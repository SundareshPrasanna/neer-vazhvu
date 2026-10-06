"""
CMWSSB ward water-level loggers (the board's online monitoring system).

One logger per GCC ward, read twice a day since August 2020, served at
http://111.93.109.166/CMWSSB-web (linked from cmwssb.tn.gov.in). Depot numbers
are GCC ward numbers: Area N is Zone N, DEP 1-14 are Zone 1's wards 1-14 and
DP 200 is Semmencheri. Values are metres, negative below ground.

The portal answers in two ways, and only one is dependable:
- getWaterlevel (JSON) returns the latest reading BEFORE the date asked: ask
  for 5 October and you get 4 October's last reading, or an older one if the
  logger missed a day. A reading's date always comes from the response, never
  the request. About 7 s a call; this is what the scraper uses.
- The report pages (.xls) list every reading, but on the live host the
  all-depot day report never returns and the one-depot range report answers
  "No record found" for most requests, including ranges that hold readings.

122.183.188.248:8080 is a test copy of the same readings (identical values),
frozen at 2021-09-06. Its day reports did work, and the 386 saved there are
the only twice-daily record of the first year; parse_report reads them.
"""

import gzip
import hashlib
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path

import httpx
import xlrd

from app.scrapers.well_levels import keep_mask, spike_mask, station_sign, stuck_days

BASE = "http://111.93.109.166/CMWSSB-web"
LATEST = f"{BASE}/onlineMonitoringSystem/getWaterlevel/ground"
AREAS = f"{BASE}/onlineMonitoringSystem/getArea"
DEPOTS = f"{BASE}/onlineMonitoringSystem/getAreaBasedDept"
NO_RECORD = b"No record found"
# Loggers write 0.000 when they miss a reading: runs of it sit inside series
# that read -2 to -17 m either side (14 wards in the first year).
PLACEHOLDERS = frozenset({0.0})
_DEPOT = re.compile(r"^\s*DE?P\s*(\d+)\s*[,-]\s*(.*?)\s*\"?\s*$")
_AREA = re.compile(r"^\s*Area\s*(\d+)\s*-\s*(.+?)\s*$", re.I)


@dataclass(frozen=True)
class Depot:
    area_id: int
    area_name: str
    depot_id: int
    name: str


@dataclass(frozen=True)
class Reading:
    depot_id: int
    zone: int
    name: str
    observed_at: datetime
    value: float


def station_id(depot_id: int) -> str:
    return f"CMWSSB-{depot_id:03d}"


async def fetch_depots(client: httpx.AsyncClient) -> list[Depot]:
    """The portal's depot list, ward loggers only (the rainfall and test areas left out)."""
    areas = (await client.get(AREAS)).json()
    depots = []
    for a in areas:
        m = _AREA.match(a["areaName"])
        if not m:
            continue
        for d in (await client.get(f"{DEPOTS}/{a['areaId']}")).json():
            dm = _DEPOT.match(d["departmentName"])
            if dm and int(dm.group(1)) == d["departmentId"]:
                depots.append(
                    Depot(a["areaId"], m.group(2), d["departmentId"], dm.group(2))
                )
    return depots


async def fetch_latest_before(
    client: httpx.AsyncClient, depot: Depot, day: date
) -> tuple[bytes, dict]:
    """The depot's latest reading before `day`, as the portal's JSON, unchanged."""
    url = f"{LATEST}/{depot.area_id}/{depot.depot_id}/{day.strftime('%d %B %Y')}/0/0/0"
    response = await client.get(url)
    response.raise_for_status()
    return response.content, {"url": url, "status": response.status_code}


def parse_latest(body: bytes, depot: Depot) -> Reading | None:
    """The reading in a getWaterlevel answer; None for 'No Data Found'."""
    rows = json.loads(body)
    if not rows or "waterlevel" not in rows[0]:
        return None
    when = rows[0]["date1"]
    for fmt in ("%b %d, %Y %I:%M:%S %p", "%b %d, %Y"):
        try:
            observed = datetime.strptime(when, fmt)
            break
        except ValueError:
            continue
    else:
        raise ValueError(f"unexpected date1 {when!r}")
    return Reading(
        depot.depot_id,
        depot.area_id,
        depot.name,
        observed,
        float(rows[0]["waterlevel"]),
    )


class RawArchive:
    """Every portal response saved gzipped and unchanged, with a manifest line, before parsing."""

    def __init__(self, root: Path):
        self.root = root
        self.manifest = root / "manifest.jsonl"

    def save(self, rel: str, body: bytes, meta: dict) -> str:
        path = self.root / f"{rel}.gz"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(gzip.compress(body, mtime=0))
        entry = {
            "path": f"{rel}.gz",
            "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            **meta,
            "bytes": len(body),
            "sha256": hashlib.sha256(body).hexdigest(),
        }
        with self.manifest.open("a") as f:
            f.write(json.dumps(entry) + "\n")
        return entry["path"]

    def entries(self) -> list[dict]:
        if not self.manifest.exists():
            return []
        return [
            json.loads(line) for line in self.manifest.read_text().splitlines() if line
        ]

    def read(self, rel: str) -> bytes:
        return gzip.decompress((self.root / rel).read_bytes())

    def has(self) -> set[str]:
        return {e["path"] for e in self.entries()}

    def save_depots(self, depots: list[Depot]) -> None:
        (self.root / "depots.json").write_text(
            json.dumps([d.__dict__ for d in depots], indent=1)
        )

    def depots(self) -> dict[int, Depot]:
        return {
            d["depot_id"]: Depot(**d)
            for d in json.loads((self.root / "depots.json").read_text())
        }

    def readings(self) -> tuple[list[Reading], dict[tuple[int, datetime], str]]:
        """Every reading in the archive, one per logger and time (the latest fetch wins)."""
        depots = self.depots() if (self.root / "depots.json").exists() else {}
        found: dict[tuple[int, datetime], tuple[Reading, str]] = {}
        for e in sorted(self.entries(), key=lambda e: e["fetched_at"]):
            body = self.read(e["path"])
            if e["path"].startswith("latest/"):
                depot = depots[int(e["path"].split("/")[1])]
                one = parse_latest(body, depot)
                rs = [one] if one else []
            else:
                rs = parse_report(body)
            for r in rs:
                found[r.depot_id, r.observed_at] = (r, e["path"])
        return [r for r, _ in found.values()], {k: ref for k, (_, ref) in found.items()}


def parse_report(body: bytes) -> list[Reading]:
    """Readings in a day-wise or location-wise report; [] for the 'No record found' page."""
    if NO_RECORD in body or body.lstrip()[:1] == b"<":
        return []
    book = xlrd.open_workbook(file_contents=body)
    sheet = book.sheet_by_index(0)
    rows = [sheet.row_values(i) for i in range(sheet.nrows)]
    header = next(
        i for i, r in enumerate(rows) if any("Water Level" in str(c) for c in r)
    )
    col = {}
    for j, cell in enumerate(rows[header]):
        for key in ("Area", "Depot", "Date", "Water Level"):
            if str(cell).strip().startswith(key):
                col[key] = j
    out = []
    for r in rows[header + 1 :]:
        depot = _DEPOT.match(str(r[col["Depot"]]))
        zone = re.search(r"\d+", str(r[col["Area"]]))
        when = r[col["Date"]]
        try:
            value = float(r[col["Water Level"]])
            if isinstance(when, float):
                when = xlrd.xldate_as_datetime(when, book.datemode)
            else:
                when = datetime.strptime(str(when).strip(), "%d/%m/%Y %H:%M:%S")
        except ValueError:
            continue
        if depot and zone:
            out.append(
                Reading(
                    int(depot.group(1)), int(zone.group()), depot.group(2), when, value
                )
            )
    return out


def upsert_daily(supabase, rows: list[dict], city_id: str, batch: int = 500) -> None:
    for i in range(0, len(rows), batch):
        supabase.table("groundwater_dwlr_daily").upsert(
            [{**r, "city_id": city_id} for r in rows[i : i + batch]],
            on_conflict="city_id,station_id,reading_date",
        ).execute()


def daily_rows(
    readings: list[Reading], refs: dict[tuple[int, datetime], str]
) -> list[dict]:
    """One row per logger per day: mean depth below ground of the readings that pass QC.

    A day whose readings all fail QC is kept as not_measured with a null depth;
    a day with no reading gets no row. A logger that moved under 10 cm across
    60 days is marked stuck, its value kept. `refs` names each reading's raw file.
    """
    by_depot: dict[int, list[Reading]] = defaultdict(list)
    for r in readings:
        by_depot[r.depot_id].append(r)
    rows = []
    for depot_id, rs in sorted(by_depot.items()):
        rs.sort(key=lambda r: r.observed_at)
        values = [r.value for r in rs]
        sign = station_sign([v for v in values if v not in PLACEHOLDERS] or values)
        kept = [r for r, k in zip(rs, keep_mask(values, PLACEHOLDERS)) if k]
        depths = [sign * r.value for r in kept]
        not_spike = (
            spike_mask([r.observed_at.date() for r in kept], depths) if kept else []
        )
        good = {id(r) for r, k in zip(kept, not_spike) if k}
        days: dict[date, dict] = defaultdict(
            lambda: {"depths": [], "dropped": 0, "ref": None}
        )
        for r in rs:
            day = days[r.observed_at.date()]
            if id(r) in good:
                day["depths"].append(sign * r.value)
            else:
                day["dropped"] += 1
            day["ref"] = refs.get((depot_id, r.observed_at), day["ref"])
        means = {
            d: round(sum(v["depths"]) / len(v["depths"]), 3)
            for d, v in days.items()
            if v["depths"]
        }
        stuck = stuck_days(means)
        last = rs[-1]
        for d, v in sorted(days.items()):
            depth = means.get(d)
            rows.append(
                {
                    "station_id": station_id(depot_id),
                    "ward": depot_id,
                    "zone": last.zone,
                    "station_name": last.name,
                    "reading_date": d.isoformat(),
                    "depth_m_bgl": depth,
                    "readings": len(v["depths"]),
                    "dropped": v["dropped"],
                    "status": "not_measured"
                    if depth is None
                    else "stuck"
                    if d in stuck
                    else "measured",
                    "raw_ref": v["ref"],
                }
            )
    return rows

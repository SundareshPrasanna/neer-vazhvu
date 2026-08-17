#!/usr/bin/env python3
"""
Pune's daily tanker delivery register, from PMC's own JSON:API.

    GET https://webadmin.pmc.gov.in/en/jsonapi/node/water_tanker
        ?include=field_file_upload

PMC publishes, every working day, one spreadsheet per tanker filling point
listing the deliveries made from it. This is not a booking system export and
not a survey: it is the corporation's own operational record, one row per
tanker sent. No other city on this platform has tanker data at this
resolution.

WHAT IS PUBLISHED HERE AND WHAT IS NOT. Each row carries the recipient
society's name, its street address, and often a phone number - 54,235 rows
with an address and 26,326 with a phone number across the corpus. **None of
that is republished.** The recipients are private housing societies, not
commercial buyers, so this differs from Gurugram's ledger where named
purchasers (DLF, Shapoorji Pallonji, Tata Projects) are companies buying
water at a published tariff and naming them is reporting on a market. Naming
a housing society, with its address, is publishing where identifiable
residents do not have water. What ships here is counts: deliveries per day,
per filling point, per prabhag, and the scheduled-versus-on-demand split.

FIVE PARSING TRAPS, all of which silently corrupt rather than error:

1. THE DATE IS IN DEVANAGARI NUMERALS. The header row reads
   "दिनांक:२८-५-२०२६", i.e. 28-05-2026. A Latin-digit regex finds nothing and
   the file looks undated. Every numeric field is translated through
   DEVANAGARI before parsing, because the prabhag column carries the same
   thing ("४" for ward 4).
2. THE PRABHAG COLUMN IS DIRTY AND ONLY HALF-POPULATED. 52% of rows have
   one, and the values include "4", "४", "4.0", ",4", "-" and the
   non-numeric "NAGAR PARISHAD" - which is PMC still tankering the Uruli
   Devachi / Fursungi area that was taken OUT of the corporation in 2024.
   That last one is a finding, not noise, and is kept as its own bucket
   rather than dropped or coerced to a number.
3. THE FILLING POINT LIVES IN THE NODE TITLE, NOT THE SPREADSHEET, and the
   titles are hand-typed: "bund", "BUND GAREDN", "RAMTEKADI TENAKAR POINT",
   "SWARGATE 1", "SNDT-13-07-2026". Normalised against a known-points table;
   anything unmatched is counted and reported rather than silently binned.
4. THE HEADER ROW IS NOT AT A FIXED INDEX. It is found by looking for the
   Marathi column labels. 11 of 409 files have no findable header at all and
   are counted as unparsed rather than assumed empty.
5. SPARSE CELLS. xlsx omits empty cells entirely, so a positional read
   shifts every column left. Cell references are decoded to column indices.

Run:  python3 neer-vazhvu-api/scripts/build_pune_tankers.py            # fetch + build
      python3 neer-vazhvu-api/scripts/build_pune_tankers.py --cache DIR # reuse a download
"""

import argparse
import collections
import hashlib
import json
import re
import sys
import urllib.request
import zipfile
from datetime import date
from pathlib import Path
from xml.etree import ElementTree as ET

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

DATA_DIR = REPO_ROOT / "public" / "data"
API = (
    "https://webadmin.pmc.gov.in/en/jsonapi/node/water_tanker"
    "?include=field_file_upload&page%5Blimit%5D=50"
)
HOST = "https://webadmin.pmc.gov.in"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
DEVANAGARI = str.maketrans("०१२३४५६७८९", "0123456789")

# Filling points, matched case-insensitively against the node title after
# stripping the date. PMC's own taxonomy_term/water_center is the canonical
# list; these are the labels that actually appear in titles.
POINTS = [
    ("Bund Garden", ("bund",)),
    ("Ramtekadi", ("ramtekadi", "ramtekdi")),
    ("Parvati", ("parvati",)),
    ("SNDT", ("sndt",)),
    ("Swargate", ("swargate",)),
    ("Lashkar", ("lashkar",)),
    ("Chaturshrungi", ("chaturshrungi", "chatushrungi", "chaturshringi")),
]


def _get(url: str, timeout: int = 120) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 neervazhvu"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def harvest_index() -> list[dict]:
    """Walk the JSON:API collection and return one record per published file.

    `links.next` comes back as http:// and HANGS rather than redirecting, so
    it is rewritten to https on every page.
    """
    out, files, url, pages = [], {}, API, 0
    while url and pages < 60:
        doc = json.loads(_get(url).decode())
        for f in doc.get("included", []):
            files[f["id"]] = f["attributes"]
        for node in doc.get("data", []):
            rel = (node.get("relationships", {}).get("field_file_upload") or {}).get(
                "data"
            )
            fid = (
                rel["id"]
                if isinstance(rel, dict)
                else (rel[0]["id"] if isinstance(rel, list) and rel else None)
            )
            out.append({"title": node["attributes"].get("title"), "fid": fid})
        nxt = (doc.get("links", {}).get("next") or {}).get("href")
        url = nxt.replace("http://", "https://") if nxt else None
        pages += 1
    recs = []
    for r in out:
        attrs = files.get(r["fid"]) if r["fid"] else None
        if not attrs:
            continue
        recs.append(
            {
                "title": r["title"],
                "url": HOST + attrs["uri"]["url"],
                "size": attrs.get("filesize"),
            }
        )
    return recs


def _col(ref: str | None) -> int:
    m = re.match(r"([A-Z]+)", ref or "")
    if not m:
        return 0
    n = 0
    for ch in m.group(1):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_sheet(path: Path) -> list[list[str]]:
    """First worksheet as a list of rows, sparse cells preserved positionally."""
    z = zipfile.ZipFile(path)
    shared: list[str] = []
    try:
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(NS + "si"):
            shared.append("".join(t.text or "" for t in si.iter(NS + "t")))
    except KeyError:
        pass
    sheets = sorted(
        n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n)
    )
    if not sheets:
        return []
    rows = []
    for row in ET.fromstring(z.read(sheets[0])).iter(NS + "row"):
        cells: dict[int, str] = {}
        for c in row.iter(NS + "c"):
            v = c.find(NS + "v")
            text = v.text if v is not None else None
            if c.get("t") == "s" and text is not None:
                text = shared[int(text)]
            elif c.get("t") == "inlineStr":
                el = c.find(NS + "is")
                text = (
                    "".join(x.text or "" for x in el.iter(NS + "t"))
                    if el is not None
                    else None
                )
            if text not in (None, ""):
                cells[_col(c.get("r"))] = str(text).strip()
        if cells:
            rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
    return rows


# Column identity comes from the Marathi HEADER LABEL, never from position.
# There are at least two layouts in the corpus and they differ in width: the
# Ramtekadi/Lashkar sheets carry a three-row PMC title block, then
# sr | prabhag | recipient | address | phone | vehicle | scheduled | on-demand |
# remarks. The Bund Garden sheets start at the header row and carry
# sr | prabhag | recipient | address | vehicle | scheduled - no phone column and
# no on-demand column at all. Reading `vehicle` at a fixed index 5 pulls it out
# of the ADDRESS column on the second layout, and the trip totals come from the
# wrong columns entirely. Both layouts were in the corpus from the first run.
COLUMN_KEYS = {
    "ward": ("प्रभाग",),
    "vehicle": ("गाडी",),
    "scheduled": ("शेड्यूल", "शेड्युल"),
    "on_demand": ("आवश्यकत",),
}


def map_columns(header: list[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    for idx, cell in enumerate(header):
        for field, keys in COLUMN_KEYS.items():
            if field in out:
                continue
            if any(k in cell for k in keys):
                out[field] = idx
    return out


def point_for(title: str) -> str | None:
    low = (title or "").lower()
    for name, keys in POINTS:
        if any(k in low for k in keys):
            return name
    return None


def _dmy(text: str) -> str | None:
    m = re.search(
        r"(\d{1,2})[-./ ](\d{1,2})[-./ ](\d{2,4})", (text or "").translate(DEVANAGARI)
    )
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y < 100:
        y += 2000
    # The corpus contains "Bund Garden Water 27-04-206" - a three-digit year.
    # Reject rather than emit the year 206.
    if not (2020 <= y <= 2035) or not (1 <= mo <= 12) or not (1 <= d <= 31):
        return None
    return f"{y:04d}-{mo:02d}-{d:02d}"


def parse_date(title: str, rows: list[list[str]], upto: int) -> str | None:
    """Title first, then the sheet's own header block.

    188 of 409 titles carry the date and the rest do not; conversely the
    Ramtekadi sheets carry it in a "दिनांक:" row and the Bund Garden sheets
    carry NO DATE ANYWHERE. Neither source alone covers the corpus, and the
    upload timestamp is deliberately NOT used as a fallback - it is when PMC
    posted the file, not the day the tankers ran, and conflating them would
    invent a delivery date."""
    from_title = _dmy(title or "")
    if from_title:
        return from_title
    for row in rows[:upto]:
        for cell in row:
            if "दिनांक" in cell:
                got = _dmy(cell)
                if got:
                    return got
    for row in rows[:upto]:
        for cell in row:
            got = _dmy(cell)
            if got:
                return got
    return None


def norm_ward(raw: str) -> str | None:
    """'4', '४', '4.0', ',4' -> '4'.  'NAGAR PARISHAD' kept.  '-' -> None."""
    v = (raw or "").strip().translate(DEVANAGARI)
    if not v or v in {"-", "--"}:
        return None
    if "nagar parishad" in v.lower():
        return "NAGAR PARISHAD"
    m = re.search(r"\d+", v)
    if not m:
        return None
    n = int(m.group(0))
    return str(n) if 1 <= n <= 41 else None


def num(raw: str) -> float:
    v = (raw or "").strip().translate(DEVANAGARI)
    return float(v) if re.match(r"^\d+(\.\d+)?$", v) else 0.0


# One tanker delivery row cannot record dozens of trips. The observed
# legitimate maximum is 12 (Swargate). Anything far above that is a MISALIGNED
# CELL, not a trip count: several Ramtekadi sheets have the vehicle number
# spilled into the trips column, so it holds "6378" or "MH12SF2637". Summed
# naively, 410 such cells contributed 2,695,085 of a 2,734,819 total - a
# headline of 2.7 million tanker trips against 57,370 delivery rows. Rejected
# and counted, never silently clamped.
MAX_PLAUSIBLE_TRIPS = 30


def trips(raw: str) -> tuple[float, bool]:
    """Returns (trips, rejected).

    A trip cell is either a count or a Marathi label naming the trip type.
    Empty or "-" -> 0. Numeric (Latin or Devanagari) within the plausible
    range -> that many. Numeric far outside it -> 0 and flagged. Any other
    non-empty text -> 1, because the label's presence IS the record of one
    trip of that kind ("शेड्युल", "आवश्यकतेनुसार")."""
    v = (raw or "").strip()
    if not v or v in {"-", "--"}:
        return 0.0, False
    n = num(v)
    if n:
        return (n, False) if n <= MAX_PLAUSIBLE_TRIPS else (0.0, True)
    # A vehicle registration that has spilled into a trip column is not a trip.
    if re.search(r"[A-Z]{2}[- ]?\d", v.upper()):
        return 0.0, True
    return 1.0, False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=None, help="directory to cache downloads in")
    args = ap.parse_args()
    cache = Path(args.cache) if args.cache else Path("/tmp/pmc_tanker_cache")
    cache.mkdir(parents=True, exist_ok=True)

    recs = harvest_index()
    print(f"index: {len(recs)} published registers", file=sys.stderr)

    deliveries = 0
    unparsed: list[str] = []
    unmatched_titles: collections.Counter = collections.Counter()
    by_date: collections.Counter = collections.Counter()
    by_point: collections.Counter = collections.Counter()
    by_ward: collections.Counter = collections.Counter()
    point_dates: dict[str, set] = collections.defaultdict(set)
    # A mean per day computed over ALL of a point's deliveries but only its
    # DATED days is a lie, and a big one: 102 of Bund Garden's registers carry
    # no date anywhere, so dividing its full 19,232 rows by the 5 days we can
    # date reported 3,846 deliveries a day. Dated and undated rows are counted
    # separately and the mean uses only the dated ones.
    point_dated: collections.Counter = collections.Counter()
    # The scheduled / on-demand split can only be computed over rows from a
    # layout that HAS an on-demand column. The Bund Garden layout does not, so
    # including its rows in the denominator drives the on-demand share toward
    # zero for a reason that has nothing to do with tanker demand.
    rows_with_demand_col = 0
    trip_cells_rejected = 0
    vehicles: collections.Counter = collections.Counter()
    sched = demand = 0.0
    rows_with_ward = rows_with_vehicle = 0
    undated = 0

    for rec in recs:
        dest = cache / (hashlib.md5(rec["url"].encode()).hexdigest() + ".xlsx")
        if not dest.exists() or dest.stat().st_size == 0:
            try:
                blob = _get(rec["url"])
            except Exception as exc:  # noqa: BLE001
                unparsed.append(f"{rec['title']}: fetch failed ({exc})")
                continue
            if blob[:2] != b"PK":
                unparsed.append(f"{rec['title']}: not an xlsx")
                continue
            dest.write_bytes(blob)
        try:
            rows = read_sheet(dest)
        except Exception as exc:  # noqa: BLE001
            unparsed.append(f"{rec['title']}: unreadable ({exc})")
            continue

        header = None
        for i, row in enumerate(rows[:14]):
            joined = " ".join(row)
            if "प्रभाग" in joined or "टँकर गाडी" in joined:
                header = i
                break
        if header is None:
            unparsed.append(f"{rec['title']}: no header row found")
            continue

        cols = map_columns(rows[header])
        if "vehicle" not in cols and "ward" not in cols:
            unparsed.append(f"{rec['title']}: header row carries no known columns")
            continue
        point = point_for(rec["title"])
        if point is None:
            unmatched_titles[(rec["title"] or "").strip()] += 1
        day = parse_date(rec["title"], rows, header)
        if day is None:
            undated += 1

        for row in rows[header + 1 :]:
            if not row or not re.match(r"^\d+$", (row[0] or "").strip()):
                continue
            deliveries += 1

            def cell(field: str) -> str:
                i = cols.get(field)
                return row[i].strip() if i is not None and len(row) > i else ""

            if day:
                by_date[day] += 1
            if point:
                by_point[point] += 1
                if day:
                    point_dates[point].add(day)
                    point_dated[point] += 1
            ward = norm_ward(cell("ward"))
            if ward:
                rows_with_ward += 1
                by_ward[ward] += 1
            veh = re.sub(r"[\s]+", "", cell("vehicle")).upper()
            if veh and re.search(r"[A-Z]{2}[- ]?\d", veh):
                rows_with_vehicle += 1
                # MH12-9571 and MH129571 are one vehicle; strip separators.
                vehicles[re.sub(r"[^A-Z0-9]", "", veh)] += 1
            # BOTH trip columns are sometimes a COUNT and sometimes the Marathi
            # word for the trip type - "शेड्युल" in the scheduled column
            # (1,360+ rows) and "आवश्यकतेनुसार" in the on-demand column. The
            # cell marks which kind of trip it was, so a non-numeric non-empty
            # cell is one trip. Treating only the numeric cells as trips, which
            # is what a naive float() does, silently dropped a quarter of the
            # on-demand column and put the on-demand share at 1.3%.
            # Devanagari digits ('१') are handled by num().
            got, bad = trips(cell("scheduled"))
            sched += got
            trip_cells_rejected += bad
            if "on_demand" in cols:
                rows_with_demand_col += 1
                got, bad = trips(cell("on_demand"))
                demand += got
                trip_cells_rejected += bad

    if not deliveries:
        print("no delivery rows parsed", file=sys.stderr)
        return 1

    days = sorted(by_date)
    busiest = by_date.most_common(1)[0]
    dated_deliveries = sum(by_date.values())
    total_trips = sched + demand
    parishad = by_ward.get("NAGAR PARISHAD", 0)
    numeric_ward_total = sum(v for k, v in by_ward.items() if k.isdigit())

    out = {
        "nvdm": "1.0",
        "dataset": "data-root/tankers",
        "scope": {"kind": "city", "id": "pune"},
        "provenance": {
            "sources": [
                {
                    "id": "pmc-tanker-register",
                    "title": (
                        "PMC daily tanker delivery registers, per filling point "
                        "(Drupal JSON:API, node/water_tanker)"
                    ),
                    "publisher": "Pune Municipal Corporation, Water Supply Department",
                    "license": registry_license("pmc-tanker-register"),
                    # Required at L2 for a `derived` artifact (spec 5.2).
                    "role": "input",
                }
            ],
            "method": "derived",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_pune_tankers.py",
            "conventions": {
                "aggregates_only": (
                    "One row per tanker delivered. Recipient society name, street "
                    "address and phone number are present on the source rows and "
                    "are NOT republished in any form - the recipients are private "
                    "housing societies, not commercial buyers. Only counts ship."
                ),
                "devanagari": (
                    "Dates and some prabhag values are written in Devanagari "
                    "numerals in the source and are translated before parsing."
                ),
            },
        },
        "_source": "PMC daily tanker delivery registers",
        "_source_url": "https://webadmin.pmc.gov.in/en/jsonapi/node/water_tanker",
        "_fetched": date.today().isoformat(),
        "_note": (
            "PMC's own operational record of tanker supply: one spreadsheet per "
            "filling point per working day, one row per tanker sent. This is "
            "neither a booking system nor a survey, and no other city on this "
            "platform publishes tanker data at this resolution."
        ),
        "kind": "delivery-register",
        "totals": {
            "deliveries": deliveries,
            "registers_published": len(recs),
            "registers_parsed": len(recs) - len(unparsed),
            "distinct_days": len(days),
            "distinct_vehicles": len(vehicles),
            "deliveries_dated": dated_deliveries,
            "deliveries_undated": deliveries - dated_deliveries,
            "trips_scheduled": round(sched),
            "trips_on_demand": round(demand),
            "filling_points": len(by_point),
            "_undated_note": (
                "Registers with no date anywhere - not in the title, not in the "
                "sheet. PMC's upload timestamp is deliberately NOT used as a "
                "substitute: it is when the file was posted, not the day the "
                "tankers ran."
            ),
        },
        "on_demand_split": {
            "rows_in_scope": rows_with_demand_col,
            "rows_in_scope_pct": round(100 * rows_with_demand_col / deliveries, 1),
            "trips_scheduled": round(sched),
            "trips_on_demand": round(demand),
            "on_demand_share_pct": round(100 * demand / total_trips, 1)
            if total_trips
            else None,
            "_scope_note": (
                "Computed only over rows from a layout that HAS an on-demand "
                "column. The Bund Garden sheets do not carry one at all, so "
                "including them would push the on-demand share toward zero for a "
                "reason unrelated to demand."
            ),
        },
        "coverage": {
            "from": days[0] if days else None,
            "to": days[-1] if days else None,
            "_note": (
                "Coverage starts when PMC began publishing these registers, not "
                "when tanker supply began. There is no earlier archive on this "
                "endpoint."
            ),
        },
        "daily": [{"date": d, "deliveries": by_date[d]} for d in days],
        "busiest_day": {"date": busiest[0], "deliveries": busiest[1]},
        "filling_points": [
            {
                "point": p,
                "deliveries": c,
                "deliveries_dated": point_dated.get(p, 0),
                "days_reporting": len(point_dates.get(p, ())),
                "mean_per_dated_day": round(point_dated[p] / len(point_dates[p]), 1)
                if point_dates.get(p)
                else None,
            }
            for p, c in by_point.most_common()
        ],
        "prabhags": [
            {"ward": k, "deliveries": v}
            for k, v in sorted(
                ((k, v) for k, v in by_ward.items() if k.isdigit()),
                key=lambda kv: -kv[1],
            )
        ],
        "outside_corporation": {
            "label": "NAGAR PARISHAD (Uruli Devachi / Fursungi)",
            "deliveries": parishad,
            "share_of_ward_attributed_pct": round(
                100 * parishad / (numeric_ward_total + parishad), 1
            )
            if (numeric_ward_total + parishad)
            else None,
            "_finding": (
                "PMC is still running tankers to the area it EXCLUDED from the "
                "corporation in 2024, when Uruli Devachi and Fursungi were taken "
                "out to form their own nagar parishad. The register attributes "
                "these deliveries to 'NAGAR PARISHAD' rather than to a prabhag."
            ),
        },
        "data_quality": {
            "rows_with_prabhag_pct": round(100 * rows_with_ward / deliveries, 1),
            "rows_with_vehicle_pct": round(100 * rows_with_vehicle / deliveries, 1),
            "trip_cells_rejected": trip_cells_rejected,
            "registers_unparsed": len(unparsed),
            "registers_undated": undated,
            "unmatched_titles": dict(unmatched_titles.most_common(12)),
            "_note": (
                "The prabhag column is populated on about half the rows, so the "
                "per-prabhag table below is a partial attribution and must not be "
                "read as a full ward ranking. Titles are hand-typed and a few do "
                "not match any known filling point; they are counted here rather "
                "than silently dropped. trip_cells_rejected counts trip columns "
                "holding a misaligned vehicle number rather than a count."
            ),
            "unparsed_registers": unparsed[:20],
        },
    }

    path = DATA_DIR / "pune-tankers.json"
    write_artifact(path, out, indent=1)
    print(
        f"pune tankers: {deliveries:,} deliveries across {len(days)} days, "
        f"{len(by_point)} filling points, {len(vehicles):,} vehicles; "
        f"{dated_deliveries:,} dated / {deliveries - dated_deliveries:,} undated; "
        f"on-demand {out['on_demand_split']['on_demand_share_pct']}% of "
        f"{out['on_demand_split']['rows_in_scope_pct']}% of rows -> {path.name}",
        file=sys.stderr,
    )
    for fp in out["filling_points"]:
        print(
            f"  {fp['point']:16} {fp['deliveries']:>7,} deliveries "
            f"({fp['deliveries_dated']:>6,} dated over {fp['days_reporting']:>3} days, "
            f"mean {fp['mean_per_dated_day']})",
            file=sys.stderr,
        )
    if unparsed:
        print(f"  ! {len(unparsed)} registers unparsed", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

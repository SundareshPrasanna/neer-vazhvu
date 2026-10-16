#!/usr/bin/env python3
"""
Daily reservoir storage for Andhra Pradesh cities from APWRIMS, the Water
Resources Department's open reservoir API (apwrims.ap.gov.in, built by Vassar
Labs). No login, no cookies: plain JSON over HTTPS.

Two endpoints, both read on every run:

  POST /api/reservoir/timeseries   format DAILY, one call for every dam and
      any date range -> {uuid: {"reservoirName", YYYYMMDD: {level (m),
      storage (TMC, GROSS), inflow, outflow (cusecs),
      levelStorageEventGenTS (epoch ms), ...}}}. The archive runs from 2012
      for Yeleru and from late 2014-2015 for the others.
  GET  /api/v2/wateraudit/report/{uuid}/Reservoirs   reservoirAttrs: full
      reservoir level, design (gross) capacity, dead storage and its level.

THE ATTRIBUTES ARE CHECKED, NOT TRUSTED. FRL, design gross, dead storage and
the dead-storage level are hard-coded per dam below and compared with what
APWRIMS serves on every run; any difference stops the run before anything is
written. Every derived number (live storage, its share, the sanity band)
hangs off those four values, so a silent revision upstream must surface as a
failure, not as a quietly different percentage. The response's own
reservoirName is checked against the uuid too.

STORAGE IS LIVE STORAGE, the platform convention (Pune's Pravah feed, see
scrape_pravah_dams.py): water above the lowest outlet, as a share of designed
live capacity. APWRIMS publishes GROSS storage, so live = gross - design dead
storage, floored at zero (Yeleru spends long dry spells below its dead-storage
level). Gross storage and the gross share are kept in the JSON artifact.
Meghadrigedda is the exception up to 15 Sep 2026 (published_live_until): its
figures then were live storage. They reach 1.04 TMC at full reservoir level
(31 Dec 2019), its design live capacity, where gross is 1.169. From 16 Sep 2026
the same levels read 0.13 TMC higher (14.417 m: 0.102 on 4 Sep, 0.228 on
23 Sep). Those earlier figures are used as live, and gross is published + dead.
Two readings either side of the switch are checked on every run that fetches
them (basis_pins); a restated archive stops the run.

ONE LEVEL RECORD PER DAM. Each reading names its levelSource. Raiwada and
Thatipudi switch between sources 4 and 42 from late 2021 until 7 Mar 2024,
and the two disagree (Thatipudi's 42 reads about 4.4 m above its 4, so storage
jumps with the source); since 8 Mar 2024 every reading is 42. From the first
42 reading (level_source_since) only 42 is kept, so the series follows the
record APWRIMS publishes today; earlier history is source 4.

DATES. Each reading is dated by the IST date of its own
levelStorageEventGenTS, not by the YYYYMMDD key it sits under. In range
requests the two agree (every reading 2012-2026, checked), but single-day
requests (sDate == eDate) for dates in 2016-2019 returned the NEXT morning's
reading under the requested key, so a key is not a date. Two keys carrying one timestamp (a carried-forward value) collapse to one
reading. Readings with no timestamp (Raiwada and Thatipudi before late 2015)
keep their key. Every range is fetched with a day of padding each side and
trimmed after re-dating.

SANITY CHECKS. A reading is rejected, and counted by reason in the artifact,
when: level is 0.0 while storage is positive (Nov 2015, every dam: zero
levels beside random storage values); level falls outside
[dead-storage level - 5 m, FRL + 2 m] (2020 Yeleru rows filed in feet,
280.45 "m"); storage exceeds design gross by more than 2%; or storage is
exactly 0.0, which is how blank entries appear in this archive (Raiwada, March
2016, at a 109.6 m level where other days in the archive hold about 2 TMC).
Level and storage must also agree (level_storage_mismatch). Storage below dead
storage with the level more than 0.1 m above the dead-storage level is
rejected (Raiwada, Aug 2012 and Mar 2019, 2-3 m above it). So is gross storage
more than 5% of live capacity above the straight line from dead storage at
the dead-storage level to design gross at FRL: a reservoir widens as it fills,
so its storage curve sits below that line (Meghadrigedda, four days in
May-Jun 2017, Apr-Jul 2024 and 6-10 Sep 2026, about ten times the live
storage other days give at the same level; Thatipudi, 31 Dec 2014 and
1 Jan 2015). Every other reading in the 2012-2026 archive sits within 1.5%
of live capacity of the line or below it.

DATABASE. --supabase upserts reservoir_daily_v2 (storage_tmc = live TMC,
storage_pct_frl = live share) for the last --days days on every run, so a
reading that lands late fills in on the next run. The newest day waits until
every dam has reported (held_back), because the dashboard cards key on one
latest date per city.

Run (from neer-vazhvu-api/):
  python3 scripts/scrape_apwrims_reservoirs.py --city visakhapatnam
      writes public/data/visakhapatnam-dam-storage.json (latest + 30 days)
  ... --city visakhapatnam --supabase            also upserts the last 7 days
  ... --city visakhapatnam --days 3 --dry-run    print the rows, write nothing
  ... --city visakhapatnam --backfill-from 2012-01-01 [--to YYYY-MM-DD]
      [--supabase | --dry-run]                   year-paged history
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

API = "https://apwrims.ap.gov.in/api"
TIMESERIES_URL = f"{API}/reservoir/timeseries"
ATTRS_URL = API + "/v2/wateraudit/report/{uuid}/Reservoirs"
AP_STATE_UUID = "6f86292b-dd9a-4987-bb8f-c3940263b349"
SOURCE_ID = "apwrims-reservoirs"
SOURCE_LABEL = "APWRIMS daily reservoir feed (AP Water Resources Department)"
UA = "Mozilla/5.0 neervazhvu-apwrims (water-data platform; one request at a time)"
IST = timezone(timedelta(hours=5, minutes=30))
FT_PER_M = 3.280839895
MCUM_PER_TMC = 28.3168
PAUSE_S = 1.5
HISTORY_DAYS = 30

# source_code -> APWRIMS identity and the design values the run verifies.
# All four from reservoirAttrs, read 2026-10-14. Yeleru's 24.11 gross and
# 6.16 dead give 17.95 TMC live, which is CWC's 0.508 BCM and the National
# Register of Large Dams 2019 row AP01HH0149 (508,300,000 m3 effective). NRLD
# also agrees on Raiwada (101,940,000 m3 gross = 3.60 TMC), Thatipudi
# (94,164,000 m3 = 3.325 TMC; 89,910,000 m3 effective = 3.175 TMC live) and
# Meghadrigedda (row AP01MH0042, 33,102,000 m3 gross = 1.169 TMC).
VISAKHAPATNAM_DAMS = {
    "yeleru": {
        "uuid": "2047859b-a4c5-4f4b-a9e6-35d06bdf0fab",
        "apwrims_name": "YELERU RESERVOIR",
        "display_name": "Yeleru",
        "river": "Yeleru",
        "frl_m": 86.56,
        "mddl_m": 72.561,
        "gross_tmc": 24.11,
        "dead_tmc": 6.16,
    },
    "raiwada": {
        "uuid": "53a12642-b27f-4a34-9ac0-19bab3af825f",
        "apwrims_name": "RAIWADA RESERVOIR",
        "display_name": "Raiwada",
        "river": "Sarada",
        "frl_m": 113.925,
        "mddl_m": 98.935,
        "gross_tmc": 3.60,
        "dead_tmc": 0.33,
        "level_source_since": ("42", "2021-12-13"),
    },
    "thatipudi": {
        "uuid": "eeb82fe7-e68a-4c75-9eb7-456b2581083c",
        "apwrims_name": "THATIPUDI RESERVOIR",
        "display_name": "Thatipudi",
        "river": "Gosthani",
        "frl_m": 90.526,
        "mddl_m": 76.511,
        "gross_tmc": 3.325,
        "dead_tmc": 0.15,
        "level_source_since": ("42", "2021-09-07"),
    },
    # APWRIMS spells it MEHADRIGADD. GVMC writes Meghadrigedda (its 2021 NGT
    # filings also write Mehadrigedda), NRLD 2019 Mehadrigedda and CGWB
    # Meghadrigadda. Same dam: Pendurthi mandal, inside GVMC.
    "meghadrigedda": {
        "uuid": "e964c4dd-6a15-4147-9104-0a9626d1ac80",
        "apwrims_name": "MEHADRIGADD RESERVOIR",
        "display_name": "Meghadrigedda",
        "river": "Naravagedda",
        "frl_m": 18.593,
        "mddl_m": 13.411,
        "gross_tmc": 1.169,
        "dead_tmc": 0.13,
        # Published figures were live storage up to this date (module
        # docstring, STORAGE); NRLD's effective 29,530,000 m3 is 1.043 TMC.
        "published_live_until": "2026-09-15",
        "basis_pins": {"2026-09-15": 0.0807, "2026-09-16": 0.204},
    },
}

CITIES = {
    "visakhapatnam": {
        "dams": VISAKHAPATNAM_DAMS,
        "corporations": ["gvmc"],
        "out_default": "public/data/visakhapatnam-dam-storage.json",
        "note": (
            "Live storage for the four reservoirs that feed GVMC, from the "
            "APWRIMS daily reservoir feed. Yeleru's storage includes Godavari "
            "water that the Purushottapatnam lift sends through the Polavaram "
            "Left Main Canal into the reservoir (since July 2018). VIWSCO's "
            "Kateru pump house sends Godavari water through a 56 km pipeline into "
            "the Yeleru canal (since December 2004), not into the reservoir, so "
            "that water is not in these figures. All four are "
            "multi-use: irrigation, industry and the city draw on the same "
            "storage. GVMC's own Mudasarlova reservoir and the Gambhiramgedda "
            "reservoir are not in this feed."
        ),
    },
}

STORAGE_NOTE = (
    "storage_tmc, storage_mcum and storage_pct_live are LIVE storage: APWRIMS "
    "publishes gross storage in TMC, and live storage is gross minus the design "
    "dead storage (the water below the lowest outlet), floored at zero. "
    "storage_pct_live is live storage as a share of designed live capacity. "
    "gross_storage_tmc and gross_pct keep the published gross figures. Each "
    "reading is dated by the IST date of its own timestamp. Readings that fail "
    "a sanity check are counted under quality.rejected and left out."
)
LIVE_PUBLISHED_NOTE = (
    "Up to {until}, APWRIMS published {name}'s storage as live storage, not "
    "gross: those figures reach the design live capacity at full reservoir "
    "level, and from the next day the same levels read higher by the dead "
    "storage. They are used as live storage, and gross_storage_tmc for those "
    "days is the published figure plus the dead storage."
)


# ---------------------------------------------------------------- network


def _call(url: str, body: dict | None = None, tries: int = 3):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"User-Agent": UA}
    if data is not None:
        headers["Content-Type"] = "application/json"
    for attempt in range(tries):
        try:
            req = urllib.request.Request(
                url, data=data, headers=headers, method="POST" if data else "GET"
            )
            with urllib.request.urlopen(req, timeout=90) as resp:
                out = json.loads(resp.read())
            time.sleep(PAUSE_S)
            return out
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            if attempt == tries - 1:
                raise
            print(f"  retry {attempt + 1} for {url}: {exc}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))


def fetch_attrs(uuid: str) -> dict:
    return _call(ATTRS_URL.format(uuid=uuid))


def fetch_timeseries(uuids: list[str], start: date, end: date) -> dict:
    return _call(
        TIMESERIES_URL,
        {
            "pEUUID": AP_STATE_UUID,
            "pUUID": uuids,
            "pType": "RESERVOIR",
            "cType": "RESERVOIR",
            "src": "STATE_AND_CENTRAL_STATIONS",
            "format": "DAILY",
            "sDate": start.strftime("%Y%m%d"),
            "eDate": end.strftime("%Y%m%d"),
            "classification": ["AGGREGATED_DATA"],
            "aggr": "LATEST",
        },
    )


# ---------------------------------------------------------------- parsing


def check_attrs(code: str, dam: dict, meta: dict) -> list[str]:
    """Differences between the hard-coded design values and APWRIMS's."""
    errs = []
    if meta.get("locationName") != dam["apwrims_name"]:
        errs.append(
            f"{code}: uuid {dam['uuid']} is {meta.get('locationName')!r}, "
            f"expected {dam['apwrims_name']!r}"
        )
    attrs = meta.get("reservoirAttrs") or {}
    for key, field in (
        ("frl_m", "fullreservoirlevel"),
        ("gross_tmc", "designcapacity"),
        ("dead_tmc", "deadstorage"),
        ("mddl_m", "deadstoragelevel"),
    ):
        raw = attrs.get(field)
        try:
            value = float(raw)
        except (TypeError, ValueError):
            errs.append(f"{code}: {field} is {raw!r}, expected {dam[key]}")
            continue
        if abs(value - dam[key]) > 1e-9:
            errs.append(f"{code}: {field} is {value}, expected {dam[key]}")
    return errs


def reject_reason(level: float | None, storage: float, dam: dict) -> str | None:
    """storage is gross TMC (see SANITY CHECKS in the module docstring)."""
    if storage == 0.0:
        return "zero_storage"
    if level == 0.0 and storage > 0:
        return "zero_level_with_storage"
    if level is not None and not (dam["mddl_m"] - 5 <= level <= dam["frl_m"] + 2):
        return "level_out_of_range"
    if storage < 0 or storage > dam["gross_tmc"] * 1.02:
        return "storage_out_of_range"
    if level is not None and level >= dam["mddl_m"]:
        live_cap = dam["gross_tmc"] - dam["dead_tmc"]
        up = (level - dam["mddl_m"]) / (dam["frl_m"] - dam["mddl_m"])
        if storage <= dam["dead_tmc"] and level > dam["mddl_m"] + 0.1:
            return "level_storage_mismatch"
        if storage > dam["dead_tmc"] + live_cap * (up + 0.05):
            return "level_storage_mismatch"
    return None


def _int(v) -> int | None:
    # reservoir_daily_v2 inflow/outflow are INTEGER columns.
    return None if v is None else int(round(float(v)))


def parse_timeseries(
    payload: dict, dams: dict, start: date, end: date
) -> tuple[dict[str, dict[str, dict]], Counter, list[dict]]:
    """Accepted readings {code: {iso_date: reading}} within [start, end], the
    counts, and the rejected readings."""
    by_uuid = {d["uuid"]: code for code, d in dams.items()}
    readings: dict[str, dict[str, dict]] = {code: {} for code in dams}
    counts: Counter = Counter()
    rejected: list[dict] = []
    for uuid, record in payload.items():
        code = by_uuid.get(uuid)
        if code is None:
            continue
        dam = dams[code]
        if record.get("reservoirName") != dam["apwrims_name"]:
            raise SystemExit(
                f"{code}: timeseries names uuid {uuid} "
                f"{record.get('reservoirName')!r}, expected {dam['apwrims_name']!r}"
            )
        live_cap = dam["gross_tmc"] - dam["dead_tmc"]
        for key, v in record.items():
            if not (key.isdigit() and isinstance(v, dict)):
                continue
            storage = v.get("storage")
            if storage is None:
                counts["no_storage_value"] += 1
                continue
            ts = v.get("levelStorageEventGenTS")
            keyed = date(int(key[:4]), int(key[4:6]), int(key[6:8]))
            if ts is None:
                counts["no_timestamp"] += 1
                day, when = keyed, None
            else:
                when = datetime.fromtimestamp(ts / 1000, IST)
                day = when.date()
                if day != keyed:
                    counts["redated_to_timestamp"] += 1
            if not (start <= day <= end):
                continue
            iso = day.isoformat()
            pin = dam.get("basis_pins", {}).get(iso)
            if pin is not None and storage != pin:
                raise SystemExit(
                    f"{code}: APWRIMS now reads {storage} TMC on {iso}, expected "
                    f"{pin}; recheck published_live_until before writing anything"
                )
            if storage > 0 and iso <= dam.get("published_live_until", ""):
                storage = round(storage + dam["dead_tmc"], 4)
            level = v.get("level")
            reason = reject_reason(level, storage, dam)
            keep = dam.get("level_source_since")
            if (
                not reason
                and keep
                and iso >= keep[1]
                and str(v.get("levelSource")) != keep[0]
            ):
                reason = "superseded_level_source"
            if reason:
                counts[f"rejected_{reason}"] += 1
                rejected.append(
                    {
                        "source_code": code,
                        "date": iso,
                        "level_m": level,
                        "gross_storage_tmc": storage,
                        "reason": reason,
                    }
                )
                continue
            prior = readings[code].get(iso)
            if prior is not None:
                counts["duplicate_reading_date"] += 1
                if (prior["_ts"] or 0) >= (ts or 0):
                    continue
            live = max(0.0, storage - dam["dead_tmc"])
            readings[code][iso] = {
                "_ts": ts,
                "date": iso,
                "reading_time": when.isoformat(timespec="minutes") if when else None,
                "level_m": level,
                "level_ft": None if level is None else round(level * FT_PER_M, 2),
                "gross_storage_tmc": storage,
                "gross_pct": round(storage / dam["gross_tmc"] * 100, 2),
                "storage_tmc": round(live, 3),
                "storage_pct_live": round(live / live_cap * 100, 2),
                "below_dead_storage": storage < dam["dead_tmc"],
                "inflow_cusecs": _int(v.get("inflow")),
                "outflow_cusecs": _int(v.get("outflow")),
            }
    for code in readings:
        for r in readings[code].values():
            r.pop("_ts")
        counts["accepted"] += len(readings[code])
        counts["below_dead_storage"] += sum(
            r["below_dead_storage"] for r in readings[code].values()
        )
    return readings, counts, rejected


def held_back(readings: dict[str, dict[str, dict]], today: date) -> set[str]:
    """Dates to keep out of the database for now: newer than the last date on
    which every dam reported, and no older than yesterday. The dashboard keys
    its cards on one latest date per city, so a morning run that lands before
    the slower dams report would show those dams as having no reading. Only
    yesterday and today are ever held, so a dam that stops reporting delays
    the others by two days at most, and not at all once it has been silent
    for a week (only dams heard from in the last week count as "every dam")."""
    recent = (today - timedelta(days=7)).isoformat()
    active = [set(r) for r in readings.values() if any(d >= recent for d in r)]
    complete = set.intersection(*active) if active else set()
    latest_complete = max(complete, default="")
    cutoff = (today - timedelta(days=1)).isoformat()
    every = set().union(*(set(r) for r in readings.values()))
    return {d for d in every if d > latest_complete and d >= cutoff}


def db_rows(city: str, readings: dict[str, dict[str, dict]], dates: set[str]):
    return [
        {
            "city_id": city,
            "source_code": code,
            "date": iso,
            "storage_tmc": r["storage_tmc"],
            "storage_pct_frl": r["storage_pct_live"],
            "level_ft": r["level_ft"],
            "inflow_cusecs": r["inflow_cusecs"],
            "outflow_cusecs": r["outflow_cusecs"],
            "source": SOURCE_LABEL,
            "scraped_from": TIMESERIES_URL,
        }
        for code in sorted(readings)
        for iso, r in sorted(readings[code].items())
        if iso in dates
    ]


# ---------------------------------------------------------------- artifact


def _long_date(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.day} {d:%B %Y}"


def _same_day_last_year(iso: str) -> str:
    d = date.fromisoformat(iso)
    try:
        return d.replace(year=d.year - 1).isoformat()
    except ValueError:  # 29 Feb
        return d.replace(year=d.year - 1, day=28).isoformat()


def build_artifact(
    city: str, cfg: dict, readings: dict, counts: Counter, rejected: list, window
) -> dict:
    as_of = max((max(r) for r in readings.values() if r), default=None)
    first_day = (
        (date.fromisoformat(as_of) - timedelta(days=HISTORY_DAYS - 1)).isoformat()
        if as_of
        else None
    )
    dams_out = []
    for code, dam in sorted(cfg["dams"].items()):
        series = readings.get(code, {})
        gross_cap = dam["gross_tmc"]
        live_cap = round(gross_cap - dam["dead_tmc"], 3)
        entry = {
            "source_code": code,
            "apwrims_name": dam["apwrims_name"],
            "apwrims_uuid": dam["uuid"],
            "display_name": dam["display_name"],
            "river": dam["river"],
            "corporations": cfg["corporations"],
            "frl_m": dam["frl_m"],
            "mddl_m": dam["mddl_m"],
            "gross_capacity_tmc": gross_cap,
            "dead_storage_tmc": dam["dead_tmc"],
            "live_capacity_tmc": live_cap,
            "gross_capacity_mcum": round(gross_cap * MCUM_PER_TMC, 2),
            "dead_storage_mcum": round(dam["dead_tmc"] * MCUM_PER_TMC, 2),
            "live_capacity_mcum": round(live_cap * MCUM_PER_TMC, 2),
        }
        if series:
            latest = series[max(series)]
            entry.update(latest)
            entry["storage_mcum"] = round(latest["storage_tmc"] * MCUM_PER_TMC, 2)
            ly = series.get(_same_day_last_year(latest["date"]))
            entry["last_year_date"] = _same_day_last_year(latest["date"])
            entry["last_year_storage_tmc"] = ly["storage_tmc"] if ly else None
            entry["last_year_storage_mcum"] = (
                round(ly["storage_tmc"] * MCUM_PER_TMC, 2) if ly else None
            )
            entry["last_year_pct_live"] = ly["storage_pct_live"] if ly else None
        else:
            entry["date"] = None
        entry["history"] = [
            {
                k: r[k]
                for k in (
                    "date",
                    "level_m",
                    "gross_storage_tmc",
                    "storage_tmc",
                    "storage_pct_live",
                    "inflow_cusecs",
                    "outflow_cusecs",
                )
            }
            for iso, r in sorted(series.items())
            if first_day and iso >= first_day
        ]
        entry["days_reported_last_30"] = len(entry["history"])
        dams_out.append(entry)

    return {
        "nvdm": "1.0",
        # Path-derived with the city token stripped, like pune-dam-storage.json.
        "dataset": "data-root/dam-storage",
        "scope": {"kind": "city", "id": city},
        "provenance": {
            "sources": [
                {
                    "id": SOURCE_ID,
                    "title": "APWRIMS reservoir daily timeseries and reservoir attributes",
                    "publisher": (
                        "Water Resources Department, Government of Andhra "
                        "Pradesh (APWRIMS)"
                    ),
                    "license": registry_license(SOURCE_ID),
                }
            ],
            "method": "api",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/scrape_apwrims_reservoirs.py",
            "note": (
                "Read from the APWRIMS JSON API. Live storage is computed as "
                "published gross storage minus design dead storage, except "
                "where storage_note says APWRIMS published live storage; the "
                "design values are checked against APWRIMS's reservoir "
                "attributes on every run. Readings are dated by their own "
                "timestamps."
            ),
        },
        "_source": SOURCE_LABEL,
        "_source_url": TIMESERIES_URL,
        "_fetched": datetime.now(IST).date().isoformat(),
        "_note": cfg["note"],
        "storage_note": " ".join(
            [STORAGE_NOTE]
            + [
                LIVE_PUBLISHED_NOTE.format(
                    until=_long_date(d["published_live_until"]),
                    name=d["display_name"],
                )
                for _, d in sorted(cfg["dams"].items())
                if d.get("published_live_until")
            ]
        ),
        "as_of": as_of,
        "quality": {
            "window": {"start": window[0].isoformat(), "end": window[1].isoformat()},
            "readings_accepted": counts["accepted"],
            "rejected": {
                k.removeprefix("rejected_"): n
                for k, n in sorted(counts.items())
                if k.startswith("rejected_")
            },
            "below_dead_storage": counts["below_dead_storage"],
            "redated_to_timestamp": counts["redated_to_timestamp"],
            "duplicate_reading_date": counts["duplicate_reading_date"],
            "no_storage_value": counts["no_storage_value"],
            "rejected_last_30_days": [
                r for r in rejected if first_day and r["date"] >= first_day
            ],
        },
        "dams": dams_out,
    }


# ---------------------------------------------------------------- main


def _upsert(rows: list[dict]) -> None:
    from supabase import create_client

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    for i in range(0, len(rows), 500):
        sb.table("reservoir_daily_v2").upsert(
            rows[i : i + 500], on_conflict="city_id,source_code,date"
        ).execute()


def _fetch_range(dams: dict, start: date, end: date):
    """Readings in [start, end], fetched by calendar year with a day of padding
    each side (see DATES in the module docstring)."""
    uuids = [d["uuid"] for d in dams.values()]
    readings: dict[str, dict[str, dict]] = {code: {} for code in dams}
    counts: Counter = Counter()
    rejected: list[dict] = []
    year = start.year
    while year <= end.year:
        lo = max(start, date(year, 1, 1))
        hi = min(end, date(year, 12, 31))
        payload = fetch_timeseries(
            uuids, lo - timedelta(days=1), hi + timedelta(days=1)
        )
        r, c, rej = parse_timeseries(payload, dams, lo, hi)
        for code in r:
            readings[code].update(r[code])
        counts.update(c)
        rejected.extend(rej)
        missing = [code for code in dams if dams[code]["uuid"] not in payload]
        print(
            f"  {lo}..{hi}: "
            + ", ".join(f"{code} {len(r[code])}" for code in sorted(r))
            + (f" | absent from response: {missing}" if missing else ""),
            file=sys.stderr,
        )
        year += 1
    return readings, counts, rejected


def _print_rows(rows: list[dict]) -> None:
    show = rows if len(rows) <= 60 else rows[:5] + rows[-5:]
    for row in show:
        print(json.dumps({k: v for k, v in row.items() if k != "scraped_from"}))
    if len(rows) > 60:
        print(f"... {len(rows) - 10} more rows not shown")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True, choices=sorted(CITIES))
    ap.add_argument(
        "--out", help="artifact path (default: the city's public/data file)"
    )
    ap.add_argument(
        "--days",
        type=int,
        default=7,
        help="daily mode: upsert this many most recent days (late readings fill in)",
    )
    ap.add_argument("--backfill-from", help="YYYY-MM-DD: page the archive by year")
    ap.add_argument("--to", help="YYYY-MM-DD: backfill end (default today, IST)")
    ap.add_argument(
        "--supabase",
        action="store_true",
        help="upsert reservoir_daily_v2 (needs SUPABASE_URL + SUPABASE_SERVICE_KEY)",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="print the rows --supabase would upsert; write nothing",
    )
    args = ap.parse_args()
    if args.supabase and args.dry_run:
        ap.error("--supabase and --dry-run are exclusive")
    cfg = CITIES[args.city]
    dams = cfg["dams"]
    today = datetime.now(IST).date()

    errs = []
    for code, dam in sorted(dams.items()):
        errs += check_attrs(code, dam, fetch_attrs(dam["uuid"]))
    if errs:
        print("APWRIMS design values differ from this script's:", file=sys.stderr)
        for e in errs:
            print(f"  {e}", file=sys.stderr)
        raise SystemExit(2)

    if args.backfill_from:
        start = date.fromisoformat(args.backfill_from)
        end = date.fromisoformat(args.to) if args.to else today
        readings, counts, _ = _fetch_range(dams, start, end)
        dates = set().union(*(set(r) for r in readings.values()))
    else:
        # A year and a week back, so the artifact can carry the same date
        # last year from the archive itself.
        start = today - timedelta(days=372)
        end = today
        readings, counts, rejected = _fetch_range(dams, start, end)
        dates = {(today - timedelta(days=i)).isoformat() for i in range(args.days)}

    hold = held_back(readings, today)
    rows = db_rows(args.city, readings, dates - hold)
    rej = {
        k.removeprefix("rejected_"): n
        for k, n in sorted(counts.items())
        if k.startswith("rejected_")
    }
    print(
        f"APWRIMS {args.city}: {counts['accepted']} readings accepted, "
        f"{sum(rej.values())} rejected {rej}; {len(rows)} rows for reservoir_daily_v2"
        + (f" (held back until every dam reports: {sorted(hold)})" if hold else ""),
        file=sys.stderr,
    )

    if not args.backfill_from:
        for code in sorted(dams):
            series = readings[code]
            if not series:
                print(f"  {code:14} NO READING in the window", file=sys.stderr)
                continue
            r = series[max(series)]
            print(
                f"  {code:14} {r['date']} level {r['level_m']} m  gross "
                f"{r['gross_storage_tmc']} TMC  live {r['storage_tmc']} TMC "
                f"({r['storage_pct_live']}% of live)",
                file=sys.stderr,
            )
        if not args.dry_run:
            out = Path(args.out) if args.out else REPO_ROOT / cfg["out_default"]
            artifact = build_artifact(
                args.city, cfg, readings, counts, rejected, (start, end)
            )
            write_artifact(out, artifact)
            print(f"wrote {out}", file=sys.stderr)

    if args.dry_run:
        _print_rows(rows)
    elif args.supabase and rows:
        _upsert(rows)
        print(f"upserted {len(rows)} rows to reservoir_daily_v2", file=sys.stderr)
    return 0 if counts["accepted"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

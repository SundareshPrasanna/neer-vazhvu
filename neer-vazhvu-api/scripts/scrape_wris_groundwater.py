#!/usr/bin/env python3
"""
Daily groundwater station ingest for one city's district.

Fetches the last N days (default 90) of station readings (manual +
DWLR/telemetric) from India WRIS and upserts them into the multi-city
groundwater_wris table on the city-aware key. When WRIS fails or its newest
reading is over a week old, the NWIC National Water Data Portal (the same WIMS
series) fills the days WRIS does not have.

Bengaluru Urban is CGWB-only: the Karnataka State Ground Water Department does
not publish to India-WRIS under any agency name probed (2026-05). Its CGWB
telemetric stations back the IISc stress-ward map.

Usage:
    cd neer-vazhvu-api
    python scripts/scrape_wris_groundwater.py --city chennai|madurai|bangalore [--dry-run]
"""

import argparse
import asyncio
import os
import sys
from datetime import date, timedelta

from dotenv import load_dotenv

load_dotenv()

from supabase import create_client  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.scrapers.nwdp import (  # noqa: E402
    CGWB_KARNATAKA,
    CGWB_TAMIL_NADU,
    STATE_TAMIL_NADU,
    fetch_nwdp_groundwater,
    join_to_stations,
)
from app.scrapers.wris import fetch_wris_groundwater  # noqa: E402

CITIES = {
    "chennai": {
        "label": "Chennai",
        "state": "Tamil Nadu",
        "district": "Chennai",
        "agencies": ["CGWB", "Tamil Nadu SW GW"],
        "nwdp": [CGWB_TAMIL_NADU, STATE_TAMIL_NADU],
    },
    "madurai": {
        "label": "Madurai",
        "state": "Tamil Nadu",
        "district": "Madurai",
        "agencies": ["CGWB", "Tamil Nadu SW GW"],
        "nwdp": [CGWB_TAMIL_NADU, STATE_TAMIL_NADU],
    },
    "bangalore": {
        "label": "Bangalore Urban",
        "state": "Karnataka",
        "district": "Bangalore Urban",
        "agencies": ["CGWB"],
        "nwdp": [CGWB_KARNATAKA],
    },
}

WRIS_STALE_DAYS = 7  # newest WRIS reading older than this: fill from NWDP
# The columns a reading row shares with its station in groundwater_wris_latest.
STATION_COLS = (
    "station_code",
    "station_name",
    "latitude",
    "longitude",
    "agency",
    "district",
    "well_type",
    "well_depth_m",
    "well_aquifer_type",
)


def _get_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        print(f"ERROR: {key} environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    return value


def _env_int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    if not raw:
        return default
    try:
        v = int(raw)
        return v if v > 0 else default
    except ValueError:
        return default


async def main(city_id: str, dry_run: bool = False) -> int:
    city = CITIES[city_id]
    supabase_url = _get_env("SUPABASE_URL")
    supabase_key = _get_env("SUPABASE_SERVICE_KEY")
    supabase = create_client(supabase_url, supabase_key)

    days = _env_int(f"{city_id.upper()}_WRIS_DAYS", 90)
    end = date.today()
    start = end - timedelta(days=days)

    print(
        f"Fetching WRIS {city['label']} records {start} -> {end} (window={days}d)...",
        flush=True,
    )

    rows: list[dict] = []
    answered = False
    try:
        records = await fetch_wris_groundwater(
            start_date=start,
            end_date=end,
            state=city["state"],
            district=city["district"],
            agencies=city["agencies"],
        )
        answered = True
        rows = [
            {
                **{c: getattr(r, c) for c in STATION_COLS},
                "reading_date": r.reading_date.isoformat(),
                "depth_to_water_m": r.depth_to_water_m,
                "acquisition_mode": r.acquisition_mode,
            }
            for r in records
        ]
        print(f"  Got {len(rows)} deduplicated daily records", flush=True)
    except Exception as exc:
        print(
            f"ERROR: WRIS fetch failed: {type(exc).__name__}: {exc!r}",
            file=sys.stderr,
            flush=True,
        )

    newest = max((r["reading_date"] for r in rows), default="")
    if newest < (end - timedelta(days=WRIS_STALE_DAYS)).isoformat():
        print(
            f"  WRIS newest reading: {newest or 'none'}; filling from NWDP...",
            flush=True,
        )
        try:
            # NWDP resources are telemetry, and names repeat across manual wells.
            stations = (
                supabase.table("groundwater_wris_latest")
                .select(",".join(STATION_COLS))
                .eq("city_id", city_id)
                .eq("acquisition_mode", "Telemetric")
                .execute()
                .data
            )
            daily = await fetch_nwdp_groundwater(
                start, end, city["district"], city["nwdp"]
            )
            have = {(r["station_code"], r["reading_date"]) for r in rows}
            filled, unjoined = join_to_stations(daily, stations, have)
            answered = True
            rows += filled
            print(f"  NWDP added {len(filled)} daily records", flush=True)
            if unjoined:
                print(
                    f"  NWDP stations not joined to a known station: {sorted(unjoined)}"
                )
        except Exception as exc:
            print(
                f"ERROR: NWDP fetch failed: {type(exc).__name__}: {exc!r}",
                file=sys.stderr,
                flush=True,
            )

    if not answered:
        return 1

    if not rows:
        # Both sources return zero rows when the network has stopped reporting;
        # exit cleanly so the daily pipeline does not red-flag the run.
        print("  No new readings; exiting cleanly.", flush=True)
        return 0

    modes: dict[str, int] = {}
    for r in rows:
        modes[r["acquisition_mode"]] = modes.get(r["acquisition_mode"], 0) + 1
    print(
        f"  unique_stations={len({r['station_code'] for r in rows})} "
        f"modes={dict(sorted(modes.items()))} "
        f"newest_reading={max(r['reading_date'] for r in rows)}",
        flush=True,
    )
    if dry_run:
        print(f"Dry run: {len(rows)} rows not written.", flush=True)
        return 0

    batch_size = 200
    for i in range(0, len(rows), batch_size):
        batch = [
            {**r, "city_id": city_id, "source": "cgwb"}
            for r in rows[i : i + batch_size]
        ]
        supabase.table("groundwater_wris").upsert(
            batch, on_conflict="city_id,station_code,reading_date"
        ).execute()
        print(f"  Upserted {i + len(batch)}/{len(rows)}", flush=True)

    print("Done.", flush=True)
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--city", required=True, choices=sorted(CITIES))
    parser.add_argument(
        "--dry-run", action="store_true", help="fetch and report, write nothing"
    )
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.city, args.dry_run)))

#!/usr/bin/env python3
"""
Daily WRIS groundwater ingest for one city's district.

Fetches the last N days (default 90) of station readings (manual +
DWLR/telemetric) from India WRIS and upserts them into the multi-city
groundwater_wris table on the city-aware key.

Bengaluru Urban is CGWB-only: the Karnataka State Ground Water Department does
not publish to India-WRIS under any agency name probed (2026-05). Its 14 CGWB
telemetric stations back the IISc stress-ward map.

Usage:
    cd neer-vazhvu-api
    python scripts/scrape_wris_groundwater.py --city madurai|bangalore
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
from app.scrapers.wris import fetch_wris_groundwater  # noqa: E402

CITIES = {
    "madurai": {
        "label": "Madurai",
        "state": "Tamil Nadu",
        "district": "Madurai",
        "agencies": ["CGWB", "Tamil Nadu SW GW"],
        "days_env": "MADURAI_WRIS_DAYS",
    },
    "bangalore": {
        "label": "Bangalore Urban",
        "state": "Karnataka",
        "district": "Bangalore Urban",
        "agencies": ["CGWB"],
        "days_env": "BANGALORE_WRIS_DAYS",
    },
}


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


async def main(city_id: str) -> int:
    city = CITIES[city_id]
    supabase_url = _get_env("SUPABASE_URL")
    supabase_key = _get_env("SUPABASE_SERVICE_KEY")
    supabase = create_client(supabase_url, supabase_key)

    days = _env_int(city["days_env"], 90)
    end = date.today()
    start = end - timedelta(days=days)

    print(
        f"Fetching WRIS {city['label']} records {start} -> {end} (window={days}d)...",
        flush=True,
    )

    try:
        records = await fetch_wris_groundwater(
            start_date=start,
            end_date=end,
            state=city["state"],
            district=city["district"],
            agencies=city["agencies"],
        )
    except Exception as exc:
        print(
            f"ERROR: WRIS fetch failed: {type(exc).__name__}: {exc!r}",
            file=sys.stderr,
            flush=True,
        )
        return 1

    print(f"  Got {len(records)} deduplicated daily records", flush=True)

    if not records:
        # India-WRIS sometimes returns zero rows during maintenance windows;
        # exit cleanly so the daily pipeline does not red-flag the run.
        print("  No new readings; exiting cleanly.", flush=True)
        return 0

    rows = [
        {
            "city_id": city_id,
            "station_code": r.station_code,
            "station_name": r.station_name,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "reading_date": r.reading_date.isoformat(),
            "depth_to_water_m": r.depth_to_water_m,
            "acquisition_mode": r.acquisition_mode,
            "agency": r.agency,
            "district": r.district,
            "well_type": r.well_type,
            "well_depth_m": r.well_depth_m,
            "well_aquifer_type": r.well_aquifer_type,
            "source": "cgwb",
        }
        for r in records
    ]

    batch_size = 200
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        supabase.table("groundwater_wris").upsert(
            batch, on_conflict="city_id,station_code,reading_date"
        ).execute()
        print(f"  Upserted {i + len(batch)}/{len(rows)}", flush=True)

    unique_stations = {r.station_code for r in records}
    modes: dict[str, int] = {}
    for r in records:
        modes[r.acquisition_mode] = modes.get(r.acquisition_mode, 0) + 1
    print(
        f"  unique_stations={len(unique_stations)} modes={dict(sorted(modes.items()))}",
        flush=True,
    )
    print("Done.", flush=True)
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--city", required=True, choices=sorted(CITIES))
    sys.exit(asyncio.run(main(parser.parse_args().city)))

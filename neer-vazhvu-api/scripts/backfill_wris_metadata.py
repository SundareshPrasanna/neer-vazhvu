#!/usr/bin/env python3
"""
One-shot WRIS backfill: re-fetch the full Chennai history and upsert so the
new well_type / well_depth_m / well_aquifer_type columns get populated on
existing rows.

Usage:
    cd neer-vazhvu-api
    python scripts/backfill_wris_metadata.py
"""

import asyncio
import os
import sys
from datetime import date

from dotenv import load_dotenv

load_dotenv()

from supabase import create_client  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.scrapers.wris import fetch_wris_groundwater  # noqa: E402


def _get_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        print(f"ERROR: {key} environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    return value


async def main() -> int:
    supabase_url = _get_env("SUPABASE_URL")
    supabase_key = _get_env("SUPABASE_SERVICE_KEY")
    supabase = create_client(supabase_url, supabase_key)

    start = date(2024, 1, 1)
    end = date.today()
    print(f"Fetching WRIS Chennai records {start} → {end}…", flush=True)

    records = await fetch_wris_groundwater(start_date=start, end_date=end)
    print(f"  Got {len(records)} deduplicated daily records", flush=True)

    rows = [
        {
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
            batch, on_conflict="station_code,reading_date"
        ).execute()
        print(f"  Upserted {i + len(batch)}/{len(rows)}", flush=True)

    print("Done.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

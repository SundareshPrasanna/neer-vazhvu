#!/usr/bin/env python3
"""
Daily WRIS groundwater ingest for Bangalore Urban district.

Fetches the last 90 days of CGWB station readings from India WRIS for
Bangalore Urban district and upserts into the multi-district
groundwater_wris table. Mirrors scripts/scrape_wris_madurai.py.

As of 2026-05, Bangalore Urban has 14 active CGWB telemetric stations
(Cubbon Park, Lalbagh, NIMHANS, IISc, Hebbal, Jayanagar, Adugodi,
Singasandra, etc.) - all Bore Well + Semi-Confined aquifer. The Karnataka
State Ground Water Department does NOT publish to India-WRIS under any
agency name we have probed, so this script is CGWB-only.

These 14 stations are the live operational backbone for verifying the
IISc Groundwater Outlook (April 2025) stress-ward map - several of the
65 named stress wards (Hebbal, Jayanagar) have a CGWB station inside
them or within 1 km.

Usage:
    cd neer-vazhvu-api
    python scripts/scrape_wris_bangalore.py
"""

import asyncio
import os
import sys
from datetime import date, timedelta

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


def _env_int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    if not raw:
        return default
    try:
        v = int(raw)
        return v if v > 0 else default
    except ValueError:
        return default


async def main() -> int:
    supabase_url = _get_env("SUPABASE_URL")
    supabase_key = _get_env("SUPABASE_SERVICE_KEY")
    supabase = create_client(supabase_url, supabase_key)

    days = _env_int("BANGALORE_WRIS_DAYS", 90)
    end = date.today()
    start = end - timedelta(days=days)

    print(
        f"Fetching WRIS Bangalore Urban records {start} -> {end} (window={days}d)...",
        flush=True,
    )

    try:
        records = await fetch_wris_groundwater(
            start_date=start,
            end_date=end,
            state="Karnataka",
            district="Bangalore Urban",
            agencies=["CGWB"],
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
        # India-WRIS API sometimes returns zero rows during maintenance
        # windows; exit cleanly so the daily pipeline does not red-flag the run.
        print("  No new readings; exiting cleanly.", flush=True)
        return 0

    rows = [
        {
            "city_id": "bangalore",
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
    sys.exit(asyncio.run(main()))

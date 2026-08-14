#!/usr/bin/env python3
"""
Daily WRIS river-level (surface water) ingest for the Madurai / Vaigai
system. Fans out across Madurai + Theni + Dindigul + Virudhunagar
districts to capture the full Vaigai mainstem and adjacent dams.

Probed coverage (CWC, Apr-May 2026):
    Madurai          : VADAMADURAI (Kodaganar tributary)
    Theni            : THENI station (Vaigai upper)
    Dindigul         : KODAGANAR DAM
    Virudhunagar     : IRRUKKANKUDI
    Sivagangai       : no data
    Ramanathapuram   : no data

Usage:
    cd neer-vazhvu-api
    python scripts/scrape_wris_river_level_madurai.py
    # window override:
    MADURAI_WRIS_RIVER_DAYS=180 python scripts/scrape_wris_river_level_madurai.py
"""

import asyncio
import os
import sys
from datetime import date, timedelta

from dotenv import load_dotenv

load_dotenv()

VAIGAI_SYSTEM_DISTRICTS = ["Madurai", "Theni", "Dindigul", "Virudhunagar"]

from supabase import create_client  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.scrapers.wris_telemetry import fetch_wris_river_level  # noqa: E402


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

    days = _env_int("MADURAI_WRIS_RIVER_DAYS", 90)
    end = date.today()
    start = end - timedelta(days=days)

    print(
        f"Fetching WRIS Vaigai-system river-level records {start} -> {end} "
        f"(window={days}d, districts={VAIGAI_SYSTEM_DISTRICTS})...",
        flush=True,
    )

    records = []
    for district in VAIGAI_SYSTEM_DISTRICTS:
        try:
            d_records = await fetch_wris_river_level(
                start_date=start,
                end_date=end,
                district=district,
                agencies=["CWC"],
            )
        except Exception as exc:
            # Don't let one district's outage kill the whole run.
            print(
                f"  WARN: {district} fetch failed: {type(exc).__name__}: {exc!r}",
                file=sys.stderr,
                flush=True,
            )
            continue
        print(f"  {district}: {len(d_records)} daily records", flush=True)
        records.extend(d_records)

    print(
        f"  Total: {len(records)} daily records across {len(VAIGAI_SYSTEM_DISTRICTS)} districts",
        flush=True,
    )

    if not records:
        print("  No new readings; exiting cleanly.", flush=True)
        return 0

    rows = [
        {
            "city_id": "madurai",
            "station_code": r.station_code,
            "station_name": r.station_name,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "agency": r.agency,
            "state": r.state,
            "district": r.district,
            "tehsil": r.tehsil,
            "major_basin": r.major_basin,
            "tributary": r.tributary,
            "acquisition_mode": r.acquisition_mode,
            "station_status": r.station_status,
            "reading_date": r.reading_date.isoformat(),
            "level_m": r.level_m,
            "reading_count": r.reading_count,
            "source": "wris",
        }
        for r in records
    ]

    batch_size = 200
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        supabase.table("wris_river_level").upsert(
            batch, on_conflict="station_code,reading_date"
        ).execute()
        print(f"  Upserted {i + len(batch)}/{len(rows)}", flush=True)

    unique_stations = {r.station_code for r in records}
    print(f"  unique_stations={len(unique_stations)}", flush=True)
    print("Done.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

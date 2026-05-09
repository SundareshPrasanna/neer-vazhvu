#!/usr/bin/env python3
"""
Daily Cauvery basin rainfall ingestion (OpenMeteo).

Computes basin-area-averaged daily precipitation across grid points inside the
WRIS Cauvery basin polygon for the past 92 days plus 14 forecast days. Upserts
to basin_rainfall_daily keyed by (city_id, basin_code, date, season).

LPA values come from public/data/cauvery-basin-lpa.json which is generated
once by scripts/backfill_cauvery_basin_lpa.py.
"""

import asyncio
import os
import sys
from dataclasses import asdict
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

import httpx  # noqa: E402
from supabase import create_client  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.scrapers.openmeteo_basin_rainfall import (  # noqa: E402
    DEFAULT_BASIN_GEOJSON,
    compute_basin_rainfall,
)


def _get_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        print(f"ERROR: {key} environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    return value


REPO_ROOT = Path(__file__).resolve().parents[2]
LPA_PATH = REPO_ROOT / "public" / "data" / "cauvery-basin-lpa.json"


async def main() -> int:
    supabase_url = _get_env("SUPABASE_URL")
    supabase_key = _get_env("SUPABASE_SERVICE_KEY")
    supabase = create_client(supabase_url, supabase_key)

    print(
        f"Computing Cauvery basin rainfall (basin polygon: {DEFAULT_BASIN_GEOJSON.name})…",
        flush=True,
    )

    try:
        rows = await compute_basin_rainfall(
            city_id="kaveri",
            basin_code="cauvery_basin",
            basin_geojson_path=DEFAULT_BASIN_GEOJSON,
            lpa_path=LPA_PATH,
        )
    except (httpx.HTTPError, ValueError) as exc:
        print(
            f"ERROR: basin rainfall scrape failed — {type(exc).__name__}: {exc}",
            file=sys.stderr,
            flush=True,
        )
        return 1

    if not rows:
        print(
            "No in-season rows produced (off-season or empty response). Exiting clean.",
            flush=True,
        )
        return 0

    print(
        f"  Got {len(rows)} basin rainfall rows ({rows[0].date} … {rows[-1].date})",
        flush=True,
    )

    payload = [asdict(r) for r in rows]
    supabase.table("basin_rainfall_daily").upsert(
        payload, on_conflict="city_id,basin_code,date,season"
    ).execute()
    print(f"  Upserted {len(payload)} rows to basin_rainfall_daily ✓", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

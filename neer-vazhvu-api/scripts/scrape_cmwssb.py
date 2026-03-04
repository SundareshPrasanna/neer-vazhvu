#!/usr/bin/env python3
"""
Standalone CMWSSB scrape script — runs outside the FastAPI server.

Designed to be called from GitHub Actions (or any environment whose IP is
not blocked by the CMWSSB website).  Reads SUPABASE_URL and
SUPABASE_SERVICE_KEY from the environment (or a .env file) and upserts
the scraped reservoir readings directly to the reservoir_daily table.

Usage:
    cd neer-vazhvu-api
    python scripts/scrape_cmwssb.py
"""

import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv()

import httpx  # noqa: E402 — imported after dotenv so env is ready
from supabase import create_client  # noqa: E402

# Bootstrap the app package so we can reuse the existing scraper.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.scrapers.cmwssb import scrape_cmwssb  # noqa: E402


def _get_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        print(f"ERROR: {key} environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    return value


async def main() -> int:
    supabase_url = _get_env("SUPABASE_URL")
    supabase_key = _get_env("SUPABASE_SERVICE_KEY")

    print("Scraping CMWSSB lake-level page…", flush=True)
    try:
        result = await scrape_cmwssb()
    except (httpx.HTTPError, ValueError) as exc:
        print(f"ERROR: Scrape failed — {exc}", file=sys.stderr)
        return 1

    print(
        f"  Got {len(result.readings)} reservoir readings for {result.date}",
        flush=True,
    )

    rows = [
        {
            "reservoir": r.reservoir,
            "date": r.date,
            "current_level_ft": r.current_level_ft,
            "current_storage_mcft": r.current_storage_mcft,
            "capacity_mcft": r.capacity_mcft,
            "storage_pct": r.storage_pct,
            "inflow_cusecs": r.inflow_cusecs,
            "outflow_cusecs": r.outflow_cusecs,
            "rainfall_mm": r.rainfall_mm,
            "source": "cmwssb_scrape",
        }
        for r in result.readings
    ]

    supabase = create_client(supabase_url, supabase_key)
    supabase.table("reservoir_daily").upsert(rows, on_conflict="reservoir,date").execute()
    print(f"  Upserted {len(rows)} rows to reservoir_daily ✓", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

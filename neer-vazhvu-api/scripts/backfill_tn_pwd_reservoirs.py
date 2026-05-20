#!/usr/bin/env python3
"""
TN Agri ARS reservoir history backfill - Madurai (Vaigai + Mullaperiyar).

The TN Agri archive serves dated pages at /ARS/home/reservoir/YYYY-MM-DD
back to ~2018. Each date returns a single HTML table identical in shape
to the daily live page, so the existing _parse_html parser can be reused.

This script powers two Tier-1 features (audit memo
madurai_chennai_parity_gaps):
  1. Reservoir history charts on /madurai home (9-year storage trends)
  2. AutoARIMA forecast (needs >= 2 years of daily history per source)

Usage:
    cd neer-vazhvu-api
    python scripts/backfill_tn_pwd_reservoirs.py
    python scripts/backfill_tn_pwd_reservoirs.py --start 2024-01-01
    python scripts/backfill_tn_pwd_reservoirs.py --start 2018-01-01 --end 2025-12-31

Defaults:
    --start = 2018-01-01
    --end   = today (IST) - 1 day
    --throttle 1.0 sec between dates (be polite to TN Agri)

Resumable: queries Supabase for existing dates per city before fetching,
skips ones we already have. Run multiple times safely.
"""

import argparse
import asyncio
import os
import sys
from dataclasses import asdict
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from dotenv import load_dotenv

load_dotenv()

from supabase import create_client  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.scrapers.tn_pwd_reservoirs import (  # noqa: E402
    EXPECTED_CITY_IDS,
    HEADERS,
    _parse_html,
)


def _get_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        print(f"ERROR: {key} environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    return value


def _today_ist() -> date:
    return datetime.now(ZoneInfo("Asia/Kolkata")).date()


def _date_range(start: date, end: date):
    cur = start
    while cur <= end:
        yield cur
        cur = cur + timedelta(days=1)


def _existing_dates(supabase, start: date, end: date) -> set[str]:
    """Pull all reservoir_daily_v2 dates already in DB for the expected cities
    so the backfill skips them on resume. Single round trip.
    """
    seen: set[str] = set()
    result = (
        supabase.table("reservoir_daily_v2")
        .select("city_id, date")
        .in_("city_id", list(EXPECTED_CITY_IDS))
        .gte("date", start.isoformat())
        .lte("date", end.isoformat())
        .execute()
    )
    for row in result.data or []:
        seen.add(f"{row['city_id']}|{row['date']}")
    return seen


HISTORICAL_URL_TEMPLATE = "https://tnagriculture.in/ARS/home/reservoir/{date}"


async def _fetch_one_date(
    client: httpx.AsyncClient, target_date: date
) -> list[dict] | None:
    """Fetch and parse a single historical date. Returns asdict-rows ready
    for upsert, or None on error/empty."""
    url = HISTORICAL_URL_TEMPLATE.format(date=target_date.isoformat())
    try:
        response = await client.get(url, headers=HEADERS, timeout=30.0)
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        print(f"  {target_date}: fetch failed ({type(exc).__name__})", file=sys.stderr)
        return None

    if response.status_code != 200:
        print(f"  {target_date}: HTTP {response.status_code}", file=sys.stderr)
        return None

    try:
        result = _parse_html(response.text)
    except ValueError as exc:
        print(f"  {target_date}: parse failed ({exc})", file=sys.stderr)
        return None

    # The parser may detect a different date-on-page than what we requested
    # (e.g. weekend rollovers). Force the requested date so historical rows
    # land where we expect them; the page is the archive for THIS date.
    rows: list[dict] = []
    for r in result.readings:
        rec = asdict(r)
        rec["date"] = target_date.isoformat()
        rec["source"] = "tn_pwd_backfill"
        rows.append(rec)
    return rows


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0].strip())
    parser.add_argument(
        "--start", default="2018-01-01", help="Start date (YYYY-MM-DD), inclusive"
    )
    parser.add_argument("--end", default=None, help="End date, default = today - 1 day")
    parser.add_argument(
        "--throttle", type=float, default=1.0, help="Seconds between requests"
    )
    parser.add_argument(
        "--cities",
        default=",".join(EXPECTED_CITY_IDS),
        help=(
            "Comma-separated city_ids to backfill. Default: all "
            f"({','.join(EXPECTED_CITY_IDS)})."
        ),
    )
    args = parser.parse_args()
    only_cities = {c.strip() for c in args.cities.split(",") if c.strip()}
    unknown = only_cities - set(EXPECTED_CITY_IDS)
    if unknown:
        print(f"ERROR: unknown city_ids in --cities: {unknown}", file=sys.stderr)
        return 1

    start = date.fromisoformat(args.start)
    end = (
        date.fromisoformat(args.end) if args.end else (_today_ist() - timedelta(days=1))
    )
    if end < start:
        print(f"ERROR: end ({end}) before start ({start})", file=sys.stderr)
        return 1

    supabase_url = _get_env("SUPABASE_URL")
    supabase_key = _get_env("SUPABASE_SERVICE_KEY")
    supabase = create_client(supabase_url, supabase_key)

    total_days = (end - start).days + 1
    print(
        f"Backfill window: {start} -> {end} ({total_days} days) "
        f"throttle={args.throttle}s",
        flush=True,
    )

    # Resumability: skip dates already in DB for ALL expected cities.
    print("Checking existing reservoir_daily_v2 dates...", flush=True)
    existing = _existing_dates(supabase, start, end)
    print(f"  {len(existing)} (city,date) pairs already present", flush=True)

    # Date is fully done iff every requested city has a row for it.
    fully_done: set[str] = set()
    for d in _date_range(start, end):
        ds = d.isoformat()
        if all(f"{c}|{ds}" in existing for c in only_cities):
            fully_done.add(ds)
    todo = [d for d in _date_range(start, end) if d.isoformat() not in fully_done]
    print(
        f"  {len(fully_done)} dates fully covered, {len(todo)} dates to fetch",
        flush=True,
    )

    fetched = 0
    upserted = 0
    failed = 0
    async with httpx.AsyncClient(follow_redirects=True) as client:
        for i, d in enumerate(todo, start=1):
            rows = await _fetch_one_date(client, d)
            if rows is None:
                failed += 1
            elif rows:
                rows = [r for r in rows if r.get("city_id") in only_cities]
                if rows:
                    supabase.table("reservoir_daily_v2").upsert(
                        rows, on_conflict="city_id,source_code,date"
                    ).execute()
                    fetched += 1
                    upserted += len(rows)
            if i % 25 == 0 or i == len(todo):
                print(
                    f"  {i}/{len(todo)} processed (fetched={fetched} "
                    f"failed={failed} rows_upserted={upserted})",
                    flush=True,
                )
            await asyncio.sleep(args.throttle)

    print(
        f"Done. Fetched {fetched} dates, upserted {upserted} rows, {failed} failed.",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

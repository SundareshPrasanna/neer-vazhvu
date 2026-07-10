#!/usr/bin/env python3
"""
KWRIS reservoir scrape - Bengaluru daily ingestion.

Scrapes Karnataka WRIS's open GeoServer (KA:reservoir_landing) for the 4 Cauvery
source dams (KRS, Hemavathy, Kabini, Harangi) and upserts to reservoir_daily_v2
keyed by (city_id, source_code, date). KWRIS is Karnataka's native authority for
these dams and replaces the second-hand TN Agriculture feed for Bengaluru.

Reads SUPABASE_URL and SUPABASE_SERVICE_KEY from the environment. Designed to run
from the local scheduled job (KWRIS may block cloud-runner IPs), mirroring
scrape_tn_pwd_reservoirs.py.

Usage:
    cd neer-vazhvu-api
    python scripts/scrape_kwris_bangalore.py            # scrape + upsert
    python scripts/scrape_kwris_bangalore.py --dry-run  # fetch + print, no DB
"""

import asyncio
import os
import sys
from dataclasses import asdict
from datetime import date, datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()

import httpx  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.scrapers.kwris_reservoirs import (  # noqa: E402
    EXPECTED_CITY_IDS,
    ScrapeResult,
    scrape_kwris_reservoirs,
)

DRY_RUN = "--dry-run" in sys.argv


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
        value = int(raw)
        return value if value > 0 else default
    except ValueError:
        return default


def _fmt_exc(exc: Exception) -> str:
    return f"{type(exc).__name__}: {repr(exc)}"


def _is_connectivity_error(exc: Exception) -> bool:
    return isinstance(
        exc,
        (
            httpx.ConnectTimeout,
            httpx.ConnectError,
            httpx.ReadTimeout,
            httpx.RemoteProtocolError,
        ),
    )


def _today_ist() -> date:
    return datetime.now(ZoneInfo("Asia/Kolkata")).date()


def _latest_reservoir_v2_date(supabase, city_id: str) -> date | None:
    result = (
        supabase.table("reservoir_daily_v2")
        .select("date")
        .eq("city_id", city_id)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    raw_date = result.data[0].get("date")
    if not raw_date:
        return None
    try:
        return date.fromisoformat(str(raw_date))
    except ValueError:
        return None


def _allow_stale_data_fallback(supabase, max_stale_days: int) -> bool:
    """Allow stale-data fallback only if every expected city is fresh enough."""
    today = _today_ist()
    for city_id in EXPECTED_CITY_IDS:
        try:
            latest_date = _latest_reservoir_v2_date(supabase, city_id)
        except Exception as exc:
            print(
                f"WARN: could not check latest reservoir_daily_v2 date for {city_id} "
                f"— {_fmt_exc(exc)}",
                file=sys.stderr,
                flush=True,
            )
            return False
        if latest_date is None:
            print(
                f"WARN: no existing reservoir_daily_v2 data for {city_id}; "
                "cannot use stale-data fallback",
                file=sys.stderr,
                flush=True,
            )
            return False
        age_days = (today - latest_date).days
        if age_days > max_stale_days:
            print(
                "ERROR: scrape failed and existing data is too stale — "
                f"city={city_id} latest={latest_date} age={age_days}d "
                f"max_allowed={max_stale_days}d",
                file=sys.stderr,
                flush=True,
            )
            return False
    print(
        "WARN: KWRIS unreachable; continuing with existing data "
        f"(within {max_stale_days}d for {list(EXPECTED_CITY_IDS)})",
        file=sys.stderr,
        flush=True,
    )
    return True


async def _scrape_with_retries(max_attempts: int) -> ScrapeResult:
    last_exc: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return await scrape_kwris_reservoirs()
        except (httpx.HTTPError, ValueError) as exc:
            last_exc = exc
            print(
                f"WARN: scrape attempt {attempt}/{max_attempts} failed — {_fmt_exc(exc)}",
                file=sys.stderr,
                flush=True,
            )
            if attempt < max_attempts:
                await asyncio.sleep(min(2 * attempt, 8))
    assert last_exc is not None
    raise last_exc


def _print_readings(result: ScrapeResult) -> None:
    print(
        f"  Got {len(result.readings)} reservoir readings (latest {result.date})",
        flush=True,
    )
    for r in result.readings:
        print(
            f"    {r.source_code:<10} {r.date}  {r.storage_tmc} TMC  "
            f"{r.storage_pct_frl}% FRL  level={r.level_ft}  "
            f"in={r.inflow_cusecs} out={r.outflow_cusecs}",
            flush=True,
        )


async def main() -> int:
    max_attempts = _env_int("KWRIS_SCRAPE_MAX_ATTEMPTS", 3)
    max_stale_days = _env_int("KWRIS_MAX_STALE_DAYS", 4)

    if DRY_RUN:
        print("Scraping KWRIS reservoir_landing (DRY RUN, no DB write)…", flush=True)
        result = await _scrape_with_retries(max_attempts)
        _print_readings(result)
        return 0

    from supabase import create_client  # local import: DB only needed for a real run

    supabase_url = _get_env("SUPABASE_URL")
    supabase_key = _get_env("SUPABASE_SERVICE_KEY")
    supabase = create_client(supabase_url, supabase_key)

    print(
        f"Scraping KWRIS reservoir_landing "
        f"(max_attempts={max_attempts}, max_stale_days={max_stale_days})…",
        flush=True,
    )
    try:
        result = await _scrape_with_retries(max_attempts)
    except (httpx.HTTPError, ValueError) as exc:
        if _is_connectivity_error(exc) and _allow_stale_data_fallback(
            supabase, max_stale_days
        ):
            return 0
        print(f"ERROR: Scrape failed — {_fmt_exc(exc)}", file=sys.stderr, flush=True)
        return 1

    _print_readings(result)

    rows = [asdict(r) for r in result.readings]
    supabase.table("reservoir_daily_v2").upsert(
        rows, on_conflict="city_id,source_code,date"
    ).execute()
    print(f"  Upserted {len(rows)} rows to reservoir_daily_v2 ✓", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

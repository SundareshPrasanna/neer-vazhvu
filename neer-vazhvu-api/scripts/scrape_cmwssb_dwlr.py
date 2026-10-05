#!/usr/bin/env python3
"""
Archive CMWSSB's 200 ward water-level loggers and load them into groundwater_dwlr_daily.

Every portal response is saved gzipped and unchanged, with a manifest line,
before anything is parsed (app/scrapers/cmwssb_dwlr.py). The archive is the
record; the table is rebuilt from it.

    cd neer-vazhvu-api
    python scripts/scrape_cmwssb_dwlr.py                  # daily: each logger's latest reading
    python scripts/scrape_cmwssb_dwlr.py --days 7         # also ask the six days before
    python scripts/scrape_cmwssb_dwlr.py --history 2021-09-01 2026-10-01
                                                          # first-of-month asks: month-end readings
    python scripts/scrape_cmwssb_dwlr.py --import-reports <backup>/raw/manifest.jsonl
                                                          # day reports saved from the test host
    python scripts/scrape_cmwssb_dwlr.py --load-only [--all] [--dry-run]

The portal answers a call in about 7 s; calls go one at a time with a pause
between them, so a daily run takes 30 to 45 minutes. A logger whose call times
out waits for the next run. CMWSSB_DWLR_RAW_DIR sets the archive
(default scripts/.cache/cmwssb-dwlr). The daily run loads the last 30 days,
read against 90 days of archive so the spike and stuck rules see context.
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

import httpx  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.scrapers.cmwssb_dwlr import (  # noqa: E402
    RawArchive,
    daily_rows,
    fetch_depots,
    fetch_latest_before,
    upsert_daily,
)

CITY_ID = "chennai"
RAW_DIR = Path(
    os.environ.get("CMWSSB_DWLR_RAW_DIR")
    or Path(__file__).resolve().parent / ".cache" / "cmwssb-dwlr"
)
# One call at a time, a pause between calls, and a long wait after a timeout:
# the portal is a working government service, not a bulk API.
PAUSE_S, BACKOFF_S = 3, 120
MAX_FAILURES = 10  # failed calls in one run before it stops asking
LOAD_DAYS, CONTEXT_DAYS = 30, 90


def month_starts(start: date, end: date) -> list[date]:
    out, d = [], start.replace(day=1)
    while d <= end:
        out.append(d)
        d = (d + timedelta(days=32)).replace(day=1)
    return out


async def fetch(archive: RawArchive, asks: list[date]) -> int:
    """Ask every logger for its latest reading before each date; saved raw, resumable."""
    have = archive.has()
    silent: set[int] = set()
    async with httpx.AsyncClient(timeout=60.0) as client:
        depots = await fetch_depots(client)
        archive.save_depots(depots)
        print(f"{len(depots)} loggers, {len(asks)} dates each", flush=True)
        failures = done = 0
        for day in sorted(asks, reverse=True):
            for depot in depots:
                rel = f"latest/{depot.depot_id:03d}/{day.isoformat()}.json"
                if f"{rel}.gz" in have or depot.depot_id in silent:
                    continue
                try:
                    body, meta = await fetch_latest_before(client, depot, day)
                except httpx.HTTPError as exc:
                    # The portal keeps working on a call we gave up on; asking
                    # again at once stacks a second query behind it. The logger
                    # waits for the next run.
                    failures += 1
                    silent.add(depot.depot_id)
                    print(
                        f"  ! {rel}: {type(exc).__name__}", file=sys.stderr, flush=True
                    )
                    if failures >= MAX_FAILURES:
                        print("Portal not answering; stopping.", file=sys.stderr)
                        return 1
                    await asyncio.sleep(BACKOFF_S)
                    continue
                archive.save(rel, body, meta)
                done += 1
                await asyncio.sleep(PAUSE_S)
            print(f"  {day} done ({done} saved)", flush=True)
    if silent:
        print(f"Loggers not answering this run: {sorted(silent)}", flush=True)
    return 0


def import_reports(archive: RawArchive, manifest: Path) -> None:
    """Copy the test host's saved day reports into the archive, keeping their fetch record."""
    have = archive.has()
    for line in manifest.read_text().splitlines():
        e = json.loads(line)
        if not e["path"].startswith("daywise/") or "xls" not in (
            e.get("content_type") or ""
        ):
            continue
        rel = f"report/test-host/{e['path'].split('/')[1].replace('.bin', '.xls')}"
        if f"{rel}.gz" not in have:
            meta = {
                k: e[k] for k in ("url", "form", "status", "content_type", "fetched_at")
            }
            archive.save(rel, (manifest.parent / e["path"]).read_bytes(), meta)


def load(archive: RawArchive, everything: bool, dry_run: bool) -> int:
    readings, refs = archive.readings()
    if not everything:
        context = date.today() - timedelta(days=CONTEXT_DAYS)
        readings = [r for r in readings if r.observed_at.date() >= context]
    rows = daily_rows(readings, refs)
    if not everything:
        since = (date.today() - timedelta(days=LOAD_DAYS)).isoformat()
        rows = [r for r in rows if r["reading_date"] >= since]
    by_status: dict[str, int] = {}
    for r in rows:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1
    newest = max((r["reading_date"] for r in rows), default=None)
    print(
        f"{len(readings)} readings -> {len(rows)} logger-days {by_status}, newest {newest}"
    )
    if dry_run or not rows:
        return 0
    from supabase import create_client

    upsert_daily(
        create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"]),
        rows,
        CITY_ID,
    )
    print(f"Upserted {len(rows)} rows.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("--days", type=int, default=1, help="days to ask for, ending today")
    ap.add_argument(
        "--history", nargs=2, type=date.fromisoformat, metavar=("START", "END")
    )
    ap.add_argument("--import-reports", type=Path, metavar="MANIFEST")
    ap.add_argument("--load-only", action="store_true", help="skip fetching")
    ap.add_argument(
        "--all",
        action="store_true",
        help="load the whole archive, not the last 30 days",
    )
    ap.add_argument(
        "--dry-run", action="store_true", help="parse and report, write nothing"
    )
    args = ap.parse_args()

    archive = RawArchive(RAW_DIR)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if args.import_reports:
        import_reports(archive, args.import_reports)
        return 0
    if args.history:
        return asyncio.run(fetch(archive, month_starts(*args.history)))
    if not args.load_only:
        today = date.today()
        asks = [today - timedelta(days=n) for n in range(args.days)]
        status = asyncio.run(fetch(archive, asks))
        if status:
            return status
    return load(archive, args.all, args.dry_run)


if __name__ == "__main__":
    sys.exit(main())

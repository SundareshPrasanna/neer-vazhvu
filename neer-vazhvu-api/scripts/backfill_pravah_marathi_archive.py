#!/usr/bin/env python3
"""
Backfill Nagpur's daily dam storage from the Maharashtra WRD department's
dated Marathi archive of the Pravah bulletin.

Pravah itself (scrape_pravah_dams.py) serves only a latest report. The WRD
department site keeps the same bulletin per date, in Marathi:

  https://wrd.maharashtra.gov.in/Upload/PDF/Today%27s-Storage-ReportMarathi-DD-MM-YYYY.pdf

Same data, not a different product: on 15-10-2026 every Nagpur-district
value in it equals the English Pravah PDF of the same day. Coverage: first
copy found 25 Feb 2024 (1 Feb and 15-24 Feb 2024 return 404; 2-14 Feb not
checked), with holes after it (15-03-2024 is 404), so a missing day is
skipped, not an error.

HOW A ROW IS FOUND. The digits are Devanagari (transliterated here), the time
reads "स." for AM, and pdftotext breaks the Marathi dam names apart: vowel
signs land on the neighbouring line and some glyphs come out as private-use
code points. So rows are matched on their DESIGNED (dead, live, gross)
storage, which is fixed per dam (NAGPUR_DESIGNED in scrape_pravah_dams.py)
and unique statewide on the bulletins checked. A file in which a triple
occurs twice, or in which the five rows are not next to each other (they sit
together in the Nagpur district block), yields nothing for that dam or file.
Each file's header date must equal the date asked for (the archive-fallback
trap), and the printed percentage must agree with storage / live capacity.

DATES. A row is stored under the FILE (report) date, as the live scraper
stores the report date: on the 25 files checked the file date equals the
newest reading in the file, which is the live scraper's report date. Each dam
row also carries its own reading date (the 15-10-2025 file dates Kamthi
Khairy 14/10/2025 and Totladoh 15/10/2025); it is kept in the dry-run JSONL
(reading_date) only. A file whose newest reading is not the file date is
reported. The same (dam, reading date) can appear in two files; a differing
value is reported as a conflict.

WRITES. --dry-run FILE writes every candidate row as JSONL and touches no
database. --supabase is separate and explicit: it INSERTS ONLY rows whose
(city_id, source_code, date) is not already in reservoir_daily_v2 (and the
upsert ignores duplicates as a second guard), for the dams the live scraper
writes (Totladoh, Kamthi Khairy). It never overwrites the live feed's rows,
including its reconstructed same-date-last-year rows; for Nagpur the live
scraper sends those insert-only too (ly_insert_only in scrape_pravah_dams.py),
so neither writer replaces a reading already stored.

SLOW HOST. Every request takes about 50 s, a 404 included. Never HEAD (it
404s). PDFs are cached in --cache and 404s are remembered there, so a rerun
fetches only what is new. A dropped connection, a timeout or a short read is
retried (RETRIES attempts, RETRY_BACKOFF_S apart, doubling); only a whole PDF
(header to %%EOF, Content-Length met) is cached, written via a temp file so a
crash never leaves half a file under the cached name.

Run:  cd neer-vazhvu-api
      python3 scripts/backfill_pravah_marathi_archive.py --cache /tmp/wrd-mr \\
          --dates 2024-03-01,2025-10-15 --dry-run /tmp/nagpur-archive.jsonl
      python3 scripts/backfill_pravah_marathi_archive.py --cache /tmp/wrd-mr \\
          --from 2024-02-01 --to 2026-10-14 --dry-run /tmp/nagpur-archive.jsonl
      python3 scripts/backfill_pravah_marathi_archive.py --cache /tmp/wrd-mr \\
          --from 2024-02-01 --to 2026-10-14 --supabase
"""

import argparse
import http.client
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scrape_pravah_dams import (  # noqa: E402
    CITIES,
    MCUM_PER_TMC,
    NAGPUR_DESIGNED,
)

ARCHIVE_URL = (
    "https://wrd.maharashtra.gov.in/Upload/PDF/"
    "Today%27s-Storage-ReportMarathi-{dmy}.pdf"
)
SOURCE = "Maharashtra WRD daily storage report (Marathi archive of the Pravah bulletin)"
DESIGNED_BY_CITY = {"nagpur": NAGPUR_DESIGNED}
# Lines between the first and last of the five rows: they are consecutive in
# the district block, and a wrapped name adds a line each.
BLOCK_SPAN = 15
DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")
_NUM = r"\d+(?:\.\d+)?"
# date | time + its Marathi marker | dead | live | gross | cur live | cur gross
#      | cur % | same date last year %
_ROW = re.compile(
    r"(?P<date>\d{2}/\d{2}/\d{4})\s+\d{1,2}:\d{2}\D*?\s"
    rf"(?P<dead>{_NUM})\s+(?P<live>{_NUM})\s+(?P<gross>{_NUM})\s+"
    rf"(?P<cur>{_NUM})\s+(?P<cur_gross>{_NUM})\s+(?P<pct>{_NUM})\s*%\s+"
    rf"(?P<ly_pct>{_NUM})\s*%"
)
_HEADER_DATE = re.compile(r"^\s*(\d{2}/\d{2}/\d{4})\s*$")
RETRIES = 3
RETRY_BACKOFF_S = 15.0
# HTTPError is a URLError: fetch() handles it first (404 cached, 5xx retried).
_TRANSIENT = (
    http.client.IncompleteRead,
    urllib.error.URLError,
    TimeoutError,
    ConnectionResetError,
)


def _dmy(d: date) -> str:
    return d.strftime("%d-%m-%Y")


def _iso(dmy_slash: str) -> str:
    dd, mm, yyyy = dmy_slash.split("/")
    return f"{yyyy}-{mm}-{dd}"


def _whole_pdf(data: bytes) -> bool:
    return data.startswith(b"%PDF-") and b"%%EOF" in data[-1024:]


def _get(url: str, timeout: int) -> bytes:
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 neervazhvu-wrd-archive"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
        length = resp.headers.get("Content-Length")
    if length and length.isdigit() and len(data) != int(length):
        raise http.client.IncompleteRead(data, int(length) - len(data))
    return data


def fetch(d: date, cache: Path, timeout: int) -> tuple[str, Path | None]:
    """('ok', path) | ('404', None) | ('error: ...', None). Cached both ways."""
    pdf = cache / f"mr_{_dmy(d)}.pdf"
    gone = cache / f"mr_{_dmy(d)}.404"
    if pdf.exists() and _whole_pdf(pdf.read_bytes()):
        return "ok", pdf
    if gone.exists():
        return "404", None
    url = ARCHIVE_URL.format(dmy=_dmy(d))
    data = b""
    for attempt in range(1, RETRIES + 1):
        try:
            data = _get(url, timeout)
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                gone.write_text("404\n")
                return "404", None
            if e.code < 500 or attempt == RETRIES:
                return f"error: HTTP {e.code}", None
        except _TRANSIENT as e:
            if attempt == RETRIES:
                return f"error: {e!r} after {RETRIES} attempts", None
        except (http.client.HTTPException, OSError) as e:
            return f"error: {e!r}", None
        time.sleep(RETRY_BACKOFF_S * 2 ** (attempt - 1))
    if not data.startswith(b"%PDF-"):
        return "error: not a PDF", None
    if not _whole_pdf(data):
        return "error: PDF has no %%EOF (cut short)", None
    part = pdf.with_suffix(".part")
    part.write_bytes(data)
    os.replace(part, pdf)
    return "ok", pdf


def pdf_text(path: Path) -> str:
    out = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        capture_output=True,
        text=True,
        check=True,
    )
    return out.stdout.translate(DEVANAGARI_DIGITS)


def parse_archive_text(text: str, designed: dict, asked: date) -> dict:
    """{'header_date', 'rows': [...], 'problems': [...]} for one archived file."""
    header = next(
        (m.group(1) for m in map(_HEADER_DATE.match, text.splitlines()[:12]) if m),
        None,
    )
    out = {
        "header_date": _iso(header) if header else None,
        "rows": [],
        "problems": [],
    }
    if out["header_date"] != asked.isoformat():
        out["problems"].append(f"header date {out['header_date']} is not {asked}")
        return out
    by_triple = {v: k for k, v in designed.items()}
    hits: dict[str, list] = {}
    for n, line in enumerate(text.splitlines()):
        m = _ROW.search(line)
        if not m:
            continue
        triple = (float(m["dead"]), float(m["live"]), float(m["gross"]))
        code = by_triple.get(triple)
        if code:
            hits.setdefault(code, []).append((n, m))
    for code in designed:
        if len(hits.get(code, [])) > 1:
            out["problems"].append(f"{code}: designed storage matches two rows")
            hits.pop(code)
        elif code not in hits:
            out["problems"].append(f"{code}: no row")
    lines = [found[0][0] for found in hits.values()]
    if lines and max(lines) - min(lines) > BLOCK_SPAN:
        out["problems"].append("rows are not together in one district block")
        return out
    readings = []
    for code, ((_, m),) in sorted(hits.items()):
        live, cur, pct = float(m["live"]), float(m["cur"]), float(m["pct"])
        reading = date.fromisoformat(_iso(m["date"]))
        if abs(cur / live * 100 - pct) > 0.06:
            out["problems"].append(f"{code}: {cur} of {live} is not {pct} %")
            continue
        if not timedelta(0) <= asked - reading <= timedelta(days=7):
            out["problems"].append(f"{code}: reading date {reading} vs file {asked}")
            continue
        readings.append(reading)
        out["rows"].append(
            {
                "source_code": code,
                "date": asked.isoformat(),
                "reading_date": reading.isoformat(),
                "archive_date": asked.isoformat(),
                "storage_mcum": round(cur, 2),
                "live_capacity_mcum": round(live, 2),
                "storage_tmc": round(cur / MCUM_PER_TMC, 3),
                "storage_pct_live": round(cur / live * 100, 1),
                "printed_pct_live": pct,
                "last_year_pct_live": float(m["ly_pct"]),
            }
        )
    if readings and max(readings) != asked:
        out["problems"].append(
            f"newest reading {max(readings)} is not the file date {asked}"
        )
    return out


def _dates(args) -> list[date]:
    if args.dates:
        return sorted({date.fromisoformat(s.strip()) for s in args.dates.split(",")})
    start = date.fromisoformat(args.from_)
    end = date.fromisoformat(args.to) if args.to else date.today() - timedelta(1)
    return [start + timedelta(n) for n in range((end - start).days + 1)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="nagpur", choices=sorted(DESIGNED_BY_CITY))
    when = ap.add_mutually_exclusive_group(required=True)
    when.add_argument("--from", dest="from_", help="first archive date, YYYY-MM-DD")
    when.add_argument("--dates", help="comma-separated YYYY-MM-DD archive dates")
    ap.add_argument("--to", help="last archive date (default yesterday)")
    ap.add_argument("--cache", required=True, help="PDF cache dir (resumable)")
    ap.add_argument("--sleep", type=float, default=2.0, help="pause between fetches")
    ap.add_argument("--timeout", type=int, default=180)
    out = ap.add_mutually_exclusive_group(required=True)
    out.add_argument("--dry-run", metavar="FILE", help="write candidate rows as JSONL")
    out.add_argument(
        "--supabase",
        action="store_true",
        help="INSERT missing rows into reservoir_daily_v2 (never overwrites); "
        "needs SUPABASE_URL + SUPABASE_SERVICE_KEY",
    )
    args = ap.parse_args()

    city = CITIES[args.city]
    designed = DESIGNED_BY_CITY[args.city]
    corporations = {sc: corps for sc, corps in city["dams"].values()}
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)

    kept: dict[tuple[str, str], dict] = {}
    by_reading: dict[tuple[str, str], dict] = {}
    log = []
    conflicts = 0
    for d in _dates(args):
        cached = (cache / f"mr_{_dmy(d)}.pdf").exists() or (
            cache / f"mr_{_dmy(d)}.404"
        ).exists()
        status, pdf = fetch(d, cache, args.timeout)
        entry = {"archive_date": d.isoformat(), "status": status}
        if pdf:
            parsed = parse_archive_text(pdf_text(pdf), designed, d)
            entry.update(rows=len(parsed["rows"]), problems=parsed["problems"])
            for r in parsed["rows"]:
                kept.setdefault((r["source_code"], r["date"]), r)
                key = (r["source_code"], r["reading_date"])
                if key not in by_reading:
                    by_reading[key] = r
                elif by_reading[key]["storage_mcum"] != r["storage_mcum"]:
                    conflicts += 1
                    entry["problems"].append(
                        f"{key}: {r['storage_mcum']} here, "
                        f"{by_reading[key]['storage_mcum']} in "
                        f"{by_reading[key]['archive_date']}"
                    )
        log.append(entry)
        print(json.dumps(entry, ensure_ascii=False), file=sys.stderr)
        if not cached:
            time.sleep(args.sleep)

    rows = sorted(kept.values(), key=lambda r: (r["source_code"], r["date"]))
    for r in rows:
        r["to_db"] = bool(corporations.get(r["source_code"]))
    ok = sum(1 for e in log if e["status"] == "ok")
    print(
        f"{args.city}: {len(log)} dates asked, {ok} files, "
        f"{sum(1 for e in log if e['status'] == '404')} not archived, "
        f"{len(rows)} dam-days ({sum(r['to_db'] for r in rows)} for the database), "
        f"{conflicts} conflicts",
        file=sys.stderr,
    )

    if args.dry_run:
        with open(args.dry_run, "w", encoding="utf-8") as fh:
            for e in log:
                fh.write(json.dumps({"kind": "file", **e}, ensure_ascii=False) + "\n")
            for r in rows:
                fh.write(json.dumps({"kind": "row", **r}, ensure_ascii=False) + "\n")
        print(f"dry run: wrote {args.dry_run}; no database touched", file=sys.stderr)
        return 0 if rows else 1

    from supabase import create_client

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    own = [r for r in rows if r["to_db"]]
    existing = set()
    for sc in sorted({r["source_code"] for r in own}):
        res = (
            sb.table("reservoir_daily_v2")
            .select("source_code,date")
            .eq("city_id", args.city)
            .eq("source_code", sc)
            .limit(20000)
            .execute()
        )
        existing |= {(x["source_code"], x["date"]) for x in res.data}
    payload = [
        {
            "city_id": args.city,
            "source_code": r["source_code"],
            "date": r["date"],
            "storage_tmc": r["storage_tmc"],
            "storage_pct_frl": r["storage_pct_live"],
            "level_ft": None,
            "inflow_cusecs": None,
            "outflow_cusecs": None,
            "source": SOURCE,
            "scraped_from": ARCHIVE_URL.format(
                dmy=_dmy(date.fromisoformat(r["archive_date"]))
            ),
        }
        for r in own
        if (r["source_code"], r["date"]) not in existing
    ]
    print(
        f"supabase: {len(existing)} rows already present, inserting {len(payload)}",
        file=sys.stderr,
    )
    for i in range(0, len(payload), 500):
        sb.table("reservoir_daily_v2").upsert(
            payload[i : i + 500],
            on_conflict="city_id,source_code,date",
            ignore_duplicates=True,
        ).execute()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Backfill weekly live-storage history for Mumbai's two CWC-monitored source
dams - Bhatsa and Upper Vaitarna - from the Central Water Commission's weekly
"Reservoir Storage Bulletin" PDFs (cwc.gov.in/reservoirs-storage-bulletin).

Why: the Pravah daily feed (scrape_pravah_dams.py) only started for us in
July 2026 and its same-date-last-year column reaches back one year at best.
The CWC bulletins list both dams weekly from 16 Apr 2015 to 8 May 2025 (the
listing stops there), which is ~10 years of history the reservoir charts
otherwise lack.

Mechanics:
  - The listing paginates (?page=0..~21, ~25 bulletins/page) and the PDF file
    names drift across eras (bulletin-DD-MM-YYYY.pdf, fb-DDMMYYYY.pdf,
    DD.MM.YYYY.pdf, ...), so we scrape the listing rows, not guess URLs.
  - Bulletin titles carry "AS ON DD.MM.YYYY" but contain typos (e.g. the
    08.05.2025 bulletin's title says 08.01.2025), so the per-dam DATE column
    inside the PDF is the date of record. It can itself be a carried-forward
    stale reading (old bulletins repeat a dam's last reading with its old
    date); upserting on (city_id, source_code, date) dedupes those for free.
  - Two table eras: pre-~2017 rows are single-line US-style dates
    ("*40 UPPER VAITARNA 603.50 596.83 0.331 0.137 4/16/2015 41 ..."), the
    current era uses DD.MM.YYYY and wraps long names across lines
    ("2 UPPER 603.500 597.470 0.331 0.152 01.05.2025 45.92 ..." / "VAITARNA").
    We match rows by numeric signature and join a pure-alpha continuation
    line into the name.
  - Units: capacity + live storage are BCM. storage_tmc = BCM * 1000/28.3168.
    storage_pct_frl uses the bulletin's own CURRENT% column when sane, else
    live/capacity. FRL sanity anchors (Bhatsa 142.07 m, Upper Vaitarna
    603.5 m) guard against misparses.
  - --supabase INSERTS ONLY MISSING (city_id, source_code, date) rows: the
    Pravah scraper owns 2024+ dates it has already written, and a backfill
    must never overwrite a live feed.

Run:
  cd neer-vazhvu-api
  python3 scripts/backfill_cwc_reservoirs.py --cache /tmp/cwc_cache --out cwc.json
  python3 scripts/backfill_cwc_reservoirs.py --cache /tmp/cwc_cache --supabase
  python3 scripts/backfill_cwc_reservoirs.py --test-pdf some_bulletin.pdf
"""

import argparse
import html as htmllib
import json
import os
import re
import ssl
import subprocess
import sys
import time
import urllib.request
from datetime import date

LISTING_URL = "https://cwc.gov.in/reservoirs-storage-bulletin"
MCUM_PER_TMC = 28.3168
TMC_PER_BCM = 1000.0 / MCUM_PER_TMC  # 35.3147

# name-match tokens -> (source_code, FRL sanity anchor in metres)
DAMS = {
    "bhatsa": ("bhatsa", 142.07),
    "upper vaitarna": ("upper_vaitarna", 603.50),
}

_NUM = r"\d+(?:\.\d+)?"
# numeric signature: FRL, level, cap_frl_bcm, live_bcm, date, current_pct ...
# name may be truncated by a wrap; date is DD.MM.YYYY or M/D/YYYY.
_ROW = re.compile(
    r"^\*?\s*\d+\s+(?P<name>[A-Z][A-Z ()'.&-]*?)\s+"
    r"(?P<frl>%(n)s)\s+(?P<level>%(n)s|-)\s+"
    r"(?P<cap>%(n)s)\s+(?P<live>%(n)s)\s+"
    r"(?P<date>\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+"
    r"(?P<pct>%(n)s|-)" % {"n": _NUM}
)
# some 2025 bulletins drop the per-dam date column from the main table
# (the date only appears in an annexure); the bulletin's own AS-ON date
# (title, or the URL's embedded date) stands in for the reading date.
_ROW_NODATE = re.compile(
    r"^\*?\s*\d+\s+(?P<name>[A-Z][A-Z ()'.&-]*?)\s+"
    r"(?P<frl>%(n)s)\s+(?P<level>%(n)s|-)\s+"
    r"(?P<cap>%(n)s)\s+(?P<live>%(n)s)\s+"
    r"(?P<pct>%(n)s)\s+%(n)s\s+%(n)s" % {"n": _NUM}
)
_ALPHA_LINE = re.compile(r"^[A-Z ()'.&-]+$")


def url_date_hint(url: str):
    """Pull DD-MM-YYYY / DDMMYYYY / DD.MM.YYYY out of a bulletin filename."""
    base = url.rsplit("/", 1)[-1]
    m = re.search(r"(\d{2})[-.]?(\d{2})[-.]?(\d{4})", base)
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        return date(y, mo, d).isoformat()
    except ValueError:
        return None


def _http_get(url: str, timeout: int = 90) -> bytes:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # cwc.gov.in's chain is often incomplete
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 neervazhvu-cwc-backfill"}
    )
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return resp.read()


def fetch_listing(cache_dir: str, max_pages: int = 40):
    """Yield (bulletin_hint_date_or_None, pdf_url) across all listing pages."""
    seen = set()
    for page in range(0, max_pages):
        url = LISTING_URL if page == 0 else f"{LISTING_URL}?page={page}"
        cache = os.path.join(cache_dir, f"listing_p{page}.html")
        if os.path.exists(cache):
            h = open(cache, encoding="utf-8", errors="replace").read()
        else:
            h = _http_get(url).decode("utf-8", errors="replace")
            open(cache, "w", encoding="utf-8").write(h)
            time.sleep(0.3)
        rows = re.findall(r"<tr[^>]*>(.*?)</tr>", h, re.S)
        page_pdfs = 0
        for r in rows:
            href = re.search(r'href="([^"]+\.pdf)"', r)
            if not href:
                continue
            pdf_url = htmllib.unescape(href.group(1))
            if pdf_url in seen:
                continue
            seen.add(pdf_url)
            page_pdfs += 1
            title = re.sub(r"<[^>]+>", " ", r)
            m = re.search(r"AS\s+ON\s+(\d{2})\.(\d{2})\.(\d{4})", title)
            hint = f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None
            yield hint, pdf_url
        if page_pdfs == 0:
            break


def _parse_row_date(raw: str, hint: str | None):
    """Row dates: DD.MM.YYYY / DD-MM-YYYY (new eras) or M/D/YYYY (old era, US-style)."""
    if "." in raw or "-" in raw:
        d, mo, y = re.split(r"[.-]", raw)
        if len(y) == 2:  # the 2024-25 era prints DD-MM-YY
            y = f"20{y}"
        try:
            return date(int(y), int(mo), int(d)).isoformat()
        except ValueError:
            try:  # rare M-D swaps
                return date(int(y), int(d), int(mo)).isoformat()
            except ValueError:
                return None
    mo, d, y = raw.split("/")  # verified US-style: "4/16/2015" in a 16-Apr bulletin
    try:
        return date(int(y), int(mo), int(d)).isoformat()
    except ValueError:
        # a handful of old rows are D/M/YYYY; try the swap before giving up
        try:
            return date(int(y), int(d), int(mo)).isoformat()
        except ValueError:
            return None


def parse_pdf(pdf_path: str, hint: str | None):
    """Extract Bhatsa + Upper Vaitarna readings from one bulletin."""
    out = subprocess.run(
        ["pdftotext", "-layout", pdf_path, "-"],
        capture_output=True,
        text=True,
    )
    if out.returncode != 0:
        return [], f"pdftotext failed: {os.path.basename(pdf_path)}"
    lines = out.stdout.splitlines()
    readings = {}
    for i, line in enumerate(lines):
        stripped = line.strip()
        m = _ROW.match(stripped)
        dated = True
        if not m:
            m = _ROW_NODATE.match(stripped)
            dated = False
        if not m:
            continue
        name = re.sub(r"\s+", " ", m.group("name")).strip().lower()
        # join a wrapped continuation line ("UPPER" ... next line "VAITARNA")
        if i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            if nxt and _ALPHA_LINE.match(nxt) and len(nxt) < 30:
                name = f"{name} {nxt.strip().lower()}"
        hit = next((k for k in DAMS if k in name), None)
        if not hit or DAMS[hit][0] in readings:
            continue
        source_code, frl_anchor = DAMS[hit]
        frl = float(m.group("frl"))
        if abs(frl - frl_anchor) > 1.0:
            continue  # numeric signature matched some other table/dam
        cap = float(m.group("cap"))
        live = float(m.group("live"))
        d = _parse_row_date(m.group("date"), hint) if dated else hint
        if not d or not cap or live < 0 or live > cap * 1.15:
            continue
        pct_raw = m.group("pct")
        pct = float(pct_raw) if pct_raw not in ("-",) else None
        computed = live / cap * 100.0
        if pct is None or pct <= 0 or pct > 110 or abs(pct - computed) > 12:
            pct = computed
        readings[source_code] = {
            "source_code": source_code,
            "date": d,
            "storage_bcm": live,
            "capacity_frl_bcm": cap,
            "storage_tmc": round(live * TMC_PER_BCM, 3),
            "storage_pct_frl": round(pct, 1),
            "bulletin": os.path.basename(pdf_path),
        }
    missing = {sc for sc, _ in DAMS.values()} - set(readings)
    warn = (
        f"{os.path.basename(pdf_path)}: missing {sorted(missing)}" if missing else None
    )
    return list(readings.values()), warn


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--cache", required=True, help="dir for listing HTML + PDFs (resumable)"
    )
    ap.add_argument("--out", help="write consolidated JSON here")
    ap.add_argument(
        "--limit", type=int, help="only process the first N bulletins (dry-run)"
    )
    ap.add_argument("--test-pdf", help="parse one local PDF and print, then exit")
    ap.add_argument(
        "--supabase",
        action="store_true",
        help="insert MISSING (city,source,date) rows into reservoir_daily_v2; "
        "never overwrites existing (Pravah-owned) rows",
    )
    args = ap.parse_args()

    if args.test_pdf:
        readings, warn = parse_pdf(args.test_pdf, None)
        print(json.dumps(readings, indent=2))
        if warn:
            print(warn, file=sys.stderr)
        return 0

    os.makedirs(args.cache, exist_ok=True)
    entries = list(fetch_listing(args.cache))
    if args.limit:
        entries = entries[: args.limit]
    print(f"listing: {len(entries)} bulletins", file=sys.stderr)

    all_rows = []
    warns = []
    for n, (hint, url) in enumerate(entries, 1):
        fname = re.sub(r"[^A-Za-z0-9._-]", "_", url.rsplit("/", 1)[-1])
        pdf_path = os.path.join(args.cache, fname)
        if not os.path.exists(pdf_path) or os.path.getsize(pdf_path) < 1000:
            try:
                data = _http_get(url)
                if not data.startswith(b"%PDF"):
                    warns.append(f"not a PDF: {url}")
                    continue
                open(pdf_path, "wb").write(data)
                time.sleep(0.4)
            except Exception as e:  # noqa: BLE001 - log and continue the sweep
                warns.append(f"download failed: {url} ({e})")
                continue
        readings, warn = parse_pdf(pdf_path, hint or url_date_hint(url))
        if warn:
            warns.append(warn)
        all_rows.extend(readings)
        if n % 50 == 0:
            print(
                f"  ...{n}/{len(entries)} bulletins, {len(all_rows)} readings",
                file=sys.stderr,
            )

    # collapse to one reading per (source_code, date) - stale carried-forward
    # rows repeat across bulletins; keep the first seen (newest bulletin).
    dedup = {}
    for r in all_rows:
        dedup.setdefault((r["source_code"], r["date"]), r)
    rows = sorted(dedup.values(), key=lambda r: (r["source_code"], r["date"]))
    by_src = {}
    for r in rows:
        by_src.setdefault(r["source_code"], []).append(r["date"])
    for sc, ds in sorted(by_src.items()):
        print(f"{sc}: {len(ds)} unique dates, {ds[0]} .. {ds[-1]}", file=sys.stderr)
    if warns:
        print(f"{len(warns)} warnings (first 10):", file=sys.stderr)
        for w in warns[:10]:
            print(f"  {w}", file=sys.stderr)

    if args.out:
        json.dump(
            {
                "_source": "CWC weekly Reservoir Storage Bulletin (cwc.gov.in)",
                "_fetched": date.today().isoformat(),
                "readings": rows,
            },
            open(args.out, "w", encoding="utf-8"),
            indent=2,
        )

    if args.supabase:
        from supabase import create_client

        sb = create_client(
            os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"]
        )
        existing = set()
        for sc in ("bhatsa", "upper_vaitarna"):
            res = (
                sb.table("reservoir_daily_v2")
                .select("source_code,date")
                .eq("city_id", "mumbai")
                .eq("source_code", sc)
                .limit(10000)
                .execute()
            )
            existing |= {(r["source_code"], r["date"]) for r in res.data}
        payload = [
            {
                "city_id": "mumbai",
                "source_code": r["source_code"],
                "date": r["date"],
                "storage_tmc": r["storage_tmc"],
                "storage_pct_frl": r["storage_pct_frl"],
                "level_ft": None,
                "inflow_cusecs": None,
                "outflow_cusecs": None,
                "source": "CWC weekly Reservoir Storage Bulletin",
                "scraped_from": LISTING_URL,
            }
            for r in rows
            if (r["source_code"], r["date"]) not in existing
        ]
        print(
            f"supabase: {len(existing)} rows already present, inserting {len(payload)} new",
            file=sys.stderr,
        )
        for i in range(0, len(payload), 500):
            sb.table("reservoir_daily_v2").upsert(
                payload[i : i + 500], on_conflict="city_id,source_code,date"
            ).execute()
        print("supabase: done", file=sys.stderr)

    return 0 if rows else 1


if __name__ == "__main__":
    raise SystemExit(main())

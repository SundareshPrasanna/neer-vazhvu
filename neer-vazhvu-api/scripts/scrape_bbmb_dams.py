#!/usr/bin/env python3
"""
Scrape the BBMB daily reservoir bulletin (Bhakra + Pong) for Delhi.

WHY THIS EXISTS
Delhi is the only live city with no raw-water feed at all: all six of its
sources ship `hasPublicFeed: false` (see src/lib/cities/delhi.ts), so its one
daily layer is rainfall. Bhakra is upstream storage behind Delhi's own BBMB
allocation, and BBMB publishes it daily again - which is new. The city config
and delhi-cgwb-stations.json both said BBMB's page "has not updated since
04.09.2025"; that was true when written and is stale as of 2026-07-26, when the
feed served "as on 26-07-2026 06:00 Hrs".

WHY IT IS URGENT
BBMB overwrites ONE file in place and publishes CURRENT DAY ONLY - there is no
archive and no dated URL. Every day this does not run is lost permanently and
cannot be backfilled from anywhere. That is the whole argument for a daily cron
rather than an on-demand pull.

WHERE IT RUNS
bbmb.gov.in is 164.100.158.163 - NICNET. Per the network constraint in
delhi.ts, NICNET hosts refuse non-India IPs, so this belongs in the launchd
job on the India-IP runner alongside CMWSSB, KWRIS and Pravah, NOT in CI.
(Reachability is per host, not per range: nmcg.nic.in is NICNET and reachable,
cpcb.nic.in is NICNET and dead. See docs/specs/headwaters-coverage-audit.md.)

WHAT IT DOES NOT DO
It records level, inflow and outflow, and leaves storage_tmc / storage_pct_frl
NULL. Reservoir level over FRL is NOT a volume ratio, and Delhi's share of
Bhakra is fixed per season in BBMB TC minutes and never published - so deriving
a "% full" here would invent precision the source does not carry. This mirrors
the deliberate full_capacity NULL decision already documented in delhi.ts.

Run:  cd neer-vazhvu-api && python3 scripts/scrape_bbmb_dams.py --out ../public/data/bbmb-dam-storage.json --supabase
"""

import argparse
import json
import re
import ssl
import subprocess
import sys
import tempfile
import urllib.request
from datetime import date, datetime

BBMB_URL = "https://bbmb.gov.in/writereaddata/Portal/Images/pdf/res_data.pdf"

# BBMB dam -> (our source_code, city_id or None, FRL ft for context only).
# Pong is carried for basin context: it is not one of Delhi's registered
# sources, so it lands in the JSON artifact but never in reservoir_daily_v2.
# Pong's "Reduced FRL" (1390) is the operative level, not the design 1400.
DAMS = {
    "bhakra": {"source_code": "bhakra", "city_id": "delhi", "frl_ft": 1680.0},
    "pong": {"source_code": "pong", "city_id": None, "frl_ft": 1390.0},
}

# "as on 26-07-2026 06:00 Hrs."
_AS_ON = re.compile(r"as on\s+(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}:\d{2})", re.I)
# "Bhakra                1592.91                    40363         26132"
_ROW = re.compile(
    r"^(?P<name>[A-Za-z]+)\s+(?P<level>\d+(?:\.\d+)?)\s+"
    r"(?P<inflow>\d+)\s+(?P<outflow>\d+)\s*$"
)


def _fetch_pdf(path: str) -> None:
    """BBMB serves an INCOMPLETE CERT CHAIN, so verification is disabled here -
    the same call Pravah makes, and the same failure CGWB shows.

    Worth spelling out because it is easy to get wrong: `curl` succeeds against
    this host on macOS because it uses the system keychain, which carries the
    intermediate. Python fails with CERTIFICATE_VERIFY_FAILED / "unable to get
    local issuer certificate" under both the default context and certifi
    (verified 2026-07-26). So "curl works" is NOT evidence that the chain is
    valid, and an earlier draft of this scraper asserted exactly that and broke.

    Tradeoff accepted: this is a public bulletin PDF we parse, not a credential
    exchange, and the content is sanity-checked below.
    """
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(
        BBMB_URL, headers={"User-Agent": "Mozilla/5.0 neervazhvu-bbmb"}
    )
    with urllib.request.urlopen(req, timeout=90, context=ctx) as resp:
        data = resp.read()
    if not data.startswith(b"%PDF"):
        raise RuntimeError("BBMB did not return a PDF (portal error page?)")
    with open(path, "wb") as fh:
        fh.write(data)


def _pdf_to_text(pdf_path: str) -> str:
    out = subprocess.run(
        ["pdftotext", "-layout", pdf_path, "-"],
        capture_output=True,
        text=True,
        check=True,
    )
    return out.stdout


def parse(text: str) -> tuple[str | None, list[dict]]:
    """Return (report_date_iso, readings). Exposed for tests."""
    m = _AS_ON.search(text)
    report_date = f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None
    report_time = m.group(4) if m else None

    readings = []
    for line in text.splitlines():
        row = _ROW.match(line.strip())
        if not row:
            continue
        key = row.group("name").strip().lower()
        if key not in DAMS:
            continue
        spec = DAMS[key]
        readings.append(
            {
                "source_code": spec["source_code"],
                "bbmb_name": row.group("name").strip(),
                "city_id": spec["city_id"],
                "date": report_date,
                "reading_time": report_time,
                "level_ft": float(row.group("level")),
                "frl_ft": spec["frl_ft"],
                "inflow_cusecs": int(row.group("inflow")),
                "outflow_cusecs": int(row.group("outflow")),
            }
        )
    return report_date, readings


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="write the JSON artifact here")
    ap.add_argument("--pdf", help="parse an already-downloaded PDF instead of fetching")
    ap.add_argument(
        "--supabase",
        action="store_true",
        help="upsert Bhakra into reservoir_daily_v2 (city_id=delhi). "
        "Needs SUPABASE_URL + SUPABASE_SERVICE_KEY.",
    )
    args = ap.parse_args()

    if args.pdf:
        pdf_path = args.pdf
    else:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            pdf_path = tmp.name
        _fetch_pdf(pdf_path)

    report_date, readings = parse(_pdf_to_text(pdf_path))
    if not readings:
        print("BBMB: no dam rows parsed - layout may have changed", file=sys.stderr)
        return 1
    if not report_date:
        print("BBMB: no 'as on' date found - refusing to date rows", file=sys.stderr)
        return 1

    # A stale bulletin is the failure mode this feed is most prone to: BBMB
    # froze for ~10 months before 2026-07. Say so rather than silently
    # re-upserting yesterday's numbers under today's date.
    age = (date.today() - datetime.fromisoformat(report_date).date()).days
    if age > 2:
        print(
            f"BBMB: WARNING bulletin is {age} days old (as on {report_date}) - "
            "the feed may have frozen again",
            file=sys.stderr,
        )

    out = {
        "_source": "BBMB daily reservoir bulletin (Bhakra + Pong)",
        "_source_url": BBMB_URL,
        "_fetched": date.today().isoformat(),
        "_report_date": report_date,
        "_note": (
            "Bhakra is upstream storage behind Delhi's BBMB allocation, not "
            "Delhi's own reservoir - Delhi's share is fixed per season in BBMB "
            "TC minutes and is never published separately. Pong is carried for "
            "basin context only and is not a registered Delhi source. Level is "
            "NOT a volume ratio, so no storage % is derived here."
        ),
        "_archive_warning": (
            "BBMB overwrites this single file daily and publishes CURRENT DAY "
            "ONLY - no dated URLs, no archive. Any day this scraper does not "
            "run is lost permanently."
        ),
        "dams": sorted(readings, key=lambda r: r["source_code"]),
    }
    payload = json.dumps(out, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(payload + "\n")

    if args.supabase:
        import os

        from supabase import create_client

        rows = [
            {
                "city_id": r["city_id"],
                "source_code": r["source_code"],
                "date": r["date"],
                # storage_tmc / storage_pct_frl stay NULL on purpose - see the
                # module docstring. BBMB publishes level, not volume.
                "storage_tmc": None,
                "storage_pct_frl": None,
                "level_ft": r["level_ft"],
                "inflow_cusecs": r["inflow_cusecs"],
                "outflow_cusecs": r["outflow_cusecs"],
                "source": "BBMB daily reservoir bulletin",
                "scraped_from": BBMB_URL,
            }
            for r in readings
            if r["city_id"]
        ]
        if rows:
            sb = create_client(
                os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"]
            )
            sb.table("reservoir_daily_v2").upsert(
                rows, on_conflict="city_id,source_code,date"
            ).execute()
            print(
                f"Upserted {len(rows)} BBMB row(s) to reservoir_daily_v2",
                file=sys.stderr,
            )

    summary = ", ".join(f"{r['bbmb_name']} {r['level_ft']}ft" for r in readings)
    print(
        f"BBMB: parsed {len(readings)} dam(s) as on {report_date} ({summary})",
        file=sys.stderr,
    )
    if not args.out:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

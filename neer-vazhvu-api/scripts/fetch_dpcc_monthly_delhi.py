"""Discover + archive DPCC's monthly Yamuna / drain / STP analysis reports.

DPCC publishes the highest-cadence river+drain water-quality feed of any
Indian metro - monthly scanned PDFs on dpcc.delhi.gov.in (Drupal; the old
dpcc.delhigovt.nic.in redirects there; reachable from ordinary networks,
NOT NICNET-blocked):

  - river_yamuna_<month>.pdf       8 stations: pH/BOD/COD/DO/FC/PO4/NH3-N
  - drain_<month>.pdf              ~39 points in 3 report series (direct
                                   outfalls, Najafgarh subdrains + Jheel
                                   up/downstream, UP outfalls, Agra canal)
  - stp_analysis_report_<month>.pdf  per-STP compliance (~30 pp) - data the
                                   May-2026 audit assumed was RTI-gated

This script does the automatable half: scrape the listing + archive pages,
classify PDFs by kind and month, download anything new into an archive
directory, and maintain an index JSON. The PDFs are IMAGE SCANS (no text
layer) - value extraction is manual transcription today (see
public/data/dpcc-monthly-wq-delhi.json) with tesseract-based OCR a wiring
task for the scheduled runner.

Run:  python scripts/fetch_dpcc_monthly_delhi.py [--archive-dir DIR]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

BASE = "https://dpcc.delhi.gov.in"
LISTING_PAGES = [
    f"{BASE}/dpcc/analysis-reports",
    f"{BASE}/dpcc/archive/analysis-reports",
]
UA = "neer-vazhvu/delhi-onboarding (https://neervazhvu.org; civic water dashboard)"

PDF_RE = re.compile(r'"(/sites/default/files/DPCC/analysis-report/[^"]+\.pdf)"')

MONTH_TOKENS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11,
    "december": 12, "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}


def classify(filename: str) -> str:
    f = filename.lower()
    if "river" in f or "yamuna" in f:
        return "river"
    if "stp" in f:
        return "stp"
    if "drain" in f:
        return "drain"
    return "other"


def parse_month(filename: str) -> str | None:
    """Best-effort '<YYYY>-<MM>' from DPCC's untidy filenames.

    Handles 'river_yamuna_may-26%29_0001.pdf', 'river_yamuna_january_2026.pdf',
    'drain_march-26%29_1%29.pdf' style names.
    """
    f = urllib.parse.unquote(filename.lower())
    for token, m in MONTH_TOKENS.items():
        match = re.search(rf"{token}[_-]?((?:20)?\d{{2}})", f)
        if match:
            yy = match.group(1)
            year = int(yy) if len(yy) == 4 else 2000 + int(yy)
            return f"{year:04d}-{m:02d}"
    return None


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=120).read()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--archive-dir",
        default=str(Path.home() / ".local/neervazhvu-ops/dpcc-archive"),
        help="where PDFs and the index are kept (default: the ops dir used by the local scheduled jobs)",
    )
    args = ap.parse_args()
    archive = Path(args.archive_dir)
    archive.mkdir(parents=True, exist_ok=True)
    index_path = archive / "index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {"files": {}}

    discovered: dict[str, dict] = {}
    for page in LISTING_PAGES:
        try:
            html = fetch(page).decode("utf-8", errors="ignore")
        except Exception as e:  # noqa: BLE001 - listing page failures should not kill the run
            print(f"WARN: {page}: {e}", file=sys.stderr)
            continue
        for rel in PDF_RE.findall(html):
            url = BASE + rel
            name = rel.rsplit("/", 1)[-1]
            discovered[name] = {
                "url": url,
                "kind": classify(name),
                "month": parse_month(name),
                "listing": page,
            }

    print(f"discovered {len(discovered)} PDFs on the listing pages")
    new = 0
    for name, meta in sorted(discovered.items()):
        if meta["kind"] == "other":
            continue
        dest = archive / name
        if name in index["files"] and dest.exists():
            continue
        try:
            data = fetch(meta["url"])
        except Exception as e:  # noqa: BLE001
            print(f"WARN: download failed {name}: {e}", file=sys.stderr)
            continue
        dest.write_bytes(data)
        index["files"][name] = {**meta, "bytes": len(data), "fetched": date.today().isoformat()}
        new += 1
        print(f"archived {name} ({meta['kind']}, {meta['month']}, {len(data):,} bytes)")

    index["last_run"] = date.today().isoformat()
    index_path.write_text(json.dumps(index, indent=1))
    kinds = {}
    for m in index["files"].values():
        kinds[m["kind"]] = kinds.get(m["kind"], 0) + 1
    print(f"index: {len(index['files'])} files {kinds}; {new} new this run")
    print("NOTE: PDFs are image scans - transcribe/OCR into public/data/dpcc-monthly-wq-delhi.json")


if __name__ == "__main__":
    main()

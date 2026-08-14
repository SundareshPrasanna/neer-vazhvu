#!/usr/bin/env python3
"""
Fetch HMDA's gazetted lake register for the Hyderabad Metropolitan Region.

This is the LEGAL layer for Hyderabad's lakes, and it is the city's signature
accountability finding. Every lake in the region is supposed to get a Full Tank
Level (FTL) boundary fixed in two steps: a PRELIMINARY notification, then a
FINAL one after objections. Until the final notification issues, the boundary
is not legally settled - which is precisely the state encroachment thrives in.

The register says: every lake has a preliminary notification, and **fewer than
half have a final one**.

Source
------
https://lakes.hmda.gov.in/ - ASP.NET WebForms on IIS. The ENTIRE register
renders in a single ~4.2 MB GridView on the landing page, with no paging, so
one GET is the whole dataset. Use a long timeout.

Per-lake documents (FTL map, cadastral map, buffer-zone sheet) hang off
__doPostBack buttons on each row. They are SCANNED RASTER PDFs - pdftotext
returns zero characters - so there is no machine-readable polygon here and
digitising ~3,000 boundaries is not viable. What IS tractable is OCR of the
fixed-position "LAKE DETAILS" title block (area at FTL in acres, FTL elevation
in m, FTL perimeter, bund length, survey date), which is a separate follow-up.
This script takes only the tabular register.

Relationship to the OSM layer
-----------------------------
`public/geojson/hyderabad-water-bodies-current.geojson` is the GEOMETRY (669
OSM polygons). This register is the LEGAL STATUS (~2,978 rows). Neither
substitutes for the other: a lake can be gazetted and absent from OSM, or
mapped in OSM and never notified. They are joined on normalised name +
village where possible, and the unmatched share on both sides is reported
rather than hidden.

Run
---
    cd neer-vazhvu-api
    python3 scripts/fetch_hmda_lake_register.py \
        --out ../public/data/hyderabad-lake-register.json
"""

import argparse
import html
import json
import re
import ssl
import sys
from pathlib import Path
import urllib.request
from collections import Counter
from datetime import date

# The registry owns every registered source's licence string; a second copy in
# a generator is how the registry and the corpus drifted apart (PR #227).
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from registry_license import registry_license  # noqa: E402


REGISTER_URL = "https://lakes.hmda.gov.in/"

# The GridView's own column order.
COLS = [
    "sno",
    "district",
    "mandal",
    "village",
    "lake_name",
    "lake_id",
    "preliminary_notification",
    "final_notification",
]


def _fetch(url: str, timeout: int = 240) -> str:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 neervazhvu-hmda"
        },
    )
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return resp.read().decode("utf8", "ignore")


def _norm_date(s: str):
    """dd-mm-yyyy -> ISO. Returns None for blanks."""
    s = (s or "").strip()
    m = re.match(r"^(\d{2})-(\d{2})-(\d{4})$", s)
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


def parse_register(page: str) -> list:
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", page, flags=re.S | re.I):
        cells = [
            html.unescape(re.sub(r"<[^>]+>", "", c)).strip()
            for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, flags=re.S | re.I)
        ]
        # Data rows lead with a numeric serial. The header row and the
        # district <select> both land in <td>s, hence the isdigit() gate.
        if len(cells) < 8 or not cells[0].strip().isdigit():
            continue
        v = dict(zip(COLS, cells[:8]))
        district = v["district"].strip()
        # The dropdown placeholder leaks into the grid as a row.
        if district.startswith("--"):
            continue
        prelim = _norm_date(v["preliminary_notification"])
        final = _norm_date(v["final_notification"])
        rows.append(
            {
                "lake_id": v["lake_id"].strip(),
                "lake_name": re.sub(r"\s+", " ", v["lake_name"]).strip(),
                "district": district,
                "mandal": v["mandal"].strip(),
                "village": v["village"].strip(),
                "preliminary_notification": prelim,
                "final_notification": final,
                # The whole point of the dataset.
                "boundary_legally_final": final is not None,
            }
        )
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="write JSON here (default: stdout summary only)")
    ap.add_argument("--html", help="parse this saved page instead of fetching")
    args = ap.parse_args()

    page = (
        open(args.html, encoding="utf8", errors="ignore").read()
        if args.html
        else _fetch(REGISTER_URL)
    )
    print(f"Fetched {len(page):,} bytes", file=sys.stderr)

    lakes = parse_register(page)
    if not lakes:
        print("HMDA: parsed 0 lakes - the grid layout changed", file=sys.stderr)
        return 1

    final = [x for x in lakes if x["boundary_legally_final"]]
    by_district = Counter(x["district"] for x in lakes)
    final_by_district = Counter(x["district"] for x in final)
    final_by_year = Counter(
        x["final_notification"][:4] for x in final if x["final_notification"]
    )

    districts = [
        {
            "district": d,
            "lakes": n,
            "final_notified": final_by_district.get(d, 0),
            "pct_final": round(final_by_district.get(d, 0) / n * 100, 1) if n else None,
        }
        for d, n in by_district.most_common()
    ]

    out = {
        "_source": "HMDA Lake Protection Committee gazetted lake register",
        "_source_url": REGISTER_URL,
        "_fetched": date.today().isoformat(),
        "_licence": registry_license("hmda-lakes-register"),
        "_note": (
            "FTL = Full Tank Level, the gazetted boundary of a lake. A lake gets a "
            "PRELIMINARY notification, then a FINAL one after objections. Until the "
            "final notification issues the boundary is not legally settled, which is "
            "the state encroachment thrives in. The per-lake FTL, cadastral and "
            "buffer-zone sheets behind this register are scanned raster PDFs with no "
            "extractable text, so no machine-readable polygon exists; this file is the "
            "tabular register only."
        ),
        "total_lakes": len(lakes),
        "final_notified": len(final),
        "pct_final_notified": round(len(final) / len(lakes) * 100, 1),
        "awaiting_final_notification": len(lakes) - len(final),
        "by_district": districts,
        "final_notifications_by_year": dict(sorted(final_by_year.items())),
        "lakes": sorted(
            lakes, key=lambda x: (x["district"], x["mandal"], x["lake_name"])
        ),
    }

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(out, fh, ensure_ascii=False, indent=1)

    print(
        f"HMDA lake register: {len(lakes):,} lakes, "
        f"{len(final):,} finally notified ({out['pct_final_notified']}%), "
        f"{out['awaiting_final_notification']:,} awaiting",
        file=sys.stderr,
    )
    for d in districts:
        print(
            f"   {d['district']:<22}{d['lakes']:>6} lakes"
            f"{d['final_notified']:>7} final  {d['pct_final']:>6}%",
            file=sys.stderr,
        )
    print(
        f"   final notifications by year: {out['final_notifications_by_year']}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

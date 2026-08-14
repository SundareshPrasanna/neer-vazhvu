#!/usr/bin/env python3
"""
Build Hyderabad's tanker series from HMWSSB's own booking records.

WHY THIS IS DIFFERENT FROM EVERY OTHER CITY'S TANKER PAGE
---------------------------------------------------------
Bengaluru's tanker page rests on OpenCity household SURVEYS (2015/2019/2024)
because that market is private, unregulated and RTI-gated: nobody publishes how
many tankers ran. Chennai's is mixed. Hyderabad is the exception - HMWSSB runs
the tanker fleet ITSELF, takes bookings through its own portal, and publishes
monthly counts of bookings AND deliveries per division and section.

WHAT THE DATA ACTUALLY SHOWS (checked before designing the page)
---------------------------------------------------------------
The obvious metric - a booking-to-delivery fulfilment rate by locality - turns
out to be a DEAD END, and that is itself the finding: HMWSSB delivers 1,315,622
of 1,316,215 bookings, 99.95%, and the worst-performing section of 201 still
sits at 98.4%. The tanker system is not rationed. Shipping a fulfilment chart
would mean shipping a flat line at 100% and implying it meant something.

So the page is built on the two dimensions that DO carry signal:

  1. SEASONALITY. Bookings swing ~3x within a year - 28-33k/month in the
     Sep-Nov post-monsoon trough against 78-93k in the Mar-Jun summer peak.
     Tanker demand is a drought signal, not a baseline.
  2. GEOGRAPHY, which is the real story. The top sections are Madhapur,
     Kondapur, Hafeezpet, Gachibowli, Manikonda, Nizampet, KPHB - i.e. the
     western IT corridor and the new growth belt, plus Banjara Hills and
     Jubilee Hills. NOT the old city. Tanker dependence in Hyderabad tracks
     where the city was built faster than its piped network, which cuts
     against the usual assumption that tankers serve the poorest areas.
     It is also the same geography as the lake register's weakest legal
     coverage (Rangareddy: 891 lakes, only 34.5% finally notified).

Source
------
OpenCity dataset `hyderabad-water-supply-through-tankers-data` (HMWSSB data,
OpenCity digitisation - attribute BOTH). 26 monthly CSVs, Jan 2022 - Feb 2024.
Schema: year,month,division,section,noofbookings,delivered

`section` is HMWSSB's own sub-ward operational unit (zone > circle > division >
section), NOT a GHMC ward. There is no published section-boundary geometry, so
this ships as a ranked table keyed on section name, not a choropleth. Said
plainly rather than faked with a ward join that would be wrong.

KNOWN GAPS, both upstream and both recorded in the output:
  - The published series STOPS at Feb 2024. Watched by the Headwaters entry
    `opencity-hyderabad-tankers`; a new CSV appearing there is the event we want.
  - **Dec 2022 is missing.** The resource exists on OpenCity but the file is
    11 bytes - empty at source, not a parse failure. Verified 2026-07-26. The
    month is reported as a gap rather than interpolated.

Run
---
    cd neer-vazhvu-api
    python3 scripts/build_hyderabad_tankers.py \
        --out ../public/data/hyderabad-tankers.json
"""

import argparse
import csv
import io
import json
import sys
from pathlib import Path
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date

# The registry owns every registered source's licence string; a second copy in
# a generator is how the registry and the corpus drifted apart (PR #227).
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from registry_license import registry_license  # noqa: E402


CKAN = "https://data.opencity.in/api/3/action/package_show?id="
DATASET = "hyderabad-water-supply-through-tankers-data"

MONTHS = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]


def _get(url: str, timeout: int = 90) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "neervazhvu-hyd-tankers"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def resource_urls() -> list:
    meta = json.loads(_get(CKAN + urllib.parse.quote(DATASET)))
    if not meta.get("success"):
        raise RuntimeError("CKAN package_show failed")
    out = []
    for r in meta["result"].get("resources", []):
        if (r.get("format") or "").upper() == "CSV" and r.get("url"):
            out.append((r.get("name") or "", r["url"]))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="write JSON here")
    args = ap.parse_args()

    resources = resource_urls()
    print(f"CKAN lists {len(resources)} CSV resources", file=sys.stderr)

    rows = []
    failed = []
    empty = []
    for name, url in resources:
        try:
            raw = _get(url).decode("utf8", "ignore")
        except Exception as exc:  # noqa: BLE001 - one bad month must not kill the build
            failed.append((name, str(exc)[:60]))
            continue
        n_before = len(rows)
        for rec in csv.DictReader(io.StringIO(raw)):
            try:
                y = int(rec["year"])
                m = int(rec["month"])
                bookings = int(float(rec["noofbookings"] or 0))
                delivered = int(float(rec["delivered"] or 0))
            except (KeyError, TypeError, ValueError):
                continue
            section = (rec.get("section") or "").strip()
            if not section:
                continue
            rows.append(
                {
                    "year": y,
                    "month": m,
                    "division": (rec.get("division") or "").strip(),
                    "section": section,
                    "bookings": bookings,
                    "delivered": delivered,
                }
            )
        if len(rows) == n_before:
            # An advertised month that yields nothing is an upstream gap, not a
            # silent skip. Dec 2022 is one (11-byte file).
            empty.append(name)

    if not rows:
        print("No tanker rows parsed", file=sys.stderr)
        return 1

    # Monthly totals.
    by_month = defaultdict(lambda: {"bookings": 0, "delivered": 0, "sections": 0})
    for r in rows:
        k = f"{r['year']:04d}-{r['month']:02d}"
        by_month[k]["bookings"] += r["bookings"]
        by_month[k]["delivered"] += r["delivered"]
        by_month[k]["sections"] += 1
    monthly = [
        {
            "month": k,
            "label": f"{MONTHS[int(k[5:])]} {k[:4]}",
            "bookings": v["bookings"],
            "delivered": v["delivered"],
            "fulfilment_pct": round(v["delivered"] / v["bookings"] * 100, 1)
            if v["bookings"]
            else None,
            "sections_reporting": v["sections"],
        }
        for k, v in sorted(by_month.items())
    ]

    # Per-section totals across the whole series.
    by_section = defaultdict(
        lambda: {"bookings": 0, "delivered": 0, "months": 0, "division": ""}
    )
    for r in rows:
        s = by_section[r["section"]]
        s["bookings"] += r["bookings"]
        s["delivered"] += r["delivered"]
        s["months"] += 1
        s["division"] = s["division"] or r["division"]
    sections = sorted(
        (
            {
                "section": name,
                "division": v["division"],
                "bookings": v["bookings"],
                "delivered": v["delivered"],
                "shortfall": v["bookings"] - v["delivered"],
                "fulfilment_pct": round(v["delivered"] / v["bookings"] * 100, 1)
                if v["bookings"]
                else None,
                "months_reporting": v["months"],
            }
            for name, v in by_section.items()
        ),
        key=lambda x: -x["bookings"],
    )

    # Seasonality: mean bookings per calendar month across all years present.
    per_cal = defaultdict(list)
    for k, v in by_month.items():
        per_cal[int(k[5:])].append(v["bookings"])
    seasonality = [
        {
            "month": mi,
            "label": MONTHS[mi],
            "mean_bookings": round(sum(vals) / len(vals)),
            "years": len(vals),
        }
        for mi, vals in sorted(per_cal.items())
    ]

    by_div = defaultdict(lambda: {"bookings": 0, "delivered": 0, "sections": set()})
    for r in rows:
        d = by_div[r["division"]]
        d["bookings"] += r["bookings"]
        d["delivered"] += r["delivered"]
        d["sections"].add(r["section"])
    divisions = sorted(
        (
            {
                "division": k,
                "bookings": v["bookings"],
                "delivered": v["delivered"],
                "sections": len(v["sections"]),
            }
            for k, v in by_div.items()
        ),
        key=lambda x: -x["bookings"],
    )

    tot_b = sum(r["bookings"] for r in rows)
    tot_d = sum(r["delivered"] for r in rows)

    out = {
        "_source": "HMWSSB tanker bookings and deliveries",
        "_source_url": f"https://data.opencity.in/dataset/{DATASET}",
        "_licence": registry_license("opencity-hyderabad-tankers"),
        "_fetched": date.today().isoformat(),
        "_note": (
            "Monthly tanker bookings AND deliveries per HMWSSB division and section. "
            "Unique on the platform: Bengaluru's tanker page rests on household surveys "
            "because that market is private and RTI-gated, whereas HMWSSB runs the fleet "
            "itself. 'section' is HMWSSB's own operational unit, NOT a GHMC ward, and no "
            "public section-boundary geometry exists - so this renders as a ranked table, "
            "not a map."
        ),
        "_coverage_gap": (
            f"Series runs {monthly[0]['label']} to {monthly[-1]['label']}. No known public "
            "release after that; the Headwaters entry opencity-hyderabad-tankers watches "
            "for one."
        ),
        "totals": {
            "bookings": tot_b,
            "delivered": tot_d,
            "shortfall": tot_b - tot_d,
            "fulfilment_pct": round(tot_d / tot_b * 100, 1) if tot_b else None,
            "months": len(monthly),
            "sections": len(sections),
        },
        "monthly": monthly,
        "seasonality": seasonality,
        "divisions": divisions,
        "sections": sections,
    }
    if empty:
        out["_empty_upstream_months"] = empty
    if failed:
        out["_failed_resources"] = [{"name": n, "error": e} for n, e in failed]

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(out, fh, ensure_ascii=False, indent=1)

    t = out["totals"]
    print(
        f"Tankers: {t['bookings']:,} bookings / {t['delivered']:,} delivered "
        f"({t['fulfilment_pct']}%) across {t['months']} months, {t['sections']} sections",
        file=sys.stderr,
    )
    print(f"   range: {monthly[0]['label']} .. {monthly[-1]['label']}", file=sys.stderr)
    print("   top sections by demand:", file=sys.stderr)
    for s in sections[:8]:
        print(
            f"      {s['section'][:30]:<32}{s['bookings']:>9,}  (div {s['division']})",
            file=sys.stderr,
        )
    peak = max(seasonality, key=lambda x: x["mean_bookings"])
    trough = min(seasonality, key=lambda x: x["mean_bookings"])
    print(
        f"   seasonality: peak {peak['label']} {peak['mean_bookings']:,}/mo vs "
        f"trough {trough['label']} {trough['mean_bookings']:,}/mo "
        f"({peak['mean_bookings'] / trough['mean_bookings']:.1f}x)",
        file=sys.stderr,
    )
    if empty:
        print(f"   !! empty upstream month(s): {', '.join(empty)}", file=sys.stderr)
    if failed:
        print(f"   !! {len(failed)} resource(s) failed to download", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

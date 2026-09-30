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

WHAT THE PAGE IS BUILT ON
-------------------------
  1. VOLUME. Bookings have risen every year since 2022.
  2. SEASONALITY. Bookings swing several-fold within a year, from the
     Sep-Nov post-monsoon trough to the Mar-Jun summer peak.
  3. GEOGRAPHY. The top sections are Kondapur, Madhapur, Manikonda, KPHB,
     Nizampet - the western IT corridor and the new growth belt - plus Banjara
     Hills and Jubilee Hills. Not the old city.
  4. DELIVERED SHARE. Near 100% for four years, lower from Jun 2026 (below).

Source
------
Telangana Open Data Portal dataset 7f408a3a-7cdb-4d33-bfa3-1869f88c0e25,
"HMWSSB water tankers data" - HMWSSB's own monthly CSVs, one per month from
Jan 2022, added to each month. The file list is read from the portal's
metastore, not built from a URL pattern (the files sit under two paths).
Schema: year,month,division,section,noofbookings,delivered

The same 25 months OpenCity mirrored (Jan 2022 - Feb 2024) are identical here
month for month; this is the publisher's copy and it keeps going.

`section` is HMWSSB's own sub-ward operational unit (zone > circle > division >
section), NOT a GHMC ward. There is no published section-boundary geometry, so
this ships as a ranked table keyed on section name, not a choropleth.

TWO THINGS THE LONGER SERIES CHANGED
  - HMWSSB re-cut its divisions and sections in Feb 2026 (the GHMC
    trifurcation). No section name survives from Jan to Feb 2026, and from
    March the list carries "(OLD)" and "(NEW)" rows beside plain names. Section
    and division rankings are therefore computed PER ERA and never summed
    across the break. Names are kept as published.
  - The delivered share is no longer flat. It stayed above 98% in every month
    to May 2026, then read 92.1%, 89.2% and 92.4% for Jun-Aug 2026. The portal
    does not say whether those bookings were cancelled, pending or delivered
    later, so the artifact carries the counts and asserts no cause.

**Dec 2022 is missing**: the file exists but is 11 bytes, empty at source. The
month is reported as a gap rather than interpolated.

Run
---
    cd neer-vazhvu-api
    python3 scripts/build_hyderabad_tankers.py --out ../public/data/hyderabad-tankers.json
    # scheduled: rebuild only when the portal's `modified` date has moved
    python3 scripts/build_hyderabad_tankers.py --out ... --if-changed
"""

import argparse
import csv
import io
import json
import sys
import time
from pathlib import Path
import urllib.request
from collections import defaultdict
from datetime import date

# The registry owns every registered source's licence string; a second copy in
# a generator is how the registry and the corpus drifted apart (PR #227).
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from registry_license import registry_license  # noqa: E402
from nvdm_write import write_artifact  # noqa: E402


SOURCE_ID = "tg-opendata-hmwssb-tankers"
ITEM = "https://data.telangana.gov.in/api/1/metastore/schemas/dataset/items/7f408a3a-7cdb-4d33-bfa3-1869f88c0e25"
DATASET_URL = "https://data.telangana.gov.in/dataset/hyderabad-metropolitan-water-supply-and-sewerage-board-hmwssb-water-tankers-data"
RECUT = "2026-02"  # first month of HMWSSB's re-cut division/section scheme

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


def _get(url: str, timeout: int = 90, tries: int = 3) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "neervazhvu-hyd-tankers"})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except Exception:  # noqa: BLE001 - retried, then raised
            if attempt == tries - 1:
                raise
            time.sleep(5 * (attempt + 1))


def resources() -> tuple[str, list]:
    """The portal's `modified` date and its (title, url) CSV list."""
    item = json.loads(_get(ITEM))
    dists = [d.get("data", d) for d in item.get("distribution", [])]
    return item["modified"][:10], [
        (d.get("title") or "", d["downloadURL"]) for d in dists if d.get("downloadURL")
    ]


def rank_sections(rows: list) -> list:
    by = defaultdict(
        lambda: {"bookings": 0, "delivered": 0, "months": 0, "division": ""}
    )
    for r in rows:
        s = by[r["section"]]
        s["bookings"] += r["bookings"]
        s["delivered"] += r["delivered"]
        s["months"] += 1
        s["division"] = s["division"] or r["division"]
    return sorted(
        (
            {
                "section": name,
                "division": v["division"],
                "bookings": v["bookings"],
                "delivered": v["delivered"],
                "shortfall": v["bookings"] - v["delivered"],
                "months_reporting": v["months"],
            }
            for name, v in by.items()
        ),
        key=lambda x: -x["bookings"],
    )


def rank_divisions(rows: list) -> list:
    by = defaultdict(lambda: {"bookings": 0, "delivered": 0, "sections": set()})
    for r in rows:
        d = by[r["division"]]
        d["bookings"] += r["bookings"]
        d["delivered"] += r["delivered"]
        d["sections"].add(r["section"])
    return sorted(
        (
            {
                "division": k,
                "bookings": v["bookings"],
                "delivered": v["delivered"],
                "sections": len(v["sections"]),
            }
            for k, v in by.items()
        ),
        key=lambda x: -x["bookings"],
    )


def summarise(rows: list) -> dict:
    """Totals, monthly series, seasonality and per-era rankings from parsed rows."""
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

    # Seasonality: mean bookings per calendar month over COMPLETE years only.
    # Bookings grow every year, so a month present in more years than another
    # would read as busier for that reason alone.
    full = {
        y for y in {k[:4] for k in by_month} if sum(k[:4] == y for k in by_month) == 12
    }
    per_cal = defaultdict(list)
    for k, v in by_month.items():
        if k[:4] in full or not full:
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

    # Rankings per era: the Feb 2026 re-cut changed every section name.
    def era(era_id: str, keep) -> dict:
        part = [r for r in rows if keep(f"{r['year']:04d}-{r['month']:02d}")]
        months = [m for m in monthly if keep(m["month"])]
        return {
            "id": era_id,
            "from": months[0]["label"],
            "to": months[-1]["label"],
            "months": len(months),
            "bookings": sum(r["bookings"] for r in part),
            "delivered": sum(r["delivered"] for r in part),
            "sections": rank_sections(part),
            "divisions": rank_divisions(part),
        }

    eras = [era("pre_recut", lambda m: m < RECUT)]
    if monthly[-1]["month"] >= RECUT:
        eras.append(era("post_recut", lambda m: m >= RECUT))

    tot_b = sum(r["bookings"] for r in rows)
    tot_d = sum(r["delivered"] for r in rows)

    return {
        "totals": {
            "bookings": tot_b,
            "delivered": tot_d,
            "shortfall": tot_b - tot_d,
            "fulfilment_pct": round(tot_d / tot_b * 100, 1) if tot_b else None,
            "months": len(monthly),
        },
        "monthly": monthly,
        "seasonality": seasonality,
        "eras": eras,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="write JSON here")
    ap.add_argument(
        "--if-changed",
        action="store_true",
        help="do nothing when --out already carries the portal's current modified date",
    )
    args = ap.parse_args()

    modified, csvs = resources()
    if args.if_changed and args.out and Path(args.out).exists():
        if json.loads(Path(args.out).read_text()).get("_upstream_modified") == modified:
            print(f"Portal unchanged since {modified}; nothing to do", file=sys.stderr)
            return 0
    print(f"Portal lists {len(csvs)} CSVs, modified {modified}", file=sys.stderr)

    # A CSV that will not download raises: a missing month would otherwise read
    # as a month with no tankers.
    rows = []
    empty = []
    for name, url in csvs:
        raw = _get(url).decode("utf8", "ignore")
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

    body = summarise(rows)
    monthly, seasonality, eras = body["monthly"], body["seasonality"], body["eras"]
    out_path = Path(args.out) if args.out else None
    if out_path and out_path.exists():
        had = json.loads(out_path.read_text()).get("totals", {}).get("months", 0)
        if len(monthly) < had:
            # This runs unattended and commits: a shorter series is never an update.
            print(
                f"Portal has {len(monthly)} months, artifact has {had}; refusing",
                file=sys.stderr,
            )
            return 1

    out = {
        "_source": "HMWSSB tanker bookings and deliveries",
        "_source_url": DATASET_URL,
        "_licence": registry_license(SOURCE_ID),
        "_fetched": date.today().isoformat(),
        "_upstream_modified": modified,
        "_note": (
            "Monthly tanker bookings AND deliveries per HMWSSB division and section, from "
            "HMWSSB's own files on the Telangana Open Data Portal. 'section' is HMWSSB's "
            "operational unit, NOT a GHMC ward, and no public section-boundary geometry "
            "exists - so this renders as ranked tables, not a map. HMWSSB re-cut its "
            "divisions and sections in Feb 2026; rankings are given per era and section "
            "names are kept as published."
        ),
        "_coverage": (
            f"Series runs {monthly[0]['label']} to {monthly[-1]['label']}, as the portal "
            f"stood on {modified}. It adds a month at a time."
        ),
        **body,
    }
    if empty:
        out["_empty_upstream_months"] = empty

    if out_path:
        write_artifact(out_path, out, indent=1)

    t = out["totals"]
    print(
        f"Tankers: {t['bookings']:,} bookings / {t['delivered']:,} delivered "
        f"({t['fulfilment_pct']}%) across {t['months']} months",
        file=sys.stderr,
    )
    print(f"   range: {monthly[0]['label']} .. {monthly[-1]['label']}", file=sys.stderr)
    for e in eras:
        print(
            f"   {e['id']} {e['from']} .. {e['to']}: {e['bookings']:,} bookings, "
            f"{len(e['sections'])} sections, top {[x['section'] for x in e['sections'][:3]]}",
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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

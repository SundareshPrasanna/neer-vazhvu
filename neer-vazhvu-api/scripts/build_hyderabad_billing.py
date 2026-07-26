#!/usr/bin/env python3
"""
HMWSSB billing and collection, 2022-2026 -> public/data/hyderabad-billing.json

Source: data.telangana.gov.in dataset 3485ce9d-4a9c-4293-b7e9-02e6697b9a75,
"Hyderabad Metropolitan Water Supply and Sewerage Board (HMWSSB) billing and
collection data 2022-2026", licensed Government Open Data License - India
(GODL-India). 54 monthly CSVs, Jan 2022 to Jun 2026.

Why this matters: the supply-overview surface was previously written off as
needing an HMWSSB RTI under section 4(1)(b). It does not - the utility already
publishes billing and collection openly, and this is the closest public proxy
we have to demand, connection count and revenue realisation.

The join that makes it valuable: the CSVs key on `division` and `section`, the
SAME operational units as the tanker ledger (build_hyderabad_tankers.py). So
tanker demand and billed demand can be compared per section, which no other
city on the platform can do.

Schema: year,month,division,section,collection,demand,noofcans,category

CAUTION, and the reason for the guards below:
  - `collection` and `demand` are rupee amounts whose unit is NOT stated in the
    dataset description. We therefore publish them as-published and never
    convert or label them as crore/lakh.
  - Rows with demand == 0 and collection == 0 are common (inactive sections).
    They are counted but excluded from efficiency ratios, which would otherwise
    be 0/0.
  - `category` is a tariff class code (C, D, M2, ...) with no published legend,
    so categories are carried through verbatim and never renamed to guesses
    like "domestic"/"commercial".
"""
from __future__ import annotations

import csv
import io
import json
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

BASE = "https://data.telangana.gov.in/sites/default/files/uploaded_resources"
DATASET_URL = "https://data.telangana.gov.in/dataset/hyderabad-metropolitan-water-supply-and-sewerage-board-hmwssb-billing-and-collection-data"
OUT = Path(__file__).resolve().parents[2] / "public" / "data" / "hyderabad-billing.json"

# (year, month) -> filename. The portal is not perfectly consistent; the 2022_1
# file carries a _1 suffix pattern that happens to match month numbering.
def url_for(year: int, month: int) -> str:
    return f"{BASE}/billing_and_collection_report_{year}_{month}.csv"


def fetch(url: str, tries: int = 3) -> str | None:
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NeerVazhvu/1.0 (contact@neervazhvu.org)"})
            with urllib.request.urlopen(req, timeout=90) as r:
                if r.status != 200:
                    return None
                return r.read().decode("utf-8", "replace")
        except Exception:
            if attempt == tries - 1:
                return None
            time.sleep(2 * (attempt + 1))
    return None


def main() -> int:
    months: list[dict] = []
    # TWO GUARDS, both learned from the data rather than assumed.
    #
    # 1. `noofcans` is a STOCK, not a flow. Summing it across months would report
    #    a division of 90k connections as having 4.9m - more than the whole city.
    #
    # 2. HMWSSB RE-CUT its division/section scheme between Jan and Feb 2026,
    #    around the 11 Feb 2026 GHMC trifurcation: sections went 209 -> 485 and
    #    24 new divisions (71-82 and others) appeared, while the old divisions
    #    1-26 survive as near-empty shells (division 6 went from 100,879
    #    connections in Jan-2026 to 8 in Jun-2026). Aggregating demand across
    #    that boundary would silently mix two different geographies, so every
    #    division/section aggregate below is computed PER ERA.
    #
    # The old-scheme era is also the one that joins to the tanker ledger, whose
    # series ends Feb 2024.
    ERA_BREAK = "2026-02"
    def era_of(key: str) -> str:
        return "pre_recut" if key < ERA_BREAK else "post_recut"

    by_division: dict[tuple[str, str], dict] = defaultdict(lambda: {"demand": 0.0, "collection": 0.0, "cans_latest": 0, "sections": set()})
    by_section: dict[tuple[str, str, str], dict] = defaultdict(lambda: {"demand": 0.0, "collection": 0.0, "cans_latest": 0})
    by_category: dict[str, dict] = defaultdict(lambda: {"demand": 0.0, "collection": 0.0, "cans_latest": 0})
    era_last = {"pre_recut": "2026-01", "post_recut": "2026-06"}
    missing: list[str] = []
    total_rows = 0

    for year in range(2022, 2027):
        for month in range(1, 13):
            if year == 2026 and month > 6:
                break
            raw = fetch(url_for(year, month))
            if raw is None:
                missing.append(f"{year}-{month:02d}")
                continue
            latest_key = f"{year}-{month:02d}"
            rdr = csv.DictReader(io.StringIO(raw))
            m_demand = m_collection = 0.0
            m_cans = 0
            m_sections: set[str] = set()
            rows = 0
            mkey = f"{year}-{month:02d}"
            era = era_of(mkey)
            is_era_last = (mkey == era_last[era])
            for row in rdr:
                try:
                    demand = float(row.get("demand") or 0)
                    collection = float(row.get("collection") or 0)
                    cans = int(float(row.get("noofcans") or 0))
                except ValueError:
                    continue
                div = (row.get("division") or "").strip()
                sec = (row.get("section") or "").strip()
                cat = (row.get("category") or "").strip()
                rows += 1
                m_demand += demand
                m_collection += collection
                m_cans += cans
                if sec:
                    m_sections.add(sec)
                d = by_division[(era, div)]
                d["demand"] += demand; d["collection"] += collection
                if sec:
                    d["sections"].add(sec)
                s = by_section[(era, div, sec)]
                s["demand"] += demand; s["collection"] += collection
                c = by_category[cat]
                c["demand"] += demand; c["collection"] += collection
                if is_era_last:
                    d["cans_latest"] += cans
                    s["cans_latest"] += cans
                    c["cans_latest"] += cans

            total_rows += rows
            months.append({
                "month": f"{year}-{month:02d}",
                "label": f"{['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month]} {year}",
                "demand": round(m_demand, 2),
                "collection": round(m_collection, 2),
                # Efficiency is only meaningful where demand was raised.
                "collection_pct": round(m_collection / m_demand * 100, 2) if m_demand > 0 else None,
                "connections": m_cans,
                "sections_reporting": len(m_sections),
                "rows": rows,
            })
            print(f"  {year}-{month:02d}  rows={rows:<6} demand={m_demand:>16,.0f} collection={m_collection:>16,.0f}", file=sys.stderr)

    if not months:
        print("FATAL: no monthly files fetched", file=sys.stderr)
        return 1

    billed = [m for m in months if m["collection_pct"] is not None]
    tot_d = sum(m["demand"] for m in months)
    tot_c = sum(m["collection"] for m in months)

    payload = {
        "_source": "HMWSSB billing and collection data 2022-2026",
        "_source_url": DATASET_URL,
        "_licence": "Government Open Data License - India (GODL-India). Attribute HMWSSB and data.telangana.gov.in.",
        "_fetched": time.strftime("%Y-%m-%d"),
        "_note": (
            "Monthly billing demand, collection, connection count and tariff category per HMWSSB "
            "division and section. Keys on the SAME division/section units as the tanker ledger, so "
            "billed demand and tanker demand are comparable per section. Rupee amounts are published "
            "as-is: the dataset does not state whether figures are rupees, thousands or lakhs, so no "
            "unit is asserted here and no conversion is applied."
        ),
        "_caveats": [
            "Tariff `category` codes (C, D, M2, ...) have no published legend; carried verbatim, never renamed.",
            "Months where total demand is 0 yield collection_pct null rather than 0, to avoid a 0/0 ratio.",
            "Collection in a month can exceed demand in that month because arrears are collected late; "
            "collection_pct above 100% is therefore expected and is not an error.",
            "`connections_at_era_end` is a point-in-time count, never a sum - connections are a stock.",
            "HMWSSB RE-CUT its division/section scheme between Jan and Feb 2026, around the 11 Feb 2026 GHMC "
            "trifurcation: sections went 209 to 485, 24 new divisions appeared, and the old divisions survive "
            "as near-empty shells (division 6: 100,879 connections in Jan-2026, 8 in Jun-2026). Division and "
            "section aggregates are therefore split into pre_recut (2022-01 to 2026-01) and post_recut "
            "(2026-02 onward) eras and MUST NOT be summed across the two. Only the pre_recut era joins to "
            "the tanker ledger, whose series ends Feb 2024.",
        ],
        "totals": {
            "months": len(months),
            "rows": total_rows,
            "demand": round(tot_d, 2),
            "collection": round(tot_c, 2),
            "collection_pct": round(tot_c / tot_d * 100, 2) if tot_d > 0 else None,
            "divisions": len(by_division),
            "sections": len(by_section),
        },
        "monthly": months,
        "divisions": sorted(
            [{"era": k[0], "division": k[1], "demand": round(v["demand"], 2), "collection": round(v["collection"], 2),
              "collection_pct": round(v["collection"] / v["demand"] * 100, 2) if v["demand"] > 0 else None,
              "connections_at_era_end": v["cans_latest"], "sections": len(v["sections"])}
             for k, v in by_division.items()],
            key=lambda x: (x["era"], -x["demand"]),
        ),
        "sections": sorted(
            [{"era": k[0], "division": k[1], "section": k[2], "demand": round(v["demand"], 2),
              "collection": round(v["collection"], 2),
              "collection_pct": round(v["collection"] / v["demand"] * 100, 2) if v["demand"] > 0 else None,
              "connections_at_era_end": v["cans_latest"]}
             for k, v in by_section.items() if k[2]],
            key=lambda x: (x["era"], -x["demand"]),
        ),
        "categories": sorted(
            [{"category": k or "(blank)", "demand": round(v["demand"], 2),
              "collection": round(v["collection"], 2), "connections_at_era_end": v["cans_latest"]}
             for k, v in by_category.items()],
            key=lambda x: -x["demand"],
        ),
    }
    if missing:
        payload["_missing_months"] = missing

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\nWrote {OUT} ({OUT.stat().st_size // 1024} KB)")
    print(f"  {len(months)} months, {total_rows:,} rows, {len(by_division)} divisions, {len(by_section)} sections")
    if missing:
        print(f"  MISSING months: {', '.join(missing)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

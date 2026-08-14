#!/usr/bin/env python3
"""
Aggregate OpenCity Bangalore tanker-water survey CSVs (2015, 2019, 2024)
into a single longitudinal summary JSON.

Source datasets (license: CC BY-NC-SA 4.0 via OpenCity resource pages):
  https://data.opencity.in/dataset/bengaluru-tanker-water-data

Each survey year used a slightly different schema. This script:
  - Reads each CSV
  - Pulls comparable fields (tanker price, capacity, monthly spend, dry
    days, BWSSB-as-source frequency, STP-reuse adoption)
  - Computes per-year stats (median, count, percent)
  - Emits public/data/bangalore-tanker-survey.json

Output is designed for the home page tanker callout + the eventual
/bangalore/tanker page. Keeps raw row counts (n=N) on every stat so
journalists can judge sample sizes.

Run: python scripts/build-bangalore-tanker-summary.py
"""

import csv
import sys
import re
import statistics
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from registry_license import registry_license  # noqa: E402

from nvdm_write import write_artifact

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_RAW = REPO_ROOT / "scripts" / "data-raw" / "bangalore"
OUT = REPO_ROOT / "public" / "data" / "bangalore-tanker-survey.json"

YEARS = [
    {
        "year": 2015,
        "file": "tanker-water-data-2015.csv",
        "col_price": "Average tanker price",
        "col_capacity": "Tanker capacity (in litres)",
        "col_units": "No of housing units",
        "col_source": "Source of water",
        "col_monthly_expense": None,
        "col_dry_days": None,
        "col_stp_reuse": None,
        "col_pincode": None,
        "col_prorated_6000": "Prorated amount for 6000 litre tanker",
    },
    {
        "year": 2019,
        "file": "tanker-water-data-2019.csv",
        "col_price": "Average tanker price",
        "col_capacity": "Tanker capacity (in litres)",
        "col_units": "No of units",
        "col_source": "Source of water (Select multiple if required)",
        "col_monthly_expense": "Monthly expense on water",
        "col_dry_days": "How many dry days  recently?",
        "col_stp_reuse": "Do you use treated STP water for flushing/gardening?",
        "col_pincode": None,
        "col_prorated_6000": None,
    },
    {
        "year": 2024,
        "file": "tanker-water-data-2024.csv",
        "col_price": "How much do you pay for a single tanker of water?",
        "col_capacity": "What is the capacity of the tanker in litres?",
        "col_units": "Number of units in the community",
        "col_source": "Sources of water supply for your community",
        "col_monthly_expense": "What is your community's monthly expense on water?",
        "col_dry_days": "Number of dry days in the past year?",
        "col_stp_reuse": "Do you use treated STP water for flushing/gardening? ",
        "col_pincode": "Your area Pincode",
        "col_prorated_6000": None,
        "col_year_ago_price": "How much were you paying for the same tanker of water a year back (Feb 2023)?",
        "col_supply_change": "Has the supply of water from BWSSB changed during the last one year (both in terms of frequency as well as quantity)? ",
        "col_more_often": "Have you been ordering private water tankers more often in the last three months? ",
    },
]


def to_float(value):
    if value is None:
        return None
    s = str(value).strip().replace(",", "").replace('"', "")
    if not s or s.lower() in ("na", "n/a", "-", "no", "yes"):
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    if not m:
        return None
    try:
        return float(m.group(0))
    except ValueError:
        return None


def median_safe(values):
    clean = [v for v in values if v is not None and v > 0]
    if not clean:
        return None
    return round(statistics.median(clean), 2)


def percent(numerator, denominator):
    if denominator == 0:
        return None
    return round(100 * numerator / denominator, 1)


def normalize_pincode(p):
    if not p:
        return None
    s = re.sub(r"[^0-9]", "", str(p))
    return s if len(s) == 6 and s.startswith("5600") else None


def process_year(spec):
    path = DATA_RAW / spec["file"]
    with path.open(encoding="utf-8", errors="replace") as f:
        rows = list(csv.DictReader(f))

    prices = []
    capacities = []
    prorated_6000 = []
    monthly_expenses = []
    dry_days_vals = []
    stp_reuse_yes = 0
    stp_reuse_total = 0
    bwssb_count = 0
    private_tanker_count = 0
    borewell_count = 0
    pincodes = set()

    # 2024-only
    year_ago_prices = []
    more_often_yes = 0
    more_often_total = 0
    supply_no_change = 0
    supply_total = 0

    for row in rows:
        price = to_float(row.get(spec["col_price"]))
        cap = to_float(row.get(spec["col_capacity"]))
        if price and price > 50:
            prices.append(price)
        if cap and cap > 500:
            capacities.append(cap)
        if price and cap and 500 <= cap <= 30000 and price > 50:
            prorated_6000.append(price * 6000 / cap)

        prorated_col = spec.get("col_prorated_6000")
        if prorated_col:
            p = to_float(row.get(prorated_col))
            if p:
                prorated_6000.append(p)

        m_exp = to_float(row.get(spec.get("col_monthly_expense") or ""))
        if m_exp and m_exp > 100:
            monthly_expenses.append(m_exp)

        dry = to_float(row.get(spec.get("col_dry_days") or ""))
        if dry is not None and 0 <= dry <= 365:
            dry_days_vals.append(dry)

        stp = (row.get(spec.get("col_stp_reuse") or "") or "").strip().lower()
        if stp:
            stp_reuse_total += 1
            if stp == "yes":
                stp_reuse_yes += 1

        source = (row.get(spec.get("col_source") or "") or "").lower()
        if source:
            if "bwssb" in source or "municipal" in source or "cauvery" in source:
                bwssb_count += 1
            if "tanker" in source or "private" in source:
                private_tanker_count += 1
            if "borewell" in source or "groundwater" in source:
                borewell_count += 1

        if spec.get("col_pincode"):
            p = normalize_pincode(row.get(spec["col_pincode"]))
            if p:
                pincodes.add(p)

        if spec["year"] == 2024:
            year_ago = to_float(row.get(spec.get("col_year_ago_price") or ""))
            if year_ago and year_ago > 50:
                year_ago_prices.append(year_ago)
            more = (row.get(spec.get("col_more_often") or "") or "").lower()
            if more and "more often" in more:
                more_often_yes += 1
                more_often_total += 1
            elif more:
                more_often_total += 1
            sup = (row.get(spec.get("col_supply_change") or "") or "").lower()
            if sup:
                supply_total += 1
                if "no change" in sup or "no" == sup:
                    supply_no_change += 1

    summary = {
        "year": spec["year"],
        "respondents_n": len(rows),
        "tanker_price_inr_per_load_median": median_safe(prices),
        "tanker_capacity_litres_median": median_safe(capacities),
        "tanker_price_inr_per_6000l_median": median_safe(prorated_6000),
        "tanker_price_n": len([p for p in prices if p > 0]),
        "monthly_water_expense_inr_median": median_safe(monthly_expenses),
        "monthly_water_expense_n": len(monthly_expenses),
        "dry_days_median": median_safe(dry_days_vals),
        "dry_days_n": len(dry_days_vals),
        "stp_reuse_pct": percent(stp_reuse_yes, stp_reuse_total) if stp_reuse_total else None,
        "stp_reuse_n": stp_reuse_total,
        "bwssb_source_pct": percent(bwssb_count, len(rows)),
        "private_tanker_source_pct": percent(private_tanker_count, len(rows)),
        "borewell_source_pct": percent(borewell_count, len(rows)),
        "unique_pincodes": len(pincodes) if pincodes else None,
    }

    if spec["year"] == 2024:
        deltas = []
        if year_ago_prices and prices:
            # Pair year-ago to current row-by-row (same respondent)
            with path.open(encoding="utf-8", errors="replace") as f:
                rows2 = list(csv.DictReader(f))
            for r in rows2:
                cur = to_float(r.get(spec["col_price"]))
                prv = to_float(r.get(spec.get("col_year_ago_price") or ""))
                if cur and prv and cur > 50 and prv > 50:
                    deltas.append(cur - prv)
            summary["tanker_price_yoy_delta_inr_median"] = median_safe(deltas)
            summary["tanker_price_yoy_delta_n"] = len(deltas)
            summary["tanker_price_yoy_year_ago_inr_median"] = median_safe(year_ago_prices)
        summary["more_often_pct"] = percent(more_often_yes, more_often_total) if more_often_total else None
        summary["more_often_n"] = more_often_total
        summary["bwssb_no_change_pct"] = percent(supply_no_change, supply_total) if supply_total else None
        summary["bwssb_no_change_n"] = supply_total

    return summary


def main():
    yearly = [process_year(spec) for spec in YEARS]

    output = {
        "_note": "Longitudinal summary of OpenCity Bengaluru Tanker Water surveys (2015, 2019, 2024). Schemas differ by year so not every field exists for every year; n= counts surface sample sizes per stat. License CC BY-NC-SA 4.0 (non-commercial, share-alike). Surveys are apartment/community-level; rates reflect informal market not BWSSB Kaveriwheels official tariffs.",
        "_source": {
            "name": "OpenCity Bengaluru Tanker Water Data",
            "url": "https://data.opencity.in/dataset/bengaluru-tanker-water-data",
            "license": registry_license("opencity-bengaluru-tanker-survey"),
            "extracted": "2026-05-24",
        },
        "_2025_context": {
            "summary": "OpenCity's 2025 follow-up article reports tanker dependence improved YoY: 50%+ of surveyed apartments reported a better water situation, 13.4% reported worse. Drivers: Cauvery Stage V commissioning Oct 2024 + post-El-Nino monsoon recovery + improved groundwater levels. Tanker dependence persists most in Southwest and Southeast wards.",
            "source_url": "https://opencity.in/bengaluru-water-tankers-survey-2025-situation-better-than-2024/",
        },
        "by_year": yearly,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Envelope-preserving write (scripts/nvdm_write.py).
    write_artifact(OUT, output)
    print(f"Wrote {OUT}")
    for y in yearly:
        print(
            f"  {y['year']}: n={y['respondents_n']}  "
            f"price/load_median=Rs{y['tanker_price_inr_per_load_median']}  "
            f"price/6000L=Rs{y['tanker_price_inr_per_6000l_median']}  "
            f"monthly=Rs{y['monthly_water_expense_inr_median']}"
        )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
TGPCB sewage treatment plant monitoring -> public/data/hyderabad-stps.json

Source: data.telangana.gov.in, "Telangana Pollution Control Board - (STP)
Sewage treatment plant Data", GODL-India. 83 monthly CSVs, Jan 2018 - Nov 2024.

WHY THIS EXISTS, AND WHAT IT CORRECTS
The facts page previously carried a claim that Hyderabad's sewage treatment
capacity "is not published". That was WRONG. TGPCB publishes, per plant and per
month: plant name, CAPACITY IN MLD, and monitored effluent quality (pH, BOD,
COD, TSS, TDS, DO, coliform, TKN, ammonia, oil & grease). The claim was made
from the absence of a headline commissioned-vs-under-construction split in the
AMRUT programme reporting, and generalised too far.

What is still genuinely unpublished is the AMRUT 39-STP programme's split
between commissioned and under-construction plants. That narrower gap stands;
the broad claim did not.

Schema: STP name, STP Capacity, pH, EC, TSS, TDS, DO, COD, BOD, T.Coli,
        F.Coli, TKN, Ammonical Nitrogen, Oil & Grease

CAUTION
  - Capacity is a free-text string: "339 MLD", "13MLD", "0.5 MLD". Parsed with
    a tolerant regex; anything unparseable is kept as raw text and excluded
    from totals rather than guessed at.
  - The same lake name can carry SEVERAL distinct plants (Miralam Tank appears
    with 10, 5 and 41.5 MLD). Plants are keyed on the full name string, never
    collapsed by lake.
  - This is a STATE file: it covers Nizamabad, Karimnagar, Siddipet and
    Vikarabad plants too. Hyderabad-area plants are flagged, not filtered out,
    so the denominator stays honest.
"""
from __future__ import annotations

import csv
import io
import json
import re
import statistics
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "data" / "hyderabad-stps.json"
BASE = "https://data.telangana.gov.in/sites/default/files/uploaded_resources"
DATASET = "https://data.telangana.gov.in/dataset/telangana-pollution-control-board-stp-sewage-treatment-plant-data"

CAP = re.compile(r"([\d.]+)\s*MLD", re.I)
# Plants outside the Hyderabad metropolitan area, by the town named in the row.
NON_HYD = re.compile(r"karimnagar|nizambad|nizamabad|siddipet|vikarabad|warangal|khammam|ramagundam", re.I)


def fetch(url: str) -> str | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NeerVazhvu/1.0 (contact@neervazhvu.org)"})
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.read().decode("utf-8", "replace") if r.status == 200 else None
    except Exception:
        return None


def num(v):
    if v is None:
        return None
    v = str(v).strip().replace(",", "")
    if not v or v.upper() in ("BDL", "NA", "-", "NIL"):
        return None
    m = re.match(r"^<?\s*([\d.]+)$", v)
    try:
        return float(m.group(1)) if m else None
    except ValueError:
        return None


def main() -> int:
    plants: dict[str, dict] = defaultdict(lambda: {"capacity_mld": None, "capacity_raw": None,
                                                   "readings": [], "in_hyderabad_area": True})
    months_seen: list[str] = []
    missing: list[str] = []

    for year in range(2018, 2025):
        for month in range(1, 13):
            if year == 2024 and month > 11:
                break
            raw = fetch(f"{BASE}/STP_Data_{month:02d}_{year}.csv")
            if raw is None:
                missing.append(f"{year}-{month:02d}")
                continue
            months_seen.append(f"{year}-{month:02d}")
            for row in csv.DictReader(io.StringIO(raw)):
                name = (row.get("STP name") or "").strip()
                if not name:
                    continue
                p = plants[name]
                capraw = (row.get("STP Capacity") or "").strip()
                if capraw and p["capacity_raw"] is None:
                    p["capacity_raw"] = capraw
                    m = CAP.search(capraw)
                    if m:
                        try:
                            p["capacity_mld"] = float(m.group(1))
                        except ValueError:
                            pass
                p["in_hyderabad_area"] = not bool(NON_HYD.search(name))
                p["readings"].append({
                    "month": f"{year}-{month:02d}",
                    "bod_mgl": num(row.get("BOD")),
                    "cod_mgl": num(row.get("COD")),
                    "do_mgl": num(row.get("DO")),
                    "ph": num(row.get("pH")),
                    "tss_mgl": num(row.get("TSS")),
                    "ammonical_n_mgl": num(row.get("Ammonical Nitrogen")),
                })
            print(f"  {year}-{month:02d}: {len(plants)} plants cumulative", file=sys.stderr)

    if not plants:
        print("FATAL: no STP rows", file=sys.stderr)
        return 1

    out_plants = []
    for name, p in plants.items():
        bods = [r["bod_mgl"] for r in p["readings"] if r["bod_mgl"] is not None]
        out_plants.append({
            "name": name,
            "capacity_mld": p["capacity_mld"],
            "capacity_raw": p["capacity_raw"],
            "in_hyderabad_area": p["in_hyderabad_area"],
            "months_monitored": len(p["readings"]),
            "bod_median_mgl": round(statistics.median(bods), 2) if bods else None,
            "bod_max_mgl": max(bods) if bods else None,
            # CPCB/MoEF discharge norm for STPs is BOD <= 10 mg/L.
            "months_bod_over_10": sum(1 for b in bods if b > 10),
            "readings": sorted(p["readings"], key=lambda r: r["month"]),
        })
    out_plants.sort(key=lambda x: -(x["capacity_mld"] or 0))

    hyd = [p for p in out_plants if p["in_hyderabad_area"]]
    cap_known = [p for p in hyd if p["capacity_mld"] is not None]
    total_cap = round(sum(p["capacity_mld"] for p in cap_known), 2)
    over = [p for p in hyd if p["months_bod_over_10"] > 0]

    payload = {
        "_source": "Telangana Pollution Control Board - Sewage Treatment Plant monitoring data",
        "_source_url": DATASET,
        "_licence": "Government Open Data License - India (GODL-India). Attribute TGPCB and data.telangana.gov.in.",
        "_fetched": time.strftime("%Y-%m-%d"),
        "_note": (
            "Per-plant capacity in MLD and monitored effluent quality, monthly. This dataset CORRECTS an "
            "earlier claim on this site that Hyderabad's treatment capacity is not published - it is, per "
            "plant. What remains genuinely unpublished is the AMRUT 39-STP programme's commissioned-versus-"
            "under-construction split, which is a narrower gap than the one previously stated."
        ),
        "_caveats": [
            "Capacity is free text upstream (\"339 MLD\", \"13MLD\"); unparseable values are kept as "
            "capacity_raw and excluded from the total rather than guessed.",
            "One lake can host several distinct plants - Miralam Tank appears at 10, 5 and 41.5 MLD - so "
            "plants are keyed on the full name and never collapsed by lake.",
            "This is a STATE file. Plants named for Nizamabad, Karimnagar, Siddipet, Vikarabad and other "
            "towns are flagged in_hyderabad_area=false rather than dropped, so the denominator stays honest.",
            "BOD compliance counts use the CPCB/MoEF STP discharge norm of 10 mg/L.",
            "Series ends November 2024; no later edition is published.",
        ],
        "totals": {
            "months": len(months_seen),
            "plants_all_telangana": len(out_plants),
            "plants_hyderabad_area": len(hyd),
            "plants_with_parsed_capacity": len(cap_known),
            "hyderabad_capacity_mld": total_cap,
            "hyderabad_plants_ever_over_bod_norm": len(over),
            "period": f"{months_seen[0]} to {months_seen[-1]}" if months_seen else None,
        },
        "plants": out_plants,
    }
    if missing:
        payload["_missing_months"] = missing

    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\nWrote {OUT} ({OUT.stat().st_size // 1024} KB)")
    t = payload["totals"]
    print(f"  {t['months']} months, {t['plants_all_telangana']} plants "
          f"({t['plants_hyderabad_area']} Hyderabad-area)")
    print(f"  Hyderabad-area capacity: {t['hyderabad_capacity_mld']} MLD across "
          f"{t['plants_with_parsed_capacity']} plants")
    print(f"  ever exceeded BOD 10 mg/L: {t['hyderabad_plants_ever_over_bod_norm']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

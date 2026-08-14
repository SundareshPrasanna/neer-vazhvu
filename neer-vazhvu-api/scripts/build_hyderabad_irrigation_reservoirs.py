#!/usr/bin/env python3
"""
Telangana Irrigation & CAD daily reservoir levels -> public/data/hyderabad-irrigation-reservoirs.json

Source: data.telangana.gov.in, "Telangana Irrigation & CAD Department - Daily
Reservoir Storage Levels", GODL-India. 65 monthly CSVs, Jan 2021 - May 2026.

WHY THIS MATTERS: an INDEPENDENT SECOND SOURCE for reservoirs we currently take
solely from HMWSSB's daily statement. Five of our eight tracked sources appear
here - Singur, Nagarjuna Sagar, Srisailam, Sri Pada Yellampally and Akkampalli.
Osman Sagar, Himayat Sagar and Manjira do NOT, which is consistent: they are
HMWSSB drinking-water reservoirs rather than Irrigation & CAD projects.

Capacity cross-check performed 2026-07-26 against the figures we publish, which
came from HMWSSB. The two departments agree to within rounding:
    Nagarjuna Sagar   312.045 vs 312.045   exact
    Srisailam         215.807 vs 215.807   exact
    Yellampally        20.175 vs  20.175   exact
    Singur             29.910 vs  29.917   -0.007 TMC (0.02%)
    Akkampalli          1.500 vs   1.499   +0.001 TMC (rounding)
That is a genuine independent validation of numbers already on the dashboard.

Schema: date, reservior_name (sic), basin_name, frl, capacity,
        level_in_feet_present, gross_storage, inflow, outflow

UNIT WARNING, taken from the publisher's own abbreviation block: `frl` is in
METRES, `capacity` and `gross_storage` are in TMC, and inflow/outflow are in
cusecs. The column is named `level_in_feet_present` but the description says
metres - the name and the description contradict each other, so that column is
carried through verbatim under its published name and is NOT converted.
"""

from __future__ import annotations

import csv
import io
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

# The registry owns every registered source's licence string; a second copy in
# a generator is how the registry and the corpus drifted apart (PR #227).
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from registry_license import registry_license  # noqa: E402
from nvdm_write import write_artifact  # noqa: E402


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "data" / "hyderabad-irrigation-reservoirs.json"
BASE = "https://data.telangana.gov.in/sites/default/files/uploaded_resources"
DATASET = "https://data.telangana.gov.in/dataset/telangana-irrigation-cad-department-daily-reservoir-storage-levels"

# Irrigation-feed name -> our source_code in reservoir_daily_v2.
TRACKED = {
    "SINGUR": "singur",
    "NAGARJUNA SAGAR": "nagarjuna_sagar",
    "SRISAILAM": "srisailam",
    "SRI PADA YELLAMPALLY PROJECT": "yellampally",
    "AKKAMPALLI (AMRSLBC)": "akkampally",
}
# What we publish, from HMWSSB. Used for the capacity cross-check only.
OUR_CAPACITY_TMC = {
    "singur": 29.917,
    "nagarjuna_sagar": 312.045,
    "srisailam": 215.807,
    "yellampally": 20.175,
    "akkampally": 1.499,
}


def fetch(url: str) -> str | None:
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "NeerVazhvu/1.0 (contact@neervazhvu.org)"}
        )
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read().decode("utf-8", "replace") if r.status == 200 else None
    except Exception:
        return None


def f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main() -> int:
    series: dict[str, list] = defaultdict(list)
    caps: dict[str, set] = defaultdict(set)
    basins: dict[str, str] = {}
    months = 0
    missing: list[str] = []

    for year in range(2021, 2027):
        for month in range(1, 13):
            if year == 2026 and month > 5:
                break
            raw = fetch(f"{BASE}/reservoir_details_{year}-{month:02d}.csv")
            if raw is None:
                missing.append(f"{year}-{month:02d}")
                continue
            months += 1
            for row in csv.DictReader(io.StringIO(raw)):
                name = (row.get("reservior_name") or "").strip()
                code = TRACKED.get(name)
                if not code:
                    continue
                cap = f(row.get("capacity"))
                if cap:
                    caps[code].add(round(cap, 3))
                basins.setdefault(code, (row.get("basin_name") or "").strip())
                series[code].append(
                    {
                        "date": (row.get("date") or "").strip(),
                        "gross_storage_tmc": f(row.get("gross_storage")),
                        "inflow_cusecs": f(row.get("inflow")),
                        "outflow_cusecs": f(row.get("outflow")),
                        "level_in_feet_present": f(row.get("level_in_feet_present")),
                    }
                )
            print(f"  {year}-{month:02d} ok", file=sys.stderr)

    if not series:
        print("FATAL: no rows for tracked reservoirs", file=sys.stderr)
        return 1

    reservoirs = []
    for code, rows in series.items():
        rows.sort(key=lambda r: r["date"])
        cap_list = sorted(caps[code])
        pub = OUR_CAPACITY_TMC.get(code)
        cap = cap_list[-1] if cap_list else None
        reservoirs.append(
            {
                "source_code": code,
                "irrigation_feed_name": next(
                    k for k, v in TRACKED.items() if v == code
                ),
                "basin": basins.get(code),
                "capacity_tmc_irrigation": cap,
                "capacity_tmc_hmwssb_as_published_by_us": pub,
                "capacity_delta_tmc": round(cap - pub, 4) if (cap and pub) else None,
                "days": len(rows),
                "first_date": rows[0]["date"],
                "last_date": rows[-1]["date"],
                "daily": rows,
            }
        )
    reservoirs.sort(key=lambda r: -(r["capacity_tmc_irrigation"] or 0))

    payload = {
        "_source": "Telangana Irrigation & CAD Department - Daily Reservoir Storage Levels",
        "_source_url": DATASET,
        "_licence": registry_license("tg-opendata-irrigation-reservoirs"),
        "_fetched": time.strftime("%Y-%m-%d"),
        "_note": (
            "An INDEPENDENT second source for five of the eight reservoirs Hyderabad's dashboard tracks. "
            "Osman Sagar, Himayat Sagar and Manjira are absent by design - they are HMWSSB drinking-water "
            "reservoirs, not Irrigation & CAD projects - so this cross-checks the transferred Krishna and "
            "Godavari sources, not the local twins."
        ),
        "_cross_check": (
            "Capacities agree with the HMWSSB-derived figures already on our dashboard to within rounding: "
            "Nagarjuna Sagar, Srisailam and Yellampally match exactly; Singur differs by 0.007 TMC (0.02%) "
            "and Akkampalli by 0.001 TMC. Two departments, independently published, same numbers."
        ),
        "_unit_warning": (
            "The publisher's abbreviation block states frl is in METRES and capacity/gross_storage in TMC, "
            "while the storage column is NAMED `level_in_feet_present`. The name and the description "
            "contradict each other, so that column is carried through verbatim under its published name and "
            "is never converted or relabelled."
        ),
        "totals": {
            "months": months,
            "reservoirs_tracked": len(reservoirs),
            "reservoirs_in_feed_not_tracked": None,
            "period": f"{min(r['first_date'] for r in reservoirs)} to {max(r['last_date'] for r in reservoirs)}",
        },
        "reservoirs": reservoirs,
    }
    if missing:
        payload["_missing_months"] = missing

    write_artifact(OUT, payload)
    print(f"\nWrote {OUT} ({OUT.stat().st_size // 1024} KB)")
    for r in reservoirs:
        print(
            f"  {r['source_code']:<17} {r['days']:>5} days  cap {r['capacity_tmc_irrigation']} TMC "
            f"(delta {r['capacity_delta_tmc']})  {r['basin']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

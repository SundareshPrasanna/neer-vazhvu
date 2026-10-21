#!/usr/bin/env python3
"""
Jaipur's urban water supply, as the Public Health Engineering Department
(PHED) of Rajasthan publishes it.

PHED, not the municipal corporation, runs Jaipur's water: the Bisalpur
transmission, the Surajpura treatment works, the city's distribution and its
tube wells. THE SOURCE OF RECORD IS PHED'S ANNUAL PROGRESS REPORT 2025-26
(pragati vivaranika, January 2026), Parishisht-21, the Jaipur city row
(status 31.12.2025, printed p.85 / PDF p.89), and the same row a year earlier
in the 2024-25 report (status 31.12.2024, printed p.84 / PDF p.87):

    Bisalpur dam (Banas, about 120 km away)     590.00 MLD   (492.08 in 2024)
    3,633 PHED tube wells                        176.00       (176.01)
                                                 ------
                                                 766.73 MLD   (668.09)

Both reports are Hindi in the legacy Kruti Dev font; their text layer is
unreadable, so every figure was read from the page image and checked against
the row's digits in the text layer, which survive. The tube-well output and
count, and the population column, are the same in both editions: likely
carried forward, so the population is left out.

WHAT IS NOT HERE, on purpose:
  * No treatment capacity. The 200 MLD Surajpura plant in PHED's project list
    is one stage; no primary source gives the whole works' capacity.
  * No city-wide NRW. PHED publishes NRW only for the 24x7 pilot areas.
  * No entitlement. Bisalpur's split (11.1 TMC a year to Jaipur and the
    villages on its pipeline, 5.1 to Ajmer, about 8 to irrigation) is a
    description in a Water Resources Department study (February 2020), not an
    order; no order has been found.

Run:  python3 neer-vazhvu-api/scripts/build_jaipur_supply.py
"""

import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

PHED_ID = "phed-rajasthan-progress-reports"
JICA_ID = "jica-bisalpur-evaluation"
WRD_STUDY_ID = "wrd-rajasthan-drip2-esia-2020"
APR_2026 = (
    "https://phedwater.rajasthan.gov.in/content/dam/doitassets/water/"
    "Public-Health-Engineering-Department/Pdf2026/PHED%20ALL%20page.pdf"
)
APR_2025 = (
    "https://phedwater.rajasthan.gov.in/content/dam/doitassets/water/"
    "Public-Health-Engineering-Department/PDF2025/Annual%20Report%202024-25.pdf"
)
SCHEDULE = (
    "https://phedwater.rajasthan.gov.in/content/dam/doitassets/water/"
    "Public-Health-Engineering-Department/WATER-_SUPPLY_TIME/Jaipur(U).pdf"
)
JICA = "https://www2.jica.go.jp/en/evaluation/pdf/2015_ID-P157_4_f.pdf"
WRD_STUDY = (
    "https://documents1.worldbank.org/curated/en/432001582439812232/pdf/"
    "Revised-Environmental-and-Social-Impact-Assessment-Dam-Rehabilitation-and-Improvement-Project-2-P170873.pdf"
)

# (key, value, where) - every number the artifact publishes.
FIGURES = [
    ("total_mld", 766.73, "APR 2025-26 printed p.85"),
    ("bisalpur_mld", 590.0, "APR 2025-26 printed p.85"),
    ("tubewell_mld", 176.0, "APR 2025-26 printed p.85"),
    ("tubewells", 3633, "APR 2025-26 printed p.85"),
    ("connections", 590385, "APR 2025-26 printed p.85"),
    ("total_mld_2024", 668.09, "APR 2024-25 printed p.84"),
    ("bisalpur_mld_2024", 492.08, "APR 2024-25 printed p.84"),
    ("tankers_peak_2025", 230, "APR 2025-26 printed p.41, 24.06.2025"),
    ("tanker_trips_peak_2025", 1283, "APR 2025-26 printed p.41, 24.06.2025"),
    ("schedule_zones", 400, "PHED zone schedule, status 15.04.2024"),
    ("distance_km", 120, "JICA ex-post evaluation (2016), PDF p.3"),
    ("jaipur_tmc", 11.1, "WRD study (Feb 2020), PDF p.7"),
    ("ajmer_tmc", 5.1, "WRD study (Feb 2020), PDF p.7"),
]
F = {k: v for k, v, _ in FIGURES}


def build() -> dict:
    # PHED's row prints 766.73 against parts of 590 and 176.0; the 0.73 is the
    # row's own rounding, so the parts are checked to within 1 MLD.
    assert abs(F["bisalpur_mld"] + F["tubewell_mld"] - F["total_mld"]) < 1.0
    share = round(F["bisalpur_mld"] / F["total_mld"] * 100)
    rise = round(F["bisalpur_mld"] - F["bisalpur_mld_2024"])
    return {
        "nvdm": "1.0",
        "dataset": "data-root/supply-overview",
        "scope": {"kind": "city", "id": "jaipur"},
        "provenance": {
            "sources": [
                {
                    "id": PHED_ID,
                    "title": "PHED Rajasthan Annual Progress Reports 2025-26 and 2024-25, Parishisht-21 (Jaipur city row); summer tanker table; zone-wise supply schedule",
                    "publisher": "Public Health Engineering Department, Government of Rajasthan",
                    "license": registry_license(PHED_ID),
                },
                {
                    "id": JICA_ID,
                    "title": "JICA ex-post evaluation, Bisalpur-Jaipur Water Supply Project (Transfer System) (2016)",
                    "publisher": "Japan International Cooperation Agency",
                    "license": registry_license(JICA_ID),
                },
                {
                    "id": WRD_STUDY_ID,
                    "title": "Water Resources Department, Rajasthan: revised environmental and social impact assessment, Dam Rehabilitation and Improvement Project 2 (February 2020), Bisalpur description",
                    "publisher": "Water Resources Department, Government of Rajasthan (published by the World Bank)",
                    "license": registry_license(WRD_STUDY_ID),
                },
            ],
            "method": "manual",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_jaipur_supply.py",
            "note": "Transcribed from PHED's progress reports (Kruti Dev Hindi, read from page images); every figure is listed in FIGURES with its page.",
        },
        "hero_copy": {
            "headline": f"{share}% of Jaipur's piped water comes from a dam about {{km}} km away",
            "body": (
                "The Public Health Engineering Department (PHED), the state's water department, "
                f"produced {F['total_mld']:,} MLD a day for {{city}} at the end of 2025. "
                f"{F['bisalpur_mld']:.0f} MLD came from Bisalpur dam on the Banas and "
                f"{F['tubewell_mld']:.0f} MLD from {F['tubewells']:,} PHED tube wells. A year earlier "
                f"Bisalpur gave {F['bisalpur_mld_2024']:.0f} MLD: the whole rise of about {rise} MLD came "
                "from the dam. Bisalpur is shared: a Water Resources Department study (2020) describes "
                f"{F['jaipur_tmc']} TMC a year for Jaipur and the villages on its pipeline, "
                f"{F['ajmer_tmc']} TMC for Ajmer, and the rest for irrigation. PHED's zone schedule "
                "(April 2024) gives most colonies about an hour of water a day."
            ),
            "wtp_label": "PHED water production",
            "wtp_sub": (
                f"{F['bisalpur_mld']:.0f} MLD from Bisalpur and {F['tubewell_mld']:.0f} MLD from "
                f"{F['tubewells']:,} tube wells, 31 December 2025"
            ),
            "uphill_label": "From Bisalpur dam",
            "uphill_sub": "Distance JICA gives for the transfer system (2016)",
            "footer": (
                "Figures from PHED Rajasthan's Annual Progress Reports 2025-26 (status 31 December "
                "2025, p.85) and 2024-25 (p.84), and PHED's zone schedule of 15 April 2024. PHED "
                "publishes no city-wide non-revenue water and no order fixing Jaipur's share of "
                "Bisalpur; both are named gaps on the About page."
            ),
        },
        "supply_chain": [
            "Bisalpur dam on the Banas, Tonk district",
            "The transfer system to Surajpura (treatment) and Balawala pumping station at the city's edge",
            "PHED's city pumping stations and reservoirs (City Circles North and South)",
            f"{F['connections']:,} PHED water connections",
            f"{F['tubewells']:,} PHED tube wells pumping into the same network",
        ],
        "_view_overrides": {
            "subtitle": (
                "Jaipur's water by source, from PHED Rajasthan's progress report (status 31 "
                "December 2025). Refreshed when PHED publishes its next report."
            ),
            "wtp_label": "PHED water production",
        },
        "current_supply_mix_mld": [
            {
                "source": "Bisalpur dam (Banas)",
                "scheme": "Bisalpur-Jaipur transfer system",
                "mld": F["bisalpur_mld"],
                "capacity_mld": None,
                "annual_mcft": None,
                "note": (
                    f"{F['bisalpur_mld_2024']} MLD a year earlier (31 December 2024). The dam also "
                    "supplies Ajmer and Tonk and irrigates farms below it."
                ),
            },
            {
                "source": f"PHED tube wells ({F['tubewells']:,})",
                "scheme": "Pumped into the city network",
                "mld": F["tubewell_mld"],
                "capacity_mld": None,
                "annual_mcft": None,
                "note": (
                    "The same count and output in PHED's 2024-25 and 2025-26 reports. Private "
                    "borewells are not in any PHED figure."
                ),
            },
        ],
        "current_supply_total_mld": F["total_mld"],
        "_supply_total_note": "PHED's production for Jaipur city; water delivered after losses is not published.",
        "distribution": {
            "population_served": None,
            "connections": {"total": F["connections"]},
            "_connections_note": (
                "PHED's count, 31 December 2025. Population left out: PHED's figure is the same in "
                "its 2024-25 and 2025-26 reports."
            ),
        },
        "allocation_context": {"transmission_distance_km": F["distance_km"]},
        "groundwater": {
            "official_mld": F["tubewell_mld"],
            "estimate_mld": None,
            "_note": (
                "PHED's own tube-well draw. For the aquifer under the city, see the groundwater "
                "page: IN-GRES assesses the Jaipur Urban unit as over-exploited."
            ),
        },
        "tankers": {
            "peak_tankers_per_day": F["tankers_peak_2025"],
            "peak_trips_per_day": F["tanker_trips_peak_2025"],
            "as_of": "2025-06-24",
            "_note": "PHED's summer contingency tankers in Jaipur city at the 2025 peak.",
        },
        "_sources": [
            {
                "name": "PHED Rajasthan, Annual Progress Report 2025-26, p.85 (Jaipur city) and p.41 (tankers)",
                "url": APR_2026,
                "date": "2026-01",
                "extracted": "2026-10-20",
            },
            {
                "name": "PHED Rajasthan, Annual Progress Report 2024-25, p.84 (Jaipur city)",
                "url": APR_2025,
                "date": "2025-01",
                "extracted": "2026-10-20",
            },
            {
                "name": "PHED Jaipur zone-wise water supply schedule (status 15.04.2024)",
                "url": SCHEDULE,
                "date": "2024-04-15",
                "extracted": "2026-10-20",
            },
            {
                "name": "JICA ex-post evaluation, Bisalpur-Jaipur Water Supply Project (2016)",
                "url": JICA,
                "date": "2016",
                "extracted": "2026-10-20",
            },
            {
                "name": "WRD Rajasthan, revised ESIA, Dam Rehabilitation and Improvement Project 2 (Feb 2020), p.7",
                "url": WRD_STUDY,
                "date": "2020-02",
                "extracted": "2026-10-20",
            },
        ],
    }


def main() -> int:
    out = build()
    path = REPO_ROOT / "public" / "data" / "jaipur-supply-overview.json"
    write_artifact(path, out)
    print(f"{out['hero_copy']['headline']} -> {path.name}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

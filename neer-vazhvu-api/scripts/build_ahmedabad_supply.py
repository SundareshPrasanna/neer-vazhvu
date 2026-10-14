#!/usr/bin/env python3
"""
Ahmedabad's urban water supply, as Ahmedabad Municipal Corporation publishes it.

THE SOURCE OF RECORD IS AMC'S BUDGET 2026-27 (Gujarati, February 2026),
printed pages 63-64 (PDF 113-114), which tabulates every raw-water source and
treatment plant with its capacity and current use. Not AMC's "Water Project"
web page: its 2,100 / 1,535 MLD table went up between October 2021 and March
2022 (Wayback) and has not changed since, so it is four budgets stale.

THE STORY, in AMC's own table:

    Narmada Main Canal, head regulator 1 -> Kotarpur WTP     330 MLD used
    Narmada Main Canal, head regulator 2 -> Kotarpur WTP     800
    Dholka branch canal (Narmada)        -> Jaspur WTP        420
    Shedhi branch canal (Mahi)           -> Raska WTP         200
    555 borewells                                             100
                                                            -----
                                                            1,850 MLD

1,550 of 1,850 MLD - 84% - comes down the Narmada Main Canal from Sardar
Sarovar. The Sabarmati, the river the city was founded on, supplies none of
it: the French wells and Dudheshwar dropped out of AMC's source table after
2021. Even the river through the riverfront is Narmada water: SRFDCL says the
Narmada canal "makes it possible to replenish the barrage-retained water".

WHAT IS NOT HERE, on purpose:
  * No NRW. AMC has never published a measured figure, and its 2023-24 budget
    says every connection is unmetered.
  * No population. The same 2026-27 budget says "about 90 lakh" on p.63 and 80
    lakh on p.9.
  * No entitlement. No public order states AMC's base allocation from the
    Narmada or the Mahi (the sanction mechanism exists - GR of 3 Feb 2007,
    circular of 9 Sep 2008 - but the quantity does not appear in public).

Every budget figure is listed in FIGURES with its printed page. Run with
`--verify <budget.pdf>` to re-check that each one is printed on that page
(Gujarati digits included) before a refresh is trusted.

Run:  python3 neer-vazhvu-api/scripts/build_ahmedabad_supply.py [--verify budget.pdf]
"""

import argparse
import subprocess
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

BUDGET_ID = "amc-budget"
BUDGET_URL = "https://ahmedabadcity.gov.in/ViewFile/ViewFile?TYPE=FileRepository,2583"
SRFDCL_ID = "srfdcl-riverfront"

# (key, value, printed page) - every number the artifact takes from the budget.
# PDF page = printed page + 50 in this edition.
FIGURES = [
    ("hr1_capacity", 330, 63),
    ("hr1_use", 330, 63),
    ("hr2_capacity", 900, 63),
    ("hr2_use", 800, 63),
    ("dholka_capacity", 600, 63),
    ("dholka_use", 420, 63),
    ("shedhi_capacity", 300, 63),
    ("shedhi_use", 200, 63),
    ("surface_capacity", 2130, 63),
    ("surface_use", 1750, 63),
    ("borewells_count", 555, 63),
    ("borewells_capacity", 315, 63),
    ("borewells_use", 100, 63),
    ("total_capacity", 2445, 63),
    ("total_use", 1850, 63),
    ("kotarpur_wtp", 1150, 64),
    ("kotarpur_wtp_use", 1100, 64),
    ("jaspur_wtp", 400, 64),
    ("raska_wtp", 200, 64),
    ("wtp_total", 1750, 64),
    ("wtp_use", 1700, 64),
    ("wtp_planned_total", 2700, 64),
    ("distribution_stations", 240, 63),
    ("supply_lines_km", 5575, 63),
    ("trunk_mains_km", 555, 63),
]
F = {k: v for k, v, _ in FIGURES}
GU_DIGITS = str.maketrans("૦૧૨૩૪૫૬૭૮૯", "0123456789")


def verify(pdf: Path) -> int:
    bad = []
    for key, value, page in FIGURES:
        text = subprocess.run(
            [
                "pdftotext",
                "-layout",
                "-f",
                str(page + 50),
                "-l",
                str(page + 50),
                str(pdf),
                "-",
            ],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.translate(GU_DIGITS)
        if str(value) not in text:
            bad.append((key, value, page))
    for key, value, page in bad:
        print(f"  NOT FOUND on p.{page}: {key} = {value}", file=sys.stderr)
    print(
        f"verify: {len(FIGURES) - len(bad)}/{len(FIGURES)} figures found",
        file=sys.stderr,
    )
    return 1 if bad else 0


def build() -> dict:
    narmada = F["hr1_use"] + F["hr2_use"] + F["dholka_use"]
    share = round(narmada / F["total_use"] * 100)
    assert narmada + F["shedhi_use"] == F["surface_use"]
    assert F["surface_use"] + F["borewells_use"] == F["total_use"]
    assert F["kotarpur_wtp"] + F["jaspur_wtp"] + F["raska_wtp"] == F["wtp_total"]
    budget = "AMC Budget 2026-27, pp.63-64"
    return {
        "nvdm": "1.0",
        "dataset": "data-root/supply-overview",
        "scope": {"kind": "city", "id": "ahmedabad"},
        "provenance": {
            "sources": [
                {
                    "id": BUDGET_ID,
                    "title": "AMC Budget 2026-27 (Gujarati): raw-water sources and treatment plants, printed pp.63-64",
                    "publisher": "Ahmedabad Municipal Corporation",
                    "license": registry_license(BUDGET_ID),
                },
                {
                    "id": SRFDCL_ID,
                    "title": "Sabarmati Riverfront: environmental improvement (Vasna barrage, Narmada canal replenishment)",
                    "publisher": "Sabarmati River Front Development Corporation Ltd",
                    "license": registry_license(SRFDCL_ID),
                },
            ],
            "method": "manual",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_ahmedabad_supply.py",
            "note": "Transcribed from AMC's budget table; every figure re-checkable against the PDF with --verify.",
        },
        "hero_copy": {
            "headline": f"{share}% of Ahmedabad's water comes down one canal",
            "body": (
                f"Ahmedabad draws {F['total_use']:,} MLD a day. {narmada:,} of it comes from "
                "three offtakes on the Narmada Main Canal, which carries water from Sardar "
                f"Sarovar dam; {F['shedhi_use']} MLD comes from the Mahi through the Shedhi "
                f"branch canal, and {F['borewells_use']} MLD from {F['borewells_count']} "
                "borewells. The Sabarmati, the river {city} was founded on, supplies none of "
                "it, and the water held in the river through the riverfront is topped up from "
                "the same Narmada canal. AMC's 2023-24 budget said the tap runs two hours a "
                "day, from 6 to 8 in the morning, through unmetered connections."
            ),
            "wtp_label": "AMC treatment capacity",
            "wtp_sub": (
                f"{F['wtp_total']:,} MLD at Kotarpur ({F['kotarpur_wtp']:,}), Jaspur "
                f"({F['jaspur_wtp']}) and Raska ({F['raska_wtp']}); {F['wtp_use']:,} MLD "
                f"treated a day. Work under way or planned would take it to {F['wtp_planned_total']:,}."
            ),
            "footer": (
                f"Figures from {budget} (Gujarati, February 2026). AMC publishes no measured "
                "non-revenue water and no entitlement from the Narmada; both are named gaps on "
                "the About page."
            ),
        },
        "supply_chain": [
            "Sardar Sarovar dam on the Narmada",
            "Narmada Main Canal: head regulators 1 and 2 to Kotarpur, the Dholka branch to Jaspur",
            "Kadana dam and the Wanakbori weir on the Mahi, through the Shedhi branch canal to Raska",
            f"Three treatment plants, {F['wtp_total']:,} MLD; {F['distribution_stations']} distribution stations",
            f"{F['supply_lines_km']:,} km of supply lines and {F['trunk_mains_km']} km of trunk mains",
        ],
        "_view_overrides": {
            "subtitle": (
                f"Every raw-water source AMC lists in its {budget}, with capacity and "
                "current use. Refreshed when AMC publishes its next budget."
            ),
            "wtp_label": "AMC treatment capacity",
        },
        "current_supply_mix_mld": [
            {
                "source": "Narmada Main Canal, head regulator 1",
                "scheme": "Kotarpur WTP",
                "mld": F["hr1_use"],
                "capacity_mld": F["hr1_capacity"],
                "annual_mcft": None,
                "note": "Gravity line from the canal. Used at full capacity.",
            },
            {
                "source": "Narmada Main Canal, head regulator 2",
                "scheme": "Kotarpur WTP",
                "mld": F["hr2_use"],
                "capacity_mld": F["hr2_capacity"],
                "annual_mcft": None,
                "note": f"{F['hr2_capacity']} MLD capacity, {F['hr2_use']} used.",
            },
            {
                "source": "Dholka branch canal (Narmada)",
                "scheme": "Jaspur WTP",
                "mld": F["dholka_use"],
                "capacity_mld": F["dholka_capacity"],
                "annual_mcft": None,
                "note": f"{F['dholka_capacity']} MLD capacity, {F['dholka_use']} used.",
            },
            {
                "source": "Shedhi branch canal (Mahi)",
                "scheme": "Raska WTP",
                "mld": F["shedhi_use"],
                "capacity_mld": F["shedhi_capacity"],
                "annual_mcft": None,
                "note": "Mahi water from Kadana, diverted at the Wanakbori weir into the Mahi canal and its Shedhi branch.",
            },
            {
                "source": f"Borewells ({F['borewells_count']})",
                "scheme": "Pumped into distribution stations and isolated networks",
                "mld": F["borewells_use"],
                "capacity_mld": F["borewells_capacity"],
                "annual_mcft": None,
                "note": (
                    f"{F['borewells_capacity']} MLD capacity, {F['borewells_use']} used. The table's own "
                    "sub-count (322 isolated + 238 station-connected) sums to 560, not 555."
                ),
            },
        ],
        "current_supply_total_mld": F["total_use"],
        "_supply_total_note": (
            f"Source-side use. AMC's treatment-side figure for the same day is "
            f"{F['wtp_use']:,} MLD; the two are different measures in one table."
        ),
        "wtps_summary": {
            "fresh_water_wtps_count": 3,
            "fresh_water_capacity_mld": F["wtp_total"],
            "total_installed_capacity_mld": F["wtp_total"],
            "average_supply_mld": F["wtp_use"],
            "planned_additions_mld": F["wtp_planned_total"] - F["wtp_total"],
            "plants": [
                {
                    "name": "Kotarpur",
                    "capacity_mld": F["kotarpur_wtp"],
                    "note": "650 + 200 + 300",
                },
                {
                    "name": "Jaspur",
                    "capacity_mld": F["jaspur_wtp"],
                    "note": "275 + 125",
                },
                {"name": "Raska", "capacity_mld": F["raska_wtp"]},
            ],
        },
        "distribution": {
            "population_served": None,
            "total_wdss": F["distribution_stations"],
            "transmission_mains_km": F["trunk_mains_km"],
            "distribution_network_km": F["supply_lines_km"],
            "note": (
                "Population left out: the same budget says about 90 lakh on p.63 and 80 lakh on p.9."
            ),
        },
        "groundwater": {
            "official_mld": F["borewells_use"],
            "estimate_mld": None,
            "_note": (
                "AMC's own borewell draw. Private borewells are not in any AMC figure. For the "
                "aquifer under the city, see the groundwater page: IN-GRES assesses the Ahmedabad "
                "Urban unit as over-exploited."
            ),
        },
        "_sources": [
            {
                "name": "AMC Budget 2026-27 (Gujarati), pp.63-64",
                "url": BUDGET_URL,
                "date": "2026-02",
                "extracted": "2026-10-14",
            },
            {
                "name": "AMC Budget 2023-24 (English): two hours a day, unmetered connections",
                "url": "https://ahmedabadcity.gov.in/ViewFile/ViewFile?TYPE=FileRepository,2203",
                "date": "2023-02",
                "extracted": "2026-10-14",
            },
            {
                "name": "SRFDCL, Environmental improvement",
                "url": "https://sabarmatiriverfront.com/environmental-improvement.html",
                "date": None,
                "extracted": "2026-10-14",
            },
        ],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--verify", type=Path, help="AMC Budget 2026-27 PDF to re-check against"
    )
    args = ap.parse_args()
    if args.verify:
        rc = verify(args.verify)
        if rc:
            return rc
    out = build()
    path = REPO_ROOT / "public" / "data" / "ahmedabad-supply-overview.json"
    write_artifact(path, out)
    print(f"{out['hero_copy']['headline']} -> {path.name}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

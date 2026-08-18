#!/usr/bin/env python3
"""
Pune's urban water supply, as Pune Municipal Corporation itself publishes it.

EVERY NUMBER HERE COMES FROM PMC'S OWN DRAFT ENVIRONMENT STATUS REPORT 2025-26
or from a Maharashtra Water Resources Regulatory Authority order. Nothing is
press-sourced, and nothing is derived except where the artifact says so. That
matters more than usual for this city, because the folk version of Pune's water
story - "11.5 TMC quota, 18 to 21 TMC actually taken" - compares two figures
that are not comparable, and the accurate version is sharper.

THE STORY, in PMC's own arithmetic (ESR 2025-26 ch.5, "Water Budget 2025-26"):

    net demand for 8,164,868 people        1,110.18 MLD   14.308 TMC
    system losses at 32% NRW               + 522.19 MLD  + 6.730 TMC
    ------------------------------------------------------------------
    total requirement                      1,631.84 MLD   21.030 TMC
    sanctioned entitlement                                16.360 TMC
    ------------------------------------------------------------------
    shortfall PMC reports                                  4.670 TMC

**The shortfall is smaller than the leakage.** 4.67 against 6.73 TMC. Pune's
entitlement gap is arithmetically inside its own distribution losses: fix the
pipes and the deficit is a surplus of 2.05 TMC, without a drop of new water.
Both numbers are PMC's, from one table, and neither needs a hostile reading.

WHY 16.36 AND NOT 11.5. The 11.5 TMC that circulates is the KHADAKWASLA-ONLY
reservation - approved by the state High Power Committee on 10 March 2005 and
carried into the PMC-WRD agreement of 1 March 2013 (11.0 domestic + 0.5
commercial). It is not PMC's total. MWRRA Order 01/2025 records the total
authorisation the River Basin Agency has granted as 16.36 TMC: the 14.61 TMC
agreement plus 1.75 TMC authorised for the merged villages by the
Superintending Engineer's letter of 2 July 2021. Comparing 11.5 against total
lifting compares a single reservoir's share against every source PMC draws on.

THE ENTITLEMENT HAS NEVER ACTUALLY BEEN SETTLED, which is the governance
finding. In 2017 the Pune District Regulatory Officer fixed PMC's entitlement
at 8.19 TMC. In December 2018 MWRRA set that aside and deemed 11.5 TMC an
entitlement under s.31(B), finding PMC's use "far in excess" of the project's
own 8.3 TMC drinking provision and that "the farmers on Khadakwasla Complex are
deprived of their share". PMC appealed again; on 19 May 2025 MWRRA found the
officer who issued the order was not the competent PDRO and remitted it to the
Chief Engineer (I), WRD Pune, for disposal in three months. Nine years, two
orders, no settled number.

Run:  python3 neer-vazhvu-api/scripts/build_pune_supply.py
"""

import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

DATA_DIR = REPO_ROOT / "public" / "data"
MCUM_PER_TMC = 28.3168

ESR = "https://webadmin.pmc.gov.in/sites/default/files/2026-08/PMC%20Draft%20ESR%202025-26_compressed.pdf"
MWRRA_2018 = (
    "http://mwrra.maharashtra.gov.in/wp-content/uploads/2022/08/Case-14-of-2018.pdf"
)
MWRRA_2025 = "https://mwrra.maharashtra.gov.in/wp-content/uploads/2025/11/85.pdf"

# PMC's four abstraction points, ESR 2025-26. Sums to the 1,681.5 MLD of
# installed lifting capacity PMC states on the same page.
SUPPLY_MIX = [
    {
        "source": "Khadakwasla chain (Khadakwasla, Panshet, Warasgaon, Temghar)",
        "scheme": "Parvati, Warje, Lashkar, Holkar, Vadgaon and the other city WTPs",
        "mld": 1500,
        "supplies": "PMC's old limits and most of the merged villages",
        "annual_mcft": None,
        "note": (
            "The four dams hold 29.15 TMC (825.43 MCM) of live storage between "
            "them. Independently confirmed: the Maharashtra WRD daily bulletin's "
            "own live capacities sum to 825.66 Mcum, 0.03% from PMC's figure."
        ),
    },
    {
        "source": "Bhama Askhed dam",
        "scheme": "Bhama Askhed / Kuruli WTP, 200 MLD",
        "mld": 150,
        "supplies": "eastern Pune (Nagar Road, Vadgaon Sheri, Kharadi belt)",
        "annual_mcft": None,
        "note": "PMC's newer eastern source, long delayed by a farmer agitation.",
    },
    {
        "source": "Pavana river",
        "scheme": "Ravet intake",
        "mld": 27,
        "supplies": "north-western fringe",
        "annual_mcft": None,
        "note": "Pavana dam is PCMC's principal source; PMC's draw here is small.",
    },
    {
        "source": "Bhima river",
        "scheme": "Wadhu intake, 5 MLD WTP",
        "mld": 4.5,
        "supplies": "eastern villages",
        "annual_mcft": None,
        "note": "The smallest of the four, and the only one on the Bhima itself.",
    },
]

# ESR 2025-26 water budget, verbatim. TMC and Mm3 are PMC's own columns, not
# conversions we computed.
BUDGET = [
    ("Piped area (old municipal limits)", 5_865_554, 150, 879.83, 11.340, 321.12),
    ("9 merged villages with sewerage", 829_855, 120, 99.58, 1.283, 36.33),
    ("25 outer villages, no sewerage", 1_080_656, 70, 75.65, 0.975, 27.61),
    ("Tanker supply", None, None, 15.00, 0.193, 5.47),
    ("Floating population", 388_803, 35, 13.61, 0.175, 4.96),
    ("Commercial / non-domestic", None, None, 26.51, 0.342, 9.68),
]

# ESR 2025-26 service-level benchmarks. The 2021-22..2024-25 column is ONE
# observation reprinted four times, not a trend - see `_slb_note`.
SLB = [
    ("Coverage of water supply", "%", 100, 98, 98),
    ("Average supply duration", "hours/day", 24, 4, 4),
    ("Non-revenue water", "%", 20, 35, 32),
    ("Per-capita supply", "LPCD", 150, 250, 199.86),
    ("Metered connections", "%", 100, 30, 72),
    ("Collection efficiency", "%", 90, 88, 88),
]

WTPS = [
    ("Parvati New", 500),
    ("Parvati Old", 267),
    ("Warje Phase 2", 200),
    ("Bhama Askhed (Kuruli)", 200),
    ("Warje Phase 1", 180),
    ("Vadgaon Phase 1", 125),
    ("Vadgaon Phase 2", 125),
    ("Lashkar New", 100),
    ("Holkar New", 40),
    ("Fursungi-Uruli", 33),
    ("Chikhali", 27),
    ("Manjari", 12),
    ("Holkar Old", 10),
    ("Warje Malwadi", 10),
    ("Kondhwe-Dhawade", 10),
    ("Fursungi Old", 5),
    ("Wagholi", 5),
    ("Wadhu", 5),
]


def main() -> int:
    total_lift = round(sum(s["mld"] for s in SUPPLY_MIX), 1)
    wtp_total = sum(c for _, c in WTPS)
    net_mld = round(sum(r[3] for r in BUDGET), 2)
    net_tmc = round(sum(r[4] for r in BUDGET), 3)

    # PMC's own totals, for a self-check against the rows above. If the rows
    # stop summing to these the transcription has drifted and the build says so
    # rather than shipping a table that disagrees with its own total.
    stated_net_mld, stated_net_tmc = 1110.18, 14.308
    stated_total_mld, stated_total_tmc = 1631.84, 21.030
    nrw_mld, nrw_tmc, nrw_pct = 522.19, 6.730, 32
    quota_tmc, deficit_tmc = 16.36, 4.67
    # Tolerances are per-check and deliberately tight, EXCEPT where PMC's own
    # table does not close. The segment rows sum to 1,110.18 MLD, and PMC's
    # loss row is exactly 32% of its stated 1,631.84 total (522.19), which
    # implies a net of 1,109.65 - so PMC's published water budget is
    # internally inconsistent by 0.53 MLD (0.03%). Same in the TMC column:
    # 14.308 + 6.730 = 21.038 against a stated 21.030. That is PMC's rounding,
    # not a transcription error, and the artifact reports it rather than
    # silently adopting one of the two answers.
    for label, got, want, tol in [
        ("net demand MLD", net_mld, stated_net_mld, 0.02),
        ("net demand TMC", net_tmc, stated_net_tmc, 0.002),
        ("total MLD", round(net_mld + nrw_mld, 2), stated_total_mld, 0.6),
        ("total TMC", round(net_tmc + nrw_tmc, 3), stated_total_tmc, 0.01),
        ("deficit TMC", round(stated_total_tmc - quota_tmc, 2), deficit_tmc, 0.005),
        ("lift MLD", total_lift, 1681.5, 0.02),
        ("WTP MLD", wtp_total, 1854, 0.02),
    ]:
        if abs(got - want) > tol:
            print(f"  ! {label}: rows give {got}, PMC states {want}", file=sys.stderr)
            return 1

    out = {
        "nvdm": "1.0",
        "dataset": "data-root/supply-overview",
        "scope": {"kind": "city", "id": "pune"},
        "provenance": {
            "sources": [
                {
                    "id": "pmc-esr",
                    "title": "PMC Draft Environment Status Report 2025-26, chapter 5 (water and wastewater management)",
                    "publisher": "Pune Municipal Corporation, Environment Department",
                    "license": registry_license("pmc-esr"),
                }
            ],
            "method": "manual",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_pune_supply.py",
            "note": (
                "Transcribed from PMC's own published report, then checked "
                "against PMC's own stated totals at build time: the water-budget "
                "rows must sum to 1,110.18 MLD / 14.308 TMC, the abstraction "
                "points to 1,681.5 MLD and the WTP list to 1,854 MLD, or the "
                "build fails. The entitlement figures are cross-checked against "
                "MWRRA Orders 19/2018 and 01/2025."
            ),
        },
        "_note": (
            "Pune's supply story is an arithmetic one and PMC publishes both "
            "halves of it. Its own water budget asks for 21.03 TMC a year "
            "against a sanctioned 16.36 TMC, a shortfall of 4.67 TMC - and "
            "books 6.73 TMC of that demand as distribution losses. The gap is "
            "smaller than the leak."
        ),
        "hero_copy": {
            "headline": "The shortfall is smaller than the leak",
            "body": (
                "Pune draws its water from four dams on the Mutha, lifts it "
                "1,681.5 MLD at a time, and treats it at eighteen plants rated "
                "1,854 MLD. By PMC's own water budget it needs 21.03 TMC a year "
                "and is entitled to 16.36 - a shortfall of 4.67 TMC. In the same "
                "table PMC books 6.73 TMC as system losses, 32% non-revenue "
                "water. The entire entitlement gap sits inside the leakage, and "
                "closing it would leave the city 2.05 TMC in surplus without a "
                "drop of new water. Meanwhile the average Punekar gets four "
                "hours of supply a day against PMC's own 24-hour benchmark - "
                "the same four hours reported in every edition since 2021-22."
            ),
            "wtp_label": "PMC treatment capacity",
            "wtp_sub": (
                "1,854 MLD across the plants PMC lists in its ESR 2025-26. The "
                "report's text says 17 plants while the table holds 18 rows; the "
                "capacities are the table's."
            ),
            "nrw_sub": (
                "32% in 2025-26, down from the 35% PMC reported in each of the "
                "four preceding editions. Worth 6.73 TMC a year."
            ),
            "pop_label": "People on PMC water",
            "pop_sub": (
                "8,164,868 across the old city, 34 merged villages and a "
                "floating population PMC puts at 5%."
            ),
            "footer": (
                "Every figure from PMC's Draft Environment Status Report "
                "2025-26 and MWRRA Orders 19/2018 and 01/2025."
            ),
        },
        # Required by src/components/dashboard/urban-supply-overview.tsx.
        # Dam -> canal/main -> WTP -> distribution, in the order the water
        # actually moves.
        "supply_chain": [
            "Khadakwasla chain: Temghar, Warasgaon and Panshet release into Khadakwasla",
            "New Mutha Right Bank Canal and the closed mains to the city",
            "18 water treatment plants totalling 1,854 MLD (Parvati alone is 767)",
            "~2,600 km of distribution mains, 23 major pumping stations",
            "8,164,868 people, at an average 4 hours of supply a day",
        ],
        # WITHOUT THESE THE CARD SHOWS MADURAI'S COPY. The shared
        # UrbanSupplyOverview falls back to i18n strings that were written for
        # Madurai - "Structural numbers from MMC and the ADB Tamil Nadu Urban
        # Flagship Investment Program" and "Pannaipatty WTP capacity" - which
        # rendered verbatim on Pune's dashboard until this was set. Caught in
        # a Playwright pass, not by reading the component.
        "_view_overrides": {
            "subtitle": (
                "Structural numbers from PMC's own Environment Status Report "
                "2025-26 and from MWRRA's orders on the Khadakwasla entitlement. "
                "Refreshed when PMC publishes a new edition."
            ),
            "wtp_label": "PMC treatment capacity",
        },
        "current_supply_mix_mld": SUPPLY_MIX,
        "current_supply_total_mld": total_lift,
        "_supply_total_note": (
            "1,681.5 MLD is PMC's INSTALLED LIFTING capacity across four "
            "abstraction points, not measured delivery. PMC states no measured "
            "daily abstraction, and explicitly excludes groundwater, private "
            "tankers and other alternative sources from these accounts."
        ),
        "wtps_summary": {
            "fresh_water_wtps_count": len(WTPS),
            "fresh_water_capacity_mld": wtp_total,
            "total_installed_capacity_mld": wtp_total,
            "plant_count_listed": len(WTPS),
            "plants": [{"name": n, "capacity_mld": c} for n, c in WTPS],
            "note": (
                "PMC's text says 17 plants; its own table lists 18. The 2024-25 "
                "edition said 15 plants totalling 1,914 MLD. Flagged, not resolved."
            ),
        },
        "distribution": {
            "population_served": 8_164_868,
            "transmission_mains_km": 2600,
            "pumping_stations": 23,
            "note": "ESR 2025-26. Network length is PMC's approximate figure.",
        },
        "water_budget_2025_26": {
            "rows": [
                {
                    "segment": seg,
                    "population": pop,
                    "norm_lpcd": lpcd,
                    "mld": mld,
                    "tmc": tmc,
                    "mcum": mcum,
                }
                for seg, pop, lpcd, mld, tmc, mcum in BUDGET
            ],
            "net_demand_mld": stated_net_mld,
            "net_demand_tmc": stated_net_tmc,
            "system_loss_mld": nrw_mld,
            "system_loss_tmc": nrw_tmc,
            "nrw_pct": nrw_pct,
            "total_requirement_mld": stated_total_mld,
            "total_requirement_tmc": stated_total_tmc,
            "sanctioned_quota_tmc": quota_tmc,
            "shortfall_tmc": deficit_tmc,
            "_finding": (
                "The shortfall (4.67 TMC) is smaller than the system loss "
                "(6.73 TMC). Eliminating non-revenue water would take total "
                "requirement to 14.31 TMC against a 16.36 TMC entitlement - a "
                "2.05 TMC surplus. This is a subtraction across two rows of one "
                "PMC table, not a modelled claim."
            ),
            "_table_does_not_close": (
                "PMC's own budget is internally inconsistent by 0.53 MLD "
                "(0.03%). The six segment rows sum to 1,110.18 MLD, while the "
                "loss row is exactly 32% of the stated 1,631.84 total, which "
                "implies a net of 1,109.65. The TMC column shows the same gap: "
                "14.308 + 6.730 = 21.038 against a stated 21.030. Both of PMC's "
                "figures are reproduced here as published rather than one being "
                "quietly corrected to make the arithmetic close. The discrepancy "
                "is far too small to affect the finding above."
            ),
        },
        "entitlement": {
            "sanctioned_tmc": quota_tmc,
            "sanctioned_basis": (
                "MWRRA Order 01/2025: 14.61 TMC by agreement plus 1.75 TMC "
                "authorised for the merged villages by the Superintending "
                "Engineer's letter of 2 July 2021."
            ),
            "khadakwasla_only_reservation_tmc": 11.5,
            "khadakwasla_reservation_basis": (
                "State High Power Committee, 10 March 2005; carried into the "
                "PMC-WRD agreement of 1 March 2013 as 11.0 domestic + 0.5 "
                "commercial. THIS IS THE 11.5 TMC THAT CIRCULATES, and it is one "
                "reservoir's share, not PMC's total entitlement."
            ),
            "history": [
                {
                    "date": "2005-03-10",
                    "event": "State High Power Committee approves an 11.5 TMC/yr reservation for PMC from Khadakwasla.",
                    "source_url": MWRRA_2018,
                },
                {
                    "date": "2013-03-01",
                    "event": "PMC-WRD water supply agreement signed: 11.0 TMC domestic + 0.5 TMC commercial, six-year term.",
                    "source_url": MWRRA_2018,
                },
                {
                    "date": "2017-10-23",
                    "event": "Pune District Regulatory Officer fixes PMC's entitlement at 8.19 TMC/yr.",
                    "source_url": MWRRA_2018,
                },
                {
                    "date": "2018-12-13",
                    "event": (
                        "MWRRA sets the PDRO order aside, deems 11.5 TMC an entitlement "
                        "under s.31(B), and finds PMC's use far in excess of the project's "
                        "8.3 TMC drinking provision, with farmers on the Khadakwasla "
                        "Complex 'deprived of their share'."
                    ),
                    "source_url": MWRRA_2018,
                },
                {
                    "date": "2021-07-02",
                    "event": "Superintending Engineer authorises a further 1.75 TMC for the merged villages.",
                    "source_url": MWRRA_2025,
                },
                {
                    "date": "2025-05-19",
                    "event": (
                        "MWRRA finds the officer who issued the impugned order was not the "
                        "competent PDRO and remits the matter to the Chief Engineer (I), "
                        "WRD Pune, for disposal within three months. The entitlement remains "
                        "formally unresolved."
                    ),
                    "source_url": MWRRA_2025,
                },
            ],
            "recorded_actual_use_tmc": {
                "2011-12": 15.90,
                "2012-13": 15.39,
                "2013-14": 15.95,
                "2014-15": 15.83,
                "2015-16": 16.50,
                "2016-17": 16.71,
                "2017-18": 18.71,
                "_note": (
                    "WRD's affidavit figures as recorded in MWRRA Order 19/2018; the "
                    "seven-year average is 17.3 TMC. PMC's own affidavit put 2017-18 at "
                    "14.56 TMC (412.36 MCM) - the utility and the regulator disagree by "
                    "4.15 TMC about how much water the utility took. NO MEASURED ANNUAL "
                    "DRAW HAS BEEN PUBLISHED SINCE 2017-18."
                ),
            },
            "khadakwasla_complex_context_tmc": {
                "total_use": 33.77,
                "irrigation_provision": 22.55,
                "evaporation_loss": 2.92,
                "pmc_drinking_provision_in_project_planning": 8.30,
                "_note": (
                    "Ex. Engineer, Khadakwasla Irrigation Division, affidavit of "
                    "1 December 2018, via MWRRA Order 19/2018. The complex is an "
                    "IRRIGATION project with a drinking-water share, which is why no "
                    "days-of-water-left runway is computed for Pune: most of that "
                    "storage is not the city's to drink."
                ),
            },
        },
        "service_levels": {
            "rows": [
                {
                    "indicator": ind,
                    "unit": unit,
                    "target": tgt,
                    "reported_2021_22_to_2024_25": old,
                    "reported_2025_26": new,
                }
                for ind, unit, tgt, old, new in SLB
            ],
            "_slb_note": (
                "PMC REPUBLISHED AN IDENTICAL SERVICE-LEVEL-BENCHMARK TABLE FOR "
                "FOUR CONSECUTIVE YEARS. The 2021-22, 2022-23, 2023-24 and "
                "2024-25 editions all report coverage 98%, supply 4 hours, NRW "
                "35%, per-capita 250 LPCD, metered 30% and collection 88%. Only "
                "2025-26 moves. Treat the first column as ONE observation, never "
                "as a four-year trend."
            ),
            "_lpcd_note": (
                "199.86 LPCD is gross at source (1,631.84 MLD over 8,164,868 "
                "people). Net at the tap on PMC's own net-demand row is 135.97 "
                "LPCD - our arithmetic on PMC's numbers, not a PMC figure."
            ),
        },
        "equitable_supply_project": {
            "name": "Equitable (24x7) Water Supply Project",
            "sanctioned_cost_inr_crore": 2818.46,
            "spent_inr_crore": 1557.89,
            "physical_progress_pct": 85,
            "storage_tanks_planned": 82,
            "storage_tanks_built": 67,
            "storage_tanks_commissioned": 35,
            "amr_meters_installed": 199_553,
            "amr_meters_target": 235_048,
            "feeder_mains_km": 98.90,
            "distribution_mains_km": 1039.48,
            "pmc_stated_time_remaining": "12 to 14 months, as of the 2025-26 ESR",
            "blocked_on_permissions": (
                "29.417 km at 158 sites awaiting traffic police permission, 2 km "
                "awaiting Irrigation, 2.352 km awaiting Defence/Cantonment."
            ),
            "local_gains_claimed": (
                "Where the project is complete PMC reports leakage down from 40% "
                "to 29%, and private tankers in Baner-Balewadi down from about "
                "170 a day to about 75."
            ),
            "_note": (
                "67 tanks are BUILT and 35 are COMMISSIONED. The difference is the "
                "honest measure of what has actually reached anybody. No PMC source "
                "claims continuous 24-hour supply anywhere in the city."
            ),
        },
        "sewage": {
            "generated_mld": 980,
            "generated_breakdown_mld": {
                "old city": 744,
                "11 villages merged 2017": 139,
                "23 villages merged 2021": 97,
            },
            "installed_capacity_mld": 477,
            "operating_stp_count": 9,
            "untreated_mld": 503,
            "untreated_pct": 51,
            "jica_programme_mld": 396,
            "_note": (
                "980 generated against 477 MLD of operating capacity leaves 503 "
                "MLD, 51% of what the city produces, reaching the Mula-Mutha "
                "untreated. The untreated figure is our subtraction of PMC's two "
                "published numbers. A 567 MLD capacity figure also circulates and "
                "reconciles: it counts the 90 MLD Old Naidu plant, which CPCB's "
                "inventory marks non-operational. The 11 proposed plants of the "
                "JICA programme total 396 MLD, which the OpenCity STP layer "
                "reproduces independently."
            ),
        },
        "groundwater": {
            "official_mld": None,
            "_note": (
                "PMC PUBLISHES NO GROUNDWATER NUMBER AT ALL, and says so: its "
                "supply accounts 'do not include groundwater sources (e.g. "
                "borewells), private tanker supply or other alternative sources'. "
                "Its 2025-26 ESR recommends CREATING seasonal borewell monitoring, "
                "city groundwater maps and a licensing regime for commercial "
                "borewells - confirming none exists. The only municipal survey is "
                "a 320-borewell pilot across five clusters. The independent "
                "estimate is ACWADAM's (2019): roughly 4 TMC a year from perhaps "
                "80,000 to 125,000 borewells, about a quarter of formal municipal "
                "supply. That is a modelled estimate from a research NGO, carried "
                "here as the only number anyone has published and NOT as a "
                "measurement."
            ),
        },
        # Shape is the component's: {name, url, date, extracted}.
        "_sources": [
            {
                "name": "PMC Draft Environment Status Report 2025-26",
                "url": ESR,
                "date": "2026-08",
                "extracted": date.today().isoformat(),
            },
            {
                "name": "MWRRA Order, Case 14 of 2018 (PMC entitlement, Khadakwasla Complex)",
                "url": MWRRA_2018,
                "date": "2018-12-13",
                "extracted": date.today().isoformat(),
            },
            {
                "name": "MWRRA Order 01/2025 (PMC appeal; total authorisation 16.36 TMC)",
                "url": MWRRA_2025,
                "date": "2025-05-19",
                "extracted": date.today().isoformat(),
            },
        ],
    }

    path = DATA_DIR / "pune-supply-overview.json"
    write_artifact(path, out, indent=1)
    print(
        f"pune supply: lift {total_lift} MLD, WTP {wtp_total} MLD, "
        f"demand {stated_total_tmc} TMC vs {quota_tmc} TMC entitlement "
        f"(shortfall {deficit_tmc}, leakage {nrw_tmc}) -> {path.name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

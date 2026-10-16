#!/usr/bin/env python3
"""
Nagpur's urban water supply, as Nagpur Municipal Corporation publishes it.

Writes public/data/nagpur-supply-overview.json, read by the cauvery-pumping
hero (hero_copy, wtps_summary, allocation_context) and the supply tile below it
(supply_chain, current_supply_mix_mld, distribution, _view_overrides, _sources).

SOURCES OF RECORD, newest first:

  NMC Budget 2026-27, Commissioner's speech, printed pp.B-3/B-4 (published
      May 2026; the speech prints no date). A scan with no text layer: every figure was read by OCR and checked on
      the page image. 4.50 lakh connections, 106 water tanks, 4,650 km of
      distribution mains, 37 tankers (346 in 2018, 309 fewer).
  NMC Budget 2025-26, speech p.B-4 (April 2025, text layer): 59 tankers.
  NMC Environment Status Report 2023-24 (CSIR-NEERI), printed pp.132-134:
      five plants rated 786 MLD; 706 MLD supplied, 410 MLD billed, 41.91% lost
      between source and consumer (FY 2023-24, the latest balance online).
      Table 6.2's monthly rows are the supplied total, 257.642 Mcum (the
      report's sentence pairs it with the billed 410 MLD; its table and the
      arithmetic make it supply); 410 MLD billed is about 150 Mcum a year.
  ESR 2022-23, 2019-20 (Wayback copy) and the 2017-18 draft (third-party
      mirror, the only copy found), for the edition series.
  MWRRA Order 13/2018 (Case 8 of 2017, 12 Sep 2018), scanned: OCR, checked
      on the page image. Conveyance length and the April 2015 pipeline.

The Pench entitlement, its history and the 2017-18 draw live on the
allocations page (build_nagpur_allocations.py), not here.

Editions disagree with one another and, twice, with themselves. Each
disagreement ships as a finding; none is corrected. The build refuses to write
if a transcribed table stops summing to its printed total.

Run:  ~/.pyenv/versions/neer-vazhvu-api/bin/python neer-vazhvu-api/scripts/build_nagpur_supply.py
      [--verify DIR]   re-check every text-layer figure on its PDF page; DIR
                       holds esr_2023_24.pdf, esr_2022_23.pdf, esr_2017_18.pdf
                       and nmc_budget_2025_26.pdf
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

OUT = REPO_ROOT / "public" / "data" / "nagpur-supply-overview.json"
EXTRACTED = "2026-10-15"  # the day every figure below was re-read

BUDGET_2627 = "https://nmcnagpur.gov.in/assets/300/2026/06/mediafiles/6a1d606eebca4_nmcbudget2026.pdf"
BUDGET_2526 = "https://nmcnagpur.gov.in/assets/300/2025/06/mediafiles/Final_budget_2024-_2025-2026_(1).pdf"
ESR_2324 = "https://nmcnagpur.gov.in/assets/300/2025/08/Public-Notices/ESR_Final_Report_2023-2024.pdf"
ESR_2223 = "https://www.nmcnagpur.gov.in/assets/300/2025/08/Public-Notices/ESR_final_Report_2022-2023.pdf"
# Live URL answers 404; the Wayback capture is the copy read.
ESR_1920 = "https://web.archive.org/web/20220806150918/https://www.nmcnagpur.gov.in/assets/250/2021/06/mediafiles/Final_2020_ESR_-_AK.pdf"
# NMC's site does not carry the 2017-18 draft; this mirror is the only copy found.
ESR_1718 = "https://caknnagpur871784109.wordpress.com/wp-content/uploads/2019/12/environmental-status-report-nagpur-2017-18.pdf"
MWRRA_ORDER = "https://mwrra.maharashtra.gov.in/wp-content/uploads/2022/08/Case-No-8-of-2017-Final-Order.pdf"

# (doc, key, value, printed page, pdf page). pdf page None = scan, checked on
# the page image only. --verify looks for str(value) on the pdf page.
FIGURES = [
    ("budget2627", "connections_lakh", 4.50, "B-3", None),
    ("budget2627", "water_tanks", 106, "B-3", None),
    ("budget2627", "network_km", 4650, "B-3", None),
    ("budget2627", "revenue_budget_2025_26_cr", 250.00, "B-3", None),
    ("budget2627", "revenue_received_2025_26_cr", 175, "B-3", None),
    ("budget2627", "revenue_proposed_2026_27_cr", 275.00, "B-4", None),
    ("budget2627", "tankers_2018", 346, "B-4", None),
    ("budget2627", "tankers_cut_since_2018", 309, "B-4", None),
    ("budget2627", "tankers_now", 37, "B-4", None),
    ("budget2526", "revenue_budget_2024_25_cr", "250.00", "B-4", 9),
    ("budget2526", "revenue_received_2024_25_cr", "195.00", "B-4", 9),
    ("budget2526", "tankers_cut_since_2018_b2526", 287, "B-4", 9),
    ("budget2526", "tankers_now_b2526", 59, "B-4", 9),
    ("esr2324", "pench_i", 136, "132", 133),
    ("esr2324", "pench_ii", 175, "132", 133),
    ("esr2324", "pench_iii", 120, "132", 133),
    ("esr2324", "wtp_total", 786, "132", 133),
    ("esr2324", "pench_iv", 115, "133", 134),
    ("esr2324", "kanhan", 240, "133", 134),
    ("esr2324", "command_areas", 73, "133", 134),
    ("esr2324", "supplied_mld", 706, "133", 134),
    ("esr2324", "loss_pct", 41.91, "133", 134),
    ("esr2324", "billed_mld", 410, "133", 134),
    ("esr2324", "pure_water_mcm", 257.642, "133", 134),
    ("esr2324", "dark_zone_cas", 36, "134", 135),
    ("esr2324", "tankers_2024", 78, "134", 135),
    ("esr2324", "samples", 16364, "134", 135),
    ("esr2324", "samples_fit", 16050, "134", 135),
    ("esr2324", "samples_unfit", 314, "134", 135),
    ("esr2324", "samples_fit_pct", 98.08, "134", 135),
    ("esr2223", "billed_mld_2223", 377.454, "162", 163),
    ("esr2223", "pure_water_mcm_2223", 250.679, "162", 163),
    ("esr2223", "loss_pct_2223_stated", 47, "162", 163),
    ("esr2223", "tankers_2023", 193, "162", 163),
    ("esr2223", "dark_zone_cas_2223", 39, "163", 164),
    ("esr1718", "network_km_1718", 2100, "23", 36),
    ("esr1718", "wtp_total_1718", 760, "23", 36),
    ("esr1718", "wtp_actual_1718", 657, "23", 36),
    ("esr1718", "canal_km", "48.50", "22", 35),
]
F = {k: v for _, k, v, _, _ in FIGURES}
PDF_NAMES = {
    "esr2324": "esr_2023_24.pdf",
    "esr2223": "esr_2022_23.pdf",
    "esr1718": "esr_2017_18.pdf",
    "budget2526": "nmc_budget_2025_26.pdf",
}

# ESR 2023-24 s.6.2.1, printed pp.132-133 (the 2022-23 edition lists the same five).
WTPS = [
    ("Pench I", F["pench_i"], "Pench"),
    ("Pench II", F["pench_ii"], "Pench"),
    ("Pench III", F["pench_iii"], "Pench"),
    ("Pench IV (Godhani)", F["pench_iv"], "Pench"),
    ("Kanhan", F["kanhan"], "Kanhan"),
]
# ESR 2017-18 draft, Table 4.4 "Present Treated Water Supply", printed p.23: capacity, actual MLD.
WTPS_2017_18 = [
    ("Kanhan Water Works", 240, 185),
    ("Pench Phase I", 136, 148),
    ("Pench Phase II", 133, 122),
    ("Pench Phase III, Stage I", 120, 100),
    ("Godhni Pench-IV", 115, 86),
    ("Old Gorewada", 16, 16),
]
# Table 6.2 of each edition: pure water supply, Mm3 per month.
MONTHLY_2023_24 = [
    ("2023-04", 21.245),
    ("2023-05", 22.366),
    ("2023-06", 21.697),
    ("2023-07", 21.803),
    ("2023-08", 21.962),
    ("2023-09", 21.071),
    ("2023-10", 22.265),
    ("2023-11", 20.850),
    ("2023-12", 21.281),
    ("2024-01", 21.452),
    ("2024-02", 19.856),
    ("2024-03", 21.794),
]
MONTHLY_2022_23 = [
    ("2022-04", 20.788),
    ("2022-05", 21.867),
    ("2022-06", 21.007),
    ("2022-07", 20.348),
    ("2022-08", 20.507),
    ("2022-09", 20.227),
    ("2022-10", 21.043),
    ("2022-11", 20.077),
    ("2022-12", 21.419),
    ("2023-01", 21.375),
    ("2023-02", 19.622),
    ("2023-03", 22.392),
]
# What ESR 2022-23 Table 6.2's twelve rows add to; the table prints 250.679.
ROWS_2022_23 = 250.672
# ESR 2017-18 p.22 "48.50 Km" of canal; NMC told MWRRA 48.4 km (para 32(v)).
CONVEYANCE_KM = 48.5
# ESR 2017-18 s.4.1.2, p.19: intake "approximately 14 km from Nagpur City".
KANHAN_INTAKE_KM = 14


def _sum(rows: list[tuple[str, float]]) -> float:
    return round(sum(v for _, v in rows), 3)


def checks() -> dict:
    """Assert every transcribed table against its printed total; return the arithmetic."""
    pench = sum(c for _, c, s in WTPS if s == "Pench")
    loss_arith = round(100 * (1 - F["billed_mld"] / F["supplied_mld"]), 2)
    # April 2023 to March 2024 has 366 days (29 February 2024).
    mld_2324 = round(_sum(MONTHLY_2023_24) * 1000 / 366, 1)
    mld_2324_365 = round(_sum(MONTHLY_2023_24) * 1000 / 365, 1)
    mld_2223 = round(F["pure_water_mcm_2223"] * 1000 / 365, 1)
    loss_2223 = round(100 * (1 - F["billed_mld_2223"] / mld_2223), 1)
    # ESR 2022-23 Table 6.2 does not close: its twelve rows (checked on the page
    # image) sum to 250.672 against a printed total of 250.679. Rows and total
    # are both asserted so a transcription slip cannot hide inside the gap.
    for label, got, want, tol in [
        ("five plants", sum(c for _, c, _ in WTPS), F["wtp_total"], 0),
        ("Pench plants", pench, 546, 0),
        ("2023-24 monthly rows", _sum(MONTHLY_2023_24), F["pure_water_mcm"], 0.0005),
        ("2022-23 monthly rows", _sum(MONTHLY_2022_23), ROWS_2022_23, 0.0005),
        (
            "2022-23 printed total minus rows",
            round(F["pure_water_mcm_2223"] - _sum(MONTHLY_2022_23), 3),
            0.007,
            0.0005,
        ),
        # 257.642 Mcum is 705.9 MLD over 365 days and 703.9 over 366; NMC states 706.
        (
            "2023-24 rows as MLD over 365 days vs 706",
            mld_2324_365,
            F["supplied_mld"],
            0.15,
        ),
        ("2023-24 rows as MLD over 366 days vs 706", mld_2324, F["supplied_mld"], 2.5),
        # 410 of 706 gives 41.93%; NMC prints 41.91%. Same to rounding, not identical.
        ("loss from 410 of 706", loss_arith, F["loss_pct"], 0.05),
        ("2022-23 loss by its own table", loss_2223, 45.0, 0.1),
        (
            "2017-18 plants capacity",
            sum(c for _, c, _ in WTPS_2017_18),
            F["wtp_total_1718"],
            0,
        ),
        (
            "2017-18 plants actual",
            sum(a for _, _, a in WTPS_2017_18),
            F["wtp_actual_1718"],
            0,
        ),
        (
            "Budget 2026-27 tankers",
            F["tankers_2018"] - F["tankers_cut_since_2018"],
            F["tankers_now"],
            0,
        ),
        (
            "Budget 2025-26 tankers",
            F["tankers_2018"] - F["tankers_cut_since_2018_b2526"],
            F["tankers_now_b2526"],
            0,
        ),
        ("2023-24 samples", F["samples_fit"] + F["samples_unfit"], F["samples"], 0),
        (
            "2023-24 fit share",
            round(100 * F["samples_fit"] / F["samples"], 2),
            F["samples_fit_pct"],
            0.005,
        ),
        ("conveyance km", float(F["canal_km"]), CONVEYANCE_KM, 0),
    ]:
        if abs(got - want) > tol:
            raise SystemExit(f"  ! {label}: rows give {got}, source states {want}")
    return {
        "pench": pench,
        "loss_arith": loss_arith,
        "mld_2324": mld_2324,
        "mld_2324_365": mld_2324_365,
        "mld_2223": mld_2223,
        "loss_2223": loss_2223,
    }


def verify(pdf_dir: Path) -> int:
    bad = []
    for doc, key, value, printed, page in FIGURES:
        if page is None:
            continue
        text = subprocess.run(
            [
                "pdftotext",
                "-layout",
                "-f",
                str(page),
                "-l",
                str(page),
                str(pdf_dir / PDF_NAMES[doc]),
                "-",
            ],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
        if str(value) not in text:
            bad.append(f"  NOT FOUND {doc} p.{printed} (pdf {page}): {key} = {value}")
    print(
        *bad,
        f"verify: {sum(p is not None for *_, p in FIGURES) - len(bad)} figures found",
        sep="\n",
        file=sys.stderr,
    )
    return 1 if bad else 0


def build() -> dict:
    a = checks()
    wtp, pench, kanhan = F["wtp_total"], a["pench"], F["kanhan"]
    esr = "NMC ESR 2023-24"
    lakh = f"{F['connections_lakh']:.2f} lakh"
    return {
        "nvdm": "1.0",
        "dataset": "data-root/supply-overview",
        "scope": {"kind": "city", "id": "nagpur"},
        "provenance": {
            "sources": [
                {
                    "id": "nmc-budget",
                    "title": "NMC Budget 2026-27 (Commissioner's speech, printed pp.B-3 and B-4) and Budget 2025-26 (p.B-4)",
                    "publisher": "Nagpur Municipal Corporation",
                    "license": registry_license("nmc-budget"),
                    "retrieved": EXTRACTED,
                },
                {
                    "id": "nmc-esr",
                    "title": "NMC Environment Status Reports 2023-24 (pp.132-134), 2022-23 (pp.161-163), 2019-20 (pp.28-31) and the 2017-18 draft (pp.18-23)",
                    "publisher": "Nagpur Municipal Corporation, prepared by CSIR-NEERI",
                    "license": registry_license("nmc-esr"),
                    "retrieved": EXTRACTED,
                },
                {
                    "id": "mwrra-case-8-2017",
                    "title": "MWRRA Order No. 13/2018 in Case No. 8 of 2017, 12 Sep 2018 (para 32(v), p.23)",
                    "publisher": "Maharashtra Water Resources Regulatory Authority",
                    "license": registry_license("mwrra-case-8-2017"),
                    "retrieved": EXTRACTED,
                },
            ],
            "method": "pdf-extract",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_nagpur_supply.py",
            "note": (
                "Transcribed from NMC's budgets and Environment Status Reports and checked against their "
                "printed totals at build time. The Budget 2026-27 and the MWRRA order are scans with no text "
                "layer: OCR, checked on the page image (Budget pp.B-3, B-4; order p.23). Text-layer figures "
                "re-check with --verify. Where editions disagree, both figures ship as findings."
            ),
        },
        "hero_copy": {
            "headline": f"Four of Nagpur's five treatment plants, {pench} of {wtp} MLD, run on Pench water from Navegaon Khairi",
            "body": (
                f"{{city}} has five water treatment plants rated {wtp} MLD. Four of them, {pench} MLD, take "
                "water from the Pench Project Complex: Totladoh, a hydro-power reservoir whose water is shared "
                "with Madhya Pradesh, releases to the Navegaon Khairi pick-up dam, and the water goes to the "
                "Mahadula pumping station, at km {km} of the old canal route (ESR 2017-18 draft); NMC told the "
                "state regulator that a closed pipeline replaced the canal in April 2015. The fifth plant, "
                f"{kanhan} MLD, draws from the Kanhan river "
                f"{KANHAN_INTAKE_KM} km from the city. NMC's 2026-27 budget (published May 2026) counts {lakh} water "
                f"connections, "
                f"{F['water_tanks']} water tanks, {F['network_km']:,} km of distribution mains and "
                f"{F['tankers_now']} tankers serving areas the network does not reach. NMC's latest published "
                f"water balance, for 2023-24, records {F['supplied_mld']} MLD supplied, {F['billed_mld']} MLD "
                f"billed and {F['loss_pct']}% lost between source and consumer. The same report counts certain "
                f"areas in {F['dark_zone_cas']} of the {F['command_areas']} command areas as dark zones, where "
                "supply was found to be less than two hours a day."
            ),
            "wtp_label": "NMC treatment capacity",
            "wtp_sub": (
                f"Pench I {F['pench_i']}, Pench II {F['pench_ii']}, Pench III {F['pench_iii']}, Pench IV "
                f"{F['pench_iv']} and Kanhan {kanhan} MLD ({esr}, pp.132-133)."
            ),
            "uphill_label": "Old canal route to Mahadula",
            "uphill_sub": (
                "Navegaon Khairi to the Mahadula pumping station by the canal (ESR 2017-18 draft, p.22). NMC "
                "told the state regulator during Case 8 of 2017 that a closed pipeline replaced the canal in "
                "April 2015; no source gives the pipeline's length."
            ),
            "nrw_sub": f"2023-24: {F['supplied_mld']} MLD supplied, {F['billed_mld']} MLD billed ({esr}, p.133).",
            "footer": (
                f"Figures from NMC Budget 2026-27, Commissioner's speech, pp.B-3 and B-4 (published May 2026; "
                f"a scan, read from the page images), {esr} (CSIR-NEERI), pp.132-134, the ESR 2017-18 draft, "
                "pp.19 and 22, and MWRRA Order 13/2018, p.23. The latest water balance NMC has put online is "
                "for 2023-24."
            ),
        },
        "supply_chain": [
            "Totladoh reservoir on the Pench, whose water is shared with Madhya Pradesh, releases to the Navegaon Khairi pick-up dam",
            f"Mahadula pumping station, at km {CONVEYANCE_KM} of the old canal route (ESR 2017-18 draft); a closed pipeline replaced the canal in April 2015 (NMC)",
            f"Kanhan river intake, {KANHAN_INTAKE_KM} km from the city",
            f"Five treatment plants, {wtp} MLD: Pench I to IV {pench}, Kanhan {kanhan}",
            f"{F['water_tanks']} water tanks and {F['network_km']:,} km of distribution mains",
            f"{lakh} water connections",
        ],
        "_view_overrides": {
            "subtitle": (
                f"Structure from NMC's Budget 2026-27 (published May 2026) and {esr}. The source split is rated "
                "treatment capacity: NMC's reports give no supply figure per source. Supply in 2023-24 was "
                f"{F['supplied_mld']} MLD."
            ),
            "wtp_label": "NMC treatment capacity",
            "source_mix_label": "Treatment capacity by source - {total} MLD",
        },
        "current_supply_mix_mld": [
            {
                "source": "Pench, four plants (rated capacity)",
                "scheme": "Pench I, II, III and IV",
                "mld": pench,
                "capacity_mld": pench,
                "annual_mcft": None,
                "note": f"'The maximum water is received to city is from Pench Dam' ({esr}, p.133).",
            },
            {
                "source": "Kanhan, one plant (rated capacity)",
                "scheme": "Kanhan Water Works",
                "mld": kanhan,
                "capacity_mld": kanhan,
                "annual_mcft": None,
                "note": "Run-of-river intake behind a 1956 barrage of 7.82 Mm3 (ESR 2017-18 draft, p.19).",
            },
        ],
        "current_supply_total_mld": wtp,
        "_supply_total_note": (
            f"{wtp} MLD is rated treatment capacity. NMC reported supplying {F['supplied_mld']} MLD in "
            f"2023-24 ({F['pure_water_mcm']} Mcum over the year, {esr} Table 6.2)."
        ),
        "wtps_summary": {
            "fresh_water_wtps_count": len(WTPS),
            "fresh_water_capacity_mld": wtp,
            "total_installed_capacity_mld": wtp,
            "plants": [
                {"name": n, "capacity_mld": c, "raw_water": s} for n, c, s in WTPS
            ],
            "_source_ref": f"{esr}, s.6.2.1, printed pp.132-133; the same list in ESR 2022-23, p.161",
            "edition_2017_18": {
                "plants": [
                    {"name": n, "capacity_mld": c, "actual_supply_mld": x}
                    for n, c, x in WTPS_2017_18
                ],
                "capacity_mld": F["wtp_total_1718"],
                "actual_supply_mld": F["wtp_actual_1718"],
                "_source_ref": "ESR 2017-18 draft (CSIR-NEERI), Table 4.4, printed p.23",
            },
            "note": (
                "EDITION FINDING. The 2017-18 draft lists six plants at 760 MLD delivering 657 (Pench II at "
                "133, Old Gorewada at 16). The 2022-23 and 2023-24 editions list five at 786 (Pench II at 175, "
                "no Old Gorewada). Neither edition explains the change; both lists are carried as printed."
            ),
        },
        "allocation_context": {
            "transmission_distance_km": CONVEYANCE_KM,
            "nrw_pct": F["loss_pct"],
            "_source_ref": (
                f"km: ESR 2017-18 draft p.22 ('48.50 Km'; NMC to MWRRA in 2017: 48.4 km of canal, Order "
                f"13/2018 para 32(v)). Loss: {esr}, p.133, 'loss of water ... from source to consumer'."
            ),
        },
        "distribution": {
            "population_served": None,
            "administrative_zones": 10,
            "ground_level_cwrs": F["water_tanks"],
            "distribution_network_km": F["network_km"],
            "connections": {"total": round(F["connections_lakh"] * 100_000)},
            "_connections_note": (
                f"NMC Budget 2026-27, p.B-3 (published May 2026): {lakh} water connections, {F['water_tanks']} water "
                f"tanks, {F['network_km']:,} km of distribution mains. {esr} counts {F['command_areas']} "
                "operating command areas in ten water distribution zones."
            ),
            "note": (
                "Population left off: the last census count (2011) is fifteen years old, and the ESR's own "
                "estimate cites a commercial website. The ten zones are NMC's ten water distribution zones "
                f"({esr}, p.133)."
            ),
        },
        "water_balance_2023_24": {
            "supplied_mld": F["supplied_mld"],
            "billed_mld": F["billed_mld"],
            "loss_pct": F["loss_pct"],
            "loss_pct_from_410_of_706": a["loss_arith"],
            "pure_water_supplied_mcm": F["pure_water_mcm"],
            "pure_water_supplied_mld_over_365_days": a["mld_2324_365"],
            "pure_water_supplied_mld_over_366_days": a["mld_2324"],
            "monthly_pure_water_mm3": [
                {"month": m, "mm3": v} for m, v in MONTHLY_2023_24
            ],
            "unbilled_mld": F["supplied_mld"] - F["billed_mld"],
            "_source_ref": f"{esr}, s.6.2.1 and Table 6.2, printed p.133",
            "_quote": (
                "Of the 706 MLD water supplied to the city, 41.91% loss of water occurred during the "
                "transport and distribution of raw water from source to consumer ... the total volume of "
                "water which reached the consumers and was billed for the period Apr-2023-Mar 2024 was 410 "
                "MLD (pure water supply of 257.642 MCM)"
            ),
            "_note": (
                "257.642 Mcum is the supplied total (Table 6.2's monthly 'pure water supply' rows): "
                f"{a['mld_2324_365']:.0f} MLD over 365 days, {a['mld_2324']:.0f} over the 366 days of "
                "2023-24. The report's sentence pairs it with the billed 410 MLD; its table and the "
                "arithmetic make it the supplied total. 410 MLD billed is about 150 Mcum a year. NMC "
                "prints 41.91%; 410 of 706 gives 41.93%, the same to rounding."
            ),
        },
        "water_balance_2022_23": {
            "supplied_mld_stated": "680-700",
            "billed_mld": F["billed_mld_2223"],
            "loss_pct_stated": F["loss_pct_2223_stated"],
            "loss_pct_by_own_table": a["loss_2223"],
            "pure_water_supplied_mcm": F["pure_water_mcm_2223"],
            "monthly_pure_water_mm3": [
                {"month": m, "mm3": v} for m, v in MONTHLY_2022_23
            ],
            "_source_ref": "ESR 2022-23, printed pp.161-162 and Table 6.2",
            "_finding": (
                "EDITION FINDING. The 2022-23 text states a 47% loss. Its own Table 6.2 gives 250.679 Mcum "
                f"for the year ({a['mld_2223']} MLD over 365 days) against 377.454 MLD billed, a {a['loss_2223']}% "
                "loss. Both are carried as printed. Its twelve monthly rows add to "
                f"{ROWS_2022_23} Mcum against the printed total of {F['pure_water_mcm_2223']}."
            ),
        },
        "service_levels": {
            "tankers_nmc": [
                {
                    "when": "2016 (ESR) or 2018 (Budgets)",
                    "count": F["tankers_2018"],
                    "source": "ESR 2022-23 p.162 and ESR 2023-24 p.134 date it 2016; Budgets 2025-26 and 2026-27, p.B-4, date it 2018",
                },
                {
                    "when": "2023",
                    "count": F["tankers_2023"],
                    "source": "ESR 2022-23, pp.162-163",
                },
                {
                    "when": "2024",
                    "count": F["tankers_2024"],
                    "source": "ESR 2023-24, p.134",
                },
                {
                    "when": "early 2025",
                    "count": F["tankers_now_b2526"],
                    "source": "Budget 2025-26, p.B-4",
                },
                {
                    "when": "early 2026",
                    "count": F["tankers_now"],
                    "source": "Budget 2026-27, p.B-4 (scan, checked on the page image)",
                },
            ],
            "_tankers_note": (
                "NMC's own count of tankers serving areas without a network. The documents do not say whether "
                "it counts vehicles or daily deployments. Budget "
                "2025-26 names four zones as tanker-free: Dharampeth, Nehru Nagar, Hudkeshwar-Narsala and "
                "Mangalwari."
            ),
            "dark_zones": [
                {
                    "year": "2022-23",
                    "command_areas": 73,
                    "with_areas_under_2h": F["dark_zone_cas_2223"],
                    "source": "ESR 2022-23, p.163",
                },
                {
                    "year": "2023-24",
                    "command_areas": F["command_areas"],
                    "with_areas_under_2h": F["dark_zone_cas"],
                    "source": "ESR 2023-24, p.134",
                },
            ],
            "_dark_zones_note": (
                "The ESR's wording is 'certain areas under 36 CAs were still considered as dark zones since "
                "the water supply was found to be less than 2 h per day': some areas "
                "within those command areas, not the whole of each. The ESRs give no citywide hours of supply. "
                "ESR 2019-20 (p.31) counted 21 of 68 command areas on 24x7 supply."
            ),
            "point_of_use_samples_2023_24": {
                "tested": F["samples"],
                "fit": F["samples_fit"],
                "unfit": F["samples_unfit"],
                "fit_pct": F["samples_fit_pct"],
                "laboratory": "Regional Public Health Laboratory, Nagpur",
                "_source_ref": f"{esr}, p.134",
            },
            "raw_water_losses_upstream_of_plants": {
                "canal_seepage_pct": "20-25",
                "pipeline_leakage_mld": "30-40",
                "_source_refs": [
                    "ESR 2017-18 draft p.22: seepage of 20-25% over 48.50 km of canal (water audit and leak detection study)",
                    "ESR 2019-20 p.31: NMC's Action Taken Report of June 2019 puts leakage on the Navegaon Khairi-Mahadula raw-water pipeline at 30-40 MLD a day",
                ],
                "_note": "These losses sit before the treatment plants; the 41.91% runs from source to consumer.",
            },
        },
        "network_series": [
            {
                "year": "2017-18",
                "network_km": F["network_km_1718"],
                "command_areas": 68,
                "source": "ESR 2017-18 draft p.23 ('appx 2100 km'); 68 command areas also in ESR 2019-20",
            },
            {
                "year": "2022-23 and 2023-24",
                "command_areas": 73,
                "source": "ESR 2022-23 p.161; ESR 2023-24 p.133",
            },
            {
                "year": "2026",
                "network_km": F["network_km"],
                "water_tanks": F["water_tanks"],
                "connections_lakh": F["connections_lakh"],
                "source": "Budget 2026-27 p.B-3",
            },
        ],
        "water_revenue_inr_crore": [
            {
                "year": "2024-25",
                "budgeted": 250.00,
                "received": 195.00,
                "received_as_of": "to date, Budget 2025-26 (April 2025)",
                "source": "Budget 2025-26, p.B-4",
            },
            {
                "year": "2025-26",
                "budgeted": F["revenue_budget_2025_26_cr"],
                "received": F["revenue_received_2025_26_cr"],
                "received_as_of": "'January 2027' as printed [sic]; the speech prints no date (published May 2026, latest internal date late February 2026)",
                "source": "Budget 2026-27, p.B-3",
            },
            {
                "year": "2026-27",
                "budgeted": F["revenue_proposed_2026_27_cr"],
                "received": None,
                "source": "Budget 2026-27, p.B-4",
            },
        ],
        "_edition_findings": [
            "Treatment plants: 760 MLD across six (2017-18 draft) against 786 across five (2022-23, 2023-24); Pench II 133 to 175 MLD, Old Gorewada's 16 MLD no longer listed.",
            f"Loss: 47% stated in the 2022-23 text against {a['loss_2223']}% from its own table; 2023-24 prints 41.91%, and 410 of 706 gives 41.93%.",
            "Supply volume: 700-760 MLD (ESR 2019-20 p.28), 680-700 MLD (ESR 2022-23), 706 MLD (ESR 2023-24).",
            "Tankers: the 346 baseline is dated 2016 by the ESRs and 2018 by the budgets.",
            "Network: about 2,100 km (ESR 2017-18 draft) against 4,650 km (Budget 2026-27); 68 command areas (2017-18, 2019-20) against 73 (2022-23, 2023-24) and 106 water tanks (Budget 2026-27).",
            "Budget 2026-27 reports water revenue received 'to January 2027' in a speech that prints no date (published May 2026; its latest internal date is late February 2026), read here as a misprint for January 2026.",
            "Conveyance: 48.50 km of canal (ESR 2017-18 p.22) against 48.4 km (NMC to MWRRA, Order 13/2018 para 32(v)); NMC says a closed pipeline has carried the water since April 2015 (same paragraph).",
        ],
        "_sources": [
            {
                "name": "NMC Budget 2026-27, Commissioner's speech, pp.B-3 to B-4 (Marathi, scan)",
                "url": BUDGET_2627,
                "date": "2026-05",
                "extracted": EXTRACTED,
            },
            {
                "name": "NMC Budget 2025-26, Commissioner's speech, p.B-4 (Marathi)",
                "url": BUDGET_2526,
                "date": "2025-04",
                "extracted": EXTRACTED,
            },
            {
                "name": "NMC Environment Status Report 2023-24 (CSIR-NEERI)",
                "url": ESR_2324,
                "date": "2025-08",
                "extracted": EXTRACTED,
            },
            {
                "name": "NMC Environment Status Report 2022-23 (CSIR-NEERI)",
                "url": ESR_2223,
                "date": "2025-08",
                "extracted": EXTRACTED,
            },
            {
                "name": "NMC Environment Status Report 2019-20 (Wayback copy)",
                "url": ESR_1920,
                "date": "2020-12",
                "extracted": EXTRACTED,
            },
            {
                "name": "NMC / CSIR-NEERI draft Environmental Status Report 2017-18 (third-party mirror)",
                "url": ESR_1718,
                "date": "2018-06",
                "extracted": EXTRACTED,
            },
            {
                "name": "MWRRA Order No. 13/2018, Case No. 8 of 2017",
                "url": MWRRA_ORDER,
                "date": "2018-09-12",
                "extracted": EXTRACTED,
            },
        ],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--verify",
        type=Path,
        help="directory holding the text-layer PDFs (see module docstring)",
    )
    args = ap.parse_args()
    if args.verify and verify(args.verify):
        return 1
    out = build()
    write_artifact(OUT, out)
    print(
        f"nagpur supply: {out['wtps_summary']['total_installed_capacity_mld']} MLD -> {OUT.name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

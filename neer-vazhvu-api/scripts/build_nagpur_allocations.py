#!/usr/bin/env python3
"""
Nagpur's allocation ledger: what the paper gives NMC from each source, and what
NMC is published as having drawn.

Writes public/data/allocations-nagpur.json, read by /[cityId]/allocations
(allocations-client.tsx) and contracted by schemas/nvdm/allocations.schema.json.

THE INSTRUMENTS, all primary:

  WRD GR of 19 Mar 2020 (code 202003191442414827, official PDF, table on p.2 of 3):
      the Pench Project Complex re-planned. NMC 112 (sanctioned plan, 1972)
      -> 190 (phase 1) -> 341 Mcum/yr (phase 2, after the Lohghogari tunnel).
  MWRRA Order 13/2018, Case 8 of 2017 (12 Sep 2018, scanned: OCR, checked on
      the page image): the 1965 letter for 112 (NMC's account), the 78 of
      21 Mar 1998 (NMC, WRD and the Authority; the petition prints 31 Mar
      1998), ordered permanent in 2008 on conditions the order records as not
      yet met, continued as temporary in 2010, held "legal and intact" under
      s.31B;
      NMC's 2017-18 water budget and the CADA entitlement table of 10 Apr 2018.
  NMC/CSIR-NEERI ESR 2017-18 draft, Table 4.3 (third-party mirror, the only
      copy): reservation and billed drawal per source. This is the ONLY
      per-source "received" figure published. The table is headed "present"
      drawal and gives no year; it is read as 2017-18, the report's edition.
  WRD GRs of 18 Sep 2019 (Lohghogari, official PDF) and 18 Apr 2023 (Kolar-
      Kanhan barrage and Rohana; text via the orgpedia mahGRs mirror).

Futures link to the commitments register by id (agreed with that builder):
ngp-lohghogari-diversion, ngp-rohana-reduce-78, ngp-kolar-kanhan-barrage-dpr.

Two tables do not close and ship as printed with the gap asserted: ESR
2017-18 Table 4.3's drawal rows add to 193.60 Mm3 against a printed 217.60,
and MWRRA para 50(v) gives NMC's 2017-18 quota as 139.03 Mcum while its two
parts add to 139.06.

Run:  ~/.pyenv/versions/neer-vazhvu-api/bin/python neer-vazhvu-api/scripts/build_nagpur_allocations.py
"""

import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

OUT = REPO_ROOT / "public" / "data" / "allocations-nagpur.json"
UPDATED = "2026-10-15"  # the day every figure below was re-read

GR = "https://gr.maharashtra.gov.in/Site/Upload/Government%20Resolutions/Marathi/{}.pdf"
# The 2023 GR's official path answered 404 again on 15 Oct 2026 (Marathi and English).
GR_MIRROR = "https://github.com/orgpedia/mahGRs/blob/main/GRs/Water_Resources_Department/{}.pdf.mr.txt"
GR_2020, GR_2019, GR_2023 = (
    "202003191442414827",
    "201909181817460527",
    "202304201803571027",
)
MWRRA_ORDER = "https://mwrra.maharashtra.gov.in/wp-content/uploads/2022/08/Case-No-8-of-2017-Final-Order.pdf"
ESR_1718 = "https://caknnagpur871784109.wordpress.com/wp-content/uploads/2019/12/environmental-status-report-nagpur-2017-18.pdf"
ESR_2324 = "https://nmcnagpur.gov.in/assets/300/2025/08/Public-Notices/ESR_Final_Report_2023-2024.pdf"

# WRD GR 19 Mar 2020, p.2: use (Mcum/yr) in the sanctioned plan, phase 1, phase 2.
REPLAN = {
    "irrigation": (689, 584, 685),
    "nmc": (112, 190, 341),
    "koradi_tps": (67, 10, 10),
    "khaperkheda_tps": (60, 10, 10),
    "fisheries": (2, 2, 2),
    "sunflag_bhandara": (2, 0, 0),
    "other_non_irrigation": (0, 5, 5),
    "evaporation": (33, 101, 132),
    "satrapur_lift": (0, 15, 15),
    "pench_high_level_right_canal": (0, 5, 5),
}
REPLAN_TOTALS = (965, 922, 1205)

# ESR 2017-18 draft, Table 4.3, printed p.23: reservation Mm3/yr, MLD;
# billed drawal Mm3/yr, MLD. The two Pench reservation rows share one drawal
# cell (PRBC at Mahadula).
TABLE_4_3 = {
    "kanhan": (55.00, 150.70, 43.80, 120.00),
    "pench_112": (112.00, 306.88, None, None),
    "pench_78": (78.00, 213.72, None, None),
    "pench_combined": (None, None, 143.00, 400.00),
    "gorewada": (5.80, 16.00, 6.80, 20.00),
}
TABLE_4_3_PRINTED = (250.80, 687.30, 217.60, 540.00)
# ESR 2017-18 draft, Table 4.4 "Present Treated Water Supply", printed p.23:
# capacity MLD, treated MLD (the same rows as WTPS_2017_18 in build_nagpur_supply.py).
TABLE_4_4 = {
    "kanhan": (240, 185),
    "pench_i": (136, 148),
    "pench_ii": (133, 122),
    "pench_iii": (120, 100),
    "pench_iv": (115, 86),
    "old_gorewada": (16, 16),
}
TABLE_4_4_PRINTED = (760, 657)

# MWRRA Order 13/2018 (page numbers are the order's own "Page n of 50").
PENCH_EXTRA_MCM = 78  # paras 32(i), 34(iii)
NMC_SAYS_PENCH, NMC_SAYS_KANHAN, NMC_SAYS_TOTAL = 190, 60, 250  # para 19(ii), p.6
BUDGET_2017_18 = {"pench": 197.33, "kanhan": 58, "gorewada": 5.84}  # para 37, pp.27-28
WELLS_2017_18 = {
    "public_borewells": 5.44,
    "public_open_wells": 2.22,
    "private_open_wells": 4.56,
}
QUOTA_2017_18 = {
    "printed": 139.03,
    "domestic": 118.05,
    "industrial": 21.01,
}  # para 50(v), p.42
# CADA letter 10 Apr 2018, para 38, p.28: the "Entitlement" column; the quota
# above is the "Allocation as per MWRRA Norm" column of the same table.
ENTITLEMENT_2017_18 = {"domestic": 125.97, "industrial": 22.93}
KHAPERKHEDA_2017_18 = {"entitlement": 70.15, "quota": 64.27}
STORAGE_OCT_2017_PCT = 43  # para 19(iii), p.6

# WRD GR 18 Apr 2023 (mirror text): Kolar-Kanhan barrage and Rohana, Mcum/yr.
BARRAGE = {"storage": 67.88, "kanhan_now": 65.71, "future": 44.934, "rohana": 68.957}


def mcum(mld: float) -> float:
    """MLD over a 365-day year, in Mcum."""
    return mld * 365 / 1000


def checks() -> dict:
    """Fail the build if a transcription stops summing; return the arithmetic."""
    cols = [sum(v[i] for v in REPLAN.values()) for i in range(3)]
    res_mm3 = round(sum(r[0] for r in TABLE_4_3.values() if r[0] is not None), 2)
    res_mld = round(sum(r[1] for r in TABLE_4_3.values() if r[1] is not None), 2)
    drawl_mm3 = round(sum(r[2] for r in TABLE_4_3.values() if r[2] is not None), 2)
    drawl_mld = round(sum(r[3] for r in TABLE_4_3.values() if r[3] is not None), 2)
    quota_parts = round(QUOTA_2017_18["domestic"] + QUOTA_2017_18["industrial"], 2)
    wells = round(
        WELLS_2017_18["public_borewells"] + WELLS_2017_18["public_open_wells"], 2
    )
    entitlement = round(sum(ENTITLEMENT_2017_18.values()), 2)
    pench_treated = sum(v[1] for k, v in TABLE_4_4.items() if k.startswith("pench"))
    for label, got, want, tol in [
        ("GR 2020 plan column", cols[0], REPLAN_TOTALS[0], 0),
        ("GR 2020 phase 1 column", cols[1], REPLAN_TOTALS[1], 0),
        ("GR 2020 phase 2 column", cols[2], REPLAN_TOTALS[2], 0),
        ("112 + 78 = phase 1", REPLAN["nmc"][0] + PENCH_EXTRA_MCM, REPLAN["nmc"][1], 0),
        ("NMC's own 190 + 60", NMC_SAYS_PENCH + NMC_SAYS_KANHAN, NMC_SAYS_TOTAL, 0),
        ("Table 4.3 reservation Mm3", res_mm3, TABLE_4_3_PRINTED[0], 0.005),
        ("Table 4.3 reservation MLD", res_mld, TABLE_4_3_PRINTED[1], 0.005),
        ("Table 4.3 drawal MLD", drawl_mld, TABLE_4_3_PRINTED[3], 0.005),
        (
            "Table 4.4 capacity",
            sum(v[0] for v in TABLE_4_4.values()),
            TABLE_4_4_PRINTED[0],
            0,
        ),
        (
            "Table 4.4 treated",
            sum(v[1] for v in TABLE_4_4.values()),
            TABLE_4_4_PRINTED[1],
            0,
        ),
        ("Table 4.4 four Pench plants treated", pench_treated, 456, 0),
        # The Mm3 drawal column does NOT close: rows 193.60, printed 217.60.
        ("Table 4.3 drawal Mm3 rows", drawl_mm3, 193.60, 0.005),
        (
            "Table 4.3 printed minus rows",
            round(TABLE_4_3_PRINTED[2] - drawl_mm3, 2),
            24.00,
            0.005,
        ),
        # Para 50(v): printed 139.03, parts 139.06.
        ("quota parts", quota_parts, 139.06, 0.005),
        (
            "quota parts minus printed",
            round(quota_parts - QUOTA_2017_18["printed"], 2),
            0.03,
            0.005,
        ),
        ("CADA entitlement parts", entitlement, 148.90, 0.005),
        (
            "barrage: Kanhan now + future",
            round(BARRAGE["kanhan_now"] + BARRAGE["future"], 3),
            110.644,
            0.0005,
        ),
    ]:
        if abs(got - want) > tol:
            raise SystemExit(f"  ! {label}: rows give {got}, source states {want}")
    return {
        "drawl_mm3": drawl_mm3,
        "quota_parts": quota_parts,
        "wells": wells,
        "entitlement": entitlement,
        "pench_treated": pench_treated,
    }


def build() -> dict:
    a = checks()
    plan, p1, p2 = REPLAN["nmc"]
    tps_plan = REPLAN["koradi_tps"][0] + REPLAN["khaperkheda_tps"][0]
    tps_p1 = REPLAN["koradi_tps"][1] + REPLAN["khaperkheda_tps"][1]
    kanhan_res, _, kanhan_drawn, kanhan_mld = TABLE_4_3["kanhan"]
    gw_res, _, gw_drawn, gw_mld = TABLE_4_3["gorewada"]
    pench_drawn, pench_mld = TABLE_4_3["pench_combined"][2:]
    q = QUOTA_2017_18
    unit = "Mcum/yr"
    order = "MWRRA Order 13/2018"
    t43 = "ESR 2017-18 draft, Table 4.3"
    pench_ids = ["mahagr-wrd-resolutions", "mwrra-case-8-2017", "nmc-esr"]
    return {
        "nvdm": "1.0",
        "dataset": "data-root/allocations",
        "scope": {"kind": "city", "id": "nagpur"},
        "provenance": {
            "sources": [
                {
                    "id": "mahagr-wrd-resolutions",
                    "title": (
                        "Water Resources Department GRs: Pench water-use re-planning, 19 Mar 2020 "
                        f"({GR_2020}); Lohghogari-Totladoh diversion, 18 Sep 2019 ({GR_2019}); Kolar-Kanhan "
                        f"barrage, 18 Apr 2023 ({GR_2023}, text via the orgpedia mahGRs mirror)"
                    ),
                    "publisher": "Water Resources Department, Government of Maharashtra",
                    "license": registry_license("mahagr-wrd-resolutions"),
                    "retrieved": UPDATED,
                },
                {
                    "id": "mwrra-case-8-2017",
                    "title": "MWRRA Order No. 13/2018 in Case No. 8 of 2017, 12 Sep 2018",
                    "publisher": "Maharashtra Water Resources Regulatory Authority",
                    "license": registry_license("mwrra-case-8-2017"),
                    "retrieved": UPDATED,
                },
                {
                    "id": "nmc-esr",
                    "title": "NMC Environment Status Reports: 2017-18 draft (Tables 4.3-4.4, pp.18-23) and 2023-24 (Table 6.2)",
                    "publisher": "Nagpur Municipal Corporation, prepared by CSIR-NEERI",
                    "license": registry_license("nmc-esr"),
                    "retrieved": UPDATED,
                },
            ],
            "method": "pdf-extract",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_nagpur_allocations.py",
            "note": (
                "Claim register: per-arrangement citations are in each row's source_ids and the file's "
                "sources map. The MWRRA order is a scan: OCR, checked on the page image (pp.5-6, 22-29, 39, "
                "42, 48-49). The 2020 and 2019 GRs were read in the official PDFs; the 2023 GR's text is the "
                "orgpedia mahGRs extraction of the official PDF, which did not open on 15 Oct 2026."
            ),
        },
        "place_id": "nagpur",
        "updated": UPDATED,
        "headline": (
            f"Nagpur's Pench share is {p1} Mcum a year; the latest published figures for its draw, in NMC's "
            "2017-18 report, disagree"
        ),
        "intro": (
            "Four of Nagpur's five treatment plants run on water from the Pench Project Complex, which the "
            "state runs for irrigation and hydro-power and shares with two thermal power stations. The "
            f"city's share has grown in steps: {plan} Mcum a year in the project plan and {PENCH_EXTRA_MCM} "
            f"more sanctioned in 1998, set at {p1} in the Water Resources Department's resolution of "
            f"19 March 2020, with {p2} planned once a tunnel brings Kanhan water from Madhya Pradesh. The "
            f"state water regulator ruled in 2018 that the extra {PENCH_EXTRA_MCM} stands in law. The most "
            "recent published figure for what the city draws from each source is in NMC's draft 2017-18 "
            "report (its table is headed 'present' and gives no year); the regulator's order records that "
            "the 2017 monsoon was lean. For the Pench, the Kanhan and Gorewada alike that report's billed and "
            "treated figures disagree, so no delivery figure is shown for any of them; each row's note gives both."
        ),
        "unit_note": (
            "Volumes are in million cubic metres a year (Mcum/yr), the unit of the regulator's order and "
            "the state's resolutions; 1 Mcum a year is about 2.74 million litres a day. The dashboard's "
            "treatment figures are in MLD. Units are never converted silently."
        ),
        "authorities": [
            {
                "id": "wrd-maharashtra",
                "name": "Water Resources Department, Government of Maharashtra",
                "role": (
                    "Runs the Pench Project Complex (Totladoh, Navegaon Khairi and Khindsi) and its canals "
                    "through the Pench Irrigation Management Project, reserves water for non-irrigation "
                    "users and bills NMC for raw water."
                ),
                "capacity": f"Planned use {REPLAN_TOTALS[0]} Mcum a year (1972); re-planned to {REPLAN_TOTALS[1]} (phase 1) and {REPLAN_TOTALS[2]:,} (phase 2) in 2020",
                "committed": f"Phase 1: NMC {p1}, irrigation {REPLAN['irrigation'][1]}, the two thermal stations {tps_p1} Mcum a year",
                "tension": (
                    "The 2020 re-planning rests on less water than the project was designed for: a "
                    "75%-dependable yield at Totladoh of 1,157.80 Mcum on 1976-2016 data against 1,760.90 in "
                    "the plan, reservoir evaporation of 132 Mcum against 33 planned, and Madhya Pradesh's "
                    "Chaurai dam (577 Mcum) storing upstream since 2016. The city's share rose from "
                    f"{plan} to {p1} as the thermal stations' fell from {tps_plan} to {tps_p1}. The GR is "
                    "subject to the final decision of a joint committee of the Central Water Commission, "
                    "Maharashtra and Madhya Pradesh on the project's yield."
                ),
                "source_refs": ["wrd-gr-2020"],
            }
        ],
        "arrangements": [
            {
                "id": "pench-nmc",
                "as_of": "2020-03-19",
                "source": "Pench Project Complex (Totladoh and Navegaon Khairi)",
                "authority_id": "wrd-maharashtra",
                "recipient": "Nagpur Municipal Corporation",
                "entitled": {
                    "value": p1,
                    "unit": unit,
                    "basis": f"{p1} in the WRD re-planning GR of 19 Mar 2020 (phase 1), equal to the {plan} of the plan plus the {PENCH_EXTRA_MCM} of 1998",
                    "note": (
                        f"The regulator's order of 12 Sep 2018 holds the {PENCH_EXTRA_MCM} 'legal and intact as "
                        "on today' under section 31B of the MWRRA Act, and records that the conditions attached "
                        "in 2008 (an agreement within 90 days, and Rs 8,445 lakh to WRD for 8,445 ha of "
                        f"irrigation command) are 'yet to be satisfied' ({order}, pp.25, 39)."
                    ),
                },
                "received": {
                    "value": None,
                    "unit": unit,
                    "year": None,
                    "note": (
                        "No delivery figure is shown because the two 2017-18 figures disagree. NMC's table bills "
                        f"{pench_drawn:.2f} Mcum of raw water for the Pench Right Bank Canal draw at Mahadula, "
                        f"covering both reservations, {TABLE_4_3['pench_112'][0]:.0f} and "
                        f"{TABLE_4_3['pench_78'][0]:.0f} ({pench_mld:.0f} MLD; {t43}, p.23), while the four "
                        f"Pench plants treated {a['pench_treated']} MLD that year, about "
                        f"{mcum(a['pench_treated']):.0f} Mcum over a year (Table 4.4, p.23), more than the bill. "
                        f"Both are below the {p1} entitlement; the year's quota, {q['printed']} Mcum, was "
                        "less than the bill. NMC's table does not close: its drawal rows add "
                        f"to {a['drawl_mm3']:.2f} Mcum against a printed total of {TABLE_4_3_PRINTED[2]:.2f}, and "
                        f"{pench_drawn:.2f} Mcum is printed beside {pench_mld:.0f} MLD "
                        f"({pench_mld * 365 / 1000:.0f} Mcum over a year); the asterisk on {pench_drawn:.2f} has "
                        "no footnote. The table is headed 'present' drawal and gives no year; it is read here as "
                        "2017-18, the report's edition (draft of June 2018). The regulator's order records that "
                        f"the 2017 monsoon was lean: storage in the complex stood at {STORAGE_OCT_2017_PCT}% in "
                        "October 2017 (p.6). The quota the CADA Superintending Engineer set for NMC for 2017-18 "
                        f"on 10 Apr 2018 was {q['printed']} Mcum, printed as {q['domestic']} domestic and "
                        f"{q['industrial']} industrial, which add to {a['quota_parts']} (the 'Allocation as per "
                        f"MWRRA Norm' column); the same table's entitlement column gives NMC {a['entitlement']:.2f} "
                        f"({ENTITLEMENT_2017_18['domestic']} + {ENTITLEMENT_2017_18['industrial']}) ({order}, "
                        "pp.28, 42). No later per-source figure is published."
                    ),
                },
                "instrument": {
                    "label": f"WRD GR of 19 Mar 2020 (Pench water-use re-planning) and {order}",
                    "url": GR.format(GR_2020),
                },
                "confidence": "high",
                "note": (
                    f"NMC's own account to the regulator in October 2017: Pench {NMC_SAYS_PENCH} + Kanhan "
                    f"{NMC_SAYS_KANHAN} = {NMC_SAYS_TOTAL} Mcum a year (p.6). Its 2017-18 water budget asked "
                    f"for {BUDGET_2017_18['pench']} Mcum from the Pench complex (p.27)."
                ),
                "source_ids": pench_ids,
            },
            {
                "id": "kanhan-nmc",
                "as_of": "2018-06",
                "source": "Kanhan river (Kanhan Water Works intake)",
                "authority_id": "wrd-maharashtra",
                "recipient": "Nagpur Municipal Corporation",
                "entitled": {
                    "value": kanhan_res,
                    "unit": unit,
                    "basis": f"annual reservation in NMC's table ({t43})",
                    "note": (
                        f"Three other figures for the same source: NMC told the regulator {NMC_SAYS_KANHAN} Mcum "
                        f"in October 2017 ({order}, p.6); its 2017-18 water budget counted "
                        f"{BUDGET_2017_18['kanhan']} (p.28); and WRD's GR of 18 Apr 2023 puts the Kanhan Water "
                        f"Works at {BARRAGE['kanhan_now']} Mcum at present. No reservation order for the Kanhan "
                        "was found."
                    ),
                },
                "received": {
                    "value": None,
                    "unit": unit,
                    "year": None,
                    "note": (
                        f"No delivery figure is shown because the two 2017-18 figures disagree. NMC's table bills "
                        f"{kanhan_drawn:.2f} Mcum of raw water ({kanhan_mld:.0f} MLD; {t43}), while the Kanhan "
                        f"plant treated {TABLE_4_4['kanhan'][1]} MLD that year (Table 4.4), about "
                        f"{mcum(TABLE_4_4['kanhan'][1]):.1f} Mcum over a year, more than both the bill and the "
                        f"{kanhan_res:.2f} reservation."
                    ),
                },
                "instrument": {
                    "label": f"NMC raw-water reservation table, {t43}",
                    "url": ESR_1718,
                },
                "confidence": "medium",
                "note": "Run-of-river: the 1956 barrage holds 7.82 Mm3 (ESR 2017-18 draft, p.19).",
                "source_ids": [
                    "nmc-esr",
                    "mwrra-case-8-2017",
                    "mahagr-wrd-resolutions",
                ],
            },
            {
                "id": "gorewada-nmc",
                "as_of": "2018-06",
                "source": "Gorewada lake (1911 bund on the Pili)",
                "authority_id": "wrd-maharashtra",
                "recipient": "Nagpur Municipal Corporation",
                "entitled": {
                    "value": gw_res,
                    "unit": unit,
                    "basis": f"annual reservation in NMC's table ({t43})",
                    "note": f"NMC's 2017-18 water budget counted {BUDGET_2017_18['gorewada']} Mcum from the lake ({order}, p.28).",
                },
                "received": {
                    "value": None,
                    "unit": unit,
                    "year": None,
                    "note": (
                        f"No delivery figure is shown because the two 2017-18 figures disagree. NMC's table bills "
                        f"{gw_drawn:.2f} Mcum ({gw_mld:.0f} MLD; {t43}), while the Old Gorewada plant is listed "
                        f"at {TABLE_4_4['old_gorewada'][0]} MLD capacity and {TABLE_4_4['old_gorewada'][1]} MLD "
                        "treated in the same report (Table 4.4). The plant is in the 2017-18 plant list and not "
                        "in the 2022-23 or 2023-24 lists."
                    ),
                },
                "instrument": {
                    "label": f"NMC raw-water reservation table, {t43}",
                    "url": ESR_1718,
                },
                "confidence": "medium",
                "source_ids": ["nmc-esr", "mwrra-case-8-2017"],
            },
            {
                "id": "nmc-public-wells",
                "as_of": "2017-10-12",
                "source": "NMC public borewells (4,967) and public open wells",
                "recipient": "Nagpur Municipal Corporation",
                "entitled": {
                    "value": None,
                    "unit": unit,
                    "basis": "NMC's own wells: no external quota",
                    "note": None,
                },
                "received": {
                    "value": a["wells"],
                    "unit": unit,
                    "year": "availability, NMC's 2017-18 water budget",
                    "note": (
                        f"{WELLS_2017_18['public_borewells']} Mcum from public borewells + "
                        f"{WELLS_2017_18['public_open_wells']} from public open wells, as counted in NMC's "
                        f"2017-18 water budget ({order}, p.28): an availability figure, not a meter reading. "
                        f"The same budget counted {WELLS_2017_18['private_open_wells']} Mcum from 25,000 "
                        "private open wells, which NMC does not run."
                    ),
                },
                "instrument": {
                    "label": f"NMC water budget 2017-18, as recorded in {order}",
                    "url": MWRRA_ORDER,
                },
                "confidence": "medium",
                "source_ids": ["mwrra-case-8-2017"],
            },
            {
                "id": "pench-thermal",
                "as_of": "2020-03-19",
                "source": "Pench Project Complex",
                "authority_id": "wrd-maharashtra",
                "recipient": "Koradi and Khaperkheda thermal power stations (MAHAGENCO)",
                "entitled": {
                    "value": tps_p1,
                    "unit": unit,
                    "basis": f"{REPLAN['koradi_tps'][1]} + {REPLAN['khaperkheda_tps'][1]} in the WRD re-planning GR of 19 Mar 2020 (phase 1); {REPLAN['koradi_tps'][0]} + {REPLAN['khaperkheda_tps'][0]} in the project plan",
                    "note": (
                        "The CADA letter of 10 Apr 2018 set Khaperkheda's 2017-18 industrial entitlement at "
                        f"{KHAPERKHEDA_2017_18['entitlement']} Mcum and its quota at "
                        f"{KHAPERKHEDA_2017_18['quota']} (the column that gives NMC {q['printed']}) ({order}, p.28)."
                    ),
                },
                "received": {
                    "value": None,
                    "unit": unit,
                    "year": None,
                    "note": "No draw figure for the thermal stations was found.",
                },
                "instrument": {
                    "label": "WRD GR of 19 Mar 2020 (Pench water-use re-planning)",
                    "url": GR.format(GR_2020),
                },
                "confidence": "high",
                "note": (
                    "The regulator directed CADA to review and reduce the thermal stations' entitlements in "
                    "phases, since treated sewage from NMC can meet these demands (direction 52(x), p.49). NMC "
                    "told the Authority in 2017 that it had handed a 130 MLD sewage treatment plant to MAHAGENCO "
                    f"({order}, p.9; para 32(vii))."
                ),
                "source_ids": ["mahagr-wrd-resolutions", "mwrra-case-8-2017"],
            },
        ],
        "events": [
            {
                "year": 1965,
                "title": f"{plan} Mcum for the city, by NMC's account of a 1965 letter",
                "note": (
                    f"NMC told the regulator that a State Government letter of 29 Mar 1965 approved a reservation "
                    f"of {plan} Mcum for the city ({order}, p.22). The Pench project's sanctioned plan, approved on "
                    f"21 Aug 1972, allots {REPLAN_TOTALS[0]} Mcum a year: {REPLAN['irrigation'][0]} to irrigation, "
                    f"{plan} to NMC, {REPLAN['koradi_tps'][0]} and {REPLAN['khaperkheda_tps'][0]} to the Koradi and "
                    f"Khaperkheda thermal stations, 2 to fisheries, 2 to industry and {REPLAN['evaporation'][0]} "
                    "to evaporation (WRD GR of 19 Mar 2020)."
                ),
                "source_refs": ["mwrra-order-2018", "wrd-gr-2020"],
            },
            {
                "year": 1982,
                "title": "The first Pench treatment plant",
                "note": (
                    "Pench I was commissioned in 1982, Pench II in 1984, Pench III in 2003 and Pench IV in "
                    "2018 (ESR 2017-18 draft, p.18). Navegaon Khairi dam was completed in 1976 and Totladoh in "
                    "1989 (WRD GR of 19 Mar 2020)."
                ),
                "source_refs": ["esr-2017-18", "wrd-gr-2020"],
            },
            {
                "year": 1998,
                "title": f"{PENCH_EXTRA_MCM} Mcum more, sanctioned up to 2005",
                "note": (
                    "NMC, the Pench Project Officer and the regulator date the sanction 21 Mar 1998; the petition "
                    "prints 31 Mar 1998, and the petitioner's later submissions say 1997 and 1999. It was "
                    "temporary, up to 2005, on condition that NMC develop an independent source by then "
                    f"({order}, pp.5, 16, 20, 22, 25, 39)."
                ),
                "source_refs": ["mwrra-order-2018"],
            },
            {
                "year": 2008,
                "title": f"Orders to make the {PENCH_EXTRA_MCM} permanent, on conditions",
                "note": (
                    "A State Government order of 12 Feb 2008 and a Chief Engineer's order of 27 Dec 2008 "
                    "converted it to a permanent reservation on conditions: an agreement within 90 days, and "
                    f"Rs 8,445 lakh to WRD for 8,445 ha of irrigation command ({order}, p.25). The regulator "
                    "records that these conditions 'are yet to be satisfied' (p.39)."
                ),
                "source_refs": ["mwrra-order-2018"],
            },
            {
                "year": 2010,
                "title": "Continued until further orders",
                "note": (
                    "At a meeting on 25 Aug 2010 the Water Resources Minister ordered the temporary reservation "
                    f"of {PENCH_EXTRA_MCM} Mcum to continue until further orders. Section 31B of the MWRRA (Amendment and Continuance) "
                    f"Act 2011 protects allocations made before 17 Sep 2010 ({order}, pp.26, 39)."
                ),
                "source_refs": ["mwrra-order-2018"],
            },
            {
                "year": 2011,
                "title": "A 50 Mcum agreement",
                "note": (
                    "An agreement for 50 Mcum of additional use was signed on 1 Jan 2011 and ran to "
                    f"31 Dec 2016; it was not renewed ({order}, p.26)."
                ),
                "source_refs": ["mwrra-order-2018"],
            },
            {
                "year": 2015,
                "title": "A closed pipeline replaces the canal",
                "note": (
                    "NMC told the regulator that a closed pipeline from Navegaon Khairi, built for Rs 250 crore, "
                    "came into use in April 2015. On the 48.4 km canal about 30% was lost, so 271 Mcum had to be "
                    f"released to deliver 190; NMC puts the saving at 81 Mcum ({order}, p.23)."
                ),
                "source_refs": ["mwrra-order-2018"],
            },
            {
                "year": 2016,
                "title": "Chaurai dam in Madhya Pradesh starts storing",
                "note": "Madhya Pradesh's Chaurai dam on the Pench (577 Mcum) has stored water since 2016 (WRD GR of 19 Mar 2020).",
                "source_refs": ["wrd-gr-2020"],
            },
            {
                "year": 2017,
                "title": "A petition to the state water regulator",
                "note": (
                    "Case No. 8 of 2017 asked MWRRA to provide water for irrigation by curtailing NMC's use of "
                    f"Pench water. Storage in the complex stood at {STORAGE_OCT_2017_PCT}% in October 2017 "
                    f"({order}, p.6)."
                ),
                "source_refs": ["mwrra-order-2018"],
            },
            {
                "year": 2018,
                "title": "The regulator's order",
                "note": (
                    f"{order} of 12 Sep 2018 holds the {PENCH_EXTRA_MCM} Mcum 'legal and intact as on today'. "
                    "It directs NMC to keep its water budget within the Authority's norm (135 litres a person "
                    "a day plus 15% losses); directs NMC and the Water Resources Department to develop "
                    "alternative sources for the city in a time-bound manner; directs NMC to run a time-bound "
                    "programme to cut distribution losses, with annual reports to the Authority that are also to be "
                    "made public; and it directs CADA to review the thermal stations' entitlements "
                    "(directions 52(i), (ii), (iv), (vii), (x), pp.48-49)."
                ),
                "source_refs": ["mwrra-order-2018"],
            },
            {
                "year": 2019,
                "title": "Lohghogari diversion approved in principle",
                "note": (
                    "WRD's GR of 18 Sep 2019 gives in-principle approval, at Rs 3,612 crore in two phases, for a "
                    "62 km tunnel to divert 10 TMC from the Kanhan near Lohghogari in Madhya Pradesh into "
                    "Totladoh. Phase 1 (Rs 17.55 crore) covers approvals only."
                ),
                "source_refs": ["wrd-gr-2019"],
            },
            {
                "year": 2020,
                "title": "Pench water use re-planned",
                "note": (
                    f"WRD's GR of 19 Mar 2020 re-plans the complex in two phases: NMC {p1} Mcum a year once the "
                    f"command's lift-irrigation schemes run, and {p2} once the Lohghogari tunnel also runs; the "
                    f"thermal stations fall to {REPLAN['koradi_tps'][1]} each. The GR is subject to the final "
                    "decision of the joint committee on the project's yield."
                ),
                "source_refs": ["wrd-gr-2020"],
            },
            {
                "year": 2023,
                "title": "Kolar-Kanhan barrage and the Rohana scheme",
                "note": (
                    "WRD's GR of 18 Apr 2023 approves survey and project-report work for a Kolar-Kanhan barrage "
                    f"at Kamptee ({BARRAGE['storage']} Mcum storage) and records a Rohana scheme of "
                    f"{BARRAGE['rohana']} Mcum (read as a year's use; the GR states no period) into the "
                    "Pench-Gorewada main, planned to reduce the "
                    f"{PENCH_EXTRA_MCM} Mcum Pench lift that the GR describes as temporarily sanctioned."
                ),
                "source_refs": ["wrd-gr-2023"],
            },
        ],
        "futures": [
            {
                "id": "lohghogari-341",
                "project": "Lohghogari tunnel and Pench phase 2",
                "mld": None,
                "earmarked_for": [
                    "Nagpur Municipal Corporation",
                    "Pench command irrigation",
                ],
                "status": (
                    f"Under the 2020 re-planning NMC's Pench share rises to {p2} Mcum a year ({p1} in phase 1) "
                    "once the lift-irrigation schemes and the Lohghogari tunnel run; irrigation rises to "
                    f"{REPLAN['irrigation'][2]}. The tunnel (10 TMC from the Kanhan in Madhya Pradesh, 62 km) "
                    "has in-principle approval at Rs 3,612 crore (GR of 18 Sep 2019). No later primary document "
                    "on its progress was found."
                ),
                "source_refs": ["wrd-gr-2020", "wrd-gr-2019"],
                "commitment_id": "ngp-lohghogari-diversion",
            },
            {
                "id": "rohana-scheme",
                "project": "Rohana scheme into the Pench-Gorewada main",
                "mld": None,
                "earmarked_for": ["Nagpur Municipal Corporation"],
                "status": (
                    f"{BARRAGE['rohana']} Mcum (read as a year's use; the GR states no period), planned to "
                    f"reduce the {PENCH_EXTRA_MCM} Mcum Pench lift "
                    "(WRD GR of 18 Apr 2023). No construction sanction was found."
                ),
                "source_refs": ["wrd-gr-2023"],
                "commitment_id": "ngp-rohana-reduce-78",
            },
            {
                "id": "kolar-kanhan-barrage",
                "project": "Kolar-Kanhan barrage, Kamptee",
                "mld": None,
                "earmarked_for": ["Nagpur Municipal Corporation (Kanhan Water Works)"],
                "status": (
                    f"A {BARRAGE['storage']} Mcum barrage to secure the Kanhan Water Works' "
                    f"{BARRAGE['kanhan_now']} Mcum and {BARRAGE['future']} Mcum of future demand (yearly "
                    "figures; the GR states no period). The 2023 GR approves survey and project-report work "
                    "only."
                ),
                "source_refs": ["wrd-gr-2023"],
                "commitment_id": "ngp-kolar-kanhan-barrage-dpr",
            },
        ],
        "gaps": [
            "What NMC draws from each source after 2017-18. NMC's latest water balance (ESR 2023-24, Table 6.2) gives only the citywide total of treated water: 257.642 Mcum in 2023-24.",
            "The annual loss-reduction reports the regulator directed NMC to make public in 2018 (Order 13/2018, direction 52(vii)) were not found online on 15 Oct 2026.",
            "The joint committee decision on the Pench yield (Central Water Commission, Maharashtra and Madhya Pradesh) that the 2020 re-planning is subject to was not found.",
            "No reservation order for the Kanhan source was found; the four Kanhan figures (55.00, 58 and 60 Mcum a year, and 65.71 Mcum in a 2023 GR that states no period) come from different documents on different bases.",
            "Draws by irrigation and by the thermal stations from the same complex, and the raw-water rate NMC pays WRD under MWRRA's bulk water tariff orders.",
        ],
        "sources": {
            "wrd-gr-2020": {
                "title": f"GR, Pench project water-use re-planning, 19 Mar 2020 (code {GR_2020}, Marathi; table on p.2)",
                "publisher": "Water Resources Department, Government of Maharashtra",
                "year": 2020,
                "url": GR.format(GR_2020),
            },
            "wrd-gr-2019": {
                "title": f"GR, Lohghogari-Totladoh diversion, in-principle approval, 18 Sep 2019 (code {GR_2019}, Marathi)",
                "publisher": "Water Resources Department, Government of Maharashtra",
                "year": 2019,
                "url": GR.format(GR_2019),
            },
            "wrd-gr-2023": {
                "title": (
                    f"GR, Kolar-Kanhan barrage survey and project report, 18 Apr 2023 (official code {GR_2023}, "
                    "Marathi). The official copy did not open on 15 Oct 2026; this link is the orgpedia mahGRs "
                    "archive's text of it"
                ),
                "publisher": "Water Resources Department, Government of Maharashtra",
                "year": 2023,
                "url": GR_MIRROR.format(GR_2023),
            },
            "mwrra-order-2018": {
                "title": "MWRRA Order No. 13/2018, Case No. 8 of 2017 (scanned)",
                "publisher": "Maharashtra Water Resources Regulatory Authority",
                "year": 2018,
                "url": MWRRA_ORDER,
            },
            "esr-2017-18": {
                "title": "NMC / CSIR-NEERI draft Environmental Status Report 2017-18, Tables 4.3-4.4 (third-party mirror, the only copy found)",
                "publisher": "Nagpur Municipal Corporation",
                "year": 2018,
                "url": ESR_1718,
            },
            "esr-2023-24": {
                "title": "NMC Environment Status Report 2023-24, Table 6.2",
                "publisher": "Nagpur Municipal Corporation",
                "year": 2025,
                "url": ESR_2324,
            },
        },
    }


def main() -> int:
    out = build()
    write_artifact(OUT, out)
    print(f"{out['headline']} -> {OUT.name}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Nagpur's dated water commitments, each with its source and dated status.

Every entry is a promise an institution made about Nagpur's water, sewage,
lakes or rivers, in its own instrument: a Government Resolution, a court or
tribunal order, an NMC budget or Environment Status Report, the AMRUT 2.0
portal, or a funder's project document. Every status change cites a dated
document. Figures were checked against the saved text on 2026-10-15; NMC's
2026-27 budget is a scanned Marathi PDF, read from its page images.

Statuses follow the shared legend literally:
  * a date that has passed with work described as under way is "overdue",
    even when an earlier revised date was given (AMRUT 2.0 water: May 2025,
    moved by NMC to May 2026, which has also passed);
  * a promise with no date and no status we can cite is "unverified";
  * "stalled" only where the institution's own document records that work
    stopped (Lendi lake: NMC's ESR 2023-24).

Five GRs answered 404 at gr.maharashtra.gov.in on 15 Oct 2026 (both folders).
Their text was read from the orgpedia mahGRs archive copy; the row cites the
official address and links the copy (MIRROR_CODES).

Left out on purpose: promises recorded only in the press (the Ambazari
"Rs 21.07 crore in four phases", Gandhisagar's Rs 49.82 crore, a Futala
"Rs 200 crore"); the 2010 Dharampeth pilot target (no start date and no zone
figures ever published); MPCB's consent validity for 12 STPs (a permit, not a
promise); and the Kanhan riverside towns' STPs (Kamptee, Kanhan-Pimpri,
Mouda: outside NMC). The 1998 "temporary" Pench allocation is an allocation
event, not a commitment: it lives on the allocation ledger.

Run:  ~/.pyenv/versions/neer-vazhvu-api/bin/python neer-vazhvu-api/scripts/build_nagpur_commitments.py
"""

import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

OUT = REPO_ROOT / "public" / "data" / "commitments-nagpur.json"

GR = "https://gr.maharashtra.gov.in/Site/Upload/Government%20Resolutions/Marathi/{}.pdf"
MIRROR = "https://github.com/orgpedia/mahGRs/blob/main/GRs/{}/{}.pdf.mr.txt"
UDD, WRD = "Urban_Development_Department", "Water_Resources_Department"
# Official PDF 404 on 15 Oct 2026; text read from the archive copy.
MIRROR_CODES = {
    "202211021115299425": UDD,  # Naik lake, AMRUT 2.0
    "202211021157345625": UDD,  # Lendi lake, AMRUT 2.0
    "202303061239587125": UDD,  # AMRUT 2.0 water distribution
    "202304061347581325": UDD,  # AMRUT 1.0 pipeline replacement
    "202304201803571027": WRD,  # Kolar-Kanhan barrage DPR, Rohana
}
MIRROR_NOTE = "official PDF did not open on 15 October 2026; text read from the orgpedia mahGRs archive copy"

NMC = "https://nmcnagpur.gov.in/assets/300/"
B2526 = NMC + "2025/06/mediafiles/Final_budget_2024-_2025-2026_(1).pdf"
B2627 = NMC + "2026/06/mediafiles/6a1d606eebca4_nmcbudget2026.pdf"
ESR2324 = NMC + "2025/08/Public-Notices/ESR_Final_Report_2023-2024.pdf"
ESR2223 = NMC + "2025/08/Public-Notices/ESR_final_Report_2022-2023.pdf"
ESR1920 = (
    "https://web.archive.org/web/20220806150918/https://www.nmcnagpur.gov.in/assets/250/2021/06/"
    "mediafiles/Final_2020_ESR_-_AK.pdf"
)
ESR1718 = (
    "https://caknnagpur871784109.wordpress.com/wp-content/uploads/2019/12/"
    "environmental-status-report-nagpur-2017-18.pdf"
)
AMRUT = (
    "https://amrut.mohua.gov.in/approvedProjects/list/TTN2eVhpdTRLYWVxbjFYdEllaWROQT09/"
    "UkJ0czN0UWJmNE9MemtZVEh0SC8rQT09"
)
PHE_DECK = "https://docs.google.com/presentation/d/1_1WsyYnmPgfk69zzPYR8EJRcW8vsGRhhT3OjjD32WCA/edit"
ICRIER = "https://icrier.org/Urbanisation/events/23-2-15/Nagpur%2024x7_23.02.15.pdf"
ADB = "https://www.adb.org/sites/default/files/project-documents//42907-01-ind-iee-draft.pdf"
NSSCDCL = "https://www.nsscdcl.org/Projects.jsp"
JICA_EXANTE = "https://www2.jica.go.jp/en/evaluation/pdf/2019_ID-P285_1_f.pdf"
JICA_LOAN = "https://www2.jica.go.jp/yen_loan/pdf/en/7078/20200330_31_en.pdf"
IK = "https://indiankanoon.org/doc/{}/"

L2526 = "NMC Budget 2025-26 (Marathi)"
L2627 = "NMC Budget 2026-27 (Marathi, scanned; read from the page images)"
LESR2324 = "NMC Environment Status Report 2023-24"
LHC56 = "Bombay High Court (Nagpur Bench), PIL 56/2023"
LNGT73 = "National Green Tribunal (Western Zone), OA 73/2025"

# Sep-2023 flood package (R&F GR 22 Feb 2024) and its releases, Rs crore.
FLOOD_WALLS, FLOOD_ROADS, FLOOD_TOTAL = 163.2331, 41.4831, 204.7162
FLOOD_RELEASES = {"2024-03-30": 14.5108, "2024-12-30": 72.12, "2026-03-31": 70.26}
# Nag project (GoI AA 14 Mar 2023 via GoM GR 3 Mar 2025), Rs crore.
NAG_CENTRE, NAG_STATE, NAG_NMC, NAG_TOTAL = 1115.22, 507.36, 304.41, 1926.99
NAG_CENTRE_RELEASED, NAG_STATE_SHARE = 167.44, 69.7607367


def gr_url(code: str) -> str:
    return GR.format(code)


def mirror_url(code: str) -> str:
    return MIRROR.format(MIRROR_CODES[code], code)


def gr_source(label: str, code: str, d: str) -> dict:
    """commitment_source for a GR. The page links `url`, so a GR whose official PDF
    did not open links the archive copy; its official address stays in official_url."""
    src = {"label": label, "url": gr_url(code), "date": d, "gr_code": code}
    if code in MIRROR_CODES:
        src["label"] = f"{label} (official code {code}; {MIRROR_NOTE})"
        src["url"] = mirror_url(code)
        src["official_url"] = gr_url(code)
        src["text_via_mirror"] = True
        src["mirror_url"] = mirror_url(code)
    return src


def h(d, status, note, label, url):
    return {
        "date": d,
        "status": status,
        "note": note,
        "source_label": label,
        "source_url": url,
    }


def mirror_h(d, status, note, label, code):
    """A history entry that links the archive copy of a GR whose PDF did not open."""
    return h(
        d,
        status,
        note,
        f"{label}, text in the orgpedia mahGRs archive copy",
        mirror_url(code),
    )


WATER = "Water supply"
SOURCES = "New water sources"
SEWAGE = "Sewage and the Nag"
LAKES = "Lakes"
AMBAZARI = "Ambazari and the 2023 flood"

COMMITMENTS = [
    # ── Water supply ──────────────────────────────────────────────────────
    {
        "id": "ngp-24x7-ppp-slb-targets",
        "category": WATER,
        "title": "Water round the clock across the city, with service targets at 5 and 10 years",
        "committed_by": (
            "Nagpur Municipal Corporation and Nagpur Environmental Services Ltd, with the operator "
            "Orange City Water, under the contract of 3 June 2011"
        ),
        "what": (
            "NMC's Superintending Engineer (Water Works) set out the contract's citywide targets in "
            "2015: within 5 years, 100% coverage, 24-hour supply, working meters on every connection, "
            "80% of complaints settled within 24 hours and 100% water quality; within 10 years, "
            "non-revenue water down from 60-70% to 20% (under 40% by year 5), 150 litres per person "
            "a day and 95% of charges collected. The slide gives years, not dates; counted from the "
            "contract of 3 June 2011 (its date in the High Court's record), the 10-year marks fell in "
            "2021."
        ),
        "due": "2021-06",
        "commitment_source": {
            "label": (
                "NMC Superintending Engineer (Water Works), '24X7 Water Initiative and Waste Water "
                "Reuse, Case Study Nagpur', ICRIER workshop, 23 February 2015, slide 14"
            ),
            "url": ICRIER,
            "date": "2015-02-23",
        },
        "status": "overdue",
        "status_history": [
            h(
                "2015-02-23",
                "on-track",
                "By December 2014, 434 of 564 km of pipeline had been replaced (75% physical "
                "progress) and about 75,000 of a targeted 3,21,000 connections made.",
                "NMC deck, ICRIER workshop, slide 17",
                ICRIER,
            ),
            h(
                "2020-12",
                "overdue",
                "'Till date only 21 command areas receive 24x7 water and the rest 47 command areas are "
                "not yet covered.'",
                "NMC Environment Status Report 2019-20, printed p.31 (archived copy)",
                ESR1920,
            ),
            h(
                "2024-03",
                "overdue",
                "In 2023-24, 41.91% of the 706 MLD supplied was lost between source and consumer "
                "(410 MLD billed), and parts of 36 of the 73 command areas were 'considered as dark "
                "zones since the water supply was found to be less than 2 h per day'.",
                f"{LESR2324}, printed pp.133-134",
                ESR2324,
            ),
            h(
                "2026-05-08",
                "overdue",
                "The contract is in arbitration over a rate rebasement the operator sought in "
                "February 2025. The High Court rejected NMC's application to replace the sole "
                "arbitrator appointed on 30 September 2025.",
                "Bombay High Court (Nagpur Bench), MCA (ARBN) 278/2026, 2026:BHC-NAG:7281",
                IK.format(171236121),
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ngp-nrw-billed-452",
        "category": WATER,
        "title": "Cut non-revenue water by 10% and raise billed water to 452 MLD",
        "committed_by": "Nagpur Municipal Corporation (Action Taken Report, June 2019)",
        "what": (
            "NMC's Action Taken Report of June 2019, as quoted in its Environment Status Report for "
            "2019-20: 'NMC has a target of reducing non-revenue water by 10% and increase the billed "
            "water to 452 MLD.' The same report records a loss of 30-40 MLD a day from the raw-water "
            "pipeline between Navegaon Khairi and Mahadula. No date was given for the target."
        ),
        "due": None,
        "commitment_source": {
            "label": "NMC Environment Status Report 2019-20, printed p.31 (archived copy)",
            "url": ESR1920,
            "date": "2020-12",
        },
        "status": "unverified",
        "status_history": [
            h(
                "2020-12",
                "unverified",
                "Target stated, with no date.",
                "NMC Environment Status Report 2019-20, printed p.31 (archived copy)",
                ESR1920,
            ),
            h(
                "2024-03",
                "unverified",
                "Billed water in 2023-24 was 410 MLD of 706 MLD supplied.",
                f"{LESR2324}, printed p.133, Table 6.2",
                ESR2324,
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ngp-amrut1-water",
        "category": WATER,
        "title": "AMRUT 1.0: new elevated tanks and 377 km of distribution pipeline",
        "committed_by": "Government of Maharashtra, Urban Development Department, for NMC (AMRUT 1.0)",
        "what": (
            "The revised sanction of 25 June 2018 (Rs 273.78 crore: Centre 91.25, State 45.64, NMC "
            "136.89) covers 58.719 km of feeder mains, 42 elevated tanks and 1 ground tank, and 377.84 "
            "km of distribution pipeline, to be finished within 24 months of the work order. A further "
            "sanction of 6 April 2023 added Rs 37.17 crore to replace old pipelines in the Binaki and "
            "Indora-II command areas. NMC's budgets count 32 elevated tanks under the scheme, against "
            "42 in the sanction; neither document explains the difference."
        ),
        "due": None,
        "commitment_source": gr_source(
            "Government of Maharashtra, Urban Development Department, GR AMRUT-2016/PK394(1)/NAVI-33, "
            "25 June 2018 (pages 2-3 headed AMRUT-2018/PK128/NAVI-33)",
            "201806251513514425",
            "2018-06-25",
        ),
        "status": "delivered",
        "status_history": [
            mirror_h(
                "2023-04-06",
                "unverified",
                "Rs 37.17 crore sanctioned to replace old pipelines in the Binaki (Rs 11.55 crore) and "
                "Indora-II (Rs 25.62 crore) command areas.",
                "GR AMRUT-2023/PK127/NAVI-33, 6 April 2023",
                "202304061347581325",
            ),
            h(
                "2024-03",
                "unverified",
                "377.5 km of pipeline completed under AMRUT 1.0.",
                f"{LESR2324}, printed p.134",
                ESR2324,
            ),
            h(
                "2025-04",
                "unverified",
                "27 of 32 elevated tanks and the 377 km of pipeline complete.",
                L2526,
                B2526,
            ),
            h(
                "2026-05",
                "delivered",
                "All 32 elevated tanks and the 377 km of pipeline complete.",
                f"{L2627}, printed p.B-4",
                B2627,
            ),
        ],
        "next_check": None,
        "revised_due": None,
    },
    {
        "id": "ngp-amrut2-water",
        "category": WATER,
        "title": "AMRUT 2.0: water pipelines for layouts and slums without them",
        "committed_by": "Government of Maharashtra, Urban Development Department, for NMC (AMRUT 2.0)",
        "what": (
            "Sanctioned on 6 March 2023 at Rs 381.85 crore (Centre 25%, State 25%, NMC 50%): "
            "distribution pipelines in authorised and unauthorised layouts and slums, feeder mains, "
            "a sump and booster pumps at Jaitala, to be finished within 24 months (24 months from "
            "the work order, whose date is not published; NMC's 2025-26 budget gave May 2025). The "
            "planned "
            "pipeline length has grown across NMC's documents, from 287 km (Environment Status "
            "Report 2023-24) to 324 km (Budget 2026-27). The AMRUT 2.0 portal lists the project at "
            "Rs 421.85 crore."
        ),
        "due": "2025-05",
        "commitment_source": gr_source(
            "Government of Maharashtra, Urban Development Department, GR AMRUT-2023/PK105/NAVI-33, "
            "6 March 2023",
            "202303061239587125",
            "2023-03-06",
        ),
        "status": "overdue",
        "status_history": [
            mirror_h(
                "2023-03-06",
                "on-track",
                "Sanctioned at Rs 381.85 crore, 24 months to complete.",
                "GR AMRUT-2023/PK105/NAVI-33, 6 March 2023",
                "202303061239587125",
            ),
            h(
                "2024-03",
                "on-track",
                "256 of 287 km of pipeline laid; work in progress.",
                f"{LESR2324}, printed p.134",
                ESR2324,
            ),
            h(
                "2025-04",
                "on-track",
                "Feeder mains 31 of 42 km and distribution pipelines 269 of 288 km laid; 84% physical "
                "and 52% financial progress; the remaining work by May 2025.",
                f"{L2526}, printed pp.B-4 to B-6",
                B2526,
            ),
            h(
                "2026-05",
                "slipped",
                "Feeder mains 36 of 42 km and distribution pipelines 299 of 324 km laid; 95% physical "
                "and 71% financial progress; the remaining work by May 2026.",
                f"{L2627}, printed p.B-4",
                B2627,
            ),
            h(
                "2026-10-15",
                "overdue",
                "The revised date of May 2026 has passed. The AMRUT 2.0 portal lists the project at Rs "
                "421.85 crore with the milestone 'Contract Awarded' (read on 15 October 2026; the "
                "portal gives no dates).",
                "MoHUA AMRUT 2.0 portal, Nagpur approved projects",
                AMRUT,
            ),
        ],
        "next_check": "2026-11-01",
        "revised_due": "2026-05",
    },
    {
        "id": "ngp-pench-iv",
        "category": WATER,
        "title": "Pench-IV: a further 115 MLD treatment plant at Godhani",
        "committed_by": "Nagpur Municipal Corporation (project described in a 2010 ADB draft environmental examination prepared by NMC)",
        "what": (
            "'NMC intends to augment Nagpur City water supply by 115 MLD by implementing Pench Phase "
            "III, Stage II (Pench-IV)': a 27.4 km pipeline from the Pench reservoir to Mahadula, a new "
            "treatment plant at Godhani and mains to the city."
        ),
        "due": None,
        "commitment_source": {
            "label": "Asian Development Bank, draft Initial Environmental Examination 42907-01, June 2010, printed p.1",
            "url": ADB,
            "date": "2010-06",
        },
        "status": "delivered",
        "status_history": [
            h(
                "2018-06",
                "delivered",
                "Pench-IV 'commissioned in 2018', then supplying 86 MLD of its 115 MLD.",
                "NMC Environment Status Report 2017-18 (draft), s.4.1; copy on a third-party site",
                ESR1718,
            ),
            h(
                "2024-03",
                "delivered",
                "Pench-IV's 115 MLD is one of five plants totalling 786 MLD.",
                f"{LESR2324}, printed pp.132-133",
                ESR2324,
            ),
        ],
        "next_check": None,
        "revised_due": None,
        "ledger_id": "pench-nmc",
    },
    # ── New water sources ─────────────────────────────────────────────────
    {
        "id": "ngp-lohghogari-diversion",
        "category": SOURCES,
        "title": "Bring 10 TMC from the Kanhan at Lohghogari into Totladoh by tunnel",
        "committed_by": "Government of Maharashtra, Water Resources Department",
        "what": (
            "In-principle approval to divert 10 TMC from the Kanhan near Lohghogari, in Chhindwara "
            "district of Madhya Pradesh, through a 62 km tunnel into Totladoh, to make up for the "
            "inflow the Pench has lost to Madhya Pradesh's Chaurai dam. Estimated at Rs 3,612 crore "
            "in two phases; phase 1 (Rs 17.55 crore) covers only the approvals, including Madhya "
            "Pradesh's consent, and phase 2 cannot start before them. A GR of the previous day asked "
            "the Finance Department to provide the funds within three years. The Water Resources "
            "Department's re-planning of Pench water (19 March 2020) raises NMC's share to 341 Mcum a "
            "year once the tunnel is built. No later Government document on the project was found."
        ),
        "due": None,
        "commitment_source": gr_source(
            "Government of Maharashtra, Water Resources Department, GR PRASHAMA-2019/PK357/MOPR-2, "
            "18 September 2019",
            "201909181817460527",
            "2019-09-18",
        ),
        "status": "unverified",
        "status_history": [
            h(
                "2019-09-17",
                "unverified",
                "The Finance Department to make the funds needed to complete the project available "
                "to the Urban Development Department within three years.",
                "GR Sankirna-2019/(PK 245/2019)/MOPR-2, 17 September 2019, clause 6",
                gr_url("201909171825128827"),
            ),
            h(
                "2020-03-19",
                "unverified",
                "The Pench re-planning GR sets NMC at 190 Mcum a year in phase 1 and 341 Mcum a year "
                "in phase 2, after the lift schemes and the Lohghogari tunnel.",
                "GR Sankirna-2020/(10/2020)/SV (Policy), 19 March 2020",
                gr_url("202003191442414827"),
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
        "ledger_id": "pench-nmc",
    },
    {
        "id": "ngp-kolar-kanhan-barrage-dpr",
        "category": SOURCES,
        "title": "Survey and project report for a barrage at the Kolar-Kanhan confluence",
        "committed_by": "Government of Maharashtra, Water Resources Department, with the Vidarbha Irrigation Development Corporation",
        "what": (
            "Approval of Rs 1.98 crore (Rs 1,97,67,544) for the remaining survey, design and "
            "detailed project report of a barrage near Kamptee with 67.88 Mcum of storage. The GR "
            "says the barrage would secure the 65.71 Mcum now supplied to NMC's Kanhan water works "
            "and a future demand of 44.934 Mcum. No date was set for the report."
        ),
        "due": None,
        "commitment_source": gr_source(
            "Government of Maharashtra, Water Resources Department, GR Sankirna-2018/(342/2018)/JaSaA, "
            "18 April 2023",
            "202304201803571027",
            "2023-04-18",
        ),
        "status": "unverified",
        "status_history": [
            mirror_h(
                "2023-04-18",
                "unverified",
                "Survey and project-report work approved; construction is not sanctioned.",
                "GR Sankirna-2018/(342/2018)/JaSaA, 18 April 2023",
                "202304201803571027",
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
        "ledger_id": "kanhan-nmc",
    },
    {
        "id": "ngp-rohana-reduce-78",
        "category": SOURCES,
        "title": "Rohana scheme: reduce the city's 78 Mcum lift from Pench",
        "committed_by": "Government of Maharashtra, Water Resources Department",
        "what": (
            "The same GR describes a Rohana water supply scheme putting 68.957 Mcum into the "
            "Pench-Gorewada pipeline, proposed to cut promptly the 78 Mcum lift from "
            "the Pench project that the GR describes as temporarily sanctioned. The GR gives no "
            "sanction or date for the Rohana scheme itself."
        ),
        "due": None,
        "commitment_source": gr_source(
            "Government of Maharashtra, Water Resources Department, GR Sankirna-2018/(342/2018)/JaSaA, "
            "18 April 2023",
            "202304201803571027",
            "2023-04-18",
        ),
        "status": "unverified",
        "status_history": [
            mirror_h(
                "2023-04-18",
                "unverified",
                "Scheme described in the GR's preamble; no sanction.",
                "GR Sankirna-2018/(342/2018)/JaSaA, 18 April 2023",
                "202304201803571027",
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
        "ledger_id": "pench-nmc",
    },
    # ── Sewage and the Nag ────────────────────────────────────────────────
    {
        "id": "ngp-nag-river-nrcp-jica",
        "category": SEWAGE,
        "title": "Nag River Pollution Abatement Project: sewers and three treatment plants for the Nag and Pili",
        "committed_by": (
            "Government of India (National River Conservation Directorate, Ministry of Jal Shakti) "
            "with a JICA loan; Government of Maharashtra; NMC as the implementing agency"
        ),
        "what": (
            "About 520 km of sewers, 92 MLD of new treatment capacity at three sites, rehabilitation "
            "of two 5 MLD plants and 7 new pumping stations for the Nag, the Pili and Bor nala, at Rs "
            "1,926.99 crore (Centre 1,115.22, State 507.36, NMC 304.41). The Government of India's "
            "sanction of 14 March 2023 allows 8 years, to March 2031; JICA's loan documents plan "
            "completion in July 2028, when all packages are in service. Both dates are shown."
        ),
        "due": "2031-03",
        "commitment_source": gr_source(
            "Government of Maharashtra, Environment and Climate Change Department, GR RANYO-2024/PK82, "
            "3 March 2025 (implementation order citing the Government of India's sanction of 14 March 2023)",
            "202503031716017604",
            "2025-03-03",
        ),
        "status": "on-track",
        "status_history": [
            h(
                "2020-03-27",
                "on-track",
                "Loan agreement signed: 29,082 million yen; completion planned for July 2028.",
                "JICA, loan announcement of 30 March 2020, item 7; ex-ante evaluation, s.3(5)",
                JICA_LOAN,
            ),
            h(
                "2025-04",
                "on-track",
                "Project management consultant at work from 4 November 2024; works to start in "
                "2025-26. NMC aims to finish in 5 of the 8 years.",
                L2526,
                B2526,
            ),
            h(
                "2026-03-23",
                "on-track",
                "The Centre's release of Rs 167.44 crore (30 June 2025) moved to the project's single "
                "nodal account.",
                "GR RANYO-2025/PK75/TK-3, 23 March 2026",
                gr_url("202603231615583504"),
            ),
            h(
                "2026-05",
                "on-track",
                "Package 5 (non-sewerage works: electric crematoria at Mokshdham, Rs 1.32 crore) "
                "awarded on 20 October 2025 and begun; tenders published for packages 3 and 4, with two "
                "bids in package 3 under technical evaluation; package 2's draft tender under scrutiny; "
                "package 1's survey done. Rs 233.50 crore provided for 2026-27.",
                f"{L2627}, printed pp.B-5 to B-6; fund head A46201960401, PDF p.330, for the Rs 233.50 crore",
                B2627,
            ),
            h(
                "2026-09-11",
                "on-track",
                "The State's matching share of Rs 69.76 crore to be credited to the project account, "
                "taking funds placed there to Rs 237.20 crore (167.44 + 69.76, our sum).",
                "GR RANYO-2025/PK75, 4 September 2026, corrigendum 11 September 2026",
                gr_url("202609041540478204"),
            ),
        ],
        "next_check": "2026-11-01",
        "revised_due": None,
    },
    {
        "id": "ngp-pohra-amrut2",
        "category": SEWAGE,
        "title": "Pohra river sewerage: sewers for the south of the city and 45 MLD of sewage treatment",
        "committed_by": "Government of Maharashtra, Urban Development Department, for NMC (AMRUT 2.0)",
        "what": (
            "Sanctioned on 9 November 2023 at Rs 957.01 crore including GST (Centre 25%, State 25%, "
            "NMC 50%): about 535 km of sewers, 45 MLD of treatment (the sanction: 35 MLD at Chikhali "
            "and 10 MLD at Jaitala; NMC's July 2024 deck: one 45 MLD plant at Chikhali) and 6 pumping "
            "stations for the south zone and Hudkeshwar-Narsala. Work orders for all five packages "
            "were issued on 25 June 2024. The sanction allows 30 months from the work order "
            "(December 2026), and NMC's 2025-26 budget aimed to finish within two years. The AMRUT "
            "2.0 portal lists "
            "Rs 987.01 crore and NMC's engineering deck Rs 1,030 crore for the same project; all "
            "three figures are stated."
        ),
        "due": "2026-12",
        "commitment_source": gr_source(
            "Government of Maharashtra, Urban Development Department, GR AMRUT-2023/PK460/NAVI-33, "
            "9 November 2023",
            "202311091254222925",
            "2023-11-09",
        ),
        "status": "slipped",
        "status_history": [
            h(
                "2025-04",
                "on-track",
                "Work orders for five packages issued on 25 June 2024; to be finished within 2 years.",
                L2526,
                B2526,
            ),
            h(
                "2025-12-14",
                "on-track",
                "NMC allowed to borrow up to Rs 400 crore for the project.",
                "GR NAMPA-1125/PK244/NAVI-26, 14 December 2025",
                gr_url("202512141527210725"),
            ),
            h(
                "2026-05",
                "slipped",
                "176 of 537 km of sewers laid; 35% physical and 20% financial progress (Rs 162 crore "
                "spent); completion now targeted for March 2027.",
                f"{L2627}, printed pp.B-6 to B-7",
                B2627,
            ),
            h(
                "2026-10-15",
                "slipped",
                "Listed on the AMRUT 2.0 portal at Rs 987.01 crore, milestone 'Contract Awarded'.",
                "MoHUA AMRUT 2.0 portal, Nagpur approved projects",
                AMRUT,
            ),
        ],
        "next_check": "2026-11-01",
        "revised_due": "2027-03",
    },
    {
        "id": "ngp-narsala-20mld-stp",
        "category": SEWAGE,
        "title": "A 20 MLD sewage treatment plant at Narsala under the Smart City programme",
        "committed_by": "Nagpur Smart and Sustainable City Development Corporation, for NMC",
        "what": (
            "A 20 MLD sewage treatment plant for the Pohra river catchment at Narsala. NMC's documents "
            "describe it differently: on trial run in 2023-24, and under 'Proposed STPs' in July "
            "2024. No completion date is published."
        ),
        "due": None,
        "commitment_source": {
            "label": "NMC Public Health Engineering, 'ongoing and proposed project' deck, 11 July 2024, slide 9",
            "url": PHE_DECK,
            "date": "2024-07-11",
        },
        "status": "unverified",
        "status_history": [
            h(
                "2024-03",
                "unverified",
                "Listed as 'WIP', on 'Trial run', 20 MLD, SBR.",
                f"{LESR2324}, printed p.137, Table 6.3",
                ESR2324,
            ),
            h(
                "2024-07-11",
                "unverified",
                "Listed under 'Proposed STPs': 'Under Smart city Project at Narsala - 20 MLD'.",
                "NMC Public Health Engineering deck, slide 9",
                PHE_DECK,
            ),
            h(
                "2026-10-15",
                "unverified",
                "NSSCDCL lists 'STP (Sewage Treatment Plant - Pohra river)' (MAH-NAG-050), which we "
                "take to be this plant: 'Work Order Issued' (undated page).",
                "NSSCDCL project list, read 15 October 2026",
                NSSCDCL,
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ngp-bhandewadi-200-reuse",
        "category": SEWAGE,
        "title": "A 200 MLD sewage plant at Bhandewadi, with treated water sold to power stations",
        "committed_by": "Nagpur Municipal Corporation, with Vishwaraj Environment (design-build-finance-operate-transfer) and MAHAGENCO",
        "what": (
            "Work order of 12 December 2014 for a 200 MLD sewage treatment plant at Bhandewadi, "
            "project cost Rs 573.34 crore, with the treated water piped to the Koradi and Khaperkheda "
            "thermal power stations. Operation and maintenance runs for 30 years, from 1 July 2018 to "
            "30 June 2048."
        ),
        "due": None,
        "commitment_source": {
            "label": (
                "NMC Public Health Engineering, 'ongoing and proposed project' deck, 11 July 2024, "
                "slide 10 (records the work order of 12 December 2014)"
            ),
            "url": PHE_DECK,
            "date": "2014-12-12",
        },
        "status": "delivered",
        "status_history": [
            h(
                "2018-06-30",
                "delivered",
                "Plant commissioned.",
                "NMC Public Health Engineering deck, slide 10",
                PHE_DECK,
            ),
            h(
                "2020-06-05",
                "delivered",
                "Pipeline for reuse at the power stations commissioned.",
                "NMC Public Health Engineering deck, slide 10",
                PHE_DECK,
            ),
        ],
        "next_check": None,
        "revised_due": None,
    },
    {
        "id": "ngp-nag-municipal-bonds",
        "category": SEWAGE,
        "title": "Raise Rs 200 crore in municipal bonds for NMC's share of the Nag project",
        "committed_by": "Nagpur Municipal Corporation",
        "what": (
            "NMC's 2026-27 budget states that it intends to raise Rs 200 crore through municipal "
            "bonds during 2026-27 towards its share of the Nag River Pollution Abatement Project, "
            "and expects a central incentive of Rs 26 crore."
        ),
        "due": "2027-03",
        "commitment_source": {
            "label": f"{L2627}, Accounts and Finance section",
            "url": B2627,
            "date": "2026-05",
        },
        "status": "unverified",
        "status_history": [
            h(
                "2026-05",
                "unverified",
                "Intention stated in the budget.",
                f"{L2627}, Accounts and Finance section",
                B2627,
            ),
        ],
        "next_check": "2027-04-01",
        "revised_due": None,
    },
    # ── Lakes ─────────────────────────────────────────────────────────────
    {
        "id": "ngp-naik-lake-amrut2",
        "category": LAKES,
        "title": "Rejuvenate Naik lake (AMRUT 2.0)",
        "committed_by": "Government of Maharashtra, Urban Development Department, for NMC (AMRUT 2.0)",
        "what": (
            "Sanctioned on 2 November 2022 at Rs 12.95 crore (Centre 3.24, State 3.24, NMC 6.48): "
            "cleaning and desilting, a storm drain, a sewer line, an edge wall, a toilet block, a yoga "
            "shed, a compound wall and an immersion tank. The GR sets 12 months to complete the "
            "project, with the work order due within 45 days (the due date counts 12 months from the "
            "45-day work-order deadline). The AMRUT 2.0 portal now lists the "
            "project as completed at Rs 15.95 crore; it does not date the completion."
        ),
        "due": "2023-12",
        "commitment_source": gr_source(
            "Government of Maharashtra, Urban Development Department, GR AMRUT-2022/PK268/NAVI-33, "
            "2 November 2022 (Naik lake)",
            "202211021115299425",
            "2022-11-02",
        ),
        "status": "delivered",
        "status_history": [
            mirror_h(
                "2022-11-02",
                "on-track",
                "Sanctioned at Rs 12.95 crore, 12 months to complete.",
                "GR AMRUT-2022/PK268/NAVI-33, 2 November 2022",
                "202211021115299425",
            ),
            h(
                "2024-03",
                "unverified",
                "NMC reports the 1st phase of work completed at Naik lake.",
                f"{LESR2324}, printed pp.137-138",
                ESR2324,
            ),
            h(
                "2026-10-15",
                "delivered",
                "'Naik Lake Rejuvenation Project', Rs 15.95 crore, milestone 'Project Completed'.",
                "MoHUA AMRUT 2.0 portal, Nagpur approved projects",
                AMRUT,
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ngp-lendi-lake-amrut2",
        "category": LAKES,
        "title": "Rejuvenate Lendi lake (AMRUT 2.0)",
        "committed_by": "Government of Maharashtra, Urban Development Department, for NMC (AMRUT 2.0)",
        "what": (
            "Sanctioned on 2 November 2022 at Rs 14.13 crore (Centre 3.53, State 3.53, NMC 7.07), "
            "with completion expected in 12 months and the work order due within 45 days (the due "
            "date counts 12 months from the 45-day work-order deadline)."
        ),
        "due": "2023-12",
        "commitment_source": gr_source(
            "Government of Maharashtra, Urban Development Department, GR AMRUT-2022/PK268/NAVI-33, "
            "2 November 2022 (Lendi lake)",
            "202211021157345625",
            "2022-11-02",
        ),
        "status": "stalled",
        "status_history": [
            mirror_h(
                "2022-11-02",
                "on-track",
                "Sanctioned at Rs 14.13 crore, 12 months to complete.",
                "GR AMRUT-2022/PK268/NAVI-33, 2 November 2022",
                "202211021157345625",
            ),
            h(
                "2024-03",
                "stalled",
                "NMC's report records that 'the development work was not completed on account of "
                "opposition from residents to removal of encroachment', and that the lake was not "
                "sampled because of dense vegetation and low water.",
                f"{LESR2324}, printed p.138",
                ESR2324,
            ),
            h(
                "2026-10-15",
                "stalled",
                "Lendi lake is not among the five Nagpur projects on the AMRUT 2.0 portal.",
                "MoHUA AMRUT 2.0 portal, Nagpur approved projects",
                AMRUT,
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ngp-three-lakes-by-2024",
        "category": LAKES,
        "title": "Rejuvenate Gandhisagar, Sonegaon and Sakkardara lakes by 2024",
        "committed_by": "Nagpur Municipal Corporation",
        "what": (
            "NMC's Environment Status Report for 2022-23 records that NMC 'dedicated a huge surplus "
            "of Rs 100 crore to the rejuvenation of Gandhi Sagar, Sonegaon and Sakkardara lake to be "
            "completed by 2024'. Sonegaon's work also carries State sanctions: phase 1 under the "
            "basic-amenities scheme (Rs 17.32 crore, 28 February 2019) and phase 2 under the Tourism "
            "Department (Rs 24.96 crore, 7 November 2023, to be spent by 31 March 2024)."
        ),
        "due": "2024",
        "commitment_source": {
            "label": "NMC Environment Status Report 2022-23, printed p.85",
            "url": ESR2223,
            "date": "2023",
        },
        "status": "overdue",
        "status_history": [
            h(
                "2023-11-07",
                "on-track",
                "Sonegaon phase 2 sanctioned at Rs 24.96 crore with Rs 8.25 crore released; the money "
                "to be spent by 31 March 2024 and the works completed immediately.",
                "Government of Maharashtra, Tourism and Cultural Affairs Department, GR TDS-2023/03/PK114 (Part-IV), 7 November 2023",
                gr_url("202311071447498623"),
            ),
            h(
                "2024-03",
                "on-track",
                "1st phase of work completed at Gandhisagar, Sakkardara and Sonegaon; all three 'under "
                "2nd phase of development and beautification'.",
                f"{LESR2324}, printed pp.137-138",
                ESR2324,
            ),
            h(
                "2026-05",
                "overdue",
                "The 2026-27 budget provides Rs 12 crore for Sonegaon lake beautification and Rs 1 "
                "crore as NMC's share for Gandhisagar's rejuvenation.",
                f"{L2627}, Water Supply and Sewerage Fund, heads A46201373309 and A46201373311 (PDF pp.322 and 330)",
                B2627,
            ),
            h(
                "2026-07-10",
                "overdue",
                "Rs 20 crore of State funds sanctioned for works at Sakkardara lake, to be executed by "
                "the Nagpur Improvement Trust.",
                "Government of Maharashtra, Urban Development Department, GR MANAPA-2026/PK152/Part-1/NAVI-16, 10 July 2026",
                gr_url("202607101202098425"),
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ngp-futala-ngt-actions",
        "category": LAKES,
        "title": "Keep Futala lake clean and lay a sewer for the settlement on its bank",
        "committed_by": "NMC, on directions of the Bombay High Court (2023), the Supreme Court (2025) and the National Green Tribunal (2025-26)",
        "what": (
            "The High Court directed on 30 November 2023 that no permanent construction be undertaken "
            "within Futala lake and that NMC and Maha Metro keep the water body clean; the Supreme "
            "Court upheld this on 7 October 2025. In the Tribunal's own case on the lake, a joint "
            "committee of CPCB, MPCB and NMC reported that about 145-160 houses beside the lake have "
            "no sewer and that the settlement has 8 cow shelters (gaushalas); on 18 November 2025 the Tribunal "
            "asked NMC for an action plan with a timeline within one month."
        ),
        "due": None,
        "commitment_source": {
            "label": f"{LNGT73}, order of 18 November 2025",
            "url": IK.format(34576620),
            "date": "2025-11-18",
        },
        "status": "unverified",
        "status_history": [
            h(
                "2025-10-07",
                "on-track",
                "The Supreme Court upheld the High Court's directions on Futala.",
                "Supreme Court of India, Swacch Association, Nagpur v. State of Maharashtra, 2025 INSC 1199",
                IK.format(85333771),
            ),
            h(
                "2026-02-03",
                "on-track",
                "NMC reported 19 CCTV cameras and nuisance-squad rounds at the lake, and a sewer for the "
                "settlement estimated at Rs 23,63,583.",
                f"{LNGT73}, order of 3 February 2026",
                IK.format(177467634),
            ),
            h(
                "2026-07-31",
                "unverified",
                "The planned sewer lengthened from 150 m to 443 m.",
                f"{LNGT73}, order of 31 July 2026",
                IK.format(121444604),
            ),
            h(
                "2026-09-10",
                "unverified",
                "Technical sanction of Rs 33,09,488 and a budget provision of Rs 36,24,426 (NMC "
                "resolution 22 of 27 June 2026). The case was next listed for 29 October 2026.",
                f"{LNGT73}, order of 10 September 2026",
                IK.format(144526823),
            ),
        ],
        "next_check": "2026-11-01",
        "revised_due": None,
    },
    {
        "id": "ngp-lakes-atr-hc-2026",
        "category": LAKES,
        "title": "An action-taken report to the High Court on conserving the city's lakes",
        "committed_by": "District Collector, Nagpur and the NMC Commissioner, on the Bombay High Court's direction",
        "what": (
            "Disposing of a case it opened on its own motion about the city's lakes, the High Court "
            "directed the District Collector and the NMC Commissioner to look into the issue, conduct "
            "the necessary enquiry, take the steps essential for conserving the lakes, and submit an "
            "action-taken report to the Registrar (Judicial) within four months."
        ),
        "due": "2026-09-07",
        "commitment_source": {
            "label": "Bombay High Court (Nagpur Bench), Suo Motu PIL 24/2026, order of 7 May 2026",
            "url": IK.format(185727412),
            "date": "2026-05-07",
        },
        "status": "unverified",
        "status_history": [
            h(
                "2026-05-07",
                "unverified",
                "Directions issued; report due within four months. Reports filed with the Registrar "
                "are not published, so whether it was filed cannot be checked from public records.",
                "Bombay High Court (Nagpur Bench), Suo Motu PIL 24/2026",
                IK.format(185727412),
            ),
        ],
        "next_check": "2026-11-01",
        "revised_due": None,
    },
    # ── Ambazari and the 2023 flood ───────────────────────────────────────
    {
        "id": "ngp-ambazari-dam-strengthening",
        "category": AMBAZARI,
        "title": "Complete the works to strengthen Ambazari dam",
        "committed_by": "Government of Maharashtra, through a High Level Committee under the Divisional Commissioner, Nagpur; NMC as the dam's owner",
        "what": (
            "After the overflow of 23 September 2023, the State set up a High Level Committee to "
            "complete urgently the works taken up to strengthen Ambazari dam, citing "
            "the High Court's orders in PIL 96/2017 (21 March 2018) and PIL 56/2023. No completion "
            "date was set."
        ),
        "due": None,
        "commitment_source": gr_source(
            "Government of Maharashtra, Urban Development Department, GR NAMPA-3023/PK261/NAVI-26, "
            "5 January 2024",
            "202401051235518225",
            "2024-01-05",
        ),
        "status": "unverified",
        "status_history": [
            h(
                "2025-04",
                "unverified",
                "Rs 11 crore (Rs 1,100 lakh) budgeted for Ambazari dam strengthening in 2025-26.",
                f"{L2526}, Water Supply and Sewerage Fund, head A43801940707",
                B2526,
            ),
            h(
                "2025-07-02",
                "unverified",
                "The High Court recorded, from the affidavit placed before it, that the safety of "
                "Ambazari dam is NMC's responsibility, the dam being NMC's property.",
                f"{LHC56}, order of 2 July 2025",
                IK.format(51036572),
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ngp-ambazari-escape-gates",
        "category": AMBAZARI,
        "title": "Gates on Ambazari's spillway, and flood-safety measures before the monsoon",
        "committed_by": "Water Resources Department (Nagpur Irrigation Division South), by affidavit; the State's High Level Committee",
        "what": (
            "The Irrigation Department told the High Court that the general layout and design of "
            "three escape gates, each 4 m by 2.5 m, for the spillway, which has no gates, were in "
            "progress (affidavit of 26 February 2024), and that a high-level submersible bridge across "
            "the spill had been technically sanctioned on 7 February 2024. On 8 May 2024 the court "
            "asked the High Level Committee to take essential safety measures to be completed before "
            "that monsoon. No completion date for the gates appears in the orders."
        ),
        "due": None,
        "commitment_source": {
            "label": f"{LHC56}, order of 11 July 2024 (records the affidavit of 26 February 2024)",
            "url": IK.format(62849948),
            "date": "2024-02-26",
        },
        "status": "unverified",
        "status_history": [
            h(
                "2024-05-08",
                "unverified",
                "Temporary flood-safety measures to be completed before the 2024 monsoon and placed on record.",
                f"{LHC56}, order of 8 May 2024",
                IK.format(199189158),
            ),
            h(
                "2024-07-11",
                "unverified",
                "Gate design in progress, to be sent to the Maharashtra Engineering Research Institute; "
                "NMC and other agencies to clear obstructions so the Nag downstream carries at least 75 "
                "cumecs.",
                f"{LHC56}, order of 11 July 2024",
                IK.format(62849948),
            ),
        ],
        "next_check": "2026-11-01",
        "revised_due": None,
    },
    {
        "id": "ngp-sep2023-flood-restoration",
        "category": AMBAZARI,
        "title": "Rebuild river and nala walls and roads damaged by the rain of September 2023",
        "committed_by": "Government of Maharashtra, Revenue and Forest Department (special package); NMC executes",
        "what": (
            "A special package of Rs 204.72 crore for the damage of 22-23 September 2023 in the city: "
            "8.41 km of river and nala retaining walls (Rs 163.23 crore) and 61.38 km of road repairs "
            "(Rs 41.48 crore). No completion date was set. NMC's 2025-26 budget gives the package as "
            "Rs 204.81 crore, approved on 20 February 2024."
        ),
        "due": None,
        "commitment_source": gr_source(
            "Government of Maharashtra, Revenue and Forest Department, GR CLS-2023/PK227/M-3, 22 February 2024",
            "202402221153440819",
            "2024-02-22",
        ),
        "status": "unverified",
        "status_history": [
            h(
                d,
                "unverified",
                f"Rs {amt:.2f} crore released to NMC.",
                f"GR CLS-2023/PK227/M-3, {lbl}",
                gr_url(code),
            )
            for d, amt, lbl, code in (
                (
                    "2024-03-30",
                    FLOOD_RELEASES["2024-03-30"],
                    "30 March 2024",
                    "202403301649281019",
                ),
                (
                    "2024-12-30",
                    FLOOD_RELEASES["2024-12-30"],
                    "30 December 2024",
                    "202412301756366919",
                ),
                (
                    "2026-03-31",
                    FLOOD_RELEASES["2026-03-31"],
                    "31 March 2026",
                    "202603311426599719",
                ),
            )
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ngp-nag-widening-crazy-castle",
        "category": AMBAZARI,
        "title": "Widen the Nag below Ambazari, from 14 m to 18 m",
        "committed_by": "Government of Maharashtra, Revenue and Forest Department (State Disaster Mitigation Fund); Maha Metro executes",
        "what": (
            "Rs 19.84 crore (Rs 19,84,12,976) from the State Disaster Mitigation Fund to widen the Nag "
            "channel from 14 m to 18 m at Crazy Castle, near Ambazari, approved by the State Executive "
            "Committee on 25 March 2025 and citing the High Court's order of 12 February 2025 in PIL "
            "56/2023. No completion date was set."
        ),
        "due": None,
        "commitment_source": gr_source(
            "Government of Maharashtra, Revenue and Forest Department, GR AYUPA-2025/PK47/AYUPA-2, 7 May 2025",
            "202505071618095219",
            "2025-05-07",
        ),
        "status": "unverified",
        "status_history": [
            h(
                "2025-06-23",
                "unverified",
                "Corrigendum to the sanction.",
                "GR AYUPA-2025/PK47/AYUPA-2, corrigendum of 23 June 2025",
                gr_url("202506231440028919"),
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
]

COUNTS = {
    "delivered": 4,
    "on-track": 1,
    "slipped": 1,
    "overdue": 3,
    "stalled": 1,
    "unverified": 12,
}

SOURCES_USED = [
    (
        "mahagr-nagpur-resolutions",
        "Government Resolutions on Nagpur's water, sewage, lakes and the 2023 flood (UDD, R&F, Environment, Tourism)",
        "Government of Maharashtra",
    ),
    (
        "mahagr-wrd-resolutions",
        "Water Resources Department GRs: Lohghogari (17 and 18 Sep 2019), Pench re-planning (19 Mar 2020), Kolar-Kanhan barrage (18 Apr 2023)",
        "Government of Maharashtra, Water Resources Department",
    ),
    (
        "nmc-budget",
        "NMC budgets 2025-26 and 2026-27 (Commissioner's speech and fund statements)",
        "Nagpur Municipal Corporation",
    ),
    (
        "nmc-esr",
        "NMC Environment Status Reports 2017-18 (draft), 2019-20, 2022-23 and 2023-24",
        "Nagpur Municipal Corporation (prepared by CSIR-NEERI)",
    ),
    (
        "amrut2-portal-nagpur",
        "AMRUT 2.0 portal: Nagpur approved projects",
        "Ministry of Housing and Urban Affairs",
    ),
    (
        "nagpur-court-docket",
        "Supreme Court, Bombay High Court (Nagpur Bench) and NGT orders, read on Indian Kanoon",
        "Supreme Court of India; Bombay High Court; National Green Tribunal",
    ),
    (
        "nmc-phe-projects-deck",
        "NMC Public Health Engineering, 'ongoing and proposed project' deck, 11 July 2024",
        "Nagpur Municipal Corporation",
    ),
    (
        "nmc-24x7-deck-2015",
        "NMC 24x7 case-study deck, ICRIER workshop, 23 February 2015",
        "Nagpur Municipal Corporation",
    ),
    (
        "adb-iee-nagpur-2010",
        "ADB draft Initial Environmental Examination 42907-01 (June 2010)",
        "Asian Development Bank",
    ),
    (
        "nsscdcl-projects",
        "Nagpur Smart City project list",
        "Nagpur Smart and Sustainable City Development Corporation",
    ),
    (
        "jica-nag-river-loan",
        "JICA ex-ante evaluation and loan announcement, Nag River Pollution Abatement",
        "Japan International Cooperation Agency",
    ),
]


def check() -> None:
    """Fail the build if the transcription or the intro's counts drift."""
    ids = [c["id"] for c in COMMITMENTS]
    assert len(ids) == len(set(ids)), "duplicate commitment id"
    got = {s: sum(c["status"] == s for c in COMMITMENTS) for s in COUNTS}
    assert got == COUNTS and len(COMMITMENTS) == 22, f"update the intro's counts: {got}"
    assert abs(FLOOD_WALLS + FLOOD_ROADS - FLOOD_TOTAL) < 1e-9, "flood package parts"
    released = sum(FLOOD_RELEASES.values())
    assert (
        round(released, 2) == 156.89 and round(100 * released / FLOOD_TOTAL, 1) == 76.6
    )
    assert round(NAG_CENTRE + NAG_STATE + NAG_NMC, 2) == NAG_TOTAL, "Nag cost split"
    # The GR prints the State share as Rs 69,76,07,366.48 (PFMS deficit figure); 167.44 x 25/60
    # = 69.77, within the rounding of the Centre's printed 167.44.
    assert abs(NAG_CENTRE_RELEASED * 25 / 60 - NAG_STATE_SHARE) < 0.01, (
        "State share = Centre x 25/60"
    )
    assert round(NAG_CENTRE_RELEASED + NAG_STATE_SHARE, 2) == 237.20
    # The Naik GR prints 12.95 with parts 3.24 + 3.24 + 6.48 (= 12.96, its own rounding).
    assert (
        abs(3.24 + 3.24 + 6.48 - 12.95) <= 0.011
        and round(3.53 + 3.53 + 7.07, 2) == 14.13
    )
    assert round(91.25 + 45.64 + 136.89, 2) == 273.78, "AMRUT 1.0 split"
    assert round(11.55 + 25.62, 2) == 37.17, "AMRUT 1.0 pipeline replacement"
    for c in COMMITMENTS:
        cs = c["commitment_source"]
        if cs.get("gr_code") in MIRROR_CODES:
            assert cs.get("text_via_mirror") and any(
                e["source_url"] == cs["mirror_url"] for e in c["status_history"]
            ), f"{c['id']}: mirror GR row must link the archive copy"
            assert cs["url"] == cs["mirror_url"], f"{c['id']}: link the copy that opens"
        for e in c["status_history"]:
            assert e["source_label"] and e["source_url"], (
                f"{c['id']}: history entry without citation"
            )
    text = repr(COMMITMENTS)
    assert "—" not in text and "–" not in text, "no em or en dashes"
    flagged = {c["commitment_source"].get("gr_code") for c in COMMITMENTS} | {
        e["source_url"].rsplit("/", 1)[-1].split(".")[0]
        for c in COMMITMENTS
        for e in c["status_history"]
    }
    assert set(MIRROR_CODES) <= flagged, "every mirror-text GR is cited somewhere"


def main() -> int:
    check()
    today = date.today().isoformat()
    out = {
        "nvdm": "1.0",
        "dataset": "data-root/commitments",
        "scope": {"kind": "city", "id": "nagpur"},
        "provenance": {
            "sources": [
                {
                    "id": sid,
                    "title": title,
                    "publisher": pub,
                    "license": registry_license(sid),
                }
                for sid, title, pub in SOURCES_USED
            ],
            "method": "manual",
            "produced_at": today,
            "produced_by": "neer-vazhvu-api/scripts/build_nagpur_commitments.py",
            "note": (
                "Each promise and each status change cites a dated document; quotes checked against "
                "the source text on 2026-10-15. Five GR texts were read from the orgpedia mahGRs "
                "archive copy because the official PDF did not open; those rows say so and link both."
            ),
        },
        "place_id": "nagpur",
        "updated": today,
        "headline": "What has been promised about Nagpur's water, and by when",
        "intro": (
            "Twenty-two commitments on Nagpur's water supply, new sources, sewage and the Nag, the "
            "city's lakes, and the works at Ambazari after the flood of September 2023, each on a "
            "dated document: a Government Resolution, a court order, an NMC budget or report, the "
            "AMRUT 2.0 portal or a funder's document. Four are delivered and one is on track. One "
            "has a date moved by NMC that has not yet come; three are past their date with no "
            "delivery on record, one of them after NMC moved it. One, Lendi lake, is recorded by "
            "NMC as not completed because of opposition to removing encroachments. Twelve can be "
            "cited as promises, but their current status cannot yet be cited either way."
        ),
        "status_legend": {
            "delivered": "The promised thing verifiably happened, even if late. The dates show how late.",
            "on-track": "The stated date has not passed and the latest dated evidence is consistent with it.",
            "slipped": "The institution itself has moved the date. Old and new dates are both shown.",
            "overdue": "The promised date has passed with no delivery and no formally revised date we can cite.",
            "stalled": "Work or approvals have stopped, by the institution's own account or a court's.",
            "unverified": "We can cite the promise but cannot yet cite its current status either way.",
        },
        "update_model": (
            "Statuses change only against a dated citation. The register is re-checked each spring "
            "against NMC's new budget and Environment Status Report, against new Government "
            "Resolutions and the AMRUT 2.0 portal, and after hearings in the High Court and the "
            "National Green Tribunal. "
            "A passed next-check date with no new citation is flagged, never silently updated."
        ),
        "sources_note": (
            "NMC's 2026-27 budget is a scanned Marathi document; its figures were read from the page "
            "images. Five Government Resolutions (Naik and Lendi lakes, AMRUT 2.0 water supply, the "
            "2023 AMRUT 1.0 pipeline sanction and the Kolar-Kanhan barrage) did not open at the "
            "State's GR portal on 15 October 2026; their text was read from the orgpedia mahGRs "
            "archive copy, which each of those rows links beside the official address. Court and "
            "tribunal orders were read on Indian Kanoon; the court, case number and date are the "
            "citation. Where two official documents give different costs or lengths for the same "
            "work, both are stated."
        ),
        "commitments": COMMITMENTS,
    }
    write_artifact(OUT, out)
    print(f"{len(COMMITMENTS)} commitments {COUNTS} -> {OUT.name}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

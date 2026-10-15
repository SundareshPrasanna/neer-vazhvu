#!/usr/bin/env python3
"""
Visakhapatnam's dated, institutionally-owned water and sewerage commitments.

Writes public/data/commitments-visakhapatnam.json for /visakhapatnam/commitments.

Every row is a promise an institution made in its own document - GVMC in its
notes and affidavits to the National Green Tribunal and the High Court's
committee, the Government of Andhra Pradesh in its compliance affidavit, the
AP High Court recording GVMC's dates, and MoHUA's AMRUT 2.0 status lists. Each
status is set only against a dated citation, and history is kept, never
overwritten. The draft Green City Action Plan (IFC for GVMC, posted by GVMC for
comment on 19 Oct 2024; we have not found an adopted version) is cited only
for context and dated status records. A draft is not a commitment, so its 2034
water-loss target has no row.

ONE WORK, ONE ROW. Where several documents date the same work (the second
Appughar plant appears in GVMC's notes, its Rs 641 crore and Rs 925 crore
plans, the state's 25 + 20 MLD line, AMRUT project AP-GVMC-4780 and two High
Court orders), the work has one row and every dated version is a history
entry. Related works with their own milestones (Pendurthi and Gajuwaka
networks, Narava plant, the state's three connection targets) stay separate
and name each other.

STATUS RULE, the same for every row: 'slipped' when the institution's own later
document moved the date and the latest date has not passed; 'overdue' when the
latest date given has passed and we have not found a completion record;
'on-track' only with a dated progress figure for the work itself (a percentage
or length laid) and the date not passed; a promise or a stage label alone
('At Implementation Stage', 'Contract Awarded', 'in progress') is
'unverified'. Where one note gives two dates (its table and its text), the
history quotes both and says which one the status rests on.

AMRUT 2.0 STATUS IS READ FROM TWO MoHUA LISTS. The Andhra Pradesh status PDF
"as on 05-03-2026" at the underscore URL (58 pages, created 9 Mar 2026; the
one MoHUA's homepage links) carries each project's milestone and "Scheduled /
revised completion date". An earlier 53-page file at the same name without the
underscore says 'Ongoing' where this one says 'At Implementation Stage'; quote
the cited file only. MoHUA's live GVMC list (captured 14 Oct 2026) has no
project IDs and no as-of date, only four stages. A project whose date has
passed and whose live stage is not "Project Completed" is overdue. The
register carries every GVMC AMRUT project of Rs 10 crore or more and every one
whose date has passed without completion.

Run:  python3 neer-vazhvu-api/scripts/build_visakhapatnam_commitments.py
"""

import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

CITY = "visakhapatnam"
OUT = REPO_ROOT / "public" / "data" / "commitments-visakhapatnam.json"
LIVE_CHECKED = "2026-10-14"
FILINGS_CHECKED = "2026-10-15"

NGT = "https://www.greentribunal.gov.in/sites/default/files/news_updates/"
CPCB_240 = NGT + "OA%20240%20of%202025%20Reply%20filed%20by%20R3%20CPCB.pdf"
APPCB_240 = NGT + "OA%20240%20of%202025%20Report%20filed%20by%20R2%20APPCB.pdf"
OA606_URL = (
    NGT
    + "AFFIDAVIT%20BY%20GOVT.%20OF%20ANDHRA%20PRADESH%20IN%20OA%20606%20of%202018%20"
    "(COMPLIANCE%20OF%20MSW%20MGT%20RULES,%202016%20AND%20OTHER%20ENVIRONMENTAL%20ISSUES).pdf"
)

OA14_MAR21 = (
    NGT + "1421_0.pdf",
    "GVMC action-taken report, NGT OA 14/2021 (SZ), enclosing a supply sheet dated 12-03-2021",
    "2021-03",
)
OA14_OCT21 = (
    NGT + "142021.pdf",
    "GVMC report signed by the SE Water Supply, NGT OA 14/2021 (SZ), filed after 22-10-2021",
    "2021-10",
)
GVMC_NOV23 = (
    CPCB_240,
    "GVMC note of 27.11.2023 to the High Court's committee in WP(PIL) 248/2020, annexed to CPCB's reply in NGT OA 240/2025 (SZ), PDF pp40-43",
    "2023-11-27",
)
OA40_2024 = (
    NGT + "OA%2040%20of%202024%20Affidavit%20by%20R3%20Greater%20Vizag.pdf",
    "GVMC Commissioner's affidavit, NGT OA 40/2024 (SZ)",
    "2024-03-27",
)
HC_NOV25 = (
    APPCB_240,
    "AP High Court order of 12.11.2025 in WP(PIL) 248/2020, quoted in APPCB's report of 09.12.2025, annexed to its report of 27.04.2026 in NGT OA 240/2025 (SZ), PDF p19",
    "2025-11-12",
)
GVMC_DEC25 = (
    APPCB_240,
    "GVMC note dated 08.12.2025, Annexure-B to APPCB's report of 09.12.2025, annexed to its report of 27.04.2026 in NGT OA 240/2025 (SZ), PDF pp24-26",
    "2025-12-08",
)
HC_MAR26 = (
    CPCB_240,
    "AP High Court order of 11.03.2026 in WP(PIL) 248/2020, annexed to CPCB's reply in NGT OA 240/2025 (SZ), PDF pp46-48",
    "2026-03-11",
)
AMRUT_AP = (
    "https://amrut.mohua.gov.in/assets/Status-of-Approved-Projects-under-AMRUT-2-in-Andhra-Pradesh-as-on-05-03-2026_.pdf",
    "MoHUA, Status of Approved Projects under AMRUT 2.0 in Andhra Pradesh, as on 05-03-2026",
    "2026-03-05",
)
AMRUT_LIVE = (
    "https://amrut.mohua.gov.in/approvedProjects/list/bE45Yjhjd3ovYVZaSnRUdTJpbnE0UT09/YWgzMHUxWkJFeHJGMlFDaUExZ2tFQT09",
    "MoHUA AMRUT 2.0 approved projects, GVMC (live list)",
    LIVE_CHECKED,
)
GCAP_TITLE = (
    "Draft Visakhapatnam Green City Action Plan (IFC for GVMC, dated Sept 2024), "
    "posted by GVMC for comment on 19 Oct 2024"
)
GCAP = (
    "https://www.gvmc.gov.in/WhatsNew/Whats_New_DocOct_658.pdf",
    GCAP_TITLE,
    "2024-09",
)
REGISTER_CHECK = (
    None,
    "Neer Vazhvu register check, 15 Oct 2026 (we have not found a completion record)",
    FILINGS_CHECKED,
)


def oa606(pages: str) -> tuple:
    return (
        OA606_URL,
        f"Government of Andhra Pradesh affidavit, NGT Principal Bench OA 606/2018 (PDF {pages})",
        "2026-02-13",
    )


def mpr_feb24(pages: str) -> tuple:
    return (
        NGT + "4024_3.pdf",
        "Andhra Pradesh monthly progress report for February 2024 for NGT Principal Bench OA 673/2018, annexed to "
        f"APPCB's report of 11.05.2024 in NGT OA 40/2024 (SZ), PDF {pages}",
        "2024-02",
    )


def appcb_apr26(pages: str) -> tuple:
    return (
        APPCB_240,
        f"APPCB report of 27.04.2026 in NGT OA 240/2025 (SZ), PDF {pages}",
        "2026-04-27",
    )


def hist(when: str, status: str, note: str, source: tuple) -> dict:
    return {
        "date": when,
        "status": status,
        "note": note,
        "source_label": source[1],
        "source_url": source[0],
    }


def commitment(
    cid,
    category,
    title,
    by,
    what,
    due,
    source,
    status,
    history,
    next_check,
    revised_due=None,
):
    return {
        "id": cid,
        "category": category,
        "title": title,
        "committed_by": by,
        "what": what,
        "due": due,
        "commitment_source": {"label": source[1], "url": source[0], "date": source[2]},
        "status": status,
        "status_history": history,
        "next_check": next_check,
        "revised_due": revised_due,
    }


def amrut_ap(project_id, cost_cr, ap_milestone, due_label, status="unverified"):
    return hist(
        "2026-03-05",
        status,
        f"{project_id}, Rs {cost_cr:.2f} crore. Milestone '{ap_milestone}', scheduled or revised completion {due_label}.",
        AMRUT_AP,
    )


def amrut_live(status, live_milestone, due_label, subject="this project"):
    note = (
        f"MoHUA's live list for GVMC (captured {LIVE_CHECKED}; it carries no as-of date) shows {subject} at "
        f"'{live_milestone}', not 'Project Completed'. The list has four stages: DPR Stage, NIT Issued, "
        "Contract Awarded and Project Completed."
    )
    if status == "overdue":
        note += f" The scheduled or revised completion, {due_label}, has passed."
    return hist(LIVE_CHECKED, status, note, AMRUT_LIVE)


def amrut(
    cid,
    project_id,
    title,
    cost_cr,
    ap_milestone,
    due_label,
    due,
    live_milestone,
    status,
    category="Water supply",
    what_extra="",
    live_subject="this project",
    earlier=(),
    ap_status="unverified",
):
    history = [
        *earlier,
        amrut_ap(project_id, cost_cr, ap_milestone, due_label, ap_status),
        amrut_live(status, live_milestone, due_label, live_subject),
    ]
    return commitment(
        cid,
        category,
        title,
        "Greater Visakhapatnam Municipal Corporation (AMRUT 2.0)",
        f"{title} (AMRUT 2.0 project {project_id}, Rs {cost_cr:.2f} crore).{what_extra}",
        due,
        AMRUT_AP,
        status,
        history,
        "2027-01-15",
    )


def build(today: str) -> dict:
    gvmc = "Greater Visakhapatnam Municipal Corporation"
    state = "Government of Andhra Pradesh"
    commitments = [
        commitment(
            "gvmc-ugd-362cr",
            "Sewerage",
            "Pendurthi underground drainage network",
            gvmc,
            "Complete the underground drainage network for the Pendurthi area (Zone VIII), which GVMC put at Rs 362 crore "
            "in its 2021 filings to the National Green Tribunal. GVMC's notes of November 2023 and December 2025 give the "
            "Pendurthi package as Rs 412 crore, and the draft Green City Action Plan (p78) describes that Rs 412 crore as "
            "a 226 km network and a 46 MLD tertiary treatment plant with 15 years of upkeep; we have not found a document "
            "that reconciles the two figures. The new Narava plant this network feeds and the state's target for sewer "
            "connections in Gajuwaka and Pendurthi by FY 2028-29 are separate rows.",
            "2021-10",
            OA14_MAR21,
            "overdue",
            [
                hist(
                    "2021-03",
                    "on-track",
                    "Physical progress 60%; 'expected to be completed by the end of October 2021' (PDF p3).",
                    OA14_MAR21,
                ),
                hist(
                    "2021-10",
                    "slipped",
                    "Physical progress 73%; 'expected to be completed by the end of August 2022' (PDF p3).",
                    OA14_OCT21,
                ),
                hist(
                    "2023-11-27",
                    "slipped",
                    "Package-I, 226 km, Rs 412 crore: '93% completed', probable completion 'Dec 2024' in the note's table "
                    "(PDF p42); its text says 'about 93% completed (with target completion of May'2024)' (PDF p41).",
                    GVMC_NOV23,
                ),
                hist(
                    "2024-03-27",
                    "slipped",
                    "Pendurthi (Zone VIII) sewer network: 190 of 226 km laid; probable completion 'May'2024' (PDF p5).",
                    OA40_2024,
                ),
                hist(
                    "2025-12-08",
                    "slipped",
                    "Package-I, sewer network in Pendurthi area, 210 km, Rs 412 crore: '97% completed', probable completion "
                    "'Mar'2026' in the note's table (PDF p25). The note's text gives 'about 93% completed (with target "
                    "completion of May'2026)' (PDF p24); GVMC's November 2023 note gave a target of May 2024.",
                    GVMC_DEC25,
                ),
                hist(
                    FILINGS_CHECKED,
                    "overdue",
                    "Both dates in GVMC's December 2025 note, March 2026 in its table and May 2026 in its text, have "
                    "passed. We have not found a completion record in the NGT filings checked for this register.",
                    REGISTER_CHECK,
                ),
            ],
            "2027-01-15",
            revised_due="2026-05",
        ),
        commitment(
            "gvmc-gajuwaka-sewer-network",
            "Sewerage",
            "Gajuwaka and Malkapuram underground drainage network",
            gvmc,
            "Complete the 429 km sewer network for the Gajuwaka and Malkapuram areas (Zone VI), one of two Smart City "
            "packages GVMC puts at Rs 942 crore together with Pendurthi; this package is Rs 530 crore. The new Narava "
            "plant this network feeds and the state's target for sewer connections in Gajuwaka and Pendurthi by "
            "FY 2028-29 are separate rows.",
            "2024-12",
            GVMC_NOV23,
            "slipped",
            [
                hist(
                    "2023-11-27",
                    "on-track",
                    "The note's text says 'about 40% completed (with target completion of Dec'2024)' (PDF p41); its table "
                    "gives 429 km, '45% Completed', probable completion 'Dec'2024', Rs 530 crore (PDF p42).",
                    GVMC_NOV23,
                ),
                hist(
                    "2024-03-27",
                    "slipped",
                    "Gajuwaka (Zone VI) sewer network: 140 of 429 km laid; probable completion 'May'2025' (PDF p5).",
                    OA40_2024,
                ),
                hist(
                    "2025-12-08",
                    "slipped",
                    "The note's table gives 48% completed (153 km), Rs 145 crore against a total project cost of Rs 530 "
                    "crore, probable completion 'Oct'2025', and the remark 'Work proposed for pre-closure and balance work "
                    "to be tendered during Jan'2026' (PDF p25). The note's text gives 'about 40% completed (with target "
                    "completion of Dec'2026)' (PDF p24); GVMC's November 2023 note gave a target of Dec 2024. The 'slipped' "
                    "status rests on that Dec 2026 date; on the table's Oct 2025 date this row would be overdue.",
                    GVMC_DEC25,
                ),
            ],
            "2027-01-15",
            revised_due="2026-12",
        ),
        commitment(
            "gvmc-narava-54mld-stp",
            "Sewage treatment",
            "A new 54 MLD treatment plant at Narava",
            gvmc,
            "Bring into use a new 54 MLD sewage treatment plant beside the existing one at Narava. GVMC says the Pendurthi "
            "and Gajuwaka sewer networks, which are separate rows, will carry sewage to it. In 2021 GVMC told the Tribunal "
            "the plant would be completed by the end of October 2021, then that it would be 'commenced by the end of "
            "August 2022'. The state's list of plants for February 2024 shows a second 54 MLD plant at Narava commissioned "
            "in October 2022, with 15 MLD of its capacity in use. GVMC's notes of November 2023 and December 2025 list the "
            "plant as in execution, due by December 2024 and then December 2026. Every date is shown below.",
            "2021-10",
            OA14_MAR21,
            "slipped",
            [
                hist(
                    "2021-03",
                    "unverified",
                    "Sewage from Pendurthi 'will be treated in 54 MLD STP which is under construction at Narava and it "
                    "will be completed by the end of October 2021' (PDF pp3-4).",
                    OA14_MAR21,
                ),
                hist(
                    "2021-10",
                    "slipped",
                    "Sewage from Pendurthi 'will be treated in 108 MLD STP, which is under construction at Narava and it "
                    "will be commenced by the end of August 2022' (PDF p3).",
                    OA14_OCT21,
                ),
                hist(
                    "2023-11-27",
                    "slipped",
                    "The note's table gives the 54 MLD plant at Narava as '90% completed', probable completion 'Dec'2024' "
                    "(PDF p42). Its text says the plant 'would come into function within 12 months i.e. by Dec 2024' once "
                    "the sewerage project, 'at 85%', is complete; that 85% is the sewerage project's, not the plant's "
                    "(PDF p41).",
                    GVMC_NOV23,
                ),
                hist(
                    "2024-02",
                    "unverified",
                    "The state's list of plants for February 2024 shows two 54 MLD plants at Narava, one commissioned in "
                    "August 2001 and one in October 2022, the second with 15 MLD of its capacity in use.",
                    mpr_feb24("pp7-8"),
                ),
                hist(
                    "2024-03-27",
                    "slipped",
                    "GVMC's affidavit gives the date in its November 2023 note: the new 54 MLD plant 'would come into "
                    "function within 12 months i.e. by Dec 2024' (PDF p5). The 93% it gives is the sewerage project's, not "
                    "the plant's.",
                    OA40_2024,
                ),
                hist(
                    "2025-12-08",
                    "slipped",
                    "The note says the plant 'would come into function within 12 months i.e. by Dec 2026' (PDF p24); "
                    "GVMC's November 2023 note gave Dec 2024. Its table, like the 2023 one, reads '54 MLD already completed "
                    "and in operation, another 54 MLD is in execution' (PDF p25).",
                    GVMC_DEC25,
                ),
            ],
            "2027-01-15",
            revised_due="2026-12",
        ),
        commitment(
            "gvmc-appughar-second-stp",
            "Sewage treatment",
            "Second 25 MLD treatment plant at Appughar, with new sewer lines",
            gvmc,
            "Build a second 25 MLD sewage treatment plant beside the existing one at Appughar, with additional sewer lines "
            "and gaps in the existing network filled, part funded by AMRUT 2.0. GVMC's December 2025 note says the plant "
            "is to treat dry-weather flow from drains that now reach the sea. The documents give five costs: Rs 88 crore "
            "(GVMC, 2023), Rs 90 crore with drain diversions (GVMC's 2024 affidavit; the draft Green City Action Plan), "
            "Rs 372 crore (GVMC, December 2025), Rs 363.38 crore (AMRUT 2.0 project AP-GVMC-4780) and a Rs 272 crore "
            "contract (High Court, March 2026). Reading AP-GVMC-4780 as this work is an inference from its title, its "
            "AMRUT funding, its contract stage and the state's AMRUT 2.0 listing of a 25 MLD GVMC plant with the same March "
            "2028 date; we have not found a document that states the link.",
            "2026-03",
            GVMC_NOV23,
            "slipped",
            [
                hist(
                    "2023-11-27",
                    "unverified",
                    "'Providing additional Sewer Network & Gaps including construction of 25 MLD STP at Appughar': 50 km, "
                    "Rs 88 crore, 'Tender Stage', probable completion 'Mar'2026 (2 years duration)', 25% of the funds "
                    "proposed under AMRUT 2.0 and 75% from GVMC (PDF p43).",
                    GVMC_NOV23,
                ),
                hist(
                    "2024-03-27",
                    "unverified",
                    "GVMC's sworn affidavit counts a 25 MLD plant inside Rs 641 crore of new sewerage works, 80% from its "
                    "own funds, to start in May-June 2024 and finish 'by the Dec'2027' (PDF p5); its 2023 note splits that "
                    "Rs 641 crore into this project (Rs 88 crore) and Madhurawada (Rs 553 crore). The affidavit also lists "
                    "the remaining 14 of 24 drains that reach the sea, with gaps in the sewer network and house "
                    "connections, at Rs 90 crore, 'In tenders', with 'Construction of New STP Mar'2026 (2 years duration)' "
                    "(PDF p7); it does not name the site.",
                    OA40_2024,
                ),
                hist(
                    "2024-09",
                    "unverified",
                    "The draft plan lists 'Diversion of dry weather flow drains and streams, which includes gaps in the "
                    "sewerage network, house service connections and construction of an additional 25MLD STP at Appughar "
                    "with a cost of INR 90 crore' as 'Sanctioned and Under Tender Stage' (p78), naming the site of the "
                    "affidavit's Rs 90 crore line.",
                    GCAP,
                ),
                hist(
                    "2025-11-12",
                    "slipped",
                    "The High Court records the Advocate General's statement that tendering for the second Appughar plant "
                    "would be completed by December 2025, construction would start around January 2026, and the plant "
                    "would take about 18 months to build.",
                    HC_NOV25,
                ),
                hist(
                    "2025-12-08",
                    "slipped",
                    "GVMC now gives the project as 207 km of sewer network with the 25 MLD plant, Rs 372 crore, 'Tender "
                    "Stage', probable completion 'Mar'2029' (PDF p25). The Rs 641 crore plan is restated as Rs 925 crore, now 25 MLD here and 20 MLD in Madhurawada, "
                    "to start in Feb-Mar 2026 and finish 'by the Mar'2029'; the note's text also puts the two new projects at "
                    "'Rs.887(553+334) crores' (PDF p24).",
                    GVMC_DEC25,
                ),
                hist(
                    "2026-02-13",
                    "slipped",
                    "The state lists 25 MLD and 20 MLD of new treatment capacity for the city by March 2029, the sizes GVMC "
                    "gives for Appughar and Madhurawada, against a gap of 69 MLD between sewage generated (248 MLD, PDF "
                    "p71) and the 179 MLD of plant capacity in use; installed capacity is 237 MLD (PDF p78). Its AMRUT 2.0 "
                    "annexure lists a 25 MLD GVMC plant as 'Tender to be called', March 2028 (PDF p134).",
                    oa606("pp71, 78, 134"),
                ),
                amrut_ap(
                    "AP-GVMC-4780",
                    363.38,
                    "At Implementation Stage",
                    "March 2028",
                    "slipped",
                ),
                hist(
                    "2026-03-11",
                    "slipped",
                    "The contract has been allotted at Rs 272 crore, Rs 38 crore of it for the plant and the rest for sewer "
                    "lines and drains, under an agreement dated 10.01.2026; soil testing and structural designs were 'in "
                    "the process of being prepared'. GVMC's Commissioner undertook to file a timeline, with the last date "
                    "'fixed for March 2027'. The court listed the case for 17.06.2026.",
                    HC_MAR26,
                ),
                hist(
                    "2026-04-27",
                    "slipped",
                    "APPCB reports that 'The GVMC has awarded work order to construct 25 MLD STP in addition to the "
                    "existing STP at Appughar' (PDF p7). It gives no new date.",
                    appcb_apr26("p7"),
                ),
                amrut_live(
                    "slipped",
                    "Contract Awarded",
                    "March 2028",
                    "'Providing additional Sewer Network and Gaps in Exiting Network in GVMC area' (Rs 363.38 crore)",
                ),
            ],
            "2026-11-01",
            revised_due="2027-03",
        ),
        commitment(
            "gvmc-madhurawada-sewerage",
            "Sewerage",
            "Madhurawada sewerage system with a 20 MLD treatment plant",
            f"{gvmc} (IFC loan); dates also from the {state}",
            "A comprehensive sewerage system for Madhurawada (Zone II), which GVMC says has no underground drainage: "
            "sewer lines, house connections and a treatment plant at Kapuluppada. GVMC gave it as 450 km with a 50 MLD "
            "plant in 2023 and as 398 km with a 20 MLD first-phase plant in December 2025, at Rs 553 crore both times. "
            "The state's target for sewer connections in Madhurawada by FY 2029-30 is a separate row.",
            "2027-12",
            GVMC_NOV23,
            "slipped",
            [
                hist(
                    "2023-11-27",
                    "unverified",
                    "450 km and 50 MLD, Rs 553 crore, 'Approval Stage', probable completion 'Dec'2027 (3 years duration)', "
                    "92% of the funds through a loan and 8% from AMRUT 2.0 (PDF p43).",
                    GVMC_NOV23,
                ),
                hist(
                    "2024-03-27",
                    "unverified",
                    "GVMC's sworn affidavit lists Madhurawada (Zone II) at Rs 553 crore, 'Permission from the GoAP is "
                    "awaited with the financial assistance of International Finance Corporation' (PDF p7), and counts a "
                    "50 MLD plant inside Rs 641 crore of new works to finish 'by the Dec'2027' (PDF p5).",
                    OA40_2024,
                ),
                hist(
                    "2024-09",
                    "unverified",
                    "The draft plan lists 'Providing comprehensive sewerage system in Zone 2 (Madhurwada Zone) of GVMC with "
                    "a loan from IFC of INR 553 crore' under 'Detailed Project Report (DPR) Submitted for Sanction' (p78).",
                    GCAP,
                ),
                hist(
                    "2025-12-08",
                    "slipped",
                    "Listed among new projects 'PROPOSED': 398 km and a 20 MLD first-phase plant, Rs 553 crore with a Rs 498 "
                    "crore IFC loan, 'Tender Stage', probable completion 'Mar'2029' (PDF p25). The note's text gives "
                    "'Dec'2028' as the targeted completion, with work 'expected to be grounded by Feb'2026' (PDF p26).",
                    GVMC_DEC25,
                ),
                hist(
                    "2026-02-13",
                    "slipped",
                    "The state lists 25 MLD and 20 MLD of new treatment capacity for the city by March 2029 (PDF p78), the "
                    "sizes GVMC gives for Appughar and Madhurawada.",
                    oa606("p78"),
                ),
                hist(
                    "2026-04-27",
                    "slipped",
                    "APPCB reports that GVMC 'has awarded work order to construct' the '20 MLD STP at Kappulauppada' (PDF "
                    "p7). It gives no new date.",
                    appcb_apr26("p7"),
                ),
            ],
            "2027-06-01",
            revised_due="2029-03",
        ),
        commitment(
            "gvmc-divert-10-drains",
            "Sewerage",
            "Divert 10 drains that reach the sea to treatment plants",
            gvmc,
            "Divert 10 of the 24 drains GVMC identified as flowing into the sea between the Coastal Battery (fishing "
            "harbour) and Rishikonda to nearby sewage treatment plants, at a cost of Rs 3 crore. GVMC's plan for the other "
            "14 drains is quoted in the second Appughar plant row.",
            "2024-06",
            OA40_2024,
            "overdue",
            [
                hist(
                    "2024-03-27",
                    "unverified",
                    "Works for 10 drains, Rs 3 crore, 'already under execution', 'To be Completed by May, June'2024' "
                    "(PDF pp6-7).",
                    OA40_2024,
                ),
                hist(
                    "2024-09",
                    "overdue",
                    "The draft plan (September 2024) lists 'Diversion of dry weather flow drains and "
                    "streams to near STP (i.e. from coastal battery to Rushikonda-1st stretch) with a cost of INR 3 "
                    "crore' among 'UGD Ongoing Projects' (p78).",
                    GCAP,
                ),
                hist(
                    "2026-04-24",
                    "overdue",
                    "APPCB's officials inspected drains from Bheemili to the Shipping Harbour on 24.04.2026 and 'observed "
                    "that 11 open drains joining gray water into the sea' (PDF p8). The report does not name the drains, "
                    "so we cannot tell whether the ten in this row are among them.",
                    appcb_apr26("p8"),
                ),
                hist(
                    FILINGS_CHECKED,
                    "overdue",
                    "The date has passed. We have not found a completion record for these ten drains in the NGT filings "
                    "checked for this register.",
                    REGISTER_CHECK,
                ),
            ],
            "2027-01-15",
        ),
        commitment(
            "ap-ugd-gajuwaka-pendurthi",
            "Sewerage",
            "Sewer connections in Gajuwaka and Pendurthi by FY 2028-29",
            state,
            "Underground drainage in the Gajuwaka and Pendurthi areas, which the state's affidavit lists as in progress, to "
            "bring sewer connections to a further 15% of the city's population by FY 2028-29. The same affidavit puts 60% "
            "of the city's population as connected in February 2026, the same share GVMC gave the Tribunal in March 2024. "
            "GVMC's two sewer-network packages for these areas are separate rows.",
            "FY 2028-29",
            oa606("p71"),
            "unverified",
            [
                hist(
                    "2026-02-13",
                    "unverified",
                    "Listed in the state's compliance affidavit to the NGT.",
                    oa606("p71"),
                )
            ],
            "2027-06-01",
        ),
        commitment(
            "ap-ugd-madhurawada-ifc",
            "Sewerage",
            "Sewer connections in Madhurawada by FY 2029-30",
            state,
            "Sewer connections for Madhurawada, listed as an IFC-funded work, to bring a further 10% of the city's "
            "population onto the sewer network by FY 2029-30. GVMC's Madhurawada sewerage project is a separate row.",
            "FY 2029-30",
            oa606("p71"),
            "unverified",
            [
                hist(
                    "2026-02-13",
                    "unverified",
                    "Listed in the state's compliance affidavit to the NGT as 'Madhurawada (IFC)-2029-30(10%)'.",
                    oa606("p71"),
                )
            ],
            "2027-06-01",
        ),
        commitment(
            "ap-ugd-anakapalli-bheemili",
            "Sewerage",
            "Sewerage for Anakapalli, Bheemili and other areas by FY 2031-32",
            state,
            "Sewer connections for Anakapalli, Bheemili and other areas, to bring a further 15% of the city's population "
            "onto the sewer network by FY 2031-32. In March 2024 GVMC put sewerage for the Bheemili and Anakapalle areas at "
            "Rs 300 crore and Rs 250 crore, with the project reports still to be prepared.",
            "FY 2031-32",
            oa606("p71"),
            "unverified",
            [
                hist(
                    "2024-03-27",
                    "unverified",
                    "GVMC's sworn affidavit lists the Bheemili (Zone I) area at Rs 300 crore and the Anakapalle (Zone VII) "
                    "area at Rs 250 crore, both at 'DPR' stage, 'To be Prepared', among future proposals 'envisaged for "
                    "completion within a span of 3 to 4 years' (PDF p7).",
                    OA40_2024,
                ),
                hist(
                    "2026-02-13",
                    "unverified",
                    "Listed in the state's compliance affidavit to the NGT.",
                    oa606("p71"),
                ),
            ],
            "2028-01-01",
        ),
        amrut(
            "amrut-aptidco-stps-7-9-mld",
            "AP-GVMC-12041",
            "7.90 MLD of sewage treatment plants for APTIDCO housing colonies",
            36.73,
            "At Implementation Stage",
            "September 2026",
            "2026-09",
            "Contract Awarded",
            "overdue",
            category="Sewage treatment",
            what_extra=" The state's progress report for February 2024 lists four GVMC APTIDCO plants (4.00 MLD) as "
            "completed and eight more (3.90 MLD) as due by May 2024. Together they make the 7.90 MLD in the title, but we "
            "have not found a document that says they are this project.",
            earlier=(
                hist(
                    "2024-02",
                    "unverified",
                    "The state's progress report for February 2024 lists four GVMC APTIDCO plants, at Satyanarayanapuram, "
                    "Parawada, Dabbanda and Aganampudi (4.00 MLD in all), as completed with trial runs in progress, and "
                    "eight more (3.90 MLD) at 30% to 60% physical progress, with a completion timeline of May 2024.",
                    mpr_feb24("pp15-16, 19-20"),
                ),
                hist(
                    "2026-02-13",
                    "slipped",
                    "The state's affidavit lists the same eight plants under its AMRUT 2.0 AP TIDCO heading, 3.90 MLD in all, at 58% "
                    "to 85% physical progress, 'Work in progress', with a completion timeline of March 2026. The 4.00 MLD "
                    "completed by February 2024 and these 3.90 MLD add up to the 7.90 MLD in MoHUA's project title; reading "
                    "them as one project is an inference.",
                    oa606("p125, Annexure VII"),
                ),
            ),
            ap_status="slipped",
        ),
        amrut(
            "amrut-aptidco-sewer-network",
            "AP-GVMC-12175",
            "Sewerage network for 9,408 APTIDCO housing units",
            2.82,
            "At Implementation Stage",
            "June 2026",
            "2026-06",
            "Contract Awarded",
            "overdue",
            category="Sewerage",
        ),
        amrut(
            "amrut-thungalam-tank",
            "AP-GVMC-8818",
            "Rejuvenation of the water body at Thungalam",
            1.27,
            "At Implementation Stage",
            "September 2026",
            "2026-09",
            "Contract Awarded",
            "overdue",
            category="Water bodies",
            what_extra=" MoHUA's live list has no Thungalam row. It lists a 'Thimmaraju Tank' at the same cost, Rs 1.27 "
            "crore, which appears to be the same project under a new name; the live list has no project IDs and does not "
            "say so.",
            live_subject="'Thimmaraju Tank' (Rs 1.27 crore), which appears to be this project under a new name (the list "
            "has no project IDs and does not say so),",
        ),
        amrut(
            "amrut-aptidco-water-supply",
            "AP-GVMC-12135",
            "Internal water supply for 9,408 APTIDCO housing units",
            22.64,
            "At Implementation Stage",
            "September 2026",
            "2026-09",
            "Contract Awarded",
            "overdue",
        ),
        amrut(
            "amrut-aptidco-water-supply-five-sites",
            "AP-GVMC-12067",
            "Water supply for APTIDCO housing at ASR Nagar, Thalavaripalem, Actchamniadulova, Dabbanda and Trijunction",
            11.78,
            "At Implementation Stage",
            "September 2026",
            "2026-09",
            "Contract Awarded",
            "overdue",
        ),
        amrut(
            "amrut-pumping-mains-scada",
            "AP-GVMC-12858",
            "Replacing pumping mains, extending distribution mains into unserved areas, and SCADA for the network",
            55.00,
            "At Implementation Stage",
            "December 2026",
            "2026-12",
            "Contract Awarded",
            "unverified",
        ),
        amrut(
            "amrut-24x7-nrw-zones-3-5-8",
            "AP-GVMC-12873",
            "24x7 water supply and network improvement to reduce non-revenue water in Zones 3, 5 and 8",
            48.50,
            "At Implementation Stage",
            "March 2027",
            "2027-03",
            "Contract Awarded",
            "unverified",
        ),
        amrut(
            "amrut-samyavalasa-wtp",
            "AP-GVMC-12857",
            "10 MLD water treatment plant near Samyavalasa, Bheemili",
            13.71,
            "At Implementation Stage",
            "March 2027",
            "2027-03",
            "Contract Awarded",
            "unverified",
        ),
        amrut(
            "amrut-narava-industrial-main",
            "AP-GVMC-12875",
            "Treated-water main from Narava WTP to HPCL, Coromandel and the Navy berth",
            150.00,
            "NIT Stage",
            "March 2028",
            "2028-03",
            "NIT Issued",
            "unverified",
        ),
    ]
    return {
        "nvdm": "1.0",
        "dataset": "data-root/commitments",
        "scope": {"kind": "city", "id": CITY},
        "provenance": {
            "sources": [
                {
                    "id": sid,
                    "title": title,
                    "publisher": pub,
                    "license": registry_license(sid),
                }
                for sid, title, pub in [
                    (
                        "ngt-andhra-filings",
                        "GVMC, Government of AP and court records filed with the NGT",
                        "National Green Tribunal",
                    ),
                    (
                        "mohua-amrut-status-ap",
                        "AMRUT 2.0 status lists (AP, 05-03-2026; GVMC live list)",
                        "Ministry of Housing and Urban Affairs",
                    ),
                    (
                        "gvmc-whats-new",
                        GCAP_TITLE,
                        "Greater Visakhapatnam Municipal Corporation",
                    ),
                ]
            ],
            "method": "manual",
            "produced_at": today,
            "produced_by": "neer-vazhvu-api/scripts/build_visakhapatnam_commitments.py",
            "note": "Each commitment cites a dated official record: GVMC's and the state's own filings to the NGT, "
            "APPCB's reports to it, the AP High Court's orders recording GVMC's dates, or MoHUA's AMRUT 2.0 lists. The "
            "draft Green City Action Plan GVMC posted for public comment on 19 Oct 2024 is cited only for context and "
            "dated status records; a draft is not a commitment, so its 2034 water-loss target has no row. AMRUT "
            f"milestones checked against MoHUA's live list on {LIVE_CHECKED}.",
        },
        "place_id": CITY,
        "updated": today,
        "headline": "What Visakhapatnam has promised about its water and sewage, and by when",
        "intro": (
            "Most of the city's dated promises are about sewage: how much of the city is connected, how much is treated, "
            "and when the rest will be. They come from GVMC's and the state's own filings to the National Green Tribunal, "
            "the AP High Court's orders, and the national AMRUT 2.0 project lists. Where several documents date the same "
            "work, it has one row and every date is in its history. From the AMRUT 2.0 list the register carries every "
            "GVMC project of Rs 10 crore or more, and every project past its scheduled date that is not marked complete."
        ),
        "status_legend": {
            "delivered": "The promised thing verifiably happened, even if late. The dates show how late.",
            "on-track": "The stated date has not passed and a dated progress figure for the work is consistent with it.",
            "slipped": "The institution itself has moved the date and the latest date has not passed. Old and new dates "
            "are both shown.",
            "overdue": "The latest stated date, original or revised, has passed and we have not found a dated record of "
            "completion.",
            "stalled": "Work or approvals have stopped, by the institution's own account or a court's.",
            "unverified": "We can cite the promise but cannot yet cite its current status either way.",
        },
        "update_model": "History is kept, never overwritten. A status changes only against a dated citation.",
        "sources_note": (
            "GVMC's own notes, affidavits and reports to the National Green Tribunal and the High Court's committee "
            "(2021 to 2025), the Government of Andhra Pradesh's compliance affidavit (February 2026) and its monthly "
            "progress report for February 2024, APPCB's report to the Tribunal of 27 April 2026, the AP High Court's "
            "orders of 12 November 2025 and 11 March 2026, and MoHUA's AMRUT 2.0 lists. The draft Green City Action Plan "
            "(IFC for GVMC), posted by GVMC for comment on 19 Oct 2024, is cited for context only. Press reports are not "
            "used."
        ),
        "commitments": commitments,
    }


def main() -> int:
    today = date.today().isoformat()
    data = build(today)
    write_artifact(OUT, data, indent=1)
    print(
        f"wrote {len(data['commitments'])} commitments -> {OUT.relative_to(REPO_ROOT)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

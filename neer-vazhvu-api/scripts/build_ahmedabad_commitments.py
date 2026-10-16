#!/usr/bin/env python3
"""
Ahmedabad's dated water commitments, each with its source and dated status.

Every entry is a promise an institution made about Ahmedabad's water, sewage
or river, in its own document, with a date or a stated timeline; and every
status change cites a dated document. Quotes were checked against the source
text on 2026-10-14 (the Gujarati budget lines by their own printed digits).

What is deliberately not here: promises whose only record is press coverage,
and promises with neither a date nor a repeated status trail. The AMC budgets
carry far more items than this; the register keeps the ones a reader can
check.

Run:  python3 neer-vazhvu-api/scripts/build_ahmedabad_commitments.py
"""

import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

FR = "https://ahmedabadcity.gov.in/ViewFile/ViewFile?TYPE=FileRepository,{}"
B2223, B2324, B2627 = FR.format(2204), FR.format(2203), FR.format(2583)
B2526 = FR.format(2359)
MOHUA = "https://amrut.mohua.gov.in/assets/Status-of-Water-Supply-projects-with-Water-Treatement-Plant-as-on-02-03-2026.pdf"
CMO_KHARICUT = "https://cmogujarat.gov.in/en/latest-news/phase-2-kharicut-canal-redevelopment-project"
CMO_RIVERFRONT = "https://cmogujarat.gov.in/en/latest-news/gujarat-cm-sabarmati-riverfront-development-project-review"
# Renders by script; the text comes from POST /PressReleaseDetailsDataL (id=49644, LangId=2).
GI_GIFT = "https://gujaratinformation.gujarat.gov.in/PressReleaseDetailsL/?id=49644&DepId=36&DistrictId=0&LanguageId=2"
NGT91 = "https://www.greentribunal.gov.in/sites/default/files/news_updates/Affidavit%20in%20Reply%20by%20R-4%20in%20OA%20No.91-2023%20%28page%20nos.818-966%29.pdf"
NGT606 = "https://www.greentribunal.gov.in/sites/default/files/news_updates/PART-II%20REVISED%20SUBMISSIONS%20CUM%20AFFIDAVIT%20BY%20GOVT.%20OF%20GUJARAT%20IN%20OA%20NO.%20606%20of%202018%20(COMPLIANCE%20OF%20MSW%20MGT%20RULES,%202016%20AND%20OTHER%20ENVIRONMENTAL%20ISSUES).pdf"
REUSE = "http://faolex.fao.org/docs/pdf/ind200786.pdf"

L2223 = "AMC Budget 2022-23 (English)"
L2324 = "AMC Budget 2023-24 (English)"
L2526 = "AMC Budget 2025-26 (Gujarati)"
L2627 = "AMC Budget 2026-27 (Gujarati)"
LHC = "Gujarat High Court, Suo Motu PIL 98/2021, order of 2 May 2025 (annexed to AMC's reply in NGT OA 91/2023 WZ)"


def h(d, status, note, label, url):
    return {
        "date": d,
        "status": status,
        "note": note,
        "source_label": label,
        "source_url": url,
    }


COMMITMENTS = [
    {
        "id": "ahm-kotarpur-400-mld-wtp",
        "category": "Water supply",
        "title": "A new 400 MLD treatment plant at Kotarpur",
        "committed_by": "Ahmedabad Municipal Corporation, under AMRUT 2.0 (Tranche 3)",
        "what": "A 400 MLD water treatment plant at Kotarpur, the works that treats the city's Narmada canal water. Its stated cost has moved from Rs 118 crore (2023-24 budget) to Rs 138 crore (MoHUA, March 2026) to Rs 230.42 crore (2026-27 budget). MoHUA's AMRUT 2.0 status list gives a scheduled completion of 16 October 2026.",
        "due": "2026-10-16",
        "commitment_source": {
            "label": "MoHUA, Status of water supply projects with WTPs under AMRUT 2.0, as on 2 March 2026 (row 182)",
            "url": MOHUA,
            "date": "2026-03-02",
        },
        "status": "unverified",
        "status_history": [
            h(
                "2023-02",
                "unverified",
                "Listed among proposed AMRUT 2.0 Tranche 3 works: 'Water treatment plant of 400 MLD capacity at Kotarpur water works', Rs 118.00 crore.",
                f"{L2324}, printed p.120",
                B2324,
            ),
            h(
                "2026-02",
                "unverified",
                "Listed as a work in progress under the AMRUT scheme, at Rs 230.42 crore.",
                f"{L2627}, PDF p.118",
                B2627,
            ),
            h(
                "2026-03-02",
                "unverified",
                "Contract awarded; Rs 138.00 crore; scheduled completion 16-10-2026.",
                "MoHUA AMRUT 2.0 status list as on 02.03.2026",
                MOHUA,
            ),
            h(
                "2026-10-15",
                "unverified",
                "Re-checked the day before the scheduled date: MoHUA's portal still carries the list as on 02.03.2026, and no commissioning record or revised date has been published.",
                "MoHUA AMRUT 2.0 status list as on 02.03.2026, re-checked 15 October 2026",
                MOHUA,
            ),
        ],
        "next_check": "2026-10-17",
        "revised_due": None,
    },
    {
        "id": "ahm-jaspur-200-mld-wtp",
        "category": "Water supply",
        "title": "Add 200 MLD of treatment at Jaspur",
        "committed_by": "Ahmedabad Municipal Corporation",
        "what": "A further 200 MLD at the Jaspur plant on the Dholka branch canal, taking it from 400 to 600 MLD. Described as in progress in every AMC budget from 2022-23 to 2026-27; no completion date has been given in any of them.",
        "due": None,
        "commitment_source": {
            "label": f"{L2223}, p.93",
            "url": B2223,
            "date": "2022-02",
        },
        "status": "unverified",
        "status_history": [
            h(
                "2022-02",
                "unverified",
                "'construction of an additional water treatment plant of 300 MLD capacity at Kotarpur and 200 MLD at Jaspur is in progress.' The Kotarpur half was completed by February 2023.",
                f"{L2223}, p.93",
                B2223,
            ),
            h(
                "2023-02",
                "unverified",
                "Jaspur: 400 MLD existing, '200 MLD (work in progress)', 600 MLD total.",
                f"{L2324}, printed p.114",
                B2324,
            ),
            h(
                "2026-02",
                "unverified",
                "Still listed as work under way ('કામ ચાલુ : ૨૦૦'), alongside a planned 250 MLD at the estimate stage.",
                f"{L2627}, PDF p.114",
                B2627,
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ahm-24x7-supply-pilot",
        "category": "Water supply",
        "title": "24x7 metered supply, first phase",
        "committed_by": "Ahmedabad Municipal Corporation",
        "what": "'In the first phase it has been decided to provide 24x7 water supply in command areas of newly constructed water distribution stations by placing water meters', in named areas of Jodhpur, Gota, Thaltej, Chandlodiya, Nikol and Vastral wards. The same budget says all connections were then unmetered and supply averaged two hours a day. No date was given.",
        "due": None,
        "commitment_source": {
            "label": f"{L2324}, printed pp.125-126",
            "url": B2324,
            "date": "2023-02",
        },
        "status": "unverified",
        "status_history": [
            h(
                "2023-02",
                "unverified",
                "First phase announced; no date, no connection count.",
                f"{L2324}, printed pp.125-126",
                B2324,
            ),
            h(
                "2025-02",
                "unverified",
                "Repeated word for word from the 2024-25 budget, still as a plan: 'વોટર મીટર મુકી ૨૪ x ૭ વોટર સપ્લાય સ્કીમનો અમલ કરવાનું આયોજન હાથ ધરેલ છે' (planning has been taken up to run the 24x7 scheme with water meters), with the first 20,000 litres a month per unit covered by the fixed water charge.",
                f"{L2526}, printed p.63",
                B2526,
            ),
            h(
                "2026-02",
                "unverified",
                "The 2026-27 budget does not mention 24x7 supply. Whether it runs in any of the named areas: no public source found.",
                L2627,
                B2627,
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ahm-borewell-to-surface-water",
        "category": "Water supply",
        "title": "Move borewell-fed areas onto surface water within three years",
        "committed_by": "Ahmedabad Municipal Corporation",
        "what": "For the areas merged into the city, AMC planned 'to construct new water distribution stations to convert borewell water supply to surface water supply in three years'. Its 2026-27 budget still lists 555 borewells supplying 100 MLD across the city; whether those are in the merged areas the promise covered is not stated.",
        "due": "2026",
        "commitment_source": {
            "label": f"{L2324}, printed p.119",
            "url": B2324,
            "date": "2023-02",
        },
        "status": "slipped",
        "status_history": [
            h(
                "2023-02",
                "unverified",
                "Three-year plan stated, with new distribution stations listed under AMRUT.",
                f"{L2324}, printed p.119",
                B2324,
            ),
            h(
                "2025-02",
                "slipped",
                "The aim is restated with a new three-year window, in the same words as the 2024-25 budget: 'બોરવેલ આધારિત વોટર સપ્લાયને આગામી ત્રણ વર્ષમાં સરફેસ વોટર આધારિત કરવા' (to move borewell-based supply onto surface water in the next three years). Read the same way as the 2023-24 promise, the window now runs to 2028.",
                f"{L2526}, printed p.85",
                B2526,
            ),
            h(
                "2026-02",
                "slipped",
                "No window is restated. 555 borewells, 315 MLD capacity, 100 MLD in use, city-wide.",
                f"{L2627}, printed p.63",
                B2627,
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": "2028",
    },
    {
        "id": "ahm-drainage-master-plan-2050",
        "category": "Sewerage and storm water",
        "title": "A sewerage and storm-water master plan to 2050",
        "committed_by": "Ahmedabad Municipal Corporation, Drainage Project",
        "what": "A consultant's master plan for the city's sewerage and storm-water needs in 2050: 'the final master plan will be submitted by March 2023.'",
        "due": "2023-03",
        "commitment_source": {
            "label": f"{L2324}, printed p.134",
            "url": B2324,
            "date": "2023-02",
        },
        "status": "overdue",
        "status_history": [
            h(
                "2023-02",
                "on-track",
                "Inception report and need assessment submitted; final plan due by March 2023.",
                f"{L2324}, printed p.134",
                B2324,
            ),
            h(
                "2026-02",
                "overdue",
                "Listed as the first of the drainage project's targets for the coming year: a 30-year city sewage and storm-water master plan. No published plan found.",
                f"{L2627}, PDF p.122",
                B2627,
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ahm-kharicut-phase-1",
        "category": "Sewerage and storm water",
        "title": "Redevelop the Kharicut canal, phase 1, within two years",
        "committed_by": "Ahmedabad Municipal Corporation, with the Government of Gujarat",
        "what": "The Kharicut, an irrigation canal dug in 1878-81 that now runs through the city's eastern industrial belt, is being rebuilt as closed boxes with a road above, from the Naroda crematorium to Vinzol. In February 2023 AMC's Standing Committee chair said 'the entire project will be completed within two years.'",
        "due": "2025-02",
        "commitment_source": {
            "label": f"{L2324}, Standing Committee statement, printed p.5",
            "url": B2324,
            "date": "2023-02",
        },
        "status": "overdue",
        "status_history": [
            h(
                "2023-02",
                "on-track",
                "Five packages, Rs 1,200 crore; work on four had begun.",
                f"{L2324}, printed p.5",
                B2324,
            ),
            h(
                "2025-03-11",
                "overdue",
                "'80% of Development Work Completed on the 12.75 km stretch'; over Rs 700 crore spent of Rs 1,338 crore allocated for phase 1.",
                "Chief Minister's Office, Gujarat, press release, 11 March 2025",
                CMO_KHARICUT,
            ),
            h(
                "2026-02",
                "overdue",
                "12.5 km in five packages at Rs 1,100 crore, 'nearing completion'.",
                f"{L2627}, PDF p.132",
                B2627,
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ahm-stp-sola-jagatpur",
        "category": "Sewage treatment",
        "title": "Sola (30 MLD) and Jagatpur (15 MLD) sewage treatment plants",
        "committed_by": "Ahmedabad Municipal Corporation, by affidavit to the Gujarat High Court",
        "what": "In the court's suo motu case on Sabarmati pollution, AMC's affidavit made 'the categorical statement that two STPs namely 30 MLD Sola and 15 MLD Jagatpur are expected to be completed by the September, 2025'.",
        "due": "2025-09",
        "commitment_source": {"label": LHC, "url": NGT91, "date": "2025-05-02"},
        "status": "overdue",
        "status_history": [
            h(
                "2025-05-02",
                "on-track",
                "Completion by September 2025 recorded in the order.",
                LHC,
                NGT91,
            ),
            h(
                "2026-02",
                "overdue",
                "Both listed as work in progress: Sola at Rs 81.00 crore, Jagatpur at Rs 64.00 crore.",
                f"{L2627}, PDF p.123",
                B2627,
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ahm-stp-vinzol-75",
        "category": "Sewage treatment",
        "title": "Vinzol 75 MLD sewage treatment plant",
        "committed_by": "Ahmedabad Municipal Corporation, by affidavit to the Gujarat High Court",
        "what": "In the same affidavit: '75 MLD Vinzol is expected to be completed by 15.02.2026.'",
        "due": "2026-02-15",
        "commitment_source": {"label": LHC, "url": NGT91, "date": "2025-05-02"},
        "status": "overdue",
        "status_history": [
            h(
                "2025-05-02",
                "on-track",
                "Completion by 15 February 2026 recorded in the order.",
                LHC,
                NGT91,
            ),
            h(
                "2026-02",
                "overdue",
                "Still listed as being built, at about Rs 145.03 crore.",
                f"{L2627}, PDF p.123",
                B2627,
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "guj-reuse-70-percent-by-2025",
        "category": "Wastewater reuse",
        "title": "Reuse 70% of treated wastewater by 2025",
        "committed_by": "Government of Gujarat, Urban Development and Urban Housing Department (binding on municipal bodies)",
        "what": "Gujarat's Policy for Reuse of Treated Waste Water (28 May 2018) sets the objectives 'To reuse 70% of TWW by 2025' and 'To reuse 100% of TWW by 2030.' It names no separate target for Ahmedabad.",
        "due": "2025",
        "commitment_source": {
            "label": "Government of Gujarat, Policy for Reuse of Treated Waste Water, 28 May 2018, p.7 (FAOLEX copy)",
            "url": REUSE,
            "date": "2018-05-28",
        },
        "status": "overdue",
        "status_history": [
            h(
                "2018-05-28",
                "on-track",
                "Policy notified.",
                "Policy for Reuse of Treated Waste Water, p.7",
                REUSE,
            ),
            h(
                "2026-03-18",
                "overdue",
                "The state's own affidavit to the NGT gives Ahmedabad's level of utilisation of treated sewage as 26%.",
                "Government of Gujarat, Part-II revised submissions cum affidavit in NGT OA 606/2018, 18 March 2026, Annex I",
                NGT606,
            ),
        ],
        "next_check": "2027-03-01",
        "revised_due": None,
    },
    {
        "id": "ahm-riverfront-all-phases-2027",
        "category": "River",
        "title": "Finish the riverfront's three Gandhinagar phases by the end of 2027",
        "committed_by": "Government of Gujarat; the Water Resources Department builds the stretch",
        "what": "'The works under all three phases of the project are expected to be completed by the end of 2027.' The three phases are 4 to 6: 17.20 km in Gandhinagar, from the Narmada Canal at Karai via PDEU and Shahpur Bridge to Chiloda Bridge. Phases 2 and 3 in Ahmedabad (Dafnala to Indira Bridge, and on to the Narmada canal) are separate projects with their own dates.",
        "due": "2027-12",
        "commitment_source": {
            "label": "Chief Minister's Office, Gujarat, press release, 6 June 2026",
            "url": CMO_RIVERFRONT,
            "date": "2026-06-06",
        },
        "status": "on-track",
        "status_history": [
            h(
                "2026-06-06",
                "unverified",
                "Completion date stated at a site review.",
                "Chief Minister's Office, Gujarat, press release, 6 June 2026",
                CMO_RIVERFRONT,
            ),
            h(
                "2026-08-11",
                "on-track",
                "The Chief Minister said at GIFT City: 'અમદાવાદના સાબરમતી રિવરફ્રન્ટને ગિફ્ટ સિટી સુધી લંબાવવાનું કામ પૂરજોશમાં પ્રગતિ હેઠળ છે' (the work to extend the Sabarmati Riverfront up to GIFT City is progressing in full swing). No revised date has been given.",
                "Chief Minister's Office, Gujarat, release via the Information Department (Gujarati), 11 August 2026",
                GI_GIFT,
            ),
        ],
        "next_check": "2027-06-01",
        "revised_due": None,
    },
]

SOURCE_IDS = [
    (
        "amc-budget",
        "AMC budgets 2022-23, 2023-24, 2025-26 and 2026-27",
        "Ahmedabad Municipal Corporation",
    ),
    (
        "gujarat-hc-sabarmati-pil",
        "Gujarat High Court, Suo Motu PIL 98/2021 (Sabarmati pollution), orders as annexed to NGT filings",
        "High Court of Gujarat",
    ),
    (
        "ngt-gujarat-filings",
        "NGT filings by the Government of Gujarat and AMC (OA 606/2018, OA 91/2023 WZ)",
        "National Green Tribunal",
    ),
    (
        "mohua-amrut-status",
        "MoHUA AMRUT 2.0 project status lists",
        "Ministry of Housing and Urban Affairs",
    ),
    (
        "cmo-gujarat-press",
        "Chief Minister's Office, Gujarat: press releases",
        "Government of Gujarat",
    ),
    (
        "gujarat-reuse-policy-2018",
        "Policy for Reuse of Treated Waste Water, 2018",
        "Government of Gujarat",
    ),
]


def main() -> int:
    today = date.today().isoformat()
    out = {
        "nvdm": "1.0",
        "dataset": "data-root/commitments",
        "scope": {"kind": "city", "id": "ahmedabad"},
        "provenance": {
            "sources": [
                {
                    "id": sid,
                    "title": title,
                    "publisher": pub,
                    "license": registry_license(sid),
                }
                for sid, title, pub in SOURCE_IDS
            ],
            "method": "manual",
            "produced_at": today,
            "produced_by": "neer-vazhvu-api/scripts/build_ahmedabad_commitments.py",
            "note": "Each promise and each status change cites a dated document; quotes checked against the source text.",
        },
        "place_id": "ahmedabad",
        "updated": today,
        "headline": "What has been promised about Ahmedabad's water, and by when",
        "intro": (
            "Ten commitments on supply, sewage, the Kharicut canal, reuse and the riverfront, eight "
            "of them dated, from AMC's budgets, its affidavits to the Gujarat High Court, the state's "
            "reuse policy and the Chief Minister's Office. Five dates have passed with no delivery we "
            "can cite; one has been moved by AMC itself; the others are still ahead or were never "
            "given a date."
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
            "Statuses change only against a dated citation. The register is re-checked each February "
            "against AMC's new budget, against the Gujarat High Court's orders in the Sabarmati case, and "
            "against MoHUA's AMRUT 2.0 status lists. A passed next-check date with no new citation is "
            "flagged, never silently updated."
        ),
        "sources_note": (
            "Budget quotes are from AMC's English budgets for 2022-23 and 2023-24 and its Gujarati "
            "budgets for 2025-26 and 2026-27, whose figures were read from the documents' own printed "
            "digits. Where two "
            "official documents give different costs for the same work, both are stated."
        ),
        "commitments": COMMITMENTS,
    }
    overdue = sum(c["status"] == "overdue" for c in COMMITMENTS)
    assert overdue == 5 and len(COMMITMENTS) == 10, "update the intro's counts"
    path = REPO_ROOT / "public" / "data" / "commitments-ahmedabad.json"
    write_artifact(path, out)
    print(
        f"{len(COMMITMENTS)} commitments ({overdue} overdue) -> {path.name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

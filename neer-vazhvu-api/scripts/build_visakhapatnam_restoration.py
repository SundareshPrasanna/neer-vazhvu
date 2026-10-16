#!/usr/bin/env python3
"""Visakhapatnam lake-restoration page data: flagship water bodies and the
AMRUT 2.0 water-body rejuvenation projects.

Hand-compiled from the research reports of 14 Oct 2026; every figure carries
its document, page and date in the record text or _conflicts. Written through
nvdm_write.write_artifact with the envelope in the first payload.

Run:  python3 neer-vazhvu-api/scripts/build_visakhapatnam_restoration.py
"""

import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

TODAY = date.today().isoformat()
SCOPE = {"kind": "city", "id": "visakhapatnam"}
RETRIEVED = "2026-10-14"

# Documents (URLs as opened by the research agents on 14 Oct 2026).
AMRUT_PDF = (
    "https://amrut.mohua.gov.in/assets/"
    "Status-of-Approved-Projects-under-AMRUT-2-in-Andhra-Pradesh-as-on-05-03-2026_.pdf"
)
AMRUT_LIVE = (
    "https://amrut.mohua.gov.in/approvedProjects/list/"
    "bE45Yjhjd3ovYVZaSnRUdTJpbnE0UT09/YWgzMHUxWkJFeHJGMlFDaUExZ2tFQT09"
)
IEE_MUDASARLOVA = (
    "https://www.gvmc.gov.in/wss/image_uploads/Developing%20and%20Rejuvenation%20of%20"
    "Mudasarlova%20Catchment%20area%20(UCCRTF05)%20-%20IEE%20-%20Oct%202018.pdf"
)
DDR_MUDASARLOVA = (
    "https://www.gvmc.gov.in/wss/image_uploads/Developing%20and%20Rejuvenation%20of%20"
    "Mudasarlova%20Catchment%20area%20(UCCRTF05)%20-%20DDR%20-%20Sep%202018.pdf"
)
IEE_MEGHADRIGEDDA = (
    "https://www.gvmc.gov.in/wss/image_uploads/Developing%203MWp%20Solar%20Energy%20Park%20at%20"
    "Meghadrigedda%20(UCCRT04)%20-%20IEE%20-%20Oct%202018.pdf"
)
IEE_NW_SECTOR = (
    "https://www.gvmc.gov.in/wss/image_uploads/24x7%20Water%20Supply%20in%20North-West%20sector%20"
    "(GVMC02)%20-%20IEE%20-%20Jan%202019.pdf"
)
GCAP = "https://www.gvmc.gov.in/WhatsNew/Whats_New_DocOct_658.pdf"
NGT_APPCB = "https://www.greentribunal.gov.in/sites/default/files/news_updates/1421.pdf"
NGT_GVMC = (
    "https://www.greentribunal.gov.in/sites/default/files/news_updates/1421_0.pdf"
)
APWRIMS = "https://apwrims.ap.gov.in/"
CPCB_NWMP = "https://cpcb.gov.in/nwmp-data-2024/"
CGWB_2025 = (
    "https://cgwb.gov.in/cgwbpnm/public/uploads/documents/1750331736769645187file.pdf"
)
GAZETTEER = "https://archive.org/details/vizagapatam01madr"
VMRDA_DMP = "http://vmrda.gov.in/masterplan-2041/DMPreports.pdf"
MOEFCC_WETLANDS = "https://indianwetlands.in/wetlands-overview/indias-wetlands-of-international-importance/"
NRLD = "https://cwc.gov.in/sites/default/files/nrld-2019.pdf"
RINL_BRIEF = (
    "https://environmentclearance.nic.in/writereaddata/Online/TOR/"
    "27_Mar_2018_124416820C83DN5JFBriefWriteUp.pdf"
)
RINL_PFR = (
    "https://environmentclearance.nic.in/writereaddata/Online/TOR/"
    "29_Mar_2018_161925363K0QEK7UDUploadedPFR.pdf"
)


def reg(sid, title, publisher, **extra):
    return {
        "id": sid,
        "title": title,
        "publisher": publisher,
        "license": registry_license(sid),
        **extra,
    }


# ── Restoration projects ────────────────────────────────────────────────────

# (project id, water body as MoHUA prints it, cost Rs crore, completed?)
# MoHUA AMRUT 2.0 status for Andhra Pradesh as on 05.03.2026, S.no 44-54 (PDF pp.5-6).
AMRUT_ROWS = [
    ("AP-GVMC-8706", "Natayyapalem", 2.00, True),
    ("AP-GVMC-8714", "Akkireddypalem", 2.00, True),
    ("AP-GVMC-8791", "Lankelapalem", 1.04, True),
    ("AP-GVMC-8795", "Kommadi Cheruvu", 3.45, True),
    ("AP-GVMC-8801", "Narava", 1.15, True),
    ("AP-GVMC-8810", "Jaggarajupeta", 0.91, True),
    ("AP-GVMC-8813", "Chinagantyada", 0.67, True),
    ("AP-GVMC-8818", "Thungalam", 1.27, False),
    ("AP-GVMC-8843", "Mindhi", 0.52, True),
    ("AP-GVMC-8853", "Kranthi Nagar", 3.30, True),
    ("AP-GVMC-8691", "Chillapeta", 7.00, True),
]


def amrut_project(pid, body, cost, done):
    scope = (
        f"Rejuvenation of the water body at {body}, one of the 11 GVMC tanks in the "
        f"water-body component of AMRUT 2.0 (MoHUA project {pid})."
    )
    sources = [AMRUT_PDF]
    if pid == "AP-GVMC-8818":
        scope += (
            " MoHUA's live AMRUT 2.0 project list for GVMC (checked 14 Oct 2026) has no "
            "Thungalam row. It has 12 GVMC water-body projects, Rs 25.31 crore in all: "
            "ten of the 5 March tanks under the same names and costs (Rs 22.04 crore), "
            "a new Rs 2.00 crore Rajupalem project and, in place of Thungalam, a "
            "Rs 1.27 crore 'Thimmaraju Tank' project at Contract Awarded. This appears "
            "to be the same project under a new name; MoHUA's live list has no project "
            "IDs and does not say so."
        )
        sources.append(AMRUT_LIVE)
    status = (
        "Completed (MoHUA status as on 5 March 2026)"
        if done
        else "Being implemented; scheduled completion September 2026 "
        "(MoHUA status as on 5 March 2026)"
    )
    return {
        "scheme_name": f"Rejuvenation of water body at {body} (AMRUT 2.0)",
        "operator": "Greater Visakhapatnam Municipal Corporation (GVMC)",
        "scope": scope,
        "funding_summary": f"AMRUT 2.0 project cost Rs {cost:.2f} crore.",
        "amount_cr": cost,
        "financier": "AMRUT 2.0 (Ministry of Housing and Urban Affairs mission)",
        "status": status,
        "project_id": pid,
        "water_body": body,
        "sources": sources,
        "source_ids": ["mohua-amrut-status-ap"],
    }


projects = [amrut_project(*row) for row in AMRUT_ROWS]
total = round(sum(p["amount_cr"] for p in projects), 2)
assert total == 23.31, total
assert sum(1 for r in AMRUT_ROWS if r[3]) == 10
# Live-list arithmetic in the Thungalam scope: the ten other 5 March tanks,
# plus Rajupalem and Thimmaraju, make the live list's Rs 25.31 crore.
assert round(total - 1.27, 2) == 22.04
assert round(22.04 + 2.00 + 1.27, 2) == 25.31

restoration = {
    "nvdm": "1.0",
    "dataset": "data-root/restoration-projects",
    "scope": SCOPE,
    "provenance": {
        "sources": [
            reg(
                "mohua-amrut-status-ap",
                "Status of Approved Projects under AMRUT 2.0 in Andhra Pradesh (as on "
                "05.03.2026), GVMC water-body rejuvenation rows S.no 44-54; and MoHUA's "
                "live AMRUT 2.0 project list for GVMC, checked 14 Oct 2026 (Rajupalem and "
                "Thimmaraju Tank rows)",
                "Ministry of Housing and Urban Affairs",
                url=AMRUT_PDF,
                as_of="2026-03-05",
                retrieved=RETRIEVED,
            )
        ],
        "method": "manual",
        "produced_at": TODAY,
        "produced_by": "neer-vazhvu-api/scripts/build_visakhapatnam_restoration.py",
        "note": (
            "The 11 GVMC water-body projects in MoHUA's AMRUT 2.0 status list for Andhra "
            "Pradesh as on 5 March 2026: Rs 23.31 crore in all, 10 completed, one being "
            "implemented. Per-record sources carry the citation."
        ),
    },
    "place_id": "visakhapatnam",
    "compiled_at": TODAY,
    "note": (
        "Visakhapatnam's dated, budgeted lake work is the AMRUT 2.0 water-body component: "
        "11 GVMC tanks, Rs 23.31 crore, 10 marked completed in MoHUA's 5 March 2026 list. "
        "MoHUA's live list (checked 14 Oct 2026) also shows a 12th, Rajupalem tank in the "
        "Anakapalli division of GVMC, Rs 2.00 crore at DPR stage; it is not in the 5 March "
        "list and is not carried here. Proposals without a sanction (the ponds and sponge "
        "parks proposed in the draft Green City Action Plan, prepared by the IFC for GVMC "
        "and posted by GVMC for comment on 19 Oct 2024) are not programmes and are left "
        "out. Flagship cards come from GVMC's own documents for the ADB (three initial "
        "environmental examinations and a resettlement due-diligence report, 2018-2019), "
        "the draft Green City Action Plan, the National Register of Large Dams, APWRIMS, "
        "CPCB lake monitoring, filings to the National Green Tribunal, RINL's 2018 filing "
        "to MoEFCC, VMRDA's draft master plan (2021), CGWB's 2025 aquifer plan, the MoEFCC "
        "wetlands portal and the 1907 district gazetteer, with conflicting figures shown "
        "side by side. No list of lost tanks is shown: we have not found a published "
        "official one."
    ),
    "_court_orders_note": (
        "Empty. We have not found a court or tribunal order about a Visakhapatnam lake or "
        "tank to this file's standard (court, case number, date and the order or a primary "
        "report of it). The NGT's public judgment search offers a date range and a captcha only, "
        "with no party or keyword search, so this is a gap in what could be searched, not "
        "a finding that no case exists."
    ),
    "projects": projects,
    "court_orders": [],
}

# ── Flagship water bodies ───────────────────────────────────────────────────

bodies = [
    {
        "name": "Mudasarlova Reservoir",
        "alternate_names": ["Mudasarlova lake"],
        "type": "reservoir",
        "year_built": None,
        "era": "Built 1902 (GVMC); handed to the town council in May 1903 (1907 gazetteer)",
        "builder": "Public Works Department, for the town council",
        "feed": "Hill streams from Dharapalem and Kambalakonda; catchment 16.4 sq km",
        "status": (
            "The city's oldest piped-water source, owned and maintained by GVMC. On 11 March "
            "2021, GVMC's one-day supply status filed with the National Green Tribunal shows "
            "nothing supplied from it, against a normal 0.50 million gallons a day. GVMC's 2018 "
            "environmental assessment for "
            "an ADB-funded lake project gives its storage as 1.5 million cubic metres, which "
            "it calls the original capacity, and 0.75 million cubic metres as the present "
            "capacity at full tank level, with no survey or date behind either figure. It says "
            "the lake and its catchment have changed over the years, and proposed desilting "
            "the lake bed. The "
            "same report found two of its three inlets still flowing in: the stream from the "
            "Kailasa hills stopped reaching it after a compound wall, a trench and the BRTS road "
            "were built across its path."
        ),
        "cultural_note": (
            "The 1907 district gazetteer describes the town's first water works: the "
            "perennial Hanumanta Vanka stream near Simhachalam 'dammed up to form a reservoir "
            "with a catchment area of six square miles and a capacity of 25 million cubic "
            "feet', piped 5.5 miles to a service reservoir near the jail. Waltair stayed on "
            "wells. The gazetteer does not use the name Mudasarlova; the stream, the hills "
            "and the catchment match it. The park around the lake is one of the oldest public "
            "parks in Andhra Pradesh (GVMC, 2018)."
        ),
        "confidence": "V",
        "sources": [IEE_MUDASARLOVA, DDR_MUDASARLOVA, GAZETTEER, NGT_GVMC, NGT_APPCB],
        "source_ids": [
            "gvmc-adb-mudasarlova-2018",
            "historical-gazetteers-visakhapatnam",
            "ngt-andhra-filings",
            "gvmc-adb-iee-24x7-nw-2019",
            "cgwb-visakhapatnam-aquifer-plans",
        ],
        "_conflicts": [
            "Year: GVMC's 2018 IEE (p.7) and DDR (p.8) say built in 1902, as does CGWB's 2025 "
            "aquifer plan (Table 9.1); the 1907 Madras District Gazetteer (Francis, p.217) says "
            "the works were handed to the council in May 1903.",
            "Capacity: 25 million cubic feet (about 0.71 million cubic metres) when the works "
            "were handed over in 1903 (1907 gazetteer, p.217, for the Hanumanta Vanka "
            "reservoir it describes); 1.5 million cubic metres as the original capacity and "
            "0.75 million cubic metres at present (GVMC IEE 2018, pp.15, 18). The IEE gives "
            "no survey or date for either of its figures.",
            "Water spread: the IEE (p.7) gives 8.1 ha; not shown, because it does not fit the "
            "1.5 million cubic metres of storage the same IEE gives (p.15); present capacity 0.75 million cubic metres is on p.18.",
            "Output: 0.00 MGD present against 0.50 MGD normal on 11 March 2021 (GVMC daily "
            "supply status, NGT OA 14/2021 (SZ) annexure); 1.82 MLD in APPCB's 2021 report to the "
            "NGT (p.3), the same figure as GVMC's ADB source table (Table 4 of the 24x7 NW "
            "sector IEE; demand columns for 2014; draft March 2016, final January 2019); 4.5 "
            "MLD in CGWB's 2025 source table (Table 9.1).",
        ],
    },
    {
        "name": "Meghadrigedda Reservoir",
        "alternate_names": ["Meghadri Gedda Reservoir", "MGR"],
        "type": "reservoir",
        "year_built": 1977,
        "feed": "The Meghadri Gedda and the Naravagedda; catchment about 368 sq km",
        "capacity_tmc": 1.169,
        "status": (
            "A live drinking-water source at Kamarapalem on the city's western side, fed by "
            "the Meghadri Gedda and the Naravagedda. On 11 March 2021, GVMC's one-day supply "
            "status filed with the National Green Tribunal shows 8.44 million gallons a day "
            "supplied from it (5.40 to the Mindhi plant and 3.04 of raw water to the Naval "
            "Dockyard (DGNP) and MES), against a normal 7.65. CWC's National Register of "
            "Large Dams (2019) lists the dam as operated and maintained by the state Water "
            "Resources Department, which reports its level and storage daily on APWRIMS, "
            "with a design capacity of 1.169 TMC. In 2018 GVMC prepared an ADB-funded 3 MWp "
            "floating solar subproject on the reservoir; its assessment describes the "
            "reservoir surface as owned by GVMC."
        ),
        "cultural_note": (
            "Built in 1977 and commissioned in 1979 with 29.31 million cubic metres of "
            "storage. In 1989 its drawal was raised to 10 million gallons a day and its "
            "storage to 33.1024 million cubic metres at a full reservoir level of 18.60 m "
            "(GVMC, 2018)."
        ),
        "confidence": "V",
        "sources": [IEE_MEGHADRIGEDDA, NGT_APPCB, APWRIMS, NGT_GVMC, NRLD],
        "source_ids": [
            "gvmc-adb-iee-meghadrigedda-solar-2018",
            "ngt-andhra-filings",
            "apwrims-reservoirs",
            "cwc-nrld-2019",
            "gvmc-adb-iee-24x7-nw-2019",
            "cgwb-visakhapatnam-aquifer-plans",
        ],
        "_conflicts": [
            "Year: CWC's National Register of Large Dams 2019 (p.59, 'Mehadrigedda', "
            "AP01MH0042) gives completion in 1977, and GVMC's 2018 floating-solar IEE (p.15) "
            "says constructed 1977 and commissioned 1979; CGWB's 2025 aquifer plan (Table 9.1) "
            "lists 1976.",
            "Capacity: APWRIMS design capacity 1.169 TMC (about 33.1 million cubic metres), "
            "agreeing with the IEE's 33.1024 and the National Register's gross storage of "
            "33,102,000 cubic metres; GVMC's 2021 filing to the NGT gives 1.0 TMC.",
            "Catchment: about 368 sq km (IEE 2018, p.15) against 374 (APPCB 2021, p.2, printed as 'Sq.mtr').",
            "Drawal: 10 MGD capacity from 1989 (IEE 2018); 8.44 MGD present (5.40 to the "
            "Mindhi plant, 3.04 of raw water to the Naval Dockyard (DGNP) and MES), 7.65 "
            "normal on 11 March 2021 (GVMC daily supply status); about 8.00 MGD (GVMC "
            "narrative to the NGT, 2021); 41.0 MLD in APPCB's 2021 report (p.2), the same "
            "figure as GVMC's ADB source table (Table 4 of the 24x7 NW sector IEE; demand "
            "columns for 2014; draft March 2016, final January 2019).",
        ],
    },
    {
        "name": "Kondakarla Ava",
        "alternate_names": ["Kondakarla lake"],
        "type": "lake",
        "year_built": None,
        "era": "Natural lake",
        "feed": "A channel from the Sarada river",
        "status": (
            "A natural freshwater lake at Kondakarla in Atchutapuram mandal, Anakapalli "
            "district, south-west of the city, fed by a channel from the Sarada. It does not "
            "appear among GVMC's listed water sources. It is in the state Water Resources "
            "Department's minor-irrigation tank register (MI012625). CPCB samples it as a lake "
            "station (2353) under the national water-quality programme: the lowest "
            "dissolved-oxygen reading each year was 2.5 to 3.6 mg/L in 2020 to 2023, under "
            "the 5 mg/L CPCB prints as its bathing-water criterion, and 4.5 mg/L in 2024."
        ),
        "cultural_note": (
            "In 1907 the district gazetteer called it 'the pretty natural lake six miles south "
            "of Anakapalle', which 'swarms with lotuses, fish and wildfowl', one of 'the very "
            "few real freshwater lakes in the Presidency'. Its irrigation chapter (p.105) adds "
            "that the lake 'has been artificially enlarged'. VMRDA's draft master plan (June "
            "2021) calls it a bird sanctuary with 70 species of birds. It is not on the "
            "MoEFCC wetlands portal's Ramsar list or its wetlands of international "
            "significance (checked 14 Oct 2026)."
        ),
        "confidence": "V",
        "sources": [GAZETTEER, CPCB_NWMP, APWRIMS, VMRDA_DMP, MOEFCC_WETLANDS],
        "source_ids": [
            "historical-gazetteers-visakhapatnam",
            "cpcb-nwmp-visakhapatnam",
            "apwrims-mi-tanks",
            "vmrda-draft-master-plan-2041",
            "moefcc-wetlands-portal",
        ],
        "_conflicts": [
            "Size claim: VMRDA's draft master plan (June 2021, p.52) calls it 'the largest "
            "fresh-water lake in the state of Andhra Pradesh'; the MoEFCC wetlands portal lists "
            "Kolleru, 90,100 ha, as the state's Ramsar wetland. Recorded, not resolved.",
            "Dissolved-oxygen minimum by year, CPCB NWMP station 2353: 2019 5.0, 2020 3.6, "
            "2021 3.0, 2022 3.4, 2023 2.5, 2024 4.5 mg/L.",
        ],
    },
    {
        "name": "Kanithi Balancing Reservoir",
        "alternate_names": [
            "Kanthi Balancing Reservoir",
            "Kannati balancing reservoir",
            "KBR",
        ],
        "type": "balancing_reservoir",
        "year_built": None,
        "builder": "RINL (Visakhapatnam Steel Plant), for the new reservoir begun in July 2016",
        "feed": "The Yeleru Left Main Canal, carrying Yeleru and Godavari water",
        "status": (
            "The tail-end point of the Yeleru canal. The draft Green City Action Plan (IFC for "
            "GVMC), posted by GVMC for comment on 19 Oct 2024, says the Yeleru and Godavari "
            "source supplies 60 percent of the city's water demand. GVMC's source table for "
            "the ADB (draft March 2016, final January 2019; its demand figures are for 2014) "
            "lists 9.09 MLD available from filtration at the reservoir. The Visakhapatnam Steel Plant (RINL) began a new Kanithi balancing reservoir in July 2016, on 225 acres, "
            "costed at Rs 465.85 crore in its 2018 expansion filing to MoEFCC."
        ),
        "confidence": "V",
        "sources": [GCAP, IEE_NW_SECTOR, RINL_BRIEF, RINL_PFR],
        "source_ids": [
            "gvmc-whats-new",
            "gvmc-adb-iee-24x7-nw-2019",
            "industry-ec-compliance-visakhapatnam",
        ],
        "_conflicts": [
            "Name: the draft Green City Action Plan spells it Kannati, RINL's 2018 filing "
            "Kanthi, OpenStreetMap Kanithi.",
            "We have not found an official date or capacity for the first Kanithi reservoir; "
            "the 2016 work is RINL's new reservoir (brief p.2; PFR land and cost tables).",
        ],
    },
    {
        "name": "Gambheeram Reservoir",
        "alternate_names": ["Gambhiramgedda Reservoir", "Gambheeram Gadda Reservoir"],
        "type": "reservoir",
        "year_built": 1957,
        "feed": "The Gambheeram gedda; dam at Boyapalem, Anandapuram mandal",
        "status": (
            "An irrigation reservoir on the city's north-eastern side that also supplies the city "
            "for part of the year: water goes to GVMC from 1 March to 30 June every year. On "
            "11 March 2021, GVMC's one-day supply status filed with the NGT shows nothing "
            "supplied from it, against a normal 0.60 million gallons a day. Most of its 640-acre "
            "command area is now "
            "built up; about 250 acres were still irrigated in 2021 (APPCB to the National "
            "Green Tribunal). CWC's National Register of Large Dams (2019) lists the dam as "
            "operated and maintained by the state Water Resources Department, with a gross "
            "storage of 3.18 million cubic metres."
        ),
        "confidence": "V",
        "sources": [NRLD, NGT_APPCB, NGT_GVMC],
        "source_ids": [
            "cwc-nrld-2019",
            "ngt-andhra-filings",
            "gvmc-adb-iee-24x7-nw-2019",
            "cgwb-visakhapatnam-aquifer-plans",
        ],
        "_conflicts": [
            "Year: 1957 dam completion (CWC NRLD 2019, p.58, AP01LH0008); CGWB's 2025 aquifer "
            "plan (Table 9.1) lists 1965 for this source, possibly when the city began drawing "
            "from it (not confirmed).",
            "Output: 0.00 MGD present against 0.60 MGD normal on 11 March 2021 (GVMC daily "
            "supply status); 8.18 MLD in APPCB's 2021 report, the same figure as GVMC's ADB "
            "source table (Table 4 of the 24x7 NW sector IEE; demand columns for 2014; draft "
            "March 2016, final January 2019); 2.7 MLD seasonal in CGWB's 2025 source table.",
        ],
    },
]

flagship = {
    "nvdm": "1.0",
    "dataset": "data-root/water-bodies-flagship",
    "scope": SCOPE,
    "provenance": {
        "sources": [
            reg(
                "gvmc-adb-mudasarlova-2018",
                "GVMC's ADB subproject documents for Mudasarlova (UCCRTF05): the initial "
                "environmental examination (Oct 2018) and the resettlement due-diligence "
                "report (Sep 2018)",
                "Greater Visakhapatnam Municipal Corporation",
                url=IEE_MUDASARLOVA,
                as_of="2018-10",
                retrieved=RETRIEVED,
            ),
            reg(
                "gvmc-adb-iee-meghadrigedda-solar-2018",
                "GVMC's ADB subproject initial environmental examination for the 3 MWp "
                "floating solar plant on the Meghadrigedda reservoir (UCCRT04, Oct 2018)",
                "Greater Visakhapatnam Municipal Corporation",
                url=IEE_MEGHADRIGEDDA,
                as_of="2018-10",
                retrieved=RETRIEVED,
            ),
            reg(
                "gvmc-adb-iee-24x7-nw-2019",
                "GVMC's ADB subproject initial environmental examination for 24x7 water "
                "supply in the North-West sector (GVMC02, Jan 2019), Table 4 water source "
                "and availability",
                "Greater Visakhapatnam Municipal Corporation",
                url=IEE_NW_SECTOR,
                as_of="2019-01",
                retrieved=RETRIEVED,
            ),
            reg(
                "gvmc-whats-new",
                "Draft Green City Action Plan (IFC for GVMC, dated Sept 2024; posted by "
                "GVMC for comment on 19 Oct 2024)",
                "Greater Visakhapatnam Municipal Corporation",
                url=GCAP,
                retrieved=RETRIEVED,
            ),
            reg(
                "ngt-andhra-filings",
                "APPCB report in NGT OA 14/2021 (SZ) (reservoir drawal in MLD) and GVMC's "
                "action-taken report in the same case, with its daily supply status for "
                "11 March 2021 (supply by source and source distances)",
                "National Green Tribunal (filings by APPCB and GVMC)",
                as_of="2021",
                retrieved=RETRIEVED,
            ),
            reg(
                "apwrims-reservoirs",
                "APWRIMS reservoir dashboard: Meghadrigedda design capacity",
                "Water Resources Department, Government of Andhra Pradesh",
                retrieved=RETRIEVED,
            ),
            reg(
                "apwrims-mi-tanks",
                "APWRIMS minor-irrigation tank layer: Kondakarla Ava (MI012625)",
                "Water Resources Department, Government of Andhra Pradesh",
                retrieved=RETRIEVED,
            ),
            reg(
                "cpcb-nwmp-visakhapatnam",
                "CPCB National Water Quality Monitoring Programme, lake station 2353 "
                "Kondakarla-Aava, 2019-2024",
                "Central Pollution Control Board",
                retrieved=RETRIEVED,
            ),
            reg(
                "cgwb-visakhapatnam-aquifer-plans",
                "CGWB Aquifer Management Plan, Visakhapatnam and Anakapalli UAs (2025), "
                "Table 9.1 source years, distances and quantities",
                "Central Ground Water Board",
                retrieved=RETRIEVED,
            ),
            reg(
                "industry-ec-compliance-visakhapatnam",
                "RINL brief write-up and pre-feasibility report for the 6.3 to 7.3 MTPA "
                "expansion, filed with MoEFCC in March 2018 (Kanthi balancing reservoir)",
                "Rashtriya Ispat Nigam Ltd (via MoEFCC environment clearance portal)",
                as_of="2018-03",
                retrieved=RETRIEVED,
            ),
            reg(
                "historical-gazetteers-visakhapatnam",
                "Madras District Gazetteers: Vizagapatam, Vol. I (W. Francis), "
                "pp.8, 105 and 217",
                "Government of Madras",
                url=GAZETTEER,
                as_of="1907",
                retrieved=RETRIEVED,
            ),
            reg(
                "vmrda-draft-master-plan-2041",
                "VMRDA Draft Master Plan 2041, report (June 2021), p.52",
                "Visakhapatnam Metropolitan Region Development Authority",
                url=VMRDA_DMP,
                as_of="2021-06",
                retrieved=RETRIEVED,
            ),
            reg(
                "cwc-nrld-2019",
                "CWC National Register of Large Dams (2019): Mehadrigedda (AP01MH0042, "
                "p.59) and Gambhiramgedda (AP01LH0008, p.58)",
                "Central Water Commission",
                url=NRLD,
                as_of="2019",
                retrieved=RETRIEVED,
            ),
            reg(
                "moefcc-wetlands-portal",
                "MoEFCC Wetlands of India portal: lists of Ramsar sites and wetlands of "
                "international significance, checked 14 Oct 2026",
                "Ministry of Environment, Forest and Climate Change (Wetlands Division)",
                url=MOEFCC_WETLANDS,
                retrieved=RETRIEVED,
            ),
        ],
        "method": "manual",
        "produced_at": TODAY,
        "produced_by": "neer-vazhvu-api/scripts/build_visakhapatnam_restoration.py",
        "note": (
            "Curated flagship register. Each record carries its own source URLs and the "
            "registry ids of the documents it cites; conflicts between sources are listed "
            "in _conflicts, not resolved."
        ),
    },
    "place_id": "visakhapatnam",
    "compiled_at": TODAY,
    "note": (
        "Five water bodies with sourced history: the three reservoirs in or at the edge of "
        "the city that GVMC draws from (Mudasarlova, Meghadrigedda, Gambheeram), the balancing "
        "reservoir at the tail of the Yeleru canal (Kanithi), and a natural freshwater lake "
        "south-west of the city (Kondakarla Ava). Thatipudi and Raiwada are left out: they "
        "are irrigation dams 56 to 60 km away in CGWB's 2025 aquifer plan (Thatipudi 56, "
        "Raiwada 60; GVMC's supply sheet of 11 March 2021 puts Raiwada at 76 km) that the "
        "dashboard tracks as supply sources, not city lakes. The 11 AMRUT tanks are in "
        "restoration-projects-visakhapatnam.json; we have not found a sourced history for "
        "any of them beyond its project row. Confidence V = checked against a primary "
        "document."
    ),
    "bodies": bodies,
}

for rel, payload in (
    ("public/data/restoration-projects-visakhapatnam.json", restoration),
    ("public/data/water-bodies-flagship-visakhapatnam.json", flagship),
):
    write_artifact(ROOT / rel, payload)
    print(f"wrote {rel}")

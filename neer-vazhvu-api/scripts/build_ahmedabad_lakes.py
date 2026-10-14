#!/usr/bin/env python3
"""
Ahmedabad's flagship lakes, its lake programmes and the court orders on them.

Ahmedabad has no single public lake register. The programme lives in AMC's
annual budgets, the legal status in Gujarat High Court orders, and the history
in the 1879 Bombay Gazetteer and Hope and Fergusson (1866). Every figure below
was checked against the saved document text on 2026-10-14. The Gujarati
budgets were read from the PDF's own embedded digits (pdftotext -layout); the
legacy-font 2024-25 and 2025-26 editions carry ASCII digits, and their words
were decoded by the font's character map, never by OCR.

Where two official documents disagree, both figures are stated in the text.
Press reports were used only as leads: no number here rests on one.

Left out on purpose: figures about the people moved off lake land (beyond
AMC's own housing allocation), all press-relayed clearance figures, and Thol
lake (a Ramsar site outside AMC limits, with no official figure in the record
we hold).

Run:  python3 neer-vazhvu-api/scripts/build_ahmedabad_lakes.py
"""

import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

DATA_DIR = REPO_ROOT / "public" / "data"

# AMC budgets (FileRepository ids). FR 2205 is the 2020-21 English budget,
# though AMC's site lists it as 2021-22.
FR = "https://ahmedabadcity.gov.in/ViewFile/ViewFile?TYPE=FileRepository,{}"
B1920, B2021, B2223, B2324 = (
    FR.format(2206),
    FR.format(2205),
    FR.format(2204),
    FR.format(2203),
)
B2425, B2526, B2627 = FR.format(280), FR.format(2359), FR.format(2583)
AMRUT = "https://amrut.mohua.gov.in/approvedProjects/list/c3cwOVlFOG1BckF5cE9mQVVFbWhSdz09/cUxHejIwaFlmcVlGZTBlRFB6STkvZz09"
GAZ = "https://archive.org/details/dli.ministry.08145"
HOPE = "https://archive.org/details/Ahmedabad_126468"
HUDCO = "https://hudco.org.in/writereaddata/EB/HUDCO-BPA/files/basic-html/page34.html"
NGT105 = (
    "https://www.greentribunal.gov.in/sites/default/files/news_updates/REPORT%20BY%20COMMITTEE%20IN%20OA%20NO.%20105"
    "%20of%202019%20(AJITSINH%20BHURUBHA%20VAGHELA%20&%20INHABITANTS%20OF%20SEVERAL%20VILLAGE%20OF%20KHERA%20TALUKA,"
    "%20DISTT.%20KHEDA%20VS.%20STATE%20OF%20GUJARAT).pdf"
)
IK = "https://indiankanoon.org/doc/{}/"
SHAH_2002 = IK.format(324892)  # SCA 10621/2000, 02.08.2002
SCA6119_QUOTED = IK.format(111321386)  # SCA 2301/2026 quotes the 29.04.2025 order
SCA6119_DISPOSED = IK.format(46004928)  # SCA 6119/2025, 24.07.2025
SCA6716 = IK.format(116034364)
KAMAL = IK.format(147325373)
ISANPUR = IK.format(78249428)
ISANPUR_LPA = IK.format(153538851)
NGT79 = IK.format(62398397)
WBC = (
    "https://mowr.nic.in/irrigationcensus/Reports/6MIC/WBS/table{0}/GJ_6MIC_WBS{0}.xls"
)


def bodies():
    return [
        {
            "name": "Kankaria Lake",
            "alternate_names": ["Hauz-i-Qutb", "Kankariya"],
            "type": "lake",
            "area_acres": 72,
            "year_built": 1451,
            "builder": "Sultan Qutb-ud-din, who completed it in 1451",
            "feed": (
                "in 1879, a stream rising west of the Bokh, turned towards Kankaria and "
                "Chandola by a dam near Kamod (Bombay Gazetteer, p.50)"
            ),
            "status": (
                "AMC began rebuilding the lakefront in 2006 at about Rs 36 crore and opened "
                "it to the public in January 2009, after the Kankaria Carnival of 25 to 31 "
                "December 2008 (AMC Budget 2026-27, PDF p.176). HUDCO's awards compendium "
                "gives completion as December 2008 at Rs 36.00 crore. The 72 acres is the "
                "1866 measurement; the record we hold has no current official water-spread "
                "figure."
            ),
            "cultural_note": (
                "A regular polygon of 34 sides, each 190 feet long, ringed with cut-stone "
                "steps, with a carved inlet sluice and an island garden, Nagina, reached by "
                "a viaduct (Hope and Fergusson 1866, pp.50-51). By 1781 it lay in ruin; the "
                "Collector, Mr Borradaile, began restoring it in 1872 (Bombay Gazetteer "
                "1879, pp.17-18). AMC's 2020-21 budget calls the lakefront the model for "
                "lake development in other cities (PDF p.4)."
            ),
            "confidence": "V",
            "sources": [HOPE, GAZ, B2627, HUDCO],
        },
        {
            "name": "Chandola Lake",
            "alternate_names": ["Chandola Talav", "Chandola Tank"],
            "type": "tank",
            # 121 ha, the Irrigation Department's figure to the High Court (2000)
            "area_acres": 299,
            "year_built": None,
            "era": "Irrigation tank, recorded by 1879",
            "builder": (
                "Not named in the sources we hold; an irrigation tank handed to the Public "
                "Works Department by a Government of Bombay order of 3 April 1916"
            ),
            "feed": (
                "the Khari Cut canal from the Khari river at Raipur, built between 1878 and "
                "1881 partly to fill this tank; AMC's 2023-24 budget says a branch of the "
                "canal still runs through Jashodanagar, Khokhra and Ghodasar to fill the "
                "lake (PDF p.149)"
            ),
            "status": (
                "Phase 1 beautification is under way at Rs 36.38 crore from AMC's own "
                "funds, and phase 2 is planned (AMC Budget 2026-27, PDF pp.102, 104 and "
                "166). From April 2025 AMC cleared structures from the lake land; "
                "the Gujarat High Court refused to stay the clearance, holding that "
                "'Chandola Lake is a water body and on a water body, no construction can "
                "be permitted' (R/SCA 6119/2025, order of 29 April 2025). Area: 121 "
                "hectares (about 299 acres) with a 525-hectare command area, per the "
                "State Irrigation Department's affidavit to the High Court in 2000."
            ),
            "cultural_note": (
                "The 1879 Bombay Gazetteer describes an earth-embanked circular reservoir "
                "about two miles south of the city near Shah Alam's tomb, covering 181 "
                "acres, with 291 acres assessed as irrigable from it, though it 'seldom "
                "retains any depth of water long after the close of the rains' (p.17). "
                "In 2000 the Irrigation Department told the High Court that urban growth "
                "had ended its use for irrigation (Shailesh R. Shah v. State of Gujarat, "
                "2002)."
            ),
            "confidence": "V",
            "sources": [
                B2627,
                SHAH_2002,
                SCA6119_QUOTED,
                SCA6119_DISPOSED,
                GAZ,
                NGT105,
            ],
        },
        {
            "name": "Lal Bahadur Shastri Lake",
            "alternate_names": ["Malik Shaban lake", "Malek Saban talav"],
            "type": "lake",
            "area_acres": 71,
            "year_built": None,
            "era": "Stone-built, recorded by 1879",
            "status": (
                "AMC's 2026-27 budget records its development, with Sola, Shilaj and Gota "
                "(phase 1) lakes, as completed at a combined Rs 63.88 crore under the "
                "Swarnim budget head (PDF p.165). The 2019-20 budget had reported an "
                "earlier development of 'Lal Bahadur Shastri lake in Bapunagar' as "
                "complete (PDF pp.143-144). The 71 acres is the 1879 measurement."
            ),
            "cultural_note": (
                "The 1879 Bombay Gazetteer describes the Malik Shaban lake, two and a "
                "quarter miles east of the city near Rakhial, as 'hardly inferior in size' "
                "to Kankaria: stone built, octagonal, 71 acres, its sides in good order "
                "but its bed 'so silted up as to hold no depth of water' (p.18). AMC's "
                "budgets give the lake both names."
            ),
            "confidence": "V",
            "sources": [B2627, B1920, GAZ],
        },
        {
            "name": "Vastrapur Lake",
            "type": "lake",
            # 51,761 sq m (AMC Budget 2023-24, PDF p.180)
            "area_acres": 12.8,
            "builder": "Ahmedabad Urban Development Authority, before 2003, per AMC's 2025-26 budget (PDF p.126)",
            "status": (
                "AMC's 2025-26 budget gives its renovation as under way at Rs 9.89 crore "
                "(PDF p.126) and, on another page, at Rs 7.3 crore (PDF p.196). The "
                "2026-27 budget lists Vastrapur among lakes where development work has "
                "been carried out (PDF p.218) and, in its English climate annex, among "
                "lake works in progress (PDF p.323). Both readings are stated; the "
                "budgets do not reconcile them."
            ),
            "cultural_note": (
                "Area 51,761 sq m on the west side of the Sabarmati. In 2023-24 AMC "
                "recorded structural damage to the retaining wall, walking path and "
                "amphitheatre steps and decided to renovate the lake (Budget 2023-24, PDF "
                "p.180); in 2022-23 it had listed its development at Rs 5.00 crore as work "
                "in progress (PDF p.138)."
            ),
            "confidence": "V",
            "sources": [B2526, B2627, B2324, B2223],
        },
        {
            "name": "Isanpur Lake",
            "type": "lake",
            # 95,608 sq m on the 7/12 revenue extract
            "area_acres": 23.6,
            "status": (
                "The Collector allotted the lake land to AMC on 20 June 2009 to develop "
                "and beautify the lake. AMC's notice of 8 September 2025 to vacate "
                "structures on the lake land was upheld by the Gujarat High Court on 14 "
                "November 2025 and on appeal on 2 December 2025. AMC's 2026-27 budget "
                "lists a lake garden here at Rs 2.00 crore (PDF p.181)."
            ),
            "cultural_note": (
                "The revenue record gives the survey number as 95,608 sq m with land use "
                "'Talav'; the town-planning map shows 95,639 sq m as water body (Town "
                "Planning Scheme 53, final plots 160 to 162, as recorded in the High "
                "Court's orders)."
            ),
            "confidence": "V",
            "sources": [ISANPUR, ISANPUR_LPA, B2627],
        },
        {
            "name": "Kamal Talav",
            "alternate_names": ["Umla Talavdi", "Kamal Lake"],
            "type": "pond",
            "status": (
                "On revenue survey no. 258 in Town Planning Scheme 97 (Naroda-North), "
                "Sardarnagar ward. AMC served notices on 6 November 2025 to vacate "
                "structures on the pond land, citing a State Government direction to "
                "develop and beautify the pond; the Gujarat High Court dismissed the "
                "challenge on 28 November 2025. AMC's 2026-27 budget lists it among 15 "
                "lakes planned for lakefront development (Rs 80.00 crore for the group, "
                "PDF p.166) and a lake garden at Rs 2.00 crore (PDF p.181)."
            ),
            "confidence": "V",
            "sources": [KAMAL, B2627],
        },
        {
            "name": "Shakri Lake",
            "alternate_names": ["Shakri Talav", "Shakri Sarovar"],
            "type": "lake",
            "status": (
                "AMC's 2026-27 budget records its development as complete at Rs 17.50 "
                "crore (PDF p.165). The 2025-26 budget had listed Shakri inside the Rs "
                "63.88 crore Swarnim group with Sola, Shilaj, Lal Bahadur Shastri and Gota "
                "lakes, then in progress (PDF p.196)."
            ),
            "cultural_note": (
                "Two official areas: 6,263 sq m in AMC's 2022-23 budget (PDF pp.91 and "
                "139) and 78,858.49 sq m in its 2023-24 budget (PDF p.180). Both are "
                "stated; neither budget explains the difference."
            ),
            "confidence": "V",
            "sources": [B2627, B2526, B2223, B2324],
        },
        {
            "name": "Malav Talav, Vasna",
            "type": "lake",
            "status": (
                "AMC's 2026-27 budget lists its renovation at Rs 6.00 crore among the West "
                "zone's works for the coming year (PDF p.95), names it in the seven-lake "
                "re-development and phase 2 group (Rs 40.00 crore for the group, PDF "
                "p.166), and includes it in the English climate annex's 21 planned "
                "lakefronts (PDF p.321)."
            ),
            "cultural_note": (
                "Not the Malav lake at Dholka, which the 1879 Bombay Gazetteer places in "
                "the regency of Minal Devi, mother of the Solanki king Siddhraj "
                "(1094-1148) (p.18). The record we hold gives no history or area for the "
                "Vasna lake."
            ),
            "confidence": "V",
            "sources": [B2627, GAZ],
        },
    ]


def projects():
    return [
        {
            "scheme_name": "AMC lake development programme",
            "operator": "Ahmedabad Municipal Corporation",
            "scope": (
                "AMC counts 176 lakes within its limits. By February 2026 development was "
                "complete at 43, under way at 13, and planned at 22 more: 15 new lakefronts "
                "and 7 re-developments or second phases (Budget 2026-27, PDF p.166). The "
                "work covers deepening, compound walls, roads, gardens, lighting, inlets, "
                "toilets, recharge wells and bringing catchment water in (PDF p.165). In "
                "its 2020-21 budget AMC counted 122 lakes (PDF p.138); the budgets we read "
                "do not say what changed between the two counts."
            ),
            "funding_summary": (
                "Stated programme cost Rs 100.00 crore (PDF p.165). Shakri lake completed at "
                "Rs 17.50 crore; Makarba, Hebatpur and ABD Kachariyu lakes under way at Rs "
                "19.72 crore from AMC's own funds (PDF p.166). Planned: 15 lakefronts "
                "at Rs 80.00 crore and 7 re-developments at Rs 40.00 crore (PDF p.166), and "
                "gardens at 24 lakes at Rs 51.00 crore (PDF p.181). The English climate "
                "annex groups the planned lakefronts as 21 lakes, a different list (PDF "
                "p.321)."
            ),
            "amount_cr": 100,
            "status": "43 done, 13 under way, 22 planned",
            "sources": [B2627, B2021],
        },
        {
            "scheme_name": "Storm-water inflows from lake catchments",
            "operator": "Ahmedabad Municipal Corporation",
            "scope": (
                "Storm-water lines that carry rain from each lake's surrounding catchment "
                "into the lake. Of 176 lakes, the network is complete at 80, under way at "
                "51, and planned at the remaining 45 (Budget 2026-27, PDF p.166; English "
                "climate annex, PDF p.321)."
            ),
            "funding_summary": "Rs 10.00 crore for catchment-to-lake works in 2026-27 (PDF p.166).",
            "amount_cr": 10,
            "status": "80 done, 51 under way, 45 planned",
            "sources": [B2627],
        },
        {
            "scheme_name": "AMRUT 2.0 water-body rejuvenation",
            "operator": "Ahmedabad Municipal Corporation",
            "financier": "AMRUT 2.0, Ministry of Housing and Urban Affairs",
            "scope": (
                "Eight AMC projects on the AMRUT 2.0 portal, Rs 63.02 crore in all. "
                "Completed: Ognaj village lake (Rs 8.60 crore), Okaf (Rs 12.74 crore) and "
                "Bhadaj (Rs 7.93 crore). Contract awarded: Ropda (Rs 3.76 crore), Vadu at "
                "Ramol (Rs 10.13 crore), a mini STP at Asarwa lake (Rs 9 crore), Muthiya "
                "(Rs 6.05 crore) and Hathijan (Rs 4.81 crore)."
            ),
            "funding_summary": (
                "Portal figures as read on 14 October 2026; the portal dates no project. "
                "AMC's 2026-27 budget (February 2026) gives different figures for the same "
                "lakes: Bhadaj and Okaf under way at Rs 24.92 crore combined, Hathijan and "
                "Naroda-Muthiya under way at Rs 15.61 crore, and Ramol Vadu and Ropda under "
                "way at Rs 20.47 crore (PDF p.165). Its English annex lists Bhadaj, Ognaj "
                "and Okaf as work in progress (PDF p.323). Both are stated here."
            ),
            "amount_cr": 63.02,
            "status": "3 completed, 5 contract awarded",
            "sources": [AMRUT, B2627],
        },
        {
            "scheme_name": "Swarnim budget lake works (SJMMSVY)",
            "operator": "Ahmedabad Municipal Corporation",
            "financier": "Government of Gujarat, Swarnim Jayanti Mukhya Mantri Shaheri Vikas Yojana",
            "scope": (
                "Sola, Shilaj, Lal Bahadur Shastri (Malek Saban) and Gota (phase 1) lakes "
                "developed and complete; Mumatpura lake under way at Rs 5.54 crore (Budget "
                "2026-27, PDF p.165). The English annex names Jagatpur and Mumatpura as "
                "SJMMSVY lake works in progress (PDF p.323)."
            ),
            "funding_summary": (
                "Rs 63.88 crore for the four completed lakes. The 2025-26 budget listed "
                "Shakri in the same Rs 63.88 crore group, then in progress (PDF p.196); the "
                "2026-27 budget lists Shakri separately, completed at Rs 17.50 crore."
            ),
            "amount_cr": 63.88,
            "status": "4 completed, 1 under way",
            "sources": [B2627, B2526],
        },
        {
            "scheme_name": "Chandola Lake beautification",
            "operator": "Ahmedabad Municipal Corporation",
            "financier": "AMC own funds",
            "scope": (
                "Phase 1 beautification in Danilimda ward, under way at Rs 36.38 crore in "
                "both the 2025-26 (PDF p.196) and 2026-27 budgets (PDF pp.102 and 166). Phase "
                "2 is planned for the coming year (PDF p.104), with a lake garden at Rs "
                "4.50 crore (PDF p.181)."
            ),
            "funding_summary": (
                "Phase 2 is Rs 40.00 crore in the South zone works list (PDF p.104); the "
                "lake section lists it inside a seven-lake group whose total is also Rs "
                "40.00 crore (PDF p.166). Both are stated; the budget does not reconcile "
                "them."
            ),
            "amount_cr": 36.38,
            "status": "Phase 1 under way; phase 2 planned",
            "sources": [B2627, B2526],
        },
        {
            "scheme_name": "Lake interlinking for flood mitigation",
            "operator": "Ahmedabad Municipal Corporation",
            "financier": "National Disaster Mitigation Fund through NDMA (15th Finance Commission), with a State share",
            "scope": (
                "New lake interlinking in the South West zone, Rs 76.00 crore and 24% "
                "complete, and in the East zone, Rs 78.00 crore and under way (Budget "
                "2026-27, PDF p.133)."
            ),
            "funding_summary": (
                "The 2026-27 budget gives the city's grant as Rs 250.00 crore from the "
                "Centre and Rs 25.00 crore from the State, and its total as Rs 270.00 crore "
                "(PDF p.133). The 2024-25 budget gives the same two parts and a total of "
                "Rs 275.00 crore (PDF p.138)."
            ),
            "status": "South West 24%; East under way",
            "sources": [B2627, B2425],
        },
        {
            "scheme_name": "Planned lake interlinking, North West zone",
            "operator": "Ahmedabad Municipal Corporation",
            "scope": (
                "Linking 6 lakes in Town Planning Schemes 217, 41 and 301 and pumping their "
                "storm water to the Gota-Godhavi canal, Rs 40.00 crore; and a line from "
                "Rajathal through Chebli lake to Bopal lake, Rs 8.00 crore (Budget 2026-27, "
                "PDF p.166)."
            ),
            "status": "Planned",
            "sources": [B2627],
        },
        {
            "scheme_name": "Housing linked to clearing lake land",
            "operator": "Ahmedabad Municipal Corporation (housing)",
            "scope": (
                "Of the 24,000 homes AMC plans to build, 3,200 are listed under removing "
                "encroachments from lakes, which the budget classes as untenable slums "
                "(Budget 2026-27, PDF p.190)."
            ),
            "funding_summary": (
                "Rs 410.00 crore in the 2026-27 budget. The 2025-26 budget gave about 4,000 "
                "homes at Rs 600.00 crore for the same purpose (PDF p.215)."
            ),
            "amount_cr": 410,
            "status": "Planned",
            "sources": [B2627, B2526],
        },
        {
            "scheme_name": "Kankaria Lakefront redevelopment",
            "operator": "Ahmedabad Municipal Corporation",
            "scope": (
                "Rebuilding the lake's edge and precinct as a public lakefront, begun in "
                "2006 (Budget 2026-27, PDF p.176). HUDCO's compendium describes a 2.25 km "
                "pedestrian promenade and notes the lake 'represented a source of aquifer "
                "recharging'."
            ),
            "funding_summary": (
                "About Rs 36 crore (AMC Budget 2026-27, PDF p.176); Rs 36.00 crore (HUDCO "
                "Best Practice Awards compendium, p.34)."
            ),
            "amount_cr": 36,
            "completed_year": 2008,
            "status": "Completed December 2008; opened January 2009",
            "sources": [B2627, HUDCO],
        },
        {
            "scheme_name": "Lake conservation proposal under NPCA",
            "operator": "Ahmedabad Municipal Corporation",
            "financier": "Proposed: Government of India 60%, Government of Gujarat 40%",
            "scope": (
                "In 2020 AMC counted 122 lakes, 26 developed and 96 still to be developed, "
                "and submitted a Rs 452.90 crore DPR for 45 of them to the Gujarat Urban "
                "Development Mission under the National Plan for Conservation of Aquatic "
                "Ecosystems: 17 lakes over 5 hectares in phase "
                "1 (Rs 310.59 crore) and 28 lakes of 2.5 to 5 hectares in phase 2 (Rs "
                "142.31 crore) (Budget 2020-21, PDF p.138)."
            ),
            "funding_summary": (
                "Centre Rs 271.74 crore, State Rs 181.16 crore (PDF p.139). The same "
                "budget's opening note says 28 lakes had been developed, not 26 (PDF p.4). "
                "The 2023-24 budget planned Jagatpur lake and a 2 MLD STP under the NPCA "
                "grant (PDF p.147)."
            ),
            "amount_cr": 452.9,
            "status": "DPR submitted (2020)",
            "sources": [B2021, B2324],
        },
    ]


def court_orders():
    return [
        {
            "case": "Shailesh R. Shah v. State of Gujarat, (2002) 3 GLR 447",
            "writ_petition": "SCA 10621/2000 with 11049/2000 and 11635/2000",
            "court": "Gujarat High Court (Division Bench)",
            "date": "2002-08-02",
            "ruling": (
                "directed the State to notify every lake and pond in Gujarat in the "
                "Official Gazette within three months and keep them as water bodies, never "
                "alienated; to prescribe and monitor water-quality standards; to "
                "rejuvenate them through a declared, phased desilting programme with "
                "storm-water recharge; to set up a Water Resources Council and Committee; "
                "to record and remove encroachments in accordance with law and the "
                "Government's rehabilitation policies; and to determine and notify a "
                "no-construction belt around each lake."
            ),
            "specific_tanks": ["Chandola Lake"],
            "concern": (
                "the protection of lakes in and around Ahmedabad and the removal of "
                "encroachments from survey no. 353"
            ),
            "source": SHAH_2002,
        },
        {
            "case": "Fuljaha Noormohammed Shaikh and others v. State of Gujarat and others",
            "writ_petition": "R/SCA 6119/2025",
            "court": "Gujarat High Court",
            "date": "2025-04-29",
            "ruling": (
                "refused to stay the clearance of structures at Chandola Lake, holding "
                "that 'Chandola Lake is a water body and on a water body, no construction "
                "can be permitted', and left the petitioners free to apply individually for "
                "housing under the State's rehabilitation schemes. It disposed of the "
                "petition on 24 July 2025, recording that the demolition had been carried "
                "out. The 29 April order's text is as quoted in the Court's judgment of 16 "
                "March 2026 in R/SCA 2301/2026, which the link opens."
            ),
            "specific_tanks": ["Chandola Lake"],
            "concern": "the clearance of homes on the lake land before any rehabilitation",
            "source": SCA6119_QUOTED,
        },
        {
            "case": "Samsuddin Jainulabiddin Shaikh and others v. State of Gujarat and others",
            "writ_petition": "R/SCA 6716/2025",
            "court": "Gujarat High Court",
            "date": "2025-05-06",
            "ruling": (
                "rejected the prayer to halt the clearance until the petitioners were "
                "rehoused, no document having been produced to justify the structures on "
                "lake or government land, and directed that individual applications for "
                "alternative housing under the State's rehabilitation scheme be considered "
                "in accordance with law."
            ),
            "specific_tanks": ["Chandola Lake"],
            "concern": "the clearance of homes near the lake before rehabilitation",
            "source": SCA6716,
        },
        {
            "case": "In re: news item on water bodies vanishing in Ahmedabad",
            "writ_petition": "OA 79/2025 (WZ)",
            "court": "National Green Tribunal, Western Zone Bench",
            "date": "2025-11-12",
            "ruling": (
                "added the State's Urban Development and Urban Housing Department and AMC "
                "as respondents and asked them to reply within four weeks, after the "
                "Gujarat Pollution Control Board said it held no specific details of the "
                "water bodies identified in the city and pointed to the High Court's 2002 directions. The matter "
                "was next listed for 22 January 2026."
            ),
            "specific_tanks": [],
            "concern": (
                "a newspaper report of 9 June 2025, on which the Tribunal registered the "
                "case, that by a civic body report some of Ahmedabad's water bodies had "
                "'vanished'"
            ),
            "source": NGT79,
        },
        {
            "case": "Navneetlal Vanmalidas Khakhkhar (Thakkar) and others v. Ahmedabad Municipal Corporation",
            "writ_petition": "R/SCA 14892/2025; R/LPA 1280/2025",
            "court": "Gujarat High Court",
            "date": "2025-11-14",
            "ruling": (
                "upheld AMC's notice of 8 September 2025 to remove structures from the "
                "lake land, holding that construction on a water body is contrary to the "
                "Gujarat Land Revenue Code, 1879. A Division Bench dismissed the appeal on "
                "2 December 2025 and declined to stay the notice."
            ),
            "specific_tanks": ["Isanpur Lake"],
            "concern": (
                "a notice to vacate homes and a temple on lake land that the Collector "
                "allotted to AMC in 2009 for development and beautification"
            ),
            "source": ISANPUR,
        },
        {
            "case": "Ashokbhai Kanjibhai Chavda and others v. Ahmedabad Municipal Corporation and others",
            "writ_petition": "R/SCA 15965/2025 with R/SCA 15979/2025",
            "court": "Gujarat High Court",
            "date": "2025-11-28",
            "ruling": (
                "dismissed the challenge to AMC's notices of 6 November 2025 to vacate "
                "structures on revenue survey no. 258, holding that no construction is "
                "permissible without permission on government land or a water body, and "
                "left the petitioners free to apply to AMC for rehabilitation under any "
                "available scheme."
            ),
            "specific_tanks": ["Kamal Talav (Umla Talavdi), Naroda"],
            "concern": (
                "AMC notices, issued on a State Government direction to develop and "
                "beautify the pond, to clear homes from the pond land"
            ),
            "source": KAMAL,
        },
    ]


def census_context():
    """District context from the first Water Bodies Census. Not a flagship
    record: the page does not render it, but it travels with the register."""
    return {
        "source": "Ministry of Jal Shakti, First Census of Water Bodies (reference year 2017-18), Gujarat district tables",
        "district": "Ahmedabad",
        "total": 1964,
        "rural": 1788,
        "urban": 176,
        "urban_ponds": 83,
        "urban_tanks": 93,
        "not_in_use": 63,
        "not_in_use_note": "all 63 urban; reason given as construction for 1 and 'others' for 62 (table 8-B)",
        "encroached": 19,
        "encroached_note": "all 19 urban; 19 of Gujarat's 22 encroached water bodies are in Ahmedabad district (table 22-A)",
        "tables": {
            "1-B urban": WBC.format("1-B"),
            "1-C all": WBC.format("1-C"),
            "5 in use / not in use": WBC.format("5"),
            "8-B reasons not in use": WBC.format("8-B"),
            "22-A encroached": WBC.format("22-A"),
        },
        "comparison": (
            "The census count of 176 urban water bodies across the district's 10 towns "
            "equals AMC's own count of 176 lakes in its 2026-27 budget; neither source "
            "shows whether they are the same set."
        ),
    }


def src(sid, title, publisher, **extra):
    return {
        "id": sid,
        "title": title,
        "publisher": publisher,
        "license": registry_license(sid),
        **extra,
    }


def closed(title, publisher, as_of, url, license_):
    return {
        "title": title,
        "publisher": publisher,
        "closed": True,
        "as_of": as_of,
        "url": url,
        "license": license_,
    }


BUDGETS = src(
    "amc-budget",
    "AMC budgets 2019-20 to 2026-27: lake development, zone works, housing and climate annex sections",
    "Ahmedabad Municipal Corporation",
)
HC = src(
    "gujarat-hc-lake-orders",
    "Gujarat High Court orders on Ahmedabad's lakes (2002, 2025)",
    "High Court of Gujarat",
)
HUDCO_SRC = closed(
    "HUDCO Best Practice Awards compendium, p.34: Kankaria Lake redevelopment",
    "Housing and Urban Development Corporation (HUDCO)",
    "2008-12",
    HUDCO,
    "HUDCO publication, cited with attribution",
)


def main() -> int:
    today = date.today().isoformat()
    by = "neer-vazhvu-api/scripts/build_ahmedabad_lakes.py"
    fl = {
        "nvdm": "1.0",
        "dataset": "data-root/water-bodies-flagship",
        "scope": {"kind": "city", "id": "ahmedabad"},
        "provenance": {
            "sources": [
                BUDGETS,
                HC,
                src(
                    "mojs-water-bodies-census-2023",
                    "First Census of Water Bodies, Gujarat district tables (reference year 2017-18)",
                    "Ministry of Jal Shakti",
                ),
                closed(
                    "Gazetteer of the Bombay Presidency, Vol. IV: Ahmedabad, pp.17-18 and 50",
                    "Government Central Press, Bombay",
                    "1879",
                    GAZ,
                    "Public domain (published 1879); read via the Internet Archive",
                ),
                closed(
                    "T.C. Hope and J. Fergusson, Architecture at Ahmedabad, pp.50-51",
                    "John Murray, London",
                    "1866",
                    HOPE,
                    "Public domain (published 1866); read via the Internet Archive",
                ),
                HUDCO_SRC,
                closed(
                    "Khari Cut Canal Report, committee in NGT OA 105/2019, pp.32-33, quoting Bombay High Court (1926) 28 Bom LR 614",
                    "National Green Tribunal (committee report)",
                    "2020-08-19",
                    NGT105,
                    "National Green Tribunal record, cited with attribution",
                ),
            ],
            "method": "manual",
            "produced_at": today,
            "produced_by": by,
            "note": (
                "Curated flagship register. Each body carries its own document links; page "
                "numbers in the text are PDF pages unless marked printed."
            ),
        },
        "place_id": "ahmedabad",
        "compiled_at": today,
        "note": (
            "Ahmedabad has no single public lake register. AMC's budgets carry the "
            "programme, Gujarat High Court orders carry the legal status, and the 1879 "
            "Bombay Gazetteer and Hope and Fergusson (1866) carry the history. Entries "
            "are graded V (verified against a primary document), N (single source) or C "
            "(claim only); every entry here is V. Areas are dated in each entry's text: "
            "Kankaria's 72 acres and Lal Bahadur Shastri's 71 acres are 1866 and 1879 "
            "measurements, Chandola's 299 acres is the 121 hectares the State Irrigation "
            "Department gave the High Court in 2000, and the Vastrapur and Isanpur figures "
            "are converted from AMC's and the revenue record's square metres."
        ),
        "context": {"water_bodies_census": census_context()},
        "bodies": bodies(),
    }
    pj = {
        "nvdm": "1.0",
        "dataset": "data-root/restoration-projects",
        "scope": {"kind": "city", "id": "ahmedabad"},
        "provenance": {
            "sources": [
                BUDGETS,
                src(
                    "mohua-amrut-status",
                    "AMRUT 2.0 portal: AMC approved projects (water-body rejuvenation rows)",
                    "Ministry of Housing and Urban Affairs (AMRUT 2.0)",
                    retrieved="2026-10-14",
                ),
                HC,
                HUDCO_SRC,
                src(
                    "ngt-gujarat-filings",
                    "National Green Tribunal (WZ), OA 79/2025, order of 12 November 2025",
                    "National Green Tribunal, Western Zone Bench",
                ),
            ],
            "method": "manual",
            "produced_at": today,
            "produced_by": by,
            "note": (
                "Curated compilation; per-record citations carry the accountability. "
                "Indian Kanoon is the mirror used for court orders; the court and case "
                "number are the citation."
            ),
        },
        "place_id": "ahmedabad",
        "compiled_at": today,
        "note": (
            "Ahmedabad's lake record is a municipal programme with a court docket beside "
            "it. AMC's budgets count 176 lakes and report progress on each; the Gujarat "
            "High Court's 2002 directions on gazetting and protecting water bodies, and "
            "its 2025 orders upholding the clearance of lake land, set the legal frame. "
            "Where AMC's budget and the AMRUT 2.0 portal disagree on the same lakes, both "
            "are stated."
        ),
        "projects": projects(),
        "court_orders": court_orders(),
    }

    text = repr((fl, pj))
    assert "—" not in text and "–" not in text, "no em or en dashes"
    write_artifact(DATA_DIR / "water-bodies-flagship-ahmedabad.json", fl, indent=1)
    write_artifact(DATA_DIR / "restoration-projects-ahmedabad.json", pj, indent=1)
    print(
        f"ahmedabad: {len(fl['bodies'])} flagship bodies, {len(pj['projects'])} projects, "
        f"{len(pj['court_orders'])} court orders",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

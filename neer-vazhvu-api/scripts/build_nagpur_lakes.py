#!/usr/bin/env python3
"""
Nagpur's flagship lakes, its lake programmes and the court orders on them.

Nagpur has no public lake register with areas. The history lives in the
Imperial Gazetteer (1908), the Maharashtra District Gazetteer (1966) and the
Supreme Court's 2025 judgment on Futala; the dam data in CWC's National
Register of Large Dams (2019); the programme in NMC's Environment Status
Reports, the State's Government Resolutions, the AMRUT 2.0 portal and NMC's
budgets; the legal frame in High Court, Supreme Court and Tribunal orders.
Every figure was checked against the saved text on 2026-10-15.

Where two official documents disagree, both figures are stated. Press reports
were used only as leads: no figure here rests on one (left out: Gandhisagar's
Rs 49.82 crore, a Futala "Rs 200 crore", the Ambazari "Rs 21.07 crore in four
phases", and the "lost" Sanjay Gandhi and Dobi lakes, which the High Court's
2026 order recites from the press).

Areas: only where an official register states one (CWC's register for
Ambazari and Gorewada, converted from hectares). Mapped extents are not
official areas and are not shown. Locations: NMC ESR 2023-24 Table 6.4
sampling points; Lendi, which has none, at the centroid of its MRSAC 2017-18
polygon. NRLD's printed Ambazari coordinates are about 25 km off: never used.

Run:  ~/.pyenv/versions/neer-vazhvu-api/bin/python neer-vazhvu-api/scripts/build_nagpur_lakes.py
"""

import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

DATA_DIR = REPO_ROOT / "public" / "data"

GR = "https://gr.maharashtra.gov.in/Site/Upload/Government%20Resolutions/Marathi/{}.pdf"
MIRROR = "https://github.com/orgpedia/mahGRs/blob/main/GRs/Urban_Development_Department/{}.pdf.mr.txt"
# Official PDFs 404 on 15 Oct 2026; the archive copy is linked instead.
NAIK_GR = "202211021115299425"
LENDI_GR = "202211021157345625"
NMC = "https://nmcnagpur.gov.in/assets/300/"
B2526 = NMC + "2025/06/mediafiles/Final_budget_2024-_2025-2026_(1).pdf"
B2627 = NMC + "2026/06/mediafiles/6a1d606eebca4_nmcbudget2026.pdf"
ESR2324 = NMC + "2025/08/Public-Notices/ESR_Final_Report_2023-2024.pdf"
ESR2223 = NMC + "2025/08/Public-Notices/ESR_final_Report_2022-2023.pdf"
AMRUT = (
    "https://amrut.mohua.gov.in/approvedProjects/list/TTN2eVhpdTRLYWVxbjFYdEllaWROQT09/"
    "UkJ0czN0UWJmNE9MemtZVEh0SC8rQT09"
)
IG1908 = "https://archive.org/details/imperialgazettee18greauoft"
GAZ = "https://gazetteers.maharashtra.gov.in/cultural.maharashtra.gov.in/english/gazetteer/Nagpur/"
GAZ_PLACES = GAZ + "places.html"
GAZ_AGRI = GAZ + "agri1.html"
GAZ_GEO = GAZ + "geo.html"
NRLD = "https://cwc.gov.in/sites/default/files/nrld06042019.pdf"
IK = "https://indiankanoon.org/doc/{}/"
SC_FUTALA = IK.format(85333771)  # SC, 7 Oct 2025, 2025 INSC 1199
HC_FUTALA = IK.format(132579417)  # HC PIL 4/2023, 30 Nov 2023
NGT_FUTALA = IK.format(144526823)  # NGT OA 73/2025, 10 Sep 2026
HC_AMBAZARI = IK.format(62849948)  # HC PIL 56/2023, 11 Jul 2024
HC_AMBAZARI_OWNER = IK.format(51036572)  # HC PIL 56/2023, 2 Jul 2025
HC_LAKES = IK.format(185727412)  # HC SMPIL 24/2026, 7 May 2026
HC_SONEGAON = IK.format(18175966)  # HC SMPIL 13/2025, 26 Nov 2025
HC_AMBAZARI_2019 = IK.format(192522868)  # HC PIL 23/2019, 26 Jun 2019
HC_WP3517 = IK.format(5339863)  # HC WP 3517/2020, 18 Dec 2020
NGT_HIGHRISE = IK.format(100278034)  # NGT OA 160/2024, 18 Jul 2025
NGT_114 = IK.format(96043262)  # NGT OA 114/2014, 5 Sep 2022


def dms(d: int, m: int, s: float) -> float:
    return round(d + m / 60 + s / 3600, 5)


# NMC ESR 2023-24, Table 6.4 (printed p.141): lake sampling points as printed.
ESR_POINTS = {
    "Futala Lake": ("FL", dms(21, 9, 6), dms(79, 2, 37)),
    "Ambazari Lake": ("AZ-1", dms(21, 7, 31.9), dms(79, 2, 34.8)),
    "Gorewada Lake": ("GD", dms(21, 11, 37.79), dms(79, 2, 27.84)),
    "Gandhisagar Lake": ("GS", dms(21, 8, 48.47), dms(79, 5, 56.35)),
    "Sonegaon Lake": ("SG-1", dms(21, 5, 54.0), dms(79, 3, 1.0)),
    "Sakkardara Lake": ("SD", dms(21, 7, 15.8), dms(79, 6, 54.1)),
    "Naik Lake": ("NK", dms(21, 9, 45.0), dms(79, 6, 47.8)),
}
# Lendi has no ESR point: centroid of MRSAC 2017-18 polygon WB_CODE 505040320101969
# (unnamed, type 01, 2.85 ha; 288 m upstream of Naik's polygon; named Lendi Talav in OSM).
LENDI_MRSAC = ("505040320101969", 21.16034, 79.11041)

HA_TO_ACRES = 2.47105
# CWC NRLD 2019 reservoir areas (m2) and gross storage (m3), PDF pp.150-151.
NRLD_DAMS = {"Ambazari": (1_530_000, 8_370_000), "Gorewada": (1_920_000, 8_840_000)}


def acres(m2: int) -> int:
    return round(m2 / 10_000 * HA_TO_ACRES)


def placed(name: str) -> dict:
    if name in ESR_POINTS:
        code, lat, lon = ESR_POINTS[name]
        return {
            "lat": lat,
            "lon": lon,
            "coord_source": f"NMC Environment Status Report 2023-24, Table 6.4 (printed p.141), sampling point {code}",
        }
    wb, lat, lon = LENDI_MRSAC
    return {
        "lat": lat,
        "lon": lon,
        "coord_source": (
            f"Centroid of MRSAC 1:10,000 water-body polygon {wb} (2017-18); NMC's 2023-24 report has no sampling point here"
        ),
    }


def bodies():
    ambazari_m2, ambazari_m3 = NRLD_DAMS["Ambazari"]
    gorewada_m2, gorewada_m3 = NRLD_DAMS["Gorewada"]
    rows = [
        {
            "name": "Futala Lake",
            "alternate_names": ["Telangkhedi Tank", "Telankhedi lake", "Phutala Lake"],
            "type": "tank",
            # 1799 is the petitioner's date as the Supreme Court recites it, not a
            # holding, and no older source carries it: shown as the court's record.
            "year_built": None,
            "era": "1799 in the Supreme Court's record (2025)",
            "builder": "Gyanoji Bhosale, in 1799 (Supreme Court of India, 2025, para 5.3)",
            "feed": (
                "the Futala stream, dammed to form the lake, which collects water from the slopes of "
                "Seminary Hills and is a tributary of the Nag (the Supreme Court, quoting the Nagpur "
                "Museum's record)"
            ),
            "status": (
                "On 7 October 2025 the Supreme Court held that Futala is a man-made water body built "
                "for irrigation and drinking water, and so not a 'wetland' under the Wetlands Rules, "
                "2017. It upheld the High Court's directions of 30 November 2023: no permanent "
                "construction within the lake, and NMC and Maha Metro to keep the water body clean. "
                "In the National Green Tribunal's case on the lake's condition, the order of 10 "
                "September 2026 recorded NMC's technical sanction of Rs 33,09,488 for a sewer for the "
                "settlement beside the lake, and the case was next listed for 29 October 2026. NMC's "
                "2023-24 sampling recorded water hyacinth on the lake."
            ),
            "cultural_note": (
                "The Supreme Court records that the lake 'along with its catchment' covers about 200 "
                "hectares; a Nagpur Museum record quoted in the judgment says it was built to give "
                "water to the Telankhedi precinct, a garden of the Bhonsle rulers with a guest house "
                "for dignitaries. The 1908 Imperial Gazetteer counts "
                "the Telinkheri reservoir among the 'worthy monuments of the best period of Bhonsla "
                "rule'. The 1966 District Gazetteer describes the Telankhedi tank's 725.6 m main dam "
                "and the 34.4 hectares of the Government Agriculture College farm and Telankhedi "
                "garden it irrigated."
            ),
            "confidence": "V",
            "sources": [SC_FUTALA, HC_FUTALA, NGT_FUTALA, IG1908, GAZ_AGRI, ESR2324],
            "source_ids": [
                "nagpur-court-docket",
                "imperial-gazetteer-1908-nagpur",
                "maharashtra-gazetteer-nagpur-1966",
                "nmc-esr",
            ],
        },
        {
            "name": "Ambazari Lake",
            "alternate_names": ["Ambazari Tank", "Ambajheri reservoir"],
            "type": "tank",
            "area_acres": acres(ambazari_m2),
            "year_built": None,
            "era": "Bhonsle-era tank, raised and piped in 1873",
            "builder": (
                "not named; built in the days of Bhonsle rule (1966 District Gazetteer); in 1873 the "
                "municipality raised the old tank's embankment by 17 feet and laid pipes to carry its "
                "water to the city by gravity, at a cost of Rs 4 lakh"
            ),
            "feed": (
                "the upper Nag, which leaves the lake as the river through the city (the 1966 Gazetteer: "
                "'almost a natural reservoir formed in the basin of the Nag river')"
            ),
            "status": (
                "CWC's National Register of Large Dams (2019) lists the dam as completed in 1870: "
                "earthfill, 13.71 m high and 952.51 m long, holding 8.37 million cubic metres over 153 "
                "hectares, operated by the State Water Resources Department and registered for "
                "irrigation. After the overflow of 23 September 2023, in which four people died "
                "according to the Collector's affidavit, the High Court is overseeing safety works "
                "(PIL 56/2023): the Irrigation Department told the court in February 2024 that the "
                "design of three 4 m by 2.5 m spillway gates was in progress, and on 2 July 2025 the "
                "court recorded that the dam's safety is NMC's responsibility as its "
                "owner. NMC's 2023-24 sampling recorded water hyacinth and greenish water."
            ),
            "cultural_note": (
                "The 1908 Imperial Gazetteer records the embankment raised again by famine labour in "
                "1900, to 1,033 yards long and 35 feet high, with a water surface of 412 acres, and "
                "that a surface drainage scheme was taken up to keep the piped supply from "
                "waterlogging the city. The "
                "1966 District Gazetteer calls Ambazari the oldest lake of its type in Nagpur, 'built "
                "in the days of the Bhosle rule', and gives its daily draw then as over 10 million litres."
            ),
            "confidence": "V",
            "sources": [
                IG1908,
                GAZ_PLACES,
                NRLD,
                HC_AMBAZARI,
                HC_AMBAZARI_OWNER,
                ESR2324,
            ],
            "source_ids": [
                "imperial-gazetteer-1908-nagpur",
                "maharashtra-gazetteer-nagpur-1966",
                "cwc-nrld-2019-nagpur",
                "nagpur-court-docket",
                "nmc-esr",
            ],
        },
        {
            "name": "Gorewada Lake",
            "alternate_names": ["Gorevada Tank"],
            "type": "tank",
            "area_acres": acres(gorewada_m2),
            "year_built": 1911,
            "builder": (
                "not named in the sources; built as the city's second source after Ambazari's supply "
                "'was inadequate to meet the demand' (1966 District Gazetteer)"
            ),
            "feed": "the Pili river ('Poli River' in CWC's register), dammed by an earthen embankment",
            "status": (
                "CWC's National Register of Large Dams (2019) lists the dam as completed in 1911: "
                "earthfill, 17.37 m high and 710 m long, holding 8.84 million cubic metres over 192 "
                "hectares, operated by the State Water Resources Department and registered for "
                "irrigation. NMC's 2023-24 sampling recorded plastics and weeds at the bank. One of "
                "NMC's three artificial idol-immersion tanks, used in Ganeshotsav 2025, is in "
                "Gorewada village (survey no. 106; estimated at Rs 19.62 crore, including works around "
                "it)."
            ),
            "cultural_note": (
                "In 1966 the District Gazetteer gave its capacity as 275.32 million cubic feet above "
                "filter level and its daily draw as 18.20 million litres, through three filters beside "
                "the reservoir."
            ),
            "confidence": "V",
            "sources": [GAZ_PLACES, NRLD, ESR2324, B2627],
            "source_ids": [
                "maharashtra-gazetteer-nagpur-1966",
                "cwc-nrld-2019-nagpur",
                "nmc-esr",
                "nmc-budget",
            ],
        },
        {
            "name": "Gandhisagar Lake",
            "alternate_names": ["Jumma Talao", "Shukrawari Talao", "Juma talao"],
            "type": "tank",
            "year_built": None,
            "era": "Bhonsle-era tank",
            "builder": (
                "the Bhonsle rulers ('a large rectangular lake built by the Bhosles and improved in "
                "later years', 1966 District Gazetteer); no individual builder or year is named"
            ),
            "status": (
                "NMC's 2023-24 report records the first phase of development as complete and a second "
                "phase under way: desilting, a walking track, a rainwater drain, edge and retaining "
                "walls, a toilet block, a sewage treatment plant, fountains, a footbridge and parking. "
                "NMC's 2022-23 report had set 2024 as the target for this lake, Sonegaon and "
                "Sakkardara. NMC's 2026-27 budget provides Rs 1 crore as its share of the lake's "
                "rejuvenation; no State sanction for the lake was found."
            ),
            "cultural_note": (
                "The 1908 Imperial Gazetteer places the Juma talao 'between the city and the railway "
                "station' among the monuments of the best period of Bhonsla rule. In 1966 the District "
                "Gazetteer described a garden with a small temple in the middle of the lake, and its "
                "fisheries list already used the name Gandhi Sagar."
            ),
            "confidence": "V",
            "sources": [IG1908, GAZ_PLACES, GAZ_GEO, ESR2324, ESR2223, B2627],
            "source_ids": [
                "imperial-gazetteer-1908-nagpur",
                "maharashtra-gazetteer-nagpur-1966",
                "nmc-esr",
                "nmc-budget",
            ],
        },
        {
            "name": "Sonegaon Lake",
            "type": "lake",
            "year_built": None,
            "era": "Described by the State as 'ancient and historic'",
            "status": (
                "Beautification in two phases: phase 1 under the State's basic-amenities scheme (Rs "
                "17.32 crore, sanctioned 28 February 2019) and phase 2 under the Tourism Department (Rs "
                "24.96 crore, 7 November 2023). NMC's 2023-24 report records phase 1 complete and "
                "phase 2 under way; NMC's 2026-27 budget provides Rs 12 crore. In November 2025 the "
                "High Court opened a case on its own motion over backwater from the lake entering "
                "homes."
            ),
            "confidence": "V",
            "sources": [GR.format("202311071447498623"), ESR2324, B2627, HC_SONEGAON],
            "source_ids": [
                "mahagr-nagpur-resolutions",
                "nmc-esr",
                "nmc-budget",
                "nagpur-court-docket",
            ],
        },
        {
            "name": "Sakkardara Lake",
            "type": "lake",
            "year_built": None,
            "status": (
                "NMC's 2023-24 report records the first phase of development complete and a second "
                "phase under way. On 10 July 2026 the State sanctioned Rs 20 crore of its own funds "
                "for works at the lake, to be executed by the Nagpur Improvement Trust."
            ),
            "cultural_note": (
                "The 1908 Imperial Gazetteer mentions the Sakardara Bagh 'about a mile from the city', "
                "with a small menagerie; the 1966 District Gazetteer lists Sakkardara among the city's "
                "old gardens."
            ),
            "confidence": "V",
            "sources": [GR.format("202607101202098425"), ESR2324, IG1908, GAZ_PLACES],
            "source_ids": [
                "mahagr-nagpur-resolutions",
                "nmc-esr",
                "imperial-gazetteer-1908-nagpur",
                "maharashtra-gazetteer-nagpur-1966",
            ],
        },
        {
            "name": "Naik Lake",
            "alternate_names": ["Naik Talao", "Naik Sarovar"],
            "type": "lake",
            "year_built": None,
            "status": (
                "Rejuvenation sanctioned under AMRUT 2.0 on 2 November 2022 at Rs 12.95 crore, with "
                "completion expected in 12 months. NMC's 2023-24 report records the first phase as "
                "complete; the AMRUT 2.0 portal lists the project as 'Project Completed' at Rs 15.95 "
                "crore (read 15 October 2026; the portal gives no dates). NMC's sampling recorded water "
                "hyacinth. The lake lies downstream of Lendi lake."
            ),
            "confidence": "V",
            "sources": [MIRROR.format(NAIK_GR), AMRUT, ESR2324],
            "source_ids": [
                "mahagr-nagpur-resolutions",
                "amrut2-portal-nagpur",
                "nmc-esr",
            ],
        },
        {
            "name": "Lendi Lake",
            "alternate_names": ["Lendi Talao"],
            "type": "lake",
            "year_built": None,
            "status": (
                "Rejuvenation sanctioned under AMRUT 2.0 on 2 November 2022 at Rs 14.13 crore, with "
                "completion expected in 12 months. NMC's 2023-24 report records that the development "
                "work 'was not completed on account of opposition from residents to removal of "
                "encroachment', and that the lake was not sampled because of dense vegetation and low "
                "water. It is not among the Nagpur projects on the AMRUT 2.0 portal (October 2026)."
            ),
            "confidence": "V",
            "sources": [MIRROR.format(LENDI_GR), ESR2324, AMRUT],
            "source_ids": [
                "mahagr-nagpur-resolutions",
                "nmc-esr",
                "amrut2-portal-nagpur",
                "mrsac-waterbodies-10k-2017-18",
            ],
        },
    ]
    for r in rows:
        r.update(placed(r["name"]))
    rows[1]["area_note"] = (
        f"{acres(ambazari_m2)} acres = 153 ha, CWC register 2019 (gross storage {ambazari_m3 / 1e6:.2f} Mm3); "
        "412 acres of water surface in the 1908 Imperial Gazetteer"
    )
    rows[2]["area_note"] = (
        f"{acres(gorewada_m2)} acres = 192 ha, CWC register 2019 (gross storage {gorewada_m3 / 1e6:.2f} Mm3)"
    )
    return rows


def projects():
    return [
        {
            "scheme_name": "AMRUT 2.0 lake rejuvenation: Naik and Lendi",
            "operator": "Nagpur Municipal Corporation",
            "financier": "AMRUT 2.0: Centre 25%, State 25%, NMC 50%",
            "scope": (
                "Two lakes sanctioned on 2 November 2022, each to be completed in 12 months: Naik "
                "(desilting, storm drain, sewer line, edge wall, toilet block, yoga shed, compound wall, "
                "immersion tank) and Lendi. The AMRUT 2.0 portal lists Naik as 'Project Completed'. "
                "NMC's 2023-24 report records Lendi's work as not completed because of opposition from "
                "residents to the removal of encroachments."
            ),
            "funding_summary": (
                "Sanctions: Naik Rs 12.95 crore (Centre 3.24, State 3.24, NMC 6.48) and Lendi Rs 14.13 "
                "crore (3.53, 3.53, 7.07). The portal lists only Naik, at Rs 15.95 crore. NMC's 2022-23 "
                "report mentions Rs 1.5 crore sought for Naik, Mangalwari and Lendi lakes under AMRUT "
                "2.0; the sanctions are the figures used here. The two GRs' text was read from the "
                "orgpedia mahGRs archive copy (the official PDFs did not open on 15 October 2026)."
            ),
            "amount_cr": round(12.95 + 14.13, 2),
            "sanctioned_year": 2022,
            "status": "Naik completed (portal); Lendi not completed",
            "sources": [
                MIRROR.format(NAIK_GR),
                MIRROR.format(LENDI_GR),
                AMRUT,
                ESR2324,
            ],
            "source_ids": [
                "mahagr-nagpur-resolutions",
                "amrut2-portal-nagpur",
                "nmc-esr",
            ],
        },
        {
            "scheme_name": "NMC lake development, phases 1 and 2",
            "operator": "Nagpur Municipal Corporation",
            "financier": "State basic-amenities grants, the 15th Finance Commission and AMRUT 2.0, per NMC's reports",
            "scope": (
                "NMC's 2023-24 report: first phase complete at Gandhisagar, Sakkardara, Sonegaon and "
                "Naik, and work complete at Police Line Takli and Binaki; Gandhisagar, Sakkardara and "
                "Sonegaon 'under 2nd phase of development and beautification', including desilting, "
                "walking tracks, rainwater drains, edge and retaining walls, toilet blocks, sewage "
                "treatment plants, fountains, footbridges and parking."
            ),
            "funding_summary": (
                "NMC's 2022-23 report records that NMC 'dedicated a huge surplus of Rs 100 crore' to "
                "Gandhisagar, Sonegaon and Sakkardara, 'to be completed by 2024'. The report cites no "
                "sanction order for the figure."
            ),
            "status": "Phase 1 done; phase 2 under way (2023-24)",
            "sources": [ESR2324, ESR2223],
            "source_ids": ["nmc-esr"],
        },
        {
            "scheme_name": "Sonegaon lake beautification",
            "operator": "Nagpur Municipal Corporation",
            "financier": "Government of Maharashtra: Urban Development (phase 1) and Tourism and Cultural Affairs (phase 2)",
            "scope": (
                "Phase 1: retaining walls on the south and north, a garden, shops, an amphitheatre, a "
                "footpath and recharge shafts. Phase 2: works on the south, west and east sides to make "
                "the lake a tourist destination."
            ),
            "funding_summary": (
                "Phase 1 Rs 17.32 crore (sanctioned 28 February 2019); phase 2 Rs 24.96 crore (7 "
                "November 2023, with Rs 8.25 crore released and the money to be spent by 31 March "
                "2024). NMC's 2026-27 budget provides Rs 12 crore (Rs 1,200 lakh) for the project."
            ),
            "amount_cr": round(17.32 + 24.96, 2),
            "sanctioned_year": 2019,
            "status": "Phase 1 done; phase 2 under way (2023-24)",
            "sources": [GR.format("202311071447498623"), ESR2324, B2627],
            "source_ids": ["mahagr-nagpur-resolutions", "nmc-esr", "nmc-budget"],
        },
        {
            "scheme_name": "Gandhisagar (Jumma Talao) rejuvenation",
            "operator": "Nagpur Municipal Corporation",
            "scope": (
                "Development and beautification of the old Bhonsle-era tank in the city centre; first "
                "phase complete and second phase under way in 2023-24, per NMC's report."
            ),
            "funding_summary": (
                "NMC's budgets carry Rs 1 crore a year as NMC's share of the lake's rejuvenation (Rs "
                "100 lakh in both 2025-26 and 2026-27). No State sanction order for the lake was found "
                "among the Government Resolutions indexed by department, so the project's total cost "
                "is not shown."
            ),
            "status": "Phase 1 done; phase 2 under way (2023-24)",
            "sources": [ESR2324, B2627, B2526],
            "source_ids": ["nmc-esr", "nmc-budget"],
        },
        {
            "scheme_name": "Sakkardara lake development",
            "operator": "Nagpur Improvement Trust",
            "financier": "Government of Maharashtra (100%), special provision for basic amenities in municipal corporation areas",
            "scope": (
                "Permissible development works at Sakkardara lake; the Collector to give "
                "administrative approval for each work."
            ),
            "amount_cr": 20,
            "sanctioned_year": 2026,
            "status": "Sanctioned 10 July 2026",
            "sources": [GR.format("202607101202098425"), ESR2324],
            "source_ids": ["mahagr-nagpur-resolutions", "nmc-esr"],
        },
        {
            "scheme_name": "Futala lakefront",
            "operator": "Maha Metro and the Nagpur Improvement Trust",
            "scope": (
                "A musical fountain, a viewers' gallery, a parking plaza and floating structures (a "
                "restaurant, a banquet hall and an artificial banyan tree). The High Court declined to "
                "order their removal but barred any permanent construction within the lake (30 "
                "November 2023); the Supreme Court upheld this on 7 October 2025. Before the Tribunal, "
                "the lake's ownership is stated to vest in the State Public Works Department."
            ),
            "funding_summary": "No cost is stated in any official document read.",
            "status": "Upheld by the Supreme Court (2025); Tribunal case open",
            "sources": [SC_FUTALA, HC_FUTALA, NGT_FUTALA],
            "source_ids": ["nagpur-court-docket"],
        },
        {
            "scheme_name": "Ambazari dam safety works and the Nag widening",
            "operator": "NMC (the dam's owner), the State Water Resources and Public Works Departments, and Maha Metro",
            "scope": (
                "A State High Level Committee (5 January 2024) to complete the works to strengthen the "
                "dam; three spillway gates of 4 m by 2.5 m, whose design the Irrigation Department "
                "reported in progress (February 2024); a "
                "high-level submersible bridge across the spill; and widening the Nag from 14 m to 18 m "
                "at Crazy Castle below the dam."
            ),
            "funding_summary": (
                "NMC's 2025-26 budget: Rs 11 crore (Rs 1,100 lakh) for strengthening the dam. State "
                "Disaster Mitigation Fund: Rs 19.84 crore to Maha Metro for the Nag widening (7 May "
                "2025). The two are separate sanctions and are not added up."
            ),
            "status": "Committee set up 2024; widening sanctioned 2025",
            "sources": [
                GR.format("202401051235518225"),
                GR.format("202505071618095219"),
                HC_AMBAZARI,
                B2526,
            ],
            "source_ids": [
                "mahagr-nagpur-resolutions",
                "nagpur-court-docket",
                "nmc-budget",
            ],
        },
        {
            "scheme_name": "Artificial idol-immersion tanks and lake upkeep",
            "operator": "Nagpur Municipal Corporation",
            "financier": "Government of Maharashtra grant (Rs 31.90 crore received)",
            "scope": (
                "Three artificial tanks for public idol immersion: at Gorewada village (estimated Rs "
                "19.62 crore), Kachhi Visa ground (estimated Rs 2.15 crore) and Police Line Takli lake "
                "(estimated Rs 8.50 crore). All three were complete and used in Ganeshotsav 2025."
            ),
            "funding_summary": (
                "Rs 30.27 crore approved by the Collector from the State grant. NMC's 2026-27 budget "
                "also provides Rs 4 crore (Rs 400 lakh) for maintenance, repair and environmental works "
                "at the city's lakes."
            ),
            "amount_cr": round(19.62 + 2.15 + 8.50, 2),
            "completed_year": 2025,
            "status": "Completed; used in Ganeshotsav 2025",
            "sources": [B2627],
            "source_ids": ["nmc-budget"],
        },
    ]


def court_orders():
    return [
        {
            "case": "Swacch Association, Nagpur v. State of Maharashtra, 2025 INSC 1199",
            "writ_petition": "Civil Appeal arising out of SLP (C) 1420/2024",
            "court": "Supreme Court of India",
            "date": "2025-10-07",
            "ruling": (
                "dismissed the appeal. It held that Futala, which it records was built in 1799 as a "
                "man-made tank for irrigation and drinking water, is not a 'wetland' under the Wetlands "
                "Rules, 2017, and "
                "upheld the High Court's directions that no permanent structure be built within the "
                "lake and that the water body be kept clean. It held that the public trust doctrine "
                "extends to man-made water bodies."
            ),
            "specific_tanks": ["Futala Lake"],
            "concern": "the lakefront's fountain, gallery and floating structures",
            "source": SC_FUTALA,
        },
        {
            "case": "Swacch Association, Nagpur v. State of Maharashtra (2023:BHC-NAG:16604-DB)",
            "writ_petition": "PIL 4/2023",
            "court": "Bombay High Court (Nagpur Bench)",
            "date": "2023-11-30",
            "ruling": (
                "declined to order removal of the musical fountain, viewers' gallery and parking plaza, "
                "directed that no construction of a permanent nature be undertaken within Futala lake, "
                "and directed Maha Metro and NMC to ensure their activities do not damage the lake and "
                "to keep the water body clean and properly maintained."
            ),
            "specific_tanks": ["Futala Lake"],
            "concern": "construction for the lakefront",
            "source": HC_FUTALA,
        },
        {
            "case": "In re: news item on Futala Lake (suo motu)",
            "writ_petition": "OA 73/2025 (WZ)",
            "court": "National Green Tribunal, Western Zone Bench",
            "date": "2026-09-10",
            "ruling": (
                "has heard the case since June 2025. A joint committee of CPCB, MPCB and NMC reported "
                "that about 145-160 houses beside the lake have no sewer and that the settlement has 8 "
                "cow shelters (gaushalas), and made seven recommendations; on 18 November 2025 the Tribunal asked "
                "NMC for an action plan with a timeline. On 10 September 2026 NMC reported a technical "
                "sanction of Rs 33,09,488 and a budget provision of Rs 36,24,426 for a sewer, and MPCB "
                "was asked whether CPCB's guidelines for dairy farms and gaushalas are followed. The "
                "case was next listed for 29 October 2026."
            ),
            "specific_tanks": ["Futala Lake"],
            "concern": "a newspaper report on the condition of the lake",
            "source": NGT_FUTALA,
        },
        {
            "case": "Public interest litigation on the Ambazari overflow of September 2023",
            "writ_petition": "PIL 56/2023",
            "court": "Bombay High Court (Nagpur Bench)",
            "date": "2024-07-11",
            "ruling": (
                "has overseen Ambazari's safety works since December 2023: it directed NMC and the "
                "Nagpur Improvement Trust to remove structures obstructing the Nag (17 January 2024), "
                "asked the State's High Level Committee to complete temporary flood-safety measures "
                "before the 2024 monsoon (8 May 2024), and recorded the Irrigation Department's "
                "affidavit that the design of three spillway gates was in progress and the need for the Nag below the dam to carry at least 75 "
                "cumecs (11 July 2024). On 2 July 2025 it recorded that the dam's safety is NMC's "
                "responsibility as its owner."
            ),
            "specific_tanks": [],
            "concern": (
                "the flood of 23 September 2023 below Ambazari dam, in which the Collector's "
                "affidavit records four deaths"
            ),
            "source": HC_AMBAZARI,
        },
        {
            "case": "Court on its own motion v. State of Maharashtra (city lakes) (2026:BHC-NAG:7264-DB)",
            "writ_petition": "Suo Motu PIL 24/2026",
            "court": "Bombay High Court (Nagpur Bench)",
            "date": "2026-05-07",
            "ruling": (
                "disposed of the case with directions to the District Collector and the NMC "
                "Commissioner to look into the issue, conduct the necessary enquiry, take the steps "
                "essential for conserving the city's lakes, and submit an action-taken report to the "
                "Registrar (Judicial) within four months."
            ),
            "specific_tanks": [],
            "concern": "newspaper reports on the degradation of several lakes in the city",
            "source": HC_LAKES,
        },
        {
            "case": "Court on its own motion v. State of Maharashtra (Sonegaon lake)",
            "writ_petition": "Suo Motu PIL 13/2025",
            "court": "Bombay High Court (Nagpur Bench)",
            "date": "2025-11-26",
            "ruling": (
                "issued notice to the State, NMC and the Nagpur Improvement Trust, returnable on 24 "
                "December 2025, and appointed an amicus curiae."
            ),
            "specific_tanks": ["Sonegaon Lake"],
            "concern": "backwater from the lake entering homes",
            "source": HC_SONEGAON,
        },
        {
            "case": "Court on its own motion v. State of Maharashtra (Ambazari lake)",
            "writ_petition": "PIL 23/2019",
            "court": "Bombay High Court (Nagpur Bench)",
            "date": "2019-06-26",
            "ruling": (
                "took on record NEERI's report on the lake's water and asked NMC to report within three "
                "weeks on removing the high concentration of phytoplankton, with a programme for "
                "periodic cleaning and for desilting."
            ),
            "specific_tanks": ["Ambazari Lake"],
            "concern": "contamination of the water",
            "source": HC_AMBAZARI_2019,
        },
        {
            "case": "Nagpur Municipal Corporation v. State of Maharashtra",
            "writ_petition": "WP 3517/2020",
            "court": "Bombay High Court (Nagpur Bench)",
            "date": "2020-12-18",
            "ruling": (
                "stayed directions on Ambazari's safety issued by the Maharashtra Water Resources "
                "Regulatory Authority on 10 December 2020, holding prima facie that the Authority "
                "lacked jurisdiction, and recorded that PIL 96/2017, disposed of on 21 March 2018, had "
                "already given comprehensive directions on the dam."
            ),
            "specific_tanks": ["Ambazari Lake"],
            "concern": "the Water Resources Regulatory Authority's directions on the dam's safety",
            "source": HC_WP3517,
        },
        {
            "case": "In re: news item on a high-rise near Ambazari lake (suo motu)",
            "writ_petition": "OA 160/2024 (WZ)",
            "court": "National Green Tribunal, Western Zone Bench",
            "date": "2025-07-18",
            "ruling": (
                "disposed of the case without directions, recording the permissions the building held "
                "and that it stands higher than the top of the spillway, and that the flood question is "
                "before the High Court in PIL 56/2023."
            ),
            "specific_tanks": [],
            "concern": "a newspaper report on flood risk from a high-rise building beside Ambazari lake",
            "source": NGT_HIGHRISE,
        },
        {
            "case": "Court on its own motion v. State of Maharashtra (Vidarbha river pollution)",
            "writ_petition": "OA 114/2014 (WZ)",
            "court": "National Green Tribunal (Special Bench)",
            "date": "2022-09-05",
            "ruling": (
                "recorded NMC's statement that it had appointed contractors and service providers for "
                "11 lakes and 3 rivers, with a project report for each."
            ),
            "specific_tanks": [],
            "concern": "pollution of rivers and lakes in Vidarbha",
            "source": NGT_114,
        },
    ]


def src(sid: str, title: str, publisher: str, **extra) -> dict:
    return {
        "id": sid,
        "title": title,
        "publisher": publisher,
        "license": registry_license(sid),
        **extra,
    }


ESR = src(
    "nmc-esr",
    "NMC Environment Status Reports 2022-23 and 2023-24 (lake status and Table 6.4 sampling points)",
    "Nagpur Municipal Corporation (prepared by CSIR-NEERI)",
)
BUDGETS = src(
    "nmc-budget",
    "NMC budgets 2025-26 and 2026-27 (lake heads, immersion tanks, Ambazari dam strengthening)",
    "Nagpur Municipal Corporation",
)
GRS = src(
    "mahagr-nagpur-resolutions",
    "Government Resolutions: Naik and Lendi lakes (AMRUT 2.0), Sonegaon phase 2, Sakkardara, Ambazari High Level Committee, Nag widening",
    "Government of Maharashtra",
)
PORTAL = src(
    "amrut2-portal-nagpur",
    "AMRUT 2.0 portal: Nagpur approved projects",
    "Ministry of Housing and Urban Affairs",
    retrieved="2026-10-15",
)
COURTS = src(
    "nagpur-court-docket",
    "Supreme Court, Bombay High Court (Nagpur Bench) and NGT orders on Futala, Ambazari, Sonegaon and the city's lakes",
    "Supreme Court of India; Bombay High Court; National Green Tribunal",
)


def check(fl: dict, pj: dict) -> None:
    names = [b["name"] for b in fl["bodies"]]
    assert len(names) == len(set(names)), "flagship names are React keys"
    assert len({p["scheme_name"] for p in pj["projects"]}) == len(pj["projects"])
    assert len({c["writ_petition"] for c in pj["court_orders"]}) == len(
        pj["court_orders"]
    )
    env = {s["id"] for s in fl["provenance"]["sources"]}
    for b in fl["bodies"]:
        assert set(b["source_ids"]) <= env, b["name"]
        assert len(set(b["sources"])) == len(b["sources"]), b["name"]
        assert b["confidence"] in ("V", "N", "C")
    envp = {s["id"] for s in pj["provenance"]["sources"]}
    for p in pj["projects"]:
        assert set(p["source_ids"]) <= envp, p["scheme_name"]
        assert p.get("amount_cr", 1) > 0, "a zero amount renders as '0' on the page"
    assert (
        acres(NRLD_DAMS["Ambazari"][0]) == 378
        and acres(NRLD_DAMS["Gorewada"][0]) == 474
    )
    assert round(12.95 + 14.13, 2) == 27.08 and round(17.32 + 24.96, 2) == 42.28
    assert round(19.62 + 2.15 + 8.50, 2) == 30.27
    assert "Ambazari Lake" in ESR_POINTS and ESR_POINTS["Ambazari Lake"][1] > 21.1, (
        "never NRLD's Ambazari"
    )
    text = repr((fl, pj))
    assert "—" not in text and "–" not in text, "no em or en dashes"


def main() -> int:
    today = date.today().isoformat()
    by = "neer-vazhvu-api/scripts/build_nagpur_lakes.py"
    fl = {
        "nvdm": "1.0",
        "dataset": "data-root/water-bodies-flagship",
        "scope": {"kind": "city", "id": "nagpur"},
        "provenance": {
            "sources": [
                src(
                    "imperial-gazetteer-1908-nagpur",
                    "Imperial Gazetteer of India, vol. XVIII (1908), Nagpur City, pp.318-320",
                    "Government of India (Clarendon Press, Oxford)",
                ),
                src(
                    "maharashtra-gazetteer-nagpur-1966",
                    "Maharashtra State Gazetteers, Nagpur District (1966), web edition: Places, Agriculture, General",
                    "Government of Maharashtra, Gazetteers Department",
                ),
                src(
                    "cwc-nrld-2019-nagpur",
                    "National Register of Large Dams 2019: Ambazari and Gorewada",
                    "Central Water Commission",
                ),
                COURTS,
                GRS,
                PORTAL,
                ESR,
                BUDGETS,
                src(
                    "mrsac-waterbodies-10k-2017-18",
                    "MRSAC 1:10,000 water bodies 2017-18: the polygon used to place Lendi lake",
                    "Maharashtra Remote Sensing Applications Centre",
                    role="input",
                ),
            ],
            "method": "manual",
            "produced_at": today,
            "produced_by": by,
            "note": (
                "Curated flagship register. Each body carries its own document links and source ids; "
                "page numbers in the text are printed pages unless marked PDF."
            ),
        },
        "place_id": "nagpur",
        "compiled_at": today,
        "note": (
            "Nagpur has no public lake register with areas. History comes from the Imperial Gazetteer "
            "(1908), the Maharashtra District Gazetteer (1966) and the Supreme Court's 2025 judgment on "
            "Futala; dam data from CWC's National Register of Large Dams (2019); current work from NMC's "
            "Environment Status Reports, the State's Government Resolutions, the AMRUT 2.0 portal and "
            "NMC's budgets. Entries are graded V (verified against a primary document), N (single "
            "source) or C (claim only); every entry here is V. Areas are given only where an official "
            "register states one: Ambazari's 378 acres and Gorewada's 474 acres are CWC's 153 and 192 "
            "hectares. Ownership is recorded differently by different documents: CWC's register names "
            "the State Water Resources Department as operator of Ambazari and Gorewada, while the High "
            "Court records Ambazari dam as NMC's property; each claim is shown with its source. NMC's "
            "2023-24 report counts 11 lakes; the three not listed here (Binaki, Pandharabodi and Police "
            "Line Takli) have no history in the documents read. Locations are NMC's 2023-24 sampling "
            "points, except Lendi, placed at the centre of its MRSAC 2017-18 polygon."
        ),
        "bodies": bodies(),
    }
    pj = {
        "nvdm": "1.0",
        "dataset": "data-root/restoration-projects",
        "scope": {"kind": "city", "id": "nagpur"},
        "provenance": {
            "sources": [GRS, PORTAL, COURTS, ESR, BUDGETS],
            "method": "manual",
            "produced_at": today,
            "produced_by": by,
            "note": (
                "Curated compilation; per-record citations carry the accountability. Indian Kanoon is "
                "the mirror used for court and tribunal orders; the court, case number and date are the "
                "citation."
            ),
        },
        "place_id": "nagpur",
        "compiled_at": today,
        "note": (
            "Nagpur's lake record is spread across four kinds of official document that do not always "
            "agree: NMC's Environment Status Reports (progress as informed by NMC), the State's "
            "Government Resolutions (sanctions and releases), the AMRUT 2.0 portal (the Centre's "
            "milestones) and NMC's budgets (each year's money). Where they give different costs or "
            "stages for the same lake, all are shown with the document each comes from. Court and "
            "tribunal orders were read on Indian Kanoon; the court, case number and date are the "
            "citation, and orders that recite press reports are carried for their directions only. "
            "Press reports were used as leads, never as figures."
        ),
        "projects": projects(),
        "court_orders": court_orders(),
    }
    check(fl, pj)
    write_artifact(DATA_DIR / "water-bodies-flagship-nagpur.json", fl, indent=1)
    write_artifact(DATA_DIR / "restoration-projects-nagpur.json", pj, indent=1)
    print(
        f"nagpur: {len(fl['bodies'])} flagship bodies, {len(pj['projects'])} projects, "
        f"{len(pj['court_orders'])} court orders",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

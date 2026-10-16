#!/usr/bin/env python3
"""
Visakhapatnam's urban water supply and the claims on its raw water.

Writes two artifacts:
  public/data/visakhapatnam-supply-overview.json   (dashboard hero + supply tile)
  public/data/allocations-visakhapatnam.json       (/visakhapatnam/allocations)

WHAT KIND OF CITY THIS IS. Visakhapatnam is a port with no large perennial
river. Its largest source is the Godavari and Yeleru system, which CGWB lists at
190 km from the city, reaching it through the Yeleru Left Main Canal and
VIWSCO's Kateru pipeline - a conveyance first built to serve the steel plant.
The same canal still feeds the steel plant, NTPC Simhadri, APIIC's industrial
parks, rural water supply and the port, so the city's supply question is as
much about who shares the canal as about how much is stored. That is why the
dashboard runs the supply-overview hero and not a days-left runway: every dam
behind the city is multi-use, and the Purushottapatnam lift refills Yeleru.

NO CURRENT SOURCE-BY-SOURCE SUPPLY TABLE FROM GVMC ITSELF WAS FOUND. The table
used here is CGWB's (Aquifer Management Plan of the Visakhapatnam and Anakapalli
urban agglomerations, 2025, Table 9.1, "As per the data provided by GVMC").
The only source-by-source table from GVMC itself that we found is a single
day, 11-03-2021, annexed to its action-taken report in NGT OA 14/2021 (SZ).
That sheet carries the per-source allocation "per irrigation year" and the
split of the Yeleru canal's tail-end water between users, which is what the
allocations ledger is built on. Its "net total" is exactly 0.85 of the gross
(65.19 of 76.69 MGD), and its LPCD is the domestic share over an assumed 2.30
million people: the net less a 13.88 MGD industrial figure, itself 70% of the
metered supply to industrial bulk consumers, leaves 51.31 MGD, or 101.41 LPCD.
Both are derived, so neither is shown as a measurement.

CARRIED FORWARD, so shown dated. CGWB's "490 MLD demand vs 391 MLD supply" is
the 2020 row of CGWB's 2022 district report carried unchanged into the 2023 and
2025 reports (supply is a constant 391 in every row to 2041); it is never
presented as a current measurement. Table 9.1's nine quantities and 380 MLD
total are also unchanged from Table 5.1 of CGWB's June 2022 report (AAP
2020-21) and its Nov 2023 report; only years and distances were re-tabulated in
2025. They are GVMC's figures of 2020-21 vintage or older and are shown dated,
not as a current reading. The 2022 and 2023 reports call the 380 MLD the raw
water available and say GVMC was able to draw 345.5 MLD of it. Press-only 2026
shortage figures stay out of both files. Press appears only beside the latest
official figure and is named as press: the 2 Sep 2026 canal release at
Payakaraopeta and the Aug 2026 Assembly remark on data-centre water.

Run:  python3 neer-vazhvu-api/scripts/build_visakhapatnam_supply.py
"""

import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

DATA_DIR = REPO_ROOT / "public" / "data"
CITY = "visakhapatnam"
# The date each source below was read; a rerun must not re-date the evidence.
EXTRACTED = "2026-10-14"
# Sources first read in the 2026-10-15 review pass.
EXTRACTED_REVIEW = "2026-10-15"
ML_PER_TMC = 28_316.8  # 1 TMC = 28.3168 million m3 = 28,316.8 ML

CGWB_2025 = (
    "https://cgwb.gov.in/cgwbpnm/public/uploads/documents/1750331736769645187file.pdf"
)
CGWB_2022 = "https://cgwb.gov.in/sites/default/files/2022-10/visakhapatnam.pdf"
GCAP_2024 = "https://www.gvmc.gov.in/WhatsNew/Whats_New_DocOct_658.pdf"
NGT_OA14_ANNEX = (
    "https://www.greentribunal.gov.in/sites/default/files/news_updates/1421_0.pdf"
)
NGT_OA40_AFFIDAVIT = (
    "https://www.greentribunal.gov.in/sites/default/files/news_updates/"
    "OA%2040%20of%202024%20Affidavit%20by%20R3%20Greater%20Vizag.pdf"
)
ADB_IEE_2019 = (
    "https://www.gvmc.gov.in/wss/image_uploads/24x7%20Water%20Supply%20in%20"
    "North-West%20sector%20(GVMC02)%20-%20IEE%20-%20Jan%202019.pdf"
)
PPA = "https://ppa.gov.in/WPSCore/Common/WebPages/Home/AboutProject.aspx"
OA606_AFFIDAVIT = (
    "https://www.greentribunal.gov.in/sites/default/files/news_updates/AFFIDAVIT%20BY%20GOVT.%20OF%20"
    "ANDHRA%20PRADESH%20IN%20OA%20606%20of%202018%20(COMPLIANCE%20OF%20MSW%20MGT%20RULES,%202016%20"
    "AND%20OTHER%20ENVIRONMENTAL%20ISSUES).pdf"
)
OA606_CS_REPORT_2024 = (
    "https://www.greentribunal.gov.in/sites/default/files/news_updates/REPORT%20BY%20CS,%20GOVT.%20OF%20"
    "ANDHRA%20PRADESH%20IN%20OA%20NO.%20606%20of%202018%20COMPLIANCE%20OF%20MSW%20MANAGEMENT%20RULES,2016.pdf"
)
CAG_AP = "https://cag.gov.in/ag/andhra-pradesh/en/audit-report"
PTI_LMC_RELEASE_2026 = "https://telanganatoday.com/chandrababu-naidu-releases-godavari-water-to-north-andhra-through-polavaram-canal"
CWC_NRLD_2019 = "https://cwc.gov.in/sites/default/files/nrld-2019.pdf"
GVMC_MGR_SOLAR_IEE_2018 = (
    "https://www.gvmc.gov.in/wss/image_uploads/Developing%203MWp%20Solar%20Energy%20Park%20at%20"
    "Meghadrigedda%20(UCCRT04)%20-%20IEE%20-%20Oct%202018.pdf"
)
VIWSCO_INFRA = "https://viwsco.in/project-infrastructure/"
VIWSCO_ABOUT = "https://viwsco.in/about/"
SEIAA = "https://parivesh.nic.in/"
HPCL_ECCR_2026 = "https://www.hindustanpetroleum.com/documents/pdf/VRMP_EC_Compliance_Report_1st_October_2025_to_31st_March_2026.pdf"

# CGWB 2025, Table 9.1 (PDF p102, printed p79). Year = the year CGWB lists for
# the source, which for Raiwada and Gambheeram looks like the year the city
# began drawing rather than the year the dam was built (dams 1981-82 and 1957).
# The nine quantities and the 380 total are the same as Table 5.1 of CGWB's
# June 2022 report (AAP 2020-21) and its Nov 2023 report: GVMC's figures of
# 2020-21 vintage or older, re-tabulated in 2025 with new distances and years.
# No cited source maps sources to zones, so `supplies` is null.
SUPPLY_MIX = [
    {
        "source": "Godavari and Yeleru, via the Yeleru canal",
        "scheme": "VIWSCO conveyance to the Narava, Aganampudi and Gajuwaka plants",
        "mld": 182,
        "supplies": None,
        "annual_mcft": None,
        "note": "CGWB gives 182 to 204 MLD for this source; its printed 380 MLD total matches the low end, so 182 is carried here. CGWB's 2022, 2023 and 2025 reports list the source at 190 km from the city. GVMC's supply sheet of 11 March 2021 prints 156 km against Yeleru reservoir and 56 km against the Kateru pump house; 56 km is the length of VIWSCO's pipeline from Kateru to the Yeleru canal, not a distance from the city. CGWB lists the source from 2005. The tail end of the canal is shared with industry (GVMC daily supply sheet, 11-03-2021, NGT OA 14/2021 (SZ) annexure).",
    },
    {
        "source": "Raiwada reservoir (Sarada river)",
        "scheme": "Raiwada water treatment plant at Narava",
        "mld": 72.5,
        "supplies": None,
        "annual_mcft": None,
        "note": "CGWB 2025 gives 60 km; CGWB 2022 and 2023 give 56 km, and GVMC's 11 March 2021 supply sheet 76 km. An irrigation dam completed in 1981-82, with a city share carved out of it.",
    },
    {
        "source": "Thatipudi reservoir (Gosthani river)",
        "scheme": "Thatipudi, 10 MGD normal supply on GVMC's 2021 sheet",
        "mld": 45.0,
        "supplies": None,
        "annual_mcft": None,
        "note": "56 km (CGWB 2025 and GVMC's 2021 sheet; CGWB 2022 and 2023 give 60), in Vizianagaram district. Completed 1968.",
    },
    {
        "source": "Meghadrigedda reservoir",
        "scheme": "To the Mindhi plant, and raw water to the Naval Dockyard and MES (GVMC, 2021)",
        "mld": 41.0,
        "supplies": None,
        "annual_mcft": None,
        "note": "5 km (CGWB 2025); GVMC's 2021 sheet gives 20 km, and CGWB 2022 and 2023 write 'GVMC' in place of a distance. CGWB lists it from 1976; CWC's National Register of Large Dams (2019, as Mehadrigedda) gives completion in 1977, and GVMC's 2018 floating-solar IEE says constructed 1977, commissioned 1979.",
    },
    {
        "source": "Gosthani river infiltration wells",
        "scheme": "Infiltration wells on the Gosthani",
        "mld": 20.5,
        "supplies": None,
        "annual_mcft": None,
        "note": "40 km (CGWB 2025 and GVMC's 2021 sheet; CGWB 2022 and 2023 give 25). CGWB dates the source to 1930; press histories say Army Engineers built it in 1942. In July 1953 the Madras Assembly was told the Military Department had offered the Gosthani works to the Government for sale in 1946-47, at Rs 18.07 lakh, and that Rs 10 lakh was paid.",
    },
    {
        "source": "Sarada river infiltration wells, Anakapalli",
        "scheme": "Anakapalli infiltration wells",
        "mld": 6.0,
        "supplies": None,
        "annual_mcft": None,
        "note": "CGWB 2025 gives 20 km; GVMC's 2021 sheet lists 'Sarada River' at 40 km.",
    },
    {
        "source": "Bheemili wells (Samayyavalasa, Nagarampalem)",
        "scheme": "Bheemili infiltration wells",
        "mld": 5.8,
        "supplies": None,
        "annual_mcft": None,
        "note": "20 km (CGWB 2025).",
    },
    {
        "source": "Mudasarlova reservoir",
        "scheme": "Mudasarlova",
        "mld": 4.5,
        "supplies": None,
        "annual_mcft": None,
        "note": "10 km (CGWB 2025 and GVMC's 2021 sheet). The town's first water works, handed over in May 1903 (Francis, Vizagapatam District Gazetteer, 1907).",
    },
    {
        "source": "Gambheeram reservoir",
        "scheme": "Gambheeram (seasonal)",
        "mld": 2.7,
        "supplies": None,
        "annual_mcft": None,
        "note": "30 km (CGWB 2025 and GVMC's 2021 sheet). Drawn seasonally.",
    },
]
CGWB_STATED_TOTAL_MLD = 380.0
# Table 9.1 gives the Godavari/Yeleru row as a range; the printed total uses 182.
GODAVARI_YELERU_RANGE_MLD = (182, 204)

# GVMC "Daily Water Supply", status 11-03-2021 (NGT OA 14/2021 (SZ) annexure,
# PDF p20). Allocation per irrigation year (TMC), "Usage so far" that irrigation
# year (TMC), and the "Treated WS (in MGD)" normal and present supply columns
# (imperial). One day only.
GVMC_2021_SOURCES = {
    "raiwada": {
        "allocation_tmc": 1.65,
        "used_tmc": 0.838,
        "normal_mgd": 15.00,
        "present_mgd": 13.657,
    },
    "meghadrigedda": {
        "allocation_tmc": 1.00,
        "used_tmc": 0.711,
        "normal_mgd": 7.65,
        "present_mgd": 8.44,
        "extra": "Of it, 5.40 MGD went to the Mindhi plant and 3.04 MGD was raw water passed on to the Naval Dockyard (DGNP) and MES.",
    },
    "thatipudi": {
        "allocation_tmc": 0.65,
        "used_tmc": 0.459,
        "normal_mgd": 10.00,
        "present_mgd": 9.87,
    },
    "gambheeram": {
        "allocation_tmc": 0.05,
        "used_tmc": 0.0,
        "normal_mgd": 0.60,
        "present_mgd": 0.00,
    },
    "mudasarlova": {
        "allocation_tmc": 0.06,
        "used_tmc": 0.0,
        "normal_mgd": 0.50,
        "present_mgd": 0.00,
    },
}
# Same sheet, Yeleru Left Main Canal: "Usage so far" against the 5.00 + 2.00 TMC
# Yeleru and 5.00 TMC Godavari (Kateru) allocations. The sheet records 0 cusecs
# released through the Kateru pump house on the previous day.
YELERU_USED_TMC = 2.691
KATERU_USED_TMC = 0.130
# Same sheet: "Realisation at Tail end (after 5 days release)" of the Yeleru
# canal, split by user. No unit is printed for this block; it is read as MGD,
# the unit of the sheet's other columns. RWS reads 0.900 on the page image, and
# the values sum exactly to 90.475.
TAIL_END_SPLIT_MGD = {
    "RINL steel plant": 35.640,
    "GVMC (Narava, Gajuwaka, Aganampudi)": 41.641,
    "APIIC industrial parks": 9.455,
    "NTPC Simhadri": 2.652,
    "Rural Water Supply": 0.900,
    "Gangavaram Port": 0.187,
    "Others (Anakapalle)": 0.0,
}
TAIL_END_STATED_MGD = 90.475
RWS_TAIL_MGD = TAIL_END_SPLIT_MGD["Rural Water Supply"]
LITRES_PER_IMPERIAL_GALLON = 4.546
NRLD_MGR_NOTE = (
    "CWC's National Register of Large Dams (2019, p59, as Mehadrigedda) lists the Water "
    "Resources Department as operating and maintaining the dam, and APWRIMS reports its storage "
    "daily; GVMC's 2018 floating-solar IEE describes the reservoir surface as owned by GVMC."
)
NRLD_GGR_NOTE = (
    "CWC's National Register of Large Dams (2019, p58, as Gambhiramgedda Reservoir) lists the "
    "Water Resources Department as operating and maintaining the dam."
)
UNIT_NOT_PRINTED = "The sheet prints no unit for its tail-end split; it is read as million gallons a day, like the sheet's other columns."


def src(sid: str, title: str, publisher: str) -> dict:
    return {
        "id": sid,
        "title": title,
        "publisher": publisher,
        "license": registry_license(sid),
    }


def check() -> None:
    total = round(sum(s["mld"] for s in SUPPLY_MIX), 1)
    if abs(total - CGWB_STATED_TOTAL_MLD) > 0.05:
        sys.exit(f"supply mix sums to {total}, CGWB states {CGWB_STATED_TOTAL_MLD}")
    if SUPPLY_MIX[0]["mld"] != GODAVARI_YELERU_RANGE_MLD[0]:
        sys.exit("Godavari/Yeleru row must carry the low end of CGWB's range")
    tail = round(sum(TAIL_END_SPLIT_MGD.values()), 3)
    if abs(tail - TAIL_END_STATED_MGD) > 0.0005:
        sys.exit(f"tail-end split sums to {tail}, sheet states {TAIL_END_STATED_MGD}")


def mgd_to_mld(mgd: float) -> float:
    return round(mgd * LITRES_PER_IMPERIAL_GALLON, 1)


def tmc(v: float) -> str:
    return "0.00" if v == 0 else f"{v:g}"


def supply_overview(today: str) -> dict:
    gvmc_share = TAIL_END_SPLIT_MGD["GVMC (Narava, Gajuwaka, Aganampudi)"]
    rinl_share = TAIL_END_SPLIT_MGD["RINL steel plant"]
    city_pct = round(100 * gvmc_share / TAIL_END_STATED_MGD)
    rinl_pct = round(100 * rinl_share / TAIL_END_STATED_MGD)
    lo, hi = GODAVARI_YELERU_RANGE_MLD
    rows_hi = round(CGWB_STATED_TOTAL_MLD - lo + hi)
    return {
        "nvdm": "1.0",
        "dataset": "data-root/supply-overview",
        "scope": {"kind": "city", "id": CITY},
        "provenance": {
            "sources": [
                src(
                    "cgwb-visakhapatnam-aquifer-plans",
                    "Aquifer Management Plan of Visakhapatnam and Anakapalli Urban Agglomerations (2025), Table 9.1, with the same quantities as Table 5.1 of CGWB's June 2022 district report",
                    "Central Ground Water Board",
                ),
                src(
                    "gvmc-whats-new",
                    "Visakhapatnam Green City Action Plan, draft for public comment (IFC for GVMC, dated Sept 2024; posted 19 Oct 2024)",
                    "Greater Visakhapatnam Municipal Corporation",
                ),
                src(
                    "ngt-andhra-filings",
                    "GVMC filings in NGT OA 14/2021 (SZ), 2021, and OA 40/2024 (SZ), 2024; Government of Andhra Pradesh filings in NGT Principal Bench OA 606/2018: the Chief Secretary's report of 10 July 2024 (Annexure-VI) and the affidavit of Feb 2026",
                    "National Green Tribunal",
                ),
            ],
            "method": "manual",
            "produced_at": today,
            "produced_by": "neer-vazhvu-api/scripts/build_visakhapatnam_supply.py",
            "note": f"Transcribed from CGWB 2025 Table 9.1 (GVMC's data; the same quantities as CGWB's June 2022 Table 5.1), the draft IFC Green City Action Plan that GVMC posted for public comment on 19 Oct 2024, GVMC's own NGT filings, and two Government of Andhra Pradesh filings in NGT Principal Bench OA 606/2018: the Chief Secretary's report of 10 July 2024 (present water supply, Annexure-VI) and the Feb 2026 affidavit (sewage figures). Table 9.1's other eight rows plus the low end of its Godavari/Yeleru range ({lo} of {lo} to {hi} MLD) are checked to sum to CGWB's printed 380 MLD total.",
        },
        "_note": "No current source-by-source supply table from GVMC itself was found. The one used is GVMC's data as CGWB reports it, first in June 2022 (AAP 2020-21) and repeated unchanged in Nov 2023 and 2025.",
        "hero_copy": {
            "headline": "A port with no large river, drawing on the Godavari and Yeleru from up to {km} km away",
            "body": (
                "{city} has no large perennial river of its own. Its largest source is the Godavari and "
                "Yeleru system, which CGWB lists at {km} km from the city; the water reaches the city "
                "through the Yeleru canal, a conveyance first built for the steel plant. About 380 MLD is "
                f"available from nine sources, {lo} to {hi} MLD of it from this system (GVMC's figures; "
                "CGWB's tables carry the same quantities unchanged since its June 2022 report). That "
                "report said GVMC was able to draw 345.5 MLD of the 380, because of shortages at Raiwada "
                "and the Gosthani. We have not found a figure that splits the system's share between the "
                "two rivers. The canal is still shared: "
                "on 11 March 2021, the only day for which we have found GVMC's split, about "
                f"{city_pct} percent of the canal's tail-end water went to the city and {rinl_pct} percent "
                "to the steel plant, with the rest to industrial parks, NTPC, rural water supply and the port."
            ),
            "wtp_label": "GVMC treatment capacity",
            "wtp_sub": "11 plants (draft Green City Action Plan, Sept 2024)",
            "uphill_label": "From the Godavari and Yeleru",
            "uphill_sub": "CGWB's distance for the Godavari/Yeleru source; the water comes by the Kateru pipeline and the Yeleru canal",
            "pop_label": "People served (estimate)",
            "pop_sub": "GVMC's own estimate in its NGT filings (2021, 2024); no census since 2011",
            "footer": (
                "Supply by source is GVMC's data as CGWB reported it in June 2022 and again, unchanged, "
                "in 2023 and 2025. Treatment capacity and litres per person from the draft Green City "
                "Action Plan that GVMC posted for public comment in Oct 2024. The canal split is GVMC's "
                "daily supply sheet of 11 March 2021, filed with the National Green Tribunal; the sheet "
                "prints no unit for the split, which is read as million gallons a day like its other "
                "columns. The draft plan puts water losses at nearly 30 percent (p30) and at 35 percent "
                "(p72) without saying how either was measured, and we have not found a measured "
                "non-revenue water figure for GVMC, so no losses figure is shown."
            ),
        },
        "supply_chain": [
            "Godavari water lifted at two points: VIWSCO's Kateru pump house, into a 56 km pipeline to the Yeleru canal (since December 2004), and the Purushottapatnam lift, through the Polavaram Left Main Canal into Yeleru reservoir (since July 2018)",
            "The Yeleru canal, about 150 km to the city (draft Green City Action Plan, p30), run with the Kateru pipeline by VIWSCO, a company GVMC and APIIC own",
            "Shared at the tail end with the steel plant, NTPC, APIIC industrial parks, rural water supply and the port",
            "Raiwada, Thatipudi, Meghadrigedda, Mudasarlova and the seasonal Gambheeram reservoirs, and infiltration wells on the Gosthani and Sarada",
            "11 treatment plants rated 489 MLD",
            "About 23 lakh people at 105 to 110 litres a person a day",
        ],
        "_view_overrides": {
            "subtitle": "GVMC's supply by source as CGWB has reported it since June 2022 (AAP 2020-21), unchanged in its 2023 and 2025 reports, with treatment capacity from the draft Green City Action Plan (2024). We have not found a newer source-by-source table from GVMC itself.",
            "wtp_label": "GVMC treatment capacity",
        },
        "current_supply_mix_mld": SUPPLY_MIX,
        "current_supply_total_mld": CGWB_STATED_TOTAL_MLD,
        "_supply_total_note": (
            "CGWB states 380 MLD in Table 9.1 (83.67 MGD in its text) and 391 MLD in Table 9.3 of the "
            "same report; the draft Green City Action Plan (2024) gives about 395.5 MLD. Table 9.1's "
            f"rows add to 380 to {rows_hi} MLD depending on the Godavari/Yeleru value ({lo} to {hi}); its "
            f"printed 380 total matches the low end, so 380 and {lo} are carried. 380 MLD also appears "
            "in CGWB's June 2022 and Nov 2023 reports, which call it the raw water available and say "
            "GVMC was able to draw 345.5 MLD of it. The Chief Secretary's report of 10 July 2024 in "
            "NGT Principal Bench OA 606/2018 (Annexure-VI, PDF p33) gives GVMC's present water supply "
            "as 334.03 MLD."
        ),
        "wtps_summary": {
            "fresh_water_wtps_count": 11,
            "fresh_water_capacity_mld": 489,
            "total_installed_capacity_mld": 489,
            "note": "'Eleven water treatment plants with a total capacity of 489 MLD (107.46 MGD)' (draft Green City Action Plan, p30). No plant-by-plant list with commissioning years was found.",
        },
        "distribution": {
            "population_served": 2_300_000,
            "note": "GVMC's own estimate ('about 23.00 lakhs') in its NGT filings of 2021 and 2024. The draft Green City Action Plan puts the distribution network at about 2,600 km.",
        },
        "allocation_context": {
            "transmission_distance_km": 190,
            "_lpcd_range": [105, 110],
            "_lpcd_standard": 135,
            "_lpcd_note": "'The per capita water supply, on average, is about 105 to 110 LPCD against the standard of 135 LPCD' (draft Green City Action Plan, p30). A city-wide average; the plan does not say how it was worked out.",
        },
        "_sewage": {
            "generation_mld": 248.0,
            "installed_capacity_mld": 237.0,
            "utilised_mld": 179.0,
            "gap_mld": 69.0,
            "households_connected": 195_025,
            "population_connected_pct": 60,
            "reuse_mld": 33.0,
            "reuse_to_hpcl_mld": 25.0,
            "as_of": "2026-02",
            "source_url": OA606_AFFIDAVIT,
            "source_label": "Government of Andhra Pradesh affidavit, NGT Principal Bench OA 606/2018 (Feb 2026), PDF pp71, 78",
            "_note": "Generation, installed capacity, utilisation and the gap are the state's own row for Visakhapatnam; reuse is '33 MLD (21%)', of which 25 MLD goes to the HPCL refinery. GVMC's own NGT affidavit of Mar 2024 (OA 40/2024 (SZ)) gives a different figure: it estimated generation at 215.05 MLD (85% of supply at 110 litres a person a day for about 23 lakh people). The later state figure is used.",
        },
        "groundwater": {
            "official_mld": None,
            "_note": "GVMC's supply sheet of 11 March 2021 lists 2.75 million gallons a day (about 12.5 MLD) from bores: 2.25 from 219 power-bore schemes and 0.50 from 8,224 hand bores. Both rows give the same figure for normal and present supply, so it reads as a set figure, not a reading. The draft Green City Action Plan (2024) says 30 percent of the city's water needs are met from groundwater. CGWB 2025 puts groundwater at 17.37 percent of supply, counting 30 MCM a year from its 2023 resource assessment against 142.71 MCM from surface water. No measured figure for how much groundwater the city draws was found.",
        },
        # Order matters: build_visakhapatnam_facts.py reads [0] as CGWB and [1]
        # as the Green City Action Plan. New sources go at the end.
        "_sources": [
            {
                "name": "CGWB, Aquifer Management Plan of Visakhapatnam and Anakapalli UAs (2025), Table 9.1 (same quantities as CGWB's June 2022 Table 5.1)",
                "url": CGWB_2025,
                "date": "2025",
                "extracted": EXTRACTED,
            },
            {
                "name": "Visakhapatnam Green City Action Plan, draft posted for public comment on 19 Oct 2024 (IFC for GVMC), p30",
                "url": GCAP_2024,
                "date": "2024-09",
                "extracted": EXTRACTED,
            },
            {
                "name": "GVMC Daily Water Supply sheet, 11-03-2021 (NGT OA 14/2021 (SZ) annexure)",
                "url": NGT_OA14_ANNEX,
                "date": "2021-03-12",
                "extracted": EXTRACTED,
            },
            {
                "name": "GVMC Commissioner's affidavit, NGT OA 40/2024 (SZ)",
                "url": NGT_OA40_AFFIDAVIT,
                "date": "2024-03-27",
                "extracted": EXTRACTED,
            },
            {
                "name": "CGWB, Aquifer Mapping and Management of Ground Water Resources, Visakhapatnam District (AAP 2020-21), Table 5.1",
                "url": CGWB_2022,
                "date": "2022-06",
                "extracted": EXTRACTED,
            },
            {
                "name": "Government of Andhra Pradesh affidavit, NGT Principal Bench OA 606/2018, PDF pp71, 78",
                "url": OA606_AFFIDAVIT,
                "date": "2026-02",
                "extracted": EXTRACTED,
            },
            {
                "name": "VIWSCO, Project Infrastructure (Kateru pump house and 56 km Godavari pipeline)",
                "url": VIWSCO_INFRA,
                "date": EXTRACTED_REVIEW,
                "extracted": EXTRACTED_REVIEW,
            },
            {
                "name": "VIWSCO, About (pipeline completed December 2004; GVMC and APIIC shareholding)",
                "url": VIWSCO_ABOUT,
                "date": EXTRACTED_REVIEW,
                "extracted": EXTRACTED_REVIEW,
            },
            {
                "name": "CAG Report No. 4 of 2025, Polavaram Irrigation Project (Purushottapatnam lift completed by July 2018)",
                "url": CAG_AP,
                "date": "2025",
                "extracted": EXTRACTED,
            },
            {
                "name": "Chief Secretary, Government of Andhra Pradesh, report in NGT Principal Bench OA 606/2018, 10.07.2024, Annexure-VI, PDF p33 (GVMC present water supply 334.03 MLD)",
                "url": OA606_CS_REPORT_2024,
                "date": "2024-07-10",
                "extracted": EXTRACTED,
            },
        ],
    }


def arrangement(
    aid,
    source,
    authority,
    recipient,
    entitled,
    received,
    instrument,
    confidence,
    note=None,
):
    row = {"id": aid, "source": source}
    # NVDM 7.6: a direct arrangement omits authority_id rather than nulling it.
    if authority:
        row["authority_id"] = authority
    row |= {
        "recipient": recipient,
        "entitled": entitled,
        "received": received,
        "instrument": instrument,
        "confidence": confidence,
    }
    if note:
        row["note"] = note
    return row


def q(value, unit, basis=None, year=None, note=None) -> dict:
    return {"value": value, "unit": unit, "basis": basis, "year": year, "note": note}


SHEET_2021 = {
    "label": "GVMC Daily Water Supply sheet, 11-03-2021 (NGT OA 14/2021 (SZ))",
    "url": NGT_OA14_ANNEX,
}
TAIL_END_BASIS = "GVMC's supply sheet: 'Realisation at Tail end (after 5 days release)'; no unit printed"


def received_2021(mgd: float) -> dict:
    """One user's share of the canal's tail-end water on the 2021 sheet."""
    if mgd == 0:
        day = "One day, 11 March 2021, from GVMC's own supply sheet, which records 0.00 for this user that day."
    else:
        day = f"Raw canal water realised at the canal's tail end on one day, 11 March 2021, from GVMC's own supply sheet (about {mgd_to_mld(mgd)} MLD at 4.546 litres to the imperial gallon)."
    return q(
        mgd,
        "MGD",
        basis=TAIL_END_BASIS,
        year="2021",
        note=f"{day} {UNIT_NOT_PRINTED}",
    )


def reservoir_received(name: str, row: dict) -> dict:
    """GVMC's supply from one reservoir on the 2021 sheet, with the year-to-date
    use against the allocation kept in the note: moving it into the value with
    unit TMC/yr would print a false shortfall, as the irrigation year still had
    months to run."""
    present, normal = row["present_mgd"], row["normal_mgd"]
    if present == 0:
        that_day = f"nothing that day, against a normal supply of {normal:.2f} MGD."
    else:
        that_day = f"{present:g} MGD that day (about {mgd_to_mld(present)} MLD at 4.546 litres to the imperial gallon)."
    extra = f" {row['extra']}" if row.get("extra") else ""
    return q(
        present,
        "MGD",
        basis="GVMC's supply sheet: 'Treated WS (in MGD), Present Supply'",
        year="2021",
        note=(
            f"GVMC's supply from {name} on one day, 11 March 2021, as the 'Treated WS, Present "
            f"Supply' column of its daily sheet records it: {that_day}{extra} Used so far in the "
            f"irrigation year, as at that date: {tmc(row['used_tmc'])} TMC of the "
            f"{row['allocation_tmc']:.2f} TMC allocation."
        ),
    )


def allocations(today: str) -> dict:
    lmc_mld = round(23.44 * ML_PER_TMC / 365, 0)
    gvmc_tail = TAIL_END_SPLIT_MGD["GVMC (Narava, Gajuwaka, Aganampudi)"]
    arrangements = [
        arrangement(
            "polavaram-lmc-visakhapatnam",
            "Godavari, via the Polavaram Left Main Canal",
            "ap-wrd",
            "Visakhapatnam city and its industries",
            q(
                23.44,
                "TMC/yr",
                basis="Polavaram project water-utilisation provision",
                note="23.44 TMC in the Polavaram Project Authority's project page, the Ministry of Jal Shakti's 2024 note and CAG Report 4 of 2025. The ADB environmental review GVMC published (Jan 2019) cites GO MS No.96 of 10-09-2004 for 24 TMC (1,855 MLD); CGWB 2025 says 12 TMC for the urban area. The documents also describe the beneficiaries differently: the city's domestic and industrial needs, the steel plant, or 611 villages en route.",
            ),
            q(
                None,
                "TMC/yr",
                note="The Purushottapatnam lift, completed by July 2018 (CAG), pumps Godavari flood water through part of this canal (km 1.8 to km 57.9) and on into Yeleru reservoir, which feeds the city (G.O.Ms.No.100 of 2016). No quantity reaching the city from it was found. We have not found an official record of a delivery to the city under the 23.44 TMC Polavaram share; CAG reported the canal at 76.05% physical progress in March 2023, the latest official figure we have found. Press reports of 2 Sep 2026 say Godavari water was released through the canal's regulator at Payakaraopeta that day, and that the state plans to take it to Visakhapatnam next year.",
            ),
            {"label": "Polavaram Project Authority, About the Project", "url": PPA},
            "medium",
        ),
        arrangement(
            "yeleru-viwsco-gvmc",
            "Yeleru reservoir, via the Yeleru canal",
            "ap-wrd",
            "GVMC (its share of a joint GVMC and VIWSCO entitlement)",
            q(
                7.00,
                "TMC/yr",
                basis="GVMC's supply sheet: 'Allocation (per Irrig. year)', printed as 5.00 + 2.00",
                year="2021",
                note="An archived AP Water Resources Department Yeleru project page (Wayback capture of 30 Sep 2023; unchanged since at least Jan 2016, with a 2015-16 budget line; the live site no longer resolves) listed 'Water Allocation for Industries (for G.V.M.C or VIWSCo): 5.00 TMC', matching the 5.00 on GVMC's 2021 sheet. VIWSCO's own site gives Yeleru an allocated share of 7 TMC. The government order behind the additional 2.00 TMC was not found.",
            ),
            q(
                gvmc_tail,
                "MGD",
                basis=TAIL_END_BASIS,
                year="2021",
                note=(
                    "GVMC's share of the canal's tail-end water on 11 March 2021: raw canal water at its "
                    f"Narava, Gajuwaka and Aganampudi intakes (about {mgd_to_mld(gvmc_tail)} MLD at 4.546 "
                    f"litres to the imperial gallon). {UNIT_NOT_PRINTED} The whole tail-end realisation that "
                    f"day was {TAIL_END_STATED_MGD}, shared with the steel plant, the port, NTPC and APIIC "
                    f"(rows below) and {RWS_TAIL_MGD:.3f} to Rural Water Supply, which has no row here. Used so far in "
                    f"the irrigation year, as at that date: {YELERU_USED_TMC} TMC of the 5.00 + 2.00 TMC "
                    f"Yeleru allocation, and {KATERU_USED_TMC:.3f} TMC of the 5.00 TMC Godavari allocation "
                    "through Kateru."
                ),
            ),
            SHEET_2021,
            "medium",
            note=f"The received figure is GVMC's own share of the canal's tail-end water that day; the canal also carried the industrial shares listed below and {RWS_TAIL_MGD:.3f} to Rural Water Supply.",
        ),
        arrangement(
            "godavari-kateru-viwsco",
            "Godavari, lifted at Kateru into the Yeleru canal",
            "ap-wrd",
            "GVMC and VIWSCO",
            q(
                5.00,
                "TMC/yr",
                basis="GVMC's supply sheet: 'Allocation (per Irrig. year)'",
                year="2021",
                note="APIIC's 2009 project note says VIWSCO 'envisage[s] drawals of 5 TMC of water from River Godavari & 5 TMC from Yeleru'. No government order for the Godavari 5 TMC was found.",
            ),
            q(
                KATERU_USED_TMC,
                "TMC",
                basis="GVMC's supply sheet: 'Usage so far' (irrigation year to date)",
                year="2021",
                note=f"Used so far in the irrigation year as at 11 March 2021, against {YELERU_USED_TMC} TMC used from Yeleru. The same sheet records 0 cusecs released through the Kateru pump house the previous day. Its MGD columns do not split canal water by source.",
            ),
            SHEET_2021,
            "low",
        ),
    ]
    # CWC's National Register of Large Dams (2019) lists the Water Resources
    # Department as operating and maintaining Raiwada, Thatipudi, Meghadrigedda
    # and Gambheeram. Mudasarlova is not in the register and stays direct.
    for code, label, authority, note in [
        ("raiwada", "Raiwada reservoir (Sarada river)", "ap-wrd", None),
        ("meghadrigedda", "Meghadrigedda reservoir", "ap-wrd", NRLD_MGR_NOTE),
        ("thatipudi", "Thatipudi reservoir (Gosthani river)", "ap-wrd", None),
        ("gambheeram", "Gambheeram reservoir", "ap-wrd", NRLD_GGR_NOTE),
        ("mudasarlova", "Mudasarlova reservoir", None, None),
    ]:
        row = GVMC_2021_SOURCES[code]
        arrangements.append(
            arrangement(
                f"{code}-gvmc",
                label,
                authority,
                "GVMC",
                q(
                    row["allocation_tmc"],
                    "TMC/yr",
                    basis="GVMC's supply sheet: 'Allocation (per Irrig. year)'",
                    year="2021",
                ),
                reservoir_received(label.split(" (")[0], row),
                SHEET_2021,
                "medium",
                note=note,
            )
        )
    arrangements += [
        arrangement(
            "rinl-viwsco",
            "Yeleru canal (Godavari and Yeleru water)",
            "viwsco",
            "RINL Visakhapatnam Steel Plant",
            q(
                45,
                "MGD",
                basis="VIWSCO Board item 43/7 (24.12.2009) schedule rising to 45 MGD from 2014-15; RINL's 2020 environmental clearance amendment gives 45 MGD as its total requirement at 7.3 MTPA",
                year="2009",
                note="The Board minute confirms this schedule 'subject to availability of required water in Godavari River and Yeleru Reservoir and subject to enhanced rate which will be negotiated and settled mutually' (VIWSCO Board item 43/7, 24.12.2009). So the shortfall shown is against a conditional schedule, not a fixed quota.",
            ),
            received_2021(TAIL_END_SPLIT_MGD["RINL steel plant"]),
            {
                "label": "RINL pre-feasibility report (2018), Appendix I: VIWSCO Board minute of 24.12.2009",
                "url": "https://environmentclearance.nic.in/writereaddata/Online/TOR/29_Mar_2018_161925363K0QEK7UDUploadedPFR.pdf",
            },
            "medium",
            note="RINL's own environmental statements report total water use of 1,15,055 KLD (2022-23) and 1,20,428 KLD (2023-24); that is a consumption figure under a different definition, so it is not compared with the canal share.",
        ),
        arrangement(
            "apiic-viwsco",
            "Yeleru canal",
            "viwsco",
            "APIIC industrial parks",
            q(
                None,
                "MGD",
                note="No overall entitlement found. Individual approvals appear in environmental clearances, for example 39 MLD for the Nakkapalli park (2024).",
            ),
            received_2021(TAIL_END_SPLIT_MGD["APIIC industrial parks"]),
            SHEET_2021,
            "low",
        ),
        arrangement(
            "ntpc-viwsco",
            "Yeleru canal",
            "viwsco",
            "NTPC Simhadri",
            q(None, "MGD", note="No plant-level entitlement found."),
            received_2021(TAIL_END_SPLIT_MGD["NTPC Simhadri"]),
            SHEET_2021,
            "low",
        ),
        arrangement(
            "gangavaram-port-viwsco",
            "Yeleru canal",
            "viwsco",
            "Gangavaram Port",
            q(
                1200,
                "KLD",
                basis="'Permission for withdrawal of 1200 KLD from VISCOW is available' - the port's environmental clearance, 24.12.2021",
                year="2021",
            ),
            received_2021(TAIL_END_SPLIT_MGD["Gangavaram Port"]),
            SHEET_2021,
            "medium",
        ),
        # The tripartite agreement novated the three 2020 GVMC-HPCL agreements
        # (45 LIGD clear water) to GVSCCL and replaced 36.2 LIGD of that clear
        # water with recycled water. The two rows below add up to its 75 LIGD
        # contracted quantity, with nothing counted twice.
        arrangement(
            "hpcl-gvmc-fresh",
            "GVMC clear water (Raiwada, Meghadrigedda and Thatipudi under the 2020 agreements)",
            None,
            "HPCL Visakh Refinery",
            q(
                8.8,
                "lakh imperial gallons/day",
                basis="Tripartite GVMC-GVSCCL-HPCL agreement, renewed 10.06.2025, in force from 29.03.2024: the clear-water share of the 75 LIGD contract (1 LIGD of it to HPCL's Waltair Park housing)",
                year="2024",
                note="The three GVMC agreements of 01.06.2020 set 45 LIGD (20.46 MLD) of clear water. Under the tripartite agreement, 36.2 LIGD of that was replaced by recycled water and 'GVMC shall continue to supply only 8.8 LIGD (4 MLD) of clear water to HPCL'. The 2020 agreements 'have been subsumed into this tripartite agreement'.",
            ),
            q(None, "MLD", note="No delivered figure found."),
            {
                "label": "HPCL Visakh Refinery EC compliance report, Oct 2025-Mar 2026, pp106-110",
                "url": HPCL_ECCR_2026,
            },
            "high",
        ),
        arrangement(
            "hpcl-gvsccl-recycled",
            "Recycled water from GVSCCL's treatment and RO plant at the Narava sewage plant",
            None,
            "HPCL Visakh Refinery",
            q(
                66.2,
                "lakh imperial gallons/day",
                basis="Tripartite agreement renewed 10.06.2025, in force from 29.03.2024: 36.2 LIGD replacing GVMC clear water plus 30 LIGD more; supply from 1 July 2023",
                year="2024",
                note="'The \"Contracted Quantity\" is 75 LIGD [34.10 Million Litres Per Day (MLD)]': 66.2 LIGD (30.10 MLD) of recycled water from GVSCCL, the smart-city company the state and GVMC jointly own, and 8.8 LIGD (4 MLD) of clear water from GVMC (row above).",
            ),
            q(
                25,
                "MLD",
                year="2026",
                note="The Government of Andhra Pradesh's affidavit in NGT Principal Bench OA 606/2018 (Feb 2026) reports 25 MLD of tertiary-treated water reused at the refinery.",
            ),
            {
                "label": "HPCL Visakh Refinery EC compliance report, Oct 2025-Mar 2026, pp106-110",
                "url": HPCL_ECCR_2026,
            },
            "high",
        ),
    ]
    return {
        "nvdm": "1.0",
        "dataset": "data-root/allocations",
        "scope": {"kind": "city", "id": CITY},
        "provenance": {
            "sources": [
                src(
                    "ngt-andhra-filings",
                    "GVMC Daily Water Supply sheet, 11-03-2021 (NGT OA 14/2021 (SZ) annexure); Government of Andhra Pradesh affidavit in NGT Principal Bench OA 606/2018 (Feb 2026)",
                    "National Green Tribunal",
                ),
                src(
                    "ppa-polavaram",
                    "Polavaram Project Authority, About the Project",
                    "Polavaram Project Authority",
                ),
                src(
                    "industry-ec-compliance-visakhapatnam",
                    "RINL, HPCL and Gangavaram Port environmental filings",
                    "Operators' statutory environmental filings",
                ),
                # A one-time 2019 document on GVMC's Projects page, registered as
                # its own closed source.
                {
                    "id": "gvmc-adb-iee-24x7-nw-2019",
                    "as_of": "2019-01",
                    "title": "ADB IEE, 24x7 Water Supply in North-West sector (GVMC/02), Jan 2019",
                    "publisher": "Greater Visakhapatnam Municipal Corporation (ADB project)",
                    "url": ADB_IEE_2019,
                    "license": registry_license("gvmc-adb-iee-24x7-nw-2019"),
                },
                src(
                    "seiaa-ap-clearances",
                    "SEIAA Andhra Pradesh environmental clearances: three data-centre campuses (2026) and APIIC's data-centre park at Madhurawada (2024)",
                    "State Environment Impact Assessment Authority, Andhra Pradesh",
                ),
            ],
            "method": "manual",
            "produced_at": today,
            "produced_by": "neer-vazhvu-api/scripts/build_visakhapatnam_supply.py",
            "note": "A register of documented claims, not a verified legal entitlement register: the operative orders for the Polavaram share (GO MS 96 of 2004), the Godavari 5 TMC, the Yeleru +2 TMC and the VIWSCO concession are cited by other documents but were not found.",
        },
        "place_id": CITY,
        "updated": today,
        "headline": "One canal, many claimants",
        "intro": (
            "Visakhapatnam's biggest source is the Godavari and Yeleru system, which CGWB lists at about "
            "190 km from the city; the water reaches the city through the Yeleru canal. The same canal "
            "feeds the steel plant, NTPC, APIIC's industrial parks, rural water supply and the port. Each "
            "row below is a documented claim on that water or on the city's own reservoirs, with the "
            "instrument that sets it and the one dated record found of what was actually delivered. Where "
            "the instrument is cited but was not found, the row says so."
        ),
        "unit_note": (
            "TMC is a thousand million cubic feet (28.32 million cubic metres). MGD in GVMC's records is imperial: "
            "one million imperial gallons is 4.546 million litres. LIGD is lakh imperial gallons a day. GVMC's "
            "sheet gives allocations 'per irrigation year' without defining it; the water year in the Government "
            "of India's May 2014 Polavaram Project Authority notification, as CAG quotes it, runs 1 June to 31 May. Received figures "
            "for the canal and reservoir rows are from a single day, 11 March 2021, the only day for which we "
            "have found GVMC's split: canal rows are raw water realised at the canal's tail end (the Kateru row gives "
            "use so far in the irrigation year); reservoir rows "
            "are GVMC's supply from that reservoir as the sheet's 'Treated WS, Present Supply' column records it. "
            "The HPCL recycled-water figure is from the Government of Andhra Pradesh's February 2026 affidavit in "
            "NGT Principal Bench OA 606/2018."
        ),
        "authorities": [
            {
                "id": "ap-wrd",
                "name": "Water Resources Department, Government of Andhra Pradesh",
                "role": "Operates Yeleru, Raiwada, Thatipudi, Meghadrigedda and Gambheeram reservoirs and the Polavaram project, and sets water allocations from them.",
                "capacity": "Yeleru 24.11 TMC gross; Raiwada 3.60 TMC; Thatipudi 3.325 TMC; Meghadrigedda 1.169 TMC (APWRIMS); Gambheeram 3.18 million cubic metres, about 0.11 TMC (CWC NRLD 2019)",
                "committed": "Publishes daily reservoir storage on APWRIMS.",
                "tension": "The same reservoirs serve irrigation, the steel plant and the city.",
                "source_refs": ["apwrims", "cwc-nrld-2019"],
            },
            {
                "id": "viwsco",
                "name": "Visakhapatnam Industrial Water Supply Company (VIWSCO)",
                "role": "Carries Godavari and Yeleru water along the Yeleru canal to the city and industry under a concession from the state; commissioned December 2004 and restructured with GVMC and APIIC as promoters.",
                "capacity": None,
                "committed": "Concession agreement not found.",
                "tension": "One conveyance serves the city and the steel plant; no order setting how its water is shared in a dry year was found.",
                "source_refs": ["apiic-viwsco", "viwsco-site"],
            },
            {
                "id": "gvmc",
                "name": "Greater Visakhapatnam Municipal Corporation (GVMC)",
                "role": "The city's water utility and a promoter of VIWSCO.",
                "capacity": "About 380 MLD available from nine sources (GVMC's figures; CGWB's tables carry the same quantities unchanged since its June 2022 report, which said GVMC was able to draw 345.5 MLD)",
                "committed": "No current source-by-source supply table of its own was found; one daily sheet (11-03-2021) was found in an NGT filing.",
                "tension": "Shares its largest source with industry, and is contracted to supply 8.8 LIGD of clear water to HPCL; the smart-city company GVSCCL, which the state and GVMC jointly own, supplies the refinery's recycled water.",
                "source_refs": ["gvmc-2021-sheet", "cgwb-2025", "cgwb-2022"],
            },
        ],
        "arrangements": arrangements,
        "events": [
            {
                "year": 1989,
                "title": "City scheme to draw from the Yeleru and Raiwada canals cleared technically",
                "note": "CPHEEO gave technical approval on 23 March 1989 to a city scheme to draw 16 MGD from the Yeleru and Raiwada canals, at an estimated cost of Rs 32.16 crore. The corporation, the state government and an LIC loan were to meet the cost.",
                "source_refs": ["ls-usq-6630-1992"],
            },
            {
                "year": 1991,
                "title": "Yeleru water reaches the steel plant",
                "note": "The Yeleru water supply scheme was completed in June 1991 and water started reaching the steel plant in July.",
                "source_refs": ["rs-usq-7230-1994"],
            },
            {
                "year": 2004,
                "title": "VIWSCO project commissioned",
                "note": "VIWSCO's project, including the Kateru pump house and a 56 km pipeline that carry Godavari water into the Yeleru Left Main Canal, was commissioned in December 2004; the state's Yeleru scheme had supplied the steel plant since July 1991.",
                "source_refs": ["apiic-viwsco", "viwsco-site"],
            },
            {
                "year": 2015,
                "title": "Water rate fixed for RINL, NTPC and GVMC",
                "note": "G.O.Ms.No.24 (25 Feb 2015) fixed Rs 11.80 per KL for 2012-13 with 5% a year escalation, and ordered VIWSCO to improve canal maintenance 'on priority'.",
                "source_refs": ["go-ms-24-2015"],
            },
            {
                "year": 2018,
                "title": "Purushottapatnam lift completed",
                "note": "The lift that pumps Godavari water into the Polavaram Left Main Canal and on to Yeleru was completed by July 2018 (CAG).",
                "source_refs": ["cag-4-2025", "go-ms-100-2016"],
            },
            {
                "year": 2026,
                "title": "Yeleru water allocated to Pampa reservoir (Rabi 2025-26)",
                "note": "G.O.Rt.No.203 (17 Apr 2026) gave permission to allocate 0.518 TMC from Yeleru to the Pampa project, at 50 cusecs for 16 Jan to 15 May 2026, for the Rabi 2025-26 crop in 5,000 acres.",
                "source_refs": ["go-rt-203-2026"],
            },
        ],
        "futures": [
            {
                "id": "polavaram-lmc",
                "project": "Polavaram Left Main Canal water for Visakhapatnam",
                "mld": lmc_mld,
                "earmarked_for": [
                    "Visakhapatnam city",
                    "Industry including the steel plant",
                ],
                "status": "CAG reported 76.05% physical progress on the canal works in March 2023, the latest official figure we have found. Press reports of 2 Sep 2026 say the regulator on the canal at Payakaraopeta, in Anakapalli district, was opened that day to release Godavari water towards north Andhra, with the water to fill the Yeleru canal and 110 tanks in the district, and that the state plans to take Godavari water to Visakhapatnam next year. We have not found an official record of the release. The figure is 23.44 TMC a year expressed per day.",
                "source_refs": ["ppa", "cag-4-2025", "pti-lmc-release-2026"],
            },
            {
                "id": "data-centres-2026",
                "project": "Three data-centre campuses (Tarluvada, Rambilli, Adavivaram)",
                # Fresh water only, like the Madhurawada and AM/NS rows.
                "mld": round((239 + 207 + 246) / 1000, 2),
                "earmarked_for": ["Data centres"],
                "status": "State environmental clearances of 18 Apr 2026 (Tarluvada, 1,000 MW, 267 KLD: 239 fresh, 28 recycled on site; Rambilli, 1,000 MW, 234 KLD: 207 fresh, 27 recycled on site) and 10 Jun 2026 (Adavivaram, 512 MW, 307 KLD: 246 fresh, 61 recycled on site; air-cooled chillers) name Rural Water Supply and Sanitation as the source of water. The recycled part is each campus's own treated wastewater, so the fresh water is the claim on Rural Water Supply and Sanitation; no cooling-water source is stated. 0.69 MLD is the three fresh-water figures added (0.81 MLD with the water recycled on site). Press reports of 19 Aug 2026 quoted the state IT minister as telling the Assembly that a 6.5 GW cluster would need about 3 TMC of water a year; we have not found the Assembly's own record.",
                "source_refs": ["seiaa-dc-2026"],
            },
            {
                "id": "apiic-dc-park-madhurawada",
                "project": "APIIC Integrated Data Centre Park and Technology/Business Park, Madhurawada",
                "mld": 1.43,
                "earmarked_for": ["Data centres", "Technology and business park"],
                "status": "State environmental clearance of 24 Dec 2024 sets a total water requirement of 2,644 KLD, of which fresh water is not to exceed 1,429 KLD and is to be met from GVMC; the other 1,215 KLD is recycled water from the park's own sewage treatment plant. 1.43 MLD, the fresh-water cap, is the claim on GVMC's supply shown here. APIIC wrote to the Municipal Commissioner for the allotment on 31 Mar 2023; the clearance records the request as under process. No GVMC allotment order was found.",
                "source_refs": ["seiaa-apiic-dc-park-2024"],
            },
            {
                "id": "amns-steel",
                "project": "AM/NS steel plant, Anakapalli",
                "mld": 104,
                "earmarked_for": ["AM/NS India"],
                "status": "Its environmental clearance (20 Mar 2026, for an 8.2 MTPA plant) says 1,03,968 m3 a day 'will be obtained from the Polavaram Left Main Canal', subject to permission from the competent authority. The state's Industries order GO Ms 76 (26 Nov 2024) records the company's request for 6,600 m3 an hour from Polavaram (about 158 MLD, for plant, port and township). It approves industrial water at Rs 50 per KL for 10 years as an incentive and asks departments to facilitate water 'as per the requirements and the rules'. It names no quantity. No Water Resources Department allocation order was found.",
                "source_refs": ["amns-ec-2026", "go-ms76-2024"],
            },
        ],
        "gaps": [
            "The text of GO MS No.96 (2004), cited for 24 TMC of Polavaram water for Visakhapatnam, was not found.",
            "The VIWSCO concession agreement and the RINL bulk water supply agreement are cited in government orders but were not found.",
            "No order setting priority between the city and industry on the Yeleru canal in a dry year was found. The state's Industrial Water Allotment Policy (G.O.Ms.No.202, 6 Dec 2014) says that in a drought, water released to industry from a reservoir is cut pro rata to what the reservoir holds; it does not say whether this covers VIWSCO's earlier allocation.",
            "No plant-level entitlement for NTPC Simhadri was found.",
            "No continuous record of what each user receives from the canal was found; the one day found is 11 March 2021, in GVMC's NGT filing of March 2021.",
            "No Water Resources Department order fixing AM/NS India's quantity from the Polavaram Left Main Canal was found; GO Ms 76 (2024) sets only the price and asks departments to facilitate.",
        ],
        "sources": {
            "gvmc-2021-sheet": {
                "title": "GVMC Daily Water Supply, status 11-03-2021 (annexure to GVMC's action-taken report, NGT OA 14/2021 (SZ))",
                "publisher": "Greater Visakhapatnam Municipal Corporation",
                "year": 2021,
                "url": NGT_OA14_ANNEX,
            },
            "cgwb-2025": {
                "title": "Aquifer Management Plan of Visakhapatnam and Anakapalli Urban Agglomerations",
                "publisher": "Central Ground Water Board",
                "year": 2025,
                "url": CGWB_2025,
            },
            "cgwb-2022": {
                "title": "Aquifer Mapping and Management of Ground Water Resources, Visakhapatnam District (AAP 2020-21), Table 5.1",
                "publisher": "Central Ground Water Board",
                "year": 2022,
                "url": CGWB_2022,
            },
            "ppa": {
                "title": "About the Project",
                "publisher": "Polavaram Project Authority",
                "year": 2026,
                "url": PPA,
            },
            "cag-4-2025": {
                "title": "Report No. 4 of 2025, performance audit of the Polavaram Irrigation Project",
                "publisher": "Comptroller and Auditor General of India",
                "year": 2025,
                "url": CAG_AP,
            },
            "pti-lmc-release-2026": {
                "title": "Chandrababu Naidu releases Godavari water to North Andhra through Polavaram canal (PTI, 2 Sep 2026; press report)",
                "publisher": "Telangana Today",
                "year": 2026,
                "url": PTI_LMC_RELEASE_2026,
            },
            "go-ms-100-2016": {
                "title": "G.O.Ms.No.100, Water Resources (Projects-I A2), 14-10-2016: Purushothapatnam Lift Irrigation Scheme",
                "publisher": "Government of Andhra Pradesh",
                "year": 2016,
                "url": "https://goir.ap.gov.in/dgo.ashx?gid=375571&fileType=E",
            },
            "apiic-viwsco": {
                "title": "VIWSCO project note",
                "publisher": "Andhra Pradesh Industrial Infrastructure Corporation",
                "year": 2009,
                "url": "https://apiic.in/wp-content/themes/custom-theme/assets/uploads/ppp/VIWSCO.pdf",
            },
            "viwsco-site": {
                "title": "About VIWSCO and Project Infrastructure",
                "publisher": "Visakhapatnam Industrial Water Supply Company",
                "year": 2026,
                "url": VIWSCO_ABOUT,
            },
            "wrd-yeleru-wayback": {
                "title": "AP WRD, Yeleru Reservoir Project page (Wayback capture 2023-09-30; content c. 2015-16)",
                "publisher": "Water Resources Department, Government of Andhra Pradesh (via Internet Archive)",
                "year": 2016,
                "url": "https://web.archive.org/web/20230930055240/https://irrigationap.cgg.gov.in/wrd/static/approjects/yeleru.html",
            },
            "apwrims": {
                "title": "Reservoir storage",
                "publisher": "Water Resources Department, Government of Andhra Pradesh (APWRIMS)",
                "year": 2026,
                "url": "https://apwrims.ap.gov.in/",
            },
            "go-ms-202-2014": {
                "title": "G.O.Ms.No.202, Industries & Commerce (INF), 06-12-2014: Industrial Water Allotment Policy",
                "publisher": "Government of Andhra Pradesh",
                "year": 2014,
                "url": "https://goir.ap.gov.in/dgo.ashx?gid=330362&fileType=E",
            },
            "go-ms-24-2015": {
                "title": "G.O.Ms.No.24, I&CAD (Reforms), 25-02-2015",
                "publisher": "Government of Andhra Pradesh",
                "year": 2015,
                "url": "https://goir.ap.gov.in/dgo.ashx?gid=335816&fileType=E",
            },
            "go-rt-203-2026": {
                "title": "G.O.Rt.No.203, Water Resources, 17-04-2026",
                "publisher": "Government of Andhra Pradesh",
                "year": 2026,
                "url": "https://goir.ap.gov.in/dgo.ashx?gid=573535&fileType=E",
            },
            "go-ms76-2024": {
                "title": "G.O.Ms.No.76, Industries & Commerce (P&I) Department, 26 Nov 2024: AM/NS India integrated steel plant, Anakapalli",
                "publisher": "Government of Andhra Pradesh, Industries & Commerce Department",
                "year": 2024,
                "url": "https://goir.ap.gov.in/dgo.ashx?gid=502354&fileType=E",
            },
            "ls-usq-6630-1992": {
                "title": "Lok Sabha Unstarred Question 6630, 8 April 1992",
                "publisher": "Lok Sabha",
                "year": 1992,
                "url": "https://archive.org/details/eparlib.nic.in.47958",
            },
            "rs-usq-7230-1994": {
                "title": "Rajya Sabha Unstarred Question 7230, 13 May 1994",
                "publisher": "Rajya Sabha",
                "year": 1994,
                "url": "https://archive.org/details/rsdebate.nic.in.197848",
            },
            "amns-ec-2026": {
                "title": "Environmental clearance, AM/NS India integrated steel plant, Anakapalli (20 Mar 2026)",
                "publisher": "Ministry of Environment, Forest and Climate Change",
                "year": 2026,
                "url": "https://parivesh.nic.in/",
            },
            "seiaa-dc-2026": {
                "title": "SEIAA Andhra Pradesh environmental clearances SIA/AP/INFRA2/575243/2026, 575126/2026 and 576702/2026 (PARIVESH proposal numbers)",
                "publisher": "State Environment Impact Assessment Authority, Andhra Pradesh (PARIVESH)",
                "year": 2026,
                "url": SEIAA,
            },
            "seiaa-apiic-dc-park-2024": {
                "title": "SEIAA Andhra Pradesh environmental clearance, APIIC Integrated Data Centre Park and Technology/Business Park, Madhurawada (proposal SIA/AP/INFRA2/462835/2024, 24 Dec 2024)",
                "publisher": "State Environment Impact Assessment Authority, Andhra Pradesh (PARIVESH)",
                "year": 2024,
                "url": SEIAA,
            },
            "ngt-oa606-ap-affidavit-2026": {
                "title": "Government of Andhra Pradesh affidavit, NGT Principal Bench OA 606/2018 (Feb 2026)",
                "publisher": "National Green Tribunal (filed by the Government of Andhra Pradesh)",
                "year": 2026,
                "url": OA606_AFFIDAVIT,
            },
            "hpcl-eccr-2026": {
                "title": "HPCL Visakh Refinery EC compliance report, Oct 2025-Mar 2026 (GVMC-GVSCCL-HPCL tripartite agreement, pp106-110)",
                "publisher": "Hindustan Petroleum Corporation Limited",
                "year": 2026,
                "url": HPCL_ECCR_2026,
            },
            "cwc-nrld-2019": {
                "title": "National Register of Large Dams 2019, Andhra Pradesh (Thatipudi and Gambhiramgedda p58, Mehadrigedda p59, Raiwada p60)",
                "publisher": "Central Water Commission",
                "year": 2019,
                "url": CWC_NRLD_2019,
            },
            "gvmc-mgr-solar-iee-2018": {
                "title": "IEE, 3 MWp floating solar park at Meghadrigedda (UCCRT04), Oct 2018",
                "publisher": "Greater Visakhapatnam Municipal Corporation (ADB project)",
                "year": 2018,
                "url": GVMC_MGR_SOLAR_IEE_2018,
            },
            "adb-iee-2019": {
                "title": "IEE, 24x7 Water Supply in North-West sector (GVMC/02), Jan 2019",
                "publisher": "Greater Visakhapatnam Municipal Corporation (ADB project)",
                "year": 2019,
                "url": ADB_IEE_2019,
            },
        },
    }


def main() -> int:
    check()
    today = date.today().isoformat()
    write_artifact(
        DATA_DIR / "visakhapatnam-supply-overview.json",
        supply_overview(today),
        indent=1,
    )
    write_artifact(
        DATA_DIR / "allocations-visakhapatnam.json", allocations(today), indent=1
    )
    print("wrote supply-overview and allocations for", CITY)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Visakhapatnam's urban water supply and the claims on its raw water.

Writes public/data/visakhapatnam-supply-overview.json (dashboard hero + supply
tile). The allocations ledger, /visakhapatnam/allocations, is curated content:
src/cities/visakhapatnam/allocations.json, built by build_curated.py.

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
VIWSCO_INFRA = "https://viwsco.in/project-infrastructure/"
VIWSCO_ABOUT = "https://viwsco.in/about/"
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


def main() -> int:
    check()
    today = date.today().isoformat()
    write_artifact(
        DATA_DIR / "visakhapatnam-supply-overview.json",
        supply_overview(today),
        indent=1,
    )
    print("wrote supply-overview for", CITY)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

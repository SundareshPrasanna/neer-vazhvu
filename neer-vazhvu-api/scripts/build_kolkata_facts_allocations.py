#!/usr/bin/env python3
"""
Kolkata facts + allocation ledger, compiled from verified primary sources.

Every entry here carries a source URL and a date. Nothing graded [R] (news or
search snippet) or [U] (asserted but unreachable) from the pre-onboarding
research is allowed in - the research doc's own rule, enforced here by keeping
the compilation in code where the provenance sits beside the number.

Two numbers are ABSENT ON PURPOSE and must stay absent:
  - total supply capacity. KMC's own page lists plants summing to 2,324.7 MLD
    while describing a ~1,900 MLD target and ~1,660 MLD requirement, is labelled
    "(DRAFT)" and footered 2013. Publishing any total would launder that.
  - LPCD. KMC contests its own denominator (4.5m residents + 6m/day floating in
    the Environment Plan; 44.96 lakh "static" on the water-supply site).
Both appear as GAP facts instead, which is the honest version of the number.

Run:  python3 neer-vazhvu-api/scripts/build_kolkata_facts_allocations.py
"""

from datetime import date
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
# Every producer writing under public/ goes through the envelope-preserving
# writer: a scheduled rewrite must not strip the NVDM envelope it finds.
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
DATA_DIR = REPO_ROOT / "public" / "data"

DEP = "https://www.kmcgov.in/KMCPortal/downloads/EnvironmentPlan_KMC_2021.pdf"
SND = "https://www.kmcgov.in/KMCPortal/downloads/SewerageAndDrainage.pdf"
WSD = "https://www.kmcgov.in/KMCPortal/downloads/WaterSupplyDepartment.pdf"
WD = "http://www.kmc-wd.com/"
EKWMA = "http://ekwma.in/ek/index.php"
WBPCB = "http://emis.wbpcb.gov.in/waterquality/showwqprevdatachoosedist.do"
ADB_AS = "https://www.adb.org/sites/default/files/linked-documents/49107-006-sd-01.pdf"
WEEKLY = "https://www.kmcgov.in/KMCPortal/downloads/Weekly_Drainage_Activity_Chart.pdf"


def facts():
    return [
        {
            "id": "ekw-treats-65pc",
            "tier": 1,
            "category": "Sewage",
            "title": "A wetland is the city's largest sewage treatment plant",
            "value": "910",
            "unit": "MLD treated by the East Kolkata Wetlands",
            "interpretation": (
                "Of Kolkata's 1,400 MLD of sewage, 910 MLD - 65% - is treated by the "
                "sewage-fed fisheries of the East Kolkata Wetlands, roughly five times what "
                "all five of the city's sewage treatment plants manage combined (179 MLD). "
                "By the corporation's own accounting the principal sewage infrastructure of a "
                "4.5-million-person city is a wetland: unbuilt, unpaid for, under real-estate "
                "pressure, and lying outside KMC's boundary in North and South 24 Parganas."
            ),
            "data_date": "2021",
            "source_url": DEP,
            "source_label": "KMC, District Environment Plan 2021",
        },
        {
            "id": "drains-6mm",
            "tier": 1,
            "category": "Drainage",
            "title": "Victorian drains rated for 6 mm of rain an hour",
            "value": "6",
            "unit": "mm/hour design standard",
            "interpretation": (
                "KMC's own sewerage document states the main network 'was designed to "
                "discharge a rainfall of 6 mm. per hour', across 180 km of century-old brick "
                "sewer with most pumping stations built 50 to 100 years ago. Measured hourly "
                "rainfall beat that standard for a mean of 31.8 hours a year over 2000-2025, "
                "and the record splits: 19.2 hours a year in 2000-2012 against 44.5 in "
                "2013-2025. The wettest hour on record delivered 40.2 mm, 6.7 times capacity."
            ),
            "data_date": "2009",
            "source_url": SND,
            "source_label": "KMC, Sewerage and Drainage (2009); rainfall via Open-Meteo ERA5",
        },
        {
            "id": "adi-ganga-zero-do",
            "tier": 1,
            "category": "Rivers",
            "title": "The Adi Ganga runs at zero dissolved oxygen",
            "value": "0",
            "unit": "mg/l dissolved oxygen",
            "interpretation": (
                "The Adi Ganga - the original course of the Ganga, running through south "
                "Kolkata past Kalighat - recorded NIL dissolved oxygen and 4,900,000 MPN/100ml "
                "faecal coliform at Bansdroni on 7 May 2026, with WBPCB's own observers "
                "recording the water as 'Blackish' and 'Pungent'. Because WBPCB samples each "
                "point separately at high and low tide, we can see that low tide is worse: "
                "BOD 14.53 against 10.75, faecal coliform 8.4 million against 4.9 million."
            ),
            "data_date": "2026-05-07",
            "source_url": WBPCB,
            "source_label": "WBPCB EMIS, sample S00116-17236",
        },
        {
            "id": "no-impounded-storage",
            "tier": 1,
            "category": "Supply",
            "title": "Kolkata stores none of its water",
            "value": "0",
            "unit": "reservoirs",
            "interpretation": (
                "Kolkata impounds nothing. Supply is run-of-river abstraction from the Hooghly "
                "at Palta, about 22 km north, plus roughly 110 MLD of deep tube wells. There "
                "is no storage to run down, so the 'days of water left' question every other "
                "city on this platform answers has no answer here - the binding constraints "
                "are upstream flow and treatment capacity, not a reservoir level."
            ),
            "data_date": "2026",
            "source_url": WD,
            "source_label": "KMC Water Supply Department",
        },
        {
            "id": "contested-denominator",
            "tier": 1,
            "category": "Gap",
            "title": "The corporation contests its own population",
            "value": "4.5m vs 6m",
            "unit": "residents vs daily floating population",
            "interpretation": (
                "KMC's Environment Plan gives more than 4.5 million residents plus a floating "
                "population of 60,00,000 per day. KMC's water-distribution site frames demand "
                "off a 'static population' of 44.96 lakh. Whatever litres-per-capita figure "
                "anyone quotes for Kolkata, the denominator is contested by the publisher, so "
                "this platform publishes no LPCD for Kolkata at all. Most cities hide this; "
                "KMC published both halves."
            ),
            "data_date": "2021",
            "source_url": DEP,
            "source_label": "KMC, District Environment Plan 2021, and kmc-wd.com",
        },
        {
            "id": "capacity-unreconciled",
            "tier": 2,
            "category": "Gap",
            "title": "The supply total does not add up, so we do not publish one",
            "value": "2,324.7 vs 1,900",
            "unit": "MLD listed vs MLD targeted",
            "interpretation": (
                "KMC's water-distribution page lists treatment plants summing to 2,214.7 MLD "
                "plus about 110 MLD of tube wells, while the same page describes a target of "
                "roughly 1,900 MLD generation in 2025 and a requirement of about 1,660 MLD. "
                "The page is labelled '(DRAFT)', footered 2013, and refers to 2025 in the "
                "future tense. Either those are post-expansion design capacities or the page "
                "mixes vintages. Until it reconciles against KMC's budget statements, no "
                "total-capacity figure appears anywhere in this product."
            ),
            "data_date": "2013",
            "source_url": WD,
            "source_label": "KMC Water Supply Department (draft page)",
        },
        {
            "id": "stp-gap-remains",
            "tier": 2,
            "category": "Sewage",
            "title": "Building every planned plant still leaves a gap",
            "value": "30.94",
            "unit": "MLD short",
            "interpretation": (
                "Ten upcoming sewage treatment plants total 280.06 MLD of new capacity against "
                "311 MLD currently untreated or only partially treated - a residual gap of "
                "30.94 MLD even if all are built, and that assumes the East Kolkata Wetlands "
                "keep absorbing 910 MLD. Two of the plants were recorded at 17% and 14% "
                "complete against a March 2022 deadline, in a document filed December 2021."
            ),
            "data_date": "2021",
            "source_url": DEP,
            "source_label": "KMC, District Environment Plan 2021",
        },
        {
            "id": "industrial-blank",
            "tier": 2,
            "category": "Gap",
            "title": "KMC left the industrial-wastewater section blank",
            "value": "0",
            "unit": "fields filled",
            "interpretation": (
                "In KMC's statutory District Environment Plan, the entire industrial-wastewater "
                "section is empty - every field blank, with WBPCB named as the responsible "
                "agency. That is a corporation declaring a gap in its own legally-mandated "
                "plan. We surface it rather than fill it from elsewhere."
            ),
            "data_date": "2021",
            "source_url": DEP,
            "source_label": "KMC, District Environment Plan 2021",
        },
        {
            "id": "ekw-extent",
            "tier": 2,
            "category": "Sewage",
            "title": "12,500 hectares of working fisheries",
            "value": "254",
            "unit": "sewage-fed fisheries",
            "interpretation": (
                "The East Kolkata Wetlands cover 12,500 hectares across 37 mouzas (30 full, 7 "
                "part) in South and North 24 Parganas, holding 254 sewage-fed fisheries, and "
                "are protected under the East Kolkata Wetlands (Conservation and Management) "
                "Act, 2006. Its management authority publishes FIR-status and charge-sheet "
                "pages - an encroachment-enforcement record in its own right."
            ),
            "data_date": "2026",
            "source_url": EKWMA,
            "source_label": "East Kolkata Wetlands Management Authority",
        },
        {
            "id": "waterlogging-register",
            "tier": 2,
            "category": "Flood",
            "title": "66 waterlogging pockets in a single week",
            "value": "53",
            "unit": "wards receiving de-silting machines",
            "interpretation": (
                "KMC's Sewerage and Drainage department publishes a weekly chart of where it "
                "sent de-silting machines. The week of 20-26 July 2026 lists 66 named "
                "waterlogging pockets across 53 wards and 15 boroughs, with 469 machine "
                "deployments. KMC overwrites this file in place every week, so there is no "
                "public archive: the series only exists because we capture it."
            ),
            "data_date": "2026-07-20",
            "source_url": WEEKLY,
            "source_label": "KMC, Weekly Drainage Activity Chart",
        },
        {
            "id": "arsenic-n24p",
            "tier": 2,
            "category": "Groundwater",
            "title": "Arsenic reaches the ring around the city",
            "value": "42.4",
            "unit": "% of North 24 Parganas habitations affected",
            "interpretation": (
                "West Bengal holds 69% of India's arsenic-affected population. In North 24 "
                "Parganas - the district holding Kolkata's own Palta intake - 2,699 of 7,334 "
                "habitations are affected, and of 47,062 samples tested across 22 blocks, "
                "8,609 (18.3%) exceeded 10 ug/L. Affected blocks include Barrackpur I and II "
                "and Rajarhat. Figures rest on West Bengal PHED's IMIS as of 30 April 2016."
            ),
            "data_date": "2016",
            "source_url": ADB_AS,
            "source_label": "British Geological Survey / ADB (2018), on PHED IMIS to 30 Apr 2016",
        },
        {
            "id": "tank-list-1993",
            "tier": 3,
            "category": "Gap",
            "title": "The pond inventory was compiled in 1993",
            "value": "3,777",
            "unit": "lakes and ponds on a 1993 list",
            "interpretation": (
                "KMC's water-body inventory is a departmental tank list 'as prepared on 1993', "
                "supplemented by an NRSA aerial map from 2004. A 33-year-old inventory of a "
                "pond-dense delta city is a named gap, and the strongest argument for a "
                "satellite-derived corroborating layer."
            ),
            "data_date": "1993",
            "source_url": DEP,
            "source_label": "KMC, District Environment Plan 2021",
        },
        {
            "id": "water-nearly-free",
            "tier": 3,
            "category": "Governance",
            "title": "Water is close to free and almost entirely unmeasured",
            "value": "450",
            "unit": "rupees per municipal tanker trip",
            "interpretation": (
                "KMC runs a municipal tanker service at published rates - Rs 450 per trip for "
                "3,600-4,000 litres within 8 km - while domestic volumetric charging is "
                "near-absent and connections are largely unmetered. That combination makes "
                "non-revenue water and distributional equity structurally invisible: no NRW "
                "figure for Kolkata was found in this research pass at all. The tariff "
                "schedule in hand is 2010-11; a current one has not been located."
            ),
            "data_date": "2010-11",
            "source_url": WSD,
            "source_label": "KMC Water Supply Department tariff schedule 2010-11",
        },
    ]


def allocations():
    """Shape is fixed by src/app/[cityId]/allocations/allocations-client.tsx:
    arrangements need `instrument` {label,url} and a `confidence` grade;
    authorities need capacity/committed/tension/source_refs; `sources` is a
    Record keyed by the id that source_refs point at, not a list."""
    return {
        "place_id": "kolkata",
        "updated": date.today().isoformat(),
        "headline": "Who is entitled to Kolkata's water, and who actually receives it",
        "intro": (
            "Kolkata's supply is run-of-river abstraction from the Hooghly, not a dam quota, "
            "so there is no entitlement document holding the city to a share of its own water. "
            "What does exist on paper is the water KMC sells onward: two bulk arrangements with "
            "neighbouring municipal bodies, both published by KMC itself. Those two sales are "
            "also why Bidhannagar and Budge Budge sit inside this platform's Kolkata scope at "
            "all - they are the verified water relationships in a metropolitan area whose "
            "administrative structure is otherwise unresolved."
        ),
        "unit_note": "MLD = million litres per day. Entitlements here are published bulk-sale volumes, not adjudicated shares.",
        "authorities": [
            {
                "id": "kmc",
                "name": "Kolkata Municipal Corporation, Water Supply Department",
                "role": "Abstracts from the Hooghly, treats, distributes, and sells bulk water onward.",
                "capacity": None,
                "committed": "112.7 MLD sold on to two neighbouring bodies",
                "tension": (
                    "KMC publishes plant capacities summing to 2,324.7 MLD beside a ~1,900 MLD "
                    "target and a ~1,660 MLD requirement, on a page labelled DRAFT and footered "
                    "2013. Until that reconciles, no total-capacity figure can be stated - so "
                    "what KMC owes onward is known while what it actually has is not."
                ),
                "source_refs": ["kmc-wd"],
            }
        ],
        "arrangements": [
            {
                "id": "kmc-bidhannagar",
                "source": "Hooghly at Palta (Indira Gandhi WTP)",
                "authority_id": "kmc",
                "recipient": "Bidhannagar Municipal Corporation (Salt Lake)",
                "entitled": {
                    "value": 90,
                    "unit": "MLD",
                    "basis": "bulk sale published by KMC",
                    "year": None,
                    "note": "Listed on KMC's water-supply department page as a bulk sale to Bidhannagar.",
                },
                "received": {
                    "value": None,
                    "unit": "MLD",
                    "basis": None,
                    "year": None,
                    "note": "Neither KMC nor Bidhannagar publishes a delivered-volume series. The entitlement is on paper; the realisation is not observable.",
                },
                "instrument": {"label": "KMC Water Supply Department, bulk supply listing", "url": WD},
                # medium, not high: the figure is published by the seller on a page
                # that is itself labelled draft and dated 2013. Real, but not audited.
                "confidence": "medium",
                "note": "The larger of KMC's two bulk sales, and the reason Bidhannagar is in scope.",
            },
            {
                "id": "kmc-budge-budge",
                "source": "Garden Reach Water Works",
                "authority_id": "kmc",
                "recipient": "Budge Budge Municipality",
                "entitled": {
                    "value": 22.7,
                    "unit": "MLD",
                    "basis": "bulk sale published by KMC",
                    "year": None,
                    "note": "Listed on KMC's water-supply department page as a bulk sale to Budge Budge.",
                },
                "received": {
                    "value": None,
                    "unit": "MLD",
                    "basis": None,
                    "year": None,
                    "note": "No delivered-volume series is published by either party.",
                },
                "instrument": {"label": "KMC Water Supply Department, bulk supply listing", "url": WD},
                "confidence": "medium",
                "note": "Drawn from Garden Reach rather than Palta, so a different plant carries it.",
            },
        ],
        "events": [
            {
                "year": 2021,
                "title": "KMC files its District Environment Plan",
                "note": (
                    "The NGT-mandated filing that put Kolkata's sewage balance on the record: "
                    "910 of 1,400 MLD treated by the East Kolkata Wetlands, outside KMC's own "
                    "boundary, against 179 MLD across all five city STPs."
                ),
                "source_refs": ["kmc-dep"],
            }
        ],
        "futures": [
            {
                "id": "grww-225",
                "project": "Garden Reach Water Works expansion",
                "mld": 225,
                "earmarked_for": ["Kolkata Municipal Corporation"],
                "status": "Under construction, no dated completion published",
                "source_refs": ["kmc-wd"],
            },
            {
                "id": "igwtp-90",
                "project": "Indira Gandhi WTP (Palta) expansion",
                "mld": 90,
                "earmarked_for": ["Kolkata Municipal Corporation"],
                "status": "Under construction, no dated completion published",
                "source_refs": ["kmc-wd"],
            },
        ],
        "gaps": [
            "No abstraction or production series exists for any Kolkata plant. The intake that supplies most of the city publishes no daily figure.",
            "No non-revenue-water figure for Kolkata was found in this research pass at all.",
            "Delivered volumes against both bulk sales are unpublished by seller and buyers alike.",
            "The current tariff schedule has not been located; the one in hand is 2010-11.",
            "KMDA's role in metropolitan supply is not established to primary sources, and the number of municipal corporations in the KMA is itself unresolved.",
        ],
        "sources": {
            "kmc-wd": {
                "title": "Water Supply Department (draft page, footered 2013)",
                "publisher": "Kolkata Municipal Corporation",
                "year": 2013,
                "url": WD,
            },
            "kmc-dep": {
                "title": "District Environment Plan 2021 - Kolkata",
                "publisher": "Kolkata Municipal Corporation",
                "year": 2021,
                "url": DEP,
            },
        },
    }


def main() -> int:
    f = {
        "place_id": "kolkata",
        "generated_at": date.today().isoformat(),
        "note": (
            "Compiled from primary sources only. Figures sourced to news reports or "
            "unreachable documents in the pre-onboarding research are excluded by rule. "
            "Two headline numbers are deliberately absent - total supply capacity and "
            "litres-per-capita - because KMC's own publications contradict themselves on "
            "both; each appears as a gap fact instead."
        ),
        "facts": facts(),
    }
    write_artifact(DATA_DIR / "facts-kolkata.json", f)
    write_artifact(DATA_DIR / "allocations-kolkata.json", allocations())
    tiers = {}
    for x in f["facts"]:
        tiers[x["tier"]] = tiers.get(x["tier"], 0) + 1
    print(
        f"kolkata: {len(f['facts'])} facts (tier1={tiers.get(1,0)} tier2={tiers.get(2,0)} "
        f"tier3={tiers.get(3,0)}), 2 allocation arrangements, 5 named gaps"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

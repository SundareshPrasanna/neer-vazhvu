#!/usr/bin/env python3
"""
Groundwater assessment from IN-GRES, the official CGWB + states portal.

    POST https://ingres.iith.ac.in/api/gec/getBusinessDataForUserOpen

IN-GRES is IIT-Hyderabad hosted, so it is reachable from any network - it is
NOT behind the NICNET gate that blocks CPCB and CGWA. It is the canonical
source for "Dynamic Ground Water Resources" at every admin level and every
assessment year, including editions missing from the OpenCity mirrors.

WHY THIS SCRIPT EXISTS RATHER THAN REUSING DELHI'S. Delhi's layer is built from
OpenCity-hosted CSV exports of this same data. That route does not generalise:
OpenCity's Dynamic GWR datasets are **Karnataka-only** plus a Delhi cut, so
there is no West Bengal file to download. This talks to the API directly.

THE PAYLOAD, which took two prior sessions to solve - do not "simplify" it:
  - keys are lowercase (`locname`/`loctype`/`locuuid`), NOT camelCase
  - `locname` has NO SPACES: "WESTBENGAL", not "WEST BENGAL"
  - `view` is lowercase "admin", not "ADMIN"
  - `parentuuid` is REQUIRED and is the discriminator. Without it the server
    returns a well-formed response containing only an empty `total` row, which
    looks like "no data for this state" rather than an error.
  - `parentLocName` is always "INDIA" and `stateuuid` is always null at every
    level, even when drilling into a district.
State UUIDs come from the Angular bundle's STATEUUIDLAYERNAME constant.

THE KOLKATA FINDING THIS SURFACED: Kolkata district and South 24 Parganas are
categorised **`salinity`** - not safe / semi-critical / critical /
over-exploited - and carry NO availability, resource or extraction figures at
all. Their groundwater is saline, so CGWB does not assess them on extraction.
That means Chennai's exploitation choropleth cannot be drawn for Kolkata
district: not because the data is missing, but because the assessment framework
classifies it on a different axis. The surrounding KMA ring IS assessed
(North 24 Parganas and Nadia semi-critical, Hugli and Haora safe), so the
regional picture is real even where the core district's is categorically absent.

Run:  python3 neer-vazhvu-api/scripts/build_ingres_gwr.py --city kolkata
      python3 neer-vazhvu-api/scripts/build_ingres_gwr.py --city bangalore
        then: npx tsx scripts/compute-bangalore-ward-profiles.ts
"""

import argparse
import json
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
# Every producer writing under public/ goes through the envelope-preserving
# writer: a scheduled rewrite must not strip the NVDM envelope it finds.
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

DATA_DIR = REPO_ROOT / "public" / "data"

API = "https://ingres.iith.ac.in/api/gec/getBusinessDataForUserOpen"
INDIA_UUID = "ffce954d-24e1-494b-ba7e-0931d8ad6085"

# DO NOT source these from the bundle. Ask the API instead: a COUNTRY-level
# call returns all 38 states WITH their uuids, which is authoritative and
# takes one request:
#
#   locname=INDIA, loctype=COUNTRY, locuuid=parentuuid=INDIA_UUID
#
# The bundle route (constant STATEUUIDLAYERNAME) is how West Bengal's was
# found and it is a trap for the next state. It is a GIS-LAYER table, it is
# INCOMPLETE - 27 of 36 states, and Haryana is one of the missing ones - and
# main.js carries a SECOND table of the same shape
# (`HR:{ST_CENSUS:6,name:"HARYANA",UUID:...}`) whose uuids are a different
# namespace entirely. That decoy gave a well-formed uuid that returned an
# empty list for every year, which reads exactly like "no data published"
# rather than "wrong id". Caught only because West Bengal, run as a control
# through the same code, still worked.
#
# MAHARASHTRA's was NOT taken from either bundle table. It came from the
# COUNTRY-level call described above, which returns all 38 states each
# carrying its own `locationUUID` - the route this comment already
# recommends, now exercised.
STATE_UUIDS = {
    "WESTBENGAL": "68ecabb4-0ea5-4909-b8e3-20bbaa7b91e8",
    "HARYANA": "648a95f6-9249-4c92-8ae4-a9d93eb7c898",
    "MAHARASHTRA": "e7b3f02d-2497-4bcd-9e20-baa4b621822b",
    # Gujarat's came from the COUNTRY-level call this file recommends above,
    # not from either bundle table.
    "GUJARAT": "8fd29251-6e20-4f33-9a96-f47cab45eb13",
    "KARNATAKA": "eaec6bbb-a219-415f-bdba-991c42586352",
    "TAMILNADU": "e98cd5b7-6556-4c0f-a778-3429e1c14a6b",
    # From the COUNTRY-level call ("ANDHRA PRADESH" there; locname has no space).
    "ANDHRAPRADESH": "609c5df4-6414-4bbd-a22d-ff5fbdad6836",
}

# Scope kinds must agree with schemas/nvdm/scopes.json or the artifact fails
# L2. Kolkata is a region (the KMA); Gurugram is a plain city.
SCOPE_KIND = {"kolkata": "region"}

# Per-unit caveat for the Nagpur talukas whose only story between editions
# is the 2024-2025 revision.
_NAGPUR_REVISED = (
    "In 2024-2025 IN-GRES raised both recharge and extraction across Nagpur "
    "district (recharge by 45%, most of it from recharge structures; "
    "extraction by 38%). The State report attributes changes between "
    "assessments mainly to refined parameters and well census data, a "
    "changing groundwater regime and recharge schemes (Dynamic Ground Water "
    "Resources of Maharashtra State 2025, Chapter 7, printed p.60)."
)

CITIES = {
    # Ahmedabad drills like Pune, and for the same reason: the district reads
    # semi-critical while the unit under the city is over-exploited. Editions
    # start at 2021-2022 because that is when IN-GRES carved AHMEDABAD URBAN out
    # of CITY & DASKROI (95,627 ha became 47,359 + 49,642); a series reaching
    # back past the redraw would show a jump that is a boundary, not a change.
    "ahmedabad": {
        "state": "GUJARAT",
        "state_label": "Gujarat",
        "source_id": "ingres-groundwater-gujarat",
        "drill": {
            "state": "GUJARAT",
            "district": "AHMEDABAD",
            "district_uuid": "630e391c-ba99-4599-b73c-003992dfdf7a",
            "unit_label": "taluka",
            "keep_district_total": True,
            # IN-GRES truncates Daskroi to "DAS"; spelled out so the map does
            # not label a taluka "Ahmedabad City & Das".
            "names": {
                "AHMEDABAD CITY & DAS": "Ahmedabad City & Daskroi",
                "AHMEDABAD URBAN": "Ahmedabad Urban",
            },
            "wfs": {"layer": "gec:indgec_vers_gujarat", "year": 2021},
        },
        "years": [
            "2021-2022",
            "2022-2023",
            "2023-2024",
            "2024-2025",
            "2025-2026",
        ],
        "notes": [
            "THE DISTRICT HIDES THE CITY. Ahmedabad district reads 79.14% and "
            "SEMI CRITICAL in 2025-2026, while the unit under the city, Ahmedabad "
            "Urban, is OVER EXPLOITED at 128.85% and the rural ring around it, "
            "Ahmedabad City & Daskroi, at 143.16%. The district figure is pulled "
            "down by six safe talukas to the west and south.",
            "AHMEDABAD URBAN IS THE CITY'S UNIT, not a revenue taluka. IN-GRES "
            "carved it out of CITY & DASKROI in 2021-2022 (95,627 ha became "
            "47,359 + 49,642). Its own polygon on the IN-GRES GeoServer holds "
            "almost all of the AMC wards, which is why it is the one to quote for "
            "the city; City & Daskroi is the peri-urban and rural belt around it, "
            "and 82% of its 2025-2026 extraction is irrigation.",
            "THE URBAN UNIT'S JUMP IS A RELABELLING, NOT A MEASUREMENT. Its "
            "extractable resource is 1,919.4 ham in each of the last three "
            "editions. Its extraction was filed entirely as industrial (1,784.4 "
            "ham) in 2021-2022 and 2022-2023, as 1,055 ham irrigation plus 304 ham "
            "industrial in 2023-2024 (70.80%, semi critical), and from 2024-2025 "
            "with 1,606 ham of domestic draft added (127.18%, then 128.85%). "
            "Quote the category in the latest edition; do not render the series "
            "as a trend.",
            "TWO TALUKAS ARE NOT ASSESSED ON EXTRACTION AT ALL. Dholera and "
            "Dhandhuka are categorised 'salinity' in all five editions: CGWB does "
            "not assess saline aquifers on extraction, so they carry no stage "
            "percentage. They are listed under not_assessed_on_extraction and "
            "drawn grey on the map rather than left out.",
            "VOLUMES EXCLUDE THE SALINE TRACT, as CGWB publishes (see fresh_of). "
            "The API's `total` key includes it and would more than double the "
            "district's extraction figure.",
            "EDITIONS START AT 2021-2022, the first in which the current units "
            "exist. In 2019-2020 the city and Daskroi were one 95,627 ha unit at "
            "82.58%, and joining that to either successor would show a jump that "
            "is a boundary change. Rainfall and some draft inputs also repeat "
            "across editions (City & Daskroi's 725.1 mm in three), so movement "
            "between editions is partly the inputs being carried forward.",
        ],
    },
    "surat": {
        "state": "GUJARAT",
        "state_label": "Gujarat",
        "source_id": "ingres-groundwater-gujarat",
        # District spellings are enumerated empirically per the playbook, not
        # assumed to match India-WRIS. Surat's own district plus the coastal
        # and industrial neighbours the city's water actually reaches: Tapi
        # holds Ukai, Navsari and Bharuch share the estuarine belt.
        "districts": {
            "SURAT": "Surat",
            "TAPI": "Tapi",
            "NAVSARI": "Navsari",
            "BHARUCH": "Bharuch",
        },
        "notes": [
            "Surat's coastal talukas sit on the same saline belt that made Kolkata "
            "district unassessable on extraction. Any unit returned as 'salinity' is a "
            "poor-quality category rather than a stage-of-extraction band and carries no "
            "extraction figures; that is a finding, not a missing file.",
            "Tapi district is included because Ukai dam - the control on Surat's entire "
            "supply and its flood risk - sits there, so the recharge picture upstream is "
            "part of the city's story rather than a neighbouring curiosity.",
        ],
    },
    "kolkata": {
        "state": "WESTBENGAL",
        "state_label": "West Bengal",
        "source_id": "ingres-groundwater-westbengal",
        # IN-GRES spells it KOLKATTA. Its district vocabulary also differs from
        # India-WRIS's (HAORA vs HOWRAH, HUGLI vs HOOGHLY), which is exactly the
        # trap the pan-India playbook records: enumerate spellings empirically,
        # never assume two government portals agree on a district name.
        "districts": {
            "KOLKATTA": "Kolkata",
            "NORTH 24 PARGANAS": "North 24 Parganas",
            "SOUTH 24 PARGANAS": "South 24 Parganas",
            "HAORA": "Howrah",
            "HUGLI": "Hooghly",
            "NADIA": "Nadia",
        },
        "notes": [
            "Kolkata district and South 24 Parganas are categorised 'salinity' - a "
            "POOR-QUALITY category, not a stage-of-extraction band. They carry no "
            "availability, resource or extraction figures because CGWB does not assess "
            "saline aquifers on extraction. This is why no exploitation choropleth is "
            "drawn for Kolkata district: the framework classifies it on a different axis, "
            "which is a finding rather than a missing file.",
            "The surrounding KMA ring IS assessed on extraction, so the regional picture "
            "is real even where the core district's is categorically absent.",
            "IN-GRES district spellings differ from India-WRIS's (KOLKATTA / HAORA / "
            "HUGLI). Two government portals do not agree on district names; enumerate "
            "empirically rather than assuming.",
        ],
    },
    "gurugram": {
        "state": "HARYANA",
        "state_label": "Haryana",
        "source_id": "ingres-groundwater-haryana",
        # IN-GRES still spells it GURGAON, the pre-2016 name. Third portal,
        # third vocabulary: India-WRIS says GURUGRAM, LGD says Gurugram, this
        # says GURGAON. Enumerate per portal, never share one spelling map.
        #
        # The neighbours are included because Gurugram's water problem does
        # not stop at the district line: Mewat and Palwal sit on the same
        # aquifer south-east, Rewari and Jhajjar west and north.
        "districts": {
            "GURGAON": "Gurugram",
            "MEWAT": "Nuh (Mewat)",
            "PALWAL": "Palwal",
            "REWARI": "Rewari",
            "JHAJJAR": "Jhajjar",
            "FARIDABAD": "Faridabad",
        },
        "notes": [
            "Gurugram district extracts 194.59% of its annual recharge and is categorised "
            "over-exploited. That figure is the primary source for the '~195%' that "
            "circulates in secondary write-ups about the city without one.",
            "Every one of the district's five assessment blocks is over-exploited, and the "
            "built city is the worst: GURGAON_URBAN stands at 326.26% of recharge, against "
            "PATAUDI 168.48, SOHNA 156.86, FARRUKH NAGAR 143.39 and rural GURGAON 106.91. "
            "Haryana as a whole is at 136.75%.",
            "The neighbouring districts are carried because the aquifer does not stop at "
            "the district line, and because Jhajjar being SAFE is what makes the rest "
            "legible as a local failure rather than a regional condition. Rewari and "
            "Faridabad are over-exploited, Palwal critical, Nuh (Mewat) semi-critical.",
            "IN-GRES still spells the district GURGAON, the pre-2016 name, where "
            "India-WRIS and LGD both say GURUGRAM. Enumerate spellings per portal.",
            "This assessment is the CURRENT groundwater picture for Gurugram. The measured "
            "LEVEL series is not: India-WRIS carries 37 Gurugram stations that stop in "
            "June 2020, and the Haryana telemetry network does not cover this district.",
        ],
    },
    # Pune is the first city on this builder to DRILL BELOW the district, and
    # the reason is that its district figure says the opposite of its finding.
    # See fetch_units() for the request shape and why the obvious one fails.
    "pune": {
        "state": "MAHARASHTRA",
        "state_label": "Maharashtra",
        "source_id": "ingres-groundwater-maharashtra",
        "drill": {
            "state": "MAHARASHTRA",
            "district": "PUNE",
            "district_uuid": "471dff0a-9b41-46f2-890d-179b2408ca4d",
            "unit_label": "taluka",
        },
        # Seven editions are published for Pune, two more than the shared
        # YEARS list carries, and they are not contiguous: 2020-2021 returns a
        # single empty row. Years are per-city precisely so adding Pune's
        # cannot silently re-cut Kolkata's and Gurugram's committed artifacts.
        "years": [
            "2019-2020",
            "2021-2022",
            "2022-2023",
            "2023-2024",
            "2024-2025",
            "2025-2026",
        ],
        "notes": [
            "SHIRUR IS THE FINDING. It is categorised CRITICAL in all six published "
            "editions, standing at 95.71% of its extractable resource in 2025-2026 "
            "and never below 94.24% since 2019-2020. 92.9% of that extraction is "
            "agriculture (12,903.4 of 13,894.6 ham), so this is an irrigation story "
            "rather than a city one - and agriculture is above 90% of extraction in "
            "8 of the 14 talukas.",
            "THE DISTRICT AGGREGATE HIDES IT. Pune district totals 63.73% and is "
            "categorised SAFE. Publishing the district number alone would state the "
            "opposite of what the talukas inside it show, which is why this city "
            "drills to assessment-unit level and no other city on this builder does.",
            "VOLUMES EXCLUDE POOR-QUALITY (SALINE) AREA, which is what CGWB "
            "publishes; the API's `total` key does not, and using it would put the "
            "district at 67.25% instead of 63.23% for 2024-2025. See fresh_of(). "
            "With the correction this artifact reproduces the CGWB National "
            "Compilation on Dynamic Ground Water Resources of India 2025 (p.161) "
            "exactly: recharge 194,942.64, extractable 182,653.14, extraction "
            "115,497.00 ham, stage 63.23%. The four talukas that carry saline area "
            "here - Baramati, Daund, Indapur and Purandhar - are also exactly the "
            "four CGWB names as salinity-affected (p.391), derived independently.",
            "THE RAINFALL GRADIENT IS IN THE ASSESSMENT ITSELF, not inferred: "
            "IN-GRES carries a per-taluka rainfall figure, and in 2025-2026 it runs "
            "from Velhe at 2,182.3 mm to Indapur at 467.9 mm and Baramati at 473.6 "
            "mm, in the same district and the same edition. A 4.7x spread inside one "
            "district is the structural fact about Pune district water: the wet end "
            "is where the city's dams sit and the dry end is where their canals go.",
            "SIX EDITIONS ARE NOT SIX YEARS OF MEASUREMENT, and this is the most "
            "important caveat on the series. IN-GRES recomputes the AVAILABILITY side "
            "every edition - every taluka has a distinct stage percentage in every "
            "edition, and a distinct availability figure in every edition bar one "
            "repeat in Mulshi - while largely CARRYING FORWARD the rainfall and "
            "extraction inputs. Seven of the 14 talukas carry a single rainfall "
            "value across all six editions, no taluka has more than three distinct "
            "values in six, and agricultural draft has only two to five distinct "
            "values in six. Year-on-year movement in stage % is therefore mostly the "
            "denominator moving, not measured extraction changing. Do not render this "
            "as an annual extraction trend.",
            "PUNE CITY BECAME ITS OWN ASSESSMENT UNIT IN 2023-2024. Before that "
            "edition the built city was inside Haveli and cannot be separated. Its "
            "series is therefore three editions long by construction, not truncated, "
            "and its extractable resource (1,218-1,231 ham) is the smallest in the "
            "district - urban Pune drinks surface water from the Khadakwasla chain, "
            "so the aquifer under it is a minor resource rather than the main one.",
            "PURANDHAR AND BARAMATI RECLASSIFIED WITHOUT RECOVERING, and the "
            "arithmetic is unambiguous because the numerator did not move AT ALL. "
            "Purandhar goes semi-critical 85.20% (2022-2023) to safe 51.27% "
            "(2023-2024) on an extraction figure of 10,854.4 ham in BOTH editions, "
            "while its extractable resource jumps 12,739.2 to 21,170.6 ham. Baramati "
            "goes 80.40% to 66.59% on an extraction figure of 16,913.2 ham in both, "
            "while extractable jumps 21,036.0 to 25,397.5 ham. Nothing was measured "
            "to have changed; the denominator was revised. Reading either as an "
            "aquifer recovering would be wrong.",
            "Two spellings shift between editions and are normalised here: the "
            "portal upper-cases every unit name before 2023-2024 and title-cases "
            "after, and MAVAL is spelled Mawal in the 2025-2026 edition only.",
        ],
    },
    # Nagpur drills for the city's own unit, Nagpur (Urban), which IN-GRES
    # publishes from 2023-2024. Every taluka is Safe, so the finding is the
    # unit and its inputs, not a stressed taluka.
    "nagpur": {
        "state": "MAHARASHTRA",
        "state_label": "Maharashtra",
        "source_id": "ingres-groundwater-maharashtra",
        "drill": {
            "state": "MAHARASHTRA",
            "district": "NAGPUR",
            "district_uuid": "68d0f469-947f-404d-b7d7-dd38c93e6a77",
            "unit_label": "taluka",
            "keep_district_total": True,
            # Upper-cased spelling in any edition (or the 2021 WFS) -> the
            # 2025-2026 spelling. The pre-2023 NAGPUR unit continues as
            # Nagpur (Rural); see notes.
            "aliases": {
                "HINGANA": "HINGNA",
                "KAMTEE": "KAMPTEE",
                "MOUDA": "MAUDA",
                "NAGPUR": "NAGPUR (RURAL)",
                "NAGPUR RURAL": "NAGPUR (RURAL)",
                "NAGPUR URBAN": "NAGPUR (URBAN)",
                "NAGPUR CITY": "NAGPUR (URBAN)",
            },
            "names": {
                "HINGNA": "Hingna",
                "KAMPTEE": "Kamptee",
                "MAUDA": "Mauda",
                "NAGPUR (RURAL)": "Nagpur (Rural)",
                "NAGPUR (URBAN)": "Nagpur (Urban)",
            },
            # The 2019 vintage has no city unit: 88.1% of the NMC outline
            # falls in no polygon (geodesic, NMCAdminBoundaries layer 3).
            "wfs": {"layer": "gec:indgec_ver_mahar", "year": 2021},
            # CGWB, National Compilation on Dynamic Ground Water Resources of
            # India 2025 (cgwb.gov.in/GWRA/GWRA_2025.pdf), Maharashtra district
            # table printed p.161 (PDF p.187) row 19, and printed p.310 (PDF
            # p.336; recharge-worthy 7,990.42 sq km).
            "published": {
                "2024-2025": {
                    "class": "Safe",
                    "development_pct": 45.68,
                    "availability_ham": 140292.9,
                    "draft_total_ham": 64092.8,
                    "recharge_worthy_area_ha": 799042.0,
                },
            },
        },
        # 2016-2017 is published for the district only; 2017-2018 and
        # 2020-2021 return a lone empty total row.
        "years": [
            "2019-2020",
            "2021-2022",
            "2022-2023",
            "2023-2024",
            "2024-2025",
            "2025-2026",
        ],
        "provenance_note": (
            "Assessment per taluka inside Nagpur district, across every "
            "published edition. Drilled below the district for the city's "
            "own assessment unit, Nagpur (Urban), published from 2023-2024; "
            "every taluka total is Safe. This is not depth to water, which "
            "IN-GRES does not carry; measured levels are a separate National "
            "Water Data Portal series."
        ),
        # Per-unit caveats, keyed by display name: the only per-unit text the
        # block panel renders (notes do not reach the page).
        "block_caveats": {
            "Nagpur (Urban)": (
                "In IN-GRES's 2023-2024 area figures Nagpur (Urban) first "
                "appears with 22,457 ha, and three units' assessed areas fall "
                "by the same total: Nagpur (Rural) by 6,277 ha, Kamptee by "
                "16,081 ha (all of it canal command area) and Hingna by 99 ha. "
                "The 2025-2026 row enters 206 ha of the unit's 22,457 ha as "
                "canal command area (16,081 ha the year before); its other "
                "figures repeat the 2024-2025 non-command values, so the "
                "stage, 54.62%, is in effect that of the non-command part "
                "alone (33.10% for the whole unit the year before). The "
                "category, Safe in all three editions, is the steadier "
                "comparison."
            ),
            "Nagpur (Rural)": (
                "Published as Nagpur until 2022-2023. Its assessed area fell "
                "by 6,277 of 53,525 ha in 2023-2024, the edition in which "
                "Nagpur (Urban) first appears, and changed again slightly in "
                "2025-2026 (by 10 ha), so editions before and after 2023-2024 "
                "cover different areas."
            ),
            "Kamptee": (
                "Its assessed area fell by 16,081 of 53,604 ha, all of it "
                "canal command area, in 2023-2024, the edition in which "
                "Nagpur (Urban) first appears, and changed again slightly in "
                "2025-2026 (by 110 ha), so editions before and after "
                "2023-2024 cover different areas."
            ),
            "Hingna": (
                "Its assessed area fell by 99 ha in 2023-2024, the edition in "
                "which Nagpur (Urban) first appears, and changed again "
                "slightly in 2025-2026 (by 409 ha). Its canal command area "
                "reads Semi Critical at 87.64% in 2025-2026, while the taluka "
                "as a whole is Safe."
            ),
            "Katol": (
                "Semi Critical in 2019-2020, 2021-2022 and 2022-2023, Safe "
                "since. The fall to 47.61% in 2025-2026 comes from a larger "
                "extractable resource (12,956 ham to 17,124 ham) with "
                "extraction close to flat (7,983 ham to 8,153 ham)."
            ),
            "Saoner": (
                "The highest stage in the district. It moved from Semi "
                "Critical to Safe in 2022-2023, when the stage fell from "
                "70.06% to 69.32%, just under the 70% line between the two. "
                + _NAGPUR_REVISED
            ),
            "Narkhed": (
                "The 2024-2025 edition roughly doubled both its extractable "
                "resource (9,517 ham to 18,920 ham) and its extraction (6,028 "
                "ham to 11,584 ham), so the stage moved little."
            ),
            **dict.fromkeys(
                "Bhiwapur Kalameshwar Kuhi Mauda Parshioni Ramtek Umred".split(),
                _NAGPUR_REVISED,
            ),
        },
        # availability_ham is the extractable resource here: the 2024-2025
        # district row equals CGWB's printed 140,292.87 ham (checked above).
        "availability_label": "Annual extractable resource",
        "notes": [
            "Nagpur district is Safe in all six editions, its stage of extraction "
            "falling from 51.87% (2019-2020) to 45.30% (2025-2026). Every one of "
            "its 14 talukas is Safe on its total in 2025-2026; Saoner is highest "
            "at 67.53%. Inside Hingna the canal command area reads Semi Critical "
            "(87.64% in 2025-2026) while the taluka total is Safe at 45.05%.",
            "Nagpur (Urban) is the city's own assessment unit, published from "
            "2023-2024. In IN-GRES's 2023-2024 area figures it first appears "
            "with 22,457 ha, and three units' assessed areas fall by the same "
            "total between 2022-2023 and 2023-2024: Nagpur 53,525 to 47,248 ha "
            "(6,277 ha), Kamptee 53,604 to 37,523 ha (16,081 ha, all of it "
            "command area, 47,480 to 31,399 ha) and Hingna 63,414 to 63,315 ha "
            "(99 ha). 6,277 + 16,081 + 99 = 22,457. No IN-GRES text calls this "
            "a transfer, and IN-GRES's own KAMTEE polygon is unchanged between "
            "its 2019 and 2021 vintages (0.43% of the NMC outline lies in it), "
            "so the match is in the area figures, not in the mapped outlines. "
            "The district total stays at 799,042 ha across the change.",
            "The 2025-2026 Nagpur (Urban) row is computed on different inputs "
            "for an unchanged 22,457 ha. Its command area is entered as 206 ha "
            "(16,081 ha in 2024-2025), while its non-command recharge, "
            "extractable resource and extraction repeat the 2024-2025 values. "
            "Recharge falls 84% (4,847.8 to 783.1 ham) and extraction 73% "
            "(1,524.3 to 406.3 ham), so the stage moves from 33.10% to 54.62%, "
            "in effect the stage of the non-command part alone. Its printed "
            "rainfall, 336.66 mm (1,146.98 mm the year before), is an average "
            "over the re-split areas; the non-command rainfall recharge is "
            "unchanged (560.69 ham). Quote the category, Safe in all three "
            "editions, as the steadier comparison, and do not quote 54.62% "
            "without this note. The taluka panel shows the three editions as "
            "bars with the unit's history_caveat beside them.",
            "IN-GRES 2024-2025 equals CGWB's printed report to the decimal. The "
            "National Compilation on Dynamic Ground Water Resources of India 2025 "
            "(printed p.161, PDF p.187, Maharashtra row 19) gives Nagpur "
            "recharge 149,110.10, "
            "extractable 140,292.87 and extraction 64,092.79 ham, stage 45.68%, "
            "and printed p.208 (PDF p.234) puts all 14 units in Safe. The "
            "producer stops if the API "
            "stops matching it. A CGWB report for year YYYY covers IN-GRES "
            "edition (YYYY-1)-YYYY, so 2025-2026 is not yet in a CGWB report; "
            "IN-GRES serves it with the same approval level and verification "
            "status as the earlier editions.",
            "Editions are partly carried-forward and revised inputs, not annual "
            "measurement. District domestic extraction is 10,252.49 ham in both "
            "2023-2024 and 2024-2025, agricultural extraction 35,859.92 ham in "
            "both 2022-2023 and 2023-2024, and Bhiwapur's domestic extraction "
            "421.00 ham in all six editions. In 2024-2025 IN-GRES raised both "
            "recharge and extraction across Nagpur district (recharge by 45%, "
            "most of it from recharge structures; extraction by 38%), so the "
            "stage barely moved. The State report attributes changes between "
            "assessments mainly to refined parameters and well census data, a "
            "changing groundwater regime and recharge schemes (Dynamic Ground "
            "Water Resources of Maharashtra State 2025, Chapter 7, printed "
            "p.60). Katol's fall to 47.61% in 2025-2026 is its "
            "extractable resource revised from 12,956 to 17,124 ham with "
            "extraction near flat.",
            "Spellings change between editions and are joined here: HINGANA "
            "becomes Hingna, KAMTEE Kamptee, MOUDA Mauda, NAGPUR becomes Nagpur "
            "Rural and then Nagpur (Rural), and Nagpur Urban becomes Nagpur "
            "(Urban); the 2021 GeoServer layer names the city unit NAGPUR CITY. "
            "Carrying the pre-2023 NAGPUR unit on as Nagpur (Rural) is a "
            "judgement: its assessed area fell by 6,277 of 53,525 ha in "
            "2023-2024, and Kamptee's by 16,081 of 53,604 ha under an unchanged "
            "name, so both series cross an area change in that edition.",
            "Polygons are the 2021 vintage of IN-GRES's own GeoServer layer, the "
            "first with the city as a unit; in the 2019 vintage 88.1% of the NMC "
            "outline (NMC GIS, NMCAdminBoundaries layer 3) lies in no unit. The "
            "2021 NAGPUR CITY polygon holds 93.3% of that outline, the rest "
            "falling in Nagpur (Rural) 5.5%, Hingna 0.8% and Kamptee 0.4%. They "
            "are revenue-taluka outlines (989,861 ha in all, geodesic), not the "
            "assessment's 799,042 ha (798,501 ha in 2025-2026), so polygon "
            "areas and assessed areas are "
            "not comparable.",
            "Maharashtra assesses 1,538 watersheds and apportions them to "
            "talukas (GSDA and CGWB, Dynamic Ground Water Resources of "
            "Maharashtra State 2025, February 2026). The district's all-Safe "
            "total contains one Semi Critical watershed, WGKK-1 at 74.27%, and "
            "two Over Exploited command areas, WGKK-2 at 113.14% and WGM-1 at "
            "141.27% (watershed annexure, printed p.206, PDF p.219). The city "
            "lies mostly in WGKN-4 "
            "(28.99%) and WGKN-1 (58.45%), both Safe. Watershed rows are not on "
            "the open API and are not carried in this artifact.",
        ],
    },
    # Bengaluru EXTENDS a series rather than owning it: IN-GRES does not serve
    # 2011-2017 per unit, WRIS does (scripts/fetch-wris-groundwater-bangalore.ts), so IN-GRES editions
    # are upserted into the blocks already there. See build_extended().
    "bangalore": {
        "state": "KARNATAKA",
        "state_label": "Karnataka",
        "source_id": "ingres-gw-assessment-ka",
        "extend": {
            "state": "KARNATAKA",
            "district": "BENGALURU(URBAN)",
            "district_uuid": "fc194628-dfa2-4026-b410-5535a5ceea8c",
        },
        # 2020-2021 is not published. The five editions 2019-20 to 2023-24
        # equal the WRIS extract they replace, to the rounding.
        "years": [
            "2019-2020",
            "2021-2022",
            "2022-2023",
            "2023-2024",
            "2024-2025",
            "2025-2026",
        ],
        # Substring -> the block name the WRIS series and polygons already use.
        # IN-GRES spells them BENGALURU EAST / Bangalore City / Bangalore-City
        # across editions.
        "unit_names": {
            "yelahanka": "Yelahanka",
            "anekal": "Anekal",
            "north": "Bangalore (North)",
            "south": "Bangalore-South",
            "east": "Bangalore-East",
            "city": "Bangalore-City",
        },
    },
    # Chennai extends the WRIS series in public/data/gwr-blocks.json. Its units
    # are matched by AREA, never by name: in the 2022-23, 2023-24 and 2024-25
    # editions IN-GRES labels Chennai's taluks one place down the alphabet from
    # Madhavaram on (the 7,068 ha unit, Chennai's largest, is labelled
    # PURASAIVAKKAM; 'KOLATHUR' stands in for Velachery), while 2025-26 labels
    # the same areas by their true names. The WRIS series already carries the
    # true names, so those editions re-run here with no change.
    # 2025-26 is left out: it assesses 17 units (Kolathur, 700 ha, carved out of
    # Ayanavaram; Thiruvottiyur 285 ha smaller) and the 16 polygons here are the
    # old set.
    "chennai": {
        "state": "TAMILNADU",
        "state_label": "Tamil Nadu",
        "source_id": "ingres-gw-assessment-tn",
        "blocks_file": "gwr-blocks.json",
        # The WRIS years before it are labelled by end year (2020, 2022), so
        # the IN-GRES editions are too; a mixed "2022, 2022-23" reads as a repeat.
        "end_year_labels": True,
        "extend": {
            "state": "TAMILNADU",
            "district": "CHENNAI",
            "district_uuid": "8801b0c2-0a9b-4189-875a-de0be55f3c52",
        },
        "years": ["2022-2023", "2023-2024", "2024-2025"],
        # area.total.totalArea (ha, rounded) -> the block name the series uses.
        "unit_areas": {
            1771: "Alandur",
            5705: "Ambattur",
            1555: "Aminjikarai",
            1529: "Ayanavaram",
            1767: "Egmore",
            2138: "Guindy",
            3613: "Madhavaram",
            3268: "Maduravoyal",
            1437: "Mambalam",
            2228: "Mylapore",
            1857: "Perambur",
            1728: "Purasaivakkam",
            7068: "Sholinganallur",
            5588: "Thiruvottiyur",
            1302: "Tondiarpet",
            2077: "Velacheri",
        },
    },
    # Visakhapatnam drills to mandal like Pune. Editions start at 2023-2024,
    # the first in which all eleven current units exist; see the notes for
    # the two redraws the earlier editions sit on.
    "visakhapatnam": {
        "state": "ANDHRAPRADESH",
        "state_label": "Andhra Pradesh",
        "source_id": "ingres-groundwater-andhra",
        "drill": {
            "state": "ANDHRAPRADESH",
            # Title case so the IN-GRES GeoServer's parent_name matches too;
            # the assessment API ignores the case of locname.
            "district": "Visakhapatnam",
            "district_uuid": "bd59c4fb-4627-4d06-ad11-bbce43af0063",
            "unit_label": "mandal",
            # Andhra Pradesh's totalGWAvailability adds the in-storage
            # resource (Gopalapatnam 2024-2025: 72,849.24 = 383.53 + 72,465.71
            # ham). CGWB's stage divides by the extractable figure, which is
            # currentAvailabilityForAllPurposes.
            "availability_key": "currentAvailabilityForAllPurposes",
            # Unit polygons: AP's mandals live in gec:indgec_mandal_all (the
            # per-state gec:indgec_vers_andhrapradesh layer holds villages
            # only); the 2023 vintage matches the seven-mandal split.
            "wfs": {"layer": "gec:indgec_mandal_all", "year": 2023},
        },
        "years": ["2023-2024", "2024-2025", "2025-2026"],
        # Per-city text for the envelope note, the block panel's caveat and its
        # availability label, in place of wording written for other cities.
        # build_drilled reads these four keys only where a city sets them.
        "provenance_note": (
            "Assessment per mandal inside Visakhapatnam district, for the three "
            "editions on today's eleven units (2023-2024 to 2025-2026). Drilled below "
            "the district because IN-GRES classes Visakhapatnam district safe in all "
            "three (43.85% in 2024-2025) while one mandal inside it, Visakhapatnam "
            "Rural, was critical in 2024-2025 (95.06%). This is NOT depth-to-water - "
            "IN-GRES does not carry it; measured levels are a separate series from "
            "APWRIMS and the AP Ground Water Department."
        ),
        "history_caveat": (
            "The editions shown start at 2023-2024, the first in which all eleven "
            "current mandals are assessed: until 2022-2023 the city was assessed as one "
            "GVMC unit and Bheemunipatnam had other boundaries. The 2025-2026 IN-GRES "
            "edition is newer than CGWB's December 2025 report, and its rainfall input "
            "repeats 2024-2025."
        ),
        "block_caveats": {
            "Visakhapatnam Rural": (
                "In 2025-2026 its extractable resource is revised from 225.3 to 437.1 "
                "ham, with 223.88 ham of surface-irrigation recharge where 2024-2025 "
                "had none, while extraction stays near 210 ham, so the move from "
                "95.06% (critical in CGWB's 2025 report) to 47.87% comes from a "
                "revised input, not measured change. IN-GRES assesses this unit over "
                "39.0 km2; the AP Water Resources Department's mandal map gives "
                "Visakhapatnam (Rural) 130.9 km2."
            ),
            "Gajuwaka": (
                "In 2025-2026 its estimated industrial draft is revised from 5.4 to "
                "97.0 ham and its surface-irrigation recharge is cut from 111.95 to "
                "19.19 ham, which together take it from 60.47% to 89.39% (semi "
                "critical); these are revised inputs, not measured change."
            ),
            "Maharanipeta": (
                "In 2025-2026 its surface-irrigation recharge is revised from 171.18 "
                "to 561.40 ham and its extractable resource from 1,058.35 to 1,411.17 "
                "ham, while extraction stays near 720 ham, so the move from 67.26% to "
                "51.34% comes from a revised input, not measured change. IN-GRES "
                "assesses this unit over 123.0 km2; the AP Water Resources "
                "Department's mandal map gives Maharanipeta 45.7 km2."
            ),
            "Seethammadhara": (
                "In 2025-2026 its surface-irrigation recharge is revised from 103.69 "
                "to 53.36 ham and its extractable resource from 205.65 to 156.98 ham, "
                "while extraction stays near 103 ham, so the move from 49.78% to "
                "66.40% comes from a revised input, not measured change."
            ),
            "Mulagada": (
                "Most of the area IN-GRES calls Mulagada lies in the mandal the AP "
                "Water Resources Department's map calls Pedagantyada, around Devada "
                "and Palavalasa, so the wells here carry that name. CGWB's 2025 "
                "aquifer plan for the Visakhapatnam and Anakapalli urban areas gives "
                "Pedagantyada 100 km2 and Mulagada 30 km2, against the 98.8 km2 "
                "IN-GRES assesses here, so the two names look transposed."
            ),
            "Peddagantyada": (
                "IN-GRES assesses this unit over 15.3 km2, a strip around "
                "Gollalapalem and Gopalapatnam. The AP Water Resources Department's "
                "map puts those wells in Mulagada and Visakhapatnam (Rural) mandals, "
                "and CGWB's 2025 aquifer plan gives Pedagantyada 100 km2, so the "
                "names of this unit and Mulagada look transposed."
            ),
        },
        "availability_label": "Annual extractable resource",
        "notes": [
            "VISAKHAPATNAM RURAL IS THE MANDAL TO WATCH. In 2024-2025, the edition "
            "CGWB printed in 'Dynamic Ground Water Resources of Andhra Pradesh State "
            "2025' (December 2025; district table PDF p.95, mandal table pp.108-109), "
            "it extracted 214.2 of its 225.3 ham extractable resource, 95.06%, and "
            "was the district's only CRITICAL unit, while Visakhapatnam district as a "
            "whole stood at 43.85%, which IN-GRES classes safe. This artifact "
            "reproduces that edition's eleven mandal figures to one decimal.",
            "2025-2026 IS THE EDITION THE MAP COLOURS, AND IT IS NEWER THAN CGWB'S "
            "DECEMBER 2025 REPORT, which carries 2024-2025. It is the newest edition "
            "on IN-GRES, and every mandal's rainfall input repeats its 2024-2025 "
            "figure. Its surface-irrigation recharge differs from 2024-2025 in every "
            "mandal, and four urban mandals move by more than 15 points, all on "
            "revised inputs rather than measured change: Visakhapatnam Rural's "
            "extractable resource nearly doubles (225.3 to 437.1 ham, with 223.88 ham "
            "of surface-irrigation recharge where 2024-2025 had none) while its "
            "extraction slips from 214.2 to 209.2 ham, taking it from 95.06% critical "
            "to 47.87% safe; Gajuwaka's estimated industrial draft goes from 5.4 to "
            "97.0 ham while its surface-irrigation recharge is cut from 111.95 to 19.19 "
            "ham (extractable resource 605.3 to 519.4 ham), taking it from 60.47% to "
            "89.39% and semi critical; Maharanipeta's surface-irrigation recharge "
            "rises from 171.18 to 561.40 ham (extractable resource 1,058.35 to "
            "1,411.17 ham), taking it from 67.26% to 51.34%; and Seethammadhara's "
            "falls from 103.69 to 53.36 ham (extractable resource 205.65 to 156.98 "
            "ham), taking it from 49.78% to 66.40%. Each moved unit's panel carries "
            "its own caveat.",
            "EDITIONS START AT 2023-2024, the first with today's eleven units. IN-GRES "
            "also publishes 2016-2017, 2019-2020, 2021-2022 and 2022-2023 under the same "
            "district id, but on different units: until 2022-2023 the city was "
            "assessed as one 'GVMC' unit of 513.8 km2, which became seven urban "
            "mandals (430.2 km2 together) in 2023-2024, and Bheemunipatnam was redrawn "
            "from 93.8 to 124.2 to 207.9 km2 (Pendurthi and Anandapuram also changed). "
            "A series joined across those redraws would show jumps that are boundary "
            "changes. For the record, the single GVMC unit stood at 50.84% "
            "(2019-2020), 47.70% (2021-2022) and 56.78% (2022-2023), all safe.",
            "ONE DISTRICT ID, TWO DISTRICTS. Andhra Pradesh divided Visakhapatnam "
            "district in April 2022 and IN-GRES kept one id across the change: its "
            "district rows cover 8,547.7 km2 in 2016-2017 and 11,050.6 km2 in "
            "2019-2020, then 1,001.7 km2 from 2021-2022, the assessed area of the new "
            "district (CGWB's 2025 report gives its geographical area as 1,049 km2). "
            "The district "
            "figure goes from 27.22% to 45.96% across that change, which is the "
            "boundary, not the aquifer. No district series is published here, and no "
            "district trend should be quoted across 2021.",
            "IN THE CITY, GROUNDWATER IS DRAWN FOR HOMES. In 2024-2025, 1,676.9 of the "
            "1,776.2 ham extracted across the seven urban mandals (94.4%, summed "
            "before rounding) was for domestic use, while in Anandapuram, Padmanabham "
            "and Pendurthi more than "
            "95% of extraction is irrigation.",
            "No unit in these three editions is categorised on the salinity axis and "
            "none carries poor-quality area, so every figure covers the unit's whole "
            "assessed area.",
            "THE MAP OUTLINES ARE APPROXIMATE. They are IN-GRES's own unit polygons "
            "(GeoServer layer gec:indgec_mandal_all, 2023 vintage, identical to the "
            "active 2025 vintage), but their areas do not equal the areas the "
            "assessment was computed over: together they cover 973.8 km2 against "
            "1,001.7 km2 assessed, and Pendurthi's polygon is 77.2 km2 against 21.6 "
            "km2 assessed. The colours carry each unit's assessed figures; the "
            "outlines only place them.",
            "IN-GRES'S URBAN UNITS DO NOT FOLLOW ANDHRA PRADESH'S MANDAL LINES. The "
            "unit IN-GRES calls Mulagada (assessed over 98.8 km2) lies mostly inside "
            "the mandal that the AP Water Resources Department's own boundary map "
            "(APWRIMS GeoServer layer AP_MANDAL_V3) calls Pedagantyada, around Devada "
            "and Palavalasa. The unit it calls Peddagantyada (15.3 km2) is a strip "
            "around Gollalapalem and Gopalapatnam. CGWB's 2025 aquifer management plan "
            "for the Visakhapatnam and Anakapalli urban agglomerations (Table 1.1) "
            "gives Pedagantyada 100 km2 and Mulagada 30 km2, so the two names look "
            "transposed. The other urban units differ in extent too: IN-GRES assesses "
            "Maharanipeta over 123.0 km2 and Visakhapatnam Rural over 39.0 km2, where "
            "the AP map has 45.7 and 130.9 km2. Figures are shown under IN-GRES's "
            "names. Each well's panel and label on the groundwater map name the AP "
            "mandal its coordinates fall in and, where it differs, the IN-GRES unit; "
            "the Mulagada and Peddagantyada panels say the names look transposed.",
            "availability_ham IS THE EXTRACTABLE RESOURCE (the API's "
            "currentAvailabilityForAllPurposes). For Andhra Pradesh the API's "
            "totalGWAvailability adds the in-storage resource below the zone of "
            "water-level fluctuation, which is why Gopalapatnam would otherwise read "
            "72,849.2 ham against an extractable 383.5 ham in 2024-2025.",
        ],
    },
}

YEARS = ["2024-2025", "2023-2024", "2022-2023", "2021-2022"]


def _post(body: dict, tries: int = 3):
    req = urllib.request.Request(
        API,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        method="POST",
    )
    for a in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode())
        except Exception as exc:
            if a == tries - 1:
                print(
                    f"  ! {body.get('locname')} {body.get('year')}: {exc}",
                    file=sys.stderr,
                )
                return []
    return []


def fetch_units(cfg: dict, year: str):
    """The assessment units one level BELOW a named district.

    THE DISCRIMINATOR IS `parentuuid`, NOT `loctype`. Asking for Pune's
    children reads, counter-intuitively, `loctype=DISTRICT` with
    `locuuid=<Pune>` and `parentuuid=<Maharashtra>` - you name the location
    you are standing on and the parent you came from, and the server returns
    that location's children. Setting `parentuuid` to Pune's own uuid (the
    obvious guess, and what the state-level call does with INDIA_UUID)
    returns ZERO rows with HTTP 200, which reads as "this district publishes
    no block assessment" rather than as a malformed request. `loctype`
    values TEHSIL / BLOCK / TALUK / ASSESSMENT UNIT all return zero rows
    too, so a reader debugging this by trying plausible level names finds
    nothing and concludes the data does not exist. It does.

    Why bother: the district aggregate is actively misleading for Pune.
    The district totals 63.23% and reads SAFE, while Shirur inside it sits
    at 95.52% and has been CRITICAL in every published edition. Publishing
    the district number alone would state the opposite of the finding.
    """
    return _post(
        {
            "parentLocName": "INDIA",
            "locname": cfg["district"],
            "loctype": "DISTRICT",
            "view": "admin",
            "locuuid": cfg["district_uuid"],
            "year": year,
            "computationType": "normal",
            "component": "recharge",
            "period": "annual",
            "category": None,
            "stateuuid": None,
            "verificationStatus": 1,
            "approvalLevel": 1,
            "parentuuid": STATE_UUIDS[cfg["state"]],
        }
    )


def fetch(state: str, year: str, tries: int = 3):
    body = json.dumps(
        {
            "parentLocName": "INDIA",
            "locname": state,
            "loctype": "STATE",
            "view": "admin",
            "locuuid": STATE_UUIDS[state],
            "year": year,
            "computationType": "normal",
            "component": "recharge",
            "period": "annual",
            "category": "safe",
            "mapOnClickParams": "true",
            "login": "true",
            "stateuuid": None,
            "verificationStatus": 1,
            "approvalLevel": 1,
            "parentuuid": INDIA_UUID,
        }
    ).encode()
    req = urllib.request.Request(
        API,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        method="POST",
    )
    for a in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode())
        except Exception as exc:
            if a == tries - 1:
                print(f"  ! {state} {year}: {exc}", file=sys.stderr)
                return []
    return []


def total_of(v):
    """Most numeric fields are {total, command, non_command}; some are scalars."""
    if isinstance(v, dict):
        return v.get("total")
    return v if isinstance(v, (int, float)) else None


CLASS_LABEL = {
    "safe": "Safe",
    "semi_critical": "Semi Critical",
    "critical": "Critical",
    "over_exploited": "Over Exploited",
}


def build_drilled(city: str, cfg: dict) -> int:
    """Assessment units BELOW a district, emitted in the GWBlock contract.

    Deliberately a different output shape from the district-level branch, and
    the difference is the point rather than an inconsistency. `src/types/
    groundwater.ts` defines what the map actually consumes - `blocks[]` with a
    `history[]` and a `latest` - and the block choropleth needs a matching
    polygon per entry. That contract can be met at taluka level and cannot be
    met by a list of whole districts, so the district branch keeps emitting
    `districts[]` (unchanged, and its committed artifacts stay byte-identical)
    and the drilled branch emits `blocks[]`.
    """
    drill = cfg["drill"]
    # An alias target needs a display name, or the assessment and the WFS
    # polygons would each fall back to a different edition's spelling.
    unnamed = set(drill.get("aliases", {}).values()) - set(drill.get("names", {}))
    if unnamed:
        print(f"aliases with no display name: {sorted(unnamed)}", file=sys.stderr)
        return 1
    units: dict[str, dict] = {}
    unassessed: dict[str, dict] = {}
    district_total: list[dict] = []
    years_seen: list[str] = []
    for year in cfg.get("years", YEARS):
        rows = fetch_units(drill, year)
        # A year with no edition comes back as a lone `total` row rather than
        # an error or an empty list, so count real units, not rows.
        real = [
            r
            for r in rows
            if isinstance(r, dict) and (r.get("locationName") or "").lower() != "total"
        ]
        if not real:
            print(f"  {year}: no edition published", file=sys.stderr)
            continue
        years_seen.append(year)
        if drill.get("keep_district_total"):
            # The drill's own `total` row carries no category, so the district
            # is read as a row of the STATE call, where IN-GRES classifies it.
            row = next(
                (
                    r
                    for r in fetch(drill["state"], year)
                    if (r.get("locationName") or "").upper() == drill["district"]
                ),
                None,
            )
            if row:
                district_total.append(
                    {
                        "year_label": year,
                        "class": CLASS_LABEL.get(
                            (row.get("category") or {}).get("total")
                        ),
                        "development_pct": round(
                            total_of(row.get("stageOfExtraction")), 2
                        ),
                        "availability_ham": _r1(
                            fresh_of(row.get("totalGWAvailability"))
                        ),
                        "draft_total_ham": _r1(
                            fresh_of((row.get("draftData") or {}).get("total"))
                        ),
                        "poor_quality_area_ha": _r1(
                            ((row.get("area") or {}).get("recharge_worthy") or {}).get(
                                "poorQualityArea"
                            )
                        ),
                        "recharge_worthy_area_ha": _r1(
                            ((row.get("area") or {}).get("recharge_worthy") or {}).get(
                                "totalArea"
                            )
                        ),
                    }
                )
        for r in real:
            raw = r.get("locationName") or ""
            # The portal upper-cases unit names before 2023-2024 and
            # title-cases after, and spells MAVAL as Mawal in 2025-2026 only.
            # Keyed on a normalised name, a single taluka would otherwise
            # split into two or three separate blocks with short histories.
            key = raw.strip().upper().replace("MAWAL", "MAVAL")
            # Spellings that differ by more than case (Nagpur's HINGANA and
            # Hingna) map to one key per unit. Absent map = identity.
            key = drill.get("aliases", {}).get(key, key)
            display = drill.get("names", {}).get(key, raw.strip().title())
            cat = (r.get("category") or {}).get("total")
            # Served pre-computed on the fresh area - use as-is.
            stage = total_of(r.get("stageOfExtraction"))
            # Volumes must EXCLUDE poor-quality area to match CGWB. See fresh_of().
            avail = fresh_of(
                r.get(drill.get("availability_key", "totalGWAvailability"))
            )
            draft = r.get("draftData") or {}
            label = CLASS_LABEL.get(cat)
            if label is None or stage is None:
                # Not assessed on extraction this edition (the salinity /
                # poor-quality axis). Recorded, never silently dropped.
                print(
                    f"  ! {raw} {year}: category={cat!r} stage={stage!r}, skipped",
                    file=sys.stderr,
                )
                unassessed.setdefault(
                    key, {"name": display, "category": cat, "editions": []}
                )["editions"].append(year)
                continue
            entry = units.setdefault(
                key,
                {"name": display, "history": [], "_detail": []},
            )
            entry["history"].append(
                {
                    "year": int(year.split("-")[1]),
                    "year_label": year,
                    "class": label,
                    "development_pct": round(stage, 2),
                    "availability_ham": _r1(avail),
                    "draft_total_ham": _r1(fresh_of(draft.get("total"))),
                }
            )
            entry["_detail"].append(
                {
                    "year_label": year,
                    "draft_agriculture_ham": _r1(fresh_of(draft.get("agriculture"))),
                    "draft_domestic_ham": _r1(fresh_of(draft.get("domestic"))),
                    "draft_industry_ham": _r1(fresh_of(draft.get("industry"))),
                    # Poor-quality (saline) area is EXCLUDED from every figure
                    # above; carried separately so a taluka that has one is
                    # visibly different from one that does not.
                    "poor_quality_area_ha": _r1(
                        ((r.get("area") or {}).get("recharge_worthy") or {}).get(
                            "poorQualityArea"
                        )
                    ),
                    "recharge_worthy_area_ha": _r1(
                        ((r.get("area") or {}).get("recharge_worthy") or {}).get(
                            "totalArea"
                        )
                    ),
                    "rainfall_mm": _r1(total_of(r.get("rainfall"))),
                }
            )

    if not units:
        print("no assessment units returned - check the drill uuids", file=sys.stderr)
        return 1
    # District figures CGWB has printed for an edition. A revision upstream
    # stops the build before it writes, since the notes quote the match.
    for year, printed in drill.get("published", {}).items():
        row = next((d for d in district_total if d["year_label"] == year), {})
        off = {k: (v, row.get(k)) for k, v in printed.items() if row.get(k) != v}
        if off:
            print(f"  ! {year} differs from the printed report: {off}", file=sys.stderr)
            return 1

    blocks = []
    for entry in units.values():
        entry["history"].sort(key=lambda h: h["year_label"])
        entry["_detail"].sort(key=lambda d: d["year_label"])
        latest = entry["history"][-1]
        block = {
            "name": entry["name"],
            "history": entry["history"],
            "latest": {
                "class": latest["class"],
                "development_pct": latest["development_pct"],
                "availability_ham": latest["availability_ham"],
                "draft_total_ham": latest["draft_total_ham"],
            },
            "detail": entry["_detail"],
        }
        own = cfg.get("block_caveats", {}).get(entry["name"])
        if cfg.get("history_caveat"):
            # A city that states why its editions start where they do gets
            # that text on every unit, followed by the unit's own caveat.
            block["history_caveat"] = " ".join(
                filter(None, [cfg["history_caveat"], own])
            )
        elif own:
            # The unit's own caveat in place of the generic short-series line.
            block["history_caveat"] = own
        elif len(entry["history"]) < len(years_seen):
            first = entry["history"][0]["year_label"]
            block["history_caveat"] = (
                f"IN-GRES first assesses this unit separately in {first}; before "
                "that edition it is not published as its own assessment unit, so "
                "the series is short by construction rather than truncated."
            )
        blocks.append(block)
    blocks.sort(key=lambda b: b["name"])
    # Keyed by display name, so a misspelt key would drop its caveat silently.
    stray = set(cfg.get("block_caveats", {})) - {b["name"] for b in blocks}
    if stray:
        print(f"block_caveats for no unit: {sorted(stray)}", file=sys.stderr)
        return 1

    out = {
        "place_id": city,
        "generated_at": date.today().isoformat(),
        "source": "IN-GRES - India Ground Water Resource Estimation System (CGWB + State groundwater departments)",
        "source_url": "https://ingres.iith.ac.in/",
        "acquired_via": "IN-GRES API, gec/getBusinessDataForUserOpen (no auth)",
        "state": cfg["state_label"],
        "district": drill["district"].title(),
        "assessment_unit": drill["unit_label"],
        "assessment_years": years_seen,
        "years": [int(y.split("-")[1]) for y in years_seen],
        "unit_note": "ham = hectare-metres. development_pct is IN-GRES's stage of extraction: annual extraction as a percentage of the annual extractable resource.",
        "blocks": blocks,
        "notes": cfg["notes"],
    }
    if cfg.get("availability_label"):
        # The block panel's label for availability_ham, where the generic
        # "Net Annual Availability" does not name what the file carries.
        out["availability_label"] = cfg["availability_label"]
    if unassessed:
        # Only where a unit was ever off the extraction axis, so the drilled
        # artifacts that have none (Pune) stay byte-identical.
        out["not_assessed_on_extraction"] = sorted(
            unassessed.values(), key=lambda u: u["name"]
        )
    if district_total:
        # The aggregate the drill exists to look past, kept so a reader (and
        # the facts producer) can set the two side by side from one file.
        out["district_total"] = district_total
    envelope = {
        "nvdm": "1.0",
        "dataset": "data-root/gwr-blocks",
        "scope": {"kind": SCOPE_KIND.get(city, "city"), "id": city},
        "provenance": {
            "sources": [
                {
                    "id": cfg["source_id"],
                    "title": (
                        f"IN-GRES dynamic ground water resource assessment, "
                        f"{drill['district'].title()} district {drill['unit_label']}s "
                        f"({cfg['state_label']})"
                    ),
                    "publisher": (
                        "IN-GRES (CGWB + State groundwater departments), IIT Hyderabad"
                    ),
                    "license": registry_license(cfg["source_id"]),
                }
            ],
            "method": "api",
            "produced_at": out["generated_at"],
            "produced_by": "neer-vazhvu-api/scripts/build_ingres_gwr.py",
            "note": cfg.get("provenance_note")
            or (
                f"Assessment per {drill['unit_label']} inside {drill['district'].title()} "
                "district, across every published edition. Drilled below the district "
                "because the district aggregate reads SAFE while units inside it are "
                "CRITICAL. This is NOT depth-to-water - IN-GRES does not carry it; "
                "measured levels are a separate India-WRIS series."
            ),
        },
    }
    path = DATA_DIR / f"gwr-blocks-{city}.json"
    write_artifact(path, {**envelope, **out}, indent=1)
    worst = max(blocks, key=lambda b: b["latest"]["development_pct"])
    print(
        f"{city}: {len(blocks)} {drill['unit_label']}s, editions {years_seen}; "
        f"worst {worst['name']} {worst['latest']['development_pct']}% "
        f"({worst['latest']['class']}) -> {path.name}",
        file=sys.stderr,
    )
    for b in blocks:
        print(
            f"  {b['name']:14} {b['latest']['class']:14} "
            f"{b['latest']['development_pct']:6.2f}%  "
            f"{len(b['history'])} editions",
            file=sys.stderr,
        )
    if "wfs" in drill:
        return build_unit_geometry(city, cfg, out)
    return 0


def build_unit_geometry(city: str, cfg: dict, assessment: dict) -> int:
    """The assessment units' own polygons, from IN-GRES's GeoServer, joined to
    the drilled assessment for the block choropleth.

    Same publisher as the numbers, so the boundaries are the ones the stage
    percentages were computed over - revenue-taluka layers from elsewhere do
    not carry units such as Ahmedabad's URBAN, which IN-GRES carved out of
    CITY & DASKROI in 2021-2022. Two traps, both learned on Pune: the layer
    holds every vintage, so `year` must pin the one matching the editions
    used; and the WFS `uuid` is a different namespace from the API's, so the
    join is on the normalised name.

    Units not assessed on extraction (saline) are drawn without a class, which
    the map renders as no-data grey rather than leaving a hole.
    """
    drill = cfg["drill"]
    wfs = drill["wfs"]
    cql = f"parent_name='{drill['district']}' AND year={wfs['year']}"
    url = (
        "https://ingres.iith.ac.in/geoserver/gec/ows?service=WFS&version=1.0.0"
        f"&request=GetFeature&typeName={wfs['layer']}&outputFormat=application/json"
        "&CQL_FILTER=" + urllib.parse.quote(cql)
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        fc = json.loads(r.read().decode())
    names = drill.get("names", {})
    by_name = {b["name"]: b for b in assessment["blocks"]}
    off_axis = {u["name"]: u for u in assessment.get("not_assessed_on_extraction", [])}

    feats, unmatched = [], []
    for f in fc.get("features", []):
        raw = ((f.get("properties") or {}).get("name") or "").strip()
        canon = drill.get("aliases", {}).get(raw.upper(), raw.upper())
        name = names.get(canon, raw.title())
        blk, off = by_name.get(name), off_axis.get(name)
        if blk is None and off is None:
            unmatched.append(raw)
            continue
        props = {"block": name, "ext_id": f["properties"].get("ext_id")}
        if blk:
            latest = blk["latest"]
            props.update(
                {
                    "class": latest["class"],
                    "sgw_dev_pe": latest["development_pct"],
                    "na_gwa": latest["availability_ham"],
                    "agwd_tot": latest["draft_total_ham"],
                    "editions": len(blk["history"]),
                }
            )
        else:
            props["not_assessed_on_extraction"] = off["category"]
        feats.append(
            {"type": "Feature", "properties": props, "geometry": f["geometry"]}
        )
    feats.sort(key=lambda f: f["properties"]["block"])
    drawn = {f["properties"]["block"] for f in feats}
    missing = sorted(set(by_name) - drawn)
    if unmatched or missing:
        print(
            f"  ! geometry with no assessment: {unmatched}; "
            f"assessment with no geometry: {missing}",
            file=sys.stderr,
        )

    district = drill["district"].title()
    out = {
        "nvdm": "1.0",
        "dataset": "geojson-layers/gwr-blocks",
        "scope": {"kind": SCOPE_KIND.get(city, "city"), "id": city},
        "provenance": {
            "sources": [
                {
                    "id": cfg["source_id"],
                    "title": (
                        f"IN-GRES {drill['unit_label']} boundaries for {district} "
                        "district, joined to the dynamic groundwater assessment"
                    ),
                    "publisher": "IN-GRES (CGWB + State groundwater departments), IIT Hyderabad",
                    "license": registry_license(cfg["source_id"]),
                }
            ],
            "method": "api",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_ingres_gwr.py",
            "note": (
                f"Geometry from IN-GRES's own GeoServer ({wfs['layer']}, year="
                f"{wfs['year']}); attributes are the latest edition in "
                f"gwr-blocks-{city}.json. Joined on normalised name - the WFS uuid "
                "is a different namespace from the assessment API's."
            ),
        },
        "type": "FeatureCollection",
        "features": feats,
    }
    path = REPO_ROOT / "public" / "geojson" / f"{city}-gwr-blocks.geojson"
    write_artifact(path, out, indent=None)
    print(f"  {len(feats)} unit polygons -> {path.name}", file=sys.stderr)
    return 1 if (unmatched or missing) else 0


def build_extended(city: str, cfg: dict) -> int:
    """Upsert IN-GRES editions into an existing blocks series, keeping older
    vintages, then move the block polygons' attributes to the latest edition
    (the ward profiles read them). Any change to an already-published value is
    printed, never applied silently."""
    path = DATA_DIR / cfg.get("blocks_file", f"gwr-blocks-{city}.json")
    geo_path = REPO_ROOT / "public" / "geojson" / f"{city}-gwr-blocks.geojson"
    doc = json.loads(path.read_text())
    geo = json.loads(geo_path.read_text())
    blocks = {b["name"]: b for b in doc["blocks"]}
    newest: dict[str, tuple[int, dict]] = {}

    for year in cfg["years"]:
        rows = [
            r
            for r in fetch_units(cfg["extend"], year)
            if isinstance(r, dict) and (r.get("locationName") or "").lower() != "total"
        ]
        if not rows:
            print(f"  {year}: no edition published", file=sys.stderr)
            continue
        end = int(year.split("-")[1])
        for r in rows:
            raw = r.get("locationName") or ""
            if "unit_areas" in cfg:
                area = ((r.get("area") or {}).get("total") or {}).get("totalArea")
                name = cfg["unit_areas"].get(round(area or 0))
            else:
                name = next(
                    (v for k, v in cfg["unit_names"].items() if k in raw.lower()), None
                )
            if name not in blocks:
                print(
                    f"  ! {year}: unknown unit {raw!r}, no polygon for it",
                    file=sys.stderr,
                )
                return 1
            cat = (r.get("category") or {}).get("total")
            stage = total_of(r.get("stageOfExtraction"))
            if CLASS_LABEL.get(cat) is None or stage is None:
                print(
                    f"  ! {raw} {year}: category={cat!r} stage={stage!r}",
                    file=sys.stderr,
                )
                return 1
            avail = fresh_of(r.get("totalGWAvailability"))
            draft = fresh_of((r.get("draftData") or {}).get("total"))
            entry = {
                "year": end,
                "year_label": f"{year[:4]}-{year[-2:]}",
                "class": CLASS_LABEL[cat],
                "development_pct": round(stage, 1),
                "availability_ham": _r1(avail),
                "draft_total_ham": _r1(draft),
            }
            if cfg.get("end_year_labels"):
                del entry["year_label"]
            hist = blocks[name]["history"]
            old = next((h for h in hist if h["year"] == end), None)
            if old and any(old.get(k) != entry[k] for k in entry if k != "year_label"):
                print(f"  ~ {name} {year}: {old} -> {entry}", file=sys.stderr)
            hist[:] = sorted(
                [h for h in hist if h["year"] != end] + [entry], key=lambda h: h["year"]
            )
            if end >= newest.get(name, (0, {}))[0]:
                newest[name] = (
                    end,
                    {
                        "class": entry["class"],
                        "sgw_dev_pe": stage,
                        "na_gwa": round(avail, 2),
                        "agwd_tot": round(draft, 2),
                    },
                )

    last = max(e for e, _ in newest.values())
    for b in doc["blocks"]:
        h = b["history"][-1]
        b["latest"] = {
            k: h[k]
            for k in ("class", "development_pct", "availability_ham", "draft_total_ham")
        }
        if newest.get(b["name"], (0,))[0] != last:
            print(f"  ! {b['name']} is not in the latest edition", file=sys.stderr)
    doc["blocks"].sort(key=lambda b: -b["latest"]["development_pct"])
    doc["years"] = sorted({h["year"] for b in doc["blocks"] for h in b["history"]})
    doc["fetched_at"] = date.today().isoformat()
    for f in geo["features"]:
        f["properties"].update(newest[f["properties"]["block"]][1])

    write_artifact(path, doc)
    write_artifact(geo_path, geo)
    for b in doc["blocks"]:
        print(
            f"  {b['name']:18} {b['latest']['development_pct']:6.1f}%  {b['latest']['class']}",
            file=sys.stderr,
        )
    return 0


def _r1(v):
    return round(v, 1) if isinstance(v, (int, float)) else None


def fresh_of(v):
    """Command + non-command, i.e. the assessment EXCLUDING poor-quality area.

    THE `total` KEY DOES NOT MATCH THE PUBLISHED REPORT, and this is the single
    most dangerous trap in this API. Every numeric field arrives as
    {total, command, non_command, poor_quality}, and `total` silently includes
    the saline/poor-quality tract. CGWB's published tables do not: they assess
    on the fresh-water area alone. For Pune district the difference is not
    cosmetic -

        command+non_command : recharge 194,942.64  extractable 182,653.14
                              extraction 115,497.00  stage 63.23%
        naive `total` key   : recharge 198,782.13  extractable 186,253.69
                              extraction 125,261.38  stage 67.25%

    and the first row reproduces the CGWB National Compilation on Dynamic
    Ground Water Resources of India 2025 (p.161) to the decimal while the
    second matches nothing anyone has published. It bites hardest on the four
    salinity-affected talukas - Baramati, Daund, Indapur and Purandhar - and
    is INVISIBLE on the other ten, whose poor-quality area is zero. Verifying
    on Shirur or Haveli alone would have shown perfect agreement and proved
    nothing.

    `stageOfExtraction` and `category` are already computed on the fresh area
    by the server, so they are used as served - which is why the stage % was
    right even while the volumes it is computed from were wrong.
    """
    if not isinstance(v, dict):
        return v if isinstance(v, (int, float)) else None
    cmd, non = v.get("command"), v.get("non_command")
    if cmd is None and non is None:
        return v.get("total")
    return (cmd or 0) + (non or 0)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="kolkata", choices=sorted(CITIES))
    args = ap.parse_args()
    cfg = CITIES[args.city]

    if "drill" in cfg:
        return build_drilled(args.city, cfg)
    if "extend" in cfg:
        return build_extended(args.city, cfg)

    by_district: dict[str, dict] = {}
    years_seen = []
    for year in YEARS:
        rows = fetch(cfg["state"], year)
        if not rows:
            continue
        years_seen.append(year)
        wanted = cfg["districts"]
        hits = 0
        for r in rows:
            name = r.get("locationName")
            if name not in wanted:
                continue
            hits += 1
            cat = r.get("category") or {}
            entry = by_district.setdefault(
                wanted[name],
                {"district": wanted[name], "ingres_name": name, "history": []},
            )
            entry["history"].append(
                {
                    "year": year,
                    # The headline classification. 'salinity' is a POOR-QUALITY
                    # category, not a stage band - a district carrying it has no
                    # extraction percentage at all, and that is a finding rather
                    # than a gap.
                    "category": cat.get("total"),
                    "poor_quality": cat.get("poor_quality"),
                    "assessed_on_extraction": cat.get("total")
                    not in (None, "salinity", "poor_quality"),
                    # THE HEADLINE NUMBER, and it was missing until 2026-08-16.
                    # The artifact carried the category band but not the
                    # percentage behind it, so nothing downstream could render a
                    # graduated choropleth or quote the figure - Gurugram's
                    # 194.59% existed only in hand-written prose. Absent for a
                    # salinity-categorised district, which is correct: CGWB does
                    # not assess those on extraction.
                    "stage_of_extraction_pct": total_of(r.get("stageOfExtraction")),
                    "extraction_total_ham": total_of(r.get("gwExtraction")),
                    "total_gw_availability_ham": total_of(r.get("totalGWAvailability")),
                    "static_gw_resource_ham": total_of(r.get("staticGWResource")),
                    "additional_recharge_ham": total_of(r.get("additionalRecharge")),
                    "loss_ham": total_of(r.get("loss")),
                    "env_flows_ham": total_of(r.get("envFlows")),
                }
            )
        print(
            f"  {year}: {len(rows)} rows, {hits} of {len(wanted)} target districts",
            file=sys.stderr,
        )

    if not by_district:
        print(
            "no districts matched - check the IN-GRES spellings in CITIES",
            file=sys.stderr,
        )
        return 1

    districts = sorted(by_district.values(), key=lambda d: d["district"])
    for d in districts:
        d["history"].sort(key=lambda h: h["year"])
        d["latest"] = d["history"][-1] if d["history"] else None

    saline = [
        d["district"]
        for d in districts
        if d["latest"] and not d["latest"]["assessed_on_extraction"]
    ]

    out = {
        "place_id": args.city,
        "generated_at": date.today().isoformat(),
        "source": "IN-GRES - India Ground Water Resource Estimation System (CGWB + State groundwater departments)",
        "source_url": "https://ingres.iith.ac.in/",
        "acquired_via": "IN-GRES API, gec/getBusinessDataForUserOpen (no auth)",
        "state": cfg["state_label"],
        "assessment_years": years_seen,
        "unit_note": "ham = hectare-metres.",
        "districts": districts,
        "not_assessed_on_extraction": saline,
        # Per-city, NOT shared. These were hardcoded Kolkata prose until
        # Gurugram became the second city through here and its artifact shipped
        # three notes about Kolkata's saline aquifer and Kolkata's district
        # spellings. A builder is not city-generic because its CONFIG is
        # parameterised; its OUTPUT TEXT has to be too. Same failure as the
        # footer that told every city CMWSSB was one of their sources.
        "notes": cfg["notes"],
    }
    # NVDM v1 envelope emitted by the PRODUCER. Kolkata's copy was enveloped by
    # a separate per-city injector, which meant a fresh run of this script
    # produced a sub-L2 artifact for any new city - Gurugram's first build came
    # out at L0. A regenerating producer owns its envelope.
    envelope = {
        "nvdm": "1.0",
        "dataset": "data-root/gwr-blocks",
        "scope": {"kind": SCOPE_KIND.get(args.city, "city"), "id": args.city},
        "provenance": {
            "sources": [
                {
                    "id": cfg["source_id"],
                    "title": (
                        f"IN-GRES dynamic ground water resource assessment, "
                        f"{cfg['state_label']} districts"
                    ),
                    "publisher": (
                        "IN-GRES (CGWB + State groundwater departments), IIT Hyderabad"
                    ),
                    "license": registry_license(cfg["source_id"]),
                }
            ],
            "method": "api",
            "produced_at": out["generated_at"],
            "produced_by": "neer-vazhvu-api/scripts/build_ingres_gwr.py",
            "note": (
                "Assessment (extraction against availability, stage %, category) per "
                "district, across every published assessment year. This is NOT "
                "depth-to-water - IN-GRES does not carry it; measured levels are a "
                "separate India-WRIS series."
            ),
        },
    }
    path = DATA_DIR / f"gwr-blocks-{args.city}.json"
    write_artifact(path, {**envelope, **out}, indent=1)
    print(
        f"{args.city}: {len(districts)} districts, years {years_seen}; "
        f"not assessed on extraction: {saline or 'none'} -> {path.name}",
        file=sys.stderr,
    )
    for d in districts:
        lt = d["latest"] or {}
        print(
            f"    {d['district']:22} {str(lt.get('category')):16} {lt.get('year')}",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

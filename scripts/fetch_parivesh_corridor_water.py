#!/usr/bin/env python3
"""Parivesh EIA/EC water pilot - Sriperumbudur-Oragadam industrial corridor.

Discovers Tamil Nadu EC proposals on Parivesh (parivesh.nic.in), downloads the
granted-EC certificate PDFs for a fixed pilot cohort of corridor facilities,
and extracts the SEIAA "salient features" water table (water requirement,
source, wastewater, STP/ETP, reuse, rainwater harvesting, groundwater
permissions) into ONE governed dataset:

    public/data/corridors/sriperumbudur/parivesh-ec-water.json

CLAIM LANGUAGE: every figure in the output is a PROPONENT-ASSERTED value as
stated in the EC/EIA submission and restated in the SEIAA EC letter. Nothing
here is a measured or audited quantity.

API recipe (undocumented, verified 2026-07-31):
  - GET  {API}/trackYourProposal/advanceSearchData?majorClearanceType=1
         &state=33&text=          -> ALL Tamil Nadu EC proposals as JSON.
         (Free-text queries cap at 40 rows; dump-by-state and filter locally.)
  - Granted ECs carry a direct certificate PDF URL under certificate_url /
    certificateUrl / certificate_url1.
  - POST {API}/proponentApplicant/getCafDataByProposalNo?proposal_no=<NO>
         (empty JSON body) -> structured CAF, archived alongside the PDF.

Politeness: sequential requests with SLEEP_S between them; every raw response
(JSON and PDF) is archived under scripts/.cache/parivesh/ (git-ignored) and
re-runs never re-download an archived file. Extraction is deterministic:
`extract` + `build` read only the cache, so the dataset is reproducible
offline from the archived PDFs.

Two extraction layers, deliberately separate:

  1. AUTO extraction (`parse_letter`): regexes over `pdftotext -layout` text
     for the recurring SEIAA table patterns. Used to MEASURE how far a
     generalized extractor gets on real letters (the format-variance question
     that decides whether a ~3,000-document run is viable).
  2. VERIFIED transcription (the `VERIFIED` table): a manual pass done
     2026-07-31 reading every letter field by field against its
     `pdftotext -layout` rendering; layout-misaligned tables were settled by
     the letter's own component arithmetic. These values are authoritative; the
     build marks per-field agreement between the two layers in
     `extraction.auto_match`, and any core-field disagreement is reported at
     build time. Ambiguous figures are null with a note quoting the letter -
     never an inferred number. Genuine judgment calls are queued for human
     review in the record's `review` list.

Usage:
    python3 scripts/fetch_parivesh_corridor_water.py discover   # state dump + corridor filter report
    python3 scripts/fetch_parivesh_corridor_water.py download   # certificate PDFs + CAF JSONs (network)
    python3 scripts/fetch_parivesh_corridor_water.py extract    # auto-extraction + variance report
    python3 scripts/fetch_parivesh_corridor_water.py build      # write the governed dataset
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "scripts" / ".cache" / "parivesh"
OUT = ROOT / "public" / "data" / "corridors" / "sriperumbudur" / "parivesh-ec-water.json"

API = "https://parivesh.nic.in/parivesh_api"
STATE_TN = 33  # Parivesh state id for Tamil Nadu
EC_CLEARANCE = 1  # majorClearanceType 1 = Environmental Clearance
SLEEP_S = 2.0
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

# Snapshot date of the discovery dump + downloads + manual verification pass;
# keeps `build` deterministic.
SNAPSHOT = "2026-07-31"

# Corridor membership filter used for the discovery report (toponyms of the
# Sriperumbudur-Oragadam corridor: taluks, SIPCOT nodes, villages).
CORRIDOR_PATTERN = re.compile(
    r"sriperumbudur|oragadam|walajabad|vallam|irungattukottai|pillaipakkam|"
    r"mambakkam|vadagal|irumbedu|sunguvarchatram|varanavasi|ullavur|ezhichur",
    re.I,
)

# ---------------------------------------------------------------------------
# Pilot cohort - fixed, documented selection (2026-07-31).
#
# Criteria: EC Granted with a certificate PDF; located in the
# Sriperumbudur-Oragadam corridor (SIPCOT Sriperumbudur / Irungattukottai /
# Oragadam / Mambakkam-Vallam Vadagal nodes and Walajabad); mixing anchor
# manufacturers with industrial-park developers. All are SEIAA-TN letters
# (the two granted Category-A toponym hits in the 2026-07-31 dump are outside
# the corridor, so the "larger projects" slots are B1 anchors: Hyundai,
# Yamaha, the Guindy Warehousing electronics campus).
#
# First-pass reading showed six of the originally selected sixteen letters
# are amendment/corrigendum letters that restate no water table; the last
# three entries are substantive corridor grants added to keep the
# water-bearing record count near the pilot target. The amendment letters
# stay in the cohort deliberately - "the certificate PDF of a granted EC is
# not always the water-bearing document" is a pilot finding that a scaled
# extractor has to design around.
# ---------------------------------------------------------------------------
PILOT = [
    ("SIA/TN/INFRA2/561399/2025", "Mobis India, SIPCOT Sriperumbudur (Pillaipakkam)"),
    ("SIA/TN/INFRA2/561627/2025", "Knorr-Bremse, SIPCOT Mambakkam (Sriperumbudur Ph IV)"),
    ("SIA/TN/INFRA2/574654/2026", "Knorr-Bremse, corrigendum to the Mambakkam EC"),
    ("SIA/TN/IND3/507163/2024", "Asian Paints, SIPCOT Sriperumbudur (amendment EC)"),
    ("SIA/TN/INFRA2/518129/2025", "India Yamaha Motor, Vallam Vadagal"),
    ("SIA/TN/INFRA2/543039/2025", "India Yamaha Motor, amendment (CER change)"),
    ("SIA/TN/INFRA2/467617/2024", "Tata Electronics expansion, amendment (built-up area)"),
    ("SIA/TN/INFRA2/502376/2024", "Mobile-phone enclosure plant, Walajabad (Guindy Warehousing)"),
    ("SIA/TN/INFRA2/519363/2025", "Mobile-phone enclosure plant, corrigendum"),
    ("SIA/TN/INFRA2/557819/2025", "NSK Bearings, Oragadam"),
    ("SIA/TN/INFRA2/539591/2025", "Allison Transmission, Oragadam"),
    ("SIA/TN/INFRA2/501457/2024", "Indospace Park Oragadam V, Ullavur"),
    ("SIA/TN/INFRA2/569723/2026", "Indospace Park Oragadam VI, corrigendum"),
    ("SIA/TN/INFRA2/527678/2025", "Hyundai Motor India, Irungattukottai"),
    ("SIA/TN/INFRA2/539380/2025", "Hyundai WIA, Oragadam"),
    ("SIA/TN/INFRA2/499993/2024", "Saint-Gobain, SIPCOT Oragadam"),
    ("SIA/TN/INFRA2/558262/2025", "Indospace Park Oragadam VI, Ullavur (parent EC)"),
    ("SIA/TN/INFRA2/548712/2025", "Indospace Vallam II, industrial sheds expansion"),
    ("SIA/TN/INFRA2/501050/2024", "Vallam (Phase I) Logistics Park"),
]

# Core fields the auto-vs-manual agreement is measured on.
CORE_FIELDS = [
    "ec_date",
    "operation_total_kld",
    "operation_fresh_kld",
    "wastewater_domestic_kld",
    "stp_capacity_kld",
]

# ---------------------------------------------------------------------------
# Groundwater conditions - DETECTED PER LETTER, never assumed.
#
# The first pass of this pilot attached one "standard SEIAA condition" string
# to every record. Re-checking the letters on 2026-07-31 showed that is false:
# the CGWA abstraction/dewatering condition appears in only 6 of the 13
# water-bearing letters, and the Vallam Phase-I letter carries no groundwater
# monitoring condition at all. The condition set is therefore derived from the
# letter text by exact-phrase match, so the dataset can never claim a
# permission condition a letter does not impose.
#
# key -> (verbatim phrase searched for, the description carried in the output)
# ---------------------------------------------------------------------------
GW_CONDITIONS: dict[str, tuple[str, str]] = {
    "cgwa_abstraction_approval": (
        "Formal approval shall be taken from the CGWA for any ground water "
        "abstraction or dewatering",
        "'Formal approval shall be taken from the CGWA for any ground water "
        "abstraction or dewatering.'",
    ),
    "no_groundwater_in_construction": (
        "No ground water shall be used during construction phase of the project",
        "'No ground water shall be used during construction phase of the project.'",
    ),
    "permission_for_drawl_gw_or_sw": (
        "shall obtain the necessary permission for drawl of ground water / surface",
        "'The project proponent shall obtain the necessary permission for drawl of "
        "ground water / surface water required for the project from the competent authority.'",
    ),
    "permission_for_drawl_freshwater_before_cto": (
        "permission shall be obtained from the competent authority for the drawl / "
        "outsourcing of fresh water",
        "'Necessary permission shall be obtained from the competent authority for the "
        "drawl / outsourcing of fresh water before obtaining consent from TNPCB.' "
        "(applies to bought-in supply, not only abstraction)",
    ),
    "groundwater_level_monitoring": (
        "ground water level and its quality should be monitored and recorded regularly",
        "'The ground water level and its quality should be monitored and recorded "
        "regularly in consultation with Ground Water Authority.'",
    ),
    "borewell_noc_before_cto": (
        "Certificate (NOC) obtained from the Competent Authority for abstraction of groundwater",
        "Pre-CTO condition: 'The PP shall furnish valid permission/No Objection "
        "Certificate (NOC) obtained from the Competent Authority for abstraction of "
        "groundwater through borewells.'",
    ),
}


def groundwater_conditions(text: str) -> list[dict]:
    """Groundwater conditions the letter actually imposes (exact-phrase match)."""
    flat = re.sub(r"\s+", " ", text)
    return [
        {"condition": key, "as_stated": desc}
        for key, (phrase, desc) in GW_CONDITIONS.items()
        if phrase in flat
    ]

# ---------------------------------------------------------------------------
# VERIFIED - manual transcription pass, 2026-07-31 (see module docstring).
# All quantities in KLD unless the text says otherwise; all values are AS
# STATED in the EC letter ("as stated in the EC/EIA submission"). None means
# the letter does not state the figure. Never a computed/inferred number.
# ---------------------------------------------------------------------------
VERIFIED: dict[str, dict] = {
    "SIA/TN/INFRA2/561399/2025": {
        "proponent": "Mobis India Limited",
        "letter_type": "grant",
        "format": "standard-expansion",
        "ec_date": "2026-02-06",
        "ec_identification_no": "EC25C3803TN5689348N",
        "construction": {"water_kld": 11.5, "source": "SIPCOT supply"},
        "operation": {
            "total_kld": 174.0,
            "fresh_kld": 139.0,
            "recycled_kld": 35.0,
            "purchased_treated_kld": None,
        },
        "wastewater_domestic_kld": 37.0,
        "trade_effluent_kld": None,
        "stp_capacity_kld": 45.0,
        "etp_capacity_kld": None,
        "water_source": "SIPCOT supply",
        "reuse_note": "Treated water 35 KLD reused: flushing 15 KLD, greenbelt 20 KLD; surplus nil.",
        "rwh": "1 recharge pit; 500 m3 rainwater harvesting sump.",
        "notes": [
            "Values are the After-Expansion column (existing 139 KLD fresh, no increment sought).",
            "Trade effluent and ETP rows are dashes in the letter (no trade effluent stated).",
            "Fresh water breakdown as stated: domestic 27 KLD, greenbelt 112 KLD.",
        ],
    },
    "SIA/TN/INFRA2/561627/2025": {
        "proponent": "Knorr-Bremse India Private Limited",
        "letter_type": "grant",
        "format": "standard-single",
        "ec_date": "2026-02-05",
        "ec_identification_no": "EC25C3806TN5503218N",
        "construction": {
            "water_kld": 20.0,
            "source": "Private water tanker",
            "note": "Disposal: septic tank with soak pit.",
        },
        "operation": {
            "total_kld": None,
            "fresh_kld": 137.0,
            "recycled_kld": 225.0,
            "purchased_treated_kld": None,
        },
        "wastewater_domestic_kld": 111.0,
        "trade_effluent_kld": 125.0,
        "stp_capacity_kld": 145.0,
        "etp_capacity_kld": 145.0,
        "water_source": "Mambakkam SIPCOT",
        "reuse_note": (
            "Treated water available for reuse 225 KLD (flushing, greenbelt & process); "
            "treated sewage 106 + treated effluent 119; surplus 0."
        ),
        "rwh": "46 recharge pits (dia 1.5 m, depth 2.5 m = 203 KL); 300 KL rainwater collection tank.",
        "notes": [
            "The 'Total Water Requirement' cell prints no number of its own (p.3): the two values "
            "printed against the three-label row align to fresh (137, = domestic 79 + process 58) "
            "and treated recycled (225, = flushing 40 + greenbelt 98 + process 87). Total left null.",
            "Wastewater as stated: from STP (sewage) 111 KLD (domestic 71 + flushing 40); from ETP "
            "(effluent) 125 KLD (industrial area 31 + production area 94).",
            "The letter's row 26 'Trade Effluent Generation' actually lists TREATED water "
            "(treated sewage 106 + treated effluent 119 = 225); trade effluent here is the "
            "ETP influent 125 KLD from row 25.",
        ],
        "review": [
            {
                "question": (
                    "Row 21 stacks three labels ('Total Water Requirement' / 'i. Fresh water "
                    "requirement' / 'ii. Treated recycled water requirement') against only two "
                    "printed numbers, 137 and 225. Read literally the letter says total = 137 "
                    "and fresh = 225; read as a one-row shift it says fresh = 137 and treated "
                    "recycled = 225 with no total printed. Which reading does SEIAA intend?"
                ),
                "verbatim": (
                    "'21. Total Water Requirement 137 / i. Fresh water requirement 225 / "
                    "ii. Treated recycled water requirement' ... "
                    "'22. Fresh water requirement i. Domestic 79.0 ii. Process 58.0' ... "
                    "'23. Treated Water Requirement i. Flushing use 40.0 ii. Greenbelt 98.0 "
                    "iii. Process 87.0'"
                ),
                "page": "p.3 of SIA/TN/INFRA2/561627/2025 letter",
                "best_interpretation": (
                    "One-row shift: fresh 137 = domestic 79 + process 58, and treated recycled "
                    "225 = flushing 40 + greenbelt 98 + process 87, both exact against the "
                    "letter's own component rows. Recorded as fresh 137 / recycled 225 with "
                    "total null (it would be 362, which the never-infer rule forbids "
                    "recording). Confidence high, but it does invert the literal reading of "
                    "the fresh-water row, which is why it is queued rather than only noted."
                ),
            }
        ],
    },
    "SIA/TN/INFRA2/574654/2026": {
        "proponent": "Knorr-Bremse India Private Limited",
        "letter_type": "corrigendum",
        "format": "no-water-table",
        "ec_date": "2026-05-18",
        "ec_identification_no": "EC25C3806TN5503218N",
        "parent_ec": "EC25C3806TN5503218N dated 2026-02-05 (SIA/TN/INFRA2/561627/2025)",
        "notes": [
            "Corrigendum correcting survey numbers/plot details; restates no water figures. "
            "Water data for this facility lives in the parent EC letter record.",
        ],
    },
    "SIA/TN/IND3/507163/2024": {
        "proponent": "Asian Paints Limited",
        "letter_type": "amendment",
        "format": "no-water-table",
        "ec_date": "2024-12-22",
        "ec_identification_no": "EC24B2601TN5462973A",
        "parent_ec": "EC24B000TN147478 dated 2024-01-12 (paints & water-based polymers plant, SIPCOT Sriperumbudur)",
        "notes": [
            "Amendment relocates a CSR 'Blue Green Centre' from IIT Madras to Olcott Memorial "
            "High School, Besant Nagar; no water figures restated. The plant's water table lives "
            "in the parent EC, which predates this pilot's certificate-URL cohort.",
        ],
    },
    "SIA/TN/INFRA2/518129/2025": {
        "proponent": "India Yamaha Motor Private Limited",
        "letter_type": "grant",
        "format": "standard-single",
        "ec_date": "2025-02-27",
        "ec_identification_no": "EC25B3813TN5181462N",
        "construction": {"water_kld": 100.0, "source": "Private tanker"},
        "operation": {
            "total_kld": 1303.6,
            "fresh_kld": 494.1,
            "recycled_kld": 809.5,
            "purchased_treated_kld": None,
        },
        "wastewater_domestic_kld": 373.49,
        "trade_effluent_kld": 437.5,
        "stp_capacity_kld": 200.0,
        "etp_capacity_kld": 0.0,
        "water_source": "SIPCOT",
        "reuse_note": (
            "Treated water requirement 809.5 KLD: flushing 84.5, process 371.01, boiler makeup 20, "
            "cooling tower makeup 45, greenbelt & OSR 288.99 (letter's own component list, "
            "which sums to 809.5 exactly)."
        ),
        "rwh": "4 ponds & roof collection system; sump capacity nil.",
        "notes": [
            "Fresh breakdown as stated: domestic 321.1, flushing 0, gardening 130.01, process 42.99.",
        ],
        "review": [
            {
                "question": (
                    "Letter states 'Proposed Capacity of ETP: 0 KLD' while also stating trade "
                    "effluent generation 437.5 KLD and construction-phase mode of disposal "
                    "'550 KLD Package STP & 468 KLD capacity of ETP' (p.3). Which ETP capacity "
                    "stands for the operating plant?"
                ),
                "verbatim": (
                    "'26. Proposed Capacity of STP 200 KLD; 27. Proposed Capacity of ETP 0 KLD' vs "
                    "'18. Mode of Disposal: 550 KLD Package STP & 468 KLD capacity of ETP' (construction phase)"
                ),
                "page": "p.3 of SIA/TN/INFRA2/518129/2025 letter",
                "best_interpretation": (
                    "Existing plant already runs larger STP/ETP (550/468 KLD); the '200/0' rows "
                    "describe only newly proposed units. Recorded as stated; confidence medium."
                ),
            }
        ],
    },
    "SIA/TN/INFRA2/543039/2025": {
        "proponent": "India Yamaha Motor Private Limited",
        "letter_type": "amendment",
        "format": "no-water-table",
        "ec_date": "2025-12-19",
        "ec_identification_no": "EC25B3813TN5560696A",
        "parent_ec": "EC25B3813TN5181462N dated 2025-02-27 (SIA/TN/INFRA2/518129/2025)",
        "notes": [
            "Amendment changes the CER activity to 'Waterbody Rejuvenation Projects' (Rs 2 crore, "
            "restore and enhance health of lakes and ponds); no water figures restated.",
        ],
    },
    "SIA/TN/INFRA2/467617/2024": {
        "proponent": "Tata Electronics Private Limited (letter addressed via applicant Sriram Kadiyala)",
        "letter_type": "amendment",
        "format": "no-water-table",
        "ec_date": "2024-05-29",
        "ec_identification_no": "EC24B3813TN5308758A",
        "parent_ec": "SEIAA-TN/F.No.9738/2023/8(b)/EC.No:999/2023 dated 2023-12-06",
        "notes": [
            "Amendment revises built-up area tables (incl. ETP/STP building rows) for the metal "
            "case / mobile phone manufacturing campus at Vallam Vadagal; no water quantities restated.",
        ],
    },
    "SIA/TN/INFRA2/502376/2024": {
        "proponent": "Guindy Warehousing & Industrial Logistics Pvt Ltd",
        "letter_type": "grant",
        "format": "standard-single",
        "ec_date": "2025-01-08",
        "ec_identification_no": "EC24B3813TN5711613N",
        "construction": {"water_kld": 255.0, "source": "SIPCOT", "note": "Stated as fresh water."},
        "operation": {
            "total_kld": 15426.98,
            "fresh_kld": 5000.0,
            "recycled_kld": 10426.98,
            "purchased_treated_kld": None,
        },
        "wastewater_total_kld": 10874.256,
        "wastewater_domestic_kld": None,
        "trade_effluent_kld": None,
        "stp_capacity_kld": 650.0,
        "etp_capacity_kld": None,
        "water_source": "SIPCOT",
        "reuse_note": "Treated water recycled: '1,87,500 (Flushing) + 260 (Gardening)' as printed.",
        "rwh": "50 recharge pits; 40,000 m3 rainwater harvesting pond.",
        "notes": [
            "Mobile-phone enclosure/casing manufacturing campus at Varanavasi-Agaram-Alavoor, "
            "Walajabad (project cost Rs 12,395 crore as stated).",
            "Wastewater generation printed as 10874.256 KLD with no domestic/trade split, and no "
            "ETP row despite the volume; kept null in the split fields, see review queue.",
        ],
        "review": [
            {
                "question": (
                    "Sub-rows 'Domestic 4,84,900 KLD' and 'Flushing 1,87,500 KLD' under fresh/treated "
                    "requirement (p.4) are 3 orders of magnitude above the stated totals. Are these "
                    "litres/day figures mislabelled KLD (i.e. 484.9 / 187.5 KLD)?"
                ),
                "verbatim": (
                    "'23. Fresh water requirement 5000 KLD; Domestic 4,84,900 KLD; Flushing 1,87,500 KLD; "
                    "24. Treated Water Requirement 10426.98 KLD; Flushing use 1,87,500 KLD; Greenbelt & OSR 260 KLD'"
                ),
                "page": "p.4 of SIA/TN/INFRA2/502376/2024 letter",
                "best_interpretation": (
                    "Litres/day pasted into a KLD table (484.9 and 187.5 KLD). Headline totals "
                    "(5000 fresh + 10426.98 recycled = 15426.98 total) are self-consistent and are "
                    "what the record carries. Confidence high for the totals, medium for the sub-rows."
                ),
            },
            {
                "question": (
                    "Wastewater generation 10874.256 KLD against STP capacity 650 KLD with no ETP row: "
                    "is the process-water treatment train simply absent from the letter's table?"
                ),
                "verbatim": "'26. Wastewater Generation 10874.256 KLD; 28. Proposed Capacity of STP 650 KLD'",
                "page": "p.5 of SIA/TN/INFRA2/502376/2024 letter",
                "best_interpretation": (
                    "The letter's table only covers the domestic STP; the industrial recycle train "
                    "(10,426.98 KLD treated-recycled) is not enumerated. Recorded as stated with "
                    "nulls in the split fields. Confidence medium."
                ),
            },
        ],
    },
    "SIA/TN/INFRA2/519363/2025": {
        "proponent": "Guindy Warehousing & Industrial Logistics Pvt Ltd",
        "letter_type": "corrigendum",
        "format": "no-water-table",
        "ec_date": "2025-02-02",
        "ec_identification_no": "EC24B3813TN5711613N",
        "parent_ec": "EC24B3813TN5711613N dated 2025-01-08 (SIA/TN/INFRA2/502376/2024)",
        "notes": [
            "Corrigendum to the enclosure-plant EC; restates no water figures.",
        ],
    },
    "SIA/TN/INFRA2/557819/2025": {
        "proponent": "NSK Bearings India Private Limited",
        "letter_type": "grant",
        "format": "standard-expansion",
        "ec_date": "2026-01-31",
        "ec_identification_no": "EC25C3806TN5549513N",
        "construction": {
            "water_kld": 100.0,
            "source": "Private tankers",
            "note": "Construction sewage treated in the existing 50 KLD STP.",
        },
        "operation": {
            "total_kld": 109.3,
            "fresh_kld": 78.7,
            "recycled_kld": 30.6,
            "purchased_treated_kld": None,
        },
        "wastewater_domestic_kld": 23.0,
        "trade_effluent_kld": 8.1,
        "stp_capacity_kld": 50.0,
        "etp_capacity_kld": 10.0,
        "water_source": "SIPCOT",
        "reuse_note": (
            "Treated water 30.6 KLD (STP 23 + ETP 7.6) reused: cooling tower 7.6, greenbelt 23; "
            "ETP revamp adds MEE/ATFD, ATFD salt to cement kilns."
        ),
        "rwh": "2 existing recharge pits + 27 additional proposed.",
        "notes": [
            "After-expansion column recorded (project summary table separately states "
            "104.10 existing + 5.2 addition = 109.30 total).",
            "Fresh breakdown as stated: domestic 27, greenbelt 30.3, process 7, CFS 10, cooling tower 4.4.",
        ],
    },
    "SIA/TN/INFRA2/539591/2025": {
        "proponent": "Allison Transmission India Private Limited",
        "letter_type": "grant",
        "format": "standard-expansion",
        "ec_date": "2025-08-19",
        "ec_identification_no": "EC25C3806TN5568882N",
        "construction": {
            "water_kld": 100.0,
            "source": "SIPCOT",
            "note": "Construction sewage 4.1 KLD to existing STP; treated water to greenbelt.",
        },
        "operation": {
            "total_kld": 106.13,
            "fresh_kld": None,
            "recycled_kld": 52.98,
            "purchased_treated_kld": None,
        },
        "wastewater_domestic_kld": 50.0,
        "trade_effluent_kld": 9.6,
        "stp_capacity_kld": 44.0,
        "etp_capacity_kld": None,
        "water_source": "SIPCOT & rainwater harvesting pond",
        "reuse_note": (
            "Treated water available for reuse 52.98 KLD (greenbelt 47.5, process 4.23, chillers "
            "1.25); surplus nil. Effluent treated through existing ETP + RO; RO permeate to "
            "process, reject to solar evaporation pond (site has one)."
        ),
        "rwh": (
            "Recharge-pit row is a dash (no count stated); rainwater harvesting sump capacity "
            "'One Pond of 2000 KL'. The pond is also named as a fresh-water source in row 24."
        ),
        "notes": [
            "STP: existing 44 KLD + additional 35 KLD stated as under installation per CTE "
            "obtained 2024 (footnote on p.5). stp_capacity_kld carries the existing 44, the only "
            "figure the letter states as a capacity; the stp_vs_sewage flag that follows (sewage "
            "50 > STP 44) is the letter's own gap, closed on paper by the additional 35 KLD unit.",
            "Row 22's 'Fresh water requirement' component list (domestic 50, flushing 0, process "
            "5.37, greenbelt 50.76, chiller 0) sums to 106.13 - the TOTAL water figure, not a "
            "fresh subtotal (existing parts 34.53 + 0 + 3.97 + 64.76 + 1 = 104.26, again the "
            "existing total). This is why fresh water is treated as unstated here.",
            "ETP capacity not stated as a number (prose: 'existing ETP (8.1 KLD)' refers to "
            "effluent volume treated, not nameplate capacity); left null.",
        ],
        "review": [
            {
                "question": (
                    "Row 21's continuation (p.5) prints one value '52.98 (existing: 38.28 & "
                    "additional: 14.70)' against the label pair 'i. Fresh water requirement / "
                    "i. Treated recycled water requirement'. Is 52.98 fresh or treated-recycled? "
                    "If treated, the letter never states fresh (106.13 - 52.98 = 53.15 by "
                    "subtraction, which the never-infer rule forbids recording)."
                ),
                "verbatim": (
                    "'21. Total Water 106.13 (existing: 104.26 & additional: 1.87) | Requirement "
                    "52.98 (existing: 38.28 & additional: 14.70) i. Fresh water requirement "
                    "i. Treated recycled water requirement' ... '23. Treated Water Requirement "
                    "47.5 (existing: 33.5 & additional: 14); i. Greenbelt 4.23; ii. Process 1.25'"
                ),
                "page": "pp.4-5 of SIA/TN/INFRA2/539591/2025 letter",
                "best_interpretation": (
                    "52.98 is the TREATED-recycled figure: row 23's components 47.5 + 4.23 + 1.25 "
                    "= 52.98 and their existing parts 33.5 + 4.78 + 0 = 38.28 reproduce its "
                    "decomposition exactly. Fresh therefore unstated (would be 53.15 by "
                    "subtraction). Confidence high on 52.98 = treated; fresh left null."
                ),
            }
        ],
    },
    "SIA/TN/INFRA2/501457/2024": {
        "proponent": "Indospace Park Oragadam V Phase 1 Private Limited",
        "letter_type": "grant",
        "format": "short-form",
        "ec_date": "2024-12-17",
        "ec_identification_no": "EC24C3806TN5394981N",
        "construction": None,
        "operation": {
            "total_kld": None,
            "fresh_kld": 190.0,
            "recycled_kld": 318.0,
            "purchased_treated_kld": None,
        },
        "wastewater_domestic_kld": 318.0,
        "trade_effluent_kld": None,
        "stp_capacity_kld": 350.0,
        "etp_capacity_kld": None,
        "water_source": "Local body",
        "reuse_note": (
            "Treated sewage 318 KLD reused: toilet flushing 156, greenbelt & OSR 90, avenue "
            "plantation & village parks 72."
        ),
        "rwh": "45 recharge pits; 3,700 m3 rainwater harvesting pond.",
        "notes": [
            "Short-form letter: no single 'total water requirement' figure and no "
            "construction-phase water row; greywater/effluent row is 'NA'.",
            "recycled_kld 318 is the letter's own stated total ('treated sewage of 318 KLD "
            "will be reused as follows...').",
            "CER list includes 'Streamlining water flow from Ullavur Periya Eri, Sitheri & "
            "Maduvu Eri (as per Collector NOC)' - tank-cascade work adjacent to the park.",
        ],
    },
    "SIA/TN/INFRA2/569723/2026": {
        "proponent": "Indospace Park Oragadam VI Phase 1/2/3 Private Limited",
        "letter_type": "corrigendum",
        "format": "no-water-table",
        "ec_date": "2026-03-09",
        "ec_identification_no": "EC25C3806TN5438877N",
        "parent_ec": "EC25C3806TN5438877N dated 2026-01-31 (SIA/TN/INFRA2/558262/2025)",
        "notes": [
            "Corrigendum correcting survey numbers in the Oragadam VI park EC; no water figures.",
        ],
    },
    "SIA/TN/INFRA2/527678/2025": {
        "proponent": "Hyundai Motor India Limited",
        "letter_type": "grant",
        "format": "standard-expansion",
        "ec_date": "2025-07-02",
        "ec_identification_no": "EC25B3813TN5581348N",
        "construction": {
            "water_kld": 43.5,
            "source": "HMI pond / SIPCOT lake water",
            "note": "Disposal to existing STP.",
        },
        "operation": {
            "total_kld": 5536.0,
            "fresh_kld": 1500.0,
            "recycled_kld": 4537.0,
            "purchased_treated_kld": None,
        },
        "wastewater_total_kld": 4537.0,
        "wastewater_domestic_kld": None,
        "trade_effluent_kld": None,
        "stp_capacity_kld": 1815.0,
        "etp_capacity_kld": 4400.0,
        "water_source": "SIPCOT lake water / HMIL pond",
        "reuse_note": "Treated water 4537 KLD; reused industrial usage 2547, greenbelt 1900.",
        "rwh": "No recharge-pit count stated; 3,35,000 m3 storage across 6 existing ponds.",
        "notes": [
            "After-expansion column recorded (existing 5529 total / 1493 fresh / 4530 recycled).",
            "Wastewater generation printed as a single 4537 KLD figure equal to treated-water "
            "generation; no domestic/trade split (trade effluent row is a dash), so the split "
            "fields stay null.",
            "Surface-water sourced: SIPCOT lake water plus the plant's own ponds - the corridor's "
            "largest stated industrial water demand in this cohort.",
        ],
        "review": [
            {
                "question": (
                    "Letter's own components disagree: fresh 1500 + treated recycled 4537 = 6037, "
                    "but 'Total water' prints 5536 (p.5). Which does SEIAA treat as granted total?"
                ),
                "verbatim": (
                    "'21. Total water: Existing 5529 KLD, After Expansion/Total 5536 KLD; Fresh water "
                    "1493 -> 1500 KLD; Treated recycled water 4530 -> 4537 KLD'"
                ),
                "page": "p.5 of SIA/TN/INFRA2/527678/2025 letter",
                "best_interpretation": (
                    "Recorded all three verbatim with an arithmetic flag. The 501 KLD gap is in the "
                    "proponent's own table (5529/1493/4530 has the same gap); possibly 'total' "
                    "excludes a reuse stream counted in the recycled figure. Confidence in the "
                    "transcription high; in the reconciliation none."
                ),
            }
        ],
    },
    "SIA/TN/INFRA2/539380/2025": {
        "proponent": "Hyundai WIA India Private Limited",
        "letter_type": "grant",
        "format": "standard-expansion",
        "ec_date": "2025-07-30",
        "ec_identification_no": "EC25C3803TN5737017N",
        "construction": {"water_kld": 4.5, "source": "Local body", "note": "Disposal: STP & ETP."},
        "operation": {
            "total_kld": 210.0,
            "fresh_kld": 107.03,
            "recycled_kld": 102.97,
            "purchased_treated_kld": None,
        },
        "wastewater_domestic_kld": 80.0,
        "trade_effluent_kld": 27.0,
        "stp_capacity_kld": 150.0,
        "etp_capacity_kld": 40.0,
        "water_source": "Local body",
        "reuse_note": (
            "Treated water (STP 76 + ETP 26.97) reused: flushing 30, greenbelt & OSR 46."
        ),
        "rwh": "Recharge pits 22 existing + 239 proposed; sump 548.8 -> 1041.6 KL after expansion.",
        "notes": [
            "recycled_kld is the letter's two stated components (STP treated 76 + ETP treated "
            "26.97); their sum equals total minus fresh exactly.",
            "STP capacity after expansion 150 KLD (60 existing + 90 proposed); ETP capacities "
            "after expansion ETP-1 10 + ETP-2 30 KLD (recorded sum 40).",
        ],
    },
    "SIA/TN/INFRA2/499993/2024": {
        "proponent": "Saint-Gobain Industries India Private Limited",
        "letter_type": "grant",
        "format": "standard-single",
        "ec_date": "2024-12-24",
        "ec_identification_no": "EC24C3806TN5974153N",
        "construction": {
            "water_kld": 200.0,
            "source": "Private tankers",
            "note": "Sewage via 70 KLD package STP; treated sewage to greenbelt.",
        },
        "operation": {
            "total_kld": 1234.72,
            "fresh_kld": 119.0,
            "recycled_kld": 225.02,
            "purchased_treated_kld": 890.7,
        },
        "wastewater_domestic_kld": 101.7,
        "trade_effluent_kld": 126.0,
        "stp_capacity_kld": 120.0,
        "etp_capacity_kld": 150.0,
        "water_source": "SIPCOT / TTRO Koyambedu (purchased tertiary-treated water)",
        "reuse_note": (
            "Letter's own summary: fresh 119 (SIPCOT), raw process water 890.7 (TTRO Koyambedu), "
            "recycled 225.02 (greenbelt 101.7 + process 123.32). ETP with MEE; RO rejects to MEE."
        ),
        "rwh": "No recharge-pit count stated; rainwater harvesting sump capacity printed 161,200 cu.m.",
        "notes": [
            "Float-glass campus at SIPCOT Oragadam (plot OZ-2, Panruti-A & Vallam-B).",
            "Components reconcile exactly: 119 + 890.7 + 225.02 = 1234.72.",
            "First cohort facility whose process water is mostly PURCHASED recycled sewage "
            "(Chennai Metro TTRO at Koyambedu) rather than fresh abstraction.",
        ],
        "review": [
            {
                "question": (
                    "Rainwater harvesting sump capacity prints 161,200 cu.m (p.4) - two orders above "
                    "every other letter in the cohort. Genuine storage lagoon or a units slip?"
                ),
                "verbatim": "'32. Rainwater Harvesting Sump Capacity 161200 Cu.m'",
                "page": "p.4 of SIA/TN/INFRA2/499993/2024 letter",
                "best_interpretation": (
                    "Possibly a real large storage reservoir for a 45-acre glass campus, but "
                    "unverifiable from the letter. Recorded verbatim in the rwh text field only. "
                    "Confidence low either way."
                ),
            }
        ],
    },
    "SIA/TN/INFRA2/558262/2025": {
        "proponent": "Indospace Park Oragadam VI Phase 1/2/3 Private Limited",
        "letter_type": "grant",
        "format": "standard-single",
        "ec_date": "2026-01-31",
        "ec_identification_no": "EC25C3806TN5438877N",
        "construction": {"water_kld": 19.0, "source": "Private tankers"},
        "operation": {
            "total_kld": 339.0,
            "fresh_kld": 187.0,
            "recycled_kld": 311.0,
            "purchased_treated_kld": None,
        },
        "wastewater_domestic_kld": 311.0,
        "trade_effluent_kld": None,
        "stp_capacity_kld": 350.0,
        "etp_capacity_kld": None,
        "water_source": "Ground water (borewell)",
        "reuse_note": "Treated water 311 KLD reused: flushing 152, greenbelt & OSR 159; surplus dash.",
        "rwh": "26 recharge pits; 1,300 m3 rainwater harvesting pond.",
        "notes": [
            "ETP capacity row prints 'Nil'; trade effluent not stated (warehouse park).",
            "The only cohort letter carrying the pre-CTO borewell NOC condition (2.1), which also "
            "requires a groundwater quality report from an accredited lab - consistent with this "
            "being the only facility stating groundwater as its operating source.",
            "Letter's own rows: total 339 vs fresh 187 + recycled 311 = 498. 187 + flushing 152 "
            "= 339, so the printed total appears to count fresh + flushing only; recorded "
            "verbatim with an arithmetic flag (same pattern as the Vallam Phase-I letter).",
            "Only cohort facility stating groundwater as its operating source - in firkas the "
            "regulator's assessment books as SAFE.",
        ],
    },
    "SIA/TN/INFRA2/548712/2025": {
        "proponent": "Indospace Vallam II Private Limited",
        "letter_type": "grant",
        "format": "standard-expansion",
        "ec_date": "2025-09-30",
        "ec_identification_no": "EC25C3806TN5921702N",
        "construction": {
            "water_kld": 7.0,
            "source": "Private tankers",
            "note": "Disposal: septic tank with soak pit or mobile STP.",
        },
        "operation": {
            "total_kld": None,
            "fresh_kld": 163.0,
            "recycled_kld": 85.0,
            "purchased_treated_kld": None,
        },
        "wastewater_domestic_kld": 223.0,
        "trade_effluent_kld": None,
        "stp_capacity_kld": 235.0,
        "etp_capacity_kld": None,
        "water_source": "SIPCOT",
        "reuse_note": "Treated water 223 KLD reused: flushing 85, greenbelt 138; surplus 0.",
        "rwh": "40 recharge pits; 'RWH pond capacity - 1.6' as printed (unit column says M3).",
        "notes": [
            "After-expansion column recorded (existing per CTO: fresh 88, recycled 44, wastewater "
            "119, STP 135).",
            "No single total-water figure printed (same three-label row pattern as the "
            "Knorr-Bremse letter); trade effluent row 'NIL'.",
            "The printed RWH pond capacity '1.6 M3' is implausibly small; recorded verbatim in "
            "the rwh text only, not as a number.",
        ],
    },
    "SIA/TN/INFRA2/501050/2024": {
        "proponent": "Vallam (Phase I) Logistics Park Private Limited",
        "letter_type": "grant",
        "format": "short-form",
        "ec_date": "2024-12-23",
        "ec_identification_no": "EC24C3803TN5595770N",
        "construction": {
            "water_kld": 18.0,
            "source": "Local body",
            "note": "Construction-phase sewage 4 KLD.",
        },
        "operation": {
            "total_kld": 443.0,
            "fresh_kld": 287.0,
            "recycled_kld": 412.0,
            "purchased_treated_kld": None,
        },
        "wastewater_domestic_kld": 414.0,
        "trade_effluent_kld": None,
        "stp_capacity_kld": 450.0,
        "etp_capacity_kld": None,
        "water_source": "Local body",
        "reuse_note": "Treated sewage reused: flushing 156, greenbelt & OSR 256.",
        "rwh": "55 recharge pits; 2 rainwater harvesting ponds.",
        "notes": [
            "Short-form letter; greywater/effluent row is a dash (logistics park).",
            "Letter's own rows: total 443 vs fresh 287 + recycled 412 = 699. 287 + flushing 156 "
            "= 443, the same fresh-plus-flushing pattern as the Oragadam VI letter; recorded "
            "verbatim with an arithmetic flag.",
            "STP 450 KLD MBBR.",
        ],
    },
}


def slug(proposal_no: str) -> str:
    return proposal_no.replace("/", "_")


def fetch(url: str, dest: Path, post_json: bool = False) -> bool:
    """Download url -> dest unless already archived. Returns True if fetched."""
    if dest.exists() and dest.stat().st_size > 0:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    if post_json:
        req = urllib.request.Request(
            url,
            data=b"{}",
            headers={"User-Agent": UA, "Content-Type": "application/json"},
            method="POST",
        )
    else:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        dest.write_bytes(resp.read())
    time.sleep(SLEEP_S)
    return True


def load_state_dump() -> list[dict]:
    f = CACHE / "tn-ec-proposals.json"
    if not f.exists():
        url = (
            f"{API}/trackYourProposal/advanceSearchData"
            f"?majorClearanceType={EC_CLEARANCE}&state={STATE_TN}&text="
        )
        print(f"fetching TN EC dump: {url}")
        fetch(url, f)
    return json.loads(f.read_text())["data"]


def cert_url(row: dict) -> str | None:
    return row.get("certificate_url") or row.get("certificateUrl") or row.get("certificate_url1")


def pilot_rows() -> list[tuple[dict, str]]:
    rows = load_state_dump()
    by_no: dict[str, list[dict]] = {}
    for r in rows:
        by_no.setdefault(r["proposalNo"], []).append(r)
    out = []
    for no, label in PILOT:
        cand = by_no.get(no, [])
        if not cand:
            sys.exit(f"pilot proposal {no} missing from state dump")
        row = next((r for r in cand if cert_url(r)), cand[0])
        out.append((row, label))
    return out


def cmd_discover() -> None:
    rows = load_state_dump()
    hits = [r for r in rows if CORRIDOR_PATTERN.search(json.dumps(r))]
    granted = [r for r in hits if r.get("proposalStatus") == "EC Granted"]
    with_cert = [r for r in granted if cert_url(r)]
    print(
        f"TN EC proposals: {len(rows)}; corridor toponym hits: {len(hits)}; "
        f"EC Granted: {len(granted)}; with certificate: {len(with_cert)}"
    )
    pilot_nos = {no for no, _ in PILOT}
    for r in sorted(with_cert, key=lambda r: r["proposalNo"]):
        mark = "*" if r["proposalNo"] in pilot_nos else " "
        print(f" {mark} {r['proposalNo']} | {r['category']} | {r['projectName'][:90]}")
    print("(* = pilot cohort)")


def cmd_download() -> None:
    for row, label in pilot_rows():
        no = row["proposalNo"]
        url = cert_url(row)
        if not url:
            print(f"SKIP {no} ({label}): no certificate URL")
            continue
        pdf = CACHE / "pdf" / f"{slug(no)}.pdf"
        if fetch(url, pdf):
            print(f"fetched {no} certificate ({pdf.stat().st_size} bytes)")
        caf = CACHE / "caf" / f"{slug(no)}.json"
        caf_url = f"{API}/proponentApplicant/getCafDataByProposalNo?proposal_no={no}"
        try:
            if fetch(caf_url, caf, post_json=True):
                print(f"fetched {no} CAF")
        except Exception as e:  # CAF is nice-to-have archive material
            print(f"WARN {no}: CAF fetch failed: {e}")


def pdf_text(no: str) -> str:
    pdf = CACHE / "pdf" / f"{slug(no)}.pdf"
    txt = CACHE / "txt" / f"{slug(no)}.txt"
    if not txt.exists():
        txt.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["pdftotext", "-layout", str(pdf), str(txt)], check=True)
    return txt.read_text(errors="replace")


# ---------------------------------------------------------------------------
# AUTO extraction (measurement layer - see module docstring).
# ---------------------------------------------------------------------------

NUM = r"(\d[\d,]*(?:\.\d+)?)"


def _num(s: str | None) -> float | None:
    return float(s.replace(",", "")) if s else None


def parse_letter(text: str) -> dict:
    """Best-effort generic extraction of the SEIAA salient-features water table.

    Targets the two recurring layouts: single-value rows ("Total Water
    Requirement   1303.6") and expansion rows where the LAST number on the
    row-group is the After-Expansion/Total column. Letters whose tables are
    column-garbled by pdftotext, or that state no water table at all, are
    expected to miss - that miss RATE is the measurement.
    """
    rec: dict = {}
    m = re.search(r"Dat(?:ed|e)\s*:?\s*(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{4})", text[:1500])
    rec["ec_date"] = f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else None
    m = re.search(r"(EC\d\d[A-Z]\d{4}TN\d+[A-Z])", text)
    rec["ec_identification_no"] = m.group(1) if m else None

    wm = re.search(r"\n[^\n]{0,120}\bWATER\b[^\n]{0,120}\n", text)
    tail = text[wm.start():] if wm else ""
    end = re.search(r"PARKING|GREEN AREA|WASTE MANAGEMENT", tail)
    water = tail[: end.start()] if end else tail[:8000]
    rec["has_water_table"] = bool(wm) and "KLD" in water

    cons = re.search(r"Construction Phase(.{0,500}?)Operation Phase", water, re.S | re.I)
    if cons:
        m = re.search(r"Water\s*\n?\s*Requirement[^\d\n]*" + NUM, cons.group(1), re.I)
        rec["construction_water_kld"] = _num(m.group(1)) if m else None

    opm = re.search(r"Operation Phase", water, re.I)
    op = water[opm.end():] if opm else water
    op_lines = op.splitlines()

    def window(label: str, before: int = 1, after: int = 3) -> list[str]:
        """Lines around the first line matching label."""
        for i, line in enumerate(op_lines):
            if re.search(label, line, re.I):
                return op_lines[max(0, i - before): i + after + 1]
        # label wrapped across two lines ("Wastewater\nGeneration")
        parts = label.split(r"\s+")
        if len(parts) > 1:
            for i in range(len(op_lines) - 1):
                if re.search(parts[0], op_lines[i], re.I) and re.search(
                    parts[-1], op_lines[i + 1], re.I
                ):
                    return op_lines[max(0, i - before): i + after + 2]
        return []

    def nums_in(lines: list[str]) -> list[float]:
        out = []
        for line in lines:
            for tok in re.findall(NUM, line):
                v = _num(tok)
                # skip serial numbers (row indices are small integers at line
                # start) - crude but effective: keep everything, callers pick.
                out.append(v)
        return out

    def row(label: str, prefer_last: bool = False) -> float | None:
        """Value for a labelled row: strip row-index tokens, then take the
        first (single-value layout) or last (expansion layout: the
        After-Expansion/Total column is rightmost) remaining number."""
        lines = window(label)
        vals: list[float] = []
        for line in lines:
            body = re.sub(r"^\s*\(?[ivx]+[\.\)]|^\s*\d{1,2}\.?\s", " ", line)
            vals.extend(_num(t) for t in re.findall(NUM, body))
        if not vals:
            return None
        return vals[-1] if prefer_last else vals[0]

    expansion = bool(re.search(r"After\s*\n?\s*Expansion", op, re.I))
    rec["layout"] = "expansion" if expansion else "single"
    rec["operation_total_kld"] = row(r"Total\s+Water", prefer_last=expansion)
    rec["operation_fresh_kld"] = row(r"Fresh\s*water\s*(requirement)?", prefer_last=expansion)
    rec["wastewater_domestic_kld"] = row(r"Wastewater\s+Generation", prefer_last=expansion)
    rec["trade_effluent_kld"] = row(r"Trade\s+Effluent", prefer_last=expansion)
    rec["stp_capacity_kld"] = row(r"Capacity\s+of\s+STP|STP\s+Capacity", prefer_last=expansion)
    rec["etp_capacity_kld"] = row(r"Capacity\s+of\s+ETP|ETP\s+Capacity", prefer_last=expansion)
    return rec


def auto_records() -> dict[str, dict]:
    out = {}
    for row, _label in pilot_rows():
        no = row["proposalNo"]
        out[no] = parse_letter(pdf_text(no))
    return out


AUTO_FIELD_MAP = {
    "ec_date": lambda v: v.get("ec_date"),
    "operation_total_kld": lambda v: (v.get("operation") or {}).get("total_kld"),
    "operation_fresh_kld": lambda v: (v.get("operation") or {}).get("fresh_kld"),
    "wastewater_domestic_kld": lambda v: v.get("wastewater_domestic_kld"),
    "stp_capacity_kld": lambda v: v.get("stp_capacity_kld"),
}


def variance_report(auto: dict[str, dict]) -> tuple[list[dict], dict]:
    rows = []
    for no, _label in PILOT:
        v = VERIFIED[no]
        a = auto[no]
        if v["format"] == "no-water-table":
            klass = "absent"
            matches = {"ec_date": a.get("ec_date") == v.get("ec_date")}
        else:
            matches = {
                f: AUTO_FIELD_MAP[f](v) == a.get(f)
                for f in CORE_FIELDS
            }
            # a field the letter itself does not state cannot count against
            # the extractor
            applicable = {f: m for f, m in matches.items() if AUTO_FIELD_MAP[f](v) is not None}
            klass = "clean" if all(applicable.values()) else "manual"
            matches = applicable
        rows.append({"proposal_no": no, "format": v["format"], "class": klass, "auto_match": matches})
    stats = {
        "clean": sum(1 for r in rows if r["class"] == "clean"),
        "manual": sum(1 for r in rows if r["class"] == "manual"),
        "absent": sum(1 for r in rows if r["class"] == "absent"),
    }
    return rows, stats


def cmd_extract() -> None:
    auto = auto_records()
    rows, stats = variance_report(auto)
    for r in rows:
        misses = [f for f, ok in r["auto_match"].items() if not ok]
        print(f"{r['proposal_no']} | {r['format']:20} | {r['class']:6} | auto-misses: {misses or '-'}")
    print(
        f"\nFormat variance: {stats['clean']} clean auto-extract, "
        f"{stats['manual']} needed manual handling, {stats['absent']} no water table "
        f"(of {len(rows)} letters)"
    )


# ---------------------------------------------------------------------------
# Dataset build.
# ---------------------------------------------------------------------------

CLAIM_BASIS = (
    "All figures are PROPONENT-ASSERTED quantities as stated in the EC/EIA "
    "submission and restated in the SEIAA Tamil Nadu EC letter. They are "
    "regulatory filings, not measurements: nothing here is metered, audited, "
    "or independently verified. Several letters contain internal "
    "inconsistencies, which are preserved verbatim and flagged in checks/notes."
)


def sanity_checks(v: dict) -> dict:
    """Arithmetic sanity flags. Never alters values - only annotates."""
    checks: dict = {}
    op = v.get("operation") or {}
    total, fresh, rec = op.get("total_kld"), op.get("fresh_kld"), op.get("recycled_kld")
    purchased = op.get("purchased_treated_kld") or 0
    if total is not None and fresh is not None and rec is not None:
        s = fresh + rec + purchased
        if abs(s - total) <= max(0.5, 0.005 * total):
            checks["components_sum_to_total"] = "pass"
        else:
            checks["components_sum_to_total"] = (
                f"flag: fresh {fresh} + recycled {rec}"
                + (f" + purchased {purchased}" if purchased else "")
                + f" = {round(s, 2)} != stated total {total} (letter's own figures, kept verbatim)"
            )
    ww = v.get("wastewater_domestic_kld")
    te = v.get("trade_effluent_kld") or 0
    ww_all = v.get("wastewater_total_kld")
    effective_ww = ww_all if ww_all is not None else (ww + te if ww is not None else None)
    if effective_ww is not None and total is not None:
        if effective_ww <= total + 0.5:
            checks["wastewater_not_above_intake"] = "pass"
        else:
            checks["wastewater_not_above_intake"] = (
                f"flag: stated wastewater {effective_ww} > stated total intake {total}"
            )
    stp = v.get("stp_capacity_kld")
    if stp is not None and ww is not None:
        checks["stp_vs_sewage"] = (
            "pass"
            if ww <= stp
            else f"flag: stated sewage {ww} KLD exceeds stated STP capacity {stp} KLD"
        )
    etp = v.get("etp_capacity_kld")
    te_stated = v.get("trade_effluent_kld")
    if etp is not None and te_stated is not None:
        checks["etp_vs_trade_effluent"] = (
            "pass"
            if te_stated <= etp
            else f"flag: stated trade effluent {te_stated} KLD exceeds stated ETP capacity {etp} KLD"
        )
    if ww_all is not None:
        cap = (stp or 0) + (v.get("etp_capacity_kld") or 0)
        if cap >= ww_all:
            checks["treatment_capacity_vs_wastewater"] = "pass"
        else:
            checks["treatment_capacity_vs_wastewater"] = (
                f"flag: stated treatment capacity {cap} KLD (STP+ETP rows) below stated "
                f"wastewater {ww_all} KLD - the letter's table does not enumerate the "
                f"remaining treatment train"
            )
    return checks


def cmd_build() -> None:
    auto = auto_records()
    rows_by_no = {row["proposalNo"]: row for row, _ in pilot_rows()}
    variance_rows, stats = variance_report(auto)
    variance_by_no = {r["proposal_no"]: r for r in variance_rows}

    mismatches = []
    facilities = []
    for no, label in PILOT:
        v = VERIFIED[no]
        row = rows_by_no[no]
        var = variance_by_no[no]
        for f, ok in var["auto_match"].items():
            if not ok and AUTO_FIELD_MAP[f](v) is not None and auto[no].get(f) is not None:
                mismatches.append((no, f, auto[no].get(f), AUTO_FIELD_MAP[f](v)))
        fac = {
            "proposal_no": no,
            "label": label,
            "project_name": re.sub(r"\s+", " ", row["projectName"]).strip(),
            "proponent": v["proponent"],
            "sector": row["sector"],
            "category": row["category"],
            "status": row["proposalStatus"],
            "issuing_authority": row.get("issuing_authority"),
            "letter_type": v["letter_type"],
            "ec_identification_no": v.get("ec_identification_no"),
            "ec_date": v["ec_date"],
            "parent_ec": v.get("parent_ec"),
            "water": None,
            "notes": v.get("notes", []),
            "review": v.get("review", []),
            "checks": {},
            # Every record was read against the letter text on SNAPSHOT: the
            # water table transcribed field by field, the EC date and EC
            # identification number matched, and (for the six amendment /
            # corrigendum letters) the absence of any water table confirmed by
            # a zero-hit search for "KLD" across the whole letter.
            "verified": True,
            "verified_on": SNAPSHOT,
            "extraction": {
                "format": v["format"],
                "class": var["class"],
                "auto_match": var["auto_match"],
            },
            "provenance": {
                "source_id": "parivesh-seiaa-tn-ec",
                "as_of": v["ec_date"],
                "retrieved": SNAPSHOT,
                "certificate_url": cert_url(row),
            },
        }
        if v["format"] != "no-water-table":
            fac["water"] = {
                "construction_phase": v.get("construction"),
                "operation_phase": v.get("operation"),
                "wastewater_total_kld": v.get("wastewater_total_kld"),
                "wastewater_domestic_kld": v.get("wastewater_domestic_kld"),
                "trade_effluent_kld": v.get("trade_effluent_kld"),
                "stp_capacity_kld": v.get("stp_capacity_kld"),
                "etp_capacity_kld": v.get("etp_capacity_kld"),
                "water_source": v.get("water_source"),
                "reuse_note": v.get("reuse_note"),
                "rwh": v.get("rwh"),
                "groundwater_conditions": groundwater_conditions(pdf_text(no)),
            }
            fac["checks"] = sanity_checks(v)
        facilities.append(fac)

    if mismatches:
        print("AUTO vs VERIFIED disagreements on letter-stated core fields:")
        for no, f, a, m in mismatches:
            print(f"  {no} {f}: auto={a} verified={m}")

    doc = {
        "nvdm": "1.0",
        "dataset": "corridors/parivesh-ec-water",
        "scope": {"kind": "corridor", "id": "sriperumbudur"},
        "provenance": {
            "sources": [
                {
                    "id": "parivesh-seiaa-tn-ec",
                    "title": "Parivesh - Tamil Nadu Environmental Clearance proposals and SEIAA EC certificate letters",
                    "publisher": "SEIAA Tamil Nadu / MoEFCC (Parivesh portal)",
                    "url": "https://parivesh.nic.in/",
                    "license": (
                        "LICENCE UNVERIFIED - statutory Environmental Clearance letters that "
                        "the EIA Notification 2006 requires the regulator to publish, served "
                        "unauthenticated from parivesh.nic.in and cited with attribution. The "
                        "portal's terms-of-use page renders client-side and was NOT read, so "
                        "this is not a verified licence grant and is not cleared for "
                        "commercial reuse. Flagged in the registry entry."
                    ),
                    "as_of": SNAPSHOT,
                    "retrieved": SNAPSHOT,
                    "role": "asserts",
                }
            ],
            "method": "pdf-extract",
            "produced_at": SNAPSHOT,
            "produced_by": "scripts/fetch_parivesh_corridor_water.py",
            "note": (
                "Pilot extraction (19 EC letters, 13 with water tables) for the "
                "Sriperumbudur-Oragadam corridor. Discovery: full TN EC dump via the "
                "undocumented advanceSearchData API, filtered on corridor toponyms; "
                "certificate PDFs archived under scripts/.cache/parivesh/ (git-ignored). "
                "Verification method, 2026-07-31: every record was read field by field "
                "against the `pdftotext -layout` rendering of its letter, with the EC date "
                "and EC identification number matched and the six amendment/corrigendum "
                "letters confirmed water-free by a zero-hit search for 'KLD' across the "
                "whole letter. Where a table's labels and values are misaligned by the "
                "layout, the reading was settled by the letter's OWN component arithmetic "
                "(sub-rows reproducing a stated subtotal exactly), not by eyeballing; those "
                "cases are in the review list. The regex extractor's per-field agreement is "
                "recorded in extraction.auto_match."
            ),
            "conventions": {
                "claim_basis": CLAIM_BASIS,
                "units": "KLD (kilolitres per day) unless a text field quotes the letter otherwise",
                "phase": (
                    "construction_phase and operation_phase are stated separately by the "
                    "letters and are NEVER summed or conflated; expansion letters carry "
                    "the After-Expansion (granted end-state) column"
                ),
                "nulls": (
                    "null means the letter does not state the figure (or states only a "
                    "dash); values are never inferred, summed across phases, or "
                    "back-calculated"
                ),
                "groundwater_conditions": (
                    "detected per letter by exact-phrase match, never assumed - there is no "
                    "single 'standard' SEIAA groundwater condition. The CGWA "
                    "abstraction/dewatering condition appears in only 6 of the 13 "
                    "water-bearing letters; one letter (Vallam Phase I) carries no "
                    "groundwater monitoring condition at all. Absence in this list means the "
                    "phrase is absent from the letter, not that the obligation does not exist "
                    "elsewhere in law."
                ),
                "checks": (
                    "sanity checks annotate, never alter: 'pass' or a 'flag: ...' string "
                    "quoting the letter's own figures. A flag is a property of the filing, "
                    "not of the transcription"
                ),
            },
        },
        "as_of": SNAPSHOT,
        "format_variance": {
            "clean_auto_extract": stats["clean"],
            "needed_manual_handling": stats["manual"],
            "no_water_table": stats["absent"],
            "letters_total": len(facilities),
        },
        "facilities": facilities,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    n_water = sum(1 for f in facilities if f["water"])
    print(f"wrote {OUT.relative_to(ROOT)} ({len(facilities)} letters, {n_water} with water tables)")


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    if cmd == "discover":
        cmd_discover()
    elif cmd == "download":
        cmd_download()
    elif cmd == "extract":
        cmd_extract()
    elif cmd == "build":
        cmd_build()
    else:
        sys.exit(f"unknown command {cmd!r} (discover | download | extract | build)")


if __name__ == "__main__":
    main()

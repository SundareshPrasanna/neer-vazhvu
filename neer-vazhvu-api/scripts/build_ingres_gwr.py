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
"""

import argparse
import json
import sys
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
}

# Scope kinds must agree with schemas/nvdm/scopes.json or the artifact fails
# L2. Kolkata is a region (the KMA); Gurugram is a plain city.
SCOPE_KIND = {"kolkata": "region"}

CITIES = {
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
    units: dict[str, dict] = {}
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
        for r in real:
            raw = r.get("locationName") or ""
            # The portal upper-cases unit names before 2023-2024 and
            # title-cases after, and spells MAVAL as Mawal in 2025-2026 only.
            # Keyed on a normalised name, a single taluka would otherwise
            # split into two or three separate blocks with short histories.
            key = raw.strip().upper().replace("MAWAL", "MAVAL")
            cat = (r.get("category") or {}).get("total")
            # Served pre-computed on the fresh area - use as-is.
            stage = total_of(r.get("stageOfExtraction"))
            # Volumes must EXCLUDE poor-quality area to match CGWB. See fresh_of().
            avail = fresh_of(r.get("totalGWAvailability"))
            draft = r.get("draftData") or {}
            label = CLASS_LABEL.get(cat)
            if label is None or stage is None:
                # Not assessed on extraction this edition (the salinity /
                # poor-quality axis). Recorded, never silently dropped.
                print(
                    f"  ! {raw} {year}: category={cat!r} stage={stage!r}, skipped",
                    file=sys.stderr,
                )
                continue
            entry = units.setdefault(
                key,
                {"name": raw.strip().title(), "history": [], "_detail": []},
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
        if len(entry["history"]) < len(years_seen):
            first = entry["history"][0]["year_label"]
            block["history_caveat"] = (
                f"IN-GRES first assesses this unit separately in {first}; before "
                "that edition it is not published as its own assessment unit, so "
                "the series is short by construction rather than truncated."
            )
        blocks.append(block)
    blocks.sort(key=lambda b: b["name"])

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
            "note": (
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

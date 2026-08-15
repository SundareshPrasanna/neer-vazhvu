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
STATE_UUIDS = {
    "WESTBENGAL": "68ecabb4-0ea5-4909-b8e3-20bbaa7b91e8",
    "HARYANA": "648a95f6-9249-4c92-8ae4-a9d93eb7c898",
}

# Scope kinds must agree with schemas/nvdm/scopes.json or the artifact fails
# L2. Kolkata is a region (the KMA); Gurugram is a plain city.
SCOPE_KIND = {"kolkata": "region"}

CITIES = {
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
}

YEARS = ["2024-2025", "2023-2024", "2022-2023", "2021-2022"]


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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="kolkata", choices=sorted(CITIES))
    args = ap.parse_args()
    cfg = CITIES[args.city]

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

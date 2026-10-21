#!/usr/bin/env python3
"""
Jaipur's 150 wards as a table: number, zone, assembly seat, population and the
zone office's published lines. No ward geometry.

THERE IS NO WARD MAP TO JOIN TO. Nagar Nigam Jaipur's official 2025 ward map
(jaipurmc.org/PDF/wardmap.pdf) is a single raster image with no coordinates,
and no vector of the 2025 wards is published. So this file carries only what
the documents state per ward, and none of the geometry-derived sections
(centroid, area, water bodies, rivers, groundwater unit) that
build_ward_profiles.py joins for cities with a ward layer. The city config
keeps wardsVintage null until the wards are digitised or JMC/LSG release a
shapefile; then Jaipur moves into build_ward_profiles.py's CITIES and these
fields ride along.

SOURCES, per column of pipeline-inputs/jaipur/wards-2025.csv:
  * ward, population: LSG ward formation notification
    P.10(N.Pa.)(Gathan)(Chunav)DLB/25/19631 of 16 Sep 2025, Rajasthan Gazette
    Extraordinary Part 6(A), 20 Sep 2025. The text layer's Devanagari is
    broken; two extractions agree on 149 wards, ward 116 (24,725) was read
    from the page image. The census basis of the figures is not stated.
  * zone, assembly_constituency: JMC's corporators list (6 Oct 2026), which
    gives each ward's zone and heads each block with its assembly seat and
    ward range; the ranges match the legend of the official ward map. Zone
    names are JMC's own English, as in the Jaipur Samadhan zone list.
  * ZONE_OFFICES below: JMC's Administrative Directory, page 2, office
    column and email, read on the page image (Kruti Dev font). Zones where
    the directory lists only an officer's mobile get no entry: officer
    mobiles are never published here. Councillor names and parties are
    left out on purpose (not water data).

Output: public/data/jaipur-ward-profiles.json once both source ids are in
scripts/source-registry/; until then the same file goes to
.onboarding-state/build/wards/ without licence strings, and the run says so.

Run:  python3 neer-vazhvu-api/scripts/build_jaipur_ward_table.py
"""

import csv
import sys
from collections import Counter
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

INPUT = REPO_ROOT / "pipeline-inputs/jaipur/wards-2025.csv"
PUBLIC = REPO_ROOT / "public/data/jaipur-ward-profiles.json"
STAGING = REPO_ROOT / ".onboarding-state/build/wards/jaipur-ward-profiles.json"

GAZETTE_ID = "lsg-rajasthan-ward-gazette-2025"
JMC_ID = "jmc-jaipur-directory"
GAZETTE_PDF = (
    "https://jankalyanfile.rajasthan.gov.in/WebMyWayFiles/DepartmentMaster/215/"
    "2026/Apr/30409/215d6e328d5-119c-4158-9832-eb3610972b24.pdf"
)
CORPORATORS_PDF = "https://jaipurmc.org/PDF/Others/ParshadList_Jaiupr.pdf"
DIRECTORY_PDF = "https://jaipurmc.org/PDF/Others/jp_AdminContList.pdf"

# The gazette's population column summed (claim W03).
GAZETTE_TOTAL = 3197135

# Ward ranges per assembly seat: corporators list block headers and the ward
# map legend agree (claim W04).
ASSEMBLY_RANGES = [
    ("Vidhyadhar Nagar", 1, 22),
    ("Jhotwara", 23, 37),
    ("Sanganer", 38, 58),
    ("Bagru", 59, 72),
    ("Malviya Nagar", 73, 87),
    ("Civil Lines", 88, 103),
    ("Kishanpole", 104, 115),
    ("Adarsh Nagar", 116, 132),
    ("Hawa Mahal", 133, 147),
    ("Amer", 148, 150),
]

# The 13 zones in the Jaipur Samadhan zone list.
ZONES = {
    "Murlipura",
    "Vidyadhar Nagar",
    "Jhotwada",
    "Mansarovar",
    "Sanganer",
    "Jagatpura",
    "Malviya Nagar",
    "Hawamahal-Amer",
    "Civil Line",
    "Kishanpol",
    "Adarsh Nagar",
    "Vaishali Nagar",
    "Jhalana",
}

# Zone deputy commissioners' offices, JMC Administrative Directory p.2 (rows
# 17-29), saved 2026-10-20, read on the page image 2026-10-21.
ZONE_OFFICES = {
    "Malviya Nagar": {"phones": ["0141-2744697"]},
    "Sanganer": {
        "phones": ["0141-2733882", "0141-2730252"],
        "email": "dcsnz.jmc@rajasthan.gov.in",
    },
    "Adarsh Nagar": {"email": "dcaadarsh.lsg@rajasthan.gov.in"},
    "Kishanpol": {"email": "dckishanpole.lsg@rajasthan.gov.in"},
    "Vidyadhar Nagar": {
        "phones": ["0141-2302436"],
        "email": "dcvdz.jmc@rajasthan.gov.in",
    },
    "Mansarovar": {
        "phones": ["0141-2399016"],
        "email": "dcmsnz.jmc@rajasthan.gov.in",
    },
    "Civil Line": {"email": "dccivillines.lsg@rajasthan.gov.in"},
    "Hawamahal-Amer": {"email": "dchawamahal.lsg@rajasthan.gov.in"},
}


def assembly_of(ward: int) -> str:
    return next(n for n, a, b in ASSEMBLY_RANGES if a <= ward <= b)


def read_rows() -> list[dict]:
    with INPUT.open(encoding="utf-8", newline="") as f:
        rows = [
            {
                "ward_number": int(r["ward"]),
                "population": int(r["population_gazette_2025"]),
                "assembly": r["assembly_constituency"],
                "zone": r["zone"],
            }
            for r in csv.DictReader(f)
        ]
    wards = [r["ward_number"] for r in rows]
    if wards != list(range(1, 151)):
        raise SystemExit("wards-2025.csv must list wards 1 to 150 once each, in order")
    total = sum(r["population"] for r in rows)
    if total != GAZETTE_TOTAL:
        raise SystemExit(
            f"population sums to {total:,}, not the gazette's {GAZETTE_TOTAL:,}"
        )
    bad = [
        r["ward_number"] for r in rows if r["assembly"] != assembly_of(r["ward_number"])
    ]
    if bad:
        raise SystemExit(
            f"assembly seat disagrees with the published ward ranges: wards {bad}"
        )
    zones = Counter(r["zone"] for r in rows)
    if set(zones) != ZONES:
        raise SystemExit(f"zones differ from JMC's 13: {sorted(set(zones) ^ ZONES)}")
    return rows


def licence_or_none(source_id: str) -> str | None:
    try:
        return registry_license(source_id)
    except KeyError:
        return None


def main() -> int:
    rows = read_rows()
    lic = {sid: licence_or_none(sid) for sid in (GAZETTE_ID, JMC_ID)}
    registered = all(lic.values())

    wards = []
    for r in rows:
        ward = {
            "ward_number": r["ward_number"],
            "zone_name": r["zone"],
            "assembly_constituency": r["assembly"],
            "population": r["population"],
        }
        if r["zone"] in ZONE_OFFICES:
            ward["zone_office"] = ZONE_OFFICES[r["zone"]]
        wards.append(ward)

    sources = [
        {
            "id": GAZETTE_ID,
            "title": "Ward formation of Nagar Nigam Jaipur, 150 wards with population: "
            "LSG notification P.10(N.Pa.)(Gathan)(Chunav)DLB/25/19631 of 16 Sep 2025, "
            "Rajasthan Gazette Extraordinary Part 6(A), 20 Sep 2025",
            "publisher": "Local Self Government Department, Government of Rajasthan",
            "url": GAZETTE_PDF,
            "license": lic[GAZETTE_ID],
            "role": "asserts",
            "as_of": "2025-09-20",
            "retrieved": "2026-10-20",
        },
        {
            "id": JMC_ID,
            "title": "Nagar Nigam Jaipur corporators list (zone and assembly seat of each "
            "ward) and Administrative Directory (zone office lines and emails)",
            "publisher": "Nagar Nigam Jaipur (Jaipur Municipal Corporation)",
            "url": CORPORATORS_PDF,
            "license": lic[JMC_ID],
            "role": "asserts",
            "as_of": "2026-10-06",
            "retrieved": "2026-10-20",
        },
    ]
    # Staging copy: an unregistered source has no licence to mirror yet.
    sources = [{k: v for k, v in s.items() if v is not None} for s in sources]

    out = {
        "nvdm": "1.0",
        "dataset": "data-root/ward-profiles",
        "scope": {"kind": "city", "id": "jaipur"},
        "provenance": {
            "sources": sources,
            "method": "pdf-extract",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_jaipur_ward_table.py",
            "note": [
                "A ward table, not ward geometry: the official 2025 ward map is a raster "
                "image without coordinates, so no ward has a centroid, an area or any "
                "layer joined to it.",
                "Population is the 2025 ward notification's figure; the notification "
                "does not state its census basis.",
                "Zone office lines and emails from JMC's Administrative Directory, page 2 "
                f"({DIRECTORY_PDF}); zones it lists only with an officer's mobile carry "
                "none. No councillor names or parties.",
            ],
        },
        "wards": wards,
    }
    path = PUBLIC if registered else STAGING
    path.parent.mkdir(parents=True, exist_ok=True)
    write_artifact(path, out)
    with_office = sum(1 for w in wards if "zone_office" in w)
    print(
        f"jaipur: {len(wards)} wards in {len({w['zone_name'] for w in wards})} zones, "
        f"population {GAZETTE_TOTAL:,}; {with_office} wards with a zone office contact "
        f"-> {path.relative_to(REPO_ROOT)}",
        file=sys.stderr,
    )
    if not registered:
        missing = ", ".join(sid for sid, v in lic.items() if v is None)
        print(
            f"STAGED, not published: register {missing} in scripts/source-registry/jaipur.json",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

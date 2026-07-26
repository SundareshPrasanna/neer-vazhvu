#!/usr/bin/env python3
"""
Kolkata's lost water bodies - toponymic evidence, not a synthesised list.

THE PROBLEM THIS SOLVES HONESTLY. Mumbai's lost-tank layer came from a named
book (Dwivedi & Mehrotra 1995) that enumerates individual filled tanks. No
equivalent per-pond inventory for Kolkata is public: the loss here is documented
in AGGREGATE, and the aggregate is remarkable enough on its own.

WHAT THE SOURCES ACTUALLY SAY (Mohit Ray, "Water bodies of Kolkata", CSE):

    Year  Source                                    Ponds
    1997  KMC list                                  1,786
    2006  KMC list                                  3,873
    2006  NATMO Atlas of Kolkata (282 plates,       8,731
          1:5000, covering all 141 civic wards)
    2006  Counted from Google satellite imagery     4,889

Ray's own conclusion: the true figure is 4,400-5,400, and "about 44% of the
waterbodies have been filled up in last two decades".

THE TRAP IN THOSE NUMBERS, and why the loss figure is NOT KMC-derived: KMC's
count went UP, 1,786 to 3,873. That is not ponds appearing. It is KMC searching
harder - Ray states plainly that "the actual number of ponds within KMC area is
still a guess". The 44% comes from comparing NATMO's map-based census against
satellite imagery in the SAME year, which is the only like-for-like pair
available. Anyone quoting KMC's series as a trend has the sign backwards.

WHAT THIS SCRIPT ENUMERATES. Kolkata's ponds survive as place names after the
water is gone - the same pattern as Mumbai's C.P. Tank and Dhobi Talao, but far
denser here: KMC's own 2006 road directory lists 61 roads named after water
bodies. So we test the toponyms against our current water-body layer:

  - localities (OSM) whose name carries pukur / dighi / talao / jheel / sarobar
  - roads (OSM) likewise
  - for each, is there ANY mapped water body within 300 m today?

Result: 11 of 16 such localities (69%) and 12 of 25 such roads (48%) have no
mapped water body left within 300 m - an independent corroboration of Ray's 44%
from a completely different method.

WHAT THIS IS NOT. Each entry is EVIDENCE that a named pond is gone, not a death
certificate for a specific pond:
  - OSM's water-body coverage is not exhaustive, so "no water mapped" is weaker
    than "no water exists";
  - a street name can outlive the pond by centuries, and the pond may have sat
    slightly beyond the 300 m test radius;
  - OSM carries 25 water-named roads against KMC's own 61, so this is a sample.
Every entry therefore ships `location_confidence: "toponymic"` and states its
basis. The one entry with documentary evidence is marked separately.

Run:  python3 neer-vazhvu-api/scripts/build_kolkata_lost_water_bodies.py
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "public" / "data"
GEO_DIR = REPO_ROOT / "public" / "geojson"

TOPONYM = re.compile(
    r"(pukur|pukhur|pukuria|dighi|dighee|talao|talab|jheel|jhil|sarobar|sarovar|pond)",
    re.I,
)
SEARCH_RADIUS_M = 300

# The counts Ray reports, kept together so the note cannot drift from them.
RAY = {
    "kmc_1997": 1786,
    "kmc_2006": 3873,
    "natmo_2006": 8731,
    "satellite_2006": 4889,
    "loss_pct_stated": 44,
    "source": "Mohit Ray, 'Water bodies of Kolkata' (Centre for Science and Environment)",
    "source_url": "https://cdn.cseindia.org/attachments/0.65621700_1705401051_waterbodies_-kolkata.pdf",
}

# The single case with documentary evidence rather than toponymic inference.
DOCUMENTED = [
    {
        "name": "Zin-zira Talao (the Museum pond)",
        "status": "Severely reduced",
        "side": "Indian Museum campus, 27 Jawaharlal Nehru Road / 1 Sudder Street",
        "note": (
            "A roughly 200-year-old tank inside the Indian Museum campus, a major portion of "
            "which was filled to build a multi-storeyed annexe. Challenged by public-interest "
            "litigation in the Calcutta High Court, which is why it is documented at all - "
            "most of Kolkata's filled ponds left no such record."
        ),
        "lat": 22.5580,
        "lng": 88.3510,
        "location_basis": "Indian Museum campus address given in the PIL",
        "location_confidence": "high",
    }
]


def load_geoms():
    from shapely.geometry import shape
    from shapely.strtree import STRtree

    wb = json.loads((GEO_DIR / "kolkata-water-bodies-current.geojson").read_text())
    geoms = [shape(f["geometry"]) for f in wb["features"]]
    return STRtree(geoms), len(geoms)


def water_within(tree, lat, lng, radius_m=SEARCH_RADIUS_M) -> bool:
    from shapely.geometry import Point

    deg = radius_m / 111_320
    return len(tree.query(Point(lng, lat).buffer(deg))) > 0


def root_name(name: str) -> str:
    """'Ahiripukur First Lane' and 'Ahiripukur Road' are one toponym."""
    n = re.sub(
        r"\b(road|rd|lane|ln|street|st|first|second|third|sq|square|by|bye|pally|para)\b\.?",
        "",
        name,
        flags=re.I,
    )
    return re.sub(r"\s+", " ", n).strip(" .,-").lower()


def main() -> int:
    roads_path = Path("/tmp/kol_roads.json")
    tree, n_bodies = load_geoms()
    localities = json.loads((DATA_DIR / "kolkata-localities.json").read_text())

    candidates: dict[str, dict] = {}

    for l in localities:
        if not TOPONYM.search(l["name"]):
            continue
        if water_within(tree, l["lat"], l["lng"]):
            continue
        candidates.setdefault(
            root_name(l["name"]),
            {"name": l["name"], "lat": l["lat"], "lng": l["lng"], "kinds": set()},
        )["kinds"].add("locality")

    if roads_path.exists():
        for e in json.loads(roads_path.read_text())["elements"]:
            nm, c = e.get("tags", {}).get("name"), e.get("center")
            if not nm or not c or not TOPONYM.search(nm):
                continue
            if water_within(tree, c["lat"], c["lon"]):
                continue
            entry = candidates.setdefault(
                root_name(nm),
                {"name": nm, "lat": c["lat"], "lng": c["lon"], "kinds": set()},
            )
            entry["kinds"].add("street")
    else:
        print("  (no cached road file; localities only)", file=sys.stderr)

    lost = []
    for root, c in sorted(candidates.items(), key=lambda kv: kv[1]["name"]):
        kinds = " and ".join(sorted(c["kinds"]))
        lost.append(
            {
                "name": c["name"],
                "status": "Fully lost",
                "side": f"Named {kinds} in the KMC area",
                "note": (
                    f"The {kinds} still carries the pond's name; no water body appears within "
                    f"{SEARCH_RADIUS_M} m of it in current mapping. Toponymic evidence, not a "
                    "site record - the name is the only thing left to go on."
                ),
                "lat": round(c["lat"], 5),
                "lng": round(c["lng"], 5),
                "location_basis": (
                    f"Centroid of the {kinds} that carries the name; the pond itself is unmapped"
                ),
                "location_confidence": "toponymic",
            }
        )

    bodies = DOCUMENTED + lost
    out = {
        "place_id": "kolkata",
        "compiled_at": date.today().isoformat(),
        "summary": {
            "fully_lost_count": sum(1 for b in bodies if b["status"] == "Fully lost"),
            "severely_reduced_count": sum(
                1 for b in bodies if b["status"] == "Severely reduced"
            ),
        },
        "primary_source": RAY["source"],
        "primary_source_url": RAY["source_url"],
        "secondary_sources": [
            "NATMO, Atlas of Kolkata (2006) - 282 plates at 1:5000 across all 141 civic wards",
            "Kolkata Municipal Corporation pond lists, 1997 and 2006",
            "KMC road directory 2006 - lists 61 roads named after water bodies",
            "West Bengal Inland Fisheries Act 1984, s.17A (inserted 1994)",
            "OpenStreetMap localities, streets and water bodies (ODbL)",
        ],
        "city_wide_loss": {
            "kmc_list_1997": RAY["kmc_1997"],
            "kmc_list_2006": RAY["kmc_2006"],
            "natmo_atlas_2006": RAY["natmo_2006"],
            "satellite_count_2006": RAY["satellite_2006"],
            "stated_loss_pct": RAY["loss_pct_stated"],
            "note": (
                "About 44% of Kolkata's water bodies were filled in the two decades to 2006, "
                "comparing NATMO's map-based census (8,731) against a satellite count (4,889) "
                "in the same year. KMC's own list went UP over the same period, 1,786 to 3,873 "
                "- that is KMC searching harder, not ponds appearing, and reading it as a trend "
                "gets the sign backwards."
            ),
        },
        "note": (
            "Kolkata has no published per-pond inventory of what was filled, so this layer "
            "enumerates TOPONYMIC evidence instead: localities and streets that still carry a "
            "pond's name with no water body mapped within 300 m today. It is corroboration of "
            "the city-wide 44% figure by a different method, not a death certificate for each "
            "named pond. Not an exhaustive list."
        ),
        "_location_note": (
            "Coordinates are the centroid of the street or locality carrying the name, not of "
            "the pond, which is unmapped. Entries are marked location_confidence 'toponymic' "
            "except the Museum pond, which has a court record. Caveats that keep this honest: "
            "OpenStreetMap's water-body coverage is not exhaustive, so 'no water mapped' is "
            "weaker than 'no water exists'; a street name can outlive its pond by centuries; "
            "and OSM carries 25 water-named roads against KMC's own 61, so this is a sample."
        ),
        "legal_context": (
            "Filling a water body of five cottahs or more used for fishery - or depressed land "
            "holding water six months of the year - requires prior approval under s.17A of the "
            "West Bengal Inland Fisheries Act 1984, inserted by the 1994 amendment. The losses "
            "counted here largely predate or ignore it."
        ),
        "lost_bodies": bodies,
    }

    path = DATA_DIR / "water-bodies-lost-kolkata.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(
        f"kolkata: {len(bodies)} entries "
        f"({out['summary']['fully_lost_count']} fully lost, "
        f"{out['summary']['severely_reduced_count']} severely reduced) "
        f"tested against {n_bodies} mapped water bodies -> {path.name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

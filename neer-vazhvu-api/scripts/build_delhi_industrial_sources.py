#!/usr/bin/env python3
"""Build public/data/industrial-sources-delhi.json.

Delhi's industrial layer, in the same shape as industrial-sources-bangalore /
-mumbai / -madurai so the rivers page and the ward `industrial` section pick it
up with no new component.

TWO TYPES, DELIBERATELY
  industrial_estate  named industrial areas inside the NCT, so `zone_count`
                     means the same thing it means for Bengaluru
  cetp               the 13 Common Effluent Treatment Plants, which are the
                     evidence layer: DPCC publishes each plant's design
                     capacity and MEASURED monthly inflow, and the gap between
                     them says how much industrial effluent reaches treatment
                     at all. That is the closest Delhi gets to attribution,
                     because DPCC's only public consent register ends in 2002.

COORDINATE PROVENANCE - read before trusting a marker
  No CETP is mapped in OpenStreetMap. Every plant coordinate here is the
  location of the industrial area or locality the plant serves, NOT a surveyed
  plant position, and each entry records which. `location_precision` is one of
    industrial_area  the named industrial-area polygon centroid (best)
    locality         the suburb/neighbourhood node (approximate)
    road             a named road in the estate (roughest)
    none             not locatable from OSM - carried without coordinates
  SMA CETP is the one plant with no coordinate: neither "SMA Industrial Area"
  nor "Shahzada Bagh" is in OSM. It keeps its flow series and is excluded from
  the map rather than being placed by guesswork.

Run: python scripts/build_delhi_industrial_sources.py
"""

from __future__ import annotations

import json
import statistics
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
FLOWS = REPO / "public/data/delhi-cetp-flows.json"
OUT = REPO / "public/data/industrial-sources-delhi.json"

OSM_ATTRIB = "OpenStreetMap contributors (ODbL), via Overpass"

# ── The 13 CETPs. Coordinates sourced individually from OSM; see the module
# docstring on what each precision level means. Design capacities come from
# DPCC's own report headers (extracted, not hand-typed) and are filled in from
# the flow series at build time, so this table never disagrees with the source.
CETPS = [
    (
        "Wazirpur",
        28.6994,
        77.1667,
        "industrial_area",
        "OSM locality 'Wazirpur Industrial Area'",
    ),
    ("Bawana", 28.7920, 77.0533, "industrial_area", "OSM 'Bawana Industrial Area'"),
    (
        "Badli",
        28.7464,
        77.1313,
        "industrial_area",
        "OSM 'Badli Industrial Area Phase 2'",
    ),
    (
        "G.T. Karnal Road",
        28.6951,
        77.1858,
        "industrial_area",
        "OSM 'GT Karnal Road Industrial Area'",
    ),
    (
        "Mayapuri",
        28.6293,
        77.1263,
        "industrial_area",
        "OSM 'Mayapuri Industrial Area 1'",
    ),
    (
        "Naraina",
        28.6321,
        77.1371,
        "industrial_area",
        "OSM 'Naraina Industrial Area - I'",
    ),
    ("Narela", 28.8298, 77.1030, "industrial_area", "OSM 'Narela Industrial Complex'"),
    (
        "Okhla",
        28.5364,
        77.2748,
        "industrial_area",
        "OSM 'Okhla Phase - II' (of three phases)",
    ),
    ("Nangloi", 28.6787, 77.0672, "locality", "OSM locality 'Nangloi'"),
    ("Jhilmil", 28.6698, 77.3073, "locality", "OSM neighbourhood 'Jhilmil Colony'"),
    ("Mangolpuri", 28.6837, 77.0915, "locality", "OSM 'Mangolpuri'"),
    ("Lawrence Road", 28.6928, 77.1582, "road", "OSM highway 'Lawrence Road'"),
    (
        "SMA Industrial Area",
        None,
        None,
        "none",
        "not in OSM under 'SMA' or 'Shahzada Bagh'",
    ),
]

# ── Named industrial estates inside the NCT, from Overpass and filtered by
# point-in-ward so Noida/Gurgaon/Kundli parcels are excluded. Deduplicated by
# hand where OSM carries two spellings of one estate (Mayapuri "1" vs "I").
ESTATES = [
    ("Anand Parvat Industrial Area", 28.6643, 77.1758),
    ("Badli Industrial Area Phase 2", 28.7464, 77.1313),
    ("Bawana Industrial Area", 28.7920, 77.0533),
    ("DLF Industrial Area", 28.6567, 77.1426),
    ("Doctor Lohia Industrial Area", 28.6809, 77.1470),
    ("GT Karnal Road Industrial Area", 28.6951, 77.1858),
    ("Kirti Nagar Industrial Area", 28.6507, 77.1467),
    ("Mayapuri Industrial Area I", 28.6293, 77.1263),
    ("Mayapuri Industrial Area II", 28.6187, 77.1183),
    ("Moti Nagar Industrial Area", 28.6573, 77.1485),
    ("Mundka Industrial Area", 28.6834, 77.0171),
    ("Naraina Industrial Area I", 28.6321, 77.1371),
    ("Naraina Industrial Area II", 28.6444, 77.1460),
    ("Narela Industrial Complex", 28.8298, 77.1030),
    ("Okhla Industrial Area Phase I", 28.5239, 77.2790),
    ("Okhla Industrial Area Phase II", 28.5364, 77.2748),
    ("Okhla Industrial Area Phase III", 28.5514, 77.2702),
    ("Patparganj Industrial Area", 28.6209, 77.2874),
    ("Rajasthani Udyog Nagar", 28.7259, 77.1597),
    ("Tilak Nagar Industrial Area", 28.6417, 77.1048),
    ("Udyog Nagar", 28.6810, 77.0808),
    ("Wazirpur Industrial Area", 28.6994, 77.1667),
]

# Which drain/river each estate's effluent reaches. Only filled where the
# DPCC drain monitoring or the CETP's own outfall makes it documented; left
# empty rather than inferred from proximity.
RIVERS = {
    "Wazirpur": ["yamuna"],
    "Okhla": ["yamuna"],
    "Naraina": ["najafgarh"],
    "Mayapuri": ["najafgarh"],
    "Bawana": ["najafgarh"],
    "Narela": ["najafgarh"],
    "Nangloi": ["najafgarh"],
    "Mangolpuri": ["najafgarh"],
    "Jhilmil": ["yamuna"],
}


def slug(name: str) -> str:
    return "dl-" + "".join(c if c.isalnum() else "-" for c in name.lower()).strip(
        "-"
    ).replace("--", "-")


def main() -> None:
    flows = json.loads(FLOWS.read_text())
    readings = flows["readings"]

    by_plant: dict[str, list[dict]] = {}
    for r in readings:
        if r.get("plant"):
            by_plant.setdefault(r["plant"], []).append(r)

    sources = []

    for name, lat, lng, precision, prov in CETPS:
        rows = by_plant.get(name, [])
        with_flow = [r for r in rows if r.get("measured_flow_mld") is not None]
        design = (
            statistics.mode([r["design_capacity_mld"] for r in rows]) if rows else None
        )
        util = None
        latest = None
        if with_flow and design:
            latest = max(with_flow, key=lambda r: r["month"])
            # MEDIAN, not mean: a single mis-OCR'd flow would drag a mean and there
            # is no way to hand-check 628 readings. The median is the typical month.
            mean_flow = statistics.median(r["measured_flow_mld"] for r in with_flow)
            util = round(mean_flow / design * 100, 1)

        entry = {
            "id": slug(name + " cetp"),
            "name": f"{name} CETP",
            "type": "cetp",
            "lat": lat,
            "lng": lng,
            "operator": "Delhi Pollution Control Committee (monitoring); plant operated by the industrial-area society",
            "rivers_affected": RIVERS.get(name, []),
            "pollutants": ["industrial_effluent", "cod", "bod", "heavy_metals"],
            "design_capacity_mld": design,
            "median_utilisation_pct": util,
            "months_observed": len(rows),
            "latest_month": latest["month"] if latest else None,
            "latest_flow_mld": latest["measured_flow_mld"] if latest else None,
            "location_precision": precision,
            "location_source": prov,
            "description": (
                f"Common effluent treatment plant for the {name} industrial area. "
                + (
                    f"Design capacity {design:g} MLD; measured inflow averaged "
                    f"{util:g}% of it across {len(with_flow)} monitored months "
                    f"(DPCC, {flows['summary']['period']}). Utilisation well under 100% means "
                    "industrial effluent is not reaching the works."
                    if util is not None and design
                    else "No usable flow readings recovered from the DPCC archive."
                )
            ),
        }
        if lat is None:
            entry["_data_status"] = "not_located"
            entry["_data_status_note"] = (
                "Flow series retained; excluded from the map because the plant's "
                "industrial area is not in OpenStreetMap. Not placed by guesswork."
            )
        sources.append(entry)

    for name, lat, lng in ESTATES:
        sources.append(
            {
                "id": slug(name),
                "name": name,
                "type": "industrial_estate",
                "lat": lat,
                "lng": lng,
                "operator": "DSIIDC / estate associations",
                "rivers_affected": [],
                "pollutants": ["industrial_effluent"],
                "location_precision": "industrial_area",
                "location_source": f"{OSM_ATTRIB}, named landuse=industrial or place polygon",
                "description": (
                    "Named industrial estate inside the NCT. Counted in the ward "
                    "industrial zone count; effluent load is not separately published "
                    "per estate."
                ),
            }
        )

    located = [s for s in sources if s.get("lat") is not None]
    doc = {
        "last_updated": "2026-07-26",
        "source": (
            "CETP design capacity and measured flow: Delhi Pollution Control Committee "
            "monthly analysis reports (OCR-extracted, see delhi-cetp-flows.json). "
            f"Locations: {OSM_ATTRIB}."
        ),
        "_note": (
            "Delhi's industrial layer carries two types. `industrial_estate` are named "
            "industrial areas, so the per-ward zone count means what it means in other "
            "cities. `cetp` are the 13 common effluent treatment plants, which carry the "
            "evidence: DPCC publishes each plant's design capacity and measured monthly "
            "inflow, and the shortfall between them is how much industrial effluent never "
            "reaches treatment. Delhi has no current per-unit register of polluters - "
            "DPCC's only public consent list ends in July 2002 - so this layer measures "
            "the treatment gap, not individual dischargers, and should not be read as a "
            "census of industry."
        ),
        "_coordinates": (
            "No CETP is mapped in OpenStreetMap. Plant markers sit on the industrial area "
            "or locality each plant serves, never a surveyed plant position; every entry "
            "records `location_precision` (industrial_area / locality / road / none). "
            "SMA CETP has no coordinate at all and is excluded from the map."
        ),
        "_archival": (
            "NOT a live feed. The DPCC CETP series ends November 2024. Surfaces showing "
            "these numbers must say so next to the figure."
        ),
        "summary": {
            "cetps": sum(1 for s in sources if s["type"] == "cetp"),
            "cetps_located": sum(
                1 for s in sources if s["type"] == "cetp" and s.get("lat")
            ),
            "industrial_estates": sum(
                1 for s in sources if s["type"] == "industrial_estate"
            ),
            "total_located": len(located),
        },
        "sources": sources,
    }
    OUT.write_text(json.dumps(doc, indent=2) + "\n")

    s = doc["summary"]
    print(f"wrote {OUT.relative_to(REPO)}")
    print(
        f"  CETPs {s['cetps']} ({s['cetps_located']} located) | estates {s['industrial_estates']}"
    )
    print(f"  total mappable points: {s['total_located']}")
    print("\n  plant utilisation (median month, worst first):")
    for e in sorted(
        (x for x in sources if x["type"] == "cetp"),
        key=lambda x: (
            x["median_utilisation_pct"] is None,
            x["median_utilisation_pct"] or 0,
        ),
    ):
        u = e["median_utilisation_pct"]
        print(
            f"    {e['name'][:26]:<26} design={e['design_capacity_mld'] or '?':>5} "
            f"util={(f'{u:g}%' if u is not None else 'n/a'):>7}  months={e['months_observed']}"
        )


if __name__ == "__main__":
    main()

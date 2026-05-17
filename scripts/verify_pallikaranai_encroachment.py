"""
Quick verification: count Google Open Buildings v3 footprints inside
Pallikaranai's TNSWA gazetted boundary, OSM ecological boundary, the
TNSWA-OSM "lost marsh character" gap, and the 1 km NGT buffer.

Output: public/data/rich-bodies/pallikaranai-open-buildings-verification.json

Why: turns the polygon-math comparison into a concrete encroachment number.
Polygon math says "233 ha gap inside gazette where OSM no longer maps
marsh." This script answers: of that 233 ha, how much is actually built?

Usage:
    cd neer-vazhvu-api
    python ../scripts/verify_pallikaranai_encroachment.py
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from shapely.geometry import shape
from shapely.ops import unary_union

# Load env (GEE creds)
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "neer-vazhvu-api" / ".env")

import ee  # noqa: E402

OPEN_BUILDINGS_COLLECTION = "GOOGLE/Research/open-buildings/v3/polygons"

# Open Buildings v3 confidence bands (per published methodology)
CONFIDENCE_BANDS = [
    ("high", 0.75, 1.0),
    ("medium", 0.65, 0.75),
    ("low", 0.5, 0.65),
]


def init_ee() -> None:
    project = os.environ["GEE_CLOUD_PROJECT"]
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    with open(key_file) as f:
        client_email = json.load(f)["client_email"]
    creds = ee.ServiceAccountCredentials(client_email, key_file=key_file)
    ee.Initialize(credentials=creds, project=project)
    print(f"GEE initialised: project={project}")


def load_geom(path: Path):
    with open(path) as f:
        gj = json.load(f)
    return unary_union([shape(f["geometry"]) for f in gj["features"]])


def shapely_to_ee(geom) -> ee.Geometry:
    return ee.Geometry(json.loads(json.dumps(geom.__geo_interface__)))


def summarise_buildings(name: str, ee_geom: ee.Geometry) -> dict:
    """Filter Open Buildings v3 to a polygon and return count + area + confidence breakdown."""
    print(f"\n[{name}]")
    buildings = ee.FeatureCollection(OPEN_BUILDINGS_COLLECTION).filterBounds(ee_geom)

    # Tight intersection so partial-overlap buildings aren't double-counted into wrong zones
    contained = buildings.filter(ee.Filter.contains(".geo", ee_geom).Not()).filter(
        ee.Filter.intersects(".geo", ee_geom)
    )

    # We actually want: buildings whose centroid is inside the region
    # (simpler + cheaper than the contains/intersects dance above)
    centroid_inside = buildings.map(
        lambda f: f.set("centroid_in", ee_geom.contains(f.geometry().centroid(1), 1))
    ).filter(ee.Filter.eq("centroid_in", True))

    count = centroid_inside.size().getInfo()
    print(f"  buildings (centroid inside): {count}")

    if count == 0:
        return {
            "region": name,
            "building_count": 0,
            "building_area_m2_sum": 0,
            "building_area_ha": 0.0,
            "by_confidence": {b[0]: 0 for b in CONFIDENCE_BANDS},
        }

    area_sum = centroid_inside.aggregate_sum("area_in_meters").getInfo()
    print(f"  total building area: {area_sum:,.0f} m² ({area_sum/10000:.2f} ha)")

    band_counts = {}
    for label, lo, hi in CONFIDENCE_BANDS:
        band = centroid_inside.filter(ee.Filter.gte("confidence", lo)).filter(
            ee.Filter.lt("confidence", hi)
        )
        c = band.size().getInfo()
        band_counts[label] = c
        print(f"  confidence {label} ({lo:.2f}-{hi:.2f}): {c}")

    return {
        "region": name,
        "building_count": count,
        "building_area_m2_sum": area_sum,
        "building_area_ha": round(area_sum / 10000, 2),
        "by_confidence": band_counts,
    }


def main() -> None:
    init_ee()

    base = ROOT / "public/geojson/rich-bodies"
    tnswa = load_geom(base / "pallikaranai.geojson")
    osm = load_geom(base / "pallikaranai-osm-ecological.geojson")
    buffer = load_geom(base / "pallikaranai-buffer-1000m.geojson")

    # Derive the comparison polygons
    gap_tnswa_minus_osm = tnswa.difference(osm)
    intersection = tnswa.intersection(osm)
    halo_buffer_minus_tnswa = buffer.difference(tnswa)

    regions = [
        ("TNSWA gazetted (full)", shapely_to_ee(tnswa), tnswa.area),
        ("OSM ecological (full)", shapely_to_ee(osm), osm.area),
        ("Intersection (both agree)", shapely_to_ee(intersection), intersection.area),
        ("Gap: TNSWA - OSM (legally protected, no longer marsh)", shapely_to_ee(gap_tnswa_minus_osm), gap_tnswa_minus_osm.area),
        ("Halo: 1km buffer - TNSWA (NGT no-build zone)", shapely_to_ee(halo_buffer_minus_tnswa), halo_buffer_minus_tnswa.area),
    ]

    results = []
    for label, ee_geom, raw_area in regions:
        summary = summarise_buildings(label, ee_geom)
        # raw_area is degrees² from shapely; not useful here. Compute proper area:
        utm_area_ha = ee_geom.area(1).getInfo() / 10000
        summary["region_area_ha"] = round(utm_area_ha, 2)
        summary["built_up_fraction_pct"] = (
            round(100 * summary["building_area_ha"] / utm_area_ha, 2)
            if utm_area_ha > 0
            else 0.0
        )
        results.append(summary)

    payload = {
        "body_id": "pallikaranai",
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "data_source": {
            "dataset": OPEN_BUILDINGS_COLLECTION,
            "license": "CC-BY-4.0",
            "version": "v3 (released June 2023)",
            "method": "Google's tree-based segmentation of high-res satellite imagery",
            "known_limitations": [
                "May under-detect low-rise informal structures in dense slum geometry",
                "Confidence < 0.5 buildings excluded by default",
                "Footprint dates are approximate; v3 reflects state around 2023",
            ],
        },
        "regions": results,
        "headline_for_v0": _build_headline(results),
    }

    out_path = ROOT / "public/data/rich-bodies/pallikaranai-open-buildings-verification.json"
    out_path.write_text(json.dumps(payload, indent=2))
    print(f"\nWrote {out_path}")
    print("\n=== Headline ===")
    for line in payload["headline_for_v0"]:
        print(f"  {line}")


def _build_headline(results: list[dict]) -> list[str]:
    by_region = {r["region"]: r for r in results}
    gap = by_region["Gap: TNSWA - OSM (legally protected, no longer marsh)"]
    gazette = by_region["TNSWA gazetted (full)"]
    halo = by_region["Halo: 1km buffer - TNSWA (NGT no-build zone)"]
    return [
        f"Inside the gazetted Ramsar boundary: {gazette['building_count']:,} buildings "
        f"covering {gazette['building_area_ha']:.0f} ha "
        f"({gazette['built_up_fraction_pct']:.1f}% of the {gazette['region_area_ha']:.0f} ha gazette).",
        f"Inside the 233 ha 'lost marsh character' gap: {gap['building_count']:,} buildings "
        f"covering {gap['building_area_ha']:.0f} ha "
        f"({gap['built_up_fraction_pct']:.1f}% of the gap).",
        f"Inside the NGT 1 km no-build halo: {halo['building_count']:,} buildings "
        f"covering {halo['building_area_ha']:.0f} ha "
        f"({halo['built_up_fraction_pct']:.1f}% of the {halo['region_area_ha']:.0f} ha halo).",
    ]


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)

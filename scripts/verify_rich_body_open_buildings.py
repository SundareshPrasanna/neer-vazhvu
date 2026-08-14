"""
Count Google Open Buildings v3 footprints inside the zones of a
rich-data water body.

Generic across rich bodies via --body-id. Zones come from
_rich_body_zones.load_body_zones (Pallikaranai-style 4-zone or
Sholavaram-style 2-zone depending on whether the body has a
separate OSM ecological boundary).

Output: public/data/rich-bodies/<body_id>-open-buildings-verification.json

Usage:
    python scripts/verify_rich_body_open_buildings.py --body-id pallikaranai
    python scripts/verify_rich_body_open_buildings.py --body-id sholavaram

Originally focused on Pallikaranai (the analysis that turned the
233 ha TNSWA-OSM gap into a quotable encroachment number). Now used
for every rich body. Open Buildings v3 is a 2023 snapshot - we keep
this as a baseline cross-check; Overture (run by
verify_rich_body_overture_buildings.py) is the current-primary
source for the UI.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from registry_license import registry_license
from nvdm_write import write_artifact

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "neer-vazhvu-api" / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import ee  # noqa: E402
from _rich_body_zones import load_body_zones, ZONE_BODY, ZONE_HALO  # noqa: E402

OPEN_BUILDINGS_COLLECTION = "GOOGLE/Research/open-buildings/v3/polygons"

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


def shapely_to_ee(geom) -> ee.Geometry:
    return ee.Geometry(json.loads(json.dumps(geom.__geo_interface__)))


def summarise_buildings(name: str, ee_geom: ee.Geometry) -> dict:
    print(f"\n[{name}]")
    buildings = ee.FeatureCollection(OPEN_BUILDINGS_COLLECTION).filterBounds(ee_geom)
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
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-id", required=True)
    ap.add_argument("--buffer-m", type=int, default=1000)
    args = ap.parse_args()

    init_ee()

    zones = load_body_zones(ROOT, args.body_id, buffer_metres=args.buffer_m)

    results = []
    for name, geom in zones.items():
        ee_geom = shapely_to_ee(geom)
        summary = summarise_buildings(name, ee_geom)
        utm_area_ha = ee_geom.area(1).getInfo() / 10000
        summary["region_area_ha"] = round(utm_area_ha, 2)
        summary["built_up_fraction_pct"] = (
            round(100 * summary["building_area_ha"] / utm_area_ha, 2)
            if utm_area_ha > 0
            else 0.0
        )
        results.append(summary)

    payload = {
        "body_id": args.body_id,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "data_source": {
            "dataset": OPEN_BUILDINGS_COLLECTION,
            "license": registry_license("google-open-buildings"),
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

    out_path = (
        ROOT
        / "public/data/rich-bodies"
        / f"{args.body_id}-open-buildings-verification.json"
    )
    write_artifact(out_path, payload)
    print(f"\nWrote {out_path}")
    print("\n=== Headline ===")
    for line in payload["headline_for_v0"]:
        print(f"  {line}")


def _build_headline(results: list[dict]) -> list[str]:
    by = {r["region"]: r for r in results}
    body = by.get(ZONE_BODY)
    halo = by.get(ZONE_HALO)
    lines: list[str] = []
    if body:
        lines.append(
            f"Inside primary boundary: {body['building_count']:,} buildings "
            f"covering {body['building_area_ha']:.0f} ha "
            f"({body['built_up_fraction_pct']:.1f}% of {body['region_area_ha']:.0f} ha)."
        )
    if halo:
        lines.append(
            f"Inside 1 km halo: {halo['building_count']:,} buildings "
            f"covering {halo['building_area_ha']:.0f} ha "
            f"({halo['built_up_fraction_pct']:.1f}% of {halo['region_area_ha']:.0f} ha)."
        )
    return lines


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)

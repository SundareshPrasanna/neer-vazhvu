"""Join the Jal Dharohar census points to the OSM water-body polygons.

Reads:
  public/geojson/delhi-water-bodies-census.geojson   (893 points; fetch-water-census-delhi.ts)
  public/geojson/delhi-water-bodies-current.geojson  (1,845 polygons; fetch-water-bodies-osm-delhi.ts)

Writes the census file back ENRICHED:
  - properties.osm_id / osm_type / osm_name / osm_area_ha for matches
  - properties.osm_join = "inside" | "near-<m>m" | "unmatched"
  - properties.water_body_type_label - decoded from the census type code
  - top-level metadata.join_summary + metadata.type_code_table

Join rule: point-in-polygon first (ray cast, bbox prefilter); else nearest
polygon vertex within NEAR_THRESHOLD_M. Distances are equirectangular -
fine at ward scale. Unmatched points are expected and honest: the census
enumerates johads/recharge pits too small or too dry for OSM mapping.

Type-code table: the 1st Census's six categories in report order. The
numeric mapping is INFERRED (01=pond confirmed by Delhi samples; the
schedule PDF should confirm 02-06 before labels render user-facing) -
each label carries that caveat via metadata.type_code_confidence.

Run: python scripts/join_delhi_census_water_bodies.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CENSUS = REPO / "public/geojson/delhi-water-bodies-census.geojson"
POLYS = REPO / "public/geojson/delhi-water-bodies-current.geojson"

NEAR_THRESHOLD_M = 150.0
M_PER_DEG_LAT = 111_320.0
COS_LAT = math.cos(math.radians(28.65))

TYPE_CODE_TABLE = {
    "01": "Pond",
    "02": "Tank",
    "03": "Lake",
    "04": "Reservoir",
    "05": "Water conservation scheme / percolation tank / check dam",
    "06": "Others",
}


def rings_of(geom: dict) -> list[list[list[float]]]:
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    if geom["type"] == "MultiPolygon":
        return [poly[0] for poly in geom["coordinates"] if poly]
    return []


def point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def dist_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    dx = (lon2 - lon1) * M_PER_DEG_LAT * COS_LAT
    dy = (lat2 - lat1) * M_PER_DEG_LAT
    return math.hypot(dx, dy)


def main() -> None:
    census = json.loads(CENSUS.read_text())
    polys = json.loads(POLYS.read_text())

    indexed = []
    for f in polys["features"]:
        rings = rings_of(f["geometry"])
        if not rings:
            continue
        xs = [p[0] for r in rings for p in r]
        ys = [p[1] for r in rings for p in r]
        indexed.append({
            "bbox": (min(xs), min(ys), max(xs), max(ys)),
            "rings": rings,
            "props": f["properties"],
        })

    counts = {"inside": 0, "near": 0, "unmatched": 0}
    for f in census["features"]:
        lon, lat = f["geometry"]["coordinates"][:2]
        props = f["properties"]

        code = str(props.get("water_body_type", "")).zfill(2)
        props["water_body_type_label"] = TYPE_CODE_TABLE.get(code)

        hit = None
        pad = NEAR_THRESHOLD_M / (M_PER_DEG_LAT * COS_LAT)
        best_near: tuple[float, dict] | None = None
        for poly in indexed:
            x0, y0, x1, y1 = poly["bbox"]
            if not (x0 - pad <= lon <= x1 + pad and y0 - pad <= lat <= y1 + pad):
                continue
            if any(point_in_ring(lon, lat, r) for r in poly["rings"]):
                hit = poly
                break
            d = min(
                dist_m(lon, lat, p[0], p[1])
                for r in poly["rings"]
                for p in r[:: max(1, len(r) // 40)]
            )
            if d <= NEAR_THRESHOLD_M and (best_near is None or d < best_near[0]):
                best_near = (d, poly)

        if hit is not None:
            src = hit["props"]
            props.update(
                osm_id=src.get("osm_id"), osm_type=src.get("osm_type"),
                osm_name=src.get("name") or None, osm_area_ha=src.get("area_ha"),
                osm_join="inside",
            )
            counts["inside"] += 1
        elif best_near is not None:
            d, poly = best_near
            src = poly["props"]
            props.update(
                osm_id=src.get("osm_id"), osm_type=src.get("osm_type"),
                osm_name=src.get("name") or None, osm_area_ha=src.get("area_ha"),
                osm_join=f"near-{round(d)}m",
            )
            counts["near"] += 1
        else:
            props["osm_join"] = "unmatched"
            counts["unmatched"] += 1

    census.setdefault("metadata", {})
    census["metadata"]["join_summary"] = {
        **counts,
        "method": f"point-in-polygon, else nearest polygon vertex within {int(NEAR_THRESHOLD_M)} m (equirectangular)",
        "joined_against": "delhi-water-bodies-current.geojson (OSM, ODbL)",
        "note": "Unmatched points are honest: the census enumerates recharge pits and seasonal johads too small/dry for OSM polygons.",
        "script": "neer-vazhvu-api/scripts/join_delhi_census_water_bodies.py",
    }
    census["metadata"]["type_code_table"] = TYPE_CODE_TABLE
    census["metadata"]["type_code_confidence"] = (
        "INFERRED from the census report's category order (01=Pond confirmed against Delhi samples); "
        "verify against the enumeration schedule PDF before labels render user-facing."
    )

    CENSUS.write_text(json.dumps(census, indent=1, ensure_ascii=False))
    print(f"join: {counts} of {len(census['features'])} points")

    by_type: dict[str, int] = {}
    for f in census["features"]:
        lbl = f["properties"].get("water_body_type_label") or f["properties"].get("water_body_type", "?")
        by_type[lbl] = by_type.get(lbl, 0) + 1
    print("type distribution:", dict(sorted(by_type.items(), key=lambda kv: -kv[1])))


if __name__ == "__main__":
    main()

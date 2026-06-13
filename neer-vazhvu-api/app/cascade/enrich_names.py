"""Cascade name enrichment: keep the published lake layer's names in sync with
the source water bodies, and name the river each lake's overflow reaches.

This is the single home for two name fixes (name sync + downstream-river naming)
that were previously applied as standalone post-processing scripts.
build_catchments calls enrich_cascade_lakes() at the end of every run, so a full
regen produces the names automatically; the same function is exposed as a CLI
for the common case of refreshing names WITHOUT re-delineating (e.g. after a
source-name backfill like scripts/name-bangalore-water-bodies.py):

    python -m app.cascade.enrich_names                 # all districts
    python -m app.cascade.enrich_names bangalore       # one district

What it does, keyed by osm_id (no geometry recompute):
  1. Names  - copy each body's `name` / `name_ta` from the source water-bodies
              geojson onto the cascade lake layer, and refresh each feature's
              embedded `drains_to_name`. build already reads source names, so
              this is a no-op during a build and a real sync when run standalone.
  2. Rivers - for every lake whose cascade has no downstream tank (a "river
              terminal"), snap its traced downstream flow path to the nearest
              named river in <city>-rivers.geojson; if within RIVER_SNAP_M,
              record that river as `drains_to_river_name`. The path follows the
              real channel, so a genuine drain meets the river at ~0 m; lakes
              whose path stays far from every named river (e.g. flow off-map)
              get no name rather than a wrong one.
"""

from __future__ import annotations

import json

import pyproj
from shapely.geometry import shape
from shapely.ops import transform as shp_transform

from app.cascade.districts import DistrictCascadeConfig, get_district_cascade_config

# Path-to-river distance (metres) at which we accept a river as the lake's sink.
# Deliberately tight: the downstream path follows the channel, so a true drain
# touches the river at ~0 m. Bengaluru calibration showed a clean gap - matches
# at ~0 m, non-matches > 5 km away - so 500 m has no false positives.
RIVER_SNAP_M = 500.0


def _sync_names_from_source(district: DistrictCascadeConfig, lakes: dict) -> int:
    """Copy name / name_ta from the source water-bodies geojson onto the cascade
    lake features by osm_id, then refresh each feature's drains_to_name."""
    src = json.loads(district.tank_polygons_path.read_text(encoding="utf-8"))
    name_by_id: dict[int, str] = {}
    alt_by_id: dict[int, str] = {}
    for f in src["features"]:
        p = f["properties"]
        oid = p.get("osm_id")
        if oid is None:
            continue
        name_by_id[oid] = (p.get("name") or "").strip()
        alt_by_id[oid] = (p.get("name_kn") or p.get("name_ta") or "").strip()

    updated = 0
    for f in lakes["features"]:
        p = f["properties"]
        oid = p["osm_id"]
        new_name = name_by_id.get(oid, "")
        if new_name and new_name != (p.get("name") or "").strip():
            p["name"] = new_name
            if alt_by_id.get(oid):
                p["name_ta"] = alt_by_id[oid]
            updated += 1

    patched = {
        f["properties"]["osm_id"]: (f["properties"].get("name") or "").strip()
        for f in lakes["features"]
    }
    for f in lakes["features"]:
        p = f["properties"]
        dst = p.get("drains_to_osm_id")
        if dst is not None:
            p["drains_to_name"] = patched.get(dst, p.get("drains_to_name") or "")
    return updated


def _assign_river_names(district: DistrictCascadeConfig, lakes: dict) -> int:
    """Name the river each river-terminal lake drains into, by snapping its
    traced downstream flow path to the nearest named river segment."""
    rivers_path = district.rivers_path
    downstream_path = district.cascade_catchment_downstream_json_path()
    if rivers_path is None or not rivers_path.exists() or not downstream_path.exists():
        return 0

    to_utm = pyproj.Transformer.from_crs(
        "EPSG:4326", f"EPSG:{district.utm_epsg}", always_xy=True
    ).transform
    rivers_fc = json.loads(rivers_path.read_text(encoding="utf-8"))
    rivers = [
        (
            (f["properties"].get("name") or "").strip(),
            shp_transform(to_utm, shape(f["geometry"])),
        )
        for f in rivers_fc["features"]
        if (f["properties"].get("name") or "").strip()
    ]
    if not rivers:
        return 0

    downstream = json.loads(downstream_path.read_text(encoding="utf-8"))
    ids = {f["properties"]["osm_id"] for f in lakes["features"]}

    named = 0
    for f in lakes["features"]:
        p = f["properties"]
        dst = p.get("drains_to_osm_id")
        # River terminal: no downstream tank, or it points at a filtered-out body.
        if dst is not None and dst in ids:
            p.pop("drains_to_river_name", None)
            continue
        path = downstream.get(str(p["osm_id"]), {}).get("features", [])
        anchor = shape(path[0]["geometry"]) if path else shape(f["geometry"]).centroid
        g = shp_transform(to_utm, anchor)
        best_name, best_d = None, RIVER_SNAP_M
        for rname, rgeom in rivers:
            d = g.distance(rgeom)
            if d <= best_d:
                best_d, best_name = d, rname
        if best_name:
            p["drains_to_river"] = True
            p["drains_to_river_name"] = best_name
            named += 1
        else:
            p.pop("drains_to_river_name", None)
    return named


def enrich_cascade_lakes(district: DistrictCascadeConfig) -> dict[str, int]:
    """Sync names from source + name the downstream river, in place on the
    published cascade lake layer. Idempotent; no geometry recompute."""
    lakes_path = district.cascade_lakes_geojson_path()
    if not lakes_path.exists():
        return {"names_synced": 0, "rivers_named": 0}
    lakes = json.loads(lakes_path.read_text(encoding="utf-8"))
    names_synced = _sync_names_from_source(district, lakes)
    rivers_named = _assign_river_names(district, lakes)
    lakes_path.write_text(
        json.dumps(lakes, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    total_named = sum(
        1 for f in lakes["features"] if (f["properties"].get("name") or "").strip()
    )
    n = len(lakes["features"])
    print(
        f"[enrich-names] {district.district_id}: synced {names_synced} names, "
        f"named river for {rivers_named} terminals; {total_named}/{n} lakes named "
        f"({100 * total_named // n if n else 0}%)"
    )
    return {"names_synced": names_synced, "rivers_named": rivers_named}


def main(argv: list[str] | None = None) -> None:
    import sys

    cities = (argv if argv is not None else sys.argv[1:]) or [
        "chennai",
        "madurai",
        "bangalore",
    ]
    for city in cities:
        enrich_cascade_lakes(get_district_cascade_config(city))


if __name__ == "__main__":
    main()

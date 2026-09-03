"""Hand-digitise a custody lake with no OSM polygon from the Sentinel-2 observed
water (build step 4, open question 2): the largest 4-connected component of
occurrence >= OCC_THRESH within RADIUS_M of the LMS point that no OSM water
polygon covers, opened by 10 m, written to data/hand-digitised-polygons.geojson
with its provenance. The spine reads it through the digitised_key override.

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python \
       scripts/bengaluru-snapshot/digitise_from_observed.py gba-bbmp-033 gba-bbmp-145
"""
from __future__ import annotations

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ee  # noqa: E402
import build_footprints as bf  # noqa: E402
from shapely.geometry import Point, mapping, shape  # noqa: E402
from shapely.ops import unary_union  # noqa: E402
from shapely.strtree import STRtree  # noqa: E402

RADIUS_M = 300


def main(spine_ids: list[str]) -> None:
    bf.init_ee()
    occ = bf.occurrence(datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    spine = {r["spine_id"]: r for r in csv.DictReader(open(bf.DATA / "gba-lakes-spine.csv"))}
    polys = json.load(open(bf.GEO / "bangalore-water-bodies-current.geojson"))["features"]
    geoms = [shape(f["geometry"]) for f in polys]; tree = STRtree(geoms)
    out_path = bf.DATA / "hand-digitised-polygons.geojson"
    feats = json.load(open(out_path))["features"] if out_path.exists() else []
    feats = [f for f in feats if f["properties"]["key"] not in spine_ids]
    for sid in spine_ids:
        r = spine[sid]
        pt = Point(float(r["lms_lon"]), float(r["lms_lat"]))
        circle_u = bf.utm(pt).buffer(RADIUS_M)
        covered = [bf.utm(geoms[j]).buffer(bf.EXCL_BUFFER_M) for j in tree.query(bf.wgs(circle_u)) if geoms[j].intersects(bf.wgs(circle_u))]
        excl = bf.wgs(unary_union(covered)) if covered else None
        water = occ.select("occ").gte(bf.OCC_THRESH)
        if excl is not None and not excl.is_empty:
            inside = ee.Image.constant(0).paint(ee.FeatureCollection([ee.Feature(bf.ee_geom(excl))]), 1)
            water = water.And(inside.Not())
        vec = water.selfMask().reduceToVectors(geometry=bf.ee_geom(bf.wgs(circle_u)), scale=bf.SCALE, crs=bf.CRS, geometryType="polygon", eightConnected=False, labelProperty="w", maxPixels=int(1e9))
        info = vec.map(lambda f: f.transform("EPSG:4326", 1)).getInfo()
        parts = [bf.opened(bf.utm(shape(f["geometry"]))) for f in info["features"]]
        parts = [g for g in parts if not g.is_empty]
        if not parts:
            print(f"  {sid} {r['ktcda_name']}: no observed water within {RADIUS_M} m of the LMS point; skipped")
            continue
        best = max(parts, key=lambda g: g.area)
        feats.append({"type": "Feature", "geometry": mapping(bf.wgs(best)), "properties": {
            "key": sid, "ktcda_key": r["ktcda_key"], "name": r["ktcda_name"], "area_ha": round(best.area / 1e4, 2),
            "provenance": f"largest 4-connected component of Sentinel-2 water occurrence >= {bf.OCC_THRESH} ({bf.START} to date) within {RADIUS_M} m of the LMS point, other OSM water masked, opened {bf.OPEN_M} m; boundary confidence Low",
            "digitised_on": datetime.now(timezone.utc).strftime("%Y-%m-%d")}})
        print(f"  {sid} {r['ktcda_name']}: {best.area / 1e4:.2f} ha from {len(parts)} components")
    json.dump({"type": "FeatureCollection", "features": feats}, open(out_path, "w"))
    print(f"wrote {out_path} ({len(feats)} polygons)")


if __name__ == "__main__":
    main(sys.argv[1:])

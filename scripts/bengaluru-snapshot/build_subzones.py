"""Named sub-zones for the three sub-zone lakes (build step 8; methodology note
7.6): inlets and the outflow, as circles of SUBZONE_M across placed from the
cascade edge endpoints; inlets clipped to the fixed footprint, the outflow kept
whole because foam collects at and below the weir (step 6 evidence).

  Bellandur  the two reviewed zones already on the platform
             (public/geojson/rich-bodies/bellandur-zone-*.geojson) are reused
  Varthur, Jakkur  every cascade edge into the lake gives an inlet at the
             endpoint of its line nearest the footprint; the edge out of the
             lake gives the outflow; a small margin so the mouth sits inside

Output: docs/research/bengaluru-lakes/data/gba-lakes-subzones.geojson with
spine_id, key, kind (inlet | outflow), label, derivation. Sub-zones are
sampled by run_lake_state.py (fetch --only <the three lakes>) and reported as
anomalies against the lake interior (P3), never as a verdict of discharge.

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python \
       scripts/bengaluru-snapshot/build_subzones.py
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, mapping, shape
from shapely.ops import transform as shp_transform

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs/research/bengaluru-lakes/data"
RICH = ROOT / "public/geojson/rich-bodies"
SUBZONE_M = 120            # mouth circle diameter (note 7.6: 100 to 150 m)
INSET_M = 20               # move the anchor this far into the lake from the shore
LAKES = {"gba-bda-001": "bellandur", "gba-bda-002": "varthur", "gba-bbmp-155": "jakkur"}
TO_UTM = Transformer.from_crs("EPSG:4326", "EPSG:32643", always_xy=True).transform
TO_WGS = Transformer.from_crs("EPSG:32643", "EPSG:4326", always_xy=True).transform


def utm(g):
    return shp_transform(TO_UTM, g)


def wgs(g):
    return shp_transform(TO_WGS, g)


def main() -> None:
    spine = {r["spine_id"]: r for r in csv.DictReader(open(DATA / "gba-lakes-spine.csv"))}
    fps = {f["properties"]["spine_id"]: utm(shape(f["geometry"])) for f in json.load(open(DATA / "gba-lakes-footprints.geojson"))["features"]}
    lakes = {f["properties"]["osm_id"]: f["properties"] for f in json.load(open(ROOT / "public/data/cascade/bangalore-cascade-lakes.geojson"))["features"]}
    edges = json.load(open(ROOT / "public/data/cascade/bangalore-cascade-edges.geojson"))["features"]
    feats = []

    def circle_at(fp, pt_utm, key, kind, label, sid, derivation):
        # step inward along the line from the shore point to the footprint centroid
        c = fp.centroid
        d = pt_utm.distance(c)
        if d > INSET_M:
            pt_utm = Point(pt_utm.x + (c.x - pt_utm.x) * INSET_M / d, pt_utm.y + (c.y - pt_utm.y) * INSET_M / d)
        # an outflow mouth straddles the bund: foam collects at and below the weir,
        # so the outflow circle is kept whole; an inlet circle is clipped to the lake
        z = pt_utm.buffer(SUBZONE_M / 2)
        if kind != "outflow":
            z = z.intersection(fp)
        if z.is_empty or z.area < 2000:
            print(f"  {sid} {key}: mouth outside the footprint, skipped")
            return
        feats.append({"type": "Feature", "geometry": mapping(wgs(z)), "properties": {
            "spine_id": sid, "key": key, "kind": kind, "label": label, "derivation": derivation,
            "area_ha": round(z.area / 1e4, 3), "px_10m": int(z.area / 100)}})

    for sid, short in LAKES.items():
        fp = fps[sid]
        osm_id = int(spine[sid]["osm_id"])
        if short == "bellandur":
            for zf in sorted(RICH.glob("bellandur-zone-*.geojson")):
                g = json.load(open(zf))["features"][0]
                key = zf.stem[len("bellandur-zone-"):]
                kind = "outflow" if g["properties"].get("kind") == "weir" else g["properties"].get("kind", "inlet")
                zg = utm(shape(g["geometry"]))
                if kind != "outflow":
                    zg = zg.intersection(fp)
                feats.append({"type": "Feature", "geometry": mapping(wgs(zg)), "properties": {
                    "spine_id": sid, "key": key, "kind": kind, "label": g["properties"].get("label", key),
                    "derivation": "platform rich-body zone, reviewed 2026-06-08; " + g["properties"].get("derivation", ""),
                    "area_ha": round(zg.area / 1e4, 3), "px_10m": int(zg.area / 100)}})
            continue
        n_in = 0
        for e in edges:
            p = e["properties"]
            line = utm(shape(e["geometry"]))
            ends = [Point(line.coords[0]), Point(line.coords[-1])]
            if p["to_osm_id"] == osm_id:
                n_in += 1
                pt = min(ends, key=lambda q: q.distance(fp))
                src = lakes.get(p["from_osm_id"], {})
                label = f"Inflow from {src.get('name') or ('lake ' + str(p['from_osm_id']))} ({p.get('confidence')} confidence edge)"
                circle_at(fp, pt, f"inlet-{n_in}", "inlet", label, sid, f"cascade edge {p['from_osm_id']} -> {osm_id}, endpoint nearest the footprint, inset {INSET_M} m, {SUBZONE_M} m circle")
            elif p["from_osm_id"] == osm_id:
                pt = min(ends, key=lambda q: q.distance(fp))
                dst = lakes.get(p["to_osm_id"], {})
                label = f"Outflow toward {dst.get('name') or ('lake ' + str(p['to_osm_id']))}"
                circle_at(fp, pt, "outflow", "outflow", label, sid, f"cascade edge {osm_id} -> {p['to_osm_id']}, endpoint nearest the footprint, inset {INSET_M} m, {SUBZONE_M} m circle")
        print(f"  {sid} {short}: {n_in} inflow edges")

    json.dump({"type": "FeatureCollection", "features": feats}, open(DATA / "gba-lakes-subzones.geojson", "w"))
    for f in feats:
        p = f["properties"]
        print(f"  {p['spine_id']} {p['key']:<10} {p['kind']:<8} {p['area_ha']:.2f} ha {p['px_10m']} px  {p['label']}")
    print(f"wrote {len(feats)} sub-zones")


if __name__ == "__main__":
    main()

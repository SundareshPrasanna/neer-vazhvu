#!/usr/bin/env python3
"""Derive the 6 Chennai sub-basin catchments from HydroBASINS level 12.

Same dataset/method lineage as the existing sub-hydrosheds (WWF/HydroSHEDS
hybas_12, channel-upstream union). Sub-basins are HYDROLOGICAL catchments, not
administrative areas: every hybas_12 unit is grouped by the coastal outlet it
drains to (following NEXT_DOWN topology), and each drainage group is assigned to
the nearest of the 6 named river mouths. This yields a true, non-overlapping
partition (e.g. Pulicat/Ponneri drain via the Arani river, so they land in
Araniyar - not Gummidipoondi).

Writes public/geojson/chennai-sub-basins-risk-geom.json (geometry only, keyed by
sub_basin). build_chennai_subbasin_risk.py joins the CEEW risk attributes onto it.

Requires GEE (uses the repo service-account key).
"""
import json
import os
from collections import defaultdict

import ee
from pyproj import Geod
from shapely.geometry import box, shape, mapping
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = os.path.join(ROOT, "motiveloop-play-a6c60c9fa760.json")
TN_BOUNDARY = os.path.join(ROOT, "public/geojson/tamil-nadu-boundary.geojson")
OUT = os.path.join(ROOT, "public/geojson/chennai-sub-basins-risk-geom.json")

# River mouths (lng, lat) - the coastal outlet each catchment drains to.
# Gummidipoondi is NOT mouth-assigned: it is a small far-north coastal block
# (mostly direct drainage; the Arani catchment that feeds Pulicat is Araniyar).
# Mouth-nearest would just hand it the Andhra-Pradesh Pulicat catchment, which
# the TN clip then deletes. Instead it is the TN northern-coastal residual not
# claimed by the five named catchments (computed below).
RIVER_MOUTHS = {
    "Kosasthalaiyar": (80.330, 13.236),   # Korttalaiyar -> Ennore creek
    "Araniyar": (80.270, 13.470),         # Arani -> Pulicat lagoon
    "Cooum": (80.292, 13.063),            # Cooum -> Marina
    "Adyar": (80.282, 13.006),            # Adyar estuary
    "Kovalam": (80.250, 12.792),          # Kovalam creek / Muttukadu (south)
}
# Where the residual northern-coastal TN drainage is labelled Gummidipoondi.
GUMMIDIPOONDI_BAND = (79.50, 13.28, 80.45, 13.80)  # lon0, lat0, lon1, lat1
ASSIGN_MAX_DEG = 0.25  # drop coastal groups farther than this from any mouth
GEOD = Geod(ellps="WGS84")


def init_ee():
    with open(KEY) as fh:
        email = json.load(fh)["client_email"]
    ee.Initialize(ee.ServiceAccountCredentials(email, KEY))


def sqkm(geom):
    area, _ = GEOD.geometry_area_perimeter(geom)
    return abs(area) / 1e6


def _polygons_only(geom):
    """Drop non-polygonal slivers a clip can introduce (GeometryCollection)."""
    if geom.geom_type in ("Polygon", "MultiPolygon"):
        return geom
    if geom.geom_type == "GeometryCollection":
        polys = [g for g in geom.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
        return unary_union(polys) if polys else geom
    return geom


def _defragment(geom, min_part_km2=5.0):
    """Keep only polygon parts above a size floor, so flat-coast routing slivers
    and detached fragments (e.g. a stray Pulicat blob) don't show as artifacts."""
    parts = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
    keep = [p for p in parts if sqkm(p) >= min_part_km2]
    if not keep:
        keep = [max(parts, key=lambda p: p.area)]
    return unary_union(keep) if len(keep) > 1 else keep[0]


def main():
    init_ee()
    # Wide region so the Palar (south) and AP coastal basins (north) terminate at
    # their OWN distant outlets and get dropped by the mouth-distance threshold,
    # rather than re-terminating near our river mouths. The unioned catchments
    # are then clipped to the TN basin window below.
    region = ee.Geometry.Rectangle([79.0, 12.2, 80.65, 13.95])
    # Clip catchments to the real Tamil Nadu state boundary so nothing spills
    # into Andhra Pradesh (the Pulicat lagoon catchment is shared TN/AP). This
    # follows the true irregular border instead of a straight latitude cut.
    tn_geom = shape(json.load(open(TN_BOUNDARY))["features"][0]["geometry"]).buffer(0)
    tn_clip = tn_geom
    fc = ee.FeatureCollection("WWF/HydroSHEDS/v1/Basins/hybas_12").filterBounds(region)
    gj = fc.getInfo()
    feats = gj["features"]
    print(f"hybas_12 units in region: {len(feats)}")

    geom = {}        # hybas_id -> shapely geom
    nxt = {}         # hybas_id -> next_down
    for f in feats:
        p = f["properties"]
        hid = int(p["HYBAS_ID"])
        geom[hid] = shape(f["geometry"]).buffer(0)
        nxt[hid] = int(p.get("NEXT_DOWN", 0))

    # Terminal sink (coastal outlet) for each unit by following NEXT_DOWN.
    def terminal(h):
        seen = set()
        while nxt.get(h, 0) != 0 and h not in seen and nxt[h] in geom:
            seen.add(h)
            h = nxt[h]
        return h

    groups = defaultdict(list)
    for hid in geom:
        groups[terminal(hid)].append(hid)
    print(f"drainage groups (coastal outlets): {len(groups)}")

    # Assign each drainage group to the nearest river mouth by its outlet point
    # (easternmost vertex of the terminal unit = where it meets the coast).
    assigned = defaultdict(list)  # river -> [hids]
    for term, hids in groups.items():
        tgeom = geom[term]
        pts = list(tgeom.exterior.coords) if tgeom.geom_type == "Polygon" else [
            c for g in tgeom.geoms for c in g.exterior.coords
        ]
        ox, oy = max(pts, key=lambda c: c[0])  # easternmost (coast)
        best, bestd = None, 1e9
        for river, (mx, my) in RIVER_MOUTHS.items():
            d = ((ox - mx) ** 2 + (oy - my) ** 2) ** 0.5
            if d < bestd:
                best, bestd = river, d
        if bestd <= ASSIGN_MAX_DEG:
            assigned[best].extend(hids)

    out = {"type": "FeatureCollection", "features": []}
    unclipped = {}  # river -> pre-TN-clip union (for the Gummidipoondi residual)
    for river in RIVER_MOUTHS:
        hids = assigned.get(river, [])
        if not hids:
            print(f"  WARNING: no units for {river}")
            continue
        raw = unary_union([geom[h] for h in hids]).buffer(0)
        unclipped[river] = raw
        merged = _polygons_only(raw.intersection(tn_clip)).buffer(0)
        merged = _defragment(merged).simplify(0.0008)
        if merged.is_empty:
            print(f"  (skip {river}: empty after TN clip)")
            continue
        print(f"  {river:15} units={len(hids):3} area={sqkm(merged):7.0f} sqkm")
        out["features"].append({
            "type": "Feature",
            "properties": {"sub_basin": river, "hybas_units": len(hids)},
            "geometry": _round(mapping(merged)),
        })

    # Gummidipoondi = TN northern-coastal residual not claimed by the five.
    others = unary_union(list(unclipped.values())).buffer(0)
    band = box(*GUMMIDIPOONDI_BAND)
    gummidi = _polygons_only(tn_clip.intersection(band).difference(others)).buffer(0)
    # Minor coastal sub-basin: keep a single clean polygon (its largest piece).
    if gummidi.geom_type == "MultiPolygon":
        gummidi = max(gummidi.geoms, key=lambda p: p.area)
    gummidi = gummidi.simplify(0.0008)
    if not gummidi.is_empty:
        print(f"  {'Gummidipoondi':15} (residual)  area={sqkm(gummidi):7.0f} sqkm")
        out["features"].append({
            "type": "Feature",
            "properties": {"sub_basin": "Gummidipoondi", "hybas_units": 0},
            "geometry": _round(mapping(gummidi)),
        })

    with open(OUT, "w") as fh:
        json.dump(out, fh)
    print(f"wrote {OUT}")


def _round(g, nd=5):
    def r(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [r(x) for x in c]
    g["coordinates"] = r(g["coordinates"])
    return g


if __name__ == "__main__":
    main()

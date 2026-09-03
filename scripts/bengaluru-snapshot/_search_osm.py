"""Search OSM water polygons by name fragment; print id, name, area, ward, AC, centroid.
Usage: python _search_osm.py ulsoor halasur kudlu ...
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from shapely.geometry import shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
polys = json.load(open(ROOT / "public/geojson/bangalore-water-bodies-current.geojson"))["features"]
wards = json.load(open(ROOT / "public/geojson/bangalore-wards-2025.geojson"))["features"]
wg = [shape(f["geometry"]) for f in wards]
wt = STRtree(wg)

for kw in sys.argv[1:]:
    rx = re.compile(kw, re.I)
    print(f"== {kw}")
    for f in polys:
        p = f["properties"]
        if rx.search(p.get("name") or "") or rx.search(p.get("name_kn") or ""):
            g = shape(f["geometry"]); c = g.representative_point()
            w = next((wards[j]["properties"] for j in wt.query(c) if wg[j].contains(c)), None)
            print(f"   {p['osm_id']:>11}  {p.get('name','')[:36]:36} {p.get('area_ha',''):>7} ha  ward={((w or {}).get('ward_name') or '-')[:22]:22} ac={((w or {}).get('ac_name') or '-')[:20]:20} @ {c.y:.4f},{c.x:.4f}")

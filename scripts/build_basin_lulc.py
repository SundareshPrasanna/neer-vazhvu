#!/usr/bin/env python3
"""Per-sub-basin land-use shares from ESA WorldCover 2021 (10 m, v200).

Reads the public AWS COGs remotely (/vsicurl/, overview level ~80 m - ample
for polygon shares), masks pixels by point-in-polygon on the coarse grid,
and writes cropland / built-up / water(+wetland) percentage metrics into
each basin's scoreboard.json. Shares are verified by construction (computed
from the raster over our own polygons).

Needs rasterio (not in the repo env): run with a venv interpreter, e.g.
  <venv>/bin/python scripts/build_basin_lulc.py cauvery-ka cauvery-tn

Post-ingest step: re-running the basin ingest wipes scoreboard metrics -
re-run this afterwards.
"""
import json
import math
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TILE_URL = ("https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
            "ESA_WorldCover_10m_2021_v200_{lat}{lon}_Map.tif")
# WorldCover classes
CROP = {40}
BUILT = {50}
WATER = {80, 90, 95}  # open water + herbaceous wetland + mangrove
DECIMATE = 8  # read at ~80 m


def tiles_for_bbox(minx, miny, maxx, maxy):
    out = []
    for lat0 in range(int(math.floor(miny / 3) * 3), int(math.floor(maxy / 3) * 3) + 1, 3):
        for lon0 in range(int(math.floor(minx / 3) * 3), int(math.floor(maxx / 3) * 3) + 1, 3):
            lat = f"{'N' if lat0 >= 0 else 'S'}{abs(lat0):02d}"
            lon = f"{'E' if lon0 >= 0 else 'W'}{abs(lon0):03d}"
            out.append(TILE_URL.format(lat=lat, lon=lon))
    return out


def point_in_geom(lon, lat, geom):
    def in_ring(ring):
        inside = False
        n = len(ring)
        for i in range(n):
            x1, y1 = ring[i][0], ring[i][1]
            x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
            if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                inside = not inside
        return inside

    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return any(in_ring(p[0]) and not any(in_ring(h) for h in p[1:]) for p in polys)


def geom_bbox(geom):
    xs, ys = [], []

    def scan(c):
        if isinstance(c[0], (int, float)):
            xs.append(c[0]); ys.append(c[1])
        else:
            for cc in c:
                scan(cc)

    scan(geom["coordinates"])
    return min(xs), min(ys), max(xs), max(ys)


def shares_for_geom(geom):
    import numpy as np
    import rasterio
    from rasterio.windows import from_bounds

    minx, miny, maxx, maxy = geom_bbox(geom)
    counts: dict[int, int] = {}
    for url in tiles_for_bbox(minx, miny, maxx, maxy):
        try:
            src = rasterio.open("/vsicurl/" + url)
        except rasterio.errors.RasterioIOError:
            continue  # tile off the landmass grid
        with src:
            tb = src.bounds
            ix0, iy0 = max(minx, tb.left), max(miny, tb.bottom)
            ix1, iy1 = min(maxx, tb.right), min(maxy, tb.top)
            if ix0 >= ix1 or iy0 >= iy1:
                continue
            win = from_bounds(ix0, iy0, ix1, iy1, src.transform)
            h = max(1, int(win.height) // DECIMATE)
            w = max(1, int(win.width) // DECIMATE)
            arr = src.read(1, window=win, out_shape=(h, w))
            # scanline mask: per row, polygon edge crossings -> inside intervals
            # (per-cell PIP is quadratic and unusable at delta scale)
            rings = []
            polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
            for poly in polys:
                for ring in poly:  # holes toggle inside-ness too
                    rings.append(ring)
            for r in range(h):
                lat = iy1 - (r + 0.5) * (iy1 - iy0) / h
                xs = []
                for ring in rings:
                    n = len(ring)
                    for i in range(n):
                        x1, y1 = ring[i][0], ring[i][1]
                        x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
                        if (y1 > lat) != (y2 > lat):
                            xs.append((x2 - x1) * (lat - y1) / (y2 - y1) + x1)
                if not xs:
                    continue
                xs.sort()
                row = arr[r]
                for k in range(0, len(xs) - 1, 2):
                    c0 = max(0, int(math.ceil((xs[k] - ix0) / (ix1 - ix0) * w - 0.5)))
                    c1 = min(w - 1, int(math.floor((xs[k + 1] - ix0) / (ix1 - ix0) * w - 0.5)))
                    for c in range(c0, c1 + 1):
                        v = int(row[c])
                        if v:
                            counts[v] = counts.get(v, 0) + 1
    total = sum(counts.values())
    if total == 0:
        return None
    pct = lambda s: round(sum(counts.get(k, 0) for k in s) / total * 100, 1)
    return {"crop": pct(CROP), "built": pct(BUILT), "water": pct(WATER), "cells": total}


def main(basin_ids):
    for basin_id in basin_ids:
        basin_dir = ROOT / "public" / "data" / "basins" / basin_id
        sub_basins = json.loads((basin_dir / "sub-basins.geojson").read_text())
        sb_path = basin_dir / "scoreboard.json"
        sb = json.loads(sb_path.read_text())
        for feat in sub_basins["features"]:
            props = feat["properties"]
            key = str(props.get("scoreboardKey") or props.get("code"))
            entry = sb["subBasins"].get(key)
            if entry is None:
                continue
            res = shares_for_geom(feat["geometry"])
            if not res:
                print(f"  WARN {basin_id}/{key}: no cells, skipped")
                continue
            src_note = (f"ESA WorldCover 2021 v200 (10 m), shares over ~80 m sampling of the "
                        f"sub-basin polygon ({res['cells']:,} cells)")
            for mkey, val in (("lulcCropPct", res["crop"]), ("lulcBuiltPct", res["built"]), ("lulcWaterPct", res["water"])):
                entry["metrics"][mkey] = {
                    "value": val, "unit": "% of area", "asOf": "2021",
                    "source": src_note, "verified": True,
                }
            print(f"  {basin_id}/{key} {entry.get('name','')}: crop {res['crop']}% built {res['built']}% water {res['water']}%")
        sb["asOf"] = date.today().isoformat()
        sb_path.write_text(json.dumps(sb, ensure_ascii=False, indent=1))
        print(f"updated {sb_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1:] or ["cauvery-ka", "cauvery-tn"])

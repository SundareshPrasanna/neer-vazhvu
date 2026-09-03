"""Per-pixel chlorophyll-proxy maps for the per-lake pages (methodology note P2,
served here as a twelve-month median rather than a persistence share): for each
lake named, the median NDCI over the last WINDOW_DAYS of clear passes on pixels
classed open water (rule B), at 20 m, with the count of passes behind each pixel.
Withheld when the median pass count inside the lake is under MIN_PASSES.

Output: docs/research/bengaluru-lakes/data/hotspots/<spine_id>.json with the
grid (rows of values, null where no open-water pass), the pixel size, the
origin, the pass count and the window.

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python \
       scripts/bengaluru-snapshot/build_hotspots.py gba-bda-001 gba-bbmp-155 ... [--end 2026-09-04]
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ee  # noqa: E402
import run_lake_state as rls  # noqa: E402
from shapely.geometry import shape  # noqa: E402

OUT = rls.DATA / "hotspots"
WINDOW_DAYS = 365
GRID_M = 20
MIN_PASSES = 25


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("spine_ids", nargs="+")
    ap.add_argument("--end", default=date.today().isoformat())
    args = ap.parse_args()
    rls.init_ee()
    OUT.mkdir(exist_ok=True)
    fps = {f["properties"]["spine_id"]: f for f in json.load(open(rls.DATA / "gba-lakes-footprints.geojson"))["features"]}
    end = date.fromisoformat(args.end); start = end - timedelta(days=WINDOW_DAYS)
    for sid in args.spine_ids:
        f = fps[sid]
        geom = ee.Geometry(f["geometry"], "EPSG:4326", False)
        coll = rls.collection(start.isoformat(), end.isoformat(), geom.bounds())
        ow = coll.map(lambda img: ee.Image(img).select("ndci").updateMask(ee.Image(img).select("c1").eq(1)))
        med = ow.median().rename("ndci")
        n = ow.count().rename("n")
        img = med.addBands(n.toFloat()).clip(geom)
        # a fixed grid at GRID_M in UTM 43N over the footprint bounds
        proj = ee.Projection(rls.CRS).atScale(GRID_M)
        arr = img.reproject(proj).sampleRectangle(region=geom.bounds(), defaultValue=-9999).getInfo()["properties"]
        vals, cnts = arr["ndci"], arr["n"]
        inside = [c for row in cnts for c in row if c not in (-9999, 0)]
        n_med = sorted(inside)[len(inside) // 2] if inside else 0
        b = shape(f["geometry"]).bounds
        rec = {"spine_id": sid, "window": [start.isoformat(), end.isoformat()], "grid_m": GRID_M, "crs": rls.CRS,
               "bounds_wgs84": list(b), "rows": len(vals), "cols": len(vals[0]) if vals else 0,
               "median_pass_count": n_med, "withheld": n_med < MIN_PASSES,
               "values": [[None if v == -9999 or c in (-9999, 0) else round(v, 3) for v, c in zip(rv, rc)] for rv, rc in zip(vals, cnts)],
               "counts": [[None if c == -9999 else c for c in rc] for rc in cnts],
               "note": "median NDCI over open-water passes per pixel; a pixel never classed open water in the window is blank"}
        json.dump(rec, open(OUT / f"{sid}.json", "w"))
        print(f"  {sid}: {rec['rows']}x{rec['cols']} cells, median passes per open-water pixel {n_med}{' (withheld)' if rec['withheld'] else ''}")


if __name__ == "__main__":
    main()

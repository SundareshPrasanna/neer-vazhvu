"""B1, built fraction inside the fixed footprint (methodology note 8.6), per year,
from Dynamic World V1 (CC BY 4.0): the annual mode of the label band inside the
footprint minus a 30 m bund ring, for 2017 to the run year. Built = label 6
(built), bare = label 7; both shares are written, the finding is the built share.

One batched reduceRegions per year over all footprints (frequency histogram of
the annual mode label). Nothing is interpolated: a footprint-year with fewer
than MIN_SCENES Dynamic World scenes reads as insufficient.

Output: docs/research/bengaluru-lakes/data/gba-lakes-builtup.csv (one row per
lake per year) and builtup-params.json.

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python \
       scripts/bengaluru-snapshot/build_builtup.py
"""
from __future__ import annotations

import csv
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs/research/bengaluru-lakes/data"
load_dotenv(ROOT / "neer-vazhvu-api" / ".env")
import ee  # noqa: E402

DW = "GOOGLE/DYNAMICWORLD/V1"
CRS, SCALE = "EPSG:32643", 10
BUND_RING_M = 30
MIN_SCENES = 8
LABELS = {0: "water", 1: "trees", 2: "grass", 3: "flooded_vegetation", 4: "crops", 5: "shrub_and_scrub", 6: "built", 7: "bare", 8: "snow_and_ice"}
TO_UTM = Transformer.from_crs("EPSG:4326", CRS, always_xy=True).transform
TO_WGS = Transformer.from_crs(CRS, "EPSG:4326", always_xy=True).transform


def init_ee() -> None:
    kf = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    ee.Initialize(credentials=ee.ServiceAccountCredentials(json.load(open(kf))["client_email"], key_file=kf), project=os.environ["GEE_CLOUD_PROJECT"])


def main() -> None:
    init_ee()
    fps = json.load(open(DATA / "gba-lakes-footprints.geojson"))["features"]
    feats, meta = [], {}
    for f in fps:
        sid = f["properties"]["spine_id"]
        inner = shp_transform(TO_UTM, shape(f["geometry"])).buffer(-BUND_RING_M)
        if inner.is_empty:
            meta[sid] = {"inner_empty": True}
            continue
        meta[sid] = {"inner_area_ha": round(inner.area / 1e4, 2)}
        feats.append(ee.Feature(ee.Geometry(mapping(shp_transform(TO_WGS, inner)), "EPSG:4326", False), {"spine_id": sid}))
    fc = ee.FeatureCollection(feats)
    aoi = fc.geometry().bounds()
    years = list(range(2017, datetime.now(timezone.utc).year + 1))
    rows = []
    for y in years:
        coll = ee.ImageCollection(DW).filterBounds(aoi).filterDate(f"{y}-01-01", f"{y + 1}-01-01")
        mode = coll.select("label").reduce(ee.Reducer.mode()).rename("label")
        n = coll.select("label").count().rename("n")
        img = mode.addBands(n)
        red = ee.Reducer.frequencyHistogram().combine(ee.Reducer.median(), sharedInputs=False)
        out = img.reduceRegions(fc, red, SCALE, CRS).getInfo()["features"]
        for f in out:
            p = f["properties"]
            hist = {int(float(k)): v for k, v in (p.get("histogram") or {}).items()}
            tot = sum(hist.values())
            n_med = p.get("median")
            rec = {"spine_id": p["spine_id"], "year": y, "dw_scenes_median": int(n_med) if n_med is not None else None,
                   "pixels": int(tot)}
            if tot >= 20 and n_med is not None and n_med >= MIN_SCENES:
                for k, name in LABELS.items():
                    rec[f"share_{name}"] = round(hist.get(k, 0) / tot, 4)
                rec["status"] = "ok"
            else:
                rec["status"] = "insufficient"
            rows.append(rec)
        print(f"  {y}: {len(out)} footprints, ok {sum(1 for r in rows if r['year'] == y and r['status'] == 'ok')}", flush=True)
    rows.sort(key=lambda r: (r["spine_id"], r["year"]))
    cols = ["spine_id", "year", "status", "dw_scenes_median", "pixels"] + [f"share_{n}" for n in LABELS.values()]
    with open(DATA / "gba-lakes-builtup.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
    json.dump({"version": "builtup-v1", "computed_at": datetime.now(timezone.utc).isoformat(), "dataset": DW,
               "rule": f"annual mode of the Dynamic World label inside the footprint inset {BUND_RING_M} m; shares of pixels; insufficient under {MIN_SCENES} scenes (median per pixel) or 20 pixels",
               "grid": {"crs": CRS, "scale_m": SCALE}, "years": years, "labels": LABELS,
               "bound": "Dynamic World per-scene labels are noisy at low confidence; the annual mode reduces it; band call only when the band width exceeds a few points (note 16.2, B1)",
               "footprints_without_inner": [k for k, v in meta.items() if v.get("inner_empty")]},
              open(DATA / "builtup-params.json", "w"), indent=2)
    print(f"wrote {len(rows)} lake-years; footprints too small for a 30 m inset: {[k for k, v in meta.items() if v.get('inner_empty')]}")


if __name__ == "__main__":
    main()

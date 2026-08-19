#!/usr/bin/env python3
"""Buckingham Canal: the CURRENT snapshot ("Today on the canal").

From the most recent cloud-masked Sentinel-2 window (Jun-Aug 2026):
  A. Surface condition along the centerline, every 100 m: open water
     visible / vegetated / indeterminate (10 m pixels; narrow reaches
     read conservative - stated, not hidden).
  B. Vegetation load per reach in HECTARES (the number a removal
     machine crew can plan against), from NDVI > 0.35 within the
     measured water corridor.
  C. Pinch points: the narrowest measured water in each city reach.

Outputs -> docs/research/buckingham-canal/data/:
  current-surface.csv (km, state), current-veg-area.csv (reach, ha)
"""

from __future__ import annotations

import csv
import json
import os
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(API_ROOT / ".env")
import ee  # noqa: E402

BASE = API_ROOT.parent / "docs" / "research" / "buckingham-canal"
DATA = BASE / "data"
RECENT = ("2026-06-01", "2026-08-18")
NDVI_VEG = 0.35

REACHES = [
    (1, 0, 2.0),
    (2, 2.0, 5.1),
    (3, 5.1, 8.5),
    (4, 8.5, 14.3),
    (5, 14.3, 16.9),
    (6, 16.9, 19.2),
    (7, 19.2, 20.5),
    (8, 20.5, 23.3),
    (9, 23.3, 27.2),
    (10, 27.2, 29.1),
    (11, 29.1, 32.0),
    (12, 32.0, 38.5),
    (13, 38.5, 44.3),
    (14, 44.3, 51.7),
    (15, 51.7, 54.4),
    (16, 54.4, 62.2),
    (17, 62.2, 73.3),
    (18, 73.3, 74.5),
]


def main():
    creds = ee.ServiceAccountCredentials(None, os.environ["GEE_SERVICE_ACCOUNT_FILE"])
    ee.Initialize(creds, project=os.environ.get("GEE_CLOUD_PROJECT"))

    pts = json.loads((DATA / "centerline.geojson").read_text())["features"][0][
        "geometry"
    ]["coordinates"]
    widths = list(csv.DictReader(open(DATA / "widths.csv")))
    half_by_km = {}
    for rid, a, b in REACHES:
        ws = sorted(
            float(r["width_m"])
            for r in widths
            if a <= float(r["chainage_km"]) < b and r["width_m"] and r["flag"] == "OK"
        )
        half_by_km[rid] = max(12, min(80, (ws[len(ws) // 2] / 2) if ws else 20))

    def mask(img):
        scl = img.select("SCL")
        good = (
            scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10)).And(scl.neq(11))
        )
        return img.updateMask(good)

    med = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterDate(*RECENT)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
        .map(mask)
        .median()
    )
    ndwi = med.normalizedDifference(["B3", "B8"])
    ndvi = med.normalizedDifference(["B8", "B4"])
    water = ndwi.gt(0.0)
    veg = ndvi.gt(NDVI_VEG)

    # A. Surface state at 100 m points (mean over a 25 m disc)
    feats = [
        ee.Feature(ee.Geometry.Point(p).buffer(25), {"i": i}) for i, p in enumerate(pts)
    ]
    stack = water.rename("water").addBands(veg.rename("veg"))
    rows = []
    CHUNK = 250
    for s in range(0, len(feats), CHUNK):
        fc = ee.FeatureCollection(feats[s : s + CHUNK])
        res = stack.reduceRegions(fc, ee.Reducer.mean(), 10).getInfo()
        for f in res["features"]:
            p = f["properties"]
            i = p["i"]
            w = p.get("water")
            v = p.get("veg")
            if w is None:
                state = "no-data"
            elif w >= 0.35:
                state = "open-water"
            elif v is not None and v >= 0.5:
                state = "vegetated"
            else:
                state = "mixed"
            rows.append(
                {
                    "km": round(i * 0.1, 1),
                    "state": state,
                    "water_frac": round(w, 2) if w is not None else "",
                    "veg_frac": round(v, 2) if v is not None else "",
                }
            )
        print(f"surface points {min(s + CHUNK, len(feats))}/{len(feats)}", flush=True)
    rows.sort(key=lambda r: r["km"])
    with open(DATA / "current-surface.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["km", "state", "water_frac", "veg_frac"])
        w.writeheader()
        w.writerows(rows)

    # B. Vegetation load per reach, hectares, within the measured corridor
    zones = []
    for rid, a, b in REACHES:
        seg = pts[int(a * 10) : int(b * 10) + 1]
        if len(seg) >= 2:
            zones.append(
                ee.Feature(
                    ee.Geometry.LineString(seg).buffer(half_by_km[rid]),
                    {"reach_id": rid},
                )
            )
    varea = veg.multiply(ee.Image.pixelArea()).rename("veg_m2")
    res = varea.reduceRegions(
        ee.FeatureCollection(zones), ee.Reducer.sum(), 10
    ).getInfo()
    out = []
    for f in res["features"]:
        p = f["properties"]
        out.append(
            {"reach_id": p["reach_id"], "veg_ha": round((p.get("sum") or 0) / 10000, 1)}
        )
    out.sort(key=lambda r: r["reach_id"])
    with open(DATA / "current-veg-area.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["reach_id", "veg_ha"])
        w.writeheader()
        w.writerows(out)
    total = sum(r["veg_ha"] for r in out)
    print(f"total corridor vegetation: {total:.0f} ha", flush=True)
    print("done")


if __name__ == "__main__":
    main()

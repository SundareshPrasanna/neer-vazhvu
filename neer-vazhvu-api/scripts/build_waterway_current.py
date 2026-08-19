#!/usr/bin/env python3
"""Waterway CURRENT snapshot (generic; --waterway <id>): "Today on the water".

Generalized 19 Aug 2026 from the Buckingham Canal pilot when the Cooum
became waterway 2. Per-waterway parameters (window, reach table, NDVI
threshold) live in <repo>/scripts/waterways/<id>.json.

From the most recent cloud-masked Sentinel-2 window:
  A. Surface condition along the centerline, every 100 m: open water
     visible / vegetated / indeterminate (10 m pixels; narrow reaches
     read conservative - stated, not hidden).
  B. Vegetation load per reach in HECTARES (the number a removal
     machine crew can plan against), from NDVI > threshold within the
     measured water corridor.
  C. Turbidity per reach: NDTI (B4-B3 normalized difference) averaged
     over NDWI-water pixels in the corridor; blank when the reach shows
     less than min_water_ha_for_ndti of water (a suspended-sediment
     reading needs enough open water to read).
  D. Vegetation ON the mapped water surface per reach: NDVI > threshold
     inside the OSM water polygons (outer rings) - the floating-mat
     metric, separated from bank growth by construction.

Stages C and D were one-off computations in the canal build (their
producers did not survive); this script is their reconstruction and the
method of record from the Cooum onward. The canal's shipped CSVs are the
Aug 2026 baseline - rerunning here moves current-window numbers, so
regenerate an already-shipped waterway only with intent.

Outputs -> <research_dir>/data/:
  current-surface.csv (km, state), current-veg-area.csv (reach, ha),
  current-turbidity.csv (reach, ndti_mean, water_ha),
  current-veg-on-water.csv (reach, veg_on_water_frac, mapped_water_ha)
"""

from __future__ import annotations

import argparse
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

REPO = API_ROOT.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--waterway", required=True)
    args = ap.parse_args()
    cfg = json.loads(
        (REPO / "scripts" / "waterways" / f"{args.waterway}.json").read_text()
    )
    sat = cfg["satellite"]
    reaches_km = [tuple(r) for r in cfg["reaches_km"]]
    data = REPO / cfg["research_dir"] / "data"
    recent = tuple(sat["windows"]["recent"])
    ndvi_veg = sat["ndvi_veg"]
    min_water_ha = sat.get("min_water_ha_for_ndti", 1.0)

    creds = ee.ServiceAccountCredentials(None, os.environ["GEE_SERVICE_ACCOUNT_FILE"])
    ee.Initialize(creds, project=os.environ.get("GEE_CLOUD_PROJECT"))

    pts = json.loads((data / "centerline.geojson").read_text())["features"][0][
        "geometry"
    ]["coordinates"]
    widths = list(csv.DictReader(open(data / "widths.csv")))
    half_by_km = {}
    for rid, a, b in reaches_km:
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
        .filterDate(*recent)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
        .map(mask)
        .median()
    )
    ndwi = med.normalizedDifference(["B3", "B8"])
    ndvi = med.normalizedDifference(["B8", "B4"])
    ndti = med.normalizedDifference(["B4", "B3"])
    water = ndwi.gt(0.0)
    veg = ndvi.gt(ndvi_veg)

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
    with open(data / "current-surface.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["km", "state", "water_frac", "veg_frac"])
        w.writeheader()
        w.writerows(rows)

    # Reach zones within the measured corridor
    zones = []
    for rid, a, b in reaches_km:
        seg = pts[int(a * 10) : int(b * 10) + 1]
        if len(seg) >= 2:
            zones.append(
                ee.Feature(
                    ee.Geometry.LineString(seg).buffer(half_by_km[rid]),
                    {"reach_id": rid},
                )
            )
    zone_fc = ee.FeatureCollection(zones)

    # B. Vegetation load per reach, hectares
    varea = veg.multiply(ee.Image.pixelArea()).rename("veg_m2")
    res = varea.reduceRegions(zone_fc, ee.Reducer.sum(), 10).getInfo()
    out = []
    for f in res["features"]:
        p = f["properties"]
        out.append(
            {"reach_id": p["reach_id"], "veg_ha": round((p.get("sum") or 0) / 10000, 1)}
        )
    out.sort(key=lambda r: r["reach_id"])
    with open(data / "current-veg-area.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["reach_id", "veg_ha"])
        w.writeheader()
        w.writerows(out)
    total = sum(r["veg_ha"] for r in out)
    print(f"total corridor vegetation: {total:.0f} ha", flush=True)

    # C. Turbidity per reach: mean NDTI over water pixels + water area
    ndti_water = ndti.updateMask(water).rename("ndti")
    wat_area = water.multiply(ee.Image.pixelArea()).rename("water_m2")
    res_t = (
        ndti_water.addBands(wat_area)
        .reduceRegions(
            zone_fc,
            ee.Reducer.mean()
            .setOutputs(["ndti_mean"])
            .combine(ee.Reducer.sum().setOutputs(["water_m2"]), sharedInputs=False),
            10,
        )
        .getInfo()
    )
    trows = []
    for f in res_t["features"]:
        p = f["properties"]
        water_ha = round((p.get("water_m2") or 0) / 10000, 1)
        nd = p.get("ndti_mean")
        trows.append(
            {
                "reach_id": p["reach_id"],
                "ndti_mean": round(nd, 3)
                if nd is not None and water_ha >= min_water_ha
                else "",
                "water_ha": water_ha,
            }
        )
    trows.sort(key=lambda r: r["reach_id"])
    with open(data / "current-turbidity.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["reach_id", "ndti_mean", "water_ha"])
        w.writeheader()
        w.writerows(trows)
    print("wrote current-turbidity.csv", flush=True)

    # D. Vegetation on the mapped water surface (OSM polygons, outer rings)
    osm = json.loads((data / "osm-water-polygons.json").read_text())
    polys = []
    for e in osm["elements"]:
        if e["type"] == "way" and "geometry" in e:
            ring = [[p["lon"], p["lat"]] for p in e["geometry"]]
            if len(ring) >= 4 and ring[0] == ring[-1]:
                polys.append(ring)
        elif e["type"] == "relation":
            for m in e.get("members", []):
                if m.get("type") != "way" or "geometry" not in m:
                    continue
                if m.get("role") not in ("outer", ""):
                    continue
                ring = [[p["lon"], p["lat"]] for p in m["geometry"]]
                if len(ring) >= 4 and ring[0] == ring[-1]:
                    polys.append(ring)
    water_geom = ee.Geometry.MultiPolygon([[r] for r in polys], None, False)
    vrows = []
    for rid, a, b in reaches_km:
        seg = pts[int(a * 10) : int(b * 10) + 1]
        if len(seg) < 2:
            continue
        zone = ee.Geometry.LineString(seg).buffer(half_by_km[rid])
        inter = water_geom.intersection(zone, 1)
        stats = (
            veg.rename("veg")
            .reduceRegion(ee.Reducer.mean(), inter, 10, maxPixels=1e9)
            .combine(ee.Dictionary({"area": inter.area(1)}))
            .getInfo()
        )
        mapped_ha = round((stats.get("area") or 0) / 10000, 1)
        frac = stats.get("veg")
        vrows.append(
            {
                "reach_id": rid,
                "veg_on_water_frac": round(frac, 3)
                if frac is not None and mapped_ha >= 0.5
                else "",
                "mapped_water_ha": mapped_ha,
            }
        )
        print(f"veg-on-water reach {rid}: {vrows[-1]}", flush=True)
    with open(data / "current-veg-on-water.csv", "w", newline="") as f:
        w = csv.DictWriter(
            f, fieldnames=["reach_id", "veg_on_water_frac", "mapped_water_ha"]
        )
        w.writeheader()
        w.writerows(vrows)
    print("done")


if __name__ == "__main__":
    main()

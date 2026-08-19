#!/usr/bin/env python3
"""Waterway Sentinel-2 baseline (generic; --waterway <id>).

Generalized 19 Aug 2026 from the Buckingham Canal pilot when the Cooum
became waterway 2. Per-waterway parameters (seasonal windows, marquee
sites, chip cadence) live in <repo>/scripts/waterways/<id>.json.

Consumes the OSM-derived centerline + widths from
scripts/build_waterway_geometry.py (main repo) and produces, per 1-km
reach of the alignment:

  - effective water width (NDWI water area / reach length), two seasons
  - corridor vegetation fraction (NDVI > threshold), two seasons - a
    FLOATING + EMERGENT vegetation proxy (hyacinth screening, not a
    species call; banks within the corridor contaminate it and the chips
    are the check)
  - a true-color chip per chip_every_km segment + marquee sites

Cloud-masked S2 SR median composites (SCL classes 3/8/9/10/11 dropped).

NOTE: composites are windowed but Earth Engine collections are not
frozen; rerunning for an already-shipped waterway can move its numbers.
The Buckingham Canal baseline is the shipped Aug 2026 run - regenerate
only with intent.

Outputs under <research_dir>/:
  data/reaches-satellite.csv
  figures/chips/seg-km{A:02d}-{B:02d}.png
  figures/chips/site-{name}.png
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
import urllib.request
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(API_ROOT / ".env")
import ee  # noqa: E402

REPO = API_ROOT.parent


def load_cfg(waterway: str) -> dict:
    return json.loads((REPO / "scripts" / "waterways" / f"{waterway}.json").read_text())


def init_ee():
    creds = ee.ServiceAccountCredentials(None, os.environ["GEE_SERVICE_ACCOUNT_FILE"])
    ee.Initialize(creds, project=os.environ.get("GEE_CLOUD_PROJECT"))


def s2_median(start, end, region):
    def mask(img):
        scl = img.select("SCL")
        good = (
            scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10)).And(scl.neq(11))
        )
        return img.updateMask(good)

    return (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterDate(start, end)
        .filterBounds(region)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
        .map(mask)
        .median()
    )


def load_reaches(data: Path, default_half_w: float, margin: float):
    rows = list(csv.DictReader(open(data / "widths.csv")))
    pts = json.loads((data / "centerline.geojson").read_text())["features"][0][
        "geometry"
    ]["coordinates"]
    n_km = math.ceil((len(pts) - 1) * 100 / 1000)
    reaches = []
    for k in range(n_km):
        seg = pts[k * 10 : k * 10 + 11]
        if len(seg) < 2:
            continue
        ws = [
            float(r["width_m"])
            for r in rows
            if k <= float(r["chainage_km"]) < k + 1
            and r["width_m"]
            and r["flag"] == "OK"
        ]
        ws.sort()
        half = (ws[len(ws) // 2] / 2 + margin) if ws else default_half_w
        half = max(15, min(110, half))
        reaches.append(
            {
                "km": k,
                "coords": seg,
                "half_w": round(half, 1),
                "osm_median_w": ws[len(ws) // 2] if ws else "",
            }
        )
    return reaches, pts


def nearest_point(pts, site: dict):
    """Marquee-site anchor: lat-only anchors match by latitude (the canal's
    north-south convention); anchors carrying lon match in 2D."""
    if "lon" in site:
        lat0 = site["lat"]
        kx = math.cos(math.radians(lat0))
        return min(
            pts,
            key=lambda c: ((c[0] - site["lon"]) * kx) ** 2 + (c[1] - lat0) ** 2,
        )
    return min(pts, key=lambda c: abs(c[1] - site["lat"]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--waterway", required=True)
    args = ap.parse_args()
    cfg = load_cfg(args.waterway)
    sat = cfg["satellite"]
    base = REPO / cfg["research_dir"]
    data = base / "data"
    chips = base / "figures" / "chips"
    chips.mkdir(parents=True, exist_ok=True)
    dry = tuple(sat["windows"]["dry"])
    recent = tuple(sat["windows"]["recent"])
    ndvi_veg = sat["ndvi_veg"]

    init_ee()
    reaches, pts = load_reaches(data, sat["default_half_w"], sat["margin"])
    print(f"reaches: {len(reaches)}")

    feats = []
    for r in reaches:
        line = ee.Geometry.LineString(r["coords"])
        corridor = line.buffer(r["half_w"])
        feats.append(
            ee.Feature(
                corridor,
                {
                    "km": r["km"],
                    "half_w": r["half_w"],
                    "len_m": 100 * (len(r["coords"]) - 1),
                },
            )
        )
    fc = ee.FeatureCollection(feats)
    whole = fc.geometry().bounds().buffer(500)

    out = {
        r["km"]: {
            "km": r["km"],
            "osm_median_w": r["osm_median_w"],
            "half_w": r["half_w"],
        }
        for r in reaches
    }

    for tag, (a, b) in {"dry": dry, "recent": recent}.items():
        img = s2_median(a, b, whole)
        ndwi = img.normalizedDifference(["B3", "B8"]).rename("ndwi")
        ndvi = img.normalizedDifference(["B8", "B4"]).rename("ndvi")
        water = ndwi.gt(0.0)
        veg = ndvi.gt(ndvi_veg)
        stack = (
            water.rename("water")
            .addBands(veg.rename("veg"))
            .addBands(ee.Image.pixelArea().rename("area"))
        )

        def per_reach(f):
            s = stack.updateMask(1).reduceRegion(
                reducer=ee.Reducer.mean()
                .forEachBand(stack.select(["water", "veg"]))
                .combine(
                    ee.Reducer.sum().forEachBand(stack.select(["area"])),
                    sharedInputs=False,
                ),
                geometry=f.geometry(),
                scale=10,
                maxPixels=1e9,
            )
            warea = ee.Number(s.get("area")).multiply(ee.Number(s.get("water")))
            eff_w = warea.divide(ee.Number(f.get("len_m")))
            return f.set(
                {
                    "water_frac": s.get("water"),
                    "veg_frac": s.get("veg"),
                    "eff_width_m": eff_w,
                }
            )

        res = fc.map(per_reach).getInfo()
        for feat in res["features"]:
            p = feat["properties"]
            k = p["km"]
            out[k][f"water_frac_{tag}"] = round(p.get("water_frac") or 0, 3)
            out[k][f"veg_frac_{tag}"] = round(p.get("veg_frac") or 0, 3)
            out[k][f"eff_width_m_{tag}"] = round(p.get("eff_width_m") or 0, 1)
        print(f"  {tag} composite reduced")

    rows = [out[k] for k in sorted(out)]
    fields = list(rows[0].keys())
    with open(data / "reaches-satellite.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print("wrote reaches-satellite.csv")

    # ---------- chips ----------
    img = s2_median(*recent, whole)
    vis = {"bands": ["B4", "B3", "B2"], "min": 0, "max": 2800, "gamma": 1.15}

    def save_thumb(region, path, dim=900):
        url = img.visualize(**vis).getThumbURL(
            {"region": region, "dimensions": dim, "format": "png"}
        )
        with urllib.request.urlopen(url, timeout=120) as resp:
            path.write_bytes(resp.read())

    every = sat["chip_every_km"]
    for k0 in range(0, len(reaches), every):
        ks = [r for r in reaches if k0 <= r["km"] < k0 + every]
        if not ks:
            continue
        coords = [c for r in ks for c in r["coords"]]
        region = ee.Geometry.LineString(coords).buffer(sat["chip_buffer_m"]).bounds()
        p = chips / f"seg-km{k0:02d}-{min(k0 + every, len(reaches)):02d}.png"
        try:
            save_thumb(region, p)
            print("chip", p.name)
        except Exception as exc:  # noqa: BLE001
            print("chip FAILED", p.name, exc)

    # Marquee sites: the single clearest recent scene (crisper than a
    # median blend) at ~2x native scale - no fake upscale past 10 m physics.
    def clearest_scene(region):
        col = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterDate(*recent)
            .filterBounds(region)
            .sort("CLOUDY_PIXEL_PERCENTAGE")
        )
        img = ee.Image(col.first())
        date = ee.Date(img.get("system:time_start")).format("YYYY-MM-dd")
        return img, date.getInfo()

    for name, site in sat["sites"].items():
        if name.startswith("_"):  # config-level notes, not sites
            continue
        best = nearest_point(pts, site)
        half = site["half_m"]
        region = ee.Geometry.Point(best).buffer(half).bounds()
        p = chips / f"site-{name}.png"
        try:
            scene, date = clearest_scene(region)
            dim = min(600, max(220, int(half * 2 / 10) * 2))
            url = scene.visualize(**vis).getThumbURL(
                {"region": region, "dimensions": dim, "format": "png"}
            )
            with urllib.request.urlopen(url, timeout=120) as resp:
                p.write_bytes(resp.read())
            print("chip", p.name, f"single scene {date}, {dim}px")
        except Exception as exc:  # noqa: BLE001
            print("chip FAILED", p.name, exc)

    print("done")


if __name__ == "__main__":
    main()

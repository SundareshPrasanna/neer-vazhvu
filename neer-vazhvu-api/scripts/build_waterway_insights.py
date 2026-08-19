#!/usr/bin/env python3
"""Waterway insights (generic; --waterway <id>): three derived layers.

Generalized 19 Aug 2026 from the Buckingham Canal pilot when the Cooum
became waterway 2. Per-waterway parameters (reach table, mouths, calendar
range) live in <repo>/scripts/waterways/<id>.json.

A. THE BUILT EDGE (rooftops): Google Open Buildings v3 footprints within
   50 m and 100 m of the centerline, per reach: building count + rooftop
   area. Neutral framing by design: "the built edge", never "encroachment"
   (that word belongs to WRD's registers, not our satellite proxy).
B. THE VEGETATION CALENDAR: monthly corridor vegetation fraction
   (NDVI > threshold) per reach across the configured years: the
   hyacinth/weed seasonality record.
C. MOUTH-STATE CLIMATOLOGY: JRC Global Surface Water monthly history
   (1984-2021) sampled at the configured sea mouths: how often each mouth
   has been open, by calendar month - the sand-bar calendar.

Outputs -> <research_dir>/data/:
   built-edge.csv, vegetation-calendar.csv, mouth-climatology.csv
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


def init_ee():
    creds = ee.ServiceAccountCredentials(None, os.environ["GEE_SERVICE_ACCOUNT_FILE"])
    ee.Initialize(creds, project=os.environ.get("GEE_CLOUD_PROJECT"))


def reach_lines(data: Path, reaches_km, sample_m: float):
    pts = json.loads((data / "centerline.geojson").read_text())["features"][0][
        "geometry"
    ]["coordinates"]
    ppk = round(1000 / sample_m)  # centerline points per km
    out = []
    for rid, a, b in reaches_km:
        seg = pts[int(a * ppk) : int(b * ppk) + 1]
        if len(seg) >= 2:
            out.append((rid, ee.Geometry.LineString(seg)))
    return out


def built_edge(data: Path, lines):
    fc = ee.FeatureCollection("GOOGLE/Research/open-buildings/v3/polygons")
    rows = []
    for rid, line in lines:
        row = {"reach_id": rid}
        for dist in (50, 100):
            zone = line.buffer(dist)
            sel = fc.filterBounds(zone).filter(ee.Filter.gte("confidence", 0.7))
            n = sel.size()
            area = sel.reduceColumns(ee.Reducer.sum(), ["area_in_meters"]).get("sum")
            d = ee.Dictionary({"n": n, "area": area}).getInfo()
            row[f"buildings_{dist}m"] = int(d["n"] or 0)
            row[f"rooftop_m2_{dist}m"] = round(float(d["area"] or 0))
        rows.append(row)
        print(f"built-edge reach {rid}: {row}", flush=True)
    with open(data / "built-edge.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def veg_calendar(data: Path, lines, cal, ndvi_veg):
    def mask(img):
        scl = img.select("SCL")
        good = (
            scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10)).And(scl.neq(11))
        )
        return img.updateMask(good)

    zones = ee.FeatureCollection(
        [ee.Feature(line.buffer(40), {"reach_id": rid}) for rid, line in lines]
    )
    col = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
        .map(mask)
    )
    rows = []
    for year in range(cal["start_year"], cal["end_year"] + 1):
        for month in range(1, 13):
            if year == cal["end_year"] and month > cal["end_month"]:
                break
            start = ee.Date.fromYMD(year, month, 1)
            m = col.filterDate(start, start.advance(1, "month")).median()
            veg = m.normalizedDifference(["B8", "B4"]).gt(ndvi_veg)
            stats = (
                veg.rename("veg").reduceRegions(zones, ee.Reducer.mean(), 10).getInfo()
            )
            for feat in stats["features"]:
                p = feat["properties"]
                rows.append(
                    {
                        "year": year,
                        "month": month,
                        "reach_id": p["reach_id"],
                        "veg_frac": round(p["mean"], 3)
                        if p.get("mean") is not None
                        else "",
                    }
                )
            print(f"veg calendar {year}-{month:02d}", flush=True)
    with open(data / "vegetation-calendar.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["year", "month", "reach_id", "veg_frac"])
        w.writeheader()
        w.writerows(rows)


def mouth_climatology(data: Path, mouths):
    hist = ee.ImageCollection("JRC/GSW1_4/MonthlyHistory")
    rows = []
    for name, (lon, lat) in mouths.items():
        pt = ee.Geometry.Point([lon, lat]).buffer(120)

        def per_img(img):
            frac = img.eq(2).reduceRegion(ee.Reducer.mean(), pt, 30).get("water")
            return ee.Feature(
                None,
                {"month": img.get("month"), "year": img.get("year"), "open_frac": frac},
            )

        feats = (
            hist.map(per_img)
            .filter(ee.Filter.notNull(["open_frac"]))
            .getInfo()["features"]
        )
        by_month: dict[int, list[float]] = {m: [] for m in range(1, 13)}
        for f in feats:
            p = f["properties"]
            by_month[int(p["month"])].append(float(p["open_frac"]))
        for m in range(1, 13):
            vals = by_month[m]
            open_share = sum(1 for v in vals if v > 0.3) / len(vals) if vals else None
            rows.append(
                {
                    "mouth": name,
                    "month": m,
                    "n_years": len(vals),
                    "share_open": round(open_share, 2)
                    if open_share is not None
                    else "",
                }
            )
        print(f"mouth {name} done", flush=True)
    with open(data / "mouth-climatology.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["mouth", "month", "n_years", "share_open"])
        w.writeheader()
        w.writerows(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--waterway", required=True)
    args = ap.parse_args()
    cfg = json.loads(
        (REPO / "scripts" / "waterways" / f"{args.waterway}.json").read_text()
    )
    data = REPO / cfg["research_dir"] / "data"
    reaches_km = [tuple(r) for r in cfg["reaches_km"]]

    init_ee()
    lines = reach_lines(data, reaches_km, cfg["geometry"]["sample_m"])
    print(f"{len(lines)} reach geometries")
    built_edge(data, lines)
    mouth_climatology(data, cfg["mouths"])
    veg_calendar(data, lines, cfg["veg_calendar"], cfg["satellite"]["ndvi_veg"])
    print("all insights written")


if __name__ == "__main__":
    main()

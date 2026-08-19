#!/usr/bin/env python3
"""Buckingham Canal insights v2: three derived layers for the waterway page.

A. THE BUILT EDGE (rooftops): Google Open Buildings v3 footprints within
   50 m and 100 m of the centerline, per reach: building count + rooftop
   area. Neutral framing by design: "the built edge", never "encroachment"
   (that word belongs to WRD's registers, not our satellite proxy).
B. THE VEGETATION CALENDAR: monthly corridor vegetation fraction
   (NDVI > 0.35) per reach, Jan 2019 - Aug 2026: the hyacinth/weed
   seasonality record, with the 2026 Okkiyam anomaly visible in context.
C. MOUTH-STATE CLIMATOLOGY: JRC Global Surface Water monthly history
   (1984-2021) sampled at the four sea mouths: how often each mouth has
   been open, by calendar month - the sand-bar calendar.

Outputs -> docs/research/buckingham-canal/data/:
   built-edge.csv, vegetation-calendar.csv, mouth-climatology.csv
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

REACHES = [  # id, km_start, km_end (dossier master table)
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
MOUTHS = {
    "ennore-creek": (80.3290, 13.2260),
    "cooum": (80.2910, 13.0700),
    "adyar": (80.2775, 13.0125),
    "muttukadu-kovalam": (80.2540, 12.7910),
}
NDVI_VEG = 0.35


def init_ee():
    creds = ee.ServiceAccountCredentials(None, os.environ["GEE_SERVICE_ACCOUNT_FILE"])
    ee.Initialize(creds, project=os.environ.get("GEE_CLOUD_PROJECT"))


def reach_lines():
    pts = json.loads((DATA / "centerline.geojson").read_text())["features"][0][
        "geometry"
    ]["coordinates"]
    out = []
    for rid, a, b in REACHES:
        seg = pts[int(a * 10) : int(b * 10) + 1]
        if len(seg) >= 2:
            out.append((rid, ee.Geometry.LineString(seg)))
    return out


def built_edge(lines):
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
    with open(DATA / "built-edge.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def veg_calendar(lines):
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
    for year in range(2019, 2027):
        for month in range(1, 13):
            if year == 2026 and month > 8:
                break
            start = ee.Date.fromYMD(year, month, 1)
            m = col.filterDate(start, start.advance(1, "month")).median()
            veg = m.normalizedDifference(["B8", "B4"]).gt(NDVI_VEG)
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
    with open(DATA / "vegetation-calendar.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["year", "month", "reach_id", "veg_frac"])
        w.writeheader()
        w.writerows(rows)


def mouth_climatology():
    hist = ee.ImageCollection("JRC/GSW1_4/MonthlyHistory")
    rows = []
    for name, (lon, lat) in MOUTHS.items():
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
    with open(DATA / "mouth-climatology.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["mouth", "month", "n_years", "share_open"])
        w.writeheader()
        w.writerows(rows)


def main():
    init_ee()
    lines = reach_lines()
    print(f"{len(lines)} reach geometries")
    built_edge(lines)
    mouth_climatology()
    veg_calendar(lines)
    print("all insights written")


if __name__ == "__main__":
    main()

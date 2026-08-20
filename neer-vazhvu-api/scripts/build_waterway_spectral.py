#!/usr/bin/env python3
"""Spectral channel-width estimates for OSM-blind transects (--waterway <id>).

Where a transect finds no OSM-traced water surface (NO_POLYGON) and no
interval within snapping range (CENTER_DRY), estimate the channel width
spectrally: water absorbs near-infrared even when dark, turbid or
sewage-laden - exactly the conditions where the NDWI threshold fails on
narrow channels. Along each blind transect we sample the recent
Sentinel-2 composite's B8 (NIR) every 10 m for +/-150 m and read the
width of the dark run containing (or nearest within 20 m of) the
centreline.

These are ESTIMATES, shipped with their own flag (SPECTRAL) and never
merged into measured medians or confidence tiers. The same pass samples
a calibration set of OSM-measured transects and reports agreement
(median absolute difference and bias), which the page's methods section
states verbatim.

Outputs -> <research_dir>/data/:
  widths-spectral.csv       (chainage_km, w_spectral_m, center_dark)
  widths-spectral-meta.json (threshold, window, calibration stats)
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(API_ROOT / ".env")
import ee  # noqa: E402

REPO = API_ROOT.parent

NIR_DARK = 1100  # L2A reflectance x10000; open water reads well below this
STEP_M = 10.0
HALF_M = 150.0
CAL_N = 150  # OSM-measured transects sampled for validation


def local_xy(lat0: float):
    R = 6371000.0
    return (
        math.radians(1) * R * math.cos(math.radians(lat0)),
        math.radians(1) * R,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--waterway", required=True)
    args = ap.parse_args()
    cfg = json.loads(
        (REPO / "scripts" / "waterways" / f"{args.waterway}.json").read_text()
    )
    data = REPO / cfg["research_dir"] / "data"
    recent = tuple(cfg["satellite"]["windows"]["recent"])
    sample_m = cfg["geometry"]["sample_m"]

    creds = ee.ServiceAccountCredentials(None, os.environ["GEE_SERVICE_ACCOUNT_FILE"])
    ee.Initialize(creds, project=os.environ.get("GEE_CLOUD_PROJECT"))

    pts = json.loads((data / "centerline.geojson").read_text())["features"][0][
        "geometry"
    ]["coordinates"]
    widths = list(csv.DictReader(open(data / "widths.csv")))

    def perp(i: int):
        j0, j1 = max(0, i - 1), min(len(pts) - 1, i + 1)
        kx, ky = local_xy(pts[i][1])
        dx = (pts[j1][0] - pts[j0][0]) * kx
        dy = (pts[j1][1] - pts[j0][1]) * ky
        n = math.hypot(dx, dy) or 1.0
        return -dy / n, dx / n

    blind = [
        (int(round(float(r["chainage_km"]) * 1000 / sample_m)), r)
        for r in widths
        if r["flag"] in ("NO_POLYGON", "CENTER_DRY")
    ]
    ok = [
        (int(round(float(r["chainage_km"]) * 1000 / sample_m)), r)
        for r in widths
        if r["flag"] == "OK"
    ]
    cal = ok[:: max(1, len(ok) // CAL_N)][:CAL_N]
    print(f"blind transects: {len(blind)}  calibration: {len(cal)}")

    feats = []
    n_off = int(HALF_M / STEP_M)
    for kind, group in (("blind", blind), ("cal", cal)):
        for ti, (i, r) in enumerate(group):
            px, py = perp(i)
            kx, ky = local_xy(pts[i][1])
            for oi in range(-n_off, n_off + 1):
                d = oi * STEP_M
                lon = pts[i][0] + (px * d) / kx
                lat = pts[i][1] + (py * d) / ky
                feats.append(
                    ee.Feature(
                        ee.Geometry.Point([lon, lat]),
                        {"tid": f"{kind}:{ti}", "oi": oi},
                    )
                )

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
        .select(["B8"])
    )

    vals: dict[str, dict[int, float]] = {}
    CHUNK = 3000
    for s in range(0, len(feats), CHUNK):
        fc = ee.FeatureCollection(feats[s : s + CHUNK])
        res = med.sampleRegions(collection=fc, scale=10, geometries=False).getInfo()
        for f in res["features"]:
            p = f["properties"]
            vals.setdefault(p["tid"], {})[p["oi"]] = p.get("B8")
        print(f"sampled {min(s + CHUNK, len(feats))}/{len(feats)}", flush=True)

    def dark_width(series: dict[int, float]):
        dark = {oi for oi, v in series.items() if v is not None and v < NIR_DARK}
        if not dark:
            return None, False
        # run containing the centre, else nearest dark sample within 20 m
        start = (
            0 if 0 in dark else next((oi for oi in (1, -1, 2, -2) if oi in dark), None)
        )
        if start is None:
            return None, False
        lo = hi = start
        while (lo - 1) in dark:
            lo -= 1
        while (hi + 1) in dark:
            hi += 1
        return (hi - lo + 1) * STEP_M, 0 in dark

    # calibration: spectral vs OSM on measured transects
    diffs = []
    for ti, (i, r) in enumerate(cal):
        w, _ = dark_width(vals.get(f"cal:{ti}", {}))
        if w is not None:
            diffs.append(w - float(r["width_m"]))
    diffs.sort()
    med_abs = sorted(abs(d) for d in diffs)[len(diffs) // 2] if diffs else None
    bias = diffs[len(diffs) // 2] if diffs else None
    detect = len(diffs) / len(cal) if cal else 0
    print(
        f"calibration: detected water on {len(diffs)}/{len(cal)} measured "
        f"transects; median |spectral-OSM| = {med_abs} m; median bias = {bias} m"
    )

    rows = []
    found = 0
    for ti, (i, r) in enumerate(blind):
        w, center = dark_width(vals.get(f"blind:{ti}", {}))
        if w is not None:
            found += 1
        rows.append(
            {
                "chainage_km": r["chainage_km"],
                "w_spectral_m": round(w, 1) if w is not None else "",
                "center_dark": int(center),
            }
        )
    with open(data / "widths-spectral.csv", "w", newline="") as f:
        wtr = csv.DictWriter(
            f, fieldnames=["chainage_km", "w_spectral_m", "center_dark"]
        )
        wtr.writeheader()
        wtr.writerows(rows)
    (data / "widths-spectral-meta.json").write_text(
        json.dumps(
            {
                "method": "Sentinel-2 recent-composite B8 (NIR) dark-run width, "
                "10 m sampling, +/-150 m per transect",
                "nir_dark_threshold": NIR_DARK,
                "window": list(recent),
                "calibration": {
                    "n": len(cal),
                    "detected": len(diffs),
                    "detect_rate": round(detect, 3),
                    "median_abs_diff_m": med_abs,
                    "median_bias_m": bias,
                },
                "blind_transects": len(blind),
                "estimated": found,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"estimated {found}/{len(blind)} blind transects -> widths-spectral.csv")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Smoke test for the Planet Insights Platform / Sentinel Hub API path on ONE water body.

Two calls, both on Sentinel-2 L2A (public data, included in every plan and in the
Copernicus Data Space free tier), so this proves the pipeline pattern before any
PlanetScope data package is bought:

  1. Statistics API: monthly MNDWI water fraction of the body polygon over the last
     12 months, clear pixels only (SCL cloud/shadow classes excluded). This is the
     T1 screen's C1/C2 primitive, computed server-side, no scene downloaded.
  2. Process API: one true-colour PNG of the body plus its 1 km halo, least-cloudy
     mosaic of the last 90 days. This is the deep-zoom chip primitive.

Both print the processing units the platform charged (x-processingunits-spent
header), which is the number the plan's compute estimate needs.

Endpoints (pick with SH_BASE; both speak the same API):
  Planet Insights Platform   https://services.sentinel-hub.com       (default)
  Copernicus Data Space      https://sh.dataspace.copernicus.eu      (free tier)

Credentials: an OAuth client (id + secret) created in the platform dashboard.
  export SH_CLIENT_ID=...  SH_CLIENT_SECRET=...  [SH_BASE=...]

Usage:
  python3 scripts/smoke_test_sentinel_hub.py --body-id porur
  python3 scripts/smoke_test_sentinel_hub.py --body-id porur --months 6 --out /tmp/porur

Needs only `requests` (already in the repo's Python environments).
"""
import argparse
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent

TOKEN_URLS = {
    "https://services.sentinel-hub.com": "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token",
    "https://sh.dataspace.copernicus.eu": "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
}

# Statistics evalscript: water = MNDWI > 0 on clear pixels; dataMask carries the clear mask
# so `mean` of `water` is the water fraction of CLEAR pixels and sampleCount is the clear count.
STATS_EVALSCRIPT = """//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B03", "B11", "SCL", "dataMask"] }],
    output: [
      { id: "water", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  // SCL: 0 nodata, 1 saturated, 3 cloud shadow, 8 cloud medium, 9 cloud high, 10 cirrus
  var cloudy = (s.SCL == 0 || s.SCL == 1 || s.SCL == 3 || s.SCL == 8 || s.SCL == 9 || s.SCL == 10);
  var mndwi = (s.B03 - s.B11) / (s.B03 + s.B11 + 1e-6);
  return {
    water: [mndwi > 0 ? 1 : 0],
    dataMask: [cloudy ? 0 : s.dataMask]
  };
}
"""

CHIP_EVALSCRIPT = """//VERSION=3
function setup() {
  return { input: ["B04", "B03", "B02", "dataMask"], output: { bands: 3 } };
}
function evaluatePixel(s) {
  var g = 2.5;
  return [Math.min(1, g * s.B04), Math.min(1, g * s.B03), Math.min(1, g * s.B02)];
}
"""


def load_geometry(path: Path):
    fc = json.loads(path.read_text())
    feat = fc["features"][0] if fc.get("type") == "FeatureCollection" else fc
    return feat["geometry"]


def bbox_of(geom):
    xs, ys = [], []

    def walk(c):
        if isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        else:
            for k in c:
                walk(k)

    walk(geom["coordinates"])
    return [min(xs), min(ys), max(xs), max(ys)]


def get_token(base: str, cid: str, secret: str) -> str:
    url = TOKEN_URLS.get(base)
    if not url:
        sys.exit(f"No token URL known for SH_BASE={base}; add it to TOKEN_URLS")
    r = requests.post(url, data={"grant_type": "client_credentials", "client_id": cid, "client_secret": secret}, timeout=60)
    if r.status_code != 200:
        sys.exit(f"token request failed {r.status_code}: {r.text[:300]}")
    return r.json()["access_token"]


def pu_spent(resp) -> str:
    for k in ("x-processingunits-spent", "X-ProcessingUnits-Spent"):
        if k in resp.headers:
            return resp.headers[k]
    return "n/a (header absent)"


def run_statistics(base, token, geom, start, end, resx_deg):
    body = {
        "input": {
            "bounds": {"geometry": geom, "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}},
            "data": [{"type": "sentinel-2-l2a", "dataFilter": {"maxCloudCoverage": 80}}],
        },
        "aggregation": {
            "timeRange": {"from": f"{start}T00:00:00Z", "to": f"{end}T23:59:59Z"},
            "aggregationInterval": {"of": "P1M"},
            "resx": resx_deg,
            "resy": resx_deg,
            "evalscript": STATS_EVALSCRIPT,
        },
        "calculations": {"default": {"statistics": {"default": {"percentiles": {"k": [50]}}}}},
    }
    r = requests.post(f"{base}/api/v1/statistics", headers={"Authorization": f"Bearer {token}"}, json=body, timeout=300)
    print(f"[statistics] HTTP {r.status_code}; processing units spent: {pu_spent(r)}")
    if r.status_code != 200:
        print(r.text[:1500])
        return None
    data = r.json()
    print(f"{'month':<12}{'clear px':>10}{'water %':>10}")
    for it in data.get("data", []):
        m = it["interval"]["from"][:7]
        out = it.get("outputs", {}).get("water", {}).get("bands", {}).get("B0", {}).get("stats", {})
        n = out.get("sampleCount", 0)
        mean = out.get("mean")
        print(f"{m:<12}{n:>10}{('%.1f' % (100 * mean)) if mean is not None and n else '   (cloud)':>10}")
    return data


def run_chip(base, token, bbox, start, end, width, out_png: Path):
    w, s_, e, n = bbox
    aspect = (e - w) / max(n - s_, 1e-9) * 0.974  # ~cos(13 deg); a chip, not a measurement
    height = max(64, int(round(width / aspect)))
    body = {
        "input": {
            "bounds": {"bbox": bbox, "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}},
            "data": [{"type": "sentinel-2-l2a",
                      "dataFilter": {"timeRange": {"from": f"{start}T00:00:00Z", "to": f"{end}T23:59:59Z"},
                                     "maxCloudCoverage": 40, "mosaickingOrder": "leastCC"}}],
        },
        "output": {"width": width, "height": height, "responses": [{"identifier": "default", "format": {"type": "image/png"}}]},
        "evalscript": CHIP_EVALSCRIPT,
    }
    r = requests.post(f"{base}/api/v1/process", headers={"Authorization": f"Bearer {token}", "Accept": "image/png"}, json=body, timeout=300)
    print(f"[process]    HTTP {r.status_code}; processing units spent: {pu_spent(r)}")
    if r.status_code != 200:
        print(r.text[:1500])
        return None
    out_png.parent.mkdir(parents=True, exist_ok=True)
    out_png.write_bytes(r.content)
    print(f"[process]    wrote {out_png} ({len(r.content) // 1024} KB, {width}x{height})")
    return out_png


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-id", default="porur")
    ap.add_argument("--months", type=int, default=12)
    ap.add_argument("--chip-days", type=int, default=90)
    ap.add_argument("--width", type=int, default=800)
    ap.add_argument("--out", default=None, help="output dir for the chip (default: scratch under /tmp)")
    args = ap.parse_args()

    base = os.environ.get("SH_BASE", "https://services.sentinel-hub.com").rstrip("/")
    cid, secret = os.environ.get("SH_CLIENT_ID"), os.environ.get("SH_CLIENT_SECRET")
    if not (cid and secret):
        sys.exit("set SH_CLIENT_ID and SH_CLIENT_SECRET (OAuth client from the platform dashboard)")

    body_path = ROOT / "public/geojson/rich-bodies" / f"{args.body_id}.geojson"
    halo_path = ROOT / "public/geojson/rich-bodies" / f"{args.body_id}-buffer-1000m.geojson"
    if not body_path.exists():
        sys.exit(f"no polygon at {body_path}")
    geom = load_geometry(body_path)
    halo_bbox = bbox_of(load_geometry(halo_path)) if halo_path.exists() else bbox_of(geom)

    today = date.today()
    stats_start = (today.replace(day=1) - timedelta(days=30 * args.months)).replace(day=1)
    chip_start = today - timedelta(days=args.chip_days)
    out_dir = Path(args.out) if args.out else Path("/tmp/rich-bodies") / args.body_id / "sh-smoke"

    print(f"endpoint {base}\nbody {args.body_id}  polygon {body_path.name}  halo bbox {['%.4f' % v for v in halo_bbox]}")
    token = get_token(base, cid, secret)
    run_statistics(base, token, geom, stats_start.isoformat(), today.isoformat(), resx_deg=0.0001)
    run_chip(base, token, halo_bbox, chip_start.isoformat(), today.isoformat(), args.width, out_dir / f"{today.isoformat()}-truecolour.png")
    print("done")


if __name__ == "__main__":
    main()

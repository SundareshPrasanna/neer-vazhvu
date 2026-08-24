"""
T4b: Cumulative water-loss tint PNG for a rich-data water body.

Generates a single semi-transparent red PNG showing pixels that were
classified as "any water" (seasonal or permanent) in 3+ of the 5
baseline years (1988-1992) but NOT in 3+ of the 5 end years (2017-2021).

The 5-year windows are necessary because JRC YearlyHistory is noisy
year-to-year over India (Landsat 5 sparse coverage; monsoon variability).
Requiring "majority of years" stabilises the signal against single-year
artefacts (e.g. 1989 has zero water everywhere in our zones - a data
artefact, not literal).

Output:
  Locally:  /tmp/rich-bodies/<body_id>/tints/water-loss-cumulative.png
  Manifest: appended to public/data/rich-bodies/<body_id>-imagery-manifest.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from shapely.ops import unary_union
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "neer-vazhvu-api" / ".env")

import ee  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _rich_body_upload import upload_supabase  # noqa: E402

JRC_YEARLY = "JRC/GSW1_4/YearlyHistory"
BASELINE_YEARS = [1988, 1989, 1990, 1991, 1992]
END_YEARS = [2017, 2018, 2019, 2020, 2021]
MAJORITY_THRESHOLD = 3  # 3 of 5 years
TINT_COLOR = "ff2d2d"  # red
TINT_OPACITY = 0.55


def init_ee():
    project = os.environ["GEE_CLOUD_PROJECT"]
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    with open(key_file) as f:
        client_email = json.load(f)["client_email"]
    creds = ee.ServiceAccountCredentials(client_email, key_file=key_file)
    ee.Initialize(credentials=creds, project=project)
    print(f"GEE initialised: project={project}")


def load_polygon(path: Path):
    with open(path) as f:
        gj = json.load(f)
    return unary_union([shape(f["geometry"]) for f in gj["features"]])


def majority_water_count(years: list[int]) -> ee.Image:
    """Return per-pixel count of years where waterClass >= 2 (any water)."""
    images = [
        ee.Image(f"{JRC_YEARLY}/{y}").select("waterClass").gte(2).unmask(0)
        for y in years
    ]
    return ee.ImageCollection(images).sum()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-id", required=True)
    ap.add_argument("--max-dim", type=int, default=1200)
    ap.add_argument(
        "--include-direction",
        action="store_true",
        help="Also export a green tint for newly-water pixels (gained, not lost)",
    )
    ap.add_argument(
        "--upload",
        action="store_true",
        help="publish the tint PNG to Supabase storage and record its URL",
    )
    args = ap.parse_args()

    init_ee()

    manifest_path = (
        ROOT / "public/data/rich-bodies" / f"{args.body_id}-imagery-manifest.json"
    )
    with open(manifest_path) as f:
        manifest = json.load(f)
    bbox = manifest["chip_bbox_wsen"]
    ee_bbox = ee.Geometry.Rectangle(bbox)

    print(f"Body: {args.body_id}")
    print(f"Baseline: {BASELINE_YEARS} (water in >= {MAJORITY_THRESHOLD}/5)")
    print(f"End:      {END_YEARS} (water in >= {MAJORITY_THRESHOLD}/5)")

    baseline_count = majority_water_count(BASELINE_YEARS)
    end_count = majority_water_count(END_YEARS)

    baseline_water = baseline_count.gte(MAJORITY_THRESHOLD)
    end_water = end_count.gte(MAJORITY_THRESHOLD)

    # Lost: was water then, isn't now
    lost = baseline_water.And(end_water.Not())

    # Diagnostics
    lost_count = lost.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=ee_bbox,
        scale=30,
        maxPixels=int(1e9),
    ).getInfo().get("waterClass") or 0
    baseline_total = baseline_water.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=ee_bbox,
        scale=30,
        maxPixels=int(1e9),
    ).getInfo().get("waterClass") or 0
    end_total = end_water.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=ee_bbox,
        scale=30,
        maxPixels=int(1e9),
    ).getInfo().get("waterClass") or 0

    print()
    print(f"Inside chip bbox (~{((bbox[2]-bbox[0])*111e3)*((bbox[3]-bbox[1])*111e3)/1e6:.1f} km² nominal):")
    print(f"  Baseline majority-water pixels: {int(baseline_total):,}")
    print(f"  End      majority-water pixels: {int(end_total):,}")
    print(f"  Lost (was-water, no-longer):    {int(lost_count):,}  ({int(lost_count)*900/10000:.1f} ha at 30m)")

    visualized = lost.selfMask().visualize(
        min=0,
        max=1,
        palette=[TINT_COLOR],
        opacity=TINT_OPACITY,
    )

    url = visualized.getThumbURL(
        {
            "region": ee_bbox,
            "dimensions": args.max_dim,
            "format": "png",
            "crs": "EPSG:4326",
        }
    )
    print(f"\nFetching tint PNG...")
    with urllib.request.urlopen(url, timeout=120) as resp:
        data = resp.read()

    local_path = (
        Path("/tmp/rich-bodies") / args.body_id / "tints" / "water-loss-cumulative.png"
    )
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(data)
    print(f"Wrote {local_path}  ({len(data)//1024} KB)")

    remote_path = f"rich-bodies/{args.body_id}/tints/water-loss-cumulative.png"
    public_url = None
    if args.upload:
        try:
            public_url = upload_supabase(remote_path, data, "image/png")
            print(f"Uploaded: {public_url}")
        except Exception as e:
            print(f"Upload failed: {e}")

    # Update manifest
    manifest["tints"] = manifest.get("tints", {})
    manifest["tints"]["water_loss"] = {
        "local_path": str(local_path),
        "remote_path": remote_path,
        "public_url": public_url,
        "method": (
            f"Pixels classified as any water (seasonal or permanent) in "
            f">= {MAJORITY_THRESHOLD} of {BASELINE_YEARS} (baseline) AND "
            f"< {MAJORITY_THRESHOLD} of {END_YEARS} (end). "
            f"JRC GSW v1.4 YearlyHistory, 30 m, EC Open licence."
        ),
        "baseline_years": BASELINE_YEARS,
        "end_years": END_YEARS,
        "majority_threshold": MAJORITY_THRESHOLD,
        "lost_pixel_count": int(lost_count),
        "lost_area_ha_at_30m": round(int(lost_count) * 900 / 10000, 2),
        "baseline_majority_water_pixels": int(baseline_total),
        "end_majority_water_pixels": int(end_total),
        "tint_color_hex": TINT_COLOR,
        "tint_opacity": TINT_OPACITY,
        "size_kb": len(data) // 1024,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"Updated manifest: {manifest_path}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)

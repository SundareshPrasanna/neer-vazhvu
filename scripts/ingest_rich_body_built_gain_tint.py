"""
T4c: Cumulative built-gain tint PNG for a rich-data water body.

Generates a single semi-transparent amber PNG showing pixels that were
classified as "built" (Dynamic World class 6) in 2+ of the 3 end years
(2023-2025) but NOT in 2+ of the 3 baseline years (2016-2018).

Skips 2026 in end window because it's partial-year as of script run.
Uses 3-year majority for symmetry with the water-loss tint methodology.

Output:
  Locally:  /tmp/rich-bodies/<body_id>/tints/built-gain-cumulative.png
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

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "neer-vazhvu-api" / ".env")

import ee  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _rich_body_upload import upload_supabase  # noqa: E402

DW = "GOOGLE/DYNAMICWORLD/V1"
BUILT_CLASS_INDEX = 6
BASELINE_YEARS = [2016, 2017, 2018]
END_YEARS = [2023, 2024, 2025]
MAJORITY_THRESHOLD = 2  # 2 of 3 years
TINT_COLOR = "ffa53d"  # amber
TINT_OPACITY = 0.55


def init_ee():
    project = os.environ["GEE_CLOUD_PROJECT"]
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    with open(key_file) as f:
        client_email = json.load(f)["client_email"]
    creds = ee.ServiceAccountCredentials(client_email, key_file=key_file)
    ee.Initialize(credentials=creds, project=project)
    print(f"GEE initialised: project={project}")


def annual_built_majority(year: int) -> ee.Image:
    """For year, take per-pixel MODE label and return binary built mask."""
    coll = (
        ee.ImageCollection(DW)
        .filterDate(f"{year}-01-01", f"{year + 1}-01-01")
        .select("label")
    )
    mode = coll.mode()
    return mode.eq(BUILT_CLASS_INDEX).unmask(0)


def majority_built_count(years: list[int]) -> ee.Image:
    """Sum annual built masks across years - per-pixel count of built years."""
    images = [annual_built_majority(y) for y in years]
    return ee.ImageCollection(images).sum()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-id", required=True)
    ap.add_argument("--max-dim", type=int, default=1200)
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
    print(f"Baseline: {BASELINE_YEARS} (built in >= {MAJORITY_THRESHOLD}/3)")
    print(f"End:      {END_YEARS} (built in >= {MAJORITY_THRESHOLD}/3)")

    baseline_count = majority_built_count(BASELINE_YEARS)
    end_count = majority_built_count(END_YEARS)

    baseline_built = baseline_count.gte(MAJORITY_THRESHOLD)
    end_built = end_count.gte(MAJORITY_THRESHOLD)

    new_built = end_built.And(baseline_built.Not())

    # Diagnostics
    baseline_total = baseline_built.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=ee_bbox,
        scale=10,
        maxPixels=int(1e9),
    ).getInfo().get("label") or 0
    end_total = end_built.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=ee_bbox,
        scale=10,
        maxPixels=int(1e9),
    ).getInfo().get("label") or 0
    new_total = new_built.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=ee_bbox,
        scale=10,
        maxPixels=int(1e9),
    ).getInfo().get("label") or 0

    print()
    print(f"Inside chip bbox:")
    print(f"  Baseline majority-built pixels: {int(baseline_total):,}  ({int(baseline_total)/100:.1f} ha)")
    print(f"  End      majority-built pixels: {int(end_total):,}  ({int(end_total)/100:.1f} ha)")
    print(f"  New built (gained, end-only):   {int(new_total):,}  ({int(new_total)/100:.1f} ha)")

    visualized = new_built.selfMask().visualize(
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
        Path("/tmp/rich-bodies") / args.body_id / "tints" / "built-gain-cumulative.png"
    )
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(data)
    print(f"Wrote {local_path}  ({len(data)//1024} KB)")

    remote_path = f"rich-bodies/{args.body_id}/tints/built-gain-cumulative.png"
    public_url = None
    if args.upload:
        try:
            public_url = upload_supabase(remote_path, data, "image/png")
            print(f"Uploaded: {public_url}")
        except Exception as e:
            print(f"Upload failed: {e}")

    manifest["tints"] = manifest.get("tints", {})
    manifest["tints"]["built_gain"] = {
        "local_path": str(local_path),
        "remote_path": remote_path,
        "public_url": public_url,
        "method": (
            f"Pixels with annual mode label = built (class 6) in "
            f"< {MAJORITY_THRESHOLD} of {BASELINE_YEARS} (baseline) AND "
            f">= {MAJORITY_THRESHOLD} of {END_YEARS} (end) - i.e. ground that "
            f"was not built in the baseline window and is built in the end "
            f"window. Dynamic World V1, 10 m, CC-BY-4.0."
        ),
        "baseline_years": BASELINE_YEARS,
        "end_years": END_YEARS,
        "majority_threshold": MAJORITY_THRESHOLD,
        "new_built_pixel_count": int(new_total),
        "new_built_area_ha_at_10m": round(int(new_total) / 100, 2),
        "baseline_majority_built_pixels": int(baseline_total),
        "end_majority_built_pixels": int(end_total),
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

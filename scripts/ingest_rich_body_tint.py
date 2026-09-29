"""
Cumulative change tint PNG for a rich-data water body, one kind per run.

  --kind water-loss (T4b): semi-transparent red over pixels that were "any
    water" (JRC YearlyHistory waterClass >= 2, seasonal or permanent) in 3+ of
    the 5 baseline years (1988-1992) but NOT in 3+ of the 5 end years
    (2017-2021). Five-year windows because JRC is noisy year to year over India
    (sparse Landsat 5, monsoon variability; 1989 reads zero water everywhere).
  --kind built-gain (T4c): semi-transparent amber over pixels whose annual
    Dynamic World mode label is "built" (class 6) in 2+ of the 3 end years
    (2023-2025) but NOT in 2+ of the 3 baseline years (2016-2018). 2026 is
    skipped as partial; 3-year majority mirrors the water-loss method.

Output:
  Locally:  /tmp/rich-bodies/<body_id>/tints/<kind>-cumulative.png
  Manifest: tints.<water_loss|built_gain> in
            public/data/rich-bodies/<body_id>-imagery-manifest.json
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

JRC_YEARLY = "JRC/GSW1_4/YearlyHistory"
DW = "GOOGLE/DYNAMICWORLD/V1"
TINT_OPACITY = 0.55


def jrc_any_water(year: int) -> ee.Image:
    return ee.Image(f"{JRC_YEARLY}/{year}").select("waterClass").gte(2).unmask(0)


def dw_built(year: int) -> ee.Image:
    coll = (
        ee.ImageCollection(DW)
        .filterDate(f"{year}-01-01", f"{year + 1}-01-01")
        .select("label")
    )
    return coll.mode().eq(6).unmask(0)


# Tinted = in the majority of one window and not the other; `gain` picks which.
KINDS = {
    "water-loss": {
        "annual": jrc_any_water,
        "band": "waterClass",
        "scale": 30,
        "noun": "water",
        "baseline_years": [1988, 1989, 1990, 1991, 1992],
        "end_years": [2017, 2018, 2019, 2020, 2021],
        "threshold": 3,
        "gain": False,
        "color": "ff2d2d",  # red
        "change_label": "Lost (was-water, no-longer)",
        "manifest_key": "water_loss",
        "count_key": "lost_pixel_count",
        "area_key": "lost_area_ha_at_30m",
        "method": (
            "Pixels classified as any water (seasonal or permanent) in "
            ">= {t} of {b} (baseline) AND < {t} of {e} (end). "
            "JRC GSW v1.4 YearlyHistory, 30 m, EC Open licence."
        ),
    },
    "built-gain": {
        "annual": dw_built,
        "band": "label",
        "scale": 10,
        "noun": "built",
        "baseline_years": [2016, 2017, 2018],
        "end_years": [2023, 2024, 2025],
        "threshold": 2,
        "gain": True,
        "color": "ffa53d",  # amber
        "change_label": "New built (gained, end-only)",
        "manifest_key": "built_gain",
        "count_key": "new_built_pixel_count",
        "area_key": "new_built_area_ha_at_10m",
        "method": (
            "Pixels with annual mode label = built (class 6) in "
            "< {t} of {b} (baseline) AND >= {t} of {e} (end) - i.e. ground that "
            "was not built in the baseline window and is built in the end "
            "window. Dynamic World V1, 10 m, CC-BY-4.0."
        ),
    },
}


def init_ee():
    project = os.environ["GEE_CLOUD_PROJECT"]
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    with open(key_file) as f:
        client_email = json.load(f)["client_email"]
    creds = ee.ServiceAccountCredentials(client_email, key_file=key_file)
    ee.Initialize(credentials=creds, project=project)
    print(f"GEE initialised: project={project}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", required=True, choices=sorted(KINDS))
    ap.add_argument("--body-id", required=True)
    ap.add_argument("--max-dim", type=int, default=1200)
    ap.add_argument(
        "--upload",
        action="store_true",
        help="publish the tint PNG to Supabase storage and record its URL",
    )
    args = ap.parse_args()
    k = KINDS[args.kind]
    base_years, end_years, t = k["baseline_years"], k["end_years"], k["threshold"]

    init_ee()

    manifest_path = (
        ROOT / "public/data/rich-bodies" / f"{args.body_id}-imagery-manifest.json"
    )
    with open(manifest_path) as f:
        manifest = json.load(f)
    bbox = manifest["chip_bbox_wsen"]
    ee_bbox = ee.Geometry.Rectangle(bbox)

    print(f"Body: {args.body_id}")
    print(f"Baseline: {base_years} ({k['noun']} in >= {t}/{len(base_years)})")
    print(f"End:      {end_years} ({k['noun']} in >= {t}/{len(end_years)})")

    # Per-pixel count of years in the class, then the majority mask per window.
    baseline = ee.ImageCollection([k["annual"](y) for y in base_years]).sum().gte(t)
    end = ee.ImageCollection([k["annual"](y) for y in end_years]).sum().gte(t)
    changed = end.And(baseline.Not()) if k["gain"] else baseline.And(end.Not())

    def pixel_sum(img) -> int:
        return (
            img.reduceRegion(
                reducer=ee.Reducer.sum(),
                geometry=ee_bbox,
                scale=k["scale"],
                maxPixels=int(1e9),
            )
            .getInfo()
            .get(k["band"])
            or 0
        )

    changed_n, baseline_n, end_n = (
        pixel_sum(changed),
        pixel_sum(baseline),
        pixel_sum(end),
    )
    ha_per_px = k["scale"] ** 2 / 10000

    nominal_km2 = ((bbox[2] - bbox[0]) * 111e3) * ((bbox[3] - bbox[1]) * 111e3) / 1e6
    print()
    print(f"Inside chip bbox (~{nominal_km2:.1f} km² nominal):")
    print(f"  Baseline majority-{k['noun']} pixels: {int(baseline_n):,}")
    print(f"  End      majority-{k['noun']} pixels: {int(end_n):,}")
    print(
        f"  {k['change_label']}: {int(changed_n):,}  "
        f"({int(changed_n) * ha_per_px:.1f} ha at {k['scale']}m)"
    )

    visualized = changed.selfMask().visualize(
        min=0,
        max=1,
        palette=[k["color"]],
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
    print("\nFetching tint PNG...")
    with urllib.request.urlopen(url, timeout=120) as resp:
        data = resp.read()

    name = f"{args.kind}-cumulative.png"
    local_path = Path("/tmp/rich-bodies") / args.body_id / "tints" / name
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(data)
    print(f"Wrote {local_path}  ({len(data) // 1024} KB)")

    remote_path = f"rich-bodies/{args.body_id}/tints/{name}"
    public_url = None
    if args.upload:
        try:
            public_url = upload_supabase(remote_path, data, "image/png")
            print(f"Uploaded: {public_url}")
        except Exception as e:
            print(f"Upload failed: {e}")

    manifest["tints"] = manifest.get("tints", {})
    manifest["tints"][k["manifest_key"]] = {
        "local_path": str(local_path),
        "remote_path": remote_path,
        "public_url": public_url,
        "method": k["method"].format(t=t, b=base_years, e=end_years),
        "baseline_years": base_years,
        "end_years": end_years,
        "majority_threshold": t,
        k["count_key"]: int(changed_n),
        # (n * scale^2) / 10^4 is the same double as the old n / 100 and n * 900 / 10000.
        k["area_key"]: round(int(changed_n) * k["scale"] ** 2 / 10000, 2),
        f"baseline_majority_{k['noun']}_pixels": int(baseline_n),
        f"end_majority_{k['noun']}_pixels": int(end_n),
        "tint_color_hex": k["color"],
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

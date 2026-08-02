"""
Dynamic World V1 water-fraction trend (annual) per zone of a rich-data body.

Mirrors verify_rich_body_water_trend.py (JRC) and verify_rich_body_built_trend.py
(DW built). Used to extend the JRC water-trend series past JRC v1.4's 2021
cutoff: the rich-body panel chart splices the JRC series (1984-2021) with
this DW series (2022-now) to show one continuous water-fraction line.

Per zone, per year, reports the fraction of pixels whose annual MODE
Dynamic World label is "water" (class 0).

Output: public/data/rich-bodies/<body_id>-dw-water-trend.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from registry_license import registry_license
from nvdm_write import write_artifact

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "neer-vazhvu-api" / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import ee  # noqa: E402
from _rich_body_zones import load_body_zones  # noqa: E402

DW = "GOOGLE/DYNAMICWORLD/V1"
WATER_CLASS_INDEX = 0
# DW started June 2015; we splice with JRC at 2021/2022, so we generate
# 2022-2026 to extend the JRC series. Generating 2016-2021 too would
# give a calibration overlap with JRC for sanity-checking, but is not
# strictly required for the live chart - the renderer treats 2022+ as
# DW-sourced and 1984-2021 as JRC-sourced.
YEARS = list(range(2022, 2027))


def init_ee() -> None:
    project = os.environ["GEE_CLOUD_PROJECT"]
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    with open(key_file) as f:
        client_email = json.load(f)["client_email"]
    creds = ee.ServiceAccountCredentials(client_email, key_file=key_file)
    ee.Initialize(credentials=creds, project=project)
    print(f"GEE initialised: project={project}")


def shapely_to_ee(geom) -> ee.Geometry:
    return ee.Geometry(json.loads(json.dumps(geom.__geo_interface__)))


def water_fraction_series(ee_geom: ee.Geometry, label: str) -> dict:
    today = datetime.now(timezone.utc).date().isoformat()
    series: dict[str, dict] = {}

    def year_to_water_fraction(y):
        y = ee.Number(y).toInt()
        start = ee.Date.fromYMD(y, 1, 1)
        end_full = ee.Date.fromYMD(y.add(1), 1, 1)
        # Don't query past today: an incomplete year still gets a partial
        # composite over the elapsed window. The renderer surfaces
        # scene_count alongside the value so a partial year reads honestly.
        end = ee.Date(
            ee.Algorithms.If(end_full.millis().gt(ee.Date(today).millis()), ee.Date(today), end_full)
        )

        coll = (
            ee.ImageCollection(DW)
            .filterDate(start, end)
            .filterBounds(ee_geom)
            .select("label")
        )

        scene_count = coll.size()
        mode = coll.mode()
        water = mode.eq(WATER_CLASS_INDEX).rename("water")
        valid = mode.gte(0).rename("valid")

        result = water.addBands(valid).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=ee_geom,
            scale=10,
            maxPixels=int(1e9),
        )

        return ee.Feature(None, {
            "year": y,
            "scene_count": scene_count,
            "water_pixels": result.get("water"),
            "valid_pixels": result.get("valid"),
        })

    fc = ee.FeatureCollection([year_to_water_fraction(y) for y in YEARS])
    info = fc.getInfo()
    print(f"\n[{label}]")
    print(f"  {'year':<6}{'scenes':>8}{'water_px':>12}{'valid_px':>12}{'water%':>10}")

    for feat in info["features"]:
        p = feat["properties"]
        year = p["year"]
        scenes = p.get("scene_count") or 0
        water_px = p.get("water_pixels") or 0
        valid_px = p.get("valid_pixels") or 0
        frac = (water_px / valid_px) if valid_px else None
        pct = round(100 * frac, 2) if frac is not None else None
        print(
            f"  {year:<6}{int(scenes):>8}{int(water_px):>12,}{int(valid_px):>12,}"
            f"{pct if pct is not None else 'n/a':>9}%"
        )
        # `any_water_pct` here means the same thing as in the JRC series:
        # what % of valid pixels in this zone read as water for this year.
        # The renderer joins the two series on this key so the chart can
        # plot one continuous line.
        series[str(year)] = {
            "year": year,
            "scene_count": int(scenes),
            "water_pixels": int(water_px),
            "valid_pixels": int(valid_px),
            "any_water_pct": pct,
            "any_water_area_ha": round(water_px / 100, 2) if water_px else 0.0,
        }
    return series


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-id", required=True)
    ap.add_argument("--buffer-m", type=int, default=1000)
    args = ap.parse_args()

    init_ee()

    zones = load_body_zones(ROOT, args.body_id, buffer_metres=args.buffer_m)

    by_zone: dict[str, dict] = {}
    for label, geom in zones.items():
        ee_geom = shapely_to_ee(geom)
        by_zone[label] = water_fraction_series(ee_geom, label)

    payload = {
        "body_id": args.body_id,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "data_source": {
            "dataset": DW,
            "license": registry_license("google-dynamic-world"),
            "version": "Dynamic World V1",
            "resolution_m": 10,
            "revisit_days": "2-5 (Sentinel-2)",
            "method": "Per-pixel annual MODE label across all DW scenes intersecting the zone; water = class 0",
            "purpose": "Extends the JRC v1.4 water-trend series past its 2021 cutoff. Spliced with JRC at year 2021/2022 in the rich-body panel chart.",
            "known_limitations": [
                "Dynamic World started June 2015; this script covers 2022-present (the JRC gap)",
                "Current-year is partial (through script run date) - see scene_count + check headline",
                "Mode aggregation can be noisy in low-scene-count regions; check scene_count column",
                "Water class includes seasonal flooding + permanent open water + flooded vegetation",
                "DW is per-image per-pixel; methodology differs from JRC YearlyHistory (annual classifier). Expect small step at the splice year.",
            ],
        },
        "years": YEARS,
        "by_zone": by_zone,
        "headline_for_v0": _build_headline(by_zone),
    }

    out_path = (
        ROOT
        / "public/data/rich-bodies"
        / f"{args.body_id}-dw-water-trend.json"
    )
    write_artifact(out_path, payload)
    print(f"\nWrote {out_path}")
    print("\n=== Headline ===")
    for line in payload["headline_for_v0"]:
        print(f"  {line}")


def _build_headline(by_zone: dict) -> list[str]:
    lines = []
    for zone_label, series in by_zone.items():
        years_sorted = sorted(int(y) for y in series.keys())
        if not years_sorted:
            continue
        first_year = years_sorted[0]
        last_year = years_sorted[-1]
        first = series[str(first_year)]["any_water_pct"]
        last = series[str(last_year)]["any_water_pct"]
        if first is not None and last is not None:
            delta_pp = round(last - first, 2)
            sign = "+" if delta_pp >= 0 else ""
            lines.append(
                f"{zone_label}: any-water fraction {first}% ({first_year}) -> "
                f"{last}% ({last_year}), delta {sign}{delta_pp} pp"
            )
        else:
            lines.append(f"{zone_label}: insufficient data ({first_year}-{last_year})")
    return lines


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)

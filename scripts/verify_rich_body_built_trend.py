"""
Dynamic World V1 class-fraction trend (annual) per zone of a rich-data body.

Per zone, per year, reports the fraction of pixels whose annual MODE Dynamic
World label is the chosen class:

  --class built (default): "built" (class 6), 2016 - present. Used by the UI
    stats strip and the sources modal.
    Output: public/data/rich-bodies/<body_id>-dynamic-world-built-trend.json
  --class water: "water" (class 0), 2022 - present. Extends the JRC water-trend
    series (verify_rich_body_water_trend.py) past JRC v1.4's 2021 cutoff: the
    rich-body panel chart splices JRC (1984-2021) with this series (2022-now).
    Output: public/data/rich-bodies/<body_id>-dw-water-trend.json

verify_rich_body_dw_water_trend.py is the --class water entry point, kept
because the dw-water-trend artifacts name it as their producer.
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

CLASSES = {
    "built": {
        "index": 6,
        "years": list(range(2016, 2027)),
        "out": "dynamic-world-built-trend.json",
        "pct_key": "built_fraction_pct",
        "area_key": "built_area_ha",
        "headline": "built fraction",
        # Historical headline format: always "+", so a fall reads "+-x pp" in 17 published files.
        "always_plus": True,
        "purpose": None,
        "limitations": [
            "Dynamic World started June 2015; pre-2016 not included",
            "Current-year is partial (through script run date)",
            "Mode aggregation can be noisy in low-scene-count regions; check scene_count column",
            "Built class includes any built-up surface (roofs, roads, paved): not building-count-equivalent",
        ],
    },
    "water": {
        "index": 0,
        # Only the post-JRC gap; the renderer treats 2022+ as DW and 1984-2021 as JRC.
        "years": list(range(2022, 2027)),
        "out": "dw-water-trend.json",
        # Same key as the JRC series, which the renderer joins on for one continuous line.
        "pct_key": "any_water_pct",
        "area_key": "any_water_area_ha",
        "headline": "any-water fraction",
        "always_plus": False,
        "purpose": "Extends the JRC v1.4 water-trend series past its 2021 cutoff. Spliced with JRC at year 2021/2022 in the rich-body panel chart.",
        "limitations": [
            "Dynamic World started June 2015; this script covers 2022-present (the JRC gap)",
            "Current-year is partial (through script run date) - see scene_count + check headline",
            "Mode aggregation can be noisy in low-scene-count regions; check scene_count column",
            "Water class includes seasonal flooding + permanent open water + flooded vegetation",
            "DW is per-image per-pixel; methodology differs from JRC YearlyHistory (annual classifier). Expect small step at the splice year.",
        ],
    },
}


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


def class_fraction_series(ee_geom: ee.Geometry, label: str, cls: str) -> dict:
    c = CLASSES[cls]
    today = datetime.now(timezone.utc).date().isoformat()
    series: dict[str, dict] = {}

    def year_to_fraction(y):
        y = ee.Number(y).toInt()
        start = ee.Date.fromYMD(y, 1, 1)
        end_full = ee.Date.fromYMD(y.add(1), 1, 1)
        # A partial current year composites the elapsed window; scene_count shows it.
        end = ee.Date(
            ee.Algorithms.If(
                end_full.millis().gt(ee.Date(today).millis()), ee.Date(today), end_full
            )
        )

        coll = (
            ee.ImageCollection(DW)
            .filterDate(start, end)
            .filterBounds(ee_geom)
            .select("label")
        )

        scene_count = coll.size()
        mode = coll.mode()
        hit = mode.eq(c["index"]).rename(cls)
        valid = mode.gte(0).rename("valid")

        result = hit.addBands(valid).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=ee_geom,
            scale=10,
            maxPixels=int(1e9),
        )

        return ee.Feature(
            None,
            {
                "year": y,
                "scene_count": scene_count,
                f"{cls}_pixels": result.get(cls),
                "valid_pixels": result.get("valid"),
            },
        )

    fc = ee.FeatureCollection([year_to_fraction(y) for y in c["years"]])
    info = fc.getInfo()
    print(f"\n[{label}]")
    print(f"  {'year':<6}{'scenes':>8}{cls + '_px':>12}{'valid_px':>12}{cls + '%':>10}")

    for feat in info["features"]:
        p = feat["properties"]
        year = p["year"]
        scenes = p.get("scene_count") or 0
        hit_px = p.get(f"{cls}_pixels") or 0
        valid_px = p.get("valid_pixels") or 0
        frac = (hit_px / valid_px) if valid_px else None
        pct = round(100 * frac, 2) if frac is not None else None
        print(
            f"  {year:<6}{int(scenes):>8}{int(hit_px):>12,}{int(valid_px):>12,}"
            f"{pct if pct is not None else 'n/a':>9}%"
        )
        series[str(year)] = {
            "year": year,
            "scene_count": int(scenes),
            f"{cls}_pixels": int(hit_px),
            "valid_pixels": int(valid_px),
            c["pct_key"]: pct,
            c["area_key"]: round(hit_px / 100, 2) if hit_px else 0.0,
        }
    return series


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-id", required=True)
    ap.add_argument("--buffer-m", type=int, default=1000)
    ap.add_argument("--class", dest="cls", choices=sorted(CLASSES), default="built")
    args = ap.parse_args(argv)
    c = CLASSES[args.cls]

    init_ee()

    zones = load_body_zones(ROOT, args.body_id, buffer_metres=args.buffer_m)

    by_zone: dict[str, dict] = {}
    for label, geom in zones.items():
        ee_geom = shapely_to_ee(geom)
        by_zone[label] = class_fraction_series(ee_geom, label, args.cls)

    data_source = {
        "dataset": DW,
        "license": registry_license("google-dynamic-world"),
        "version": "Dynamic World V1",
        "resolution_m": 10,
        "revisit_days": "2-5 (Sentinel-2)",
        "method": f"Per-pixel annual MODE label across all DW scenes intersecting the zone; {args.cls} = class {c['index']}",
    }
    if c["purpose"]:
        data_source["purpose"] = c["purpose"]
    data_source["known_limitations"] = c["limitations"]
    payload = {
        "body_id": args.body_id,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "data_source": data_source,
        "years": c["years"],
        "by_zone": by_zone,
        "headline_for_v0": _build_headline(by_zone, c),
    }

    out_path = ROOT / "public/data/rich-bodies" / f"{args.body_id}-{c['out']}"
    write_artifact(out_path, payload)
    print(f"\nWrote {out_path}")
    print("\n=== Headline ===")
    for line in payload["headline_for_v0"]:
        print(f"  {line}")


def _build_headline(by_zone: dict, c: dict) -> list[str]:
    lines = []
    for zone_label, series in by_zone.items():
        years_sorted = sorted(int(y) for y in series.keys())
        if not years_sorted:
            continue
        first_year = years_sorted[0]
        last_year = years_sorted[-1]
        first = series[str(first_year)][c["pct_key"]]
        last = series[str(last_year)][c["pct_key"]]
        if first is not None and last is not None:
            delta_pp = round(last - first, 2)
            sign = "+" if c["always_plus"] or delta_pp >= 0 else ""
            lines.append(
                f"{zone_label}: {c['headline']} {first}% ({first_year}) -> "
                f"{last}% ({last_year}), delta {sign}{delta_pp} pp"
            )
        else:
            lines.append(f"{zone_label}: insufficient data ({first_year}-{last_year})")
    return lines


def cli(argv: list[str] | None = None) -> None:
    try:
        main(argv)
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    cli()

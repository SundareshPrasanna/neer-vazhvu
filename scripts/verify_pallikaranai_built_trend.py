"""
Complement to verify_pallikaranai_encroachment.py.

Where Open Buildings v3 gives a static 2023 building-count snapshot,
Dynamic World gives a per-year "fraction of pixels classified as built"
trend from 2016 to today. Together they answer:
  - snapshot: how many buildings exist now? (Open Buildings v3, June 2023)
  - trend:    is the built fraction still rising? (Dynamic World, 2016->2026)

Output: public/data/rich-bodies/pallikaranai-dynamic-world-built-trend.json

Methodology: for each calendar year, take the per-pixel MODE label across
all Dynamic World scenes intersecting each zone, then compute the fraction
of pixels whose dominant annual classification is "built" (class index 6).
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from shapely.geometry import shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "neer-vazhvu-api" / ".env")

import ee  # noqa: E402

DW = "GOOGLE/DYNAMICWORLD/V1"
BUILT_CLASS_INDEX = 6
YEARS = list(range(2016, 2027))  # 2016 to 2026 inclusive

# Dynamic World's 9 classes (for documentation):
DW_CLASSES = [
    "water", "trees", "grass", "flooded_vegetation", "crops",
    "shrub_and_scrub", "built", "bare", "snow_and_ice",
]


def init_ee() -> None:
    project = os.environ["GEE_CLOUD_PROJECT"]
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    with open(key_file) as f:
        client_email = json.load(f)["client_email"]
    creds = ee.ServiceAccountCredentials(client_email, key_file=key_file)
    ee.Initialize(credentials=creds, project=project)
    print(f"GEE initialised: project={project}")


def load_geom(path: Path):
    with open(path) as f:
        gj = json.load(f)
    return unary_union([shape(f["geometry"]) for f in gj["features"]])


def shapely_to_ee(geom) -> ee.Geometry:
    return ee.Geometry(json.loads(json.dumps(geom.__geo_interface__)))


def built_fraction_series(ee_geom: ee.Geometry, label: str) -> dict:
    """For each year in YEARS, compute fraction of pixels with annual mode label = built."""
    today = datetime.now(timezone.utc).date().isoformat()
    series = {}

    def year_to_built_fraction(y):
        y = ee.Number(y).toInt()
        start = ee.Date.fromYMD(y, 1, 1)
        end_full = ee.Date.fromYMD(y.add(1), 1, 1)
        end = ee.Date(ee.Algorithms.If(end_full.millis().gt(ee.Date(today).millis()), ee.Date(today), end_full))

        coll = (
            ee.ImageCollection(DW)
            .filterDate(start, end)
            .filterBounds(ee_geom)
            .select("label")
        )

        scene_count = coll.size()

        mode = coll.mode()
        built = mode.eq(BUILT_CLASS_INDEX).rename("built")
        valid = mode.gte(0).rename("valid")

        result = built.addBands(valid).reduceRegion(
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
                "built_pixels": result.get("built"),
                "valid_pixels": result.get("valid"),
            },
        )

    fc = ee.FeatureCollection([year_to_built_fraction(y) for y in YEARS])
    info = fc.getInfo()
    print(f"\n[{label}]")
    print(f"  {'year':<6}{'scenes':>8}{'built_px':>12}{'valid_px':>12}{'built%':>10}")

    for feat in info["features"]:
        p = feat["properties"]
        year = p["year"]
        scenes = p.get("scene_count") or 0
        built_px = p.get("built_pixels") or 0
        valid_px = p.get("valid_pixels") or 0
        frac = (built_px / valid_px) if valid_px else None
        pct = round(100 * frac, 2) if frac is not None else None
        print(
            f"  {year:<6}{int(scenes):>8}{int(built_px):>12,}{int(valid_px):>12,}"
            f"{pct if pct is not None else 'n/a':>9}%"
        )
        series[str(year)] = {
            "year": year,
            "scene_count": int(scenes),
            "built_pixels": int(built_px),
            "valid_pixels": int(valid_px),
            "built_fraction_pct": pct,
            "built_area_ha": round(built_px / 100, 2) if built_px else 0.0,
        }

    return series


def main() -> None:
    init_ee()

    base = ROOT / "public/geojson/rich-bodies"
    tnswa = load_geom(base / "pallikaranai.geojson")
    osm = load_geom(base / "pallikaranai-osm-ecological.geojson")
    buffer = load_geom(base / "pallikaranai-buffer-1000m.geojson")

    gap_tnswa_minus_osm = tnswa.difference(osm)
    halo_buffer_minus_tnswa = buffer.difference(tnswa)

    zones = [
        ("TNSWA gazetted (full)", tnswa),
        ("OSM ecological (full)", osm),
        ("Gap: TNSWA - OSM", gap_tnswa_minus_osm),
        ("Halo: 1km buffer - TNSWA (NGT no-build zone)", halo_buffer_minus_tnswa),
    ]

    by_zone = {}
    for label, geom in zones:
        ee_geom = shapely_to_ee(geom)
        by_zone[label] = built_fraction_series(ee_geom, label)

    payload = {
        "body_id": "pallikaranai",
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "data_source": {
            "dataset": DW,
            "license": "CC-BY-4.0",
            "version": "Dynamic World V1",
            "resolution_m": 10,
            "revisit_days": "2-5 (Sentinel-2)",
            "method": "Per-pixel annual MODE label across all DW scenes intersecting the zone; built = class 6",
            "known_limitations": [
                "Dynamic World started June 2015; pre-2016 not included",
                "2026 partial-year (through script run date)",
                "Mode aggregation can be noisy in low-scene-count regions; check scene_count column",
                "Built class includes any built-up surface (roofs, roads, paved): not building-count-equivalent",
            ],
        },
        "years": YEARS,
        "by_zone": by_zone,
        "headline_for_v0": _build_headline(by_zone),
    }

    out_path = ROOT / "public/data/rich-bodies/pallikaranai-dynamic-world-built-trend.json"
    out_path.write_text(json.dumps(payload, indent=2))
    print(f"\nWrote {out_path}")
    print("\n=== Headline ===")
    for line in payload["headline_for_v0"]:
        print(f"  {line}")


def _build_headline(by_zone: dict) -> list[str]:
    lines = []
    for zone_label, series in by_zone.items():
        years_sorted = sorted(int(y) for y in series.keys())
        first_year = years_sorted[0]
        last_year = years_sorted[-1]
        first = series[str(first_year)]["built_fraction_pct"]
        last = series[str(last_year)]["built_fraction_pct"]
        if first is not None and last is not None:
            delta_pp = round(last - first, 2)
            lines.append(
                f"{zone_label}: built fraction {first}% ({first_year}) -> "
                f"{last}% ({last_year}), delta +{delta_pp} pp"
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

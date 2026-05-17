"""
JRC Global Surface Water v1.4 yearly classification trend for Pallikaranai.

Companion to verify_pallikaranai_built_trend.py: where Dynamic World gives
the GROWING built-fraction story 2016-2026, JRC gives the LOSING water-
fraction story 1984-2021 (the v1.4 cutoff).

Per year, per zone, classify each 30 m pixel as:
  0 = no data / no observation
  1 = not water (dry)
  2 = seasonal water (wet some months)
  3 = permanent water (wet most months)

Output: public/data/rich-bodies/pallikaranai-jrc-water-trend.json

Years: 1984-2021 (v1.4 cutoff). 2022-present is a known gap - JRC has
not released a newer version. Extending to 2022+ requires computing our
own Landsat/S2 water mask matching JRC's methodology (deferred).
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

JRC_YEARLY = "JRC/GSW1_4/YearlyHistory"
YEARS = list(range(1984, 2022))  # JRC v1.4 covers 1984-2021 inclusive

CLASS_LABELS = {0: "no_data", 1: "not_water", 2: "seasonal", 3: "permanent"}


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


def water_class_series(ee_geom: ee.Geometry, label: str) -> dict:
    """Per year, count pixels in each water class within the zone."""
    def year_to_counts(y):
        y = ee.Number(y).toInt()
        img = ee.Image(f"{JRC_YEARLY}/{y.format('%d').getInfo()}").select("waterClass")
        hist = img.reduceRegion(
            reducer=ee.Reducer.frequencyHistogram(),
            geometry=ee_geom,
            scale=30,
            maxPixels=int(1e9),
        ).get("waterClass")
        return ee.Feature(None, {"year": y, "hist": hist})

    fc = ee.FeatureCollection([year_to_counts(y) for y in YEARS])
    info = fc.getInfo()

    print(f"\n[{label}]")
    print(f"  {'year':<6}{'no_data':>10}{'dry':>10}{'seasonal':>11}{'permanent':>12}{'any_water%':>12}")

    series = {}
    for feat in info["features"]:
        p = feat["properties"]
        year = int(p["year"])
        hist = p.get("hist") or {}
        c0 = int(float(hist.get("0", 0)))
        c1 = int(float(hist.get("1", 0)))
        c2 = int(float(hist.get("2", 0)))
        c3 = int(float(hist.get("3", 0)))
        total = c0 + c1 + c2 + c3
        valid = c1 + c2 + c3
        any_water = c2 + c3
        any_water_pct = round(100 * any_water / valid, 2) if valid else None
        permanent_pct = round(100 * c3 / valid, 2) if valid else None
        seasonal_pct = round(100 * c2 / valid, 2) if valid else None

        print(
            f"  {year:<6}{c0:>10,}{c1:>10,}{c2:>11,}{c3:>12,}"
            f"{any_water_pct if any_water_pct is not None else 'n/a':>11}%"
        )

        series[str(year)] = {
            "year": year,
            "pixels_no_data": c0,
            "pixels_not_water": c1,
            "pixels_seasonal": c2,
            "pixels_permanent": c3,
            "total_pixels": total,
            "valid_pixels": valid,
            "any_water_pct": any_water_pct,
            "permanent_pct": permanent_pct,
            "seasonal_pct": seasonal_pct,
            "any_water_area_ha": round(any_water * 900 / 10000, 2),  # 30m pixel = 900 m²
            "permanent_area_ha": round(c3 * 900 / 10000, 2),
        }

    return series


def main() -> None:
    init_ee()

    base = ROOT / "public/geojson/rich-bodies"
    tnswa = load_geom(base / "pallikaranai.geojson")
    osm = load_geom(base / "pallikaranai-osm-ecological.geojson")
    buffer = load_geom(base / "pallikaranai-buffer-1000m.geojson")

    gap = tnswa.difference(osm)
    halo = buffer.difference(tnswa)

    zones = [
        ("TNSWA gazetted (full)", tnswa),
        ("OSM ecological (full)", osm),
        ("Gap: TNSWA - OSM", gap),
        ("Halo: 1km buffer - TNSWA (NGT no-build zone)", halo),
    ]

    by_zone = {}
    for label, geom in zones:
        ee_geom = shapely_to_ee(geom)
        by_zone[label] = water_class_series(ee_geom, label)

    payload = {
        "body_id": "pallikaranai",
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "data_source": {
            "dataset": JRC_YEARLY,
            "version": "JRC Global Surface Water v1.4 (Pekel et al., Nature 2016, updated)",
            "license": "EC Open / public domain",
            "resolution_m": 30,
            "method": "Per-pixel annual water classification from Landsat 5/7/8 archives",
            "classes": CLASS_LABELS,
            "known_limitations": [
                "v1.4 cutoff is 2021. No 2022-present data; extending requires custom pipeline.",
                "Landsat 5 over India was sparse in 1984-1995; expect high no_data fractions in early years.",
                "30m resolution: bodies under ~2 ha have unreliable signal.",
                "JRC may misclassify marsh bed (damp but not wet) as 'not water' during dry season.",
            ],
        },
        "years": YEARS,
        "by_zone": by_zone,
        "headline_for_v0": _build_headline(by_zone),
    }

    out_path = ROOT / "public/data/rich-bodies/pallikaranai-jrc-water-trend.json"
    out_path.write_text(json.dumps(payload, indent=2))
    print(f"\nWrote {out_path}")
    print("\n=== Headline ===")
    for line in payload["headline_for_v0"]:
        print(f"  {line}")


def _build_headline(by_zone: dict) -> list[str]:
    lines = []
    for zone_label, series in by_zone.items():
        # Compare a reference baseline (avg of first 5 valid years) to the end
        years_sorted = sorted(int(y) for y in series.keys())
        baseline_years = []
        baseline_vals = []
        for y in years_sorted[:10]:
            v = series[str(y)]["any_water_pct"]
            if v is not None:
                baseline_years.append(y)
                baseline_vals.append(v)
                if len(baseline_vals) == 5:
                    break

        end_window = []
        for y in years_sorted[-5:]:
            v = series[str(y)]["any_water_pct"]
            if v is not None:
                end_window.append(v)

        if baseline_vals and end_window:
            base_avg = round(sum(baseline_vals) / len(baseline_vals), 1)
            end_avg = round(sum(end_window) / len(end_window), 1)
            delta_pp = round(end_avg - base_avg, 1)
            base_label = f"{baseline_years[0]}-{baseline_years[-1]} avg"
            end_label = f"{years_sorted[-5]}-{years_sorted[-1]} avg"
            lines.append(
                f"{zone_label}: any-water fraction {base_avg}% ({base_label}) -> "
                f"{end_avg}% ({end_label}), delta {delta_pp:+} pp"
            )
        else:
            lines.append(f"{zone_label}: insufficient valid years")
    return lines


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)

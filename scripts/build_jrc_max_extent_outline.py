#!/usr/bin/env python3
"""
A water body's outline from the satellite record, where no official or OSM
outline covers the water it has held.

JRC Global Surface Water's `max_extent` band marks every 30 m pixel where
water was seen at least once, 1984-2021. The outline is the connected region of
those pixels that contains a seed point inside the body (eight-connected,
within a radius), so a seasonal reservoir that has not filled in decades is
drawn at the largest area the satellite record shows it holding, not at the
remnant OSM traces today. It is NOT the full-supply area at FRL, which a
reservoir may not have reached since 1984; say so beside it.

Writes public/geojson/<city>-jrc-max-extent.geojson, one feature per body,
which scripts/fetch-rich-body-polygon.ts takes with --from-layer ... --match
name=<name>. Each feature carries the OSM element it pairs with (city-map
clicks match on osm_id).

Run:
  python3 scripts/build_jrc_max_extent_outline.py --city jaipur \\
      --body "Ramgarh|76.0464,27.049|way|126183859" --radius-m 6000
"""

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

import ee

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

SOURCE_ID = "jrc-global-surface-water"
ASSET = "JRC/GSW1_4/GlobalSurfaceWater"


def init_ee() -> None:
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    with open(key_file) as f:
        email = json.load(f)["client_email"]
    ee.Initialize(
        credentials=ee.ServiceAccountCredentials(email, key_file=key_file),
        project=os.environ["GEE_CLOUD_PROJECT"],
    )


def outline(lon: float, lat: float, radius_m: int) -> dict:
    seed = ee.Geometry.Point([lon, lat])
    roi = seed.buffer(radius_m).bounds()
    mask = ee.Image(ASSET).select("max_extent").selfMask().clip(roi)
    vectors = mask.reduceToVectors(
        geometry=roi,
        scale=30,
        geometryType="polygon",
        eightConnected=True,
        maxPixels=1e9,
    )
    hit = vectors.filterBounds(seed)
    if hit.size().getInfo() != 1:
        raise SystemExit(f"seed {lon},{lat}: no single max-extent region contains it")
    return hit.first().geometry().getInfo()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--city", required=True)
    ap.add_argument(
        "--body",
        action="append",
        required=True,
        help='"<name>|<lon>,<lat>|<osm type>|<osm id>"; the seed must lie inside the body',
    )
    ap.add_argument("--radius-m", type=int, default=6000)
    args = ap.parse_args()

    init_ee()
    features = []
    for spec in args.body:
        name, seed, osm_type, osm_id = spec.split("|")
        lon, lat = (float(v) for v in seed.split(","))
        geometry = outline(lon, lat, args.radius_m)
        features.append(
            {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "name": name,
                    "osm_type": osm_type,
                    "osm_id": int(osm_id),
                    "seed": [lon, lat],
                    "method": (
                        "Connected region of JRC Global Surface Water max_extent pixels "
                        f"(water seen at least once, 1984-2021) containing the seed, within "
                        f"{args.radius_m} m, eight-connected, 30 m."
                    ),
                },
            }
        )
        print(f"{name}: outline from JRC max extent", file=sys.stderr)

    out = {
        "nvdm": "1.0",
        "dataset": "geojson-layers/jrc-max-extent",
        "scope": {"kind": "city", "id": args.city},
        "provenance": {
            "sources": [
                {
                    "id": SOURCE_ID,
                    "title": "JRC Global Surface Water v1.4, max_extent band (1984-2021)",
                    "publisher": "European Commission Joint Research Centre / Google",
                    "license": registry_license(SOURCE_ID),
                    "role": "input",
                }
            ],
            "method": "derived",
            "produced_at": date.today().isoformat(),
            "produced_by": "scripts/build_jrc_max_extent_outline.py",
            "note": (
                "Each outline is the largest area the satellite record shows the body "
                "holding water, 1984-2021, not its full-supply area at FRL."
            ),
        },
        "type": "FeatureCollection",
        "features": features,
    }
    path = REPO_ROOT / "public" / "geojson" / f"{args.city}-jrc-max-extent.geojson"
    write_artifact(path, out)
    print(
        f"{len(features)} outline(s) -> {path.relative_to(REPO_ROOT)}", file=sys.stderr
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

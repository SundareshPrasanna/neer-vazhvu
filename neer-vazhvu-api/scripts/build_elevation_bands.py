#!/usr/bin/env python3
"""
Build public/data/elevation-bands-{city}.geojson - a granular ground-height
layer (hypsometric bands) for the flood-risk and water-bodies maps.

Source: FABDEM V1-2 via Earth Engine (satellite-derived 30 m DEM with
buildings and forests removed - true ground height), the same asset and
fetch path the catchment atlas uses (app/cascade/catchments.py).

Method: mosaic the city bbox -> mask to the city's official boundary
polygons (kills the sea, which FABDEM renders as ~0 m and would otherwise
swallow the lowest band) -> classify into height bands -> polygonize ->
simplify + drop slivers -> one MultiPolygon feature per band.

Mumbai bands are tuned to its flood story: nearly all chronic waterlogging
sits under 5 m.

Run:  python scripts/build_elevation_bands.py --city mumbai
Needs GEE credentials in .env (same as the cascade/GEE pipelines).
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

import numpy as np
import rasterio
import rasterio.features
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parent
sys.path.insert(0, str(API_ROOT))

from app.cascade.catchments import _fetch_fabdem_mosaic  # noqa: E402

CITIES = {
    "mumbai": {
        "bbox": (72.75, 18.85, 73.35, 19.55),  # the 9-corporation urban MMR
        "boundary": "public/geojson/mumbai-corporations-2024.geojson",
        # band edges (metres); labels derive from consecutive pairs
        "bands": [0, 2, 5, 10, 20, 50, 100],
    },
}

SIMPLIFY_DEG = 0.0004  # ~44 m - two DEM cells; bands, not spot heights
MIN_AREA_DEG2 = 4e-7  # ~0.5 ha - drop slivers


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="mumbai", choices=sorted(CITIES))
    ap.add_argument(
        "--dem", help="reuse an existing mosaic GeoTIFF instead of fetching"
    )
    args = ap.parse_args()
    cfg = CITIES[args.city]

    if args.dem:
        dem_path = Path(args.dem)
    else:
        dem_path = Path(tempfile.gettempdir()) / f"elevation_{args.city}_fabdem.tif"
        if not dem_path.exists():
            print(f"Fetching FABDEM mosaic for {args.city} {cfg['bbox']} ...")
            _fetch_fabdem_mosaic(cfg["bbox"], dem_path)
        else:
            print(f"Reusing cached mosaic {dem_path}")

    boundary_fc = json.loads((REPO_ROOT / cfg["boundary"]).read_text())
    land = unary_union([shape(f["geometry"]) for f in boundary_fc["features"]])

    with rasterio.open(dem_path) as src:
        dem = src.read(1).astype("float32")
        transform = src.transform
        land_mask = rasterio.features.geometry_mask(
            [mapping(land)], out_shape=dem.shape, transform=transform, invert=True
        )

    edges = cfg["bands"]
    features = []
    total_kept = 0
    for i in range(len(edges)):
        lo = edges[i]
        hi = edges[i + 1] if i + 1 < len(edges) else None
        sel = (
            land_mask
            & (dem >= lo)
            & ((dem < hi) if hi is not None else np.ones_like(land_mask))
        )
        if not sel.any():
            continue
        polys = []
        for geom, val in rasterio.features.shapes(
            sel.astype("uint8"), mask=sel, transform=transform
        ):
            if val != 1:
                continue
            g = shape(geom)
            if g.area < MIN_AREA_DEG2:
                continue
            polys.append(g)
        if not polys:
            continue
        merged = unary_union(polys).simplify(SIMPLIFY_DEG, preserve_topology=True)
        label = f"{lo}-{hi} m" if hi is not None else f"{lo} m +"
        features.append(
            {
                "type": "Feature",
                "geometry": mapping(merged),
                "properties": {"band": label, "min_m": lo, "max_m": hi, "order": i},
            }
        )
        total_kept += len(polys)
        print(f"  band {label}: {len(polys)} polygons kept")

    out = {
        "type": "FeatureCollection",
        "name": f"elevation-bands-{args.city}",
        "_provenance": (
            "FABDEM V1-2 (Hawker et al., University of Bristol; satellite-derived "
            "30 m DEM with buildings and forests removed) via Google Earth Engine, "
            "classified into ground-height bands and clipped to the official "
            "corporation boundaries. Bands are honest at ~30 m horizontal / "
            "~2 m vertical accuracy - read them as bands, not spot heights."
        ),
        "features": features,
    }
    out_path = REPO_ROOT / f"public/data/elevation-bands-{args.city}.geojson"
    out_path.write_text(json.dumps(out, separators=(",", ":")))
    mb = out_path.stat().st_size / 1e6
    print(f"wrote {out_path.name}: {len(features)} band features, {mb:.1f} MB")
    if mb > 8:
        print("WARNING: >8 MB - raise SIMPLIFY_DEG / MIN_AREA_DEG2 or move to PMTiles")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

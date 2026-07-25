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

Basin mode builds public/data/basins/<id>/elevation-bands.geojson for the
basin atlas terrain layer instead: same FABDEM source, but the bbox derives
from the basin boundary file, pixels outside the boundary polygon are
masked out, and simplification is coarser (basin zoom, not street zoom).

Run:  python scripts/build_elevation_bands.py --city mumbai
      python scripts/build_elevation_bands.py --basin arkavathi
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
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parent
sys.path.insert(0, str(API_ROOT))

from app.cascade.catchments import FABDEM_ASSET, _FETCH_TILE_DEG  # noqa: E402

CITIES = {
    "mumbai": {
        "bbox": (72.75, 18.85, 73.35, 19.55),  # the urban MMR, all 9 corporations
        # band edges (metres); labels derive from consecutive pairs
        "bands": [0, 2, 5, 10, 20, 50, 100],
    },
    # Chennai is a coastal alluvial plain - almost everything sits under
    # 20 m, so the low bands are cut finer than Mumbai's.
    "chennai": {
        "bbox": (79.95, 12.75, 80.35, 13.35),  # GCC + flood-relevant fringe
        "bands": [0, 2, 5, 10, 15, 25, 50],
    },
    # Inland cities: sea-level bands are meaningless; bands follow relief
    # relative to the local terrain envelope instead.
    "madurai": {
        "bbox": (77.95, 9.80, 78.30, 10.10),  # city + Vaigai corridor
        "bands": [60, 130, 145, 160, 180, 220, 300],
    },
    "bangalore": {
        "bbox": (77.40, 12.80, 77.85, 13.20),  # BBMP + GBA fringe
        "bands": [700, 840, 870, 900, 930, 960, 1000],
    },
}

# Basin-atlas terrain layers. bbox comes from the boundary file; pixels
# outside the boundary polygon are masked to NODATA so bands stop at the
# watershed divide (terrain beyond it belongs to a different basin's story).
BASINS = {
    "arkavathi": {
        "boundary": "public/data/basins/arkavathi/boundary.geojson",
        "out": "public/data/basins/arkavathi/elevation-bands.geojson",
        # Nandi Hills (1,452 m) down to the Sangama confluence (366 m);
        # most of the basin is the Bengaluru plateau, so the plateau is cut
        # finer than the tails. Edges sit on the FABDEM percentiles
        # (p0=366 p5=623 p20=698 p40=779 p60=860 p80=900 p95=930 p100=1452).
        "bands": [360, 620, 720, 800, 860, 920, 980],
        "bbox_buffer_deg": 0.02,
        "simplify_deg": 0.001,  # ~110 m - basin zoom, not street zoom
        "min_area_deg2": 1e-5,  # ~12 ha - drop basin-scale slivers
    },
}

# Sentinel for FABDEM's masked pixels (the sea). Land - including genuinely
# 0-1 m reclaimed Mumbai - keeps its real value, so masking by sentinel is
# the honest land/sea split. (v1 clipped to the official corporation
# boundaries instead, which left the non-municipal land BETWEEN the nine
# corporations - Tungareshwar, rural Bhiwandi taluka - without bands.)
NODATA = -9999.0


def fetch_fabdem_unmasked(bbox, out_path):
    """Tiled FABDEM fetch like catchments._fetch_fabdem_mosaic, but with
    masked (sea) pixels exported as NODATA instead of silently 0."""
    import io
    import math
    import urllib.request
    import zipfile

    from rasterio.merge import merge as rio_merge

    from app.gee.client import initialize_earth_engine

    ee = initialize_earth_engine()
    fab = ee.ImageCollection(FABDEM_ASSET).mosaic().rename("dem").unmask(NODATA)

    minx, miny, maxx, maxy = bbox
    nx = max(1, math.ceil((maxx - minx) / _FETCH_TILE_DEG))
    ny = max(1, math.ceil((maxy - miny) / _FETCH_TILE_DEG))
    tiles = []
    tmp = out_path.parent / (out_path.stem + "_tiles")
    tmp.mkdir(parents=True, exist_ok=True)
    for j in range(ny):
        for i in range(nx):
            x0 = minx + i * _FETCH_TILE_DEG
            y0 = miny + j * _FETCH_TILE_DEG
            region = ee.Geometry.Rectangle(
                [
                    x0,
                    y0,
                    min(x0 + _FETCH_TILE_DEG, maxx),
                    min(y0 + _FETCH_TILE_DEG, maxy),
                ]
            )
            url = fab.clip(region).getDownloadURL(
                {
                    "scale": 30,
                    "region": region,
                    "format": "GEO_TIFF",
                    "crs": "EPSG:4326",
                }
            )
            raw = urllib.request.urlopen(url, timeout=300).read()
            tile = tmp / f"t_{j}_{i}.tif"
            if raw[:2] == b"PK":
                z = zipfile.ZipFile(io.BytesIO(raw))
                name = next(n for n in z.namelist() if n.endswith(".tif"))
                tile.write_bytes(z.read(name))
            else:
                tile.write_bytes(raw)
            tiles.append(tile)
            print(f"  tile {j * nx + i + 1}/{nx * ny}")
    srcs = [rasterio.open(t) for t in tiles]
    mosaic, transform = rio_merge(srcs)
    meta = srcs[0].meta.copy()
    meta.update(height=mosaic.shape[1], width=mosaic.shape[2], transform=transform)
    with rasterio.open(out_path, "w", **meta) as dst:
        dst.write(mosaic)
    for src in srcs:
        src.close()


SIMPLIFY_DEG = 0.0004  # ~44 m - two DEM cells; bands, not spot heights
MIN_AREA_DEG2 = 4e-7  # ~0.5 ha - drop slivers


def load_boundary_geom(path: Path):
    """Union of every polygon in a boundary GeoJSON (Feature or collection)."""
    d = json.loads(path.read_text())
    feats = d["features"] if d.get("type") == "FeatureCollection" else [d]
    return unary_union([shape(f.get("geometry") or f) for f in feats])


def main() -> int:
    ap = argparse.ArgumentParser()
    target = ap.add_mutually_exclusive_group()
    target.add_argument("--city", choices=sorted(CITIES))
    target.add_argument("--basin", choices=sorted(BASINS))
    ap.add_argument(
        "--dem", help="reuse an existing mosaic GeoTIFF instead of fetching"
    )
    args = ap.parse_args()
    if not args.city and not args.basin:
        args.city = "mumbai"

    boundary = None
    if args.basin:
        name = args.basin
        cfg = BASINS[name]
        boundary = load_boundary_geom(REPO_ROOT / cfg["boundary"])
        buf = cfg["bbox_buffer_deg"]
        minx, miny, maxx, maxy = boundary.bounds
        bbox = (minx - buf, miny - buf, maxx + buf, maxy + buf)
        simplify_deg = cfg["simplify_deg"]
        min_area_deg2 = cfg["min_area_deg2"]
        out_path = REPO_ROOT / cfg["out"]
        provenance = (
            "FABDEM V1-2 (Hawker et al., University of Bristol; satellite-derived "
            "30 m DEM with buildings and forests removed) via Google Earth Engine, "
            "classified into ground-height bands and clipped to the basin "
            "boundary. Simplified for basin-scale display (~110 m tolerance) - "
            "read them as bands, not spot heights."
        )
    else:
        name = args.city
        cfg = CITIES[name]
        bbox = cfg["bbox"]
        simplify_deg = SIMPLIFY_DEG
        min_area_deg2 = MIN_AREA_DEG2
        out_path = REPO_ROOT / f"public/data/elevation-bands-{name}.geojson"
        provenance = (
            "FABDEM V1-2 (Hawker et al., University of Bristol; satellite-derived "
            "30 m DEM with buildings and forests removed) via Google Earth Engine, "
            "classified into ground-height bands and clipped to the official "
            "corporation boundaries. Bands are honest at ~30 m horizontal / "
            "~2 m vertical accuracy - read them as bands, not spot heights."
        )

    if args.dem:
        dem_path = Path(args.dem)
    else:
        dem_path = Path(tempfile.gettempdir()) / f"elevation_{name}_fabdem_v2.tif"
        if not dem_path.exists():
            print(f"Fetching FABDEM mosaic (unmasked) for {name} {bbox} ...")
            fetch_fabdem_unmasked(bbox, dem_path)
        else:
            print(f"Reusing cached mosaic {dem_path}")

    with rasterio.open(dem_path) as src:
        dem = src.read(1).astype("float32")
        transform = src.transform
        # Land = everything FABDEM defines; sea = the NODATA sentinel.
        land_mask = dem > NODATA + 1

    if boundary is not None:
        land_mask &= rasterio.features.geometry_mask(
            [mapping(boundary)],
            out_shape=dem.shape,
            transform=transform,
            invert=True,
        )

    # Elevation spread inside the mask - the reference for tuning band edges.
    vals = dem[land_mask]
    pcts = np.percentile(vals, [0, 5, 20, 40, 60, 80, 95, 100])
    print(
        "elevation percentiles (m):",
        " ".join(f"p{p}={v:.0f}" for p, v in zip([0, 5, 20, 40, 60, 80, 95, 100], pcts)),
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
            if g.area < min_area_deg2:
                continue
            polys.append(g)
        if not polys:
            continue
        merged = unary_union(polys).simplify(simplify_deg, preserve_topology=True)
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
        "name": f"elevation-bands-{name}",
        "_provenance": provenance,
        "features": features,
    }
    out_path.write_text(json.dumps(out, separators=(",", ":")))
    mb = out_path.stat().st_size / 1e6
    print(f"wrote {out_path.name}: {len(features)} band features, {mb:.1f} MB")
    if mb > 8:
        print("WARNING: >8 MB - raise SIMPLIFY_DEG / MIN_AREA_DEG2 or move to PMTiles")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

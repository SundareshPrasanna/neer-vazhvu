#!/usr/bin/env python3
"""Derive the catchments of Greater Mumbai's four city rivers (Mithi, Dahisar,
Poisar, Oshiwara) from FABDEM 30 m with WhiteboxTools D8 routing.

Why not HydroBASINS: the Chennai recipe (derive_chennai_subbasins_hydrobasins.py)
groups HydroBASINS level-12 units by outlet, but level 12 is the finest level
and over Salsette island its units are 320 and 337 sq km coastal blocks that
each hold more than one of the four rivers (checked 2026-09-06). The rivers are
6 to 18 km long; the units cannot separate them. So this uses the same FABDEM +
WhiteboxTools routing the cascade pipeline used for the region's lake
catchments (neer-vazhvu-api/app/cascade/catchments.py, catchments_fabdem_wbt_v1),
which means the river sheds and the lake catchments in the atlas share one DEM
and one method.

Pour points: each river's mapped course (public/geojson/mumbai-rivers.geojson),
800 m upstream of its seaward end, snapped to the highest-accumulation cell
within 250 m; the shed is every cell that drains to that point. The tidal reach
below the pour point is left out on purpose: the sea and the mudflats at or
below 0 m are masked before routing, and a catchment cannot be delineated
across nodata.

Needs earthengine-api, rasterio, whitebox, pyproj, shapely, numpy - not all in
the repo env; run with a venv interpreter:
    <venv>/bin/python scripts/derive_mumbai_subbasins_fabdem.py
GEE_KEY overrides the service-account key path (default: the repo key).
Rasters are cached under .cache/mumbai-rivers/ (gitignored); delete the
directory to force a re-fetch.

Output: pipeline-inputs/mumbai-river-catchments-fabdem.geojson, enveloped
(FABDEM input; CC BY-NC-SA encumbered like the cascade family).
scripts/build_mumbai_rivers_basin.py reads it as the city half of the basin's
sub-hydrosheds family.
"""
from __future__ import annotations

import io
import json
import math
import os
import sys
import urllib.request
import zipfile
from collections import deque
from datetime import date
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Geod, Transformer
from rasterio.features import shapes
from rasterio.merge import merge as rio_merge
from rasterio.warp import Resampling, calculate_default_transform, reproject
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from registry_license import registry_license  # noqa: E402

KEY = Path(os.environ.get("GEE_KEY") or ROOT / "motiveloop-play-a6c60c9fa760.json")
RIVERS = ROOT / "public/geojson/mumbai-rivers.geojson"
OUT = ROOT / "pipeline-inputs/mumbai-river-catchments-fabdem.geojson"
CACHE = ROOT / ".cache/mumbai-rivers"

FABDEM_ASSET = "projects/sat-io/open-datasets/FABDEM"
# Greater Mumbai plus the Sanjay Gandhi National Park hills the rivers rise in.
BBOX = (72.76, 18.88, 73.02, 19.33)  # minx, miny, maxx, maxy (lon/lat)
TILE_DEG = 0.20
UTM = 32643  # WGS84 / UTM 43N
POUR_UPSTREAM_M = 800.0
SNAP_RADIUS_M = 250.0
MIN_PART_KM2 = 0.2

# WhiteboxTools D8 pointer codes -> (drow, dcol) the cell flows TO. WBT's own
# convention (1 NE, 2 E, 4 SE, 8 S, 16 SW, 32 W, 64 NW, 128 N), NOT ESRI's
# (which starts at 1 = E): d8_pointer emits ESRI codes only with esri_pntr=True.
# Verified on this DEM 2026-09-06 - every cell's pointed-to neighbour carries
# more flow accumulation under this map, 39% of them under the ESRI map.
D8 = {1: (-1, 1), 2: (0, 1), 4: (1, 1), 8: (1, 0), 16: (1, -1), 32: (0, -1), 64: (-1, -1), 128: (-1, 0)}

RIVERS_TO_SHED = {"mithi": "MITHI", "dahisar": "DAHISAR", "poisar": "POISAR", "oshiwara": "OSHIWARA"}
GEOD = Geod(ellps="WGS84")


def log(msg: str) -> None:
    print(msg, flush=True)


def init_ee():
    import ee

    email = json.load(open(KEY))["client_email"]
    ee.Initialize(ee.ServiceAccountCredentials(email, str(KEY)))
    return ee


def fetch_fabdem(out_path: Path) -> None:
    """Tile the bbox, pull each FABDEM tile from Earth Engine, mosaic to one GeoTIFF."""
    ee = init_ee()
    fab = ee.ImageCollection(FABDEM_ASSET).mosaic().rename("dem")
    minx, miny, maxx, maxy = BBOX
    nx = max(1, math.ceil((maxx - minx) / TILE_DEG))
    ny = max(1, math.ceil((maxy - miny) / TILE_DEG))
    tiles = []
    for j in range(ny):
        for i in range(nx):
            x0, y0 = minx + i * TILE_DEG, miny + j * TILE_DEG
            x1, y1 = min(x0 + TILE_DEG, maxx), min(y0 + TILE_DEG, maxy)
            region = ee.Geometry.Rectangle([x0, y0, x1, y1])
            url = fab.clip(region).getDownloadURL({"scale": 30, "region": region, "format": "GEO_TIFF", "crs": "EPSG:4326"})
            raw = urllib.request.urlopen(url, timeout=300).read()
            tile = CACHE / f"fabdem_tile_{j}_{i}.tif"
            if raw[:2] == b"PK":
                z = zipfile.ZipFile(io.BytesIO(raw))
                tile.write_bytes(z.read(next(n for n in z.namelist() if n.endswith(".tif"))))
            else:
                tile.write_bytes(raw)
            tiles.append(tile)
        log(f"  fetched FABDEM tile row {j + 1}/{ny}")
    srcs = [rasterio.open(p) for p in tiles]
    mosaic, transform = rio_merge(srcs)
    meta = srcs[0].meta.copy()
    meta.update(height=mosaic.shape[1], width=mosaic.shape[2], transform=transform)
    for s in srcs:
        s.close()
    with rasterio.open(out_path, "w", **meta) as dst:
        dst.write(mosaic)
    log(f"mosaic -> {out_path.name} ({mosaic.shape[2]}x{mosaic.shape[1]} px)")


def reproject_utm(src_path: Path, dst_path: Path) -> None:
    dst_crs = f"EPSG:{UTM}"
    with rasterio.open(src_path) as src:
        transform, w, h = calculate_default_transform(src.crs, dst_crs, src.width, src.height, *src.bounds, resolution=30)
        meta = src.meta.copy()
        meta.update(crs=dst_crs, transform=transform, width=w, height=h, dtype="float32", nodata=-9999.0)
        with rasterio.open(dst_path, "w", **meta) as dst:
            reproject(rasterio.band(src, 1), rasterio.band(dst, 1), src_transform=src.transform, src_crs=src.crs,
                      dst_transform=transform, dst_crs=dst_crs, resampling=Resampling.bilinear)
    # Mask the sea and the tidal flats at or below 0 m, as the cascade pipeline does.
    with rasterio.open(dst_path, "r+") as ds:
        arr = ds.read(1)
        arr[arr <= 0] = -9999.0
        ds.write(arr, 1)
    log(f"reprojected -> EPSG:{UTM}")


def route(dem_utm: Path) -> tuple[Path, Path]:
    from whitebox import WhiteboxTools

    wbt = WhiteboxTools()
    wbt.set_working_dir(str(CACHE))
    wbt.verbose = False
    log("WBT breach_depressions_least_cost ...")
    wbt.breach_depressions_least_cost(dem_utm.name, "breach.tif", dist=100, fill=True)
    log("WBT d8_pointer + d8_flow_accumulation ...")
    wbt.d8_pointer("breach.tif", "d8.tif")
    wbt.d8_flow_accumulation("breach.tif", "acc.tif", out_type="cells")
    return CACHE / "d8.tif", CACHE / "acc.tif"


def pour_point(river_geom: dict) -> tuple[float, float]:
    """The point POUR_UPSTREAM_M up the river from its seaward (westernmost) end."""
    lines = river_geom["coordinates"] if river_geom["type"] == "MultiLineString" else [river_geom["coordinates"]]
    # Seaward end: the line endpoint furthest west (all four rivers meet the sea on the west coast).
    best = None
    for ln in lines:
        for end_idx, seq in ((0, ln), (len(ln) - 1, ln[::-1])):
            x = seq[0][0]
            if best is None or x < best[0]:
                best = (x, seq)
    seq = best[1]  # ordered from the sea inland
    walked = 0.0
    for a, b in zip(seq, seq[1:]):
        _, _, d = GEOD.inv(a[0], a[1], b[0], b[1])
        if walked + d >= POUR_UPSTREAM_M:
            f = (POUR_UPSTREAM_M - walked) / d
            return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
        walked += d
    return tuple(seq[-1][:2])


def upstream_mask(d8: np.ndarray, seed: tuple[int, int]) -> np.ndarray:
    """Every cell that drains to the seed cell, by inverting the D8 pointer."""
    H, W = d8.shape
    rows, cols = np.indices(d8.shape)
    tgt = np.full(d8.shape, -1, dtype=np.int64)
    for code, (dr, dc) in D8.items():
        m = d8 == code
        rr, cc = rows[m] + dr, cols[m] + dc
        ok = (rr >= 0) & (rr < H) & (cc >= 0) & (cc < W)
        flat = np.flatnonzero(m)
        tgt.flat[flat[ok]] = rr[ok] * W + cc[ok]
    tgt_flat = tgt.ravel()
    order = np.argsort(tgt_flat, kind="stable")
    sorted_tgt = tgt_flat[order]
    mask = np.zeros(d8.size, dtype=bool)
    start = seed[0] * W + seed[1]
    mask[start] = True
    q = deque([start])
    while q:
        cur = q.popleft()
        lo = np.searchsorted(sorted_tgt, cur, side="left")
        hi = np.searchsorted(sorted_tgt, cur, side="right")
        for child in order[lo:hi]:
            if not mask[child]:
                mask[child] = True
                q.append(int(child))
    return mask.reshape(d8.shape)


def sqkm(geom) -> float:
    area, _ = GEOD.geometry_area_perimeter(geom)
    return abs(area) / 1e6


def rounded(g: dict, nd: int = 5) -> dict:
    def r(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [r(x) for x in c]

    g["coordinates"] = r(g["coordinates"])
    return g


def main() -> int:
    CACHE.mkdir(parents=True, exist_ok=True)
    dem = CACHE / "fabdem-4326.tif"
    dem_utm = CACHE / "fabdem-utm.tif"
    if not dem.exists():
        fetch_fabdem(dem)
    if not dem_utm.exists():
        reproject_utm(dem, dem_utm)
    d8_path, acc_path = (CACHE / "d8.tif", CACHE / "acc.tif")
    if not (d8_path.exists() and acc_path.exists()):
        d8_path, acc_path = route(dem_utm)

    with rasterio.open(d8_path) as ds:
        d8 = ds.read(1).astype(np.int64)
        transform = ds.transform
    with rasterio.open(acc_path) as ds:
        acc = ds.read(1)
    to_utm = Transformer.from_crs("EPSG:4326", f"EPSG:{UTM}", always_xy=True)
    to_wgs = Transformer.from_crs(f"EPSG:{UTM}", "EPSG:4326", always_xy=True)
    cell = abs(transform.a)
    snap_cells = int(math.ceil(SNAP_RADIUS_M / cell))

    rivers = {f["properties"]["river_id"]: f["geometry"] for f in json.loads(RIVERS.read_text())["features"]}
    features = []
    for river_id, shed_id in RIVERS_TO_SHED.items():
        lon, lat = pour_point(rivers[river_id])
        x, y = to_utm.transform(lon, lat)
        col, row = ~transform * (x, y)
        row, col = int(row), int(col)
        r0, r1 = max(0, row - snap_cells), min(d8.shape[0], row + snap_cells + 1)
        c0, c1 = max(0, col - snap_cells), min(d8.shape[1], col + snap_cells + 1)
        win = acc[r0:r1, c0:c1]
        dr, dc = np.unravel_index(int(np.argmax(win)), win.shape)
        seed = (r0 + int(dr), c0 + int(dc))
        mask = upstream_mask(d8, seed)
        polys = [shape(g) for g, v in shapes(mask.astype(np.uint8), mask=mask, transform=transform) if v == 1]
        geom_utm = unary_union(polys).buffer(0)
        geom = shp_transform(to_wgs.transform, geom_utm).buffer(0)
        parts = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
        keep = [p for p in parts if sqkm(p) >= MIN_PART_KM2] or [max(parts, key=lambda p: p.area)]
        geom = (unary_union(keep) if len(keep) > 1 else keep[0]).simplify(0.0003).buffer(0)
        slon, slat = to_wgs.transform(*(transform * (seed[1] + 0.5, seed[0] + 0.5)))
        log(f"  {river_id:9} pour ({lon:.4f},{lat:.4f}) -> snapped ({slon:.4f},{slat:.4f}) acc={int(acc[seed]):,} cells; shed {sqkm(geom):.1f} sq km")
        features.append({
            "type": "Feature",
            "properties": {
                "shedId": shed_id,
                "river_id": river_id,
                "area_km2": round(sqkm(geom), 1),
                "pour_point": [round(slon, 5), round(slat, 5)],
                "pour_point_basis": f"{int(POUR_UPSTREAM_M)} m upstream of the mapped seaward end, snapped to the highest flow accumulation within {int(SNAP_RADIUS_M)} m",
            },
            "geometry": rounded(mapping(geom)),
        })

    doc = {
        "nvdm": "1.0",
        "dataset": "basins/river-catchments-source",
        "scope": {"kind": "basin", "id": "mumbai-rivers"},
        "provenance": {
            "sources": [
                {
                    "id": "fabdem-dem",
                    "title": "FABDEM v1-2 30 m bare-earth DEM",
                    "publisher": "University of Bristol (Hawker et al.), via GEE sat-io",
                    "license": registry_license("fabdem-dem"),
                    "role": "input",
                },
                {
                    "id": "osm-overpass",
                    "title": "OpenStreetMap river courses (pour-point placement only)",
                    "publisher": "OpenStreetMap contributors",
                    "license": registry_license("osm-overpass"),
                    "role": "input",
                },
            ],
            "method": "derived",
            "produced_at": date.today().isoformat(),
            "produced_by": "scripts/derive_mumbai_subbasins_fabdem.py",
            "internal_inputs": ["public/geojson/mumbai-rivers.geojson"],
            "note": (
                "Catchments of the four Greater Mumbai rivers, delineated on FABDEM 30 m with WhiteboxTools "
                "(least-cost breaching, D8 pointer, D8 accumulation) from a pour point 800 m up each mapped course; "
                "the tidal reach below the pour point is not part of the shed. Same DEM and routing as the region's "
                "lake catchments (neer-vazhvu-api/app/cascade). FABDEM makes this CC BY-NC-SA (non-commercial) encumbered."
            ),
        },
        "type": "FeatureCollection",
        "features": features,
    }
    OUT.write_text(json.dumps(doc, separators=(",", ":")))
    log(f"wrote {OUT.relative_to(ROOT)} ({len(features)} sheds)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

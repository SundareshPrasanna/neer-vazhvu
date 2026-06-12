"""Layer A2: terrain-derived catchments (the "area of influence" per lake).

Where `topology.py` infers tank-to-tank *edges*, this stage delineates the
*contributing area* of each water body: the catchment that drains into it.
Once a catchment polygon exists, the rich per-lake panel (catchment area,
buildings/rooftop in catchment, rooftop harvest, area-weighted rainfall,
cumulative-network roll-ups) is just joins on top.

Method (`catchments_fabdem_wbt_v1`), run once per district:

  1. Acquire ONE FABDEM 30 m bare-earth mosaic over the district bounding box
     (water-body bbox + `catchment_dem_buffer_deg`), tiled through Earth
     Engine. FABDEM has buildings + canopy removed, which matters in dense
     urban terrain where a surface model would dam flow at every rooftop.
  2. Reproject to the district UTM zone (metric, ~30 m cells) and mask ocean
     / <=0 m to nodata so coastal breaching does not stall on the flat sea.
  3. Hydrologically condition + route ONCE with WhiteboxTools: breach
     depressions (least-cost, fill remainder) -> D8 pointer -> D8 flow
     accumulation. O(district), not O(number of lakes).
  4. Per water body: rasterize its polygon and BFS upstream over the D8 grid,
     SEEDED FROM THE WHOLE POLYGON. The catchment is every cell whose downhill
     path reaches the lake. Whole-polygon seeding is what makes this robust for
     both river-fed reservoirs (large catchment) and off-stream / channel-fed
     ones (small natural catchment, e.g. Sholavaram).

Quality is gated, not assumed: catchments that touch the DEM edge (possibly
clipped) or whose polygon is sub-pixel are flagged in the quality manifest
rather than silently shipped.

Supersedes the 90 m MERIT / HydroBASINS scaffold in
`app.gee.catchment_derivation` (4 hand-picked reservoirs, never shipped) for
the cascade-atlas surface: this is 30 m and runs across every cascade node.
"""

from __future__ import annotations

import io
import json
import math
import re
import tempfile
import urllib.request
import zipfile
from collections import deque
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.features import rasterize, shapes
from rasterio.merge import merge as rio_merge
from rasterio.warp import Resampling, calculate_default_transform, reproject
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform, unary_union

from app.cascade.districts import DistrictCascadeConfig

FABDEM_ASSET = "projects/sat-io/open-datasets/FABDEM"

# WhiteboxTools / ESRI D8 pointer codes -> (drow, dcol) the cell flows TO.
# Row increases southward in a north-up raster.
D8_DELTAS: dict[int, tuple[int, int]] = {
    1: (0, 1), 2: (1, 1), 4: (1, 0), 8: (1, -1),
    16: (0, -1), 32: (-1, -1), 64: (-1, 0), 128: (-1, 1),
}
_NEIGHBORS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

# GEE getDownloadURL has a per-request pixel/byte ceiling; tile the fetch.
_FETCH_TILE_DEG = 0.20
# Flow-accumulation threshold (cells) above which a cell is treated as a
# stream channel for the streams layer. ~1500 cells * 900 m2 ~= 1.35 km2.
_STREAM_THRESHOLD_CELLS = 1500


# Conduits (rivers/canals/creeks) are not impoundments: their "catchment" is a
# whole river basin, which is meaningless as a lake area-of-influence. Some are
# tagged water_type="water" so topology's water_type filter misses them; we
# catch named ones here, and unnamed thin ribbons geometrically below.
_CONDUIT_NAME_RE = re.compile(
    r"river|canal|creek|stream|rivulet|drain|kaalvai|ஆறு|கால்வாய்|ஓடை|நதி", re.IGNORECASE
)
# Unnamed thin-ribbon test: Polsby-Popper compactness (4*pi*A/P^2) below this,
# with catchment far larger than the polygon, is a river segment not a tank.
_RIBBON_COMPACTNESS_MAX = 0.03
_RIBBON_CATCHMENT_RATIO_MIN = 100.0


def _polsby_popper(poly: Any) -> float:
    return 4 * math.pi * poly.area / (poly.length ** 2) if poly.length else 0.0


def _log(msg: str) -> None:
    print(f"[catchments] {msg}", flush=True)


# --------------------------------------------------------------------------
# DEM acquisition
# --------------------------------------------------------------------------
def _water_body_bbox(district: DistrictCascadeConfig) -> tuple[float, float, float, float]:
    fc = json.loads(district.tank_polygons_path.read_text(encoding="utf-8"))
    xs: list[float] = []
    ys: list[float] = []
    for feat in fc["features"]:
        minx, miny, maxx, maxy = shape(feat["geometry"]).bounds
        xs += [minx, maxx]
        ys += [miny, maxy]
    return min(xs), min(ys), max(xs), max(ys)


def _fetch_fabdem_mosaic(bbox: tuple[float, float, float, float], out_path: Path) -> None:
    """Tile the bbox, pull each FABDEM tile via Earth Engine, mosaic to one GeoTIFF (EPSG:4326)."""
    from app.gee.client import initialize_earth_engine

    ee = initialize_earth_engine()
    fab = ee.ImageCollection(FABDEM_ASSET).mosaic().rename("dem")

    minx, miny, maxx, maxy = bbox
    nx = max(1, math.ceil((maxx - minx) / _FETCH_TILE_DEG))
    ny = max(1, math.ceil((maxy - miny) / _FETCH_TILE_DEG))
    _log(f"DEM bbox {bbox} -> {nx}x{ny} = {nx * ny} tiles @ {_FETCH_TILE_DEG} deg")

    tmpdir = Path(tempfile.mkdtemp(prefix="fabdem_"))
    tile_paths: list[Path] = []
    for j in range(ny):
        for i in range(nx):
            x0 = minx + i * _FETCH_TILE_DEG
            y0 = miny + j * _FETCH_TILE_DEG
            x1 = min(x0 + _FETCH_TILE_DEG, maxx)
            y1 = min(y0 + _FETCH_TILE_DEG, maxy)
            region = ee.Geometry.Rectangle([x0, y0, x1, y1])
            url = fab.clip(region).getDownloadURL(
                {"scale": 30, "region": region, "format": "GEO_TIFF", "crs": "EPSG:4326"}
            )
            raw = urllib.request.urlopen(url, timeout=300).read()
            tile = tmpdir / f"t_{j}_{i}.tif"
            if raw[:2] == b"PK":
                z = zipfile.ZipFile(io.BytesIO(raw))
                name = next(n for n in z.namelist() if n.endswith(".tif"))
                tile.write_bytes(z.read(name))
            else:
                tile.write_bytes(raw)
            tile_paths.append(tile)
        _log(f"  fetched tile row {j + 1}/{ny}")

    srcs = [rasterio.open(p) for p in tile_paths]
    mosaic, transform = rio_merge(srcs)
    meta = srcs[0].meta.copy()
    meta.update(height=mosaic.shape[1], width=mosaic.shape[2], transform=transform)
    for s in srcs:
        s.close()
    with rasterio.open(out_path, "w", **meta) as dst:
        dst.write(mosaic)
    _log(f"mosaic -> {out_path} ({mosaic.shape[2]}x{mosaic.shape[1]} px)")


def _reproject_to_utm(src_path: Path, dst_path: Path, epsg: int) -> None:
    dst_crs = f"EPSG:{epsg}"
    with rasterio.open(src_path) as src:
        transform, w, h = calculate_default_transform(
            src.crs, dst_crs, src.width, src.height, *src.bounds, resolution=30
        )
        meta = src.meta.copy()
        meta.update(crs=dst_crs, transform=transform, width=w, height=h,
                    dtype="float32", nodata=-9999.0)
        with rasterio.open(dst_path, "w", **meta) as dst:
            reproject(
                rasterio.band(src, 1), rasterio.band(dst, 1),
                src_transform=src.transform, src_crs=src.crs,
                dst_transform=transform, dst_crs=dst_crs,
                resampling=Resampling.bilinear,
            )
    # Mask ocean / <=0 m so least-cost breaching skips the flat sea.
    with rasterio.open(dst_path, "r+") as ds:
        arr = ds.read(1)
        n_sea = int((arr <= 0).sum())
        arr[arr <= 0] = -9999.0
        ds.write(arr, 1)
    _log(f"reprojected -> EPSG:{epsg}, masked {n_sea} ocean/<=0 cells")


def _condition_and_route(dem_utm: Path, workdir: Path) -> tuple[Path, Path]:
    """WhiteboxTools: breach depressions -> D8 pointer -> D8 flow accumulation."""
    from whitebox import WhiteboxTools

    wbt = WhiteboxTools()
    wbt.set_working_dir(str(workdir))
    wbt.verbose = False
    _log("WBT breach_depressions_least_cost ...")
    wbt.breach_depressions_least_cost(dem_utm.name, "breach.tif", dist=100, fill=True)
    _log("WBT d8_pointer ...")
    wbt.d8_pointer("breach.tif", "d8.tif")
    _log("WBT d8_flow_accumulation ...")
    wbt.d8_flow_accumulation("breach.tif", "acc.tif", out_type="cells")
    return workdir / "d8.tif", workdir / "acc.tif"


# --------------------------------------------------------------------------
# Per-lake delineation
# --------------------------------------------------------------------------
def _bfs_upstream(ptr: np.ndarray, seed_mask: np.ndarray) -> np.ndarray:
    """Catchment = seed cells + every cell whose D8 path drains into the seed."""
    H, W = ptr.shape
    ws = seed_mask.copy()
    q: deque[tuple[int, int]] = deque(map(tuple, np.argwhere(seed_mask)))
    while q:
        r, c = q.popleft()
        for dr, dc in _NEIGHBORS:
            nr, nc = r + dr, c + dc
            if 0 <= nr < H and 0 <= nc < W and not ws[nr, nc]:
                t = D8_DELTAS.get(int(ptr[nr, nc]))
                if t is not None and nr + t[0] == r and nc + t[1] == c:
                    ws[nr, nc] = True
                    q.append((nr, nc))
    return ws


def build_catchments(district: DistrictCascadeConfig, *, dem_cache: Path | None = None) -> dict[str, Any]:
    """Delineate a catchment for every cascade node in the district.

    `dem_cache` (optional) is a directory holding dem_utm.tif/d8.tif/acc.tif
    from a previous run, so re-delineation skips the slow GEE + WBT steps.
    """
    workdir = dem_cache or Path(tempfile.mkdtemp(prefix=f"catch_{district.district_id}_"))
    workdir.mkdir(parents=True, exist_ok=True)
    dem_wgs = workdir / "dem_wgs.tif"
    dem_utm = workdir / "dem_utm.tif"
    d8_path = workdir / "d8.tif"
    acc_path = workdir / "acc.tif"

    if not d8_path.exists():
        if not dem_wgs.exists():
            bbox = _water_body_bbox(district)
            buf = district.catchment_dem_buffer_deg
            _fetch_fabdem_mosaic((bbox[0] - buf, bbox[1] - buf, bbox[2] + buf, bbox[3] + buf), dem_wgs)
        _reproject_to_utm(dem_wgs, dem_utm, district.utm_epsg)
        _condition_and_route(dem_utm, workdir)

    import pyproj

    with rasterio.open(d8_path) as src:
        ptr = src.read(1)
        T = src.transform
        H, W = ptr.shape
    with rasterio.open(acc_path) as src:
        acc = src.read(1)
    cell_area_m2 = abs(T.a * T.e)
    to_utm = pyproj.Transformer.from_crs("EPSG:4326", f"EPSG:{district.utm_epsg}", always_xy=True).transform
    to_wgs = pyproj.Transformer.from_crs(f"EPSG:{district.utm_epsg}", "EPSG:4326", always_xy=True).transform

    # Canonical node set (osm_ids in the cascade graph) + their polygons.
    nodes_fc = json.loads(district.cascade_nodes_geojson_path().read_text(encoding="utf-8"))
    node_ids = {f["properties"]["osm_id"] for f in nodes_fc["features"]}
    bodies_fc = json.loads(district.tank_polygons_path.read_text(encoding="utf-8"))
    polys: dict[int, dict[str, Any]] = {
        f["properties"]["osm_id"]: {
            "geom": shape(f["geometry"]),
            "name": (f["properties"].get("name") or "") + " " + (f["properties"].get("name_ta") or ""),
        }
        for f in bodies_fc["features"]
        if f["properties"].get("osm_id") in node_ids
    }
    _log(f"delineating {len(polys)} of {len(node_ids)} nodes (rest have no polygon)")

    catch_features: list[dict[str, Any]] = []
    area_by_id: dict[int, float] = {}
    flagged: list[dict[str, Any]] = []
    done = 0
    for osm_id, meta in polys.items():
        poly = meta["geom"]
        name = meta["name"].strip()
        # Named conduits: skip before the BFS (rivers are not impoundments).
        if name and _CONDUIT_NAME_RE.search(name):
            flagged.append({"osm_id": osm_id, "quality": "conduit_excluded", "name": name})
            continue
        poly_utm = shp_transform(to_utm, poly)
        seed = rasterize([(mapping(poly_utm), 1)], out_shape=(H, W), transform=T,
                         fill=0, dtype="uint8").astype(bool)
        if not seed.any():
            flagged.append({"osm_id": osm_id, "quality": "no_seed_subpixel"})
            continue
        ws = _bfs_upstream(ptr, seed)
        area_km2 = round(ws.sum() * cell_area_m2 / 1e6, 3)
        lake_km2 = round(seed.sum() * cell_area_m2 / 1e6, 3)
        # Unnamed thin ribbon draining a whole basin = a river segment, not a tank.
        if (not name and _polsby_popper(poly) < _RIBBON_COMPACTNESS_MAX
                and lake_km2 > 0 and area_km2 / lake_km2 > _RIBBON_CATCHMENT_RATIO_MIN):
            flagged.append({"osm_id": osm_id, "quality": "conduit_excluded",
                            "catchment_area_sqkm": area_km2, "note": "unnamed_ribbon"})
            continue
        touches_edge = bool(ws[0, :].any() or ws[-1, :].any() or ws[:, 0].any() or ws[:, -1].any())
        quality = "edge_touch_maybe_clipped" if touches_edge else "ok"
        area_by_id[osm_id] = area_km2
        if touches_edge:
            flagged.append({"osm_id": osm_id, "quality": quality, "catchment_area_sqkm": area_km2})

        geoms = [shape(g) for g, v in shapes(ws.astype("uint8"), mask=ws, transform=T) if v == 1]
        catch_utm = unary_union(geoms).simplify(15.0, preserve_topology=True)
        catch_features.append({
            "type": "Feature",
            "properties": {
                "osm_id": osm_id,
                "catchment_area_sqkm": area_km2,
                "lake_area_sqkm": lake_km2,
                "touches_edge": touches_edge,
                "quality": quality,
            },
            "geometry": mapping(shp_transform(to_wgs, catch_utm)),
        })
        done += 1
        if done % 200 == 0:
            _log(f"  delineated {done}/{len(polys)}")

    # Write catchments GeoJSON.
    out = district.cascade_catchments_geojson_path()
    out.write_text(
        json.dumps({"type": "FeatureCollection", "features": catch_features}, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # Extend the nodes file in place with catchment_area_sqkm.
    for f in nodes_fc["features"]:
        f["properties"]["catchment_area_sqkm"] = area_by_id.get(f["properties"]["osm_id"])
    district.cascade_nodes_geojson_path().write_text(
        json.dumps(nodes_fc, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    areas = sorted(area_by_id.values())
    summary = {
        "district_id": district.district_id,
        "algorithm": "catchments_fabdem_wbt_v1",
        "dem": "FABDEM_30m",
        "utm_epsg": district.utm_epsg,
        "nodes_total": len(node_ids),
        "delineated": len(catch_features),
        "no_polygon": len(node_ids) - len(polys),
        "flagged_count": len(flagged),
        "edge_touch_count": sum(1 for x in flagged if x["quality"] == "edge_touch_maybe_clipped"),
        "no_seed_count": sum(1 for x in flagged if x["quality"] == "no_seed_subpixel"),
        "conduit_excluded_count": sum(1 for x in flagged if x["quality"] == "conduit_excluded"),
        "area_sqkm": {
            "min": areas[0] if areas else None,
            "median": areas[len(areas) // 2] if areas else None,
            "max": areas[-1] if areas else None,
            # Catchments nest (a tank's catchment lies inside its reservoir's),
            # so this sum double-counts shared area; it is NOT district area.
            "sum_overlapping": round(sum(areas), 1),
        },
        "flagged": flagged,
        "dem_cache": str(workdir),
    }
    district.cascade_catchment_quality_json_path().write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return summary

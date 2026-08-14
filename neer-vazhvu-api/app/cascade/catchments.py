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
from shapely.geometry import LineString, mapping, shape
from shapely.ops import transform as shp_transform, unary_union

from app.nvdm_io import merge_envelope

# rasterio (+ GDAL) ships only in the optional `hydro` extra and is used solely
# by the DEM acquisition / flow-routing functions below. Import it tolerantly so
# the module - and its shapely-only helpers like _is_river_ribbon / _polsby_popper
# - load without the extra (e.g. CI, which installs only `.[dev]`). The DEM
# functions are reached only by the cascade pipeline, which runs with `.[hydro]`.
try:
    import rasterio
    from rasterio.features import rasterize, shapes
    from rasterio.merge import merge as rio_merge
    from rasterio.warp import Resampling, calculate_default_transform, reproject
except ModuleNotFoundError:  # pragma: no cover - only hit without the hydro extra
    rasterio = None  # type: ignore[assignment]
    rasterize = shapes = rio_merge = None  # type: ignore[assignment]
    Resampling = calculate_default_transform = reproject = None  # type: ignore[assignment]

from app.cascade.districts import DistrictCascadeConfig

FABDEM_ASSET = "projects/sat-io/open-datasets/FABDEM"

# WhiteboxTools / ESRI D8 pointer codes -> (drow, dcol) the cell flows TO.
# Row increases southward in a north-up raster.
D8_DELTAS: dict[int, tuple[int, int]] = {
    1: (0, 1),
    2: (1, 1),
    4: (1, 0),
    8: (1, -1),
    16: (0, -1),
    32: (-1, -1),
    64: (-1, 0),
    128: (-1, 1),
}
_NEIGHBORS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

# GEE getDownloadURL has a per-request pixel/byte ceiling; tile the fetch.
_FETCH_TILE_DEG = 0.20
# Flow-accumulation threshold (cells) above which a cell is treated as a
# stream channel for the feeder-stream layer. ~800 cells * 900 m2 ~= 0.72 km2,
# which gives a dense dendritic network without overwhelming the catchment.
_STREAM_THRESHOLD_CELLS = 800
_STREAM_NEIGHBORS = [
    (-1, -1),
    (-1, 0),
    (-1, 1),
    (0, -1),
    (0, 1),
    (1, -1),
    (1, 0),
    (1, 1),
]


# Conduits (rivers/canals/creeks) are not impoundments: their "catchment" is a
# whole river basin, which is meaningless as a lake area-of-influence. Some are
# tagged water_type="water" so topology's water_type filter misses them; we
# catch named ones here, and unnamed thin ribbons geometrically below.
_CONDUIT_NAME_RE = re.compile(
    r"river|canal|creek|stream|rivulet|drain|kaalvai|ஆறு|கால்வாய்|ஓடை|நதி", re.IGNORECASE
)
# Thin-ribbon test: Polsby-Popper compactness (4*pi*A/P^2) below this, with a
# catchment far larger than the polygon, is a river segment, not a tank. The
# catchment-to-area ratio is the real discriminator: a genuine elongated water
# body (e.g. Pulicat lagoon, pp 0.019) has a low ratio (~3), whereas a river
# masquerading as a lake (Vrishabhavati, "Nagarbhavi Thorai") has a ratio in
# the hundreds. So this also catches NAMED rivers the conduit regex misses.
#
# Exception: an on-river RESERVOIR (e.g. Manchanabele, impounded behind a dam on
# the Arkavati trunk) is both elongated AND drains a whole basin, so it trips the
# ratio test exactly like a river - the ratio cannot tell them apart. A surface-
# area floor can: a contiguous water polygon this large is an impoundment, never
# a drain/canal ribbon. Bodies at or above the floor are exempt from the test.
_RIBBON_COMPACTNESS_MAX = 0.05
_RIBBON_CATCHMENT_RATIO_MIN = 100.0
_RIBBON_LAKE_AREA_FLOOR_KM2 = 0.5  # ~50 ha; above this, keep even if ribbon-like


def _polsby_popper(poly: Any) -> float:
    return 4 * math.pi * poly.area / (poly.length**2) if poly.length else 0.0


def _is_river_ribbon(poly: Any, lake_km2: float, total_km2: float) -> bool:
    """True if a water polygon is a river/canal segment masquerading as a tank.

    Thin (low compactness) AND draining a catchment far larger than itself.
    Large impoundments are exempt via the area floor: an on-river reservoir
    (Manchanabele) is thin and drains a whole basin, so it trips compactness
    and ratio exactly like a river - only its surface area sets it apart.
    """
    return (
        lake_km2 < _RIBBON_LAKE_AREA_FLOOR_KM2
        and lake_km2 > 0
        and _polsby_popper(poly) < _RIBBON_COMPACTNESS_MAX
        and total_km2 / lake_km2 > _RIBBON_CATCHMENT_RATIO_MIN
    )


def _log(msg: str) -> None:
    print(f"[catchments] {msg}", flush=True)


# --------------------------------------------------------------------------
# DEM acquisition
# --------------------------------------------------------------------------
def _water_body_bbox(
    district: DistrictCascadeConfig,
) -> tuple[float, float, float, float]:
    fc = json.loads(district.tank_polygons_path.read_text(encoding="utf-8"))
    xs: list[float] = []
    ys: list[float] = []
    for feat in fc["features"]:
        minx, miny, maxx, maxy = shape(feat["geometry"]).bounds
        xs += [minx, maxx]
        ys += [miny, maxy]
    return min(xs), min(ys), max(xs), max(ys)


def _fetch_fabdem_mosaic(
    bbox: tuple[float, float, float, float], out_path: Path
) -> None:
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
                {
                    "scale": 30,
                    "region": region,
                    "format": "GEO_TIFF",
                    "crs": "EPSG:4326",
                }
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
        meta.update(
            crs=dst_crs,
            transform=transform,
            width=w,
            height=h,
            dtype="float32",
            nodata=-9999.0,
        )
        with rasterio.open(dst_path, "w", **meta) as dst:
            reproject(
                rasterio.band(src, 1),
                rasterio.band(dst, 1),
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=transform,
                dst_crs=dst_crs,
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
    _log("WBT extract_streams + strahler_stream_order ...")
    wbt.extract_streams("acc.tif", "streams.tif", threshold=_STREAM_THRESHOLD_CELLS)
    wbt.strahler_stream_order("d8.tif", "streams.tif", "strahler.tif")
    return workdir / "d8.tif", workdir / "acc.tif"


# --------------------------------------------------------------------------
# Per-lake delineation
# --------------------------------------------------------------------------
def _bfs_upstream(
    ptr: np.ndarray, seed_mask: np.ndarray, barrier: np.ndarray | None = None
) -> np.ndarray:
    """Catchment = seed cells + every cell whose D8 path drains into the seed.

    If `barrier` is given (a mask of OTHER water bodies), the trace stops when
    it reaches a barrier cell - it does not climb past another lake. That
    yields the lake's OWN (incremental) catchment: the land that drains to it
    before reaching any other water body. Without a barrier it yields the TOTAL
    upstream basin (everything that ultimately drains to it).
    """
    H, W = ptr.shape
    ws = seed_mask.copy()
    q: deque[tuple[int, int]] = deque(map(tuple, np.argwhere(seed_mask)))
    while q:
        r, c = q.popleft()
        for dr, dc in _NEIGHBORS:
            nr, nc = r + dr, c + dc
            if 0 <= nr < H and 0 <= nc < W and not ws[nr, nc]:
                if barrier is not None and barrier[nr, nc]:
                    continue  # another water body upstream -> its land is its own
                t = D8_DELTAS.get(int(ptr[nr, nc]))
                if t is not None and nr + t[0] == r and nc + t[1] == c:
                    ws[nr, nc] = True
                    q.append((nr, nc))
    return ws


def _chaikin(
    coords: list[tuple[float, float]], iters: int = 2
) -> list[tuple[float, float]]:
    """Corner-cutting smoothing: turns the D8 staircase into natural curves."""
    for _ in range(iters):
        if len(coords) < 3:
            break
        out = [coords[0]]
        for p, q in zip(coords[:-1], coords[1:]):
            out.append((0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]))
            out.append((0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]))
        out.append(coords[-1])
        coords = out
    return coords


def build_vector_streams(
    district: DistrictCascadeConfig, *, dem_cache: Path
) -> dict[str, Any]:
    """Sharper feeder streams: vectorise the stream raster into continuous
    channel reaches (WhiteboxTools), smooth them (Chaikin), then clip each to a
    lake's basin. Replaces the blocky per-cell segments. Uses cached rasters +
    the basin polygons; no catchment re-delineation."""
    import shapefile  # pyshp
    import pyproj
    from shapely.strtree import STRtree
    from shapely.geometry import LineString, mapping, shape as _shape
    from shapely.ops import transform as _tf, unary_union as _union
    from whitebox import WhiteboxTools

    W = Path(dem_cache)
    wbt = WhiteboxTools()
    wbt.set_working_dir(str(W))
    wbt.verbose = False
    if not (W / "streams_vec.shp").exists():
        _log("WBT raster_streams_to_vector ...")
        wbt.raster_streams_to_vector("streams.tif", "d8.tif", "streams_vec.shp")

    sr = rasterio.open(W / "strahler.tif")
    sa = sr.read(1)
    inv = ~sr.transform
    Hs, Ws = sa.shape
    to_wgs = pyproj.Transformer.from_crs(
        f"EPSG:{district.utm_epsg}", "EPSG:4326", always_xy=True
    ).transform

    reaches: list[Any] = []
    orders: list[int] = []
    for sh in shapefile.Reader(str(W / "streams_vec.shp")).shapes():
        pts = sh.points
        if len(pts) < 2:
            continue
        mx, my = pts[len(pts) // 2]
        fcol, frow = inv * (mx, my)
        row, col = int(frow), int(fcol)
        order = int(sa[row, col]) if 0 <= row < Hs and 0 <= col < Ws else 1
        g = _tf(to_wgs, LineString(_chaikin(list(pts)))).simplify(
            0.00004, preserve_topology=True
        )
        if not g.is_empty:
            reaches.append(g)
            orders.append(max(order, 1))
    _log(f"{len(reaches)} vectorised stream reaches; clipping to basins")

    tree = STRtree(reaches)
    basins = json.loads(
        district.cascade_catchment_basin_json_path().read_text(encoding="utf-8")
    )
    out: dict[str, Any] = {}
    for oid, geom in basins.items():
        basin = _shape(geom)
        byo: dict[int, list[Any]] = {}
        for i in tree.query(basin):
            clipped = reaches[int(i)].intersection(basin)
            if clipped.is_empty:
                continue
            byo.setdefault(orders[int(i)], []).append(clipped)
        feats = [
            {
                "type": "Feature",
                "properties": {"order": o},
                "geometry": mapping(_union(geoms)),
            }
            for o, geoms in sorted(byo.items())
        ]
        out[oid] = {"type": "FeatureCollection", "features": feats}

    streams_path = district.cascade_catchment_streams_json_path()
    streams_path.write_text(
        json.dumps(merge_envelope(streams_path, out), separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    return {
        "district_id": district.district_id,
        "reaches": len(reaches),
        "lakes": len(out),
    }


def _trace_downstream(
    acc: np.ndarray,
    lake_label: np.ndarray,
    start: tuple[int, int],
    self_idx: int,
    max_steps: int = 6000,
) -> tuple[int, list[tuple[int, int]]]:
    """From a lake's outlet, follow the channel downstream (steepest-accumulation
    neighbour) until it enters another water body. Returns (label index of that
    lake, path cells walked from the outlet to that lake's edge). The label is 0
    if it reaches a sink / the river / the grid edge first. Pointer-free
    (max-accumulation = true downstream regardless of D8 encoding)."""
    H, W = acc.shape
    r, c = start
    path: list[tuple[int, int]] = [(r, c)]
    visited: set[tuple[int, int]] = set()
    for _ in range(max_steps):
        best = acc[r, c]
        nr = nc = -1
        for dr, dc in _NEIGHBORS:
            rr, cc = r + dr, c + dc
            if (
                0 <= rr < H
                and 0 <= cc < W
                and (rr, cc) not in visited
                and acc[rr, cc] > best
            ):
                best = acc[rr, cc]
                nr, nc = rr, cc
        if nr < 0:
            return 0, path
        lbl = int(lake_label[nr, nc])
        if lbl and lbl != self_idx:
            path.append((nr, nc))
            return lbl, path
        visited.add((r, c))
        r, c = nr, nc
        path.append((r, c))
    return 0, path


def build_catchments(
    district: DistrictCascadeConfig, *, dem_cache: Path | None = None
) -> dict[str, Any]:
    """Delineate a catchment for every cascade node in the district.

    `dem_cache` (optional) is a directory holding dem_utm.tif/d8.tif/acc.tif
    from a previous run, so re-delineation skips the slow GEE + WBT steps.
    """
    workdir = dem_cache or Path(
        tempfile.mkdtemp(prefix=f"catch_{district.district_id}_")
    )
    workdir.mkdir(parents=True, exist_ok=True)
    dem_wgs = workdir / "dem_wgs.tif"
    dem_utm = workdir / "dem_utm.tif"
    d8_path = workdir / "d8.tif"
    acc_path = workdir / "acc.tif"

    if not d8_path.exists():
        if not dem_wgs.exists():
            bbox = _water_body_bbox(district)
            buf = district.catchment_dem_buffer_deg
            _fetch_fabdem_mosaic(
                (bbox[0] - buf, bbox[1] - buf, bbox[2] + buf, bbox[3] + buf), dem_wgs
            )
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
    to_utm = pyproj.Transformer.from_crs(
        "EPSG:4326", f"EPSG:{district.utm_epsg}", always_xy=True
    ).transform
    to_wgs = pyproj.Transformer.from_crs(
        f"EPSG:{district.utm_epsg}", "EPSG:4326", always_xy=True
    ).transform

    # --- Feeder-stream network (for the per-lake "streams in this catchment"
    # overlay). Chain each stream cell to its highest-accumulation neighbour:
    # that is the true downstream cell regardless of the D8 pointer encoding,
    # so the segments trace the natural curved channels. Precomputed once;
    # clipped to each lake's watershed in the loop. ---
    strahler_path = workdir / "strahler.tif"
    if not strahler_path.exists():
        from whitebox import WhiteboxTools

        wbt = WhiteboxTools()
        wbt.set_working_dir(str(workdir))
        wbt.verbose = False
        wbt.extract_streams("acc.tif", "streams.tif", threshold=_STREAM_THRESHOLD_CELLS)
        wbt.strahler_stream_order("d8.tif", "streams.tif", "strahler.tif")
    sa = rasterio.open(strahler_path).read(1)
    sy, sx = np.where(sa > 0)
    s_order = sa[sy, sx]
    _tr = pyproj.Transformer.from_crs(
        f"EPSG:{district.utm_epsg}", "EPSG:4326", always_xy=True
    )

    def _cells_to_wgs(
        rows: np.ndarray, cols: np.ndarray
    ) -> tuple[np.ndarray, np.ndarray]:
        lo, la = _tr.transform(T.c + (cols + 0.5) * T.a, T.f + (rows + 0.5) * T.e)
        return np.round(lo, 5), np.round(la, 5)

    slon, slat = _cells_to_wgs(sy, sx)
    # Downstream endpoint of each stream cell = its highest-accumulation
    # neighbour. Vectorised over the 8 directions across all stream cells.
    own = acc[sy, sx]
    best = own.copy()
    bnr, bnc = sy.copy(), sx.copy()
    for dr, dc in _STREAM_NEIGHBORS:
        nr, nc = sy + dr, sx + dc
        inb = (nr >= 0) & (nr < H) & (nc >= 0) & (nc < W)
        nv = np.where(inb, acc[np.clip(nr, 0, H - 1), np.clip(nc, 0, W - 1)], -1)
        take = nv > best
        best = np.where(take, nv, best)
        bnr = np.where(take, nr, bnr)
        bnc = np.where(take, nc, bnc)
    s_valid = best > own
    dlon, dlat = _cells_to_wgs(bnr, bnc)

    def _streams_in(mask: np.ndarray) -> dict[str, Any]:
        """Stream features (grouped by Strahler order) where `mask` (over the
        stream-cell arrays) is true. One scan to the catchment's stream cells,
        then group + build coordinates with numpy (no per-segment Python loop)."""
        idx = np.where(mask & s_valid)[0]
        if not len(idx):
            return {"type": "FeatureCollection", "features": []}
        orders = s_order[idx]
        feats: list[dict[str, Any]] = []
        for order in np.unique(orders):
            ii = idx[orders == order]
            coords = np.stack(
                [
                    np.column_stack([slon[ii], slat[ii]]),
                    np.column_stack([dlon[ii], dlat[ii]]),
                ],
                axis=1,
            ).tolist()
            feats.append(
                {
                    "type": "Feature",
                    "properties": {"order": int(order)},
                    "geometry": {"type": "MultiLineString", "coordinates": coords},
                }
            )
        return {"type": "FeatureCollection", "features": feats}

    streams_by_lake: dict[str, Any] = {}
    seg_by_id: dict[
        int, list[tuple[int, int]]
    ] = {}  # osm_id -> one-hop downstream channel cells
    drains_map: dict[int, int | None] = {}  # osm_id -> next lake osm_id (cascade graph)

    # Canonical node set (osm_ids in the cascade graph) + per-node graph props.
    nodes_fc = json.loads(
        district.cascade_nodes_geojson_path().read_text(encoding="utf-8")
    )
    node_props = {
        f["properties"]["osm_id"]: f["properties"] for f in nodes_fc["features"]
    }
    node_ids = set(node_props)
    bodies_fc = json.loads(district.tank_polygons_path.read_text(encoding="utf-8"))
    polys: dict[int, dict[str, Any]] = {
        f["properties"]["osm_id"]: {
            "geom": shape(f["geometry"]),
            "name": f["properties"].get("name") or "",
            "name_ta": f["properties"].get("name_ta") or "",
        }
        for f in bodies_fc["features"]
        if f["properties"].get("osm_id") in node_ids
    }
    _log(f"delineating {len(polys)} of {len(node_ids)} nodes (rest have no polygon)")

    # Pre-project every polygon, and rasterise all (non-named-conduit) water
    # bodies into one barrier mask. Each lake's OWN (incremental) catchment is
    # then the upstream trace that STOPS at this barrier - the land draining to
    # it before reaching any other tank. Named rivers/canals are left out of the
    # barrier so they act as conveyance, not walls.
    poly_utm_by_id: dict[int, Any] = {}
    barrier_shapes: list[tuple[dict[str, Any], int]] = []
    for oid, m in polys.items():
        pu = shp_transform(to_utm, m["geom"])
        poly_utm_by_id[oid] = pu
        nm = f"{m['name']} {m['name_ta']}".strip()
        if not (nm and _CONDUIT_NAME_RE.search(nm)):
            barrier_shapes.append((mapping(pu), 1))
    all_tanks_mask = (
        rasterize(
            barrier_shapes, out_shape=(H, W), transform=T, fill=0, dtype="uint8"
        ).astype(bool)
        if barrier_shapes
        else np.zeros((H, W), bool)
    )
    _log(f"barrier mask: {int(all_tanks_mask.sum())} water-body cells")

    # Lake-label raster (compact index per water body) for downstream tracing.
    idx_by_id = {oid: i + 1 for i, oid in enumerate(polys)}
    id_by_idx = {i: oid for oid, i in idx_by_id.items()}
    lake_label = (
        rasterize(
            [(mapping(poly_utm_by_id[oid]), idx_by_id[oid]) for oid in polys],
            out_shape=(H, W),
            transform=T,
            fill=0,
            dtype="int32",
        )
        if polys
        else np.zeros((H, W), "int32")
    )

    catch_features: list[dict[str, Any]] = []
    lake_features: list[dict[str, Any]] = []
    area_by_id: dict[int, float] = {}
    flagged: list[dict[str, Any]] = []
    done = 0
    for osm_id, meta in polys.items():
        poly = meta["geom"]
        name_full = f"{meta['name']} {meta['name_ta']}".strip()
        name = name_full
        # Named conduits: skip before the BFS (rivers are not impoundments).
        if name and _CONDUIT_NAME_RE.search(name):
            flagged.append(
                {"osm_id": osm_id, "quality": "conduit_excluded", "name": name}
            )
            continue
        poly_utm = poly_utm_by_id[osm_id]
        seed = rasterize(
            [(mapping(poly_utm), 1)],
            out_shape=(H, W),
            transform=T,
            fill=0,
            dtype="uint8",
        ).astype(bool)
        if not seed.any():
            flagged.append({"osm_id": osm_id, "quality": "no_seed_subpixel"})
            continue
        # TOTAL = whole upstream basin; OWN = stops at the next water body.
        total_ws = _bfs_upstream(ptr, seed)
        own_ws = _bfs_upstream(ptr, seed, barrier=all_tanks_mask)
        total_km2 = round(total_ws.sum() * cell_area_m2 / 1e6, 3)
        own_km2 = round(own_ws.sum() * cell_area_m2 / 1e6, 3)
        received_km2 = round(max(total_km2 - own_km2, 0.0), 3)
        lake_km2 = round(seed.sum() * cell_area_m2 / 1e6, 3)
        # Thin ribbon draining a whole basin = a river segment, not a tank.
        # Applies to named bodies too (catches rivers like "Vrishabhavati" that
        # the conduit name-regex misses); the catchment ratio keeps genuine
        # elongated water bodies (Pulicat: low ratio) from being dropped, and the
        # area floor keeps large impoundments (Manchanabele) that otherwise look
        # like ribbons by both compactness and ratio.
        if _is_river_ribbon(poly, lake_km2, total_km2):
            flagged.append(
                {
                    "osm_id": osm_id,
                    "quality": "conduit_excluded",
                    "catchment_area_sqkm": total_km2,
                    "note": "ribbon",
                    "name": name,
                }
            )
            continue
        touches_edge = bool(
            total_ws[0, :].any()
            or total_ws[-1, :].any()
            or total_ws[:, 0].any()
            or total_ws[:, -1].any()
        )
        quality = "edge_touch_maybe_clipped" if touches_edge else "ok"
        area_by_id[osm_id] = own_km2  # headline = the lake's OWN catchment
        if touches_edge:
            flagged.append(
                {"osm_id": osm_id, "quality": quality, "total_upstream_sqkm": total_km2}
            )

        # The drawn tile is the OWN (incremental) catchment - non-overlapping,
        # so the district reads as a clean mosaic rather than nested basins.
        geoms = [
            shape(g)
            for g, v in shapes(own_ws.astype("uint8"), mask=own_ws, transform=T)
            if v == 1
        ]
        catch_utm = unary_union(geoms).simplify(15.0, preserve_topology=True)
        catch_features.append(
            {
                "type": "Feature",
                "properties": {
                    "osm_id": osm_id,
                    "catchment_area_sqkm": own_km2,  # OWN (headline)
                    "total_upstream_sqkm": total_km2,  # full basin (roll-up)
                    "received_sqkm": received_km2,  # inherited from upstream
                    "lake_area_sqkm": lake_km2,
                    "touches_edge": touches_edge,
                    "quality": quality,
                },
                "geometry": mapping(shp_transform(to_wgs, catch_utm)),
            }
        )

        # Downstream cascade neighbour: trace this lake's outlet to the first
        # lake it reaches. Embeds the cascade graph in the lakes file.
        outlet_flat = int(np.argmax(np.where(seed, acc, -1)))
        dlbl, dseg = _trace_downstream(
            acc, lake_label, divmod(outlet_flat, W), idx_by_id[osm_id]
        )
        drains_to = id_by_idx.get(dlbl)
        drains_to_name = polys[drains_to]["name"] if drains_to in polys else ""
        # One-hop channel cells (this lake's outlet -> the next lake's edge);
        # chained along drains_to after the loop into a full downstream path.
        seg_by_id[osm_id] = dseg
        drains_map[osm_id] = drains_to

        # Clickable lake layer: the real water-body polygon (not a centroid
        # circle), delineated lakes only (conduits already filtered out),
        # with all the panel stats embedded so the frontend needs one file.
        np_ = node_props.get(osm_id, {})
        lake_features.append(
            {
                "type": "Feature",
                "properties": {
                    "osm_id": osm_id,
                    "name": meta["name"],
                    "name_ta": meta["name_ta"],
                    "catchment_area_sqkm": own_km2,  # OWN (headline area of influence)
                    "total_upstream_sqkm": total_km2,  # full basin draining through it
                    "received_sqkm": received_km2,  # inherited from upstream tanks
                    "drains_to_osm_id": drains_to,  # cascade: where its overflow goes next
                    "drains_to_name": drains_to_name,
                    "lake_area_sqkm": lake_km2,
                    "degree_in": np_.get("degree_in"),
                    "degree_out": np_.get("degree_out"),
                    "cascade_position": np_.get("cascade_position"),
                    "drains_to_river": np_.get("drains_to_river"),
                    "river_outlet_distance_km": np_.get("river_outlet_distance_km"),
                },
                "geometry": mapping(poly.simplify(0.0001, preserve_topology=True)),
            }
        )

        # Feeder streams across the whole basin (own + inherited), so the
        # upstream feeders flowing in are visible, not just the local ones.
        streams_by_lake[str(osm_id)] = _streams_in(total_ws[sy, sx])
        done += 1
        if done % 200 == 0:
            _log(f"  delineated {done}/{len(polys)}")

    # Write catchments GeoJSON (merge_envelope keeps NVDM governance intact).
    out = district.cascade_catchments_geojson_path()
    out.write_text(
        json.dumps(
            merge_envelope(
                out, {"type": "FeatureCollection", "features": catch_features}
            ),
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    # Write the clickable lakes GeoJSON (real polygons, delineated lakes only).
    lakes_path = district.cascade_lakes_geojson_path()
    lakes_path.write_text(
        json.dumps(
            merge_envelope(
                lakes_path, {"type": "FeatureCollection", "features": lake_features}
            ),
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    # Write per-lake feeder streams, keyed by osm_id (served on click).
    streams_path = district.cascade_catchment_streams_json_path()
    streams_path.write_text(
        json.dumps(merge_envelope(streams_path, streams_by_lake), separators=(",", ":"))
        + "\n",
        encoding="utf-8",
    )

    # Per-lake DOWNSTREAM flow path: chain the one-hop channel segments along
    # drains_to (single out-edge per lake => O(chain) per lake) into the full
    # route from this lake's outlet down through the cascade to the river, then
    # smooth + simplify so the map can draw how the overflow actually flows.
    def _path_feature(cells: list[tuple[int, int]]) -> dict[str, Any] | None:
        if len(cells) < 2:
            return None
        step = max(1, len(cells) // 400)  # cap detail for very long routes
        rows = np.array([rc[0] for rc in cells[::step]])
        cols = np.array([rc[1] for rc in cells[::step]])
        lo, la = _cells_to_wgs(rows, cols)
        coords = list(zip(lo.tolist(), la.tolist()))
        if len(coords) < 2:
            return None
        g = LineString(_chaikin(coords)).simplify(0.00004, preserve_topology=True)
        if g.is_empty:
            return None
        return {"type": "Feature", "properties": {}, "geometry": mapping(g)}

    downstream_by_lake: dict[str, Any] = {}
    for osm_id in seg_by_id:
        cells: list[tuple[int, int]] = []
        seen: set[int] = set()
        cur: int | None = osm_id
        while cur is not None and cur not in seen and len(cells) < 6000:
            seen.add(cur)
            cells.extend(seg_by_id.get(cur, []))
            cur = drains_map.get(cur)
        feat = _path_feature(cells)
        downstream_by_lake[str(osm_id)] = {
            "type": "FeatureCollection",
            "features": [feat] if feat else [],
        }
    downstream_path = district.cascade_catchment_downstream_json_path()
    downstream_path.write_text(
        json.dumps(
            merge_envelope(downstream_path, downstream_by_lake), separators=(",", ":")
        )
        + "\n",
        encoding="utf-8",
    )

    # NOTE: per-lake TOTAL basin polygons ({district}-catchment-basin.json) are
    # generated separately (extracted from the full-BFS catchments), not in this
    # hot loop - vectorising every basin here was the run-time bottleneck.

    # Extend the nodes file in place with catchment_area_sqkm.
    for f in nodes_fc["features"]:
        f["properties"]["catchment_area_sqkm"] = area_by_id.get(
            f["properties"]["osm_id"]
        )
    nodes_path = district.cascade_nodes_geojson_path()
    nodes_path.write_text(
        json.dumps(merge_envelope(nodes_path, nodes_fc), ensure_ascii=False) + "\n",
        encoding="utf-8",
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
        "edge_touch_count": sum(
            1 for x in flagged if x["quality"] == "edge_touch_maybe_clipped"
        ),
        "no_seed_count": sum(1 for x in flagged if x["quality"] == "no_seed_subpixel"),
        "conduit_excluded_count": sum(
            1 for x in flagged if x["quality"] == "conduit_excluded"
        ),
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
    quality_path = district.cascade_catchment_quality_json_path()
    quality_path.write_text(
        json.dumps(merge_envelope(quality_path, summary), indent=2, ensure_ascii=False)
        + "\n",
        encoding="utf-8",
    )

    # Sync names from the (possibly name-backfilled) source and name the river
    # each terminal lake drains into. Folded in here so a regen is self-
    # contained; also runnable standalone via `python -m app.cascade.enrich_names`.
    from app.cascade.enrich_names import enrich_cascade_lakes

    enrich_cascade_lakes(district)
    return summary

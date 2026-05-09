from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import numpy as np
from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union

from app.gee.cities import get_city_config
from app.gee.client import initialize_earth_engine
from app.gee.reservoir_context import (
    canonicalize_reservoir_name,
    read_catchment_payload,
)

# Catchment derivation today is Chennai-only (HydroBASINS reference points
# are hand-picked per reservoir below). When another city onboards
# reservoir-context, parameterise this on city_id.
_CHENNAI_CITY = get_city_config("chennai")
PHASE1_RESERVOIRS = _CHENNAI_CITY.phase1_reservoirs
RESERVOIR_CATCHMENTS_PATH = _CHENNAI_CITY.reservoir_catchments_path
WATER_BODIES_PATH = _CHENNAI_CITY.current_water_bodies_path

HYDROBASINS_DATASET_TEMPLATE = "WWF/HydroSHEDS/v1/Basins/hybas_{level}"
DEFAULT_HYDROBASINS_LEVEL = 12
DEFAULT_SIMPLIFY_METERS = 250
MERIT_HYDRO_DATASET = "MERIT/Hydro/v1_0_1"

# These are reservoir reference points used to fetch a first-pass HydroBASINS
# catchment candidate. They are not treated as formal outlet points.
RESERVOIR_REFERENCE_POINTS: dict[str, tuple[float, float]] = {
    "poondi": (80.0678, 13.3542),
    "cholavaram": (80.1499, 13.2184),
    "redhills": (80.1811, 13.1710),
    "chembarambakkam": (80.0551, 12.9517),
}

_DEFAULT_METADATA = {
    "status": "pending_verification",
    "notes": (
        "Populate with verified catchment polygons for Poondi, Red Hills, "
        "Chembarambakkam, and Cholavaram before enabling Phase 1 reservoir rainfall "
        "context."
    ),
    "expected_reservoirs": list(PHASE1_RESERVOIRS),
}

_RESERVOIR_NOTES = {
    "redhills": (
        "HydroBASINS level-12 candidate captured from the Red Hills reservoir footprint. "
        "This is a reviewed derived geometry and should be reconciled with the CMDA "
        "Red Hills catchment map before final verification."
    ),
    "poondi": (
        "HydroBASINS candidate represents local upstream terrain support only. "
        "Imported Krishna water should be treated separately in product copy."
    ),
    "cholavaram": (
        "HydroBASINS candidate represents local runoff support only inside a managed "
        "reservoir network. At level 12 this currently resolves to the same basin "
        "as Red Hills, so it should be treated as a provisional low-confidence "
        "candidate until a better local derivation is available."
    ),
    "chembarambakkam": (
        "HydroBASINS candidate should be reviewed against the Adyar catchment "
        "hydrologic literature before final verification."
    ),
}

_RESERVOIR_CONFIDENCE = {
    "poondi": "medium",
    "redhills": "medium",
    "chembarambakkam": "medium",
    "cholavaram": "low",
}

_LOCAL_MERIT_CONFIG = {
    "cholavaram": {
        "waterbody_names": ("Sholavaram Lake", "Cholavaram Lake"),
        "outlet_hint": (80.169497, 13.222619),
        "bbox_buffer_meters": 5000,
        "seed_search_radius_cells": 1,
        "confidence": "medium",
        "notes": (
            "Local MERIT Hydro upstream trace built from the strongest upstream-area "
            "cell just downstream of Sholavaram Lake. This is a local runoff-support "
            "catchment candidate and should still be reviewed against drainage and "
            "managed-transfer infrastructure."
        ),
    }
}


def build_hydrobasins_catchment_feature(
    *,
    reservoir: str,
    geometry: dict[str, Any],
    properties: dict[str, Any],
    source_dataset: str,
    hydrobasins_level: int,
    reference_point: tuple[float, float],
    derivation_method: str = "hydrobasins_point_intersection",
    extra_properties: dict[str, Any] | None = None,
) -> dict[str, Any]:
    canonical = canonicalize_reservoir_name(reservoir)
    if canonical not in PHASE1_RESERVOIRS:
        raise RuntimeError(f"Unknown Phase 1 reservoir: {reservoir!r}")

    normalized_geometry = {
        "type": geometry.get("type"),
        "coordinates": geometry.get("coordinates"),
    }

    if normalized_geometry["type"] not in {"Polygon", "MultiPolygon"}:
        raise RuntimeError(
            f"HydroBASINS candidate for {canonical} returned unsupported geometry "
            f"{normalized_geometry['type']!r}"
        )

    merged_properties = {
        "reservoir": canonical,
        "source_type": "derived",
        "confidence": _RESERVOIR_CONFIDENCE.get(canonical, "medium"),
        "geometry_status": "reviewed_candidate",
        "derivation_method": derivation_method,
        "source_dataset": source_dataset,
        "hydrobasins_level": hydrobasins_level,
        "source_hybas_id": properties.get("HYBAS_ID"),
        "next_down": properties.get("NEXT_DOWN"),
        "pfaf_id": properties.get("PFAF_ID"),
        "main_basin_id": properties.get("MAIN_BAS"),
        "sub_area_sqkm": properties.get("SUB_AREA"),
        "up_area_sqkm": properties.get("UP_AREA"),
        "reference_lng": round(reference_point[0], 6),
        "reference_lat": round(reference_point[1], 6),
        "notes": _RESERVOIR_NOTES.get(canonical, ""),
    }
    if extra_properties:
        merged_properties.update(extra_properties)

    return {
        "type": "Feature",
        "properties": merged_properties,
        "geometry": normalized_geometry,
    }


def build_merit_local_catchment_feature(
    *,
    reservoir: str,
    geometry: dict[str, Any],
    source_dataset: str,
    outlet_hint: tuple[float, float],
    seed_point: tuple[float, float],
    seed_upa_sqkm: float,
    visited_cell_count: int,
    bbox_buffer_meters: int,
) -> dict[str, Any]:
    canonical = canonicalize_reservoir_name(reservoir)
    if canonical not in PHASE1_RESERVOIRS:
        raise RuntimeError(f"Unknown Phase 1 reservoir: {reservoir!r}")

    config = _LOCAL_MERIT_CONFIG.get(canonical)
    if not config:
        raise RuntimeError(f"No MERIT local configuration for reservoir {canonical}")

    normalized_geometry = {
        "type": geometry.get("type"),
        "coordinates": geometry.get("coordinates"),
    }

    if normalized_geometry["type"] not in {"Polygon", "MultiPolygon"}:
        raise RuntimeError(
            f"MERIT local candidate for {canonical} returned unsupported geometry "
            f"{normalized_geometry['type']!r}"
        )

    return {
        "type": "Feature",
        "properties": {
            "reservoir": canonical,
            "source_type": "derived_local_support",
            "confidence": config["confidence"],
            "geometry_status": "reviewed_candidate",
            "derivation_method": "merit_local_upstream_trace",
            "source_dataset": source_dataset,
            "outlet_hint_lng": round(outlet_hint[0], 6),
            "outlet_hint_lat": round(outlet_hint[1], 6),
            "seed_lng": round(seed_point[0], 6),
            "seed_lat": round(seed_point[1], 6),
            "seed_upa_sqkm": round(seed_upa_sqkm, 2),
            "visited_cell_count": visited_cell_count,
            "bbox_buffer_meters": bbox_buffer_meters,
            "notes": config["notes"],
        },
        "geometry": normalized_geometry,
    }


def _load_named_waterbody_geometry(*, names: tuple[str, ...]) -> Any:
    if not WATER_BODIES_PATH.exists():
        raise RuntimeError(f"Missing water-bodies GeoJSON: {WATER_BODIES_PATH}")

    payload = json.loads(WATER_BODIES_PATH.read_text(encoding="utf-8"))
    for feature in payload.get("features", []):
        name = (feature.get("properties", {}).get("name") or "").strip()
        if name in names:
            return shape(feature["geometry"])

    raise RuntimeError(
        f"Could not find waterbody geometry for any of: {', '.join(names)}"
    )


def _expand_bounds(
    bounds: tuple[float, float, float, float], *, buffer_meters: int
) -> tuple[float, float, float, float]:
    min_lon, min_lat, max_lon, max_lat = bounds
    mean_lat = (min_lat + max_lat) / 2
    lat_buffer = buffer_meters / 111_320
    lon_scale = max(np.cos(np.deg2rad(mean_lat)), 0.1)
    lon_buffer = buffer_meters / (111_320 * lon_scale)
    return (
        min_lon - lon_buffer,
        min_lat - lat_buffer,
        max_lon + lon_buffer,
        max_lat + lat_buffer,
    )


def _sample_merit_window(
    *, bounds: tuple[float, float, float, float]
) -> tuple[np.ndarray, np.ndarray]:
    min_lon, min_lat, max_lon, max_lat = bounds
    ee = initialize_earth_engine()
    region = ee.Geometry.BBox(min_lon, min_lat, max_lon, max_lat)
    properties = (
        ee.Image(MERIT_HYDRO_DATASET)
        .select(["dir", "upa"])
        .sampleRectangle(region=region)
        .getInfo()["properties"]
    )
    return np.array(properties["dir"]), np.array(properties["upa"], dtype=float)


def _find_seed_cell(
    *,
    upa_array: np.ndarray,
    bounds: tuple[float, float, float, float],
    outlet_hint: tuple[float, float],
    search_radius_cells: int,
) -> tuple[int, int]:
    min_lon, min_lat, max_lon, max_lat = bounds
    nrows, ncols = upa_array.shape
    dx = (max_lon - min_lon) / ncols
    dy = (max_lat - min_lat) / nrows

    col = int((outlet_hint[0] - min_lon) / dx)
    row = int((max_lat - outlet_hint[1]) / dy)
    row = min(max(row, 0), nrows - 1)
    col = min(max(col, 0), ncols - 1)

    row_start = max(0, row - search_radius_cells)
    row_end = min(nrows, row + search_radius_cells + 1)
    col_start = max(0, col - search_radius_cells)
    col_end = min(ncols, col + search_radius_cells + 1)
    window = upa_array[row_start:row_end, col_start:col_end]
    if not np.isfinite(window).any():
        raise RuntimeError(
            "Could not identify a finite upstream-area seed cell near the outlet hint."
        )
    local_idx = np.unravel_index(np.nanargmax(window), window.shape)
    return row_start + int(local_idx[0]), col_start + int(local_idx[1])


def _trace_upstream_cells(
    dir_array: np.ndarray, *, seed_row: int, seed_col: int
) -> set[tuple[int, int]]:
    nrows, ncols = dir_array.shape
    deltas = {
        1: (0, 1),
        2: (1, 1),
        4: (1, 0),
        8: (1, -1),
        16: (0, -1),
        32: (-1, -1),
        64: (-1, 0),
        128: (-1, 1),
    }

    reverse: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for row in range(nrows):
        for col in range(ncols):
            value = dir_array[row, col]
            if not np.isfinite(value):
                continue
            direction = int(value)
            if direction not in deltas:
                continue
            d_row, d_col = deltas[direction]
            next_row = row + d_row
            next_col = col + d_col
            if 0 <= next_row < nrows and 0 <= next_col < ncols:
                reverse.setdefault((next_row, next_col), []).append((row, col))

    visited = {(seed_row, seed_col)}
    frontier = [(seed_row, seed_col)]
    while frontier:
        node = frontier.pop()
        for upstream in reverse.get(node, []):
            if upstream in visited:
                continue
            visited.add(upstream)
            frontier.append(upstream)
    return visited


def _mask_to_polygon_geometry(
    *,
    cells: set[tuple[int, int]],
    bounds: tuple[float, float, float, float],
    shape_: tuple[int, int],
) -> dict[str, Any]:
    min_lon, min_lat, max_lon, max_lat = bounds
    nrows, ncols = shape_
    dx = (max_lon - min_lon) / ncols
    dy = (max_lat - min_lat) / nrows

    boxes = []
    for row, col in cells:
        cell_min_lon = min_lon + col * dx
        cell_max_lon = min_lon + (col + 1) * dx
        cell_max_lat = max_lat - row * dy
        cell_min_lat = max_lat - (row + 1) * dy
        boxes.append(box(cell_min_lon, cell_min_lat, cell_max_lon, cell_max_lat))

    merged = unary_union(boxes)
    simplified = merged.simplify(min(dx, dy) / 2, preserve_topology=True)
    return mapping(simplified)


def derive_merit_local_catchment_feature(*, reservoir: str) -> dict[str, Any]:
    canonical = canonicalize_reservoir_name(reservoir)
    if canonical not in PHASE1_RESERVOIRS:
        raise RuntimeError(f"Unknown Phase 1 reservoir: {reservoir!r}")

    config = _LOCAL_MERIT_CONFIG.get(canonical)
    if not config:
        raise RuntimeError(
            f"No MERIT local derivation configuration for reservoir {canonical}"
        )

    waterbody_geometry = _load_named_waterbody_geometry(names=config["waterbody_names"])
    bounds = _expand_bounds(
        waterbody_geometry.bounds,
        buffer_meters=int(config["bbox_buffer_meters"]),
    )
    dir_array, upa_array = _sample_merit_window(bounds=bounds)
    seed_row, seed_col = _find_seed_cell(
        upa_array=upa_array,
        bounds=bounds,
        outlet_hint=config["outlet_hint"],
        search_radius_cells=int(config["seed_search_radius_cells"]),
    )
    cells = _trace_upstream_cells(dir_array, seed_row=seed_row, seed_col=seed_col)
    geometry = _mask_to_polygon_geometry(
        cells=cells, bounds=bounds, shape_=dir_array.shape
    )
    derived_shape = shape(geometry)
    if not derived_shape.intersects(waterbody_geometry):
        raise RuntimeError(
            f"MERIT local catchment for {canonical} did not intersect the source waterbody geometry."
        )

    min_lon, min_lat, max_lon, max_lat = bounds
    nrows, ncols = dir_array.shape
    dx = (max_lon - min_lon) / ncols
    dy = (max_lat - min_lat) / nrows
    seed_point = (
        min_lon + (seed_col + 0.5) * dx,
        max_lat - (seed_row + 0.5) * dy,
    )

    return build_merit_local_catchment_feature(
        reservoir=canonical,
        geometry=geometry,
        source_dataset=MERIT_HYDRO_DATASET,
        outlet_hint=config["outlet_hint"],
        seed_point=seed_point,
        seed_upa_sqkm=float(upa_array[seed_row, seed_col]),
        visited_cell_count=len(cells),
        bbox_buffer_meters=int(config["bbox_buffer_meters"]),
    )


def _suggest_geometry_version(features: list[dict[str, Any]]) -> str:
    has_local_support = any(
        ((feature.get("properties") or {}).get("derivation_method") or "").startswith(
            "merit_"
        )
        or (
            (feature.get("properties") or {}).get("source_type")
            == "derived_local_support"
        )
        for feature in features
    )
    if has_local_support:
        return "hybrid-catchment-candidates-v1"
    return "hydrobasins-candidates-v1"


def select_upstream_hybas_ids(
    records: list[dict[str, Any]],
    *,
    target_hybas_id: int,
) -> list[int]:
    next_down_by_id: dict[int, int] = {}

    for record in records:
        hybas_id = record.get("HYBAS_ID")
        next_down = record.get("NEXT_DOWN")
        if hybas_id is None:
            continue
        next_down_by_id[int(hybas_id)] = int(next_down) if next_down is not None else 0

    upstream_ids: list[int] = []
    for hybas_id in next_down_by_id:
        current = hybas_id
        visited: set[int] = set()
        while current and current not in visited:
            if current == target_hybas_id:
                upstream_ids.append(hybas_id)
                break
            visited.add(current)
            current = next_down_by_id.get(current, 0)

    if target_hybas_id not in upstream_ids:
        upstream_ids.append(target_hybas_id)

    return sorted(set(upstream_ids))


def derive_hydrobasins_catchment_feature(
    *,
    reservoir: str,
    hydrobasins_level: int = DEFAULT_HYDROBASINS_LEVEL,
    simplify_meters: int = DEFAULT_SIMPLIFY_METERS,
    reference_point: tuple[float, float] | None = None,
    include_upstream: bool = False,
) -> dict[str, Any]:
    canonical = canonicalize_reservoir_name(reservoir)
    if canonical not in PHASE1_RESERVOIRS:
        raise RuntimeError(f"Unknown Phase 1 reservoir: {reservoir!r}")

    if hydrobasins_level <= 0 or hydrobasins_level > 12:
        raise RuntimeError("hydrobasins_level must be between 1 and 12")
    if simplify_meters <= 0:
        raise RuntimeError("simplify_meters must be positive")

    point = reference_point or RESERVOIR_REFERENCE_POINTS.get(canonical)
    if point is None:
        raise RuntimeError(f"Missing reference point for reservoir {canonical}")

    source_dataset = HYDROBASINS_DATASET_TEMPLATE.format(level=hydrobasins_level)
    ee = initialize_earth_engine()
    point_geom = ee.Geometry.Point(list(point))
    collection = ee.FeatureCollection(source_dataset)
    feature = collection.filterBounds(point_geom).first()

    feature_info = feature.getInfo()
    if not feature_info:
        raise RuntimeError(
            f"No HydroBASINS feature found for reservoir {canonical} at level "
            f"{hydrobasins_level}"
        )

    geometry_source = feature.geometry()
    derivation_method = "hydrobasins_point_intersection"
    extra_properties: dict[str, Any] = {}

    properties = feature_info.get("properties", {})
    target_hybas_id = properties.get("HYBAS_ID")
    main_basin_id = properties.get("MAIN_BAS")

    if include_upstream and target_hybas_id is not None and main_basin_id is not None:
        topology_info = (
            collection.filter(ee.Filter.eq("MAIN_BAS", main_basin_id))
            .select(["HYBAS_ID", "NEXT_DOWN"])
            .getInfo()
        )
        topology_records = [
            feature_row.get("properties", {})
            for feature_row in topology_info.get("features", [])
        ]
        upstream_ids = select_upstream_hybas_ids(
            topology_records,
            target_hybas_id=int(target_hybas_id),
        )
        geometry_source = collection.filter(
            ee.Filter.inList("HYBAS_ID", upstream_ids)
        ).geometry()
        derivation_method = "hydrobasins_upstream_union"
        extra_properties = {
            "upstream_union": True,
            "upstream_feature_count": len(upstream_ids),
            "upstream_hybas_ids": upstream_ids,
        }

    geometry_info = geometry_source.simplify(maxError=simplify_meters).getInfo()

    return build_hydrobasins_catchment_feature(
        reservoir=canonical,
        geometry=geometry_info,
        properties=properties,
        source_dataset=source_dataset,
        hydrobasins_level=hydrobasins_level,
        reference_point=point,
        derivation_method=derivation_method,
        extra_properties=extra_properties,
    )


def _load_or_create_catchment_payload(path: Path) -> dict[str, Any]:
    if path.exists():
        payload = read_catchment_payload(path)
    else:
        payload = {
            "type": "FeatureCollection",
            "name": "chennai-reservoir-catchments",
            "metadata": deepcopy(_DEFAULT_METADATA),
            "features": [],
        }

    payload.setdefault("type", "FeatureCollection")
    payload.setdefault("name", "chennai-reservoir-catchments")
    metadata = payload.setdefault("metadata", {})
    for key, value in _DEFAULT_METADATA.items():
        metadata.setdefault(key, deepcopy(value))
    payload.setdefault("features", [])
    return payload


def upsert_catchment_candidate(
    feature: dict[str, Any],
    *,
    path: Path | None = None,
    geometry_version: str | None = None,
) -> dict[str, Any]:
    output_path = (path or RESERVOIR_CATCHMENTS_PATH).expanduser().resolve()
    payload = _load_or_create_catchment_payload(output_path)
    features = payload.get("features", [])

    reservoir = canonicalize_reservoir_name(
        (feature.get("properties") or {}).get("reservoir")
    )
    if reservoir not in PHASE1_RESERVOIRS:
        raise RuntimeError(
            f"Candidate feature is missing a valid reservoir name: {reservoir!r}"
        )

    next_features: list[dict[str, Any]] = []
    replaced = False
    for existing in features:
        existing_name = canonicalize_reservoir_name(
            (existing.get("properties") or {}).get("reservoir")
        )
        if existing_name == reservoir:
            next_features.append(feature)
            replaced = True
        else:
            next_features.append(existing)

    if not replaced:
        next_features.append(feature)

    next_features.sort(
        key=lambda item: PHASE1_RESERVOIRS.index(
            canonicalize_reservoir_name((item.get("properties") or {}).get("reservoir"))
        )
    )

    completed = [
        canonicalize_reservoir_name((item.get("properties") or {}).get("reservoir"))
        for item in next_features
    ]
    completed = [name for name in completed if name in PHASE1_RESERVOIRS]

    metadata = payload["metadata"]
    metadata["status"] = (
        "partial_review"
        if len(completed) < len(PHASE1_RESERVOIRS)
        else "ready_for_verification"
    )
    metadata["geometry_version"] = geometry_version or _suggest_geometry_version(
        next_features
    )
    metadata["completed_reservoirs"] = completed
    metadata["notes"] = (
        "Catchment features in this file are curated candidate polygons. "
        "HydroBASINS and local MERIT-derived geometries should be reviewed against "
        "Chennai drainage and official catchment sources before Phase 1 is enabled."
    )

    payload["features"] = next_features
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return {
        "path": str(output_path),
        "feature_count": len(next_features),
        "completed_reservoirs": completed,
        "geometry_version": metadata["geometry_version"],
        "replaced": replaced,
    }

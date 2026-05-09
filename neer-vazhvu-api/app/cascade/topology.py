"""Layer A: DEM-derived cascade topology.

For each tank polygon in the district:
  1. Compute centroid and area.
  2. Sample elevation at the centroid from a global DEM (HydroSHEDS
     conditioned DEM by default; equivalent products work for any city).
  3. Identify likely downstream neighbours within
     `max_downstream_distance_km` whose elevation is lower.
  4. Pick the single best downstream candidate, scored by elevation
     drop normalised by distance (steeper-and-closer wins).

Output is a directed graph rendered as GeoJSON FeatureCollections:
  - nodes: tank polygons with `degree_in`, `degree_out`, and
    `cascade_position` (depth in the longest path it sits on).
  - edges: LineStrings from upstream centroid to downstream centroid
    with `status='predicted'` until later stages (channels.py,
    encroachment.py, scoring.py) upgrade or downgrade them.

This is a v0 heuristic, not full hydrological flow accumulation. It
gives a defensible first-cut cascade structure that can be refined in
P5 with proper flow tracing on a downloaded flow-direction raster.

Pure-Python graph logic; the only external call is the GEE elevation
sample, which is split into a separate function so the graph builder
itself stays unit-testable with synthetic inputs.
"""

from __future__ import annotations

import json
import math
from typing import Any

from app.cascade.districts import DistrictCascadeConfig


# HydroSHEDS conditioned DEM at 3 arc-second (~90 m) resolution. Global
# coverage, GEE-native, free. Using the conditioned variant means sinks
# are filled, which is what flow-routing-style heuristics expect.
HYDROSHEDS_CONDITIONED_DEM = "WWF/HydroSHEDS/03CONDEM"
HYDROSHEDS_DEM_BAND = "b1"
HYDROSHEDS_DEM_SCALE_METERS = 90

_GEOMETRY_TYPES = {"Polygon", "MultiPolygon"}
_EARTH_RADIUS_KM = 6371.0088


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance in km between two (lat, lon) points."""
    lat1, lon1 = a
    lat2, lon2 = b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def _polygon_centroid(geometry: dict[str, Any]) -> tuple[float, float] | None:
    """Approximate centroid as the mean of the outer ring vertices.

    Sufficient for cascade-scale work (tank centroids only need to be
    inside the polygon for distance-based reasoning). Avoids a shapely
    dependency for the pure logic.
    """
    if geometry.get("type") == "Polygon":
        coords = geometry.get("coordinates", [[]])[0]
    elif geometry.get("type") == "MultiPolygon":
        # Use the first / largest ring's outer boundary.
        polys = geometry.get("coordinates", [])
        if not polys or not polys[0]:
            return None
        coords = polys[0][0]
    else:
        return None
    if not coords:
        return None
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return (sum(lats) / len(lats), sum(lons) / len(lons))


def _read_tank_polygons(district: DistrictCascadeConfig) -> list[dict[str, Any]]:
    """Load tank polygons that are eligible to enter the cascade graph.

    Filters out features without geometry, without an osm_id, or below
    the district's minimum tank area threshold.
    """
    payload = json.loads(
        district.tank_polygons_path.read_text(encoding="utf-8")
    )
    if payload.get("type") != "FeatureCollection":
        raise RuntimeError(
            f"Tank polygons file is not a FeatureCollection: "
            f"{district.tank_polygons_path}"
        )

    eligible: list[dict[str, Any]] = []
    for feature in payload.get("features", []):
        geometry = feature.get("geometry") or {}
        if geometry.get("type") not in _GEOMETRY_TYPES:
            continue
        properties = feature.get("properties") or {}
        if properties.get("osm_id") is None:
            continue
        area_ha = float(properties.get("area_ha") or 0)
        if area_ha < district.min_tank_area_ha:
            continue
        eligible.append(feature)
    return eligible


def _sample_elevations_via_gee(
    centroids: list[tuple[float, float]],
) -> list[float | None]:
    """Sample HydroSHEDS DEM elevations at all centroids in one GEE call.

    Returns a list of elevations in meters, aligned with the input order.
    Centroids over no-data pixels return None.
    """
    if not centroids:
        return []

    from app.gee.client import initialize_earth_engine

    ee = initialize_earth_engine()
    dem = ee.Image(HYDROSHEDS_CONDITIONED_DEM).select(HYDROSHEDS_DEM_BAND)

    # Build a FeatureCollection of points; use the row index as the join
    # key so we can put results back in input order.
    features = [
        ee.Feature(ee.Geometry.Point([lon, lat]), {"_idx": idx})
        for idx, (lat, lon) in enumerate(centroids)
    ]
    fc = ee.FeatureCollection(features)
    sampled = dem.reduceRegions(
        collection=fc,
        reducer=ee.Reducer.first(),
        scale=HYDROSHEDS_DEM_SCALE_METERS,
        tileScale=4,
    ).getInfo()

    elevations: list[float | None] = [None] * len(centroids)
    for feat in sampled.get("features", []):
        props = feat.get("properties") or {}
        idx = props.get("_idx")
        first = props.get("first")
        if idx is None:
            continue
        elevations[int(idx)] = None if first is None else float(first)
    return elevations


def _build_graph_from_polygons_with_elevations(
    *,
    polygons: list[dict[str, Any]],
    elevations: list[float | None],
    district: DistrictCascadeConfig,
) -> dict[str, list[dict[str, Any]]]:
    """Pure-Python graph builder. No GEE, fully unit-testable.

    `polygons` is a list of GeoJSON Features; `elevations` is the
    matching elevation in meters (or None when the DEM had no data).
    """
    if len(polygons) != len(elevations):
        raise RuntimeError("polygons and elevations must be the same length")

    # Build node records keyed by osm_id.
    nodes_by_osm: dict[int, dict[str, Any]] = {}
    centroids: dict[int, tuple[float, float]] = {}
    elevations_by_osm: dict[int, float | None] = {}
    for feature, elevation in zip(polygons, elevations, strict=True):
        properties = feature["properties"]
        osm_id = int(properties["osm_id"])
        centroid = _polygon_centroid(feature["geometry"])
        if centroid is None:
            continue
        nodes_by_osm[osm_id] = {
            "osm_id": osm_id,
            "name": properties.get("name") or "",
            "name_ta": properties.get("name_ta") or "",
            "area_ha": float(properties.get("area_ha") or 0.0),
            "water_type": properties.get("water_type") or "",
            "centroid": centroid,
            "elevation_m": elevation,
        }
        centroids[osm_id] = centroid
        elevations_by_osm[osm_id] = elevation

    # For each upstream tank, score downstream candidates and pick the
    # single best one. A tank can be downstream of many uppers; only its
    # own outflow is constrained to a single edge in this v0.
    edges_out: dict[int, tuple[int, float, float]] = {}
    osm_ids = list(nodes_by_osm)
    max_dist = district.max_downstream_distance_km

    for upstream in osm_ids:
        elev_up = elevations_by_osm[upstream]
        if elev_up is None:
            continue
        cent_up = centroids[upstream]
        best: tuple[int, float, float] | None = None  # (downstream, score, dist_km)
        for downstream in osm_ids:
            if downstream == upstream:
                continue
            elev_dn = elevations_by_osm[downstream]
            if elev_dn is None:
                continue
            drop = elev_up - elev_dn
            if drop <= 0:
                continue
            dist = _haversine_km(cent_up, centroids[downstream])
            if dist <= 0 or dist > max_dist:
                continue
            # Score: steeper and closer wins. Drop is in m, dist in km;
            # we prefer the highest drop / dist (m per km of separation).
            score = drop / dist
            if best is None or score > best[1]:
                best = (downstream, score, dist)
        if best is not None:
            edges_out[upstream] = best

    # Compute degree_in.
    degree_in: dict[int, int] = {osm_id: 0 for osm_id in osm_ids}
    for upstream, (downstream, _score, _dist) in edges_out.items():
        degree_in[downstream] += 1

    # Compute cascade_position via depth-from-source. A "source" tank
    # has no inbound edge (degree_in == 0); its position is 1. Its
    # downstream is 2, etc. With a DAG (which this is by elevation
    # construction) this is stable.
    cascade_position: dict[int, int] = {}

    def _resolve_position(osm_id: int, seen: frozenset[int]) -> int:
        if osm_id in cascade_position:
            return cascade_position[osm_id]
        if osm_id in seen:
            # Cycle defence (shouldn't happen because elevation strictly
            # decreases along any edge). Treat as source.
            return 1
        # Find all uppers that flow into this node.
        uppers = [
            up for up, (dn, _s, _d) in edges_out.items() if dn == osm_id
        ]
        if not uppers:
            depth = 1
        else:
            depth = 1 + max(
                _resolve_position(up, seen | {osm_id}) for up in uppers
            )
        cascade_position[osm_id] = depth
        return depth

    for osm_id in osm_ids:
        _resolve_position(osm_id, frozenset())

    # Compose GeoJSON Features.
    node_features: list[dict[str, Any]] = []
    for osm_id, node in nodes_by_osm.items():
        lat, lon = node["centroid"]
        node_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "osm_id": osm_id,
                    "name": node["name"],
                    "name_ta": node["name_ta"],
                    "area_ha": node["area_ha"],
                    "water_type": node["water_type"],
                    "elevation_m": node["elevation_m"],
                    "degree_in": degree_in[osm_id],
                    "degree_out": 1 if osm_id in edges_out else 0,
                    "cascade_position": cascade_position[osm_id],
                },
            }
        )

    edge_features: list[dict[str, Any]] = []
    for upstream, (downstream, score, dist_km) in edges_out.items():
        cent_up = centroids[upstream]
        cent_dn = centroids[downstream]
        elev_up = elevations_by_osm[upstream]
        elev_dn = elevations_by_osm[downstream]
        edge_features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [cent_up[1], cent_up[0]],
                        [cent_dn[1], cent_dn[0]],
                    ],
                },
                "properties": {
                    "from_osm_id": upstream,
                    "to_osm_id": downstream,
                    "distance_km": round(dist_km, 3),
                    "elevation_drop_m": round(
                        (elev_up or 0) - (elev_dn or 0), 2
                    ),
                    "score_m_per_km": round(score, 2),
                    # Predicted only; channel evidence + encroachment
                    # overlay refine this later.
                    "status": "predicted",
                },
            }
        )

    # Stable ordering for diff-friendly output.
    node_features.sort(key=lambda f: f["properties"]["osm_id"])
    edge_features.sort(
        key=lambda f: (
            f["properties"]["from_osm_id"],
            f["properties"]["to_osm_id"],
        )
    )

    return {"nodes": node_features, "edges": edge_features}


def build_graph(district: DistrictCascadeConfig) -> dict[str, Any]:
    """Build the DEM-derived cascade graph for a district.

    Returns `{"nodes": [...], "edges": [...]}` ready for serialization.
    Side effects: one GEE elevation-sample call. No DB writes.
    """
    polygons = _read_tank_polygons(district)
    centroids: list[tuple[float, float]] = []
    valid_polygons: list[dict[str, Any]] = []
    for feature in polygons:
        centroid = _polygon_centroid(feature["geometry"])
        if centroid is None:
            continue
        centroids.append(centroid)
        valid_polygons.append(feature)

    elevations = _sample_elevations_via_gee(centroids)
    return _build_graph_from_polygons_with_elevations(
        polygons=valid_polygons,
        elevations=elevations,
        district=district,
    )

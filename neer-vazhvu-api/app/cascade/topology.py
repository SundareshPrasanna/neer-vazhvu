"""Layer A: DEM-derived cascade topology.

For each tank polygon in the district:

  1. Compute centroid and area.
  2. Sample elevation AND D8 flow direction at the centroid (one
     batched GEE call per dataset; HydroSHEDS conditioned DEM
     `WWF/HydroSHEDS/03CONDEM` for elevation, `WWF/HydroSHEDS/03DIR`
     for flow direction).
  3. Identify likely downstream neighbours within
     `max_downstream_distance_km` whose elevation is lower AND that
     sit within a +/- 67.5 degree cone aligned with the upstream
     tank's flow-direction code.
  4. Reject any candidate edge whose straight-line LineString
     intersects a river LineString (water doesn't flow across rivers,
     it falls into them). Rivers are loaded from
     `district.rivers_path` if present.
  5. Pick the single best downstream candidate, scored by elevation
     drop normalised by distance.

Why both elevation AND flow direction:
  - Bare elevation is unreliable in flat terrain (Chennai delta has
    many tanks at integer-rounded elevations like 8, 9, 10 metres -
    "downhill" decisions become noise).
  - Flow direction encodes the LOCAL descent direction at the
    upstream pixel, which stays informative even when elevations are
    near-tied. Combining the two: elevation says "this is plausibly
    downhill", flow direction says "this is plausibly the right
    bearing".

Output is a directed graph rendered as GeoJSON FeatureCollections:
  - nodes: tank polygons with `degree_in`, `degree_out`, and
    `cascade_position` (depth in the longest path it sits on).
  - edges: LineStrings from upstream centroid to downstream centroid
    with `status='predicted'` until later stages refine.

Pure-Python graph logic; the GEE / shapely / file-IO calls are
isolated in helper functions so the graph builder itself stays
unit-testable with synthetic inputs.
"""

from __future__ import annotations

import json
import math
from typing import Any

from app.cascade.districts import DistrictCascadeConfig


HYDROSHEDS_CONDITIONED_DEM = "WWF/HydroSHEDS/03CONDEM"
HYDROSHEDS_DEM_BAND = "b1"
HYDROSHEDS_DEM_SCALE_METERS = 90

# Drainage-direction raster, ESRI D8 codes (1=E, 2=SE, 4=S, 8=SW,
# 16=W, 32=NW, 64=N, 128=NE). 0 = no data; 247 = sink.
HYDROSHEDS_FLOW_DIR = "WWF/HydroSHEDS/03DIR"
HYDROSHEDS_FLOW_DIR_BAND = "b1"

_GEOMETRY_TYPES = {"Polygon", "MultiPolygon"}
_EARTH_RADIUS_KM = 6371.0088

# water_type values that should NEVER enter the cascade graph as nodes.
# Rivers, canals, drains, and channels are conduits, not tanks - if a
# river segment is in the polygon set (the OSM dump frequently has
# named river polygons like "Vaigai River"), it would otherwise be
# treated as a tank that water flows into / out of, which is nonsense.
EXCLUDED_WATER_TYPES_FOR_CASCADE = frozenset(
    {
        "river",
        "stream",
        "canal",
        "drain",
        "ditch",
        "wastewater",
    }
)

# How wide the "downstream cone" is around the flow-direction bearing.
# 67.5 degrees = 1.5 * D8 cell. Strict enough to reject candidates on
# the wrong side of the upstream tank, lenient enough to accommodate
# tanks slightly off the principal flow vector.
FLOW_DIRECTION_CONE_HALFANGLE_DEG = 67.5

# ESRI D8 -> compass bearing in degrees from North.
D8_TO_BEARING_DEG: dict[int, float] = {
    1: 90.0,    # E
    2: 135.0,   # SE
    4: 180.0,   # S
    8: 225.0,   # SW
    16: 270.0,  # W
    32: 315.0,  # NW
    64: 0.0,    # N (also 360)
    128: 45.0,  # NE
}


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = a
    lat2, lon2 = b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def _bearing_deg(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Initial great-circle bearing from a to b, in degrees from North."""
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def _angular_distance_deg(a: float, b: float) -> float:
    """Smallest angular separation between two compass bearings."""
    diff = abs(a - b) % 360
    return min(diff, 360 - diff)


def _polygon_centroid(geometry: dict[str, Any]) -> tuple[float, float] | None:
    if geometry.get("type") == "Polygon":
        coords = geometry.get("coordinates", [[]])[0]
    elif geometry.get("type") == "MultiPolygon":
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

    Drops features without geometry, without an osm_id, below the
    district's minimum tank-area threshold, OR whose water_type is a
    conduit (river/canal/etc.) rather than a tank.
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
        water_type = str(properties.get("water_type") or "").strip().lower()
        if water_type in EXCLUDED_WATER_TYPES_FOR_CASCADE:
            continue
        area_ha = float(properties.get("area_ha") or 0)
        if area_ha < district.min_tank_area_ha:
            continue
        eligible.append(feature)
    return eligible


def _load_river_segments(district: DistrictCascadeConfig) -> list[Any]:
    """Return shapely LineString instances for every river segment.

    Returns an empty list if the district has no rivers_path or the
    file doesn't exist; the river-crossing check is then a no-op.
    """
    rivers_path = district.rivers_path
    if rivers_path is None or not rivers_path.exists():
        return []

    from shapely.geometry import LineString, MultiLineString, shape

    payload = json.loads(rivers_path.read_text(encoding="utf-8"))
    segments: list[Any] = []
    for feature in payload.get("features", []):
        geometry = feature.get("geometry") or {}
        gtype = geometry.get("type")
        if gtype not in {"LineString", "MultiLineString"}:
            continue
        geom = shape(geometry)
        if isinstance(geom, MultiLineString):
            segments.extend(list(geom.geoms))
        elif isinstance(geom, LineString):
            segments.append(geom)
    return segments


def _sample_elevations_via_gee(
    centroids: list[tuple[float, float]],
) -> list[float | None]:
    """Sample HydroSHEDS DEM elevations at all centroids in one GEE call."""
    if not centroids:
        return []

    from app.gee.client import initialize_earth_engine

    ee = initialize_earth_engine()
    dem = ee.Image(HYDROSHEDS_CONDITIONED_DEM).select(HYDROSHEDS_DEM_BAND)
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


def _sample_flow_directions_via_gee(
    centroids: list[tuple[float, float]],
) -> list[int | None]:
    """Sample HydroSHEDS D8 flow-direction codes at all centroids."""
    if not centroids:
        return []

    from app.gee.client import initialize_earth_engine

    ee = initialize_earth_engine()
    flow_dir = ee.Image(HYDROSHEDS_FLOW_DIR).select(HYDROSHEDS_FLOW_DIR_BAND)
    features = [
        ee.Feature(ee.Geometry.Point([lon, lat]), {"_idx": idx})
        for idx, (lat, lon) in enumerate(centroids)
    ]
    fc = ee.FeatureCollection(features)
    sampled = flow_dir.reduceRegions(
        collection=fc,
        reducer=ee.Reducer.first(),
        scale=HYDROSHEDS_DEM_SCALE_METERS,
        tileScale=4,
    ).getInfo()

    codes: list[int | None] = [None] * len(centroids)
    for feat in sampled.get("features", []):
        props = feat.get("properties") or {}
        idx = props.get("_idx")
        first = props.get("first")
        if idx is None:
            continue
        if first is None:
            continue
        try:
            value = int(round(float(first)))
        except (TypeError, ValueError):
            continue
        codes[int(idx)] = value
    return codes


def _find_river_outlet(
    *,
    tank_centroid: tuple[float, float],
    flow_direction_d8: int | None,
    river_segments: list[Any],
    max_outlet_distance_km: float,
) -> tuple[float, float, float, float] | None:
    """If the tank's flow direction points to a river within range, return
    the nearest in-cone river-outlet point as
    (outlet_lat, outlet_lng, distance_km, bearing_deg).

    Otherwise None (tank has no river to drain into in its flow direction,
    or no flow data, or no rivers configured).
    """
    if not river_segments or flow_direction_d8 is None:
        return None
    expected_bearing = D8_TO_BEARING_DEG.get(flow_direction_d8)
    if expected_bearing is None:
        return None

    from shapely.geometry import Point

    tank_lat, tank_lng = tank_centroid
    tank_point = Point(tank_lng, tank_lat)  # shapely is (x, y) = (lng, lat)

    best: tuple[float, float, float, float] | None = None
    for segment in river_segments:
        # Closest point on the LineString to the tank centroid.
        proj_dist = segment.project(tank_point)
        nearest = segment.interpolate(proj_dist)
        outlet_lat = nearest.y
        outlet_lng = nearest.x
        dist_km = _haversine_km(tank_centroid, (outlet_lat, outlet_lng))
        if dist_km > max_outlet_distance_km or dist_km <= 0:
            continue
        bearing_to_outlet = _bearing_deg(tank_centroid, (outlet_lat, outlet_lng))
        if (
            _angular_distance_deg(bearing_to_outlet, expected_bearing)
            > FLOW_DIRECTION_CONE_HALFANGLE_DEG
        ):
            continue
        if best is None or dist_km < best[2]:
            best = (outlet_lat, outlet_lng, dist_km, bearing_to_outlet)
    return best


def _candidate_passes_flow_direction(
    *,
    upstream_flow_code: int | None,
    upstream_centroid: tuple[float, float],
    downstream_centroid: tuple[float, float],
) -> bool:
    """Is the candidate within the upstream tank's downstream cone?

    Falls back to ACCEPT when the upstream tank has no usable flow
    direction (code 0, missing, sink at 247, or any value outside the
    D8 set). This keeps behaviour reasonable in border / no-data
    regions while still letting the cone gate filter out wrong-bearing
    candidates wherever the flow raster has a real direction.
    """
    if upstream_flow_code is None:
        return True
    expected_bearing = D8_TO_BEARING_DEG.get(upstream_flow_code)
    if expected_bearing is None:
        return True
    bearing_to_candidate = _bearing_deg(upstream_centroid, downstream_centroid)
    return (
        _angular_distance_deg(bearing_to_candidate, expected_bearing)
        <= FLOW_DIRECTION_CONE_HALFANGLE_DEG
    )


def _build_graph_from_polygons_with_elevations(
    *,
    polygons: list[dict[str, Any]],
    elevations: list[float | None],
    district: DistrictCascadeConfig,
    flow_directions: list[int | None] | None = None,
    river_segments: list[Any] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Pure-Python graph builder. No GEE, fully unit-testable.

    `flow_directions` and `river_segments` are optional - when not
    provided, the corresponding gates degrade to "accept everything"
    (so legacy tests written before those gates existed still pass).
    """
    if len(polygons) != len(elevations):
        raise RuntimeError("polygons and elevations must be the same length")
    if flow_directions is not None and len(flow_directions) != len(polygons):
        raise RuntimeError(
            "flow_directions, when provided, must match the polygon count"
        )

    nodes_by_osm: dict[int, dict[str, Any]] = {}
    centroids: dict[int, tuple[float, float]] = {}
    elevations_by_osm: dict[int, float | None] = {}
    flow_by_osm: dict[int, int | None] = {}

    for idx, (feature, elevation) in enumerate(
        zip(polygons, elevations, strict=True)
    ):
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
        flow_by_osm[osm_id] = (
            flow_directions[idx] if flow_directions is not None else None
        )

    # Optional river-crossing barrier.
    river_index = None
    if river_segments:
        from shapely.strtree import STRtree

        river_index = STRtree(river_segments)

    edges_out: dict[int, tuple[int, float, float]] = {}
    osm_ids = list(nodes_by_osm)
    max_dist = district.max_downstream_distance_km

    for upstream in osm_ids:
        elev_up = elevations_by_osm[upstream]
        if elev_up is None:
            continue
        cent_up = centroids[upstream]
        flow_code_up = flow_by_osm[upstream]
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
            cent_dn = centroids[downstream]
            dist = _haversine_km(cent_up, cent_dn)
            if dist <= 0 or dist > max_dist:
                continue
            if not _candidate_passes_flow_direction(
                upstream_flow_code=flow_code_up,
                upstream_centroid=cent_up,
                downstream_centroid=cent_dn,
            ):
                continue
            if river_index is not None:
                from shapely.geometry import LineString

                edge_line = LineString(
                    [
                        (cent_up[1], cent_up[0]),
                        (cent_dn[1], cent_dn[0]),
                    ]
                )
                hits = river_index.query(edge_line, predicate="intersects")
                if len(hits) > 0:
                    continue
            score = drop / dist
            if best is None or score > best[1]:
                best = (downstream, score, dist)
        if best is not None:
            edges_out[upstream] = best

    # Tanks that didn't get a tank-to-tank outflow but whose flow
    # direction points to a river within range drain INTO that river.
    # Stored as (outlet_lat, outlet_lng, distance_km, bearing_deg).
    river_outlets_by_osm: dict[int, tuple[float, float, float, float]] = {}
    if river_segments:
        for tank_osm_id in osm_ids:
            if tank_osm_id in edges_out:
                continue  # already drains to a tank
            outlet = _find_river_outlet(
                tank_centroid=centroids[tank_osm_id],
                flow_direction_d8=flow_by_osm[tank_osm_id],
                river_segments=river_segments,
                max_outlet_distance_km=district.max_river_outlet_distance_km,
            )
            if outlet is not None:
                river_outlets_by_osm[tank_osm_id] = outlet

    degree_in: dict[int, int] = {osm_id: 0 for osm_id in osm_ids}
    for _upstream, (downstream, _score, _dist) in edges_out.items():
        degree_in[downstream] += 1

    cascade_position: dict[int, int] = {}

    def _resolve_position(osm_id: int, seen: frozenset[int]) -> int:
        if osm_id in cascade_position:
            return cascade_position[osm_id]
        if osm_id in seen:
            return 1
        uppers = [up for up, (dn, _s, _d) in edges_out.items() if dn == osm_id]
        depth = (
            1 + max(_resolve_position(up, seen | {osm_id}) for up in uppers)
            if uppers
            else 1
        )
        cascade_position[osm_id] = depth
        return depth

    for osm_id in osm_ids:
        _resolve_position(osm_id, frozenset())

    node_features: list[dict[str, Any]] = []
    for osm_id, node in nodes_by_osm.items():
        lat, lon = node["centroid"]
        outlet = river_outlets_by_osm.get(osm_id)
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
                    "flow_direction_d8": flow_by_osm[osm_id],
                    "degree_in": degree_in[osm_id],
                    "degree_out": 1 if osm_id in edges_out else 0,
                    "cascade_position": cascade_position[osm_id],
                    "drains_to_river": outlet is not None,
                    "river_outlet_distance_km": (
                        round(outlet[2], 3) if outlet is not None else None
                    ),
                    "river_outlet_bearing_deg": (
                        round(outlet[3], 1) if outlet is not None else None
                    ),
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
                    "status": "predicted",
                },
            }
        )

    river_outlet_features: list[dict[str, Any]] = []
    for tank_osm_id, (out_lat, out_lng, dist_km, bearing) in (
        river_outlets_by_osm.items()
    ):
        cent = centroids[tank_osm_id]
        river_outlet_features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [cent[1], cent[0]],
                        [out_lng, out_lat],
                    ],
                },
                "properties": {
                    "from_osm_id": tank_osm_id,
                    "from_name": nodes_by_osm[tank_osm_id]["name"],
                    "distance_km": round(dist_km, 3),
                    "bearing_deg": round(bearing, 1),
                    "status": "drains_to_river",
                },
            }
        )

    node_features.sort(key=lambda f: f["properties"]["osm_id"])
    edge_features.sort(
        key=lambda f: (
            f["properties"]["from_osm_id"],
            f["properties"]["to_osm_id"],
        )
    )
    river_outlet_features.sort(key=lambda f: f["properties"]["from_osm_id"])

    return {
        "nodes": node_features,
        "edges": edge_features,
        "river_outlets": river_outlet_features,
    }


def build_graph(district: DistrictCascadeConfig) -> dict[str, Any]:
    """Build the DEM- and flow-direction-derived cascade graph."""
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
    flow_directions = _sample_flow_directions_via_gee(centroids)
    river_segments = _load_river_segments(district)

    return _build_graph_from_polygons_with_elevations(
        polygons=valid_polygons,
        elevations=elevations,
        district=district,
        flow_directions=flow_directions,
        river_segments=river_segments,
    )

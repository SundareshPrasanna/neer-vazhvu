"""Unit tests for the pure-Python cascade graph builder.

The GEE-coupled `build_graph` wrapper is exercised by the CLI smoke
test against real Madurai data; here we test the graph-construction
logic in isolation with synthetic polygons + elevations.
"""

from __future__ import annotations

import pytest

from app.cascade.districts import DistrictCascadeConfig
from app.cascade.topology import (
    _build_graph_from_polygons_with_elevations,
    _haversine_km,
    _polygon_centroid,
)


def _square_polygon(osm_id: int, name: str, lat: float, lon: float, area_ha: float):
    """Tiny ~1 km square polygon centred at (lat, lon)."""
    half = 0.005  # ~ 0.5 km in degrees at this latitude
    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [lon - half, lat - half],
                    [lon + half, lat - half],
                    [lon + half, lat + half],
                    [lon - half, lat + half],
                    [lon - half, lat - half],
                ]
            ],
        },
        "properties": {
            "osm_id": osm_id,
            "name": name,
            "area_ha": area_ha,
            "water_type": "reservoir",
        },
    }


def _district(tmp_path, **overrides) -> DistrictCascadeConfig:
    base = dict(
        district_id="testville",
        label="Testville",
        state="tamil_nadu",
        tank_polygons_path=tmp_path / "polygons.geojson",
    )
    base.update(overrides)
    return DistrictCascadeConfig(**base)


def test_haversine_returns_zero_for_identical_points():
    assert _haversine_km((9.9, 78.1), (9.9, 78.1)) == pytest.approx(0)


def test_haversine_one_degree_latitude_is_about_111km():
    assert _haversine_km((9.0, 78.0), (10.0, 78.0)) == pytest.approx(111, abs=1)


def test_polygon_centroid_returns_mean_of_outer_ring():
    centroid = _polygon_centroid(_square_polygon(1, "x", 9.9, 78.1, 10)["geometry"])
    assert centroid == pytest.approx((9.9, 78.1), abs=0.001)


def test_polygon_centroid_returns_none_for_unsupported_geometry():
    assert _polygon_centroid({"type": "Point", "coordinates": [78.0, 9.0]}) is None


def test_three_tank_chain_produces_two_predicted_edges(tmp_path):
    # Three tanks lined up with strictly decreasing elevation along a
    # north-south axis. Expect a clean two-edge cascade A -> B -> C.
    polygons = [
        _square_polygon(1, "Top tank", lat=9.93, lon=78.1, area_ha=20),
        _square_polygon(2, "Mid tank", lat=9.92, lon=78.1, area_ha=15),
        _square_polygon(3, "Low tank", lat=9.91, lon=78.1, area_ha=10),
    ]
    elevations = [180.0, 150.0, 120.0]
    district = _district(tmp_path, max_downstream_distance_km=3.0)

    graph = _build_graph_from_polygons_with_elevations(
        polygons=polygons,
        elevations=elevations,
        district=district,
    )

    edge_pairs = {
        (e["properties"]["from_osm_id"], e["properties"]["to_osm_id"])
        for e in graph["edges"]
    }
    assert edge_pairs == {(1, 2), (2, 3)}


def test_cascade_position_assigns_depth_from_source(tmp_path):
    polygons = [
        _square_polygon(1, "Top tank", lat=9.93, lon=78.1, area_ha=20),
        _square_polygon(2, "Mid tank", lat=9.92, lon=78.1, area_ha=15),
        _square_polygon(3, "Low tank", lat=9.91, lon=78.1, area_ha=10),
    ]
    elevations = [180.0, 150.0, 120.0]
    district = _district(tmp_path)

    graph = _build_graph_from_polygons_with_elevations(
        polygons=polygons, elevations=elevations, district=district
    )

    by_id = {n["properties"]["osm_id"]: n["properties"] for n in graph["nodes"]}
    assert by_id[1]["cascade_position"] == 1
    assert by_id[2]["cascade_position"] == 2
    assert by_id[3]["cascade_position"] == 3
    assert by_id[1]["degree_in"] == 0 and by_id[1]["degree_out"] == 1
    assert by_id[2]["degree_in"] == 1 and by_id[2]["degree_out"] == 1
    assert by_id[3]["degree_in"] == 1 and by_id[3]["degree_out"] == 0


def test_uphill_neighbour_does_not_become_downstream(tmp_path):
    # Two tanks; B is uphill of A. Algorithm must not produce A -> B.
    polygons = [
        _square_polygon(1, "Lower", lat=9.92, lon=78.1, area_ha=20),
        _square_polygon(2, "Upper", lat=9.93, lon=78.1, area_ha=15),
    ]
    elevations = [120.0, 180.0]  # 1 lower, 2 higher
    district = _district(tmp_path)

    graph = _build_graph_from_polygons_with_elevations(
        polygons=polygons, elevations=elevations, district=district
    )

    edges = [
        (e["properties"]["from_osm_id"], e["properties"]["to_osm_id"])
        for e in graph["edges"]
    ]
    # Only 2 -> 1 should exist; never 1 -> 2.
    assert edges == [(2, 1)]


def test_neighbour_outside_distance_threshold_is_skipped(tmp_path):
    polygons = [
        _square_polygon(1, "Top", lat=9.93, lon=78.1, area_ha=20),
        # Far tank: ~5 km south, lower elevation. Should be excluded
        # by the 3 km cap.
        _square_polygon(2, "Far low", lat=9.88, lon=78.1, area_ha=10),
    ]
    elevations = [180.0, 100.0]
    district = _district(tmp_path, max_downstream_distance_km=3.0)

    graph = _build_graph_from_polygons_with_elevations(
        polygons=polygons, elevations=elevations, district=district
    )

    assert graph["edges"] == []


def test_node_with_missing_elevation_is_skipped_as_upstream(tmp_path):
    polygons = [
        _square_polygon(1, "No elev", lat=9.93, lon=78.1, area_ha=20),
        _square_polygon(2, "Has elev", lat=9.92, lon=78.1, area_ha=10),
    ]
    elevations = [None, 100.0]
    district = _district(tmp_path)

    graph = _build_graph_from_polygons_with_elevations(
        polygons=polygons, elevations=elevations, district=district
    )

    # Tank 1 has no elevation, so it can't be an upstream candidate.
    # Tank 2 has lower elevation than tank 1 (None vs 100) but elevation
    # comparison requires both sides; 1 -> 2 should not appear.
    assert graph["edges"] == []
    # But tank 1 still appears as a node with elevation_m=None.
    by_id = {n["properties"]["osm_id"]: n["properties"] for n in graph["nodes"]}
    assert by_id[1]["elevation_m"] is None


def test_diamond_cascade_picks_steepest_downstream(tmp_path):
    # Top tank has two downhill candidates of similar distance. The one
    # with bigger elevation drop should win.
    polygons = [
        _square_polygon(1, "Top", lat=9.93, lon=78.1, area_ha=20),
        _square_polygon(2, "Gentle drop", lat=9.92, lon=78.10, area_ha=10),
        _square_polygon(3, "Steep drop", lat=9.92, lon=78.11, area_ha=10),
    ]
    elevations = [180.0, 170.0, 100.0]  # 3 has the much steeper drop
    district = _district(tmp_path)

    graph = _build_graph_from_polygons_with_elevations(
        polygons=polygons, elevations=elevations, district=district
    )

    edges = [
        (e["properties"]["from_osm_id"], e["properties"]["to_osm_id"])
        for e in graph["edges"]
    ]
    assert (1, 3) in edges
    assert (1, 2) not in edges


def test_min_tank_area_filters_out_small_polygons_via_read(tmp_path):
    # _build_graph_from_polygons_with_elevations doesn't filter by area
    # (that happens in _read_tank_polygons), so the helper should just
    # use what's given. This test documents that.
    polygons = [
        _square_polygon(1, "Top", lat=9.93, lon=78.1, area_ha=0.01),  # tiny
        _square_polygon(2, "Bot", lat=9.92, lon=78.1, area_ha=0.01),
    ]
    elevations = [180.0, 100.0]
    district = _district(tmp_path, min_tank_area_ha=10.0)

    graph = _build_graph_from_polygons_with_elevations(
        polygons=polygons, elevations=elevations, district=district
    )

    # Both still appear because the helper trusts its input. The area
    # filter is a responsibility of _read_tank_polygons.
    assert len(graph["nodes"]) == 2

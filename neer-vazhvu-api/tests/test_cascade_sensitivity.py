"""Unit tests for the cascade sensitivity sweeper.

The main entry point `run_sensitivity_analysis` is exercised
end-to-end against real Madurai/Chennai data in the smoke suite;
here we test the smaller building blocks (graph summary,
parameter-sweep loop dispatch, min-area below-default skip
behaviour) in isolation.
"""

from __future__ import annotations

from app.cascade import sensitivity, topology
from app.cascade.districts import DistrictCascadeConfig


def _district(tmp_path, **overrides) -> DistrictCascadeConfig:
    base = dict(
        district_id="testville",
        label="Testville",
        state="tamil_nadu",
        tank_polygons_path=tmp_path / "polygons.geojson",
    )
    base.update(overrides)
    return DistrictCascadeConfig(**base)


def _square_polygon(osm_id, name, lat, lon, area_ha):
    half = 0.005
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


def test_summarise_graph_counts_nodes_edges_outlets():
    fake_graph = {
        "nodes": [
            {
                "properties": {
                    "cascade_position": 1,
                    "degree_in": 0,
                    "degree_out": 1,
                    "drains_to_river": False,
                }
            },
            {
                "properties": {
                    "cascade_position": 2,
                    "degree_in": 1,
                    "degree_out": 0,
                    "drains_to_river": False,
                }
            },
            {
                "properties": {
                    "cascade_position": 1,
                    "degree_in": 0,
                    "degree_out": 0,
                    "drains_to_river": False,
                }
            },
        ],
        "edges": [
            {"properties": {"confidence": "high"}},
        ],
        "river_outlets": [{"properties": {}}],
    }
    summary = sensitivity._summarise_graph(fake_graph)
    assert summary["node_count"] == 3
    assert summary["edge_count"] == 1
    assert summary["river_outlet_count"] == 1
    assert summary["max_cascade_depth"] == 2
    assert summary["isolated_count"] == 1  # third node has 0/0/False
    assert summary["edge_confidence_counts"]["high"] == 1


def test_sweep_max_downstream_distance_changes_edge_count(tmp_path):
    polygons = [
        _square_polygon(1, "Top", lat=9.95, lon=78.1, area_ha=20),
        _square_polygon(2, "Mid", lat=9.94, lon=78.1, area_ha=15),
        # Far tank: ~5 km south. In range at >=5 km, out of range at 3 km.
        _square_polygon(3, "Far", lat=9.90, lon=78.1, area_ha=10),
    ]
    elevations = [200.0, 150.0, 100.0]
    flow_directions = [None, None, None]
    district = _district(tmp_path, max_downstream_distance_km=3.0)

    results = sensitivity._sweep_one_parameter(
        "max_downstream_distance_km",
        [3.0, 6.0],
        base_district=district,
        polygons=polygons,
        elevations=elevations,
        flow_directions=flow_directions,
        river_segments=[],
    )

    # At 3.0 km tank 1 reaches tank 2 but the chain stops; at 6.0 km
    # it can extend to tank 3.
    by_value = {r["value"]: r for r in results}
    assert by_value[3.0]["edge_count"] < by_value[6.0]["edge_count"]


def test_sweep_min_area_below_default_is_skipped(tmp_path):
    district = _district(tmp_path, min_tank_area_ha=1.0)
    results = sensitivity._sweep_one_parameter(
        "min_tank_area_ha",
        [0.5, 1.0, 2.0],
        base_district=district,
        polygons=[],
        elevations=[],
        flow_directions=[],
        river_segments=[],
    )
    by_value = {r["value"]: r for r in results}
    assert by_value[0.5]["skipped"] is True
    assert "below the default" in by_value[0.5]["note"]
    assert by_value[1.0]["skipped"] is False
    assert by_value[2.0]["skipped"] is False


def test_sweep_cone_halfangle_restores_module_constant(tmp_path):
    # The sweep monkey-patches FLOW_DIRECTION_CONE_HALFANGLE_DEG.
    # Ensure it is restored after the run, even with multiple values.
    original = topology.FLOW_DIRECTION_CONE_HALFANGLE_DEG
    district = _district(tmp_path)
    sensitivity._sweep_one_parameter(
        "cone_halfangle_deg",
        [22.5, 45.0, 67.5],
        base_district=district,
        polygons=[],
        elevations=[],
        flow_directions=[],
        river_segments=[],
    )
    assert topology.FLOW_DIRECTION_CONE_HALFANGLE_DEG == original

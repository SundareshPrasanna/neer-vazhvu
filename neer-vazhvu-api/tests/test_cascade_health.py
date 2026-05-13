"""Unit tests for the cascade health scorer.

Tests pin the scoring formula so future weight tuning shows up as
intentional, traceable changes. The end-to-end `compute_cascade_health`
function is exercised via real Madurai/Chennai data in the smoke
suite; here we test the pure scoring + component-finding logic
with small fixtures.
"""

from __future__ import annotations

from app.cascade import health


def test_priority_bands():
    assert health._classify_priority(0.0) == "CRITICAL"
    assert health._classify_priority(24.9) == "CRITICAL"
    assert health._classify_priority(25.0) == "HIGH"
    assert health._classify_priority(44.9) == "HIGH"
    assert health._classify_priority(45.0) == "MEDIUM"
    assert health._classify_priority(69.9) == "MEDIUM"
    assert health._classify_priority(70.0) == "LOW"
    assert health._classify_priority(100.0) == "LOW"


def test_normalise_name_strips_common_suffixes():
    assert health._normalise_name("Vandiyur tank") == "vandiyur"
    assert health._normalise_name("Vandiyur Lake") == "vandiyur"
    assert health._normalise_name("Madakulam Kanmai") == "madakulam"
    assert (
        health._normalise_name("Reservoir near Thiruppalai (13.2 ha)")
        == "thiruppalai"
    )


def test_intersects_lost_matches_normalised_name():
    lost = {"Vandiyur tank", "Tallakulam tank", "Sengulam tank"}
    assert health._intersects_lost("Vandiyur Lake", lost) == "Vandiyur tank"
    # Substring match against the lost-tank name (>=4 chars).
    assert health._intersects_lost("Reservoir near Tallakulam", lost) == "Tallakulam tank"
    # No match for unrelated names.
    assert health._intersects_lost("Some Other Reservoir", lost) is None
    # Empty lost set returns None.
    assert health._intersects_lost("Vandiyur Lake", set()) is None


def test_find_connected_components_basic():
    # Three components: {1,2,3} chain, {4,5} pair, {6} isolated.
    node_ids = {1, 2, 3, 4, 5, 6}
    edges = [(1, 2), (2, 3), (4, 5)]
    components = health.find_connected_components(node_ids, edges)
    component_sets = [frozenset(c) for c in components]
    assert frozenset({1, 2, 3}) in component_sets
    assert frozenset({4, 5}) in component_sets
    assert frozenset({6}) in component_sets


def test_find_connected_components_treats_edges_as_undirected():
    # A -> B and C -> B in the directed graph -> all in one component
    # under undirected component-finding.
    node_ids = {1, 2, 3}
    edges = [(1, 2), (3, 2)]
    components = health.find_connected_components(node_ids, edges)
    assert len(components) == 1
    assert components[0] == {1, 2, 3}


def test_score_documented_cascade_full_intact():
    # All tanks resolved AND in OSM, all edges reproduced, all HIGH
    # confidence, no lost-tank hits. Should produce health=100.
    cascade = {
        "cascade_id": "test-perfect",
        "name": "Perfect cascade",
        "tanks_in_order": [
            {"name": "A", "osm_id": 1},
            {"name": "B", "osm_id": 2},
            {"name": "C", "osm_id": 3},
        ],
        "edges": [
            {"from_index": 0, "to_index": 1, "link_type": "natural"},
            {"from_index": 1, "to_index": 2, "link_type": "natural"},
        ],
    }
    result = health.score_documented_cascade(
        cascade,
        current_node_osm_ids={1, 2, 3},
        edges_by_pair={
            (1, 2): {"confidence": "high"},
            (2, 3): {"confidence": "high"},
        },
        lost_tank_names=set(),
    )
    assert result["health_score"] == 100.0
    assert result["priority"] == "LOW"
    assert result["components"]["tank_presence"]["ratio"] == 1.0
    assert result["components"]["edge_reproduction"]["ratio"] == 1.0
    assert result["components"]["avg_edge_confidence"] == 1.0


def test_score_documented_cascade_no_tanks_in_osm():
    # No tanks resolve, no edges match, no confidence info.
    cascade = {
        "cascade_id": "test-lost",
        "name": "Lost cascade",
        "tanks_in_order": [{"name": "X"}, {"name": "Y"}],
        "edges": [{"from_index": 0, "to_index": 1}],
    }
    result = health.score_documented_cascade(
        cascade,
        current_node_osm_ids=set(),
        edges_by_pair={},
        lost_tank_names=set(),
    )
    assert result["health_score"] == 0.0
    assert result["priority"] == "CRITICAL"


def test_score_documented_cascade_lost_tank_penalty_capped():
    # Many lost-tank matches: penalty is capped at the documented
    # constant (40 by default).
    cascade = {
        "cascade_id": "test-many-lost",
        "name": "Many lost",
        "tanks_in_order": [
            {"name": "Tallakulam", "osm_id": 1},
            {"name": "Sengulam", "osm_id": 2},
            {"name": "Managiri", "osm_id": 3},
            {"name": "Athikulam", "osm_id": 4},
            {"name": "Pudhukulam", "osm_id": 5},
            {"name": "Mudakkaththan", "osm_id": 6},
        ],
        "edges": [],
    }
    lost = {
        "Tallakulam tank",
        "Sengulam tank",
        "Managiri tank",
        "Athikulam tank",
        "Pudhukulam tank",
        "Mudakkaththan tank",
    }
    result = health.score_documented_cascade(
        cascade,
        current_node_osm_ids={1, 2, 3, 4, 5, 6},
        edges_by_pair={},
        lost_tank_names=lost,
    )
    # All tanks "present" (osm_id matches), no edges (no doc edges):
    # tank_presence_ratio = 1.0, edge_repro = 0, avg_conf = 0
    # raw_health = 0.4 * 100 = 40
    # 6 lost hits * 10 = 60 raw penalty, capped at 40 -> health = 0
    assert result["health_score"] == 0.0
    assert len(result["components"]["lost_tank_intersections"]) == 6


def test_score_auto_cascade_below_threshold_returns_score():
    # The scorer always returns a result; the orchestrator is what
    # filters out tiny components. Single-tank "component" still scores.
    nodes_by_id = {
        1: {"name": "Tiny", "area_ha": 0.5, "isolation_reason": None},
    }
    result = health.score_auto_cascade(
        component={1},
        nodes_by_id=nodes_by_id,
        component_edges=[],
        lost_tank_names=set(),
    )
    # Health: 0.6 * 0 (no edges) + 0.4 * 1.0 (not isolated) = 40
    assert result["health_score"] == 40.0
    assert result["priority"] == "HIGH"
    assert result["size"] == 1


def test_score_auto_cascade_full_chain():
    # 3 tanks, 2 HIGH-confidence edges, none isolated. Should score
    # 0.6 * 1.0 + 0.4 * 1.0 = 100.
    nodes_by_id = {
        1: {"name": "A", "area_ha": 10.0, "isolation_reason": None},
        2: {"name": "B", "area_ha": 5.0, "isolation_reason": None},
        3: {"name": "C", "area_ha": 8.0, "isolation_reason": None},
    }
    edges = [
        {"confidence": "high"},
        {"confidence": "high"},
    ]
    result = health.score_auto_cascade(
        component={1, 2, 3},
        nodes_by_id=nodes_by_id,
        component_edges=edges,
        lost_tank_names=set(),
    )
    assert result["health_score"] == 100.0
    assert result["priority"] == "LOW"
    assert result["representative_tank_name"] == "A"
    assert result["total_area_ha"] == 23.0


def test_score_auto_cascade_returns_tanks_in_topological_order():
    # Chain: 1 -> 2 -> 3 -> 4. Topological sort should produce that order.
    nodes_by_id = {
        1: {"name": "Head", "area_ha": 5.0, "isolation_reason": None},
        2: {"name": "Mid", "area_ha": 4.0, "isolation_reason": None},
        3: {"name": "Lower", "area_ha": 3.0, "isolation_reason": None},
        4: {"name": "Terminal", "area_ha": 2.0, "isolation_reason": None},
    }
    edges = [
        {"from_osm_id": 1, "to_osm_id": 2, "confidence": "high"},
        {"from_osm_id": 2, "to_osm_id": 3, "confidence": "high"},
        {"from_osm_id": 3, "to_osm_id": 4, "confidence": "high"},
    ]
    result = health.score_auto_cascade(
        component={1, 2, 3, 4},
        nodes_by_id=nodes_by_id,
        component_edges=edges,
        lost_tank_names=set(),
    )
    order = [t["osm_id"] for t in result["tanks_in_order"]]
    assert order == [1, 2, 3, 4]
    # Headwater + terminal flags
    assert result["tanks_in_order"][0]["is_headwater_in_component"] is True
    assert result["tanks_in_order"][0]["is_terminal_in_component"] is False
    assert result["tanks_in_order"][-1]["is_headwater_in_component"] is False
    assert result["tanks_in_order"][-1]["is_terminal_in_component"] is True


def test_score_auto_cascade_tanks_in_order_handles_diamond():
    # 1 -> 2 and 1 -> 3; 2 -> 4 and 3 -> 4. Tank 1 first, tank 4 last.
    nodes_by_id = {nid: {"name": f"T{nid}", "area_ha": 1.0} for nid in [1, 2, 3, 4]}
    edges = [
        {"from_osm_id": 1, "to_osm_id": 2},
        {"from_osm_id": 1, "to_osm_id": 3},
        {"from_osm_id": 2, "to_osm_id": 4},
        {"from_osm_id": 3, "to_osm_id": 4},
    ]
    result = health.score_auto_cascade(
        component={1, 2, 3, 4},
        nodes_by_id=nodes_by_id,
        component_edges=edges,
        lost_tank_names=set(),
    )
    order = [t["osm_id"] for t in result["tanks_in_order"]]
    assert order[0] == 1  # headwater first
    assert order[-1] == 4  # terminal last
    # 2 and 3 in between, in either order (osm_id-tiebroken to 2 then 3)
    assert order[1:3] == [2, 3]


def test_score_auto_cascade_isolated_nodes_reduce_score():
    # Two of three nodes isolated, low-confidence edges.
    nodes_by_id = {
        1: {"name": "A", "area_ha": 1.0, "isolation_reason": "no_neighbors_in_range"},
        2: {"name": "B", "area_ha": 1.0, "isolation_reason": None},
        3: {"name": "C", "area_ha": 1.0, "isolation_reason": "all_neighbors_uphill"},
    }
    edges = [{"confidence": "low"}]
    result = health.score_auto_cascade(
        component={1, 2, 3},
        nodes_by_id=nodes_by_id,
        component_edges=edges,
        lost_tank_names=set(),
    )
    # 0.6 * 0.2 + 0.4 * (1/3) = 0.12 + 0.133 = 0.253 -> 25.3
    # (no lost-tank hits since names don't match the empty set)
    assert 20.0 <= result["health_score"] <= 30.0

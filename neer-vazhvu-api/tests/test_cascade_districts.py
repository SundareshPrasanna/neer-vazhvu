import json

import pytest

from app.cascade.districts import (
    CASCADE_OUTPUT_DIR,
    CASCADE_TILE_DIR,
    DistrictCascadeConfig,
    HistoricalEra,
    NamedCascade,
    get_district_cascade_config,
    supported_district_ids,
)
from app.cascade import publish


def test_supported_district_ids_includes_seeded_cities():
    # Subset check (not equality) so adding a new district (Delhi /
    # Mumbai / etc.) doesn't break the test without an explicit update.
    assert {"chennai", "madurai", "bangalore"}.issubset(supported_district_ids())


def test_get_district_cascade_config_normalises_case():
    assert get_district_cascade_config(" Madurai ").district_id == "madurai"


def test_get_district_cascade_config_raises_for_unknown_district():
    with pytest.raises(RuntimeError, match="Unknown district_id"):
        get_district_cascade_config("delhi")


def test_madurai_config_points_at_madurai_assets():
    madurai = get_district_cascade_config("madurai")
    assert madurai.tank_polygons_path.name == "madurai-water-bodies-current.geojson"
    assert madurai.state == "tamil_nadu"


def test_madurai_config_includes_pandya_and_nayak_eras():
    madurai = get_district_cascade_config("madurai")
    eras = {era.era for era in madurai.historical_eras}
    assert eras == {"Pandya", "Nayak"}


def test_chennai_config_starts_with_no_curation():
    chennai = get_district_cascade_config("chennai")
    assert chennai.named_cascades == ()
    assert chennai.court_references == ()


def test_bangalore_config_points_at_bangalore_assets():
    bangalore = get_district_cascade_config("bangalore")
    assert bangalore.tank_polygons_path.name == "bangalore-water-bodies-current.geojson"
    assert bangalore.state == "karnataka"
    # Multi-outflow scoring is the Bangalore-specific topology override -
    # the ridge city's traditional kere chains had feeder + surplus
    # channels that single-outflow scoring would lose.
    assert bangalore.allow_multi_outflow is True


def test_bangalore_config_includes_kempegowda_era():
    bangalore = get_district_cascade_config("bangalore")
    eras = {era.era for era in bangalore.historical_eras}
    assert "Kempegowda" in eras


def test_bangalore_config_includes_forward_foundation_court_anchor():
    bangalore = get_district_cascade_config("bangalore")
    case_ids = {case.case_id for case in bangalore.court_references}
    assert "forward-foundation-ngt-2012" in case_ids


def test_output_paths_are_district_scoped():
    madurai = get_district_cascade_config("madurai")
    assert madurai.cascade_nodes_geojson_path() == (
        CASCADE_OUTPUT_DIR / "madurai-cascade-nodes.geojson"
    )
    assert madurai.cascade_edges_pmtiles_path() == (
        CASCADE_TILE_DIR / "madurai-cascade-edges.pmtiles"
    )


def test_named_cascade_dataclass_is_hashable_and_frozen():
    # frozen=True + slots=True means equality is structural; this also
    # guarantees curation entries can live in tuples on the config.
    a = NamedCascade(cascade_id="vaigai-east", name="Vaigai East")
    b = NamedCascade(cascade_id="vaigai-east", name="Vaigai East")
    assert a == b
    with pytest.raises(AttributeError):
        a.name = "mutated"  # type: ignore[misc]


def test_historical_era_carries_period_bounds():
    era = HistoricalEra(era="Pandya", period_start=300, period_end=1300)
    assert era.period_end - era.period_start == 1000


def test_publish_write_geojson_roundtrips_to_disk(tmp_path, monkeypatch):
    # Redirect output dirs so the test doesn't pollute the real public/
    monkeypatch.setattr(publish, "CASCADE_OUTPUT_DIR", tmp_path / "data")
    monkeypatch.setattr(publish, "CASCADE_TILE_DIR", tmp_path / "tiles")

    test_district = DistrictCascadeConfig(
        district_id="testville",
        label="Testville",
        state="tamil_nadu",
        tank_polygons_path=tmp_path / "polygons.geojson",
    )
    # Override the per-config path methods to point inside the tmp dir
    nodes_path = tmp_path / "data" / "testville-cascade-nodes.geojson"
    edges_path = tmp_path / "data" / "testville-cascade-edges.geojson"
    outlets_path = tmp_path / "data" / "testville-cascade-river-outlets.geojson"
    monkeypatch.setattr(
        DistrictCascadeConfig,
        "cascade_nodes_geojson_path",
        lambda self: nodes_path,
    )
    monkeypatch.setattr(
        DistrictCascadeConfig,
        "cascade_edges_geojson_path",
        lambda self: edges_path,
    )
    monkeypatch.setattr(
        DistrictCascadeConfig,
        "cascade_river_outlets_geojson_path",
        lambda self: outlets_path,
    )

    sample_node = {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [78.1, 9.9]},
        "properties": {"osm_id": 12345, "name": "Test tank"},
    }
    sample_edge = {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": [[78.1, 9.9], [78.2, 9.8]]},
        "properties": {"from_osm_id": 12345, "to_osm_id": 67890, "status": "predicted"},
    }

    result = publish.write_geojson(test_district, [sample_node], [sample_edge])

    assert result["node_count"] == 1
    assert result["edge_count"] == 1
    payload = json.loads(nodes_path.read_text())
    assert payload["type"] == "FeatureCollection"
    assert payload["features"][0]["properties"]["osm_id"] == 12345


def test_publish_write_geojson_embeds_meta_in_each_collection(tmp_path, monkeypatch):
    # Every published FeatureCollection must carry a top-level _meta
    # block with district_id, generated_at, pipeline_version, algorithm,
    # inputs_hash, and feature_type so a reviewer can trace any single
    # file back to the pipeline run that produced it.
    monkeypatch.setattr(publish, "CASCADE_OUTPUT_DIR", tmp_path / "data")
    monkeypatch.setattr(publish, "CASCADE_TILE_DIR", tmp_path / "tiles")

    test_district = DistrictCascadeConfig(
        district_id="testville",
        label="Testville",
        state="tamil_nadu",
        tank_polygons_path=tmp_path / "polygons.geojson",
    )
    nodes_path = tmp_path / "data" / "testville-cascade-nodes.geojson"
    edges_path = tmp_path / "data" / "testville-cascade-edges.geojson"
    outlets_path = tmp_path / "data" / "testville-cascade-river-outlets.geojson"
    monkeypatch.setattr(
        DistrictCascadeConfig,
        "cascade_nodes_geojson_path",
        lambda self: nodes_path,
    )
    monkeypatch.setattr(
        DistrictCascadeConfig,
        "cascade_edges_geojson_path",
        lambda self: edges_path,
    )
    monkeypatch.setattr(
        DistrictCascadeConfig,
        "cascade_river_outlets_geojson_path",
        lambda self: outlets_path,
    )

    publish.write_geojson(test_district, [], [], [])

    expected_meta_keys = {
        "district_id",
        "generated_at",
        "pipeline_version",
        "algorithm",
        "inputs_hash",
        "feature_type",
    }
    for path, feature_type in (
        (nodes_path, "nodes"),
        (edges_path, "edges"),
        (outlets_path, "river_outlets"),
    ):
        payload = json.loads(path.read_text())
        assert payload["type"] == "FeatureCollection"
        meta = payload.get("_meta") or {}
        assert set(meta.keys()) == expected_meta_keys, (
            f"{path.name} _meta keys mismatch: {set(meta.keys())}"
        )
        assert meta["district_id"] == "testville"
        assert meta["feature_type"] == feature_type
        assert meta["pipeline_version"] == publish.PIPELINE_VERSION
        assert meta["algorithm"] == publish.ALGORITHM_VERSION
        assert meta["generated_at"].endswith("Z")


def test_publish_write_systems_manifest_keeps_payload_geometry_free(
    tmp_path, monkeypatch
):
    # Manifest is loaded on initial page render; must stay tiny. This
    # test enforces that we don't accidentally inline geometry into it.
    monkeypatch.setattr(publish, "CASCADE_OUTPUT_DIR", tmp_path / "data")
    monkeypatch.setattr(publish, "CASCADE_TILE_DIR", tmp_path / "tiles")

    test_district = DistrictCascadeConfig(
        district_id="testville",
        label="Testville",
        state="tamil_nadu",
        tank_polygons_path=tmp_path / "polygons.geojson",
    )
    manifest_path = tmp_path / "data" / "testville-cascade-systems.json"
    monkeypatch.setattr(
        DistrictCascadeConfig,
        "cascade_systems_json_path",
        lambda self: manifest_path,
    )

    publish.write_systems_manifest(
        test_district,
        systems={
            "systems": [
                {
                    "cascade_id": "vaigai-east",
                    "name": "Vaigai East",
                    "tank_count": 12,
                    "intact_link_pct": 33.3,
                    "bbox": [78.0, 9.8, 78.3, 10.0],
                }
            ],
            "summary": {"total_systems": 1},
        },
    )

    payload = json.loads(manifest_path.read_text())
    serialized = json.dumps(payload)
    # Manifest must not contain any LineString or Polygon geometry strings.
    assert "LineString" not in serialized
    assert "Polygon" not in serialized
    assert "coordinates" not in serialized


def test_build_pmtiles_errors_clearly_when_tippecanoe_missing(monkeypatch):
    # Force the availability check to fail so we exercise the error path
    # without depending on whether tippecanoe is installed in CI.
    monkeypatch.setattr(publish, "_tippecanoe_available", lambda: False)
    madurai = get_district_cascade_config("madurai")
    with pytest.raises(RuntimeError, match="tippecanoe is not installed"):
        publish.build_pmtiles(madurai)


def test_cascade_stats_json_path_is_district_scoped():
    madurai = get_district_cascade_config("madurai")
    assert madurai.cascade_stats_json_path() == (
        CASCADE_OUTPUT_DIR / "madurai-cascade-stats.json"
    )


def test_madurai_config_pins_vandiyur_as_narrative_anchor():
    # Vandiyur is osm_id 1073092381 in the published Madurai nodes.
    # The narrative-anchor override exists because Madurai's
    # topologically-highest-convergence node is an unnamed reservoir;
    # the public PIL story is anchored on Vandiyur.
    madurai = get_district_cascade_config("madurai")
    assert madurai.narrative_anchor_osm_id == 1073092381


def test_chennai_config_leaves_narrative_anchor_unset():
    # Chennai uses the auto-computed top_convergence; no manual override.
    chennai = get_district_cascade_config("chennai")
    assert chennai.narrative_anchor_osm_id is None


def _stub_district_paths(monkeypatch, tmp_path):
    """Helper: redirect a test district's output paths into tmp_path."""
    monkeypatch.setattr(publish, "CASCADE_OUTPUT_DIR", tmp_path)
    monkeypatch.setattr(publish, "CASCADE_TILE_DIR", tmp_path / "tiles")
    monkeypatch.setattr(
        DistrictCascadeConfig,
        "cascade_nodes_geojson_path",
        lambda self: tmp_path / f"{self.district_id}-cascade-nodes.geojson",
    )
    monkeypatch.setattr(
        DistrictCascadeConfig,
        "cascade_edges_geojson_path",
        lambda self: tmp_path / f"{self.district_id}-cascade-edges.geojson",
    )
    monkeypatch.setattr(
        DistrictCascadeConfig,
        "cascade_river_outlets_geojson_path",
        lambda self: tmp_path / f"{self.district_id}-cascade-river-outlets.geojson",
    )
    monkeypatch.setattr(
        DistrictCascadeConfig,
        "cascade_stats_json_path",
        lambda self: tmp_path / f"{self.district_id}-cascade-stats.json",
    )


def test_write_stats_manifest_computes_counts_and_max_depth(tmp_path, monkeypatch):
    _stub_district_paths(monkeypatch, tmp_path)

    district = DistrictCascadeConfig(
        district_id="testville",
        label="Testville",
        state="tamil_nadu",
        tank_polygons_path=tmp_path / "polygons.geojson",
    )

    # Three nodes: one isolated, one mid-cascade convergence, one terminal.
    nodes = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [78.0, 9.9]},
            "properties": {
                "osm_id": 1,
                "name": "Source tank",
                "degree_in": 0,
                "degree_out": 1,
                "cascade_position": 1,
                "drains_to_river": False,
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [78.1, 9.9]},
            "properties": {
                "osm_id": 2,
                "name": "Convergence tank",
                "degree_in": 3,
                "degree_out": 1,
                "cascade_position": 4,
                "drains_to_river": False,
                "area_ha": 50.0,
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [78.2, 9.9]},
            "properties": {
                "osm_id": 3,
                "name": "Isolated tank",
                "degree_in": 0,
                "degree_out": 0,
                "cascade_position": 1,
                "drains_to_river": False,
            },
        },
    ]
    edges = [{"type": "Feature", "properties": {"from_osm_id": 1, "to_osm_id": 2}}]
    outlets: list = []
    publish.write_geojson(district, nodes, edges, outlets)

    result = publish.write_stats_manifest(district)
    assert result["node_count"] == 3
    assert result["edge_count"] == 1
    assert result["river_outlet_count"] == 0
    assert result["isolated_count"] == 1
    assert result["max_cascade_depth"] == 4

    payload = json.loads(district.cascade_stats_json_path().read_text())
    assert payload["_meta"]["pipeline_version"] == publish.PIPELINE_VERSION
    assert payload["_meta"]["algorithm"] == publish.ALGORITHM_VERSION
    assert payload["_meta"]["generated_at"].endswith("Z")
    assert payload["top_convergence"]["osm_id"] == 2
    assert payload["top_convergence"]["degree_in"] == 3


def test_write_stats_manifest_resolves_narrative_anchor_when_set(tmp_path, monkeypatch):
    _stub_district_paths(monkeypatch, tmp_path)

    district = DistrictCascadeConfig(
        district_id="anchored",
        label="Anchored",
        state="tamil_nadu",
        tank_polygons_path=tmp_path / "polygons.geojson",
        narrative_anchor_osm_id=99,
    )

    nodes = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [78.0, 9.9]},
            "properties": {
                "osm_id": 1,
                "name": "Bigger convergence",
                "degree_in": 5,
                "degree_out": 1,
                "cascade_position": 3,
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [78.1, 9.9]},
            "properties": {
                "osm_id": 99,
                "name": "The narrative anchor",
                "degree_in": 2,
                "degree_out": 1,
                "cascade_position": 2,
                "area_ha": 100.0,
            },
        },
    ]
    publish.write_geojson(district, nodes, [], [])
    publish.write_stats_manifest(district)

    payload = json.loads(district.cascade_stats_json_path().read_text())
    assert payload["narrative_anchor"]["osm_id"] == 99
    assert payload["narrative_anchor"]["name"] == "The narrative anchor"
    # Top convergence is still the auto-computed highest degree_in.
    assert payload["top_convergence"]["osm_id"] == 1


def test_write_stats_manifest_narrative_anchor_null_when_unmatched(
    tmp_path, monkeypatch
):
    _stub_district_paths(monkeypatch, tmp_path)

    district = DistrictCascadeConfig(
        district_id="ghost",
        label="Ghost",
        state="tamil_nadu",
        tank_polygons_path=tmp_path / "polygons.geojson",
        narrative_anchor_osm_id=99999,  # not in the node set
    )
    nodes = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [78.0, 9.9]},
            "properties": {"osm_id": 1, "name": "Only tank", "degree_in": 0},
        },
    ]
    publish.write_geojson(district, nodes, [], [])
    publish.write_stats_manifest(district)

    payload = json.loads(district.cascade_stats_json_path().read_text())
    assert payload["narrative_anchor"] is None


def test_write_stats_manifest_handles_empty_input(tmp_path, monkeypatch):
    _stub_district_paths(monkeypatch, tmp_path)

    district = DistrictCascadeConfig(
        district_id="empty",
        label="Empty",
        state="tamil_nadu",
        tank_polygons_path=tmp_path / "polygons.geojson",
    )
    # No GeoJSONs on disk - the loader returns empty lists; stats should
    # be zeros without raising.
    publish.write_stats_manifest(district)
    payload = json.loads(district.cascade_stats_json_path().read_text())
    assert payload["node_count"] == 0
    assert payload["edge_count"] == 0
    assert payload["max_cascade_depth"] == 0
    assert payload["isolated_count"] == 0
    assert payload["top_convergence"] is None
    assert payload["narrative_anchor"] is None

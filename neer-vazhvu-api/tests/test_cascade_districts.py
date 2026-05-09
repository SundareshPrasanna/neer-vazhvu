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


def test_supported_district_ids_includes_madurai_and_chennai():
    assert set(supported_district_ids()) == {"chennai", "madurai"}


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

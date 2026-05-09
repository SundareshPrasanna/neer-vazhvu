import pytest

from app.gee.cities import (
    DEFAULT_CITY_ID,
    CityGeeConfig,
    get_city_config,
    supported_city_ids,
)


def test_default_city_id_is_chennai():
    assert DEFAULT_CITY_ID == "chennai"


def test_supported_city_ids_includes_chennai_and_madurai():
    assert set(supported_city_ids()) == {"chennai", "madurai"}


def test_get_city_config_normalizes_case_and_whitespace():
    assert get_city_config(" Madurai ").city_id == "madurai"


def test_get_city_config_falls_back_to_default_when_city_id_missing():
    assert get_city_config(None).city_id == DEFAULT_CITY_ID


def test_get_city_config_raises_for_unknown_city():
    with pytest.raises(RuntimeError, match="Unknown city_id"):
        get_city_config("delhi")


def test_chennai_config_has_reservoir_catchments_and_phase1_reservoirs():
    chennai = get_city_config("chennai")
    assert isinstance(chennai, CityGeeConfig)
    assert chennai.reservoir_catchments_path is not None
    assert chennai.phase1_reservoirs == (
        "poondi",
        "redhills",
        "chembarambakkam",
        "cholavaram",
    )
    assert "osm:25453624" in chennai.flagship_history_cohort  # Chembarambakkam


def test_madurai_config_has_no_reservoir_catchments_yet():
    madurai = get_city_config("madurai")
    assert madurai.reservoir_catchments_path is None
    assert madurai.phase1_reservoirs == ()
    assert "osm:13724237" in madurai.flagship_history_cohort  # Vaigai Dam


def test_madurai_paths_point_at_madurai_assets():
    madurai = get_city_config("madurai")
    assert madurai.restoration_priority_path.name == "restoration-priority-madurai.json"
    assert (
        madurai.current_water_bodies_path.name == "madurai-water-bodies-current.geojson"
    )
    assert (
        madurai.phase1_targets_path.name == "gee-phase1-water-body-targets-madurai.json"
    )

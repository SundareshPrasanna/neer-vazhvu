from app.gee.cities import get_city_config
from app.gee.targets import determine_include_reason


def test_excludes_industrial_ponds():
    row = {
        "osm_id": 1,
        "name": "ETPS Flyash Pond",
        "water_type": "reservoir",
        "area_ha": 61.18,
        "priority_level": "critical",
    }

    assert determine_include_reason(row) is None


def test_excludes_oxidation_ponds():
    row = {
        "osm_id": 2,
        "name": "Oxidation Pond",
        "water_type": "pond",
        "area_ha": 1.66,
        "priority_level": "high",
    }

    assert determine_include_reason(row) is None


def test_includes_named_large_lakes():
    row = {
        "osm_id": 3,
        "name": "Porur Lake",
        "water_type": "water",
        "area_ha": 29.03,
        "priority_level": "moderate",
    }

    assert determine_include_reason(row) == "named_large"


def test_includes_high_priority_named_water_body():
    row = {
        "osm_id": 4,
        "name": "Thamarai Kulam",
        "water_type": "pond",
        "area_ha": 1.2,
        "priority_level": "high",
    }

    assert determine_include_reason(row) == "priority"


def test_excludes_tiny_unnamed_water_bodies():
    row = {
        "osm_id": 5,
        "name": "",
        "water_type": "pond",
        "area_ha": 0.4,
        "priority_level": "low",
    }

    assert determine_include_reason(row) is None


def test_excludes_census_only_rows_without_polygon():
    row = {
        "osm_id": None,
        "name": "RETTAI ERI",
        "water_type": "lake",
        "area_ha": 105.0,
        "priority_level": "high",
    }

    assert determine_include_reason(row) is None


def test_madurai_reservoir_name_pattern_matches_vaigai_only_for_madurai():
    row = {
        "osm_id": 13724237,
        "name": "Vaigai Dam reservoir",
        "water_type": "reservoir",
        "area_ha": 1418.08,
        "priority_level": "moderate",
    }

    madurai = get_city_config("madurai")
    chennai = get_city_config("chennai")

    # Vaigai is Madurai's reservoir pattern; Chennai falls through to named_large.
    assert determine_include_reason(row, city=madurai) == "named_reservoir"
    assert determine_include_reason(row, city=chennai) == "named_large"


def test_chennai_reservoir_name_pattern_does_not_apply_to_madurai():
    row = {
        "osm_id": 1,
        "name": "Poondi Reservoir",
        "water_type": "reservoir",
        "area_ha": 1500.0,
        "priority_level": "moderate",
    }

    assert (
        determine_include_reason(row, city=get_city_config("chennai"))
        == "named_reservoir"
    )
    # Madurai has no "poondi" pattern; falls through to size-based naming rule.
    assert (
        determine_include_reason(row, city=get_city_config("madurai")) == "named_large"
    )

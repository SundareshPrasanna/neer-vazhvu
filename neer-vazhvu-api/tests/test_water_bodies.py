import json
from datetime import date

from app.gee.water_bodies import (
    build_monthly_backfill_reference_dates,
    calculate_valid_pixel_pct,
    calculate_historical_persistence_pct,
    classify_surface_water_anomaly,
    derive_confidence_level,
    filter_targets_for_cohort,
    load_phase1_target_features,
    month_end_for_date,
    previous_month_end,
    Phase1WaterBodyTargetFeature,
)


def test_classify_surface_water_anomaly_uses_expected_thresholds():
    assert classify_surface_water_anomaly(None) == "near_normal"
    assert classify_surface_water_anomaly(0.45) == "much_lower"
    assert classify_surface_water_anomaly(0.75) == "lower"
    assert classify_surface_water_anomaly(1.0) == "near_normal"
    assert classify_surface_water_anomaly(1.2) == "higher"
    assert classify_surface_water_anomaly(1.6) == "much_higher"


def test_derive_confidence_level_uses_valid_pixel_coverage_and_size():
    assert derive_confidence_level(valid_pixel_pct=None, area_ha=10) == "low"
    assert derive_confidence_level(valid_pixel_pct=35, area_ha=10) == "low"
    assert derive_confidence_level(valid_pixel_pct=65, area_ha=3) == "medium"
    assert derive_confidence_level(valid_pixel_pct=92, area_ha=6) == "high"


def test_calculate_historical_persistence_pct_counts_months_with_meaningful_water():
    monthly_baseline_areas_ha = [12, 11, 10, 8, 5, 2, 0, 0, 0, 3, 7, 9]

    persistence_pct = calculate_historical_persistence_pct(
        monthly_baseline_areas_ha,
        target_area_ha=40,
    )

    assert persistence_pct == 50.0


def test_calculate_valid_pixel_pct_caps_at_one_hundred_percent():
    assert calculate_valid_pixel_pct(None, 40) is None
    assert calculate_valid_pixel_pct(30, 0) is None
    assert calculate_valid_pixel_pct(20, 40) == 50.0
    assert calculate_valid_pixel_pct(60, 40) == 100.0


def test_month_end_helpers_cover_regular_and_leap_year_months():
    assert month_end_for_date(date(2026, 4, 3)) == date(2026, 4, 30)
    assert month_end_for_date(date(2024, 2, 10)) == date(2024, 2, 29)
    assert previous_month_end(date(2026, 4, 3)) == date(2026, 3, 31)
    assert previous_month_end(date(2026, 3, 31)) == date(2026, 2, 28)


def test_build_monthly_backfill_reference_dates_includes_reference_then_month_ends():
    dates = build_monthly_backfill_reference_dates(
        reference_date=date(2026, 4, 2),
        months_back=3,
    )

    assert dates == [
        date(2026, 4, 2),
        date(2026, 3, 31),
        date(2026, 2, 28),
        date(2026, 1, 31),
    ]


def test_build_monthly_backfill_reference_dates_avoids_duplicate_when_ref_is_month_end():
    dates = build_monthly_backfill_reference_dates(
        reference_date=date(2026, 3, 31),
        months_back=2,
    )

    assert dates == [
        date(2026, 3, 31),
        date(2026, 2, 28),
        date(2026, 1, 31),
    ]


def test_filter_targets_for_cohort_keeps_only_flagship_history_targets():
    targets = [
        Phase1WaterBodyTargetFeature(
            gee_target_id="osm:25453624",
            osm_id=25453624,
            census_id=None,
            name="Chembarambakkam Lake",
            water_type="reservoir",
            area_ha=2000.44,
            priority_level="moderate",
            priority_score=44.7,
            centroid=[],
            include_reason="named_reservoir",
            geometry={"type": "Polygon", "coordinates": []},
        ),
        Phase1WaterBodyTargetFeature(
            gee_target_id="osm:999999",
            osm_id=999999,
            census_id=None,
            name="Test Non Cohort Lake",
            water_type="lake",
            area_ha=12.5,
            priority_level="high",
            priority_score=42.0,
            centroid=[],
            include_reason="named_large",
            geometry={"type": "Polygon", "coordinates": []},
        ),
    ]

    filtered = filter_targets_for_cohort(targets, cohort="flagship-history")

    assert [target.gee_target_id for target in filtered] == ["osm:25453624"]


def test_load_phase1_target_features_matches_manifest_to_geojson(tmp_path):
    manifest_path = tmp_path / "targets.json"
    water_bodies_path = tmp_path / "water-bodies.geojson"

    manifest_path.write_text(
        json.dumps(
            {
                "targets": [
                    {
                        "gee_target_id": "osm:123",
                        "osm_id": 123,
                        "census_id": None,
                        "name": "Test Lake",
                        "water_type": "lake",
                        "area_ha": 12.5,
                        "priority_level": "high",
                        "priority_score": 42.0,
                        "centroid": [13.1, 80.2],
                        "include_reason": "named_large",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    water_bodies_path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {
                            "osm_id": 123,
                            "name": "Test Lake",
                            "water_type": "lake",
                            "area_ha": 12.5,
                        },
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [
                                [
                                    [80.0, 13.0],
                                    [80.1, 13.0],
                                    [80.1, 13.1],
                                    [80.0, 13.1],
                                    [80.0, 13.0],
                                ]
                            ],
                        },
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    targets = load_phase1_target_features(
        manifest_path=manifest_path,
        water_bodies_path=water_bodies_path,
    )

    assert len(targets) == 1
    assert targets[0].gee_target_id == "osm:123"
    assert targets[0].geometry["type"] == "Polygon"

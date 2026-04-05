import json
from datetime import date

import pytest

from app.gee.reservoir_context import (
    baseline_offsets,
    calculate_anomaly_pct,
    classify_rainfall_context,
    load_reservoir_catchments,
    shift_years,
    validate_reservoir_catchments,
    window_bounds,
)


def _write_geojson(path, features, metadata=None):
    payload = {
        "type": "FeatureCollection",
        "metadata": metadata or {},
        "features": features,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def _polygon():
    return {
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
    }


def test_load_reservoir_catchments_reads_geometry_version_and_aliases(tmp_path):
    path = tmp_path / "catchments.geojson"
    _write_geojson(
        path,
        [
            {
                "type": "Feature",
                "properties": {"reservoir": "Poondi"},
                "geometry": _polygon(),
            },
            {
                "type": "Feature",
                "properties": {"reservoir": "Red Hills"},
                "geometry": _polygon(),
            },
            {
                "type": "Feature",
                "properties": {"reservoir": "Chembarambakkam"},
                "geometry": _polygon(),
            },
            {
                "type": "Feature",
                "properties": {"reservoir": "Cholavaram"},
                "geometry": _polygon(),
            },
        ],
        metadata={"geometry_version": "verified-2026-04-03"},
    )

    catchments, geometry_version = load_reservoir_catchments(path)

    assert geometry_version == "verified-2026-04-03"
    assert list(catchments) == [
        "poondi",
        "redhills",
        "chembarambakkam",
        "cholavaram",
    ]


def test_validate_reservoir_catchments_reports_missing_and_invalid_features(tmp_path):
    path = tmp_path / "catchments.geojson"
    _write_geojson(
        path,
        [
            {
                "type": "Feature",
                "properties": {"reservoir": "Poondi"},
                "geometry": _polygon(),
            },
            {
                "type": "Feature",
                "properties": {"reservoir": "Unknown"},
                "geometry": _polygon(),
            },
            {
                "type": "Feature",
                "properties": {"reservoir": "Red Hills"},
                "geometry": {"type": "Point", "coordinates": [80.0, 13.0]},
            },
        ],
    )

    result = validate_reservoir_catchments(path)

    assert result["ok"] is False
    assert result["missing_reservoirs"] == [
        "redhills",
        "chembarambakkam",
        "cholavaram",
    ]
    assert len(result["invalid_features"]) == 2


@pytest.mark.parametrize(
    ("anomaly_pct", "expected"),
    [
        (None, "near_normal"),
        (-60.0, "well_below"),
        (-25.0, "below"),
        (0.0, "near_normal"),
        (35.0, "above"),
        (65.0, "well_above"),
    ],
)
def test_classify_rainfall_context(anomaly_pct, expected):
    assert classify_rainfall_context(anomaly_pct) == expected


def test_window_bounds_are_inclusive_of_context_day():
    start_date, end_date_exclusive = window_bounds(date(2026, 4, 3), 7)

    assert start_date.isoformat() == "2026-03-28"
    assert end_date_exclusive.isoformat() == "2026-04-04"


def test_shift_years_handles_leap_day():
    assert shift_years(date(2024, 2, 29), -1) == date(2023, 2, 28)


def test_baseline_offsets_stop_before_chirps_coverage():
    offsets = baseline_offsets(date(1983, 1, 10), 30, baseline_years=5)

    assert offsets == [1]


def test_calculate_anomaly_pct_requires_real_baseline():
    assert calculate_anomaly_pct(12.0, None) is None
    assert calculate_anomaly_pct(12.0, 0.5) is None
    assert calculate_anomaly_pct(18.0, 12.0) == 50.0

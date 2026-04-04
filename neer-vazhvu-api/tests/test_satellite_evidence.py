from datetime import date

from app.gee.evidence import (
    build_satellite_evidence_reference_dates,
    build_satellite_evidence_storage_path,
    build_thumb_region_from_geometry,
    resolve_satellite_evidence_geometry_version,
    sanitize_gee_target_id_for_path,
)


def test_sanitize_gee_target_id_for_path_normalizes_separators():
    assert sanitize_gee_target_id_for_path("osm:25453624") == "osm-25453624"
    assert sanitize_gee_target_id_for_path(" Census/6 ") == "census-6"


def test_build_satellite_evidence_reference_dates_downsamples_monthly_history():
    dates = build_satellite_evidence_reference_dates(
        reference_date=date(2026, 4, 2),
        months_back=12,
        frame_count=6,
    )

    assert dates == [
        date(2026, 4, 2),
        date(2026, 2, 28),
        date(2025, 12, 31),
        date(2025, 10, 31),
        date(2025, 8, 31),
        date(2025, 6, 30),
    ]


def test_build_satellite_evidence_storage_path_uses_cohort_target_and_variant():
    true_color_path = build_satellite_evidence_storage_path(
        gee_target_id="osm:25453624",
        frame_date=date(2026, 3, 25),
        variant="true-color",
    )
    overlay_path = build_satellite_evidence_storage_path(
        gee_target_id="osm:25453624",
        frame_date=date(2026, 3, 25),
        variant="water-overlay",
    )

    assert true_color_path == "flagship-history/osm-25453624/2026-03-25/true-color.jpg"
    assert overlay_path == "flagship-history/osm-25453624/2026-03-25/water-overlay.png"


def test_build_thumb_region_from_geometry_adds_padding_and_returns_polygon():
    region = build_thumb_region_from_geometry(
        {
            "type": "Polygon",
            "coordinates": [
                [
                    [80.0, 13.0],
                    [80.2, 13.0],
                    [80.2, 13.1],
                    [80.0, 13.1],
                    [80.0, 13.0],
                ]
            ],
        }
    )

    assert region["type"] == "Polygon"
    ring = region["coordinates"][0]
    assert ring[0] == ring[-1]
    xs = [point[0] for point in ring]
    ys = [point[1] for point in ring]
    assert min(xs) < 80.0
    assert min(ys) < 13.0
    assert max(xs) > 80.2
    assert max(ys) > 13.1


def test_resolve_satellite_evidence_geometry_version_uses_file_stem():
    assert resolve_satellite_evidence_geometry_version().endswith(
        "chennai-water-bodies-current"
    )

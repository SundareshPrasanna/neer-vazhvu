from datetime import date

from app.gee.evidence import (
    WaterBodySatelliteEvidenceRow,
    _apply_existing_review_state,
    build_satellite_evidence_reference_dates,
    build_satellite_evidence_storage_path,
    build_thumb_region_from_geometry,
    resolve_satellite_evidence_geometry_version,
    sanitize_gee_target_id_for_path,
)


def _row(**overrides):
    base = dict(
        gee_target_id="osm:1073092381",
        reference_date="2026-04-30",
        frame_date="2026-04-25",
        frame_rank=1,
        source_asset_id="S2_TEST_ASSET_A",
        dynamic_world_asset_id=None,
        is_reviewed=False,
        notes=None,
    )
    base.update(overrides)
    return WaterBodySatelliteEvidenceRow(**base)


def test_apply_existing_review_state_preserves_prior_approval():
    rows = [_row(is_reviewed=False)]
    existing_by_key = {
        ("osm:1073092381", "2026-04-30"): {
            "frame_date": "2026-04-25",
            "source_asset_id": "S2_TEST_ASSET_A",
            "dynamic_world_asset_id": None,
            "is_reviewed": True,
            "notes": None,
        },
    }

    [merged] = _apply_existing_review_state(rows, existing_by_key)

    assert merged.is_reviewed is True


def test_apply_existing_review_state_preserves_prior_rejection_with_notes():
    rows = [_row(is_reviewed=False)]
    existing_by_key = {
        ("osm:1073092381", "2026-04-30"): {
            "frame_date": "2026-04-25",
            "source_asset_id": "S2_TEST_ASSET_A",
            "dynamic_world_asset_id": None,
            "is_reviewed": False,
            "notes": "cloud-edge artefact on dam wall",
        },
    }

    [merged] = _apply_existing_review_state(rows, existing_by_key)

    assert merged.is_reviewed is False
    assert merged.notes == "cloud-edge artefact on dam wall"


def test_apply_existing_review_state_resets_when_scene_differs():
    # Existing row was approved, but the rebuild picked a different scene
    # (different source_asset_id) — the prior approval no longer applies,
    # row keeps the default is_reviewed=False so it gets re-reviewed.
    rows = [_row(is_reviewed=False, source_asset_id="S2_NEW_SCENE_B")]
    existing_by_key = {
        ("osm:1073092381", "2026-04-30"): {
            "frame_date": "2026-04-25",
            "source_asset_id": "S2_TEST_ASSET_A",
            "dynamic_world_asset_id": None,
            "is_reviewed": True,
            "notes": None,
        },
    }

    [merged] = _apply_existing_review_state(rows, existing_by_key)

    assert merged.is_reviewed is False


def test_apply_existing_review_state_leaves_new_rows_pending():
    rows = [_row(is_reviewed=False)]
    existing_by_key: dict[tuple[str, str], dict] = {}

    [merged] = _apply_existing_review_state(rows, existing_by_key)

    assert merged.is_reviewed is False
    assert merged.notes is None


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

import json

import numpy as np

from app.gee.catchment_derivation import (
    _find_seed_cell,
    _trace_upstream_cells,
    build_hydrobasins_catchment_feature,
    build_merit_local_catchment_feature,
    select_upstream_hybas_ids,
    upsert_catchment_candidate,
)


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


def test_build_hydrobasins_catchment_feature_normalizes_properties():
    feature = build_hydrobasins_catchment_feature(
        reservoir="Red Hills",
        geometry={**_polygon(), "geodesic": False},
        properties={
            "HYBAS_ID": 4121590240,
            "NEXT_DOWN": 4121131520,
            "PFAF_ID": 453750820200,
            "SUB_AREA": 193.1,
            "UP_AREA": 193.3,
        },
        source_dataset="WWF/HydroSHEDS/v1/Basins/hybas_12",
        hydrobasins_level=12,
        reference_point=(80.1811, 13.1710),
    )

    assert feature["properties"]["reservoir"] == "redhills"
    assert feature["properties"]["source_hybas_id"] == 4121590240
    assert feature["properties"]["sub_area_sqkm"] == 193.1
    assert feature["geometry"] == _polygon()


def test_build_hydrobasins_catchment_feature_uses_reservoir_specific_confidence():
    feature = build_hydrobasins_catchment_feature(
        reservoir="Cholavaram",
        geometry=_polygon(),
        properties={"HYBAS_ID": 1, "SUB_AREA": 10.0, "UP_AREA": 10.0},
        source_dataset="WWF/HydroSHEDS/v1/Basins/hybas_12",
        hydrobasins_level=12,
        reference_point=(80.1499, 13.2184),
    )

    assert feature["properties"]["confidence"] == "low"
    assert "same basin as Red Hills" in feature["properties"]["notes"]


def test_build_merit_local_catchment_feature_adds_local_support_metadata():
    feature = build_merit_local_catchment_feature(
        reservoir="Cholavaram",
        geometry={
            **_polygon(),
            "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        },
        source_dataset="MERIT/Hydro/v1_0_1",
        outlet_hint=(80.169497, 13.222619),
        seed_point=(80.170000, 13.223000),
        seed_upa_sqkm=28.33,
        visited_cell_count=3255,
        bbox_buffer_meters=5000,
    )

    assert feature["properties"]["source_type"] == "derived_local_support"
    assert feature["properties"]["derivation_method"] == "merit_local_upstream_trace"
    assert feature["properties"]["visited_cell_count"] == 3255
    assert feature["properties"]["confidence"] == "medium"
    assert feature["geometry"] == _polygon()


def test_upsert_catchment_candidate_updates_metadata_and_replaces_feature(tmp_path):
    path = tmp_path / "catchments.geojson"
    path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "name": "chennai-reservoir-catchments",
                "metadata": {
                    "status": "pending_verification",
                    "expected_reservoirs": [
                        "poondi",
                        "redhills",
                        "chembarambakkam",
                        "cholavaram",
                    ],
                },
                "features": [
                    {
                        "type": "Feature",
                        "properties": {"reservoir": "redhills", "source_hybas_id": 1},
                        "geometry": _polygon(),
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    feature = {
        "type": "Feature",
        "properties": {
            "reservoir": "redhills",
            "source_hybas_id": 4121590240,
        },
        "geometry": _polygon(),
    }

    result = upsert_catchment_candidate(
        feature,
        path=path,
        geometry_version="hydrobasins-candidates-v1",
    )
    payload = json.loads(path.read_text(encoding="utf-8"))

    assert result["replaced"] is True
    assert payload["metadata"]["status"] == "partial_review"
    assert payload["metadata"]["completed_reservoirs"] == ["redhills"]
    assert payload["features"][0]["properties"]["source_hybas_id"] == 4121590240


def test_upsert_catchment_candidate_switches_geometry_version_for_local_support(
    tmp_path,
):
    path = tmp_path / "catchments.geojson"

    feature = build_merit_local_catchment_feature(
        reservoir="Cholavaram",
        geometry=_polygon(),
        source_dataset="MERIT/Hydro/v1_0_1",
        outlet_hint=(80.169497, 13.222619),
        seed_point=(80.170000, 13.223000),
        seed_upa_sqkm=28.33,
        visited_cell_count=3255,
        bbox_buffer_meters=5000,
    )

    result = upsert_catchment_candidate(feature, path=path)
    payload = json.loads(path.read_text(encoding="utf-8"))

    assert result["geometry_version"] == "hybrid-catchment-candidates-v1"
    assert payload["metadata"]["geometry_version"] == "hybrid-catchment-candidates-v1"


def test_select_upstream_hybas_ids_follows_next_down_chain():
    records = [
        {"HYBAS_ID": 10, "NEXT_DOWN": 20},
        {"HYBAS_ID": 11, "NEXT_DOWN": 20},
        {"HYBAS_ID": 20, "NEXT_DOWN": 30},
        {"HYBAS_ID": 30, "NEXT_DOWN": 0},
        {"HYBAS_ID": 99, "NEXT_DOWN": 88},
    ]

    assert select_upstream_hybas_ids(records, target_hybas_id=20) == [10, 11, 20]


def test_find_seed_cell_uses_highest_upa_within_local_window():
    upa_array = [
        [1.0, 2.0, 3.0],
        [4.0, 9.0, 6.0],
        [7.0, 8.0, 5.0],
    ]

    seed_row, seed_col = _find_seed_cell(
        upa_array=np.array(upa_array, dtype=float),
        bounds=(80.0, 13.0, 80.3, 13.3),
        outlet_hint=(80.15, 13.15),
        search_radius_cells=1,
    )

    assert (seed_row, seed_col) == (1, 1)


def test_trace_upstream_cells_follows_reverse_d8_graph():
    dir_array = np.array(
        [
            [2, 4, 8],
            [1, 0, 16],
            [128, 64, 32],
        ],
        dtype=float,
    )

    visited = _trace_upstream_cells(dir_array, seed_row=1, seed_col=1)

    assert visited == {
        (0, 0),
        (0, 1),
        (0, 2),
        (1, 0),
        (1, 1),
        (1, 2),
        (2, 0),
        (2, 1),
        (2, 2),
    }

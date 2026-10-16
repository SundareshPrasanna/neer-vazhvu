"""Offline tests for Nagpur's geography producers (wards, water bodies, rivers).

Network fetches are not exercised; these pin the transcription, the unit and
identity rules, and the overlap join on synthetic shapes.
"""

import sys
from pathlib import Path

from shapely.geometry import box

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import build_nagpur_geography as geo  # noqa: E402
import build_nagpur_wards as wards  # noqa: E402


def test_gazette_populations_sum_to_the_schedule():
    assert sorted(wards.POPULATION) == list(range(1, 39))
    assert (
        sum(t for t, _ in wards.POPULATION.values()) == wards.GAZETTE_TOTAL == 2447494
    )
    # English schedule runs pp.35-68 of the 68-page gazette, in ward order.
    pages = [p for _, p in (wards.POPULATION[w] for w in range(1, 39))]
    assert pages == sorted(pages) and pages[0] == 35 and pages[-1] == 68


def test_seats_are_37_fours_and_one_three():
    assert sum(wards.SEATS.values()) == 151
    assert [w for w, s in wards.SEATS.items() if s == 3] == [38]


def test_boundary_note_only_on_wards_whose_edge_may_not_be_final():
    noted = [w for w in range(1, 39) if wards.boundary_note(w)]
    assert noted == [6, 7, 8, 9, 19, 23, 26]
    assert "ward 19" in wards.boundary_note(8)
    # Wards 6 and 9 do not touch: each note names ward 7 only.
    assert "ward 7." in wards.boundary_note(6) and "ward 7." in wards.boundary_note(9)
    assert "ward 26" in wards.boundary_note(23) and "ward 23" in wards.boundary_note(26)
    assert "—" not in wards.boundary_note(6)
    assert "22 Aug" not in wards.boundary_note(6)


def test_zone_numbers_are_nmcs_own():
    assert sorted(wards.ZONE_NO.values()) == list(range(1, 11))
    assert wards.ZONE_NO["Ashi Nagar"] == 9


def test_mrsac_spellings_map_onto_nmc_zone_names():
    assert set(wards.MRSAC_SPELLING.values()) <= set(wards.ZONE_NO)
    assert wards.ZONE_MIN_SHARE == 0.9


def test_built_wards_name_a_zone_only_above_the_share():
    import json

    fc = json.loads(
        (wards.REPO_ROOT / "public/geojson/nagpur-wards-2025.geojson").read_text()
    )
    props = [f["properties"] for f in fc["features"]]
    for p in props:
        named = p["zone_share"] >= wards.ZONE_MIN_SHARE
        assert (p["zone_name"] is not None) == named, p["ward_number"]
        assert (p["zone_no"] is None) == (p["zone_name"] is None)
    assert sum(p["zone_name"] is not None for p in props) == 20


def test_area_of_a_small_square_near_nagpur():
    # 0.01 deg x 0.01 deg at 21 N: 1.1132 km x 1.0393 km (cos 21 deg).
    a = geo.area_km2(box(79.0, 21.0, 79.01, 21.01))
    assert abs(a - 1.1132 * 1.0389) < 0.01


def test_type_labels_fix_the_domain_misspelling():
    assert geo.TYPE_LABEL_FIX["Malgnzari Tank"] == "malguzari tank"
    assert geo.NAME_FIX["Ash Pound"] == "Ash Pond"


def test_rivers_keep_the_nag_first_and_the_join_ids():
    assert [r[0] for r in geo.RIVERS] == [
        "nag",
        "pili",
        "pora",
        "kanhan",
        "kolar",
        "wainganga",
    ]


def test_frame_matches_the_city_config():
    cfg = (Path(__file__).resolve().parents[2] / "src/lib/cities/nagpur.ts").read_text()
    s, w, n, e = geo.FRAME
    assert f"south: {s}, north: {n}, west: {w}, east: {e}" in cfg


def _body(geom):
    return {"p": {}, "geom": geom}


def _osm(i, geom, **tags):
    return {"type": "way", "id": i, "tags": tags, "geom": geom}


def test_overlap_join_is_mutual_best_and_skips_rivers_and_pools():
    lake = box(0, 0, 10, 10)
    pond = box(10.5, 0, 11, 0.5)  # a pond beside the lake
    bodies = [_body(lake), _body(pond)]
    osm = [
        _osm(1, box(0, 0, 11.2, 10), name="Big Lake"),  # covers the lake and the pond
        _osm(2, box(0, 0, 10, 10), water="river", name="Nag River"),
        _osm(3, box(10.5, 0, 11, 0.5), name="Swiming Pool"),
    ]
    m, named = geo.match_osm(bodies, osm)
    assert set(m) == {0} and set(named) == {0}  # the pond is not named after the lake
    assert m[0][0]["id"] == 1 and m[0][1] > 0.8


def test_a_named_polygon_inside_an_unnamed_match_lends_its_name():
    body = box(0, 0, 10, 10)
    osm = [_osm(1, box(0, 0, 10, 9.5)), _osm(2, box(1, 1, 6, 6), name="Koradi Lake")]
    m, named = geo.match_osm([_body(body)], osm)
    assert m[0][0]["id"] == 1 and named[0]["id"] == 2


def test_osm_relation_is_stitched_from_member_ways():
    def way(coords):
        return [{"lon": x, "lat": y} for x, y in coords]

    doc = {
        "elements": [
            {
                "type": "relation",
                "id": 9,
                "tags": {"natural": "water", "type": "multipolygon"},
                "members": [
                    {
                        "type": "way",
                        "role": "outer",
                        "geometry": way([(0, 0), (4, 0), (4, 4)]),
                    },
                    {
                        "type": "way",
                        "role": "outer",
                        "geometry": way([(4, 4), (0, 4), (0, 0)]),
                    },
                    {
                        "type": "way",
                        "role": "inner",
                        "geometry": way([(1, 1), (2, 1), (2, 2), (1, 2), (1, 1)]),
                    },
                ],
            }
        ]
    }
    (poly,) = geo.osm_polygons(doc)
    assert poly["id"] == 9 and abs(poly["geom"].area - 15) < 1e-9

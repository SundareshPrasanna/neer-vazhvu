"""Tests for the river-ribbon filter in the catchment delineation stage.

The filter drops river/canal segments that OSM maps as water polygons, while
keeping genuine tanks - including large on-river reservoirs that look ribbon-like
by shape and catchment ratio but are real impoundments (e.g. Manchanabele).
"""

from __future__ import annotations

from shapely.geometry import box

from app.cascade.catchments import _is_river_ribbon, _polsby_popper

# A long, thin rectangle: low Polsby-Popper compactness, like a river segment.
THIN = box(0.0, 0.0, 1000.0, 5.0)
# A square: high compactness, like a normal tank.
COMPACT = box(0.0, 0.0, 100.0, 100.0)


def test_thin_geometry_is_below_compactness_threshold():
    assert _polsby_popper(THIN) < 0.05
    assert _polsby_popper(COMPACT) > 0.5


def test_river_ribbon_dropped():
    # Vrishabhavati-like: thin, small surface area, huge upstream catchment.
    assert _is_river_ribbon(THIN, lake_km2=0.34, total_km2=157.0) is True


def test_large_on_river_reservoir_kept():
    # Manchanabele-like: thin AND a basin-sized catchment ratio (613), but the
    # 2.6 sqkm surface area is above the floor, so it must NOT be treated as a
    # ribbon. This is the regression guard for the reported bug.
    assert _is_river_ribbon(THIN, lake_km2=2.62, total_km2=1605.0) is False


def test_compact_tank_kept():
    # A normal tank is compact, so the ribbon test never applies.
    assert _is_river_ribbon(COMPACT, lake_km2=0.1, total_km2=0.5) is False


def test_low_ratio_elongated_lake_kept():
    # Pulicat-like: thin but a small catchment relative to its own area (ratio 3).
    assert _is_river_ribbon(THIN, lake_km2=0.3, total_km2=0.9) is False


def test_zero_area_is_not_a_ribbon():
    assert _is_river_ribbon(THIN, lake_km2=0.0, total_km2=10.0) is False

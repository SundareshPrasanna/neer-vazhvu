"""Layer A: cross-check predicted channels against ground evidence.

Two evidence streams:

1. OSM `waterway=*` tags within a buffer of each predicted edge.
2. Sentinel-1 SAR + Sentinel-2 NDWI during monsoon months (when channels
   should carry water if they are still functional).

Each predicted edge is annotated with `osm_match` (bool) and
`monsoon_water_observed` (bool); the scoring stage maps these to a
status in {intact, partial, broken, encroached}.

Phase: implemented in P5.
"""

from __future__ import annotations

from typing import Any

from app.cascade.districts import DistrictCascadeConfig


def cross_check_osm(
    district: DistrictCascadeConfig,
    edges: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    raise NotImplementedError(
        "channels.cross_check_osm is implemented in P5 (OSM waterway evidence)."
    )


def cross_check_sentinel(
    district: DistrictCascadeConfig,
    edges: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    raise NotImplementedError(
        "channels.cross_check_sentinel is implemented in P5 "
        "(Sentinel-1/2 monsoon water evidence)."
    )

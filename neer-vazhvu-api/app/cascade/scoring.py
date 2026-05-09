"""Layer A: classify edge status and roll up per-cascade health scores.

Edge classifier maps the raw evidence flags (osm_match,
monsoon_water_observed, built_up_overlap_pct) to a status:

- `intact`     - OSM confirms; monsoon water observed
- `partial`    - OSM confirms but no monsoon water (intermittent or seasonal)
- `broken`     - no OSM evidence, no monsoon water
- `encroached` - built-up overlap exceeds threshold (overrides others)

Cascade health score for a named cascade is the share of edges in
{intact, partial} weighted by edge importance (currently uniform).

Phase: thresholds drafted in P3, applied once channels.py + encroachment.py
land in P5.
"""

from __future__ import annotations

from typing import Any

from app.cascade.districts import DistrictCascadeConfig


def classify_edge_status(
    district: DistrictCascadeConfig,
    edges: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    raise NotImplementedError(
        "scoring.classify_edge_status is implemented in P5 (after channel evidence)."
    )


def cascade_health_scores(
    district: DistrictCascadeConfig,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
) -> dict[str, Any]:
    raise NotImplementedError(
        "scoring.cascade_health_scores is implemented in P3 "
        "(per-cascade aggregate health)."
    )

"""Layer A: DEM-derived cascade topology.

For each tank polygon in the district, compute flow direction from the
DEM (MERIT Hydro by default) and identify likely downstream tanks
within `max_downstream_distance_km`. Output is a directed graph:

- nodes: tank polygons with degree-in / degree-out / position-in-cascade
- edges: predicted channels with `status='predicted'` until the channel
  evidence stage upgrades them to intact / partial / broken / encroached.

Phase: implemented in P1.
"""

from __future__ import annotations

from typing import Any

from app.cascade.districts import DistrictCascadeConfig


def build_graph(district: DistrictCascadeConfig) -> dict[str, Any]:
    """Build the DEM-derived cascade graph for a district.

    Returns a dict shaped as `{"nodes": [...], "edges": [...]}` ready for
    serialization. Pure function: no DB writes, no side effects.
    """
    raise NotImplementedError(
        "topology.build_graph is implemented in P1 (DEM-derived cascade graph)."
    )

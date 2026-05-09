"""Layer B: attach district-curated metadata to the cascade graph.

The pipeline runs without curation. When `district.named_cascades`,
`court_references`, etc. are populated, this stage:

- Tags each node with the named cascade it belongs to (if any)
- Tags each node with court / atlas / NGO references that mention it
- Composes a `cascade-systems.json` summary of named cascades with
  member tanks, narratives, and (after scoring) health scores.

Pure function: takes the universal nodes/edges and the district's
curation tuples, returns enriched nodes/edges + a systems manifest.

Phase: implemented in P3.
"""

from __future__ import annotations

from typing import Any

from app.cascade.districts import DistrictCascadeConfig


def attach_named_cascades(
    district: DistrictCascadeConfig,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    """Return (enriched_nodes, enriched_edges, systems_manifest)."""
    raise NotImplementedError(
        "curation.attach_named_cascades is implemented in P3 (Layer B curation merge)."
    )

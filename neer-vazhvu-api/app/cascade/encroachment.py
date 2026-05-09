"""Layer A: built-up encroachment overlay on predicted channels.

For each predicted edge, buffer the LineString by ~30 m and reduce
Dynamic World built-up class fraction over multiple years. An edge with
high built-up overlap is flagged as `encroached` regardless of OSM/SAR
evidence (the channel may not even exist anymore).

Phase: implemented in P5.
"""

from __future__ import annotations

from typing import Any

from app.cascade.districts import DistrictCascadeConfig


def overlay_built_up(
    district: DistrictCascadeConfig,
    edges: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    raise NotImplementedError(
        "encroachment.overlay_built_up is implemented in P5 "
        "(Dynamic World built-up overlay)."
    )

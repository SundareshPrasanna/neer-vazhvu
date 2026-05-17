"""
Shared helper for rich-body verify and ingest scripts.

Loads a body's polygons based on body_id and builds the zone set the
verification scripts iterate over. Two shapes are supported:

  4-zone (Pallikaranai-style): body has BOTH a primary boundary
  (gazetted Ramsar from TNSWA) AND a separate OSM ecological boundary.
  Zones: primary body + OSM ecological + (primary - OSM gap) + halo.

  2-zone (Sholavaram-style): body has only the primary boundary (OSM-
  sourced or hand-curated). Zones: primary body + halo.

Generic zone names are used everywhere so the UI doesn't need to know
about per-body specifics; the rich-body registry tells the UI which
zones to surface and how to label them.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import OrderedDict as OrderedDictType

from shapely.geometry import shape
from shapely.ops import unary_union


# Canonical generic zone names used across all rich bodies.
ZONE_BODY = "Body (primary)"
ZONE_OSM_ECOLOGICAL = "OSM ecological"
ZONE_GAP = "Gap: body - OSM ecological"
ZONE_HALO = "Halo: 1km buffer - body"


def load_geom(path: Path):
    with open(path) as f:
        gj = json.load(f)
    return unary_union([shape(f["geometry"]) for f in gj["features"]])


def load_body_zones(
    root: Path, body_id: str, buffer_metres: int = 1000
) -> "OrderedDictType[str, object]":
    """Return ordered mapping of zone name -> shapely geometry.

    Order is consistent: primary, [osm_ecological, gap], halo. UI rendering
    relies on this ordering.
    """
    from collections import OrderedDict

    base = root / "public/geojson/rich-bodies"
    primary = load_geom(base / f"{body_id}.geojson")

    osm_path = base / f"{body_id}-osm-ecological.geojson"
    has_osm = osm_path.exists()
    osm = load_geom(osm_path) if has_osm else None

    buffer_path = base / f"{body_id}-buffer-{buffer_metres}m.geojson"
    buffer = load_geom(buffer_path) if buffer_path.exists() else primary

    zones: "OrderedDictType[str, object]" = OrderedDict()
    zones[ZONE_BODY] = primary
    if has_osm and osm is not None:
        zones[ZONE_OSM_ECOLOGICAL] = osm
        zones[ZONE_GAP] = primary.difference(osm)
    zones[ZONE_HALO] = buffer.difference(primary)

    return zones

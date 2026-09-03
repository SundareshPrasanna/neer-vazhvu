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

Pollution capabilities additionally sample named per-body sub-zones
(inlet, weir, outflow) via load_named_subzones(). The pollution
"open-water core" is NOT built here: it is derived GEE-side in the
state capability as body.buffer(-inset_m) intersected with a per-pass
MNDWI water class, because ee.Geometry.buffer is geodesic-in-metres and
the water mask is inherently per-scene.
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


def load_named_subzones(
    root: Path, body_id: str
) -> "OrderedDictType[str, dict]":
    """Return ordered mapping key -> {label, kind, geom} for a body's named
    pollution sub-zones, or an empty mapping if it has none.

    Each sub-zone is a separate file at
    public/geojson/rich-bodies/{body_id}-zone-{key}.geojson, with the key
    taken from the filename. label and kind are read from the first feature's
    properties (defaulting to the key and "custom"), so the set is
    self-describing and needs no coupling to the TS rich-body registry.
    """
    from collections import OrderedDict

    base = root / "public/geojson/rich-bodies"
    prefix = f"{body_id}-zone-"
    out: "OrderedDictType[str, dict]" = OrderedDict()
    for path in sorted(base.glob(f"{prefix}*.geojson")):
        key = path.stem[len(prefix):]
        with open(path) as f:
            gj = json.load(f)
        feats = gj.get("features", [])
        props = (feats[0].get("properties") or {}) if feats else {}
        geom = unary_union([shape(ft["geometry"]) for ft in feats])
        out[key] = {
            "label": props.get("label", key),
            "kind": props.get("kind", "custom"),
            "geom": geom,
        }
    return out

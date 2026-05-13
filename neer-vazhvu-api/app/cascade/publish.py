"""Publish stage: write GeoJSON + JSON manifests, then build PMTiles.

Performance contract: the frontend must NOT load bulk GeoJSON for the
cascade map layer. The PMTiles outputs serve the map via byte-range
requests and auto-simplify per zoom; the small JSON manifest serves the
named-cascade summaries and per-tank context cards without any geometry.

GeoJSON outputs are kept around for downstream consumers (DHAN,
researchers, journalists) but are NOT what the frontend map renders.

Phase: write_geojson + write_systems_manifest land in P1; build_pmtiles
lands in P1 (requires `tippecanoe` available on PATH).
"""

from __future__ import annotations

import datetime as _dt
import hashlib
import json
import shutil
import subprocess
from typing import Any

from app.cascade.districts import (
    CASCADE_OUTPUT_DIR,
    CASCADE_TILE_DIR,
    DistrictCascadeConfig,
)


# Bumped whenever the publish-stage output schema changes. Pure metadata
# - the rest of the pipeline doesn't read it. Hydrologist-facing PDF /
# methodology docs reference this string.
PIPELINE_VERSION = "v1.1.0"

# Identifier for the topology algorithm in use. Bumped when the
# algorithm itself changes (multi-outflow rules, reservoir handling,
# cone-angle defaults, etc.). v1 = the original single-outflow D8
# steepest-descent algorithm shipped in PR #100.
ALGORITHM_VERSION = "d8_steepest_descent_v1"


def _ensure_dirs() -> None:
    CASCADE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CASCADE_TILE_DIR.mkdir(parents=True, exist_ok=True)


def _now_iso_utc() -> str:
    """ISO-8601 UTC timestamp with Z suffix, seconds precision.

    Same format on every output so reviewers can cross-reference the
    GeoJSON files, the stats manifest, and any future PDF / paper that
    cites a specific pipeline run.
    """
    return (
        _dt.datetime.now(_dt.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _inputs_hash(district: DistrictCascadeConfig) -> str:
    """SHA256 of the input GeoJSONs (tanks + rivers) for reproducibility.

    Lets a reviewer check whether two outputs were generated from the
    same source extracts. Empty string if neither input file exists.
    """
    hasher = hashlib.sha256()
    hashed_any = False
    for path in (district.tank_polygons_path, district.rivers_path):
        if path is None or not path.exists():
            continue
        hasher.update(path.read_bytes())
        hashed_any = True
    return hasher.hexdigest() if hashed_any else ""


def _build_meta(
    district: DistrictCascadeConfig,
    feature_type: str | None = None,
) -> dict[str, Any]:
    """Construct the _meta block embedded in every published artefact.

    Same shape across the three GeoJSON FeatureCollections (nodes,
    edges, river_outlets) and the stats manifest, so downstream
    consumers (hydrologist reviews, PDF citations, future PySheds
    comparisons) read one schema.

    feature_type names which kind of features the GeoJSON holds; for
    the stats manifest it stays None.
    """
    meta: dict[str, Any] = {
        "district_id": district.district_id,
        "generated_at": _now_iso_utc(),
        "pipeline_version": PIPELINE_VERSION,
        "algorithm": ALGORITHM_VERSION,
        "inputs_hash": _inputs_hash(district),
    }
    if feature_type is not None:
        meta["feature_type"] = feature_type
    return meta


def write_geojson(
    district: DistrictCascadeConfig,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    river_outlets: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Write nodes, edges, and river-outlet arrows as GeoJSON.

    Each FeatureCollection carries a top-level _meta block with the
    district id, generated_at timestamp, pipeline_version, algorithm
    identifier, and SHA256 hash of the input GeoJSONs. _meta is a
    non-standard but widely-tolerated extension; Leaflet, Mapbox GL,
    tippecanoe, and standard JSON consumers all ignore unknown keys.

    river_outlets is a list of LineString features from a tank centroid
    to its nearest in-flow-direction river point; tanks that drain into
    a river instead of into another tank.
    """
    _ensure_dirs()
    river_outlets = river_outlets or []

    def _wrap(features: list[dict[str, Any]], feature_type: str) -> dict[str, Any]:
        return {
            "type": "FeatureCollection",
            "_meta": _build_meta(district, feature_type=feature_type),
            "features": features,
        }

    nodes_fc = _wrap(nodes, "nodes")
    edges_fc = _wrap(edges, "edges")
    outlets_fc = _wrap(river_outlets, "river_outlets")

    nodes_path = district.cascade_nodes_geojson_path()
    edges_path = district.cascade_edges_geojson_path()
    outlets_path = district.cascade_river_outlets_geojson_path()
    nodes_path.write_text(
        json.dumps(nodes_fc, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    edges_path.write_text(
        json.dumps(edges_fc, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    outlets_path.write_text(
        json.dumps(outlets_fc, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    return {
        "nodes_path": str(nodes_path),
        "edges_path": str(edges_path),
        "river_outlets_path": str(outlets_path),
        "node_count": len(nodes),
        "edge_count": len(edges),
        "river_outlet_count": len(river_outlets),
    }


def _load_feature_collection(path) -> list[dict[str, Any]]:
    """Read a FeatureCollection GeoJSON file and return its features.

    Returns an empty list if the file is missing - callers handle the
    absence rather than raising, since the stats pass may be run before
    all three publish outputs exist (e.g. during partial regeneration).
    """
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    features = payload.get("features") or []
    if not isinstance(features, list):
        return []
    return features


def _safe_int(value: Any) -> int:
    """Coerce degree_in / degree_out / cascade_position into a plain int,
    defaulting to 0 for missing or null values."""
    if value is None:
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _is_isolated(props: dict[str, Any]) -> bool:
    """Definition: degree_in == 0 AND degree_out == 0 AND not
    drains_to_river. Used in both the stats manifest summary and the
    methodology-section narrative (anything else with zero connections
    has at least a river outlet).
    """
    return (
        _safe_int(props.get("degree_in")) == 0
        and _safe_int(props.get("degree_out")) == 0
        and not props.get("drains_to_river", False)
    )


def _compute_stats(
    district: DistrictCascadeConfig,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    river_outlets: list[dict[str, Any]],
) -> dict[str, Any]:
    """Compute summary statistics for the cascade stats manifest.

    Pure function over published feature lists; safe to unit-test
    without any GEE or disk dependencies.
    """
    node_props = [node.get("properties", {}) for node in nodes]

    max_cascade_depth = (
        max(
            (_safe_int(props.get("cascade_position")) for props in node_props),
            default=0,
        )
    )
    isolated_count = sum(1 for props in node_props if _is_isolated(props))

    # Top convergence node = highest degree_in. Ties broken by largest
    # area (more narratively prominent), then by osm_id for determinism.
    top_convergence: dict[str, Any] | None = None
    if node_props:
        best = max(
            node_props,
            key=lambda p: (
                _safe_int(p.get("degree_in")),
                float(p.get("area_ha") or 0.0),
                -_safe_int(p.get("osm_id")),
            ),
        )
        top_convergence = {
            "osm_id": _safe_int(best.get("osm_id")),
            "name": (best.get("name") or "").strip() or None,
            "degree_in": _safe_int(best.get("degree_in")),
            "cascade_position": _safe_int(best.get("cascade_position")) or None,
            "area_ha": (
                round(float(best.get("area_ha")), 2)
                if best.get("area_ha") is not None
                else None
            ),
        }

    # Narrative anchor: if the district config names one, look it up in
    # the node list and include its details too. Lets the about-page
    # methodology section anchor on a known landmark (Vandiyur for
    # Madurai) even when topology's top_convergence is unnamed or less
    # narratively meaningful.
    narrative_anchor: dict[str, Any] | None = None
    if district.narrative_anchor_osm_id is not None:
        anchor_id = district.narrative_anchor_osm_id
        for props in node_props:
            if _safe_int(props.get("osm_id")) == anchor_id:
                narrative_anchor = {
                    "osm_id": anchor_id,
                    "name": (props.get("name") or "").strip() or None,
                    "degree_in": _safe_int(props.get("degree_in")),
                    "cascade_position": (
                        _safe_int(props.get("cascade_position")) or None
                    ),
                    "area_ha": (
                        round(float(props.get("area_ha")), 2)
                        if props.get("area_ha") is not None
                        else None
                    ),
                }
                break
        # narrative_anchor stays None if osm_id wasn't matched in nodes;
        # consumers fall back to top_convergence.

    return {
        "node_count": len(nodes),
        "edge_count": len(edges),
        "river_outlet_count": len(river_outlets),
        "isolated_count": isolated_count,
        "max_cascade_depth": max_cascade_depth,
        "top_convergence": top_convergence,
        "narrative_anchor": narrative_anchor,
    }


def write_stats_manifest(district: DistrictCascadeConfig) -> dict[str, Any]:
    """Compute summary statistics from the published GeoJSONs and write
    {district}-cascade-stats.json.

    Reads nodes / edges / river-outlets from disk; does not require the
    in-memory graph. Safe to run independently any time after
    write_geojson() has produced the three GeoJSON files.

    The output is the single source of truth for the about-page
    methodology section and the hydrologist-facing PDF; the frontend no
    longer hardcodes these counts.
    """
    _ensure_dirs()
    nodes = _load_feature_collection(district.cascade_nodes_geojson_path())
    edges = _load_feature_collection(district.cascade_edges_geojson_path())
    outlets = _load_feature_collection(
        district.cascade_river_outlets_geojson_path()
    )

    stats = _compute_stats(district, nodes, edges, outlets)
    payload: dict[str, Any] = {
        "district_id": district.district_id,
        "label": district.label,
        "_meta": _build_meta(district),
        **stats,
    }

    stats_path = district.cascade_stats_json_path()
    stats_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return {
        "stats_path": str(stats_path),
        **{k: v for k, v in stats.items() if k != "top_convergence" and k != "narrative_anchor"},
    }


def write_systems_manifest(
    district: DistrictCascadeConfig,
    systems: dict[str, Any],
) -> dict[str, Any]:
    """Write the small JSON manifest the frontend loads on initial render.

    No geometry in this file - just named-cascade summaries, counts,
    and bounding boxes. Keeps initial page payload tiny.
    """
    _ensure_dirs()
    payload = {
        "district_id": district.district_id,
        "label": district.label,
        "_meta": _build_meta(district),
        "systems": systems.get("systems", []),
        "summary": systems.get("summary", {}),
    }
    manifest_path = district.cascade_systems_json_path()
    manifest_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return {"manifest_path": str(manifest_path)}


def _tippecanoe_available() -> bool:
    return shutil.which("tippecanoe") is not None


def build_pmtiles(district: DistrictCascadeConfig) -> dict[str, Any]:
    """Build PMTiles for the cascade nodes and edges layers.

    Uses tippecanoe with auto-simplification across zooms; output is a
    single byte-range-queryable file per layer that the frontend mounts
    as a vector source. Requires `tippecanoe` on PATH; install via
    `brew install tippecanoe` on macOS.
    """
    if not _tippecanoe_available():
        raise RuntimeError(
            "tippecanoe is not installed; install via "
            "`brew install tippecanoe` (macOS) or "
            "https://github.com/felt/tippecanoe for other platforms."
        )

    _ensure_dirs()
    nodes_geojson = district.cascade_nodes_geojson_path()
    edges_geojson = district.cascade_edges_geojson_path()
    outlets_geojson = district.cascade_river_outlets_geojson_path()
    nodes_pmtiles = district.cascade_nodes_pmtiles_path()
    edges_pmtiles = district.cascade_edges_pmtiles_path()
    outlets_pmtiles = district.cascade_river_outlets_pmtiles_path()

    if not nodes_geojson.exists() or not edges_geojson.exists():
        raise RuntimeError(
            f"Missing source GeoJSON for {district.district_id}; "
            "run write_geojson() first."
        )

    # Per the perf contract: minimum zoom 8 (district overview),
    # max zoom 14 (interactive detail). tippecanoe auto-simplifies
    # geometries between zooms; the resulting file is small and the
    # client only fetches the tiles it needs.
    common = [
        "tippecanoe",
        "--force",
        "--minimum-zoom=8",
        "--maximum-zoom=14",
        "--drop-densest-as-needed",
    ]
    subprocess.run(
        [
            *common,
            "--layer=cascade_nodes",
            f"--output={nodes_pmtiles}",
            str(nodes_geojson),
        ],
        check=True,
    )
    subprocess.run(
        [
            *common,
            "--layer=cascade_edges",
            f"--output={edges_pmtiles}",
            str(edges_geojson),
        ],
        check=True,
    )
    result: dict[str, Any] = {
        "nodes_pmtiles": str(nodes_pmtiles),
        "edges_pmtiles": str(edges_pmtiles),
        "nodes_size_bytes": nodes_pmtiles.stat().st_size,
        "edges_size_bytes": edges_pmtiles.stat().st_size,
    }
    if outlets_geojson.exists():
        subprocess.run(
            [
                *common,
                "--layer=cascade_river_outlets",
                f"--output={outlets_pmtiles}",
                str(outlets_geojson),
            ],
            check=True,
        )
        result["river_outlets_pmtiles"] = str(outlets_pmtiles)
        result["river_outlets_size_bytes"] = outlets_pmtiles.stat().st_size
    return result

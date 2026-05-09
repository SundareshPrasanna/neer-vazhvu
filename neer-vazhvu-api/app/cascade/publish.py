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

import json
import shutil
import subprocess
from typing import Any

from app.cascade.districts import (
    CASCADE_OUTPUT_DIR,
    CASCADE_TILE_DIR,
    DistrictCascadeConfig,
)


def _ensure_dirs() -> None:
    CASCADE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CASCADE_TILE_DIR.mkdir(parents=True, exist_ok=True)


def write_geojson(
    district: DistrictCascadeConfig,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    river_outlets: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Write nodes, edges, and river-outlet arrows as GeoJSON.

    river_outlets is a list of LineString features from a tank centroid
    to its nearest in-flow-direction river point; tanks that drain into
    a river instead of into another tank.
    """
    _ensure_dirs()
    river_outlets = river_outlets or []
    nodes_fc = {"type": "FeatureCollection", "features": nodes}
    edges_fc = {"type": "FeatureCollection", "features": edges}
    outlets_fc = {"type": "FeatureCollection", "features": river_outlets}

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

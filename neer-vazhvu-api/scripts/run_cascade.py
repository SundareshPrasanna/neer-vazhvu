"""CLI for the cascade reconstruction pipeline.

Usage:
    python scripts/run_cascade.py --district madurai build-topology
    python scripts/run_cascade.py --district madurai cross-check-channels
    python scripts/run_cascade.py --district madurai detect-encroachment
    python scripts/run_cascade.py --district madurai score
    python scripts/run_cascade.py --district madurai curate
    python scripts/run_cascade.py --district madurai publish
    python scripts/run_cascade.py --district madurai stats
    python scripts/run_cascade.py --district madurai tile
    python scripts/run_cascade.py --district madurai run-all

Stages dispatch to pure functions in app.cascade.*. Outputs are
deterministic files in public/data/cascade/ and public/tiles/cascade/.

The `stats` stage is a standalone refresh of {district}-cascade-stats.json
from the published GeoJSONs - useful when re-running publish without
re-running build-topology, or when bootstrapping stats files for a
district that already has GeoJSON outputs from an older pipeline.
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))


def cmd_build_topology(district_id: str) -> int:
    """Build the cascade graph AND publish nodes/edges GeoJSON in one shot.

    The graph is district-scoped state we don't keep in memory across
    subcommands; persisting to GeoJSON here makes downstream stages
    (cross-check-channels, detect-encroachment, score, tile) reload
    from disk. Same pattern as the GEE manifests.
    """
    from app.cascade import publish, topology
    from app.cascade.districts import get_district_cascade_config

    district = get_district_cascade_config(district_id)
    graph = topology.build_graph(district)
    written = publish.write_geojson(
        district,
        nodes=graph["nodes"],
        edges=graph["edges"],
        river_outlets=graph.get("river_outlets", []),
    )
    stats = publish.write_stats_manifest(district)
    print(
        json.dumps(
            {
                "district_id": district.district_id,
                "node_count": len(graph["nodes"]),
                "edge_count": len(graph["edges"]),
                "river_outlet_count": len(graph.get("river_outlets", [])),
                **written,
                **stats,
            },
            indent=2,
        )
    )
    return 0


def cmd_delineate_catchments(district_id: str) -> int:
    """Terrain-derive a catchment polygon for every cascade node.

    One FABDEM mosaic + one WhiteboxTools conditioning pass per district,
    then a bounded upstream BFS per lake. Writes
    {district}-cascade-catchments.geojson, extends the nodes file with
    catchment_area_sqkm, and writes {district}-catchment-quality.json.
    """
    from app.cascade import catchments
    from app.cascade.districts import get_district_cascade_config

    district = get_district_cascade_config(district_id)
    # Persist the conditioned DEM (FABDEM mosaic + WhiteboxTools rasters) per
    # district so re-delineation (e.g. after a filter change) skips the slow
    # GEE pull and reuses the cached terrain.
    dem_cache = Path(tempfile.gettempdir()) / "cascade_dem_cache" / district_id
    summary = catchments.build_catchments(district, dem_cache=dem_cache)
    print(json.dumps(summary, indent=2))
    return 0


def cmd_enrich_catchments(district_id: str) -> int:
    """Join Overture buildings + IMD rainfall onto each catchment to compute
    rooftop area, building count, and annual rainwater-harvest potential.
    Writes the stats into the lakes GeoJSON properties."""
    from app.cascade import buildings
    from app.cascade.districts import get_district_cascade_config

    district = get_district_cascade_config(district_id)
    print(json.dumps(buildings.enrich_catchments(district), indent=2))
    return 0


def cmd_cross_check_channels(district_id: str) -> int:
    from app.cascade import channels
    from app.cascade.districts import get_district_cascade_config

    district = get_district_cascade_config(district_id)
    # Loads existing edges from publish output, threads through OSM + Sentinel.
    channels.cross_check_osm(district, edges=[])
    channels.cross_check_sentinel(district, edges=[])
    return 0


def cmd_detect_encroachment(district_id: str) -> int:
    from app.cascade import encroachment
    from app.cascade.districts import get_district_cascade_config

    district = get_district_cascade_config(district_id)
    encroachment.overlay_built_up(district, edges=[])
    return 0


def cmd_score(district_id: str) -> int:
    from app.cascade import scoring
    from app.cascade.districts import get_district_cascade_config

    district = get_district_cascade_config(district_id)
    scoring.classify_edge_status(district, edges=[])
    scoring.cascade_health_scores(district, nodes=[], edges=[])
    return 0


def cmd_curate(district_id: str) -> int:
    from app.cascade import curation
    from app.cascade.districts import get_district_cascade_config

    district = get_district_cascade_config(district_id)
    curation.attach_named_cascades(district, nodes=[], edges=[])
    return 0


def cmd_publish(district_id: str) -> int:
    """Refuse: standalone `publish` had no real inputs and overwrote shipped
    GeoJSONs with empty FeatureCollections (2026-08 baseline P0.3). The real
    publish happens inside build-topology; `stats` refreshes manifests from
    the existing GeoJSONs."""
    print(
        f"'publish' is disabled: it would overwrite {district_id}'s shipped "
        f"cascade artifacts with empty data. Use 'build-topology' to build "
        f"and publish, or 'stats' to refresh manifests from existing "
        f"GeoJSONs.",
        file=sys.stderr,
    )
    return 1


def cmd_stats(district_id: str) -> int:
    """Compute and write the stats manifest from existing GeoJSONs.

    Standalone path for refreshing stats after the GeoJSONs have been
    regenerated outside the full pipeline run, or for bootstrapping
    stats files from an existing publish.
    """
    from app.cascade import publish
    from app.cascade.districts import get_district_cascade_config

    district = get_district_cascade_config(district_id)
    stats = publish.write_stats_manifest(district)
    print(json.dumps(stats, indent=2))
    return 0


def cmd_sensitivity(district_id: str) -> int:
    """Sweep each topology parameter and write a per-city sensitivity
    table to {district}-cascade-sensitivity.json. Read by the
    methodology section and the hydrologist-facing PDF.
    """
    from app.cascade import sensitivity
    from app.cascade.districts import get_district_cascade_config

    district = get_district_cascade_config(district_id)
    payload = sensitivity.run_sensitivity_analysis(district)
    print(
        json.dumps(
            {
                "district_id": payload["district_id"],
                "sweeps": [
                    {
                        "parameter": s["parameter"],
                        "default": s["default"],
                        "result_count": len(s["results"]),
                    }
                    for s in payload["sweeps"]
                ],
            },
            indent=2,
        )
    )
    return 0


def cmd_health(district_id: str) -> int:
    """Score documented + auto-derived cascades for health and priority.

    Reads documented chains from
    public/data/cascade/{district}-cascades-documented.json, joins
    them with the cascade GeoJSONs and (where present) the
    lost-tanks JSON, writes {district}-cascades-health.json.
    """
    from app.cascade import health
    from app.cascade.districts import get_district_cascade_config

    district = get_district_cascade_config(district_id)
    payload = health.compute_cascade_health(district)
    print(
        json.dumps(
            {
                "district_id": payload["district_id"],
                "summary": payload["summary"],
            },
            indent=2,
        )
    )
    return 0


def cmd_tile(district_id: str) -> int:
    from app.cascade import publish
    from app.cascade.districts import get_district_cascade_config

    district = get_district_cascade_config(district_id)
    result = publish.build_pmtiles(district)
    print(json.dumps(result, indent=2))
    return 0


def cmd_run_all(district_id: str) -> int:
    cmd_build_topology(district_id)
    cmd_cross_check_channels(district_id)
    cmd_detect_encroachment(district_id)
    cmd_score(district_id)
    cmd_curate(district_id)
    # publish intentionally absent: build-topology already wrote the
    # GeoJSONs; the old standalone publish step re-wrote them empty.
    cmd_tile(district_id)
    return 0


def build_parser() -> argparse.ArgumentParser:
    from app.cascade.districts import supported_district_ids

    parser = argparse.ArgumentParser(description="Cascade reconstruction pipeline")
    parser.add_argument(
        "--district",
        required=True,
        choices=list(supported_district_ids()),
        help="District scope for the cascade pipeline.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    for command in (
        "build-topology",
        "delineate-catchments",
        "enrich-catchments",
        "cross-check-channels",
        "detect-encroachment",
        "score",
        "curate",
        "publish",
        "stats",
        "health",
        "sensitivity",
        "tile",
        "run-all",
    ):
        subparsers.add_parser(command, help=f"Run the {command} stage.")

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    dispatch = {
        "build-topology": cmd_build_topology,
        "delineate-catchments": cmd_delineate_catchments,
        "enrich-catchments": cmd_enrich_catchments,
        "cross-check-channels": cmd_cross_check_channels,
        "detect-encroachment": cmd_detect_encroachment,
        "score": cmd_score,
        "curate": cmd_curate,
        "publish": cmd_publish,
        "stats": cmd_stats,
        "health": cmd_health,
        "sensitivity": cmd_sensitivity,
        "tile": cmd_tile,
        "run-all": cmd_run_all,
    }

    try:
        return dispatch[args.command](args.district)
    except NotImplementedError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

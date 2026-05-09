"""CLI for the cascade reconstruction pipeline.

Usage:
    python scripts/run_cascade.py --district madurai build-topology
    python scripts/run_cascade.py --district madurai cross-check-channels
    python scripts/run_cascade.py --district madurai detect-encroachment
    python scripts/run_cascade.py --district madurai score
    python scripts/run_cascade.py --district madurai curate
    python scripts/run_cascade.py --district madurai publish
    python scripts/run_cascade.py --district madurai tile
    python scripts/run_cascade.py --district madurai run-all

Stages dispatch to pure functions in app.cascade.*. Outputs are
deterministic files in public/data/cascade/ and public/tiles/cascade/.
"""

from __future__ import annotations

import argparse
import json
import sys
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
        district, nodes=graph["nodes"], edges=graph["edges"]
    )
    print(
        json.dumps(
            {
                "district_id": district.district_id,
                "node_count": len(graph["nodes"]),
                "edge_count": len(graph["edges"]),
                **written,
            },
            indent=2,
        )
    )
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
    from app.cascade import publish
    from app.cascade.districts import get_district_cascade_config

    district = get_district_cascade_config(district_id)
    geo = publish.write_geojson(district, nodes=[], edges=[])
    manifest = publish.write_systems_manifest(district, systems={})
    print(json.dumps({**geo, **manifest}, indent=2))
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
    cmd_publish(district_id)
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
        "cross-check-channels",
        "detect-encroachment",
        "score",
        "curate",
        "publish",
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
        "cross-check-channels": cmd_cross_check_channels,
        "detect-encroachment": cmd_detect_encroachment,
        "score": cmd_score,
        "curate": cmd_curate,
        "publish": cmd_publish,
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

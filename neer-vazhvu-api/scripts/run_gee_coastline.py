"""
Orchestrator for the Chennai coastal shoreline-change reproduction.

Stages mirror app/gee/coastline.py. The end-to-end run needs GEE credentials
(see app/gee/client.py) and the coastal extra (pip install -e .[coastal]); it
has not been run/validated locally yet. See
docs/research/chennai-coast-paper/METHODS.md.

Commands:
  check-auth          Verify Earth Engine credentials are usable.
  extract-shorelines  Stage 1: CoastSat shoreline extraction via GEE.
  build-geojson       Stage 2 + emit public/geojson/chennai-coastal-transects.geojson.
  all                 extract-shorelines -> build-geojson.

Example:
  python scripts/run_gee_coastline.py check-auth
  python scripts/run_gee_coastline.py all
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

REPO_ROOT = API_ROOT.parent
OUT_PATH = REPO_ROOT / "public" / "geojson" / "chennai-coastal-transects.geojson"


def cmd_check_auth() -> int:
    from app.gee.client import check_auth

    print(json.dumps(check_auth(), indent=2))
    return 0


def cmd_extract_shorelines() -> int:
    from app.gee.coastline import extract_shorelines

    shorelines = extract_shorelines()
    print(json.dumps({"epochs": sorted(shorelines.shorelines)}, indent=2))
    return 0


def cmd_build_geojson(write: bool) -> int:
    from app.gee.coastline import (
        build_transects,
        compute_transect_rates,
        extract_shorelines,
        transects_to_geojson,
    )

    shorelines = extract_shorelines()
    # The baseline is the earliest reliable shoreline; zone assignment splits
    # the baseline by the study's published per-zone lengths (see METHODS.md).
    baseline = shorelines.shorelines[min(shorelines.shorelines)]
    transects = build_transects(baseline)

    def zone_of(_tid: int) -> str:  # placeholder: wire arc-length split on run
        return "?"

    rates = compute_transect_rates(transects, shorelines, zone_of)
    fc = transects_to_geojson(rates)
    if write:
        OUT_PATH.write_text(json.dumps(fc, separators=(",", ":")), encoding="utf-8")
        print(f"wrote {OUT_PATH} ({len(fc['features'])} transects)")
    else:
        print(json.dumps({"transect_count": len(fc["features"])}, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Chennai coastal shoreline-change pipeline")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check-auth")
    sub.add_parser("extract-shorelines")
    bg = sub.add_parser("build-geojson")
    bg.add_argument("--write", action="store_true")
    al = sub.add_parser("all")
    al.add_argument("--write", action="store_true", default=True)

    args = parser.parse_args()
    if args.command == "check-auth":
        return cmd_check_auth()
    if args.command == "extract-shorelines":
        return cmd_extract_shorelines()
    if args.command in ("build-geojson", "all"):
        return cmd_build_geojson(write=getattr(args, "write", False))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

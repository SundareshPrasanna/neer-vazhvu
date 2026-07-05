"""
Orchestrator for the Chennai coastal shoreline-change reproduction.

Computes our own transect erosion/accretion rates (MNDWI on Landsat/Sentinel-2
via GEE + DSAS-equivalent WLR) and writes
public/geojson/chennai-coastal-transects.geojson (source="computed"). Needs
Earth Engine auth (see app/gee/client.py); no extra pip deps beyond the core
install. See docs/research/chennai-coast-paper/METHODS.md.

Commands:
  check-auth     Verify Earth Engine credentials are usable.
  build-geojson  Run the pipeline; --write to persist the GeoJSON.

Example:
  python scripts/run_gee_coastline.py check-auth
  python scripts/run_gee_coastline.py build-geojson --write
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))


def cmd_check_auth() -> int:
    from app.gee.client import check_auth

    print(json.dumps(check_auth(), indent=2))
    return 0


def cmd_build_geojson(write: bool, city: str) -> int:
    from app.gee.coastline import run

    fc = run(city=city, write=write, log=lambda m: print(m, flush=True))
    print(
        json.dumps({"transect_count": len(fc["features"]), "written": write}, indent=2)
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Coastal shoreline-change pipeline (per-city, see COASTS)"
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check-auth")
    bg = sub.add_parser("build-geojson")
    bg.add_argument("--write", action="store_true")
    bg.add_argument("--city", default="chennai")

    args = parser.parse_args()
    if args.command == "check-auth":
        return cmd_check_auth()
    if args.command == "build-geojson":
        return cmd_build_geojson(write=args.write, city=args.city)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

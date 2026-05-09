#!/usr/bin/env python3
"""
One-time backfill: compute Cauvery basin rainfall LPA from OpenMeteo Historical.

Fetches 30 years (1991-2020, the WMO climate-normal period) of daily basin-area-
averaged precipitation across the WRIS Cauvery polygon, computes the mean
season-cumulative rainfall by day-of-season for SW (Jun-Sep) and NE (Oct-Dec),
and writes the result to public/data/cauvery-basin-lpa.json.

This script does NOT need Supabase credentials. Run once, commit the JSON.

Usage:
    cd neer-vazhvu-api
    python scripts/backfill_cauvery_basin_lpa.py
"""

import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.scrapers.openmeteo_basin_rainfall import (  # noqa: E402
    DEFAULT_BASIN_GEOJSON,
    fetch_archive_for_lpa,
    grid_points_in_basin,
    load_basin_polygon,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_PATH = REPO_ROOT / "public" / "data" / "cauvery-basin-lpa.json"


async def main() -> int:
    print(f"Loading basin polygon from {DEFAULT_BASIN_GEOJSON}", flush=True)
    polygon = load_basin_polygon(DEFAULT_BASIN_GEOJSON)
    points = grid_points_in_basin(polygon)
    print(f"  {len(points)} grid points inside basin", flush=True)

    print("Fetching 1991-2020 daily archive for each year…", flush=True)
    lpa = await fetch_archive_for_lpa(points, start_year=1991, end_year=2020)

    print(f"  SW season: {len(lpa.get('sw', {}))} days of LPA", flush=True)
    print(f"  NE season: {len(lpa.get('ne', {}))} days of LPA", flush=True)

    # Write before printing stats so a stat-print bug doesn't lose the result.
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(
            {
                "_meta": {
                    "basin": "Cauvery",
                    "polygon_source": "India-WRIS Basin layer 11 (bacode='05')",
                    "rainfall_source": "OpenMeteo Historical Archive (ERA5-Land base)",
                    "period": "1991-2020 (WMO climate normal)",
                    "grid_points": len(points),
                    "spacing_deg": 0.75,
                    "schema": "{ 'sw' | 'ne': { day_of_season_idx: cumulative_mm } }",
                },
                "sw": {str(k): v for k, v in sorted(lpa.get("sw", {}).items())},
                "ne": {str(k): v for k, v in sorted(lpa.get("ne", {}).items())},
            },
            f,
            indent=2,
        )
    print(f"  Wrote LPA to {OUT_PATH}", flush=True)

    if lpa.get("sw"):
        sw_max_doy = max(lpa["sw"].keys())
        print(
            f"  SW season-end LPA (day {sw_max_doy}): {lpa['sw'][sw_max_doy]} mm",
            flush=True,
        )
    if lpa.get("ne"):
        ne_max_doy = max(lpa["ne"].keys())
        print(
            f"  NE season-end LPA (day {ne_max_doy}): {lpa['ne'][ne_max_doy]} mm",
            flush=True,
        )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

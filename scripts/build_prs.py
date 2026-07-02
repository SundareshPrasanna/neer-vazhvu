#!/usr/bin/env python3
"""Build a basin's Polluted River Stretch (PRS) layer for the Basin Atlas.

GENERIC + scalable: this script is river-agnostic. To onboard PRS for a new
river (Cauvery, Ganga, ...), add a basin entry to scripts/prs-sources.json and
run:

    python scripts/build_prs.py <basinId>

No code change, no new component - the `prs` layer flag (in the basin manifest)
and the PRSPanel render whatever this produces, the same way for every river.

Each source line geometry (any OGR-readable format: GeoPackage, Shapefile,
GeoJSON ...) is reprojected to WGS84, simplified + rounded for web use, and
tagged with the constants a column-mapped ingest cannot inject (survey year,
CPCB/NGT priority band; I = worst). Output:

    public/data/basins/<basinId>/prs.geojson

Run from the repo root with the neer-vazhvu-api pyenv env active (needs shapely);
ogr2ogr is taken from PATH / $OGR2OGR / a QGIS*.app bundle (macOS), mirroring
scripts/ingest_basin.py.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from shapely.geometry import shape, mapping

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "scripts" / "prs-sources.json"

SIMPLIFY_DEG = 0.0001  # ~11 m; plenty for city/basin-zoom rendering
COORD_DP = 5           # ~1 m


def _find_tool(name: str, env_var: str) -> str:
    if os.environ.get(env_var):
        return os.environ[env_var]
    found = shutil.which(name)
    if found:
        return found
    for app in sorted(Path("/Applications").glob("QGIS*.app"), reverse=True):
        cand = app / "Contents" / "MacOS" / name
        if cand.exists():
            return str(cand)
    sys.exit(f"Could not find {name}. Install GDAL or set ${env_var}.")


OGR2OGR = _find_tool("ogr2ogr", "OGR2OGR")


def _proj_env() -> dict:
    env = dict(os.environ)
    if "Contents/MacOS" in OGR2OGR:
        base = Path(OGR2OGR).parent.parent / "Resources"
        for cand in (base / "qgis" / "proj", base / "proj"):
            if (cand / "proj.db").exists():
                env["PROJ_LIB"] = str(cand)
                env["PROJ_DATA"] = str(cand)
                break
    return env


def _reproject_to_4326(src: Path) -> dict:
    r = subprocess.run(
        [OGR2OGR, "-f", "GeoJSON", "-t_srs", "EPSG:4326",
         "-nlt", "LINESTRING", "/vsistdout/", str(src)],
        capture_output=True, text=True, env=_proj_env(),
    )
    if r.returncode != 0:
        sys.exit(f"ogr2ogr failed for {src.name}:\n{r.stderr}")
    return json.loads(r.stdout)


def _round_coords(geom):
    def rnd(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], COORD_DP), round(c[1], COORD_DP)]
        return [rnd(x) for x in c]
    geom = dict(geom)
    geom["coordinates"] = rnd(geom["coordinates"])
    return geom


def build(basin_id: str) -> None:
    cfg = json.loads(CONFIG.read_text())["basins"].get(basin_id)
    if not cfg:
        sys.exit(f"No PRS config for basin '{basin_id}' in {CONFIG.relative_to(REPO)}")

    src_dir = REPO / cfg["srcDir"]
    river = cfg.get("river", basin_id)
    credit = cfg.get("credit", "")
    out = REPO / "public" / "data" / "basins" / basin_id / "prs.geojson"

    features = []
    for entry in cfg["years"]:
        fc = _reproject_to_4326(src_dir / entry["file"])
        if not fc.get("features"):
            sys.exit(f"No features in {entry['file']}")
        src = fc["features"][0]
        geom = shape(src["geometry"]).simplify(SIMPLIFY_DEG, preserve_topology=False)
        length_km = round(float(src["properties"].get("Length", 0.0)), 1)
        year, priority = entry["year"], entry["priority"]
        features.append({
            "type": "Feature",
            "properties": {
                "kind": "prs",
                "year": year,
                "priority": priority,
                "length_km": length_km,
                "river": river,
                "label": f"Polluted stretch {year} ({length_km} km, Priority {priority})",
                "source": credit,
            },
            "geometry": _round_coords(mapping(geom)),
        })

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"type": "FeatureCollection", "name": f"{basin_id}_prs", "features": features}))
    sizes = ", ".join(f"{f['properties']['year']}={f['properties']['length_km']}km/"
                      f"Pri {f['properties']['priority']}" for f in features)
    print(f"Wrote {out.relative_to(REPO)} ({out.stat().st_size} bytes): {sizes}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python scripts/build_prs.py <basinId>   (e.g. arkavathi)")
    build(sys.argv[1])

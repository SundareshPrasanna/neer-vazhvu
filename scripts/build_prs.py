#!/usr/bin/env python3
"""Build a basin's Polluted River Stretch (PRS) layer for the Basin Atlas.

GENERIC + scalable: this script is river-agnostic. To onboard PRS for a new
river (Cauvery, Ganga, ...), add a basin entry to scripts/prs-sources.json and
run:

    python3 scripts/build_prs.py <basinId>

No code change, no new component - the `prs` layer flag (in the basin manifest)
and the PRSPanel render whatever this produces, the same way for every river.

Sources are partner GeoPackages that live OUTSIDE the repo (shared under
agreement, gitignored by policy). Each year entry names a GPKG + layer; the
layer's line features are merged into one stretch line, reprojected to WGS84,
simplified + rounded for web use, and tagged with the constants a column-mapped
ingest cannot inject (survey year, CPCB/NGT priority band; I = worst).

The displayed length comes from the layer's own distance attribute where the
source carries one (`distanceAttr` + `fid` - the canonical 2025 layer does),
else from the geodesic measure of the simplified line. Either way the build
FAILS if geometry and stated length drift more than 1% apart - the lesson of
PR #290, where months shipped against a stale standalone layer.

History: this script originally shelled to ogr2ogr. This machine no longer has
GDAL, and the config had drifted behind the shipped data (#290 rebuilt the
geometry without updating it) - it now reads GeoPackages directly (stdlib
sqlite3 + the WKB parser in build_basin_gpkg_layers.py) and the config again
reproduces what ships.

Output: public/data/basins/<basinId>/prs.geojson
"""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

from build_basin_gpkg_layers import hav_km, line_geometry, merged_lines, read_layer

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "scripts" / "prs-sources.json"
SIMPLIFY_DEG = 0.00005  # keeps the drawn line within ~0.3% of the stated length


def build(basin_id: str) -> None:
    cfg = json.loads(CONFIG.read_text())["basins"].get(basin_id)
    if not cfg:
        sys.exit(f"No PRS config for basin '{basin_id}' in {CONFIG.relative_to(REPO)}")

    src_dir = Path(cfg["srcDir"]).expanduser()
    if not src_dir.is_dir():
        sys.exit(f"srcDir not found: {src_dir} (partner GeoPackages live outside the repo)")
    river = cfg.get("river", basin_id)
    credit = cfg.get("credit", "")
    out = REPO / "public" / "data" / "basins" / basin_id / "prs.geojson"

    features = []
    for entry in cfg["years"]:
        gpkg = src_dir / entry["file"]
        parts = []
        for fid, kind, p in read_layer(gpkg, entry["layer"]):
            if kind != "line":
                continue
            if "fid" in entry and fid != entry["fid"]:
                continue
            parts.extend(p)
        if not parts:
            sys.exit(f"No line geometry for {entry['year']} in {entry['file']}:{entry['layer']}")
        geom = line_geometry(merged_lines(parts), SIMPLIFY_DEG)
        lines = geom["coordinates"] if geom["type"] == "MultiLineString" else [geom["coordinates"]]
        measured = sum(hav_km(l) for l in lines)
        if entry.get("distanceAttr"):
            con = sqlite3.connect(gpkg)
            stated = float(con.execute(
                f'SELECT "{entry["distanceAttr"]}" FROM "{entry["layer"]}" WHERE rowid = ?',
                (entry["fid"],)).fetchone()[0])
            con.close()
            if abs(measured - stated) / stated > 0.01:
                sys.exit(f"FAIL {entry['year']}: measured {measured:.2f} km vs stated "
                         f"{stated:.2f} km (>1% apart) - wrong layer?")
            length_km = round(stated, 1)
        elif entry.get("statedKm"):
            # Partner-stated length (e.g. Paani's own 2018 measure, 64.6) -
            # still cross-checked against the geometry we drew.
            stated = float(entry["statedKm"])
            if abs(measured - stated) / stated > 0.01:
                sys.exit(f"FAIL {entry['year']}: measured {measured:.2f} km vs statedKm "
                         f"{stated:.2f} (>1% apart) - wrong layer?")
            length_km = round(stated, 1)
        else:
            length_km = round(measured, 1)
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
            "geometry": geom,
        })

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"type": "FeatureCollection", "name": f"{basin_id}_prs", "features": features}))
    sizes = ", ".join(f"{f['properties']['year']}={f['properties']['length_km']}km/"
                      f"Pri {f['properties']['priority']}" for f in features)
    print(f"Wrote {out.relative_to(REPO)} ({out.stat().st_size} bytes): {sizes}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/build_prs.py <basinId>   (e.g. arkavathi)")
    build(sys.argv[1])

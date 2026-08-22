#!/usr/bin/env python3
"""Build overview-basin layers from partner GeoPackages (local, not in-repo).

Produces, for an overview basin (config: scripts/basin-sources/<basin>-paani.json):

    prs-stretches.geojson    CPCB polluted river stretches as REAL LINES from the
                             partner's canonical PRS layer, with priority/BOD from
                             the CPCB report itself (defensible-numbers: every
                             number in the config cites its table)
    rivers.geojson           named river centrelines, clipped to the basin share
    context-boundary.geojson the FULL basin outline (all states), drawn muted
                             behind the interactive share

Why a sibling script and not an ingest family: ingest_basin_overview.py pulls
from live GeoServers; these layers come from partner GeoPackages that live
OUTSIDE the repo (shared under agreement, gitignored by policy - see
.gitignore's docs/partnerships note). Same pattern as
build_basin_prs_points.py: write the family file, patch inventory.json.

Run AFTER ingest_basin_overview.py (a full ingest regenerates inventory.json
and would drop these families from it - re-run this script to restore them,
the same discipline as build_basin_wq_readings.py).

Validations (build fails on any):
  - every PRS entry's measured geodesic length within 1% of the layer's own
    Distance attribute (the number we display);
  - every PRS midpoint lands in the sub-basin the config expects, using the
    SAME sampling rule as basin-overview.tsx (mid-vertex of the longest part),
    so the map's client-side counting is deterministic at build time;
  - no silently-empty layer: a configured river with no geometry after the
    basin clip fails unless the config marks it `allowEmpty` (the honest-gap
    escape hatch for layers the partner shipped empty).

GPKG reading is stdlib sqlite3 + a small ISO-WKB parser (this machine has no
GDAL/ogr2ogr; only shapely). Handles 4326 passthrough and the 3857 inverse.

Usage: python3 scripts/build_basin_gpkg_layers.py scripts/basin-sources/cauvery-ka-paani.json
"""
from __future__ import annotations

import json
import math
import sqlite3
import struct
import sys
from pathlib import Path

from shapely.geometry import LineString, MultiLineString, MultiPolygon, Polygon, mapping
from shapely.ops import linemerge, unary_union

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402  (envelopes survive re-runs)
R_MERC = 6378137.0
COORD_DP = 5


# ── GeoPackage binary + ISO WKB ─────────────────────────────────────────────

def gpkg_wkb(blob: bytes) -> bytes:
    if blob[:2] != b"GP":
        raise ValueError("not a GeoPackage geometry blob")
    env_ind = (blob[3] >> 1) & 7
    env_size = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env_ind]
    return blob[8 + env_size:]


def parse_wkb(buf: bytes, off: int = 0):
    """Return (geom, offset). geom = ("line"|"poly", parts) with parts a list
    of coordinate lists (line parts, or polygon rings flattened poly-by-poly)."""
    bo = "<" if buf[off] == 1 else ">"
    raw = struct.unpack_from(bo + "I", buf, off + 1)[0]
    typ = raw & 0xFF
    zm = raw // 1000  # ISO: 1=Z, 2=M, 3=ZM
    dims = 2 + (1 if zm in (1, 3) else 0) + (1 if zm in (2, 3) else 0)
    off += 5

    def read_points(o):
        n = struct.unpack_from(bo + "I", buf, o)[0]
        o += 4
        vals = struct.unpack_from(bo + f"{dims * n}d", buf, o)
        o += 8 * dims * n
        return [(vals[dims * i], vals[dims * i + 1]) for i in range(n)], o

    if typ == 2:  # LineString
        pts, off = read_points(off)
        return ("line", [pts]), off
    if typ == 3:  # Polygon
        n = struct.unpack_from(bo + "I", buf, off)[0]
        off += 4
        rings = []
        for _ in range(n):
            r, off = read_points(off)
            rings.append(r)
        return ("poly", [rings]), off
    if typ == 8:  # CircularString - arcs approximated by their vertices
        pts, off = read_points(off)
        return ("line", [pts]), off
    if typ == 9:  # CompoundCurve - concatenate its segments into one line
        n = struct.unpack_from(bo + "I", buf, off)[0]
        off += 4
        coords: list = []
        for _ in range(n):
            (kind, parts), off = parse_wkb(buf, off)
            for part in parts:
                coords.extend(part if not coords else part[1:])
        return ("line", [coords]), off
    if typ == 10:  # CurvePolygon - rings are curves (LineString/Compound/Circular)
        n = struct.unpack_from(bo + "I", buf, off)[0]
        off += 4
        rings = []
        for _ in range(n):
            (kind, parts), off = parse_wkb(buf, off)
            for part in parts:
                rings.append(part)
        return ("poly", [rings]), off
    if typ in (4, 5, 6, 7, 11, 12):  # Multi* / GeometryCollection / MultiCurve / MultiSurface
        n = struct.unpack_from(bo + "I", buf, off)[0]
        off += 4
        lines, polys = [], []
        for _ in range(n):
            (kind, parts), off = parse_wkb(buf, off)
            (lines if kind == "line" else polys).extend(parts)
        if polys and not lines:
            return ("poly", polys), off
        return ("line", lines), off
    raise ValueError(f"unsupported WKB type {raw}")


def read_layer(gpkg: Path, table: str):
    """Yield (fid, kind, parts) per feature, reprojected to lon/lat."""
    con = sqlite3.connect(gpkg)
    try:
        srs = con.execute(
            "SELECT srs_id FROM gpkg_geometry_columns WHERE table_name = ?", (table,)
        ).fetchone()
        if srs is None:
            raise SystemExit(f"layer {table!r} not found in {gpkg.name}")
        srs = srs[0]
        geom_col = con.execute(
            "SELECT column_name FROM gpkg_geometry_columns WHERE table_name = ?", (table,)
        ).fetchone()[0]
        for row in con.execute(f'SELECT rowid, "{geom_col}" FROM "{table}"'):
            fid, blob = row
            if blob is None:
                continue
            kind, parts = parse_wkb(gpkg_wkb(blob))[0]
            if srs == 3857:
                # "line": parts = [pointlist]; "poly": parts = [[ring, ...], ...]
                if kind == "line":
                    parts = [[merc_inv(x, y) for x, y in part] for part in parts]
                else:
                    parts = [[[merc_inv(x, y) for x, y in ring] for ring in poly] for poly in parts]
            elif srs != 4326:
                raise SystemExit(f"layer {table!r} is EPSG:{srs} - only 4326/3857 supported here")
            yield fid, kind, parts
    finally:
        con.close()


def merc_inv(x: float, y: float):
    lon = math.degrees(x / R_MERC)
    lat = math.degrees(2 * math.atan(math.exp(y / R_MERC)) - math.pi / 2)
    return (lon, lat)


# ── geometry helpers ────────────────────────────────────────────────────────

def hav_km(coords) -> float:
    R = 6371.0088
    s = 0.0
    for (x1, y1), (x2, y2) in zip(coords, coords[1:]):
        p1, p2 = math.radians(y1), math.radians(y2)
        a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(x2 - x1) / 2) ** 2
        s += 2 * R * math.asin(math.sqrt(a))
    return s


def merged_lines(parts) -> list[list]:
    """linemerge + longest-part-first: basin-overview.tsx samples the mid-vertex
    of the FIRST part of a MultiLineString, so part order is load-bearing."""
    merged = linemerge(MultiLineString([p for p in parts if len(p) >= 2]))
    geoms = [merged] if merged.geom_type == "LineString" else list(merged.geoms)
    lines = sorted((list(g.coords) for g in geoms), key=hav_km, reverse=True)
    return [[(x, y) for x, y, *_ in l] for l in lines]


def line_geometry(lines, eps: float) -> dict:
    simplified = []
    for l in lines:
        s = LineString(l).simplify(eps, preserve_topology=False)
        simplified.append([[round(x, COORD_DP), round(y, COORD_DP)] for x, y in s.coords])
    if len(simplified) == 1:
        return {"type": "LineString", "coordinates": simplified[0]}
    return {"type": "MultiLineString", "coordinates": simplified}


def rounded(geom: dict) -> dict:
    def rnd(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], COORD_DP), round(c[1], COORD_DP)]
        return [rnd(x) for x in c]
    return {"type": geom["type"], "coordinates": rnd(geom["coordinates"])}


# ── build ───────────────────────────────────────────────────────────────────

def main(cfg_path: str) -> None:
    cfg = json.loads(Path(cfg_path).read_text())
    src_dir = Path(cfg["srcDir"]).expanduser()
    if not src_dir.is_dir():
        sys.exit(f"srcDir not found: {src_dir} (partner GeoPackages live outside the repo)")
    basin_dir = ROOT / "public" / "data" / "basins" / cfg["basinId"]
    sub_basins = json.loads((basin_dir / "sub-basins.geojson").read_text())

    def sub_code_for(x: float, y: float) -> str | None:
        # Same even-odd outer-ring test the component uses.
        def in_ring(ring):
            c, j = False, len(ring) - 1
            for i in range(len(ring)):
                xi, yi = ring[i][0], ring[i][1]
                xj, yj = ring[j][0], ring[j][1]
                if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                    c = not c
                j = i
            return c
        for f in sub_basins["features"]:
            g = f["geometry"]
            polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
            if any(in_ring(p[0]) for p in polys):
                return f["properties"]["code"]
        return None

    inv_updates: dict[str, dict] = {}

    def emit(family: str, features: list, provenance: str) -> None:
        fp = basin_dir / f"{family}.geojson"
        write_artifact(fp, {"type": "FeatureCollection", "features": features}, compact=True)
        inv_updates[family] = {
            "featureCount": len(features),
            "sources": [{"file": f"{family}.geojson", "kind": None,
                         "count": len(features), "provenance": provenance}],
            "bytes": fp.stat().st_size,
            "sliced": False,
        }
        print(f"  {family}: {len(features)} features, {fp.stat().st_size // 1024} KB")

    # 1. Clip mask: the basin's own share polygon, buffered a hair so border
    #    reaches (the mainstem runs the state line) survive the intersection.
    clip_cfg = cfg["clip"]
    mask_parts = []
    for _, kind, parts in read_layer(src_dir / clip_cfg["gpkg"], clip_cfg["layer"]):
        if kind != "poly":
            sys.exit("clip layer is not polygonal")
        for rings in parts:
            mask_parts.append(Polygon(rings[0], rings[1:]))
    mask = unary_union(mask_parts).buffer(clip_cfg.get("bufferDeg", 0.005))
    print(f"clip mask: {clip_cfg['layer']!r}, area {mask.area:.2f} sq deg")

    # 2. PRS stretch lines from the canonical layer, attributes from the config
    #    (which cites the CPCB report per entry).
    prs_cfg = cfg["prs"]
    by_fid = {}
    con = sqlite3.connect(src_dir / prs_cfg["gpkg"])
    dist_rows = dict(con.execute(
        f'SELECT rowid, "{prs_cfg["distanceAttr"]}" FROM "{prs_cfg["layer"]}"'))
    con.close()
    for fid, kind, parts in read_layer(src_dir / prs_cfg["gpkg"], prs_cfg["layer"]):
        by_fid[fid] = merged_lines(parts)
    feats = []
    for entry in prs_cfg["entries"]:
        fid = entry["fid"]
        if fid not in by_fid:
            sys.exit(f"PRS fid {fid} ({entry['stretchId']}) not in layer")
        lines = by_fid[fid]
        claimed = float(dist_rows[fid])
        measured = sum(hav_km(l) for l in lines)
        if abs(measured - claimed) / claimed > 0.01:
            sys.exit(f"FAIL {entry['stretchId']}: measured {measured:.2f} km vs "
                     f"claimed {claimed:.2f} km (>1% apart)")
        geom = line_geometry(lines, prs_cfg.get("simplifyEps", 0.00005))
        first = geom["coordinates"] if geom["type"] == "LineString" else geom["coordinates"][0]
        mx, my = first[len(first) // 2]
        code = sub_code_for(mx, my)
        if code != entry["expectSubBasin"]:
            sys.exit(f"FAIL {entry['stretchId']}: midpoint sub-basin {code}, "
                     f"expected {entry['expectSubBasin']}")
        props = {
            "stretchId": entry["stretchId"],
            "river": entry["river"],
            "stretch": entry["stretch"],
            "priority": entry["priority"],
            "kind": "stretch",
            "bodValue": entry["bodValue"],
            "lengthKm": round(claimed, 1),
            "subBasin": code,
            "vintage": prs_cfg["assessment"],
        }
        if entry.get("history"):
            props["history"] = entry["history"]
        feats.append({"type": "Feature", "geometry": geom, "properties": props})
        print(f"  prs {entry['stretchId']}: {claimed:.1f} km claimed / "
              f"{measured:.1f} measured, Priority {entry['priority']}, -> {code}")
    emit("prs-stretches", feats, prs_cfg["source"])

    # 3. Named river centrelines, clipped to the basin share.
    riv_cfg = cfg["rivers"]
    feats = []
    for entry in riv_cfg["layers"]:
        parts = []
        for _, kind, p in read_layer(src_dir / riv_cfg["gpkg"], entry["layer"]):
            if kind == "line":
                parts.extend(p)
        if not parts:
            if entry.get("allowEmpty"):
                print(f"  rivers: {entry['name']} EMPTY in source (declared gap), skipped")
                continue
            sys.exit(f"FAIL rivers: {entry['layer']!r} has no line geometry")
        clipped = MultiLineString([p for p in parts if len(p) >= 2]).intersection(mask)
        if clipped.is_empty:
            if entry.get("allowEmpty"):
                print(f"  rivers: {entry['name']} fully outside the basin share, skipped")
                continue
            sys.exit(f"FAIL rivers: {entry['name']} empty after basin clip")
        lines = []
        if clipped.geom_type == "LineString":
            lines = [list(clipped.coords)]
        elif clipped.geom_type in ("MultiLineString", "GeometryCollection"):
            lines = [list(g.coords) for g in clipped.geoms if g.geom_type == "LineString"]
        lines = [[(x, y) for x, y, *_ in l] for l in lines if len(l) >= 2]
        geom = line_geometry(merged_lines(lines), riv_cfg.get("simplifyEps", 0.0005))
        km = sum(hav_km(l) for l in (geom["coordinates"] if geom["type"] == "MultiLineString" else [geom["coordinates"]]))
        feats.append({"type": "Feature", "geometry": geom, "properties": {
            "riverId": entry["name"].lower().replace(" ", "-"),
            "name": entry["name"], "kind": entry.get("kind", "tributary"),
            "lengthKm": round(km, 1),
        }})
        print(f"  rivers: {entry['name']} {km:.0f} km in-basin")
    emit("rivers", feats, riv_cfg["provenance"])

    # 4. Full-basin context outline.
    ctx_cfg = cfg["contextBoundary"]
    polys = []
    for _, kind, parts in read_layer(src_dir / ctx_cfg["gpkg"], ctx_cfg["layer"]):
        if kind != "poly":
            sys.exit("context boundary is not polygonal")
        for rings in parts:
            polys.append(Polygon(rings[0], rings[1:]))
    geom = unary_union(polys).simplify(ctx_cfg.get("simplifyEps", 0.002), preserve_topology=True)
    if geom.geom_type == "Polygon":
        geom = MultiPolygon([geom])
    emit("context-boundary", [{
        "type": "Feature", "geometry": rounded(mapping(geom)),
        "properties": {"name": ctx_cfg["name"], "role": "context"},
    }], ctx_cfg["provenance"])

    # 5. Patch the inventory (see the re-run note in the module docstring).
    inv_path = basin_dir / "inventory.json"
    inv = json.loads(inv_path.read_text())
    inv["families"].update(inv_updates)
    write_artifact(inv_path, inv, indent=1)
    print(f"updated {inv_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "scripts/basin-sources/cauvery-ka-paani.json")

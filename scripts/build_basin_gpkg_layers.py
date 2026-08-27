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
    state-boundary.geojson   the state outline the basin sits in, unclipped -
                             the frame, not a member of the basin's own layers
    waterbodies.geojson      major waterbody SURFACES from the partner's
                             India-WRIS register, clipped to the basin share
                             (the reservoir dots keep live storage; these
                             carry extent)
    city-footprint.geojson   a city boundary split by the basin divide, each
                             part carrying its own measured area and share

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
    escape hatch for layers the partner shipped empty);
  - a city footprint's parts must not overlap: the drains-here share is a
    ratio of measured areas, and overlapping parts would double-count ground.

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

from shapely import make_valid
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Polygon, mapping
from shapely.ops import linemerge, transform, unary_union

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


def poly_km2(geom) -> float:
    """Area in sq km via a local equirectangular projection about the shape's
    own centroid latitude. Over a single sub-basin-sized shape that is good to
    well under a percent, and it keeps this script free of a projection
    dependency (the module docstring's no-GDAL rule)."""
    lat0 = math.radians(geom.centroid.y)
    return transform(lambda x, y: (x * 111.320 * math.cos(lat0), y * 110.574), geom).area


def polygons_of(gpkg: Path, table: str):
    """Every polygon part of a layer, made valid. The partner exports carry
    self-intersecting rings (a side-location conflict in the waterbodies layer
    killed a plain intersection), so validity is repaired on read, not assumed."""
    parts = []
    for _, kind, rings_list in read_layer(gpkg, table):
        if kind != "poly":
            continue
        for rings in rings_list:
            parts.append(make_valid(Polygon(rings[0], rings[1:])))
    return parts


def as_multipolygon(geom, eps: float) -> dict:
    g = make_valid(geom).simplify(eps, preserve_topology=True)
    if g.geom_type == "Polygon":
        g = MultiPolygon([g])
    elif g.geom_type == "GeometryCollection":
        g = MultiPolygon([p for p in g.geoms if p.geom_type == "Polygon"])
    return rounded(mapping(g))


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
    review_dir = Path(cfg["reviewDir"]).expanduser() if cfg.get("reviewDir") else None

    def gpkg_of(section: dict) -> Path:
        """Sections read from the original delivery unless they name the later
        review package (from: "review") - the two arrived months apart and are
        not merged into one directory."""
        base = review_dir if section.get("from") == "review" else src_dir
        if base is None or not base.is_dir():
            sys.exit(f"reviewDir not found: {base} (needed by a from:'review' section)")
        return base / section["gpkg"]

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

    # 5. Karnataka state boundary - the administrative frame the basin sits in.
    #    Deliberately NOT clipped: the point of drawing it is the part that
    #    leaves the basin, above all the southern border the Cauvery crosses
    #    on its way into Tamil Nadu.
    sb_cfg = cfg.get("stateBoundary")
    if sb_cfg:
        geom = unary_union(polygons_of(gpkg_of(sb_cfg), sb_cfg["layer"]))
        if geom.is_empty:
            sys.exit(f"FAIL stateBoundary: {sb_cfg['layer']!r} has no polygon geometry")
        emit("state-boundary", [{
            "type": "Feature",
            "geometry": as_multipolygon(geom, sb_cfg.get("simplifyEps", 0.004)),
            "properties": {"name": sb_cfg["name"], "role": "context"},
        }], sb_cfg["provenance"])
        print(f"  state-boundary: {sb_cfg['name']}, {poly_km2(geom):,.0f} sq km")

    # 6. Major waterbodies, clipped to the basin share. These are the surfaces
    #    behind the reservoir dots: the dots carry live storage, the polygons
    #    carry extent, and the two are separate families on purpose.
    wb_cfg = cfg.get("waterbodies")
    if wb_cfg:
        gpkg = gpkg_of(wb_cfg)
        con = sqlite3.connect(gpkg)
        attrs = dict(con.execute(
            f'SELECT rowid, "{wb_cfg["nameAttr"]}" FROM "{wb_cfg["layer"]}"'))
        areas = dict(con.execute(
            f'SELECT rowid, "{wb_cfg["areaAttr"]}" FROM "{wb_cfg["layer"]}"'))
        con.close()
        min_ha = wb_cfg.get("minAreaHa", 0)
        feats, dropped_small, unnamed = [], 0, 0
        for fid, kind, rings_list in read_layer(gpkg, wb_cfg["layer"]):
            if kind != "poly":
                continue
            geom = make_valid(unary_union(
                [make_valid(Polygon(r[0], r[1:])) for r in rings_list]))
            if not geom.intersects(mask):
                continue
            area_ha = float(areas.get(fid) or 0)
            if area_ha < min_ha:
                dropped_small += 1
                continue
            clipped = make_valid(geom).intersection(mask)
            if clipped.is_empty:
                continue
            name = (attrs.get(fid) or "").strip() or None
            if name is None:
                unnamed += 1
            cx, cy = clipped.centroid.x, clipped.centroid.y
            feats.append({
                "type": "Feature",
                "geometry": as_multipolygon(clipped, wb_cfg.get("simplifyEps", 0.0002)),
                "properties": {
                    "name": name,
                    "areaHa": round(area_ha, 1),
                    "subBasin": sub_code_for(cx, cy),
                },
            })
        feats.sort(key=lambda f: -(f["properties"]["areaHa"] or 0))
        emit("waterbodies", feats, wb_cfg["provenance"])
        print(f"  waterbodies: {len(feats)} in-basin at >= {min_ha} ha "
              f"({dropped_small} below the threshold, {unnamed} unnamed in the register)")

    # 7. City footprint against the basin divide. Bengaluru is the reason this
    #    atlas exists and only part of it drains here; the split IS the point,
    #    so each part carries its own measured area and share.
    cf_cfg = cfg.get("cityFootprint")
    if cf_cfg:
        gpkg = gpkg_of(cf_cfg)
        parts = []
        for entry in cf_cfg["parts"]:
            geom = unary_union(polygons_of(gpkg, entry["layer"]))
            if geom.is_empty:
                sys.exit(f"FAIL cityFootprint: {entry['layer']!r} has no polygon geometry")
            parts.append((entry, geom))
        # The two parts must tile the city, not overlap it - otherwise the
        # share below would be arithmetic on double-counted ground.
        if len(parts) == 2:
            overlap = poly_km2(parts[0][1].intersection(parts[1][1]))
            if overlap > 1.0:
                sys.exit(f"FAIL cityFootprint: parts overlap by {overlap:.1f} sq km; "
                         "the drains-here share would be double-counted")
        total = sum(poly_km2(g) for _, g in parts)
        feats = []
        for entry, geom in parts:
            km2 = poly_km2(geom)
            feats.append({
                "type": "Feature",
                "geometry": as_multipolygon(geom, cf_cfg.get("simplifyEps", 0.0008)),
                "properties": {
                    "cityId": cf_cfg["cityId"],
                    "name": cf_cfg["name"],
                    "drains": entry["drains"],
                    "areaKm2": round(km2, 1),
                    "sharePct": round(100 * km2 / total, 1),
                },
            })
            print(f"  city-footprint: {cf_cfg['name']} drains={entry['drains']} "
                  f"{km2:,.0f} sq km ({100 * km2 / total:.1f}%)")
        emit("city-footprint", feats, cf_cfg["provenance"])

    # 8. Patch the inventory (see the re-run note in the module docstring).
    inv_path = basin_dir / "inventory.json"
    inv = json.loads(inv_path.read_text())
    inv["families"].update(inv_updates)
    write_artifact(inv_path, inv, indent=1)
    print(f"updated {inv_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "scripts/basin-sources/cauvery-ka-paani.json")

#!/usr/bin/env python3
"""Basin Atlas ingestion engine (see docs/specs/basin-atlas.md section 6).

Reads a partner ingest-manifest.json, reprojects every source to EPSG:4326,
maps the partner's columns onto our fixed layer-family contract, tags each
feature with its sub-hydroshed, simplifies, slices heavy families per shed for
on-demand loading, and emits minified GeoJSON + an inventory.json.

Generic: a new basin is a new manifest, not new code.

Usage:
    python3 scripts/ingest_basin.py docs/paani_data/ingest-manifest.json

GDAL: uses `ogr2ogr`/`ogrinfo` from PATH, or $OGR2OGR / $OGRINFO, or the
QGIS.app bundle if present (macOS). CSVs are parsed directly in Python.
"""

from __future__ import annotations

import csv
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Every family is tagged with its sub-hydroshed id (shedId) - so the map can
# scope it to a selected river and slice heavy ones per shed - EXCEPT these
# structural layers: the boundary and sheds define the frame, and rivers carry
# their shed mapping in the manifest (BasinRiver.subHydroshedIds).
NO_SHED_FAMILIES = {"boundary", "sub-hydrosheds", "rivers"}
NUMERIC_FIELDS = {"areaHa", "capacityMld"}
STYLE_LAYER = "layer_styles"


# ── GDAL discovery ──────────────────────────────────────────────────────────

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
OGRINFO = _find_tool("ogrinfo", "OGRINFO")


def _proj_env() -> dict:
    env = dict(os.environ)
    # QGIS bundles proj.db under Resources/qgis/proj on macOS.
    if "Contents/MacOS" in OGR2OGR:
        base = Path(OGR2OGR).parent.parent / "Resources"
        for cand in (base / "qgis" / "proj", base / "proj"):
            if (cand / "proj.db").exists():
                env["PROJ_LIB"] = str(cand)
                env["PROJ_DATA"] = str(cand)
                break
    return env


# ── geometry helpers (pure python; avoids shapely/geopandas) ─────────────────

def _rep_point(geom: dict) -> tuple[float, float] | None:
    """A representative point for shed tagging (not a true centroid)."""
    t, c = geom.get("type"), geom.get("coordinates")
    if not c:
        return None
    if t == "Point":
        return c[0], c[1]
    if t in ("LineString", "MultiPoint"):
        return tuple(c[len(c) // 2][:2])
    if t == "MultiLineString":
        part = c[0]
        return tuple(part[len(part) // 2][:2])
    if t == "Polygon":
        ring = c[0]
        return _ring_avg(ring)
    if t == "MultiPolygon":
        ring = c[0][0]
        return _ring_avg(ring)
    return None


def _ring_avg(ring: list) -> tuple[float, float] | None:
    pts = [p for p in ring if len(p) >= 2]
    if not pts:
        return None
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)


def _pt_in_ring(x: float, y: float, ring: list) -> bool:
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-15) + xi):
            inside = not inside
        j = i
    return inside


def _pt_in_geom(x: float, y: float, geom: dict) -> bool:
    t, c = geom.get("type"), geom.get("coordinates")
    if t == "Polygon":
        return _pt_in_ring(x, y, c[0])
    if t == "MultiPolygon":
        return any(_pt_in_ring(x, y, poly[0]) for poly in c)
    return False


# ── ogr / source reading ─────────────────────────────────────────────────────

def _list_layers(path: Path) -> list[str]:
    out = subprocess.run([OGRINFO, "-ro", "-q", str(path)], capture_output=True,
                         text=True, env=_proj_env()).stdout
    names = []
    for line in out.splitlines():
        # "1: LayerName (Geometry)"  ->  LayerName
        if ":" not in line:
            continue
        rest = line.split(":", 1)[1].strip()
        name = rest.rsplit(" (", 1)[0].strip() if rest.endswith(")") else rest
        if name and name != STYLE_LAYER:
            names.append(name)
    return names


def _read_vector(path: Path, layer: str | None, simplify: float | None) -> list[dict]:
    """Reproject one layer to 4326 GeoJSON via ogr2ogr and return its features."""
    tmpdir = tempfile.mkdtemp()
    tmp = os.path.join(tmpdir, "out.geojson")
    try:
        cmd = [OGR2OGR, "-f", "GeoJSON", "-t_srs", "EPSG:4326", "-dim", "XY",
               "-lco", "COORDINATE_PRECISION=5", tmp, str(path)]
        if layer:
            cmd.append(layer)
        if simplify:
            cmd[1:1] = ["-simplify", str(simplify)]
        r = subprocess.run(cmd, capture_output=True, text=True, env=_proj_env())
        if r.returncode != 0:
            sys.exit(f"ogr2ogr failed for {path.name} [{layer}]:\n{r.stderr}")
        with open(tmp) as fh:
            return json.load(fh).get("features", [])
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _read_csv_points(path: Path, lat_field: str, lng_field: str) -> list[dict]:
    feats = []
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            try:
                lat = float((row.get(lat_field) or "").strip())
                lng = float((row.get(lng_field) or "").strip())
            except (TypeError, ValueError):
                continue
            if not (lat and lng):
                continue
            feats.append({"type": "Feature",
                          "geometry": {"type": "Point", "coordinates": [round(lng, 5), round(lat, 5)]},
                          "properties": row})
    return feats


# ── property mapping ─────────────────────────────────────────────────────────

def _clean(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _map_props(raw: dict, src: dict) -> dict:
    out = {}
    for tgt, col in (src.get("fields") or {}).items():
        val = _clean(raw.get(col))
        if val is None:
            continue
        if tgt in NUMERIC_FIELDS:
            try:
                val = float(val)
            except ValueError:
                pass
        out[tgt] = val
    out.update(src.get("literal") or {})
    return out


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("usage: ingest_basin.py <manifest.json>")
    manifest = json.loads(Path(sys.argv[1]).read_text())
    src_dir = REPO / manifest["sourceDir"]
    out_dir = REPO / manifest["outDir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    slice_threshold = manifest.get("sliceThresholdBytes", 1_048_576)

    # Pass 1: load sub-hydroshed polygons first so we can tag every other layer.
    sheds: list[tuple[str, dict]] = []
    shed_src = next((s for s in manifest["sources"] if s["family"] == "sub-hydrosheds"), None)
    if shed_src:
        for f in _read_vector(src_dir / shed_src["file"], shed_src.get("layer"),
                              shed_src.get("simplify")):
            sid = _clean((f.get("properties") or {}).get(shed_src["fields"]["shedId"]))
            if sid and f.get("geometry"):
                sheds.append((sid, f["geometry"]))

    def tag_shed(geom: dict) -> str | None:
        rp = _rep_point(geom) if geom else None
        if not rp:
            return None
        for sid, sgeom in sheds:
            if _pt_in_geom(rp[0], rp[1], sgeom):
                return sid
        return None

    families: dict[str, list[dict]] = {}
    inventory_families: dict[str, dict] = {}
    skipped: list[dict] = []

    for src in manifest["sources"]:
        fam = src["family"]
        if src.get("skip"):
            skipped.append({"file": src["file"], "family": fam,
                            "kind": (src.get("literal") or {}).get("kind"),
                            "reason": src.get("skipReason", "")})
            continue

        path = src_dir / src["file"]
        if not path.exists():
            sys.exit(f"Missing source: {path}")

        # Resolve which layer(s) to read.
        if path.suffix.lower() == ".csv":
            raw_feats = _read_csv_points(path, src["latField"], src["lngField"])
        else:
            if src.get("allLayers"):
                layers = _list_layers(path)
            elif src.get("layer"):
                layers = [src["layer"]]
            else:
                layers = [None]
            raw_feats = []
            for lyr in layers:
                raw_feats += _read_vector(path, lyr, src.get("simplify"))

        bucket = families.setdefault(fam, [])
        n = 0
        for f in raw_feats:
            geom = f.get("geometry")
            if not geom:
                continue
            props = _map_props(f.get("properties") or {}, src)
            if fam not in NO_SHED_FAMILIES:
                sid = tag_shed(geom)
                if sid:
                    props["shedId"] = sid
            bucket.append({"type": "Feature", "geometry": geom, "properties": props})
            n += 1

        inv = inventory_families.setdefault(fam, {"featureCount": 0, "sources": []})
        inv["featureCount"] += n
        inv["sources"].append({
            "file": src["file"],
            "kind": (src.get("literal") or {}).get("kind"),
            "count": n,
            "provenance": src.get("provenance", ""),
        })

    # Write family files (+ per-shed slices for heavy families) and finish inventory.
    heavy_families = {s["family"] for s in manifest["sources"] if s.get("heavy")}
    for fam, feats in families.items():
        fc = {"type": "FeatureCollection", "features": feats}
        fpath = out_dir / f"{fam}.geojson"
        fpath.write_text(json.dumps(fc, separators=(",", ":")))
        inv = inventory_families[fam]
        inv["bytes"] = fpath.stat().st_size

        sliced = fam in heavy_families and inv["bytes"] > slice_threshold
        inv["sliced"] = sliced
        if sliced:
            sdir = out_dir / fam
            sdir.mkdir(exist_ok=True)
            by_shed: dict[str, list[dict]] = {}
            for f in feats:
                key = f["properties"].get("shedId") or "_unassigned"
                by_shed.setdefault(key, []).append(f)
            for key, sfeats in by_shed.items():
                (sdir / f"{key}.geojson").write_text(
                    json.dumps({"type": "FeatureCollection", "features": sfeats},
                               separators=(",", ":")))
            inv["shedKeys"] = sorted(by_shed)

    inventory = {
        "basinId": manifest["basinId"],
        "generatedFrom": str(Path(sys.argv[1]).name),
        "families": inventory_families,
        "skipped": skipped,
    }
    (out_dir / "inventory.json").write_text(json.dumps(inventory, indent=2))

    # Report.
    print(f"basin '{manifest['basinId']}' -> {out_dir.relative_to(REPO)}")
    for fam in sorted(inventory_families):
        inv = inventory_families[fam]
        kb = inv.get("bytes", 0) / 1024
        tag = " [sliced]" if inv.get("sliced") else ""
        print(f"  {fam:18} {inv['featureCount']:5} feats  {kb:8.1f} KB{tag}")
    if skipped:
        print("  skipped:", ", ".join(s["file"] for s in skipped))


if __name__ == "__main__":
    main()

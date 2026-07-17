#!/usr/bin/env python3
"""Basin OVERVIEW ingestion - the hierarchy layer above the deep-dive atlas
(see docs/specs/cauvery-basin-hierarchy.md).

Source ADAPTER + basin CONFIG -> fixed output contract under
public/data/basins/<basinId>/:

    boundary.geojson       the parent basin outline
    sub-basins.geojson     child sub-basin polygons (name, code, scoreboardKey)
    tanks.geojson          minor-irrigation tanks within the basin
    prs-stretches.geojson  polluted river stretches (with vintage labels)
    wq-stations.geojson    water-quality monitoring stations in-basin
    reservoirs.geojson     reservoir locations in-basin (liveId joins the
                           daily storage feed where scraped)
    streams.geojson        stream segments (best-effort; skipped if the
                           source attribution is unusable)
    scoreboard.json        per-sub-basin keyed metric map (value+asOf+source);
                           missing metrics stay missing - the UI renders
                           honest gaps, never fabricates
    inventory.json         counts + provenance for DataOnThisMap

Generic by construction: a new basin is a new config file (and, for a new
data source, a new adapter class) - shared types and the atlas component
never learn source-system ids.

Usage:
    python3 scripts/ingest_basin_overview.py scripts/basin-sources/cauvery-ka.json
"""

from __future__ import annotations

import json
import math
import ssl
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE  # kwris chain is incomplete; data is public


# ── geometry helpers (pure stdlib) ──────────────────────────────────────────

def _rdp(points: list, eps: float) -> list:
    """Douglas-Peucker simplification."""
    if len(points) < 3:
        return points
    ax, ay = points[0][0], points[0][1]
    bx, by = points[-1][0], points[-1][1]
    dmax, idx = 0.0, 0
    dx, dy = bx - ax, by - ay
    norm = math.hypot(dx, dy) or 1e-12
    for i in range(1, len(points) - 1):
        d = abs(dy * (points[i][0] - ax) - dx * (points[i][1] - ay)) / norm
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        left = _rdp(points[: idx + 1], eps)
        right = _rdp(points[idx:], eps)
        return left[:-1] + right
    return [points[0], points[-1]]


def simplify_geom(geom: dict, eps: float, precision: int = 5) -> dict:
    def ring(r):
        s = _rdp(r, eps) if eps > 0 else r
        out = [[round(x, precision), round(y, precision)] for x, y, *_ in s]
        return out if len(out) >= 4 or geom["type"] not in ("Polygon", "MultiPolygon") else [
            [round(x, precision), round(y, precision)] for x, y, *_ in r
        ]

    t = geom["type"]
    if t == "Point":
        x, y, *_ = geom["coordinates"]
        return {"type": t, "coordinates": [round(x, precision), round(y, precision)]}
    if t == "LineString":
        return {"type": t, "coordinates": ring(geom["coordinates"])}
    if t == "MultiLineString":
        return {"type": t, "coordinates": [ring(l) for l in geom["coordinates"]]}
    if t == "Polygon":
        return {"type": t, "coordinates": [ring(r) for r in geom["coordinates"]]}
    if t == "MultiPolygon":
        return {"type": t, "coordinates": [[ring(r) for r in poly] for poly in geom["coordinates"]]}
    return geom


def point_in_geom(lon: float, lat: float, geom: dict) -> bool:
    def in_ring(x, y, r):
        c, j = False, len(r) - 1
        for i in range(len(r)):
            xi, yi = r[i][0], r[i][1]
            xj, yj = r[j][0], r[j][1]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                c = not c
            j = i
        return c

    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return any(in_ring(lon, lat, p[0]) for p in polys)


# ── KWRIS adapter ───────────────────────────────────────────────────────────

class KwrisAdapter:
    """Karnataka WRIS open GeoServer. Quirks live here and nowhere else:
    WFS 1.0.0 (2.0.0 flips the EPSG:4326 axis order), no auth, *_KN fields
    are double-encoded Kannada mojibake (dropped), CQL string values may
    carry trailing whitespace in the source tables (space-insensitive
    matching is done client-side)."""

    def __init__(self, endpoint: str):
        self.endpoint = endpoint

    def fetch(self, type_name: str, cql: str | None = None, max_features: int | None = None) -> dict:
        params = {
            "service": "WFS",
            "version": "1.0.0",
            "request": "GetFeature",
            "typeName": type_name,
            "outputFormat": "application/json",
            # KWRIS mixes native CRSs per layer (some lon/lat, some UTM-43N
            # metres); force server-side reprojection so every geometry
            # arrives as WGS84 lon,lat (1.0.0 axis order).
            "srsName": "EPSG:4326",
        }
        if cql:
            params["CQL_FILTER"] = cql
        if max_features:
            params["maxFeatures"] = str(max_features)
        url = f"{self.endpoint}?{urllib.parse.urlencode(params)}"
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url, timeout=120, context=CTX) as r:
                    return json.load(r)
            except Exception as e:  # noqa: BLE001
                if attempt == 2:
                    raise SystemExit(f"KWRIS fetch failed for {type_name}: {e}")
                print(f"  retry {type_name} ({e})")
        return {}

    @staticmethod
    def clean_props(props: dict, keep: dict[str, str]) -> dict:
        """Map + rename source fields; drop everything else (incl. *_KN
        mojibake). keep = {sourceField: outField}. String values stripped."""
        out = {}
        for src, dst in keep.items():
            v = props.get(src)
            if isinstance(v, str):
                v = v.strip()
            if v not in (None, ""):
                out[dst] = v
        return out


ADAPTERS = {"kwris": KwrisAdapter}


# ── ingest ──────────────────────────────────────────────────────────────────

def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    cfg = json.loads(Path(sys.argv[1]).read_text())
    basin_id = cfg["basinId"]
    out_dir = REPO / "public" / "data" / "basins" / basin_id
    out_dir.mkdir(parents=True, exist_ok=True)
    adapter = ADAPTERS[cfg["adapter"]](cfg["endpoint"])
    today = date.today().isoformat()
    inventory: dict = {"basinId": basin_id, "generatedFrom": Path(sys.argv[1]).name,
                       "generatedOn": today, "families": {}}

    def emit(family: str, features: list, provenance: str, source_file: str):
        fc = {"type": "FeatureCollection", "features": features}
        fp = out_dir / f"{family}.geojson"
        fp.write_text(json.dumps(fc, separators=(",", ":"), ensure_ascii=False))
        inventory["families"][family] = {
            "featureCount": len(features),
            "sources": [{"file": source_file, "kind": None, "count": len(features),
                         "provenance": provenance}],
            "bytes": fp.stat().st_size,
            "sliced": False,
        }
        print(f"  {family}: {len(features)} features, {fp.stat().st_size//1024} KB")

    prov = cfg["provenance"]

    # 1. Basin boundary
    print("boundary…")
    b = cfg["boundary"]
    raw = adapter.fetch(b["typeName"], b.get("cql"))
    feats = [{"type": "Feature",
              "geometry": simplify_geom(f["geometry"], b.get("simplifyEps", 0.001)),
              "properties": {"name": cfg["displayName"]}}
             for f in raw["features"]]
    if not feats:
        raise SystemExit("boundary: 0 features - check the filter")
    boundary_geom = raw["features"][0]["geometry"]  # full precision for joins
    emit("boundary", feats, prov, b["typeName"])

    # 2. Sub-basins (geometry + names + scoreboardKey join)
    print("sub-basins…")
    sb = cfg["subBasins"]
    raw = adapter.fetch(sb["typeName"], sb.get("cql"))
    key_by_name = sb["scoreboardKeyByName"]
    sub_feats, sub_geoms = [], {}
    for f in raw["features"]:
        p = f["properties"]
        name = str(p.get(sb["nameField"], "")).strip()
        code = str(p.get(sb["codeField"], "")).strip()
        sk = key_by_name.get(name)
        if sk is None:
            print(f"  WARN: no scoreboardKey for sub-basin {name!r}")
        sub_geoms[code] = f["geometry"]
        sub_feats.append({
            "type": "Feature",
            "geometry": simplify_geom(f["geometry"], sb.get("simplifyEps", 0.0008)),
            "properties": {"name": name, "code": code,
                           **({"scoreboardKey": str(sk)} if sk is not None else {})},
        })
    emit("sub-basins", sub_feats, prov, sb["typeName"])

    def sub_key_for(lon: float, lat: float) -> str | None:
        for code, geom in sub_geoms.items():
            if point_in_geom(lon, lat, geom):
                return code
        return None

    # 3. Simple point/line families from config
    for fam in cfg.get("families", []):
        print(f"{fam['family']}…")
        try:
            raw = adapter.fetch(fam["typeName"], fam.get("cql"))
        except SystemExit as e:
            # best-effort family (e.g. the WAF blocks some filters): warn, skip
            print(f"  WARN: {fam['family']} skipped - {e}")
            continue
        feats = []
        for f in raw["features"]:
            props = adapter.clean_props(f["properties"], fam["keep"])
            # Some KWRIS layers serve projected-metre geometry but clean
            # decimal-degree Latitude/Longitude properties - rebuild the point.
            if fam.get("pointFromProps"):
                pf = fam["pointFromProps"]
                try:
                    lat = float(f["properties"].get(pf["lat"]))
                    lon = float(f["properties"].get(pf["lon"]))
                except (TypeError, ValueError):
                    continue
                f = {**f, "geometry": {"type": "Point", "coordinates": [lon, lat]}}
            if f.get("geometry") is None:
                continue
            g = f["geometry"]
            if fam.get("clipToBasin"):
                # point families: keep only in-basin features
                if g["type"] == "Point":
                    lon, lat = g["coordinates"][0], g["coordinates"][1]
                    if not point_in_geom(lon, lat, boundary_geom):
                        continue
                    code = sub_key_for(lon, lat)
                    if code:
                        props["subBasin"] = code
            if fam.get("static"):
                props.update(fam["static"])
            # config-declared value mapping (e.g. KWRIS ReservoirID -> the
            # daily-feed source code) - keeps source ids out of components
            if fam.get("valueMap"):
                vm = fam["valueMap"]
                mapped = vm["map"].get(str(props.get(vm["field"], "")))
                if mapped is not None:
                    props[vm["out"]] = mapped
            feats.append({"type": "Feature",
                          "geometry": simplify_geom(g, fam.get("simplifyEps", 0)),
                          "properties": props})
        # client-side attribute filters - the KWRIS WAF blocks LIKE-CQL, and
        # source strings carry stray whitespace, so match here instead
        if fam.get("clientFilter"):
            cf = fam["clientFilter"]
            feats = [f for f in feats
                     if str(f["properties"].get(cf["field"], "")).strip().lower() == cf["equals"].lower()]
        if fam.get("clientContains"):
            cc = fam["clientContains"]
            feats = [f for f in feats
                     if cc["contains"].lower() in str(f["properties"].get(cc["field"], "")).lower()]
        emit(fam["family"], feats, fam.get("provenance", prov), fam["typeName"])

    # 4. Scoreboard: keyed per-sub-basin metric map
    print("scoreboard…")
    sc = cfg["scoreboard"]
    board: dict[str, dict] = {str(v): {"name": k, "metrics": {}}
                              for k, v in key_by_name.items()}
    for metric in sc["metrics"]:
        raw = adapter.fetch(metric["typeName"], metric.get("cql"))
        for f in raw["features"]:
            p = f["properties"]
            key = str(p.get(metric["keyField"], "")).strip()
            val = p.get(metric["valueField"])
            if key in board and val is not None:
                board[key]["metrics"][metric["name"]] = {
                    "value": val, "unit": metric.get("unit"),
                    "asOf": today, "source": metric.get("source", prov),
                    "verified": False,  # M4 flips this after semantics check
                }
    # tank + station counts per sub-basin from the emitted files
    for count_fam, metric_name in (sc.get("countFamilies") or {}).items():
        fp = out_dir / f"{count_fam}.geojson"
        if not fp.exists():
            continue
        fc = json.loads(fp.read_text())
        by_code: dict[str, int] = {}
        for f in fc["features"]:
            code = f["properties"].get("subBasin")
            if code:
                by_code[code] = by_code.get(code, 0) + 1
        code_to_key = {}
        for sf in sub_feats:
            c, k = sf["properties"].get("code"), sf["properties"].get("scoreboardKey")
            if c and k:
                code_to_key[c] = k
        for code, n in by_code.items():
            k = code_to_key.get(code)
            if k in board:
                board[k]["metrics"][metric_name] = {
                    "value": n, "unit": "count", "asOf": today,
                    "source": prov, "verified": True,
                }
    (out_dir / "scoreboard.json").write_text(json.dumps(
        {"asOf": today, "subBasins": board}, indent=1, ensure_ascii=False))
    print(f"  scoreboard: {len(board)} sub-basins")

    (out_dir / "inventory.json").write_text(json.dumps(inventory, indent=1, ensure_ascii=False))
    print("inventory written. Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

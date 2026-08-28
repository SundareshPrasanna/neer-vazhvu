#!/usr/bin/env python3
"""Build the Restoration Register spine for a city (M1).

One record per water body with a stable id, a crosswalk to every other id the body
carries, and the fixed footprint every encroachment indicator is computed inside.
Everything downstream (the screen, the diagnose tier, the edition files) keys off
this file; nothing downstream re-derives a footprint or a match.

Inputs (all committed, except the raster cache which is re-downloadable):
  public/geojson/<city>-water-bodies-current.geojson   OSM polygons (mapped footprint)
  public/geojson/<city>-rivers.geojson                  river lines, for the river-section filter
  public/data/register/<city>-census-extract.json       Census of Water Bodies rows (--fetch-census
                                                        pulls them once from the served table)
  public/data/cascade/<city>-cascade-lakes.geojson      cascade nodes, joined by osm_id (reference only;
                                                        the numbers stay in that file with its own licence)
  src/lib/water-bodies/rich-body-registry.ts            legal boundaries (gazetted / FTL) where declared
  .cache/register/<city>-jrc-gsw-30m.tif                JRC GSW v1.4 max_extent + occurrence, 30 m,
                                                        downloaded from Earth Engine when absent

Geometries per body: mapped (OSM), legal (gazette or FTL, where one exists), observed
(the JRC maximum-extent component touching the mapped polygon, clipped to a buffer
of it), and the FIXED FOOTPRINT = union of legal, mapped and observed. Measuring
encroachment inside the mapped polygon alone reports a fill-in as zero once a mapper
redraws the edge; the union keeps the extent the body once had.

Output:
  public/data/register/<city>-spine.geojson   FeatureCollection, one feature per body,
                                              geometry = fixed footprint (Point for census-only
                                              bodies), NVDM envelope on the file

Usage:
  neer-vazhvu-api/.venv/bin/python scripts/build_register_spine.py --city chennai --fetch-census --check
  neer-vazhvu-api/.venv/bin/python scripts/build_register_spine.py --city chennai --check
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
from datetime import date
from pathlib import Path

import numpy as np
import rasterio
from rasterio import features as rfeatures
from rasterio.windows import from_bounds
from shapely.geometry import Point, mapping, shape
from shapely.ops import transform as shp_transform
from shapely.ops import unary_union
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

REG_DIR = ROOT / "public/data/register"
CACHE = ROOT / ".cache/register"
REGISTRY_TS = ROOT / "src/lib/water-bodies/rich-body-registry.ts"

RIVER_TYPES = {"river", "canal", "drain", "ditch"}
INFRA_TYPES = {"wastewater"}
RIVER_NEAR_M = 50.0
RIVER_ASPECT = 3.5
CENSUS_MATCH_M = 200.0
TREND_FLOOR_30M_HA = 9.0     # 100 valid JRC pixels (calibration, M0)
TREND_FLOOR_10M_HA = 2.0
PRESENCE_FLOOR_HA = 0.25
OBSERVED_MIN_HA = 2.0        # below this the 30 m record is a blob, not a footprint
OBSERVED_OCCURRENCE_PCT = 20 # water in at least a fifth of valid observations: recurrent extent, not a flood year
OBSERVED_MAX_GROWTH = 3.0    # fixed/mapped above this is an adjacent water body, not this one: drop and flag
RIVER_NAME_RX = re.compile(r"\b(river|aaru|aru|canal|kalvai|drain|odai|nadi|creek|backwater)\b", re.I)
INFRA_NAME_RX = re.compile(r"\b(thermal|power station|power plant|fly ?ash|ash pond|cooling|effluent|treatment plant|stp|cetp|salt pan|saltpan)\b", re.I)

SIZE_CLASSES = [(0.4, "under 0.4"), (2, "0.4-2"), (10, "2-10"), (50, "10-50"), (100, "50-100"), (200, "100-200")]

CENSUS_FIELDS = (
    "id,census_code,name,water_body_type,nature,ownership,latitude,longitude,"
    "storage_capacity_original,storage_capacity_present,storage_loss_pct,max_depth_m,"
    "water_spread_area,construction_year,renovation_year,basin,sub_basin,is_in_use,"
    "encroachment_status,encroachment_pct,ward_name,village,taluk,block,district"
)


# ------------------------------------------------------------------ geometry helpers
def metre_transforms(lat0: float):
    """Local equirectangular metres at latitude lat0; adequate for buffers and areas
    at city scale (under 1% at 13 N over a 1 km buffer)."""
    kx, ky = 111320.0 * math.cos(math.radians(lat0)), 110574.0

    def fwd(x, y, z=None):
        return (x * kx, y * ky)

    def inv(x, y, z=None):
        return (x / kx, y / ky)

    return fwd, inv


def area_ha(geom, lat0: float) -> float:
    fwd, _ = metre_transforms(lat0)
    return round(shp_transform(fwd, geom).area / 10000, 2)


def buffer_m(geom, metres: float, lat0: float):
    fwd, inv = metre_transforms(lat0)
    return shp_transform(inv, shp_transform(fwd, geom).buffer(metres))


def distance_m(a, b, lat0: float) -> float:
    fwd, _ = metre_transforms(lat0)
    return shp_transform(fwd, a).distance(shp_transform(fwd, b))


def size_class(ha: float) -> str:
    for cut, label in SIZE_CLASSES:
        if ha < cut:
            return label
    return "over 200"


def valid(geom):
    """OSM rings self-touch and raster shapes share edges; make every input valid
    before any union so a topology fault cannot abort a city build."""
    if geom.is_valid:
        return geom
    g = make_valid(geom)
    if g.geom_type == "GeometryCollection":
        polys = [x for x in g.geoms if x.geom_type in ("Polygon", "MultiPolygon")]
        g = unary_union(polys) if polys else g.buffer(0)
    return g


def round_geom(geom, nd=6):
    return shape(json.loads(json.dumps(mapping(geom)), parse_float=lambda s: round(float(s), nd)))


def stable_id(city: str, system: str, ident: str) -> str:
    return "nvwb-" + hashlib.sha1(f"{city}|{system}|{ident}".encode()).hexdigest()[:10]


# ------------------------------------------------------------------ inputs
def load_fc(path: Path) -> dict:
    return json.loads(path.read_text())


def fetch_census(city: str) -> list[dict]:
    """One read of the served census table; the extract is then committed and the
    build never touches the network again for it."""
    import requests
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env.local")
    url, key = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"), os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not (url and key):
        sys.exit("--fetch-census needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local")
    r = requests.get(
        f"{url}/rest/v1/water_bodies_census",
        params={"select": CENSUS_FIELDS, "order": "id"},
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Range": "0-9999"},
        timeout=120,
    )
    r.raise_for_status()
    rows = r.json()
    if city != "chennai":
        sys.exit("the served census table holds Chennai district only; other cities need their own loader")
    return rows


def write_census_extract(city: str, rows: list[dict]) -> Path:
    path = REG_DIR / f"{city}-census-extract.json"
    payload = {
        "nvdm": "1.0",
        "dataset": "register/census-extract",
        "scope": {"kind": "city", "id": city},
        "provenance": {
            "sources": [{
                "id": "datagovin-waterbodies-census-tn",
                "title": "First Census of Water Bodies (2018-19), Tamil Nadu state file, Chennai district rows",
                "publisher": "Ministry of Jal Shakti, via data.gov.in",
                "license": registry_license("datagovin-waterbodies-census-tn"),
                "role": "input",
            }],
            "method": "api",
            "produced_at": date.today().isoformat(),
            "note": "One read of the served water_bodies_census table (lineage: Supabase, loaded 2026-03-26 from the data.gov.in state resource); committed so the register spine rebuilds from the repo alone.",
        },
        "row_count": len(rows),
        "rows": rows,
    }
    REG_DIR.mkdir(parents=True, exist_ok=True)
    # This producer authors its own envelope; drop the previous file so the
    # preserve-if-present merge does not carry an older provenance forward.
    path.unlink(missing_ok=True)
    write_artifact(path, payload, compact=True)
    return path


def registry_bodies(city: str) -> dict[int, dict]:
    """osm_id -> {id, name, polygon_path, boundary_source, legal, osm_ecological_path}
    for every rich-body registry entry of this city. `legal` is true when the primary
    polygon is a gazette, FTL or survey boundary rather than the OSM mapper's line."""
    if not REGISTRY_TS.exists():
        return {}
    txt = REGISTRY_TS.read_text()
    out = {}
    for m in re.finditer(r'\bid:\s*"([a-z0-9-]+)",\s*osm_id:\s*(\d+),(.*?)\bcity_id:\s*"([a-z]+)",(.*?)\bpolygon_path:\s*"([^"]+)"', txt, re.S):
        rid, osm_id, body_city, head, path = m.group(1), int(m.group(2)), m.group(4), m.group(3) + m.group(5), m.group(6)
        if body_city != city:
            continue
        src = re.search(r'boundary_source:\s*"([^"]+)"', head)
        eco = re.search(r'osm_ecological_path:\s*"([^"]+)"', head)
        name = re.search(r'\bname:\s*"([^"]+)"', head)
        src = src.group(1) if src else "OpenStreetMap"
        out[osm_id] = {"id": rid, "name": name.group(1) if name else rid, "polygon_path": path, "boundary_source": src,
                       "legal": bool(re.search(r"gazett|tnswa|ftl|full tank|survey|notified", src, re.I)),
                       "osm_ecological_path": eco.group(1) if eco else None}
    return out


def load_polygon(rel: str):
    fc = load_fc(ROOT / "public" / rel.lstrip("/"))
    if fc.get("features"):
        return valid(unary_union([valid(shape(x["geometry"])) for x in fc["features"]]))
    return valid(shape(fc["geometry"]))


def jrc_raster(city: str, bounds) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{city}-jrc-gsw-30m.tif"
    if path.exists():
        return path
    import requests
    from dotenv import load_dotenv

    import ee

    load_dotenv(ROOT / "neer-vazhvu-api" / ".env")
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    creds = ee.ServiceAccountCredentials(json.load(open(key_file))["client_email"], key_file=key_file)
    ee.Initialize(credentials=creds, project=os.environ["GEE_CLOUD_PROJECT"])
    w, s, e, n = bounds
    bbox = ee.Geometry.Rectangle([w, s, e, n])
    img = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select(["max_extent", "occurrence"]).unmask(0).clip(bbox).toUint8()
    url = img.getDownloadURL({"region": bbox, "scale": 30, "crs": "EPSG:4326", "format": "GEO_TIFF"})
    r = requests.get(url, timeout=900)
    r.raise_for_status()
    path.write_bytes(r.content)
    return path


# ------------------------------------------------------------------ river-section filter
def river_vertex_index(rivers_fc: dict, lat0: float):
    fwd, _ = metre_transforms(lat0)
    pts = []
    for f in rivers_fc.get("features", []):
        g = f.get("geometry") or {}
        lines = g.get("coordinates", [])
        if g.get("type") == "LineString":
            lines = [lines]
        elif g.get("type") != "MultiLineString":
            continue
        for line in lines:
            for x, y in line:
                pts.append(fwd(x, y))
    return np.array(pts) if pts else np.zeros((0, 2))


def river_section_reason(props: dict, geom, river_pts, lat0: float) -> str | None:
    """Port of the filter the Chennai scorer used, so the register drops the same
    river reaches and estuaries it did, for the same stated reasons."""
    wtype = (props.get("water_type") or "").lower()
    if wtype in INFRA_TYPES:
        return f"infrastructure: typed {wtype}"
    if props.get("name") and INFRA_NAME_RX.search(props["name"]):
        return "infrastructure: named as a plant pond, ash pond, cooling or treatment reservoir, or salt pan"
    if wtype in RIVER_TYPES:
        return f"river-section: typed {wtype}"
    name = props.get("name") or ""
    area = props.get("area_ha") or 0
    if name and RIVER_NAME_RX.search(name):
        return "river-section: named as a river or canal"
    if name or area < 20:
        return None
    if wtype == "water" and area > 200:
        return "river-section: unnamed water over 200 ha (floodplain or estuary)"
    minx, miny, maxx, maxy = geom.bounds
    ratio = max(maxx - minx, maxy - miny) / max(min(maxx - minx, maxy - miny), 1e-4)
    if ratio > RIVER_ASPECT:
        return f"river-section: unnamed, elongated (aspect {ratio:.1f})"
    if len(river_pts):
        fwd, _ = metre_transforms(lat0)
        ring = geom.exterior.coords if geom.geom_type == "Polygon" else list(geom.geoms)[0].exterior.coords
        for x, y in list(ring)[:20]:
            px, py = fwd(x, y)
            d = np.min(np.hypot(river_pts[:, 0] - px, river_pts[:, 1] - py))
            if d < RIVER_NEAR_M:
                return "river-section: unnamed, touches a river line"
    return None


# ------------------------------------------------------------------ observed extent
def observed_extent(mapped, ds, lat0: float):
    """JRC recurrent-water components (occurrence at or above OBSERVED_OCCURRENCE_PCT
    of valid observations, 1984-2021) that touch the mapped polygon, clipped to a
    buffer of it. Occurrence rather than max_extent so a single flood year does not
    become the footprint; a filled tank that held water for a fifth of the record
    still counts. Returns (geometry or None, buffer metres)."""
    eq_r = math.sqrt(shp_transform(metre_transforms(lat0)[0], mapped).area / math.pi)
    buf_m = float(min(300.0, max(60.0, 0.5 * eq_r)))
    zone = buffer_m(mapped, buf_m, lat0)
    w, s, e, n = zone.bounds
    try:
        win = from_bounds(w, s, e, n, ds.transform)
    except Exception:
        return None, buf_m
    win = win.round_offsets().round_lengths()
    if win.width < 1 or win.height < 1:
        return None, buf_m
    arr = ds.read(2, window=win)  # band 2 = occurrence (%)
    wet = arr >= OBSERVED_OCCURRENCE_PCT
    if not wet.any():
        return None, buf_m
    tr = ds.window_transform(win)
    parts = []
    for geom_json, val in rfeatures.shapes(wet.astype(np.uint8), mask=wet, transform=tr):
        g = valid(shape(geom_json))
        if g.intersects(mapped):
            parts.append(g)
    if not parts:
        return None, buf_m
    obs = unary_union(parts).intersection(zone)
    return (obs if not obs.is_empty else None), buf_m


# ------------------------------------------------------------------ build
def build(city: str, fetch: bool) -> tuple[dict, dict]:
    osm_fc = load_fc(ROOT / f"public/geojson/{city}-water-bodies-current.geojson")
    rivers_fc = load_fc(ROOT / f"public/geojson/{city}-rivers.geojson") if (ROOT / f"public/geojson/{city}-rivers.geojson").exists() else {"features": []}
    cascade_path = ROOT / f"public/data/cascade/{city}-cascade-lakes.geojson"
    cascade_ids = set()
    if cascade_path.exists():
        cascade_ids = {int(f["properties"]["osm_id"]) for f in load_fc(cascade_path)["features"] if f["properties"].get("osm_id") is not None}
    census_path = REG_DIR / f"{city}-census-extract.json"
    if fetch or not census_path.exists():
        write_census_extract(city, fetch_census(city))
    census_rows = load_fc(census_path)["rows"]
    registry = registry_bodies(city)
    legal = {k: v for k, v in registry.items() if v["legal"]}

    feats = osm_fc["features"]
    all_geoms = [valid(shape(f["geometry"])) for f in feats]
    minx = min(g.bounds[0] for g in all_geoms)
    miny = min(g.bounds[1] for g in all_geoms)
    maxx = max(g.bounds[2] for g in all_geoms)
    maxy = max(g.bounds[3] for g in all_geoms)
    lat0 = (miny + maxy) / 2
    river_pts = river_vertex_index(rivers_fc, lat0)
    raster = jrc_raster(city, (minx - 0.02, miny - 0.02, maxx + 0.02, maxy + 0.02))

    out, stats = [], {"osm_in": len(feats), "excluded": 0, "observed": 0, "legal": 0, "cascade": 0,
                      "census_rows": len(census_rows), "census_matched_pip": 0, "census_matched_near": 0, "census_only": 0,
                      "tiers": {}}
    bodies = []  # (feature dict, fixed geom) for census matching
    seen_registry: set[int] = set()
    with rasterio.open(raster) as ds:
        for f, mapped in zip(feats, all_geoms):
            p = f["properties"]
            osm_id = int(p["osm_id"])
            reason = river_section_reason(p, mapped, river_pts, lat0)
            anchor = {"system": "osm", "id": f"{p.get('osm_type', 'way')}/{osm_id}"}
            nv_id = stable_id(city, "osm", anchor["id"])
            crosswalk = [{"system": "osm", "id": str(osm_id), "osm_type": p.get("osm_type"), "method": "exact", "quality": "high"},
                         {"system": "legacy-priority", "id": f"osm:{osm_id}", "method": "exact", "quality": "high"}]
            if osm_id in cascade_ids:
                crosswalk.append({"system": "cascade", "id": str(osm_id), "file": f"public/data/cascade/{city}-cascade-lakes.geojson", "method": "exact", "quality": "high"})
                stats["cascade"] += 1
            if osm_id in registry:
                crosswalk.append({"system": "rich-body", "id": registry[osm_id]["id"], "method": "exact", "quality": "high"})
                seen_registry.add(osm_id)
            mapped_ha = area_ha(mapped, lat0)
            if reason:
                stats["excluded"] += 1
                out.append({"type": "Feature", "geometry": mapping(round_geom(mapped)), "properties": {
                    "nv_wb_id": nv_id, "city_id": city, "name": p.get("name") or None, "name_ta": p.get("name_ta") or None,
                    "water_type": p.get("water_type"), "status": "excluded:" + reason.split(":")[0], "exclusion_reason": reason,
                    "anchor": anchor, "crosswalk": crosswalk, "mapped_area_ha": mapped_ha, "fixed_area_ha": mapped_ha,
                    "geometry_kind": "mapped", "tier_hint": "excluded"}})
                continue

            geoms, sources = [mapped], {"mapped": "osm-overpass"}
            legal_g = None
            if osm_id in legal and (ROOT / "public" / legal[osm_id]["polygon_path"].lstrip("/")).exists():
                legal_g = load_polygon(legal[osm_id]["polygon_path"])
                geoms.append(legal_g)
                sources["legal"] = legal[osm_id]["boundary_source"]
                stats["legal"] += 1
            obs, buf_m, obs_flag = None, None, None
            if mapped_ha >= OBSERVED_MIN_HA:
                obs, buf_m = observed_extent(mapped, ds, lat0)
                if obs is not None:
                    trial = valid(unary_union([valid(g) for g in geoms + [obs]]))
                    if area_ha(trial, lat0) > OBSERVED_MAX_GROWTH * mapped_ha:
                        obs_flag = f"observed extent dropped: union over {OBSERVED_MAX_GROWTH:.0f}x the mapped area (adjacent water body); review"
                        stats["observed_dropped"] = stats.get("observed_dropped", 0) + 1
                        obs = None
                    else:
                        geoms.append(obs)
                        sources["observed"] = f"jrc-global-surface-water:occurrence>={OBSERVED_OCCURRENCE_PCT}"
                        stats["observed"] += 1
            fixed = valid(unary_union([valid(g) for g in geoms]))
            fixed_ha = area_ha(fixed, lat0)
            floors = {"trend_30m": fixed_ha >= TREND_FLOOR_30M_HA, "trend_10m": fixed_ha >= TREND_FLOOR_10M_HA, "presence_10m": fixed_ha >= PRESENCE_FLOOR_HA}
            tier = "T1-L" if floors["trend_10m"] else ("T1-S" if floors["presence_10m"] else "T0")
            stats["tiers"][tier] = stats["tiers"].get(tier, 0) + 1
            props = {
                "nv_wb_id": nv_id, "city_id": city, "name": p.get("name") or None, "name_ta": p.get("name_ta") or None,
                "water_type": p.get("water_type"), "status": "active", "anchor": anchor, "crosswalk": crosswalk,
                "geometry_kind": "fixed-footprint", "geometry_sources": sources,
                "mapped_area_ha": mapped_ha, "legal_area_ha": area_ha(legal_g, lat0) if legal_g is not None else None,
                "observed_area_ha": area_ha(obs, lat0) if obs is not None else None, "observed_buffer_m": buf_m,
                "fixed_area_ha": fixed_ha, "size_class": size_class(fixed_ha), "floors": floors, "tier_hint": tier,
                "observed_flag": obs_flag,
            }
            feat = {"type": "Feature", "geometry": mapping(round_geom(fixed)), "properties": props}
            out.append(feat)
            bodies.append((feat, fixed))

    # registry bodies the OSM water-body file does not carry (a Ramsar marsh mapped as
    # wetland, not water): the registry polygon is the mapped or legal footprint
    with rasterio.open(raster) as ds:
        for osm_id, rb in registry.items():
            if osm_id in seen_registry or not (ROOT / "public" / rb["polygon_path"].lstrip("/")).exists():
                continue
            primary = load_polygon(rb["polygon_path"])
            geoms, sources = [primary], {"legal" if rb["legal"] else "mapped": rb["boundary_source"]}
            if rb["osm_ecological_path"] and (ROOT / "public" / rb["osm_ecological_path"].lstrip("/")).exists():
                geoms.append(load_polygon(rb["osm_ecological_path"]))
                sources["mapped"] = "osm-overpass (ecological boundary)"
            mapped_ha = area_ha(primary, lat0)
            obs, buf_m = observed_extent(primary, ds, lat0)
            if obs is not None:
                geoms.append(obs)
                sources["observed"] = f"jrc-global-surface-water:occurrence>={OBSERVED_OCCURRENCE_PCT}"
                stats["observed"] += 1
            fixed = valid(unary_union([valid(g) for g in geoms]))
            fixed_ha = area_ha(fixed, lat0)
            floors = {"trend_30m": fixed_ha >= TREND_FLOOR_30M_HA, "trend_10m": fixed_ha >= TREND_FLOOR_10M_HA, "presence_10m": fixed_ha >= PRESENCE_FLOOR_HA}
            tier = "T1-L" if floors["trend_10m"] else ("T1-S" if floors["presence_10m"] else "T0")
            stats["tiers"][tier] = stats["tiers"].get(tier, 0) + 1
            stats["registry_only"] = stats.get("registry_only", 0) + 1
            if rb["legal"]:
                stats["legal"] += 1
            anchor = {"system": "rich-body", "id": rb["id"]}
            crosswalk = [{"system": "rich-body", "id": rb["id"], "method": "exact", "quality": "high"},
                         {"system": "osm", "id": str(osm_id), "osm_type": "relation", "method": "registry", "quality": "medium"}]
            if osm_id in cascade_ids:
                crosswalk.append({"system": "cascade", "id": str(osm_id), "file": f"public/data/cascade/{city}-cascade-lakes.geojson", "method": "exact", "quality": "high"})
            feat = {"type": "Feature", "geometry": mapping(round_geom(fixed)), "properties": {
                "nv_wb_id": stable_id(city, "rich-body", rb["id"]), "city_id": city, "name": rb["name"], "name_ta": None,
                "water_type": "wetland", "status": "active", "anchor": anchor, "crosswalk": crosswalk,
                "geometry_kind": "fixed-footprint", "geometry_sources": sources,
                "mapped_area_ha": mapped_ha, "legal_area_ha": mapped_ha if rb["legal"] else None,
                "observed_area_ha": area_ha(obs, lat0) if obs is not None else None, "observed_buffer_m": buf_m,
                "fixed_area_ha": fixed_ha, "size_class": size_class(fixed_ha), "floors": floors, "tier_hint": tier}}
            out.append(feat)
            bodies.append((feat, fixed))

    # census crosswalk: containing footprint first, then nearest within 200 m, else census-only
    for row in census_rows:
        if row.get("latitude") is None or row.get("longitude") is None:
            continue
        pt = Point(float(row["longitude"]), float(row["latitude"]))
        cid = str(row.get("census_code") or row["id"])
        hit, method, dist = None, None, None
        for feat, fixed in bodies:
            if fixed.contains(pt):
                hit, method, dist = feat, "point-in-polygon", 0.0
                break
        if hit is None:
            best = None
            for feat, fixed in bodies:
                if abs(fixed.centroid.x - pt.x) > 0.01 or abs(fixed.centroid.y - pt.y) > 0.01:
                    continue
                d = distance_m(pt, fixed, lat0)
                if d <= CENSUS_MATCH_M and (best is None or d < best[1]):
                    best = (feat, d)
            if best:
                hit, method, dist = best[0], "distance", round(best[1], 1)
        link = {"system": "census", "id": cid, "census_row_id": row["id"], "name": row.get("name"), "method": method,
                "quality": "high" if method == "point-in-polygon" else "medium", "distance_m": dist}
        if hit is not None:
            hit["properties"]["crosswalk"].append(link)
            hit["properties"]["crosswalk"].append({"system": "legacy-priority", "id": f"census:{row['id']}", "method": "exact", "quality": "high"})
            stats["census_matched_pip" if method == "point-in-polygon" else "census_matched_near"] += 1
        else:
            stats["census_only"] += 1
            nv_id = stable_id(city, "census", cid)
            out.append({"type": "Feature", "geometry": mapping(pt), "properties": {
                "nv_wb_id": nv_id, "city_id": city, "name": row.get("name"), "name_ta": None,
                "water_type": (row.get("water_body_type") or "").lower() or None, "status": "active",
                "anchor": {"system": "census", "id": cid},
                "crosswalk": [dict(link, method="anchor", quality="high", distance_m=None),
                              {"system": "legacy-priority", "id": f"census:{row['id']}", "method": "exact", "quality": "high"}],
                "geometry_kind": "point", "geometry_sources": {"point": "datagovin-waterbodies-census-tn"},
                "mapped_area_ha": None, "legal_area_ha": None, "observed_area_ha": None, "observed_buffer_m": None,
                "fixed_area_ha": row.get("water_spread_area"), "size_class": size_class(row.get("water_spread_area") or 0),
                "floors": {"trend_30m": False, "trend_10m": False, "presence_10m": False}, "tier_hint": "T0"}})
            stats["tiers"]["T0"] = stats["tiers"].get("T0", 0) + 1

    fc = {
        "nvdm": "1.0",
        "dataset": "register/spine",
        "scope": {"kind": "city", "id": city},
        "provenance": {
            "sources": [
                {"id": "osm-overpass", "title": "OpenStreetMap water-body polygons (Overpass extract): the mapped footprint", "publisher": "OpenStreetMap contributors", "license": registry_license("osm-overpass"), "role": "input"},
                {"id": "jrc-global-surface-water", "title": "JRC Global Surface Water v1.4 GlobalSurfaceWater occurrence, 30 m: the observed (recurrent) footprint", "publisher": "European Commission JRC (Pekel et al.)", "license": registry_license("jrc-global-surface-water"), "role": "input"},
                {"id": "datagovin-waterbodies-census-tn", "title": "First Census of Water Bodies, Chennai district rows (committed extract)", "publisher": "Ministry of Jal Shakti, via data.gov.in", "license": registry_license("datagovin-waterbodies-census-tn"), "role": "input"},
                {"id": "tnswa-ramsar-boundary", "title": "TNSWA gazetted Ramsar boundary (legal footprint where declared in the rich-body registry)", "publisher": "Tamil Nadu State Wetland Authority", "license": registry_license("tnswa-ramsar-boundary"), "role": "input"},
            ],
            "method": "derived",
            "produced_by": "scripts/build_register_spine.py",
            "produced_at": date.today().isoformat(),
            "note": ("Fixed footprint = union(legal, mapped, observed). Observed = JRC occurrence >= 20% components touching the mapped polygon, "
                     "clipped to a buffer of 0.5 x equivalent radius (60-300 m), computed only at or above 2 ha, dropped and flagged when the "
                     "union exceeds 3x the mapped area. River sections are kept "
                     "with status excluded:river-section and the reason. Cascade nodes are referenced by osm_id, not copied. "
                     "Halo = 1 km buffer of the fixed footprint minus the footprint, computed by consumers."),
        },
        "type": "FeatureCollection",
        "stats": stats,
        "features": out,
    }
    return fc, stats


def check(fc: dict) -> list[str]:
    errs = []
    ids = [f["properties"]["nv_wb_id"] for f in fc["features"]]
    if len(ids) != len(set(ids)):
        errs.append("duplicate nv_wb_id")
    st = fc["stats"]
    active_osm = sum(1 for f in fc["features"] if f["properties"]["anchor"]["system"] == "osm")
    if active_osm != st["osm_in"]:
        errs.append(f"osm features in {st['osm_in']} != out {active_osm}")
    if st["census_matched_pip"] + st["census_matched_near"] + st["census_only"] != st["census_rows"]:
        errs.append("census rows not all accounted for")
    for f in fc["features"]:
        p = f["properties"]
        if p["geometry_kind"] == "fixed-footprint" and (p["fixed_area_ha"] or 0) + 1e-6 < (p["mapped_area_ha"] or 0):
            errs.append(f"{p['nv_wb_id']}: fixed footprint smaller than mapped")
        if not f["geometry"] or not f["geometry"].get("coordinates"):
            errs.append(f"{p['nv_wb_id']}: empty geometry")
    return errs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True)
    ap.add_argument("--fetch-census", action="store_true", help="(re)read the served census table into the committed extract")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    fc, stats = build(args.city, args.fetch_census)
    REG_DIR.mkdir(parents=True, exist_ok=True)
    out = REG_DIR / f"{args.city}-spine.geojson"
    out.unlink(missing_ok=True)  # producer-owned envelope, see write_census_extract
    write_artifact(out, fc, compact=True)
    print(json.dumps(stats, indent=1))
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB, {len(fc['features'])} features)")
    if args.check:
        errs = check(fc)
        if errs:
            print("CHECK FAILED:\n  " + "\n  ".join(errs[:20]))
            return 1
        print("check OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Backfill REAL lake/tank names onto Bengaluru's OSM water-body polygons from
authoritative named open sources, by spatial join.

Why: ~80% of bangalore-water-bodies-current.geojson polygons come from OSM with
no name. The Jal Dharohar census carries no name field (only village/ward), and
Nominatim only yields locality guesses. We join named open sources onto our
polygons and write the name onto each currently-unnamed body they cover.

Sources, applied in priority order (all committed under scripts/data-raw/bangalore/):
  1. ATREE-CSEI    atree-csei-bengaluru-urban-rural-lakes.kmz  (polygon)
       "Map of Lakes in Bengaluru Urban and Rural Districts", via OpenCity, open.
       1,349 named polygons ("Jogi kere", "Ramayyanapalya Kere"). Canonical
       Bengaluru lake census - highest priority.
       https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area
  2. BBMP-Masterlist  opencity-bbmp-lakes-masterlist.kml       (polygon)
       BBMP lake masterlist via OpenCity, 181 named polygons inside BBMP limits.
  3. KGIS-MI-Tanks  kwris-mi-tanks-bengaluru.geojson           (point)
       Karnataka WRIS (KWRIS) GeoServer, layer KA:MI_Tanks - the state Minor
       Irrigation tank register, 328 named tank points in the Bengaluru bbox
       (3,419 statewide). Open WFS, no auth:
       https://water.karnataka.gov.in/geoserver/KA/ows  (KA:MI_Tanks). Snapshot
       fetched 2026-07-09. Point source: named when a tank point falls inside a
       still-unnamed OSM polygon (or within POINT_SNAP_M of it).

Polygon join (sources 1-2): reproject both layers to UTM 43N (EPSG:32643); for
each unnamed OSM polygon, pick the ref polygon with the largest overlap; accept
when IoU >= 0.2 (genuine mutual overlap) OR the OSM polygon is mostly inside the
ref AND covers a real chunk of it (overlap_frac >= 0.5 AND reverse_frac >= 0.2).
The reverse guard rejects the "small pond fully inside a big lake outline" case
(high overlap_frac but tiny IoU) that would smear one lake's name across several
distinct bodies - a wrong name is worse than a blank one. River-type ref names
are filtered out so we never relabel a tank with a river name.

Point join (source 3): a tank point inside an OSM polygon (point-in-polygon), or
within POINT_SNAP_M of it, transfers its name. Highest confidence is containment.

Provenance: each backfilled feature gets
  name              <- ref toponym
  name_source       = "ATREE-CSEI" | "BBMP-Masterlist" | "KGIS-MI-Tanks"
  name_match_iou    = <float>   (polygon sources: match confidence)
  name_match_m      = <float>   (point source: point-to-polygon distance, metres)
OSM-native names are never overwritten. Priority order means a higher source
wins; lower sources only fill what remains blank. Re-running clears every name
this script previously set (name_source in OUR_SOURCES) and re-derives, so it is
idempotent regardless of source order changes.

Run:
  python scripts/name-bangalore-water-bodies.py
  python scripts/name-bangalore-water-bodies.py --dry-run
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import pyproj
from shapely.geometry import MultiPolygon, Point, Polygon, shape
from shapely.ops import transform as shp_transform
from shapely.strtree import STRtree

from nvdm_write import write_artifact

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = REPO_ROOT / "scripts" / "data-raw" / "bangalore"
ATREE_KMZ = RAW_DIR / "atree-csei-bengaluru-urban-rural-lakes.kmz"
BBMP_KML = RAW_DIR / "opencity-bbmp-lakes-masterlist.kml"
MI_TANKS_GEOJSON = RAW_DIR / "kwris-mi-tanks-bengaluru.geojson"
OSM_GEOJSON = REPO_ROOT / "public" / "geojson" / "bangalore-water-bodies-current.geojson"
UTM_EPSG = 32643  # UTM 43N, metric CRS for Bengaluru
OUR_SOURCES = ("ATREE-CSEI", "BBMP-Masterlist", "KGIS-MI-Tanks")

KML_NS = {"k": "http://www.opengis.net/kml/2.2"}
# Ref names that are rivers/canals, not tanks: never relabel a tank with these.
_RIVER_NAME_RE = re.compile(r"river|canal|nala|nalla|halla|raja\s*kaluve|kaluve|stream|nadi", re.IGNORECASE)
# Container/heading placemarks that are not real toponyms.
_NON_NAME_RE = re.compile(r"^(BBMP_Lakes|Masterlist|Layer)\b", re.IGNORECASE)
# Polygon match acceptance thresholds.
IOU_MIN = 0.20           # genuine mutual overlap
OVERLAP_FRAC_MIN = 0.50  # OSM polygon mostly inside ref (intersection / OSM area)
REVERSE_FRAC_MIN = 0.20  # ...and covers a real chunk of ref (intersection / ref area)
# Point (MI_Tanks) snap distance: a tank point this close to a polygon counts.
POINT_SNAP_M = 15.0


def _rings_from_placemark(pm) -> list[Polygon]:
    rings: list[Polygon] = []
    for poly in pm.findall(".//k:Polygon", KML_NS):
        coords = poly.find(".//k:outerBoundaryIs//k:coordinates", KML_NS)
        if coords is None or not coords.text:
            continue
        pts = []
        for tok in coords.text.split():
            c = tok.split(",")
            if len(c) >= 2:
                pts.append((float(c[0]), float(c[1])))
        if len(pts) >= 3:
            rings.append(Polygon(pts))
    return rings


def _parse_kml_root(root) -> list[tuple[str, object]]:
    """Named polygons from a KML root element."""
    out: list[tuple[str, object]] = []
    for pm in root.findall(".//k:Placemark", KML_NS):
        nm_el = pm.find("k:name", KML_NS)
        name = (nm_el.text or "").strip() if nm_el is not None else ""
        if not name or _NON_NAME_RE.search(name) or _RIVER_NAME_RE.search(name):
            continue
        rings = _rings_from_placemark(pm)
        if rings:
            g = (rings[0] if len(rings) == 1 else MultiPolygon(rings)).buffer(0)
            if not g.is_empty:
                out.append((name, g))
    return out


def _parse_kmz_polys(kmz_path: Path) -> list[tuple[str, object]]:
    with zipfile.ZipFile(kmz_path) as z:
        doc = next(n for n in z.namelist() if n.endswith(".kml"))
        return _parse_kml_root(ET.fromstring(z.read(doc)))


def _parse_kml_polys(kml_path: Path) -> list[tuple[str, object]]:
    return _parse_kml_root(ET.fromstring(kml_path.read_text(encoding="utf-8")))


def _parse_mi_tank_points(geojson_path: Path) -> list[tuple[str, object]]:
    """Named tank points from the KWRIS MI_Tanks snapshot."""
    fc = json.loads(geojson_path.read_text(encoding="utf-8"))
    out: list[tuple[str, object]] = []
    for f in fc["features"]:
        name = (f["properties"].get("TankName") or "").strip()
        geom = f.get("geometry")
        if not name or _RIVER_NAME_RE.search(name) or not geom or geom["type"] != "Point":
            continue
        lon, lat = geom["coordinates"][0], geom["coordinates"][1]
        out.append((name, Point(lon, lat)))
    return out


def _available(props, taken) -> bool:
    """A feature can be named now if it is not already named this run AND it is
    either blank or holds a name this script itself set (re-derivable). OSM-native
    names are never touched."""
    if id(props) in taken:
        return False
    cur = (props.get("name") or "").strip()
    return not cur or props.get("name_source") in OUR_SOURCES


def _match_polygon_source(fc, ref, tree, ref_geoms, source, to_utm, taken) -> int:
    """Name still-unnamed OSM polygons from a polygon reference source."""
    filled = 0
    for f in fc["features"]:
        props = f["properties"]
        if not _available(props, taken):
            continue
        try:
            g = shp_transform(to_utm, shape(f["geometry"])).buffer(0)
        except Exception:
            continue
        if g.is_empty or g.area <= 0:
            continue
        best_idx, best_inter = None, 0.0
        for idx in tree.query(g):
            inter = g.intersection(ref_geoms[idx]).area
            if inter > best_inter:
                best_inter, best_idx = inter, idx
        if best_idx is None:
            continue
        rg = ref_geoms[best_idx]
        overlap_frac = best_inter / g.area
        reverse_frac = best_inter / rg.area if rg.area > 0 else 0.0
        union = g.area + rg.area - best_inter
        iou = best_inter / union if union > 0 else 0.0
        if iou >= IOU_MIN or (overlap_frac >= OVERLAP_FRAC_MIN and reverse_frac >= REVERSE_FRAC_MIN):
            props["name"] = ref[best_idx][0]
            props["name_source"] = source
            props["name_match_iou"] = round(iou, 3)
            props.pop("name_match_m", None)
            taken.add(id(props))
            filled += 1
    return filled


def _match_point_source(fc, pts, names, source, to_utm, taken) -> int:
    """Name still-unnamed OSM polygons from a point reference source
    (point-in-polygon, or within POINT_SNAP_M)."""
    upts = [shp_transform(to_utm, p) for p in pts]
    tree = STRtree(upts)
    filled = 0
    for f in fc["features"]:
        props = f["properties"]
        if not _available(props, taken):
            continue
        try:
            g = shp_transform(to_utm, shape(f["geometry"])).buffer(0)
        except Exception:
            continue
        if g.is_empty or g.area <= 0:
            continue
        best_idx, best_dist = None, None
        for idx in tree.query(g.buffer(POINT_SNAP_M)):
            d = g.distance(upts[idx])
            if best_dist is None or d < best_dist:
                best_dist, best_idx = d, idx
        if best_idx is not None and best_dist is not None and best_dist <= POINT_SNAP_M:
            props["name"] = names[best_idx]
            props["name_source"] = source
            props["name_match_m"] = round(best_dist, 1)
            props.pop("name_match_iou", None)
            taken.add(id(props))
            filled += 1
    return filled


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    to_utm = pyproj.Transformer.from_crs("EPSG:4326", f"EPSG:{UTM_EPSG}", always_xy=True).transform

    fc = json.loads(OSM_GEOJSON.read_text(encoding="utf-8"))

    # Names are (re)derived in place: a feature previously named by this script is
    # eligible again (see _available), and matching overwrites its existing name
    # keys without moving them, so re-runs keep the diff to just the changed names.
    # `taken` marks features named earlier in THIS run so a lower-priority source
    # never overrides a higher one. OSM-native names are never eligible.
    taken: set[int] = set()
    osm_native = sum(
        1 for f in fc["features"]
        if (f["properties"].get("name") or "").strip()
        and f["properties"].get("name_source") not in OUR_SOURCES
    )

    counts: dict[str, int] = {}

    # Source 1-2: polygon overlap (ATREE-CSEI, then BBMP-Masterlist).
    for source, polys in (
        ("ATREE-CSEI", _parse_kmz_polys(ATREE_KMZ)),
        ("BBMP-Masterlist", _parse_kml_polys(BBMP_KML)),
    ):
        ref = [(n, shp_transform(to_utm, g)) for n, g in polys]
        ref_geoms = [g for _, g in ref]
        tree = STRtree(ref_geoms)
        print(f"[name-blr] {source}: {len(ref)} named reference polygons (rivers filtered out)")
        counts[source] = _match_polygon_source(fc, ref, tree, ref_geoms, source, to_utm, taken)

    # Source 3: point-in-polygon (KGIS-MI-Tanks).
    mi = _parse_mi_tank_points(MI_TANKS_GEOJSON)
    print(f"[name-blr] KGIS-MI-Tanks: {len(mi)} named tank points")
    counts["KGIS-MI-Tanks"] = _match_point_source(
        fc, [p for _, p in mi], [n for n, _ in mi], "KGIS-MI-Tanks", to_utm, taken
    )

    # A feature we named on a previous run but that no longer matches any source
    # loses its derived name (keeps the layer honest, stays idempotent).
    for f in fc["features"]:
        props = f["properties"]
        if props.get("name_source") in OUR_SOURCES and id(props) not in taken:
            for k in ("name", "name_source", "name_match_iou", "name_match_m"):
                props.pop(k, None)

    total_named = sum(1 for f in fc["features"] if (f["properties"].get("name") or "").strip())
    n = len(fc["features"])
    print(f"[name-blr] OSM-native names: {osm_native} | backfilled: "
          + " ".join(f"{k}={v}" for k, v in counts.items()))
    print(f"[name-blr] total named: {total_named}/{n} ({100 * total_named // n}%)")
    if dry_run:
        print("[name-blr] --dry-run: not writing")
        return
    # Envelope-preserving write (scripts/nvdm_write.py): keeps the NVDM
    # envelope and advances produced_at; indent=2 matches the file's
    # existing pretty-print so the diff is the name fields, not a reformat.
    write_artifact(OSM_GEOJSON, fc)
    print(f"[name-blr] wrote {OSM_GEOJSON.name}")


if __name__ == "__main__":
    main()

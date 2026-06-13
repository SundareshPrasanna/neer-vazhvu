#!/usr/bin/env python3
"""
Backfill REAL lake/tank names onto Bengaluru's OSM water-body polygons from an
authoritative named source, by polygon-overlap spatial join.

Why: ~80% of bangalore-water-bodies-current.geojson polygons come from OSM with
no name. The Jal Dharohar census carries no name field (only village/ward), and
Nominatim only yields locality guesses. The ATREE/CSEI "Map of Lakes in
Bengaluru Urban and Rural Districts" (published open on OpenCity) is the
canonical Bengaluru lake census: 1,349 NAMED polygons with real toponyms
("Jogi kere", "Ramayyanapalya Kere"). We join it to our polygons and write the
name onto each currently-unnamed body it overlaps.

Source (committed under scripts/data-raw/bangalore/):
  atree-csei-bengaluru-urban-rural-lakes.kmz   (ATREE/CSEI via OpenCity, open)
  https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area

Join: reproject both layers to UTM 43N (EPSG:32643); for each unnamed OSM
polygon, pick the ref polygon with the largest overlap; accept when IoU >= 0.2
(genuine mutual overlap) OR the OSM polygon is mostly inside the ref AND covers
a real chunk of it (overlap_frac >= 0.5 AND reverse_frac >= 0.2). The reverse
guard is deliberate: it rejects the "small pond fully inside a big lake outline"
case (high overlap_frac but tiny IoU) that would otherwise smear one lake's name
across several distinct bodies - a wrong name is worse than a blank one. River-
type ref names are filtered out so we never relabel a tank with a river name.

Provenance: each backfilled feature gets
  name              <- ref toponym
  name_source       = "ATREE-CSEI"      (so honest-data provenance is visible)
  name_match_iou    = <float>           (match confidence, for audit/rerun)
OSM-native names are never overwritten. Re-running re-derives only the names we
previously set (name_source == "ATREE-CSEI"), so it is idempotent.

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
from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.ops import transform as shp_transform
from shapely.strtree import STRtree

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_KMZ = REPO_ROOT / "scripts" / "data-raw" / "bangalore" / "atree-csei-bengaluru-urban-rural-lakes.kmz"
OSM_GEOJSON = REPO_ROOT / "public" / "geojson" / "bangalore-water-bodies-current.geojson"
NAME_SOURCE = "ATREE-CSEI"
UTM_EPSG = 32643  # UTM 43N, metric CRS for Bengaluru

KML_NS = {"k": "http://www.opengis.net/kml/2.2"}
# Ref names that are rivers/canals, not tanks: never relabel a tank with these.
_RIVER_NAME_RE = re.compile(r"river|canal|nala|nalla|halla|raja\s*kaluve|kaluve|stream|nadi", re.IGNORECASE)
# Match acceptance thresholds.
IOU_MIN = 0.20           # genuine mutual overlap
OVERLAP_FRAC_MIN = 0.50  # OSM polygon mostly inside ref (intersection / OSM area)
REVERSE_FRAC_MIN = 0.20  # ...and covers a real chunk of ref (intersection / ref area)


def _parse_kmz_polys(kmz_path: Path) -> list[tuple[str, object]]:
    """Named polygons from the ATREE KMZ (reads doc.kml inside the zip)."""
    with zipfile.ZipFile(kmz_path) as z:
        doc = next(n for n in z.namelist() if n.endswith(".kml"))
        root = ET.fromstring(z.read(doc))
    out: list[tuple[str, object]] = []
    for pm in root.findall(".//k:Placemark", KML_NS):
        nm_el = pm.find("k:name", KML_NS)
        name = (nm_el.text or "").strip() if nm_el is not None else ""
        if not name or _RIVER_NAME_RE.search(name):
            continue
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
        if rings:
            g = (rings[0] if len(rings) == 1 else MultiPolygon(rings)).buffer(0)
            if not g.is_empty:
                out.append((name, g))
    return out


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    to_utm = pyproj.Transformer.from_crs("EPSG:4326", f"EPSG:{UTM_EPSG}", always_xy=True).transform

    ref = [(n, shp_transform(to_utm, g)) for n, g in _parse_kmz_polys(SRC_KMZ)]
    ref_geoms = [g for _, g in ref]
    tree = STRtree(ref_geoms)
    print(f"[name-blr] {len(ref)} named reference polygons (rivers filtered out)")

    fc = json.loads(OSM_GEOJSON.read_text(encoding="utf-8"))
    filled = recomputed = skipped_named = 0
    reused: dict[str, int] = {}

    for f in fc["features"]:
        props = f["properties"]
        cur = (props.get("name") or "").strip()
        # Eligible: blank name, or a name we set ourselves (re-derive).
        if cur and props.get("name_source") != NAME_SOURCE:
            skipped_named += 1
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
            # clear a stale prior derivation that no longer matches
            if props.get("name_source") == NAME_SOURCE:
                props.pop("name", None); props.pop("name_source", None); props.pop("name_match_iou", None)
            continue
        rg = ref_geoms[best_idx]
        overlap_frac = best_inter / g.area
        reverse_frac = best_inter / rg.area if rg.area > 0 else 0.0
        union = g.area + rg.area - best_inter
        iou = best_inter / union if union > 0 else 0.0
        if iou >= IOU_MIN or (overlap_frac >= OVERLAP_FRAC_MIN and reverse_frac >= REVERSE_FRAC_MIN):
            name = ref[best_idx][0]
            was_ours = props.get("name_source") == NAME_SOURCE
            props["name"] = name
            props["name_source"] = NAME_SOURCE
            props["name_match_iou"] = round(iou, 3)
            reused[name] = reused.get(name, 0) + 1
            recomputed += 1 if was_ours else 0
            filled += 1 if not was_ours else 0

    multi = {k: v for k, v in reused.items() if v > 1}
    print(f"[name-blr] newly named: {filled} | re-derived: {recomputed} | left OSM-native names untouched: {skipped_named}")
    print(f"[name-blr] ref names matched to >1 OSM polygon (lake split across polygons): {len(multi)}")
    if dry_run:
        print("[name-blr] --dry-run: not writing")
        return
    # Match the source file's existing pretty-print so the diff is just the
    # added name fields, not a whole-file reformat.
    OSM_GEOJSON.write_text(json.dumps(fc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total_named = sum(1 for f in fc["features"] if (f["properties"].get("name") or "").strip())
    print(f"[name-blr] wrote {OSM_GEOJSON.name}: {total_named}/{len(fc['features'])} now named "
          f"({100 * total_named // len(fc['features'])}%)")


if __name__ == "__main__":
    main()

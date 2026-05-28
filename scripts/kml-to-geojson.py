"""Generic KML -> GeoJSON converter.

Reads KML Placemarks of type Point / LineString / Polygon /
MultiGeometry and emits a minified GeoJSON FeatureCollection. Strips
empty geometries; preserves the Placemark name + description as
properties (description HTML is stripped and truncated to 500 chars).

Useful any time we ingest an OpenCity / KSRSAC / state-GIS KML for a
new city. First used for the Bengaluru flood-risk layers (KSRSAC
hotspots + BBMP stormwater drain network, round 22); reusable as-is
for Mumbai (MCGM stormwater drain KML, Mithi River layers) and Delhi
(DJB infrastructure KMLs) when those city onboardings start.

Earlier per-city converters (convert-bangalore-*-kml.py) hand-rolled
similar logic for each individual KML; this one is the generic
extraction so future ingests don't repeat the parser.

Geometry handling:
 - Point / LineString / Polygon mapped directly.
 - MultiGeometry collapses to Multi* when all children share a type,
   else to GeometryCollection.
 - Polygon innerBoundaryIs rings are preserved as holes.
 - Coordinates with optional altitude (lng,lat,alt) drop altitude.

Usage:
    python3 scripts/kml-to-geojson.py <input.kml> <output.geojson>

For batch use, wrap in a shell loop or a city-specific driver
script. Output is single-line minified JSON for git-friendly diffs.
"""

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"k": "http://www.opengis.net/kml/2.2"}


def parse_coords(coord_text: str):
    """Parse KML coordinates "lng,lat[,alt] lng,lat[,alt] ..." -> list of [lng, lat]."""
    if not coord_text:
        return []
    tokens = coord_text.strip().split()
    out = []
    for t in tokens:
        parts = t.split(",")
        if len(parts) >= 2:
            try:
                out.append([float(parts[0]), float(parts[1])])
            except ValueError:
                continue
    return out


def parse_point(el):
    coords_el = el.find("k:coordinates", NS)
    pts = parse_coords(coords_el.text if coords_el is not None else "")
    if not pts:
        return None
    return {"type": "Point", "coordinates": pts[0]}


def parse_linestring(el):
    coords_el = el.find("k:coordinates", NS)
    pts = parse_coords(coords_el.text if coords_el is not None else "")
    if len(pts) < 2:
        return None
    return {"type": "LineString", "coordinates": pts}


def parse_polygon(el):
    outer = el.find("k:outerBoundaryIs/k:LinearRing/k:coordinates", NS)
    inners = el.findall("k:innerBoundaryIs/k:LinearRing/k:coordinates", NS)
    if outer is None:
        return None
    outer_pts = parse_coords(outer.text)
    if len(outer_pts) < 3:
        return None
    rings = [outer_pts]
    for ir in inners:
        ir_pts = parse_coords(ir.text)
        if len(ir_pts) >= 3:
            rings.append(ir_pts)
    return {"type": "Polygon", "coordinates": rings}


def parse_multigeometry(el):
    geoms = []
    for child in el:
        tag = child.tag.split("}", 1)[-1]
        if tag == "Point":
            g = parse_point(child)
        elif tag == "LineString":
            g = parse_linestring(child)
        elif tag == "Polygon":
            g = parse_polygon(child)
        elif tag == "MultiGeometry":
            g = parse_multigeometry(child)
        else:
            g = None
        if g is None:
            continue
        if g["type"] == "GeometryCollection":
            geoms.extend(g["geometries"])
        else:
            geoms.append(g)
    if not geoms:
        return None
    if len(geoms) == 1:
        return geoms[0]
    # Promote homogeneous collections to Multi*
    types = {g["type"] for g in geoms}
    if types == {"LineString"}:
        return {"type": "MultiLineString", "coordinates": [g["coordinates"] for g in geoms]}
    if types == {"Polygon"}:
        return {"type": "MultiPolygon", "coordinates": [g["coordinates"] for g in geoms]}
    if types == {"Point"}:
        return {"type": "MultiPoint", "coordinates": [g["coordinates"] for g in geoms]}
    return {"type": "GeometryCollection", "geometries": geoms}


def parse_placemark(pm):
    name_el = pm.find("k:name", NS)
    desc_el = pm.find("k:description", NS)
    name = name_el.text.strip() if (name_el is not None and name_el.text) else None
    desc = desc_el.text.strip() if (desc_el is not None and desc_el.text) else None

    geom = None
    for child in pm:
        tag = child.tag.split("}", 1)[-1]
        if tag == "Point":
            geom = parse_point(child)
        elif tag == "LineString":
            geom = parse_linestring(child)
        elif tag == "Polygon":
            geom = parse_polygon(child)
        elif tag == "MultiGeometry":
            geom = parse_multigeometry(child)
        if geom is not None:
            break

    if geom is None:
        return None

    props = {}
    if name:
        props["name"] = name
    if desc:
        # Many OpenCity KMLs stuff HTML tables in description; strip tags.
        import re

        desc_clean = re.sub(r"<[^>]+>", " ", desc)
        desc_clean = re.sub(r"\s+", " ", desc_clean).strip()
        if desc_clean and desc_clean != name:
            props["description"] = desc_clean[:500]

    return {"type": "Feature", "properties": props, "geometry": geom}


def convert(in_path: Path, out_path: Path) -> int:
    tree = ET.parse(in_path)
    root = tree.getroot()
    placemarks = root.findall(".//k:Placemark", NS)
    features = []
    for pm in placemarks:
        f = parse_placemark(pm)
        if f is not None:
            features.append(f)
    fc = {"type": "FeatureCollection", "features": features}
    out_path.write_text(json.dumps(fc, separators=(",", ":")))
    return len(features)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    in_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    n = convert(in_path, out_path)
    in_kb = in_path.stat().st_size // 1024
    out_kb = out_path.stat().st_size // 1024
    print(f"  {in_path.name} ({in_kb} KB)  ->  {out_path.name} ({out_kb} KB)  features={n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

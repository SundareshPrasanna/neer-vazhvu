#!/usr/bin/env python3
"""
Convert OpenCity Madurai ward KML to:
  1. public/geojson/madurai-wards-2022.geojson - 100-feature FeatureCollection
  2. public/data/madurai-ward-profiles.json    - skeleton profiles array

Source KML: https://data.opencity.in/dataset/madurai-wards-map
File:       49412899-c569-474a-9868-c3d4c7d46655.kml (627KB, 100 wards, 5 zones)

The ward-profiles output is a skeleton: ward_number, zone_no, zone_name,
centroid, area_sq_km only. Water-bodies / flood / drainage / sewerage / rivers
/ industrial fields are filled in later milestones as those data layers land.

Run: python scripts/convert-madurai-wards-kml.py path/to/madurai-wards.kml
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nvdm_write import write_artifact  # noqa: E402

KML_NS = {"k": "http://www.opengis.net/kml/2.2"}
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
GEOJSON_OUT = REPO_ROOT / "public" / "geojson" / "madurai-wards-2022.geojson"
PROFILES_OUT = REPO_ROOT / "public" / "data" / "madurai-ward-profiles.json"


def parse_coords(text: str) -> list[list[float]]:
    pairs = []
    for chunk in text.strip().split():
        parts = chunk.split(",")
        if len(parts) >= 2:
            pairs.append([float(parts[0]), float(parts[1])])
    return pairs


def extract_simple_data(extended_data: ET.Element) -> dict:
    out = {}
    schema_data = extended_data.find("k:SchemaData", KML_NS)
    if schema_data is None:
        return out
    for sd in schema_data.findall("k:SimpleData", KML_NS):
        name = sd.attrib.get("name")
        if name and sd.text is not None:
            out[name] = sd.text
    return out


def polygon_geom(poly: ET.Element) -> dict:
    rings = []
    outer = poly.find("k:outerBoundaryIs/k:LinearRing/k:coordinates", KML_NS)
    if outer is not None and outer.text:
        rings.append(parse_coords(outer.text))
    for inner in poly.findall("k:innerBoundaryIs/k:LinearRing/k:coordinates", KML_NS):
        if inner.text:
            rings.append(parse_coords(inner.text))
    return {"type": "Polygon", "coordinates": rings}


def extract_geometry(placemark: ET.Element) -> dict | None:
    multi = placemark.find("k:MultiGeometry", KML_NS)
    if multi is not None:
        polys = multi.findall("k:Polygon", KML_NS)
        if len(polys) == 1:
            return polygon_geom(polys[0])
        if len(polys) > 1:
            rings = [polygon_geom(p)["coordinates"] for p in polys]
            return {"type": "MultiPolygon", "coordinates": rings}
    poly = placemark.find("k:Polygon", KML_NS)
    if poly is not None:
        return polygon_geom(poly)
    return None


def polygon_centroid(rings: list[list[list[float]]]) -> list[float]:
    """Area-weighted centroid using the shoelace formula on the outer ring."""
    if not rings or not rings[0]:
        return [0.0, 0.0]
    pts = rings[0]
    if pts[0] != pts[-1]:
        pts = pts + [pts[0]]
    cx = cy = a2 = 0.0
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        cross = x0 * y1 - x1 * y0
        a2 += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if a2 == 0:
        n = len(pts) - 1
        return [sum(p[0] for p in pts[:-1]) / n, sum(p[1] for p in pts[:-1]) / n]
    return [cx / (3 * a2), cy / (3 * a2)]


def parse_zone_no(zone: str | None) -> str | None:
    """'Central Zone-III' -> 'III'."""
    if not zone:
        return None
    m = re.search(r"Zone-([IVX]+)", zone)
    return m.group(1) if m else None


def parse_zone_name(zone: str | None) -> str | None:
    """'Central Zone-III' -> 'CENTRAL'."""
    if not zone:
        return None
    m = re.match(r"(\w+)\s*Zone", zone)
    return m.group(1).upper() if m else None


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: convert-madurai-wards-kml.py <path-to-kml>", file=sys.stderr)
        sys.exit(1)

    src = Path(sys.argv[1])
    tree = ET.parse(src)
    root = tree.getroot()

    features = []
    profiles = []
    for placemark in root.iter("{http://www.opengis.net/kml/2.2}Placemark"):
        ed = placemark.find("k:ExtendedData", KML_NS)
        attrs = extract_simple_data(ed) if ed is not None else {}
        geom = extract_geometry(placemark)
        if geom is None:
            continue

        ward_name = attrs.get("ward_lgd_name") or attrs.get("sourcewardcode") or ""
        ward_no = int(ward_name) if ward_name.isdigit() else None
        zone_full = attrs.get("zone")
        area_sqm = float(attrs["st_area(shape)"]) if attrs.get("st_area(shape)") else None

        features.append({
            "type": "Feature",
            "properties": {
                "ward_no": ward_no,
                "ward_name": ward_name,
                "zone": zone_full,
                "town_name": attrs.get("townname"),
                "ward_lgd_code": attrs.get("ward_lgd_code"),
                "source_ward_code": attrs.get("sourcewardcode"),
                "area_sqm": area_sqm,
                "perimeter_m": float(attrs["st_length(shape)"]) if attrs.get("st_length(shape)") else None,
            },
            "geometry": geom,
        })

        if ward_no is not None:
            rings = geom["coordinates"] if geom["type"] == "Polygon" else geom["coordinates"][0]
            centroid = polygon_centroid(rings)
            profiles.append({
                "ward_number": ward_no,
                "zone_no": parse_zone_no(zone_full),
                "zone_name": parse_zone_name(zone_full),
                "centroid": centroid,
                "area_sq_km": round(area_sqm / 1_000_000, 6) if area_sqm else None,
            })

    profiles.sort(key=lambda p: p["ward_number"])

    write_artifact(GEOJSON_OUT, {"type": "FeatureCollection", "features": features}, compact=True)
    write_artifact(PROFILES_OUT, profiles)
    print(f"Wrote {len(features)} features to {GEOJSON_OUT}")
    print(f"Wrote {len(profiles)} ward profiles to {PROFILES_OUT}")


if __name__ == "__main__":
    main()

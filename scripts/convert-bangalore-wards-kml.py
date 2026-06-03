#!/usr/bin/env python3
"""
Convert OpenCity GBA 369-ward KML (Dec 2025) to:
  1. public/geojson/bangalore-wards-2025.geojson - 369-feature FeatureCollection
  2. public/data/bangalore-ward-profiles.json    - profile array with population

Source KML: https://data.opencity.in/dataset/gba-wards-delimitation-2025
File:       gba-369-wards-december-2025.kml (3.9MB, 369 wards, 5 corporations,
            10 zones, includes name changes notified 01.12.2025)

The KML carries much richer per-ward data than Madurai's: Kannada ward + corp
names, assembly constituency, returning officer division, population breakdown
(TOT/SC/ST x M/F). Profile output captures all of it so downstream pages
(/bangalore/my-ward, ranking tables, ward narrative AI prompts) can use it
without re-parsing the KML.

ward_number is the *global* 1..369 ordinal (from the KML's id field, parsed
out of "ward_369_final.<N>"). ward_id is the corporation-local ward number
(1..n within each of West/East/South/North/Central). Both are surfaced so
journalists can quote either form.

Run: python scripts/convert-bangalore-wards-kml.py scripts/data-raw/bangalore/gba-369-wards-december-2025.kml
"""

import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

KML_NS = {"k": "http://www.opengis.net/kml/2.2"}
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
GEOJSON_OUT = REPO_ROOT / "public" / "geojson" / "bangalore-wards-2025.geojson"
PROFILES_OUT = REPO_ROOT / "public" / "data" / "bangalore-ward-profiles.json"


def parse_coords(text: str) -> list[list[float]]:
    pairs = []
    for chunk in text.strip().split():
        parts = chunk.split(",")
        if len(parts) >= 2:
            pairs.append([float(parts[0]), float(parts[1])])
    return pairs


def extract_simple_data(extended_data: ET.Element) -> dict:
    out: dict[str, str] = {}
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


def polygon_area_sq_km(rings: list[list[list[float]]], centroid_lat: float) -> float:
    """Shoelace area in degree^2 scaled to km^2 at the centroid's latitude.
    Adequate for ward-scale polygons - errors below 0.1% at ward sizes at
    Bangalore's latitude. Not for nationwide or polar polygons."""
    if not rings or not rings[0]:
        return 0.0
    pts = rings[0]
    if pts[0] != pts[-1]:
        pts = pts + [pts[0]]
    a2 = 0.0
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        a2 += x0 * y1 - x1 * y0
    area_deg_sq = abs(a2) / 2.0
    km_per_deg_lat = 110.574
    km_per_deg_lon = 111.320 * math.cos(math.radians(centroid_lat))
    return area_deg_sq * km_per_deg_lat * km_per_deg_lon


def multipolygon_area_sq_km(coords: list, centroid_lat: float) -> float:
    """Sum of outer-ring areas across each polygon in a MultiPolygon."""
    total = 0.0
    for poly_rings in coords:
        total += polygon_area_sq_km(poly_rings, centroid_lat)
    return total


def parse_global_ward_no(id_str: str | None) -> int | None:
    """'ward_369_final.42' -> 42."""
    if not id_str:
        return None
    m = re.search(r"\.(\d+)$", id_str)
    return int(m.group(1)) if m else None


def to_int(value: str | None) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def main() -> None:
    if len(sys.argv) < 2:
        print(
            "Usage: convert-bangalore-wards-kml.py <path-to-kml>",
            file=sys.stderr,
        )
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

        global_ward_no = parse_global_ward_no(attrs.get("id"))
        ward_id_local = to_int(attrs.get("ward_id"))
        ward_name_en = attrs.get("ward_name")
        ward_name_kn = attrs.get("ward_name_kn")
        ward_label = attrs.get("Ward_Name")
        corporation = attrs.get("Corporation")
        corporation_kn = attrs.get("corporation_kn")
        corporation_id = to_int(attrs.get("corporation_id"))
        zone = attrs.get("zone")
        zone_name = attrs.get("zone_name")
        assembly = attrs.get("Assembly")
        ac_name = attrs.get("ac")
        ac_name_kn = attrs.get("ac_kn")
        ac_no = to_int(attrs.get("ac_no"))
        ro_code = to_int(attrs.get("RO_Code"))
        ro_division = attrs.get("RO_Division")
        aro_code = to_int(attrs.get("ARO_Code"))
        aro_sub_division = attrs.get("ARO_ Sub Division")
        total_pop = to_int(attrs.get("TOT_P"))
        total_male = to_int(attrs.get("TOT_M"))
        total_female = to_int(attrs.get("TOT_F"))
        sc_pop = to_int(attrs.get("SC_P"))
        st_pop = to_int(attrs.get("ST_P"))
        voter_low = to_int(attrs.get("low_range"))
        voter_high = to_int(attrs.get("high_range"))

        feature_props = {
            "ward_no": global_ward_no,
            "ward_id_local": ward_id_local,
            "ward_name": ward_name_en,
            "ward_name_kn": ward_name_kn,
            "ward_label": ward_label,
            "corporation": corporation,
            "corporation_kn": corporation_kn,
            "corporation_id": corporation_id,
            "zone": zone,
            "zone_name": zone_name,
            "assembly": assembly,
            "ac_name": ac_name,
            "ac_no": ac_no,
            "total_pop": total_pop,
        }
        features.append({
            "type": "Feature",
            "properties": feature_props,
            "geometry": geom,
        })

        if global_ward_no is None:
            continue

        if geom["type"] == "Polygon":
            outer_rings = geom["coordinates"]
            centroid = polygon_centroid(outer_rings)
            area = polygon_area_sq_km(outer_rings, centroid[1])
        else:
            primary = geom["coordinates"][0]
            centroid = polygon_centroid(primary)
            area = multipolygon_area_sq_km(geom["coordinates"], centroid[1])

        profiles.append({
            "ward_number": global_ward_no,
            "ward_id_local": ward_id_local,
            "ward_name": ward_name_en,
            "ward_name_kn": ward_name_kn,
            "corporation": corporation,
            "corporation_kn": corporation_kn,
            "corporation_id": corporation_id,
            "zone": zone,
            "zone_name": zone_name,
            "assembly_constituency": ac_name,
            "assembly_constituency_kn": ac_name_kn,
            "assembly_no": ac_no,
            "ro_code": ro_code,
            "ro_division": ro_division,
            "aro_code": aro_code,
            "aro_sub_division": aro_sub_division,
            "population_total": total_pop,
            "population_male": total_male,
            "population_female": total_female,
            "population_sc": sc_pop,
            "population_st": st_pop,
            "voter_range_low": voter_low,
            "voter_range_high": voter_high,
            "centroid": [round(centroid[0], 6), round(centroid[1], 6)],
            "area_sq_km": round(area, 4),
        })

    profiles.sort(key=lambda p: p["ward_number"])

    GEOJSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    PROFILES_OUT.parent.mkdir(parents=True, exist_ok=True)
    GEOJSON_OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    PROFILES_OUT.write_text(json.dumps(profiles, indent=2))
    print(f"Wrote {len(features)} features to {GEOJSON_OUT}")
    print(f"Wrote {len(profiles)} ward profiles to {PROFILES_OUT}")

    expected = 369
    if len(profiles) != expected:
        print(
            f"WARNING: expected {expected} wards, got {len(profiles)}",
            file=sys.stderr,
        )
        sys.exit(2)


if __name__ == "__main__":
    main()

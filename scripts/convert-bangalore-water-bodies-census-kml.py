#!/usr/bin/env python3
"""
Convert OpenCity Bengaluru Urban water bodies census KML to GeoJSON.

Source: https://data.opencity.in/dataset/bengaluru-urban-and-karnataka-water-bodies-census-data
File:   bengaluru-urban-water-bodies-census.kml (1.3MB, 718 features, Points)
Origin: Jal Dharohar / 1st Census of Water Bodies (Ministry of Jal Shakti,
        survey 2018-19, release 2023). Same census that gave Chennai its 305
        bodies. Karnataka coverage is district-level: this file = Bangalore
        Urban district (includes Anekal taluk + rural pockets beyond GBA).

Output: public/geojson/bangalore-water-bodies-census.geojson

Geometry is Point (lat/lng of each water body). Polygon shapes need a
separate OSM Overpass fetch (TODO follow-up commit) to power the same UI
shape as Chennai/Madurai's `<city>-water-bodies-current.geojson`. This
census file is still valuable on its own because it carries fields OSM
does NOT: water_body_ownership (Panchayat/Government/Private), encroachment
status, original storage capacity, official enumeration date + photo URL.

Run: python scripts/convert-bangalore-water-bodies-census-kml.py scripts/data-raw/bangalore/bengaluru-urban-water-bodies-census.kml
"""

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from nvdm_write import write_artifact

KML_NS = {"k": "http://www.opengis.net/kml/2.2"}
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
OUT = REPO_ROOT / "public" / "geojson" / "bangalore-water-bodies-census.geojson"

# Numeric water_body_type codes used by the Jal Dharohar schema. Decoded
# against the census handbook (https://nwic.gov.in). Codes outside this map
# fall through unchanged so we don't silently drop information.
WATER_BODY_TYPE_MAP = {
    "01": "Pond",
    "02": "Tank",
    "03": "Lake",
    "04": "Reservoir",
    "05": "Water Conservation Scheme",
    "06": "Percolation Tank",
    "07": "Check Dam",
    "08": "Other",
}


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


def extract_point(placemark: ET.Element) -> list[float] | None:
    point = placemark.find("k:Point/k:coordinates", KML_NS)
    if point is None or not point.text:
        return None
    parts = point.text.strip().split(",")
    if len(parts) < 2:
        return None
    return [float(parts[0]), float(parts[1])]


def to_float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def main() -> None:
    if len(sys.argv) < 2:
        print(
            "Usage: convert-bangalore-water-bodies-census-kml.py <path-to-kml>",
            file=sys.stderr,
        )
        sys.exit(1)

    src = Path(sys.argv[1])
    tree = ET.parse(src)
    root = tree.getroot()

    features = []
    for placemark in root.iter("{http://www.opengis.net/kml/2.2}Placemark"):
        ed = placemark.find("k:ExtendedData", KML_NS)
        if ed is None:
            continue
        attrs = extract_simple_data(ed)
        coords = extract_point(placemark)
        if coords is None:
            continue

        wb_type_code = attrs.get("water_body_type")
        wb_type_name = WATER_BODY_TYPE_MAP.get(wb_type_code, wb_type_code) if wb_type_code else None

        features.append({
            "type": "Feature",
            "properties": {
                "census_code": attrs.get("unique_id"),
                "village": attrs.get("village") or attrs.get("village_nwic"),
                "block_tehsil": attrs.get("block_tehsil"),
                "subdistrict": attrs.get("subdistrict_nwic"),
                "district": attrs.get("district_nwic"),
                "rural_or_urban": attrs.get("rural_or_urban"),
                "water_body_type_code": wb_type_code,
                "water_body_type": wb_type_name,
                "water_body_ownership": attrs.get("water_body_ownership"),
                "water_body_nature": attrs.get("water_body_nature"),
                "in_use": attrs.get("waterbody_use_notuse"),
                "encroached": attrs.get("waterbody_encroached"),
                "storage_capacity_original": to_float(
                    attrs.get("storage_capacity_water_body_ori")
                ),
                "max_depth_m": to_float(attrs.get("max_depth_water_body_fully_fill")),
                "water_spread_area": to_float(
                    attrs.get("water_spread_area_of_water_body")
                ),
                "image_path": attrs.get("image_path"),
            },
            "geometry": {"type": "Point", "coordinates": coords},
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Envelope-preserving write (scripts/nvdm_write.py); compact like before.
    write_artifact(OUT, {"type": "FeatureCollection", "features": features}, compact=True)
    print(f"Wrote {len(features)} water bodies to {OUT}")


if __name__ == "__main__":
    main()

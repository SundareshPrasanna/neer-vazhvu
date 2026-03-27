#!/usr/bin/env python3
"""
Convert CMWSSB sewerage KML/KMZ files to GeoJSON for web delivery.

Processes three datasets:
1. Sewage Treatment Plants (9 polygons -> centroids with capacity)
2. Sewage Pumping Stations (349 polygons -> centroids with SPS/STP names)
3. Pumping Mains (3,834 lines -> simplified lines with origin/destination)

Run: python scripts/convert-sewerage-kml.py

Input:  scripts/data-raw/sewerage/
Output: public/geojson/chennai-sewerage.geojson
"""

import json
import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"kml": "http://www.opengis.net/kml/2.2"}

# Material codes from sewer-codes.txt
MATERIAL_CODES = {
    "1": "Brick Arch", "2": "RCC Pipe", "3": "CI Pipe", "4": "DWC Pipe",
    "6": "SW Pipe", "8": "DI Pipe", "9": "PVC Pipe", "10": "PVC",
    "11": "PSC Pipe", "12": "MS Pipe",
}

PIPE_SIZE_CODES = {
    "1": 100, "2": 150, "3": 200, "4": 250, "5": 300, "6": 350,
    "8": 400, "9": 450, "10": 500, "11": 600, "12": 700, "14": 750,
    "15": 800, "16": 900, "17": 1000, "18": 1100, "19": 1200,
    "23": 1600, "29": 225, "30": 125, "31": 160, "32": 1050,
}

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "data-raw" / "sewerage"
OUT_DIR = SCRIPT_DIR.parent / "public" / "geojson"


def parse_coords(text: str) -> list[list[float]]:
    """Parse KML coordinate string to [[lng, lat], ...]"""
    coords = []
    for part in text.strip().split():
        vals = part.split(",")
        if len(vals) >= 2:
            lng, lat = float(vals[0]), float(vals[1])
            # Round to 5 decimal places (~1m precision)
            coords.append([round(lng, 5), round(lat, 5)])
    return coords


def centroid(coords: list[list[float]]) -> list[float]:
    """Compute simple centroid of a polygon."""
    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return [round(sum(lngs) / len(lngs), 5), round(sum(lats) / len(lats), 5)]


def get_simple_data(placemark: ET.Element) -> dict[str, str]:
    """Extract SimpleData name/value pairs from a Placemark."""
    data = {}
    for sd in placemark.iter("{%s}SimpleData" % NS["kml"]):
        name = sd.get("name", "")
        val = (sd.text or "").strip()
        if val:
            data[name] = val
    return data


def get_first_coords(placemark: ET.Element) -> list[list[float]] | None:
    """Get coordinates from the first LineString or Polygon in a Placemark."""
    # Try LineString first
    for ls in placemark.iter("{%s}LineString" % NS["kml"]):
        coords_el = ls.find("{%s}coordinates" % NS["kml"])
        if coords_el is not None and coords_el.text:
            return parse_coords(coords_el.text)

    # Try Polygon (outer boundary)
    for poly in placemark.iter("{%s}Polygon" % NS["kml"]):
        outer = poly.find(
            "{%s}outerBoundaryIs/{%s}LinearRing/{%s}coordinates"
            % (NS["kml"], NS["kml"], NS["kml"])
        )
        if outer is not None and outer.text:
            return parse_coords(outer.text)

    return None


def iter_placemarks(kml_path: str):
    """Stream-parse KML file yielding (SimpleData dict, coords) tuples."""
    print(f"  Parsing {kml_path} ...")
    tree = ET.parse(kml_path)
    root = tree.getroot()
    for pm in root.iter("{%s}Placemark" % NS["kml"]):
        data = get_simple_data(pm)
        coords = get_first_coords(pm)
        if coords:
            yield data, coords


def simplify_line(coords: list[list[float]], tolerance: float = 0.0001) -> list[list[float]]:
    """Douglas-Peucker simplification for a line."""
    if len(coords) <= 2:
        return coords

    # Find point with max distance from line between first and last
    first, last = coords[0], coords[-1]
    max_dist = 0
    max_idx = 0

    for i in range(1, len(coords) - 1):
        # Perpendicular distance from point to line
        dx = last[0] - first[0]
        dy = last[1] - first[1]
        if dx == 0 and dy == 0:
            dist = ((coords[i][0] - first[0]) ** 2 + (coords[i][1] - first[1]) ** 2) ** 0.5
        else:
            dist = abs(dy * coords[i][0] - dx * coords[i][1] + last[0] * first[1] - last[1] * first[0]) / (dx**2 + dy**2) ** 0.5
        if dist > max_dist:
            max_dist = dist
            max_idx = i

    if max_dist > tolerance:
        left = simplify_line(coords[: max_idx + 1], tolerance)
        right = simplify_line(coords[max_idx:], tolerance)
        return left[:-1] + right
    else:
        return [first, last]


def convert_treatment_plants() -> list[dict]:
    """Convert STPs to point features with capacity info."""
    kml_path = DATA_DIR / "treatment-plants.kml"
    features = []
    seen_ids = set()

    for data, coords in iter_placemarks(str(kml_path)):
        stp_id = data.get("stp_id", "")
        if stp_id in seen_ids:
            continue
        seen_ids.add(stp_id)

        center = centroid(coords)
        capacity = data.get("installed_capacity_mld")

        feature = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": center},
            "properties": {
                "layer": "stp",
                "name": data.get("stp_name", "").strip(),
                "capacity_mld": float(capacity) if capacity else None,
                "treatment_process": data.get("treatment_process", ""),
                "road": data.get("road_name", "").strip(),
                "effluent": data.get("characteristics_of_effluent", "").strip(),
                "disposal_point": data.get("disposal_point_id", ""),
            },
        }
        features.append(feature)

    print(f"  STPs: {len(features)} features")
    return features


def convert_pumping_stations() -> list[dict]:
    """Convert SPS polygons to point centroids."""
    kml_path = DATA_DIR / "pumping-stations.kml"
    features = []
    seen_ids = set()

    for data, coords in iter_placemarks(str(kml_path)):
        sps_id = data.get("sps_id", "")
        if sps_id in seen_ids:
            continue
        seen_ids.add(sps_id)

        center = centroid(coords)

        feature = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": center},
            "properties": {
                "layer": "sps",
                "name": data.get("name_of_the_sps", "").strip(),
                "stp_name": data.get("name_of_the_stp", "").strip(),
                "category": data.get("category", ""),
                "type": data.get("type_of_station", ""),
                "road": data.get("road_name", "").strip(),
                "streets_served": int(data["total_no_of_streets_collected"]) if data.get("total_no_of_streets_collected") else None,
                "ground_water_level": data.get("ground_water_level", ""),
            },
        }
        features.append(feature)

    print(f"  Pumping stations: {len(features)} features")
    return features


def convert_pumping_mains() -> list[dict]:
    """Convert pumping mains to simplified line features."""
    kml_path = DATA_DIR / "pumping-mains.kml"
    features = []

    for data, coords in iter_placemarks(str(kml_path)):
        simplified = simplify_line(coords, tolerance=0.00005)

        pipe_material = data.get("pipe_material", "")
        material_name = MATERIAL_CODES.get(pipe_material, pipe_material)

        pipe_size = data.get("size", "")
        size_mm = PIPE_SIZE_CODES.get(pipe_size, int(pipe_size) if pipe_size.isdigit() else None)

        feature = {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": simplified},
            "properties": {
                "layer": "pumping_main",
                "origin": data.get("originating_sps_stp_name", "").strip(),
                "destination": data.get("destination_sps_stp_name", "").strip(),
                "material": material_name,
                "size_mm": size_mm,
                "length_m": round(float(data["st_length(shape)"]), 1) if data.get("st_length(shape)") else None,
            },
        }
        features.append(feature)

    print(f"  Pumping mains: {len(features)} features (before merge)")

    # Merge line segments that share the same origin-destination pair
    merged = merge_line_segments(features)
    print(f"  Pumping mains: {len(merged)} features (after merge)")
    return merged


def merge_line_segments(features: list[dict]) -> list[dict]:
    """Group line segments by origin-destination and merge properties.
    Keep individual segments since merging LineStrings would require
    complex topology analysis. Just return as-is.
    """
    return features


def main():
    print("=== Converting CMWSSB Sewerage Data ===\n")

    all_features = []

    # 1. Treatment plants
    stps = convert_treatment_plants()
    all_features.extend(stps)

    # 2. Pumping stations
    sps = convert_pumping_stations()
    all_features.extend(sps)

    # 3. Pumping mains
    mains = convert_pumping_mains()
    all_features.extend(mains)

    # Write combined GeoJSON
    geojson = {
        "type": "FeatureCollection",
        "features": all_features,
    }

    out_path = OUT_DIR / "chennai-sewerage.geojson"
    with open(out_path, "w") as f:
        json.dump(geojson, f)

    size_mb = os.path.getsize(out_path) / 1024 / 1024
    print(f"\n=== Output ===")
    print(f"  {out_path}")
    print(f"  {len(all_features)} total features, {size_mb:.2f} MB")
    print(f"    STPs: {len(stps)}")
    print(f"    Pumping Stations: {len(sps)}")
    print(f"    Pumping Mains: {len(mains)}")


if __name__ == "__main__":
    main()

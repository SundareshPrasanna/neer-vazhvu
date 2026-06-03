#!/usr/bin/env python3
"""
Convert OpenCity BWSSB sewerage trunk-lines (>=300mm) KML to GeoJSON.

Source: https://data.opencity.in/dataset/bwssb-sewerage-line-maps-for-bengaluru
File:   bwssb-sewerage-300mm-plus.kml (16 MB, 16,403 LineString features)

Output: public/geojson/bangalore-sewerage-trunks.geojson

The OpenCity dataset splits BWSSB's full network by diameter into three
KMLs (<=150 / 150-300 / >=300 mm). This converter handles the >=300mm
trunk-line file - the larger collection mains that carry sewage to the
big STPs (V.Valley, K&C Valley, Bellandur Amani Kere). Smaller-bore
collector lines (under 300mm) are a separate ingest if we ever need
per-block coverage; for the foam-and-fire / Vrishabhavathi narrative the
trunks are what matters.

Output is intentionally large (~16 MB GeoJSON). Bangalore is enabled=false
in the city registry, so this doesn't ship to production yet. When we
wire the frontend we should consider PMTiles or simplification.

Run: python scripts/convert-bangalore-sewerage-trunks-kml.py scripts/data-raw/bangalore/bwssb-sewerage-300mm-plus.kml
"""

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

KML_NS = {"k": "http://www.opengis.net/kml/2.2"}
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
OUT = REPO_ROOT / "public" / "geojson" / "bangalore-sewerage-trunks.geojson"


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


def extract_linestring(placemark: ET.Element) -> list[list[float]] | None:
    ls = placemark.find("k:LineString/k:coordinates", KML_NS)
    if ls is None or not ls.text:
        return None
    coords: list[list[float]] = []
    for chunk in ls.text.strip().split():
        parts = chunk.split(",")
        if len(parts) >= 2:
            try:
                coords.append([float(parts[0]), float(parts[1])])
            except ValueError:
                continue
    return coords if len(coords) >= 2 else None


def to_float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def to_int(value: str | None) -> int | None:
    f = to_float(value)
    return int(f) if f is not None else None


def main() -> None:
    if len(sys.argv) < 2:
        print(
            "Usage: convert-bangalore-sewerage-trunks-kml.py <path-to-kml>",
            file=sys.stderr,
        )
        sys.exit(1)

    tree = ET.parse(sys.argv[1])
    root = tree.getroot()

    features = []
    total_length_m = 0.0
    diameter_buckets: dict[str, int] = {}
    for placemark in root.iter("{http://www.opengis.net/kml/2.2}Placemark"):
        ed = placemark.find("k:ExtendedData", KML_NS)
        if ed is None:
            continue
        attrs = extract_simple_data(ed)
        coords = extract_linestring(placemark)
        if coords is None:
            continue

        diameter = to_float(attrs.get("Diameter"))
        length_m = to_float(attrs.get("Length")) or 0.0
        if length_m:
            total_length_m += length_m
        bucket = _diameter_bucket(diameter)
        diameter_buckets[bucket] = diameter_buckets.get(bucket, 0) + 1

        features.append({
            "type": "Feature",
            "properties": {
                "pipe_id": to_int(attrs.get("KGISSewerlineID")),
                "diameter_mm": diameter,
                "length_m": length_m,
                "status": attrs.get("Status"),
                "zone_id": attrs.get("ZoneID"),
                "valley_subdiv": to_int(attrs.get("KGISValley_SubDivisionID")),
            },
            "geometry": {"type": "LineString", "coordinates": coords},
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    print(f"Wrote {len(features)} sewer-trunk segments to {OUT}")
    print(f"  total length: {total_length_m/1000:.1f} km")
    print("  diameter buckets:")
    for bucket in sorted(diameter_buckets.keys()):
        print(f"    {bucket}: {diameter_buckets[bucket]:,}")


def _diameter_bucket(d: float | None) -> str:
    if d is None:
        return "unknown"
    if d < 450:
        return "300-449"
    if d < 600:
        return "450-599"
    if d < 900:
        return "600-899"
    return "900+"


if __name__ == "__main__":
    main()

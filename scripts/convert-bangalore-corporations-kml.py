#!/usr/bin/env python3
"""
Convert OpenCity GBA 5-corporation boundary KML to GeoJSON.

Source: https://data.opencity.in/dataset/greater-bengaluru-authority-corporations-delimitation-2025
File:   gba-5-corporations-september-2025.kml (339KB, 5 features - Central, North,
        South, East, West)

Output: public/geojson/bangalore-corporations-2025.geojson

Used by /bangalore/my-ward + /bangalore home as the over-ward administrative
context layer ("which of the 5 City Corporations is this ward in?"). The KML
has only `id` + `corporatio` (truncated 'corporation') columns - we expand the
truncated name and join with the human-friendly Kannada equivalents.

Run: python scripts/convert-bangalore-corporations-kml.py scripts/data-raw/bangalore/gba-5-corporations-september-2025.kml
"""

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

KML_NS = {"k": "http://www.opengis.net/kml/2.2"}
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
OUT = REPO_ROOT / "public" / "geojson" / "bangalore-corporations-2025.geojson"

# Map from the truncated KML "corporatio" code to the canonical English +
# Kannada names already used in the ward dataset. Keeps the ward file and
# the corp file consistent so a frontend layer can join on `corporation`.
CORP_KN = {
    "Central": "ಕೇಂದ್ರ",
    "East": "ಪೂರ್ವ",
    "West": "ಪಶ್ಚಿಮ",
    "North": "ಉತ್ತರ",
    "South": "ದಕ್ಷಿಣ",
}


def parse_coords(text: str) -> list[list[float]]:
    pairs = []
    for chunk in text.strip().split():
        parts = chunk.split(",")
        if len(parts) >= 2:
            pairs.append([float(parts[0]), float(parts[1])])
    return pairs


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


def main() -> None:
    if len(sys.argv) < 2:
        print(
            "Usage: convert-bangalore-corporations-kml.py <path-to-kml>",
            file=sys.stderr,
        )
        sys.exit(1)

    tree = ET.parse(sys.argv[1])
    root = tree.getroot()

    features = []
    for placemark in root.iter("{http://www.opengis.net/kml/2.2}Placemark"):
        attrs = {}
        for sd in placemark.iter("{http://www.opengis.net/kml/2.2}SimpleData"):
            name = sd.attrib.get("name")
            if name and sd.text is not None:
                attrs[name] = sd.text

        geom = extract_geometry(placemark)
        if geom is None:
            continue

        # KML truncates "corporation" to "corporatio".
        corp_en = attrs.get("corporatio") or attrs.get("corporation")
        features.append({
            "type": "Feature",
            "properties": {
                "corporation_id": int(attrs["id"]) if attrs.get("id") else None,
                "corporation": corp_en,
                "corporation_kn": CORP_KN.get(corp_en) if corp_en else None,
            },
            "geometry": geom,
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    print(f"Wrote {len(features)} corporations to {OUT}")

    if len(features) != 5:
        print(f"WARNING: expected 5 corporations, got {len(features)}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Kolkata's 1st Census of Water Bodies points -> census geojson.

    https://data.opencity.in/dataset/kolkata-water-bodies-census-data
    (Ministry of Jal Shakti enumeration, digitised by OpenCity)

WHY THIS MATTERS FOR KOLKATA SPECIFICALLY. The city's own working inventory is a
departmental tank list compiled in **1993**, supplemented by a 2004 NRSA aerial
map. This is an independent, enumerated, GPS-located census - the only modern
per-water-body register Kolkata has, and it is not KMC's.

It is also a fourth number in a city that already could not agree on how many
ponds it has (KMC 1997: 1,786; KMC 2006: 3,873; NATMO 2006: 8,731; satellite
2006: 4,889). The census is deliberately NOT reconciled against those here.
Different instruments counting different things - a national census counting
enumerable water bodies against a municipal tank list against a map census -
is the finding, not a problem to average away.

Each census point is joined to our OSM polygon layer so a reader can see which
enumerated bodies still show open water today: point-in-polygon first, then
nearest polygon within 150 m.

Run:  python3 neer-vazhvu-api/scripts/build_kolkata_water_census.py [--kml path]
"""

import argparse
import json
import math
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
GEO_DIR = REPO_ROOT / "public" / "geojson"

KML_URL = (
    "https://data.opencity.in/dataset/d9c9b5e1-01e2-4fa4-8c7c-ff335d327f96/"
    "resource/8b4faaae-746e-4079-8d08-93c54fa04956/download/"
    "bdb7e96d-acaf-442c-9488-b9f8297404ca.kml"
)
NS = {"k": "http://www.opengis.net/kml/2.2"}
JOIN_RADIUS_M = 150


def fetch_kml(dest: Path):
    req = urllib.request.Request(KML_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=240) as r:
        dest.write_bytes(r.read())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kml")
    args = ap.parse_args()

    from shapely.geometry import Point, shape
    from shapely.strtree import STRtree

    kml = Path(args.kml) if args.kml else GEO_DIR / "_kol_census.kml"
    if not args.kml:
        fetch_kml(kml)

    root = ET.parse(kml).getroot()
    feats = []
    for pm in root.findall(".//k:Placemark", NS):
        props = {
            sd.get("name"): (sd.text or "").strip()
            for sd in pm.findall(".//k:SimpleData", NS)
        }
        try:
            lng, lat = float(props["longitude"]), float(props["latitude"])
        except (KeyError, TypeError, ValueError):
            continue
        feats.append(
            {
                "type": "Feature",
                "properties": props,
                "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
            }
        )

    # Join to the OSM polygon layer: which enumerated bodies still show water?
    wb = json.loads((GEO_DIR / "kolkata-water-bodies-current.geojson").read_text())
    polys = [shape(f["geometry"]) for f in wb["features"]]
    tree = STRtree(polys)
    deg = JOIN_RADIUS_M / 111_320
    inside = near = unmatched = 0
    for f in feats:
        p = Point(*f["geometry"]["coordinates"])
        hit = [polys[i] for i in tree.query(p) if polys[i].contains(p)]
        if hit:
            f["properties"]["osm_match"] = "inside"
            inside += 1
        elif len(tree.query(p.buffer(deg))) > 0:
            f["properties"]["osm_match"] = "near"
            near += 1
        else:
            f["properties"]["osm_match"] = "unmatched"
            unmatched += 1

    out = {
        "type": "FeatureCollection",
        "metadata": {
            "source": "1st Census of Water Bodies, Kolkata (Ministry of Jal Shakti enumeration)",
            "publisher": "Ministry of Jal Shakti / Government of West Bengal",
            "digitization": "OpenCity Urban Data Portal (data.opencity.in)",
            "source_url": "https://data.opencity.in/dataset/kolkata-water-bodies-census-data",
            "retrieved": date.today().isoformat(),
            "count": len(feats),
            "join_summary": {
                "inside": inside,
                "near": near,
                "unmatched": unmatched,
                "method": f"point-in-polygon, else nearest polygon within {JOIN_RADIUS_M} m",
                "joined_against": "kolkata-water-bodies-current.geojson (OSM, ODbL)",
            },
            "note": (
                "This is the only modern per-water-body register Kolkata has, and it is not "
                "KMC's - the corporation's own working inventory is a tank list compiled in "
                "1993 plus a 2004 NRSA aerial map. It is deliberately NOT reconciled against "
                "the city's other counts (KMC 1,786 in 1997 and 3,873 in 2006; NATMO 8,731 and "
                "satellite 4,889, both 2006). Different instruments counting different things "
                "is the finding, not an error to average away."
            ),
            "unmatched_note": (
                "'unmatched' means no OSM water polygon within 150 m of the enumerated point. "
                "That is a prompt to look, not proof the body is gone: OSM coverage is partial "
                "and census coordinates are enumerator-placed."
            ),
        },
        "features": feats,
    }
    path = GEO_DIR / "kolkata-water-bodies-census.geojson"
    path.write_text(json.dumps(out, ensure_ascii=False))
    if not args.kml and kml.exists():
        kml.unlink()
    print(
        f"kolkata census: {len(feats)} enumerated bodies "
        f"(inside {inside}, near {near}, unmatched {unmatched}) -> {path.name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

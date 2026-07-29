#!/usr/bin/env python3
"""Full-extent taluk boundaries for the Arkavathi atlas.

Paani Earth review (29 Jul 2026): the taluk layer shipped clipped to the basin,
but "Show <taluk> on the map" should display the whole administrative unit -
the district layer already draws full extents. This script replaces
public/data/basins/arkavathi/admin-taluk.geojson with full boundaries from the
KWRIS open GeoServer (2023 taluk layer, includes the post-2020 taluks such as
Harohalli), keeping the basin file's own names and per-feature properties
(level / shedId / parentDistrict) so every existing mapMatch keeps working.

Usage:
    python3 scripts/build_arkavathi_taluks_full.py [cached-wfs.geojson]

Without an argument it fetches the layer from KWRIS (no auth).
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public/data/basins/arkavathi/admin-taluk.geojson"
INVENTORY = REPO / "public/data/basins/arkavathi/inventory.json"

WFS_URL = (
    "https://water.karnataka.gov.in/geoserver/KA/ows"
    "?service=WFS&version=1.0.0&request=GetFeature"
    "&typeName=KA:GIS_Taluk_20230621&outputFormat=application/json"
)

# KWRIS NAME -> the name this basin's layers already use (mapMatch contract).
NAME_MAP = {
    "Bangalore (North)": "Bengaluru North",
    "Bangalore-South": "Bangalore-South",
    "Anekal": "Anekal",
    "Yelahanka": "Yelahanka",
    "Nelamangala": "Nelamangala",
    "Doddaballapura": "Doddaballapura",
    "Devanahalli": "Devanahalli",
    "Kollegala(Hanur)": "Hanur",
    "Chikballapur": "Chikkaballapura",
    "Magadi": "Magadi",
    "Ramanagar": "Ramanagara",
    "Channapatna": "Channapatna",
    "Kanakpura": "Kanakpura",
    "Harohalli": "Harohalli",
}


def round_coords(coords, nd=5):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], nd), round(coords[1], nd)]
    return [round_coords(c, nd) for c in coords]


def main() -> None:
    if len(sys.argv) > 1:
        src = json.loads(Path(sys.argv[1]).read_text())
    else:
        print(f"fetching {WFS_URL}")
        with urllib.request.urlopen(WFS_URL, timeout=120) as r:
            src = json.load(r)

    # Keep each feature's existing properties - the atlas relies on name
    # (mapMatch), shedId (river-selection scoping) and parentDistrict (tooltip).
    prev = json.loads(OUT.read_text())
    prev_props = {f["properties"]["name"]: f["properties"] for f in prev["features"]}

    feats = []
    for f in src["features"]:
        ours = NAME_MAP.get(f["properties"].get("NAME") or "")
        if not ours:
            continue
        props = prev_props.get(ours)
        if props is None:
            raise SystemExit(f"no existing properties for taluk {ours!r}")
        geom = f["geometry"]
        lng, lat = _first_position(geom["coordinates"])
        if not (74 < lng < 79 and 11 < lat < 15):
            raise SystemExit(f"suspicious coordinates for {ours!r}: {lng}, {lat}")
        feats.append(
            {
                "type": "Feature",
                "properties": dict(props),
                "geometry": {"type": geom["type"], "coordinates": round_coords(geom["coordinates"])},
            }
        )

    missing = set(prev_props) - {f["properties"]["name"] for f in feats}
    if missing:
        raise SystemExit(f"taluks missing from KWRIS layer: {sorted(missing)}")

    feats.sort(key=lambda f: f["properties"]["name"])
    fc = {"type": "FeatureCollection", "features": feats}
    OUT.write_text(json.dumps(fc, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {OUT} ({len(feats)} taluks, {OUT.stat().st_size:,} bytes)")

    inv = json.loads(INVENTORY.read_text())
    inv["families"]["admin-taluk"] = {
        "featureCount": len(feats),
        "sources": [
            {
                "file": "KA:GIS_Taluk_20230621 (KWRIS GeoServer)",
                "kind": None,
                "count": len(feats),
                "provenance": (
                    "Full-extent taluk boundaries from the KWRIS open GeoServer "
                    "(water.karnataka.gov.in, 2023 taluk layer), fetched 2026-07-29; "
                    "names aligned to the basin's KGIS naming. Replaces the "
                    "basin-clipped taluks (Paani Earth review, Jul 2026)."
                ),
            }
        ],
        "bytes": OUT.stat().st_size,
        "sliced": False,
    }
    INVENTORY.write_text(json.dumps(inv, indent=2, ensure_ascii=False) + "\n")
    print(f"updated {INVENTORY}")


def _first_position(coords):
    while not isinstance(coords[0], (int, float)):
        coords = coords[0]
    return coords[0], coords[1]


if __name__ == "__main__":
    main()

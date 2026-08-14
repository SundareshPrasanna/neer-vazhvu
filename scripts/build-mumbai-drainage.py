#!/usr/bin/env python3
"""
Build public/geojson/mumbai-drainage.geojson from OpenStreetMap (Overpass).

Mumbai's flooding is rainfall + high-tide + CHOKED-DRAINAGE driven, so the
flood page needs the storm-water drainage skeleton: the open drains and the
named nallas (Mogra, Vakola, SNDT, Irla, Mahul...) that BRIMSTOWAD was meant
to widen after the 26 July 2005 deluge. BMC publishes no public per-drain
survey (Chennai's GCC does - chennai-drainage.geojson is an official
condition-graded street survey; this layer is NOT that), so the honest public
source is OSM's mapped drain network.

Included: waterway=drain and waterway=ditch (the mapped SWD), plus
waterway=stream/canal/river whose name reads as a nalla/nallah/nala.
Excluded: the 11 named rivers already on the rivers layer (Mithi etc.),
dams/weirs.

Source: OpenStreetMap via Overpass API (ODbL).
Run:  python scripts/build-mumbai-drainage.py
"""

import json
import math
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from nvdm_write import write_artifact

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
OUT_PATH = "public/geojson/mumbai-drainage.geojson"

# Urban MMR extent (south, west, north, east) - same band as the water-bodies
# main bbox: the 9 corporations' built-up area.
BBOX = (18.85, 72.70, 19.60, 73.35)

# Rivers already rendered by the rivers layer - skip their ways here so the
# flood map's drainage toggle doesn't double-draw them.
RIVER_NAME_RE = re.compile(
    r"\b(mithi|dahisar|poisar|oshiwara|oshiwra|ulhas|waldhuni|kalu|vaitarna|bhatsa|surya|tansa)\b",
    re.I,
)
NALLA_NAME_RE = re.compile(r"\bnall?ah?\b|\bnala\b", re.I)


def _overpass(query: str):
    data = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for ep in OVERPASS_ENDPOINTS:
        for attempt in range(2):
            try:
                req = urllib.request.Request(
                    ep, data=data, headers={"User-Agent": "neervazhvu-build"}
                )
                with urllib.request.urlopen(req, timeout=150) as resp:
                    return json.load(resp)
            except Exception as exc:  # noqa: BLE001
                last = exc
                print(f"  retry ({ep} attempt {attempt + 1}): {str(exc)[:60]}", file=sys.stderr)
    raise last


def _haversine_km(a, b):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, [a[1], a[0], b[1], b[0]])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def main() -> int:
    s, w, n, e = BBOX
    bbox = f"{s},{w},{n},{e}"
    # Two catches: (1) all mapped drains/ditches; (2) named nallas that OSM
    # tags as stream/canal/river instead of drain.
    query = (
        "[out:json][timeout:150];("
        f'way["waterway"="drain"]({bbox});'
        f'way["waterway"="ditch"]({bbox});'
        f'way["waterway"~"^(stream|canal|river)$"]["name"~"nall?ah?|nala",i]({bbox});'
        ");out geom;"
    )
    print("Querying Overpass for Mumbai drains + nallas…", flush=True)
    payload = _overpass(query)

    features = []
    total_km = 0.0
    named = 0
    for el in payload.get("elements", []):
        if el.get("type") != "way" or "geometry" not in el:
            continue
        tags = el.get("tags") or {}
        name = tags.get("name", "")
        # A named river's own way sometimes carries "nalla" in a tributary
        # name - keep those; skip only the main rivers themselves.
        if name and RIVER_NAME_RE.search(name) and not NALLA_NAME_RE.search(name):
            continue
        line = [[pt["lon"], pt["lat"]] for pt in el["geometry"]]
        if len(line) < 2:
            continue
        length_km = sum(
            _haversine_km(line[i], line[i + 1]) for i in range(len(line) - 1)
        )
        total_km += length_km
        if name:
            named += 1
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": line},
                "properties": {
                    "osm_id": el["id"],
                    "name": name,
                    "waterway": tags.get("waterway", ""),
                    "covered": tags.get("covered", ""),
                    "length_km": round(length_km, 2),
                },
            }
        )

    if not features:
        print("ERROR: Overpass returned no drainage ways", file=sys.stderr)
        return 1

    out = {
        "type": "FeatureCollection",
        "name": "mumbai-drainage",
        "_provenance": (
            "OpenStreetMap via Overpass API (ODbL): waterway=drain/ditch plus "
            "named nallas tagged as stream/canal. NOT an official BMC SWD "
            "survey - no public one exists; coverage reflects what mappers "
            "have traced."
        ),
        "features": features,
    }
    # Envelope-preserving write (scripts/nvdm_write.py): keeps the NVDM
    # envelope injected by the migration so a regeneration cannot strip it.
    write_artifact(Path(OUT_PATH), out, compact=True)
    print(
        f"Wrote {len(features)} drainage ways ({named} named, ~{total_km:.0f} km) -> {OUT_PATH}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

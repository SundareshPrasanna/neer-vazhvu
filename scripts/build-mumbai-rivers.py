#!/usr/bin/env python3
"""
Build public/geojson/mumbai-rivers.geojson from OpenStreetMap (Overpass).

The rivers page loads /geojson/<cityId>-rivers.geojson as MultiLineString
features whose `river_id` links to the rivers in
public/data/river-quality-<cityId>.json. This script fetches the waterway
geometry for Mumbai's four rivers (Mithi, Dahisar, Poisar, Oshiwara) from
OSM and assembles one MultiLineString per river.

Source: OpenStreetMap via Overpass API (ODbL).
Run:  python scripts/build-mumbai-rivers.py
"""

import json
import math
import re
import sys
import urllib.parse
import urllib.request

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
OUT_PATH = "public/geojson/mumbai-rivers.geojson"


def _overpass(query: str):
    data = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for ep in OVERPASS_ENDPOINTS:
        for attempt in range(2):
            try:
                req = urllib.request.Request(
                    ep, data=data, headers={"User-Agent": "neervazhvu-build"}
                )
                with urllib.request.urlopen(req, timeout=120) as resp:
                    return json.load(resp)
            except Exception as exc:  # noqa: BLE001
                last = exc
                print(f"  retry ({ep} attempt {attempt + 1}): {str(exc)[:60]}", file=sys.stderr)
    raise last

# MMR extent (south, west, north, east): BMC's four small rivers in the SW plus
# the eastern Ulhas/Waldhuni corridor and the NE/NW source rivers.
BBOX = (18.85, 72.65, 19.85, 73.55)

# OSM-name substring (lowercase) -> (river_id, display name, Marathi name).
RIVER_MATCH = [
    # BMC (Greater Mumbai) rivers
    ("mithi", ("mithi", "Mithi River", "मिठी नदी")),
    ("dahisar", ("dahisar", "Dahisar River", "दहिसर नदी")),
    ("poisar", ("poisar", "Poisar River", "पोयसर नदी")),
    ("oshiwara", ("oshiwara", "Oshiwara River", "ओशिवरा नदी")),
    ("oshiwra", ("oshiwara", "Oshiwara River", "ओशिवरा नदी")),
    # Eastern corridor: the Ulhas is both source and sewage sink; Waldhuni is
    # Ulhasnagar's polluted tributary nalla into it.
    ("ulhas", ("ulhas", "Ulhas River", "उल्हास नदी")),
    ("waldhuni", ("waldhuni", "Waldhuni River", "वालधुनी नदी")),
    ("kalu", ("kalu", "Kalu River", "काळू नदी")),
    # Source rivers feeding the supply reservoirs
    ("vaitarna", ("vaitarna", "Vaitarna River", "वैतरणा नदी")),
    ("bhatsa", ("bhatsa", "Bhatsa River", "भातसा नदी")),
    ("surya", ("surya", "Surya River", "सूर्या नदी")),
    ("tansa", ("tansa", "Tansa River", "तानसा नदी")),
]


def _haversine_km(a, b):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, [a[1], a[0], b[1], b[0]])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def _match(name: str):
    # Whole-word match so "kalu" doesn't grab "Kalundre River" (a different
    # river), etc.
    low = (name or "").lower()
    for needle, meta in RIVER_MATCH:
        if re.search(r"\b" + re.escape(needle) + r"\b", low):
            return meta
    return None


def main() -> int:
    s, w, n, e = BBOX
    query = (
        "[out:json][timeout:90];"
        f'(way["waterway"]["name"~"Mithi|Dahisar|Poisar|Oshiwara|Oshiwra|Ulhas|Waldhuni|Kalu|Vaitarna|Bhatsa|Surya|Tansa",i]({s},{w},{n},{e}););'
        "out geom;"
    )
    print("Querying Overpass for Mumbai river waterways…", flush=True)
    payload = _overpass(query)

    # river_id -> { lines: [[ [lng,lat], ... ]], osm_ids: [], meta }
    grouped: dict[str, dict] = {}
    for el in payload.get("elements", []):
        if el.get("type") != "way" or "geometry" not in el:
            continue
        # Drop dams/weirs and named irrigation canals that share a river's name
        # ("Bhatsa Dam", "Bhatsa Right Bank Canal"), but KEEP drains/streams -
        # Mumbai's channelised rivers (Poisar, Oshiwara) are tagged waterway=drain.
        tags = el.get("tags") or {}
        nm = (tags.get("name") or "").lower()
        if tags.get("waterway") in ("dam", "weir") or "canal" in nm or "dam" in nm:
            continue
        meta = _match(tags.get("name", ""))
        if not meta:
            continue
        rid, disp, mr = meta
        line = [[pt["lon"], pt["lat"]] for pt in el["geometry"]]
        if len(line) < 2:
            continue
        g = grouped.setdefault(
            rid, {"disp": disp, "mr": mr, "lines": [], "osm_ids": []}
        )
        g["lines"].append(line)
        g["osm_ids"].append(el["id"])

    if not grouped:
        print("ERROR: Overpass returned no matching waterways", file=sys.stderr)
        return 1

    features = []
    # Emit every configured river (RIVER_MATCH order), not just the original
    # four BMC rivers.
    for rid in dict.fromkeys(meta[0] for _, meta in RIVER_MATCH):
        g = grouped.get(rid)
        if not g:
            print(f"  WARN: no OSM geometry for {rid}", file=sys.stderr)
            continue
        length_km = round(
            sum(
                _haversine_km(line[i], line[i + 1])
                for line in g["lines"]
                for i in range(len(line) - 1)
            ),
            1,
        )
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "MultiLineString", "coordinates": g["lines"]},
                "properties": {
                    "river_id": rid,
                    "name": g["disp"],
                    "name_mr": g["mr"],
                    "waterway": "river",
                    "length_km": length_km,
                    "osm_ids": sorted(g["osm_ids"]),
                },
            }
        )
        print(
            f"  {rid}: {len(g['lines'])} ways, ~{length_km} km", flush=True
        )

    out = {
        "type": "FeatureCollection",
        "name": "mumbai-rivers",
        "_provenance": "OpenStreetMap via Overpass API (ODbL).",
        "features": features,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False)
    print(f"Wrote {len(features)} rivers -> {OUT_PATH}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Build public/geojson/mumbai-water-bodies-current.geojson from OpenStreetMap.

The water-bodies page renders the current OSM water-body polygons for the
city (lakes, ponds, tanks) coloured/labelled on the map. This fetches
natural=water polygons in the Mumbai bbox via Overpass, computes each
body's area, and drops the huge sea/creek polygons (area filter) so only
real water bodies remain. Property schema matches bangalore-water-bodies-
current.geojson: osm_id, osm_type, name, name_mr, water_type, area_ha.

Source: OpenStreetMap via Overpass API (ODbL).
Run:  python scripts/build-mumbai-water-bodies.py
"""

import json
import math
import sys
import urllib.parse
import urllib.request

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
OUT_PATH = "public/geojson/mumbai-water-bodies-current.geojson"
# MMR extent: covers the urbanised metro of the 9 corporations (Greater Mumbai
# in the SW up to Vasai-Virar/Thane/Kalyan/Navi-Mumbai/Panvel). The distant
# supply reservoirs (Bhatsa/Vaitarna etc., further N/E) come via the separate
# named SUPPLY_BBOX fetch below.
BBOX = (18.85, 72.70, 19.60, 73.35)  # s, w, n, e
# Keep bodies up to this size; larger closed polygons are the sea / big
# creeks, not lakes (Vihar, the largest real lake, is ~7 sqkm = 700 ha).
MAX_AREA_HA = 1500.0
MIN_AREA_HA = 0.02

# OSM ways/relations to drop outright: coastal salt-pan / tidal polygons that
# sit in the sea off Uttan and read as a "water body in the ocean" (and whose
# terrain catchment bleeds into the sea in the cascade atlas). Not freshwater
# bodies; excluded from both this layer and the cascade lakes.
DROP_OSM_IDS = {1222292339}

# Mumbai's 5 supply reservoirs sit 90-130 km north/east of the city, outside
# BBOX - so a city-scoped query misses them. They ARE Mumbai's tap, though, so
# we fetch them by name from the Thane/Palghar region and tag them
# supply_reservoir=True. They're large (Bhatsa is ~3,000+ ha), so the
# MAX_AREA_HA city-lake cap is bypassed for them. The 2 in-city lakes (Vihar,
# Tulsi) already come through the main BBOX query.
SUPPLY_BBOX = (19.40, 73.05, 20.05, 73.55)  # s, w, n, e (Thane + Palghar)
SUPPLY_NAME_RE = "Bhatsa|Tansa|Vaitarna|Modak Sagar"

KM_PER_DEG_LAT = 110.57
KM_PER_DEG_LNG = 111.32 * math.cos(math.radians(19.0))


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
                print(f"  retry ({ep}): {str(exc)[:60]}", file=sys.stderr)
    raise last


def _ring_area_ha(ring) -> float:
    s = 0.0
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
        s += x1 * y2 - x2 * y1
    deg2 = abs(s) / 2.0
    return deg2 * KM_PER_DEG_LAT * KM_PER_DEG_LNG * 100.0  # sqkm -> ha


def _stitch(segments):
    """Join member linestrings end-to-end into closed rings (relation outers
    are often split across several member ways)."""
    segs = [list(s) for s in segments if len(s) >= 2]
    rings = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while changed and ring[0] != ring[-1]:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == ring[-1]:
                    ring += s[1:]
                elif s[-1] == ring[-1]:
                    ring += s[-2::-1]
                elif s[-1] == ring[0]:
                    ring = s[:-1] + ring
                elif s[0] == ring[0]:
                    ring = s[::-1][:-1] + ring
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        if len(ring) >= 4:
            rings.append(ring)
    return rings


def main() -> int:
    s, w, n, e = BBOX
    bbox = f"{s},{w},{n},{e}"
    # Mumbai lakes are tagged variously: natural=water (Powai, Vihar),
    # water=lake + landuse=reservoir (Tulsi). Catch all three, ways + relations.
    query = (
        "[out:json][timeout:150];("
        + "".join(
            f'{kind}["{tag}"]({bbox});'
            for kind in ("way", "relation")
            for tag in ("natural", "water", "landuse")
        )
        + ");out geom;"
    )
    print("Querying Overpass for Mumbai water bodies…", flush=True)
    payload = _overpass(query)

    features = []
    kept = dropped = 0
    seen = set()
    for el in payload.get("elements", []):
        tags = el.get("tags") or {}
        # Keep only genuine water bodies (the broad query also returns
        # non-water natural=/landuse= features).
        is_water = (
            tags.get("natural") == "water"
            or "water" in tags
            or tags.get("landuse") == "reservoir"
        )
        if not is_water:
            continue
        if el["id"] in DROP_OSM_IDS:
            continue
        key = (el["type"], el["id"])
        if key in seen:
            continue
        name = tags.get("name", "")
        water_type = tags.get("water") or tags.get("natural") or tags.get("landuse") or "water"

        rings = []
        if el.get("type") == "way" and "geometry" in el:
            rings = [[[p["lon"], p["lat"]] for p in el["geometry"]]]
        elif el.get("type") == "relation":
            outers = [
                [[p["lon"], p["lat"]] for p in m["geometry"]]
                for m in el.get("members", [])
                if m.get("role") == "outer" and "geometry" in m
            ]
            rings = _stitch(outers)
        if not rings or len(rings[0]) < 4:
            continue

        area = sum(_ring_area_ha(r) for r in rings)
        # Drop the sea / massive creeks; keep named small bodies regardless.
        if area > MAX_AREA_HA:
            dropped += 1
            continue
        if area < MIN_AREA_HA and not name:
            continue
        # Mark seen only once KEPT, so a large reservoir dropped here by the area
        # filter can still be re-added by the named SUPPLY_BBOX fetch below.
        seen.add(key)

        geom = (
            {"type": "Polygon", "coordinates": [rings[0]]}
            if len(rings) == 1
            else {"type": "MultiPolygon", "coordinates": [[r] for r in rings]}
        )
        features.append(
            {
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "osm_id": el["id"],
                    "osm_type": el["type"],
                    "name": name,
                    "name_mr": "",
                    "water_type": water_type,
                    "area_ha": round(area, 2),
                },
            }
        )
        kept += 1

    # --- Supply reservoirs (90-130 km out, by name) -------------------------
    ss, sw, sn, se = SUPPLY_BBOX
    sbbox = f"{ss},{sw},{sn},{se}"
    supply_query = (
        "[out:json][timeout:180];("
        + "".join(
            f'{kind}["natural"="water"]["name"~"{SUPPLY_NAME_RE}",i]({sbbox});'
            f'{kind}["water"]["name"~"{SUPPLY_NAME_RE}",i]({sbbox});'
            f'{kind}["landuse"="reservoir"]["name"~"{SUPPLY_NAME_RE}",i]({sbbox});'
            for kind in ("way", "relation")
        )
        + ");out geom;"
    )
    print("Querying Overpass for Mumbai's supply reservoirs…", flush=True)
    supply_payload = _overpass(supply_query)
    supply_kept = 0
    for el in supply_payload.get("elements", []):
        tags = el.get("tags") or {}
        name = tags.get("name", "")
        if not name:
            continue
        key = (el["type"], el["id"])
        if key in seen:
            continue
        seen.add(key)
        if el.get("type") == "way" and "geometry" in el:
            rings = [[[p["lon"], p["lat"]] for p in el["geometry"]]]
        elif el.get("type") == "relation":
            rings = _stitch(
                [
                    [[p["lon"], p["lat"]] for p in m["geometry"]]
                    for m in el.get("members", [])
                    if m.get("role") == "outer" and "geometry" in m
                ]
            )
        else:
            rings = []
        if not rings or len(rings[0]) < 4:
            continue
        area = sum(_ring_area_ha(r) for r in rings)
        geom = (
            {"type": "Polygon", "coordinates": [rings[0]]}
            if len(rings) == 1
            else {"type": "MultiPolygon", "coordinates": [[r] for r in rings]}
        )
        features.append(
            {
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "osm_id": el["id"],
                    "osm_type": el["type"],
                    "name": name,
                    "name_mr": "",
                    "water_type": "reservoir",
                    "area_ha": round(area, 2),
                    # Marks Mumbai's distant drinking-water reservoirs so the
                    # map can label them as the city's actual supply, distinct
                    # from in-city lakes/tanks.
                    "supply_reservoir": True,
                },
            }
        )
        supply_kept += 1
    print(f"  + {supply_kept} supply reservoirs", flush=True)

    # Tag supply reservoirs by name regardless of which fetch caught them: with
    # the regional bbox, a mid-size reservoir like Tansa now falls inside the
    # main query and arrives as a plain lake, so name-tag here for consistency.
    import re as _re
    _supply_re = _re.compile(SUPPLY_NAME_RE, _re.I)
    for f in features:
        if _supply_re.search(f["properties"].get("name", "")):
            f["properties"]["supply_reservoir"] = True

    out = {
        "type": "FeatureCollection",
        "name": "mumbai-water-bodies-current",
        "_provenance": "OpenStreetMap via Overpass API (ODbL).",
        "features": sorted(features, key=lambda f: -f["properties"]["area_ha"]),
    }
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False)
    named = sum(1 for f in features if f["properties"]["name"])
    print(
        f"Wrote {kept} bodies ({named} named) -> {OUT_PATH}  (dropped {dropped} sea/large)",
        flush=True,
    )
    for f in features[:10]:
        p = f["properties"]
        if p["name"]:
            print(f"  {p['name']:<28} {p['area_ha']} ha  {p['water_type']}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

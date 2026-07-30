#!/usr/bin/env python3
"""
Build public/geojson/mumbai-corporations-2024.geojson - the boundary polygons of
the 9 municipal corporations of the Mumbai Metropolitan Region.

This is the P0 admin layer for the MMR re-scope (docs/specs/mumbai-mmr.md):
the corporation is the always-present comparable sub-unit of the region, so we
need one clean boundary per corporation. Fetched from OpenStreetMap
administrative relations (boundary=administrative, admin_level 7-8) by name,
outer rings stitched into polygons, with corporation_id / acronym / district
metadata attached. Per-corporation centroid + bbox are printed so they can be
pasted into the CorporationConfig entries in src/lib/cities/mumbai.ts.

Source: OpenStreetMap via Overpass API (ODbL).
Run:  python3 scripts/build-mmr-corporations.py
"""

import json
import math
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
OUT_PATH = "public/geojson/mumbai-corporations-2024.geojson"
# MMR bounding box (s, w, n, e) - generous, covers all 9 corporations.
BBOX = (18.55, 72.60, 20.20, 73.85)

KM_PER_DEG_LAT = 110.57
KM_PER_DEG_LNG = 111.32 * math.cos(math.radians(19.2))

# corporation_id -> (display_name, acronym, district, OSM name regex). The regex
# matches the OSM relation `name` tag (English); variants included because OSM
# naming is inconsistent across these relations.
# Greater Mumbai (BMC) has no single admin_level=8 relation in OSM; its
# jurisdiction is the two revenue districts (Mumbai City + Mumbai Suburban,
# admin_level=5) combined, so we match BOTH at level 5 and dissolve them. The
# other 8 corporations are admin_level=8 - pinning the level avoids matching the
# same-named District (level 6) or taluka (level 7), e.g. "Thane"/"Bhiwandi".
# Tuple: (id, display, acronym, district, name_regex, admin_level)
CORPORATIONS = [
    ("bmc",   "Greater Mumbai",     "BMC",   "Mumbai City + Suburban",
     r"^Mumbai (City|Suburban) District$", "5"),
    ("tmc",   "Thane",              "TMC",   "Thane",     r"^Thane( Municipal Corporation)?$", "8"),
    ("kdmc",  "Kalyan-Dombivli",    "KDMC",  "Thane",     r"Kalyan.?Dombivli", "8"),
    ("nmmc",  "Navi Mumbai",        "NMMC",  "Thane",     r"^Navi Mumbai( Municipal Corporation)?$", "8"),
    ("mbmc",  "Mira-Bhayandar",     "MBMC",  "Thane",     r"Mira.?Bhayand[ae]r", "8"),
    ("vvcmc", "Vasai-Virar",        "VVCMC", "Palghar",   r"Vasai.?Virar", "8"),
    ("bncmc", "Bhiwandi-Nizampur",  "BNCMC", "Thane",     r"Bhiwandi", "8"),
    ("umc",   "Ulhasnagar",         "UMC",   "Thane",     r"^Ulhasnagar( Municipal Corporation)?$", "8"),
    ("pmc",   "Panvel",             "PMC",   "Raigad",    r"^Panvel( Municipal Corporation)?$", "8"),
]


def _overpass(query: str):
    data = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for ep in OVERPASS_ENDPOINTS:
        for _ in range(2):
            try:
                req = urllib.request.Request(
                    ep, data=data, headers={"User-Agent": "neervazhvu-build"}
                )
                with urllib.request.urlopen(req, timeout=180) as resp:
                    return json.load(resp)
            except Exception as exc:  # noqa: BLE001
                last = exc
                print(f"  retry ({ep}): {str(exc)[:70]}", file=sys.stderr)
    raise last


def _stitch(segments):
    """Join member linestrings end-to-end into closed rings."""
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


def _ring_area_ha(ring) -> float:
    s = 0.0
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0 * KM_PER_DEG_LAT * KM_PER_DEG_LNG * 100.0


def _centroid_bbox(rings):
    pts = [p for r in rings for p in r]
    lngs = [p[0] for p in pts]
    lats = [p[1] for p in pts]
    # area-weighted centroid would be nicer; mean of the largest ring's vertices
    # is plenty for a map default center.
    big = max(rings, key=_ring_area_ha)
    cx = sum(p[0] for p in big) / len(big)
    cy = sum(p[1] for p in big) / len(big)
    return (round(cy, 4), round(cx, 4)), (round(min(lats), 4), round(min(lngs), 4),
                                          round(max(lats), 4), round(max(lngs), 4))


def main() -> int:
    s, w, n, e = BBOX
    bbox = f"{s},{w},{n},{e}"
    name_union = "|".join(f"({c[4]})" for c in CORPORATIONS)
    query = (
        "[out:json][timeout:180];"
        f'relation["boundary"="administrative"]["admin_level"~"^[5678]$"]'
        f'["name"~"{name_union}"]({bbox});'
        "out geom;"
    )
    print("Querying Overpass for MMR corporation boundaries…", flush=True)
    payload = _overpass(query)

    import re
    from shapely.geometry import Polygon, mapping
    from shapely.ops import unary_union

    # Collect ALL matching relations per corporation (BMC = 2 districts).
    cand: dict[str, list] = {c[0]: [] for c in CORPORATIONS}
    for el in payload.get("elements", []):
        if el.get("type") != "relation":
            continue
        tags = el.get("tags") or {}
        name = tags.get("name", "")
        for cid, _disp, _ac, _dist, pat, lvl in CORPORATIONS:
            if re.search(pat, name) and tags.get("admin_level") == lvl:
                cand[cid].append(el)
                break

    features = []
    for cid, disp, ac, dist, _pat, _lvl in CORPORATIONS:
        els = cand[cid]
        if not els:
            print(f"  MISSING: {cid} ({disp}) - no OSM relation matched", file=sys.stderr)
            continue
        polys = []
        osm_ids = []
        for el in els:
            osm_ids.append(el["id"])
            outers = [
                [[p["lon"], p["lat"]] for p in m["geometry"]]
                for m in el.get("members", [])
                if m.get("role") == "outer" and "geometry" in m
            ]
            for ring in _stitch(outers):
                if len(ring) >= 4:
                    polys.append(Polygon(ring).buffer(0))  # buffer(0) fixes self-touch
        if not polys:
            print(f"  MISSING geometry: {cid} ({disp})", file=sys.stderr)
            continue
        # Dissolve (BMC's two districts merge into one; islands stay separate).
        merged = unary_union(polys)
        geom = mapping(merged)
        rings = (
            [merged.exterior.coords[:]]
            if merged.geom_type == "Polygon"
            else [g.exterior.coords[:] for g in merged.geoms]
        )
        center, bb = _centroid_bbox([[list(p) for p in r] for r in rings])
        area_sqkm = round(sum(_ring_area_ha([list(p) for p in r]) for r in rings) / 100.0, 1)
        features.append(
            {
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "corporation_id": cid,
                    "name": disp,
                    "acronym": ac,
                    "district": dist,
                    "osm_ids": osm_ids,
                    "area_sqkm": area_sqkm,
                },
            }
        )
        print(
            f"  {cid:<6} {disp:<20} center=({center[0]},{center[1]}) "
            f"bbox=({bb[0]},{bb[1]},{bb[2]},{bb[3]}) area={area_sqkm} sqkm",
            flush=True,
        )

    out = {
        "type": "FeatureCollection",
        "name": "mumbai-corporations-2024",
        "_provenance": "OpenStreetMap administrative boundaries via Overpass API (ODbL).",
        "features": features,
    }
    # Envelope-preserving write (scripts/nvdm_write.py): keeps the NVDM
    # envelope injected by the migration so a regeneration cannot strip it.
    write_artifact(Path(OUT_PATH), out, compact=True)
    print(f"\nWrote {len(features)}/9 corporations -> {OUT_PATH}", flush=True)
    return 0 if len(features) == 9 else 2


if __name__ == "__main__":
    sys.exit(main())

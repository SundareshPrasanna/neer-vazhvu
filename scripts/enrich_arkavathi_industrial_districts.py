#!/usr/bin/env python3
"""Tag Arkavathi industrial-area polygons with their district.

Paani Earth review (29 Jul 2026): the DEP snapshot lists the named KIADB areas
per district and should also surface the unnamed "other" (likely KSSIDC)
polygons under a single per-district chip. Those features carry no admin
attribution, so this script point-in-polygon tests each feature's
representative point against the basin's admin-district layer and writes a
`district` property (the DEP snapshot's district key) onto every
industrial-area / industrial-area-other feature.

Usage:
    python3 scripts/enrich_arkavathi_industrial_districts.py
"""

from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PRESSURES = REPO / "public/data/basins/arkavathi/pressures-industrial.geojson"
DISTRICTS = REPO / "public/data/basins/arkavathi/admin-district.geojson"

# admin-district `name` -> gaps.json district key.
DISTRICT_KEY = {
    "Bengaluru South": "bengaluru-south",
    "Bengaluru (Urban)": "bengaluru-urban",
    "Bengaluru (Rural)": "bengaluru-rural",
    "Chikkaballapura": "chikkaballapura",
}


def rings(geom):
    if geom["type"] == "Polygon":
        yield geom["coordinates"]
    elif geom["type"] == "MultiPolygon":
        yield from geom["coordinates"]


def point_in_ring(pt, ring):
    x, y = pt
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def point_in_geom(pt, geom):
    for poly in rings(geom):
        if point_in_ring(pt, poly[0]) and not any(point_in_ring(pt, hole) for hole in poly[1:]):
            return True
    return False


def rep_point(geom):
    if geom["type"] == "Point":
        return tuple(geom["coordinates"][:2])
    # Vertex average of the largest outer ring - enough for admin attribution
    # of these small, convex-ish estate polygons.
    ring = max((p[0] for p in rings(geom)), key=len)
    xs = [c[0] for c in ring]
    ys = [c[1] for c in ring]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def main() -> None:
    fc = json.loads(PRESSURES.read_text())
    districts = json.loads(DISTRICTS.read_text())["features"]

    counts: dict[str, int] = {}
    unmatched = 0
    unlocated = 0
    for f in fc["features"]:
        if f["properties"].get("kind") not in ("industrial-area", "industrial-area-other"):
            continue
        if not f["geometry"] or not f["geometry"]["coordinates"]:
            # 11 unnamed estates carry no geometry at all ("Location not
            # matched") - they can't be attributed to a district.
            unlocated += 1
            continue
        pt = rep_point(f["geometry"])
        key = next(
            (
                DISTRICT_KEY[d["properties"]["name"]]
                for d in districts
                if point_in_geom(pt, d["geometry"])
            ),
            None,
        )
        if key is None:
            # Basin-edge polygon falling just outside the (full-extent) district
            # layer would be a data bug worth hearing about.
            unmatched += 1
            f["properties"].pop("district", None)
            continue
        f["properties"]["district"] = key
        if f["properties"]["kind"] == "industrial-area-other":
            counts[key] = counts.get(key, 0) + 1

    PRESSURES.write_text(json.dumps(fc, separators=(",", ":"), ensure_ascii=False))
    print(f"unnamed (industrial-area-other) polygons per district: {counts}")
    print(f"unnamed estates with no geometry (skipped): {unlocated}")
    if unmatched:
        print(f"WARNING: {unmatched} industrial polygons matched no district")


if __name__ == "__main__":
    main()

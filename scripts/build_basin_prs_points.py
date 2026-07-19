#!/usr/bin/env python3
"""Build a point-based prs-stretches.geojson for an overview basin from a
CPCB polluted-river-stretches config (scripts/basin-sources/<basin>-prs.json).

Used where the source GIS has no per-river geometry to draw stretch lines
(cauvery-tn: TNGIS streams carry no names). Each CPCB stretch/location is
emitted as one Point feature per sub-basin it touches, placed at CPCB's own
monitoring locations. Every point is validated against sub-basins.geojson at
build time - a point landing in the wrong (or no) sub-basin fails the build.

Usage: python3 scripts/build_basin_prs_points.py scripts/basin-sources/cauvery-tn-prs.json
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def point_in_geom(lon, lat, geom):
    def in_ring(ring):
        inside = False
        n = len(ring)
        for i in range(n):
            x1, y1 = ring[i][0], ring[i][1]
            x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
            if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                inside = not inside
        return inside

    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return any(in_ring(p[0]) and not any(in_ring(h) for h in p[1:]) for p in polys)


def main(cfg_path):
    cfg = json.loads(Path(cfg_path).read_text())
    basin_dir = ROOT / "public" / "data" / "basins" / cfg["basinId"]
    sub_basins = json.loads((basin_dir / "sub-basins.geojson").read_text())

    features = []
    for entry in cfg["entries"]:
        for pt in entry["points"]:
            hits = [
                f["properties"]["code"]
                for f in sub_basins["features"]
                if point_in_geom(pt["lon"], pt["lat"], f["geometry"])
            ]
            if hits != [pt["subBasin"]]:
                sys.exit(
                    f"FAIL {entry['stretchId']} point ({pt['lon']}, {pt['lat']}): "
                    f"expected sub-basin {pt['subBasin']}, polygon test says {hits}"
                )
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [pt["lon"], pt["lat"]]},
                "properties": {
                    "stretchId": entry["stretchId"],
                    "river": entry["river"],
                    "stretch": entry["stretch"],
                    "priority": entry["priority"],
                    "kind": entry["kind"],
                    "bodValue": entry["bodValue"],
                    "history": entry.get("history"),
                    "subBasin": pt["subBasin"],
                    "locations": pt["locations"],
                    "vintage": cfg["assessment"],
                },
            })

    out = basin_dir / "prs-stretches.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False))
    print(f"wrote {out.relative_to(ROOT)}: {len(features)} points, "
          f"{len(cfg['entries'])} CPCB entries")

    # Register in the basin inventory so "Data on this map" stays truthful.
    inv_path = basin_dir / "inventory.json"
    inv = json.loads(inv_path.read_text())
    inv["families"]["prs-stretches"] = {
        "featureCount": len(features),
        "bytes": out.stat().st_size,
        "sources": [{
            "file": "prs-stretches.geojson",
            "kind": None,
            "count": len(features),
            "provenance": cfg["source"],
        }],
    }
    inv_path.write_text(json.dumps(inv, ensure_ascii=False, indent=1))
    print(f"updated {inv_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "scripts/basin-sources/cauvery-tn-prs.json")

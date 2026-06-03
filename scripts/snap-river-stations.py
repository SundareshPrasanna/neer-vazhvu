"""Snap river-quality station coords to nearest OSM river polyline point.

Idempotent. Reads /public/data/river-quality-<city>.json + the matching
city rivers GeoJSON, and for each station computes the distance to the
nearest polyline point on its parent river. Stations within
SNAP_THRESHOLD_M of the polyline are MOVED to the nearest point; the
original coord is preserved in lat_original / lng_original. Stations
farther off keep their named-place coordinate and are flagged with
`off_osm_river_polyline: true`.

Why we need this: OSM doesn't trace Bengaluru's rivers through built-up
BBMP - the urban segment flows as storm-drain / rajakaluve channels not
tagged as 'waterway=river'. KSPCB sampling stations curated at named
city places (Begur, Bommanahalli, Nayandahalli, etc.) end up far from
any OSM river polyline point unless we either move them or flag them.

Usage:
    python scripts/snap-river-stations.py --city bangalore [--threshold-m 2000]

Run on every river-quality file refresh. Safe to re-run; preserves
prior audit fields and updates them on each pass.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RIVERS_GEOJSON = ROOT / "public" / "geojson"
RIVER_QUALITY = ROOT / "public" / "data"


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def collect_river_points(geojson: dict) -> dict[str, list[tuple[float, float]]]:
    """Map river name -> flat list of [lng, lat] coords across all linestrings."""
    out: dict[str, list[tuple[float, float]]] = {}
    for feat in geojson.get("features", []):
        name = feat.get("properties", {}).get("name")
        if not name:
            continue
        geom = feat.get("geometry", {})
        gtype = geom.get("type")
        if gtype == "LineString":
            out.setdefault(name, []).extend(geom["coordinates"])
        elif gtype == "MultiLineString":
            for line in geom["coordinates"]:
                out.setdefault(name, []).extend(line)
    return out


def closest_point(
    lat: float, lng: float, points: list[tuple[float, float]]
) -> tuple[tuple[float, float], float]:
    best = points[0]
    bestd = math.inf
    for p in points:
        d = haversine_m(lat, lng, p[1], p[0])
        if d < bestd:
            bestd = d
            best = p
    return best, bestd


def snap(city: str, threshold_m: float) -> None:
    geo_path = RIVERS_GEOJSON / f"{city}-rivers.geojson"
    rq_path = RIVER_QUALITY / f"river-quality-{city}.json"

    if not geo_path.exists():
        raise SystemExit(f"missing rivers geojson: {geo_path}")
    if not rq_path.exists():
        raise SystemExit(f"missing river-quality file: {rq_path}")

    river_pts = collect_river_points(json.loads(geo_path.read_text()))
    rq = json.loads(rq_path.read_text())

    # Older runs of this script appended an OSM-coverage caveat directly
    # into the `stretch` field. Strip those legacy concatenations so the
    # next pass can store the caveat in a dedicated field instead, and
    # leave `stretch` as the editorial physical-stretch description that
    # the UI renders as the station's primary label.
    LEGACY_CAVEAT_MARKERS = (
        "Marker is off the OSM-traced river LineString",
        "Marker sits on the urban storm-drain network",
    )

    audit = []
    for r in rq.get("rivers", []):
        name = r.get("name")
        pts = river_pts.get(name, [])
        if not pts:
            audit.append(f"  WARN  no river polyline for '{name}'")
            continue
        for s in r.get("stations", []):
            # Prefer the original coord when re-snapping (idempotent).
            lat = s.get("lat_original", s["lat"])
            lng = s.get("lng_original", s["lng"])
            pt, d = closest_point(lat, lng, pts)
            s["osm_river_offset_m_before"] = round(d)

            # Clean any legacy caveat text out of `stretch`.
            stretch = s.get("stretch", "") or ""
            for marker in LEGACY_CAVEAT_MARKERS:
                idx = stretch.find(marker)
                if idx >= 0:
                    stretch = stretch[:idx].rstrip(" \t-.:;,")
                    break
            if stretch:
                s["stretch"] = stretch
            elif "stretch" in s and not stretch:
                s["stretch"] = ""

            if d <= threshold_m:
                s["lat_original"] = lat
                s["lng_original"] = lng
                s["lat"] = round(pt[1], 6)
                s["lng"] = round(pt[0], 6)
                s["snapped_to_river_polyline"] = True
                s["osm_river_offset_m_after"] = 0
                # Clear off-polyline state from any previous run.
                s.pop("off_osm_river_polyline", None)
                s.pop("osm_coverage_caveat", None)
                audit.append(f"  SNAP  {s['name']:55s} {d:>6.0f}m -> 0m")
            else:
                s["off_osm_river_polyline"] = True
                s["osm_river_offset_m_after"] = round(d)
                # Restore the original coord (no movement when off-polyline).
                s["lat"] = lat
                s["lng"] = lng
                s.pop("snapped_to_river_polyline", None)
                s["osm_coverage_caveat"] = (
                    "Coordinate is at the named place cited in the KSPCB / "
                    "CPCB monitoring report. OpenStreetMap does not trace the "
                    "river segment through this point - in Bengaluru the river "
                    "frequently flows as a storm-drain (rajakaluve) channel "
                    "through built-up BBMP, and OSM doesn't tag those as "
                    "waterway=river. Rendered with a dashed-border marker so "
                    "the visual disconnect from the polyline reads as "
                    "intentional."
                )
                audit.append(f"  KEEP  {s['name']:55s} {d:>6.0f}m  (off-polyline)")

    rq["_osm_coverage_note"] = (
        f"River-quality stations cross-referenced against the OSM river "
        f"LineStrings. Stations within {int(threshold_m)} m of the polyline "
        "have been snapped to the nearest line point (lat_original / "
        "lng_original preserved for audit). Stations farther off carry "
        "`off_osm_river_polyline: true` plus an `osm_coverage_caveat` field "
        "explaining the disconnect; the `stretch` field stays the editorial "
        "physical-stretch description so the UI's primary station label is "
        "stable."
    )

    rq_path.write_text(json.dumps(rq, indent=2))
    print("\n".join(audit))
    print(f"\nWrote {rq_path}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True, help="e.g. bangalore")
    # Bumped from 2 km to 5 km after testing on Bengaluru: more KSPCB
    # named-place stations sit on the riverbank within 3-4 km of where
    # OSM picks up the polyline. 5 km keeps the snap honest (we're
    # moving the marker visibly toward the river, not faking precision)
    # while catching stations that the 2 km threshold was leaving
    # visually orphaned.
    ap.add_argument("--threshold-m", type=float, default=5000.0)
    args = ap.parse_args()
    snap(args.city, args.threshold_m)


if __name__ == "__main__":
    main()

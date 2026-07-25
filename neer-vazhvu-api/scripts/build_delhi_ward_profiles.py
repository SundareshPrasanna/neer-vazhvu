"""Build public/data/delhi-ward-profiles.json - per-ward joins across every
layer in the repo (Madurai profile schema + Delhi extensions).

Joins per ward (point-in-polygon with bbox prefilter; polygon layers are
attributed by centroid, drains by segment midpoint):
  - water_bodies: OSM polygon count/area + Jal Dharohar census records +
    restoration-priority flags + top bodies by area
  - lost_bodies: from the lost-water register points
  - flood: chronic waterlogging hotspots in-ward (Delhi HAS this layer)
  - drainage: OSM drain segment count + mapped km in-ward
  - sewerage: honest not_available (DJB pipelines KML with OpenCity ask)
  - jj_bastis: honest not_geocoded (no lat/lon in DUSIB PDFs; pre-2022
    ward numbers need the SEC crosswalk)
  - river_station: nearest DPCC monthly station + distance
  - representative: councillor (name/party) from the MCD-2022 results
  - population: delimitation-file TotalPop/SC_Pop; ac_name for context

Run: python scripts/build_delhi_ward_profiles.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
G = REPO / "public/geojson"
D = REPO / "public/data"

M_LAT = 111_320.0
COS = math.cos(math.radians(28.65))


def load(p: Path):
    return json.loads(p.read_text())


def rings_of(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    if geom["type"] == "MultiPolygon":
        return [poly[0] for poly in geom["coordinates"] if poly]
    return []


def in_ring(lon, lat, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def centroid_of(rings):
    pts = rings[0]
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def ring_area_km2(ring):
    a = 0.0
    for i in range(len(ring) - 1):
        a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return abs(a) / 2 * (M_LAT * COS) * M_LAT / 1e6


def dist_m(lon1, lat1, lon2, lat2):
    return math.hypot((lon2 - lon1) * M_LAT * COS, (lat2 - lat1) * M_LAT)


class WardIndex:
    def __init__(self, features):
        self.entries = []
        for f in features:
            rings = rings_of(f["geometry"])
            xs = [p[0] for r in rings for p in r]
            ys = [p[1] for r in rings for p in r]
            self.entries.append({
                "no": f["properties"]["ward_no"],
                "rings": rings,
                "bbox": (min(xs), min(ys), max(xs), max(ys)),
            })

    def find(self, lon, lat):
        for e in self.entries:
            x0, y0, x1, y1 = e["bbox"]
            if x0 <= lon <= x1 and y0 <= lat <= y1 and any(in_ring(lon, lat, r) for r in e["rings"]):
                return e["no"]
        return None


def main():
    wards = load(G / "delhi-wards-2022.geojson")["features"]
    idx = WardIndex(wards)

    osm = load(G / "delhi-water-bodies-current.geojson")["features"]
    census = load(G / "delhi-water-bodies-census.geojson")["features"]
    lost = load(D / "water-bodies-lost-delhi.json")["lost_bodies"]
    priority = load(D / "restoration-priority-delhi.json")["water_bodies"]
    hotspots = load(D / "delhi-flood-hotspots.json")["hotspots"]
    drains = load(G / "delhi-drainage.geojson")["features"]
    stations = load(D / "river-quality-delhi.json")["rivers"][0]["stations"]
    # delhi-ward-representatives.json follows the RepsFile contract:
    # {meta, wards: {"<no>": {councillor: {...}}}} (wards_detail keeps the
    # full per-ward election record).
    reps = {
        int(k): v["councillor"]
        for k, v in load(D / "delhi-ward-representatives.json")["wards"].items()
    }

    acc = {
        f["properties"]["ward_no"]: {
            "bodies": [], "census": 0, "lost": [], "hotspots": [],
            "drain_count": 0, "drain_km": 0.0,
        }
        for f in wards
    }

    for f in osm:
        rings = rings_of(f["geometry"])
        if not rings:
            continue
        lon, lat = centroid_of(rings)
        w = idx.find(lon, lat)
        if w is not None:
            acc[w]["bodies"].append(f["properties"])

    for f in census:
        lon, lat = f["geometry"]["coordinates"][:2]
        w = idx.find(lon, lat)
        if w is not None:
            acc[w]["census"] += 1

    for b in lost:
        w = idx.find(b["lng"], b["lat"])
        if w is not None:
            acc[w]["lost"].append(b["name"])

    for h in hotspots:
        w = idx.find(h["lng"], h["lat"])
        if w is not None:
            acc[w]["hotspots"].append(h["name"])

    for f in drains:
        coords = f["geometry"]["coordinates"]
        mid = coords[len(coords) // 2]
        w = idx.find(mid[0], mid[1])
        if w is not None:
            acc[w]["drain_count"] += 1
            acc[w]["drain_km"] += f["properties"].get("length_km") or 0

    pr_by_osm = {p["osm_id"]: p for p in priority if p.get("osm_id")}

    profiles = []
    for f in sorted(wards, key=lambda f: f["properties"]["ward_no"]):
        p = f["properties"]
        no = p["ward_no"]
        rings = rings_of(f["geometry"])
        lon, lat = centroid_of(rings)
        a = acc[no]

        scored = [pr_by_osm[b["osm_id"]] for b in a["bodies"] if b.get("osm_id") in pr_by_osm]
        st = min(stations, key=lambda s: dist_m(lon, lat, s["lng"], s["lat"]))
        rep = reps.get(no)

        profiles.append({
            "ward_number": no,
            "ward_name": p["ward_name"],
            "zone_no": "",
            "zone_name": "",
            "ac_no": p.get("ac_no"),
            "ac_name": p.get("ac_name"),
            "centroid": [lon, lat],
            "area_sq_km": round(sum(ring_area_km2(r) for r in rings), 3),
            "population": {"total_2022_delimitation": p.get("total_pop"), "sc": p.get("sc_pop")},
            "representative": (
                {"councillor": rep["name"], "party": rep["party"],
                 "reservation": rep.get("reservation")}
                if rep else None
            ),
            "water_bodies": {
                "current_count": len(a["bodies"]),
                "census_records": a["census"],
                "restoration_critical": sum(1 for s in scored if s["priority_level"] == "critical"),
                "restoration_high": sum(1 for s in scored if s["priority_level"] == "high"),
                "avg_restoration_score": (
                    round(sum(s["priority_score"] for s in scored) / len(scored), 1) if scored else None
                ),
                # Shape per WardProfile.water_bodies.top_bodies in
                # src/lib/hooks/use-ward-profile.ts - the card renders
                # score/level, so emit those names exactly.
                # Only SCORED bodies are listed: the card renders a
                # "score/100 + level" chip, so an unscored OSM polygon would
                # read as a genuine 0/100. Delhi's priority pass covers the
                # flagship register, so most wards list none - the count above
                # still tells the ward's story.
                "top_bodies": [
                    {
                        "name": pr.get("name") or "(unnamed)",
                        "score": pr["priority_score"],
                        "level": pr["priority_level"],
                    }
                    for pr in sorted(scored, key=lambda x: -x["priority_score"])[:3]
                ],
            },
            "lost_bodies": {"count": len(a["lost"]), "names": a["lost"]},
            "flood": {
                "chronic_hotspots": len(a["hotspots"]),
                "hotspot_names": a["hotspots"],
                "_note": "Counts Delhi's named perennial waterlogging sites. The full official lists (169 locations identified for 2025; 448 points mapped from traffic-police data) are referenced in reporting but not published as data.",
            },
            "drainage": {
                "line_count": a["drain_count"],
                "total_length_km": round(a["drain_km"], 1),
            },
            "sewerage": {
                "_data_status": "not_available",
                "_data_status_note": "DJB sewer-network KML delisted from OpenCity; restore requested. See /delhi/about data gaps.",
            },
            "jj_bastis": {
                "_data_status": "not_geocoded",
                "_data_status_note": "DUSIB's 675-cluster roster (306,521 households) has no coordinates in the public PDFs and uses pre-2022 ward numbers; per-ward attribution needs the SEC crosswalk or geocoding.",
            },
            # Key + field names per WardProfile.rivers (the card reads
            # nearest_river_id/nearest_station_id/nearest_km).
            "rivers": {
                "nearest_station_id": st["id"],
                "nearest_river_id": "yamuna",
                "nearest_km": round(dist_m(lon, lat, st["lng"], st["lat"]) / 1000, 1),
            },
            # Delhi's industrial layer is the DPCC CETP archive, not a mapped
            # zone polygon set - no per-ward zone count exists.
            "industrial": {
                "_data_status": "not_available",
                "_data_status_note": "No per-ward industrial-zone polygons published for Delhi; the DPCC CETP monthly archive (13 plants) is the industrial layer and is not ward-attributed.",
            },
        })

    out = D / "delhi-ward-profiles.json"
    out.write_text(json.dumps(profiles, ensure_ascii=False, separators=(",", ":")))
    n_bodies = sum(pf["water_bodies"]["current_count"] for pf in profiles)
    n_hot = sum(pf["flood"]["chronic_hotspots"] for pf in profiles)
    print(f"wrote {out.name}: {len(profiles)} wards | {n_bodies} bodies attributed | "
          f"{sum(pf['water_bodies']['census_records'] for pf in profiles)} census records | "
          f"{n_hot} hotspots | {round(sum(pf['drainage']['total_length_km'] for pf in profiles))} drain km in-ward")


if __name__ == "__main__":
    main()

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
    """Point-in-polygon lookup. `key` selects which property find() returns;
    pass key=None to get the whole properties dict (used for the CGWB
    district polygons, which carry class + stage inline)."""

    def __init__(self, features, key="ward_no"):
        self.key = key
        self.entries = []
        for f in features:
            rings = rings_of(f["geometry"])
            xs = [p[0] for r in rings for p in r]
            ys = [p[1] for r in rings for p in r]
            self.entries.append(
                {
                    "no": f["properties"][key] if key else f["properties"],
                    "rings": rings,
                    "bbox": (min(xs), min(ys), max(xs), max(ys)),
                }
            )

    def find(self, lon, lat):
        for e in self.entries:
            x0, y0, x1, y1 = e["bbox"]
            if (
                x0 <= lon <= x1
                and y0 <= lat <= y1
                and any(in_ring(lon, lat, r) for r in e["rings"])
            ):
                return e["no"]
        return None


def industrial_section(estates, cetps):
    """Per-ward industrial summary.

    zone_count counts named INDUSTRIAL ESTATES only, so it means the same
    thing here as in Bengaluru's profiles. CETPs are reported separately:
    a common effluent treatment plant is infrastructure serving an estate,
    not an industrial zone, and folding it into zone_count would inflate the
    count and mislead a ward-to-ward comparison.

    Utilisation is carried through because it is the finding - a plant
    running far under design capacity means the effluent is going elsewhere.
    """
    section = {
        "zone_count": len(estates),
        "zone_names": [e["name"] for e in estates[:5]],
    }
    if cetps:
        section["cetp_count"] = len(cetps)
        section["cetps"] = [
            {
                "name": c["name"],
                "design_capacity_mld": c.get("design_capacity_mld"),
                "median_utilisation_pct": c.get("median_utilisation_pct"),
            }
            for c in cetps
        ]
        # Shown next to the figures, per the transparency requirement carried
        # in industrial-sources-delhi.json's _archival note.
        section["_series_note"] = (
            "CETP flow figures are from DPCC's monthly analysis reports; the "
            "series ends November 2024 and is not live."
        )
    return section


def jj_section(clusters):
    """Per-ward JJ-basti summary.

    Household counts exist only for clusters whose location name joined to
    DUSIB's household roster, so the ward total is reported as a floor with
    the number of clusters it is missing, rather than as a ward census."""
    if not clusters:
        return {"count": 0, "households": 0, "households_is_floor": False, "names": []}
    with_hh = [c for c in clusters if c.get("households")]
    return {
        "count": len(clusters),
        "households": sum(c["households"] for c in with_hh),
        # True when at least one cluster in this ward has no household count,
        # i.e. the figure understates the ward.
        "households_is_floor": len(with_hh) < len(clusters),
        "clusters_without_households": len(clusters) - len(with_hh),
        "names": [
            c["location"]
            for c in sorted(clusters, key=lambda c: -(c.get("households") or 0))[:5]
        ],
    }


# A CGWB telemetric well further than this from the ward centroid is not
# reported: Delhi's network is 140-odd points over 1,483 sq km, and beyond
# a few km the reading says nothing about the ward.
WELL_MAX_KM = 5.0


def groundwater_section(lon, lat, gwr_idx, wells):
    """Shape per WardGroundwaterAssessment in src/lib/hooks/use-ward-profile.ts:
    the district assessment unit (Delhi assesses by district, not block) plus
    the nearest CGWB telemetric well if one falls within WELL_MAX_KM."""
    props = gwr_idx.find(lon, lat)
    block = None
    if props:
        block = {
            "name": props.get("block"),
            "class": props.get("class"),
            "development_pct": props.get("sgw_dev_pe"),
        }

    nearest_well = None
    if wells:
        w = min(wells, key=lambda w: dist_m(lon, lat, w["lng"], w["lat"]))
        km = dist_m(lon, lat, w["lng"], w["lat"]) / 1000
        if km <= WELL_MAX_KM:
            last = w["readings"][-1]
            nearest_well = {
                "name": w["name"],
                "block": w.get("district") or "",
                "distance_km": round(km, 1),
                "latest": {
                    "year": last["year"],
                    "month": last["month"],
                    "depth_m_bgl": last["depth_m_bgl"],
                },
            }

    if not block and not nearest_well:
        return None
    return {"block": block, "nearest_well": nearest_well}


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

    # DUSIB's 675 JJ bastis, geocoded from the Board's own coordinate PDF
    # (see build_delhi_jj_bastis_geo.py). Household counts are present only
    # where the location-name join to the roster succeeded, so a ward's
    # household total is a FLOOR, not a census - flagged per ward below.
    jj = load(D / "delhi-jj-bastis-geo.json")["clusters"]

    # Named industrial estates + the 13 CETPs (build_delhi_industrial_sources.py).
    # Optional so the ward build still runs before that layer is generated.
    try:
        ind_sources = load(D / "industrial-sources-delhi.json")["sources"]
    except FileNotFoundError:
        ind_sources = []

    # District-level CGWB assessment polygons + the latest class/stage per
    # district, used as the ward's "block" in the shared groundwater card.
    gwr_idx = WardIndex(load(G / "delhi-gwr-blocks.geojson")["features"], key=None)

    # CGWB telemetric wells (India-WRIS). Optional: the groundwater card falls
    # back to district class alone if the station file has not been built.
    try:
        cgwb_wells = [
            w
            for w in load(D / "delhi-cgwb-stations.json")["wells"]
            if w.get("readings") and w.get("_data_status") != "suspect"
        ]
    except FileNotFoundError:
        cgwb_wells = []

    acc = {
        f["properties"]["ward_no"]: {
            "bodies": [],
            "census": 0,
            "lost": [],
            "hotspots": [],
            "drain_count": 0,
            "drain_km": 0.0,
            "jj": [],
            "estates": [],
            "cetps": [],
        }
        for f in wards
    }

    # SMA CETP has no coordinate (not in OSM) and is skipped here by the
    # lat/lng guard: it keeps its flow series in the sources file but cannot
    # belong to a ward without inventing a position for it.
    ind_unplaced = 0
    for src in ind_sources:
        if src.get("lat") is None or src.get("lng") is None:
            ind_unplaced += 1
            continue
        w = idx.find(src["lng"], src["lat"])
        if w is None:
            ind_unplaced += 1
            continue
        bucket = "cetps" if src.get("type") == "cetp" else "estates"
        acc[w][bucket].append(src)

    # ~33 of the 675 clusters land outside every MCD ward, and correctly so:
    # they sit in the NDMC area (Lutyens - Race Course, Raisina, Talkatora,
    # Pandara Road) or the Delhi Cantonment Board, neither of which is part of
    # the 250-ward MCD delimitation. They are counted as out-of-jurisdiction
    # rather than silently dropped.
    jj_unplaced = 0
    for c in jj:
        if c.get("lat") is None or c.get("lng") is None:
            continue
        w = idx.find(c["lng"], c["lat"])
        if w is not None:
            acc[w]["jj"].append(c)
        else:
            jj_unplaced += 1

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

        scored = [
            pr_by_osm[b["osm_id"]] for b in a["bodies"] if b.get("osm_id") in pr_by_osm
        ]
        st = min(stations, key=lambda s: dist_m(lon, lat, s["lng"], s["lat"]))
        rep = reps.get(no)

        profiles.append(
            {
                "ward_number": no,
                "ward_name": p["ward_name"],
                "zone_no": "",
                "zone_name": "",
                "ac_no": p.get("ac_no"),
                "ac_name": p.get("ac_name"),
                "centroid": [lon, lat],
                "area_sq_km": round(sum(ring_area_km2(r) for r in rings), 3),
                "population": {
                    "total_2022_delimitation": p.get("total_pop"),
                    "sc": p.get("sc_pop"),
                },
                "representative": (
                    {
                        "councillor": rep["name"],
                        "party": rep["party"],
                        "reservation": rep.get("reservation"),
                    }
                    if rep
                    else None
                ),
                "water_bodies": {
                    "current_count": len(a["bodies"]),
                    "census_records": a["census"],
                    "restoration_critical": sum(
                        1 for s in scored if s["priority_level"] == "critical"
                    ),
                    "restoration_high": sum(
                        1 for s in scored if s["priority_level"] == "high"
                    ),
                    "avg_restoration_score": (
                        round(sum(s["priority_score"] for s in scored) / len(scored), 1)
                        if scored
                        else None
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
                "jj_bastis": jj_section(a["jj"]),
                # Key + field names per WardProfile.rivers (the card reads
                # nearest_river_id/nearest_station_id/nearest_km).
                "rivers": {
                    "nearest_station_id": st["id"],
                    "nearest_river_id": "yamuna",
                    "nearest_km": round(
                        dist_m(lon, lat, st["lng"], st["lat"]) / 1000, 1
                    ),
                },
                "industrial": industrial_section(a["estates"], a["cetps"]),
                "groundwater_assessment": groundwater_section(
                    lon, lat, gwr_idx, cgwb_wells
                ),
            }
        )

    out = D / "delhi-ward-profiles.json"
    out.write_text(json.dumps(profiles, ensure_ascii=False, separators=(",", ":")))
    n_bodies = sum(pf["water_bodies"]["current_count"] for pf in profiles)
    n_hot = sum(pf["flood"]["chronic_hotspots"] for pf in profiles)
    n_jj = sum(pf["jj_bastis"]["count"] for pf in profiles)
    n_hh = sum(pf["jj_bastis"]["households"] for pf in profiles)
    n_well = sum(
        1
        for pf in profiles
        if (pf.get("groundwater_assessment") or {}).get("nearest_well")
    )
    print(
        f"wrote {out.name}: {len(profiles)} wards | {n_bodies} bodies attributed | "
        f"{sum(pf['water_bodies']['census_records'] for pf in profiles)} census records | "
        f"{n_hot} hotspots | {round(sum(pf['drainage']['total_length_km'] for pf in profiles))} drain km in-ward"
    )
    print(
        f"  JJ bastis: {n_jj} clusters in {sum(1 for pf in profiles if pf['jj_bastis']['count'])} wards, "
        f"{n_hh:,} households | {jj_unplaced} outside MCD (NDMC / Cantonment)"
    )
    n_est = sum(pf["industrial"].get("zone_count", 0) for pf in profiles)
    n_cetp = sum(pf["industrial"].get("cetp_count", 0) for pf in profiles)
    print(
        f"  industrial: {n_est} estates + {n_cetp} CETPs across "
        f"{sum(1 for pf in profiles if pf['industrial'].get('zone_count'))} wards | "
        f"{ind_unplaced} unplaced (no coords / outside MCD)"
    )
    print(
        f"  groundwater: {sum(1 for pf in profiles if pf.get('groundwater_assessment'))} wards with district class, "
        f"{n_well} with a CGWB well within {WELL_MAX_KM:g} km"
    )


if __name__ == "__main__":
    main()

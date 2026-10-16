#!/usr/bin/env python3
"""
Per-ward profiles for /<city>/my-ward, joined from layers the city already ships.

City-generic: a city is an entry in CITIES naming its ward geometry and the
layers to join. Every section the city has no source for is written as
{"_data_status": "not_available", "_data_status_note": ...} with the reason,
never as a zero count, so the ward card says what is missing instead of
reporting an absence as a measurement. (Chennai, Madurai, Bengaluru and Delhi
keep their own producers; this is the shape new cities use.)

Joins (point-in-polygon on each ward's polygon):
  * water bodies: OSM polygons whose first vertex lies in the ward
  * rivers: nearest monitored river station with a coordinate, and its distance
  * groundwater: the IN-GRES assessment unit holding the ward's centroid, and
    the nearest telemetry station within NEAREST_WELL_KM with its latest month

Run:  python3 neer-vazhvu-api/scripts/build_ward_profiles.py --city ahmedabad
"""

import argparse
import json
import math
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

NEAREST_WELL_KM = 5.0

CITIES = {
    "nagpur": {
        "wards": "public/geojson/nagpur-wards-2025.geojson",
        "water_bodies": "public/geojson/nagpur-water-bodies-current.geojson",
        "river_quality": "public/data/river-quality-nagpur.json",
        "gw_units": "public/geojson/nagpur-gwr-blocks.geojson",
        "gw_blocks": "public/data/gwr-blocks-nagpur.json",
        "gw_stations": "public/data/nagpur-cgwb-stations.json",
        "sources": [
            (
                "mrsac-gatishakti-dma-wards",
                "MRSAC PM Gati Shakti ward layer (38 wards, 2025)",
                "Maharashtra Remote Sensing Applications Centre (MRSAC)",
            ),
            (
                "nmc-gis-admin-boundaries",
                "NMC GIS zone boundaries (zone names)",
                "Nagpur Municipal Corporation",
            ),
            (
                "mrsac-waterbodies-10k-2017-18",
                "MRSAC 1:10,000 water bodies, 2017-18",
                "Maharashtra Remote Sensing Applications Centre (MRSAC)",
            ),
            (
                "osm-overpass",
                "OpenStreetMap names for water bodies",
                "OpenStreetMap contributors",
            ),
            (
                "nmc-esr-river-stp-tables",
                "NMC river sampling sites (ESR 2023-24)",
                "Nagpur Municipal Corporation",
            ),
            (
                "ingres-groundwater-maharashtra",
                "IN-GRES assessment units",
                "CGWB / IIT-Hyderabad (IN-GRES)",
            ),
            (
                "nwic-nwdp-groundwater-maharashtra",
                "NWDP groundwater telemetry",
                "National Water Informatics Centre",
            ),
        ],
        "not_available": {
            "lost_bodies": "No public register of Nagpur's lost lakes has been found, so none can be placed in wards.",
            "flood": "NMC's City Disaster Management Plan 2025-26 lists the places where water collects in heavy rain by name, fire station by fire station, without locations, so they cannot be placed in wards.",
            "drainage": "We have not found NMC's storm-water drains published as a map or a file. The City Development Plan 2041 (March 2015) puts the network at about 917 km, as surveyed in 2008.",
            "sewerage": "NMC's Environment Status Report 2023-24 locates its sewage treatment plants, but we have not found a map of the sewer network, so sewer lines cannot be placed in wards.",
            "industrial": "MPCB's river action plans name the power stations and industries along the Kanhan and the Kolar, but we have not found their locations published, so they cannot be placed in wards.",
        },
    },
    "ahmedabad": {
        "wards": "public/geojson/ahmedabad-wards-2020.geojson",
        "water_bodies": "public/geojson/ahmedabad-water-bodies-current.geojson",
        "river_quality": "public/data/river-quality-ahmedabad.json",
        "gw_units": "public/geojson/ahmedabad-gwr-blocks.geojson",
        "gw_blocks": "public/data/gwr-blocks-ahmedabad.json",
        "gw_stations": "public/data/ahmedabad-cgwb-stations.json",
        "sources": [
            (
                "amc-citymap-wards",
                "AMC City Map ward layer (48 wards)",
                "Ahmedabad Municipal Corporation",
            ),
            (
                "osm-overpass",
                "OpenStreetMap water bodies",
                "OpenStreetMap contributors",
            ),
            (
                "cpcb-nwmp",
                "CPCB NWMP river stations",
                "Central Pollution Control Board",
            ),
            (
                "ingres-groundwater-gujarat",
                "IN-GRES assessment units",
                "CGWB / IIT-Hyderabad (IN-GRES)",
            ),
            (
                "nwic-nwdp-groundwater-gujarat",
                "NWDP groundwater telemetry",
                "National Water Informatics Centre",
            ),
        ],
        "not_available": {
            "lost_bodies": "No public register of Ahmedabad's lost lakes has been found, so none can be placed in wards.",
            "flood": "AMC identifies 148 waterlogging spots (July 2026) but has not published the list or their locations, so they cannot be placed in wards.",
            "drainage": "AMC reports 1,010 km of storm-water drains (Budget 2026-27) but publishes no drain geometry.",
            "sewerage": "AMC's sewage treatment plants are named in its budget and in GPCB filings, but no plant or pumping-station locations are published.",
            "industrial": "GPCB publishes no coordinates for the common effluent treatment plants or the industrial units that discharge to the Sabarmati.",
        },
    },
}


def polys_of(geom: dict) -> list:
    return [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]


def in_ring(x: float, y: float, ring: list) -> bool:
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def contains(geom: dict, x: float, y: float) -> bool:
    return any(
        in_ring(x, y, [p[:2] for p in poly[0]])
        and not any(in_ring(x, y, [p[:2] for p in h]) for h in poly[1:])
        for poly in polys_of(geom)
    )


def centroid(geom: dict) -> tuple[float, float]:
    """Area-weighted centroid of the largest polygon's outer ring."""
    ring = max((poly[0] for poly in polys_of(geom)), key=len)
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip([p[:2] for p in ring], [p[:2] for p in ring[1:]]):
        f = x1 * y2 - x2 * y1
        a += f
        cx += (x1 + x2) * f
        cy += (y1 + y2) * f
    return (cx / (3 * a), cy / (3 * a)) if a else tuple(ring[0][:2])


def km(a: tuple, b: tuple) -> float:
    lat = math.radians((a[1] + b[1]) / 2)
    return math.hypot((a[0] - b[0]) * 111.32 * math.cos(lat), (a[1] - b[1]) * 110.57)


def load(path: str):
    return json.loads((REPO_ROOT / path).read_text())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True, choices=sorted(CITIES))
    city = ap.parse_args().city
    cfg = CITIES[city]

    wards = load(cfg["wards"])["features"]
    bodies = load(cfg["water_bodies"])["features"]
    rq = load(cfg["river_quality"])
    stations = [
        (s["id"], r["id"], (s["lng"], s["lat"]))
        for r in rq["rivers"]
        for s in r["stations"]
        if s.get("lat") is not None and s.get("lng") is not None
    ]
    units = load(cfg["gw_units"])["features"]
    gw_blocks = load(cfg["gw_blocks"])["blocks"]
    latest = {b["name"]: b["latest"] for b in gw_blocks}
    # The unit's own caveat (changed inputs or area between editions) travels
    # with its figure, so a ward card never shows the percentage without it.
    caveat = {
        b["name"]: b["history_caveat"] for b in gw_blocks if b.get("history_caveat")
    }
    wells = load(cfg["gw_stations"])["wells"]

    def first_point(geom):
        return tuple(polys_of(geom)[0][0][0][:2])

    profiles = []
    for w in wards:
        p, g = w["properties"], w["geometry"]
        c = centroid(g)
        in_ward = [b for b in bodies if contains(g, *first_point(b["geometry"]))]
        near = min(stations, key=lambda s: km(c, s[2]))
        unit = next(
            (u["properties"]["block"] for u in units if contains(u["geometry"], *c)),
            None,
        )
        block = None
        if unit and unit in latest:
            block = {
                "name": unit,
                "class": latest[unit]["class"],
                "development_pct": latest[unit]["development_pct"],
            }
            if unit in caveat:
                block["note"] = caveat[unit]
        well = min(wells, key=lambda x: km(c, (x["lng"], x["lat"])))
        dist = km(c, (well["lng"], well["lat"]))
        last = well["readings"][-1] if well["readings"] else None
        profiles.append(
            {
                "ward_number": p["ward_number"],
                "ward_name": p["ward_name"],
                "zone_no": None if p["zone_no"] is None else str(p["zone_no"]),
                "zone_name": p["zone_name"],
                "centroid": [round(c[0], 6), round(c[1], 6)],
                "area_sq_km": p["area_sq_km"],
                "population_2011": p.get("population_2011"),
                "water_bodies": {
                    "current_count": len(in_ward),
                    "census_records": 0,
                    "restoration_critical": 0,
                    "restoration_high": 0,
                    "avg_restoration_score": None,
                    "top_bodies": [],
                    "named": sorted(
                        {
                            b["properties"]["name"]
                            for b in in_ward
                            if b["properties"].get("name")
                        }
                    ),
                },
                "lost_bodies": {
                    "count": 0,
                    "names": [],
                    "_data_status": "not_available",
                    "_data_status_note": cfg["not_available"]["lost_bodies"],
                },
                **{
                    k: {
                        "_data_status": "not_available",
                        "_data_status_note": cfg["not_available"][k],
                    }
                    for k in ("flood", "drainage", "sewerage", "industrial")
                },
                "rivers": {
                    "nearest_station_id": near[0],
                    "nearest_river_id": near[1],
                    "nearest_km": round(km(c, near[2]), 1),
                },
                "groundwater_assessment": {
                    "block": block,
                    "nearest_well": None
                    if dist > NEAREST_WELL_KM
                    else {
                        "name": well["name"],
                        "block": well["block"],
                        "distance_km": round(dist, 1),
                        "latest": None
                        if last is None
                        else {
                            "year": last["year"],
                            "month": last["month"],
                            "depth_m_bgl": last["depth_m_bgl"],
                        },
                    },
                },
            }
        )
        # A ward file that flags an outline caveat carries it to the ward page.
        if p.get("boundary_note"):
            profiles[-1]["boundary_note"] = p["boundary_note"]
    profiles.sort(key=lambda x: x["ward_number"])

    out = {
        "nvdm": "1.0",
        "dataset": "data-root/ward-profiles",
        "scope": {"kind": "city", "id": city},
        "provenance": {
            "sources": [
                {
                    "id": sid,
                    "title": t,
                    "publisher": pub,
                    "license": registry_license(sid),
                    "role": "input",
                }
                for sid, t, pub in cfg["sources"]
            ],
            "method": "derived",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_ward_profiles.py",
            "internal_inputs": sorted(
                {
                    cfg[k]
                    for k in (
                        "wards",
                        "water_bodies",
                        "river_quality",
                        "gw_units",
                        "gw_blocks",
                        "gw_stations",
                    )
                }
            ),
            "note": "Point-in-polygon joins of the city's shipped layers onto its ward geometry; sections without a source are marked not_available.",
        },
        "wards": profiles,
    }
    path = REPO_ROOT / "public" / "data" / f"{city}-ward-profiles.json"
    write_artifact(path, out)
    with_well = sum(1 for x in profiles if x["groundwater_assessment"]["nearest_well"])
    print(
        f"{city}: {len(profiles)} wards; {sum(x['water_bodies']['current_count'] for x in profiles)} "
        f"water bodies placed; {with_well} wards with a well within {NEAREST_WELL_KM:g} km -> {path.name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

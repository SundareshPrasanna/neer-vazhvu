#!/usr/bin/env python3
"""
Compute risk_v2_dl: a per-ward water-stress score for Delhi's 250 MCD wards,
emitted to public/data/ward-risk-delhi.json in the same schema as
ward-risk-bangalore.json / ward-risk-madurai.json / ward-risk-mumbai.json.

WHY A DIFFERENT MODEL AGAIN. Each city's composite leans on what that city
actually measures:
  - Chennai/Bangalore  groundwater-led, but Bangalore's gw_depth_m is NULL
                       (13 stations, no per-ward interpolation)
  - Mumbai             equity-led (supply hours), because CGWB excludes Mumbai
  - Delhi              BOTH are available, so risk_v2_dl uses both.

Delhi is the first city here with real per-ward groundwater depth: 237 CGWB
observation wells (India-WRIS), enough that most wards have a station within
GW_RADIUS_KM. It is also the first with a geocoded informal-settlement layer
(DUSIB's 675 JJ bastis with coordinates), so service equity is measurable
rather than proxied.

Factors, z-scored across the 250 wards (higher composite = worse):
  gw_depth        0.35  mean depth-to-water of CGWB wells within GW_RADIUS_KM
                        (deeper = worse). Delhi's defining crisis.
  gw_stage        0.20  district groundwater extraction stage % (CGWB 2025:
                        New Delhi 123.2%, Shahdara 112.2%, North East 106.0%,
                        South 103.4% are Over-Exploited)
  jj_share        0.25  JJ-basti households per 1,000 ward population - the
                        share of the ward living in settlements DJB does not
                        serve through metered household connections
  flood_exposure  0.10  chronic waterlogging hotspots in the ward
  wb_density      0.10  water bodies per sq km (INVERTED: fewer = worse)

Wards with no CGWB well inside the radius keep gw_depth_m = null and are
scored on the remaining factors renormalised, rather than being handed the
city mean - an invented depth would be indistinguishable from a measured one
in the ranking table.

Inputs (all already in the repo):
  public/geojson/delhi-wards-2022.geojson
  public/data/delhi-ward-profiles.json     (water bodies, JJ bastis, flood)
  public/data/delhi-cgwb-stations.json     (237 wells)

Run: python scripts/compute-delhi-ward-risk.py
"""

from __future__ import annotations

import json
import math
import statistics
from pathlib import Path

from nvdm_write import write_artifact

REPO = Path(__file__).resolve().parent.parent
WARDS = REPO / "public" / "geojson" / "delhi-wards-2022.geojson"
PROFILES = REPO / "public" / "data" / "delhi-ward-profiles.json"
STATIONS = REPO / "public" / "data" / "delhi-cgwb-stations.json"
OUT = REPO / "public" / "data" / "ward-risk-delhi.json"

ALGORITHM_VERSION = "risk_v2_dl"
WEIGHTS = {
    "gw_depth": 0.35,
    "gw_stage": 0.20,
    "jj_share": 0.25,
    "flood_exposure": 0.10,
    "wb_density": 0.10,
}
# A well further than this from the ward centroid says little about the ward.
GW_RADIUS_KM = 4.0

M_LAT = 110_574.0


def dist_km(lon1, lat1, lon2, lat2):
    cos = math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot((lon2 - lon1) * M_LAT * cos, (lat2 - lat1) * M_LAT) / 1000


def rings_of(geom):
    if geom["type"] == "Polygon":
        return geom["coordinates"]
    if geom["type"] == "MultiPolygon":
        return [r for poly in geom["coordinates"] for r in poly]
    return []


def centroid_of(rings):
    pts = [p for r in rings for p in r]
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def zscores(values):
    present = [v for v in values if v is not None]
    if len(present) < 2:
        return [0.0 for _ in values]
    mu = statistics.mean(present)
    sd = statistics.pstdev(present) or 1.0
    return [None if v is None else (v - mu) / sd for v in values]


def grade_for(pct):
    return "A" if pct < 20 else "B" if pct < 40 else "C" if pct < 60 else "D" if pct < 80 else "F"


def main():
    wards = json.loads(WARDS.read_text())["features"]
    # Dual-shape during the NVDM migration: legacy bare array or the wrapped
    # producer-emitted form ({ envelope..., wards: [...] }).
    profiles_doc = json.loads(PROFILES.read_text())
    profiles_list = profiles_doc if isinstance(profiles_doc, list) else profiles_doc["wards"]
    profiles = {p["ward_number"]: p for p in profiles_list}
    wells = [w for w in json.loads(STATIONS.read_text())["wells"]
             if w.get("readings") and w.get("_data_status") != "suspect"]
    print(f"{len(wards)} wards | {len(profiles)} profiles | {len(wells)} usable wells")

    rows = []
    for f in wards:
        p = f["properties"]
        no = p["ward_no"]
        prof = profiles.get(no, {})
        rings = rings_of(f["geometry"])
        lon, lat = centroid_of(rings)

        near = [(dist_km(lon, lat, w["lng"], w["lat"]), w) for w in wells]
        near = [(d, w) for d, w in near if d <= GW_RADIUS_KM]
        if near:
            gw_depth = round(statistics.mean(w["depth_latest_m_bgl"] for _, w in near), 2)
        else:
            gw_depth = None

        ga = prof.get("groundwater_assessment") or {}
        block = ga.get("block") or {}
        gw_stage = block.get("development_pct")

        pop = p.get("total_pop") or 0
        jj = prof.get("jj_bastis") or {}
        jj_hh = jj.get("households") or 0
        jj_share = round(jj_hh * 1000 / pop, 2) if pop else 0.0

        flood = prof.get("flood") or {}
        hotspots = flood.get("chronic_hotspots") or 0

        wb = prof.get("water_bodies") or {}
        area = prof.get("area_sq_km") or 0
        wb_density = round((wb.get("current_count") or 0) / area, 3) if area else 0.0

        rows.append({
            "ward_number": no,
            "ward_name": p.get("ward_name") or f"Ward {no}",
            "zone": p.get("ac_name") or "",
            "area_sq_km": round(area, 4),
            "centroid_latlng": [round(lon, 6), round(lat, 6)],
            "gw_depth_m": gw_depth,
            "gw_station_count": len(near),
            "gw_stage_pct": gw_stage,
            "gw_district": block.get("name"),
            "gw_class": block.get("class"),
            "jj_households": jj_hh,
            "jj_clusters": jj.get("count") or 0,
            "jj_households_per_1000": jj_share,
            "flood_hotspots": hotspots,
            "wb_count": wb.get("current_count") or 0,
            "wb_density_per_sqkm": wb_density,
        })

    z = {
        "gw_depth": zscores([r["gw_depth_m"] for r in rows]),
        "gw_stage": zscores([r["gw_stage_pct"] for r in rows]),
        "jj_share": zscores([r["jj_households_per_1000"] for r in rows]),
        "flood_exposure": zscores([r["flood_hotspots"] for r in rows]),
        # inverted: FEWER water bodies = worse
        "wb_density": [None if v is None else -v
                       for v in zscores([r["wb_density_per_sqkm"] for r in rows])],
    }

    for i, r in enumerate(rows):
        num = den = 0.0
        for factor, weight in WEIGHTS.items():
            val = z[factor][i]
            if val is None:
                continue
            num += val * weight
            den += weight
        # renormalise over the factors this ward actually has, so a ward with
        # no nearby well is not implicitly scored 0 on groundwater
        r["composite_zscore"] = round(num / den, 4) if den else 0.0
        r["_factors_used"] = round(den, 2)

    ordered = sorted(rows, key=lambda r: r["composite_zscore"])
    n = len(ordered)
    for idx, r in enumerate(ordered):
        pct = (idx / (n - 1)) * 100 if n > 1 else 50
        r["composite_score"] = round(pct, 1)
        r["grade"] = grade_for(pct)

    doc = {
        "algorithm_version": ALGORITHM_VERSION,
        "weights": WEIGHTS,
        "_note": (
            "Per-ward water-stress composite for Delhi's 250 MCD wards. Higher "
            "composite_score = worse. Unlike Bengaluru's composite, gw_depth_m is a "
            "MEASURED value: the mean latest depth-to-water of CGWB observation wells "
            f"within {GW_RADIUS_KM:g} km of the ward centroid. Wards with no well in "
            "range keep gw_depth_m = null and are scored on the remaining factors "
            "renormalised, never on an imputed depth. NDMC and Delhi Cantonment are "
            "outside the 250-ward MCD delimitation and are not scored."
        ),
        "_factors": {
            "gw_depth": f"mean depth-to-water (m bgl) of CGWB wells within {GW_RADIUS_KM:g} km; deeper = worse",
            "gw_stage": "district groundwater extraction stage % (CGWB 2025 assessment)",
            "jj_share": "DUSIB JJ-basti households per 1,000 ward population",
            "flood_exposure": "chronic waterlogging hotspots in the ward",
            "wb_density": "water bodies per sq km (inverted: fewer = worse)",
        },
        "sources": {
            "wards": "public/geojson/delhi-wards-2022.geojson",
            "groundwater": "public/data/delhi-cgwb-stations.json (CGWB via India-WRIS)",
            "jj_bastis": "public/data/delhi-jj-bastis-geo.json (DUSIB)",
            "profiles": "public/data/delhi-ward-profiles.json",
        },
        "wards": ordered,
    }
    write_artifact(OUT, doc)

    with_gw = sum(1 for r in ordered if r["gw_depth_m"] is not None)
    depths = [r["gw_depth_m"] for r in ordered if r["gw_depth_m"] is not None]
    print(f"wrote {OUT.relative_to(REPO)}")
    print(f"  wards with a well within {GW_RADIUS_KM:g} km: {with_gw}/{n}")
    if depths:
        print(f"  ward gw depth: median {statistics.median(depths):.1f} m, "
              f"range {min(depths):.1f}..{max(depths):.1f} m")
    print(f"  grades: " + ", ".join(
        f"{g}={sum(1 for r in ordered if r['grade'] == g)}" for g in "ABCDF"))
    print("  worst 5:")
    for r in ordered[-5:][::-1]:
        print(f"    {r['ward_number']:3d} {r['ward_name'][:22]:22s} "
              f"score={r['composite_score']:5.1f} gw={r['gw_depth_m']} "
              f"jj/1k={r['jj_households_per_1000']:6.1f} {r['gw_class']}")


if __name__ == "__main__":
    main()

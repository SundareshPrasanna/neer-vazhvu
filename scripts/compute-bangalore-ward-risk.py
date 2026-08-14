#!/usr/bin/env python3
"""
Compute a per-ward water-stress score for Bengaluru's 369 GBA wards
and emit public/data/ward-risk-bangalore.json conforming to the same
schema /bangalore/my-ward/rankings expects (matches Madurai's
ward-risk-madurai.json shape).

Methodology V0 (will refine as IISc 65 stress-ward names get ingested
+ per-ward groundwater data lands):
  - wb_density_per_sqkm: count of OSM water-body centroids that fall
    inside the ward polygon, divided by ward area
  - gw_depth_m: NULL (Bengaluru does not yet have per-ward groundwater
    depth interpolated from the 13 CGWB stations)
  - wb_health_score: 100 if the ward contains a named flagship kere
    (Bellandur, Halsoor, Hesaraghatta, Sankey, Madiwala, Jakkur etc.);
    else baseline 50
  - composite_score (higher = worse stress) is a weighted average:
      population_density (z-score) * 0.5
    - wb_density (z-score) * 0.3
    - wb_health_score (z-score) * 0.2
  - grade: A/B/C/D/F by quintile of composite_score

The composite is intentionally conservative: it leans on what we
actually have (population, ward area, water-body polygons) rather than
inventing a groundwater depth we don't measure per ward.

Run: python scripts/compute-bangalore-ward-risk.py
"""

from __future__ import annotations
import json
import statistics
from pathlib import Path
from typing import Any

from nvdm_write import write_artifact

REPO_ROOT = Path(__file__).resolve().parent.parent
WARDS_GEOJSON = REPO_ROOT / "public" / "geojson" / "bangalore-wards-2025.geojson"
PROFILES_JSON = REPO_ROOT / "public" / "data" / "bangalore-ward-profiles.json"
WATER_BODIES_GEOJSON = (
    REPO_ROOT / "public" / "geojson" / "bangalore-water-bodies-current.geojson"
)
OUT = REPO_ROOT / "public" / "data" / "ward-risk-bangalore.json"

# Named flagship kere - if a ward's polygon contains any of these by
# OSM-name match (case-insensitive substring), wb_health_score is
# bumped to 100. Otherwise 50 (baseline). Names sourced from the
# water-bodies-lost-bangalore.json + ATREE flagship inventory.
FLAGSHIP_NAMES = {
    "bellandur lake",
    "varthur lake",
    "hebbal lake",
    "ulsoor",
    "halasuru lake",
    "madiwala lake",
    "sankey tank",
    "jakkur lake",
    "agara lake",
    "hesaraghatta lake",
    "yelahanka lake",
    "lalbagh tank",
    "kempambudhi",
    "puttenahalli lake",
    "kaikondrahalli lake",
}


def point_in_polygon(lng: float, lat: float, ring: list[list[float]]) -> bool:
    """Ray-cast point-in-polygon for a single linear ring (lng, lat)."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi
        ):
            inside = not inside
        j = i
    return inside


def polygon_contains(ward_geom: dict, lng: float, lat: float) -> bool:
    """Handle Polygon / MultiPolygon ward geometries."""
    if ward_geom["type"] == "Polygon":
        rings = ward_geom["coordinates"]
        if not rings:
            return False
        if not point_in_polygon(lng, lat, rings[0]):
            return False
        # Check holes
        for hole in rings[1:]:
            if point_in_polygon(lng, lat, hole):
                return False
        return True
    if ward_geom["type"] == "MultiPolygon":
        for poly in ward_geom["coordinates"]:
            if not poly:
                continue
            if point_in_polygon(lng, lat, poly[0]):
                inside_hole = False
                for hole in poly[1:]:
                    if point_in_polygon(lng, lat, hole):
                        inside_hole = True
                        break
                if not inside_hole:
                    return True
    return False


def polygon_centroid(geom: dict) -> tuple[float, float] | None:
    """Centroid of the largest outer ring."""
    coords = None
    if geom["type"] == "Polygon" and geom["coordinates"]:
        coords = geom["coordinates"][0]
    elif geom["type"] == "MultiPolygon" and geom["coordinates"]:
        coords = max(geom["coordinates"], key=lambda p: len(p[0]) if p else 0)[0]
    if not coords or len(coords) < 3:
        return None
    cx = sum(c[0] for c in coords) / len(coords)
    cy = sum(c[1] for c in coords) / len(coords)
    return cx, cy


def zscore(value: float | None, values: list[float]) -> float:
    if value is None or not values:
        return 0.0
    mean = statistics.fmean(values)
    sd = statistics.pstdev(values) or 1.0
    return (value - mean) / sd


def grade_from_quintile(rank: int, total: int) -> str:
    if total <= 0:
        return "C"
    pct = rank / total
    if pct <= 0.20:
        return "A"
    if pct <= 0.40:
        return "B"
    if pct <= 0.60:
        return "C"
    if pct <= 0.80:
        return "D"
    return "F"


def main() -> None:
    wards_fc = json.loads(WARDS_GEOJSON.read_text())
    profiles_raw = json.loads(PROFILES_JSON.read_text())
    # Accept both the legacy bare-array shape and the NVDM wrapped form
    # ({ envelope..., wards: [...] }) the profiles producer now emits.
    profiles = profiles_raw if isinstance(profiles_raw, list) else profiles_raw["wards"]
    wbs_fc = json.loads(WATER_BODIES_GEOJSON.read_text())

    # Build a map of profiles by ward_number for fast lookup.
    profile_by_ward = {p["ward_number"]: p for p in profiles}

    # Pre-compute water-body centroids + names for the spatial join.
    wb_points: list[tuple[float, float, str, float]] = []
    for feat in wbs_fc["features"]:
        centroid = polygon_centroid(feat["geometry"])
        if not centroid:
            continue
        name = (feat["properties"].get("name") or "").strip().lower()
        area_ha = feat["properties"].get("area_ha") or 0
        wb_points.append((centroid[0], centroid[1], name, float(area_ha)))

    print(f"Loaded {len(wards_fc['features'])} wards, {len(profiles)} profiles, {len(wb_points)} water bodies", flush=True)

    # First pass: per-ward feature counts.
    ward_stats: dict[int, dict[str, Any]] = {}
    for w_feat in wards_fc["features"]:
        ward_no = w_feat["properties"].get("ward_no")
        if ward_no is None:
            continue
        profile = profile_by_ward.get(ward_no)
        if not profile:
            continue
        area_sqkm = profile.get("area_sq_km") or 0
        pop = profile.get("population_total") or 0

        wb_count = 0
        wb_area_ha = 0.0
        contains_flagship = False
        for lng, lat, name, area_ha in wb_points:
            if polygon_contains(w_feat["geometry"], lng, lat):
                wb_count += 1
                wb_area_ha += area_ha
                if not contains_flagship and name:
                    for flag in FLAGSHIP_NAMES:
                        if flag in name:
                            contains_flagship = True
                            break

        wb_density_per_sqkm = wb_count / area_sqkm if area_sqkm > 0 else 0.0
        pop_density = pop / area_sqkm if area_sqkm > 0 else 0.0
        wb_health_score = 100 if contains_flagship else 50

        ward_stats[ward_no] = {
            "ward_number": ward_no,
            "ward_name": profile.get("ward_name") or f"Ward {ward_no}",
            "zone": profile.get("zone_name") or profile.get("corporation") or "",
            "gw_depth_m": None,
            "wb_density_per_sqkm": round(wb_density_per_sqkm, 3),
            "wb_health_score": wb_health_score,
            "_pop_density": pop_density,
            "_wb_area_ha": round(wb_area_ha, 2),
            "_wb_count": wb_count,
        }

    if not ward_stats:
        print("ERROR: no wards processed", flush=True)
        return

    # Z-score normalisation for composite (higher composite = worse).
    densities = [s["wb_density_per_sqkm"] for s in ward_stats.values()]
    pop_dens = [s["_pop_density"] for s in ward_stats.values()]
    health = [s["wb_health_score"] for s in ward_stats.values()]

    # Percentiles for surfacing in the per-ward record (0-100; higher
    # percentile = better-ranked for that component, matching Madurai's
    # convention: pct_wb_density 100 = best water-body coverage in the city).
    def percentile_of(value: float, values: list[float], higher_is_better: bool) -> int:
        if not values:
            return 0
        sorted_vals = sorted(values)
        # rank: count of strictly-lesser entries
        below = sum(1 for v in sorted_vals if v < value)
        pct = (below / max(len(sorted_vals) - 1, 1)) * 100
        return round(pct if higher_is_better else 100 - pct)

    for s in ward_stats.values():
        # Inverted wb_density (lower density -> worse), positive pop_density (higher -> worse),
        # inverted wb_health (lower health -> worse).
        composite_z = (
            -zscore(s["wb_density_per_sqkm"], densities) * 0.3
            + zscore(s["_pop_density"], pop_dens) * 0.5
            - zscore(s["wb_health_score"], health) * 0.2
        )
        # Keep the z-score under composite_zscore for transparency; the
        # exposed `composite_score` is converted to a 0-100 city-wide
        # percentile rank below (matching Chennai / Madurai conventions
        # where 0 = best, 100 = worst). The raw z-score-driven sort
        # below preserves the ordering used for grade assignment.
        s["composite_zscore"] = round(composite_z, 4)
        s["pct_wb_density"] = percentile_of(
            s["wb_density_per_sqkm"], densities, higher_is_better=True
        )
        s["pct_wb_health"] = percentile_of(
            s["wb_health_score"], health, higher_is_better=True
        )
        # gw_depth_m is null for Bengaluru today (no per-ward groundwater
        # interpolation yet); the percentile reflects that.
        s["pct_gw_depth"] = None

    # Sort ascending by z-score so rank 1 = best (lowest stress) and
    # rank N = worst. composite_score then = (rank - 1) / (N - 1) * 100,
    # so a ward at the best end reads 0/100 and the worst reads 100/100
    # in the renderer (matches the Chennai / Madurai ward-risk tooltip
    # convention).
    sorted_wards = sorted(ward_stats.values(), key=lambda s: s["composite_zscore"])
    total = len(sorted_wards)
    for idx, s in enumerate(sorted_wards):
        s["grade"] = grade_from_quintile(idx + 1, total)
        s["composite_score"] = (
            round((idx) / max(1, total - 1) * 100, 1) if total > 1 else 0.0
        )

    output = {
        "algorithm_version": "bangalore-v0-pop-wb-density",
        "weights": {
            "pop_density": 0.5,
            "wb_density_per_sqkm_inverted": 0.3,
            "wb_health_score_inverted": 0.2,
        },
        "wards": [
            {
                "ward_number": s["ward_number"],
                "ward_name": s["ward_name"],
                "zone": s["zone"],
                "area_sq_km": round(profile_by_ward[s["ward_number"]].get("area_sq_km") or 0, 4),
                "centroid_latlng": profile_by_ward[s["ward_number"]].get("centroid"),
                "gw_depth_m": s["gw_depth_m"],
                "gw_station_count": 0,
                "wb_count": s["_wb_count"],
                "wb_density_per_sqkm": s["wb_density_per_sqkm"],
                "wb_health_score": s["wb_health_score"],
                "wb_health_sample_count": s["_wb_count"],
                "pct_gw_depth": s["pct_gw_depth"],
                "pct_wb_density": s["pct_wb_density"],
                "pct_wb_health": s["pct_wb_health"],
                "composite_score": s["composite_score"],
                "composite_zscore": s["composite_zscore"],
                "grade": s["grade"],
            }
            for s in sorted(ward_stats.values(), key=lambda s: s["ward_number"])
        ],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Envelope-preserving write (scripts/nvdm_write.py): keeps the NVDM
    # envelope injected by the Bangalore migration and advances produced_at.
    write_artifact(OUT, output)
    print(f"Wrote {OUT}")

    from collections import Counter
    grade_counts = Counter(s["grade"] for s in ward_stats.values())
    print(f"  grades: {dict(grade_counts)}")
    print(f"  total wards graded: {total}")
    print(f"  flagship wards (wb_health=100): {sum(1 for s in ward_stats.values() if s['wb_health_score'] == 100)}")


if __name__ == "__main__":
    main()

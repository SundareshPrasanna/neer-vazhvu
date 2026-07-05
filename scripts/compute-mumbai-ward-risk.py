#!/usr/bin/env python3
"""
Compute risk_v2_mum: a per-ward water-stress score for Mumbai's 24 BMC
administrative wards, emitted to public/data/ward-risk-mumbai.json in the
same schema as ward-risk-bangalore.json / ward-risk-madurai.json.

WHY A DIFFERENT MODEL. Mumbai is excluded from the CGWB groundwater
assessment, so the Chennai/Bangalore groundwater-led composite is not
honest here. Mumbai's defining water risk is SERVICE EQUITY (citywide
avg supply 5.37 h/day, 1 of 24 wards at 24x7 - Praja 2024) plus monsoon
FLOODING.

Factors, z-scored across the 24 wards:
  - supply_deficit  0.50  real per-ward avg water-supply HOURS (Praja 2024
                          Table 4); fewer hours = worse (INVERTED z-score).
                          Replaces the earlier slum-area-share proxy.
  - flood_exposure  0.30  chronic flooding hotspots in the ward (count)
  - river_burden    0.20  Priority-I river polyline vertices in the ward
slum_area_share is still computed + stored as context (unweighted).
composite_zscore = weighted sum; composite_score = 0-100 city percentile;
grade = A/B/C/D/F by quintile of composite.

Inputs (all already in the repo, plus DataMeet slum geometry fetched on
first run):
  public/geojson/mumbai-wards-2023.geojson
  public/data/mumbai-flood-hotspots.geojson
  public/geojson/mumbai-rivers.geojson
  public/geojson/mumbai-slum-clusters.geojson  (DataMeet, ODbL)

Run: python scripts/compute-mumbai-ward-risk.py
"""

from __future__ import annotations

import json
import math
import statistics
import sys
import urllib.request
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
WARDS = REPO / "public" / "geojson" / "mumbai-wards-2023.geojson"
FLOOD = REPO / "public" / "data" / "mumbai-flood-hotspots.geojson"
RIVERS = REPO / "public" / "geojson" / "mumbai-rivers.geojson"
SLUMS = REPO / "public" / "geojson" / "mumbai-slum-clusters.geojson"
SLUMS_URL = (
    "https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/"
    "master/Mumbai/slumClusters.geojson"
)
OUT = REPO / "public" / "data" / "ward-risk-mumbai.json"

WEIGHTS = {"supply_deficit": 0.50, "flood_exposure": 0.30, "river_burden": 0.20}

# Real per-ward average daily water-supply HOURS, from Praja Foundation's
# 2024 "Status of Civic Issues in Mumbai" report, Table 4 (citywide avg
# 5.37 h). This is the direct service-equity signal that REPLACES the
# earlier slum-area-share proxy: fewer hours = worse service = higher risk.
# Keyed by BMC admin ward code (matches mumbai-wards-2023.geojson ward_code).
SUPPLY_HOURS = {
    "A": 2.46,
    "B": 1.88,
    "C": 1.53,
    "D": 3.50,
    "E": 4.87,
    "F/N": 3.30,
    "F/S": 5.03,
    "G/N": 4.25,
    "G/S": 5.53,
    "H/E": 3.11,
    "H/W": 3.25,
    "K/E": 6.48,
    "K/W": 2.37,
    "L": 10.56,
    "M/E": 7.56,
    "M/W": 11.0,
    "N": 11.83,
    "P/N": 3.89,
    "P/S": 2.73,
    "R/C": 3.54,
    "R/N": 2.46,
    "R/S": 4.48,
    "S": 12.0,
    "T": 24.0,
}
CITYWIDE_AVG_HOURS = 5.37

# Mumbai-latitude degree -> km (for relative areas; exact projection is
# unnecessary since every ward is scored against the others).
KM_PER_DEG_LAT = 110.57
KM_PER_DEG_LNG = 111.32 * math.cos(math.radians(19.0))


def _polys(geom: dict) -> list[list[list[list[float]]]]:
    """Return a list of polygons (each = [outer_ring, *holes]) for Polygon
    or MultiPolygon."""
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return geom["coordinates"]
    return []


def _ring_in(pt, ring) -> bool:
    x, y = pt
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi
        ):
            inside = not inside
        j = i
    return inside


def contains(geom: dict, pt) -> bool:
    for poly in _polys(geom):
        if _ring_in(pt, poly[0]) and not any(_ring_in(pt, h) for h in poly[1:]):
            return True
    return False


def _ring_area_km2(ring) -> float:
    """Shoelace area of a ring in km^2 (abs)."""
    s = 0.0
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
        s += x1 * y2 - x2 * y1
    deg2 = abs(s) / 2.0
    return deg2 * KM_PER_DEG_LAT * KM_PER_DEG_LNG


def area_km2(geom: dict) -> float:
    total = 0.0
    for poly in _polys(geom):
        total += _ring_area_km2(poly[0])
        for h in poly[1:]:
            total -= _ring_area_km2(h)
    return total


def centroid(geom: dict):
    # Area-weighted centroid of the largest outer ring (good enough for a label).
    best = None
    best_a = -1.0
    for poly in _polys(geom):
        ring = poly[0]
        a = _ring_area_km2(ring)
        if a > best_a:
            best_a = a
            cx = sum(p[0] for p in ring) / len(ring)
            cy = sum(p[1] for p in ring) / len(ring)
            best = [round(cx, 6), round(cy, 6)]
    return best


def _zscore(v: float, vals: list[float]) -> float:
    if len(vals) < 2:
        return 0.0
    sd = statistics.pstdev(vals)
    if sd == 0:
        return 0.0
    return (v - statistics.mean(vals)) / sd


def _percentile(v: float, vals: list[float]) -> int:
    # Higher value -> higher percentile (worse).
    n = len(vals)
    below = sum(1 for x in vals if x < v)
    return round(below / (n - 1) * 100) if n > 1 else 0


def _grade(rank: int, total: int) -> str:
    # rank 1 = worst. Quintiles: F (worst) .. A (best).
    q = (rank - 1) / total
    if q < 0.2:
        return "F"
    if q < 0.4:
        return "D"
    if q < 0.6:
        return "C"
    if q < 0.8:
        return "B"
    return "A"


def _load(path: Path) -> dict:
    return json.loads(path.read_text())


def main() -> int:
    if not SLUMS.exists():
        print(f"Fetching slum clusters -> {SLUMS.name} …", flush=True)
        req = urllib.request.Request(
            SLUMS_URL, headers={"User-Agent": "neervazhvu-build"}
        )
        SLUMS.write_bytes(urllib.request.urlopen(req, timeout=90).read())

    wards = _load(WARDS)["features"]
    floods = _load(FLOOD)["features"]
    rivers = _load(RIVERS)["features"]
    slums = _load(SLUMS)["features"]

    # Pre-extract slum (centroid, area) and flood points and river vertices.
    slum_pts = []
    for f in slums:
        g = f.get("geometry") or {}
        if g.get("type") not in ("Polygon", "MultiPolygon"):
            continue
        c = centroid(g)
        if c:
            slum_pts.append((c, area_km2(g)))
    flood_pts = [
        f["geometry"]["coordinates"]
        for f in floods
        if f.get("geometry", {}).get("type") == "Point"
    ]
    river_verts = []
    for f in rivers:
        g = f.get("geometry") or {}
        if g.get("type") == "MultiLineString":
            for line in g["coordinates"]:
                river_verts.extend(line)

    rows = []
    for f in wards:
        g = f["geometry"]
        props = f["properties"]
        a = area_km2(g)
        code = props.get("ward_code")
        slum_area = sum(area for (c, area) in slum_pts if contains(g, c))
        slum_share = min(slum_area / a, 1.0) if a > 0 else 0.0
        flood_n = sum(1 for p in flood_pts if contains(g, p))
        river_n = sum(1 for v in river_verts if contains(g, v))
        rows.append(
            {
                "ward_number": props.get("ward_no"),
                "ward_name": props.get("ward_name"),
                "ward_code": code,
                "zone": code,
                "area_sq_km": round(a, 3),
                "centroid_latlng": (centroid(g) or [None, None])[::-1],
                # Real per-ward service equity (Praja 2024 Table 4).
                "supply_hours": SUPPLY_HOURS.get(code, CITYWIDE_AVG_HOURS),
                # Kept as context (no longer weighted): geometry-based exposure.
                "slum_area_share": round(slum_share, 4),
                "flood_hotspot_count": flood_n,
                "river_vertex_count": river_n,
            }
        )

    supply_vals = [r["supply_hours"] for r in rows]
    slum_vals = [r["slum_area_share"] for r in rows]
    flood_vals = [float(r["flood_hotspot_count"]) for r in rows]
    river_vals = [float(r["river_vertex_count"]) for r in rows]
    n = len(rows)

    for r in rows:
        # Fewer supply hours = worse service = higher risk percentile.
        r["pct_supply"] = (
            round(sum(1 for x in supply_vals if x > r["supply_hours"]) / (n - 1) * 100)
            if n > 1
            else 0
        )
        r["pct_slum"] = _percentile(r["slum_area_share"], slum_vals)
        r["pct_flood"] = _percentile(float(r["flood_hotspot_count"]), flood_vals)
        r["pct_river"] = _percentile(float(r["river_vertex_count"]), river_vals)
        r["composite_zscore"] = round(
            # supply factor INVERTED: high hours -> low risk.
            -_zscore(r["supply_hours"], supply_vals) * WEIGHTS["supply_deficit"]
            + _zscore(float(r["flood_hotspot_count"]), flood_vals)
            * WEIGHTS["flood_exposure"]
            + _zscore(float(r["river_vertex_count"]), river_vals)
            * WEIGHTS["river_burden"],
            4,
        )

    ordered = sorted(rows, key=lambda r: r["composite_zscore"])  # worst last
    total = len(ordered)
    for idx, r in enumerate(ordered):
        # rank 1 = worst (highest composite); ordered ascending so reverse.
        rank = total - idx
        r["composite_score"] = round((idx) / (total - 1) * 100, 1) if total > 1 else 0
        r["grade"] = _grade(rank, total)

    out = {
        "algorithm_version": "mumbai-v3-realsupply-2026-06",
        "weights": WEIGHTS,
        "_methodology": (
            "Equity-first ward water-stress for Mumbai's 24 BMC admin wards. "
            "supply_deficit = real per-ward average daily water-supply HOURS (Praja 2024 "
            "Table 4; fewer hours = worse service = higher risk) - this REPLACES the earlier "
            "slum-area-share proxy. flood_exposure = chronic flooding hotspots in the ward; "
            "river_burden = Priority-I river polyline vertices in the ward. slum_area_share "
            "is retained as context only (unweighted). Higher composite = worse."
        ),
        "wards": sorted(rows, key=lambda r: r["ward_number"] or 0),
    }
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"Wrote {len(rows)} wards -> {OUT}", flush=True)
    print(f"  grades: {dict(Counter(r['grade'] for r in rows))}", flush=True)
    worst = sorted(rows, key=lambda r: -r["composite_score"])[:6]
    for r in worst:
        print(
            f"  worst: {r['ward_code']:<4} {r['ward_name']:<22} "
            f"supply={r['supply_hours']}h flood={r['flood_hotspot_count']} "
            f"score={r['composite_score']} {r['grade']}",
            flush=True,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())

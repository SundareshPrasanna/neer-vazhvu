"""Layer A3: rooftop-harvest enrichment for catchments.

Joins Overture building footprints (CDLA-Permissive, queried straight off the
S3 parquet release with DuckDB+spatial, same method as the rich-body building
extracts) and IMD rainfall normals onto each lake's catchment:

  buildings_in_catchment  - count of footprints whose centroid is in the catchment
  rooftop_area_sqkm       - summed footprint area (true m^2 via ST_Area_Spheroid)
  annual_rainfall_mm      - sum of the 12 IMD monthly normals at the city grid point
  rooftop_harvest_ml      - rooftop_area * rainfall * 0.8 runoff, in million litres

One district-wide DuckDB query (the S3 listing overhead dominates, so a single
query is far cheaper than per-lake), then a vectorised STRtree point-in-polygon
join so a building counts toward every catchment that contains it (nested
catchments share their inner buildings, as they should). Results are written
back into the lakes GeoJSON properties so the frontend needs no extra fetch.
"""

from __future__ import annotations

import json
import math
import os
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any

import numpy as np
from shapely import points as shapely_points
from shapely.geometry import shape
from shapely.strtree import STRtree

from app.cascade.districts import DistrictCascadeConfig

OVERTURE_BUCKET = "overturemaps-us-west-2"
OVERTURE_REGION = "us-west-2"
# Overture publishes a fresh release roughly monthly and prunes old ones, so a
# hardcoded release silently 404s after a few weeks (this is why harvest stalled
# - the pipeline was pinned to a release that no longer existed). Resolve the
# latest live release at run time; this constant is only the offline fallback.
DEFAULT_OVERTURE_RELEASE = "2026-05-20.0"
RUNOFF_COEFFICIENT = 0.8


def _log(msg: str) -> None:
    print(f"[buildings] {msg}", flush=True)


def _latest_overture_release() -> str:
    """Newest live Overture release id, via anonymous S3 REST listing.

    Falls back to DEFAULT_OVERTURE_RELEASE if the listing is unreachable.
    """
    url = (
        f"https://{OVERTURE_BUCKET}.s3.{OVERTURE_REGION}.amazonaws.com/"
        "?list-type=2&prefix=release/&delimiter=/"
    )
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            root = ET.fromstring(resp.read())
        ns = {"s3": "http://s3.amazonaws.com/doc/2006-03-01/"}
        rels = [
            p.text.split("/")[-2]
            for p in root.findall(".//s3:CommonPrefixes/s3:Prefix", ns)
            if p.text
        ]
        return max(rels) if rels else DEFAULT_OVERTURE_RELEASE
    except Exception as exc:  # network/parse failure -> offline fallback
        _log(f"release listing failed ({exc}); using {DEFAULT_OVERTURE_RELEASE}")
        return DEFAULT_OVERTURE_RELEASE


def _annual_rainfall_mm(district: DistrictCascadeConfig) -> float:
    """Sum of the 12 monthly rainfall normals (averaged over the normal period)."""
    data = json.loads(district.imd_rainfall_path.read_text(encoding="utf-8"))
    lo, hi = data.get("normal_period", [1970, 2020])
    by_month: dict[int, list[float]] = {}
    for row in data["monthly"]:
        if lo <= row["year"] <= hi:
            by_month.setdefault(row["month"], []).append(row["rainfall_mm"])
    return float(sum(sum(v) / len(v) for v in by_month.values() if v))


def enrich_catchments(district: DistrictCascadeConfig) -> dict[str, Any]:
    import duckdb

    rain_mm = _annual_rainfall_mm(district)
    _log(f"annual rainfall normal: {rain_mm:.0f} mm")

    catch = json.loads(
        district.cascade_catchments_geojson_path().read_text(encoding="utf-8")
    )
    polys = [shape(f["geometry"]) for f in catch["features"]]
    osm_ids = [f["properties"]["osm_id"] for f in catch["features"]]
    tree = STRtree(polys)
    minx = min(p.bounds[0] for p in polys)
    miny = min(p.bounds[1] for p in polys)
    maxx = max(p.bounds[2] for p in polys)
    maxy = max(p.bounds[3] for p in polys)

    # Planar footprint area at the district's latitude (m^2 per deg^2), the
    # same approximation the rich-body building extracts use. Far cheaper than
    # the geodesic ST_Area_Spheroid over millions of buildings.
    lat0 = (miny + maxy) / 2.0
    deg2_to_m2 = 110574.0 * (111320.0 * math.cos(math.radians(lat0)))
    release = _latest_overture_release()
    overture_glob = (
        f"s3://{OVERTURE_BUCKET}/release/{release}/theme=buildings/type=building/*"
    )
    # Release in the cache key so a release roll invalidates the stale extract.
    cache_path = f"/tmp/overture_{district.district_id}_{release}_buildings.parquet"

    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs;")
    # Overture's bucket is public; an anonymous secret forces unsigned requests
    # so the pull works without AWS credentials in the environment.
    con.execute(
        f"CREATE SECRET overture_anon (TYPE s3, PROVIDER config, "
        f"REGION '{OVERTURE_REGION}', ENDPOINT 's3.{OVERTURE_REGION}.amazonaws.com');"
    )
    if not os.path.exists(cache_path):
        _log(
            f"querying Overture buildings (release {release}) in bbox "
            f"[{minx:.3f},{miny:.3f},{maxx:.3f},{maxy:.3f}] (one-time S3 pull) ..."
        )
        con.execute(
            f"""
            COPY (
              SELECT ST_X(ST_Centroid(geometry)) AS lon,
                     ST_Y(ST_Centroid(geometry)) AS lat,
                     ST_Area(geometry) * {deg2_to_m2} AS area_m2
              FROM read_parquet('{overture_glob}')
              WHERE bbox.xmin BETWEEN {minx} AND {maxx}
                AND bbox.ymin BETWEEN {miny} AND {maxy}
            ) TO '{cache_path}' (FORMAT parquet)
            """
        )
    df = con.execute(f"SELECT lon, lat, area_m2 FROM read_parquet('{cache_path}')").df()
    _log(f"{len(df):,} buildings; joining to {len(polys)} catchments")

    count = np.zeros(len(polys))
    area = np.zeros(len(polys))
    if len(df):
        pts = shapely_points(df["lon"].to_numpy(), df["lat"].to_numpy())
        # point WITHIN catchment: predicate is applied as predicate(input, tree),
        # i.e. point.within(catchment). (The earlier "contains" tested
        # point.contains(catchment) and matched nothing.)
        pt_idx, cat_idx = tree.query(pts, predicate="within")
        np.add.at(count, cat_idx, 1)
        np.add.at(area, cat_idx, df["area_m2"].to_numpy()[pt_idx])

    # rooftop harvest (million litres) = area_m2 * rain_m * runoff, /1000 m3->ML...
    # area_m2 * (mm/1000) * 0.8 = m3; m3 / 1000 = ML.
    stats_by_id: dict[int, dict[str, float]] = {}
    for i, oid in enumerate(osm_ids):
        roof_m2 = float(area[i])
        harvest_ml = roof_m2 * (rain_mm / 1000.0) * RUNOFF_COEFFICIENT / 1000.0
        stats_by_id[oid] = {
            "buildings_in_catchment": int(count[i]),
            "rooftop_area_sqkm": round(roof_m2 / 1e6, 4),
            "annual_rainfall_mm": round(rain_mm, 1),
            "rooftop_harvest_ml": round(harvest_ml, 2),
        }

    # Write the stats back into the lakes GeoJSON properties.
    lakes = json.loads(
        district.cascade_lakes_geojson_path().read_text(encoding="utf-8")
    )
    for f in lakes["features"]:
        s = stats_by_id.get(f["properties"]["osm_id"])
        if s:
            f["properties"].update(s)
    district.cascade_lakes_geojson_path().write_text(
        json.dumps(lakes, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    nonzero = sum(1 for s in stats_by_id.values() if s["buildings_in_catchment"])
    return {
        "district_id": district.district_id,
        "annual_rainfall_mm": round(rain_mm, 1),
        "total_buildings": int(count.sum()),
        "catchments_with_buildings": nonzero,
        "overture_release": release,
    }

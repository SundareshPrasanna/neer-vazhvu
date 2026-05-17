"""
T19a: Overture Maps Foundation building footprints inside Pallikaranai zones.

Companion to verify_pallikaranai_encroachment.py (which uses Google
Open Buildings v3, June 2023 release). Overture publishes building
footprints quarterly with sources from Microsoft + OSM + Google +
others - typically much fresher than the 2023 Google snapshot.

Output: public/data/rich-bodies/pallikaranai-overture-buildings.json

Latest release as of writing: 2026-04-15.0 - 2-month-old data instead
of 3-year-old.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb
from shapely.geometry import shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
OVERTURE_RELEASE = "2026-04-15.0"
OVERTURE_BUILDINGS_URL = (
    f"s3://overturemaps-us-west-2/release/{OVERTURE_RELEASE}/"
    f"theme=buildings/type=building/*"
)


def load_geom(path: Path):
    with open(path) as f:
        gj = json.load(f)
    return unary_union([shape(f["geometry"]) for f in gj["features"]])


def main():
    base = ROOT / "public/geojson/rich-bodies"
    tnswa = load_geom(base / "pallikaranai.geojson")
    osm = load_geom(base / "pallikaranai-osm-ecological.geojson")
    buffer = load_geom(base / "pallikaranai-buffer-1000m.geojson")

    gap = tnswa.difference(osm)
    halo = buffer.difference(tnswa)

    # Query bbox = TNSWA + buffer union with small margin
    union = unary_union([tnswa, buffer])
    minx, miny, maxx, maxy = union.bounds
    # Add small margin in degrees (~200m at 13N)
    pad = 0.002
    qminx, qminy, qmaxx, qmaxy = minx - pad, miny - pad, maxx + pad, maxy + pad
    print(f"Query bbox: lon {qminx:.4f}..{qmaxx:.4f}, lat {qminy:.4f}..{qmaxy:.4f}")
    print(f"Overture release: {OVERTURE_RELEASE}")
    print(f"This will fetch ~tens of MB of parquet over the network; please wait.\n")

    con = duckdb.connect(":memory:")
    con.execute("INSTALL spatial; LOAD spatial;")
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET s3_region='us-west-2';")
    con.execute(
        "CREATE OR REPLACE TEMP MACRO bbox_overlap(xmin,xmax,ymin,ymax,qxmin,qxmax,qymin,qymax)"
        " AS xmax >= qxmin AND xmin <= qxmax AND ymax >= qymin AND ymin <= qymax;"
    )

    # Pull all building geometries that fall in our query bbox.
    # We bring back WKB (binary) for shapely to interpret rather than
    # decoding geometry in SQL - simpler and works with the duckdb spatial
    # binding we have.
    sql = f"""
    SELECT
      id,
      ST_AsWKB(geometry) AS geom_wkb,
      height,
      sources
    FROM read_parquet('{OVERTURE_BUILDINGS_URL}',
                      filename=true, hive_partitioning=1)
    WHERE bbox.xmin BETWEEN {qminx} AND {qmaxx}
      AND bbox.ymin BETWEEN {qminy} AND {qmaxy}
    """
    print("Querying Overture buildings parquet (this can take a couple of minutes)...")
    rows = con.execute(sql).fetchall()
    print(f"  fetched {len(rows):,} candidate buildings in query bbox\n")

    if not rows:
        print("No buildings returned - verify bbox + release path.", file=sys.stderr)
        sys.exit(1)

    # Parse geometry once per row; compute centroid for inside-polygon test
    from shapely import wkb as shapely_wkb

    buildings = []
    for row in rows:
        try:
            geom = shapely_wkb.loads(bytes(row[1]))
        except Exception:
            continue
        if geom.is_empty:
            continue
        centroid = geom.centroid
        # Approximate area in m^2 using equirectangular at 13N
        # (proper utm reprojection is overkill for a quick count + area)
        deg_to_m = 111320 * 0.974  # cos(13deg)
        area_m2 = geom.area * (deg_to_m**2)
        buildings.append({
            "id": row[0],
            "centroid": centroid,
            "area_m2": area_m2,
            "height": row[2],
        })

    def summarise(name: str, region) -> dict:
        inside = [b for b in buildings if region.contains(b["centroid"])]
        count = len(inside)
        area_ha = sum(b["area_m2"] for b in inside) / 10000
        with_height = sum(1 for b in inside if b["height"] is not None)
        return {
            "region": name,
            "building_count": count,
            "building_area_ha": round(area_ha, 2),
            "with_height_metadata": with_height,
        }

    regions = [
        ("TNSWA gazetted (full)", tnswa),
        ("OSM ecological (full)", osm),
        ("Gap: TNSWA - OSM", gap),
        ("Halo: 1km buffer - TNSWA (NGT no-build zone)", halo),
    ]

    summaries = []
    print(f"{'region':<55} {'count':>8} {'area_ha':>10} {'w/height':>10}")
    for name, region in regions:
        s = summarise(name, region)
        # Region area in ha via UTM-ish approximation
        utm_area_ha = region.area * (111320 * 0.974) ** 2 / 10000
        s["region_area_ha"] = round(utm_area_ha, 2)
        s["built_up_fraction_pct"] = (
            round(100 * s["building_area_ha"] / utm_area_ha, 2) if utm_area_ha > 0 else 0
        )
        summaries.append(s)
        print(f"{name:<55} {s['building_count']:>8,} {s['building_area_ha']:>10.2f} {s['with_height_metadata']:>10,}")

    payload = {
        "body_id": "pallikaranai",
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "data_source": {
            "dataset": f"Overture Maps Foundation - buildings ({OVERTURE_RELEASE})",
            "release_date": "2026-04-15",
            "url_root": OVERTURE_BUILDINGS_URL,
            "license": "CDLA-Permissive 2.0",
            "method": (
                "Per-building polygon download via DuckDB+spatial+httpfs query on the "
                "Overture parquet release filtered by chip bbox. Buildings counted "
                "as inside a region when their centroid is within the region polygon. "
                "Area summed from each footprint's planar area at 13N."
            ),
            "providers": "Microsoft + OpenStreetMap + Google + other partners (combined and deduplicated by Overture)",
            "known_limitations": [
                "Updates quarterly; this release reflects data through approximately Q1 2026.",
                "May still under-detect very recent informal construction.",
                "Centroid-in-polygon test slightly miscounts buildings straddling a polygon edge.",
                "Height metadata is sparse (mostly null) outside known dense urban cores.",
            ],
        },
        "regions": summaries,
        "headline_for_v0": _build_headline(summaries),
        "comparison_note": (
            "Compare side-by-side with the Google Open Buildings v3 numbers in "
            "pallikaranai-open-buildings-verification.json (2023 release). "
            "Delta indicates construction since 2023."
        ),
    }

    out_path = ROOT / "public/data/rich-bodies/pallikaranai-overture-buildings.json"
    out_path.write_text(json.dumps(payload, indent=2))
    print(f"\nWrote {out_path}")
    print("\n=== Headline ===")
    for line in payload["headline_for_v0"]:
        print(f"  {line}")


def _build_headline(summaries: list[dict]) -> list[str]:
    by = {r["region"]: r for r in summaries}
    gazette = by["TNSWA gazetted (full)"]
    halo = by["Halo: 1km buffer - TNSWA (NGT no-build zone)"]
    return [
        f"Inside the 1,247 ha gazetted Ramsar boundary: {gazette['building_count']:,} buildings "
        f"covering {gazette['building_area_ha']:.0f} ha ({gazette['built_up_fraction_pct']:.1f}%).",
        f"Inside the 1 km NGT no-build halo: {halo['building_count']:,} buildings "
        f"covering {halo['building_area_ha']:.0f} ha ({halo['built_up_fraction_pct']:.1f}%).",
    ]


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)

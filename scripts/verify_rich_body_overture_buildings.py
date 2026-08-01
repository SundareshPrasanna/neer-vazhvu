"""
T19a: Overture Maps Foundation building footprints inside Pallikaranai zones.

Companion to verify_pallikaranai_encroachment.py (which uses Google
Open Buildings v3, June 2023 release). Overture publishes building
footprints quarterly with sources from Microsoft + OSM + Google +
others - typically much fresher than the 2023 Google snapshot.

Output: public/data/rich-bodies/pallikaranai-overture-buildings.json

Anomaly detection: when re-running this script (e.g. on a quarterly
cron after a new Overture release), the new count is delta-checked
against the previous JSON. If any zone's building count changes by
more than ANOMALY_DELTA_PCT, the script exits non-zero AND writes
the new payload to review-candidates/ instead of overwriting the
canonical path - so a CI workflow can fail loudly and require human
review before publication.

Usage:
  python scripts/verify_pallikaranai_overture_buildings.py
    --body-id pallikaranai
    [--release 2026-04-15.0]
    [--anomaly-pct 20]
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from registry_license import registry_license
from nvdm_write import write_artifact

import duckdb
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _rich_body_zones import load_body_zones, ZONE_BODY, ZONE_HALO  # noqa: E402

DEFAULT_ANOMALY_PCT = 20.0  # any zone changing > this triggers review

# Overture retires old releases from the public bucket (the pinned
# 2026-04-15.0 vanished and broke the June refresh), so the default is
# discovered from the bucket's own listing rather than pinned.
OVERTURE_LIST_URL = (
    "https://overturemaps-us-west-2.s3.amazonaws.com/"
    "?list-type=2&prefix=release/&delimiter=/"
)


def latest_overture_release() -> str:
    """Newest release id in the public bucket (ids sort as dates)."""
    import re
    import urllib.request

    with urllib.request.urlopen(OVERTURE_LIST_URL, timeout=60) as resp:
        xml = resp.read().decode()
    releases = re.findall(r"<Prefix>release/([^/<]+)/</Prefix>", xml)
    if not releases:
        raise RuntimeError(
            f"no releases found at {OVERTURE_LIST_URL} - bucket layout changed?"
        )
    return sorted(releases)[-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-id", default="pallikaranai")
    ap.add_argument("--release", default=None,
                    help="Overture release id; default = newest in the bucket")
    ap.add_argument("--anomaly-pct", type=float, default=DEFAULT_ANOMALY_PCT,
                    help="Flag any zone whose count changes by more than this percent vs the previous JSON.")
    args = ap.parse_args()
    body_id = args.body_id
    release = args.release or latest_overture_release()
    overture_url = (
        f"s3://overturemaps-us-west-2/release/{release}/"
        f"theme=buildings/type=building/*"
    )

    zones = load_body_zones(ROOT, body_id, buffer_metres=1000)
    primary = zones[ZONE_BODY]
    halo = zones[ZONE_HALO]

    # Query bbox = primary + halo union with small margin
    union = unary_union([primary, halo])
    minx, miny, maxx, maxy = union.bounds
    # Add small margin in degrees (~200m at 13N)
    pad = 0.002
    qminx, qminy, qmaxx, qmaxy = minx - pad, miny - pad, maxx + pad, maxy + pad
    print(f"Body: {body_id}")
    print(f"Query bbox: lon {qminx:.4f}..{qmaxx:.4f}, lat {qminy:.4f}..{qmaxy:.4f}")
    print(f"Overture release: {release}")
    print(f"Anomaly threshold: ±{args.anomaly_pct}%")
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
    FROM read_parquet('{overture_url}',
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

    # Use the same zone set the other verify scripts emit so the UI has
    # consistent names across data sources.
    regions = list(zones.items())

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
        "body_id": body_id,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "data_source": {
            "dataset": f"Overture Maps Foundation - buildings ({release})",
            "release_date": release.split(".")[0],
            "url_root": overture_url,
            "license": registry_license("overture-buildings"),
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

    out_path = ROOT / "public/data/rich-bodies" / f"{body_id}-overture-buildings.json"
    # Review candidates live OUTSIDE public/ (round-4 review: anything under
    # public/ is statically served regardless of extension - a suffix trick
    # kept it out of the catalogue but not out of serving). Acceptance =
    # move the file over the canonical path (envelope already inherited).
    candidate_dir = ROOT / "review-candidates"
    candidate_dir.mkdir(exist_ok=True)
    candidate_path = candidate_dir / f"{body_id}-overture-buildings.candidate.json"

    # Anomaly detection: compare against the previously published JSON
    anomalies = _detect_anomalies(out_path, payload, args.anomaly_pct)
    if anomalies:
        write_artifact(candidate_path, payload, envelope_from=out_path)
        print(f"\n!! ANOMALY DETECTED in {len(anomalies)} zone(s):")
        for a in anomalies:
            print(
                f"   {a['region']}: {a['old']} → {a['new']}  "
                f"({a['delta_pct']:+.1f}% vs threshold ±{args.anomaly_pct}%)"
            )
        print(f"\nWrote candidate to {candidate_path}")
        print(f"Canonical {out_path.name} NOT overwritten - human review required.")
        rel_cand = candidate_path.relative_to(ROOT)
        rel_out = out_path.relative_to(ROOT)
        print(f"To accept: mv {rel_cand} {rel_out} && git add -A")
        sys.exit(2)

    write_artifact(out_path, payload)
    # Clean up any stale candidate file from a previous failed run
    if candidate_path.exists():
        candidate_path.unlink()
    print(f"\nWrote {out_path}")
    print("\n=== Headline ===")
    for line in payload["headline_for_v0"]:
        print(f"  {line}")


def _detect_anomalies(out_path: Path, new_payload: dict, threshold_pct: float) -> list[dict]:
    """Compare new count vs previous JSON on disk. Return list of zones that exceed threshold."""
    if not out_path.exists():
        return []  # first run, nothing to compare against
    try:
        old = json.loads(out_path.read_text())
    except (json.JSONDecodeError, OSError):
        return []
    old_by_region = {r["region"]: r for r in old.get("regions", [])}
    flagged: list[dict] = []
    for r_new in new_payload["regions"]:
        r_old = old_by_region.get(r_new["region"])
        if not r_old:
            continue
        old_count = int(r_old.get("building_count", 0))
        new_count = int(r_new.get("building_count", 0))
        if old_count == 0:
            continue
        delta_pct = ((new_count - old_count) / old_count) * 100
        if abs(delta_pct) > threshold_pct:
            flagged.append({
                "region": r_new["region"],
                "old": old_count,
                "new": new_count,
                "delta_pct": delta_pct,
            })
    return flagged


def _build_headline(summaries: list[dict]) -> list[str]:
    by = {r["region"]: r for r in summaries}
    body = by.get(ZONE_BODY)
    halo = by.get(ZONE_HALO)
    out: list[str] = []
    if body:
        out.append(
            f"Inside primary boundary: {body['building_count']:,} buildings "
            f"covering {body['building_area_ha']:.0f} ha ({body['built_up_fraction_pct']:.1f}%)."
        )
    if halo:
        out.append(
            f"Inside 1 km halo: {halo['building_count']:,} buildings "
            f"covering {halo['building_area_ha']:.0f} ha ({halo['built_up_fraction_pct']:.1f}%)."
        )
    return out


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)

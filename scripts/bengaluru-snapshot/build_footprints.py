"""Fixed footprint per custody-list lake (methodology note section 7.3, snapshot
build step 4).

  footprint = OSM polygon  UNION  Sentinel-2 observed maximum water extent

The observed maximum is the per-pixel water occurrence over the whole L2A archive
(MNDWI > 0 on Cloud Score+ clear pixels, 2017-03-28 to the run date), kept where
occurrence >= OCC_THRESH and the pixel has >= MIN_CLEAR clear observations, then
vectorised and restricted to the connected water touching the OSM polygon. Other
OSM water polygons (buffered EXCL_BUFFER_M) are masked out first so a neighbouring
tank does not merge in across a bund. The search halo around the OSM polygon
starts at HALOS_M[0] and widens whenever the water reaches the halo edge, so a
mis-sized OSM polygon (BDA's 2 ha Ramasandra) is governed by the observed water.

Also written per footprint: the shoreline ring width (10 m; 20 m at >= 50 ha),
interior pixel counts at 10 m and 20 m, the share of the footprint within 100 m
of shore (adjacency exposure), the sensitivity of the observed area to the
occurrence threshold, the share of the OSM polygon never seen as water, and the
boundary-provenance confidence class (section 16.4: observed maximum = Medium,
mapped only = Low; an "unverified" spine assignment is Low regardless).

Outputs (docs/research/bengaluru-lakes/data/):
  gba-lakes-footprints.geojson   one feature per lake with a polygon
  gba-lakes-footprints.csv       the same properties as a table
  footprint-params.json          methods-as-data for this step
  unassessed-lms-water-probe.csv (--probe-unassessed) water seen near the LMS
                                 point of each polygon-less row, and whether an
                                 OSM polygon already covers it

Per-lake GEE responses are cached under .cache/bengaluru-snapshot/footprints/ so
a re-run only recomputes what is missing (--force to ignore the cache).

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python \
       scripts/bengaluru-snapshot/build_footprints.py [--only gba-bda-003,...] [--workers 4]
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pyproj import Transformer
from shapely import make_valid, set_precision
from shapely.geometry import MultiPolygon, Point, Polygon, mapping, shape
from shapely.ops import transform as shp_transform, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs/research/bengaluru-lakes/data"
GEO = ROOT / "public/geojson"
CACHE = ROOT / ".cache/bengaluru-snapshot/footprints"
load_dotenv(ROOT / "neer-vazhvu-api" / ".env")

import ee  # noqa: E402

# ---- published parameters (also written to footprint-params.json) ------------
S2_SR = "COPERNICUS/S2_SR_HARMONIZED"
CS_PLUS = "GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED"
CS_BAND, CS_THRESH = "cs_cdf", 0.60
START = "2017-03-28"                 # two-satellite operation (section 11)
CRS, SCALE = "EPSG:32643", 10        # UTM 43N, the S2 tile grid over Bengaluru
T_WATER_MNDWI = 0.0                  # MNDWI > 0 = water (Xu 2006); no NDVI ceiling
                                     # here: the footprint is the lakebed, mats included
OCC_THRESH = 0.05                    # observed maximum = water on >= 5% of clear obs
OCC_SENSITIVITY = [0.05, 0.10, 0.25, 0.50]
MIN_CLEAR = 20                       # clear observations a pixel needs to be judged
HALOS_M = [250, 500, 1000]           # search radius around the OSM polygon, widened
                                     # while the water reaches the halo edge
EXCL_BUFFER_M = 15                   # other OSM water is masked out with this buffer
OSM_TOUCH_M = 20                     # a water component counts if within this of OSM
RING_M, RING_M_LARGE, LARGE_HA = 10, 20, 50   # section 7.3 shoreline ring
OPEN_M = 10                          # morphological opening: drops water narrower
                                     # than 2 px (channels, spillways) from the
                                     # observed maximum; they hold no interior pixel
SIMPLIFY_M = 1.0
VERSION = "footprints-v1"

TO_UTM = Transformer.from_crs("EPSG:4326", CRS, always_xy=True).transform
TO_WGS = Transformer.from_crs(CRS, "EPSG:4326", always_xy=True).transform


def utm(g):
    return shp_transform(TO_UTM, g)


def wgs(g):
    return shp_transform(TO_WGS, g)


def init_ee() -> None:
    project = os.environ["GEE_CLOUD_PROJECT"]
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    email = json.load(open(key_file))["client_email"]
    ee.Initialize(credentials=ee.ServiceAccountCredentials(email, key_file=key_file), project=project)


def ee_geom(g) -> ee.Geometry:
    return ee.Geometry(mapping(g), "EPSG:4326", False)


def occurrence(end: str) -> ee.Image:
    """Bands: occ (water share of clear obs, masked under MIN_CLEAR), clear (count)."""
    def prep(img):
        clear = img.select(CS_BAND).gte(CS_THRESH)
        g, s = img.select("B3"), img.select("B11")
        water = g.subtract(s).divide(g.add(s)).gt(T_WATER_MNDWI).And(clear)
        return clear.rename("clear").addBands(water.rename("water"))

    coll = (ee.ImageCollection(S2_SR).filterDate(START, end)
            .linkCollection(ee.ImageCollection(CS_PLUS), [CS_BAND]).map(prep))
    counts = coll.sum()
    clear = counts.select("clear")
    occ = counts.select("water").divide(clear).updateMask(clear.gte(MIN_CLEAR)).rename("occ")
    return occ.addBands(clear)


def lake_request(occ_img: ee.Image, osm_wgs, halo_m: int, excl_wgs) -> dict:
    """One GEE round trip: the observed-maximum component(s) touching the OSM
    polygon inside the halo, plus occurrence statistics."""
    osm = ee_geom(osm_wgs)
    halo = osm.buffer(halo_m)
    occ = occ_img.select("occ")
    water = occ.gte(OCC_THRESH)
    if excl_wgs is not None and not excl_wgs.is_empty:
        inside_excl = ee.Image.constant(0).paint(ee.FeatureCollection([ee.Feature(ee_geom(excl_wgs))]), 1)
        water = water.And(inside_excl.Not())
    vectors = water.selfMask().reduceToVectors(
        geometry=halo, scale=SCALE, crs=CRS, geometryType="polygon",
        eightConnected=False, labelProperty="w", maxPixels=int(1e9))
    comp = vectors.filterBounds(osm.buffer(OSM_TOUCH_M))
    comp_geom = comp.geometry(1).transform("EPSG:4326", 1)
    union = comp_geom.union(osm, 1)
    area = ee.Image.pixelArea()
    sens = {}
    for t in OCC_SENSITIVITY:
        sens[f"area_occ_{int(t*100):02d}"] = (occ.gte(t).multiply(area)
                                              .reduceRegion(ee.Reducer.sum(), union, SCALE, CRS, maxPixels=int(1e9)).get("occ"))
    osm_stats = occ_img.select("occ").addBands(occ.gte(OCC_THRESH).rename("wet")) \
        .addBands(occ_img.select("clear")) \
        .reduceRegion(ee.Reducer.mean().combine(ee.Reducer.median(), sharedInputs=True), osm, SCALE, CRS, maxPixels=int(1e9))
    props = ee.Dictionary(sens).combine(osm_stats).set("halo_m", halo_m)
    feat = ee.Feature(comp_geom, props)
    return feat.getInfo()


def with_retry(fn, tries=4):
    for i in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            time.sleep(5 * (i + 1))
            print(f"    retry {i+1}: {str(e)[:120]}", file=sys.stderr)


def build_one(spine_id: str, osm_wgs, excl_wgs, occ_img, force: bool) -> dict:
    """Widen the halo until the observed water stops touching its edge; cache
    each GEE response by halo."""
    out = {}
    for halo_m in HALOS_M:
        cp = CACHE / f"{spine_id}-{halo_m}.json"
        if cp.exists() and not force:
            resp = json.loads(cp.read_text())
        else:
            resp = with_retry(lambda: lake_request(occ_img, osm_wgs, halo_m, excl_wgs))
            cp.write_text(json.dumps(resp))
        out = resp
        geom = resp.get("geometry")
        comp = shape(geom) if geom and geom.get("coordinates") else None
        if comp is None or comp.is_empty:
            break
        halo_u = utm(osm_wgs).buffer(halo_m)
        comp_u = opened(utm(comp))
        if comp_u.is_empty or comp_u.distance(halo_u.exterior) > SCALE * 1.5:
            break
        if halo_m == HALOS_M[-1]:
            out["halo_truncated"] = True
    return out


def opened(g_utm):
    """Opening by OPEN_M: removes appendages narrower than 2 * OPEN_M."""
    return g_utm.buffer(-OPEN_M).buffer(OPEN_M)


def ring_for(area_ha: float) -> int:
    return RING_M_LARGE if area_ha >= LARGE_HA else RING_M


def clean_polygon(g):
    """Keep polygons only, fix validity, drop slivers under one pixel."""
    if g is None or g.is_empty:
        return None
    g = set_precision(make_valid(g), 0.01).buffer(0)
    parts = [p for p in (g.geoms if hasattr(g, "geoms") else [g]) if isinstance(p, Polygon) and p.area >= SCALE * SCALE]
    if not parts:
        return None
    return parts[0] if len(parts) == 1 else MultiPolygon(parts)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated spine_ids")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--end", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    ap.add_argument("--probe-unassessed", action="store_true", help="also probe the polygon-less rows' LMS points")
    ap.add_argument("--out-dir", help="write outputs here instead of the data dir (test runs with --only)")
    args = ap.parse_args()
    out_dir = Path(args.out_dir) if args.out_dir else DATA
    CACHE.mkdir(parents=True, exist_ok=True)
    init_ee()
    occ_img = occurrence(args.end)

    spine_rows = list(csv.DictReader(open(DATA / "gba-lakes-spine.csv")))
    spine_geo = {f["properties"]["spine_id"]: shape(f["geometry"]) for f in json.load(open(DATA / "gba-lakes-spine.geojson"))["features"]}
    polys = json.load(open(GEO / "bangalore-water-bodies-current.geojson"))["features"]
    poly_geoms = [shape(f["geometry"]) for f in polys]
    tree = STRtree(poly_geoms)
    osm_by_id = {f["properties"]["osm_id"]: i for i, f in enumerate(polys)}

    def exclusion_for(osm_wgs, halo_m: int):
        """Other OSM water inside the widest halo, minus polygons that duplicate
        this lake (overlap > 10% of the smaller), buffered EXCL_BUFFER_M."""
        halo_wgs = wgs(utm(osm_wgs).buffer(halo_m + EXCL_BUFFER_M))
        keep = []
        for j in tree.query(halo_wgs):
            gj = poly_geoms[j]
            if not gj.intersects(halo_wgs):
                continue
            inter = gj.intersection(osm_wgs).area
            if inter > 0 and inter / min(gj.area, osm_wgs.area) > 0.10:
                continue
            keep.append(utm(gj).buffer(EXCL_BUFFER_M))
        return wgs(unary_union(keep)) if keep else None

    todo = [r for r in spine_rows if r["spine_id"] in spine_geo]
    if args.only:
        want = set(args.only.split(","))
        todo = [r for r in todo if r["spine_id"] in want]
    print(f"footprints for {len(todo)} lakes, end {args.end}, workers {args.workers}")

    results: dict[str, dict] = {}

    def work(row):
        sid = row["spine_id"]
        osm_wgs = spine_geo[sid]
        excl = exclusion_for(osm_wgs, HALOS_M[-1])
        t0 = time.time()
        resp = build_one(sid, osm_wgs, excl, occ_img, args.force)
        return sid, resp, excl, time.time() - t0

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(work, r): r for r in todo}
        done = 0
        for fut in as_completed(futs):
            row = futs[fut]
            try:
                sid, resp, excl, dt = fut.result()
            except Exception as e:  # noqa: BLE001
                print(f"  FAILED {row['spine_id']} {row['ktcda_name']}: {e}", file=sys.stderr)
                continue
            results[sid] = (resp, excl)
            done += 1
            p = resp.get("properties", {})
            print(f"  [{done}/{len(todo)}] {sid} {row['ktcda_name'][:32]:<32} halo {p.get('halo_m')} m "
                  f"osm {float(row['area_ha']):.1f} ha obs05 {(p.get('area_occ_05') or 0)/1e4:.1f} ha  {dt:.0f}s")

    features, table = [], []
    for row in todo:
        sid = row["spine_id"]
        if sid not in results:
            continue
        resp, excl = results[sid]
        p = resp.get("properties", {})
        osm_wgs = spine_geo[sid]
        osm_u = set_precision(make_valid(utm(osm_wgs)), 0.01).buffer(0)
        geom = resp.get("geometry")
        comp_u = clean_polygon(opened(utm(shape(geom)))) if geom and geom.get("coordinates") else None
        fp_u = clean_polygon(unary_union([osm_u] + ([comp_u] if comp_u is not None else [])))
        fp_u = fp_u.simplify(SIMPLIFY_M, preserve_topology=True)
        area_ha = fp_u.area / 1e4
        ring = ring_for(area_ha)
        interior = fp_u.buffer(-ring)
        obs_outside_osm_ha = (comp_u.difference(osm_u).area / 1e4) if comp_u is not None else 0.0
        osm_outside_obs_ha = (osm_u.difference(comp_u).area / 1e4) if comp_u is not None else osm_u.area / 1e4
        shore100 = 1 - fp_u.buffer(-100).area / fp_u.area
        wet_share = p.get("wet_mean")
        clear_med = p.get("clear_median")
        unverified = "unverified" in (row.get("note") or "").lower()
        never_water = comp_u is None
        dominates = comp_u is not None and obs_outside_osm_ha > osm_u.area / 1e4
        # Low when the boundary rests on one source alone: an unverified mapping,
        # no observed water to corroborate it, or observed water that contradicts it
        conf = "low" if (unverified or never_water or dominates) else "medium"
        flags = []
        if never_water:
            flags.append("no_water_observed")
        if wet_share is not None and wet_share < 0.5:
            flags.append("osm_mostly_dry")
        if dominates:
            flags.append("observed_max_dominates")
        if resp.get("halo_truncated"):
            flags.append("halo_truncated")
        if unverified:
            flags.append("assignment_unverified")
        adjacent = []
        fp_wgs_probe = wgs(fp_u.buffer(EXCL_BUFFER_M))
        for j in tree.query(fp_wgs_probe):
            pj = polys[j]["properties"]
            if pj["osm_id"] == int(row["osm_id"]):
                continue
            if poly_geoms[j].intersects(fp_wgs_probe):
                adjacent.append(f"{pj['osm_id']}:{pj.get('name') or ''}")
        props = {
            "spine_id": sid, "ktcda_key": row["ktcda_key"], "ktcda_name": row["ktcda_name"],
            "ktcda_custodian": row["ktcda_custodian"], "osm_id": int(row["osm_id"]), "osm_name": row["osm_name"],
            "corporation": row["corporation"], "ward_name": row["ward_name"],
            "osm_area_ha": round(osm_u.area / 1e4, 2),
            "observed_max_area_ha": round(comp_u.area / 1e4, 2) if comp_u is not None else 0.0,
            "footprint_area_ha": round(area_ha, 2),
            "observed_outside_osm_ha": round(obs_outside_osm_ha, 2),
            "osm_outside_observed_ha": round(osm_outside_obs_ha, 2),
            "osm_wet_share": round(wet_share, 3) if wet_share is not None else None,
            "osm_occ_mean": round(p["occ_mean"], 3) if p.get("occ_mean") is not None else None,
            "clear_obs_median": int(clear_med) if clear_med is not None else None,
            **{k: round(v / 1e4, 2) if v is not None else None for k, v in ((k, p.get(k)) for k in (f"area_occ_{int(t*100):02d}" for t in OCC_SENSITIVITY))},
            "halo_m": p.get("halo_m"),
            "ring_m": ring,
            "interior_area_ha": round(interior.area / 1e4, 2),
            "interior_px_10m": int(interior.area / 100),
            "interior_px_20m": int(interior.area / 400),
            "ring_share": round(1 - interior.area / fp_u.area, 3),
            "shore100_share": round(shore100, 3),
            "boundary_provenance": "osm+observed_max" if comp_u is not None else "osm_only",
            "boundary_confidence": conf,
            "flags": ";".join(flags),
            "adjacent_osm": ";".join(adjacent[:6]),
        }
        features.append({"type": "Feature", "geometry": mapping(wgs(fp_u)), "properties": props})
        table.append(props)

    features.sort(key=lambda f: f["properties"]["spine_id"])
    table.sort(key=lambda r: r["spine_id"])
    if not args.only or args.out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        json.dump({"type": "FeatureCollection", "features": features}, open(out_dir / "gba-lakes-footprints.geojson", "w"))
        with open(out_dir / "gba-lakes-footprints.csv", "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(table[0].keys())); w.writeheader(); w.writerows(table)
        params = {
            "version": VERSION, "computed_at": datetime.now(timezone.utc).isoformat(),
            "date_range": [START, args.end],
            "dataset": S2_SR, "cloud_mask": f"{CS_PLUS} {CS_BAND} >= {CS_THRESH}",
            "water_rule": f"MNDWI (B3, B11) > {T_WATER_MNDWI} on clear pixels; no NDVI ceiling (lakebed, mats included)",
            "occurrence_threshold": OCC_THRESH, "occurrence_sensitivity": OCC_SENSITIVITY,
            "min_clear_observations_per_pixel": MIN_CLEAR,
            "grid": {"crs": CRS, "scale_m": SCALE, "note": "B11 is 20 m native, resampled; the observed maximum is a 20 m product"},
            "halo_rule": {"halos_m": HALOS_M, "widen_when": "observed water within 15 m of the halo edge"},
            "exclusion": {"other_osm_water_buffer_m": EXCL_BUFFER_M, "duplicate_overlap_share": 0.10},
            "component_rule": f"4-connected water within {OSM_TOUCH_M} m of the OSM polygon",
            "footprint": f"OSM polygon union observed-maximum component(s) after an opening of {OPEN_M} m; simplified 1 m; slivers under one pixel dropped",
            "ring_rule": {"ring_m": RING_M, "ring_m_large": RING_M_LARGE, "large_from_ha": LARGE_HA},
            "confidence_rule": "medium when the observed maximum corroborates a verified OSM polygon; low when the assignment is unverified, no water was observed, or the observed water outside the polygon exceeds the polygon (raster-only boundary); never high (no survey boundary)",
            "n_lakes": len(features),
        }
        json.dump(params, open(out_dir / "footprint-params.json", "w"), indent=2)
        print(f"wrote {len(features)} footprints to {out_dir}")
    else:
        for t in table:
            print(json.dumps(t, indent=1))

    if args.probe_unassessed:
        probe_unassessed(occ_img, spine_rows, polys, poly_geoms, tree)


def probe_unassessed(occ_img, spine_rows, polys, poly_geoms, tree) -> None:
    """For each polygon-less row with an LMS point: observed water (occ >= thresh)
    within 250 m of the point, split into water already covered by an OSM
    polygon and water no OSM polygon covers; nearest OSM water polygon."""
    rows = [r for r in spine_rows if r["match_method"] == "no_polygon"]
    out = []
    for r in rows:
        rec = {"spine_id": r["spine_id"], "ktcda_key": r["ktcda_key"], "ktcda_name": r["ktcda_name"],
               "lms_name": r["lms_name"], "lms_lat": r["lms_lat"], "lms_lon": r["lms_lon"],
               "water_uncovered_ha": None, "water_covered_by_osm_ha": None, "nearest_osm": "", "nearest_osm_m": None,
               "note": r.get("note", "")}
        if r["lms_lat"]:
            pt = Point(float(r["lms_lon"]), float(r["lms_lat"]))
            circle_u = utm(pt).buffer(250)
            covered = [utm(poly_geoms[j]).buffer(EXCL_BUFFER_M) for j in tree.query(wgs(circle_u)) if poly_geoms[j].intersects(wgs(circle_u))]
            cov_u = unary_union(covered) if covered else None
            water = occ_img.select("occ").gte(OCC_THRESH).multiply(ee.Image.pixelArea())
            total = water.reduceRegion(ee.Reducer.sum(), ee_geom(wgs(circle_u)), SCALE, CRS, maxPixels=int(1e9)).get("occ")
            if cov_u is not None:
                cov_geom = ee_geom(wgs(circle_u.intersection(cov_u)))
                cov = water.reduceRegion(ee.Reducer.sum(), cov_geom, SCALE, CRS, maxPixels=int(1e9)).get("occ")
            else:
                cov = ee.Number(0)
            tot_v, cov_v = with_retry(lambda: ee.List([total, cov]).getInfo())
            rec["water_uncovered_ha"] = round(((tot_v or 0) - (cov_v or 0)) / 1e4, 2)
            rec["water_covered_by_osm_ha"] = round((cov_v or 0) / 1e4, 2)
            best = None
            for j in tree.query(wgs(utm(pt).buffer(600))):
                d = utm(poly_geoms[j]).distance(utm(pt))
                if best is None or d < best[0]:
                    best = (d, j)
            if best:
                pj = polys[best[1]]["properties"]
                rec["nearest_osm"] = f"{pj['osm_id']}:{pj.get('name') or ''} ({pj.get('area_ha')} ha)"
                rec["nearest_osm_m"] = int(best[0])
        out.append(rec)
        print(f"  probe {rec['ktcda_key']} {rec['ktcda_name'][:30]:<30} uncovered {rec['water_uncovered_ha']} ha covered {rec['water_covered_by_osm_ha']} ha nearest {rec['nearest_osm']} {rec['nearest_osm_m']} m")
    with open(DATA / "unassessed-lms-water-probe.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
    print(f"wrote probe for {len(out)} unassessed rows")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Restoration Register screen (M2): compute, band, rank, compare, check.

Runs the Tier-1 screen for one city and one edition from the spine
(public/data/register/<city>-spine.geojson) and writes the edition file. Stages:

  --compute   Earth Engine zonal statistics over every footprint in the spine, as
              chunked reduceRegions calls (never one call per body), each stage cached
              under .cache/register/<city>-<edition>/ so a rerun skips what is done.
  --band      indicators -> bands -> axes -> need class -> route -> rank, from the
              cache plus the committed joins (census extract, cascade graph, recorded
              projects, river stations). Writes public/data/register/<city>-edition-<edition>.json.
  --compare   the edition against the legacy restoration-priority score, body by body
              -> docs/methodology/restoration-register-<city>-<edition>-comparison.md
  --check     validate the edition file (ids, counts, bands, ranks)

Thresholds, floors and lens weights come from scripts/register_thresholds.py only.
Method: docs/methodology/restoration-register-indicators.md (v0.1).

Usage:
  neer-vazhvu-api/.venv/bin/python scripts/build_register_screen.py --city chennai --edition 2026q3 --compute --band --compare --check
  ... --limit 12 --compute      smoke run on the twelve largest bodies
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
from datetime import date
from pathlib import Path
from statistics import mean

from shapely.geometry import Point, mapping, shape
from shapely.ops import transform as shp_transform

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import register_thresholds as T  # noqa: E402
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

REG_DIR = ROOT / "public/data/register"
DW = "GOOGLE/DYNAMICWORLD/V1"
S2 = "COPERNICUS/S2_SR_HARMONIZED"
S2_CLOUD = "COPERNICUS/S2_CLOUD_PROBABILITY"
JRC_YEARLY = "JRC/GSW1_4/YearlyHistory"
GHSL_POP = "JRC/GHSL/P2023A/GHS_POP"
OPEN_BUILDINGS = "GOOGLE/Research/open-buildings/v3/polygons"
CLOUD_PROB_MAX = 40
OB_MIN_CONFIDENCE = 0.65
JRC_YEARS = range(1984, 2022)
DW_YEARS = range(2016, 2026)
MONTHLY_YEARS = range(2016, 2026)

# Chennai supply reservoirs as listed on the CMWSSB lake-level page (S6 supply role).
SUPPLY_RESERVOIRS = {"chennai": {"Chembarambakkam Lake", "Red Hills Reservoir", "Puzhal Lake", "Sholavaram Lake", "Poondi Reservoir", "Cholavaram Lake", "Porur Lake"}}


# ------------------------------------------------------------------ helpers
def metre_transforms(lat0: float):
    kx, ky = 111320.0 * math.cos(math.radians(lat0)), 110574.0
    return (lambda x, y, z=None: (x * kx, y * ky)), (lambda x, y, z=None: (x / kx, y / ky))


def buffer_m(geom, metres: float, lat0: float):
    fwd, inv = metre_transforms(lat0)
    return shp_transform(inv, shp_transform(fwd, geom).buffer(metres))


def distance_m(a, b, lat0: float) -> float:
    fwd, _ = metre_transforms(lat0)
    return shp_transform(fwd, a).distance(shp_transform(fwd, b))


def frac(num, den):
    return (100.0 * num / den) if (num is not None and den) else None


def slope(points):
    pts = [(x, y) for x, y in points if y is not None]
    if len(pts) < 5:
        return None
    n = len(pts)
    sx = sum(p[0] for p in pts)
    sy = sum(p[1] for p in pts)
    sxx = sum(p[0] ** 2 for p in pts)
    sxy = sum(p[0] * p[1] for p in pts)
    den = n * sxx - sx * sx
    return (n * sxy - sx * sy) / den if den else None


def quintile(value, values):
    vals = sorted(v for v in values if v is not None)
    if value is None or not vals:
        return None
    pos = sum(1 for v in vals if v <= value) / len(vals)
    return min(5, max(1, math.ceil(pos * 5)))


def save_cache(path: Path, obj, text: bool = False) -> None:
    """Cache and report files under .cache/ and docs/: never NVDM artifacts, so they
    do not go through write_artifact; the only artifact this producer writes is the
    edition, in main(), through write_artifact."""
    with path.open("w") as f:
        f.write(obj if text else json.dumps(obj))


def edition_windows(edition: str) -> dict:
    m = re.fullmatch(r"(\d{4})q([1-4])", edition)
    if not m:
        sys.exit("edition must look like 2026q3")
    y, q = int(m.group(1)), int(m.group(2))
    last_full = y - 1
    return {"year": y, "quarter": q, "last_full_year": last_full,
            "c1_current": tuple(range(last_full - 2, last_full + 1)),
            "dry_season_year": y if q >= 2 else y - 1,
            "c2_current": tuple(range(last_full - 2, last_full + 1))}


# ------------------------------------------------------------------ spine + joins
def load_spine(city: str, limit: int | None):
    fc = json.loads((REG_DIR / f"{city}-spine.geojson").read_text())
    lat0 = 0.0
    bodies, points = [], []
    for f in fc["features"]:
        p = f["properties"]
        if p["status"] != "active":
            continue
        if p["geometry_kind"] == "point":
            points.append({"id": p["nv_wb_id"], "props": p, "geom": shape(f["geometry"])})
            continue
        g = shape(f["geometry"])
        bodies.append({"id": p["nv_wb_id"], "props": p, "geom": g})
    if bodies:
        lat0 = mean(b["geom"].centroid.y for b in bodies)
    bodies.sort(key=lambda b: -(b["props"]["fixed_area_ha"] or 0))
    if limit:
        bodies = bodies[:limit]
    for b in bodies:
        g = b["geom"]
        b["inset30"] = buffer_m(g, -T.C3_INNER_RING_M, lat0)
        if b["inset30"].is_empty or b["inset30"].area < g.area * 0.05:
            b["inset30"] = g
            b["inset_flag"] = "inner ring not applied: body too narrow"
        b["inset10"] = buffer_m(g, -10, lat0)
        if b["inset10"].is_empty:
            b["inset10"] = g
        zone = buffer_m(g, 1000, lat0)
        b["zone1km"] = zone
        b["halo"] = zone.difference(g)
    return bodies, points, lat0, fc


def load_joins(city: str):
    census = {r["id"]: r for r in json.loads((REG_DIR / f"{city}-census-extract.json").read_text())["rows"]}
    cascade = {}
    cp = ROOT / f"public/data/cascade/{city}-cascade-lakes.geojson"
    if cp.exists():
        for f in json.loads(cp.read_text())["features"]:
            pr = f["properties"]
            if pr.get("osm_id") is not None:
                cascade[int(pr["osm_id"])] = pr
    projects = []
    pp = ROOT / f"public/data/restoration-projects{'' if city == 'chennai' else '-' + city}.json"
    if pp.exists():
        projects = json.loads(pp.read_text()).get("projects", [])
    stations = []
    rp = ROOT / f"public/data/river-quality{'' if city == 'chennai' else '-' + city}.json"
    if rp.exists():
        for riv in json.loads(rp.read_text()).get("rivers", []):
            for s in riv.get("stations", []):
                stations.append(Point(s["lng"], s["lat"]))
    return census, cascade, projects, stations


def ulb_geometry(city: str):
    """Union of the city's ward polygons: the ULB ranking unit. None when no ward file."""
    from shapely.ops import unary_union
    from shapely.prepared import prep

    cands = sorted((ROOT / "public/geojson").glob(f"{city}-wards*.geojson"))
    if not cands:
        return None
    fc = json.loads(cands[-1].read_text())
    return prep(unary_union([shape(f["geometry"]).buffer(0) for f in fc["features"] if f.get("geometry")]))


def cluster_of(osm_id: int | None, cascade: dict) -> str:
    """Terminal sink of the chain the body drains through; the T1-S ranking unit."""
    if osm_id is None or osm_id not in cascade:
        return "unclustered"
    seen, cur = set(), osm_id
    while cur in cascade and cascade[cur].get("drains_to_osm_id") is not None and cur not in seen:
        seen.add(cur)
        cur = int(cascade[cur]["drains_to_osm_id"])
    return f"chain:{cur}"


# ------------------------------------------------------------------ Earth Engine compute
def init_ee():
    import os

    import ee
    from dotenv import load_dotenv

    load_dotenv(ROOT / "neer-vazhvu-api" / ".env")
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    creds = ee.ServiceAccountCredentials(json.load(open(key_file))["client_email"], key_file=key_file)
    ee.Initialize(credentials=creds, project=os.environ["GEE_CLOUD_PROJECT"])
    return ee


class Zonal:
    """Chunked reduceRegions with a per-stage cache and split-on-timeout."""

    def __init__(self, ee, cache_dir: Path, log):
        self.ee, self.cache, self.log = ee, cache_dir, log
        self.cache.mkdir(parents=True, exist_ok=True)
        self.timing: dict[str, dict] = {}

    def fc(self, bodies, key):
        ee = self.ee
        return ee.FeatureCollection([ee.Feature(ee.Geometry(mapping(b[key]), None, False), {"id": b["id"]}) for b in bodies])

    def run(self, tag, image, bodies, key, reducer, scale, chunk=100):
        path = self.cache / f"{tag}.json"
        done = json.loads(path.read_text()) if path.exists() else {}
        todo = [b for b in bodies if b["id"] not in done]
        if not todo:
            return done
        t0, calls = time.time(), 0
        i = 0
        size = chunk
        while i < len(todo):
            part = todo[i:i + size]
            try:
                res = image.reduceRegions(collection=self.fc(part, key), reducer=reducer, scale=scale, tileScale=4).getInfo()
                calls += 1
            except Exception as e:  # noqa: BLE001 - EE raises a generic EEException
                msg = str(e)
                if size > 5 and ("timed out" in msg or "too large" in msg.lower() or "memory" in msg.lower()):
                    size = max(5, size // 2)
                    self.log(f"  {tag}: {msg[:60]} -> chunk {size}")
                    continue
                if "429" in msg or "Too many" in msg or "quota" in msg.lower():
                    self.log(f"  {tag}: rate limited, waiting 30 s")
                    time.sleep(30)
                    continue
                raise
            for f in res["features"]:
                pr = f["properties"]
                done[pr.pop("id")] = pr
            save_cache(path, done)
            i += size
            self.log(f"  {tag}: {min(i, len(todo))}/{len(todo)} ({time.time() - t0:.0f} s)")
        self.timing[tag] = {"bodies": len(todo), "seconds": round(time.time() - t0, 1), "requests": calls}
        return done


def compute(city: str, edition: str, bodies, cache_dir: Path, log) -> dict:
    ee = init_ee()
    W = edition_windows(edition)
    z = Zonal(ee, cache_dir, log)
    sum_r, mean_r = ee.Reducer.sum(), ee.Reducer.mean()
    big = [b for b in bodies if (b["props"]["fixed_area_ha"] or 0) >= T.TREND_FLOOR_30M_HA]
    tenm = [b for b in bodies if (b["props"]["fixed_area_ha"] or 0) >= T.PRESENCE_FLOOR_HA]

    # A. JRC yearly history 1984-2021: water and valid pixel counts per year (30 m), bodies at the 30 m floor
    if big:
        bands = [ee.Image.constant(1).rename("jt")]
        for y in JRC_YEARS:
            # YearlyHistory is masked where a pixel was never water in 1984-2021; that is a
            # valid 'not water' (class 1), distinct from class 0 (too few observations that year).
            wc = ee.ImageCollection(JRC_YEARLY).filter(ee.Filter.eq("year", y)).first().select("waterClass").unmask(1)
            bands += [wc.gte(2).rename(f"jw{y}"), wc.gte(1).rename(f"jv{y}")]
        z.run("jrc", ee.Image.cat(bands), big, "geom", sum_r, 30, chunk=150)

    # B. Dynamic World annual mode 2016-2025: water / built / bare / valid / scene count (10 m)
    bands = [ee.Image.constant(1).rename("dt")]
    for y in DW_YEARS:
        coll = ee.ImageCollection(DW).filterDate(f"{y}-01-01", f"{y + 1}-01-01").select("label")
        mode = coll.reduce(ee.Reducer.mode())
        bands += [mode.eq(0).unmask(0).rename(f"dw{y}"), mode.eq(6).unmask(0).rename(f"db{y}"), mode.eq(7).unmask(0).rename(f"dr{y}"),
                  mode.mask().rename(f"dv{y}"), coll.count().unmask(0).rename(f"dn{y}")]
    dw_img = ee.Image.cat(bands)
    z.run("dw_fixed", dw_img, tenm, "geom", sum_r, 10, chunk=80)
    z.run("dw_inset", dw_img.select([f"db{W['last_full_year']}", f"dr{W['last_full_year']}", f"dv{W['last_full_year']}",
                                     f"db{W['last_full_year'] - 3}", f"dr{W['last_full_year'] - 3}", f"dv{W['last_full_year'] - 3}"]),
          tenm, "inset30", sum_r, 10, chunk=120)
    z.run("dw_halo", dw_img.select([f"db{y}" for y in (2016, W["last_full_year"])] + [f"dv{y}" for y in (2016, W["last_full_year"])]),
          tenm, "halo", sum_r, 10, chunk=60)

    # C. Dynamic World monthly water 2017-2025 (10 m): per-month water and observed pixel counts
    for y in MONTHLY_YEARS:
        bands, waters, obs = [], [], []
        for m in range(1, 13):
            start = f"{y}-{m:02d}-01"
            end = f"{y + 1}-01-01" if m == 12 else f"{y}-{m + 1:02d}-01"
            mode = ee.ImageCollection(DW).filterDate(start, end).select("label").reduce(ee.Reducer.mode())
            w, o = mode.eq(0).unmask(0), mode.mask()
            waters.append(w)
            obs.append(o)
            bands += [w.rename(f"mw{m:02d}"), o.rename(f"mo{m:02d}")]
        # any-month water is the 10 m analogue of JRC's yearly any-water (seasonal or permanent);
        # the annual mode under-reads every seasonal tank, so it is not used for extent
        bands += [ee.ImageCollection(waters).max().rename("ma"), ee.ImageCollection(obs).max().rename("mv")]
        z.run(f"monthly_{y}", ee.Image.cat(bands), tenm, "geom", sum_r, 10, chunk=60)

    # D. Sentinel-2 dry-season composite (Jan-May) with the s2cloudless mask: vegetation, water, quality proxies
    dy = W["dry_season_year"]
    s2 = ee.ImageCollection(S2).filterDate(f"{dy}-01-01", f"{dy}-06-01")
    cloud = ee.ImageCollection(S2_CLOUD).filterDate(f"{dy}-01-01", f"{dy}-06-01")
    joined = ee.Join.saveFirst("cloud").apply(s2, cloud, ee.Filter.equals(leftField="system:index", rightField="system:index"))

    def mask_s2(img):
        prob = ee.Image(img.get("cloud")).select("probability")
        return img.updateMask(prob.lt(CLOUD_PROB_MAX)).select(["B3", "B4", "B5", "B8", "B11"]).multiply(1e-4)

    masked = ee.ImageCollection(joined).map(mask_s2)
    med = masked.median()
    ndvi = med.normalizedDifference(["B8", "B4"])
    mndwi = med.normalizedDifference(["B3", "B11"])
    ndci = med.normalizedDifference(["B5", "B4"])
    ndti = med.normalizedDifference(["B4", "B3"])
    water = mndwi.gt(0)
    s2_img = ee.Image.cat([
        ee.Image.constant(1).rename("st"), ndvi.gt(T.C4_NDVI).unmask(0).rename("sveg"), water.unmask(0).rename("swat"),
        ndci.updateMask(water).rename("sndci"), ndti.updateMask(water).rename("sndti"), masked.count().select(0).unmask(0).rename("sn"),
    ])
    combo = sum_r.combine(mean_r, sharedInputs=True)
    z.run("s2_fixed", s2_img.select(["st", "sveg", "swat", "sn"]), tenm, "geom", combo, 10, chunk=100)
    z.run("s2_core", s2_img.select(["swat", "sndci", "sndti"]), [b for b in tenm if (b["props"]["fixed_area_ha"] or 0) >= T.QUALITY_FLOOR_OPEN_WATER_HA], "inset10", combo, 10, chunk=100)

    # E. Population within 1 km (GHSL 100 m, 2025 epoch)
    pop = ee.Image(f"{GHSL_POP}/2025").select("population_count")
    pop = pop.updateMask(pop.gte(0))
    z.run("pop_zone", pop, bodies, "zone1km", sum_r, 100, chunk=200)

    # F. Open Buildings v3 inside the footprint: count and footprint area
    ob = ee.FeatureCollection(OPEN_BUILDINGS).filter(ee.Filter.gte("confidence", OB_MIN_CONFIDENCE))

    def ob_stats(f):
        hit = ob.filterBounds(f.geometry())
        return f.set({"ob_n": hit.size(), "ob_area": hit.aggregate_sum("area_in_meters")})

    path = cache_dir / "ob_fixed.json"
    done = json.loads(path.read_text()) if path.exists() else {}
    todo = [b for b in bodies if b["id"] not in done]
    t0 = time.time()
    for i in range(0, len(todo), 60):
        part = todo[i:i + 60]
        res = z.fc(part, "geom").map(ob_stats).getInfo()
        for f in res["features"]:
            pr = f["properties"]
            done[pr.pop("id")] = pr
        save_cache(path, done)
        log(f"  ob_fixed: {min(i + 60, len(todo))}/{len(todo)} ({time.time() - t0:.0f} s)")
    if todo:
        z.timing["ob_fixed"] = {"bodies": len(todo), "seconds": round(time.time() - t0, 1), "requests": math.ceil(len(todo) / 60)}
    save_cache(cache_dir / "timing.json", z.timing)
    return z.timing


# ------------------------------------------------------------------ banding
def load_cache(cache_dir: Path, tag: str) -> dict:
    p = cache_dir / f"{tag}.json"
    return json.loads(p.read_text()) if p.exists() else {}


def census_capacity(row: dict):
    """Plausibility rules from census-capacity.ts: suppress impossible capacity values."""
    orig, pres = row.get("storage_capacity_original"), row.get("storage_capacity_present")
    area, depth = row.get("water_spread_area"), row.get("max_depth_m")
    if orig is None or pres is None:
        return None, "absent"
    if pres > orig:
        return None, "present above original"
    if area and depth:
        cap = area * 10000 * depth * T.CENSUS_AREA_DEPTH_TOLERANCE
        if orig > cap or pres > cap:
            return None, "exceeds area x depth"
    loss = row.get("storage_loss_pct")
    if loss is None and orig:
        loss = 100.0 * (orig - pres) / orig
    return loss, "ok"


def band_city(city: str, edition: str, bodies, points, lat0, cache_dir: Path, joins, log) -> dict:
    W = edition_windows(edition)
    census, cascade, projects, stations = joins
    jrc, dwf, dwi, dwh = (load_cache(cache_dir, t) for t in ("jrc", "dw_fixed", "dw_inset", "dw_halo"))
    monthly = {y: load_cache(cache_dir, f"monthly_{y}") for y in MONTHLY_YEARS}
    s2f, s2c, popz, obf = (load_cache(cache_dir, t) for t in ("s2_fixed", "s2_core", "pop_zone", "ob_fixed"))
    lfy = W["last_full_year"]
    project_names = [(pr.get("name") or "").lower() for pr in projects]

    ulb = ulb_geometry(city)
    records = []
    for b in bodies:
        p, bid = b["props"], b["id"]
        in_ulb = bool(ulb.intersects(b["geom"])) if ulb else True
        ha = p["fixed_area_ha"] or 0
        ind: dict[str, dict] = {}
        conf: dict[str, str] = {}
        xw = {c["system"]: c for c in p["crosswalk"]}
        osm_id = int(xw["osm"]["id"]) if "osm" in xw else None
        census_rows = [census[c["census_row_id"]] for c in p["crosswalk"] if c["system"] == "census" and c.get("census_row_id") in census]
        cz = cascade.get(osm_id) if osm_id is not None else None

        # ---- C1 extent retained
        j, d = jrc.get(bid, {}), dwf.get(bid, {})
        ref, ref_src, ref_n = None, None, 0
        if ha >= T.TREND_FLOOR_30M_HA and j and j.get("jt", 0) >= T.TREND_FLOOR_30M_PX:
            fr = []
            for y in JRC_YEARS:
                jv, jw = j.get(f"jv{y}", 0), j.get(f"jw{y}", 0)
                if j["jt"] and jv / j["jt"] >= T.C1_REF_MIN_COVERAGE and jv:
                    fr.append(100.0 * jw / jv)
            fr.sort(reverse=True)
            if len(fr) >= 3:
                ref, ref_src, ref_n = mean(fr[:T.C1_REF_TOP_N_30M]), "jrc-1984-2021", len(fr)
        def any_water(y):
            m = monthly.get(y, {}).get(bid)
            return (100.0 * m.get("ma", 0) / m["mv"]) if (m and m.get("mv")) else None

        if ref is None and d and d.get("dt", 0) >= T.TREND_FLOOR_10M_PX and ha >= T.TREND_FLOOR_10M_HA:
            fr = sorted((v for v in (any_water(y) for y in range(2016, 2022)) if v is not None), reverse=True)
            if len(fr) >= 3:
                ref, ref_src, ref_n = mean(fr[:T.C1_REF_TOP_N_10M]), "dw-any-month-2016-2021", len(fr)
        cur_vals = [v for v in (any_water(y) for y in W["c1_current"]) if v is not None]
        cur = mean(cur_vals) if cur_vals else None
        # The 10 m any-month record reads higher than the 30 m seasonal-or-permanent class
        # on the same body. Where both overlap (2016-2021) the ratio is measured per body
        # and applied to the 30 m reference, so retained is instrument-consistent.
        offset = None
        if ref_src == "jrc-1984-2021" and j:
            pairs = [(any_water(y), 100.0 * j.get(f"jw{y}", 0) / j[f"jv{y}"]) for y in range(2016, 2022) if j.get(f"jv{y}") and any_water(y) is not None]
            if len(pairs) >= 3 and mean(q for _, q in pairs) > 5 and mean(dv for dv, _ in pairs) > 5:
                offset = max(0.5, min(2.0, mean(dv for dv, _ in pairs) / mean(q for _, q in pairs)))
        ref_adj = (ref * offset) if (ref and offset) else ref
        retained = (100.0 * cur / ref_adj) if (ref_adj and cur is not None) else None
        scenes = mean([d.get(f"dn{y}", 0) / max(d.get("dt", 1), 1) for y in W["c1_current"]]) if d else 0
        ind["C1"] = {"value": round(min(retained, 100.0), 1) if retained is not None else None, "unit": "% of reference",
                     "band": T.band_ge(retained, T.C1_BANDS), "reference_pct": round(ref, 1) if ref else None,
                     "reference_adjusted_pct": round(ref_adj, 1) if ref_adj else None, "instrument_offset_ratio": round(offset, 3) if offset else None,
                     "raw_ratio_pct": round(retained, 1) if retained is not None else None,
                     "reference_source": ref_src, "reference_years_used": ref_n, "current_pct": round(cur, 1) if cur is not None else None,
                     "current_years": list(W["c1_current"]), "season": "annual any-water on both sides: JRC seasonal-or-permanent against any month with water in the 10 m record"}
        conf["C1"] = ("I" if retained is None else "High" if (scenes >= 6 and (d.get("dt", 0) >= 2 * T.TREND_FLOOR_10M_PX)) else "Medium" if scenes >= 3 else "Low")

        # ---- U1 extent trend (pp/yr)
        if ha >= T.TREND_FLOOR_30M_HA and j and ref_src == "jrc-1984-2021":
            pts = [(y, 100.0 * j.get(f"jw{y}", 0) / j[f"jv{y}"] if j.get(f"jv{y}") else None) for y in range(2012, 2022)]
        else:
            pts = [(y, any_water(y)) for y in DW_YEARS]
        u1 = slope(pts)
        u1c = "I" if u1 is None else ("Rising" if u1 <= T.U1_RISING_PP_YR else "Easing" if u1 >= T.U1_EASING_PP_YR else "Steady")
        ind["U1"] = {"value": round(u1, 2) if u1 is not None else None, "unit": "pp/yr", "class": u1c, "window": "jrc 2012-2021" if ref_src == "jrc-1984-2021" else "dw any-month 2016-2025"}

        # ---- C2 hydroperiod + K1-K3 from monthly water
        def months_wet(y):
            m = monthly.get(y, {}).get(bid)
            if not m or not d.get("dt"):
                return None, None, {}
            per_month = {}
            for mm in range(1, 13):
                obs = m.get(f"mo{mm:02d}", 0)
                if obs >= 0.3 * d["dt"]:
                    per_month[mm] = 100.0 * m.get(f"mw{mm:02d}", 0) / obs
            if len(per_month) < 6:
                return None, len(per_month), per_month
            wet = sum(1 for v in per_month.values() if v >= T.K_PRESENCE_WATER_PCT)
            return 12.0 * wet / len(per_month), len(per_month), per_month

        mw = {y: months_wet(y) for y in MONTHLY_YEARS}
        base = [mw[y][0] for y in T.C2_BASELINE_YEARS if mw[y][0] is not None]
        curm = [mw[y][0] for y in W["c2_current"] if mw[y][0] is not None]
        c2_base, c2_cur = (mean(base) if base else None), (mean(curm) if curm else None)
        loss = (c2_base - c2_cur) if (c2_base is not None and c2_cur is not None) else None
        is_perennial = (p.get("water_type") in ("lake", "reservoir")) or (p.get("name") in SUPPLY_RESERVOIRS.get(city, set()))  # noqa: F841 - reused below
        c2_band = T.band_lt(loss, T.C2_LOSS_BANDS)
        if is_perennial and c2_cur is not None and c2_cur < T.C2_PERENNIAL_MIN_MONTHS_E:
            c2_band = "E"
        ind["C2"] = {"value": round(loss, 1) if loss is not None else None, "unit": "months lost vs 2017-19", "band": c2_band,
                     "months_wet_baseline": round(c2_base, 1) if c2_base is not None else None, "months_wet_current": round(c2_cur, 1) if c2_cur is not None else None,
                     "source": "dynamic-world monthly mode; months without observation excluded", "perennial_rule": is_perennial}
        obs_min = min(mw[y][1] or 0 for y in W["c2_current"])
        conf["C2"] = "I" if loss is None else ("High" if obs_min >= 9 else "Medium" if obs_min >= 6 else "Low")
        # K1 wet-season, K2 dry-season presence, last three years
        def season_present(y, months):
            pm = mw[y][2]
            vals = [pm[m] for m in months if m in pm]
            return None if not vals else max(vals) >= T.K_PRESENCE_WATER_PCT
        k1 = [season_present(y, T.K_WET_SEASON_MONTHS) for y in W["c2_current"]]
        k2 = [season_present(y, T.K_DRY_SEASON_MONTHS) for y in W["c2_current"]]

        def k_band(flags):
            known = [f for f in flags if f is not None]
            if not known:
                return "I"
            n = sum(known)
            return "A" if n == len(known) == 3 else ("E" if n == 0 else "C")
        ind["K1"] = {"years_present": sum(1 for f in k1 if f), "years_observed": sum(1 for f in k1 if f is not None), "band": k_band(k1)}
        ind["K2"] = {"years_present": sum(1 for f in k2 if f), "years_observed": sum(1 for f in k2 if f is not None), "band": k_band(k2)}
        ind["K3"] = {"value": ind["C2"]["value"], "band": T.band_lt(loss, T.C2_LOSS_BANDS)}

        # ---- C3 converted surface (inset 30 m), C3s structures, U2 build rates
        di, dh, ob = dwi.get(bid, {}), dwh.get(bid, {}), obf.get(bid, {})
        # Built only. The bare class is a dry tank bed in the annual mode of every seasonal
        # tank, not a conversion; it is reported as exposed bed, never banded as C3.
        c3 = frac(di.get(f"db{lfy}", 0), di.get(f"dv{lfy}"))
        c3_prev = frac(di.get(f"db{lfy - 3}", 0), di.get(f"dv{lfy - 3}"))
        bare = frac(di.get(f"dr{lfy}", 0), di.get(f"dv{lfy}"))
        ob_n = int(ob.get("ob_n") or 0)
        ob_area_pct = frac(ob.get("ob_area") or 0, ha * 10000) if ha else None
        # The 10 m built class bleeds into small footprints from the streets around
        # them (on this city's small tanks it read 100% built where mapped building
        # footprints covered 4%). So: the structure footprints set a band of their own,
        # and the 10 m value may worsen it by at most two bands, and only where the
        # inner ring could be applied. Under 5% with no structure at all is A.
        struct_band = T.band_lt(ob_area_pct, T.C3_BANDS) if ob_area_pct is not None else "I"
        dw_band = T.band_lt(c3, T.C3_BANDS) if (c3 is not None and not b.get("inset_flag")) else None
        if dw_band and struct_band in T.BAND_SCORE and ha < 10:
            # bleed is an edge effect of one or two pixels: decisive on a small tank, noise on a large one
            c3_band = T.BANDS[min(T.BAND_SCORE[dw_band], T.BAND_SCORE[struct_band] + 2)]
        elif dw_band:
            c3_band = dw_band
        else:
            c3_band = struct_band
        if c3 is not None and c3 < T.C3_CORROBORATION_PCT and ob_n == 0:
            c3_band = "A"
        c3_basis = (("10 m built class, capped at two bands beyond the structure footprints (body under 10 ha)" if ha < 10 else "10 m built class") if dw_band else
                    "structure footprints only: body too narrow for the 10 m built class")
        ind["C3"] = {"value": round(c3, 2) if c3 is not None else None, "unit": "% of footprint built (inset 30 m)", "band": c3_band,
                     "year": lfy, "inner_ring_note": b.get("inset_flag"), "corroborated_by_structures": ob_n > 0,
                     "structure_band": struct_band, "basis": c3_basis,
                     "exposed_bed_pct": round(bare, 1) if bare is not None else None}
        ind["C3s"] = {"structures": ob_n, "per_10ha": round(10 * ob_n / ha, 2) if ha else None, "footprint_area_pct": round(ob_area_pct, 2) if ob_area_pct is not None else None,
                      "source": "open-buildings-v3 (confidence >= 0.65)"}
        conf["C3"] = "I" if c3 is None else ("High" if di.get(f"dv{lfy}", 0) >= 200 else "Medium")
        halo_now, halo_2016 = frac(dh.get(f"db{lfy}", 0), dh.get(f"dv{lfy}")), frac(dh.get("db2016", 0), dh.get("dv2016"))
        u2_c3 = (c3 - c3_prev) if (c3 is not None and c3_prev is not None) else None
        u2_halo = (halo_now - halo_2016) if (halo_now is not None and halo_2016 is not None) else None
        ind["U2"] = {"c3_change_3yr_pp": round(u2_c3, 2) if u2_c3 is not None else None, "halo_built_pct": round(halo_now, 1) if halo_now is not None else None,
                     "halo_change_since_2016_pp": round(u2_halo, 1) if u2_halo is not None else None,
                     "class": "Rising" if (u2_c3 is not None and u2_c3 >= 5) else ("Steady" if u2_c3 is not None else "I")}
        ind["U3"] = {"value": round(c3, 2) if c3 is not None else None, "threshold_pct": T.U3_IRREVERSIBILITY_PCT,
                     "beyond": (c3 is not None and c3 >= T.U3_IRREVERSIBILITY_PCT)}
        ind["K4"] = {"value": ind["C3"]["value"], "band": {"A": "A", "B": "C", "C": "C", "D": "E", "E": "E"}.get(c3_band, "I"), "basis": c3_basis}

        # ---- C4 vegetation choke, C5 quality proxies (dry season)
        s = s2f.get(bid, {})
        exempt = (p.get("water_type") in T.C4_EXEMPT_TYPES) or p["anchor"]["system"] == "rich-body"
        c4 = frac(s.get("sveg_sum", 0), s.get("st_sum")) if s else None
        dry_water = frac(s.get("swat_sum", 0), s.get("st_sum")) if s else None
        is_perennial = (p.get("water_type") in ("lake", "reservoir")) or (p.get("name") in SUPPLY_RESERVOIRS.get(city, set()))
        # Choke means vegetation on a water body. A seasonal tank that is dry in Jan-May
        # has grass on its bed, which is C2/K2's finding, not C4's.
        applies = exempt is False and c4 is not None and ((dry_water or 0) >= 10 or is_perennial)
        c4_band = "exempt" if exempt else (T.band_lt(c4, T.C4_BANDS) if applies else "n/a")
        ind["C4"] = {"value": round(c4, 1) if c4 is not None else None, "unit": "% of footprint, dry-season NDVI > 0.25",
                     "band": c4_band, "dry_season": f"Jan-May {W['dry_season_year']}", "dry_season_water_pct": round(dry_water, 1) if dry_water is not None else None,
                     "note": ("marsh or natural wetland: vegetation is the habitat, see C2" if exempt else
                              None if applies else "not applicable: no dry-season water in the footprint (see C2, K2); vegetation is on a dry bed")}
        conf["C4"] = "I" if (c4 is None or not applies) else ("High" if (s.get("sn_mean") or 0) >= 6 else "Medium" if (s.get("sn_mean") or 0) >= 3 else "Low")
        sc = s2c.get(bid, {})
        open_water_ha = (sc.get("swat_sum") or 0) / 100.0
        if open_water_ha >= T.QUALITY_FLOOR_OPEN_WATER_HA and sc.get("sndci_mean") is not None:
            ind["C5"] = {"ndci": round(sc["sndci_mean"], 3), "ndti": round(sc.get("sndti_mean"), 3) if sc.get("sndti_mean") is not None else None,
                         "open_water_ha": round(open_water_ha, 1), "band": "relative", "note": "percentile within the city cohort, banded only after in-situ calibration"}
        else:
            ind["C5"] = {"band": "I", "open_water_ha": round(open_water_ha, 1), "note": "under 5 ha of open water in the dry-season composite"}

        # ---- C6 storage loss (census, plausibility-checked); K6 census check
        c6, c6_note, cust = None, "no census row", "unknown"
        in_use, encroach = None, None
        if census_rows:
            row = census_rows[0]
            c6, c6_note = census_capacity(row)
            cust = "single" if row.get("ownership") else "unknown"
            in_use, encroach = row.get("is_in_use"), row.get("encroachment_status")
        ind["C6"] = {"value": round(c6, 1) if c6 is not None else None, "unit": "% storage lost", "band": T.band_lt(c6, T.C6_BANDS), "note": c6_note}
        k6 = "unverifiable"
        if census_rows and ind["K2"]["band"] != "I":
            if in_use is False:
                k6 = "confirmed" if ind["K2"]["band"] == "E" else ("contradicted" if ind["K2"]["band"] == "A" else "partly")
            elif in_use is True:
                k6 = "confirmed" if ind["K2"]["band"] in ("A", "C") else "contradicted"
        ind["K6"] = {"census_in_use": in_use, "census_encroachment": encroach, "check": k6}
        ind["C7"] = {"band": "I", "note": "patch counting not run in this edition"}
        ind["C8"] = {"band": "I", "note": "needs the outflow sub-zone and the froth classifier (Tier 2)"}

        # ---- stakes
        pz = popz.get(bid, {}).get("sum")
        ind["S1"] = {"size_class": p["size_class"], "fixed_area_ha": ha}
        ind["S2"] = {"population_1km": round(pz) if pz is not None else None, "quintile": None}
        ind["S3"] = {"band": "I", "note": "IN-GRES block polygons not joined in this edition"}
        ind["S4"] = ({"routed_load_sqkm": cz.get("total_upstream_sqkm"), "own_catchment_sqkm": cz.get("catchment_area_sqkm"),
                      "load_to_area": round(cz["total_upstream_sqkm"] / cz["lake_area_sqkm"], 1) if cz.get("lake_area_sqkm") else None,
                      "cascade_position": cz.get("cascade_position"), "degree_in": cz.get("degree_in"), "drains_to_river": cz.get("drains_to_river"),
                      "source": f"public/data/cascade/{city}-cascade-lakes.geojson (FABDEM-based, non-commercial licence carries)"} if cz else {"band": "I", "note": "not a cascade node"})
        protected = "legal" in (p.get("geometry_sources") or {})
        ind["S5"] = {"protected": protected, "basis": (p.get("geometry_sources") or {}).get("legal")}
        supply = p.get("name") in SUPPLY_RESERVOIRS.get(city, set())
        ind["S6"] = {"supply_role": supply, "census_in_use": in_use}

        # ---- tractability
        ind["T1"] = {"custodian": cust, "ownership": census_rows[0].get("ownership") if census_rows else None}
        t2 = "High" if ob_n <= max(2, 0.2 * ha) else ("Medium" if ob_n <= max(10, ha) else "Low")
        ind["T2"] = {"class": t2, "structures": ob_n}
        ind["T3"] = {"band": "I", "note": "inlet and outlet state needs the sub-metre read (Tier 2)", "degree_in": cz.get("degree_in") if cz else None}
        name_l = (p.get("name") or "").lower()
        prog = "none"
        if name_l:
            for pr, pn in zip(projects, project_names):
                if name_l.split()[0] in pn and len(name_l.split()[0]) > 4:
                    prog = {"completed": "completed", "ongoing": "works underway", "in_progress": "works underway", "planned": "proposed", "proposed": "proposed"}.get(pr.get("status"), "dpr")
        ind["T4"] = {"programme": prog, "source": "public/data/restoration-projects.json (recorded projects only)"}
        near_station = any(distance_m(st, b["geom"], lat0) <= 3000 for st in stations)
        ind["T5"] = {"legal_boundary": protected, "census_row": bool(census_rows), "station_within_3km": near_station}

        # ---- axes
        c_bands = {k: ind[k]["band"] for k in ("C1", "C2", "C3", "C4", "C6") if ind[k].get("band") in T.BAND_SCORE}
        if exempt:
            c_bands.pop("C1", None)  # marsh or natural wetland: open water is not its extent; C2 carries it
            ind["C1"]["note"] = "reported only; a marsh's extent is its hydroperiod (C2)"
        cond = T.condition_band(c_bands)
        tract = "Unknown" if cust == "unknown" else ("Low" if t2 == "Low" else "High" if t2 == "High" else "Medium")
        urg = "Rising" if (u1c == "Rising" or ind["U2"]["class"] == "Rising") else ("Easing" if u1c == "Easing" else ("Steady" if u1c != "I" else ("Steady" if ind["U2"]["class"] == "Steady" else "I")))
        rec = {"nv_wb_id": bid, "name": p.get("name"), "name_ta": p.get("name_ta"), "water_type": p.get("water_type"),
               "tier": p["tier_hint"], "size_class": p["size_class"], "fixed_area_ha": ha, "anchor": p["anchor"],
               "crosswalk": p["crosswalk"], "cluster": cluster_of(osm_id, cascade), "unit": f"ulb:{city}" if in_ulb else f"region:{city}-bbox-outside-ulb",
               "indicators": ind, "confidence": conf,
               "axes": {"condition_band": cond, "c_bands": c_bands, "tractability_class": tract, "urgency_class": urg},
               "_protected": protected, "_supply": supply, "_programme": prog, "_pop": pz, "_load": ind["S4"].get("load_to_area")}
        records.append(rec)

    # census-only points: census indicators only
    for pt in points:
        p = pt["props"]
        rows = [census[c["census_row_id"]] for c in p["crosswalk"] if c["system"] == "census" and c.get("census_row_id") in census]
        row = rows[0] if rows else {}
        c6, note = census_capacity(row) if row else (None, "no census row")
        records.append({"nv_wb_id": pt["id"], "name": p.get("name"), "name_ta": None, "water_type": p.get("water_type"), "tier": "T0",
                        "size_class": p.get("size_class"), "fixed_area_ha": p.get("fixed_area_ha"), "anchor": p["anchor"], "crosswalk": p["crosswalk"],
                        "cluster": "unclustered", "unit": f"ulb:{city}" if (ulb is None or ulb.intersects(pt["geom"])) else f"region:{city}-bbox-outside-ulb",
                        "indicators": {"C6": {"value": round(c6, 1) if c6 is not None else None, "unit": "% storage lost", "band": T.band_lt(c6, T.C6_BANDS), "note": note},
                                       "K6": {"census_in_use": row.get("is_in_use"), "census_encroachment": row.get("encroachment_status"), "check": "unverifiable"},
                                       "T1": {"custodian": "single" if row.get("ownership") else "unknown", "ownership": row.get("ownership")}},
                        "confidence": {"C6": "Low"}, "axes": {"condition_band": "I", "c_bands": {}, "tractability_class": "Unknown", "urgency_class": "I"},
                        "_protected": False, "_supply": False, "_programme": "none", "_pop": None, "_load": None})

    # ---- stakes quintiles, need class, route, rank per lens
    pops = [r["_pop"] for r in records]
    loads = [r["_load"] for r in records]
    for r in records:
        if "S2" in r["indicators"]:
            r["indicators"]["S2"]["quintile"] = quintile(r["_pop"], pops)
        if r["_load"] is not None:
            r["indicators"]["S4"]["load_quintile"] = quintile(r["_load"], loads)
    size_rank = {label: i for i, (_, label) in enumerate(T.SIZE_CLASSES)}
    size_rank["over 200"] = len(T.SIZE_CLASSES)

    def stakes_score(r, lens):
        ind = r["indicators"]
        comps = {
            "S1": size_rank.get(r["size_class"], 0) / len(T.SIZE_CLASSES),
            "S2": ((ind.get("S2", {}).get("quintile") or 0) / 5.0),
            "S3": 0.0,
            "S4": ((ind.get("S4", {}).get("load_quintile") or 0) / 5.0),
            "S5": 1.0 if r["_protected"] else 0.0,
            "S6": 1.0 if (r["_supply"] or ind.get("S6", {}).get("census_in_use")) else 0.0,
            "C6": (T.BAND_SCORE.get(ind.get("C6", {}).get("band"), 0) / 4.0),
            "C2": (T.BAND_SCORE.get(ind.get("C2", {}).get("band"), 0) / 4.0),
            "C4": (T.BAND_SCORE.get(ind.get("C4", {}).get("band"), 0) / 4.0),
            "T1": 1.0 if ind.get("T1", {}).get("custodian") == "single" else 0.0,
        }
        emph = T.LENSES[lens]["emphasis"]
        return sum(comps.get(k, 0.0) for k in emph) / len(emph)

    for r in records:
        ax = r["axes"]
        ax["stakes_score"] = {lens: round(stakes_score(r, lens), 3) for lens in T.LENSES}
        s0 = ax["stakes_score"][T.DEFAULT_LENS]
        ax["stakes_class"] = "High" if s0 >= 0.6 else ("Medium" if s0 >= 0.3 else "Low")
        r["need_class"] = T.need_class(ax["condition_band"], ax["tractability_class"], ax["urgency_class"], r["_programme"], False, r["_protected"], ax["stakes_class"])
        if r["tier"] == "T0":
            r["need_class"] = "Unassessed"
        route = ["AMRUT 2.0 water-body component (ULB)", "CSR"]
        if r["_protected"]:
            route = ["Amrit Dharohar (Ramsar)", "NPCA integrated management plan"] + route
        if r["_programme"] in ("dpr", "works underway"):
            route.append("Co-fund the recorded programme's gaps: verification, monitoring, O&M")
        r["route"] = route
        cs = T.BAND_SCORE.get(ax["condition_band"], 0) / 4.0
        us = T.URGENCY_SCORE.get(ax["urgency_class"], 0) / 2.0
        r["need_index"] = {lens: round(w["condition"] * cs + w["urgency"] * us + w["stakes"] * ax["stakes_score"][lens], 4) for lens, w in T.LENSES.items()}
        comp = [v for k, v in r["confidence"].items() if v in ("High", "Medium", "Low")]
        r["confidence_body"] = ("Low" if "Low" in comp else "Medium" if "Medium" in comp else "High") if comp else "I"
        r["change_log"] = []

    conf_rank = {"High": 0, "Medium": 1, "Low": 2, "I": 3}
    need_rank = {c: i for i, c in enumerate(T.NEED_CLASS_ORDER)}

    def sort_key(lens):
        return lambda r: (need_rank.get(r["need_class"], 99), -T.BAND_SCORE.get(r["axes"]["condition_band"], -1), -r["need_index"][lens],
                          conf_rank.get(r["confidence_body"], 3), -(r["fixed_area_ha"] or 0))

    for r in records:
        r["rank"] = {}
    for lens in T.LENSES:
        for unit in sorted({r["unit"] for r in records}):
            large = sorted([r for r in records if r["tier"] == "T1-L" and r["unit"] == unit], key=sort_key(lens))
            for i, r in enumerate(large, 1):
                r["rank"][lens] = {"unit": unit, "position": i, "of": len(large)}
        small = [r for r in records if r["tier"] == "T1-S"]
        clusters = {}
        for r in small:
            clusters.setdefault(r["cluster"], []).append(r)
        for cid, members in clusters.items():
            for i, r in enumerate(sorted(members, key=sort_key(lens)), 1):
                r["rank"][lens] = {"unit": f"cluster:{cid}", "position": i, "of": len(members)}
    for r in records:
        for k in ("_protected", "_supply", "_programme", "_pop", "_load"):
            r.pop(k, None)

    def count(key):
        out = {}
        for r in records:
            v = key(r)
            out[v] = out.get(v, 0) + 1
        return dict(sorted(out.items(), key=lambda kv: str(kv[0])))

    summary = {"bodies": len(records), "by_unit": count(lambda r: r["unit"]), "by_tier": count(lambda r: r["tier"]), "by_condition_band": count(lambda r: r["axes"]["condition_band"]),
               "by_need_class": count(lambda r: r["need_class"]), "by_confidence": count(lambda r: r["confidence_body"]),
               "hectares_in_D_or_E": round(sum((r["fixed_area_ha"] or 0) for r in records if r["axes"]["condition_band"] in ("D", "E")), 1),
               "c4_applicability": count(lambda r: r["indicators"].get("C4", {}).get("band", "n/a") if r["tier"] != "T0" else "T0"),
               "k6_census_check": count(lambda r: r["indicators"].get("K6", {}).get("check", "n/a")),
               "clusters": len({r["cluster"] for r in records if r["tier"] == "T1-S"})}
    timing = load_cache(cache_dir, "timing")
    ed = {
        "nvdm": "1.0", "dataset": "register/edition", "scope": {"kind": "city", "id": city},
        "provenance": {
            "sources": [
                {"id": "osm-overpass", "title": "OpenStreetMap water-body polygons (via the register spine)", "publisher": "OpenStreetMap contributors", "license": registry_license("osm-overpass"), "role": "input"},
                {"id": "jrc-global-surface-water", "title": "JRC Global Surface Water v1.4 yearly history 1984-2021 (C1 reference, U1)", "publisher": "European Commission JRC (Pekel et al.)", "license": registry_license("jrc-global-surface-water"), "role": "input"},
                {"id": "google-dynamic-world", "title": "Google Dynamic World V1 annual and monthly modes 2016-2025 (C1 current, C2, C3, K1-K4, U2)", "publisher": "Google / World Resources Institute", "license": registry_license("google-dynamic-world"), "role": "input"},
                {"id": "sentinel-2-l2a", "title": f"Sentinel-2 L2A dry-season composite Jan-May {W['dry_season_year']} with the s2cloudless mask (C4, C5)", "publisher": "ESA Copernicus", "license": registry_license("sentinel-2-l2a"), "role": "input"},
                {"id": "google-open-buildings", "title": "Google Open Buildings v3 polygons inside the footprint (C3s, T2)", "publisher": "Google Research", "license": registry_license("google-open-buildings"), "role": "input"},
                {"id": "datagovin-waterbodies-census-tn", "title": "First Census of Water Bodies, Chennai rows (C6, K6, T1)", "publisher": "Ministry of Jal Shakti, via data.gov.in", "license": registry_license("datagovin-waterbodies-census-tn"), "role": "input"},
                {"id": "fabdem-dem", "title": "FABDEM-based cascade graph (S4 routed load, via public/data/cascade); the non-commercial licence carries to this file", "publisher": "University of Bristol (Hawker et al.), via GEE sat-io", "license": registry_license("fabdem-dem"), "role": "input"},
            ],
            "method": "derived", "produced_by": "scripts/build_register_screen.py", "produced_at": date.today().isoformat(),
            "note": "Population within 1 km from GHSL P2023A GHS_POP 2025 (JRC, free and open, attribution).",
        },
        "edition": edition, "as_of": date.today().isoformat(), "city_id": city, "thresholds_version": T.VERSION, "methodology": "docs/methodology/restoration-register-indicators.md",
        "windows": {k: (list(v) if isinstance(v, tuple) else v) for k, v in W.items()}, "lenses": T.LENSES, "summary": summary,
        "compute_timing": timing, "records": records,
    }
    return ed


# ------------------------------------------------------------------ compare + check
def compare(city: str, edition: str, ed: dict) -> Path:
    old_path = ROOT / f"public/data/restoration-priority{'' if city == 'chennai' else '-' + city}.json"
    old = json.loads(old_path.read_text())
    old_by = {w["id"]: w for w in old["water_bodies"]}
    joined, cross = [], {}
    for r in ed["records"]:
        legacy = [c["id"] for c in r["crosswalk"] if c["system"] == "legacy-priority"]
        o = next((old_by[k] for k in legacy if k in old_by), None)
        if not o:
            continue
        joined.append((r, o))
        key = (o["priority_level"], r["axes"]["condition_band"])
        cross[key] = cross.get(key, 0) + 1
    levels, bands = ["critical", "high", "moderate", "low"], ["E", "D", "C", "B", "A", "I"]
    lines = ["# Restoration Register: the first edition against the legacy priority score", "",
             f"City: {city}. Edition: {edition}. Generated by `scripts/build_register_screen.py --compare`.", "",
             f"Bodies joined by legacy id: {len(joined)} of {len(ed['records'])} register records and {len(old['water_bodies'])} legacy scores.", "",
             "## Crosstab: legacy level (rows) against register condition band (columns)", "",
             "| legacy \\ band | " + " | ".join(bands) + " | total |", "|---|" + "---|" * (len(bands) + 1)]
    for lv in levels:
        row = [cross.get((lv, b), 0) for b in bands]
        lines.append(f"| {lv} | " + " | ".join(str(x) for x in row) + f" | {sum(row)} |")
    lines += ["", "## Where they disagree most", "",
              "Legacy critical or high, register A or B (the proximity proxies flagged them; the satellite record does not):", ""]
    for r, o in sorted(joined, key=lambda t: -t[1]["priority_score"]):
        if o["priority_level"] in ("critical", "high") and r["axes"]["condition_band"] in ("A", "B"):
            lines.append(f"- {r['name'] or '(unnamed)'} ({r['fixed_area_ha']} ha): legacy {o['priority_level']} {o['priority_score']}; register {r['axes']['condition_band']}, C1 {r['indicators']['C1'].get('value')}%, C3 {r['indicators']['C3'].get('value')}%, need class {r['need_class']}")
            if sum(1 for ln in lines if ln.startswith("- ")) >= 15:
                break
    lines += ["", "Legacy moderate or low, register D or E (the satellite record shows loss the proxies could not see):", ""]
    n = 0
    for r, o in sorted(joined, key=lambda t: -(t[0]["fixed_area_ha"] or 0)):
        if o["priority_level"] in ("moderate", "low") and r["axes"]["condition_band"] in ("D", "E"):
            lines.append(f"- {r['name'] or '(unnamed)'} ({r['fixed_area_ha']} ha): legacy {o['priority_level']} {o['priority_score']}; register {r['axes']['condition_band']}, C1 {r['indicators']['C1'].get('value')}% of reference, C2 {r['indicators']['C2'].get('band')}, C3 {r['indicators']['C3'].get('value')}%, need class {r['need_class']}")
            n += 1
            if n >= 15:
                break
    lines += ["", "## Register summary", "", "```", json.dumps(ed["summary"], indent=1), "```", ""]
    out = ROOT / f"docs/methodology/restoration-register-{city}-{edition}-comparison.md"
    save_cache(out, "\n".join(lines), text=True)
    return out


def check(ed: dict) -> list[str]:
    errs = []
    ids = [r["nv_wb_id"] for r in ed["records"]]
    if len(ids) != len(set(ids)):
        errs.append("duplicate nv_wb_id")
    for r in ed["records"]:
        if r["axes"]["condition_band"] not in ("A", "B", "C", "D", "E", "I"):
            errs.append(f"{r['nv_wb_id']}: bad condition band")
        if r["need_class"] not in T.NEED_CLASS_ORDER:
            errs.append(f"{r['nv_wb_id']}: bad need class {r['need_class']}")
        if r["tier"] in ("T1-L", "T1-S") and T.DEFAULT_LENS not in r["rank"]:
            errs.append(f"{r['nv_wb_id']}: unranked {r['tier']}")
    for lens in T.LENSES:
        for unit in {r.get("unit") for r in ed["records"]}:
            pos = sorted(r["rank"][lens]["position"] for r in ed["records"] if r["tier"] == "T1-L" and r.get("unit") == unit)
            if pos and pos != list(range(1, len(pos) + 1)):
                errs.append(f"{lens}/{unit}: T1-L positions not contiguous")
    return errs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True)
    ap.add_argument("--edition", required=True)
    ap.add_argument("--compute", action="store_true")
    ap.add_argument("--band", action="store_true")
    ap.add_argument("--compare", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    def log(msg):
        print(msg, flush=True)

    cache_dir = ROOT / ".cache/register" / f"{args.city}-{args.edition}{'-limit' + str(args.limit) if args.limit else ''}"
    bodies, points, lat0, _ = load_spine(args.city, args.limit)
    log(f"{args.city} {args.edition}: {len(bodies)} footprints, {len(points)} census points, lat0 {lat0:.3f}")
    if args.compute:
        timing = compute(args.city, args.edition, bodies, cache_dir, log)
        log("compute timing: " + json.dumps(timing))
    ed = None
    if args.band:
        ed = band_city(args.city, args.edition, bodies, points, lat0, cache_dir, load_joins(args.city), log)
        # Stable path: the corpus release and pin freeze each quarter's edition; the
        # edition id lives inside the file, so the source registry never changes per quarter.
        out = REG_DIR / f"{args.city}-edition.json"
        if not args.limit:
            out.unlink(missing_ok=True)  # producer-owned envelope
            write_artifact(out, ed, compact=True)
            log(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")
        else:
            save_cache(cache_dir / "edition-preview.json", ed)
            log(f"limit run: edition preview in {cache_dir / 'edition-preview.json'}")
        log("summary: " + json.dumps(ed["summary"]))
    if args.compare and ed:
        log(f"comparison -> {compare(args.city, args.edition, ed).relative_to(ROOT)}")
    if args.check and ed:
        errs = check(ed)
        if errs:
            log("CHECK FAILED:\n  " + "\n  ".join(errs[:20]))
            return 1
        log("check OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

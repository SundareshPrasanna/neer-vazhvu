"""Per-pass surface state for every custody-list lake with a footprint (snapshot
build step 5; methodology note sections 7.1, 7.4, 7.5, 7.7, 7.8, 8.1, 8.2, 8.11).

The Bellandur pipeline (scripts/verify_rich_body_pollution_state.py) generalised:
one Sentinel-2 L2A scene at a time, one batched reduceRegions over every zone of
every lake, instead of per-lake getInfo calls.

Per scene, per pixel (Cloud Score+ cs_cdf >= 0.60 = clear):
  class   froth > floating or emergent vegetation > open water > bed (section 7.4,
          rule B of classifier-validation.json: mats need MNDWI <= 0, foam needs
          NIR >= SWIR; green bloom water stays open water)
  indices NDCI (Q1), NDTI (Q3), B3/B4 (Q5), hue angle (Q7), NIR (glint screen)
          on open-water pixels only
Per zone, per scene:
  lakebed  composition shares of the clear pixels; clear share of the footprint
  core     (footprint inset by the shoreline ring) mean, p10/p50/p90 and count of
           each index on open-water pixels; P1 = share of core open water with
           NDCI above the published 0.1 mark
  sub-zones (optional gba-lakes-subzones.geojson, step 8) the same two reductions

Two modes:
  fetch     pull scene batches from GEE (chunks of about 13 scenes per request,
            under the 5,000-row reply cap; cached under
            .cache/bengaluru-snapshot/state/, resumable)
  assemble  turn the cache into one row per lake per pass with the section 7.8
            floors and 7.1 pass classes applied, write
            docs/research/bengaluru-lakes/data/lake-passes.csv.gz and
            state-params.json (methods as data)
  diagnose  per-scene percentile dump of the classifier's feature bands on the
            lakebed of the lakes named in --only (threshold setting, step 6)

Observed passes only; nothing is imputed. Sen2Cor L2A as distributed, so every
index is Tier 1 (relative) and is never converted to a physical unit here.

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python \
       scripts/bengaluru-snapshot/run_lake_state.py fetch [--start 2017-03-28] [--end YYYY-MM-DD] [--workers 3]
     ... run_lake_state.py assemble
     ... run_lake_state.py diagnose --only gba-bda-001,gba-bbmp-155 --start 2026-02-01 --end 2026-04-01
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import math
import os
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(os.environ.get("NV_SNAPSHOT_DATA") or ROOT / "docs/research/bengaluru-lakes/data")
CACHE = Path(os.environ.get("NV_SNAPSHOT_CACHE") or ROOT / ".cache/bengaluru-snapshot/state")
load_dotenv(ROOT / "neer-vazhvu-api" / ".env")

import ee  # noqa: E402

# ---- published parameters (written to state-params.json) ---------------------
S2_SR = "COPERNICUS/S2_SR_HARMONIZED"
CS_PLUS = "GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED"
CS_BAND, CS_THRESH = "cs_cdf", 0.60
REFL_SCALE = 10000.0
CRS, SCALE = "EPSG:32643", 10        # B5 and B11 are 20 m native, resampled
START_DEFAULT = "2017-03-28"
# classifier thresholds (reflectance 0 to 1), initial values tuned on Bellandur;
# per-lake-type values from the step 6 validation are recorded next to the data
T_WATER_MNDWI = 0.00
T_VEG_NDVI = 0.25
T_VEG_MNDWI_MAX = 0.00               # rule B: a mat is not SWIR-dark like water
T_FROTH_BRIGHT, T_FROTH_SWIR, T_FROTH_NDVI = 0.18, 0.10, 0.10   # rule B adds NIR >= SWIR
NDCI_P1_MARK = 0.10                  # Mishra and Mishra 2012 (about 25 mg per m3)
# section 7.1 pass classes on the clear share of the footprint
CLEAR_PASS, PARTIAL_PASS = 0.70, 0.30
# section 7.8 floors
MIN_VALID_PX = 20                    # composition fraction
MIN_CORE_OW_PX = 10                  # optical index on the core
GLINT_PCT = 95                       # NIR p50 on the core above the lake's own
                                     # percentile of clear passes = glint flag
# van der Woerd and Wernand 2018, Table 1 (S2 MSI 10 m set: R400, B2 490, B3 560,
# B4 665, R710) and Table 2 polynomial. The 400 and 710 nm edge weights are
# applied to the nearest measured band (B2 and B4), which is the paper's
# spectrum-reconstruction rule at the interval ends.
HUE_X = (8.356 + 12.040, 53.696, 32.087 + 0.487)
HUE_Y = (0.993 + 23.122, 65.702, 16.830 + 0.177)
HUE_Z = (43.487 + 61.055, 1.778, 0.015 + 0.000)
HUE_POLY = (-164.83, 1139.90, -3006.04, 3677.75, -1979.71, 371.38)
CLASS_LABELS = {0: "not_clear", 1: "open_water", 2: "algae", 3: "froth", 4: "bed"}
IDX_BANDS = ["ndci", "ndti", "gr", "hue", "nir", "p1"]
PCTS = [10, 50, 90]
VERSION = "lake-state-v2"

TO_UTM = Transformer.from_crs("EPSG:4326", CRS, always_xy=True).transform
TO_WGS = Transformer.from_crs(CRS, "EPSG:4326", always_xy=True).transform


def init_ee() -> None:
    project = os.environ["GEE_CLOUD_PROJECT"]
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    email = json.load(open(key_file))["client_email"]
    ee.Initialize(credentials=ee.ServiceAccountCredentials(email, key_file=key_file), project=project)


# ---- zones ---------------------------------------------------------------------
def load_zones(only: set[str] | None) -> tuple[list[dict], dict]:
    """Zones as plain dicts: zone_id, spine_id, kind, geometry (WGS84).
    Core = footprint inset by ring_m in UTM (matches the footprint pixel counts)."""
    fps = json.load(open(DATA / "gba-lakes-footprints.geojson"))["features"]
    zones, meta = [], {}
    for f in fps:
        p = f["properties"]
        sid = p["spine_id"]
        if only and sid not in only:
            continue
        g = shape(f["geometry"])
        gu = shp_transform(TO_UTM, g)
        core = gu.buffer(-p["ring_m"])
        meta[sid] = {**p, "footprint_px_10m": int(gu.area / 100)}
        zones.append({"zone_id": f"{sid}|lakebed", "spine_id": sid, "kind": "lakebed", "geometry": mapping(g)})
        if not core.is_empty:
            zones.append({"zone_id": f"{sid}|core", "spine_id": sid, "kind": "core", "geometry": mapping(shp_transform(TO_WGS, core))})
    sz = DATA / "gba-lakes-subzones.geojson"
    if sz.exists():
        for f in json.load(open(sz))["features"]:
            p = f["properties"]
            if only and p["spine_id"] not in only:
                continue
            zones.append({"zone_id": f"{p['spine_id']}|{p['key']}", "spine_id": p["spine_id"], "kind": p.get("kind", "subzone"), "geometry": f["geometry"]})
    return zones, meta


def zones_fc(zones: list[dict]) -> ee.FeatureCollection:
    return ee.FeatureCollection([
        ee.Feature(ee.Geometry(z["geometry"], "EPSG:4326", False), {"zone_id": z["zone_id"]}) for z in zones])


def zone_pixel_counts(zones: list[dict], fc: ee.FeatureCollection, tag: str) -> dict[str, int]:
    """Pixels per zone at SCALE/CRS under the same boundary weighting reduceRegions
    uses per scene; the denominator for clear share and swath coverage. Cached."""
    cp = CACHE / tag / "zone-pixels.json"
    if cp.exists():
        d = json.loads(cp.read_text())
        if set(d) >= {z["zone_id"] for z in zones}:
            return d
    cp.parent.mkdir(parents=True, exist_ok=True)
    feats = with_retry(lambda: ee.Image.constant(1).reduceRegions(fc, ee.Reducer.count(), SCALE, CRS).getInfo())["features"]
    d = {f["properties"]["zone_id"]: int(f["properties"]["count"]) for f in feats}
    cp.write_text(json.dumps(d))
    return d


def zones_bounds(zones: list[dict]):
    xs, ys = [], []
    for z in zones:
        g = shape(z["geometry"]).bounds
        xs += [g[0], g[2]]; ys += [g[1], g[3]]
    return ee.Geometry.Rectangle([min(xs) - 0.01, min(ys) - 0.01, max(xs) + 0.01, max(ys) + 0.01], "EPSG:4326", False)


# ---- per-scene bands -------------------------------------------------------------
def preprocess(img: ee.Image) -> ee.Image:
    swath = img.select("B3").mask()
    clear = img.select(CS_BAND).gte(CS_THRESH).unmask(0).updateMask(swath)
    r = img.select(["B2", "B3", "B4", "B5", "B8", "B11"]).divide(REFL_SCALE)
    blue, green, red, rededge, nir, swir = [r.select(b) for b in ["B2", "B3", "B4", "B5", "B8", "B11"]]
    mndwi = green.subtract(swir).divide(green.add(swir))
    ndvi = nir.subtract(red).divide(nir.add(red))
    ndci = rededge.subtract(red).divide(rededge.add(red)).rename("ndci")
    ndti = red.subtract(green).divide(red.add(green)).rename("ndti")
    gr = green.divide(red).rename("gr")
    bright = green.add(red).add(nir).divide(3)
    # hue angle (degrees) from CIE tristimulus, MSI 10 m weights, corrected
    X = blue.multiply(HUE_X[0]).add(green.multiply(HUE_X[1])).add(red.multiply(HUE_X[2]))
    Y = blue.multiply(HUE_Y[0]).add(green.multiply(HUE_Y[1])).add(red.multiply(HUE_Y[2]))
    Z = blue.multiply(HUE_Z[0]).add(green.multiply(HUE_Z[1])).add(red.multiply(HUE_Z[2]))
    s = X.add(Y).add(Z)
    x, y = X.divide(s).subtract(1 / 3), Y.divide(s).subtract(1 / 3)
    alpha = y.atan2(x).multiply(180 / math.pi)
    alpha = alpha.where(alpha.lt(0), alpha.add(360))
    a = alpha.divide(100)
    c5, c4, c3, c2, c1, c0 = HUE_POLY
    delta = (a.pow(5).multiply(c5).add(a.pow(4).multiply(c4)).add(a.pow(3).multiply(c3))
             .add(a.pow(2).multiply(c2)).add(a.multiply(c1)).add(c0))
    hue = alpha.add(delta).rename("hue")

    # rule B (classifier-validation.json, step 6): foam keeps NIR at or above SWIR
    # (a bright dry lakebed has SWIR above NIR); a floating or emergent mat is
    # SWIR-bright (MNDWI <= 0), while green bloom water (NDVI 0.25-0.45 with
    # MNDWI well above 0) stays open water and carries its bloom in NDCI
    is_froth = (bright.gt(T_FROTH_BRIGHT).And(swir.gt(T_FROTH_SWIR)).And(ndvi.lt(T_FROTH_NDVI))
                .And(nir.gte(swir)))
    is_algae = ndvi.gt(T_VEG_NDVI).And(mndwi.lte(T_VEG_MNDWI_MAX)).And(is_froth.Not())
    is_water = mndwi.gt(T_WATER_MNDWI).And(is_froth.Not()).And(is_algae.Not())
    cls = ee.Image(4).where(is_water, 1).where(is_algae, 2).where(is_froth, 3).where(clear.Not(), 0).rename("cls")
    comp = ee.Image.cat([cls.eq(k).rename(f"c{k}") for k in range(5)]).updateMask(swath)
    ow = cls.eq(1)
    idx = ee.Image.cat([ndci, ndti, gr, hue, nir.rename("nir"), ndci.gt(NDCI_P1_MARK).rename("p1")]).updateMask(ow)
    feat = ee.Image.cat([bright.rename("bright"), swir.rename("swir"), ndvi.rename("ndvi"), mndwi.rename("mndwi"),
                         ndci, red.rename("red")]).updateMask(clear)
    return (comp.addBands(idx).addBands(feat)
            .set("t", img.get("system:time_start"), "img", img.get("system:index")))


def collection(start: str, end: str, aoi) -> ee.ImageCollection:
    return (ee.ImageCollection(S2_SR).filterBounds(aoi).filterDate(start, end)
            .linkCollection(ee.ImageCollection(CS_PLUS), [CS_BAND]).map(preprocess))


def per_scene(zones: ee.FeatureCollection):
    """One reduceRegions per scene over every zone: composition bands (unmasked
    inside the swath) and index bands (masked to open water) together; the
    reducer runs per band with each band's own mask (verified against separate
    reductions on Bellandur and Jakkur, identical to 4 decimals)."""
    red = (ee.Reducer.mean().combine(ee.Reducer.percentile(PCTS), sharedInputs=True)
           .combine(ee.Reducer.count(), sharedInputs=True))
    bands = [f"c{k}" for k in range(5)] + IDX_BANDS

    def _per(img):
        img = ee.Image(img)
        tag = {"t": img.get("t"), "img": img.get("img")}
        return (img.select(bands).reduceRegions(zones, red, SCALE, CRS)
                .map(lambda f: ee.Feature(None, f.toDictionary().combine(tag))))
    return _per


def scene_chunks(start: str, end: str, aoi, per_chunk: int) -> list[tuple[str, list[str]]]:
    """Scenes over the AOI in date order, grouped so one request stays under
    GEE's 5,000-element reply cap (rows = scenes x zones)."""
    base = ee.ImageCollection(S2_SR).filterBounds(aoi).filterDate(start, end).sort("system:time_start")
    ids = base.aggregate_array("system:index").getInfo()
    out = []
    for i in range(0, len(ids), per_chunk):
        chunk = ids[i:i + per_chunk]
        out.append((f"{chunk[0][:8]}_{i:05d}", chunk))
    return out


def month_windows(start: str, end: str) -> list[tuple[str, str]]:
    s = date.fromisoformat(start); e = date.fromisoformat(end)
    out = []
    cur = s
    while cur < e:
        nxt = date(cur.year + (cur.month == 12), (cur.month % 12) + 1, 1)
        out.append((cur.isoformat(), min(nxt, e).isoformat()))
        cur = nxt
    return out


def with_retry(fn, tries=6):
    for i in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            print(f"    retry {i+1}: {str(e)[:140]}", file=sys.stderr)
            time.sleep(30 * (i + 1) if "concurrent" in str(e) else 10 * (i + 1))


# ---- fetch ---------------------------------------------------------------------
def cmd_fetch(args) -> None:
    init_ee()
    only = set(args.only.split(",")) if args.only else None
    zones, _ = load_zones(only)
    fc = zones_fc(zones)
    aoi = zones_bounds(zones)
    fn = per_scene(fc)
    tag = "all" if not only else "only-" + "-".join(sorted(only))[:60]
    (CACHE / tag).mkdir(parents=True, exist_ok=True)
    zpx = zone_pixel_counts(zones, fc, tag)
    print(f"zone pixel counts: {len(zpx)} zones")
    per_chunk = max(1, min(40, 4800 // len(zones)))
    chunks = scene_chunks(args.start, args.end, aoi, per_chunk)
    n_scenes = sum(len(c[1]) for c in chunks)
    print(f"fetch {len(zones)} zones, {n_scenes} scenes in {len(chunks)} chunks of {per_chunk}, cache {CACHE / tag}", flush=True)

    def work(chunk):
        key, ids = chunk
        cp = CACHE / tag / f"{key}.json"
        if cp.exists() and not args.force:
            return key, "cached", None
        t0 = time.time()
        coll = collection(args.start, args.end, aoi).filter(ee.Filter.inList("system:index", ids))
        feats = with_retry(lambda: ee.FeatureCollection(coll.map(fn)).flatten().getInfo())
        rows = [f["properties"] for f in feats["features"]]
        cp.write_text(json.dumps(rows))
        return key, f"{len(ids)} scenes {len(rows)} rows", time.time() - t0

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(work, c) for c in chunks]
        for i, fut in enumerate(as_completed(futs), 1):
            try:
                key, msg, dt = fut.result()
                print(f"  [{i}/{len(chunks)}] {key} {msg}" + (f" {dt:.0f}s" if dt else ""), flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"  FAILED chunk: {e}", file=sys.stderr, flush=True)


# ---- assemble --------------------------------------------------------------------
def _r(v, n=4):
    return round(v, n) if isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v)) else None


def cmd_assemble(args) -> None:
    only = set(args.only.split(",")) if args.only else None
    zones, meta = load_zones(only)
    tag = "all" if not only else "only-" + "-".join(sorted(only))[:60]
    # the main cache first, then every supplementary tag (lakes re-fetched after a
    # spine fix, sub-zones) whose rows override on (lake, scene, zone)
    tags = [tag] if only else ["all"] + sorted(d.name for d in CACHE.iterdir() if d.is_dir() and d.name != "all")
    files, zpx = [], {}
    for t in tags:
        if not (CACHE / t).exists():
            continue
        files += sorted(p for p in (CACHE / t).glob("*.json") if p.name != "zone-pixels.json")
        zp = CACHE / t / "zone-pixels.json"
        if zp.exists():
            zpx.update(json.loads(zp.read_text()))
    if not files:
        sys.exit(f"no cache under {CACHE}; run fetch first")
    # (spine_id, img) -> {zone kind -> props}
    recs: dict[tuple[str, str], dict] = defaultdict(dict)
    for fp in files:
        for p in json.loads(fp.read_text()):
            zid = p.get("zone_id")
            if not zid:
                continue
            sid, kind = zid.split("|", 1)
            recs[(sid, p["img"])][kind] = p
    print(f"cache tags: {tags}")
    print(f"{len(files)} cache files, {len(recs)} lake-scene records")

    rows = []
    for (sid, img), zk in recs.items():
        m = meta.get(sid)
        lb = zk.get("lakebed")
        if not m or not lb or lb.get("c0_count") in (None, 0):
            continue
        t = lb["t"]
        d = datetime.fromtimestamp(t / 1000, tz=timezone.utc)
        swath = int(lb["c0_count"])
        c0 = lb.get("c0_mean") or 0.0
        clear_px = int(round(swath * (1 - c0)))
        fp_px = max(zpx.get(f"{sid}|lakebed") or m["footprint_px_10m"], 1)
        clear_share = min(1.0, clear_px / fp_px)
        pass_class = "clear" if clear_share >= CLEAR_PASS else ("partial" if clear_share >= PARTIAL_PASS else "discard")
        row = {
            "spine_id": sid, "date": d.strftime("%Y-%m-%d"), "img": img, "tile": img.split("_")[-1] if "_" in img else "",
            "footprint_px": fp_px, "swath_px": swath, "swath_share": round(min(1.0, swath / fp_px), 3), "clear_px": clear_px, "clear_share": round(clear_share, 3),
            "pass_class": pass_class,
        }
        # composition among clear pixels (W1, W2, W4, W5)
        if clear_px >= MIN_VALID_PX and c0 < 1:
            for k in (1, 2, 3, 4):
                row[f"frac_{CLASS_LABELS[k]}"] = round((lb.get(f"c{k}_mean") or 0.0) / (1 - c0), 4)
            row["comp_ok"] = True
        else:
            row["comp_ok"] = False
        # core indices (Q1, Q3, Q5, Q7) on open water
        core = zk.get("core")
        n_ow = int(core.get("ndci_count") or 0) if core else 0
        row["core_ow_px"] = n_ow
        if core and n_ow >= MIN_CORE_OW_PX and pass_class == "clear":
            for b in ("ndci", "ndti", "gr", "hue", "nir"):
                row[f"{b}_mean"] = _r(core.get(f"{b}_mean"))
                for q in PCTS:
                    row[f"{b}_p{q}"] = _r(core.get(f"{b}_p{q}"))
            row["p1_ndci"] = _r(core.get("p1_mean"))
            row["idx_ok"] = True
        else:
            row["idx_ok"] = False
        # sub-zones: composition + index means, floors applied
        for kind, zp in zk.items():
            if kind in ("lakebed", "core"):
                continue
            c = i = zp
            if c and c.get("c0_count"):
                sw = int(c["c0_count"]); cc0 = c.get("c0_mean") or 0.0; vp = int(round(sw * (1 - cc0)))
                row[f"{kind}_valid_px"] = vp
                if vp >= MIN_VALID_PX and cc0 < 1:
                    for k in (1, 2, 3, 4):
                        row[f"{kind}_frac_{CLASS_LABELS[k]}"] = round((c.get(f"c{k}_mean") or 0.0) / (1 - cc0), 4)
            if i and int(i.get("ndci_count") or 0) >= MIN_CORE_OW_PX:
                row[f"{kind}_ow_px"] = int(i["ndci_count"])
                for b in ("ndci", "ndti", "gr", "hue"):
                    row[f"{kind}_{b}_p50"] = _r(i.get(f"{b}_p50"))
        rows.append(row)

    # one record per lake per date: the image covering the most of the footprint
    best: dict[tuple[str, str], dict] = {}
    for r in rows:
        k = (r["spine_id"], r["date"])
        if k not in best or r["swath_px"] > best[k]["swath_px"]:
            best[k] = r
    rows = sorted(best.values(), key=lambda r: (r["spine_id"], r["date"]))
    rows = [r for r in rows if r["pass_class"] != "discard"]

    # glint screen (X3): NIR p50 on the core above the lake's own GLINT_PCT of clear passes
    by_lake: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        if r.get("idx_ok") and r.get("nir_p50") is not None:
            by_lake[r["spine_id"]].append(r)
    for sid, rs in by_lake.items():
        vals = sorted(r["nir_p50"] for r in rs)
        if len(vals) >= 20:
            cut = vals[min(len(vals) - 1, int(len(vals) * GLINT_PCT / 100))]
            for r in rs:
                r["glint_flag"] = r["nir_p50"] > cut
    for r in rows:
        r.setdefault("glint_flag", False)

    cols = ["spine_id", "date", "img", "tile", "footprint_px", "swath_px", "swath_share", "clear_px", "clear_share", "pass_class", "comp_ok",
            "frac_open_water", "frac_algae", "frac_froth", "frac_bed", "core_ow_px", "idx_ok", "glint_flag", "p1_ndci"]
    for b in ("ndci", "ndti", "gr", "hue", "nir"):
        cols += [f"{b}_mean"] + [f"{b}_p{q}" for q in PCTS]
    extra = sorted({k for r in rows for k in r} - set(cols))
    cols += extra
    out = DATA / ("lake-passes.csv.gz" if not only else f"lake-passes-{tag}.csv.gz")
    with gzip.open(out, "wt", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
    n_lakes = len({r["spine_id"] for r in rows})
    n_clear = sum(1 for r in rows if r["pass_class"] == "clear")
    print(f"wrote {out}: {len(rows)} lake-passes ({n_clear} clear, {len(rows) - n_clear} partial) over {n_lakes} lakes")
    if not only:
        params = {
            "version": VERSION, "computed_at": datetime.now(timezone.utc).isoformat(),
            "dataset": S2_SR, "cloud_mask": f"{CS_PLUS} {CS_BAND} >= {CS_THRESH}",
            "atmospheric_correction": "Sen2Cor L2A as distributed (Tier 1, relative; no physical units)",
            "grid": {"crs": CRS, "scale_m": SCALE, "note": "B5 and B11 are 20 m native, resampled; NDCI and MNDWI are 20 m products"},
            "classifier": {"rule": "B", "precedence": "froth > floating or emergent vegetation > open_water > bed",
                            "froth": f"mean(B3,B4,B8) > {T_FROTH_BRIGHT} and B11 > {T_FROTH_SWIR} and NDVI < {T_FROTH_NDVI} and B8 >= B11",
                            "algae": f"NDVI > {T_VEG_NDVI} and MNDWI <= {T_VEG_MNDWI_MAX} on non-froth (mats; bloom water stays open water)",
                            "open_water": f"MNDWI > {T_WATER_MNDWI} on the rest",
                            "bed": "remainder inside the footprint", "thresholds_status": "rule B chosen in step 6; evidence in classifier-validation.json"},
            "indices": {"ndci": "(B5-B4)/(B5+B4), Mishra and Mishra 2012", "ndti": "(B4-B3)/(B4+B3), Lacaux et al. 2007",
                        "gr": "B3/B4, Toming et al. 2016", "hue": "CIE hue angle, van der Woerd and Wernand 2018 MSI 10 m weights and polynomial (edge weights on B2 and B4)",
                        "p1_ndci": f"share of core open-water pixels with NDCI > {NDCI_P1_MARK}", "sampled_on": "open-water pixels of the core (footprint inset by ring_m)"},
            "pass_rule": {"clear": f">= {CLEAR_PASS} of footprint pixels clear", "partial": f"{PARTIAL_PASS} to {CLEAR_PASS}: composition only", "discard": f"< {PARTIAL_PASS}"},
            "floors": {"composition_valid_px": MIN_VALID_PX, "index_core_open_water_px": MIN_CORE_OW_PX},
            "glint_screen": f"NIR p50 on the core above the lake's own p{GLINT_PCT} across clear passes (needs 20 passes); flagged, not removed",
            "duplicate_dates": "two tiles on one date: the image covering more of the footprint is kept",
            "imputation": "none; observed passes only",
            "n_lake_passes": len(rows), "n_lakes": n_lakes,
        }
        json.dump(params, open(DATA / "state-params.json", "w"), indent=2)


# ---- diagnose ----------------------------------------------------------------------
def cmd_diagnose(args) -> None:
    init_ee()
    if not args.only:
        sys.exit("diagnose needs --only")
    only = set(args.only.split(","))
    zones, meta = load_zones(only)
    lakebeds = [z for z in zones if z["kind"] == "lakebed"]
    fc = zones_fc(lakebeds)
    aoi = zones_bounds(lakebeds)
    bands = ["bright", "swir", "ndvi", "mndwi", "ndci", "red"]
    red = ee.Reducer.percentile([10, 50, 90, 95]).combine(ee.Reducer.count(), sharedInputs=True)

    def _per(img):
        img = ee.Image(img)
        return img.select(bands).reduceRegions(fc, red, SCALE, CRS).map(
            lambda f: ee.Feature(None, f.toDictionary().set("t", img.get("t"))))
    coll = collection(args.start, args.end, aoi)
    feats = ee.FeatureCollection(coll.map(_per)).flatten().getInfo()["features"]
    by = defaultdict(list)
    for f in feats:
        by[f["properties"]["zone_id"]].append(f["properties"])
    for zid, ps in sorted(by.items()):
        print(f"\n[{zid}]")
        for p in sorted(ps, key=lambda p: p["t"]):
            if not p.get("bright_count"):
                continue
            d = datetime.fromtimestamp(p["t"] / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            print(f"  {d} n={int(p['bright_count'])}")
            for b in bands:
                print(f"    {b:<7} " + " ".join(f"p{q}={_r(p.get(f'{b}_p{q}')) if p.get(f'{b}_p{q}') is not None else 'NA'!s:>8}" for q in (10, 50, 90, 95)))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["fetch", "assemble", "diagnose"])
    ap.add_argument("--only", help="comma-separated spine_ids")
    ap.add_argument("--start", default=START_DEFAULT)
    ap.add_argument("--end", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    {"fetch": cmd_fetch, "assemble": cmd_assemble, "diagnose": cmd_diagnose}[args.mode](args)


if __name__ == "__main__":
    main()

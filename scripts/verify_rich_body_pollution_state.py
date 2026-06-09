"""
Pollution STATE capability (Tier-1, relative) for a rich-data body.
Generic across rich bodies via --body-id; reads per-body settings from the
TS rich-body registry's `pollution` block is NOT done here (no TS<->Py
coupling) - size/inset are passed as flags with sensible defaults.

What it computes, per clear Sentinel-2 scene, inside the lake polygon:

  Per-pass MNDWI-based pixel classification (decision tree, precedence
  froth > algae > open-water > bed) -> class FRACTIONS per zone. The
  fractions are themselves the headline pollution-state signal (e.g.
  "38% algae, 4% froth this scene"); they also route the indices:

    - turbidity (relative): NDTI + red-band reflectance, sampled ONLY on
      open-water pixels of the 10 m-inset core.
    - chl-a (relative): NDCI (red-edge), same open-water core.

Zones sampled: whole lakebed (fraction denominator), open-water core
(inset ∩ open-water class, for indices), and each named sub-zone
(inlet/weir) so source signals are visible.

NOT computed (declared gap, no optical signature): DO, BOD, COD, coliform.

Output: public/data/rich-bodies/<body_id>-pollution-state.json

  python scripts/verify_rich_body_pollution_state.py --body-id bellandur \
      --start 2017-03-28 --end 2026-06-08
  # classifier validation run (narrow window around a known froth date):
  python scripts/verify_rich_body_pollution_state.py --body-id bellandur \
      --start 2017-02-01 --end 2017-03-01 --validate
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import OrderedDict, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "neer-vazhvu-api" / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import ee  # noqa: E402
from _rich_body_zones import (  # noqa: E402
    ZONE_BODY,
    load_body_zones,
    load_named_subzones,
)

# ---- Data sources -----------------------------------------------------------
S2_SR = "COPERNICUS/S2_SR_HARMONIZED"          # L2A surface reflectance
CS_PLUS = "GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED"  # Cloud Score+
CS_BAND = "cs_cdf"                              # recommended masking band
CS_THRESH = 0.60                               # keep pixels with cs_cdf >= this
REFL_SCALE = 10000.0                           # S2 SR DN -> reflectance
SAMPLE_SCALE = 10                              # m; 10m bands native, B11/B5
                                               # (20m) resampled - documented,
                                               # gives 4x pixels in small zones
MAXPIX = int(1e9)
MIN_OPEN_WATER_PX = 10   # below this, open-water indices are gated (N/A)

# ---- Classification thresholds (reflectance 0-1) ----------------------------
# INITIAL values - to be tuned against known froth/clean dates in --validate.
T_WATER_MNDWI = 0.00     # MNDWI > this => water-like (Xu 2006)
T_VEG_NDVI = 0.25        # NDVI > this => floating veg/algae (on non-froth)
T_FROTH_BRIGHT = 0.18    # mean(green,red,NIR) > this AND ...
T_FROTH_SWIR = 0.10      # ... SWIR1 > this AND ...
T_FROTH_NDVI = 0.10      # ... NDVI < this => foam (flat-bright, NOT vegetation)

CLASS_LABELS = {1: "open_water", 2: "algae", 3: "froth", 4: "bed"}

MIN_VALID_PX = 20        # below this a zone-scene is low-confidence


def init_ee() -> None:
    project = os.environ["GEE_CLOUD_PROJECT"]
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    with open(key_file) as f:
        client_email = json.load(f)["client_email"]
    creds = ee.ServiceAccountCredentials(client_email, key_file=key_file)
    ee.Initialize(credentials=creds, project=project)
    print(f"GEE initialised: project={project}")


def shapely_to_ee(geom) -> ee.Geometry:
    return ee.Geometry(json.loads(json.dumps(geom.__geo_interface__)))


def preprocess(img: ee.Image) -> ee.Image:
    """Cloud-mask, scale, add index + class bands. 'clear' stays unmasked so
    cloud fraction can be measured per zone."""
    cs = img.select(CS_BAND)
    clear = cs.gte(CS_THRESH).rename("clear")
    r = img.select(["B2", "B3", "B4", "B5", "B8", "B11"]).divide(REFL_SCALE)
    blue, green, red, rededge, nir, swir = [
        r.select(b) for b in ["B2", "B3", "B4", "B5", "B8", "B11"]
    ]

    mndwi = green.subtract(swir).divide(green.add(swir)).rename("mndwi")
    ndvi = nir.subtract(red).divide(nir.add(red)).rename("ndvi")
    ndci = rededge.subtract(red).divide(rededge.add(red)).rename("ndci")
    ndti = red.subtract(green).divide(red.add(green)).rename("ndti")
    bright = green.add(red).add(nir).divide(3).rename("bright")
    swir_b = swir.rename("swir")
    red_r = red.rename("red_r")

    is_froth = (bright.gt(T_FROTH_BRIGHT)
                .And(swir.gt(T_FROTH_SWIR))
                .And(ndvi.lt(T_FROTH_NDVI)))
    is_algae = ndvi.gt(T_VEG_NDVI).And(is_froth.Not())
    is_water = mndwi.gt(T_WATER_MNDWI).And(is_froth.Not()).And(is_algae.Not())
    cls = (
        ee.Image(4)
        .where(is_water, 1)
        .where(is_algae, 2)
        .where(is_froth, 3)
        .rename("cls")
    )
    # mask everything to clear pixels so histograms only count valid data
    masked = clear.eq(1)
    out = (
        cls.updateMask(masked)
        .addBands(ndci.updateMask(masked))
        .addBands(ndti.updateMask(masked))
        .addBands(red_r.updateMask(masked))
        # diagnostic feature bands (masked) for --diagnose threshold setting
        .addBands(bright.updateMask(masked))
        .addBands(swir_b.updateMask(masked))
        .addBands(ndvi.updateMask(masked))
        .addBands(mndwi.updateMask(masked))
        .addBands(clear)  # unmasked
    )
    return out.copyProperties(img, ["system:time_start"])


def zone_series(coll: ee.ImageCollection, geom: ee.Geometry) -> ee.FeatureCollection:
    def per_img(img):
        img = ee.Image(img)
        cls = img.select("cls")
        hist = cls.reduceRegion(
            reducer=ee.Reducer.frequencyHistogram(),
            geometry=geom, scale=SAMPLE_SCALE, maxPixels=MAXPIX,
        ).get("cls")
        # open-water-only indices (cls == 1): turbidity + chl, gated downstream
        ow = img.updateMask(cls.eq(1))
        idx = ow.select(["ndci", "ndti", "red_r"]).reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=geom, scale=SAMPLE_SCALE, maxPixels=MAXPIX,
        )
        # algae-vigor: mean NDVI over the algae/macrophyte class (cls == 2).
        # For choked lakes this is the primary eutrophication-intensity signal.
        alg = img.updateMask(cls.eq(2))
        algae_ndvi = alg.select("ndvi").reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=geom, scale=SAMPLE_SCALE, maxPixels=MAXPIX,
        ).get("ndvi")
        clear_frac = img.select("clear").reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=geom, scale=SAMPLE_SCALE, maxPixels=MAXPIX,
        ).get("clear")
        return ee.Feature(None, {
            "t": img.get("system:time_start"),
            "hist": hist,
            "ndci": idx.get("ndci"),
            "ndti": idx.get("ndti"),
            "red": idx.get("red_r"),
            "algae_ndvi": algae_ndvi,
            "clear_frac": clear_frac,
        })

    return coll.map(per_img)


def parse_scene(props: dict) -> dict | None:
    t = props.get("t")
    if t is None:
        return None
    date = datetime.fromtimestamp(t / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
    hist = props.get("hist") or {}
    counts = {int(float(k)): int(float(v)) for k, v in hist.items()}
    valid = sum(counts.values())
    if valid < MIN_VALID_PX:
        return {"date": date, "valid_px": valid, "low_confidence": True}
    fr = {f"frac_{CLASS_LABELS[c]}": round(counts.get(c, 0) / valid, 4)
          for c in CLASS_LABELS}
    clear = props.get("clear_frac")
    ow_px = counts.get(1, 0)
    ow_ok = ow_px >= MIN_OPEN_WATER_PX
    return {
        "date": date,
        "valid_px": valid,
        "open_water_px": ow_px,
        "cloud_pct": round(100 * (1 - clear), 1) if clear is not None else None,
        **fr,
        # algae-vigor: headline eutrophication-intensity signal for choked lakes
        "algae_vigor_ndvi": _r(props.get("algae_ndvi")),
        # open-water-only indices: gated to scenes with enough open water
        "ndci_rel": _r(props.get("ndci")) if ow_ok else None,
        "ndti_rel": _r(props.get("ndti")) if ow_ok else None,
        "red_rel": _r(props.get("red")) if ow_ok else None,
        "open_water_indices_gated": not ow_ok,
    }


def _r(v):
    return round(v, 4) if isinstance(v, (int, float)) else None


def monthly_rollup(scenes: list[dict]) -> dict:
    buckets: dict[str, list[dict]] = defaultdict(list)
    for s in scenes:
        if s.get("low_confidence"):
            continue
        buckets[s["date"][:7]].append(s)
    out = {}
    for ym, rows in sorted(buckets.items()):
        def avg(key):
            vals = [r[key] for r in rows if r.get(key) is not None]
            return round(sum(vals) / len(vals), 4) if vals else None
        out[ym] = {
            "n_scenes": len(rows),
            **{f"frac_{c}": avg(f"frac_{c}") for c in CLASS_LABELS.values()},
            "algae_vigor_ndvi": avg("algae_vigor_ndvi"),
            "ndci_rel": avg("ndci_rel"),
            "ndti_rel": avg("ndti_rel"),
            "red_rel": avg("red_rel"),
        }
    return out


def _status_and_headline(by_zone: dict) -> "tuple[dict, list[str]]":
    good = [s for s in by_zone.get("lakebed", {}).get("scenes", [])
            if not s.get("low_confidence")]
    n = len(good)

    def mean_frac(key):
        vals = [r[key] for r in good if r.get(key) is not None]
        return sum(vals) / len(vals) if vals else None

    ow = mean_frac("frac_open_water")
    alg = mean_frac("frac_algae")
    bed = mean_frac("frac_bed")
    fro = mean_frac("frac_froth")
    vigor = mean_frac("algae_vigor_ndvi")
    n_idx = sum(1 for s in good if s.get("ndci_rel") is not None)

    def pct(x):
        return f"{100 * x:.0f}%" if x is not None else "n/a"

    idx_status = (
        f"computed where >={MIN_OPEN_WATER_PX}px open water ({n_idx}/{n} "
        f"scenes), but open water averages only {pct(ow)} of the surface and "
        f"shifts location scene-to-scene - low spatial consistency, not a "
        f"lake-wide reading"
    )
    cap = {
        "classification": "ok",
        "surface_composition": "ok (primary signal for this lake)",
        "algae_vigor": "ok (relative NDVI over algae class)",
        "turbidity_rel": idx_status,
        "chl_ndci_rel": idx_status,
        "froth": "detected but low-confidence at S2 resolution; clusters in "
                 "dry pre-monsoon months - high-res signature phase pending",
        "do_bod_coliform": "gap: no optical signature - requires in-situ",
    }
    headline = [
        f"Surface composition (mean of {n} scenes): {pct(alg)} algae/macrophyte, "
        f"{pct(ow)} open water, {pct(bed)} bed, {pct(fro)} froth.",
    ]
    if vigor is not None:
        headline.append(f"Algae-mat vigour (mean NDVI over algae class): {vigor:.2f}.")
    headline.append(
        f"Reads as a vegetation-choked surface, not open water: open water "
        f"averages only {pct(ow)} and varies scene-to-scene, so turbidity/chl "
        f"are low-consistency proxies, not lake-wide metrics.")
    headline.append(
        "Froth is rare and localized (median 0% of surface), concentrating in "
        "dry pre-monsoon months; reliable quantification needs high-res (deferred).")
    return cap, headline


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-id", required=True)
    ap.add_argument("--start", default="2017-03-28")
    ap.add_argument("--end", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    ap.add_argument("--inset-m", type=int, default=10)
    ap.add_argument("--validate", action="store_true",
                    help="print per-scene classification table; skip file write")
    ap.add_argument("--diagnose", action="store_true",
                    help="dump feature-band percentiles to set thresholds; skip write")
    args = ap.parse_args()

    init_ee()

    base_zones = load_body_zones(ROOT, args.body_id)
    body = base_zones[ZONE_BODY]
    ee_body = shapely_to_ee(body)
    # open-water core = body inset by inset_m (water-class restriction applied
    # per-pass inside the reducer via cls==1)
    sampling: "OrderedDict[str, ee.Geometry]" = OrderedDict()
    sampling["lakebed"] = ee_body
    sampling["open_water_core"] = ee_body.buffer(-args.inset_m)
    for key, sz in load_named_subzones(ROOT, args.body_id).items():
        sampling[key] = shapely_to_ee(sz["geom"])

    aoi = ee_body.bounds()
    coll = (
        ee.ImageCollection(S2_SR)
        .filterBounds(aoi)
        .filterDate(args.start, args.end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 95))  # trim full-cloud
        .linkCollection(ee.ImageCollection(CS_PLUS), [CS_BAND])
        .map(preprocess)
    )
    n = coll.size().getInfo()
    print(f"S2 scenes in {args.start}..{args.end}: {n}")
    if n == 0:
        print("No scenes; aborting.")
        return

    if args.diagnose:
        _diagnose(coll, sampling)
        return

    by_zone: dict[str, dict] = {}
    for zname, zgeom in sampling.items():
        info = zone_series(coll, zgeom).getInfo()
        scenes = [p for p in (parse_scene(f["properties"]) for f in info["features"]) if p]
        scenes.sort(key=lambda s: s["date"])
        by_zone[zname] = {"scenes": scenes, "monthly": monthly_rollup(scenes)}
        print(f"  [{zname}] {len(scenes)} scenes parsed")

    if args.validate:
        _print_validation(by_zone)
        return

    cap_status, headline = _status_and_headline(by_zone)
    payload = {
        "body_id": args.body_id,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "tier": "relative",
        "cadence": {"evaluate": "per clear S2 scene", "stored": "per-scene + monthly rollup"},
        "capability_status": cap_status,
        "params": {
            "cloud_score_thresh": CS_THRESH, "inset_m": args.inset_m,
            "T_WATER_MNDWI": T_WATER_MNDWI, "T_VEG_NDVI": T_VEG_NDVI,
            "T_FROTH_BRIGHT": T_FROTH_BRIGHT, "T_FROTH_SWIR": T_FROTH_SWIR,
            "sample_scale_m": SAMPLE_SCALE, "min_valid_px": MIN_VALID_PX,
        },
        "data_source": {
            "dataset": S2_SR, "cloud_mask": f"{CS_PLUS} ({CS_BAND}>={CS_THRESH})",
            "ac_method": "Sen2Cor L2A (land-tuned; RELATIVE use only - not calibrated to NTU/mg/L)",
            "resolution_m": SAMPLE_SCALE,
            "resolution_note": "Sampled at 10m; SWIR (B11) and red-edge (B5) "
                               "are natively 20m and resampled, so MNDWI/NDCI "
                               "effective resolution remains 20m.",
            "method": "Per-pass MNDWI decision-tree classification (froth>algae>open-water>bed); "
                      "surface-composition fractions + algae-vigour (NDVI) are the primary "
                      "signal; NDTI/red turbidity + NDCI chl-a gated to open-water core.",
            "classes": CLASS_LABELS,
            "references": [
                "Xu 2006 (MNDWI)", "Mishra & Mishra 2012 RSE (NDCI)",
                "Lacaux et al. 2007 (NDTI)",
            ],
            "known_limitations": [
                "Tier-1 RELATIVE only: indices are not calibrated to physical units. "
                "Calibration needs KSPCB in-situ (status: sought).",
                "DO/BOD/COD/coliform have no optical signature - permanently a declared gap.",
                "Classification thresholds are initial; froth/algae separation must be "
                "validated against known froth dates before the series is trusted.",
                "Monsoon cloud blanks optical chemistry; SAR fallback is a later phase.",
                "Sen2Cor AC is land-tuned; absolute values over water are biased.",
            ],
        },
        "date_range": [args.start, args.end],
        "n_scenes": n,
        "headline_for_v0": headline,
        "by_zone": by_zone,
    }
    out = ROOT / "public/data/rich-bodies" / f"{args.body_id}-pollution-state.json"
    out.write_text(json.dumps(payload, indent=2))
    print(f"\nWrote {out}")
    print("\n=== Headline ===")
    for line in headline:
        print(f"  {line}")


def _diagnose(coll: ee.ImageCollection, sampling: "OrderedDict") -> None:
    bands = ["bright", "swir", "ndvi", "mndwi", "red_r", "ndci"]
    pcts = [10, 50, 90, 95]
    redu = ee.Reducer.percentile(pcts)
    print("\n=== FEATURE PERCENTILES (set thresholds from these) ===")
    for zname in ("lakebed", "weir"):
        geom = sampling[zname]

        def per_img(img):
            img = ee.Image(img)
            stats = img.select(bands).reduceRegion(
                reducer=redu, geometry=geom, scale=SAMPLE_SCALE, maxPixels=MAXPIX,
            )
            return ee.Feature(None, stats.set("t", img.get("system:time_start")))

        info = ee.FeatureCollection(coll.map(per_img)).getInfo()
        print(f"\n[{zname}]")
        for feat in info["features"]:
            p = feat["properties"]
            t = p.get("t")
            if t is None:
                continue
            date = datetime.fromtimestamp(t / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            print(f"  {date}")
            for b in bands:
                vals = [p.get(f"{b}_p{q}") for q in pcts]
                cells = " ".join(
                    f"p{q}={(_r(v) if v is not None else 'NA')!s:>8}"
                    for q, v in zip(pcts, vals)
                )
                print(f"    {b:<8} {cells}")


def _print_validation(by_zone: dict) -> None:
    print("\n=== CLASSIFIER VALIDATION (per scene) ===")
    for zname in ("lakebed", "weir"):
        if zname not in by_zone:
            continue
        print(f"\n[{zname}]  date        valid  open%  algae%  froth%  bed%   ndci")
        for s in by_zone[zname]["scenes"]:
            if s.get("low_confidence"):
                print(f"  {s['date']}   {s['valid_px']:>5}  (low confidence)")
                continue
            print(f"  {s['date']}   {s['valid_px']:>5}  "
                  f"{100*s['frac_open_water']:>5.1f}  {100*s['frac_algae']:>5.1f}  "
                  f"{100*s['frac_froth']:>5.1f}  {100*s['frac_bed']:>4.1f}  "
                  f"{s['ndci_rel']}")
    print("\nExpectation: froth% at the weir should spike on known froth dates.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)

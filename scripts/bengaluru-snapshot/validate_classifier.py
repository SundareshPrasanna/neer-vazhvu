"""Classifier validation (build step 6; methodology note 7.4, 10.4): compare
class shares per pass under two rules on named lakes and windows, so the rule
the snapshot runs with is chosen on evidence and recorded as methods-as-data.

  rule A (Bellandur-tuned initial rule): froth = bright > 0.18 and SWIR > 0.10
         and NDVI < 0.10; algae = NDVI > 0.25 on non-froth; water = MNDWI > 0 on
         the rest; bed = remainder
  rule B (refined): froth additionally needs NIR >= SWIR (foam absorbs SWIR; a
         bright dry lakebed has SWIR above NIR); the vegetation class needs
         MNDWI <= 0 (a mat is dark in the SWIR sense; green bloom water with
         NDVI 0.25-0.45 and MNDWI well above 0 stays open water, and its bloom
         is carried by NDCI on the core); water = MNDWI > 0 on the rest

Per lake per pass: shares under both rules on the lakebed (and on the weir
sub-zone for Bellandur), with NDVI, MNDWI, NIR and SWIR medians.

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python \
       scripts/bengaluru-snapshot/validate_classifier.py --only gba-bbmp-155,gba-bda-001 --start 2026-02-01 --end 2026-03-16
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ee  # noqa: E402
import run_lake_state as rls  # noqa: E402


def classes_ab(img: ee.Image) -> ee.Image:
    swath = img.select("B3").mask()
    clear = img.select(rls.CS_BAND).gte(rls.CS_THRESH).unmask(0).updateMask(swath)
    r = img.select(["B3", "B4", "B8", "B11"]).divide(rls.REFL_SCALE)
    green, red, nir, swir = [r.select(b) for b in ["B3", "B4", "B8", "B11"]]
    mndwi = green.subtract(swir).divide(green.add(swir))
    ndvi = nir.subtract(red).divide(nir.add(red))
    bright = green.add(red).add(nir).divide(3)
    froth_a = bright.gt(rls.T_FROTH_BRIGHT).And(swir.gt(rls.T_FROTH_SWIR)).And(ndvi.lt(rls.T_FROTH_NDVI))
    algae_a = ndvi.gt(rls.T_VEG_NDVI).And(froth_a.Not())
    water_a = mndwi.gt(rls.T_WATER_MNDWI).And(froth_a.Not()).And(algae_a.Not())
    froth_b = froth_a.And(nir.gte(swir))
    algae_b = ndvi.gt(rls.T_VEG_NDVI).And(mndwi.lte(0)).And(froth_b.Not())
    water_b = mndwi.gt(rls.T_WATER_MNDWI).And(froth_b.Not()).And(algae_b.Not())
    out = ee.Image.cat([
        water_a.rename("a_water"), algae_a.rename("a_algae"), froth_a.rename("a_froth"),
        water_b.rename("b_water"), algae_b.rename("b_algae"), froth_b.rename("b_froth"),
        ndvi.rename("ndvi"), mndwi.rename("mndwi"), nir.rename("nir"), swir.rename("swir"), bright.rename("bright"),
    ]).updateMask(clear)
    return out.set("t", img.get("system:time_start"))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", required=True)
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    args = ap.parse_args()
    rls.init_ee()
    zones, _ = rls.load_zones(set(args.only.split(",")))
    zones = [z for z in zones if z["kind"] in ("lakebed", "outflow", "weir")]
    fc = rls.zones_fc(zones)
    aoi = rls.zones_bounds(zones)
    coll = (ee.ImageCollection(rls.S2_SR).filterBounds(aoi).filterDate(args.start, args.end)
            .linkCollection(ee.ImageCollection(rls.CS_PLUS), [rls.CS_BAND]).map(classes_ab))
    red = ee.Reducer.mean().combine(ee.Reducer.count(), sharedInputs=True)

    def _per(img):
        img = ee.Image(img)
        return img.reduceRegions(fc, red, rls.SCALE, rls.CRS).map(lambda f: ee.Feature(None, f.toDictionary().set("t", img.get("t"))))
    feats = ee.FeatureCollection(coll.map(_per)).flatten().getInfo()["features"]
    by = defaultdict(list)
    for f in feats:
        by[f["properties"]["zone_id"]].append(f["properties"])
    for zid, ps in sorted(by.items()):
        print(f"\n[{zid}]  date        n     | rule A  water algae froth | rule B  water algae froth | ndvi  mndwi  nir   swir  bright (medians of means)")
        for p in sorted(ps, key=lambda p: p["t"]):
            if not p.get("ndvi_count"):
                continue
            d = datetime.fromtimestamp(p["t"] / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            g = lambda k: p.get(k) if p.get(k) is not None else float("nan")
            print(f"  {d} {int(p['ndvi_count']):>6} |         {g('a_water_mean'):5.2f} {g('a_algae_mean'):5.2f} {g('a_froth_mean'):5.2f} |         "
                  f"{g('b_water_mean'):5.2f} {g('b_algae_mean'):5.2f} {g('b_froth_mean'):5.2f} | {g('ndvi_mean'):5.2f} {g('mndwi_mean'):6.2f} {g('nir_mean'):5.3f} {g('swir_mean'):5.3f} {g('bright_mean'):5.3f}")


if __name__ == "__main__":
    main()

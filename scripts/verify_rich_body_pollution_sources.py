"""
Pollution SOURCES capability (Tier-1, relative) for a rich-data body.
Generic across rich bodies via --body-id.

Characterises each named sub-zone (inlet / weir / outflow) as a candidate
pollution source by its ANOMALY vs the lake interior - i.e. is this spot
more eutrophic / frothier / more turbid / warmer than the body as a whole,
and how persistently. Output is candidate source signals for field
verification, NOT a verdict that sewage discharges here.

Two inputs:
  1. S2 composition + index anomalies, read from the STATE output
     (<body>-pollution-state.json) - no GEE re-run, well-resolved at 10m.
  2. Landsat C2 L2 surface temperature (ST_B10) - NEW GEE pull. Thermal is
     natively 100m so a 120m sub-zone is ~1 thermal pixel: the LST anomaly
     is INDICATIVE, not precise. Flagged in the output.

Output: public/data/rich-bodies/<body_id>-pollution-sources.json

  python scripts/verify_rich_body_pollution_sources.py --body-id bellandur
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "neer-vazhvu-api" / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import ee  # noqa: E402
from _rich_body_zones import ZONE_BODY, load_body_zones, load_named_subzones  # noqa: E402

LST_SCALE, LST_OFFSET = 0.00341802, 149.0   # ST_B10 -> Kelvin
MAXPIX = int(1e9)
LAKEBED = "lakebed"


def init_ee() -> None:
    project = os.environ["GEE_CLOUD_PROJECT"]
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    with open(key_file) as f:
        client_email = json.load(f)["client_email"]
    ee.Initialize(credentials=ee.ServiceAccountCredentials(client_email, key_file=key_file),
                  project=project)
    print(f"GEE initialised: project={project}")


def shapely_to_ee(geom) -> ee.Geometry:
    return ee.Geometry(json.loads(json.dumps(geom.__geo_interface__)))


# ---- 1. S2 index/composition anomalies from the STATE output ----------------

def s2_anomalies(state: dict, subzones: list[str]) -> dict:
    """For each sub-zone, mean(sub-zone - lakebed) over date-matched scenes,
    plus persistence (% of scenes where the sub-zone is elevated), for the
    composition + index fields the STATE capability already produced."""
    fields = ["frac_algae", "frac_froth", "ndti_rel", "ndci_rel", "red_rel"]

    def index_by_date(zone):
        out = {}
        for s in state["by_zone"].get(zone, {}).get("scenes", []):
            if not s.get("low_confidence"):
                out[s["date"]] = s
        return out

    lake = index_by_date(LAKEBED)
    result = {}
    for z in subzones:
        zd = index_by_date(z)
        dates = sorted(set(zd) & set(lake))
        per_field = {}
        for f in fields:
            diffs = [zd[d][f] - lake[d][f] for d in dates
                     if zd[d].get(f) is not None and lake[d].get(f) is not None]
            if diffs:
                elevated = sum(1 for x in diffs if x > 0)
                per_field[f] = {
                    "mean_anomaly": round(sum(diffs) / len(diffs), 4),
                    "n": len(diffs),
                    "persistence_pct": round(100 * elevated / len(diffs), 1),
                }
        result[z] = per_field
    return result


# ---- 2. Landsat thermal anomalies (NEW GEE) ---------------------------------

def lst_collection(start, end, aoi):
    def prep(img):
        qa = img.select("QA_PIXEL")
        bad = (qa.bitwiseAnd(1 << 3).neq(0)
               .Or(qa.bitwiseAnd(1 << 4).neq(0)))   # cloud / cloud shadow
        lst = (img.select("ST_B10").multiply(LST_SCALE).add(LST_OFFSET)
               .subtract(273.15).rename("lst"))
        return lst.updateMask(bad.Not()).copyProperties(img, ["system:time_start"])

    l8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2").filterBounds(aoi).filterDate(start, end)
    l9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2").filterBounds(aoi).filterDate(start, end)
    return l8.merge(l9).map(prep)


def lst_series(coll, zones: dict) -> list[dict]:
    items = list(zones.items())

    def per_img(img):
        img = ee.Image(img)
        feat = ee.Feature(None, {"t": img.get("system:time_start")})
        for name, geom in items:
            v = img.reduceRegion(ee.Reducer.mean(), geom, 30, maxPixels=MAXPIX).get("lst")
            feat = feat.set(name, v)
        return feat

    info = ee.FeatureCollection(coll.map(per_img)).getInfo()
    rows = []
    for f in info["features"]:
        p = f["properties"]
        t = p.get("t")
        if t is None or p.get(LAKEBED) is None:
            continue
        rows.append({
            "date": datetime.fromtimestamp(t / 1000, tz=timezone.utc).strftime("%Y-%m-%d"),
            **{k: round(p[k], 2) for k in zones if p.get(k) is not None},
        })
    return sorted(rows, key=lambda r: r["date"])


def thermal_anomalies(rows: list[dict], subzones: list[str]) -> dict:
    out = {}
    for z in subzones:
        diffs = [r[z] - r[LAKEBED] for r in rows if z in r and LAKEBED in r]
        if diffs:
            warmer = sum(1 for x in diffs if x > 0)
            out[z] = {
                "mean_anomaly_c": round(sum(diffs) / len(diffs), 2),
                "n": len(diffs),
                "warmer_pct": round(100 * warmer / len(diffs), 1),
            }
    return out


def characterise(z: str, kind: str, s2: dict, th: dict) -> str:
    bits = []
    a = s2.get("frac_algae", {})
    fr = s2.get("frac_froth", {})
    if a and abs(a["mean_anomaly"]) >= 0.05:
        bits.append(f"{'more' if a['mean_anomaly'] > 0 else 'less'} algae "
                    f"({a['mean_anomaly'] * 100:+.0f}pp, {a['persistence_pct']:.0f}% of scenes)")
    if fr and fr["mean_anomaly"] >= 0.02:
        bits.append(f"more froth ({fr['mean_anomaly'] * 100:+.1f}pp, "
                    f"{fr['persistence_pct']:.0f}% of scenes)")
    t = th.get(z)
    if t and abs(t["mean_anomaly_c"]) >= 0.5:
        bits.append(f"{'warmer' if t['mean_anomaly_c'] > 0 else 'cooler'} "
                    f"{t['mean_anomaly_c']:+.1f}C [coarse]")
    if not bits:
        return f"{kind}: no strong anomaly vs lake interior in free optical/thermal."
    return f"{kind}: " + "; ".join(bits) + " - candidate for field verification."


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-id", required=True)
    ap.add_argument("--start", default="2017-03-28")
    ap.add_argument("--end", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    args = ap.parse_args()

    state_path = ROOT / "public/data/rich-bodies" / f"{args.body_id}-pollution-state.json"
    if not state_path.exists():
        print(f"FAILED: {state_path} missing - run the STATE capability first.", file=sys.stderr)
        sys.exit(1)
    state = json.loads(state_path.read_text())

    init_ee()

    base = load_body_zones(ROOT, args.body_id)
    named = load_named_subzones(ROOT, args.body_id)
    subzones = list(named.keys())
    if not subzones:
        print("No named sub-zones for this body; nothing to characterise.")
        return

    zones = {LAKEBED: shapely_to_ee(base[ZONE_BODY])}
    kinds = {}
    for k, sz in named.items():
        zones[k] = shapely_to_ee(sz["geom"])
        kinds[k] = sz["kind"]

    s2 = s2_anomalies(state, subzones)
    aoi = zones[LAKEBED].bounds()
    rows = lst_series(lst_collection(args.start, args.end, aoi), zones)
    th = thermal_anomalies(rows, subzones)
    print(f"Landsat thermal scenes: {len(rows)}")

    sources = {}
    for z in subzones:
        sources[z] = {
            "kind": kinds[z],
            "label": named[z]["label"],
            "s2_anomaly": s2.get(z, {}),
            "thermal_anomaly": th.get(z, {}),
            "characterisation": characterise(z, kinds[z], s2.get(z, {}), th),
        }

    payload = {
        "body_id": args.body_id,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "tier": "relative",
        "capability_status": {
            "s2_source_anomaly": "ok (10m, well-resolved)",
            "thermal_anomaly": "indicative only - Landsat thermal native 100m, "
                               "a 120m sub-zone is ~1 thermal pixel",
            "outfall_pinpoint": "gap: exact discharge mouth needs high-res / SAR slick / field",
        },
        "data_source": {
            "s2_state": str(state_path.name),
            "thermal": "LANDSAT/LC08+LC09 C02 L2 ST_B10 (QA_PIXEL cloud-masked)",
            "method": "Per-sub-zone anomaly vs lake interior (sub-zone minus lakebed), "
                      "date-matched, with persistence. Candidate source signals, not verdicts.",
            "known_limitations": [
                "Sub-zone locations are derived candidates (inlet/weir) - see zone geojson provenance.",
                "Thermal anomaly is coarse at sub-zone scale (100m native).",
                "Does not distinguish sewage vs stormwater vs industrial - field verification required.",
            ],
        },
        "thermal_series": rows,
        "sources": sources,
        "headline_for_v0": [sources[z]["characterisation"] for z in subzones],
    }
    out = ROOT / "public/data/rich-bodies" / f"{args.body_id}-pollution-sources.json"
    out.write_text(json.dumps(payload, indent=2))
    print(f"\nWrote {out}\n\n=== Headline ===")
    for line in payload["headline_for_v0"]:
        print(f"  {line}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)

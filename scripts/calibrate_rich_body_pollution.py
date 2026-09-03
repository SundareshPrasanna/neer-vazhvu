"""
Tier-2 calibration ENGINE for the pollution layer. Generic via --body-id.

Promotes the relative satellite indices (NDTI/red turbidity, NDCI chl) to
physical units by regressing them against date-matched in-situ samples.
The maths is trivial; the binding constraint is having in-situ measurements
of a SATELLITE-CALIBRATABLE parameter (turbidity NTU / TSS mg/L /
chlorophyll-a ug/L).

IMPORTANT (researched 2026-06): the public KSPCB/CPCB NWMP data for
Bellandur reports pH, EC, DO, BOD, coliform (+ nitrate/COD/TDS in full
sheets) - i.e. the parameters with NO optical signature. The calibratable
parameters are largely absent (chlorophyll-a essentially never; TSS only
sometimes). So in-situ must come from: NWMP full sheets IF they carry TSS,
or IISc / T.V. Ramachandra academic datasets (chl/turbidity), or a field
campaign. This script activates the moment any such matched data exists.

IN-SITU DATA CONTRACT - CSV at data/insitu/<body_id>-insitu.csv:
    date,param,value,source[,station]
  date  = YYYY-MM-DD (sample date)
  param = turbidity_ntu | tss_mgl | chl_ugl
  value = float (in the unit named by param)
  source= short provenance string (e.g. "KSPCB NWMP", "IISc Ramachandra 2019")

Output: public/data/rich-bodies/<body_id>-pollution-calibration.json

  python scripts/calibrate_rich_body_pollution.py --body-id bellandur
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# in-situ parameter -> satellite index it calibrates (from open_water_core)
PARAM_INDEX = {
    "turbidity_ntu": "ndti_rel",
    "tss_mgl": "ndti_rel",
    "chl_ugl": "ndci_rel",
}
MATCH_WINDOW_DAYS = 3
PROMOTE_MIN_N = 10
PROMOTE_MIN_R2 = 0.5
SAMPLE_ZONE = "open_water_core"   # indices are computed on actual water here


def ols(xs: list[float], ys: list[float]) -> dict:
    """Plain ordinary least squares y = a*x + b with R2 and RMSE."""
    n = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    a = sxy / sxx if sxx else 0.0
    b = my - a * mx
    ss_tot = sum((y - my) ** 2 for y in ys)
    ss_res = sum((y - (a * x + b)) ** 2 for x, y in zip(xs, ys))
    r2 = 1 - ss_res / ss_tot if ss_tot else 0.0
    rmse = (ss_res / n) ** 0.5
    return {"slope": round(a, 5), "intercept": round(b, 5),
            "r2": round(r2, 4), "rmse": round(rmse, 4), "n": n}


def load_insitu(path: Path) -> list[dict]:
    rows = []
    with open(path) as f:
        for r in csv.DictReader(f):
            try:
                rows.append({
                    "date": datetime.strptime(r["date"].strip(), "%Y-%m-%d").date(),
                    "param": r["param"].strip(),
                    "value": float(r["value"]),
                    "source": r.get("source", "").strip(),
                })
            except (ValueError, KeyError):
                continue
    return rows


def sat_index_by_date(state: dict, index_key: str) -> list[tuple]:
    out = []
    for s in state["by_zone"].get(SAMPLE_ZONE, {}).get("scenes", []):
        if s.get("low_confidence") or s.get(index_key) is None:
            continue
        out.append((datetime.strptime(s["date"], "%Y-%m-%d").date(), s[index_key]))
    return out


def match(insitu: list[dict], sat: list[tuple], window: int) -> list[tuple]:
    """Pair each in-situ sample with the nearest satellite scene within
    +/- window days. Returns (sat_index, insitu_value) pairs."""
    pairs = []
    for s in insitu:
        best = None
        for d, idx in sat:
            dd = abs((d - s["date"]).days)
            if dd <= window and (best is None or dd < best[0]):
                best = (dd, idx)
        if best:
            pairs.append((best[1], s["value"]))
    return pairs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-id", required=True)
    ap.add_argument("--insitu", help="override in-situ CSV path")
    ap.add_argument("--window", type=int, default=MATCH_WINDOW_DAYS)
    args = ap.parse_args()

    state_path = ROOT / "public/data/rich-bodies" / f"{args.body_id}-pollution-state.json"
    if not state_path.exists():
        print(f"FAILED: {state_path} missing - run the STATE capability first.", file=sys.stderr)
        sys.exit(1)
    state = json.loads(state_path.read_text())

    insitu_path = Path(args.insitu) if args.insitu else \
        ROOT / "data/insitu" / f"{args.body_id}-insitu.csv"

    if not insitu_path.exists():
        print(f"No in-situ CSV at {insitu_path}.")
        print("\nTier-2 is GATED on matched in-situ data. Provide a CSV with the contract:")
        print("  date,param,value,source")
        print("  param in {turbidity_ntu, tss_mgl, chl_ugl}")
        print("\nAcquisition options (researched 2026-06):")
        print("  - NWMP full monthly sheets IF they carry TSS for this body (public, PDF)")
        print("  - IISc / T.V. Ramachandra academic datasets (chl/turbidity)")
        print("  - field sampling matched to S2 pass dates")
        print("\nNote: public KSPCB/CPCB NWMP reports BOD/DO/pH/EC/coliform - none "
              "optically calibratable; chlorophyll-a is essentially never measured.")
        return

    insitu = load_insitu(insitu_path)
    by_param: dict[str, list] = {}
    for r in insitu:
        by_param.setdefault(r["param"], []).append(r)

    calibrations = {}
    for param, samples in by_param.items():
        index_key = PARAM_INDEX.get(param)
        if not index_key:
            print(f"Skipping unknown param '{param}'")
            continue
        sat = sat_index_by_date(state, index_key)
        pairs = match(samples, sat, args.window)
        if len(pairs) < 3:
            calibrations[param] = {"status": "insufficient matched pairs",
                                   "n_matched": len(pairs), "index": index_key}
            continue
        xs = [p[0] for p in pairs]
        ys = [p[1] for p in pairs]
        fit = ols(xs, ys)
        promote = fit["n"] >= PROMOTE_MIN_N and fit["r2"] >= PROMOTE_MIN_R2
        calibrations[param] = {
            "index": index_key, "match_window_days": args.window,
            **fit,
            "model": f"{param} = {fit['slope']} * {index_key} + {fit['intercept']}",
            "promote_to_tier2": promote,
            "promote_reason": (f"R2={fit['r2']} n={fit['n']}: "
                               + ("meets" if promote else "below")
                               + f" threshold (R2>={PROMOTE_MIN_R2}, n>={PROMOTE_MIN_N})"),
            "sources": sorted({s["source"] for s in samples if s["source"]}),
        }

    payload = {
        "body_id": args.body_id,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "tier": "2 (calibrated) - candidate",
        "method": f"OLS of in-situ vs {SAMPLE_ZONE} satellite index, "
                  f"date-matched within +/-{args.window} days.",
        "known_limitations": [
            "Linear OLS; small n; relative index from land-tuned AC - treat coefficients as provisional.",
            "Only turbidity/TSS/chl are calibratable; DO/BOD/coliform remain a permanent optical gap.",
            "For vegetation-choked bodies the open-water index is a low-consistency sliver - calibration may be weak.",
        ],
        "calibrations": calibrations,
    }
    out = ROOT / "public/data/rich-bodies" / f"{args.body_id}-pollution-calibration.json"
    out.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {out}\n")
    for param, c in calibrations.items():
        print(f"  {param}: {c.get('model', c.get('status'))}  "
              f"(R2={c.get('r2', '-')}, n={c.get('n', c.get('n_matched', 0))}, "
              f"promote={c.get('promote_to_tier2', False)})")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)

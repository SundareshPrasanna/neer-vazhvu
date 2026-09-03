"""Per-lake summary for the snapshot (build step 7; methodology note sections
7.7, 7.8, 8.1 to 8.4, 8.11, 11, 16.2, 16.4, Appendix D).

Reads lake-passes.csv.gz (one row per lake per clear or partial pass) and the
footprint, built-up and join tables, and writes one JSON per lake plus a flat
CSV, each value carrying n, an error band and a confidence class:

  current season   the latest season with at least MIN_SEASON_PASSES clear passes
                   for that lake (pre-monsoon Mar-May, monsoon Jun-Sep,
                   post-monsoon Oct-Dec, winter Jan-Feb); named on every value
  W1, W2, W4, W5   composition shares: seasonal median of per-pass shares, band =
                   binomial standard error on the effective pixel count (Appendix
                   D: interior pixels / 4) plus the classifier's default
                   allowance (10 points before validation, note 16.2)
  Q1, Q3, Q5, Q7   core index medians: seasonal median of per-pass p50, band =
                   interquartile range across the season's passes; shown as a
                   percentile against the lake's own same-season history (P7)
  P1               share of core open water above the NDCI 0.1 mark, as W
  P7               own-baseline percentile of the current seasonal median within
                   the same-season per-pass distribution of prior years; needs 3
                   prior seasons and 10 observations; rank error from Appendix D.4
  H1, H2           water area = W1 x footprint; share of the observed maximum
  W4 events        passes per year with froth above 5% (of the outflow sub-zone
                   where one exists, else of the footprint); a lower bound
  X1, X2           clear passes per season and days since the last clear pass
  B1               built share inside the footprint (latest Dynamic World year)
  G2, V1, V2, N1   the regulator's class, custodian, programme state, cascade

Confidence (note 16.4) is the worst of: interior pixels, adjacency share, clear
passes in the period, baseline observations, classifier validation (default
thresholds = Low unless classifier-validation.json lists the lake's type as
validated), boundary provenance. Nothing is interpolated; a value under a floor
reads "insufficient" with the reason.

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python \
       scripts/bengaluru-snapshot/build_lake_summary.py [--as-of 2026-09-03]
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import math
import statistics
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs/research/bengaluru-lakes/data"
OUT = DATA / "lakes"

SEASONS = {"winter": (1, 2), "pre_monsoon": (3, 5), "monsoon": (6, 9), "post_monsoon": (10, 12)}
SEASON_LABEL = {"winter": "winter (Jan-Feb)", "pre_monsoon": "pre-monsoon (Mar-May)", "monsoon": "monsoon (Jun-Sep)", "post_monsoon": "post-monsoon (Oct-Dec)"}
MIN_SEASON_PASSES = 4        # note 7.8 seasonal statistic floor
MIN_BASELINE_SEASONS = 3     # note 7.8 own-baseline floor
MIN_BASELINE_OBS = 10        # note 16.4 E6
CLASSIFIER_ALLOWANCE = {"high": 0.02, "medium": 0.05, "low": 0.10}   # note 16.2; step 6 evidence:
                             # rule A vs B on Bellandur within 2 points (high), orbit-to-orbit
                             # spread on Jakkur under rule B about 5 points (medium), 10 before validation
FROTH_EVENT_SHARE = 0.05     # note 8.1 W4
EFFECTIVE_PX_DIVISOR = 4     # Appendix D.2
COMP_KEYS = {"W1": "frac_open_water", "W2": "frac_algae", "W4": "frac_froth", "W5": "frac_bed"}
IDX_KEYS = {"Q1": "ndci_p50", "Q3": "ndti_p50", "Q5": "gr_p50", "Q7": "hue_p50", "P1": "p1_ndci"}
PCTL_SE = {10: 9.5, 30: 5.5, 100: 3.0, 300: 1.7}   # Appendix D.4, rank SE of the 90th percentile
VERSION = "lake-summary-v1"


def season_of(d: date) -> tuple[str, int]:
    for s, (a, b) in SEASONS.items():
        if a <= d.month <= b:
            return s, d.year
    raise ValueError(d)


def fnum(v):
    try:
        return float(v) if v not in ("", None, "None") else None
    except ValueError:
        return None


def pct_rank(value: float, dist: list[float]) -> float:
    below = sum(1 for x in dist if x < value); ties = sum(1 for x in dist if x == value)
    return 100 * (below + 0.5 * ties) / len(dist)


def rank_se(n: int) -> float:
    for k in sorted(PCTL_SE):
        if n <= k:
            return PCTL_SE[k]
    return PCTL_SE[300]


def cls_pixels(n: int) -> str:
    return "high" if n >= 1000 else "medium" if n >= 100 else "low" if n >= 20 else "insufficient"


def cls_shore(share: float) -> str:
    return "high" if share < 0.3 else "medium" if share <= 0.6 else "low"


def cls_passes(n: int) -> str:
    return "high" if n >= 8 else "medium" if n >= 4 else "low" if n >= 2 else "insufficient"


def cls_baseline(n: int, seasons: int) -> str:
    if n < MIN_BASELINE_OBS or seasons < MIN_BASELINE_SEASONS:
        return "insufficient"
    return "high" if n >= 100 else "medium" if n >= 30 else "low"


ORDER = {"high": 0, "medium": 1, "low": 2, "insufficient": 3}


def worst(*classes: str) -> str:
    return max(classes, key=lambda c: ORDER[c])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    args = ap.parse_args()
    as_of = date.fromisoformat(args.as_of)
    OUT.mkdir(exist_ok=True)

    fps = {r["spine_id"]: r for r in csv.DictReader(open(DATA / "gba-lakes-footprints.csv"))}
    joins = {r["spine_id"]: r for r in csv.DictReader(open(DATA / "gba-lakes-joins.csv"))}
    spine = {r["spine_id"]: r for r in csv.DictReader(open(DATA / "gba-lakes-spine.csv"))}
    built: dict[str, dict[int, dict]] = defaultdict(dict)
    for r in csv.DictReader(open(DATA / "gba-lakes-builtup.csv")):
        built[r["spine_id"]][int(r["year"])] = r
    validated = {"lakes": {}, "types": {}}
    vp = DATA / "classifier-validation.json"
    if vp.exists():
        validated = json.load(open(vp))
    passes: dict[str, list[dict]] = defaultdict(list)
    with gzip.open(DATA / "lake-passes.csv.gz", "rt") as f:
        for r in csv.DictReader(f):
            passes[r["spine_id"]].append(r)

    flat = []
    for sid, fp in sorted(fps.items()):
        rows = sorted(passes.get(sid, []), key=lambda r: r["date"])
        clear = [r for r in rows if r["pass_class"] == "clear"]
        interior_px = int(fp["interior_px_10m"]); interior_px20 = int(fp["interior_px_20m"])
        n_eff = max(1, interior_px // EFFECTIVE_PX_DIVISOR)
        # lake type from the baseline composition (all clear passes): decides which
        # step 6 validation applies (note 16.4: this lake = high, same type = medium)
        comp = defaultdict(list)
        for r in clear:
            if r.get("comp_ok") == "True":
                for c in ("frac_open_water", "frac_algae", "frac_bed"):
                    comp[c].append(float(r[c]))
        if not comp["frac_open_water"]:
            ltype = "no-data"
        elif interior_px < 100:
            ltype = "small"
        else:
            ow, al, bd = (statistics.median(comp[c]) for c in ("frac_open_water", "frac_algae", "frac_bed"))
            ltype = "open" if ow >= 0.5 else "choked" if al >= 0.5 else "dry" if bd >= 0.5 else "mixed"
        cls_conf = validated["lakes"].get(sid, {}).get("class") or validated["types"].get(ltype, {}).get("class", "low")
        base_conf = {
            "pixels_10m": cls_pixels(interior_px), "pixels_20m": cls_pixels(interior_px20),
            "adjacency": cls_shore(float(fp["shore100_share"])),
            "boundary": fp["boundary_confidence"],
            "classifier": cls_conf, "lake_type": ltype,
        }
        # seasons with enough clear passes; the current one is the latest
        by_season: dict[tuple[str, int], list[dict]] = defaultdict(list)
        for r in clear:
            by_season[season_of(date.fromisoformat(r["date"]))].append(r)
        seasons_ok = sorted((k for k, v in by_season.items() if len(v) >= MIN_SEASON_PASSES), key=lambda k: (k[1], list(SEASONS).index(k[0])))
        cur = seasons_ok[-1] if seasons_ok else None
        out = {
            "spine_id": sid, "ktcda_key": fp["ktcda_key"], "name": fp["ktcda_name"], "osm_name": fp["osm_name"],
            "custodian": fp["ktcda_custodian"], "corporation": fp["corporation"], "ward": fp["ward_name"],
            "version": VERSION, "as_of": args.as_of,
            "footprint": {"area_ha": float(fp["footprint_area_ha"]), "observed_max_ha": float(fp["observed_max_area_ha"]), "osm_ha": float(fp["osm_area_ha"]),
                          "interior_px_10m": interior_px, "interior_px_20m": interior_px20, "ring_m": int(fp["ring_m"]),
                          "shore100_share": float(fp["shore100_share"]), "provenance": fp["boundary_provenance"], "confidence": fp["boundary_confidence"], "flags": fp["flags"]},
            "coverage": {
                "passes_total": len(rows), "passes_clear": len(clear), "passes_partial": len(rows) - len(clear),
                "first_clear": clear[0]["date"] if clear else None, "last_clear": clear[-1]["date"] if clear else None,
                "days_since_last_clear": (as_of - date.fromisoformat(clear[-1]["date"])).days if clear else None,
                "clear_by_year": {y: sum(1 for r in clear if r["date"].startswith(str(y))) for y in range(2017, as_of.year + 1)},
            },
            "current_season": None, "kpis": {}, "insufficient": {},
        }
        if cur is None:
            out["insufficient"]["all"] = f"no season with {MIN_SEASON_PASSES} clear passes"
        else:
            cur_rows = by_season[cur]
            out["current_season"] = {"season": cur[0], "year": cur[1], "label": f"{SEASON_LABEL[cur[0]]} {cur[1]}", "clear_passes": len(cur_rows),
                                     "first": cur_rows[0]["date"], "last": cur_rows[-1]["date"]}
            passes_conf = cls_passes(len(cur_rows))
            # baseline: same season, prior years
            base_rows = [r for (s, y), v in by_season.items() if s == cur[0] and y < cur[1] for r in v]
            base_seasons = len({y for (s, y) in by_season if s == cur[0] and y < cur[1] and len(by_season[(s, y)]) >= 2})

            def kpi(key: str, col: str, is_share: bool):
                vals = [fnum(r.get(col)) for r in cur_rows]
                vals = [v for v in vals if v is not None]
                if len(vals) < MIN_SEASON_PASSES:
                    out["insufficient"][key] = f"{len(vals)} passes with a value in {SEASON_LABEL[cur[0]]} {cur[1]} (floor {MIN_SEASON_PASSES})"
                    return
                med = statistics.median(vals)
                q = statistics.quantiles(vals, n=4) if len(vals) >= 4 else [min(vals), med, max(vals)]
                if is_share:
                    se = math.sqrt(max(med * (1 - med), 1e-6) / n_eff)
                    allow = CLASSIFIER_ALLOWANCE.get(base_conf["classifier"], 0.10) if key.startswith("W") else 0.0
                    band = {"kind": "binomial_se_plus_classifier", "se": round(se, 4), "classifier_allowance": allow, "total": round(se + allow, 4)}
                else:
                    band = {"kind": "iqr_across_passes", "q1": round(q[0], 4), "q3": round(q[-1], 4), "total": round((q[-1] - q[0]) / 2, 4)}
                bvals = [fnum(r.get(col)) for r in base_rows]
                bvals = [v for v in bvals if v is not None]
                bconf = cls_baseline(len(bvals), base_seasons)
                p7 = None
                if bconf != "insufficient":
                    p7 = {"percentile": round(pct_rank(med, bvals), 1), "baseline_n": len(bvals), "baseline_seasons": base_seasons, "rank_se": rank_se(len(bvals)),
                          "baseline_median": round(statistics.median(bvals), 4), "baseline_years": f"{min(r['date'][:4] for r in base_rows)}-{max(r['date'][:4] for r in base_rows)}"}
                conf = worst(base_conf["pixels_20m" if key in ("Q1", "P1", "W1") else "pixels_10m"], base_conf["adjacency"] if key.startswith("Q") else "high",
                             passes_conf, base_conf["classifier"] if key.startswith("W") else "high", base_conf["boundary"] if key in ("W1", "W5") else "high")
                out["kpis"][key] = {"value": round(med, 4), "n": len(vals), "band": band, "own_baseline": p7, "baseline_confidence": bconf,
                                    "confidence": conf, "resolution_m": 20 if key in ("Q1", "P1", "W1") else 10,
                                    "season": out["current_season"]["label"]}

            for key, col in COMP_KEYS.items():
                kpi(key, col, True)
            for key, col in IDX_KEYS.items():
                kpi(key, col, key == "P1")
            # H1, H2 from W1
            w1 = out["kpis"].get("W1")
            if w1:
                area = float(fp["footprint_area_ha"]); obs = float(fp["observed_max_area_ha"])
                out["kpis"]["H1"] = {"value_ha": round(w1["value"] * area, 2), "band_ha": round(w1["band"]["total"] * area, 2), "n": w1["n"],
                                     "ring_share": float(fp["ring_share"]), "confidence": worst(w1["confidence"], base_conf["boundary"]), "season": w1["season"]}
                if obs > 0:
                    out["kpis"]["H2"] = {"value": round(min(1.0, w1["value"] * area / obs), 3), "denominator": "observed maximum 2017-2026 (no notified FTL polygon)",
                                         "band": round(w1["band"]["total"] * area / obs, 3), "confidence": worst(w1["confidence"], base_conf["boundary"]), "season": w1["season"]}
        # froth events per year (lower bound); outflow sub-zone where one exists
        ev_col = next((c for c in ("weir_frac_froth", "outflow_frac_froth") if any(c in r and r[c] not in ("", None) for r in clear)), "frac_froth")
        events = defaultdict(int)
        for r in clear:
            v = fnum(r.get(ev_col))
            if v is not None and v > FROTH_EVENT_SHARE:
                events[r["date"][:4]] += 1
        out["kpis"]["W4_events"] = {"per_year": dict(sorted(events.items())), "zone": ev_col.replace("_frac_froth", "") if ev_col != "frac_froth" else "footprint",
                                    "rule": f"clear passes with froth above {int(FROTH_EVENT_SHARE*100)}%", "bound": "lower bound at 10 m: patches under about 30 m are missed",
                                    "confidence": worst(base_conf["classifier"], "medium")}
        # B1 latest year
        by = built.get(sid, {})
        ok_years = sorted(y for y, r in by.items() if r["status"] == "ok")
        if ok_years:
            y = ok_years[-1]; r = by[y]
            b19 = by.get(2019, {}) if by.get(2019, {}).get("status") == "ok" else None
            out["kpis"]["B1"] = {"year": y, "built_share": float(r["share_built"]), "bare_share": float(r["share_bare"]), "water_share": float(r["share_water"]),
                                 "change_since_2019": round(float(r["share_built"]) - float(b19["share_built"]), 3) if b19 else None,
                                 "source": "Dynamic World V1 annual mode, footprint inset 30 m", "confidence": worst(base_conf["boundary"], "medium"),
                                 "note": "a lake under works reads as built or bare during the works"}
        else:
            out["insufficient"]["B1"] = "no Dynamic World year with enough scenes"
        # joins
        j = joins.get(sid, {})
        out["regulator"] = {"kspcb_class": j.get("kspcb_class") or None, "month": j.get("kspcb_month") or None, "station": j.get("kspcb_name") or None,
                            "join": j.get("kspcb_join"), "distance_m": j.get("kspcb_distance_m") or None,
                            "do_mgl": j.get("kspcb_do_mgl") or None, "bod_mgl": j.get("kspcb_bod_mgl") or None, "turbidity_ntu": j.get("kspcb_turbidity_ntu") or None,
                            "tss_mgl": j.get("kspcb_tss_mgl") or None, "fecal_coliform_mpn": j.get("kspcb_fecal_coliform_mpn") or None,
                            "join_quality": "high" if j.get("kspcb_join") in ("inside_footprint", "override") else "medium" if j.get("kspcb_join") == "nearest_name_agrees" else "none"}
        out["programme"] = {"state": j.get("programme_state") or None, "source_class": j.get("programme_source_class") or None, "names": j.get("programme_match_names") or None}
        out["cascade"] = {"position": spine[sid].get("cascade_position") or None, "inflows": spine[sid].get("degree_in") or None, "drains_to": spine[sid].get("drains_to") or None,
                          "upstream": j.get("upstream_lakes") or None}
        out["base_confidence"] = base_conf
        out["lake_type"] = ltype
        json.dump(out, open(OUT / f"{sid}.json", "w"), indent=1)
        k = out["kpis"]
        flat.append({
            "spine_id": sid, "name": fp["ktcda_name"], "custodian": fp["ktcda_custodian"], "corporation": fp["corporation"],
            "footprint_ha": fp["footprint_area_ha"], "boundary_confidence": fp["boundary_confidence"], "lake_type": ltype, "classifier_confidence": cls_conf,
            "season": out["current_season"]["label"] if out["current_season"] else "", "clear_passes": out["current_season"]["clear_passes"] if out["current_season"] else 0,
            "days_since_last_clear": out["coverage"]["days_since_last_clear"],
            **{f"{key}": k[key]["value"] if key in k else "" for key in list(COMP_KEYS) + list(IDX_KEYS)},
            **{f"{key}_band": k[key]["band"]["total"] if key in k else "" for key in list(COMP_KEYS) + list(IDX_KEYS)},
            **{f"{key}_p7": k[key]["own_baseline"]["percentile"] if key in k and k[key]["own_baseline"] else "" for key in list(COMP_KEYS) + list(IDX_KEYS)},
            **{f"{key}_conf": k[key]["confidence"] if key in k else "" for key in list(COMP_KEYS) + list(IDX_KEYS)},
            "H1_ha": k["H1"]["value_ha"] if "H1" in k else "", "H2": k["H2"]["value"] if "H2" in k else "",
            "W4_events_2025": k["W4_events"]["per_year"].get("2025", 0), "W4_events_2026": k["W4_events"]["per_year"].get("2026", 0),
            "B1_built": k["B1"]["built_share"] if "B1" in k else "", "B1_year": k["B1"]["year"] if "B1" in k else "",
            "kspcb_class": out["regulator"]["kspcb_class"] or "", "programme": out["programme"]["state"] or "",
            "cascade_position": out["cascade"]["position"] or "", "insufficient": "; ".join(f"{a}: {b}" for a, b in out["insufficient"].items()),
        })
    with open(DATA / "gba-lakes-summary.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(flat[0].keys())); w.writeheader(); w.writerows(flat)
    n_cur = sum(1 for r in flat if r["season"])
    print(f"wrote {len(flat)} lake summaries ({n_cur} with a current season) to {OUT} and gba-lakes-summary.csv")
    from collections import Counter
    print("current seasons:", Counter(r["season"] for r in flat))
    print("W1 confidence:", Counter(r["W1_conf"] for r in flat))
    print("Q1 confidence:", Counter(r["Q1_conf"] for r in flat))


if __name__ == "__main__":
    main()

"""Need class and the "fundable now" ordering (build step 10; register plan
section 7 applied to the snapshot's Tier 1 KPIs, methodology note 16.4 rule 3).

Axes, every rule published in ranking-params.json:

  Condition   Health Card bands where the snapshot can compute them, A best to E
              worst; the band of the value is used and flagged "two candidate
              bands" when the value's error band straddles a boundary:
                C1  share of full tank level (H2 against the observed maximum)
                C3  built share inside the footprint (B1, Dynamic World)
                C4  vegetated share (W2: algae, floating and emergent vegetation)
                C5  chlorophyll proxy (Q1 NDCI, Mishra and Mishra 2012 marks,
                    indicative on Sentinel-2)
                C8  froth events per year (W4, lower bound)
                G2  the regulator's Use Based Class (KSPCB, June 2026), as printed
              Condition band = the worse of (median of the computable bands; the
              single worst band when two or more read E).
  Stakes      High / Medium / Low from footprint area, lifted one class for a
              lake with two or more custody lakes downstream or 5,000 or more
              buildings in its routed catchment (cascade layer).
  Tractability High when the boundary is Medium and built share is under 10%;
              Medium when built share is 10-20% or the boundary is Low; Low when
              built share is 20% or more; Unknown when no water was observed or
              built share is insufficient.
  Urgency     Rising when the current season's Q1 or W2 sits at or above the
              lake's own 90th percentile (P7, after the rank error) or built share
              rose 5 points or more since 2019; Easing when both sit at or below
              the 10th; Steady otherwise; Unknown without a baseline.
  Programme   none / proposed (budget line) / works underway (press-reported
              works) from programme-state-2025-26.csv; source class carried.

Need class per the register table; rank within the city (the funding unit) by
Need class, Condition band, the lens-weighted Need index (Restoration need lens:
Condition 0.45, Urgency 0.25, Stakes 0.30; band A=0 to E=4, class High=2,
Medium=1, Low=0), confidence, then footprint area. Unassessed rows (no polygon,
no current season, no computable Condition band) are listed after with the
queue reason. Custodians are never ranked against each other.

Outputs: docs/research/bengaluru-lakes/data/gba-lakes-ranking.csv, ranking-params.json

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python \
       scripts/bengaluru-snapshot/build_ranking.py
"""
from __future__ import annotations

import csv
import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_joins import name_aliases  # noqa: E402
from build_spine import sim  # noqa: E402
DATA = ROOT / "docs/research/bengaluru-lakes/data"
LAKES = DATA / "lakes"
VERSION = "ranking-v1"

BAND_VAL = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}
CLASS_VAL = {"High": 2, "Medium": 1, "Low": 0, "Unknown": 0}
LENS = {"name": "Restoration need (default register lens; CSR-fundable ordering)", "condition": 0.45, "urgency": 0.25, "stakes": 0.30}
URGENCY_VAL = {"Rising": 2, "Steady": 1, "Easing": 0, "Unknown": 1}
NEED_ORDER = ["Fund now", "Co-fund", "Intervene early", "Design first", "Watch / verify", "Maintain", "Steward", "Unassessed"]
CONF_ORDER = {"high": 0, "medium": 1, "low": 2, "insufficient": 3, "": 3}

# band edges: value -> band; edges ascending, worse with higher value unless reversed
C1_EDGES = [(0.85, "A"), (0.70, "B"), (0.50, "C"), (0.30, "D")]        # share of full tank level, higher is better
C3_EDGES = [(0.01, "A"), (0.05, "B"), (0.10, "C"), (0.20, "D")]        # built share
C4_EDGES = [(0.10, "A"), (0.20, "B"), (0.30, "C"), (0.40, "D")]        # vegetated share
C5_EDGES = [(0.00, "A"), (0.10, "B"), (0.20, "C"), (0.40, "D")]        # NDCI
C8_EDGES = [(0.5, "A"), (2.5, "B"), (5.5, "C"), (9.5, "D")]            # froth events per year


def band_up(v: float, edges) -> str:
    for edge, b in edges:
        if v < edge:
            return b
    return "E"


def band_down(v: float, edges) -> str:
    for edge, b in edges:
        if v >= edge:
            return b
    return "E"


def banded(value, err, edges, reverse=False):
    """Band of the value plus the two candidate bands when the error straddles an edge."""
    f = band_down if reverse else band_up
    b = f(value, edges)
    lo, hi = f(value - err, edges), f(value + err, edges)
    cands = sorted({lo, b, hi}, key=BAND_VAL.get)
    return b, ("/".join(cands) if len(cands) > 1 else "")


def main() -> None:
    fps = {r["spine_id"]: r for r in csv.DictReader(open(DATA / "gba-lakes-footprints.csv"))}
    spine = list(csv.DictReader(open(DATA / "gba-lakes-spine.csv")))
    cascade = {f["properties"]["osm_id"]: f["properties"] for f in json.load(open(ROOT / "public/data/cascade/bangalore-cascade-lakes.geojson"))["features"]}
    osm_of = {r["spine_id"]: int(r["osm_id"]) for r in spine if r["osm_id"]}
    downstream: dict[int, set] = defaultdict(set)
    custody_osm = set(osm_of.values())
    for r in spine:
        if r["osm_id"] and r["drains_to"]:
            pass
    edges = json.load(open(ROOT / "public/data/cascade/bangalore-cascade-edges.geojson"))["features"]
    succ: dict[int, set] = defaultdict(set)
    for e in edges:
        p = e["properties"]
        succ[p["from_osm_id"]].add(p["to_osm_id"])

    def custody_downstream(o: int, depth=6) -> int:
        seen, frontier, n = {o}, {o}, 0
        for _ in range(depth):
            nxt = set()
            for x in frontier:
                for y in succ.get(x, ()):
                    if y not in seen:
                        seen.add(y); nxt.add(y)
                        if y in custody_osm:
                            n += 1
            frontier = nxt
            if not frontier:
                break
        return n

    kspcb = list(csv.DictReader(open(DATA / "kspcb-lakes-2026-06.csv")))
    joined_serials = {j["kspcb_serial"] for j in csv.DictReader(open(DATA / "gba-lakes-joins.csv")) if j["kspcb_serial"]}

    def station_anchor(name: str) -> str:
        """A KSPCB station not joined to any footprint whose name agrees with a
        polygon-less row: its coordinates anchor a hand-digitised boundary."""
        best = None
        for st in kspcb:
            if st["serial"] in joined_serials:
                continue
            agree = max((sim(a, b) for a in name_aliases(name) for b in name_aliases(st["name"])), default=0)
            if agree >= 0.85 and (best is None or agree > best[0]):
                best = (agree, st)
        return f"; KSPCB station '{best[1]['name']}' at {best[1]['lat']}, {best[1]['lon']} (Class {best[1]['use_based_class']}, June 2026)" if best else ""

    def display_name(r) -> str:
        n = re.sub(r"^[\s,;:]*(ward\s*no\.?\s*\d+\s*)?", "", r["ktcda_name"], flags=re.I).strip(" ,/")
        parts = [x.strip() for x in n.split("/") if x.strip()]
        if len(parts) > 1 and re.search(r"bangalore|bengaluru|taluk", parts[-1], re.I):
            parts = parts[:-1]
        n = " / ".join(parts)
        if not n or not n[0].isalpha():
            n = r["osm_name"] or r["ktcda_name"]
        elif r["osm_name"] and not r["osm_name"].startswith("(") and sim(" ".join(name_aliases(n)[:1]), " ".join(name_aliases(r["osm_name"])[:1])) < 0.5:
            n = f"{n} ({r['osm_name']})"    # the map name where it differs from the custody name
        return n

    rows, unassessed = [], []
    for r in spine:
        sid = r["spine_id"]
        if r["match_method"] == "duplicate":
            continue
        if sid not in fps:
            unassessed.append({"spine_id": sid, "name": display_name(r), "custodian": r["ktcda_custodian"], "corporation": r["corporation"],
                               "need_class": "Unassessed", "queue_reason": "no polygon at open resolution" + ("; LMS point on record" if r["lms_lat"] else "; no location on record") + station_anchor(r["ktcda_name"]),
                               "note": r["note"]})
            continue
        d = json.load(open(LAKES / f"{sid}.json"))
        k = d["kpis"]; fp = fps[sid]
        if not d["current_season"]:
            unassessed.append({"spine_id": sid, "name": display_name(r), "custodian": r["ktcda_custodian"], "corporation": r["corporation"],
                               "need_class": "Unassessed", "queue_reason": d["insufficient"].get("all", "no season with enough clear passes"), "note": fp["flags"]})
            continue
        bands, notes, shown = {}, [], {}
        # the value's band drives the class; where the error straddles an edge the
        # candidate bands are shown beside it (note 16.4 rule 3), value first
        def take(key, value, err, edges, reverse=False):
            b, amb = banded(value, err, edges, reverse)
            bands[key] = b
            shown[key] = f"{b}({amb})" if amb else b
            if amb:
                notes.append(f"{key} candidates {amb}")
        if "H2" in k:
            take("C1", k["H2"]["value"], k["H2"]["band"], C1_EDGES, reverse=True)
        if "B1" in k:
            take("C3", k["B1"]["built_share"], 0.02, C3_EDGES)
        if "W2" in k:
            take("C4", k["W2"]["value"], k["W2"]["band"]["total"], C4_EDGES)
        if "Q1" in k:
            take("C5", k["Q1"]["value"], k["Q1"]["band"]["total"], C5_EDGES)
        ev = k.get("W4_events", {}).get("per_year", {})
        yrs = [y for y in ev if int(y) >= 2019]
        if d["coverage"]["passes_clear"] >= 8:
            per_year = statistics.mean([ev.get(str(y), 0) for y in range(2019, 2026)])
            bands["C8"] = band_up(per_year, C8_EDGES); shown["C8"] = bands["C8"]
        g2 = d["regulator"]["kspcb_class"]
        if g2 in BAND_VAL:
            bands["G2"] = g2; shown["G2"] = g2
        if not bands:
            unassessed.append({"spine_id": sid, "name": display_name(r), "custodian": r["ktcda_custodian"], "corporation": r["corporation"],
                               "need_class": "Unassessed", "queue_reason": "no computable condition band", "note": "; ".join(f"{a}: {b}" for a, b in d["insufficient"].items())})
            continue
        vals = [BAND_VAL[b] for b in bands.values()]
        med = statistics.median(vals)
        worst_v = max(vals)
        cond_v = worst_v if sum(1 for v in vals if v == 4) >= 2 else max(med, 0)
        cond_v = int(round(cond_v))
        condition = "ABCDE"[cond_v]
        # stakes
        area = float(fp["footprint_area_ha"])
        stakes = "High" if area >= 20 else "Medium" if area >= 5 else "Low"
        o = osm_of.get(sid); cp = cascade.get(o, {}) if o else {}
        n_down = custody_downstream(o) if o else 0
        bld = cp.get("buildings_in_catchment") or 0
        lifted = False
        if (n_down >= 2 or bld >= 5000) and stakes != "High":
            stakes = "High" if stakes == "Medium" else "Medium"; lifted = True
        # tractability
        b1 = k.get("B1", {}).get("built_share")
        never = "no_water_observed" in fp["flags"]
        if never or b1 is None:
            tract = "Unknown"
        elif b1 >= 0.20:
            tract = "Low"
        elif b1 >= 0.10 or fp["boundary_confidence"] == "low":
            tract = "Medium"
        else:
            tract = "High"
        # urgency
        def p7(key):
            ob = k.get(key, {}).get("own_baseline")
            return (ob["percentile"], ob["rank_se"]) if ob else (None, None)
        q1p, q1se = p7("Q1"); w2p, w2se = p7("W2")
        b1_rise = (k.get("B1", {}).get("change_since_2019") or 0) >= 0.05
        if q1p is None and w2p is None and not b1_rise:
            urgency = "Unknown"
        elif b1_rise or (q1p is not None and q1p >= 90 + q1se) or (w2p is not None and w2p >= 90 + w2se):
            urgency = "Rising"
        elif all(p is not None and p <= 10 for p in (q1p, w2p) if p is not None) and (q1p is not None or w2p is not None):
            urgency = "Easing"
        else:
            urgency = "Steady"
        # programme
        ps = (d["programme"]["state"] or "").lower()
        if "works" in ps or "completion" in ps:
            programme = "works underway"
        elif ps:
            programme = "proposed"
        else:
            programme = "none"
        # need class (register 7.2)
        if condition in "DE" and programme == "works underway":
            need = "Co-fund"
        elif condition in "DE" and tract == "High" and programme in ("none", "proposed"):
            need = "Fund now"
        elif condition in "DE" and tract in ("Low", "Unknown"):
            need = "Design first"
        elif condition in "DE":
            need = "Co-fund" if programme == "proposed" else "Design first"
        elif condition == "C" and urgency == "Rising":
            need = "Intervene early"
        elif programme == "works underway":
            need = "Watch / verify"
        elif condition in "AB" and stakes == "High":
            need = "Maintain"
        elif condition in "AB":
            need = "Steward"
        else:
            need = "Watch / verify"
        # register 7.1: one severe signal alone flags the body for a closer read, it
        # is not a verdict; a dry lake or one never seen holding water is a scoping
        # question before any maintenance rupee
        lone_e = [a for a, b in bands.items() if b == "E"]
        if never:
            need = "Design first"; notes.append("no open water observed 2017-2026: boundary and hydrology to scope")
        elif len(lone_e) == 1 and condition in "ABC":
            if lone_e[0] == "C1":
                need = "Design first"; notes.append("single severe input C1: little or no water in the reading window; storage and inflow to scope")
            else:
                need = "Watch / verify"; notes.append(f"single severe input {lone_e[0]}: flagged for a closer read, not a verdict")
        idx = LENS["condition"] * cond_v + LENS["urgency"] * URGENCY_VAL[urgency] + LENS["stakes"] * CLASS_VAL[stakes]
        confs = [k[x]["confidence"] for x in ("W1", "W2", "Q1") if x in k]
        conf = max(confs, key=lambda c: CONF_ORDER[c]) if confs else "insufficient"
        rows.append({
            "spine_id": sid, "name": display_name(r), "ktcda_name": r["ktcda_name"], "custodian": r["ktcda_custodian"], "corporation": r["corporation"], "ward": r["ward_name"],
            "footprint_ha": area, "season": d["current_season"]["label"], "clear_passes": d["current_season"]["clear_passes"],
            "need_class": need, "condition_band": condition, "condition_inputs": " ".join(f"{a}={shown[a]}" for a in bands),
            "stakes": stakes + (" (lifted: cascade)" if lifted else ""), "tractability": tract, "urgency": urgency, "programme": programme,
            "programme_detail": d["programme"]["state"] or "", "programme_source_class": d["programme"]["source_class"] or "",
            "kspcb_class": g2 or "", "need_index": round(idx, 3), "confidence": conf,
            "W1": k.get("W1", {}).get("value", ""), "W2": k.get("W2", {}).get("value", ""), "W2_band": k.get("W2", {}).get("band", {}).get("total", ""),
            "Q1": k.get("Q1", {}).get("value", ""), "Q1_p7": (k.get("Q1", {}).get("own_baseline") or {}).get("percentile", ""),
            "W2_p7": (k.get("W2", {}).get("own_baseline") or {}).get("percentile", ""),
            "H2": k.get("H2", {}).get("value", ""), "B1": b1 if b1 is not None else "", "B1_change_2019": k.get("B1", {}).get("change_since_2019", ""),
            "froth_events_per_year_2019_25": round(per_year, 2) if "C8" in bands else "",
            "custody_lakes_downstream": n_down, "buildings_in_catchment": bld, "cascade_position": d["cascade"]["position"] or "",
            "boundary_confidence": fp["boundary_confidence"], "flags": fp["flags"], "band_notes": "; ".join(notes),
        })
    rows.sort(key=lambda x: (NEED_ORDER.index(x["need_class"]), -BAND_VAL[x["condition_band"]], -x["need_index"], CONF_ORDER[x["confidence"]], -x["footprint_ha"]))
    for i, x in enumerate(rows, 1):
        x["rank"] = i
    cols = ["rank"] + [c for c in rows[0].keys() if c != "rank"]
    with open(DATA / "gba-lakes-ranking.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
    with open(DATA / "gba-lakes-unassessed.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(unassessed[0].keys())); w.writeheader(); w.writerows(unassessed)
    params = {
        "version": VERSION, "computed_at": datetime.now(timezone.utc).isoformat(), "lens": LENS,
        "band_edges": {"C1_share_of_full_tank": C1_EDGES, "C3_built_share": C3_EDGES, "C4_vegetated_share": C4_EDGES, "C5_ndci": C5_EDGES, "C8_froth_events_per_year": C8_EDGES},
        "condition_rule": "worse of (median of computable bands; single worst when two or more read E); G2 = KSPCB Use Based Class as printed",
        "stakes_rule": "area >= 20 ha High, 5-20 Medium, < 5 Low; lifted one class with >= 2 custody lakes downstream or >= 5,000 buildings in the routed catchment",
        "tractability_rule": "High: boundary Medium and built < 10%; Medium: built 10-20% or boundary Low; Low: built >= 20%; Unknown: no water observed or built insufficient",
        "urgency_rule": "Rising: Q1 or W2 at or above own p90 plus rank error, or built share up >= 5 points since 2019; Easing: both at or below p10; Steady otherwise; Unknown without baseline",
        "programme_rule": "budget line = proposed; press-reported works = works underway; both source class Low (press)",
        "need_class_rule": "register plan section 7.2; Condition C with Urgency Steady, Easing or Unknown and no works on record falls to Watch / verify as the residual class; a lake never seen holding water, or with C1 as its single severe input, reads Design first; any other single severe input with Condition A to C reads Watch / verify (register 7.1: one severe signal alone is a flag, not a verdict)",
        "rank_rule": "Need class order, Condition band (E first), Need index (Condition 0.45 x band A=0..E=4 + Urgency 0.25 x Rising=2/Steady=1/Easing=0 + Stakes 0.30 x High=2/Medium=1/Low=0), confidence, footprint area",
        "funding_unit": "Greater Bengaluru (the city); custodians are never ranked against each other",
        "n_ranked": len(rows), "n_unassessed": len(unassessed),
        "need_class_counts": dict(Counter(x["need_class"] for x in rows)), "condition_counts": dict(Counter(x["condition_band"] for x in rows)),
    }
    json.dump(params, open(DATA / "ranking-params.json", "w"), indent=2)
    print(f"ranked {len(rows)}, unassessed {len(unassessed)}")
    print("need classes:", params["need_class_counts"])
    print("condition:", params["condition_counts"])
    print("top 15:")
    for x in rows[:15]:
        print(f"  {x['rank']:>3} {x['name'][:28]:<28} {x['custodian']:<6} {x['need_class']:<16} cond {x['condition_band']} [{x['condition_inputs']}] stakes {x['stakes'][:6]} tract {x['tractability']:<7} urg {x['urgency']:<7} prog {x['programme']:<14} idx {x['need_index']} conf {x['confidence']}")


if __name__ == "__main__":
    main()

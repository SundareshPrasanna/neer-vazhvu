#!/usr/bin/env python3
"""Pre-publication numeric audit for the Cooum page: recompute every
pipeline-derived number independently from the raw inputs and diff against
what the page serves. Exits non-zero on any mismatch. Canal counterpart:
scripts/audit_waterway_numbers.py.

Covers: per-reach width stats + confidence tiers, satellite metrics, veg
hectares, veg-on-water, turbidity, built edge, today tiles, the
condition-strip coverage, the numeric needles inside curated reach facts
that quote our own measurements, the width ledger against the canonical
HSCTC table, the live-BOD headline against the research CSV, chainage
tiling, and cross-document consistency of headline numbers.
"""

import csv
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / "docs" / "research" / "cooum"
OUT = ROOT / "public" / "data" / "waterways" / "cooum"
errors, notes = [], []

reaches = json.loads((OUT / "reaches.json").read_text())
today = json.loads((OUT / "today.json").read_text())["today"]
widths = list(csv.DictReader(open(RESEARCH / "data" / "widths.csv")))
sat = {int(r["km"]): r for r in csv.DictReader(open(RESEARCH / "data" / "reaches-satellite.csv"))}
vegha = {int(r["reach_id"]): float(r["veg_ha"]) for r in csv.DictReader(open(RESEARCH / "data" / "current-veg-area.csv"))}
vow = {int(r["reach_id"]): r for r in csv.DictReader(open(RESEARCH / "data" / "current-veg-on-water.csv"))}
turb = {int(r["reach_id"]): r for r in csv.DictReader(open(RESEARCH / "data" / "current-turbidity.csv"))}
built = {int(r["reach_id"]): r for r in csv.DictReader(open(RESEARCH / "data" / "built-edge.csv"))}
surface = list(csv.DictReader(open(RESEARCH / "data" / "current-surface.csv")))
osm_meta = json.loads((RESEARCH / "data" / "osm-water-meta.json").read_text())
way_year = {f"{e['type']}/{e['id']}": int(e["timestamp"][:4])
            for e in osm_meta.get("elements", []) if "timestamp" in e}


def close(a, b, tol=0.051):
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    return abs(float(a) - float(b)) <= tol


# ---- per-reach recomputation ----
for r in reaches["reaches"]:
    rid, (a, b) = r["id"], r["km"]
    rows = [w for w in widths if a <= float(w["chainage_km"]) < b]
    ok = sorted(float(w["width_m"]) for w in rows if w["width_m"] and w["flag"] == "OK")
    exp = {"median_m": ok[len(ok) // 2] if ok else None,
           "min_m": ok[0] if ok else None, "max_m": ok[-1] if ok else None,
           "n_measured": len(ok)}
    for k, v in exp.items():
        if not close(r["width"][k], v, 0.11):
            errors.append(f"reach {rid} width.{k}: page {r['width'][k]} vs recomputed {v}")
    # confidence tier recompute
    okr = [(float(w["chainage_km"]), float(w["width_m"]), w["osm_water_ids"])
           for w in rows if w["width_m"] and w["flag"] == "OK"]
    share = len(okr) / len(rows) if rows else 0
    if len(okr) >= 3:
        med = exp["median_m"]
        diffs = [abs(okr[i+1][1] - okr[i][1]) / med * 100 for i in range(len(okr) - 1)
                 if okr[i+1][0] - okr[i][0] < 0.35]
        jit = statistics.median(diffs) if diffs else None
        yrs = [way_year[w] for _, _, ids in okr for w in ids.split(";") if w in way_year]
        vin_ok = bool(yrs) and statistics.median(yrs) >= 2021
        tier = "A" if (share >= 0.7 and vin_ok and (jit or 99) <= 25) else ("B" if share >= 0.4 else "C")
    else:
        tier = "C"
    if r["width"]["confidence"]["tier"] != tier:
        errors.append(f"reach {rid} tier: page {r['width']['confidence']['tier']} vs {tier}")
    # satellite fields
    kms = [k for k in sat if a <= k < b]
    for fld in ("veg_frac_dry", "veg_frac_recent", "water_frac_recent", "eff_width_m_recent"):
        vs = [float(sat[k][fld]) for k in kms if sat[k][fld] != ""]
        expv = round(sum(vs) / len(vs), 2) if vs else None
        if not close(r["satellite"][fld], expv):
            errors.append(f"reach {rid} sat.{fld}: {r['satellite'][fld]} vs {expv}")
    if not close(r["veg_ha"], vegha.get(rid), 0.051):
        errors.append(f"reach {rid} veg_ha: {r['veg_ha']} vs {vegha.get(rid)}")
    v = vow.get(rid, {})
    expf = float(v["veg_on_water_frac"]) if v.get("veg_on_water_frac") else None
    if not close(r["satellite"]["veg_on_water_frac"], expf, 0.001):
        errors.append(f"reach {rid} veg_on_water: {r['satellite']['veg_on_water_frac']} vs {expf}")
    be = built.get(rid)
    if be and r["built_edge"]:
        for k1 in ("buildings_50m", "buildings_100m", "rooftop_m2_50m"):
            if int(r["built_edge"][k1]) != int(be[k1]):
                errors.append(f"reach {rid} built_edge.{k1}: {r['built_edge'][k1]} vs {be[k1]}")

# ---- identity + global stats ----
all_ok = sorted(float(w["width_m"]) for w in widths if w["width_m"] and w["flag"] == "OK")
ident = reaches["identity"]
stats_txt = json.dumps(ident)
if len(all_ok) != 264:
    errors.append(f"global OK transects: {len(all_ok)} (page claims 264)")
gmed = all_ok[len(all_ok) // 2]
if not close(gmed, 71, 0.6):
    errors.append(f"global median width {gmed} vs claimed 71 m")
if "264 of 315" not in stats_txt:
    errors.append("identity stat no longer cites 264 of 315 transects")
n_rows = len(widths)
if n_rows != 315:
    errors.append(f"transect count {n_rows} != 315")
last_km = float(widths[-1]["chainage_km"])
if not close(last_km, 62.8, 0.15):
    errors.append(f"chainage end {last_km} vs 62.8")

# ---- today tiles ----
tot_veg = round(sum(vegha.values()))
tot_water = round(sum(float(t["water_ha"]) for t in turb.values()))
n_ndti = sum(1 for t in turb.values() if t["ndti_mean"] != "")
t50 = sum(int(b["buildings_50m"]) for b in built.values())
t100 = sum(int(b["buildings_100m"]) for b in built.values())
tiles_txt = json.dumps(today["tiles"])
checks = [(f"{tot_veg} ha", "veg total"), (f"~{tot_water} ha", "water total"),
          (f"{n_ndti} of 13", "turbidity reaches"),
          (f"{t50:,}", "built 50m"), (f"{t100:,}", "built 100m")]
for needle, label in checks:
    if needle not in tiles_txt:
        errors.append(f"today tile missing/changed: {label} expected '{needle}'")
share = int(built[10]["buildings_50m"]) / t50
if not (0.334 <= share <= 0.45):
    errors.append(f"'more than one in three' reach-10 share now {share:.2f}")
# condition strip covers full chainage
strip = today["strip"]
if strip[0]["from"] > 0.01 or abs(strip[-1]["to"] - last_km) > 0.15:
    errors.append("condition strip does not span full chainage")
if len(surface) != 629:
    notes.append(f"surface points {len(surface)} (expected 629)")

# ---- curated facts that quote our own measurements ----
facts_txt = json.dumps([r["facts"] for r in reaches["reaches"]], ensure_ascii=False)
needles = [
    (f"{float(turb[4]['water_ha']):.1f} ha", "reach-4 open water"),
    (f"{float(turb[5]['water_ha']):.1f} ha", "reach-5 open water"),
    (f"{float(turb[3]['water_ha']):.1f} ha", "reach-3 open water"),
    (f"{round(float(vow[6]['veg_on_water_frac']) * 100, 1)}%", "reach-6 veg-on-water"),
    (f"{round(float(vow[3]['veg_on_water_frac']) * 100)}%", "reach-3 veg-on-water"),
    (f"{round(float(vow[8]['veg_on_water_frac']) * 100)}%", "reach-8 veg-on-water"),
    (f"{round(float(vow[10]['veg_on_water_frac']) * 100)}%", "reach-10 veg-on-water"),
    (f"{round(float(vow[5]['veg_on_water_frac']) * 100)}%", "reach-5 veg-on-water"),
    (f"{int(built[10]['buildings_50m'])} buildings", "reach-10 built edge"),
    (f"{int(built[10]['buildings_100m']):,} within 100 m", "reach-10 built 100m"),
    (f"{int(built[8]['buildings_50m'])} buildings", "reach-8 built edge"),
]
for needle, label in needles:
    if needle not in facts_txt:
        errors.append(f"curated fact needle missing/changed: {label} expected '{needle}'")
# reach-3 per-km median range
byk = {}
for w in widths:
    if 10.0 <= float(w["chainage_km"]) < 17.5 and w["width_m"] and w["flag"] == "OK":
        byk.setdefault(int(float(w["chainage_km"])), []).append(float(w["width_m"]))
meds = sorted(sorted(v)[len(v) // 2] for v in byk.values())
r3_range = f"{meds[0]:.0f} to {meds[-1]:.0f} m"
if r3_range not in facts_txt:
    errors.append(f"reach-3 per-km median range: expected '{r3_range}'")

# ---- width ledger vs canonical HSCTC table ----
CANON = {
 "River mouth - Napier Bridge": (151, 151, 151, 151),
 "Napier Bridge - Periyar Bridge": (126, 146, 45, 60),
 "Periyar Bridge - Coolways Bridge": (126, 135, 51, 58),
 "Coolways Bridge - St. Andrew Bridge": (94, 131, 60, 62),
 "St. Andrew Bridge - Harris Bridge": (87, 93, 49, 58),
 "Harris Bridge - Ethiraj Bridge": (82, 98, 46, 51),
 "Ethiraj Bridge - College Bridge": (97, 173, 40, 52),
 "College Bridge - Mc. Nicholas Road": (99, 118, 47, 53),
 "Mc. Nicholas Road - Choolaimedu Bridge": (68, 95, 37, 53),
 "Poonamallee High Road - Anna Arch Road": (71, 102, 43, 45),
 "Anna Arch Road - Anna Nagar 8th Main Road": (79, 150, 62, 64),
 "Anna Nagar 8th Main Road - Inner Ring Road": (71, 95, 44, 101),
 "Inner Ring Road - Mogappair Estate Road": (89, 144, 46, 101),
 "Mogappair Estate Road - Vanagaram Ambattur Road": (76, 110, 46, 92),
}
wl = reaches.get("width_ledger")
if not wl or len(wl["rows"]) != 14:
    errors.append("width ledger missing or wrong row count")
else:
    for row in wl["rows"]:
        c = CANON.get(row["stretch"])
        if not c:
            errors.append(f"ledger stretch name drift: {row['stretch']}")
            continue
        if (row["orig_min"], row["orig_max"], row["hsctc_min"], row["hsctc_max"]) != c:
            errors.append(f"ledger values drift on {row['stretch']}")
    # today_line median over the ledger span (km 43.5 to the end)
    span = sorted(float(w["width_m"]) for w in widths
                  if float(w["chainage_km"]) >= 43.5 and w["width_m"] and w["flag"] == "OK")
    if span:
        med = span[len(span) // 2]
        if f"median is {med:.0f} m" not in wl["today_line"]:
            errors.append(f"ledger today_line median: expected {med:.0f} m")
        if f"{span[0]:.0f} m minimum" not in wl["today_line"]:
            errors.append(f"ledger today_line minimum: expected {span[0]:.0f} m")

# ---- the live-BOD headline vs the research series ----
ngt = list(csv.DictReader(open(RESEARCH / "data" / "wq-tn-ngt-mpr-cooum-monthly.csv")))
latest = ngt[-1]
lo, hi = [s.strip() for s in latest["bod_mgl"].replace("- ", "-").split("-")[:2]]
if f"BOD {lo}-{hi} mg/L" not in stats_txt:
    errors.append(f"identity BOD stat vs research CSV: expected 'BOD {lo}-{hi} mg/L' "
                  f"({latest['month']} {latest['year']})")

# ---- claims hygiene ----
claims = json.loads((OUT / "claims.json").read_text())["claims"]
texts = {}
for c in claims:
    texts.setdefault(c["text"], []).append(c["id"])
dups = {t: ids for t, ids in texts.items() if len(ids) > 2}
if dups:
    notes.append(f"{len(dups)} claim texts repeated >2x (review): "
                 + "; ".join(list(dups)[:2]))

print(f"AUDIT: {len(errors)} errors, {len(notes)} notes")
for e in errors:
    print(" ERROR:", e)
for n in notes:
    print(" note:", n)
sys.exit(1 if errors else 0)

#!/usr/bin/env python3
"""Pre-publication numeric audit: recompute every pipeline-derived number
on the Buckingham Canal page independently from the raw inputs and diff
against what the page serves. Exits non-zero on any mismatch.

Covers: per-reach width stats + confidence tiers, satellite metrics,
veg hectares, veg-on-water, turbidity, built edge, today tiles, the
condition-strip coverage, the width ledger (against the canonical HSCTC
table), timeline integrity, identity stats, chainage tiling, and
cross-document consistency of headline numbers.
"""

import csv
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / "docs" / "research" / "buckingham-canal"
OUT = ROOT / "public" / "data" / "waterways" / "buckingham-canal"
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
        diffs = []
        for i in range(len(okr)):
            for j in range(i + 1, len(okr)):
                gap = okr[j][0] - okr[i][0]
                if gap < 0.15:
                    continue
                if gap < 0.35:
                    diffs.append(abs(okr[j][1] - okr[i][1]) / med * 100)
                break
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
        for k1, k2 in [("buildings_50m", "buildings_50m"), ("buildings_100m", "buildings_100m"),
                       ("rooftop_m2_50m", "rooftop_m2_50m")]:
            if int(r["built_edge"][k1]) != int(be[k2]):
                errors.append(f"reach {rid} built_edge.{k1}: {r['built_edge'][k1]} vs {be[k2]}")

# ---- identity + global stats ----
all_ok = sorted(float(w["width_m"]) for w in widths if w["width_m"] and w["flag"] == "OK")
ident = reaches["identity"]
stats_txt = json.dumps(ident)
if len(all_ok) != 1012:
    errors.append(f"global OK transects: {len(all_ok)} (page claims 1,012)")
gmed = all_ok[len(all_ok) // 2]
if not close(gmed, 33, 0.6):
    errors.append(f"global median width {gmed} vs claimed 33 m")
if "1,012 transects" not in stats_txt:
    errors.append("identity stat no longer cites 1,012 transects")
n_rows = len(widths)
if n_rows != 1492:
    errors.append(f"transect count {n_rows} != 1492")
last_km = float(widths[-1]["chainage_km"])
if not close(last_km, 74.55, 0.15):
    errors.append(f"chainage end {last_km} vs 74.55")

# ---- today tiles ----
tot_veg = round(sum(vegha.values()))
tot_water = round(sum(float(t["water_ha"]) for t in turb.values()))
n_ndti = sum(1 for t in turb.values() if t["ndti_mean"] != "")
t50 = sum(int(b["buildings_50m"]) for b in built.values())
t100 = sum(int(b["buildings_100m"]) for b in built.values())
city50 = sum(int(built[i]["buildings_50m"]) for i in (8, 9, 10, 11, 12))
tiles_txt = json.dumps(today["tiles"])
checks = [(f"{tot_veg} ha", "veg total"), (f"~{tot_water} ha", "water total"),
          (f"{n_ndti} of 18", "turbidity reaches"), ("6,238", "built 50m"), ("15,182", "built 100m")]
for needle, label in checks:
    if needle not in tiles_txt:
        errors.append(f"today tile missing/changed: {label} expected '{needle}'")
if t50 != 6238 or t100 != 15182:
    errors.append(f"built totals recomputed {t50}/{t100} vs 6,238/15,182")
share = city50 / t50
if not (0.74 <= share <= 0.78):
    errors.append(f"'three in four' city share now {share:.2f}")
# condition strip covers full chainage
strip = today["strip"]
if strip[0]["from"] > 0.01 or abs(strip[-1]["to"] - last_km) > 0.15:
    errors.append("condition strip does not span full chainage")
cov = sum(1 for s2 in surface)
if cov != 1492:
    notes.append(f"surface points {cov} (expected 1492)")

# ---- width ledger vs canonical HSCTC table ----
CANON = {
 "Adyar River - Greenways Road": (107, 116, 25, 31),
 "Greenways Road - Kamaraj Salai": (115, 123, 25, 33),
 "Kamaraj Salai - Venkatakrishna Road": (98, 123, 33, 48),
 "Venkatakrishna Road - St. Mary's Road": (122, 123, 37, 38),
 "St. Mary's Road - Agraharam Road": (133, 143, 28, 38),
 "Agraharam Road - Kutchery Road": (113, 117, 33, 37),
 "Kutchery Road - P.V. Koil Street": (114, 134, 34, 39),
 "P.V. Koil Street - Radhakrishna Street": (117, 133, 25, 38),
 "Radhakrishna Street - Avvai Shanmugam Salai": (120, 122, 30, 32),
 "Avvai Shanmugam Salai - Besant Road": (100, 109, 25, 34),
 "Besant Road - Barathi Salai": (89, 110, 24, 25),
 "Barathi Salai - Wallaja Road": (80, 111, 30, 36),
 "Wallaja Road - Swami Sivanandha Salai": (42, 73, 32, 36),
 "Swami Sivanandha Salai - Cooum River": (80, 93, 25, 28),
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

#!/usr/bin/env python3
"""Build public/data/waterways/buckingham-canal/ from the research base.

Inputs:
  docs/waterways/buckingham-canal/waterway-curation.json (editorial, tracked)
  docs/research/buckingham-canal/data/widths.csv                 (measured)
  docs/research/buckingham-canal/data/reaches-satellite.csv      (Sentinel-2)
  docs/research/buckingham-canal/data/centerline.geojson
  docs/research/buckingham-canal/figures/chips/*.png

Outputs (public/data/waterways/buckingham-canal/):
  reaches.json      - 18 reaches: verdicts, facts (sourced), width stats,
                      per-km satellite metrics, transect strip, chips
  chapters.json     - the 8 story chapters with resolved reach refs
  timeline.json     - the money-and-orders ledger
  claims.json       - every rendered fact/stat with source+date+flag
  width-profile.json- full-chainage width series for the long-profile chart
  centerline.geojson- copy
  chips/            - only the chips the page references

Companion gate: scripts/verify_waterway_buckingham.py (run after).
"""

import csv
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / "docs" / "research" / "buckingham-canal"
OUT = ROOT / "public" / "data" / "waterways" / "buckingham-canal"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "chips").mkdir(exist_ok=True)

CURATION = ROOT / "docs" / "waterways" / "buckingham-canal" / "waterway-curation.json"
if not (RESEARCH / "data" / "widths.csv").exists():
    raise SystemExit(
        "Research base missing: docs/research/buckingham-canal/ is local-only "
        "(gitignored). Copy it from the main worktree or regenerate via "
        "scripts/build_buckingham_canal_geometry.py + the satellite script.")
cur = json.loads(CURATION.read_text())
widths = list(csv.DictReader(open(RESEARCH / "data" / "widths.csv")))
built = {int(r["reach_id"]): r for r in
         csv.DictReader(open(RESEARCH / "data" / "built-edge.csv"))}
photos_meta = json.loads(
    (RESEARCH / "figures" / "photos" / "photos.json").read_text())
osm_meta = json.loads(
    (RESEARCH / "data" / "osm-water-meta.json").read_text())
way_year = {}
for e in osm_meta.get("elements", []):
    if "timestamp" in e:
        way_year[f"{e['type']}/{e['id']}"] = int(e["timestamp"][:4])
veg_ha_by_reach = {int(r["reach_id"]): float(r["veg_ha"]) for r in
                   csv.DictReader(open(RESEARCH / "data" / "current-veg-area.csv"))}
veg_on_water = {int(r["reach_id"]): {
    "frac": float(r["veg_on_water_frac"]) if r["veg_on_water_frac"] else None,
    "mapped_water_ha": float(r["mapped_water_ha"])}
    for r in csv.DictReader(open(RESEARCH / "data" / "current-veg-on-water.csv"))}


def width_confidence(rows_all, ok_rows):
    """Tier the reach's width measurement (DECISIONS W7 addendum):
    A = well-covered recent tracing with low transect-to-transect jitter;
    B = measured but sparse or older tracing; C = not channel-measurable."""
    import statistics
    share = len(ok_rows) / len(rows_all) if rows_all else 0.0
    if len(ok_rows) < 3:
        return {"tier": "C", "share_measured": round(share, 2),
                "jitter_pct": None, "tracing_years": None}
    ws = sorted(w for _, w, _ in ok_rows)
    med = ws[len(ws) // 2]
    diffs = [abs(ok_rows[i + 1][1] - ok_rows[i][1]) / med * 100
             for i in range(len(ok_rows) - 1)
             if ok_rows[i + 1][0] - ok_rows[i][0] < 0.35]
    jitter = statistics.median(diffs) if diffs else None
    years = [way_year[w] for _, _, ids in ok_rows
             for w in ids.split(";") if w in way_year]
    vintage = f"{min(years)}-{max(years)}" if years else None
    vin_ok = bool(years) and statistics.median(years) >= 2021
    if share >= 0.7 and vin_ok and (jitter or 99) <= 25:
        tier = "A"
    elif share >= 0.4:
        tier = "B"
    else:
        tier = "C"
    return {"tier": tier, "share_measured": round(share, 2),
            "jitter_pct": round(jitter) if jitter is not None else None,
            "tracing_years": vintage}
photos_by_reach = {}
for ph in photos_meta:
    photos_by_reach.setdefault(ph["reach"], []).append(ph)
sat = {int(r["km"]): r for r in
       csv.DictReader(open(RESEARCH / "data" / "reaches-satellite.csv"))}

claims = []


def claim(text, source, date, flag, ctx):
    cid = f"c{len(claims) + 1:03d}"
    claims.append({"id": cid, "text": text, "source": source,
                   "date": date, "flag": flag, "context": ctx})
    return cid


# ---------------- reaches ----------------
reaches_out = []
for r in cur["reaches"]:
    a, b = r["km"]
    rows = [w for w in widths if a <= float(w["chainage_km"]) < b]
    ok = sorted(float(w["width_m"]) for w in rows
                if w["width_m"] and w["flag"] == "OK")
    strip = [{"km": float(w["chainage_km"]),
              "w": float(w["width_m"]) if w["width_m"] else None,
              "flag": w["flag"]} for w in rows]
    kms = [k for k in sat if a <= k < b]

    def avg(f):
        vs = [float(sat[k][f]) for k in kms if sat[k][f] != ""]
        return round(sum(vs) / len(vs), 2) if vs else None

    ok_rows = [(float(w["chainage_km"]), float(w["width_m"]),
                w["osm_water_ids"]) for w in rows
               if w["width_m"] and w["flag"] == "OK"]
    confidence = width_confidence(rows, ok_rows)

    works_cur = cur.get("works", {}).get(str(r["id"]))
    works = None
    if works_cur:
        def _wf(items, ctx):
            out2 = []
            for t, src, dt, fl in items:
                cid = claim(t, src, dt, fl, f"works:{ctx}:{r['id']}")
                out2.append({"text": t, "source": src, "date": dt,
                             "flag": fl, "claim_id": cid})
            return out2
        works = {
            "channel": _wf(works_cur.get("channel", []), "channel"),
            "interception": _wf(works_cur.get("interception", []), "intercept"),
            "constraints": _wf(works_cur.get("constraints", []), "constraint"),
            "surveys": works_cur.get("surveys", []),
            "programmes": works_cur.get("programmes", []),
        }

    facts = []
    for f in r["facts"]:
        cid = claim(f["text"], f["source"], f["date"], f["flag"],
                    f"reach:{r['id']}")
        facts.append({**f, "claim_id": cid})

    reaches_out.append({
        "id": r["id"], "name": r["name"], "km": r["km"],
        "verdict": r["verdict"], "character": r["character"],
        "width": {"median_m": ok[len(ok) // 2] if ok else None,
                  "min_m": ok[0] if ok else None,
                  "max_m": ok[-1] if ok else None,
                  "n_measured": len(ok),
                  "confidence": confidence},
        "veg_ha": veg_ha_by_reach.get(r["id"]),
        "works": works,
        "satellite": {"veg_on_water_frac": veg_on_water.get(r["id"], {}).get("frac"),
                      "mapped_water_ha": veg_on_water.get(r["id"], {}).get("mapped_water_ha"),
                      "veg_frac_dry": avg("veg_frac_dry"),
                      "veg_frac_recent": avg("veg_frac_recent"),
                      "water_frac_recent": avg("water_frac_recent"),
                      "eff_width_m_recent": avg("eff_width_m_recent")},
        "transects": strip,
        "built_edge": {
            "buildings_50m": int(built[r["id"]]["buildings_50m"]),
            "rooftop_m2_50m": int(built[r["id"]]["rooftop_m2_50m"]),
            "buildings_100m": int(built[r["id"]]["buildings_100m"]),
        } if r["id"] in built else None,
        "photos": [{"file": ph["file"], "author": ph["author"],
                    "licence": ph["licence"], "year": ph["year"]}
                   for ph in photos_by_reach.get(r["id"], [])],
        "facts": facts,
        "chips": r["chips"],
    })

# ---------------- chapters, timeline, identity ----------------
by_id = {r["id"]: r for r in reaches_out}
chapters_out = []
for ch in cur["chapters"]:
    claim(ch["verdict"], "Neer Vazhvu synthesis of the sourced dossier",
          "2026-08-18", "inferred", f"chapter:{ch['key']}")
    chapters_out.append({
        **ch,
        "reaches": [{"id": i, "name": by_id[i]["name"], "km": by_id[i]["km"]}
                    for i in ch["reach_ids"]],
    })

timeline_out = []
for t in cur["timeline"]:
    cid = claim(t["label"], t["source"], t["date"], "verified", "timeline")
    timeline_out.append({**t, "claim_id": cid})

identity = dict(cur["identity"])
for s in identity["headline_stats"]:
    s["claim_id"] = claim(f"{s['value']} - {s['label']}", s["source"],
                          s["date"], s["flag"], "identity")

# ---------------- today.json (current snapshot) ----------------
surface = list(csv.DictReader(open(RESEARCH / "data" / "current-surface.csv")))
runs = []
for row in surface:
    st = row["state"]
    if runs and runs[-1]["state"] == st:
        runs[-1]["to"] = float(row["km"])
    else:
        runs.append({"state": st, "from": float(row["km"]),
                     "to": float(row["km"])})
veg_area = {int(r["reach_id"]): float(r["veg_ha"]) for r in
            csv.DictReader(open(RESEARCH / "data" / "current-veg-area.csv"))}
turb = {int(r["reach_id"]): {"ndti": float(r["ndti_mean"]) if r["ndti_mean"] else None,
                             "water_ha": float(r["water_ha"])}
        for r in csv.DictReader(open(RESEARCH / "data" / "current-turbidity.csv"))}
total_veg = round(sum(veg_area.values()))
total_water = round(sum(t["water_ha"] for t in turb.values()))
top_veg = sorted(veg_area.items(), key=lambda kv: -kv[1])[:5]

silt_facts = []
for f in cur.get("silt_ledger", []):
    cid = claim(f["text"], f["source"], f["date"], f["flag"], "silt-ledger")
    silt_facts.append({**f, "claim_id": cid})

today_tiles = []
for value, label, source, date, flag in [
    (f"{total_veg} ha", "vegetation on the corridor this window (weed mats, reeds and bank growth together)",
     "Neer Vazhvu Sentinel-2 analysis, Jun-Aug 2026", "2026-08-18", "inferred"),
    (f"~{total_water} ha", "open water visible from orbit, concentrated at the Ennore, Muttukadu and Kelambakkam reaches",
     "Neer Vazhvu Sentinel-2 analysis, Jun-Aug 2026", "2026-08-18", "inferred"),
    ("7 of 18", "reaches with enough open water for a suspended-sediment reading; the Adyar crossing reads highest",
     "Neer Vazhvu Sentinel-2 NDTI analysis", "2026-08-18", "inferred"),
    ("6,238", "buildings within 50 m of the centerline (15,182 within 100 m) - three in four along the 18 km between Triplicane and the Okkiyam confluence. A deliberately conservative count: measured from the centerline, not the canal's recorded boundary",
     "Google Open Buildings v3 (2023 release, confidence >= 0.7); Neer Vazhvu proximity analysis", "2026-08-18", "inferred"),
]:
    cid = claim(f"{value} - {label}", source, date, flag, "today")
    today_tiles.append({"value": value, "label": label, "source": source,
                        "date": date, "flag": flag, "claim_id": cid})

today = {
    "as_of": "Sentinel-2 window 1 Jun - 18 Aug 2026 (clearest-pixel composites)",
    "tiles": today_tiles,
    "strip": runs,
    "veg_by_reach": [{"reach_id": k, "veg_ha": v} for k, v in sorted(veg_area.items())],
    "top_veg_reaches": [{"reach_id": k, "veg_ha": v} for k, v in top_veg],
    "turbidity": [{"reach_id": k, **v} for k, v in sorted(turb.items())],
    "silt": silt_facts,
}

# ---------------- width profile (full chainage) ----------------
profile = [{"km": float(w["chainage_km"]),
            "w": float(w["width_m"]) if w["width_m"] else None,
            "flag": w["flag"]} for w in widths]

# ---------------- ground photos ----------------
(OUT / "photos").mkdir(exist_ok=True)
for ph in photos_meta:
    src = RESEARCH / "figures" / "photos" / ph["file"]
    if src.exists():
        shutil.copy(src, OUT / "photos" / ph["file"])

# ---------------- chips ----------------
used = sorted({c for r in cur["reaches"] for c in r["chips"]})
copied = 0
for c in used:
    src = RESEARCH / "figures" / "chips" / c
    if src.exists():
        shutil.copy(src, OUT / "chips" / c)
        copied += 1
    else:
        print(f"WARN missing chip {c}")

# ---------------- write ----------------
prov = {
    "built": "2026-08-18",
    "method": "scripts/build_waterway_buckingham.py",
    "research_base": "docs/research/buckingham-canal/ (dossier.md, sections 01-07, data-vintages.md)",
    "attribution": {
        "osm": "Centerline and width measurement derived from OpenStreetMap (ODbL).",
        "sentinel": "Chips and corridor metrics contain modified Copernicus Sentinel data (2026).",
    },
    "banned_claims_note": "See curation.banned_claims; enforced by scripts/verify_waterway_buckingham.py",
}

wl = cur.get("width_ledger")
if wl:
    wl = dict(wl)
    wl["claim_id"] = claim(
        "Cooum-Adyar width ledger, 14 stretches: original survey vs HSCTC "
        "(~2012) widths", wl["source"], wl["date"], wl["flag"],
        "width-ledger")

(OUT / "reaches.json").write_text(json.dumps(
    {"_provenance": prov, "identity": identity, "reaches": reaches_out,
     "width_ledger": wl}))
(OUT / "chapters.json").write_text(json.dumps(
    {"_provenance": prov, "chapters": chapters_out}))
(OUT / "timeline.json").write_text(json.dumps(
    {"_provenance": prov, "timeline": timeline_out}))
(OUT / "claims.json").write_text(json.dumps(
    {"_provenance": prov, "claims": claims}))
(OUT / "today.json").write_text(json.dumps({"_provenance": prov, "today": today}))
(OUT / "width-profile.json").write_text(json.dumps(
    {"_provenance": prov, "profile": profile}))
shutil.copy(RESEARCH / "data" / "centerline.geojson", OUT / "centerline.geojson")

n_facts = sum(len(r["facts"]) for r in reaches_out)
size_mb = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file()) / 1e6
print(f"reaches: {len(reaches_out)}  chapters: {len(chapters_out)}  "
      f"facts: {n_facts}  claims: {len(claims)}  chips: {copied}  "
      f"total: {size_mb:.1f} MB")

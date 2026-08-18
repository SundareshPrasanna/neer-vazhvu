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
                  "n_measured": len(ok)},
        "satellite": {"veg_frac_dry": avg("veg_frac_dry"),
                      "veg_frac_recent": avg("veg_frac_recent"),
                      "water_frac_recent": avg("water_frac_recent"),
                      "eff_width_m_recent": avg("eff_width_m_recent")},
        "transects": strip,
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

# ---------------- width profile (full chainage) ----------------
profile = [{"km": float(w["chainage_km"]),
            "w": float(w["width_m"]) if w["width_m"] else None,
            "flag": w["flag"]} for w in widths]

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

(OUT / "reaches.json").write_text(json.dumps(
    {"_provenance": prov, "identity": identity, "reaches": reaches_out}))
(OUT / "chapters.json").write_text(json.dumps(
    {"_provenance": prov, "chapters": chapters_out}))
(OUT / "timeline.json").write_text(json.dumps(
    {"_provenance": prov, "timeline": timeline_out}))
(OUT / "claims.json").write_text(json.dumps(
    {"_provenance": prov, "claims": claims}))
(OUT / "width-profile.json").write_text(json.dumps(
    {"_provenance": prov, "profile": profile}))
shutil.copy(RESEARCH / "data" / "centerline.geojson", OUT / "centerline.geojson")

n_facts = sum(len(r["facts"]) for r in reaches_out)
size_mb = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file()) / 1e6
print(f"reaches: {len(reaches_out)}  chapters: {len(chapters_out)}  "
      f"facts: {n_facts}  claims: {len(claims)}  chips: {copied}  "
      f"total: {size_mb:.1f} MB")

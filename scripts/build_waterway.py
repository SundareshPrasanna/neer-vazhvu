#!/usr/bin/env python3
"""Build public/data/waterways/<id>/ from a waterway's research base.

Generalized 19 Aug 2026 from the Buckingham Canal pilot when the Cooum
became waterway 2. Per-waterway parameters live in
scripts/waterways/<id>.json (build section); the editorial layer lives in
the tracked waterway-curation.json the config points at. For
buckingham-canal this reproduces the pilot's artifacts byte-for-byte
(entry point kept: scripts/build_waterway_buckingham.py).

Usage: python3 scripts/build_waterway.py --waterway <id>

Inputs:
  <curation>                             (editorial, tracked)
  <research_dir>/data/widths.csv                 (measured)
  <research_dir>/data/reaches-satellite.csv      (Sentinel-2)
  <research_dir>/data/current-*.csv, built-edge.csv
  <research_dir>/data/centerline.geojson
  <research_dir>/figures/chips/*.png + photos/

Outputs (public/data/waterways/<id>/ - corpus-managed json;
         imagery to public/images/waterways/<id>/):
  reaches.json chapters.json timeline.json claims.json today.json
  width-profile.json centerline.geojson

Companion gates: the per-waterway verify_waterway_*.py and numeric audit
(run after every build).
"""

import argparse
import csv
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from registry_license import registry_license  # noqa: E402

# Same text for every waterway: the claims artifact's own provenance note.
_CLAIMS_NOTE = (
    "Claim-dataset compilation: each record names its source, "
    "date and flag (verified / our analysis / as asserted); "
    "empty sources by design - per-record citations carry "
    "accountability."
)


def width_confidence(rows_all, ok_rows, way_year):
    """Tier the reach's width measurement (canal DECISIONS W7 addendum):
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


def main(waterway=None):
    if waterway is None:
        ap = argparse.ArgumentParser()
        ap.add_argument("--waterway", required=True)
        waterway = ap.parse_args().waterway
    cfg = json.loads(
        (ROOT / "scripts" / "waterways" / f"{waterway}.json").read_text())
    bld = cfg["build"]
    RESEARCH = ROOT / cfg["research_dir"]
    OUT = ROOT / "public" / "data" / "waterways" / cfg["id"]
    OUT.mkdir(parents=True, exist_ok=True)
    # Imagery lives OUTSIDE the corpus-managed trees (the corpus is
    # json/geojson by contract and fetch-corpus.sh replaces public/data
    # wholesale); the house pattern is public/images/.
    IMG = ROOT / "public" / "images" / "waterways" / cfg["id"]
    (IMG / "chips").mkdir(parents=True, exist_ok=True)

    if not (RESEARCH / "data" / "widths.csv").exists():
        raise SystemExit(
            f"Research base missing: {cfg['research_dir']}/ is local-only "
            "(gitignored). Copy it from the main worktree or regenerate via "
            "scripts/build_waterway_geometry.py + the satellite scripts.")
    cur = json.loads((ROOT / cfg["curation"]).read_text())
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
        confidence = width_confidence(rows, ok_rows, way_year)

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
            # One attribution string per photo (author, year, licence terms).
            # Deliberately NOT a `licence` field: in an enveloped artifact that
            # key asserts the artifact's own licence and is checked against the
            # registry (check-generator-drift.py); these are per-photo Commons
            # credits, rendered verbatim.
            "photos": [{"file": ph["file"],
                        "credit": f"{ph['author']}, {ph['year']} · {ph['licence']}"}
                       for ph in photos_by_reach.get(r["id"], [])],
            "facts": facts,
            "chips": r["chips"],
        })

    # ---------------- chapters, timeline, identity ----------------
    by_id = {r["id"]: r for r in reaches_out}
    chapters_out = []
    for ch in cur["chapters"]:
        claim(ch["verdict"], bld["synthesis_source"],
              bld["synthesis_date"], "inferred", f"chapter:{ch['key']}")
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

    # The tile templates live in curation (editorial text); the values they
    # render are recomputed here from the measured CSVs, so the numeric audit
    # can diff them against the same inputs.
    t50 = sum(int(b["buildings_50m"]) for b in built.values())
    t100 = sum(int(b["buildings_100m"]) for b in built.values())
    tile_vals = {
        "total_veg": total_veg,
        "total_water": total_water,
        "n_ndti": sum(1 for t in turb.values() if t["ndti"] is not None),
        "n_reaches": len(cur["reaches"]),
        "built_50": f"{t50:,}",
        "built_100": f"{t100:,}",
    }
    today_tiles = []
    for tile in cur["today"]["tiles"]:
        value = tile["value_template"].format(**tile_vals)
        label = tile["label_template"].format(**tile_vals)
        cid = claim(f"{value} - {label}", tile["source"], tile["date"],
                    tile["flag"], "today")
        today_tiles.append({"value": value, "label": label,
                            "source": tile["source"], "date": tile["date"],
                            "flag": tile["flag"], "claim_id": cid})

    today = {
        "as_of": cur["today"]["as_of"],
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
    (IMG / "photos").mkdir(exist_ok=True)
    for ph in photos_meta:
        src = RESEARCH / "figures" / "photos" / ph["file"]
        if src.exists():
            shutil.copy(src, IMG / "photos" / ph["file"])

    # ---------------- chips ----------------
    used = sorted({c for r in cur["reaches"] for c in r["chips"]})
    copied = 0
    for c in used:
        src = RESEARCH / "figures" / "chips" / c
        if src.exists():
            shutil.copy(src, IMG / "chips" / c)
            copied += 1
        else:
            print(f"WARN missing chip {c}")

    # ---------------- write ----------------
    # NVDM v1 envelope (L2 gate): identity + provenance ride on every artifact.
    # Source ids join the Headwaters registry (scripts/source-registry/
    # platform.json, dependsOn names each file); licences mirror the registry,
    # which owns them.
    src_blocks = {}
    for sid, meta in bld["source_meta"].items():
        src_blocks[sid] = {
            "id": sid,
            "role": "input",
            "title": meta["title"],
            "publisher": meta["publisher"],
            "url": meta["url"],
            "license": registry_license(sid),
            "retrieved": bld["retrieved"],
        }

    def doc_sources(doc_key):
        return [src_blocks[sid] for sid in bld["doc_sources"].get(doc_key, [])]

    # Each write site below spells out the four envelope keys as literals -
    # the ward-profiles pattern scripts/check-generator-drift.py recognizes as
    # "this call writes a complete envelope of its own".
    _SCOPE = {"kind": "waterway", "id": cfg["id"]}

    def prov_env(sources: list, method: str, note: str) -> dict:
        return {
            "sources": sources,
            "method": method,
            "produced_at": bld["produced_at"],
            "produced_by": bld["produced_by"],
            "note": note,
        }

    prov = {
        "built": bld["produced_at"],
        "method": bld["produced_by"],
        "research_base": bld["research_base"],
        "attribution": bld["attribution"],
        "banned_claims_note": bld["banned_claims_note"],
    }

    wl = cur.get("width_ledger")
    if wl:
        wl = dict(wl)
        claim_text = wl.pop("claim_text")
        wl["claim_id"] = claim(claim_text, wl["source"], wl["date"],
                               wl["flag"], "width-ledger")

    reaches_doc = {"nvdm": "1.0", "dataset": "waterways/reaches", "scope": _SCOPE,
     "provenance": prov_env(
         doc_sources("reaches"), "mixed", bld["notes"]["reaches"]),
     "_provenance": prov, "identity": identity, "reaches": reaches_out,
     "width_ledger": wl}
    (OUT / "reaches.json").write_text(json.dumps(reaches_doc))
    chapters_doc = {"nvdm": "1.0", "dataset": "waterways/chapters", "scope": _SCOPE,
     "provenance": prov_env([], "manual", bld["editorial_note"]),
     "_provenance": prov, "chapters": chapters_out}
    (OUT / "chapters.json").write_text(json.dumps(chapters_doc))
    timeline_doc = {"nvdm": "1.0", "dataset": "waterways/timeline", "scope": _SCOPE,
     "provenance": prov_env([], "manual", bld["editorial_note"]),
     "_provenance": prov, "timeline": timeline_out}
    (OUT / "timeline.json").write_text(json.dumps(timeline_doc))
    claims_doc = {"nvdm": "1.0", "dataset": "waterways/claims", "scope": _SCOPE,
     "provenance": prov_env([], "manual", _CLAIMS_NOTE),
     "_provenance": prov, "claims": claims}
    (OUT / "claims.json").write_text(json.dumps(claims_doc))
    today_doc = {"nvdm": "1.0", "dataset": "waterways/today", "scope": _SCOPE,
     "provenance": prov_env(
         doc_sources("today"), "mixed", bld["notes"]["today"]),
     "_provenance": prov, "today": today}
    (OUT / "today.json").write_text(json.dumps(today_doc))
    width_profile_doc = {"nvdm": "1.0", "dataset": "waterways/width-profile", "scope": _SCOPE,
     "provenance": prov_env(
         doc_sources("width_profile"), "derived", bld["notes"]["width_profile"]),
     "_provenance": prov, "profile": profile}
    (OUT / "width-profile.json").write_text(json.dumps(width_profile_doc))
    _cl = json.loads((RESEARCH / "data" / "centerline.geojson").read_text())
    centerline_doc = {"type": _cl["type"],
     "nvdm": "1.0", "dataset": "waterways/centerline", "scope": _SCOPE,
     "provenance": prov_env(
         doc_sources("centerline"), "api", bld["notes"]["centerline"]),
     "features": _cl["features"]}
    (OUT / "centerline.geojson").write_text(json.dumps(centerline_doc))

    n_facts = sum(len(r["facts"]) for r in reaches_out)
    size_mb = sum(f.stat().st_size for d in (OUT, IMG) for f in d.rglob("*") if f.is_file()) / 1e6
    print(f"reaches: {len(reaches_out)}  chapters: {len(chapters_out)}  "
          f"facts: {n_facts}  claims: {len(claims)}  chips: {copied}  "
          f"total: {size_mb:.1f} MB")


if __name__ == "__main__":
    main()

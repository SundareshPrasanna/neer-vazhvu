"""Joins for the snapshot (build step 9): one row per spine lake with

  custodian (spine, V1)
  KSPCB June 2026 station: name, Use Based Class, DO, BOD, turbidity, TSS, the
    join rule and distance (G1, G2); station inside the footprint, else the
    nearest station within KSPCB_MAX_M whose name agrees, else none
  programme state 2025-26 (V2): BBMP budget, NDMF, lakes-department allocation,
    works nearing completion; name-matched, source class carried
  cascade (N1): position, inflow count, downstream lake, direct upstream lakes
    from the edge layer (for N2, N3 in the ranking step)

Output: docs/research/bengaluru-lakes/data/gba-lakes-joins.csv and a match log
printed for review. Every join is by rule; hand fixes go in joins-overrides.csv
(spine_id, kspcb_serial or "none", programme_names).

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python \
       scripts/bengaluru-snapshot/build_joins.py
"""
from __future__ import annotations

import csv
import difflib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform as shp_transform

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs/research/bengaluru-lakes/data"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_spine import aliases, sim  # noqa: E402

KSPCB_MONTH = "2026-06"
KSPCB_MAX_M = 600          # nearest-station rule (with name agreement)
PROG_CUTOFF = 0.9          # fuzzy only above this; lower-similarity true matches are pinned by spine_id in the CSV
NAME_AGREE = 0.6
TO_UTM = Transformer.from_crs("EPSG:4326", "EPSG:32643", always_xy=True).transform


def utm(g):
    return shp_transform(TO_UTM, g)


def name_aliases(name: str) -> list[str]:
    """Spine aliases plus comma-split parts and a token-sorted form, so
    "Soulkere, Kaikondrahalli Vill" and "Lower Ambalipura" still meet their rows."""
    out = []
    for part in [name] + [p for p in re.split(r"[,/]", name) if p.strip()]:
        for a in aliases(part):
            for v in (a, " ".join(sorted(a.split()))):
                if v and v not in out:
                    out.append(v)
    return out


def main() -> None:
    spine = list(csv.DictReader(open(DATA / "gba-lakes-spine.csv")))
    fps = {f["properties"]["spine_id"]: f for f in json.load(open(DATA / "gba-lakes-footprints.geojson"))["features"]}
    fp_utm = {sid: utm(shape(f["geometry"])) for sid, f in fps.items()}
    kspcb = list(csv.DictReader(open(DATA / f"kspcb-lakes-{KSPCB_MONTH}.csv")))
    prog = list(csv.DictReader(open(DATA / "programme-state-2025-26.csv")))
    overrides = {}
    op = DATA / "joins-overrides.csv"
    if op.exists():
        overrides = {r["spine_id"]: r for r in csv.DictReader(open(op))}

    # cascade edges: direct upstream lakes per osm_id
    edges = json.load(open(ROOT / "public/data/cascade/bangalore-cascade-edges.geojson"))["features"]
    up: dict[int, list[str]] = defaultdict(list)
    ep = edges[0]["properties"] if edges else {}
    src_key = next((k for k in ("from_osm_id", "source_osm_id", "src_osm_id", "upstream_osm_id") if k in ep), None)
    dst_key = next((k for k in ("to_osm_id", "target_osm_id", "dst_osm_id", "downstream_osm_id") if k in ep), None)
    name_key = next((k for k in ("from_name", "source_name", "src_name", "upstream_name") if k in ep), None)
    if src_key and dst_key:
        for e in edges:
            p = e["properties"]
            try:
                up[int(p[dst_key])].append(f"{p[src_key]}:{p.get(name_key, '') if name_key else ''}")
            except (TypeError, ValueError):
                pass
    else:
        print(f"cascade edge keys not recognised: {sorted(ep)}", file=sys.stderr)

    # KSPCB stations as points
    st_pts = []
    for r in kspcb:
        try:
            st_pts.append((r, utm(Point(float(r["lon"]), float(r["lat"])))))
        except ValueError:
            pass

    def kspcb_match(row):
        sid = row["spine_id"]
        if sid in overrides and overrides[sid].get("kspcb_serial"):
            v = overrides[sid]["kspcb_serial"].strip()
            if v == "none":
                return None, "override_none", None
            for r, _ in st_pts:
                if r["serial"] == v:
                    return r, "override", 0
        if sid not in fp_utm:
            return None, "no_footprint", None
        g = fp_utm[sid]
        variants = name_aliases(row["ktcda_name"]) + (name_aliases(row["osm_name"]) if row["osm_name"] else [])
        # candidates inside or within KSPCB_MAX_M; a station whose name agrees
        # beats a nearer one that does not (a neighbour's station can sit inside
        # a large footprint: Mahadevapura Lake-2 inside Doddanekundi)
        cands = []
        for r, pt in st_pts:
            d = g.distance(pt)
            if d <= KSPCB_MAX_M:
                agree = max((sim(a, b) for a in variants for b in name_aliases(r["name"])), default=0)
                cands.append((0 if agree >= NAME_AGREE else 1, d, r))
        cands.sort(key=lambda t: (t[0], t[1]))
        if not cands:
            return None, "none", None
        rank, d, r = cands[0]
        if rank == 0:
            return r, ("inside_footprint" if d == 0 else "nearest_name_agrees"), int(d)
        if d == 0:
            return r, "inside_footprint_name_conflict", 0
        return None, "nearest_name_conflict", int(d)

    prog_index: dict[str, list[dict]] = defaultdict(list)
    for r in prog:
        for a in name_aliases(r["lake_name_as_printed"]):
            prog_index[a].append(r)
    prog_keys = list(prog_index)

    pinned_names = {r["lake_name_as_printed"] for r in prog if r.get("spine_id")}

    def prog_match(row):
        variants = name_aliases(row["ktcda_name"]) + (name_aliases(row["osm_name"]) if row["osm_name"] else [])
        hits = [r for r in prog if r.get("spine_id") == row["spine_id"]]
        for v in variants:
            if v in prog_index:
                hits += prog_index[v]
            else:
                for c in difflib.get_close_matches(v, prog_keys, n=2, cutoff=PROG_CUTOFF):
                    hits += prog_index[c]
        seen, out = set(), []
        for h in hits:
            if h["lake_name_as_printed"] in pinned_names and h.get("spine_id") != row["spine_id"]:
                continue  # a pinned name never matches another lake by similarity
            k = (h["lake_name_as_printed"], h["programme"])
            if k not in seen:
                seen.add(k); out.append(h)
        return out

    out_rows, log = [], defaultdict(int)
    kspcb_used = defaultdict(list)
    for row in spine:
        sid = row["spine_id"]
        st, how, dist = kspcb_match(row)
        log[how] += 1
        hits = prog_match(row)
        rec = {
            "spine_id": sid, "ktcda_key": row["ktcda_key"], "ktcda_name": row["ktcda_name"], "custodian": row["ktcda_custodian"],
            "corporation": row["corporation"], "ward_name": row["ward_name"], "osm_id": row["osm_id"],
            "kspcb_join": how, "kspcb_distance_m": dist if dist is not None else "",
            "kspcb_serial": st["serial"] if st else "", "kspcb_name": st["name"] if st else "",
            "kspcb_class": st["use_based_class"] if st else "", "kspcb_month": KSPCB_MONTH if st else "",
            "kspcb_do_mgl": st["do_mgl"] if st else "", "kspcb_bod_mgl": st["bod_mgl"] if st else "",
            "kspcb_turbidity_ntu": st["turbidity_ntu"] if st else "", "kspcb_tss_mgl": st["tss_mgl"] if st else "",
            "kspcb_fecal_coliform_mpn": st["fecal_coliform_mpn"] if st else "",
            "programme_state": "; ".join(f"{h['programme']}" + (f" Rs {h['amount_cr']} cr" if h["amount_cr"] else "") for h in hits),
            "programme_source_class": "; ".join(sorted({h["source_class"] for h in hits})),
            "programme_match_names": "; ".join(sorted({h["lake_name_as_printed"] for h in hits})),
            "cascade_position": row["cascade_position"], "degree_in": row["degree_in"], "drains_to": row["drains_to"],
            "upstream_lakes": "; ".join(up.get(int(row["osm_id"]), [])) if row["osm_id"] else "",
        }
        if st:
            kspcb_used[st["serial"]].append(sid)
        out_rows.append(rec)

    with open(DATA / "gba-lakes-joins.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys())); w.writeheader(); w.writerows(out_rows)
    print("KSPCB join:", dict(log))
    dup = {k: v for k, v in kspcb_used.items() if len(v) > 1}
    print("KSPCB stations joined to more than one lake:", dup)
    matched = {r["kspcb_serial"] for r in out_rows if r["kspcb_serial"]}
    print(f"KSPCB stations matched {len(matched)} of {len(kspcb)}; unmatched stations:")
    for r in kspcb:
        if r["serial"] not in matched:
            print(f"   {r['serial']:>3} {r['name']} ({r['lat']}, {r['lon']}) class {r['use_based_class']}")
    print("programme rows matched to a spine lake:", sum(1 for r in out_rows if r["programme_state"]))
    for r in out_rows:
        if r["programme_match_names"]:
            print(f"   {r['spine_id']} {r['ktcda_name'][:34]:<34} <- {r['programme_match_names']}")
    pm = {n for r in out_rows for n in r["programme_match_names"].split("; ") if n}
    print("programme names unmatched:", sorted({r["lake_name_as_printed"] for r in prog} - pm))
    print("cascade upstream lists:", sum(1 for r in out_rows if r["upstream_lakes"]))


if __name__ == "__main__":
    main()

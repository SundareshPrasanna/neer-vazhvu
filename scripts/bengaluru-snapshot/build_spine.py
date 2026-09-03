"""Build the GBA lake spine: one record per KTCDA custody-list lake, joined to an
OSM polygon (public/geojson/bangalore-water-bodies-current.geojson), the BBMP Lake
Management System point, the 2025 ward and corporation, and the cascade layer.

Match order per KTCDA row (a polygon is assigned to at most one row; every "/"
alias of the KTCDA name is tried):
  0. manual override (data/spine-manual-overrides.csv: ktcda_key -> osm_id, or
     duplicate_of, or no_polygon=1)
  1. LMS point (name match KTCDA->LMS) inside an OSM polygon, or nearest within
     400 m. Full priority when the polygon is unnamed or its name agrees with the
     lake name (similarity >= 0.6); otherwise kept as a low-priority candidate
     (method suffixed "_name_conflict") so a transliteration mismatch does not
     lose a correct point, while a row with an agreeing name wins any collision
  2. KTCDA name exact match to an OSM polygon name (normalised)
  3. KTCDA name fuzzy match (ratio >= 0.86), preferring polygons inside the row's
     assembly constituency
  4. unmatched -> data/spine-manual-queue.csv with candidate polygons from both the
     LMS point neighbourhood and name similarity (ratio >= 0.6)

Outputs (docs/research/bengaluru-lakes/data/):
  gba-lakes-spine.csv, gba-lakes-spine.geojson, spine-manual-queue.csv

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python scripts/bengaluru-snapshot/build_spine.py
"""
from __future__ import annotations

import csv
import difflib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs/research/bengaluru-lakes/data"
GEO = ROOT / "public/geojson"
DEG_400M = 0.0036
BBOX = (77.2, 12.6, 78.0, 13.4)

STOP = r"\b(lake|kere|keri|tank|kunte|katte|amanikere|ammanikere|amani|stp|disused|near|temple|bangalore|bengaluru|north|south|east|west|taluk|and|ward|no)\b"


def norm(name: str) -> str:
    n = name.lower()
    n = re.sub(r"\(.*?\)", " ", n)
    n = re.sub(r"-\s*\d+", " ", n)
    n = re.sub(STOP, " ", n)
    n = re.sub(r"[^a-z ]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    n = n.replace("ooru", "ur").replace("uru", "ur").replace("oor", "ur")
    n = n.replace("pete", "pet").replace("nagara", "nagar").replace("palya", "palya")
    return n


def aliases(name: str) -> list[str]:
    parts = [p for p in re.split(r"[/]", name) if p.strip()]
    out = []
    for p in parts + [name]:
        n = norm(p)
        if n and n not in out:
            out.append(n)
    return out


def sim(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a, b).ratio() if a and b else 0.0


def main() -> None:
    ktcda = list(csv.DictReader(open(DATA / "ktcda-custody-lists.csv")))
    lms_raw = json.load(open(DATA / "lms-locations-raw.json"))
    lms = lms_raw["locations"] if isinstance(lms_raw, dict) else lms_raw
    zone_of: dict[int, int] = {}
    for z in range(1, 9):
        p = DATA / "lms-zones" / f"zone-{z}.json"
        if p.exists():
            d = json.load(open(p))
            for loc in (d.get("locations") if isinstance(d, dict) else d) or []:
                zone_of[int(loc["id"])] = z
    overrides: dict[str, dict] = {}
    op = DATA / "spine-manual-overrides.csv"
    if op.exists():
        for r in csv.DictReader(open(op)):
            overrides[r["ktcda_key"].strip()] = r

    polys = json.load(open(GEO / "bangalore-water-bodies-current.geojson"))["features"]
    poly_geoms = [shape(f["geometry"]) for f in polys]
    tree = STRtree(poly_geoms)
    wards = json.load(open(GEO / "bangalore-wards-2025.geojson"))["features"]
    ward_geoms = [shape(f["geometry"]) for f in wards]
    ward_tree = STRtree(ward_geoms)
    cascade = {f["properties"]["osm_id"]: f["properties"] for f in json.load(open(ROOT / "public/data/cascade/bangalore-cascade-lakes.geojson"))["features"]}
    osm_index = {f["properties"]["osm_id"]: i for i, f in enumerate(polys)}

    name_index: dict[str, list[int]] = defaultdict(list)
    for i, f in enumerate(polys):
        nm = f["properties"].get("name") or ""
        if nm:
            for a in aliases(nm):
                name_index[a].append(i)
    lms_index: dict[str, list[dict]] = defaultdict(list)
    for loc in lms:
        for a in aliases(loc["name"]):
            lms_index[a].append(loc)
    name_keys = list(name_index.keys())
    lms_keys = list(lms_index.keys())

    def ward_for(pt: Point):
        for j in ward_tree.query(pt):
            if ward_geoms[j].contains(pt):
                return wards[j]["properties"]
        return None

    ac_cache: dict[int, str] = {}

    def ac_of_poly(j: int) -> str:
        if j not in ac_cache:
            w = ward_for(poly_geoms[j].representative_point())
            ac_cache[j] = ((w or {}).get("ac_name", "") or "").lower()
        return ac_cache[j]

    def lms_lookup(variants: list[str]):
        for v in variants:
            if v in lms_index:
                return lms_index[v][0]
        for v in variants:
            m = difflib.get_close_matches(v, lms_keys, n=1, cutoff=0.86)
            if m:
                return lms_index[m[0]][0]
        return None

    def point_candidates(pt: Point):
        out = []
        for j in tree.query(pt):
            if poly_geoms[j].contains(pt):
                out.append((j, 0.0))
        for j in tree.query(pt.buffer(DEG_400M)):
            d = poly_geoms[j].distance(pt)
            if d < DEG_400M and all(j != o for o, _ in out):
                out.append((j, d))
        return sorted(out, key=lambda t: t[1])

    def poly_name_agree(j: int, variants: list[str], lms_name: str | None) -> float:
        pname = polys[j]["properties"].get("name") or ""
        if not pname:
            return 1.0
        pv = aliases(pname)
        best = 0.0
        for a in variants + (aliases(lms_name) if lms_name else []):
            for b in pv:
                best = max(best, sim(a, b))
        return best

    # ---- pass 1: candidate per row --------------------------------------------
    proposals = []  # (row_idx, j, method, score, sort_key)
    lms_hits: dict[int, dict] = {}
    for ri, row in enumerate(ktcda):
        key = f"{row['custodian']}#{row['serial']}"
        variants = aliases(row["name"])
        # LMS lookup runs for every row, override or not: the point is the only
        # location an unassessed row has, and the override only fixes the polygon
        hit = lms_lookup(variants)
        pt = None
        if hit:
            try:
                x, y = float(hit["longitude"]), float(hit["latitude"])
                if BBOX[0] < x < BBOX[2] and BBOX[1] < y < BBOX[3]:
                    pt = Point(x, y)
                    lms_hits[ri] = hit
            except Exception:
                pass
        if key in overrides:
            o = overrides[key]
            if o.get("osm_id", "").strip():
                proposals.append((ri, osm_index[int(o["osm_id"])], "manual_override", 1.0, 0))
            continue
        chosen = None
        if pt is not None:
            best = None
            for j, d in point_candidates(pt):
                agree = poly_name_agree(j, variants, hit["name"])
                rank = (0 if agree >= 0.6 else 1, d)
                if best is None or rank < best[0]:
                    best = (rank, j, d, agree)
            if best:
                _, j, d, agree = best
                inside = d == 0
                if agree >= 0.6:
                    chosen = (ri, j, "lms_point_in_polygon" if inside else "lms_point_nearest", round(agree, 3), 1 if inside else 2)
                else:
                    chosen = (ri, j, ("lms_point_in_polygon" if inside else "lms_point_nearest") + "_name_conflict", round(agree, 3), 5 if inside else 6)
        if chosen is None or chosen[4] >= 5:
            exact = None
            for v in variants:
                if v in name_index:
                    cands = name_index[v][:]
                    ac = (row["constituency_or_taluk"] or "").lower()
                    cands.sort(key=lambda i: (0 if ac and ac in ac_of_poly(i) else 1, -(polys[i]["properties"].get("area_ha") or 0)))
                    exact = (ri, cands[0], "name_exact", 1.0, 3)
                    break
            if exact:
                chosen = exact
        if chosen is None or chosen[4] >= 5:
            fz = None
            ac = (row["constituency_or_taluk"] or "").lower()
            for v in variants:
                for cand in difflib.get_close_matches(v, name_keys, n=3, cutoff=0.86):
                    for i in name_index[cand]:
                        pri = 0 if ac and ac in ac_of_poly(i) else 1
                        s = sim(v, cand)
                        if fz is None or (pri, -s) < (fz[0], -fz[1]):
                            fz = (pri, s, i)
            if fz:
                chosen = (ri, fz[2], "name_fuzzy", round(fz[1], 3), 4)
        if chosen:
            proposals.append(chosen)

    # ---- pass 2: one polygon per row, best claim wins --------------------------
    claimed: dict[int, tuple] = {}
    for prop in sorted(proposals, key=lambda p: (p[4], -p[3])):
        if prop[1] not in claimed:
            claimed[prop[1]] = prop
    winner = {p[0]: p for p in claimed.values()}

    # ---- assemble ---------------------------------------------------------------
    records, queue = [], []
    for ri, row in enumerate(ktcda):
        key = f"{row['custodian']}#{row['serial']}"
        rec = dict(
            spine_id=f"gba-{row['custodian'].lower().split()[0]}-{int(row['serial']):03d}",
            ktcda_key=key, ktcda_custodian=row["custodian"], ktcda_serial=row["serial"], ktcda_name=row["name"],
            ktcda_ward=row["ward"], ktcda_constituency=row["constituency_or_taluk"], in_bbmp=row["in_bbmp"],
            lms_id="", lms_name="", lms_lat="", lms_lon="", lms_zone="",
            osm_id="", osm_name="", area_ha="", match_method="unmatched", match_score="",
            ward_no="", ward_name="", corporation="", assembly="",
            cascade_position="", degree_in="", drains_to="", duplicate_of="", note="",
        )
        hit = lms_hits.get(ri)
        if hit:
            rec.update(lms_id=hit["id"], lms_name=hit["name"], lms_lat=hit["latitude"], lms_lon=hit["longitude"], lms_zone=zone_of.get(int(hit["id"]), ""))
        o = overrides.get(key)
        if o and o.get("duplicate_of", "").strip():
            rec.update(match_method="duplicate", duplicate_of=o["duplicate_of"].strip(), note=o.get("note", ""))
        elif o and o.get("no_polygon", "").strip() == "1":
            rec.update(match_method="no_polygon", note=o.get("note", ""))
        elif ri in winner:
            _, j, method, score, _ = winner[ri]
            p = polys[j]["properties"]
            rec.update(osm_id=p["osm_id"], osm_name=p.get("name", ""), area_ha=p.get("area_ha", ""), match_method=method, match_score=score, note=(o or {}).get("note", ""))
            w = ward_for(poly_geoms[j].representative_point())
            if w:
                rec.update(ward_no=w.get("ward_no"), ward_name=w.get("ward_name"), corporation=w.get("corporation"), assembly=w.get("ac_name"))
            cp = cascade.get(p["osm_id"])
            if cp:
                rec.update(cascade_position=cp.get("cascade_position"), degree_in=cp.get("degree_in"), drains_to=cp.get("drains_to_name"))
        else:
            lost = [p for p in proposals if p[0] == ri]
            why = f"lost {polys[lost[0][1]]['properties']['osm_id']} ({polys[lost[0][1]]['properties'].get('name','')}) to a better claim" if lost else "no candidate"
            cands = []
            if hit:
                try:
                    pt = Point(float(hit["longitude"]), float(hit["latitude"]))
                    for j, d in point_candidates(pt)[:3]:
                        cands.append(f"pt {polys[j]['properties']['osm_id']} '{polys[j]['properties'].get('name','')}' {polys[j]['properties'].get('area_ha','')}ha {round(d*111000)}m")
                except Exception:
                    pass
            seenc = set()
            for v in aliases(row["name"]):
                for cand in difflib.get_close_matches(v, name_keys, n=3, cutoff=0.6):
                    for i in name_index[cand][:2]:
                        oid = polys[i]["properties"]["osm_id"]
                        if oid in seenc:
                            continue
                        seenc.add(oid)
                        cands.append(f"nm {oid} '{polys[i]['properties'].get('name','')}' {polys[i]['properties'].get('area_ha','')}ha ac={ac_of_poly(i)} s={round(sim(v,cand),2)}")
            queue.append(dict(ktcda_key=key, name=row["name"], ward=row["ward"], constituency=row["constituency_or_taluk"], lms_hit=(hit or {}).get("name", ""), lms_lat=(hit or {}).get("latitude", ""), lms_lon=(hit or {}).get("longitude", ""), why=why, candidates=" | ".join(cands[:8])))
        records.append(rec)

    with open(DATA / "gba-lakes-spine.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(records[0].keys())); w.writeheader(); w.writerows(records)
    with open(DATA / "spine-manual-queue.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["ktcda_key", "name", "ward", "constituency", "lms_hit", "lms_lat", "lms_lon", "why", "candidates"]); w.writeheader(); w.writerows(queue)
    feats = [{"type": "Feature", "geometry": polys[osm_index[int(r["osm_id"])]]["geometry"], "properties": r} for r in records if r["osm_id"] != ""]
    json.dump({"type": "FeatureCollection", "features": feats}, open(DATA / "gba-lakes-spine.geojson", "w"))

    print("rows:", len(records), dict(Counter(r["match_method"] for r in records)))
    areas = sorted(float(r["area_ha"]) for r in records if r["area_ha"] != "")
    def cnt(lo, hi=1e9): return sum(1 for a in areas if lo <= a < hi)
    print("matched areas: <2 ha", cnt(0, 2), "| 2-5", cnt(2, 5), "| 5-10", cnt(5, 10), "| 10-20", cnt(10, 20), "| 20-50", cnt(20, 50), "| >=50", cnt(50))
    print("corporations:", dict(Counter(r["corporation"] for r in records if r["corporation"])))
    print("manual queue:", len(queue))


if __name__ == "__main__":
    main()

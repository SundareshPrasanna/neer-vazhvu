"""Diagnostic: KTCDA rows that collapsed onto the same OSM polygon, with method and
distance context, so the crosswalk can be tightened."""
from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV = ROOT / "docs/research/bengaluru-lakes/data/gba-lakes-spine.csv"

rows = list(csv.DictReader(open(CSV)))
by_poly: dict[str, list[dict]] = defaultdict(list)
for r in rows:
    if r["osm_id"]:
        by_poly[r["osm_id"]].append(r)
dups = {k: v for k, v in by_poly.items() if len(v) > 1}
print("polygons shared by more than one KTCDA row:", len(dups))
for osm, rs in sorted(dups.items(), key=lambda kv: -len(kv[1])):
    print(f"\nosm {osm}  '{rs[0]['osm_name']}'  {rs[0]['area_ha']} ha  ward {rs[0]['ward_name']} ({rs[0]['corporation']})")
    for r in rs:
        print(f"   {r['ktcda_custodian']:>6} #{r['ktcda_serial']:>3}  {r['ktcda_name'][:38]:38}  via {r['match_method']:22} lms='{r['lms_name'][:30]}'  ktcda_ward='{r['ktcda_ward'][:16]}'")

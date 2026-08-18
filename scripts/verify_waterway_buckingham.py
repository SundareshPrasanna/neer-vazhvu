#!/usr/bin/env python3
"""Publication gate for public/data/waterways/buckingham-canal/.

Fails (exit 1) if:
  - any fact/claim lacks a non-empty source, date, or valid flag
  - any banned claim string appears in emitted text (the corrected
    figures of 18 Aug 2026 must never render):
      * "7.51"  (the unverified widening figure)
      * "1,280 KLD" / "1280 KLD" (2010-vintage CPCL figure as current)
      * a width-table claim sourced to The Hindu
      * "242.73" in any claim whose text ties it to the canal alone
  - reach km ranges do not tile 0..74.5 contiguously
  - a referenced chip is missing
  - the data directory exceeds 8 MB
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "waterways" / "buckingham-canal"
errors = []

reaches = json.loads((OUT / "reaches.json").read_text())
chapters = json.loads((OUT / "chapters.json").read_text())
timeline = json.loads((OUT / "timeline.json").read_text())
claims = json.loads((OUT / "claims.json").read_text())["claims"]

FLAGS = {"verified", "inferred", "asserted"}
for c in claims:
    if not c.get("source") or not str(c.get("source")).strip():
        errors.append(f"{c['id']}: empty source")
    if not c.get("date") or not str(c.get("date")).strip():
        errors.append(f"{c['id']}: empty date")
    if c.get("flag") not in FLAGS:
        errors.append(f"{c['id']}: bad flag {c.get('flag')!r}")

all_text = json.dumps(
    [reaches, chapters, timeline, claims], ensure_ascii=False)

if "7.51" in all_text:
    errors.append('banned: "7.51" (unverified widening figure) appears')
for s in ("1,280 KLD", "1280 KLD"):
    if s in all_text:
        errors.append(f'banned: "{s}" (2010-vintage CPCL figure) appears')
for c in claims:
    blob = (c["text"] + " " + c["source"]).lower()
    if "hindu" in blob and ("width" in blob or "143" in blob):
        errors.append(f"{c['id']}: width table attributed to The Hindu")
    if "242.73" in c["text"]:
        t = c["text"].lower()
        if "water bodies" not in t and "waterways" not in t:
            errors.append(f"{c['id']}: 242.73 without the all-water-bodies "
                          "qualifier")

rs = sorted(reaches["reaches"], key=lambda r: r["km"][0])
if abs(rs[0]["km"][0] - 0.0) > 0.01:
    errors.append("reach tiling does not start at km 0")
for a, b in zip(rs, rs[1:]):
    if abs(a["km"][1] - b["km"][0]) > 0.01:
        errors.append(f"reach gap/overlap at km {a['km'][1]} -> {b['km'][0]}")
if abs(rs[-1]["km"][1] - 74.5) > 0.11:
    errors.append(f"reach tiling ends at {rs[-1]['km'][1]}, expected 74.5")

for r in rs:
    for chip in r["chips"]:
        if not (OUT / "chips" / chip).exists():
            errors.append(f"reach {r['id']}: missing chip {chip}")
    for f in r["facts"]:
        if not f.get("claim_id"):
            errors.append(f"reach {r['id']}: fact without claim_id")

size_mb = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file()) / 1e6
if size_mb > 8.0:
    errors.append(f"data dir {size_mb:.1f} MB exceeds 8 MB budget")

if errors:
    print(f"FAIL ({len(errors)}):")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print(f"OK: {len(claims)} claims sourced+dated+flagged, "
      f"{len(rs)} reaches tiled 0-74.5 km, chips present, "
      f"{size_mb:.1f} MB <= 8 MB")

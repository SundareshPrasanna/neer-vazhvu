#!/usr/bin/env python3
"""Publication gate for public/data/waterways/cooum/.

Fails (exit 1) if:
  - any fact/claim lacks a non-empty source, date, or valid flag
  - any banned claim appears in emitted text (DECISIONS.md C5; each was
    a real error found in circulation during the Aug 2026 research):
      * "8,552" / "8552" cusecs (Poondi releases do not flow down the Cooum)
      * "19,817" / "19817" (not a Cooum resettlement figure)
      * "76 miles" (1905 postcard caption)
      * 19,500 or 22,000 rendered as cubic metres per second / cumecs
        (the CMDA primary reads cusecs)
      * "345 mg" as a reading without its 2021 vintage in the same claim
      * an outfall count of 118 without its 2014 vintage in the same claim
      * the sewage-inlet data attributed to Arappor (it is PWD via NEPT 2017)
  - reach km ranges do not tile 0..62.8 contiguously
  - a referenced chip or photo is missing
  - the data directory exceeds 8 MB
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "waterways" / "cooum"
IMG = ROOT / "public" / "images" / "waterways" / "cooum"
errors = []

reaches = json.loads((OUT / "reaches.json").read_text())
chapters = json.loads((OUT / "chapters.json").read_text())
timeline = json.loads((OUT / "timeline.json").read_text())
claims = json.loads((OUT / "claims.json").read_text())["claims"]
today = json.loads((OUT / "today.json").read_text())

FLAGS = {"verified", "inferred", "asserted"}
for c in claims:
    if not c.get("source") or not str(c.get("source")).strip():
        errors.append(f"{c['id']}: empty source")
    if not c.get("date") or not str(c.get("date")).strip():
        errors.append(f"{c['id']}: empty date")
    if c.get("flag") not in FLAGS:
        errors.append(f"{c['id']}: bad flag {c.get('flag')!r}")

all_text = json.dumps(
    [reaches, chapters, timeline, claims, today], ensure_ascii=False)

for s in ("8,552", "8552", "19,817", "19817", "76 miles"):
    if s in all_text:
        errors.append(f'banned: "{s}" appears in emitted text')

CUMEC = re.compile(r"(19,?500|22,?000)[^.]{0,40}(m3/s|m³|cumec|cubic metre)")
if CUMEC.search(all_text):
    errors.append("banned: 19,500/22,000 rendered as cubic metres per second")

for c in claims:
    blob = c["text"] + " " + c["source"]
    if "345 mg" in blob and "2021" not in blob:
        errors.append(f"{c['id']}: 345 mg/L without its 2021 vintage")
    if "outfall" in blob.lower() and re.search(r"\b118\b", blob) \
            and "2014" not in blob:
        errors.append(f"{c['id']}: an outfall count of 118 without its "
                      "2014 vintage")
    if "inlet" in blob.lower() and "arappor" in blob.lower():
        errors.append(f"{c['id']}: sewage-inlet data attributed to Arappor "
                      "(it is PWD data via NEPT 16(3) 2017)")

rs = sorted(reaches["reaches"], key=lambda r: r["km"][0])
if abs(rs[0]["km"][0] - 0.0) > 0.01:
    errors.append("reach tiling does not start at km 0")
for a, b in zip(rs, rs[1:]):
    if abs(a["km"][1] - b["km"][0]) > 0.01:
        errors.append(f"reach gap/overlap at km {a['km'][1]} -> {b['km'][0]}")
if abs(rs[-1]["km"][1] - 62.8) > 0.11:
    errors.append(f"reach tiling ends at {rs[-1]['km'][1]}, expected 62.8")

for r in rs:
    for chip in r["chips"]:
        if not (IMG / "chips" / chip).exists():
            errors.append(f"reach {r['id']}: missing chip {chip}")
    for ph in r["photos"]:
        if not (IMG / "photos" / ph["file"]).exists():
            errors.append(f"reach {r['id']}: missing photo {ph['file']}")
    for f in r["facts"]:
        if not f.get("claim_id"):
            errors.append(f"reach {r['id']}: fact without claim_id")

size_mb = sum(f.stat().st_size for d in (OUT, IMG) for f in d.rglob("*") if f.is_file()) / 1e6
if size_mb > 8.0:
    errors.append(f"data dir {size_mb:.1f} MB exceeds 8 MB budget")

if errors:
    print(f"FAIL ({len(errors)}):")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print(f"OK: {len(claims)} claims sourced+dated+flagged, "
      f"{len(rs)} reaches tiled 0-62.8 km, chips and photos present, "
      f"{size_mb:.1f} MB <= 8 MB")

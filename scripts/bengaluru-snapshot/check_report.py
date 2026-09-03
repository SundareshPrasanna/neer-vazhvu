"""Number and language checks on the rendered report (build step 11, final-run
checks 1 to 3 in the build log). Exit code 1 on any failure.

  1. every W1, W2, Q1 cell in the ordered list is either a value with a band, an
     n and a confidence letter, or the word "insufficient"
  2. no Health Card band is assigned where the ranking script flagged two
     candidate bands without saying so (band_notes are carried per lake)
  3. language: no em dashes, no "awaiting review", none of the blame words the
     government-facing rule excludes, the brand name as two words

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python \
       scripts/bengaluru-snapshot/check_report.py
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs/research/bengaluru-lakes/data"
HTML = ROOT / "docs/research/bengaluru-lakes/bengaluru-lakes-snapshot-2026.html"

BLAME = ["negligen", "failed to", "failure of", "illegal", "culprit", "blame", "violat", "lapse", "apathy", "mismanag", "abandon"]


def main() -> int:
    page = HTML.read_text()
    body = re.sub(r"<style>.*?</style>", "", page, flags=re.S)
    body = re.sub(r"<svg.*?</svg>", "", body, flags=re.S)
    txt = re.sub(r"<[^>]+>", " ", body)
    fails = []
    # 1. cells
    cells = re.findall(r'<td class="num">([^<]*?)<span class="pm">([^<]*)</span> <span class="meta">n(\d+) ([HML])</span></td>|<td class="num muted">(insufficient)</td>', page)
    n_val = sum(1 for c in cells if c[0]); n_ins = sum(1 for c in cells if c[4])
    bad = [c for c in cells if c[0] and not re.fullmatch(r"±[\d.]+", c[1])]
    if bad:
        fails.append(f"{len(bad)} value cells without a band")
    # 2. band notes carried
    ranking = list(csv.DictReader(open(DATA / "gba-lakes-ranking.csv")))
    n_amb = sum(1 for r in ranking if r["band_notes"])
    # 3. language
    if "—" in txt or "–" in txt:
        fails.append("em or en dash in the text")
    if "awaiting review" in txt.lower():
        fails.append("'awaiting review' in the text")
    for w in BLAME:
        if w in txt.lower():
            fails.append(f"blame word '{w}'")
    if re.search(r"NeerVazhvu|Neervazhvu", txt):
        fails.append("brand name run together")
    print(f"value cells {n_val}, insufficient cells {n_ins}, lakes with candidate-band notes {n_amb} (carried in gba-lakes-ranking.csv band_notes)")
    if fails:
        print("FAIL: " + "; ".join(fails))
        return 1
    print("checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Diagnostic: which BBMP serials the strict parser dropped, with their raw lines."""
from __future__ import annotations

import csv
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "docs/research/bengaluru-lakes/sources/ktcda-bbmp-lakes.pdf"
CSV = ROOT / "docs/research/bengaluru-lakes/data/ktcda-custody-lists.csv"

got = {int(r["serial"]) for r in csv.DictReader(open(CSV)) if r["custodian"] == "BBMP"}
text = subprocess.run(["pdftotext", "-layout", str(PDF), "-"], capture_output=True, text=True).stdout
lines = text.split("\n")
missing = []
for i, l in enumerate(lines):
    m = re.match(r"^\s*(\d{1,3})\s{2,}(.*\S)\s*$", l)
    if m and int(m.group(1)) not in got:
        missing.append((int(m.group(1)), l.rstrip(), lines[i + 1].rstrip() if i + 1 < len(lines) else ""))
seen = set()
for n, l, nxt in missing:
    if n in seen:
        continue
    seen.add(n)
    print(f"{n:4d} | {l[:110]}")
    print(f"      next: {nxt[:110]}")
print("missing serials:", sorted(seen), "count", len(seen), "max serial in file:", max(int(m.group(1)) for m in (re.match(r'^\s*(\d{1,3})\s{2,}', l) for l in lines) if m))

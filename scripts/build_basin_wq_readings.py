#!/usr/bin/env python3
"""Attach KSPCB/NWMP use-based water-quality classes to a basin overview's
wq-stations (the L2 "readings" rung of the depth ladder - see
docs/specs/cauvery-basin-hierarchy.md).

Parses the KSPCB "Classification of Water Quality under NWMP" PDF (monthly
use-based class per station, A best .. E worst, * = not sampled), joins rows
to wq-stations.geojson by the NWMP station code, and writes:
  - per-station props: monthlyClasses, latestClass, worstClass,
    readingsPeriod, readingsSource
  - per-sub-basin scoreboard metric wqWorstClass (verified: the classification
    is the board's own published verdict)

Usage:
    python3 scripts/build_basin_wq_readings.py \
        <local copy of the KSPCB NWMP classification PDF, fetched from
        kspcb.karnataka.gov.in - NOT mirrored in the repo, see
        scripts/mirrored-documents.json> \
        public/data/basins/cauvery-ka \
        "April 2025 - February 2026"
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

CLASS_ORDER = "ABCDE"  # A best .. E worst


def parse_classification(pdf_path: Path) -> dict[str, list[str]]:
    from pypdf import PdfReader

    text = "\n".join((p.extract_text() or "") for p in PdfReader(str(pdf_path)).pages)
    rows: dict[str, list[str]] = {}
    pending: str | None = None
    for raw in text.split("\n"):
        line = raw.strip()
        if not line or line.startswith(("Apr-", "Class ", "Sl")):
            continue
        m = re.match(r"^(\d{1,3})\s+(\d{1,4})\s+(.*)$", line)
        if m:
            pending = None
            code, rest = m.group(2), m.group(3)
        elif pending is not None:
            code, rest = pending, line
        else:
            continue
        # a completed row ends in >= 8 class tokens (A-E or *)
        tokens = rest.split()
        classes: list[str] = []
        while tokens and re.fullmatch(r"[A-E*]", tokens[-1]):
            classes.insert(0, tokens.pop())
        if len(classes) >= 8:
            rows[code] = (rows.get(code) or [])[:0] + classes
            pending = None
        else:
            pending = code
    return rows


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__)
        return 2
    pdf_path, basin_dir, period = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    source = f"KSPCB NWMP classification, {period} (mirrored: /{pdf_path.relative_to('public')})"

    rows = parse_classification(pdf_path)
    print(f"parsed {len(rows)} classified stations from the PDF")

    fp = basin_dir / "wq-stations.geojson"
    fc = json.loads(fp.read_text())
    matched = 0
    worst_by_sub: dict[str, str] = {}
    for f in fc["features"]:
        p = f["properties"]
        classes = rows.get(str(p.get("stationCode", "")))
        if not classes:
            continue
        sampled = [c for c in classes if c in CLASS_ORDER]
        if not sampled:
            continue
        p["monthlyClasses"] = "".join(classes)
        p["latestClass"] = sampled[-1]
        p["worstClass"] = max(sampled, key=CLASS_ORDER.index)
        p["readingsPeriod"] = period
        p["readingsSource"] = source
        matched += 1
        sub = p.get("subBasin")
        if sub:
            cur = worst_by_sub.get(sub)
            if cur is None or CLASS_ORDER.index(p["worstClass"]) > CLASS_ORDER.index(cur):
                worst_by_sub[sub] = p["worstClass"]
    fp.write_text(json.dumps(fc, separators=(",", ":"), ensure_ascii=False))
    print(f"matched {matched}/{len(fc['features'])} basin stations; worst-by-sub: {worst_by_sub}")

    # scoreboard: wqWorstClass per sub-basin (join sub codes -> scoreboardKey)
    sb_fp = basin_dir / "scoreboard.json"
    sb = json.loads(sb_fp.read_text())
    subs = json.loads((basin_dir / "sub-basins.geojson").read_text())
    code_to_key = {
        f["properties"].get("code"): f["properties"].get("scoreboardKey")
        for f in subs["features"]
    }
    for code, worst in worst_by_sub.items():
        key = code_to_key.get(code)
        if key and key in sb["subBasins"]:
            sb["subBasins"][key]["metrics"]["wqWorstClass"] = {
                "value": worst, "unit": "use-based class",
                "asOf": sb.get("asOf"), "source": source, "verified": True,
            }
    sb_fp.write_text(json.dumps(sb, indent=1, ensure_ascii=False))
    print("scoreboard updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

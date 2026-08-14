#!/usr/bin/env python3
"""
Convert OpenCity BWSSB Cauvery stage-wise water-supply areas CSV to JSON.

Source: https://data.opencity.in/dataset/bwssb-stage-wise-cauvery-water-supply-areas
File:   bwssb-cauvery-stage-areas.csv (5 parallel columns: Stage 1..Stage 4 Ph 2)

Output: public/data/bangalore-cauvery-stage-areas.json
   {
     "stage_1": ["Nethajinagar", "Nagamma Nagar", ...],
     "stage_2": [...],
     "stage_3": [...],
     "stage_4_ph_1": [...],
     "stage_4_ph_2": [...]
   }

The source CSV is parallel columns of unequal length, not normalised rows.
Each column lists the BBMP-area names served by that Cauvery supply stage.
We strip whitespace and drop empty cells.

NOTE: Stage V (commissioned Oct 2024 at T.K. Halli, ~775 MLD design but
~400 MLD actual delivery as of Feb 2026, covering the 110 newly-added
villages) is NOT in this dataset - OpenCity hasn't yet captured it as
of this commit. Follow-up: ingest Stage V coverage when published.

The source CSV is Windows-1252 / latin-1 encoded (apostrophes, dashes).
We read with latin-1 and emit clean UTF-8 JSON.

Run: python scripts/convert-bangalore-cauvery-stage-areas.py scripts/data-raw/bangalore/bwssb-cauvery-stage-areas.csv
"""

import csv
import re
import sys
from pathlib import Path

from nvdm_write import write_artifact

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
OUT = REPO_ROOT / "public" / "data" / "bangalore-cauvery-stage-areas.json"

STAGE_KEY_FROM_HEADER = {
    "Cauvery Stage 1": "stage_1",
    "Stage 2": "stage_2",
    "Stage 3": "stage_3",
    "Stage 4 Ph 1": "stage_4_ph_1",
    "Stage 4 Phase 2": "stage_4_ph_2",
}


def main() -> None:
    if len(sys.argv) < 2:
        print(
            "Usage: convert-bangalore-cauvery-stage-areas.py <path-to-csv>",
            file=sys.stderr,
        )
        sys.exit(1)

    src = Path(sys.argv[1])
    # The source uses Windows-1252 chars (curly apostrophes / en-dashes).
    with src.open(encoding="latin-1") as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames or []
        stages: dict[str, list[str]] = {key: [] for key in STAGE_KEY_FROM_HEADER.values()}
        seen: dict[str, set[str]] = {key: set() for key in STAGE_KEY_FROM_HEADER.values()}
        for row in reader:
            for header, key in STAGE_KEY_FROM_HEADER.items():
                raw = row.get(header)
                if not raw:
                    continue
                name = re.sub(r"\s+", " ", raw).strip()
                if not name:
                    continue
                # Skip duplicates within the same stage.
                if name.lower() in seen[key]:
                    continue
                seen[key].add(name.lower())
                stages[key].append(name)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Envelope-preserving write (scripts/nvdm_write.py).
    write_artifact(OUT, stages)

    print(f"Wrote {OUT}")
    for key, items in stages.items():
        print(f"  {key}: {len(items)} areas")
    if "Cauvery Stage 1" not in cols:
        print(
            "WARNING: source CSV header changed - expected 'Cauvery Stage 1' column",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()

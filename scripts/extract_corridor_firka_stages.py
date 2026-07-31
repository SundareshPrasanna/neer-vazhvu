#!/usr/bin/env python3
"""Extract firka-level stage of extraction for the corridor from the TN state
report PDF annexure.

The IN-GRES-served data carries firka CLASSIFICATIONS but not firka stage
percentages (those are taluk-level in the served series from edition 2023
onward). The published state report PDF ("Dynamic Ground Water Resources of
Tamil Nadu, 2025", CGWB SECR + TN SG&SWRDC) carries the full firka annexure
including stage % and category. This script parses that annexure for the
corridor's firkas and writes a small provenance-carrying JSON that
build_corridor_sriperumbudur.py merges into the firka layer.

The PDF category doubles as a third publication of the classification: the
build script hard-fails if it disagrees with the API category for any firka.

Run after build_corridor_sriperumbudur.py (needs assessment-firkas.geojson
for the corridor firka roster), then re-run the build to merge:
  python3 scripts/extract_corridor_firka_stages.py
  python3 scripts/build_corridor_sriperumbudur.py
  python3 scripts/verify_corridor_assessment.py
"""

import json
import os
import re
import subprocess
import sys
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public/data/corridors/sriperumbudur")
CACHE = os.path.join(ROOT, ".cache/corridor-sriperumbudur")

PDF_URL = "https://cgwb.gov.in/cgwbpnm/public/uploads/documents/bulk/17781482536411file.pdf"
PDF_NAME = "dynamic-gw-tn-2025.pdf"
EDITION = "2025"

DISTRICTS = {"KANCHEEPURAM", "CHENGALPATTU", "TIRUVALLUR"}

# Annexure row shape (pdftotext -layout):
#   <n> TAMILNADU <DISTRICT> <FIRKA NAME...> FIRKA <17 numbers> <category>
ROW_RE = re.compile(
    r"^\s*\d+\s+TAMILNADU\s+(\S+)\s+(.+?)\s+FIRKA\s+(.+?)\s+([a-z_]+)\s*$"
)


def norm(name):
    return re.sub(r"[^A-Z0-9]", "", (name or "").upper())


def main():
    os.makedirs(CACHE, exist_ok=True)
    pdf_path = os.path.join(CACHE, PDF_NAME)
    if not os.path.exists(pdf_path):
        print("fetching state report PDF ...")
        urllib.request.urlretrieve(PDF_URL, pdf_path)
    txt_path = pdf_path + ".txt"
    if not os.path.exists(txt_path):
        subprocess.run(["pdftotext", "-layout", pdf_path, txt_path], check=True)

    rows = {}
    with open(txt_path, encoding="utf-8", errors="replace") as f:
        for line in f:
            m = ROW_RE.match(line)
            if not m:
                continue
            district, name, numbers, category = m.groups()
            if district.upper() not in DISTRICTS:
                continue
            nums = numbers.split()
            try:
                stage = float(nums[-1])
            except (ValueError, IndexError):
                continue
            key = (district.upper(), norm(name))
            if key in rows:
                sys.exit(f"AMBIGUOUS: duplicate firka row for {key}; refusing to guess.")
            rows[key] = {"district": district.title(), "firka": name.strip(),
                         "stage_pct": stage, "category": category}

    firkas = json.load(open(os.path.join(DATA, "assessment-firkas.geojson")))
    taluk_district = {}
    for dist, taluks in {
        "KANCHEEPURAM": ["SRIPERUMBUDUR", "KUNDRATHUR", "WALAJABAD", "KANCHEEPURAM", "UTHIRAMERUR"],
        "CHENGALPATTU": ["CHENGALPATTU", "TAMBARAM", "VANDALUR", "THIRUPPORUR",
                          "THIRUKKALUKUNDRAM", "PALLAVARAM", "CHEYYUR", "MADHURANTAKAM"],
        "TIRUVALLUR": ["AVADI", "POONAMALLEE", "GUMMUDIPOONDI", "TIRUTTANI", "PONNERI",
                        "PALLIPATTU", "RKPETTAI", "TIRUVALLUR", "UTHUKKOTTAI"],
    }.items():
        for t in taluks:
            taluk_district[t] = dist

    out, missing = {}, []
    for feat in firkas["features"]:
        p = feat["properties"]
        district = taluk_district.get(norm(p["taluk"]))
        row = rows.get((district, norm(p["firka"]))) if district else None
        if row is None:
            missing.append((p["firka"], p["taluk"]))
            continue
        out[p["uuid"]] = {**row, "taluk": p["taluk"]}

    if missing:
        sys.exit(f"UNMATCHED corridor firkas in the PDF annexure: {missing}")

    payload = {
        "_provenance": {
            "source": "Dynamic Ground Water Resources of Tamil Nadu, 2025 (CGWB SECR and TN SG&SWRDC), firka annexure",
            "source_url": PDF_URL,
            "edition": EDITION,
            "retrieved": date.today().isoformat(),
            "method": "scripts/extract_corridor_firka_stages.py (pdftotext -layout + fixed-shape row parse); stage_pct is the annexure's stage of extraction column",
            "note": "Single-publication value: the served IN-GRES series does not carry firka stage, so no second source exists for these percentages. Categories are independently cross-checked across publications.",
        },
        "edition": EDITION,
        "firkas_by_uuid": out,
    }
    with open(os.path.join(DATA, f"firka-stages-{EDITION}.json"), "w") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    print(f"extracted {len(out)} corridor firka stages; "
          f"range {min(v['stage_pct'] for v in out.values())}-{max(v['stage_pct'] for v in out.values())}%")


if __name__ == "__main__":
    main()

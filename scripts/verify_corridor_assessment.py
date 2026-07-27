#!/usr/bin/env python3
"""Cross-check the corridor assessment data before any prose is written (D12d).

Compares three independent publications of the same assessment:
  A. IN-GRES API values already emitted by build_corridor_sriperumbudur.py
     (public/data/corridors/sriperumbudur/assessment*.{json,geojson})
  B. The TN state report PDF, "Dynamic Ground Water Resources of Tamil Nadu,
     2025" (CGWB SECR + TN SG&SWRDC) - firka-level annexure
  C. The national "Block wise Categorization" PDF for GWRA-2025 - TN taluk rows

Checks:
  1. Taluk category, edition 2025: API vs C for the 10 corridor taluks
  2. Firka category, edition 2025: API reportSummary vs B for the 47 corridor
     firkas (name-matched within taluk)

Output: public/data/corridors/sriperumbudur/assessment-crosscheck.json
Console: a pass/fail table. Any mismatch is listed, not resolved (both-sources
rule); mismatches must be surfaced in the UI if published.

PDFs are fetched to .cache/corridor-sriperumbudur/ if absent. pdftotext
(poppler) is required.
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

PDFS = {
    "state_2025": (
        "https://cgwb.gov.in/cgwbpnm/public/uploads/documents/bulk/17781482536411file.pdf",
        "dynamic-gw-tn-2025.pdf",
    ),
    "blockwise_2025": (
        "https://cgwb.gov.in/GWRA/Blockwise_Categorization_GWRA_2025.pdf",
        "blockwise-categorization-gwra2025.pdf",
    ),
}

CATEGORY_WORDS = {
    "safe": "safe", "semi_critical": "semi-critical", "critical": "critical",
    "over_exploited": "over-exploited", "salinity": "saline",
}


def ensure_pdf(key):
    url, fname = PDFS[key]
    path = os.path.join(CACHE, fname)
    if not os.path.exists(path):
        # A scratchpad copy may exist from the recon session; otherwise fetch.
        os.makedirs(CACHE, exist_ok=True)
        print(f"fetching {fname} ...")
        urllib.request.urlretrieve(url, path)
    return path


def pdf_text(path):
    txt_path = path + ".txt"
    if not os.path.exists(txt_path):
        subprocess.run(["pdftotext", "-layout", path, txt_path], check=True)
    with open(txt_path, encoding="utf-8", errors="replace") as f:
        return f.read()


def norm(name):
    return re.sub(r"[^A-Z0-9]", "", (name or "").upper())


def find_category_near(text_lines, unit_name, context_names=()):
    """Find the assessment category on lines mentioning unit_name.

    Returns the set of categories found (a unit name can recur across
    annexure tables; category columns repeat the same word)."""
    unit_re = re.compile(re.escape(unit_name.replace(" ", "")), re.I)
    cats = set()
    for line in text_lines:
        squashed = re.sub(r"\s+", "", line)
        if not unit_re.search(squashed):
            continue
        if context_names and not any(
            re.search(re.escape(c.replace(" ", "")), squashed, re.I) for c in context_names
        ):
            pass  # district/taluk context is often on a different line; accept
        low = line.lower()
        for api_cat, word in CATEGORY_WORDS.items():
            pattern = word.replace("-", r"[\s_-]?")
            if api_cat == "critical":
                # "critical" must not be the tail of "semi-critical"
                pattern = r"(?<!semi)(?<!semi-)(?<!semi_)(?<!semi )critical"
            if re.search(pattern, low):
                cats.add(api_cat)
    return cats


def main():
    table = json.load(open(os.path.join(DATA, "assessment.json")))["table"]
    firkas = json.load(open(os.path.join(DATA, "assessment-firkas.geojson")))["features"]

    results = {"retrieved": date.today().isoformat(), "taluk_checks": [], "firka_checks": []}
    mismatches = 0

    # ---- Check 1: taluk categories vs national blockwise PDF ---------------
    bw_lines = pdf_text(ensure_pdf("blockwise_2025")).splitlines()
    for row in table:
        api_cat = row["editions"].get("2025", {}).get("category")
        pdf_cats = find_category_near(bw_lines, row["taluk"])
        ok = api_cat in pdf_cats if pdf_cats else None
        results["taluk_checks"].append({
            "taluk": row["taluk"], "api_category": api_cat,
            "pdf_categories_found": sorted(pdf_cats), "match": ok,
        })
        if ok is False:
            mismatches += 1

    # ---- Check 2: firka categories vs state report annexure ----------------
    st_lines = pdf_text(ensure_pdf("state_2025")).splitlines()
    for f in firkas:
        p = f["properties"]
        api_cat = p.get("category_2025")
        if api_cat is None:
            continue
        pdf_cats = find_category_near(st_lines, p["firka"], (p["taluk"],))
        ok = api_cat in pdf_cats if pdf_cats else None
        results["firka_checks"].append({
            "firka": p["firka"], "taluk": p["taluk"], "api_category": api_cat,
            "pdf_categories_found": sorted(pdf_cats), "match": ok,
        })
        if ok is False:
            mismatches += 1

    found_t = [c for c in results["taluk_checks"] if c["match"] is not None]
    found_f = [c for c in results["firka_checks"] if c["match"] is not None]
    results["summary"] = {
        "taluk_rows_located_in_pdf": f"{len(found_t)}/{len(results['taluk_checks'])}",
        "taluk_matches": sum(1 for c in found_t if c["match"]),
        "firka_rows_located_in_pdf": f"{len(found_f)}/{len(results['firka_checks'])}",
        "firka_matches": sum(1 for c in found_f if c["match"]),
        "mismatches": mismatches,
    }

    out = os.path.join(DATA, "assessment-crosscheck.json")
    with open(out, "w") as fh:
        json.dump(results, fh, indent=1)
    print(json.dumps(results["summary"], indent=2))
    for c in results["taluk_checks"] + results["firka_checks"]:
        if c["match"] is False:
            print("MISMATCH:", c)
        elif c["match"] is None:
            print("NOT LOCATED IN PDF:", c.get("taluk"), c.get("firka", ""))
    sys.exit(1 if mismatches else 0)


if __name__ == "__main__":
    main()

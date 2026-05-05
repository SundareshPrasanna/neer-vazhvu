#!/usr/bin/env python3
"""
CPCB NWMP Vaigai parser - Tier 1.E of the Madurai parity sequence.

CPCB publishes annual "Water Quality of River Data - {YEAR}" reports as
PDFs containing year-end summary tables: each row is one NWMP station,
columns include river name, station name, station code, and the
year's min / max / mean for DO, BOD, pH, conductivity, fecal coliform,
nitrate, etc.

Mirrors how Chennai's public/data/river-quality.json was hand-curated
from the same PDF series. This script automates the Vaigai cut.

Inputs:
    docs/cpcb/WQuality_River-Data-{YEAR}.pdf  (one per year, drop them in)

Output:
    public/data/river-quality-madurai.json  (overwrites readings array
    while preserving the seed station metadata)

Usage:
    cd neer-vazhvu-api
    python scripts/scrape_cpcb_nwmp_vaigai.py
    python scripts/scrape_cpcb_nwmp_vaigai.py --years 2022,2023,2024
    python scripts/scrape_cpcb_nwmp_vaigai.py --pdf-dir ../docs/cpcb

The PDFs are not committed to git (large + redistribution unclear). Drop
them locally; the script fail-softs with a friendly message if a year is
missing rather than aborting.
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

try:
    import pdfplumber
except ImportError:
    print(
        "pdfplumber not installed. Add it to requirements then:\n"
        "  pip install pdfplumber\n"
        "(or: pip install -r neer-vazhvu-api/requirements.txt)"
    )
    sys.exit(1)


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PDF_DIR = REPO_ROOT / "docs" / "cpcb"
OUTPUT_PATH = REPO_ROOT / "public" / "data" / "river-quality-madurai.json"

# Mapping CPCB station-name fragments to our seed station IDs in
# river-quality-madurai.json. CPCB uses inconsistent capitalization +
# punctuation across years, so we lowercase + substring-match.
STATION_ALIASES: dict[str, list[str]] = {
    "vaigai-dam":           ["vaigai dam", "vaigai reservoir", "andipatti dam"],
    "vaigai-andipatti":     ["andipatti", "andipatty"],  # excl. dam (handled above)
    "vaigai-sellur":        ["sellur", "k.k. nagar", "kalavasal"],
    "vaigai-anuppanadi":    ["anuppanadi", "anupanadi", "anuppankadi", "vilangudi"],
    "vaigai-manamadurai":   ["manamadurai", "mana madurai"],
    "vaigai-ramanathapuram": ["ramanathapuram", "ramnad"],
}

# Header tokens we look for to find the right table on a PDF page. CPCB
# annual reports have one mega-table; we scan tables on each page until
# we hit one whose first row contains these tokens.
EXPECTED_HEADERS = ["river", "station", "do", "bod"]


def parse_float(s: str | None) -> float | None:
    if s is None:
        return None
    t = s.strip()
    if not t or t in {"-", "--", "NA", "N/A", "ND", "BDL"}:
        return None
    # CPCB sometimes embeds "<0.5" or "<2"; treat as null (below detection).
    if t.startswith("<"):
        return None
    # Strip stray asterisks / footnote markers.
    t = re.sub(r"[*†#]", "", t).strip()
    try:
        return float(t)
    except ValueError:
        return None


def midpoint(min_s: str | None, max_s: str | None) -> float | None:
    """CPCB tables report min and max per parameter; we store the midpoint
    (matches how Chennai's river-quality.json was curated)."""
    lo = parse_float(min_s)
    hi = parse_float(max_s)
    if lo is None and hi is None:
        return None
    if lo is None:
        return hi
    if hi is None:
        return lo
    return round((lo + hi) / 2, 2)


def match_station_id(river_cell: str, station_cell: str) -> str | None:
    """Match a CPCB row to one of our seed station IDs."""
    river = (river_cell or "").lower()
    if "vaigai" not in river:
        return None
    name = (station_cell or "").lower()

    # vaigai-dam check first (the alias 'andipatti' would otherwise match dam too).
    if any(a in name for a in STATION_ALIASES["vaigai-dam"]):
        return "vaigai-dam"

    for sid, aliases in STATION_ALIASES.items():
        if sid == "vaigai-dam":
            continue
        if any(a in name for a in aliases):
            return sid
    return None


def find_column_indices(header: list[str]) -> dict[str, int] | None:
    """Map our parameter keys to (min_col, max_col) tuples in the table.

    CPCB tables are inconsistent: sometimes columns are 'DO Min'/'DO Max',
    sometimes a single 'DO' column with the value embedded. Returns None
    if we can't map confidently.
    """
    norm = [(c or "").strip().lower() for c in header]

    def find(needle: str, prefix: str | None = None) -> int | None:
        for i, c in enumerate(norm):
            if needle in c and (prefix is None or prefix in c):
                return i
        return None

    river_idx = find("river")
    station_idx = find("station") or find("location")
    if river_idx is None or station_idx is None:
        return None

    # We accept the header even if some metric columns are missing; the
    # downstream parser fills nulls when a column is absent.
    return {
        "river_idx": river_idx,
        "station_idx": station_idx,
        # Pairs (min, max) for each metric. Either side may be None.
        "do_min": find("do min") or find("do (min)"),
        "do_max": find("do max") or find("do (max)"),
        "bod_min": find("bod min") or find("bod (min)"),
        "bod_max": find("bod max") or find("bod (max)"),
        "ph_min": find("ph min") or find("ph (min)"),
        "ph_max": find("ph max") or find("ph (max)"),
        "cond_min": find("conductivity min") or find("cond min"),
        "cond_max": find("conductivity max") or find("cond max"),
        "fc_min": find("fecal coli") or find("f. coli"),
        "fc_max": find("fecal coli max") or find("f. coli max"),
        "nitrate_min": find("nitrate min") or find("nitrate (min)"),
        "nitrate_max": find("nitrate max") or find("nitrate (max)"),
    }


def extract_year_readings(pdf_path: Path, year: int) -> dict[str, dict[str, Any]]:
    """Walk every table on every page; return {station_id -> reading}."""
    out: dict[str, dict[str, Any]] = {}
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                if not table or len(table) < 2:
                    continue
                header = table[0]
                if not all(any(t in (c or "").lower() for c in header) for t in EXPECTED_HEADERS):
                    continue
                cols = find_column_indices(header)
                if cols is None:
                    continue
                for row in table[1:]:
                    if not row or len(row) <= max(cols["river_idx"], cols["station_idx"]):
                        continue
                    sid = match_station_id(row[cols["river_idx"]], row[cols["station_idx"]])
                    if not sid:
                        continue

                    def cell(key: str) -> str | None:
                        idx = cols.get(key)
                        if idx is None or idx >= len(row):
                            return None
                        return row[idx]

                    out[sid] = {
                        "year": year,
                        "do_mgl":            midpoint(cell("do_min"), cell("do_max")),
                        "bod_mgl":           midpoint(cell("bod_min"), cell("bod_max")),
                        "ph":                midpoint(cell("ph_min"), cell("ph_max")),
                        "conductivity_us":   midpoint(cell("cond_min"), cell("cond_max")),
                        "cod_mgl":           None,  # not in CPCB river-data PDFs
                        "fecal_coliform_mpn": midpoint(cell("fc_min"), cell("fc_max")),
                        "tds_mgl":           None,
                        "nitrate_mgl":       midpoint(cell("nitrate_min"), cell("nitrate_max")),
                        "chromium_mgl":      None,
                        "lead_mgl":          None,
                        "cadmium_mgl":       None,
                    }
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", default="2020,2021,2022,2023,2024",
                        help="Comma-separated years to ingest")
    parser.add_argument("--pdf-dir", default=str(DEFAULT_PDF_DIR),
                        help=f"Directory holding WQuality_River-Data-YYYY.pdf files (default: {DEFAULT_PDF_DIR})")
    parser.add_argument("--output", default=str(OUTPUT_PATH))
    args = parser.parse_args()

    pdf_dir = Path(args.pdf_dir)
    years = [int(y) for y in args.years.split(",")]

    if not OUTPUT_PATH.exists():
        print(f"Seed file missing: {OUTPUT_PATH}\nRe-create it from the Tier 1.E commit before running.")
        return 1

    seed = json.loads(OUTPUT_PATH.read_text())
    river = seed["rivers"][0]
    by_id = {s["id"]: s for s in river["stations"]}

    # Reset readings (idempotent run).
    for s in by_id.values():
        s["readings"] = []

    captured_years: list[int] = []
    for year in years:
        pdf_path = pdf_dir / f"WQuality_River-Data-{year}.pdf"
        if not pdf_path.exists():
            print(f"  - missing  {pdf_path.name} (skipping)")
            continue
        print(f"  + parsing  {pdf_path.name}")
        readings = extract_year_readings(pdf_path, year)
        if not readings:
            print(f"      no Vaigai rows matched - check STATION_ALIASES if this is unexpected")
            continue
        for sid, reading in readings.items():
            by_id[sid]["readings"].append(reading)
        captured_years.append(year)
        print(f"      matched {len(readings)} stations: {sorted(readings.keys())}")

    if not captured_years:
        print("\nNo CPCB PDFs found. Drop them in docs/cpcb/ and re-run.")
        print("Output JSON left with empty readings (still valid for the rivers page).")
        return 0

    # Sort each station's readings by year ascending.
    for s in by_id.values():
        s["readings"].sort(key=lambda r: r["year"])

    seed["last_updated"] = max(captured_years)
    seed["data_year_range"] = [min(captured_years), max(captured_years)]

    Path(args.output).write_text(json.dumps(seed, indent=2, ensure_ascii=False))
    print(f"\nWrote {args.output}")
    print(f"  Years covered: {captured_years}")
    counts = {sid: len(s["readings"]) for sid, s in by_id.items()}
    for sid, n in counts.items():
        print(f"  {sid}: {n} annual readings")
    return 0


if __name__ == "__main__":
    sys.exit(main())

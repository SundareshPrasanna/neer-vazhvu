#!/usr/bin/env python3
"""
CPCB NWMP Vaigai parser - Tier 1.E of the Madurai parity sequence.

CPCB publishes annual "Water Quality of River Data - {YEAR}" reports as
PDFs containing one mega-table with rows like:

  10059  RIVER VAIGAI AT MADURAI U/S  TAMIL NADU  Tmin Tmax  DO_min DO_max  pH_min pH_max  Cond_min Cond_max  BOD_min BOD_max  N_min N_max  FC_min FC_max  TC_min TC_max  ...

Vaigai has only TWO NWMP stations (verified across 2021-2024):
  10059 = RIVER VAIGAI AT MADURAI U/S
  10060 = RIVER VAIGAI AT MADURAI D/S

This script reads the PDFs in docs/cpcb/, finds rows whose station name
contains "VAIGAI", parses min/max into midpoints, and writes the results
to public/data/river-quality-madurai.json (overwriting the readings
arrays; preserving the seed metadata).

Inputs:
    docs/cpcb/WQuality_River-Data-{YEAR}.pdf

Output:
    public/data/river-quality-madurai.json

Usage:
    cd neer-vazhvu-api
    python scripts/scrape_cpcb_nwmp_vaigai.py
    python scripts/scrape_cpcb_nwmp_vaigai.py --years 2022,2023,2024

Drop CPCB PDFs in docs/cpcb/ first; the script fail-softs if a year is
missing.
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
        "pdfplumber not installed.\n"
        "  pip install pdfplumber\n"
        "(or: pip install -e neer-vazhvu-api[cpcb])"
    )
    sys.exit(1)


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PDF_DIR = REPO_ROOT / "docs" / "cpcb"
OUTPUT_PATH = REPO_ROOT / "public" / "data" / "river-quality-madurai.json"


# ── row matching ─────────────────────────────────────────────────────

# CPCB station name -> our seed station id. CPCB publishes "U/S" + "D/S"
# only for Madurai (no readings for Vaigai dam, Andipatti, Manamadurai,
# Ramanathapuram - those aren't on the National Water Monitoring Network
# at present).
def match_station_id(text: str) -> str | None:
    t = text.upper()
    if "VAIGAI" not in t:
        return None
    if "U/S" in t or "U / S" in t or "UPSTREAM" in t:
        return "vaigai-sellur"  # Madurai U/S anchor
    if "D/S" in t or "D / S" in t or "DOWNSTREAM" in t:
        return "vaigai-anuppanadi"  # Madurai D/S anchor
    return None


# ── value parsing ────────────────────────────────────────────────────

NUM_RE = re.compile(r"-?\d+(?:\.\d+)?")


def parse_float(s: str | None) -> float | None:
    if s is None:
        return None
    t = s.strip()
    if not t or t.upper() in {"-", "--", "NA", "N/A", "ND", "BDL"}:
        return None
    if t.startswith("<"):
        return None
    t = re.sub(r"[*†#,]", "", t).strip()
    try:
        return float(t)
    except ValueError:
        return None


def midpoint(min_s: Any, max_s: Any) -> float | None:
    lo = parse_float(min_s if isinstance(min_s, str) else (str(min_s) if min_s is not None else None))
    hi = parse_float(max_s if isinstance(max_s, str) else (str(max_s) if max_s is not None else None))
    if lo is None and hi is None:
        return None
    if lo is None:
        return round(hi, 2) if hi is not None else None
    if hi is None:
        return round(lo, 2)
    return round((lo + hi) / 2, 2)


# ── extraction strategies ────────────────────────────────────────────

def parse_vaigai_from_line(line: str) -> dict | None:
    """Parse a CPCB row when extract_tables fails / returns garbage.

    Format observed for 2023 + 2024:
      10059 RIVER VAIGAI AT MADURAI U/S TAMIL NADU 25 31 5.2 7.1 6.0 8.7 299 934 1.0 5.0 0.32 1.03 5 27 19 49

    Column order (after STATE column): Temp_min Temp_max DO_min DO_max
    pH_min pH_max Cond_min Cond_max BOD_min BOD_max Nitrate_min Nitrate_max
    FC_min FC_max TC_min TC_max [FStrep_min FStrep_max]
    """
    sid = match_station_id(line)
    if not sid:
        return None
    # Strip the prose part: everything before the State name. State
    # always ends with "TAMIL NADU" (uppercase). Take everything after.
    m = re.search(r"TAMIL\s+NADU\s+(.*)$", line, re.I)
    if not m:
        return None
    nums = NUM_RE.findall(m.group(1))
    if len(nums) < 12:
        return None  # not enough columns

    # Map by index. Some PDFs omit the trailing fecal-streptococci pair.
    def pair(i: int) -> tuple[str | None, str | None]:
        if i + 1 >= len(nums):
            return None, None
        return nums[i], nums[i + 1]

    do_lo, do_hi = pair(2)
    ph_lo, ph_hi = pair(4)
    cond_lo, cond_hi = pair(6)
    bod_lo, bod_hi = pair(8)
    nit_lo, nit_hi = pair(10)
    fc_lo, fc_hi = pair(12) if len(nums) >= 14 else (None, None)

    return {
        "station_id": sid,
        "do_mgl": midpoint(do_lo, do_hi),
        "bod_mgl": midpoint(bod_lo, bod_hi),
        "ph": midpoint(ph_lo, ph_hi),
        "conductivity_us": midpoint(cond_lo, cond_hi),
        "cod_mgl": None,
        "fecal_coliform_mpn": midpoint(fc_lo, fc_hi),
        "tds_mgl": None,
        "nitrate_mgl": midpoint(nit_lo, nit_hi),
        "chromium_mgl": None,
        "lead_mgl": None,
        "cadmium_mgl": None,
    }


def stitch_wrapped_lines(text: str) -> list[str]:
    """CPCB sometimes wraps long rows across two lines:

      10004 RIVER VAIGAI AT
      MADURAI U/S TAMIL NADU 25 31 ...

    Stitch a line into the next if it lacks the trailing TAMIL NADU
    state marker AND its successor doesn't start with a station code.
    """
    lines = [ln.rstrip() for ln in text.split("\n")]
    out: list[str] = []
    i = 0
    while i < len(lines):
        cur = lines[i]
        if cur and "VAIGAI" in cur.upper() and "TAMIL NADU" not in cur.upper():
            # Try stitching forward.
            for j in (i + 1, i + 2):
                if j < len(lines) and "TAMIL NADU" in lines[j].upper():
                    cur = " ".join([cur] + lines[i + 1 : j + 1])
                    i = j
                    break
        out.append(cur)
        i += 1
    return out


CPCB_VAIGAI_CODE_TO_SID = {
    "10059": "vaigai-sellur",       # Madurai U/S
    "10060": "vaigai-anuppanadi",   # Madurai D/S
}


def parse_code_anchored_row(code: str, line: str) -> dict | None:
    """Parse a line that begins with a CPCB station code (e.g. 10059 or
    10060) and contains the numeric Min/Max columns inline. Used for
    2021-2022 PDFs where the row name and code/numbers fall on
    different lines.

    Format observed:
      10059 25.0 27.0 5.1 6.5 ...     (2021: code first, no state)
      10059 TAMIL NADU 28 29 5.2 ...  (2022: code, state, then numbers)
    """
    rest = line.strip()
    if not rest.startswith(code):
        return None
    rest = rest[len(code):]
    # Strip any leading state name like "TAMIL NADU".
    rest = re.sub(r"^[A-Z\s]{3,}?(?=\d)", "", rest, count=1).strip()
    nums = NUM_RE.findall(rest)
    # Same column order as the line-text parser.
    if len(nums) < 12:
        return None

    def pair(i: int) -> tuple[str | None, str | None]:
        if i + 1 >= len(nums):
            return None, None
        return nums[i], nums[i + 1]

    do_lo, do_hi = pair(2)
    ph_lo, ph_hi = pair(4)
    cond_lo, cond_hi = pair(6)
    bod_lo, bod_hi = pair(8)
    nit_lo, nit_hi = pair(10)
    fc_lo, fc_hi = pair(12) if len(nums) >= 14 else (None, None)

    return {
        "do_mgl": midpoint(do_lo, do_hi),
        "bod_mgl": midpoint(bod_lo, bod_hi),
        "ph": midpoint(ph_lo, ph_hi),
        "conductivity_us": midpoint(cond_lo, cond_hi),
        "cod_mgl": None,
        "fecal_coliform_mpn": midpoint(fc_lo, fc_hi),
        "tds_mgl": None,
        "nitrate_mgl": midpoint(nit_lo, nit_hi),
        "chromium_mgl": None,
        "lead_mgl": None,
        "cadmium_mgl": None,
    }


def extract_year_readings(pdf_path: Path, year: int) -> dict[str, dict]:
    """Return {station_id -> reading-dict-with-year} for the year.

    Two passes: the canonical line parser first (works for 2023+), then
    a code-anchored fallback that scans for "10059 ..." and "10060 ..."
    lines (works for 2021/2022 PDFs where the row label and data sit
    on different physical lines).
    """
    out: dict[str, dict] = {}
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if "VAIGAI" not in text.upper():
                continue

            # Pass 1: canonical single-line rows
            for line in stitch_wrapped_lines(text):
                rec = parse_vaigai_from_line(line)
                if rec is None:
                    continue
                sid = rec.pop("station_id")
                rec["year"] = year
                out[sid] = rec

            # Pass 2: code-anchored fallback. Only apply if Vaigai is
            # mentioned anywhere on the page (rules out collisions where
            # codes 10059/10060 might appear on unrelated pages).
            if "VAIGAI" in text.upper():
                for raw_line in text.split("\n"):
                    line = raw_line.strip()
                    for code, sid in CPCB_VAIGAI_CODE_TO_SID.items():
                        if sid in out:
                            continue  # already captured by pass 1
                        rec = parse_code_anchored_row(code, line)
                        if rec is None:
                            continue
                        rec["year"] = year
                        out[sid] = rec
    return out


# ── main ─────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", default="2020,2021,2022,2023,2024")
    parser.add_argument("--pdf-dir", default=str(DEFAULT_PDF_DIR))
    parser.add_argument("--output", default=str(OUTPUT_PATH))
    args = parser.parse_args()

    pdf_dir = Path(args.pdf_dir)
    years = [int(y) for y in args.years.split(",")]

    if not OUTPUT_PATH.exists():
        print(f"Seed file missing: {OUTPUT_PATH}\nRe-create from the Tier 1.E commit before running.")
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
        records = extract_year_readings(pdf_path, year)
        if not records:
            print(f"      no Vaigai rows matched - check station-name regex if unexpected")
            continue
        for sid, rec in records.items():
            if sid not in by_id:
                continue
            by_id[sid]["readings"].append(rec)
        print(f"      matched {len(records)} stations: {sorted(records.keys())}")
        captured_years.append(year)

    if not captured_years:
        print("\nNo CPCB PDFs produced rows. Check docs/cpcb/ contents.")
        return 0

    for s in by_id.values():
        s["readings"].sort(key=lambda r: r["year"])

    seed["last_updated"] = str(max(captured_years))
    seed["data_year_range"] = [min(captured_years), max(captured_years)]

    Path(args.output).write_text(json.dumps(seed, indent=2, ensure_ascii=False))
    print(f"\nWrote {args.output}")
    print(f"  Years covered: {captured_years}")
    counts = {sid: len(s["readings"]) for sid, s in by_id.items()}
    for sid, n in counts.items():
        marker = "  " if n == 0 else "✓ "
        print(f"  {marker}{sid}: {n} annual readings")
    return 0


if __name__ == "__main__":
    sys.exit(main())

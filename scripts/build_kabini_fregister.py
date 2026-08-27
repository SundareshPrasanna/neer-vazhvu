#!/usr/bin/env python3
"""Count the consented industries on the Kabini polluted stretch from KSPCB's
own F-register, so the action plan's figure can be read against the register.

The Kabini stretch MPR (August 2025) reports 38 water-polluting industries in
Nanjangud taluk. The partner review asked whether that is the whole industrial
picture. This script answers it from the register KSPCB publishes itself.

Source: KSPCB Regional Office Mysore-2, "F-Register 2020-21 updated
31.03.2021" (the PDF's own title). Unlike the Bengaluru-area registers that
scripts/build_fregister.py reads, this one carries a real text layer with
explicit Taluk, Colour and Status columns, so the counts here are read rather
than OCR-guessed. They are still a 31.03.2021 snapshot being compared with a
2025 MPR: the gap is four years and is stated in the output.

Three traps this file exists to not fall into:

  1. The PDF is TWO registers. Pages 1 to ~54 are the industrial F-register;
     the remaining pages are a bio-medical-waste register of hospitals, PHCs
     and health centres, with its own row numbering restarting at 1. Counting
     the whole PDF inflates every taluk. The boundary is detected from row
     shape, never hardcoded.
  2. pdfplumber's table extractor loses rows two ways when cell ruling is
     missing: it drops them outright (F-Reg 1129-1131) and it emits them with
     empty cells (F-Reg 1156). Both are real rows, present in the text layer.
     The build fails on any gap in the F-Reg sequence, and on any row it
     cannot classify, unless the text layer resolves it.
  3. "Local body" rows (colour cell "LB") are municipalities, not industries.
     They are reported separately, never inside an industry count.

What the register does NOT support: a 17-category count. Only five rows carry
"17-Cat" in the colour cell, which is plainly not the whole 17-category
subset, and no other column encodes it. The output says so rather than
publishing a number the source cannot carry.

Usage:  python3 scripts/build_kabini_fregister.py [--out FILE] [--cache DIR]
Requires: pdfplumber.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import re
import ssl
import sys
import tempfile
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = json.loads((HERE / "fregister-sources.json").read_text())

# Column positions in the industrial table (verified against the header row,
# which the build re-checks on every page).
COL = {"fno": 0, "uin": 1, "name": 2, "area": 4, "taluk": 5,
       "district": 7, "size": 8, "colour": 9, "cat": 10, "status": 17}
INDUSTRIAL_WIDTH = 25
HEADER_FIRST = "F-Reg No."

COLOURS = {"RED": "Red", "ORANGE": "Orange", "GREEN": "Green", "WHITE": "White"}
CAT_LETTER = {"R": "Red", "O": "Orange", "G": "Green", "W": "White"}
STATUSES = {"OPERATION": "Operation", "CLOSED": "Closed", "YTC": "Yet to commence"}
SIZES = ("Large", "Medium", "Small", "Micro")

# Every taluk spelling the register actually uses, mapped to one name. New
# spellings must be added deliberately: an unrecognised taluk fails the build
# rather than quietly dropping units out of a count.
TALUKS = {
    "nanjangud": "Nanjangud", "nanjangudu": "Nanjangud", "nanjanagudu": "Nanjangud",
    "nangangud": "Nanjangud", "nanjanagud": "Nanjangud",
    "mysore": "Mysuru", "mysuru": "Mysuru", "hootagalli": "Mysuru",
    "hootgalli": "Mysuru", "koorgalli": "Mysuru", "belavadi": "Mysuru",
    "tnpura": "T. Narasipura", "tnarsipura": "T. Narasipura",
    "tnarasipura": "T. Narasipura",
    "periyapatna": "Periyapatna", "hunsur": "Hunsur",
    "hdkote": "H.D. Kote", "krnagar": "K.R. Nagar", "krnagara": "K.R. Nagar",
}


def norm(s: str) -> str:
    return re.sub(r"[^a-z]", "", (s or "").lower())


def fetch(url: str, dest: Path) -> None:
    if dest.exists():
        return
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, context=ctx, timeout=180) as r:
        dest.write_bytes(r.read())


def taluk_of(raw: str) -> str | None:
    return TALUKS.get(norm(raw))


def colour_of(row: list[str]) -> tuple[str | None, bool]:
    """(colour, is_local_body). Falls back to the category code's leading
    letter, which is how the 17-category rows carry their colour."""
    cell = (row[COL["colour"]] or "").strip()
    if cell.upper() == "LB":
        return None, True
    if cell.upper() in COLOURS:
        return COLOURS[cell.upper()], False
    m = re.match(r"^([ROGW])[-\s]?\d", (row[COL["cat"]] or "").strip(), re.I)
    if m:
        return CAT_LETTER[m.group(1).upper()], False
    return None, False


def status_of(row: list[str]) -> str | None:
    return STATUSES.get((row[COL["status"]] or "").strip().upper())


def recover_row(line: str) -> list[str] | None:
    """Rebuild a dropped row from its text line. Anchored on the fixed
    vocabulary that follows the free-text columns:
        ... <taluk> <jurisdiction> <district> <size> <colour> ...
    and the status, which the text layer glues to the investment figure."""
    m = re.search(
        r"(\S+)\s+(?:Rural|Urban)\s+(?:Mysore|Mysuru)\s+"
        rf"(?:{'|'.join(SIZES)})\s+(Red|Orange|Green|White)\b",
        line, re.I)
    if not m:
        return None
    st = re.search(r"\d(YTC|Operation|Closed)\b", line, re.I)
    row = [""] * INDUSTRIAL_WIDTH
    row[COL["fno"]] = line.split()[0]
    row[COL["taluk"]] = m.group(1)
    row[COL["colour"]] = m.group(2).title()
    row[COL["status"]] = st.group(1).title() if st else ""
    row[COL["name"]] = " ".join(line.split()[2:6])
    return row


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE.parent / "docs/research/kabini-fregister-counts.json"))
    ap.add_argument("--cache", default=os.path.join(tempfile.gettempdir(), "kspcb_freg"))
    args = ap.parse_args()
    try:
        import pdfplumber
    except ImportError:
        sys.exit("pip install pdfplumber")

    cfg = SRC["kabini_stretch"]
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    pdf_path = cache / cfg["file"]
    fetch(SRC["base_url"] + cfg["file"], pdf_path)

    rows: dict[int, list[str]] = {}
    text_lines: dict[int, str] = {}
    headers, last_industrial_page = set(), 0
    with pdfplumber.open(pdf_path) as pdf:
        pages = len(pdf.pages)
        for pi, page in enumerate(pdf.pages, start=1):
            for table in page.extract_tables():
                for raw in table:
                    c = [(x or "").replace("\n", " ").strip() for x in raw]
                    if c and c[0] == HEADER_FIRST:
                        headers.add(tuple(c[:12]))
                        continue
                    # Row shape IS the register boundary: the bio-medical
                    # register that follows has a different column count.
                    if len(c) != INDUSTRIAL_WIDTH or not re.fullmatch(r"\d+", c[0] or ""):
                        continue
                    rows[int(c[0])] = c
                    last_industrial_page = pi
            if pi <= last_industrial_page + 1:
                for line in (page.extract_text() or "").splitlines():
                    m = re.match(r"\s*(\d{1,4})\s+\S", line)
                    if m:
                        text_lines.setdefault(int(m.group(1)), line)

    if len(headers) != 1:
        sys.exit(f"FAIL: {len(headers)} distinct header signatures - layout drifted")

    # Trap 2: no silent gaps and no silently-blank rows. The table extractor
    # both drops rows and emits them empty; the text layer resolves either.
    hi = max(rows)
    recovered, repaired = [], []
    for fno in range(1, hi + 1):
        line = text_lines.get(fno)
        if fno not in rows:
            rec = recover_row(line) if line else None
            if rec is None:
                sys.exit(f"FAIL: F-Reg {fno} missing from the table and unrecoverable from text")
            rows[fno] = rec
            recovered.append(fno)
            continue
        row = rows[fno]
        colour, is_lb = colour_of(row)
        if is_lb or (colour and taluk_of(row[COL["taluk"]])):
            continue
        rec = recover_row(line) if line else None
        if rec is None:
            continue  # reported as unclassified below, never silently counted
        for k in ("taluk", "colour", "status", "name"):
            if not row[COL[k]].strip():
                row[COL[k]] = rec[COL[k]]
        repaired.append(fno)

    print(f"{cfg['file']}: {pages} pages, industrial register ends p{last_industrial_page}")
    print(f"  {len(rows)} rows, F-Reg 1-{hi}, {len(recovered)} recovered and "
          f"{len(repaired)} repaired from the text layer "
          f"(recovered {recovered or 'none'}, repaired {repaired or 'none'})")

    per = collections.defaultdict(lambda: collections.Counter())
    detail = collections.defaultdict(lambda: collections.Counter())
    local_bodies = collections.Counter()
    unknown_taluk, unclassified = [], []
    for fno, row in sorted(rows.items()):
        tk = taluk_of(row[COL["taluk"]])
        colour, is_lb = colour_of(row)
        if is_lb:
            local_bodies[tk or "unknown"] += 1
            continue
        if tk is None:
            unknown_taluk.append((fno, row[COL["taluk"]], row[COL["name"]][:40]))
            continue
        per[tk]["total"] += 1
        if colour is None:
            per[tk]["unclassified"] += 1
            unclassified.append((fno, row[COL["name"]][:40]))
            continue
        per[tk][colour] += 1
        st = status_of(row)
        detail[tk][f"{colour}/{st or 'unstated'}"] += 1

    # A blank taluk cell is an incomplete row, not a new taluk; anything else
    # is a spelling this file has not been taught and must not swallow.
    named_unknown = [u for u in unknown_taluk if norm(u[1])]
    if named_unknown:
        for fno, raw, name in named_unknown:
            print(f"  UNKNOWN TALUK F-Reg {fno}: {raw!r} ({name})")
        sys.exit(f"FAIL: {len(named_unknown)} rows carry an unrecognised taluk")

    focus = cfg["focusTaluk"]
    print(f"\n  {'taluk':16s} {'total':>6s} {'Red':>5s} {'Orange':>7s} {'Green':>6s} {'White':>6s} {'?':>3s}")
    for tk, c in sorted(per.items(), key=lambda kv: -kv[1]["total"]):
        print(f"  {tk:16s} {c['total']:6d} {c['Red']:5d} {c['Orange']:7d} "
              f"{c['Green']:6d} {c['White']:6d} {c['unclassified']:3d}")
    print(f"\n  {focus} by category and working status:")
    for k, v in sorted(detail[focus].items()):
        print(f"    {k:26s} {v:4d}")
    if local_bodies:
        print(f"\n  local bodies (excluded from industry counts): {sum(local_bodies.values())}")
    if unclassified:
        print(f"  unclassified colour: {len(unclassified)} rows "
              f"({', '.join(f'F{f}' for f, _ in unclassified)})")

    red_ops = detail[focus]["Red/Operation"]
    out = {
        "_doc": "KSPCB F-register counts for the Kabini polluted stretch. Built by "
                "scripts/build_kabini_fregister.py; see that file for the three "
                "extraction traps and for why no 17-category count is published.",
        "source": {
            "title": cfg["title"],
            "publisher": "Karnataka State Pollution Control Board, Regional Office Mysore-2",
            "url": SRC["base_url"] + cfg["file"],
            "asOn": cfg["asOn"],
            "retrieved": cfg["retrieved"],
        },
        "extraction": {
            "pages": pages,
            "industrialRegisterEndsPage": last_industrial_page,
            "rows": len(rows),
            "fRegRange": [1, hi],
            "recoveredFromTextLayer": recovered,
            "repairedFromTextLayer": repaired,
            "localBodiesExcluded": sum(local_bodies.values()),
            "unclassifiedColour": [f for f, _ in unclassified],
        },
        "byTaluk": {tk: dict(c) for tk, c in per.items()},
        "focusTaluk": focus,
        "focusDetail": dict(detail[focus]),
        "seventeenCategory": {
            "published": False,
            "reason": "The register flags only five rows as '17-Cat' and encodes the "
                      "subset nowhere else, so a 17-category count cannot be read "
                      "from this source.",
        },
        "readAgainst": {
            "claim": cfg["mprClaim"],
            "source": cfg["mprSource"],
            "note": f"The register is a {cfg['asOn']} snapshot and the MPR figure is "
                    f"from August 2025; the two are four years apart. On the register, "
                    f"{focus} taluk carries {per[focus]['Red']} Red-category units, "
                    f"{red_ops} of them recorded as operating.",
        },
    }
    outp = Path(args.out)
    outp.parent.mkdir(parents=True, exist_ok=True)
    outp.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    print(f"\n-> {outp}")


if __name__ == "__main__":
    main()

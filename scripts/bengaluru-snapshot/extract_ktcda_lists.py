"""Extract the four KTCDA custody lists (PDF) into one CSV.

Source PDFs: docs/research/bengaluru-lakes/sources/ktcda-*.pdf, supplied 3 Sep 2026
(KTCDA "List of Lakes in Bengaluru"; site page returned HTTP 500 when checked, so
the URL is recorded as presumed until confirmed). See sources/README.md.

Parsing: `pdftotext -bbox-layout` gives every word with its bounding box. Per page,
the header phrases ("Sl No", "Ward", "Assembly Constituency" or "Taluk", "Name of
Lake") are located geometrically (same baseline, adjacent x) and define column
bands with boundaries midway between adjacent phrases. Column 0 holds only the
leading integer of a line; any other word left of the first boundary belongs to
column 1 (ward text starts left of the centred header). Words are binned into
lines by y and lines into rows: a line with a serial anchors a row; lines without
one are wrapped fragments and attach to the nearest anchor whose cell in that
column is still empty. The numeric column-number row and the legacy-encoded
Kannada footnotes are skipped.

Output: docs/research/bengaluru-lakes/data/ktcda-custody-lists.csv
"""
from __future__ import annotations

import csv
import re
import subprocess
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs/research/bengaluru-lakes/sources"
OUT = ROOT / "docs/research/bengaluru-lakes/data/ktcda-custody-lists.csv"

LISTS = [
    ("ktcda-bbmp-lakes.pdf", "BBMP", [["Sl", "No"], ["Ward"], ["Assembly", "Constituency"], ["Name", "of", "Lake"]]),
    ("ktcda-bda-lakes.pdf", "BDA", [["Sl", "No"], ["Taluk"], ["Name", "of", "Lake"]]),
    ("ktcda-forest-lakes.pdf", "Forest Department", [["Sl", "No"], ["Taluk"], ["Name", "of", "Lake"]]),
    ("ktcda-bmrcl-lakes.pdf", "BMRCL", [["Sl", "No"], ["Taluk"], ["Name", "of", "Lake"]]),
]
XW = "{http://www.w3.org/1999/xhtml}word"
XP = "{http://www.w3.org/1999/xhtml}page"


def words_by_page(path: Path):
    xml = subprocess.run(["pdftotext", "-bbox-layout", str(path), "-"], capture_output=True, text=True, check=True).stdout
    xml = re.sub(r"<!DOCTYPE[^>]*>", "", xml)
    root = ET.fromstring(xml)
    pages = []
    for page in root.iter(XP):
        ws = []
        for w in page.iter(XW):
            t = (w.text or "").strip()
            if t:
                ws.append(dict(t=t, x0=float(w.get("xMin")), x1=float(w.get("xMax")), y0=float(w.get("yMin")), y1=float(w.get("yMax"))))
        pages.append(ws)
    return pages


def ascii_share(s: str) -> float:
    return sum(1 for c in s if c.isascii()) / len(s) if s else 1.0


def find_header(ws, headers):
    """Locate each header phrase geometrically; return [(x0, x1, y0)] or None."""
    spans = []
    for phrase in headers:
        found = None
        for w in ws:
            if w["t"] != phrase[0]:
                continue
            x1, y, ok = w["x1"], w["y0"], True
            for tok in phrase[1:]:
                nxt = [v for v in ws if v["t"] == tok and abs(v["y0"] - y) <= 3 and 0 <= v["x0"] - x1 <= 12]
                if not nxt:
                    ok = False
                    break
                x1 = min(nxt, key=lambda v: v["x0"])["x1"]
            if ok:
                found = (w["x0"], x1, y)
                break
        if not found:
            return None
        spans.append(found)
    return spans


def parse_page(ws, headers):
    spans = find_header(ws, headers)
    if not spans:
        return [], "no header"
    header_y = spans[0][2]
    bounds = [(spans[k][1] + spans[k + 1][0]) / 2 for k in range(len(spans) - 1)]
    ncol = len(spans)

    def col_of(x):
        for k, b in enumerate(bounds):
            if x < b:
                return k
        return len(bounds)

    body = [w for w in ws if w["y0"] > header_y + 4 and ascii_share(w["t"]) >= 0.8]
    body.sort(key=lambda w: (w["y0"], w["x0"]))
    lines = []
    for w in body:
        if lines and abs(w["y0"] - lines[-1]["y"]) <= 3:
            lines[-1]["words"].append(w)
        else:
            lines.append(dict(y=w["y0"], words=[w]))
    line_h = 11.0
    parsed = []
    for ln in lines:
        words = sorted(ln["words"], key=lambda w: w["x0"])
        cells = [[] for _ in range(ncol)]
        serial = None
        for i, w in enumerate(words):
            k = col_of(w["x0"])
            if k == 0:
                if i == 0 and re.fullmatch(r"\d{1,3}", w["t"]):
                    serial = int(w["t"])
                    continue
                k = 1  # non-serial text in the serial band belongs to the next column
            cells[k].append(w["t"])
        cells = [" ".join(c) for c in cells]
        parsed.append(dict(y=ln["y"], cells=cells, serial=serial))
    # numeric column-number row: serial present and every other cell a bare integer
    parsed = [p for p in parsed if not (p["serial"] is not None and all(re.fullmatch(r"\d+", c.strip()) for c in p["cells"][1:] if c.strip()) and any(c.strip() for c in p["cells"][1:]))]
    anchors = [i for i, p in enumerate(parsed) if p["serial"] is not None]
    rows = {i: [str(parsed[i]["serial"])] + [c.strip() for c in parsed[i]["cells"][1:]] for i in anchors}
    for i, p in enumerate(parsed):
        if p["serial"] is not None:
            continue
        near = sorted([a for a in anchors if abs(parsed[a]["y"] - p["y"]) <= 2.6 * line_h], key=lambda a: abs(parsed[a]["y"] - p["y"]))
        if not near:
            continue
        target = next((a for a in near if all(not rows[a][k] for k in range(1, ncol) if p["cells"][k].strip())), near[0])
        for k in range(1, ncol):
            frag = p["cells"][k].strip()
            if frag:
                rows[target][k] = (rows[target][k] + " " + frag).strip() if parsed[target]["y"] < p["y"] else (frag + " " + rows[target][k]).strip()
    return [rows[a] for a in anchors], f"{len(anchors)} rows"


CONSTITUENCIES = [
    "Mahadevapura", "KR Puram", "K R Puram", "Bommanahalli", "Bengaluru South", "Bangalore South",
    "Yalahanka", "Yelahanka", "Dasarahalli", "Byatarayanapura", "153-Yeshwanthpura", "153- Yashwanthpura",
    "Yeshwanthpura", "Padmanabanagar", "Padmanabhanagar", "Govindarajanagara", "Govindarajanagar",
    "161-C.V.Raman Nagara", "161-C.V.Raman Nagar", "C.V.Raman Nagar", "160- Sarvagna Nagara", "Sarvagna Nagara",
    "162-Shivajinagar", "Shivajinagar", "Basavanagudi", "Vijayanagara", "Vijayanagar", "Chikkapete", "Chickpet",
    "BTM Layout", "Malleshwaram", "RajaRajeshwari Nagar", "Rajarajeshwari Nagar", "Anekal", "Bangalore North Additional",
    "Bangalore North additional", "Bangalore North", "Bengaluru North", "Hebbal", "Pulakeshinagar", "Sarvagnanagar",
    "Vijanapura", "Shantinagar", "Gandhinagar", "Rajajinagar", "Jayanagar", "Chamrajpet", "Mahalakshmi Layout",
]


def split_constituency(const_cell: str, name: str) -> tuple[str, str]:
    """Return (constituency, name) with any stray name fragment moved back to the name.
    The constituency band is centred on its header; long names that begin left of
    the name band's boundary drop their first word(s) into the constituency cell."""
    c = re.sub(r"\s+", " ", const_cell).strip()
    for phrase in sorted(CONSTITUENCIES, key=len, reverse=True):
        i = c.lower().find(phrase.lower())
        if i >= 0:
            before, after = c[:i].strip(), c[i + len(phrase):].strip()
            frag = (before + " " + after).strip()
            return phrase, (frag + " " + name).strip() if frag else name
    return c, name


def main() -> None:
    out: list[dict] = []
    for fname, custodian, headers in LISTS:
        seen: set[int] = set()
        for pno, ws in enumerate(words_by_page(SRC / fname), start=1):
            rows, status = parse_page(ws, headers)
            print(f"  {custodian} page {pno}: {status}")
            for cells in rows:
                serial = int(cells[0])
                if serial in seen:
                    continue
                name = re.sub(r"\s+", " ", cells[-1]).strip()
                if not name:
                    continue
                seen.add(serial)
                if custodian == "BBMP":
                    ward = re.sub(r"\s+", " ", cells[1]).strip()
                    const, name = split_constituency(cells[2], name)
                    out.append(dict(custodian=custodian, serial=serial, ward=ward, constituency_or_taluk=const, name=name, in_bbmp="Out of BBMP" not in ward))
                else:
                    out.append(dict(custodian=custodian, serial=serial, ward="", constituency_or_taluk=cells[1], name=name, in_bbmp=True))
        if seen:
            missing = sorted(set(range(1, max(seen) + 1)) - seen)
            print(f"{custodian}: {len(seen)} rows, serials 1..{max(seen)}; missing {missing}")
        else:
            print(f"{custodian}: NO ROWS")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.sort(key=lambda r: (["BBMP", "BDA", "Forest Department", "BMRCL"].index(r["custodian"]), r["serial"]))
    with OUT.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
    print(Counter(r["custodian"] for r in out), "| out of BBMP:", sum(1 for r in out if not r["in_bbmp"]), "| total:", len(out))
    print("wrote", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()

"""Extract KSPCB's monthly "Water Quality Data of Bengaluru Lakes" sheet (PDF from
kspcb.karnataka.gov.in/environmental-monitoring/water, Google Drive links) into a
CSV: one row per monitoring location with the regulator's Use Based Class (A to
E) and the columns the snapshot joins on (DO, BOD, turbidity, TSS, coliform).

pdftotext -layout keeps the row structure; each data line is
  <serial> <Mon-YYYY> <name> <lat> <lon> <35 values> <class>
Latitude and longitude are sometimes printed as a quoted split ("13.00 502"),
which is rejoined. Values are kept as printed (BDL stays BDL). Names that wrap
over two or three lines are recovered from pdftotext -bbox-layout: every word in
the name column whose vertical centre falls in the row's band (midpoints between
successive serial numbers) belongs to that row.

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python \
       scripts/bengaluru-snapshot/extract_kspcb_sheet.py \
       docs/research/bengaluru-lakes/sources/kspcb-bengaluru-lakes-2026-06.pdf 2026-06
"""
from __future__ import annotations

import csv
import re
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs/research/bengaluru-lakes/data"

COLS = ["temp_c", "do_mgl", "ph", "conductivity_umho_cm", "bod_mgl", "nitrate_n_mgl", "nitrite_n_mgl",
        "fecal_coliform_mpn", "total_coliform_mpn", "carbonate_mgl", "bicarbonate_mgl", "turbidity_ntu",
        "phenolphthalein_alkalinity_mgl", "total_alkalinity_mgl", "chlorides_mgl", "cod_mgl", "tkn_mgl",
        "ammoniacal_n_mgl", "total_hardness_mgl", "ca_as_caco3_mgl", "ca_mgl", "mg_as_caco3_mgl", "mg_mgl",
        "sulphate_mgl", "sodium_mgl", "tds_mgl", "tss_mgl", "phosphate_mgl", "boron_mgl", "potassium_mgl",
        "fluoride_mgl", "sodium_pct", "sar", "ortho_phosphate_mgl", "use_based_class"]
COORD = r'"?\d{2}\.\d+(?: \d+)?"?'
LINE = re.compile(rf"^\s*(\d+)\s+([A-Z][a-z]{{2}}-\d{{4}})\s+(.+?)\s+({COORD})\s+({COORD})\s+(.*?)\s*$")


def names_from_bbox(pdf: str) -> dict[int, str]:
    """serial -> full name, from word boxes: rows are bands around each serial
    number's y-centre; the name column lies between the serial/date columns and
    the latitude column (found from the header words)."""
    xml = subprocess.run(["pdftotext", "-bbox-layout", pdf, "-"], check=True, capture_output=True, text=True).stdout
    root = ET.fromstring(xml)
    out: dict[int, str] = {}
    for page in root.iter("{http://www.w3.org/1999/xhtml}page"):
        words = []
        for w in page.iter("{http://www.w3.org/1999/xhtml}word"):
            words.append((float(w.get("xMin")), float(w.get("yMin")), float(w.get("xMax")), float(w.get("yMax")), (w.text or "").strip()))
        # name column: right of the sampling-date column, left of the first coordinate
        date_x1 = max((w[2] for w in words if re.fullmatch(r"[A-Z][a-z]{2}-\d{4}", w[4])), default=None)
        coord_x0 = min((w[0] for w in words if re.match(r'^"?\d{2}\.\d+', w[4])), default=None)
        if date_x1 is None or coord_x0 is None:
            continue
        serials = sorted(((w[1] + w[3]) / 2, int(w[4])) for w in words if w[0] < date_x1 - 15 and w[4].isdigit() and (w[1] + w[3]) / 2 > 60)
        for i, (yc, serial) in enumerate(serials):
            top = (serials[i - 1][0] + yc) / 2 if i > 0 else yc - 12
            bot = (serials[i + 1][0] + yc) / 2 if i + 1 < len(serials) else yc + 12
            ws = [w for w in words if date_x1 + 1 <= w[0] and w[2] <= coord_x0 + 1 and top <= (w[1] + w[3]) / 2 < bot]
            ws.sort(key=lambda w: (round(w[1]), w[0]))
            out[serial] = re.sub(r"\s+", " ", " ".join(w[4] for w in ws)).strip()
    return out


def coord(s: str) -> float:
    return float(s.replace('"', "").replace(" ", ""))


def main(pdf: str, month: str) -> None:
    txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], check=True, capture_output=True, text=True).stdout
    full_names = names_from_bbox(pdf)
    rows, bad = [], []
    for line in txt.splitlines():
        m = LINE.match(line)
        if not m:
            continue
        serial, mon, name, lat, lon, rest = m.groups()
        vals = rest.split()
        if len(vals) != len(COLS):
            bad.append((serial, name, len(vals), vals[-3:]))
        rec = {"serial": int(serial), "month": month, "sampling_month": mon,
               "name": full_names.get(int(serial)) or name.strip(), "name_on_row_line": name.strip(),
               "lat": coord(lat), "lon": coord(lon)}
        if len(vals) == len(COLS):
            rec.update(dict(zip(COLS, vals)))
        elif vals and vals[-1] in "ABCDE":
            rec["use_based_class"] = vals[-1]
        rows.append(rec)
    out = DATA / f"kspcb-lakes-{month}.csv"
    fields = ["serial", "month", "sampling_month", "name", "name_on_row_line", "lat", "lon"] + COLS
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)
    classes = {}
    for r in rows:
        classes[r.get("use_based_class", "")] = classes.get(r.get("use_based_class", ""), 0) + 1
    print(f"{len(rows)} rows -> {out}; classes {classes}; rows with unexpected value counts: {len(bad)}")
    for b in bad[:10]:
        print("  ", b)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

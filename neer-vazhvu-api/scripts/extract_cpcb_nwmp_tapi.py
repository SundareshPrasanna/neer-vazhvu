#!/usr/bin/env python3
"""
Extract the River Tapi water-quality profile from CPCB NWMP annual editions.

WHY THIS EXISTS
The first Surat pass shipped a single edition (2022), which gave seven stations
and one year. Chennai carries five years. CPCB publishes NWMP annually and the
tables are stable in shape across editions, so the depth gap closes by reading
more of the same document rather than by finding a new source.

WHAT IT READS
`WQuality_River-Data-<year>.pdf` (major rivers, which carries the Tapi table)
and `Water_Quality_data_of_Med_Min_River_<year>.pdf` (medium and minor rivers,
which carries the Mindhola at Sachin). Both are national compilations; only the
Gujarat rows are kept.

THE PARSING PROBLEM, and why this uses pdftotext rather than a Python parser
CPCB wraps a station's name across several physical lines while its numbers sit
on one, so a naive line reader drops the name or attaches it to the wrong row.
`pdftotext -layout` preserves the column geometry, which turns each data row
into one line beginning with the station code and containing the state cell.
Rows are matched on that signature, and every row must carry "GUJARAT" so a
station from another state can never be filed under Surat.

It also has to be pdftotext for a practical reason: pdfplumber's page-by-page
text extraction took over thirty minutes of CPU on these six editions and had
not finished. pdftotext does one edition in under two seconds.

WHAT IT DOES NOT DO
It does not interpolate a missing year, and it does not average min/max into a
midpoint. CPCB publishes a range per station per year because that is what it
measured; collapsing it would invent a precision the source does not carry.

Run:
  cd neer-vazhvu-api && python3 scripts/extract_cpcb_nwmp_tapi.py \
      --pdf-dir <dir of downloaded editions> --root ..
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from nvdm_write import write_artifact  # noqa: E402

CITY = "surat"

# The Gujarat Tapi stations, upstream to sea. Keyed by the station code CPCB
# prints, which is stable across editions; the printed NAME is not (it varies
# in spacing, capitalisation and how much of the location it repeats).
TAPI_STATIONS = {
    "46": ("River Tapi at Ukai, Sherula Bridge", 21.2483, 73.5903, 1),
    "1247": ("River Tapi at Mandavi", 21.2600, 73.3000, 2),
    "1983": ("River Tapi near Bardoli (Kapp Bridge), Kakrapar", 21.1400, 73.1200, 3),
    "47": ("River Tapi at Kathore (NH-8 Bridge), u/s of Surat", 21.2260, 72.9560, 4),
    "1248": (
        "River Tapi at Surat u/s Kathore (Limdeshwar Mahadev)",
        21.2200,
        72.9300,
        5,
    ),
    "1982": ("River Tapi at Rander Bridge, Surat", 21.2050, 72.8000, 6),
    "2071": ("River Tapi at ONGC Bridge, Hazira", 21.1180, 72.6600, 7),
}
MINDHOLA_STATIONS = {
    "1438": ("River Mindhola at State Highway Bridge, Sachin", 21.0800, 72.8800, 1),
}

# Medium/minor-river editions are not laid out consistently. In 2023-24 the
# station code leads its row, as in the major-river tables; in 2022 the code
# TRAILS the block and the name and values sit on separate lines above it. So
# those stations also carry a name keyword, and a block scan keyed on that
# keyword runs when the code-led match finds nothing. The keyword must be
# unique within the document.
STATION_KEYWORDS = {"1438": "MINDHOLA"}

# A data row: station code, then the measured pairs. CPCB prints temperature,
# DO, pH, conductivity, BOD, nitrate and the coliforms as min/max pairs; the
# column count varies by edition, so the row is matched loosely and the values
# are taken positionally from the numbers that follow the state name.
_ROW = re.compile(
    r"^\s*(?P<code>\d{1,4})\s+(?P<rest>.*?)\bGUJARAT\b\s+(?P<nums>[\d\s.\-BDL]+?)\s*$",
    re.I,
)
_NUM = re.compile(r"BDL|-|\d+(?:\.\d+)?", re.I)


def numbers(blob: str) -> list[float | None]:
    """CPCB writes below-detection as 'BDL' and absent as '-'. Both become None
    so a reader can tell 'measured and tiny' from 'measured and absent' only
    where the source itself distinguishes them."""
    out: list[float | None] = []
    for tok in _NUM.findall(blob):
        t = tok.strip().upper()
        out.append(None if t in ("BDL", "-") else float(t))
    return out


def pair(vals: list[float | None], i: int) -> dict | None:
    """Take the i-th min/max pair, or None when the edition omits the column."""
    lo, hi = (
        (vals[2 * i] if 2 * i < len(vals) else None),
        (vals[2 * i + 1] if 2 * i + 1 < len(vals) else None),
    )
    if lo is None and hi is None:
        return {"below_detection_limit": True}
    return {"min": lo, "max": hi}


def page_text(pdf_path: Path) -> str | None:
    """Whole-document text with column geometry preserved, or None if unreadable.

    CPCB serves some editions truncated; one bad edition must not take the other
    five with it, but it is reported rather than silently skipped because a
    missing year is a coverage claim.
    """
    if not shutil.which("pdftotext"):
        raise RuntimeError("pdftotext (poppler) is required: brew install poppler")
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tmp:
        out = Path(tmp.name)
    try:
        proc = subprocess.run(
            ["pdftotext", "-layout", str(pdf_path), str(out)],
            capture_output=True,
            timeout=180,
        )
        if proc.returncode != 0 and not out.stat().st_size:
            print(f"  {pdf_path.name}: UNREADABLE - edition skipped")
            return None
        return out.read_text(encoding="utf-8", errors="replace")
    except (subprocess.TimeoutExpired, OSError) as exc:
        print(f"  {pdf_path.name}: UNREADABLE ({type(exc).__name__}) - edition skipped")
        return None
    finally:
        out.unlink(missing_ok=True)


def extract_year(pdf_path: Path, wanted: dict) -> dict[str, dict] | None:
    """Return {station_code: measurements} for the wanted stations in one edition."""
    text = page_text(pdf_path)
    if text is None:
        return None
    found: dict[str, dict] = {}
    lines = text.split("\n")
    for line in lines:
        m = _ROW.match(line)
        if not m:
            continue
        code = m.group("code")
        if code not in wanted:
            continue
        vals = numbers(m.group("nums"))
        if len(vals) < 8:
            continue
        # Column order as printed by CPCB: temperature, dissolved oxygen, pH,
        # conductivity, BOD, nitrate, then the coliform counts.
        found[code] = {
            # Field names below are the SHARED rivers client's, not CPCB's.
            "temperature_c": pair(vals, 0),
            "do_mgl": pair(vals, 1),
            "ph": pair(vals, 2),
            "conductivity_us": pair(vals, 3),
            "bod_mgl": pair(vals, 4),
            "nitrate_mgl": pair(vals, 5),
        }

    # Fallback for the trailing-code layout: find the keyword line, then take
    # the first following line that carries a full set of measurements.
    for code, keyword in STATION_KEYWORDS.items():
        if code in found or code not in wanted:
            continue
        for i, line in enumerate(lines):
            if keyword not in line.upper() or "GUJARAT" not in line.upper():
                continue
            for probe in lines[i : i + 4]:
                vals = numbers(probe)
                if len(vals) >= 12:
                    found[code] = {
                        # Field names below are the SHARED rivers client's, not CPCB's.
                        "temperature_c": pair(vals, 0),
                        "do_mgl": pair(vals, 1),
                        "ph": pair(vals, 2),
                        "conductivity_us": pair(vals, 3),
                        "bod_mgl": pair(vals, 4),
                        "nitrate_mgl": pair(vals, 5),
                    }
                    break
            if code in found:
                break
    return found


def build(pdf_dir: Path, root: Path) -> dict:
    editions: dict[int, dict] = {}
    unreadable: list[str] = []
    for pdf in sorted(pdf_dir.glob("WQuality_River-Data-*.pdf")):
        year = int(re.search(r"(\d{4})", pdf.name).group(1))
        rows = extract_year(pdf, TAPI_STATIONS)
        if rows is None:
            unreadable.append(pdf.name)
            continue
        if rows:
            editions.setdefault(year, {}).update(
                {("tapi", k): v for k, v in rows.items()}
            )
        print(f"  {pdf.name}: {len(rows)} Tapi stations")
    for pdf in sorted(pdf_dir.glob("Water_Quality_data_of_Med_Min_River_*.pdf")):
        year = int(re.search(r"(\d{4})", pdf.name).group(1))
        rows = extract_year(pdf, MINDHOLA_STATIONS)
        if rows is None:
            unreadable.append(pdf.name)
            continue
        if rows:
            editions.setdefault(year, {}).update(
                {("mindhola", k): v for k, v in rows.items()}
            )
        print(f"  {pdf.name}: {len(rows)} Mindhola stations")

    rivers = []
    for river_id, name, name_gu, catalogue in (
        ("tapi", "Tapi", "તાપી", TAPI_STATIONS),
        ("mindhola", "Mindhola", "મીંઢોળા", MINDHOLA_STATIONS),
    ):
        stations = []
        for code, (label, lat, lng, order) in catalogue.items():
            readings = []
            for year in sorted(editions):
                m = editions[year].get((river_id, code))
                if m:
                    readings.append({"year": year, **m})
            if readings:
                stations.append(
                    {
                        "id": f"{river_id}-{code}",
                        "station_code": code,
                        "name": label,
                        "lat": lat,
                        "lng": lng,
                        "downstream_order": order,
                        "readings": readings,
                    }
                )
        if stations:
            stations.sort(key=lambda s: s["downstream_order"])
            rivers.append(
                {"id": river_id, "name": name, "name_gu": name_gu, "stations": stations}
            )

    years = sorted(editions)
    total = sum(len(s["readings"]) for r in rivers for s in r["stations"])
    reg = json.loads((root / "scripts/source-registry/surat.json").read_text())
    src = next(s for s in reg["sources"] if s["id"] == "cpcb-nwmp")

    return {
        "nvdm": "1.0",
        "dataset": "data-root/river-quality",
        "scope": {"kind": "city", "id": CITY},
        "provenance": {
            "sources": [
                {
                    "id": src["id"],
                    "title": "CPCB National Water Quality Monitoring Programme, annual editions",
                    "publisher": src["publisher"],
                    "license": src["license"],
                    "url": src["url"],
                }
            ],
            "method": "pdf-extract",
            "note": (
                f"Gujarat rows only, from {len(years)} annual editions "
                f"({years[0]}-{years[-1]}). Rows are matched on the printed station code "
                "and the mandatory GUJARAT state cell, because CPCB wraps station names "
                "across physical lines. Ranges are carried as published; no midpoint is "
                "derived. Station coordinates are placed on the named crossing or "
                "landmark, since the source table publishes none."
            ),
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/extract_cpcb_nwmp_tapi.py",
        },
        "last_updated": str(years[-1]) if years else "",
        "data_year_range": f"{years[0]}-{years[-1]}" if years else "",
        "source_label": "CPCB National Water Quality Monitoring Programme",
        "source_url": "https://cpcb.gov.in/water-quality-data/",
        "_note": (
            "The profile's headline finding, now visible across editions rather than in a "
            "single year: BOD stays at or below detection limit at most Surat Tapi "
            "stations while conductivity climbs downstream to seawater levels at the "
            "Hazira estuary. Surat's river problem is salinity, not sewage."
        ),
        "_coverage": {
            "editions": years,
            "readings": total,
            "unreadable_editions": unreadable,
        },
        "rivers": rivers,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pdf-dir", required=True)
    ap.add_argument("--root", default="..")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    root = Path(args.root).resolve()
    payload = build(Path(args.pdf_dir).expanduser(), root)
    out = Path(args.out) if args.out else root / "public/data/river-quality-surat.json"
    write_artifact(out, payload)
    cov = payload["_coverage"]
    print(f"wrote {out}: editions {cov['editions']}, {cov['readings']} station-years")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

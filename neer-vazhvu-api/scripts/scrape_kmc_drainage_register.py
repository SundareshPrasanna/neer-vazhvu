#!/usr/bin/env python3
"""
KMC's weekly de-silting / waterlogging activity register.

    https://www.kmcgov.in/KMCPortal/downloads/Weekly_Drainage_Activity_Chart.pdf

A genuinely live weekly feed at a FIXED url: the Kolkata Municipal Corporation's
Mechanical Sewer Cleansing wing publishes, every week, the list of waterlogging
pockets it sent machines to - with a borough/ward attribution on every row. The
file is overwritten in place each week, so there is no archive but the current
week is always current. Structurally this is Mumbai's BMC chronic-flooding
register, and it feeds the same flood-risk surface.

Why it matters beyond the flood page: it is the INDEPENDENT CHECK on the
drainage-capacity hero. The hero says reanalysis rainfall beat the 6 mm/hour
design standard for N hours; this register says which streets actually flooded
and which wards KMC actually sent a jetting machine to. Modelled exceedance and
observed failure are different evidence, and the product should carry both
rather than let one stand in for the other.

Parsing notes, all learned from the real document:
  - pdftotext -layout is stable; columns split reliably on runs of 2+ spaces.
  - The Date cell is written ONCE per date group and left blank on subsequent
    rows, so dates forward-fill. Formats vary WITHIN one file: "20.7.26",
    "21-7-26", "26-07-26".
  - Br./Wd is "<roman borough>/<ward list>", and the ward list can be a single
    ward (I/4), a comma list (I/3,4,5), an ampersand pair (III/31 & 32) or carry
    stray spaces (I/ 7, XIII / 120). One row can therefore touch several wards.
  - Locations wrap onto a second line ("Tala Park Avenue/Manmatha" +
    "Dutta Road"); a continuation line has no ward cell and is appended.
  - Division headers ("(North Division)") appear only on the first page in the
    text layer, so division is carried forward and is null where unknown. We do
    not guess it from the borough.

Run:  python3 neer-vazhvu-api/scripts/scrape_kmc_drainage_register.py
      [--pdf cached.pdf]  parse a local copy instead of fetching
      [--out path]        default public/data/kolkata-waterlogging-register.json
"""

import argparse
import re
import subprocess
import sys
import tempfile
import urllib.request
from collections import OrderedDict
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
# Every producer writing under public/ goes through the envelope-preserving
# writer: a scheduled rewrite must not strip the NVDM envelope it finds.
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
PDF_URL = "https://www.kmcgov.in/KMCPortal/downloads/Weekly_Drainage_Activity_Chart.pdf"
DEFAULT_OUT = REPO_ROOT / "public" / "data" / "kolkata-waterlogging-register.json"

MACHINE_COLUMNS = [
    "manhole_desilting",
    "jetting",
    "bucket",
    "gully_pit_emptier",
    "blow_vac",
]

# "I/3,4,5"  "III/31 & 32"  "XIII / 120"  "I/ 7"
WARD_CELL = re.compile(r"^(?P<b>[IVX]+)\s*/\s*(?P<w>\d[\d,&\s]*)$")
# "20.7.26" / "21-7-26" / "26-07-26"
DATE_CELL = re.compile(r"^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$")
PERIOD = re.compile(
    r"(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\s*to\s*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})"
)
DIVISION = re.compile(r"\(([A-Za-z\s]+Division)\)")


def fetch_pdf(dest: Path) -> None:
    req = urllib.request.Request(PDF_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        dest.write_bytes(resp.read())


def pdf_to_text(pdf: Path) -> str:
    out = subprocess.run(
        ["pdftotext", "-layout", str(pdf), "-"],
        capture_output=True,
        check=True,
    )
    return out.stdout.decode("utf-8", errors="replace")


def norm_date(token: str) -> str | None:
    m = DATE_CELL.match(token)
    if not m:
        return None
    d, mo, y = m.groups()
    year = int(y) + 2000 if len(y) == 2 else int(y)
    try:
        return date(year, int(mo), int(d)).isoformat()
    except ValueError:
        return None


def parse_wards(cell: str) -> tuple[str, list[int]]:
    m = WARD_CELL.match(cell.strip())
    if not m:
        return "", []
    borough = m.group("b")
    wards = [int(w) for w in re.findall(r"\d+", m.group("w"))]
    return borough, wards


def parse(text: str) -> dict:
    lines = text.split("\n")
    entries: list[dict] = []
    current_date: str | None = None
    division: str | None = None
    period_from = period_to = None

    for raw in lines:
        if not raw.strip():
            continue

        if period_from is None:
            pm = PERIOD.search(raw)
            if pm:
                period_from = norm_date(pm.group(1))
                period_to = norm_date(pm.group(2))

        dm = DIVISION.search(raw)
        if dm:
            division = dm.group(1).strip()
            continue

        cells = [c.strip() for c in re.split(r"\s{2,}", raw.strip()) if c.strip()]
        if not cells:
            continue

        # A leading date cell opens a new date group and is dropped from the row.
        maybe = norm_date(cells[0])
        if maybe:
            current_date = maybe
            cells = cells[1:]
        if not cells:
            continue

        # Locate the ward cell; without one this is either a header or the
        # wrapped tail of the previous location.
        ward_idx = next(
            (i for i, c in enumerate(cells) if WARD_CELL.match(c)), None
        )
        if ward_idx is None:
            if (
                entries
                and len(cells) == 1
                and len(cells[0]) > 3
                and not re.search(r"\d\s*$", cells[0])
                and "Division" not in cells[0]
                and not cells[0].lower().startswith(("date", "activity", "the kolkata"))
            ):
                entries[-1]["location"] += " " + cells[0]
            continue

        location = " ".join(cells[:ward_idx]).strip()
        if not location:
            continue
        borough, wards = parse_wards(cells[ward_idx])

        tail = cells[ward_idx + 1 :]
        machines: dict[str, int] = {}
        for i, col in enumerate(MACHINE_COLUMNS):
            val = tail[i] if i < len(tail) else "-"
            machines[col] = int(val) if val.isdigit() else 0
        remarks = " ".join(tail[len(MACHINE_COLUMNS) :]).strip() or None

        entries.append(
            {
                "date": current_date,
                "location": location,
                "borough": borough,
                "wards": wards,
                "division": division,
                "machines": machines,
                "remarks": remarks,
            }
        )

    # The Date cell is vertically CENTRED across its group in the PDF, so
    # pdftotext emits it on whichever row it happens to align with - which for
    # the first group is the second row, leaving the row above it undated.
    # Back-fill those leading rows from the first date seen. Only the head of
    # the file can be affected; every later group inherits by forward-fill.
    first_date = next((e["date"] for e in entries if e["date"]), None)
    for e in entries:
        if e["date"] is None:
            e["date"] = first_date
        else:
            break

    # Per-ward rollup: the register's real analytical value is that every
    # pocket carries a ward, so the flood page can rank wards by how often KMC
    # had to intervene.
    by_ward: "OrderedDict[tuple[str, int], dict]" = OrderedDict()
    for e in entries:
        for w in e["wards"]:
            key = (e["borough"], w)
            row = by_ward.setdefault(
                key,
                {"borough": e["borough"], "ward": w, "entries": 0, "pockets": []},
            )
            row["entries"] += 1
            if e["location"] not in row["pockets"]:
                row["pockets"].append(e["location"])

    pockets = {e["location"] for e in entries}
    return {
        "period": {"from": period_from, "to": period_to},
        "entries": entries,
        "by_ward": sorted(
            by_ward.values(), key=lambda r: (-len(r["pockets"]), r["borough"], r["ward"])
        ),
        "summary": {
            "rows": len(entries),
            "distinct_pockets": len(pockets),
            "wards_touched": len(by_ward),
            "boroughs_touched": len({e["borough"] for e in entries if e["borough"]}),
            "machine_deployments": sum(
                sum(e["machines"].values()) for e in entries
            ),
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        pdf = Path(args.pdf) if args.pdf else Path(tmp) / "kmc.pdf"
        if not args.pdf:
            fetch_pdf(pdf)
        text = pdf_to_text(pdf)

    parsed = parse(text)
    if not parsed["entries"]:
        print("KMC register: parsed 0 rows - layout may have changed", file=sys.stderr)
        return 1

    parsed.update(
        {
            "source": "Kolkata Municipal Corporation, Sewerage & Drainage Department (Mechanical Sewer Cleansing wing)",
            "title": "Weekly Drainage Activity Chart",
            "url": PDF_URL,
            "generated_at": date.today().isoformat(),
            "limitation": (
                "KMC overwrites this file in place each week, so there is no upstream "
                "archive: this snapshot is the only record of the week it covers. Rows "
                "are de-silting deployments, which is where KMC SENT machines - not a "
                "complete list of everywhere the city flooded."
            ),
        }
    )

    out = Path(args.out)
    write_artifact(out, parsed)
    s = parsed["summary"]
    print(
        f"KMC register {parsed['period']['from']}..{parsed['period']['to']}: "
        f"{s['rows']} rows, {s['distinct_pockets']} pockets, "
        f"{s['wards_touched']} wards, {s['boroughs_touched']} boroughs -> {out.name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

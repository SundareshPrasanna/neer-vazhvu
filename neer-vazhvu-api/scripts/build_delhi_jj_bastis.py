"""Build the DUSIB JJ-bastis dataset for Delhi.

Parses the two public DUSIB "675 JJ Bastis/Clusters" PDFs and joins them on
cluster code into public/data/dusib-jj-bastis.json:

  - 2019 list (46 pp): S.No, Division, Code, AC No, Location, Households,
    Land Owning Agency, Remarks - the current-ish roster.
    https://delhishelterboard.in/main/wp-content/uploads/2019/10/JJBastisList675.pdf
  - 2015 list (16 pp): adds Land Area (sqm), Parliamentary Constituency,
    Ward No (PRE-2022 delimitation - join to modern wards needs the SEC
    crosswalk), Revenue District.
    https://delhishelterboard.in/main/wp-content/uploads/2015/12/675_JJ_Cluster_List.pdf

NOTE: neither public PDF carries lat/lon (the internal audit's claim of
per-cluster coordinates does not hold for these files). Geocoding is a
follow-up: ward-join once the 2022 ward geometry lands, or Nominatim on the
location strings with manual QA.

Run:  python scripts/build_delhi_jj_bastis.py [--pdf-dir DIR]
Deps: pdfplumber (already in the API environment).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

import pdfplumber

PDF_2019_URL = (
    "https://delhishelterboard.in/main/wp-content/uploads/2019/10/JJBastisList675.pdf"
)
PDF_2015_URL = "https://delhishelterboard.in/main/wp-content/uploads/2015/12/675_JJ_Cluster_List.pdf"

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402

OUT_PATH = REPO_ROOT / "public" / "data" / "dusib-jj-bastis.json"


def fetch(url: str, dest: Path) -> Path:
    if dest.exists():
        return dest
    print(f"downloading {url}")
    req = urllib.request.Request(
        url, headers={"User-Agent": "neer-vazhvu/delhi-onboarding"}
    )
    dest.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    return dest


def clean(cell: object) -> str:
    if cell is None:
        return ""
    return re.sub(r"\s+", " ", str(cell)).strip()


def to_int(cell: object) -> int | None:
    s = clean(cell).replace(",", "")
    return int(s) if s.isdigit() else None


def parse_2019(path: Path) -> dict[str, dict]:
    rows: dict[str, dict] = {}
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            table = page.extract_table()
            if not table:
                continue
            for raw in table:
                cells = [clean(c) for c in raw]
                if len(cells) < 7 or not re.match(r"^\d+\.?$", cells[0] or ""):
                    continue
                code = cells[2]
                if not code:
                    continue
                rows[code] = {
                    "code": code,
                    "division": cells[1],
                    "ac_no": to_int(cells[3]),
                    "location": cells[4],
                    "households": to_int(cells[5]),
                    "land_owning_agency": cells[6],
                    "remarks": cells[7] if len(cells) > 7 else "",
                }
    return rows


def parse_2015(path: Path) -> dict[str, dict]:
    rows: dict[str, dict] = {}
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            table = page.extract_table()
            if not table:
                continue
            for raw in table:
                cells = [clean(c) for c in raw]
                if len(cells) < 11 or not cells[0].isdigit():
                    continue
                code = cells[1]
                if not code:
                    continue
                rows[code] = {
                    "land_area_sqm": to_int(cells[7]),
                    "parliamentary_constituency": cells[8],
                    "ward_no_pre2022": cells[9],
                    "revenue_district": cells[10],
                    "households_2015": to_int(cells[5]),
                }
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf-dir", default="/tmp", help="where to cache the source PDFs")
    args = ap.parse_args()
    pdf_dir = Path(args.pdf_dir)
    pdf_dir.mkdir(parents=True, exist_ok=True)

    p2019 = fetch(PDF_2019_URL, pdf_dir / "dusib-jj-675-2019.pdf")
    p2015 = fetch(PDF_2015_URL, pdf_dir / "dusib-jj-675-2015.pdf")

    r2019 = parse_2019(p2019)
    r2015 = parse_2015(p2015)
    print(f"2019 list: {len(r2019)} clusters | 2015 list: {len(r2015)} clusters")

    merged = []
    for code, row in sorted(
        r2019.items(), key=lambda kv: int(kv[0]) if kv[0].isdigit() else 10**6
    ):
        extra = r2015.get(code, {})
        merged.append({**row, **extra})
    matched = sum(1 for m in merged if "revenue_district" in m)
    print(f"merged: {len(merged)} clusters, {matched} enriched from the 2015 list")

    total_hh = sum(m["households"] or 0 for m in merged)
    out = {
        "_note": (
            "DUSIB's public roster of JJ (jhuggi-jhopri) bastis, parsed from the Board's own "
            "two PDFs (2019 list joined with the 2015 list's land-area/constituency/district "
            "columns on cluster code). ward_no_pre2022 uses the PRE-unification ward "
            "numbering - do not join it to the 2022 250-ward geometry without the SEC "
            "crosswalk. No lat/lon exists in either public PDF; geocoding is a follow-up."
        ),
        "source": {
            "publisher": "Delhi Urban Shelter Improvement Board (DUSIB)",
            "documents": [
                {"title": "List of 675 JJ Bastis (2019 update)", "url": PDF_2019_URL},
                {
                    "title": "List of 675 JJ Clusters (2015, with land area / PC / ward / district)",
                    "url": PDF_2015_URL,
                },
            ],
            "retrieved": date.today().isoformat(),
            "builder": "neer-vazhvu-api/scripts/build_delhi_jj_bastis.py",
        },
        "summary": {
            "clusters": len(merged),
            "clusters_enriched_from_2015": matched,
            "total_households_2019": total_hh,
        },
        "clusters": merged,
    }

    write_artifact(OUT_PATH, out)
    print(f"wrote {OUT_PATH} ({len(merged)} clusters, {total_hh:,} households)")


if __name__ == "__main__":
    sys.exit(main())

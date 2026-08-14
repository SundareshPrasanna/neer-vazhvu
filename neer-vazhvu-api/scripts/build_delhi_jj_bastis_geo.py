#!/usr/bin/env python3
"""Build public/data/delhi-jj-bastis-geo.json - DUSIB's 675 JJ bastis as points.

Delhi's JJ (jhuggi-jhopri) basti roster shipped without coordinates, so the
ward profiles carried `jj_bastis: {_data_status: "not_geocoded"}` for all 250
wards and the equity layer could not be drawn. DUSIB does publish coordinates,
in a separate PDF linked from the same page as the roster:

  List of 675 J.J. Bastis with Latitude and Longitude (upload date 16-09-2022)
  https://delhishelterboard.in/main/wp-content/uploads/2022/09/JJC_List_675_Geo_Coordinates.pdf
  sha256 f9dc3767bf904addf1a2ade3de18b90189159bfda24724d0dd80d0c4ccaf38e8

The two DUSIB lists use DIFFERENT serial numbering (geo #1 = F-Block Mangolpuri,
roster #1 = LNJP Hospital Ranjeet Road), so household counts are joined on
normalised location text. Every join records `match_method` so a reader can
tell an exact match from a fuzzy one; fuzzy matches below THRESHOLD are left
unjoined rather than guessed.

Records wrap across up to three physical lines when the location name is long,
with latitude and longitude landing on continuation lines, so a record is
parsed as a BLOCK anchored on a strictly sequential serial (1..675).

Usage:  python scripts/build_delhi_jj_bastis_geo.py
"""

from __future__ import annotations

import collections
import difflib
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
from nvdm_write import write_artifact  # noqa: E402

CACHE = Path(__file__).resolve().parent / ".cache"
OUT = REPO / "public/data/delhi-jj-bastis-geo.json"
ROSTER = REPO / "public/data/dusib-jj-bastis.json"

PDF_URL = (
    "https://delhishelterboard.in/main/wp-content/uploads/2022/09/"
    "JJC_List_675_Geo_Coordinates.pdf"
)
PDF_SHA256 = "f9dc3767bf904addf1a2ade3de18b90189159bfda24724d0dd80d0c4ccaf38e8"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"

EXPECTED = 675
LAT = (28.35, 28.95)  # Delhi NCT bounding box, used to reject bad coordinates
LNG = (76.80, 77.40)
NUM = re.compile(r"\d{2}\.\d{3,}")
THRESHOLD = 0.90  # difflib ratio below which a fuzzy match is discarded


def fetch_pdf() -> Path:
    CACHE.mkdir(exist_ok=True)
    pdf = CACHE / "dusib-jj-675-geo.pdf"
    if not pdf.exists():
        req = urllib.request.Request(PDF_URL, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=120) as r:
            pdf.write_bytes(r.read())
    digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
    if digest != PDF_SHA256:
        sys.exit(
            f"FATAL: DUSIB PDF sha256 mismatch\n  expected {PDF_SHA256}\n  got      {digest}\n"
            "  DUSIB may have republished the list; re-verify before trusting it."
        )
    return pdf


def pdf_to_text(pdf: Path) -> list[str]:
    txt = CACHE / "dusib-jj-675-geo.txt"
    subprocess.run(["pdftotext", "-layout", str(pdf), str(txt)], check=True)
    return [
        line.rstrip()
        for line in txt.read_text(encoding="utf-8", errors="ignore").splitlines()
    ]


def parse_blocks(lines: list[str]) -> list[dict]:
    blocks, cur, expect = [], None, 1
    for line in lines:
        if not line.strip() or "Lattitude" in line or re.match(r"\s*S\s*No", line):
            continue
        m = re.match(r"\s*(\d{1,3})\s+(\S.*)$", line)
        if m and int(m.group(1)) == expect:
            if cur:
                blocks.append(cur)
            cur = {"sno": expect, "lines": [m.group(2)]}
            expect += 1
        elif cur:
            cur["lines"].append(line.strip())
    if cur:
        blocks.append(cur)

    out = []
    for b in blocks:
        blob = " ".join(b["lines"])
        nums = NUM.findall(blob)
        lat = next((float(n) for n in nums if LAT[0] <= float(n) <= LAT[1]), None)
        lng = next((float(n) for n in nums if LNG[0] <= float(n) <= LNG[1]), None)
        loc = blob
        for n in nums:
            loc = loc.replace(n, " ")
        out.append(
            {
                "sno": b["sno"],
                "location": re.sub(r"\s+", " ", loc).strip(" .,;-"),
                "lat": lat,
                "lng": lng,
            }
        )
    return out


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    for a, b in [
        ("jhuggi", "jj"),
        ("jjc", "jj"),
        ("cluster", ""),
        ("camp", ""),
        ("colony", ""),
        ("basti", ""),
        ("near", ""),
        ("behind", ""),
        ("block", "blk"),
        ("puri", "pur"),
        ("road", ""),
        ("nagar", "ngr"),
    ]:
        s = s.replace(a, b)
    return " ".join(sorted(set(w for w in s.split() if len(w) > 2)))


def main() -> None:
    recs = parse_blocks(pdf_to_text(fetch_pdf()))

    if len(recs) != EXPECTED:
        sys.exit(f"FATAL: parsed {len(recs)} records, expected {EXPECTED}")
    missing = [r for r in recs if r["lat"] is None or r["lng"] is None]
    if missing:
        sys.exit(
            f"FATAL: {len(missing)} records without coordinates: "
            f"{[r['sno'] for r in missing][:10]}"
        )

    roster = json.loads(ROSTER.read_text())["clusters"]
    by_norm: dict[str, list] = collections.defaultdict(list)
    for c in roster:
        by_norm[norm(c["location"])].append(c)
    keys = list(by_norm)

    exact = fuzzy = 0
    for r in recs:
        key = norm(r["location"])
        hits = by_norm.get(key)
        method, score = None, None
        if hits and len(hits) == 1:
            method, score = "exact", 1.0
        else:
            close = difflib.get_close_matches(key, keys, n=1, cutoff=THRESHOLD)
            if close and len(by_norm[close[0]]) == 1:
                hits = by_norm[close[0]]
                method = "fuzzy"
                score = round(difflib.SequenceMatcher(None, key, close[0]).ratio(), 3)
        if method:
            c = hits[0]
            r.update(
                roster_code=c["code"],
                households=c.get("households"),
                revenue_district=c.get("revenue_district"),
                land_owning_agency=c.get("land_owning_agency"),
                ward_no_pre2022=c.get("ward_no_pre2022"),
                match_method=method,
                match_score=score,
            )
            exact += method == "exact"
            fuzzy += method == "fuzzy"
        else:
            r["match_method"] = "unmatched"

    total_hh = sum(c.get("households") or 0 for c in roster)
    got_hh = sum(r.get("households") or 0 for r in recs)

    doc = {
        "_note": (
            "DUSIB's 675 JJ bastis as point coordinates, parsed from the Board's own "
            "'List of 675 J.J. Bastis with Latitude and Longitude' PDF (upload date "
            "16-09-2022) and joined to the household roster in dusib-jj-bastis.json. "
            "All 675 records carry coordinates and all fall inside the Delhi NCT "
            "bounding box. Household counts come from the roster, which uses different "
            "serial numbering, so the join is on normalised location text: "
            "`match_method` is 'exact', 'fuzzy' (difflib ratio >= 0.90, score recorded) "
            "or 'unmatched'. Unmatched points keep their coordinates but carry no "
            "household count rather than an inferred one."
        ),
        "source": {
            "label": "Delhi Urban Shelter Improvement Board (DUSIB)",
            "coordinates_url": PDF_URL,
            "coordinates_upload_date": "2022-09-16",
            "coordinates_sha256": PDF_SHA256,
            "roster_file": "dusib-jj-bastis.json",
            "page": "https://delhishelterboard.in/main/?page_id=3644",
        },
        "summary": {
            "clusters": len(recs),
            "with_coordinates": sum(1 for r in recs if r["lat"] and r["lng"]),
            "matched_exact": exact,
            "matched_fuzzy": fuzzy,
            "unmatched": sum(1 for r in recs if r["match_method"] == "unmatched"),
            "households_joined": got_hh,
            "households_total_roster": total_hh,
            "households_coverage_pct": round(got_hh * 100 / total_hh, 1)
            if total_hh
            else None,
        },
        "clusters": recs,
    }
    write_artifact(OUT, doc)

    s = doc["summary"]
    print(f"wrote {OUT.relative_to(REPO)}")
    print(f"  clusters          {s['clusters']} (all with coordinates)")
    print(f"  matched exact     {s['matched_exact']}")
    print(f"  matched fuzzy     {s['matched_fuzzy']}")
    print(f"  unmatched         {s['unmatched']}")
    print(
        f"  households joined {s['households_joined']:,} / {s['households_total_roster']:,} "
        f"({s['households_coverage_pct']}%)"
    )


if __name__ == "__main__":
    main()

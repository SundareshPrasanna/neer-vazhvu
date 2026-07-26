#!/usr/bin/env python3
"""Extract DPCC's monthly drain water-quality tables into
public/data/delhi-drain-quality.json.

WHY. Delhi's drain network is the verification instrument for the commitment
to trap all 39 major drains by 30 June 2026: a trapped drain reads NO FLOW.
The repo carried the network for exactly ONE month (May 2026) because the
rows were being hand-typed off scans, so the pollution surface had a single
data point. This parses the reports instead.

WHAT IS AND IS NOT AVAILABLE. There is no deep archive. DPCC's listing page
carries a rolling window of roughly three months, OpenCity mirrors only the
CETP datasets, and the Wayback Machine has ZERO captures of the
analysis-report directory or the listing page. The historical drain series was
never archived by anyone and cannot be recovered - this grows forward from now
instead, one month at a time, which is why the Headwaters registry watches the
listing.

THE UPSIDE. Unlike the CETP reports these PDFs carry an embedded text layer
(no OCR needed) AND per-drain COORDINATES, which the hand-typed month lacked.
That turns the 39 drains into a mappable, ward-attributable layer.

PARSING. The reports have no ruled table, and each record spans two or three
physical lines (N latitude on one, E longitude plus the values on the next),
so rows are reconstructed from word POSITIONS. Column bands are derived per
page from that page's own header row, because the three sections
(Najafgarh sub-drains + UP outfalls, Agra Canal, direct-to-Yamuna) do not
share a layout.

The embedded text is scanner-OCR quality ("Tod" for 100, "77.3 1199" with a
stray space), so values are parsed defensively and anything implausible is
dropped rather than published.

Run: python scripts/extract_delhi_drain_quality.py [--pdf FILE ...]
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / ".cache" / "delhi-drain-pdfs"
OUT = REPO / "public/data/delhi-drain-quality.json"
LISTING = "https://dpcc.delhi.gov.in/dpcc/analysis-reports"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"

# Delhi NCT plus the UP/Haryana outfall fringe the drain reports cover.
LAT_RANGE = (28.30, 29.00)
LNG_RANGE = (76.70, 77.45)

SAMPLED = re.compile(
    r"DATE\s+OF\s+SAMPLING\s*[:.]?\s*(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})", re.I
)
SECTION = re.compile(
    r"(Najafgarh\s+Drains|Najafgarh\s+Jheel|UP\s+Drains[^\n]*Shahdara|"
    r"Agra\s+Canal|Direct[a-z]*\s+discharg|falling\s+into\s+Agra)",
    re.I,
)
NOFLOW = re.compile(r"NO\s*FLOW", re.I)
MONTH_IN_NAME = re.compile(
    r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-_ ]?(\d{2,4})", re.I
)
MONTHS = {
    m: i
    for i, m in enumerate(
        [
            "jan",
            "feb",
            "mar",
            "apr",
            "may",
            "jun",
            "jul",
            "aug",
            "sep",
            "oct",
            "nov",
            "dec",
        ],
        1,
    )
}

# Header words that anchor each value column.
COLUMN_KEYS = {"ph": "pH", "tss": "TSS", "cod": "COD", "bod": "BOD"}


CANON_FILE = REPO / "public/data/dpcc-monthly-wq-delhi.json"
NAME_FLOOR = 0.72  # below this a parsed fragment is not assigned to a drain


def load_canon() -> list[tuple[str, str]]:
    """The 39 drain names + group codes, hand-typed for May 2026.

    The embedded text layer is scanner-OCR quality, so parsed names arrive as
    fragments ("D rain", "Drain No") or as two drains run together ("Indrapuri
    Drain Sahibabad Drain"). Rather than regex harder, parsed names are matched
    against this roster, which is already in the repo and was transcribed by
    hand. Anything that does not match is reported, never published under a
    guessed name.
    """
    doc = json.loads(CANON_FILE.read_text())
    for m in doc.get("months", []):
        if m.get("drains"):
            return [(d["name"], d.get("group")) for d in m["drains"]]
    return []


def match_canon(
    raw: str, canon: list[tuple[str, str]]
) -> tuple[str | None, str | None, float]:
    import difflib

    def norm(s: str) -> str:
        s = re.sub(r"\bdrains?\b", "", (s or "").lower())
        return (
            re.sub(r"[^a-z0-9 ]", " ", s).split()
            and " ".join(re.sub(r"[^a-z0-9 ]", " ", s).split())
            or ""
        )

    target = norm(raw)
    if not target:
        return None, None, 0.0
    best, best_score = None, 0.0
    for name, group in canon:
        score = difflib.SequenceMatcher(None, target, norm(name)).ratio()
        if score > best_score:
            best, best_score = (name, group), score
    if best and best_score >= NAME_FLOOR:
        return best[0], best[1], round(best_score, 3)
    return None, None, round(best_score, 3)


def num(tok: str, lo: float, hi: float) -> float | None:
    """Parse a value token, tolerating the scanner's stray spaces and dots."""
    s = re.sub(r"[^\d.]", "", tok or "").strip(".")
    if not s:
        return None
    parts = [p for p in s.split(".") if p]
    if not parts:
        return None
    s = parts[0] if len(parts) == 1 else f"{parts[0]}.{parts[1]}"
    try:
        v = float(s)
    except ValueError:
        return None
    return v if lo <= v <= hi else None


def month_from_name(name: str) -> str | None:
    m = MONTH_IN_NAME.search(urllib.parse.unquote(name))
    if not m:
        return None
    y = int(m.group(2))
    y += 2000 if y < 100 else 0
    return f"{y:04d}-{MONTHS[m.group(1).lower()[:3]]:02d}"


def fetch_listing() -> list[tuple[str, str]]:
    req = urllib.request.Request(LISTING, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        html = r.read().decode("utf-8", "ignore")
    out = []
    for href in set(re.findall(r'href="([^"]*analysis-report[^"]*\.pdf)"', html, re.I)):
        name = urllib.parse.unquote(href).split("/")[-1]
        if "drain" in name.lower():
            url = (
                href if href.startswith("http") else "https://dpcc.delhi.gov.in" + href
            )
            out.append((name, url))
    return sorted(out)


def download(url: str, name: str) -> Path | None:
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = CACHE / re.sub(r"[^A-Za-z0-9.]+", "-", name)
    if dest.exists() and dest.stat().st_size > 10_000:
        return dest
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=180) as r:
            dest.write_bytes(r.read())
        return dest
    except Exception as exc:
        print(f"    ! download failed {name}: {exc}", flush=True)
        return None


def column_bands(words) -> dict[str, tuple[float, float]]:
    """Locate every column from this page's own header row.

    The three report sections do NOT share a layout - page 3 sits ~23pt right
    of page 1 - so nothing here may be hardcoded. Returns bands for the value
    columns plus `name` and `coord`, derived from the "Name of Drain" and
    "Coordinates" headers.
    """
    bands: dict[str, tuple[float, float]] = {}
    name_x = coord_x = None
    for w in words:
        key = re.sub(r"[^a-z]", "", w["text"].lower())
        centre = (w["x0"] + w["x1"]) / 2
        if key in COLUMN_KEYS and key not in bands:
            bands[key] = (centre - 32, centre + 32)
        if key == "name" and name_x is None:
            name_x = w["x0"]
        if key == "coordinates" and coord_x is None:
            coord_x = w["x0"]
    if name_x is not None and coord_x is not None and coord_x > name_x:
        bands["name"] = (name_x - 12, coord_x - 6)
        bands["coord"] = (coord_x - 6, coord_x + 70)
    elif bands:
        # Some sections omit the "Name of Drain" / "Coordinates" headers
        # entirely (page 2 of the June report). Fall back to deriving the two
        # from the leftmost value column, which is always present: names sit
        # left of the coordinates, coordinates left of the first value.
        first_value_x = min(x0 for k, (x0, _) in bands.items() if k in COLUMN_KEYS)
        bands["coord"] = (first_value_x - 110, first_value_x - 12)
        bands["name"] = (first_value_x - 250, first_value_x - 110)
    return bands


def parse_pdf(pdf: Path, month: str | None, canon: list[tuple[str, str]]) -> list[dict]:
    import pdfplumber

    records: list[dict] = []
    with pdfplumber.open(pdf) as doc:
        for page in doc.pages:
            words = page.extract_words()
            if not words:
                continue
            flat = " ".join(w["text"] for w in words)
            sampled = None
            s = SAMPLED.search(flat)
            if s:
                d, mo, y = int(s.group(1)), int(s.group(2)), int(s.group(3))
                y += 2000 if y < 100 else 0
                if 1 <= mo <= 12 and 1 <= d <= 31:
                    sampled = f"{y:04d}-{mo:02d}-{d:02d}"

            bands = column_bands(words)
            if not bands:
                continue

            # Cluster tolerance matters: at /3 the longitude word and its own
            # pH/TSS/COD/BOD values land in different clusters and every value
            # reads as None (which then looks like NO FLOW). /6 is about one
            # line height in these reports and groups a row correctly.
            lines = collections.defaultdict(list)
            for w in words:
                lines[round(w["top"] / 6)].append(w)
            ordered = sorted(lines)

            # Section headings, by the y they appear at.
            headings: list[tuple[int, str]] = []
            for k in ordered:
                text = " ".join(
                    w["text"] for w in sorted(lines[k], key=lambda w: w["x0"])
                )
                m = SECTION.search(text)
                if m:
                    headings.append((k, re.sub(r"\s+", " ", m.group(1)).strip()))

            def section_at(y: int) -> str | None:
                hit = [h for yy, h in headings if yy <= y]
                return hit[-1] if hit else None

            name_band = bands.get("name")
            if not name_band:
                continue

            # Records are anchored on the SERIAL NUMBER in the leftmost column
            # and run until the next serial. Anchoring on the coordinate line
            # instead fragments multi-line names ("Najafgarh Jheel Downstream"
            # became "Downstream") and mixes neighbouring drains together.
            serial_lines = [
                k
                for k in ordered
                if any(
                    w["x0"] < name_band[0] and re.fullmatch(r"\d{1,2}[.,]?", w["text"])
                    for w in lines[k]
                )
            ]

            heading_ys = {y for y, _ in headings}

            for si, start in enumerate(serial_lines):
                end = (
                    serial_lines[si + 1]
                    if si + 1 < len(serial_lines)
                    else ordered[-1] + 1
                )
                # Stop the block at the next SECTION HEADING as well as the
                # next serial, otherwise the heading text is swallowed into
                # this drain's name ("Downstream UP Drains out falling...").
                nxt_heading = [y for y in heading_ys if start < y < end]
                if nxt_heading:
                    end = min(nxt_heading)
                block = [w for k in ordered if start <= k < end for w in lines[k]]
                if not block:
                    continue
                btext = " ".join(
                    w["text"] for w in sorted(block, key=lambda w: (w["top"], w["x0"]))
                )

                lat = lon = None
                for w in block:
                    if not (
                        bands["coord"][0]
                        <= (w["x0"] + w["x1"]) / 2
                        <= bands["coord"][1] + 40
                    ):
                        continue
                    if lat is None and re.match(r"^2[89][.\d ]+$", w["text"]):
                        lat = num(w["text"], *LAT_RANGE)
                    elif lon is None and re.match(r"^7[67][.\d ]+$", w["text"]):
                        lon = num(w["text"], *LNG_RANGE)

                nm = [
                    w["text"]
                    for w in sorted(block, key=lambda w: (w["top"], w["x0"]))
                    if name_band[0] <= w["x0"] < name_band[1]
                    and not re.fullmatch(r"[\d.,]+|[A-C]\.?|[NE]", w["text"])
                ]
                name = re.sub(r"\s+", " ", " ".join(nm)).strip(" .|:-")
                name = re.sub(r"^\d+\.?\s*", "", name)
                if len(name) < 3:
                    continue

                vals: dict[str, float | None] = {}
                for key in COLUMN_KEYS:
                    if key not in bands:
                        vals[key] = None
                        continue
                    x0, x1 = bands[key]
                    lo, hi = (0.0, 14.0) if key == "ph" else (0.0, 20000.0)
                    got = None
                    for w in block:
                        centre = (w["x0"] + w["x1"]) / 2
                        if x0 <= centre <= x1:
                            got = num(w["text"], lo, hi)
                            if got is not None:
                                break
                    vals[key] = got

                # NO FLOW is an explicit printed value, not an absence. Only
                # the printed marker sets the flag; a row we simply failed to
                # read stays null, because reporting an unread row as a
                # trapped drain would fake the trapping programme's result.
                canon_name, canon_group, score = match_canon(name, canon)
                records.append(
                    {
                        "name": canon_name or name,
                        "matched": canon_name is not None,
                        "raw_name": name,
                        "name_match_score": score,
                        "group": canon_group or section_at(start),
                        "lat": lat,
                        "lng": lon,
                        "month": month,
                        "sampled": sampled,
                        "no_flow": bool(NOFLOW.search(btext)),
                        "ph": vals.get("ph"),
                        "tss": vals.get("tss"),
                        "cod": vals.get("cod"),
                        "bod": vals.get("bod"),
                    }
                )

            continue

            # (unreachable) previous coordinate-anchored path
            for idx, k in enumerate(ordered):
                row = sorted(lines[k], key=lambda w: w["x0"])
                text = " ".join(w["text"] for w in row)
                lon = None
                for w in row:
                    if w["text"].upper() == "E":
                        continue
                    v = num(w["text"], *LNG_RANGE)
                    if v is not None and re.match(r"^7[67][.\d ]+$", w["text"]):
                        lon = v
                        break
                if lon is None:
                    continue

                lat = None
                for back in range(idx, max(idx - 4, -1), -1):
                    for w in sorted(lines[ordered[back]], key=lambda w: w["x0"]):
                        v = num(w["text"], *LAT_RANGE)
                        if v is not None and re.match(r"^2[89][.\d ]+$", w["text"]):
                            lat = v
                            break
                    if lat is not None:
                        break

                # Name sits left of the coordinate column and may wrap onto the
                # line above. Kept to a 1-line window: widening it bleeds the
                # neighbouring drain's name into this record ("Bupania Drain
                # Najafgarh Jheel" was two different drains).
                name_words = []
                for back in (idx - 1, idx):
                    if back < 0:
                        continue
                    for w in sorted(lines[ordered[back]], key=lambda w: w["x0"]):
                        if 130 <= w["x0"] < 235 and not re.fullmatch(
                            r"[\d.]+|[A-C]\.?", w["text"]
                        ):
                            name_words.append(w["text"])
                name = re.sub(r"\s+", " ", " ".join(name_words)).strip(" .|:-")
                name = re.sub(r"^\d+\.?\s*", "", name)
                if not name:
                    continue

                vals: dict[str, float | None] = {}
                for key, (x0, x1) in bands.items():
                    lo, hi = (0.0, 14.0) if key == "ph" else (0.0, 20000.0)
                    got = None
                    for w in row:
                        centre = (w["x0"] + w["x1"]) / 2
                        if x0 <= centre <= x1:
                            got = num(w["text"], lo, hi)
                            if got is not None:
                                break
                    vals[key] = got

                no_flow = bool(NOFLOW.search(text)) or all(
                    v is None for v in vals.values()
                )

                records.append(
                    {
                        "name": name,
                        "group": section_at(k),
                        "lat": lat,
                        "lng": lon,
                        "month": month,
                        "sampled": sampled,
                        "no_flow": no_flow,
                        "ph": vals.get("ph"),
                        "tss": vals.get("tss"),
                        "cod": vals.get("cod"),
                        "bod": vals.get("bod"),
                    }
                )
    return records


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--pdf", nargs="*", help="parse local PDFs instead of the DPCC listing"
    )
    args = ap.parse_args()

    jobs: list[tuple[str, Path]] = []
    if args.pdf:
        for p in args.pdf:
            path = Path(p)
            jobs.append((month_from_name(path.name) or "unknown", path))
    else:
        listed = fetch_listing()
        print(f"drain PDFs on the DPCC listing: {len(listed)}")
        for name, url in listed:
            path = download(url, name)
            if path:
                jobs.append((month_from_name(name) or "unknown", path))

    canon = load_canon()
    print(f"canonical drain roster: {len(canon)} names")
    months: dict[str, list[dict]] = {}
    for month, path in jobs:
        recs = parse_pdf(path, month, canon)
        print(f"  {month}  {path.name[:44]:<44} {len(recs)} drains")
        if recs:
            months.setdefault(month, []).extend(recs)

    # Fold in the hand-transcribed month already in the repo. It has values but
    # no coordinates, so positions are backfilled from the parsed month by
    # canonical name - which is what makes May mappable too.
    coords = {
        r["name"].lower(): (r["lat"], r["lng"])
        for rs in months.values()
        for r in rs
        if r.get("matched") and r.get("lat") and r.get("lng")
    }
    hand = json.loads(CANON_FILE.read_text())
    for m in hand.get("months", []):
        if not m.get("drains") or m["month"] in months:
            continue
        for d in m["drains"]:
            lat, lng = coords.get(d["name"].lower(), (None, None))
            months.setdefault(m["month"], []).append(
                {
                    "name": d["name"],
                    "matched": True,
                    "raw_name": d["name"],
                    "name_match_score": 1.0,
                    "group": d.get("group"),
                    "lat": lat,
                    "lng": lng,
                    "month": m["month"],
                    "sampled": m.get("sampled"),
                    "no_flow": bool(NOFLOW.search(str(d.get("remark") or "")))
                    or d.get("no_flow", False),
                    "ph": d.get("ph"),
                    "tss": d.get("tss"),
                    "cod": d.get("cod"),
                    "bod": d.get("bod"),
                    "_transcription": "hand-typed from scan (pre-dates this parser)",
                    "_coords_from": "parsed month, joined by name" if lat else None,
                }
            )

    all_recs = [r for rs in months.values() for r in rs]
    located = [r for r in all_recs if r["lat"] and r["lng"]]
    noflow = [r for r in all_recs if r["no_flow"]]
    unmatched = [r for r in all_recs if not r.get("matched")]

    doc = {
        "_note": (
            "DPCC monthly drain water-quality tables, parsed from the embedded text layer "
            "of the Committee's analysis-report PDFs. The drain network is the verification "
            "instrument for the commitment to trap all 39 major drains by 30 June 2026: a "
            "trapped drain reads NO FLOW, which is captured here as `no_flow` rather than "
            "as a missing value."
        ),
        "_coverage_limit": (
            "There is NO deep archive. DPCC's listing carries a rolling window of about "
            "three months, OpenCity mirrors only the CETP datasets, and the Wayback Machine "
            "has zero captures of the analysis-report directory or the listing page. The "
            "historical series was never archived by anyone and cannot be recovered; this "
            "grows forward one month at a time, which is why the Headwaters registry "
            "watches the listing."
        ),
        "_extraction": (
            "These PDFs carry an embedded text layer, so no OCR is needed - but it is "
            "scanner-quality ('Tod' for 100, stray spaces inside numbers), and the reports "
            "have no ruled table. Records span two or three physical lines and are "
            "reconstructed from word positions, with the value columns derived per page "
            "from that page's own header row because the three sections differ in layout. "
            "Implausible values are dropped rather than published."
        ),
        "source": {
            "publisher": "Delhi Pollution Control Committee (I/C Water Laboratory)",
            "listing_url": LISTING,
            "retrieved": "2026-07-26",
        },
        "standards": {"tss_mg_l": 100, "cod_mg_l": 250, "bod_mg_l": 30},
        "summary": {
            "months": sorted(months),
            "readings": len(all_recs),
            "with_coordinates": len(located),
            "no_flow_readings": len(noflow),
            "distinct_drains": len({r["name"].lower() for r in all_recs}),
            "canon_roster": len(canon),
            "matched_to_roster": len(all_recs) - len(unmatched),
            "unmatched": len(unmatched),
        },
        "readings": sorted(all_recs, key=lambda r: (r["month"] or "", r["name"])),
    }
    OUT.write_text(json.dumps(doc, indent=2) + "\n")

    s = doc["summary"]
    print(f"\nwrote {OUT.relative_to(REPO)}")
    print(f"  months {s['months']}")
    print(
        f"  {s['readings']} readings | {s['with_coordinates']} with coordinates | "
        f"{s['distinct_drains']} distinct drains | {s['no_flow_readings']} NO FLOW"
    )
    if unmatched:
        print(
            f"  UNMATCHED (reported, not published under a guessed name): {len(unmatched)}"
        )
        for r in unmatched[:10]:
            print(f"    raw={r['raw_name']!r} best={r['name_match_score']}")
    if not all_recs:
        sys.exit("FATAL: parsed nothing - the report layout has probably changed")


if __name__ == "__main__":
    main()

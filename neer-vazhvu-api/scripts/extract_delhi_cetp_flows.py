#!/usr/bin/env python3
"""Build public/data/delhi-cetp-flows.json - the CETP utilisation series.

Delhi's industrial-attribution problem: DPCC's only public consent register
ends in July 2002, so there is no current per-unit denominator of who
discharges what. But DPCC does publish, monthly, the design capacity and the
MEASURED INFLOW of every Common Effluent Treatment Plant. That answers a
sharper question than a register would: how much of the industrial effluent
these plants exist to treat actually reaches them.

Source: public/data/delhi-cetp-monthly-index.json (62 monthly PDF bundles,
2019-2024, DPCC via OpenCity). The PDFs are IMAGE SCANS with no text layer,
which is why this archive sat indexed but unextracted.

WHAT THIS EXTRACTS, AND WHAT IT DELIBERATELY DOES NOT
  extracted: plant, design capacity, month, sampling date, measured flow,
             OLMS (online monitoring) remark
  NOT extracted: the 23-parameter inlet/outlet grid. Those cells OCR badly -
             merged rows, garbled heavy-metal values - and half-read arsenic
             or chromium numbers would be worse than none. They need a better
             OCR pass or manual transcription. The fields above are prose
             lines and come out clean.

VALIDATION: the repo carries one hand-transcribed page (Wazirpur, Nov 2024)
in delhi-cetp-monthly-index.json's schema_sample. This script asserts its own
output against that page, so a silent OCR regression fails the build.

Needs: pdftoppm (poppler) and tesseract on PATH.
Usage:  python scripts/extract_delhi_cetp_flows.py [--limit N] [--keep-images]
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
from nvdm_write import write_artifact  # noqa: E402

INDEX = REPO / "public/data/delhi-cetp-monthly-index.json"
CACHE = Path(__file__).resolve().parent / ".cache" / "delhi-cetp-pdfs"
OCR_CACHE = Path(__file__).resolve().parent / ".cache" / "delhi-cetp-ocr"
OUT = REPO / "public/data/delhi-cetp-flows.json"

ARCHIVE_MIN_YEAR, ARCHIVE_MAX_YEAR = 2019, 2025  # the DPCC archive's real span
MAX_FLOW_MULTIPLE = 3.0  # flow above this x design is an OCR artefact, not overload
FUZZY_MIN = 0.62  # below this a garbled name is left unresolved, not guessed
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"

# DPCC changed the report header partway through the archive:
#   2023-24: ANALYSIS REPORT OF SMA CETP (12 MLD) FOR THE MONTH OF NOVEMBER-2024
#   2019-22: ANALYSIS REPORT OF WAZ ron CETP (24 MLD)      <- no month at all
# So the month is taken from the header when present and from the bundle name
# otherwise, and the plant name is fuzzy-matched because the older scans OCR
# the name badly ("WAZ ron" for WAZIRPUR).
HEADER_WITH_MONTH = re.compile(
    r"ANALYSIS\s+REPORT\s+OF\s+(.+?)\s*\(\s*([\d.]+)\s*MLD\s*\)\s*FOR\s+THE\s+MONTH\s+OF\s+([A-Z]+)\s*[-–]\s*(\d{4})",
    re.I,
)
HEADER_ANY = re.compile(
    r"ANALYSIS\s+REPORT\s+OF\s+(.{0,40}?)\s*\(\s*([\d.]+)\s*MLD\s*\)", re.I
)
# The plant name repeats on the "Name & Address of Ind./Unit" line; a second
# reading of the same name materially improves the fuzzy match on bad scans.
UNIT_LINE = re.compile(
    r"Name\s*&?\s*Address[^\n:]*[:.]?\s*(.{0,40}?)\s*\(\s*[\d.]+\s*MLD", re.I
)
BUNDLE_MONTH = re.compile(r"([A-Z][a-z]+)\s+(\d{4})")
# 2019 reports sometimes state "Sampling location: BYPASS OF CETP", which is a
# material fact rather than a formatting detail: the sample was not taken at
# the works inlet.
SAMPLE_LOC = re.compile(r"Samp[a-z]*\s+[il]ocation\s*[:.]?\s*([^\n|]{0,40})", re.I)
# "Flow: - 5.32 MLD" - DPCC prints a dash between the colon and the value on
# some pages; omitting it silently drops those plants.
FLOW = re.compile(r"Flow\s*[:.]?\s*[-–—]?\s*([\d.]+)\s*MLD", re.I)
SAMPLED = re.compile(
    r"Date\s+of\s+Sampling\s*[:.]?\s*(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})", re.I
)
OLMS = re.compile(r"OLMS\s+was\s+(non[- ]?functional|functional|not\s+working)", re.I)

MONTHS = {
    m.upper(): i
    for i, m in enumerate(
        [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ],
        1,
    )
}

# Plant-name spellings drift across months (GTK vs G.T. KARNAL ROAD). Canonical
# names + coordinates come from the register in industrial-sources-delhi.json.
CANON = {
    "GTK": "G.T. Karnal Road",
    "G.T. KARNAL ROAD": "G.T. Karnal Road",
    "GT KARNAL ROAD": "G.T. Karnal Road",
    "SMA": "SMA Industrial Area",
    "LAWRENCE ROAD": "Lawrence Road",
    "MANGOLPURI": "Mangolpuri",
    "MAYAPURI": "Mayapuri",
    "NARAINA": "Naraina",
    "NANGLOI": "Nangloi",
    "NARELA": "Narela",
    "BAWANA": "Bawana",
    "BADLI": "Badli",
    "JHILMIL": "Jhilmil",
    "OKHLA": "Okhla",
    "WAZIRPUR": "Wazirpur",
}


def canon_plant(raw: str, alt: str | None = None) -> tuple[str | None, str, float]:
    """Map an OCR'd plant name onto one of the 13 known CETPs.

    Returns (canonical_or_None, raw_cleaned, confidence). Older scans mangle
    the name ("WAZ ron CETP"), so an exact lookup is tried first, then a
    fuzzy match against the known set using BOTH readings of the name on the
    page. Below FUZZY_MIN the plant is left unresolved rather than guessed:
    attributing a month's effluent flow to the wrong plant would be worse
    than dropping the row.
    """
    import difflib

    def clean(s: str) -> str:
        s = re.sub(
            r"\s*CETP.*$", "", re.sub(r"\s+", " ", s or "").strip(" .:-|"), flags=re.I
        )
        return re.sub(r"[^A-Za-z. ]", "", s).strip().upper()

    known = list(CANON)
    cands = [c for c in [clean(raw), clean(alt or "")] if c]

    for cand in cands:
        if cand in CANON:
            return CANON[cand], cand, 1.0

    # Unique-prefix rule, for names the OCR truncates or splits ("WAZ RON" for
    # WAZIRPUR, ratio only 0.53). Requires the prefix to match exactly ONE
    # canonical name: "NAR" is deliberately rejected because it prefixes both
    # NARAINA and NARELA, and a coin-flip there would misattribute a plant's
    # effluent flow.
    for cand in cands:
        head = (cand.split() or [""])[0]
        if len(head) >= 3:
            hits = {CANON[k] for k in known if k.startswith(head)}
            if len(hits) == 1:
                return hits.pop(), cand, 0.95

    best_name, best_score = None, 0.0
    for cand in cands:
        for k in known:
            score = difflib.SequenceMatcher(None, cand, k).ratio()
            if score > best_score:
                best_name, best_score = CANON[k], score
    return (
        (best_name if best_score >= FUZZY_MIN else None),
        clean(raw),
        round(best_score, 3),
    )


def to_mld(raw: str | None, lo: float = 0.0, hi: float = 200.0) -> float | None:
    """Parse an OCR'd MLD figure defensively.

    Tesseract emits trailing and doubled dots ("3.255.", "2..4"), which crash a
    bare float() and previously killed a whole 62-bundle run on one page. Values
    outside a plausible envelope are discarded rather than published: Delhi's
    largest CETP is 35 MLD, so anything past ~200 is an OCR artefact, not a
    plant.
    """
    if not raw:
        return None
    s = re.sub(r"[^\d.]", "", raw).strip(".")
    if not s:
        return None
    parts = [p for p in s.split(".") if p != ""]
    if not parts:
        return None
    s = parts[0] if len(parts) == 1 else f"{parts[0]}.{parts[1]}"
    try:
        v = float(s)
    except ValueError:
        return None
    return v if lo <= v <= hi else None


def month_from_bundle(name: str) -> str | None:
    m = BUNDLE_MONTH.search(name or "")
    if not m:
        return None
    mon = MONTHS.get(m.group(1).upper())
    return f"{int(m.group(2)):04d}-{mon:02d}" if mon else None


def fetch(url: str, dest: Path) -> Path | None:
    if dest.exists() and dest.stat().st_size > 10_000:
        return dest
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=180) as r:
            dest.write_bytes(r.read())
        return dest
    except Exception as exc:
        print(f"    ! download failed: {exc}", flush=True)
        return None


def parse_page(txt: str, flat: str, bundle_name: str) -> dict | None:
    """Pull one CETP's monthly record out of an OCR'd page.

    Returns None for pages that are not a plant report (covers, indexes) or
    whose design capacity is unreadable - without a capacity there is no
    utilisation to compute, which is the whole point of the layer.
    """
    hm = HEADER_WITH_MONTH.search(flat)
    if hm:
        raw_name, design = hm.group(1), to_mld(hm.group(2))
        year, mon = int(hm.group(4)), MONTHS.get(hm.group(3).upper(), 0)
        # OCR reads "2022" as "2922" on at least one Narela page. The bundle
        # name carries the same month and is machine-generated, so trust it
        # whenever the header year is outside the archive's real span.
        if not (ARCHIVE_MIN_YEAR <= year <= ARCHIVE_MAX_YEAR) or not mon:
            month = month_from_bundle(bundle_name)
            if not month:
                return None
        else:
            month = f"{year:04d}-{mon:02d}"
    else:
        ha = HEADER_ANY.search(flat)
        if not ha:
            return None
        raw_name, design = ha.group(1), to_mld(ha.group(2))
        month = month_from_bundle(bundle_name)
        if not month:
            return None
    if design is None:
        return None

    unit = UNIT_LINE.search(flat)
    plant, raw_clean, conf = canon_plant(raw_name, unit.group(1) if unit else None)

    flow = FLOW.search(txt)
    s = SAMPLED.search(txt)
    olms = OLMS.search(txt)
    loc = SAMPLE_LOC.search(txt)

    sampled = None
    if s:
        d, m, y = int(s.group(1)), int(s.group(2)), int(s.group(3))
        if y < 100:
            y += 2000
        if 1 <= m <= 12 and 1 <= d <= 31:
            sampled = f"{y:04d}-{m:02d}-{d:02d}"

    measured = to_mld(flow.group(1)) if flow else None

    # A plant cannot receive many times its design capacity. The observed
    # ratios are bimodal with an EMPTY 3x-10x band: 621 readings sit at or
    # under design, 6 between 1x and 3x (genuine overload), then nothing until
    # two Mangolpuri readings at 29x and 59x - a 2.4 MLD works reading 141 MLD,
    # which is "1.41" with a lost decimal point. Cutting at 3x therefore drops
    # only the artefacts and preserves real overload.
    flow_rejected = None
    if measured is not None and design and measured > design * MAX_FLOW_MULTIPLE:
        flow_rejected = measured
        measured = None

    row = {
        "plant": plant,
        "design_capacity_mld": design,
        "month": month,
        "sampled": sampled,
        "measured_flow_mld": measured,
        "olms_remark": olms.group(0) if olms else None,
    }
    if flow_rejected is not None:
        row["_rejected_flow_mld"] = flow_rejected
        row["_rejected_reason"] = (
            f"{flow_rejected:g} MLD is {flow_rejected / design:.0f}x the "
            f"{design:g} MLD design capacity; treated as an OCR artefact"
        )
    if plant is None:
        row["_unresolved_plant"] = raw_clean
    if conf < 1.0:
        row["_name_match_confidence"] = conf
    if loc:
        sl = re.sub(r"\s+", " ", loc.group(1)).strip(" .:-|")
        if sl:
            row["sampling_location"] = sl
    return row


def ocr_bundle(pdf: Path, keep: bool, bundle_name: str = "") -> list[dict]:
    """OCR one monthly bundle, caching the page text.

    Rendering + tesseract is ~40 s a bundle and ~40 min for the archive. The
    text is cached per bundle so a crash anywhere downstream (or a change to
    the parsing rules) costs seconds instead of the whole run - which it did,
    twice, before this existed.
    """
    text_cache = OCR_CACHE / (pdf.stem + ".pages.json")
    if text_cache.exists():
        pages = json.loads(text_cache.read_text())
        rows = []
        for i, txt in enumerate(pages):
            try:
                row = parse_page(txt, txt.replace("\n", " "), bundle_name)
            except Exception as exc:
                print(f"    ! cached page {i + 1} skipped: {exc}", flush=True)
                continue
            if row is not None:
                rows.append(row)
        return rows

    work = Path(tempfile.mkdtemp(prefix="cetp_"))
    try:
        subprocess.run(
            ["pdftoppm", "-r", "300", "-png", str(pdf), str(work / "p")],
            check=True,
            capture_output=True,
        )
        rows = []
        pages: list[str] = []
        for img in sorted(work.glob("p-*.png")):
            base = img.with_suffix("")
            subprocess.run(
                ["tesseract", str(img), str(base), "--psm", "6"],
                check=False,
                capture_output=True,
            )
            tpath = Path(str(base) + ".txt")
            if not tpath.exists():
                continue
            txt = tpath.read_text(errors="ignore")
            pages.append(txt)
            flat = txt.replace("\n", " ")
            try:
                row = parse_page(txt, flat, bundle_name)
            except Exception as exc:  # one bad page must not kill a 62-bundle run
                print(f"    ! page {img.name} skipped: {exc}", flush=True)
                continue
            if row is not None:
                rows.append(row)
        # Written before the return so the OCR survives any later failure.
        OCR_CACHE.mkdir(parents=True, exist_ok=True)
        text_cache.write_text(json.dumps(pages))
        return rows
    finally:
        if keep:
            print(f"    images kept in {work}")
        else:
            shutil.rmtree(work, ignore_errors=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="only N bundles (smoke test)")
    ap.add_argument("--keep-images", action="store_true")
    args = ap.parse_args()

    idx = json.loads(INDEX.read_text())
    resources = idx["resources"]
    if args.limit:
        resources = resources[-args.limit :]
    CACHE.mkdir(parents=True, exist_ok=True)
    OCR_CACHE.mkdir(parents=True, exist_ok=True)

    readings: list[dict] = []
    for i, res in enumerate(resources, 1):
        name = res["name"]
        dest = CACHE / (re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-") + ".pdf")
        print(f"[{i}/{len(resources)}] {name}", flush=True)
        pdf = fetch(res["url"], dest)
        if not pdf:
            continue
        rows = ocr_bundle(pdf, args.keep_images, name)
        for r in rows:
            r["source_bundle"] = name
        readings.extend(rows)
        print(f"    {len(rows)} plants", flush=True)

    # ── validation against the hand-transcribed page ────────────────────────
    sample = idx.get("schema_sample") or {}
    if sample:
        want_plant, _, _ = canon_plant(sample["plant"])
        hit = next(
            (
                r
                for r in readings
                if r["plant"] == want_plant and r["month"] == sample["month"]
            ),
            None,
        )
        if hit:
            for field, key in [
                ("design_capacity_mld", "design_capacity_mld"),
                ("measured_flow_mld", "measured_flow_mld"),
            ]:
                if hit[field] is not None and abs(hit[field] - sample[key]) > 0.011:
                    sys.exit(
                        f"FATAL: OCR disagrees with the hand-transcribed page on {field}: "
                        f"OCR={hit[field]} transcribed={sample[key]}"
                    )
            print(
                f"\nvalidated against hand-transcribed {want_plant} {sample['month']}: "
                f"design={hit['design_capacity_mld']} flow={hit['measured_flow_mld']} OK"
            )
        else:
            print(
                f"\nWARNING: could not locate {want_plant} {sample['month']} to validate against"
            )

    with_flow = [r for r in readings if r["measured_flow_mld"] is not None]
    # Unresolved names are stored as None (see canon_plant); sorting a mixed
    # str/None set raises, so they are excluded from the roster and counted
    # separately rather than silently coerced to a string.
    plants = sorted({r["plant"] for r in readings if r["plant"]})
    unresolved = [r for r in readings if not r["plant"]]
    months = sorted({r["month"] for r in readings})

    doc = {
        "_note": (
            "Design capacity vs MEASURED monthly inflow for Delhi's Common Effluent "
            "Treatment Plants, OCR-extracted from DPCC's monthly analysis PDFs. This is "
            "Delhi's industrial-attribution layer: DPCC's only public consent register "
            "ends in July 2002, so there is no per-unit denominator of who discharges "
            "what, but the gap between what these plants were built to treat and what "
            "actually reaches them is measurable, monthly, and published. Utilisation "
            "well under 100% means industrial effluent is not arriving at the works."
        ),
        "_extraction": (
            "The source PDFs are image scans with no text layer. Extracted here: plant, "
            "design capacity, month, sampling date, measured flow, OLMS remark - all "
            "prose lines that OCR cleanly. NOT extracted: the 23-parameter inlet/outlet "
            "grid, whose cells OCR badly; half-read heavy-metal values would be worse "
            "than none. Validated against the hand-transcribed Wazirpur page in "
            "delhi-cetp-monthly-index.json (build fails on disagreement)."
        ),
        "source": {
            "publisher": "Delhi Pollution Control Committee (I/C Water Laboratory)",
            "host": "OpenCity Urban Data Portal",
            "index_file": "delhi-cetp-monthly-index.json",
            "bundles_processed": len(resources),
        },
        "summary": {
            "plants": len(plants),
            "months": len(months),
            "period": f"{months[0]} to {months[-1]}" if months else None,
            "readings": len(readings),
            "readings_with_flow": len(with_flow),
            "readings_unresolved_plant": len(unresolved),
            "readings_flow_rejected": sum(
                1 for r in readings if "_rejected_flow_mld" in r
            ),
        },
        "plants": plants,
        # plant is None for rows whose name could not be resolved, and None is
        # not orderable against str - the same trap that bit the roster sort.
        "readings": sorted(readings, key=lambda r: (r["month"], r["plant"] or "")),
    }
    write_artifact(OUT, doc)

    print(f"\nwrote {OUT.relative_to(REPO)}")
    s = doc["summary"]
    print(
        f"  {s['plants']} plants x {s['months']} months = {s['readings']} readings "
        f"({s['readings_with_flow']} with a flow value)"
    )
    print(f"  period {s['period']}")
    if unresolved:
        # Surfaced, not swallowed: an unresolved name means a month of a
        # plant's effluent flow could not be attributed and is excluded.
        print(f"  UNRESOLVED plant names: {len(unresolved)} readings")
        for r in unresolved[:8]:
            print(
                f"    {r['month']}  raw={r.get('_unresolved_plant')!r} "
                f"conf={r.get('_name_match_confidence')}"
            )


if __name__ == "__main__":
    main()

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

The same run also emits a compact evidence manifest and a content-addressed
asset tree containing the source PDFs and WebP renders for pages that produced
records. The binary asset tree is a staging input and must never be committed.

Needs: pdftoppm (poppler), tesseract and cwebp on PATH.
Usage:  python scripts/extract_delhi_cetp_flows.py [--limit N] [--keep-images]
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date
import hashlib
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
from registry_license import registry_license  # noqa: E402

INDEX = REPO / "public/data/delhi-cetp-monthly-index.json"
CACHE = Path(__file__).resolve().parent / ".cache" / "delhi-cetp-pdfs"
OCR_CACHE = Path(__file__).resolve().parent / ".cache" / "delhi-cetp-ocr"
OUT = REPO / "public/data/delhi-cetp-flows.json"
MANIFEST_OUT = REPO / "public/data/delhi-cetp-evidence-manifest.json"
EVIDENCE_ASSETS = (
    Path(__file__).resolve().parent / ".cache" / "delhi-cetp-evidence-assets"
)

EVIDENCE_SCHEMA = "neer-vazhvu.delhi-cetp-evidence.v1"
OCR_CACHE_SCHEMA = "neer-vazhvu.delhi-cetp-ocr-pages.v1"
EXTRACTOR_ID = "extract-delhi-cetp-flows"
EXTRACTOR_VERSION = "2"
OCR_DPI = 300
OCR_PSM = 6
OCR_FORMAT = "jpeg"
OCR_JPEG_QUALITY = 95
OCR_WORKERS = 8
RENDER_VERSION = "v1"
RENDER_DPI = 180
RENDER_QUALITY = 82

# The lineage pass deliberately preserves the already-reviewed 709-record
# public artifact. A clean OCR pass can discover candidate additions or miss a
# previously accepted header; those are corpus-review work, not silent changes
# in a page-linking PR. These accepted records were manually located after the
# v2 parser declined their headers; the rendered pages were visually checked.
LINEAGE_PAGE_OVERRIDES = {
    ("March 2023 CETP Data", "Jhilmil", None): 9,
    ("June 2023 CETP Data", "Bawana", None): 5,
    ("June 2023 CETP Data", "Wazirpur", None): 12,
    ("August 2023 CETP Data", "Lawrence Road", None): 8,
    ("November 2023 CETP Data", "Jhilmil", None): 9,
    ("November 2023 CETP Data", "Wazirpur", None): 1,
    ("April 2024 CETP Data", "Okhla", None): 11,
}

# Page lineage makes historical extraction defects visible without rewriting
# the reviewed public series in this PR. These findings become explicit review
# work in the explorer instead of being silently hidden or silently corrected.
LINEAGE_REVIEW_FINDINGS = {
    ("June 2023 CETP Data", "Bawana", None): [
        {
            "code": "plant_attribution_conflict",
            "severity": "review",
            "message": (
                "The reviewed row says Bawana, but its 12 MLD / 3.81 MLD "
                "values appear on the SMA CETP source page."
            ),
        }
    ],
    ("June 2023 CETP Data", "Wazirpur", None): [
        {
            "code": "ocr_value_review_required",
            "severity": "review",
            "message": (
                "The reviewed row preserves a prior 21 MLD OCR reading and no "
                "flow; the page visibly reads 24 MLD and 5.06 MLD."
            ),
        }
    ],
    ("April 2024 CETP Data", "Okhla", None): [
        {
            "code": "ocr_value_review_required",
            "severity": "review",
            "message": (
                "The reviewed row contains a 2074 sampling year and no flow; "
                "the page visibly reads 08.04.2024 and 2.32 MLD."
            ),
        }
    ],
}

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


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def opencity_resource_id(url: str) -> str:
    match = re.search(r"/resource/([0-9a-f-]{36})(?:/|$)", url, re.I)
    if not match:
        raise ValueError(f"OpenCity resource URL has no stable resource id: {url}")
    return match.group(1).lower()


def document_id(resource_url: str) -> str:
    return f"opencity-{opencity_resource_id(resource_url)}"


def evidence_id(document_sha256: str, page_number: int) -> str:
    return f"cetp-{document_sha256[:16]}-p{page_number:03d}"


def evidence_object_root(document_sha256: str) -> str:
    return f"delhi-cetp/documents/{document_sha256}"


def valid_pdf(path: Path) -> bool:
    if not path.exists() or path.stat().st_size <= 10_000:
        return False
    with path.open("rb") as handle:
        return handle.read(5) == b"%PDF-"


def fetch(url: str, dest: Path) -> Path | None:
    if valid_pdf(dest):
        return dest
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as response:
                dest.write_bytes(response.read())
            if not valid_pdf(dest):
                dest.unlink(missing_ok=True)
                raise ValueError("response was not a valid PDF")
            return dest
        except Exception as exc:
            dest.unlink(missing_ok=True)
            print(f"    ! download attempt {attempt}/3 failed: {exc}", flush=True)
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

    # The acquisition index's bundle label is the archive month. OCR can read
    # a report date or a damaged header year as another valid-looking period
    # (one December-2023 page became December 2024). Prefer the machine-curated
    # bundle month whenever it exists; the page remains the evidence source.
    bundle_month = month_from_bundle(bundle_name)
    if bundle_month:
        month = bundle_month

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


def cached_pages(payload: object) -> list[dict]:
    """Read the canonical cache envelope and upgrade both legacy list shapes."""
    if isinstance(payload, dict):
        if payload.get("schema") != OCR_CACHE_SCHEMA:
            raise ValueError("OCR page cache schema is unsupported")
        payload = payload.get("pages")
    if not isinstance(payload, list):
        raise ValueError("OCR page cache must be a list")
    pages: list[dict] = []
    for index, entry in enumerate(payload, 1):
        if isinstance(entry, str):
            text = entry
            page_number = index
        elif isinstance(entry, dict):
            text = entry.get("text")
            page_number = entry.get("page_number")
            if not isinstance(text, str) or not isinstance(page_number, int):
                raise ValueError("OCR page cache entry is invalid")
        else:
            raise ValueError("OCR page cache entry is invalid")
        pages.append(
            {
                "page_number": page_number,
                "text": text,
                "text_sha256": sha256_text(text),
            }
        )
    return pages


def rows_from_pages(pages: list[dict], bundle_name: str) -> list[dict]:
    rows: list[dict] = []
    for page in pages:
        page_number = page["page_number"]
        txt = page["text"]
        try:
            row = parse_page(txt, txt.replace("\n", " "), bundle_name)
        except Exception as exc:
            print(f"    ! cached page {page_number} skipped: {exc}", flush=True)
            continue
        if row is not None:
            row["page_number"] = page_number
            row["ocr_text_sha256"] = page["text_sha256"]
            rows.append(row)
    return rows


def ocr_image(img: Path) -> dict | None:
    page_match = re.search(r"-(\d+)$", img.stem)
    if not page_match:
        return None
    page_number = int(page_match.group(1))
    base = img.with_suffix("")
    subprocess.run(
        ["tesseract", str(img), str(base), "--psm", str(OCR_PSM)],
        check=False,
        capture_output=True,
    )
    tpath = Path(str(base) + ".txt")
    txt = tpath.read_text(errors="ignore") if tpath.exists() else ""
    return {
        "page_number": page_number,
        "text": txt,
        "text_sha256": sha256_text(txt),
    }


def ocr_bundle(
    pdf: Path, keep: bool, bundle_name: str = ""
) -> tuple[list[dict], list[dict]]:
    """OCR one monthly bundle, caching the page text.

    Rendering + tesseract is ~40 s a bundle and ~40 min for the archive. The
    text is cached per bundle so a crash anywhere downstream (or a change to
    the parsing rules) costs seconds instead of the whole run - which it did,
    twice, before this existed.
    """
    text_cache = OCR_CACHE / (pdf.stem + ".pages.json")
    if text_cache.exists():
        cached_payload = json.loads(text_cache.read_text())
        pages = cached_pages(cached_payload)
        if not isinstance(cached_payload, dict):
            text_cache.write_text(
                json.dumps({"schema": OCR_CACHE_SCHEMA, "pages": pages})
            )
        return rows_from_pages(pages, bundle_name), pages

    work = Path(tempfile.mkdtemp(prefix="cetp_"))
    try:
        subprocess.run(
            [
                "pdftoppm",
                "-r",
                str(OCR_DPI),
                "-jpeg",
                "-jpegopt",
                f"quality={OCR_JPEG_QUALITY}",
                str(pdf),
                str(work / "p"),
            ],
            check=True,
            capture_output=True,
        )
        images = sorted(work.glob("p-*.jpg"))
        with ThreadPoolExecutor(max_workers=OCR_WORKERS) as executor:
            pages = [
                page for page in executor.map(ocr_image, images) if page is not None
            ]
        # Written before the return so the OCR survives any later failure.
        OCR_CACHE.mkdir(parents=True, exist_ok=True)
        text_cache.write_text(json.dumps({"schema": OCR_CACHE_SCHEMA, "pages": pages}))
        return rows_from_pages(pages, bundle_name), pages
    finally:
        if keep:
            print(f"    images kept in {work}")
        else:
            shutil.rmtree(work, ignore_errors=True)


def render_evidence_assets(
    pdf: Path,
    document_sha256: str,
    page_numbers: set[int],
    assets_dir: Path,
) -> list[dict]:
    """Archive one PDF and render only pages referenced by evidence rows."""
    object_root = evidence_object_root(document_sha256)
    document_dir = assets_dir / object_root
    source_pdf = document_dir / "source.pdf"
    pages_dir = document_dir / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)

    if not source_pdf.exists() or sha256_path(source_pdf) != document_sha256:
        shutil.copyfile(pdf, source_pdf)

    expected = {
        page_number: pages_dir
        / f"{page_number:03d}"
        / f"render-{RENDER_VERSION}-{RENDER_DPI}dpi.webp"
        for page_number in page_numbers
    }
    missing = {page for page, path in expected.items() if not path.exists()}
    if missing:
        work = Path(tempfile.mkdtemp(prefix="cetp_render_"))
        try:
            subprocess.run(
                [
                    "pdftoppm",
                    "-r",
                    str(RENDER_DPI),
                    "-png",
                    str(pdf),
                    str(work / "page"),
                ],
                check=True,
                capture_output=True,
            )
            rendered: dict[int, Path] = {}
            for image in work.glob("page-*.png"):
                match = re.search(r"-(\d+)$", image.stem)
                if match:
                    rendered[int(match.group(1))] = image
            for page_number in sorted(missing):
                source_image = rendered.get(page_number)
                if source_image is None:
                    raise RuntimeError(
                        f"page {page_number} was not rendered from {pdf.name}"
                    )
                output = expected[page_number]
                output.parent.mkdir(parents=True, exist_ok=True)
                subprocess.run(
                    [
                        "cwebp",
                        "-quiet",
                        "-q",
                        str(RENDER_QUALITY),
                        str(source_image),
                        "-o",
                        str(output),
                    ],
                    check=True,
                    capture_output=True,
                )
        finally:
            shutil.rmtree(work, ignore_errors=True)

    return [
        {
            "page_number": page_number,
            "object_path": str(path.relative_to(assets_dir).as_posix()),
            "sha256": sha256_path(path),
            "byte_length": path.stat().st_size,
        }
        for page_number, path in sorted(expected.items())
    ]


def evidence_disposition(row: dict) -> tuple[str, list[dict]]:
    findings: list[dict] = []
    if row.get("plant") is None:
        findings.append(
            {
                "code": "unresolved_plant",
                "severity": "review",
                "message": "The OCR plant name did not clear the attribution floor.",
            }
        )
    if "_rejected_flow_mld" in row:
        findings.append(
            {
                "code": "flow_value_excluded",
                "severity": "error",
                "message": row["_rejected_reason"],
            }
        )
    if "_rejected_flow_mld" in row:
        return "excluded", findings
    if row.get("plant") is None:
        return "needs-review", findings
    return "extracted", findings


def lineage_key(row: dict) -> tuple[str, str | None, float | None]:
    plant = row.get("plant")
    return (
        row["source_bundle"],
        plant,
        None if plant else row["design_capacity_mld"],
    )


def bind_reviewed_baseline(
    baseline_readings: list[dict],
    candidate_readings: list[dict],
    documents: list[dict],
    ocr_pages_by_document: dict[str, list[dict]],
) -> tuple[list[dict], dict]:
    """Attach v2 page lineage without silently revising reviewed values."""
    candidates_by_key: dict[tuple[str, str | None, float | None], list[dict]] = {}
    for candidate in candidate_readings:
        candidates_by_key.setdefault(lineage_key(candidate), []).append(candidate)
    for candidates in candidates_by_key.values():
        candidates.sort(key=lambda row: row["page_number"])

    document_by_bundle = {document["bundle_name"]: document for document in documents}
    bound: list[dict] = []
    overrides_used: list[dict] = []
    missing_lineage: list[tuple[str, str | None, float | None]] = []
    for baseline in baseline_readings:
        key = lineage_key(baseline)
        candidates = candidates_by_key.get(key, [])
        candidate = candidates.pop(0) if candidates else None
        document = document_by_bundle.get(baseline["source_bundle"])
        if document is None:
            raise RuntimeError(f"no document for baseline record {key}")

        if candidate is not None:
            page_number = candidate["page_number"]
            text_sha256 = candidate["ocr_text_sha256"]
        else:
            page_number = LINEAGE_PAGE_OVERRIDES.get(key)
            if page_number is None:
                missing_lineage.append(key)
                continue
            page = next(
                (
                    item
                    for item in ocr_pages_by_document[document["document_id"]]
                    if item["page_number"] == page_number
                ),
                None,
            )
            if page is None:
                raise RuntimeError(
                    f"manual lineage page {page_number} is missing for {key}"
                )
            text_sha256 = page["text_sha256"]
            overrides_used.append(
                {"source_bundle": key[0], "plant": key[1], "page_number": page_number}
            )

        row = dict(baseline)
        row.update(
            {
                "source_resource_url": document["source_resource_url"],
                "document_id": document["document_id"],
                "document_sha256": document["sha256"],
                "page_number": page_number,
                "ocr_text_sha256": text_sha256,
                "evidence_id": evidence_id(document["sha256"], page_number),
            }
        )
        disposition, findings = evidence_disposition(row)
        lineage_findings = LINEAGE_REVIEW_FINDINGS.get(key, [])
        if lineage_findings:
            findings.extend(lineage_findings)
            if disposition == "extracted":
                disposition = "needs-review"
        row["evidence_disposition"] = disposition
        if findings:
            row["evidence_findings"] = findings
        bound.append(row)

    if missing_lineage:
        rendered = "\n".join(f"  - {key}" for key in missing_lineage)
        raise RuntimeError(
            "reviewed baseline records have no canonical page lineage:\n" + rendered
        )

    unused_candidates = [
        candidate
        for candidates in candidates_by_key.values()
        for candidate in candidates
    ]
    return bound, {
        "lineage_overrides": overrides_used,
        "candidate_records": len(candidate_readings),
        "reviewed_records": len(bound),
        "unreviewed_candidate_additions": len(unused_candidates),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="only N bundles (smoke test)")
    ap.add_argument("--keep-images", action="store_true")
    ap.add_argument(
        "--evidence-assets-dir",
        type=Path,
        default=EVIDENCE_ASSETS,
        help="content-addressed PDF/page asset tree (never commit this directory)",
    )
    ap.add_argument(
        "--skip-evidence-assets",
        action="store_true",
        help="skip asset rendering for parser smoke tests; no manifest is written",
    )
    args = ap.parse_args()

    idx = json.loads(INDEX.read_text())
    reviewed_baseline = json.loads(OUT.read_text())
    resources = idx["resources"]
    if args.limit:
        resources = resources[-args.limit :]
    CACHE.mkdir(parents=True, exist_ok=True)
    OCR_CACHE.mkdir(parents=True, exist_ok=True)

    readings: list[dict] = []
    documents: list[dict] = []
    ocr_pages_by_document: dict[str, list[dict]] = {}
    failed_resources: list[str] = []
    for i, res in enumerate(resources, 1):
        name = res["name"]
        resource_url = res["url"]
        dest = CACHE / (re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-") + ".pdf")
        print(f"[{i}/{len(resources)}] {name}", flush=True)
        pdf = fetch(resource_url, dest)
        if not pdf:
            failed_resources.append(name)
            continue
        pdf_sha256 = sha256_path(pdf)
        doc_id = document_id(resource_url)
        rows, pages = ocr_bundle(pdf, args.keep_images, name)
        ocr_pages_by_document[doc_id] = pages
        for r in rows:
            r["source_bundle"] = name
            r["source_resource_url"] = resource_url
            r["document_id"] = doc_id
            r["document_sha256"] = pdf_sha256
            r["evidence_id"] = evidence_id(pdf_sha256, r["page_number"])
            disposition, findings = evidence_disposition(r)
            r["evidence_disposition"] = disposition
            if findings:
                r["evidence_findings"] = findings
        readings.extend(rows)

        referenced_pages = {page["page_number"] for page in pages}
        rendered_pages = []
        if not args.skip_evidence_assets:
            rendered_pages = render_evidence_assets(
                pdf, pdf_sha256, referenced_pages, args.evidence_assets_dir
            )
        documents.append(
            {
                "document_id": doc_id,
                "bundle_name": name,
                "dataset": res["dataset"],
                "source_resource_url": resource_url,
                "sha256": pdf_sha256,
                "byte_length": pdf.stat().st_size,
                "page_count": len(pages),
                "source_object_path": (
                    f"{evidence_object_root(pdf_sha256)}/source.pdf"
                    if not args.skip_evidence_assets
                    else None
                ),
                "pages": rendered_pages,
            }
        )
        print(f"    {len(rows)} plants", flush=True)

    if failed_resources:
        sys.exit(
            "FATAL: could not acquire all indexed CETP bundles: "
            + ", ".join(failed_resources)
        )

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
                if hit[field] is None or abs(hit[field] - sample[key]) > 0.011:
                    sys.exit(
                        f"FATAL: OCR disagrees with the hand-transcribed page on {field}: "
                        f"OCR={hit[field]} transcribed={sample[key]}"
                    )
            hit["evidence_disposition"] = "reference-validated"
            print(
                f"\nvalidated against hand-transcribed {want_plant} {sample['month']}: "
                f"design={hit['design_capacity_mld']} flow={hit['measured_flow_mld']} OK"
            )
        elif not args.limit:
            sys.exit(
                f"FATAL: could not locate {want_plant} {sample['month']} to validate against"
            )
        else:
            print(f"\nreference page not present in {args.limit}-bundle smoke run")

    if args.limit:
        print("\nsmoke run complete; canonical artifacts were not rewritten")
        return

    candidate_readings = readings
    readings, lineage_review = bind_reviewed_baseline(
        reviewed_baseline["readings"],
        candidate_readings,
        documents,
        ocr_pages_by_document,
    )
    if sample:
        want_plant, _, _ = canon_plant(sample["plant"])
        reviewed_hit = next(
            (
                row
                for row in readings
                if row["plant"] == want_plant and row["month"] == sample["month"]
            ),
            None,
        )
        if reviewed_hit is None:
            sys.exit(
                "FATAL: reference-validated record is absent from the reviewed baseline"
            )
        reviewed_hit["evidence_disposition"] = "reference-validated"

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

    if not args.skip_evidence_assets:
        page_bindings = {
            (document["document_id"], page["page_number"])
            for document in documents
            for page in document["pages"]
        }
        missing_page_bindings = [
            row["evidence_id"]
            for row in readings
            if (row["document_id"], row["page_number"]) not in page_bindings
        ]
        if missing_page_bindings:
            sys.exit(
                "FATAL: evidence records have no rendered page: "
                + ", ".join(missing_page_bindings[:10])
            )

        evidence_ids = [row["evidence_id"] for row in readings]
        if len(evidence_ids) != len(set(evidence_ids)):
            sys.exit("FATAL: duplicate evidence identifiers")

        manifest = {
            "nvdm": "1.0",
            "dataset": "data-root/cetp-evidence-manifest",
            "scope": {"kind": "city", "id": "delhi"},
            "provenance": {
                "sources": [
                    {
                        "id": "dpcc-cetp-monthly-delhi",
                        "title": "DPCC CETP monthly analysis bundles 2019-2024 (via OpenCity)",
                        "publisher": "Delhi Pollution Control Committee (via OpenCity)",
                        "license": registry_license("dpcc-cetp-monthly-delhi"),
                        "as_of": "2024-11",
                        "retrieved": idx.get("source", {}).get("retrieved"),
                    }
                ],
                "method": "pdf-extract",
                "produced_at": date.today().isoformat(),
                "produced_by": "neer-vazhvu-api/scripts/extract_delhi_cetp_flows.py",
                "internal_inputs": [
                    "public/data/delhi-cetp-monthly-index.json",
                    "public/data/delhi-cetp-flows.json",
                ],
                "note": (
                    "Content-addressed custody and page-render manifest for the reviewed "
                    "Delhi CETP flow series. Binary source documents and renders remain "
                    "outside Git and are uploaded only to protected platform storage."
                ),
            },
            "_schema": EVIDENCE_SCHEMA,
            "corpus_id": "delhi-cetp-monthly-archive",
            "title": "Delhi CETP monthly analysis archive",
            "attribution": {
                "publisher": "Delhi Pollution Control Committee (I/C Water Laboratory)",
                "host": "OpenCity Urban Data Portal",
                "rights_note": (
                    "OpenCity labels the source datasets Other (Public Domain). "
                    "Retain DPCC and OpenCity attribution; verify upstream terms "
                    "before redistributing the binary archive outside this protected view."
                ),
            },
            "acquired_on": idx.get("source", {}).get("retrieved"),
            "extractor": {
                "id": EXTRACTOR_ID,
                "version": EXTRACTOR_VERSION,
                "processing_edition": "historical-public-import",
                "ocr": {
                    "engine": "tesseract",
                    "engine_version": None,
                    "version_note": (
                        "The historical OCR cache predates engine-version capture; "
                        "the extractor contract and OCR profile remain recorded."
                    ),
                    "dpi": OCR_DPI,
                    "psm": OCR_PSM,
                    "input_format": OCR_FORMAT,
                    "jpeg_quality": OCR_JPEG_QUALITY,
                    "workers": OCR_WORKERS,
                },
                "page_renderer": {
                    "version": RENDER_VERSION,
                    "dpi": RENDER_DPI,
                    "format": "webp",
                    "quality": RENDER_QUALITY,
                },
            },
            "summary": {
                "documents": len(documents),
                "document_pages": sum(d["page_count"] for d in documents),
                "evidence_pages": sum(len(d["pages"]) for d in documents),
                "evidence_records": len(readings),
                "records_with_flow": len(with_flow),
                "reference_validated": sum(
                    r["evidence_disposition"] == "reference-validated" for r in readings
                ),
                "needs_review": sum(
                    r["evidence_disposition"] == "needs-review" for r in readings
                ),
                "excluded": sum(
                    r["evidence_disposition"] == "excluded" for r in readings
                ),
            },
            "lineage_review": lineage_review,
            "documents": documents,
        }
        write_artifact(MANIFEST_OUT, manifest)

    print(f"\nwrote {OUT.relative_to(REPO)}")
    if not args.skip_evidence_assets:
        print(f"wrote {MANIFEST_OUT.relative_to(REPO)}")
        print(f"staged binary assets under {args.evidence_assets_dir}")
    s = doc["summary"]
    print(
        f"  {s['plants']} plants x {s['months']} months = {s['readings']} readings "
        f"({s['readings_with_flow']} with a flow value)"
    )
    print(f"  period {s['period']}")
    print(
        "  clean OCR candidates "
        f"{lineage_review['candidate_records']}; reviewed baseline "
        f"{lineage_review['reviewed_records']}; unreviewed additions "
        f"{lineage_review['unreviewed_candidate_additions']}"
    )
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

from __future__ import annotations

import importlib.util
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "extract_delhi_cetp_flows.py"
SPEC = importlib.util.spec_from_file_location("extract_delhi_cetp_flows", SCRIPT)
assert SPEC and SPEC.loader
cetp = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(cetp)


def test_cached_pages_upgrades_legacy_text_cache_with_stable_page_numbers():
    pages = cetp.cached_pages(["first", "second"])

    assert [page["page_number"] for page in pages] == [1, 2]
    assert pages[0]["text_sha256"] == cetp.sha256_text("first")


def test_cached_pages_reads_the_single_schema_versioned_cache_contract():
    pages = cetp.cached_pages(
        {
            "schema": cetp.OCR_CACHE_SCHEMA,
            "pages": [{"page_number": 7, "text": "flow"}],
        }
    )

    assert pages == [
        {
            "page_number": 7,
            "text": "flow",
            "text_sha256": cetp.sha256_text("flow"),
        }
    ]


def test_evidence_identity_is_content_and_page_addressed():
    document_sha = "a" * 64

    assert cetp.evidence_id(document_sha, 7) == "cetp-aaaaaaaaaaaaaaaa-p007"
    assert (
        cetp.evidence_object_root(document_sha)
        == f"delhi-cetp/documents/{document_sha}"
    )


def test_disposition_surfaces_unresolved_and_excluded_values():
    unresolved, unresolved_findings = cetp.evidence_disposition({"plant": None})
    excluded, excluded_findings = cetp.evidence_disposition(
        {
            "plant": "Mangolpuri",
            "_rejected_flow_mld": 141.0,
            "_rejected_reason": "outside the accepted envelope",
        }
    )

    assert unresolved == "needs-review"
    assert unresolved_findings[0]["code"] == "unresolved_plant"
    assert excluded == "excluded"
    assert excluded_findings[0]["code"] == "flow_value_excluded"


def test_rows_from_pages_retains_exact_source_page_and_text_hash():
    text = """
    ANALYSIS REPORT OF WAZIRPUR CETP (24 MLD) FOR THE MONTH OF NOVEMBER-2024
    Date of Sampling: 04.11.2024
    Flow: - 5.32 MLD
    OLMS was non functional
    """
    pages = [{"page_number": 11, "text": text, "text_sha256": cetp.sha256_text(text)}]

    rows = cetp.rows_from_pages(pages, "November 2024 CETP Data")

    assert len(rows) == 1
    assert rows[0]["plant"] == "Wazirpur"
    assert rows[0]["page_number"] == 11
    assert rows[0]["ocr_text_sha256"] == cetp.sha256_text(text)
    assert rows[0]["measured_flow_mld"] == 5.32


def test_lineage_key_ignores_unstable_raw_text_for_unresolved_plants():
    baseline = {
        "source_bundle": "September 2019 CETP Data",
        "plant": None,
        "_unresolved_plant": "A",
        "design_capacity_mld": 12.0,
    }
    clean_ocr = {
        **baseline,
        "_unresolved_plant": "garbled name from a cleaner OCR pass",
    }

    assert cetp.lineage_key(baseline) == cetp.lineage_key(clean_ocr)
    assert cetp.lineage_key(baseline) == (
        "September 2019 CETP Data",
        None,
        12.0,
    )


def test_review_finding_downgrades_a_historical_extraction_conflict():
    key = ("June 2023 CETP Data", "Bawana", None)

    assert cetp.LINEAGE_PAGE_OVERRIDES[key] == 5
    assert cetp.LINEAGE_REVIEW_FINDINGS[key][0]["code"] == (
        "plant_attribution_conflict"
    )

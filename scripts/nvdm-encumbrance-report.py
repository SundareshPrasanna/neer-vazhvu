#!/usr/bin/env python3
"""NVDM licence-encumbrance report (serving-hardening P0).

Walks every enveloped artifact in the dataset catalogue, resolves each
provenance source's licence terms (registry entry for id-carrying sources,
inline `license` for closed sources), and buckets them:

  nc              non-commercial family (CC BY-NC, CC BY-NC-SA, HydroSHEDS
                  wording, "presume non-commercial")
  share-alike     ODbL / CC BY-SA and other copyleft-on-data terms
  third-party     copyrighted works we cite ((c) Praja, academic papers,
                  NGO/IGO reports) - quotable with citation, not ours to
                  relicense or mirror in bulk
  vague           no stated licence / unrecorded terms - unverifiable
  gov-attribution government publications cited with attribution
  clean-open      explicit open terms (CC BY, public domain, GODL, ODC-BY,
                  open-access, OpenCity-open)

An artifact's status is its WORST source bucket (nc worst, clean-open best).
Methodology-role sources are skipped: a method is cited, not redistributed
(same rule the L3 licence check applies).

This is the mechanical basis for NC-free corpus editions: an artifact is
licence-clean when every non-methodology source lands in gov-attribution or
clean-open.

Usage:
  python3 scripts/nvdm-encumbrance-report.py             # full report
  python3 scripts/nvdm-encumbrance-report.py --list nc   # artifact list for one bucket
  python3 scripts/nvdm-encumbrance-report.py --json      # machine-readable output

Exit nonzero if any enveloped source id has no registry match (lineage bug)
or a licence string cannot be classified (extend BUCKET_RULES - the fallback
is deliberately loud, never silently clean).

Stdlib only. Run scripts/build_dataset_catalogue.py first.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = ROOT / "docs/architecture/dataset-catalogue.json"
REGISTRY_DIR = ROOT / "scripts/source-registry"

# Worst -> best. An artifact inherits the worst bucket among its sources.
BUCKET_ORDER = [
    "nc",
    "share-alike",
    "third-party",
    "vague",
    "gov-attribution",
    "clean-open",
]

BUCKET_DESC = {
    "nc": "non-commercial family (CC BY-NC / BY-NC-SA, HydroSHEDS wording, presumed-NC)",
    "share-alike": "share-alike / copyleft-on-data (ODbL, CC BY-SA)",
    "third-party": "third-party copyrighted works cited ((c) reports, academic papers)",
    "vague": "no stated licence or unrecorded terms - unverifiable",
    "gov-attribution": "government publications cited with attribution",
    "clean-open": "explicit open terms (CC BY, public domain, GODL, open access)",
}

GOV_MARKERS = (
    "government",
    "goi ",
    "goi,",
    "gotn",
    "gnctd",
    "gok",
    "gazette",
    "election result",
    "delimitation record",
    "municipal",
    "tamil nadu government portal",
)


def classify(license_str: str | None) -> str:
    """Map a licence string to a bucket. Order matters: encumbrance markers
    are checked before open markers so dual/derived wordings fail closed."""
    if not license_str or not license_str.strip():
        return "vague"
    s = license_str.lower()
    # 1. Non-commercial family. HydroSHEDS' own wording is "free for
    #    non-commercial and most uses" - NC-encumbered for our purposes.
    if re.search(r"\bnc\b", s) or "non-commercial" in s or "noncommercial" in s:
        return "nc"
    # 2. Share-alike / database copyleft. A dual grant that INCLUDES ODbL is
    #    treated share-alike unless the trace records which grant was used.
    if "odbl" in s or "by-sa" in s or "share-alike" in s or "sharealike" in s:
        return "share-alike"
    # 3. Explicitly vague / unrecorded terms - before open markers, so
    #    "open WFS, no explicit licence stated" fails closed.
    if (
        "no stated licence" in s
        or "no stated license" in s
        or "no explicit licence" in s
        or "no explicit license" in s
        or "unrecorded" in s
        or "presume" in s
        or "registration-gated" in s
    ):
        return "vague"
    # 4. Third-party copyright marks.
    if "(c)" in s or "©" in s or "copyright" in s:
        return "third-party"
    # 5. Explicit open grants.
    if (
        re.search(r"\bcc\s*by\b", s)
        or "cc0" in s
        or "public domain" in s
        or "public-domain" in s
        or "open data license" in s
        or "godl" in s
        or "odc-by" in s
        or "cdla-permissive" in s
        or "open access" in s
        or "free and open" in s
        or "free for research" in s
        or s.startswith("open (per opencity")
        or "other (public domain)" in s
    ):
        return "clean-open"
    # 6. Government publications cited with attribution.
    cited = (
        "attribution" in s
        or "cited" in s
        or "public data" in s
        or "public feed" in s
        or "mirrored openly" in s
        or "public project document" in s
    )
    if cited and any(m in s for m in GOV_MARKERS):
        return "gov-attribution"
    # 7. Non-government works we cite (academic, IGO, NGO, press).
    if cited:
        return "third-party"
    # Fallback: unknown wording is a classification gap, not silently clean.
    return "UNCLASSIFIED"


def worst(buckets: set[str]) -> str:
    for b in BUCKET_ORDER:
        if b in buckets:
            return b
    return "clean-open"


def registry_licenses() -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for f in sorted(REGISTRY_DIR.glob("*.json")):
        for s in json.loads(f.read_text()).get("sources", []):
            if s.get("id"):
                out[s["id"]] = s.get("license")
    return out


def assess_corpus() -> tuple[list[dict], list[str], list[str]]:
    """Returns (artifact results, lineage errors, unclassified licence strings)."""
    reg = registry_licenses()
    cat = json.loads(CATALOGUE.read_text())
    results: list[dict] = []
    lineage_errors: list[str] = []
    unclassified: set[str] = set()

    for rec in cat["files"]:
        try:
            doc = json.loads((ROOT / rec["path"]).read_text())
        except Exception:  # noqa: BLE001 - unparseable files are the validator's problem
            continue
        if not isinstance(doc, dict) or "nvdm" not in doc:
            continue
        source_buckets: set[str] = set()
        detail: list[dict] = []
        for s in doc.get("provenance", {}).get("sources", []):
            if not isinstance(s, dict) or s.get("role") == "methodology":
                continue
            licences: list[str | None] = []
            sid = s.get("id")
            if sid:
                if sid not in reg:
                    lineage_errors.append(
                        f"{rec['path']}: source id '{sid}' has no registry match"
                    )
                    continue
                licences.append(reg[sid])
            if s.get("license"):
                licences.append(s["license"])
            if not licences:
                licences.append(None)
            buckets = set()
            for lic in licences:
                b = classify(lic)
                if b == "UNCLASSIFIED":
                    unclassified.add(lic or "")
                    b = "vague"
                buckets.add(b)
            w = worst(buckets)
            source_buckets.add(w)
            detail.append(
                {
                    "id": sid,
                    "title": s.get("title"),
                    "bucket": w,
                    "licenses": [lic for lic in licences if lic],
                }
            )
        status = worst(source_buckets) if source_buckets else "clean-open"
        results.append(
            {
                "path": rec["path"],
                "family": rec["family"],
                "scope": rec["scope"],
                "status": status,
                "sources": detail,
            }
        )
    return results, lineage_errors, sorted(unclassified)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument(
        "--list",
        metavar="BUCKET",
        help="print artifact paths whose worst bucket is BUCKET",
    )
    args = ap.parse_args(argv)

    results, lineage_errors, unclassified = assess_corpus()

    if args.json:
        print(
            json.dumps(
                {"artifacts": results, "lineage_errors": lineage_errors}, indent=1
            )
        )
    elif args.list:
        if args.list not in BUCKET_ORDER:
            print(
                f"unknown bucket '{args.list}' (choose from {BUCKET_ORDER})",
                file=sys.stderr,
            )
            return 2
        for r in results:
            if r["status"] == args.list:
                print(r["path"])
    else:
        by_bucket: dict[str, list[dict]] = defaultdict(list)
        for r in results:
            by_bucket[r["status"]].append(r)
        print(
            f"# NVDM licence-encumbrance report - {len(results)} enveloped artifacts\n"
        )
        for b in BUCKET_ORDER:
            arts = by_bucket.get(b, [])
            print(f"## {b} ({len(arts)}) - {BUCKET_DESC[b]}")
            for r in sorted(arts, key=lambda x: x["path"]):
                culprits = sorted(
                    {
                        (d["id"] or (d["title"] or "?")[:40])
                        for d in r["sources"]
                        if d["bucket"] == b
                        and b not in ("gov-attribution", "clean-open")
                    }
                )
                suffix = f"  [{', '.join(culprits)}]" if culprits else ""
                print(f"  {r['path']}{suffix}")
            print()
        clean = sum(
            len(by_bucket.get(b, [])) for b in ("gov-attribution", "clean-open")
        )
        print(
            f"licence-clean (gov-attribution or clean-open): {clean} / {len(results)}"
        )

    ok = True
    if lineage_errors:
        ok = False
        print(
            "\nLINEAGE ERRORS (enveloped source id with no registry match):",
            file=sys.stderr,
        )
        for e in lineage_errors:
            print(f"  {e}", file=sys.stderr)
    if unclassified:
        ok = False
        print(
            "\nUNCLASSIFIED licence strings (extend BUCKET_RULES in classify()):",
            file=sys.stderr,
        )
        for u in unclassified:
            print(f"  {u!r}", file=sys.stderr)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

#!/usr/bin/env python3
"""NVDM licence-encumbrance report (serving-hardening P0).

Walks every enveloped artifact in the dataset catalogue, resolves each
provenance source's licence terms (registry entry for id-carrying sources,
inline `license` for closed sources), and buckets them:

  restricted      explicitly restrictive terms (no-derivatives, research-only,
                  all-rights-reserved, evaluation-only, no-redistribution)
  nc              non-commercial family (CC BY-NC, CC BY-NC-SA, HydroSHEDS
                  wording, "presume non-commercial")
  share-alike     ODbL / CC BY-SA and other copyleft-on-data terms
  third-party     copyrighted works we cite ((c) Praja, academic papers,
                  NGO/IGO reports) - quotable with citation, not ours to
                  relicense or mirror in bulk
  vague           no stated licence, unrecorded terms, generic access language
                  without a canonical grant, unaudited per-record citations,
                  or undeclared/unprovable internal lineage - unverifiable
  gov-attribution government publications cited with attribution
  clean-open      canonical open grants only (CC BY variants, CC0, public
                  domain, GODL-India, ODC-BY, CDLA-Permissive, plus the
                  specific verified wordings already in the registries)

An artifact's status is the WORST bucket across its own sources AND its
declared internal lineage, propagated recursively (cycle-safe) through
`provenance.internal_inputs` - mirroring the validator's dependency-floor
taint semantics (scripts/validate_nvdm.py):

  - derived/gee/mixed artifacts that do not declare internal_inputs are
    lineage-unknown and can never be better than 'vague';
  - a declared internal input that is not an enveloped artifact makes the
    dependent 'vague' (licence unprovable); an input path absent from the
    catalogue entirely, or a lineage cycle, is a LOUD audit error;
  - empty non-methodology sources are clean ONLY for explicitly
    self-authored artifacts (provenance.produced_by present, exactly the
    validator's empty-sources rule); claim-dataset compilations rest on
    per-record citations this audit does not read, so they stay 'vague'.

Methodology-role sources are skipped: a method is cited, not redistributed
(same rule the L3 licence check applies).

This is the mechanical basis for NC-free corpus editions: an artifact is
licence-clean when it lands in gov-attribution or clean-open under all of
the rules above.

Usage:
  python3 scripts/nvdm-encumbrance-report.py             # full report
  python3 scripts/nvdm-encumbrance-report.py --list nc   # artifact list for one bucket
  python3 scripts/nvdm-encumbrance-report.py --json      # machine-readable output
  python3 scripts/nvdm-encumbrance-report.py --selftest  # classifier + lineage unit tests

Exit nonzero if any enveloped source id has no registry match (lineage bug),
an artifact in the catalogue cannot be read or parsed (a file the audit
cannot read is a failure, not an omission), an internal_inputs path does not
exist in the catalogue, lineage is cyclic, or a licence string cannot be
classified (the fallback is deliberately loud, never silently clean).

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

sys.path.insert(0, str(ROOT / "scripts"))
from validate_nvdm import CLAIM_DATASETS  # noqa: E402 - single source of truth

# Worst -> best. An artifact inherits the worst bucket among its sources
# and its internal lineage.
BUCKET_ORDER = [
    "restricted",
    "nc",
    "share-alike",
    "third-party",
    "vague",
    "gov-attribution",
    "clean-open",
]

CLEAN_BUCKETS = ("gov-attribution", "clean-open")

BUCKET_DESC = {
    "restricted": "explicitly restrictive terms (ND, research-only, all-rights-reserved)",
    "nc": "non-commercial family (CC BY-NC / BY-NC-SA, HydroSHEDS wording, presumed-NC)",
    "share-alike": "share-alike / copyleft-on-data (ODbL, CC BY-SA)",
    "third-party": "third-party copyrighted works cited ((c) reports, academic papers)",
    "vague": "unverifiable: no stated/canonical licence, unaudited per-record citations, or unproven lineage",
    "gov-attribution": "government publications cited with attribution",
    "clean-open": "canonical open grants (CC BY, public domain, GODL, CDLA-Permissive)",
}

LINEAGE_METHODS = ("derived", "gee", "mixed")

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

# Exact verified wordings already present in the registries. Generic access
# language ("open", "free", "open access") is NOT clean without one of these
# or a canonical identifier - it falls through to vague.
EXACT_CLEAN_WORDINGS = (
    # Named provider grant, wording verified at the source. Generic access
    # language ("open", "free and open", portal labels) is NOT here - it
    # classifies vague until counsel or a source-verified named grant
    # upgrades the registry string (PR #221 review round 2: the mechanical
    # gate must not pre-empt the pending counsel question on OpenCity's
    # dataset-page "open" label).
    "copernicus free and open data, attribution required",
)


def classify(license_str: str | None) -> str:
    """Map a licence string to a bucket, fail-closed: restrictive markers are
    checked FIRST, clean requires a canonical grant or a verified exact
    wording, and anything unmatched is UNCLASSIFIED (a loud audit error)."""
    if not license_str or not license_str.strip():
        return "vague"
    s = license_str.lower()
    # 1. Explicitly restrictive terms - before anything that could look open,
    #    so "open access; all rights reserved" and "CC BY-ND" fail closed.
    if (
        re.search(r"\bnd\b", s)
        or "no-deriv" in s
        or "noderiv" in s
        or "research only" in s
        or "research-only" in s
        or "for research" in s
        or "all rights reserved" in s
        or "evaluation only" in s
        or "for evaluation" in s
        or "no redistribution" in s
        or "not be redistributed" in s
    ):
        return "restricted"
    # 2. Non-commercial family. HydroSHEDS' own wording is "free for
    #    non-commercial and most uses" - NC-encumbered for our purposes.
    if re.search(r"\bnc\b", s) or "non-commercial" in s or "noncommercial" in s:
        return "nc"
    # 3. Share-alike / database copyleft. A dual grant that INCLUDES ODbL is
    #    treated share-alike unless the trace records which grant was used.
    if "odbl" in s or "by-sa" in s or "share-alike" in s or "sharealike" in s:
        return "share-alike"
    # 4. Verified exact provider wordings (full-string / ";"-suffixed match
    #    only, so they cannot shadow the generic-language rules below).
    if any(s == w or s.startswith(w + ";") for w in EXACT_CLEAN_WORDINGS):
        return "clean-open"
    # 5. Explicitly vague / unrecorded terms AND generic access language -
    #    before open markers, so "open WFS, no explicit licence stated"
    #    fails closed and portal labels like OpenCity's dataset-page "open"
    #    stay unverifiable until counsel or a named grant upgrades them.
    if (
        "no stated licence" in s
        or "no stated license" in s
        or "no explicit licence" in s
        or "no explicit license" in s
        or "unrecorded" in s
        or "presume" in s
        or "registration-gated" in s
        or s.startswith("open (per opencity dataset page)")
        or "free and open" in s
    ):
        return "vague"
    # 6. Third-party copyright marks.
    if "(c)" in s or "©" in s or "copyright" in s:
        return "third-party"
    # 7. Canonical open grants ONLY.
    #    (CC BY-NC/-SA/-ND variants were already caught above.)
    if (
        re.search(r"\bcc[-\s]?by\b", s)
        or re.search(r"\bcc0\b", s)
        or "public domain" in s
        or "public-domain" in s
        or "government open data license" in s
        or "godl" in s
        or "odc-by" in s
        or "cdla-permissive" in s
    ):
        return "clean-open"
    # 8. Government publications cited with attribution.
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
    # 8. Non-government works we cite (academic, IGO, NGO, press).
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


def own_assessment(
    rec: dict, doc: dict, reg: dict, audit_errors: list[str], unclassified: set[str]
) -> tuple[str, list[dict], list[str]]:
    """Artifact's own-source bucket (before lineage): (status, source detail, notes)."""
    prov = doc.get("provenance", {})
    notes: list[str] = []
    source_buckets: set[str] = set()
    detail: list[dict] = []
    sources = [
        s
        for s in prov.get("sources", [])
        if isinstance(s, dict) and s.get("role") != "methodology"
    ]
    for s in sources:
        licences: list[str | None] = []
        sid = s.get("id")
        if sid:
            if sid not in reg:
                audit_errors.append(
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
    if source_buckets:
        return worst(source_buckets), detail, notes
    # Empty non-methodology sources: clean ONLY for explicitly self-authored
    # artifacts (validator rule: produced_by names the producer). Claim
    # compilations rest on per-record citations this audit does not read.
    dataset = f"{rec['family']}/{rec['dataset']}"
    if dataset in CLAIM_DATASETS:
        notes.append(
            "claim compilation: licence rests on unaudited per-record citations"
        )
        return "vague", detail, notes
    if prov.get("produced_by"):
        notes.append(f"self-authored ({prov.get('produced_by')})")
        return "clean-open", detail, notes
    notes.append("empty sources without produced_by - unverifiable")
    return "vague", detail, notes


def assess_corpus() -> tuple[list[dict], list[str], list[str]]:
    """Returns (artifact results, audit errors, unclassified licence strings).

    Status = worst(own sources, declared internal lineage), propagated
    recursively and cycle-safe through provenance.internal_inputs.
    """
    reg = registry_licenses()
    cat = json.loads(CATALOGUE.read_text())
    audit_errors: list[str] = []
    unclassified: set[str] = set()
    catalogue_paths = {r["path"] for r in cat["files"]}

    docs: dict[str, dict] = {}
    recs: dict[str, dict] = {}
    for rec in cat["files"]:
        try:
            doc = json.loads((ROOT / rec["path"]).read_text())
        except Exception as e:  # noqa: BLE001
            # A file the audit cannot read is a FAILURE, not an omission.
            audit_errors.append(f"{rec['path']}: unreadable ({e})")
            continue
        if isinstance(doc, dict) and "nvdm" in doc:
            docs[rec["path"]] = doc
            recs[rec["path"]] = rec

    own: dict[str, tuple[str, list[dict], list[str]]] = {
        p: own_assessment(recs[p], docs[p], reg, audit_errors, unclassified)
        for p in docs
    }

    # Recursive worst-status propagation through internal_inputs, cycle-safe.
    final: dict[str, str] = {}
    lineage_notes: dict[str, list[str]] = defaultdict(list)
    visiting: set[str] = set()

    def resolve(path: str, chain: tuple[str, ...]) -> str:
        if path in final:
            return final[path]
        if path in visiting:
            audit_errors.append(
                "lineage cycle: " + " -> ".join(chain[chain.index(path) :] + (path,))
            )
            return "vague"
        visiting.add(path)
        doc = docs[path]
        prov = doc.get("provenance", {})
        status, _, _ = own[path]
        buckets = {status}
        ii = prov.get("internal_inputs")
        if prov.get("method") in LINEAGE_METHODS and ii is None:
            # Validator taint semantics: undeclared lineage on a derived/gee/
            # mixed artifact is lineage-unknown - never provably clean.
            buckets.add("vague")
            lineage_notes[path].append(
                "lineage undeclared (derived/gee/mixed without internal_inputs)"
            )
        for dep in ii or []:
            if dep in docs:
                dep_status = resolve(dep, chain + (path,))
                buckets.add(dep_status)
                if dep_status not in CLEAN_BUCKETS:
                    lineage_notes[path].append(f"inherits '{dep_status}' from {dep}")
            elif dep in catalogue_paths:
                buckets.add("vague")
                lineage_notes[path].append(
                    f"input {dep} is not enveloped - licence unprovable"
                )
            else:
                audit_errors.append(
                    f"{path}: internal_inputs path '{dep}' is not in the catalogue"
                )
                buckets.add("vague")
        visiting.discard(path)
        final[path] = worst(buckets)
        return final[path]

    for p in docs:
        resolve(p, ())

    results = [
        {
            "path": p,
            "family": recs[p]["family"],
            "scope": recs[p]["scope"],
            "status": final[p],
            "own_status": own[p][0],
            "sources": own[p][1],
            "notes": own[p][2] + lineage_notes.get(p, []),
        }
        for p in docs
    ]
    return results, audit_errors, sorted(unclassified)


def selftest() -> int:
    fails: list[str] = []

    def check(name: str, cond: bool) -> None:
        print(f"{name}: {'OK' if cond else 'FAIL'}")
        if not cond:
            fails.append(name)

    # ---- classifier: the three confirmed review misclassifications.
    check(
        "'free for research only' is not clean",
        classify("free for research only") == "restricted",
    )
    check(
        "'open access; all rights reserved' is not clean",
        classify("open access; all rights reserved") == "restricted",
    )
    check("'CC BY-ND 4.0' is not clean", classify("CC BY-ND 4.0") == "restricted")
    # Restrictive markers take precedence over any open-looking language.
    check(
        "restrictive marker beats canonical CC BY",
        classify("CC BY 4.0, for evaluation only") == "restricted",
    )
    check("NC beats CC BY", classify("dual: CC BY 4.0 or CC BY-NC 4.0") == "nc")
    check(
        "ODbL in a dual grant stays share-alike",
        classify("CC BY 4.0 / ODbL") == "share-alike",
    )
    # Generic access language without a canonical identifier is vague.
    check(
        "bare 'open access' is vague, not clean",
        classify("open access") == "UNCLASSIFIED" or classify("open access") == "vague",
    )
    check(
        "bare 'free and open' is not clean", classify("free and open") != "clean-open"
    )
    # Canonical grants still classify clean.
    check("CC BY 4.0 clean", classify("CC BY 4.0") == "clean-open")
    check(
        "ADB CC BY 3.0 IGO clean",
        classify("ADB open access (CC BY 3.0 IGO)") == "clean-open",
    )
    check(
        "GODL-India clean",
        classify("Government Open Data License - India") == "clean-open",
    )
    check(
        "USGS public domain clean",
        classify("USGS public domain, courtesy attribution") == "clean-open",
    )
    check("CDLA-Permissive clean", classify("CDLA-Permissive 2.0") == "clean-open")
    # Review round 2: OpenCity's dataset-page "open" label is generic portal
    # access language - vague until counsel rules on it (counsel brief Q5).
    # The mechanical gate must not pre-empt that answer.
    check(
        "OpenCity 'open' portal label is vague, not clean",
        classify("open (per OpenCity dataset page)") == "vague",
    )
    check(
        "OpenCity 'open' label with ';' qualifier is vague too",
        classify(
            "open (per OpenCity dataset page); underlying assessment is CGWB + state GW departments"
        )
        == "vague",
    )
    check(
        "generic 'free and open, attribution required' is vague",
        classify("free and open, attribution required") == "vague",
    )
    check(
        "verified Copernicus wording (JRC GSW) stays clean",
        classify(
            "Copernicus free and open data, attribution required; download page: "
            "'All data here is produced under the Copernicus Programme and is provided "
            "free of charge, without restriction of use'"
        )
        == "clean-open",
    )
    check(
        "HydroSHEDS wording is nc",
        classify(
            "HydroSHEDS licence (free for non-commercial and most uses, attribution required)"
        )
        == "nc",
    )
    check(
        "no-stated-licence is vague",
        classify(
            "BMC government portal API, no stated licence - cited with attribution"
        )
        == "vague",
    )
    check(
        "(c) Praja is third-party",
        classify("report (c) Praja, RTI-sourced tables; OpenCity mirror")
        == "third-party",
    )
    check(
        "gov publication cited is gov-attribution",
        classify("TN government publication, cited with attribution")
        == "gov-attribution",
    )
    check(
        "empty licence is vague",
        classify(None) == "vague" and classify("  ") == "vague",
    )

    # ---- every distinct licence string currently in the registries must
    # classify (registry drift the classifier cannot handle breaks CI).
    reg_strings = {v for v in registry_licenses().values() if v}
    unhandled = sorted(s for s in reg_strings if classify(s) == "UNCLASSIFIED")
    check(
        f"all {len(reg_strings)} distinct registry licence strings classify",
        not unhandled,
    )
    for s in unhandled:
        print(f"  UNCLASSIFIED: {s!r}")

    # ---- lineage propagation semantics on the real corpus rules.
    # Synthetic checks against own_assessment/worst orderings.
    check(
        "worst() ranks restricted above nc", worst({"nc", "restricted"}) == "restricted"
    )
    check(
        "worst() ranks share-alike above vague",
        worst({"vague", "share-alike"}) == "share-alike",
    )
    check(
        "worst() ranks vague above gov-attribution",
        worst({"gov-attribution", "vague"}) == "vague",
    )

    # Real-corpus invariants for the review findings: inheritance through
    # internal_inputs and the empty-source rules.
    results, audit_errors, unclassified = assess_corpus()
    by = {r["path"]: r for r in results}

    r = by.get("public/data/ward-risk-delhi.json")
    check(
        "ward-risk-delhi inherits share-alike from delhi-ward-profiles",
        r is not None and r["status"] == "share-alike",
    )
    r = by.get("public/data/restoration-priority-delhi.json")
    check(
        "restoration-priority-delhi inherits share-alike from OSM water bodies",
        r is not None and r["status"] == "share-alike",
    )
    r = by.get("public/data/facts-madurai.json")
    check(
        "facts-madurai transitively inherits share-alike via internal_inputs",
        r is not None and r["status"] == "share-alike",
    )
    r = by.get("public/data/water-bodies-lost-madurai.json")
    check(
        "empty-source claim compilation stays vague (not clean)",
        r is not None and r["status"] == "vague",
    )
    r = by.get("public/data/gee-phase1-water-body-targets-madurai.json")
    check(
        "self-authored empty-source artifact stays clean",
        r is not None and r["status"] == "clean-open",
    )
    check(
        "undeclared derived/gee lineage is never clean",
        all(
            r["status"] not in CLEAN_BUCKETS
            for r in results
            if any("lineage undeclared" in n for n in r["notes"])
        ),
    )
    check("real-corpus audit is error-free", not audit_errors and not unclassified)

    print(f"{'FAIL' if fails else 'OK'}: {len(fails)} failures")
    return 1 if fails else 0


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
    ap.add_argument(
        "--selftest", action="store_true", help="classifier + lineage unit tests"
    )
    args = ap.parse_args(argv)

    if args.selftest:
        return selftest()

    results, audit_errors, unclassified = assess_corpus()

    if args.json:
        print(
            json.dumps({"artifacts": results, "audit_errors": audit_errors}, indent=1)
        )
    elif args.list:
        if args.list not in BUCKET_ORDER:
            print(
                f"unknown bucket '{args.list}' (choose from {BUCKET_ORDER})",
                file=sys.stderr,
            )
            return 2
        for r in sorted(results, key=lambda x: x["path"]):
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
                        if d["bucket"] == b and b not in CLEAN_BUCKETS
                    }
                )
                for n in r["notes"]:
                    if b not in CLEAN_BUCKETS and (
                        "inherits" in n
                        or "lineage" in n
                        or "unaudited" in n
                        or "unprovable" in n
                    ):
                        culprits.append(n)
                suffix = f"  [{'; '.join(culprits[:3])}]" if culprits else ""
                print(f"  {r['path']}{suffix}")
            print()
        clean = sum(len(by_bucket.get(b, [])) for b in CLEAN_BUCKETS)
        print(
            f"licence-clean (gov-attribution or clean-open): {clean} / {len(results)}"
        )

    ok = True
    if audit_errors:
        ok = False
        print(
            "\nAUDIT ERRORS (unreadable artifacts, unmatched source ids, broken lineage):",
            file=sys.stderr,
        )
        for e in audit_errors:
            print(f"  {e}", file=sys.stderr)
    if unclassified:
        ok = False
        print(
            "\nUNCLASSIFIED licence strings (extend classify() deliberately):",
            file=sys.stderr,
        )
        for u in unclassified:
            print(f"  {u!r}", file=sys.stderr)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

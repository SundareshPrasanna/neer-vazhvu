#!/usr/bin/env python3
"""Gate on upstream documents mirrored into the repository.

A file under a mirror tree is a REDISTRIBUTED COPY of somebody else's
document, not a derived dataset. The NVDM envelope machinery never looked at
these trees, so they could carry a publisher's own report while the registry
entry for that same publisher said redistribution needs their approval. This
check closes that path.

This is an ALLOWLIST. A mirror ships only on an affirmative right, never on
the absence of a known objection.

Rules, in order, and the order is load-bearing:

  1. Every file under a mirror tree must appear in scripts/mirrored-documents.json,
     and every listed document must exist. A document nobody claimed is a
     document nobody checked.
  2. IDENTITY FIRST. Every entry must name a `source_id` registered in
     scripts/source-registry/. This is checked BEFORE any clearance route can
     return, because a permission or a quoted clause is a claim ABOUT a
     source: if we cannot say which source, the claim is unattached to
     anything and clears nothing. (The first version returned on a
     well-formed `permission` before it ever looked at `source_id`, so a
     permission with no source id at all - or an unregistered one - passed.)
  3. Then exactly one of three affirmative routes, each fully validated:
       a. `permission`           - grantor, granted_on (ISO calendar date),
                                   form. All non-empty strings.
       b. `redistribution_basis` - clause, source_url (http/https), verified_on
                                   (ISO calendar date).
       c. the source classifies `clean-open` - a canonical open grant.
     A partially-filled route is not a route; it is a failure, not a fallback
     to the next one.
  4. Everything else FAILS. gov-attribution describes how we CITE a government
     publication, not a licence to republish its PDF. share-alike permits
     redistribution only on terms a file drop does not offer. nc, third-party,
     vague, restricted and UNCLASSIFIED are obvious. A `status` field - including
     'unresolved' or even 'cleared' - is documentation and is never a route.

Run with --selftest to see every state and its verdict.

Stdlib only.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts/mirrored-documents.json"

# Every repository tree that can carry a redistributed upstream DOCUMENT.
# public/data and public/geojson are deliberately NOT here: those are derived
# datasets governed per artifact by their NVDM envelope. Add a tree here the
# moment it can hold a mirrored source file.
MIRROR_TREES = ("public/docs",)


def _classifier():
    spec = importlib.util.spec_from_file_location(
        "enc", ROOT / "scripts/nvdm-encumbrance-report.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def registry_licenses() -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for f in sorted((ROOT / "scripts/source-registry").glob("*.json")):
        for s in json.loads(f.read_text()).get("sources", []):
            if s.get("id"):
                out[s["id"]] = s.get("license")
    return out


# The ONLY licence buckets that are themselves an affirmative right to
# redistribute a whole document. Everything else - including gov-attribution,
# which is a description of our citation practice rather than a grant - needs
# a quoted clause or a recorded permission instead.
#
# Enumerated rather than denied one at a time, because the previous version
# failed only on 'restricted' and let six documents with explicitly unproven
# rights sail through on a printed warning. The question a gate has to answer
# is "which states reach a pass verdict", not "does this one input fail".
#
#   clean-open       PASS  canonical open grant (CC BY, CC0, GODL, ODC-BY...)
#   gov-attribution  fail  practice, not permission - the string may be no
#                          more than "cited with attribution"
#   share-alike      fail  redistribution allowed but only under terms we are
#                          not offering with a PDF drop in a repo
#   nc               fail  non-commercial input
#   third-party      fail  somebody else's copyrighted work
#   vague            fail  terms unknown
#   restricted       fail  publisher requires permission
#   UNCLASSIFIED     fail  the classifier does not understand the string
REDISTRIBUTABLE_BUCKETS = {"clean-open"}


def _nonempty_str(v) -> bool:
    return isinstance(v, str) and bool(v.strip())


def _iso_date(v) -> bool:
    """A real calendar date in ISO form. '2026-02-30' is not one."""
    if not isinstance(v, str):
        return False
    try:
        date.fromisoformat(v)
    except ValueError:
        return False
    return True


def _http_url(v) -> bool:
    if not _nonempty_str(v):
        return False
    parts = urlparse(v)
    return parts.scheme in ("http", "https") and bool(parts.netloc)


# route name -> {field: predicate}. Every field is required and validated;
# a partially-filled route is a failure, never a fall-through to the next.
ROUTE_FIELDS = {
    "permission": {
        "grantor": _nonempty_str,
        "granted_on": _iso_date,
        "form": _nonempty_str,
    },
    "redistribution_basis": {
        "clause": _nonempty_str,
        "source_url": _http_url,
        "verified_on": _iso_date,
    },
}


def clearance(d: dict, reg: dict, enc) -> str | None:
    """None if this mirror may ship, else the reason it may not.

    IDENTITY IS CHECKED FIRST and unconditionally. A permission or a quoted
    clause is a claim ABOUT a source; with no source, or an unregistered one,
    it is a claim about nothing. The first version returned on a well-formed
    permission before it ever read `source_id`, so a permission with no source
    id passed the gate.
    """
    sid = d.get("source_id")
    if not _nonempty_str(sid):
        return (
            "no source_id - a permission or a quoted clause is a claim about a "
            "SOURCE, so with no source named there is nothing for it to attach to"
        )
    if sid not in reg:
        return f"source_id '{sid}' has no registry match - lineage unprovable"

    for route, fields in ROUTE_FIELDS.items():
        block = d.get(route)
        if block is None:
            continue
        if not isinstance(block, dict):
            return f"`{route}` must be an object with {', '.join(fields)}"
        bad = [k for k, ok in fields.items() if not ok(block.get(k))]
        if bad:
            return (
                f"`{route}` is incomplete or malformed: {', '.join(sorted(bad))}. "
                f"A partially-filled route is not a route"
            )
        return None

    bucket = enc.classify(reg[sid])
    if bucket in REDISTRIBUTABLE_BUCKETS:
        return None
    status = d.get("status", "unstated")
    return (
        f"source '{sid}' classifies '{bucket}', which is not an affirmative right "
        f"to redistribute the document itself (manifest status: '{status}'). "
        f"Delete the mirror and cite the publisher's URL, or record a "
        f"`redistribution_basis` quoting the clause that permits it, or a "
        f"`permission` (grantor, granted_on, form)"
    )


def main() -> int:
    enc = _classifier()
    reg = registry_licenses()
    manifest = json.loads(MANIFEST.read_text())
    docs = {d["path"]: d for d in manifest["documents"]}

    errors: list[str] = []
    cleared: list[str] = []

    on_disk = {
        str(p.relative_to(ROOT))
        for tree in MIRROR_TREES
        for p in sorted((ROOT / tree).rglob("*"))
        if p.is_file() and not p.name.startswith(".")
    }

    for p in sorted(on_disk - set(docs)):
        errors.append(
            f"{p}: mirrored document not listed in scripts/mirrored-documents.json "
            f"- every redistributed upstream file must name its source and be gated on its terms"
        )
    for p in sorted(set(docs) - on_disk):
        errors.append(f"{p}: listed in the manifest but missing from the tree")

    for path in sorted(set(docs) & on_disk):
        d = docs[path]
        why = clearance(d, reg, enc)
        if why is None:
            cleared.append(path)
        else:
            errors.append(f"{path}: {why}")

    if errors:
        print("mirrored-document gate FAILED:")
        for e in errors:
            print(f"  {e}")
        print(
            "\nA mirror is a redistributed copy of somebody else's document. It "
            "ships only on an AFFIRMATIVE right: a canonical open grant on the "
            "source, a quoted redistribution clause, or a recorded permission. "
            "Anything else - unresolved, vague, unclassified, government "
            "practice, share-alike, non-commercial - means delete the file and "
            "link to the publisher instead."
        )
        return 1

    print(
        f"mirrored-document gate OK: {len(cleared)} mirrored documents, "
        f"every one carrying an affirmative right to redistribute"
    )
    return 0


def selftest() -> int:
    """Enumerate every state the gate can meet and pin its verdict.

    The point is not "does this input fail" but "which states can reach a PASS
    verdict". Anything not listed here as passing must fail.
    """
    enc = _classifier()
    fails: list[str] = []

    def check(name: str, cond: bool) -> None:
        print(f"{name}: {'OK' if cond else 'FAIL'}")
        if not cond:
            fails.append(name)

    # One representative registry string per bucket, so the table below is
    # driven by the real classifier rather than by hand-written buckets.
    reg = {
        "clean": "CC BY 4.0",
        "gov": "GoI publication, cited with attribution",
        "sa": "ODbL 1.0",
        "nc": "CC BY-NC-SA 4.0 (non-commercial AND share-alike)",
        "third": "report (c) Praja, RTI-sourced tables; OpenCity mirror",
        "vague": "no explicit licence: the portal publishes no terms of use",
        "restricted": "restrictive, permission required - no redistribution without approval",
    }
    for key, want in (
        ("clean", "clean-open"),
        ("gov", "gov-attribution"),
        ("sa", "share-alike"),
        ("nc", "nc"),
        ("third", "third-party"),
        ("vague", "vague"),
        ("restricted", "restricted"),
    ):
        check(f"fixture '{key}' really classifies {want}", enc.classify(reg[key]) == want)

    # PASS only for clean-open. Everything else, including the two that read
    # reassuringly (gov-attribution, share-alike), must fail.
    for key, should_pass in (
        ("clean", True),
        ("gov", False),
        ("sa", False),
        ("nc", False),
        ("third", False),
        ("vague", False),
        ("restricted", False),
    ):
        got = clearance({"source_id": key}, reg, enc) is None
        check(
            f"bucket {enc.classify(reg[key])!r} "
            f"{'passes' if should_pass else 'FAILS'} the mirror gate",
            got is should_pass,
        )

    # A status field is documentation. None of these unlock anything.
    for status in ("unresolved", "cleared", "fine", "reviewed", None):
        d = {"source_id": "restricted", "status": status}
        check(
            f"status={status!r} does not clear a restricted source",
            clearance(d, reg, enc) is not None,
        )
    check(
        "status='cleared' does not clear an unproven source either",
        clearance({"source_id": "vague", "status": "cleared"}, reg, enc) is not None,
    )
    check(
        "a note does not clear anything",
        clearance(
            {"source_id": "vague", "note": "we think this is probably fine"}, reg, enc
        )
        is not None,
    )

    # The three affirmative routes, and their incomplete forms.
    check(
        "a complete permission clears even a restricted source",
        clearance(
            {
                "source_id": "restricted",
                "permission": {
                    "grantor": "CPCB Member Secretary",
                    "granted_on": "2026-07-31",
                    "form": "email",
                },
            },
            reg,
            enc,
        )
        is None,
    )
    check(
        "a partial permission clears nothing",
        clearance(
            {"source_id": "restricted", "permission": {"grantor": "somebody"}}, reg, enc
        )
        is not None,
    )
    check(
        "a quoted redistribution_basis clears",
        clearance(
            {
                "source_id": "vague",
                "redistribution_basis": {
                    "clause": "may be reproduced free of charge in any format",
                    "source_url": "https://example.gov.in/policy",
                    "verified_on": "2026-07-31",
                },
            },
            reg,
            enc,
        )
        is None,
    )
    check(
        "a redistribution_basis without a quoted clause clears nothing",
        clearance(
            {
                "source_id": "vague",
                "redistribution_basis": {"source_url": "https://example.gov.in/"},
            },
            reg,
            enc,
        )
        is not None,
    )
    check(
        "an unregistered source_id clears nothing",
        clearance({"source_id": "not-a-real-id"}, reg, enc) is not None,
    )
    check(
        "no source_id at all clears nothing",
        clearance({}, reg, enc) is not None,
    )

    # ---- IDENTITY IS CHECKED FIRST (PR #227 review round 4). Each of these
    # passed before: the route returned before `source_id` was ever read, so a
    # complete-looking claim about nothing in particular cleared the gate.
    good_perm = {"grantor": "CPCB Member Secretary", "granted_on": "2026-07-31", "form": "email"}
    good_basis = {
        "clause": "may be reproduced free of charge in any format",
        "source_url": "https://example.gov.in/policy",
        "verified_on": "2026-07-31",
    }
    check(
        "a complete permission with NO source_id still fails",
        clearance({"permission": good_perm}, reg, enc) is not None,
    )
    check(
        "a complete permission with an UNREGISTERED source_id still fails",
        clearance({"source_id": "nope", "permission": good_perm}, reg, enc) is not None,
    )
    check(
        "a complete redistribution_basis with NO source_id still fails",
        clearance({"redistribution_basis": good_basis}, reg, enc) is not None,
    )
    check(
        "a complete redistribution_basis with an UNREGISTERED source_id still fails",
        clearance({"source_id": "nope", "redistribution_basis": good_basis}, reg, enc)
        is not None,
    )
    check(
        "an empty-string source_id is not a source_id",
        clearance({"source_id": "   ", "permission": good_perm}, reg, enc) is not None,
    )

    # ---- FIELD VALIDATION. Present-but-junk is not present.
    bad_cases = {
        "blank grantor": {"permission": {**good_perm, "grantor": "  "}},
        "non-string grantor": {"permission": {**good_perm, "grantor": 42}},
        "prose date": {"permission": {**good_perm, "granted_on": "last July"}},
        "impossible date": {"permission": {**good_perm, "granted_on": "2026-02-30"}},
        "permission not an object": {"permission": "granted, trust me"},
        "blank clause": {"redistribution_basis": {**good_basis, "clause": ""}},
        "url without scheme": {
            "redistribution_basis": {**good_basis, "source_url": "example.gov.in/policy"}
        },
        "non-http scheme": {
            "redistribution_basis": {
                **good_basis,
                "source_url": "javascript:alert(1)",
            }
        },
        "bad verified_on": {
            "redistribution_basis": {**good_basis, "verified_on": "2026-13-01"}
        },
    }
    for name, extra in bad_cases.items():
        check(
            f"{name} does not clear",
            clearance({"source_id": "restricted", **extra}, reg, enc) is not None,
        )
    check(
        "a valid permission on a REGISTERED source does clear",
        clearance({"source_id": "restricted", "permission": good_perm}, reg, enc) is None,
    )
    check(
        "a valid redistribution_basis on a REGISTERED source does clear",
        clearance(
            {"source_id": "restricted", "redistribution_basis": good_basis}, reg, enc
        )
        is None,
    )

    print(f"{'OK' if not fails else 'FAIL'}: {len(fails)} failures")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv[1:] else main())

#!/usr/bin/env python3
"""Sample-corpus manifest validator + pruner (serving-hardening P0/P1).

Two jobs:

  (default)  Assert scripts/sample-corpus.json stays honest as envelopes
             evolve:
               - every reference artifact exists, is enveloped, and is
                 licence-clean under the FULL lineage-aware rules of
                 scripts/nvdm-encumbrance-report.py (own sources AND
                 recursive internal_inputs inheritance);
               - every build fixture exists and still has exactly its
                 recorded status. A fixture that became licence-clean must
                 be PROMOTED to reference_artifacts; one that degraded
                 (e.g. to nc) must be re-decided. NC and restricted are
                 never acceptable in the public sample.

             That last rule is absolute and has no note-based exception.
             PR #227 briefly added one - a fixture could stay `restricted`
             if it carried a `licence_note` - and it was rejected on review
             for the right reason: a note is documentation, not permission,
             and the pruner retains those files for the APPLICATION to read,
             not merely for tests. Where mechanical source-term propagation
             genuinely over-claims (a derived ward score is not CPCB's
             report), the answer is an audited per-artifact
             `provenance.rights_determination` in the envelope, scored by
             scripts/nvdm-encumbrance-report.py - a determination with
             reasoning and a review date, not a manifest annotation.

  --prune    Delete every file under public/data and public/geojson that is
             not in the manifest (directories are kept - the build reads
             family directory listings). Used by the sample-only CI job to
             prove the manifest is sufficient for `npm run build` and
             `npm test` on a corpus-less clone. Skips the gitignored
             rich-bodies imagery/tints trees (Supabase-served, dev-only).

             It ALSO prunes the mirrored-document trees (public/docs),
             keeping only mirrors that scripts/mirrored-documents.json marks
             as cleared or permission-backed. Those trees were previously
             invisible to every licence check in the repo, which is how a
             mirror of a permission-required CPCB report came to ship in
             every build; a sample corpus we would hand to a stranger must
             not carry a document whose terms nobody has read.

Stdlib only. Run scripts/build_dataset_catalogue.py first if artifacts moved.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts/sample-corpus.json"
CLEAN_BUCKETS = {"gov-attribution", "clean-open"}
PRUNE_SKIP_DIRS = (
    "public/data/rich-bodies/imagery",
    "public/data/rich-bodies/tints",
)


def encumbrance() -> dict[str, str]:
    """path -> worst licence bucket, for every enveloped artifact."""
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts/nvdm-encumbrance-report.py"), "--json"],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(proc.stderr, file=sys.stderr)
        raise SystemExit("encumbrance report failed (lineage or classification gap)")
    return {a["path"]: a["status"] for a in json.loads(proc.stdout)["artifacts"]}


def check() -> int:
    manifest = json.loads(MANIFEST.read_text())
    status = encumbrance()
    errors: list[str] = []

    refs = manifest["reference_artifacts"]
    fixture_paths = {f["path"] for f in manifest["build_fixtures"]}
    dupes = set(refs) & fixture_paths
    if dupes:
        errors += [
            f"{p}: listed as both reference artifact and fixture" for p in sorted(dupes)
        ]

    for p in refs:
        if not (ROOT / p).exists():
            errors.append(f"{p}: reference artifact missing from tree")
        elif p not in status:
            errors.append(
                f"{p}: reference artifact is not enveloped (licence not provable)"
            )
        elif status[p] not in CLEAN_BUCKETS:
            errors.append(
                f"{p}: reference artifact is no longer licence-clean (now '{status[p]}')"
            )

    for f in manifest["build_fixtures"]:
        p = f["path"]
        if not (ROOT / p).exists():
            errors.append(f"{p}: build fixture missing from tree")
            continue
        errors += fixture_errors(f, status.get(p, "not-enveloped"))

    if errors:
        print("sample-corpus manifest FAILED:")
        for e in errors:
            print(f"  {e}")
        return 1
    print(
        f"sample-corpus manifest OK: {len(refs)} licence-clean reference artifacts, "
        f"{len(fixture_paths)} documented build fixtures"
    )
    return 0


MIRRORS = ROOT / "scripts/mirrored-documents.json"
MIRROR_TREES = ("public/docs",)


def prune_mirrors() -> int:
    """Drop every mirrored upstream document whose terms are not established."""
    docs = {
        d["path"]: d for d in json.loads(MIRRORS.read_text())["documents"]
    }
    removed = 0
    for tree in MIRROR_TREES:
        for p in sorted((ROOT / tree).rglob("*")):
            if not p.is_file():
                continue
            rel = str(p.relative_to(ROOT))
            d = docs.get(rel, {})
            if d.get("permission") or d.get("status") == "cleared":
                continue
            p.unlink()
            removed += 1
    return removed


def prune() -> int:
    manifest = json.loads(MANIFEST.read_text())
    keep = set(manifest["reference_artifacts"]) | {
        f["path"] for f in manifest["build_fixtures"]
    }
    removed = prune_mirrors()
    for top in ("public/data", "public/geojson"):
        for p in sorted((ROOT / top).rglob("*")):
            if not p.is_file():
                continue
            rel = str(p.relative_to(ROOT))
            if rel in keep or any(rel.startswith(d + "/") for d in PRUNE_SKIP_DIRS):
                continue
            p.unlink()
            removed += 1
    print(
        f"pruned corpus to sample manifest: kept {len(keep)} files, removed {removed}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(prune() if "--prune" in sys.argv[1:] else check())

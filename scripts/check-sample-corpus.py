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
                 (e.g. to nc) must be re-decided.

             NC is never acceptable anywhere in the sample. `restricted` is
             never acceptable in reference_artifacts either - that set is
             the corpus we actually redistribute - but a build FIXTURE may
             record it, because fixtures are by definition "files the build
             cannot pass without, which are NOT provably licence-clean".
             The escape hatch is deliberately narrow: the entry must carry
             a `licence_note` naming the restrictive source and its terms,
             so the exception is reviewed rather than inherited silently.
             Widened 2026-07-31, when reading CPCB's and DPCC's own website
             policies (permission required for any use beyond download and
             print) reclassified them from gov-attribution to restricted
             and tainted the ward/river lineage `npm test` reads.

  --prune    Delete every file under public/data and public/geojson that is
             not in the manifest (directories are kept - the build reads
             family directory listings). Used by the sample-only CI job to
             prove the manifest is sufficient for `npm run build` and
             `npm test` on a corpus-less clone. Skips the gitignored
             rich-bodies imagery/tints trees (Supabase-served, dev-only).

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
        actual = status.get(p, "not-enveloped")
        if not (ROOT / p).exists():
            errors.append(f"{p}: build fixture missing from tree")
        elif actual != f["expected_status"]:
            hint = (
                "promote it to reference_artifacts"
                if actual in CLEAN_BUCKETS
                else "re-decide its entry (nc/restricted are never acceptable in the public sample)"
            )
            errors.append(
                f"{p}: fixture status changed '{f['expected_status']}' -> '{actual}' - {hint}"
            )
        elif actual == "nc":
            errors.append(
                f"{p}: fixture is nc-encumbered - not acceptable in the public sample"
            )
        elif actual == "restricted" and not f.get("licence_note"):
            errors.append(
                f"{p}: fixture is restricted-encumbered - allowed only with a "
                f"licence_note naming the restrictive source and its terms"
            )
        if not f.get("decision") or not f.get("required_by"):
            errors.append(f"{p}: fixture entry must document required_by and decision")

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


def prune() -> int:
    manifest = json.loads(MANIFEST.read_text())
    keep = set(manifest["reference_artifacts"]) | {
        f["path"] for f in manifest["build_fixtures"]
    }
    removed = 0
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

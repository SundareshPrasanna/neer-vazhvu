#!/usr/bin/env python3
"""Gate on upstream documents mirrored into the repository.

A file under a mirror tree is a REDISTRIBUTED COPY of somebody else's
document, not a derived dataset. The NVDM envelope machinery never looked at
these trees, so they could carry a publisher's own report while the registry
entry for that same publisher said redistribution needs their approval. This
check closes that path.

Rules, in order:

  1. Every file under a mirror tree must appear in scripts/mirrored-documents.json.
     An unlisted mirror is a failure: a document nobody claimed is a document
     nobody checked.
  2. Every listed document must exist, and must name a `source_id` that is
     registered in scripts/source-registry/.
  3. That source must not classify 'restricted' under the shared classifier in
     scripts/nvdm-encumbrance-report.py. Mirroring is redistribution, and a
     publisher who requires permission for redistribution has not given it.
     The only way past this is a recorded `permission` (who granted it, when,
     in what form) - never a note, which is documentation, not permission.
  4. Entries with status 'unresolved' are reported loudly but do not fail.
     They are the to-do list of terms nobody has read yet.

Stdlib only.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

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


def main() -> int:
    enc = _classifier()
    reg = registry_licenses()
    manifest = json.loads(MANIFEST.read_text())
    docs = {d["path"]: d for d in manifest["documents"]}

    errors: list[str] = []
    unresolved: list[str] = []

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
        sid = d.get("source_id")
        if not sid:
            errors.append(f"{path}: no source_id - lineage unprovable")
            continue
        if sid not in reg:
            errors.append(f"{path}: source_id '{sid}' has no registry match")
            continue
        bucket = enc.classify(reg[sid])
        if bucket == "restricted" and not d.get("permission"):
            errors.append(
                f"{path}: source '{sid}' classifies '{bucket}' - mirroring is "
                f"redistribution and this publisher requires permission. Delete the "
                f"mirror and cite the publisher's own URL, or record an actual "
                f"`permission` (grantor, date, form)"
            )
        if d.get("status") == "unresolved":
            unresolved.append(f"{path} ({d.get('publisher', sid)})")

    if unresolved:
        print(f"mirrored documents with UNRESOLVED upstream terms ({len(unresolved)}):")
        for u in unresolved:
            print(f"  {u}")

    if errors:
        print("mirrored-document gate FAILED:")
        for e in errors:
            print(f"  {e}")
        return 1

    print(
        f"mirrored-document gate OK: {len(on_disk)} mirrored documents, "
        f"none from a restricted source"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

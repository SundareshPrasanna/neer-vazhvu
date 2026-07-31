#!/usr/bin/env python3
"""Stop envelope metadata drifting back in the next time a producer runs.

THE DEFECT THIS EXISTS FOR. PR #227 corrected 209 source licences across 154
envelopes and added rights determinations to five artefacts. The artefacts were
right; the PRODUCERS were not. `build_delhi_ward_profiles.py` still held the old
OpenCity and WRIS literals and emitted no determination, so running it restored
three stale licences, deleted the determination, and dropped the artefact a
conformance level. Nothing detected that, because only three of ~85 producers
have a regeneration diff in CI.

Running all 85 in CI is not possible: most fetch from a network, an authenticated
portal, or Earth Engine. So this checks the thing that actually drifts, and
checks it for every producer at once, offline and deterministically:

  1. NO GENERATOR MAY HARDCODE A REGISTERED SOURCE'S LICENCE. A dict literal
     carrying both an `id` that is in the Headwaters registry and a `license`
     string literal is a second copy of a fact the registry owns, and second
     copies drift. Use registry_license() / registryLicense().

  2. A PRODUCER MUST EMIT THE RIGHTS DETERMINATION ITS ARTEFACT CARRIES. If an
     artefact has provenance.rights_determination and its produced_by script
     never mentions one, the next run deletes an audited legal judgement
     silently. That is worse than never having recorded it.

Neither rule needs the producer to run, so both cover producers CI can never
execute. Run with --list to see the producer inventory and which ones have
real regeneration-diff coverage.

Stdlib only.
"""

from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from registry_license import registry_licenses  # noqa: E402

REG = registry_licenses()

GENERATOR_DIRS = ("scripts", "neer-vazhvu-api/scripts", "neer-vazhvu-api/app")

# These read or enforce licences rather than emitting envelopes; a literal in
# them is the subject matter, not a copy that can drift.
EXEMPT = {
    "nvdm-encumbrance-report.py",
    "validate_nvdm.py",
    "build_dataset_catalogue.py",
    "check-mirrored-documents.py",
    "check-sample-corpus.py",
    "check-generator-drift.py",
    "registry_license.py",
}

# Producers CI actually re-runs and diffs. Keep in step with .github/workflows/ci.yml.
REGEN_COVERED = {
    "scripts/compute-ward-profiles.ts",
    "scripts/compute-madurai-ward-profiles.ts",
    "scripts/compute-bangalore-ward-profiles.ts",
    "neer-vazhvu-api/scripts/build_delhi_ward_profiles.py",
}


def python_literal_errors() -> list[str]:
    errs: list[str] = []
    for d in GENERATOR_DIRS:
        for p in sorted((ROOT / d).rglob("*.py")):
            if p.name in EXEMPT:
                continue
            src = p.read_text()
            if '"license"' not in src and "'license'" not in src:
                continue
            try:
                tree = ast.parse(src)
            except SyntaxError:
                continue
            for node in ast.walk(tree):
                if not isinstance(node, ast.Dict):
                    continue
                pairs = {
                    k.value: v
                    for k, v in zip(node.keys, node.values)
                    if isinstance(k, ast.Constant) and isinstance(k.value, str)
                }
                sid, lic = pairs.get("id"), pairs.get("license")
                if sid is None or lic is None:
                    continue
                if not (isinstance(sid, ast.Constant) and isinstance(sid.value, str)):
                    continue
                if sid.value not in REG:
                    continue
                if isinstance(lic, ast.Constant) and isinstance(lic.value, str):
                    errs.append(
                        f"{p.relative_to(ROOT)}:{lic.lineno}: hardcoded licence for "
                        f"registered source '{sid.value}' - use "
                        f"registry_license(\"{sid.value}\")"
                    )
    return errs


# id: "x", ... license: "literal"  - the TypeScript shape.
TS_PAIR = re.compile(
    r'id:\s*"(?P<sid>[a-z0-9\-]+)",(?:[^{}]|\{[^{}]*\})*?license:\s*"', re.S
)


def ts_literal_errors() -> list[str]:
    errs: list[str] = []
    for d in GENERATOR_DIRS:
        for p in sorted((ROOT / d).rglob("*.ts")):
            src = p.read_text()
            if "license:" not in src:
                continue
            for m in TS_PAIR.finditer(src):
                sid = m.group("sid")
                if sid not in REG:
                    continue
                line = src[: m.start()].count("\n") + 1
                errs.append(
                    f"{p.relative_to(ROOT)}:{line}: hardcoded licence for registered "
                    f'source \'{sid}\' - use registryLicense("{sid}")'
                )
    return errs


def determination_errors() -> tuple[list[str], list[str]]:
    """Artefacts whose producer would silently drop their determination."""
    errs: list[str] = []
    ok: list[str] = []
    for top in ("public/data", "public/geojson"):
        for p in sorted((ROOT / top).rglob("*")):
            if p.suffix not in (".json", ".geojson") or not p.is_file():
                continue
            try:
                doc = json.loads(p.read_text())
            except Exception:
                continue
            if not isinstance(doc, dict) or "nvdm" not in doc:
                continue
            prov = doc.get("provenance") or {}
            if "rights_determination" not in prov:
                continue
            rel = str(p.relative_to(ROOT))
            producer = (prov.get("produced_by") or "").strip()
            script = producer.split()[0] if producer else ""
            sp = ROOT / script
            if not script or not sp.exists():
                errs.append(
                    f"{rel}: carries a rights_determination but produced_by "
                    f"'{producer or '(none)'}' is not a file in this repo - nothing "
                    f"guarantees a rerun preserves it"
                )
                continue
            if "rights_determination" not in sp.read_text():
                errs.append(
                    f"{rel}: carries a rights_determination but its producer "
                    f"{script} never emits one - rerunning it deletes an audited "
                    f"legal judgement silently"
                )
            else:
                ok.append(f"{rel} <- {script}")
    return errs, ok


def inventory() -> None:
    producers: dict[str, list[str]] = {}
    for top in ("public/data", "public/geojson"):
        for p in sorted((ROOT / top).rglob("*")):
            if p.suffix not in (".json", ".geojson") or not p.is_file():
                continue
            try:
                doc = json.loads(p.read_text())
            except Exception:
                continue
            if not isinstance(doc, dict) or "nvdm" not in doc:
                continue
            pb = ((doc.get("provenance") or {}).get("produced_by") or "").strip()
            if pb:
                producers.setdefault(pb.split()[0], []).append(str(p.relative_to(ROOT)))
    print(f"{len(producers)} producers of enveloped artifacts:\n")
    for script, files in sorted(producers.items(), key=lambda kv: -len(kv[1])):
        mark = "regen-diffed" if script in REGEN_COVERED else "static-only"
        print(f"  {len(files):3d} artifacts  [{mark}]  {script}")
    print(
        f"\n{len(REGEN_COVERED)} producers are re-run and diffed in CI. The rest are "
        f"network-, portal- or Earth-Engine-bound and cannot be, which is why the "
        f"licence-literal and determination rules above are static."
    )


def main(argv: list[str]) -> int:
    if "--list" in argv:
        inventory()
        return 0
    errs = python_literal_errors() + ts_literal_errors()
    det_errs, det_ok = determination_errors()
    errs += det_errs
    if errs:
        print("generator-drift gate FAILED:")
        for e in errs:
            print(f"  {e}")
        print(
            "\nA generator holding its own copy of a registry fact is how the "
            "envelopes and the registry drifted apart in the first place."
        )
        return 1
    print(
        f"generator-drift gate OK: no generator hardcodes a registered source's "
        f"licence; {len(det_ok)} rights determinations are emitted by their producer"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

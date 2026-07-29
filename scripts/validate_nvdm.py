#!/usr/bin/env python3
"""NVDM conformance validator (spec: docs/specs/nvdm-v1.md Part 10).

Assesses every catalogued artifact against the four conformance levels:

  L0 Catalogued - present in docs/architecture/dataset-catalogue.json
  L1 Registered - at least one Headwaters source joins to the file
  L2 Enveloped  - valid NVDM envelope; identity agrees with the file path
  L3 Contracted - payload validates against the dataset's schema in schemas/nvdm/

Usage:
  python3 scripts/validate_nvdm.py                 # full report -> docs/architecture/nvdm-conformance.md
  python3 scripts/validate_nvdm.py --check FILE... # gate mode: exit 1 unless every FILE reaches L2
  python3 scripts/validate_nvdm.py --selftest      # validate schemas/nvdm/examples/* (CI sanity)

Stdlib only. Implements the subset of JSON Schema the NVDM schemas restrict
themselves to: type (incl. unions), properties, required, items, enum, pattern,
minItems, allOf, and $ref within schemas/nvdm/ files. Run the catalogue builder
first; this tool deliberately reuses its output instead of re-walking the tree.
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = ROOT / "docs/architecture/dataset-catalogue.json"
SCHEMA_DIR = ROOT / "schemas/nvdm"
OUT_MD = ROOT / "docs/architecture/nvdm-conformance.md"

TYPE_MAP = {
    "object": dict, "array": list, "string": str,
    "integer": int, "number": (int, float), "boolean": bool, "null": type(None),
}


class SchemaError(Exception):
    pass


def load_schemas() -> dict[str, dict]:
    return {f.name: json.loads(f.read_text()) for f in SCHEMA_DIR.glob("*.schema.json")}


def resolve_ref(ref: str, current: str, schemas: dict[str, dict]) -> tuple[dict, str]:
    """Resolve 'file.schema.json#/$defs/x' or '#/$defs/x' -> (subschema, owning file)."""
    file_part, _, frag = ref.partition("#")
    owner = file_part or current
    node = schemas[owner]
    for part in frag.strip("/").split("/"):
        if part:
            node = node[part]
    return node, owner


def validate(doc, schema: dict, schemas: dict[str, dict], owner: str, path: str = "$") -> list[str]:
    """Return list of violations (empty = valid) for the supported subset."""
    errs: list[str] = []
    if "$ref" in schema:
        sub, sub_owner = resolve_ref(schema["$ref"], owner, schemas)
        return validate(doc, sub, schemas, sub_owner, path)
    for sub in schema.get("allOf", []):
        errs += validate(doc, sub, schemas, owner, path)
    if "enum" in schema and doc not in schema["enum"]:
        errs.append(f"{path}: {json.dumps(doc)[:40]} not in {schema['enum']}")
    if "type" in schema:
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        ok = any(
            isinstance(doc, TYPE_MAP[t]) and not (t in ("integer", "number") and isinstance(doc, bool))
            for t in types
        )
        if not ok:
            errs.append(f"{path}: expected {types}, got {type(doc).__name__}")
            return errs  # deeper checks meaningless on wrong type
    if isinstance(doc, dict):
        for req in schema.get("required", []):
            if req not in doc:
                errs.append(f"{path}: missing required key '{req}'")
        for key, sub in schema.get("properties", {}).items():
            if key in doc:
                errs += validate(doc[key], sub, schemas, owner, f"{path}.{key}")
    if isinstance(doc, str) and "pattern" in schema:
        if not re.search(schema["pattern"], doc):
            errs.append(f"{path}: '{doc[:40]}' fails pattern {schema['pattern']}")
    if isinstance(doc, list):
        if "minItems" in schema and len(doc) < schema["minItems"]:
            errs.append(f"{path}: {len(doc)} items < minItems {schema['minItems']}")
        if "items" in schema:
            for i, el in enumerate(doc[:500]):
                errs += validate(el, schema["items"], schemas, owner, f"{path}[{i}]")
    return errs


def envelope_check(doc, rec: dict, schemas: dict[str, dict]) -> list[str]:
    """L2: envelope validity + identity agreement with the catalogue record."""
    if not isinstance(doc, dict):
        return ["artifact is not an object (bare arrays cannot carry an envelope)"]
    errs = validate(doc, {"$ref": "envelope.schema.json#/$defs/envelope"}, schemas, "envelope.schema.json")
    if errs:
        return errs
    declared = doc["dataset"]
    actual = f"{rec['family']}/{rec['dataset']}"
    if declared != actual:
        errs.append(f"identity: dataset '{declared}' != path-derived '{actual}'")
    if doc["scope"]["id"] != rec["scope"]:
        errs.append(f"identity: scope.id '{doc['scope']['id']}' != path-derived '{rec['scope']}'")
    return errs


def contract_schema_for(rec: dict, schemas: dict[str, dict]) -> str | None:
    name = f"{rec['dataset']}.schema.json"
    return name if name in schemas else None


# Claim datasets (spec 5.1): every record makes an independently quotable claim
# and MUST carry its own source reference. Maps dataset id -> (collection key,
# acceptable per-record source keys).
CLAIM_DATASETS = {
    "data-root/facts": ("facts", ("source_ids", "sources")),
    "data-root/commitments": ("commitments", ("source_ids", "sources", "commitment_source")),
    "data-root/allocations": ("arrangements", ("source_ids", "sources", "source")),
    "data-root/water-bodies-lost": ("lost_bodies", ("source_ids", "sources", "source")),
    "data-root/water-bodies-flagship": ("bodies", ("source_ids", "sources", "source")),
    "data-root/restoration-projects": ("projects", ("source_ids", "sources", "source")),
}


def claim_provenance_errors(doc: dict, dataset: str) -> list[str]:
    """Spec 5.1: per-record source refs on claim datasets; source_ids must resolve."""
    if dataset not in CLAIM_DATASETS:
        return []
    coll_key, source_keys = CLAIM_DATASETS[dataset]
    records = doc.get(coll_key)
    if not isinstance(records, list):
        return []  # structural problems are the contract schema's job
    env_ids = {
        s.get("id")
        for s in doc.get("provenance", {}).get("sources", [])
        if isinstance(s, dict) and s.get("id")
    }
    errs = []
    for i, r in enumerate(records):
        if not isinstance(r, dict):
            continue
        if not any(r.get(k) for k in source_keys):
            errs.append(f"$.{coll_key}[{i}] ({r.get('id', '?')}): no per-record source ref "
                        f"(needs one of {'/'.join(source_keys)})")
        for sid in r.get("source_ids", []):
            if sid not in env_ids:
                errs.append(f"$.{coll_key}[{i}]: source_ids '{sid}' not found in provenance.sources ids")
    return errs


def assess(rec: dict, schemas: dict[str, dict]) -> dict:
    path = ROOT / rec["path"]
    level = 0  # L0: it's in the catalogue by construction
    notes: list[str] = []
    if rec["headwaters_sources"]:
        level = 1
    try:
        doc = json.loads(path.read_text())
    except Exception as e:  # noqa: BLE001
        return {"path": rec["path"], "level": level, "notes": [f"unparseable: {e}"][:1]}
    env_errs = envelope_check(doc, rec, schemas)
    if not env_errs:
        # L2 requires L1 semantics too, but registry coverage is tracked separately;
        # an enveloped file with an unregistered living source is reported, not demoted.
        level = max(level, 2)
        contract = contract_schema_for(rec, schemas)
        if contract:
            c_errs = validate(doc, schemas[contract], schemas, contract)
            c_errs += claim_provenance_errors(doc, f"{rec['family']}/{rec['dataset']}")
            if c_errs:
                notes += [f"L3 fail: {e}" for e in c_errs[:5]]
            else:
                level = 3
        else:
            notes.append("no contract published for this dataset (L3 not applicable yet)")
    else:
        notes += [f"L2 fail: {e}" for e in env_errs[:3]]
    return {"path": rec["path"], "level": level, "notes": notes}


def selftest(schemas: dict[str, dict]) -> int:
    ok = True
    cases = {
        "examples/example-facts.json": "facts.schema.json",
        "examples/example-water-bodies-current.geojson": "water-bodies-current.schema.json",
    }
    for rel, schema_name in cases.items():
        doc = json.loads((SCHEMA_DIR / rel).read_text())
        errs = validate(doc, schemas[schema_name], schemas, schema_name)
        errs += validate(doc, {"$ref": "envelope.schema.json#/$defs/envelope"}, schemas, "envelope.schema.json")
        print(f"{rel}: {'OK' if not errs else 'FAIL'}")
        for e in errs:
            print(f"  {e}")
        ok = ok and not errs
    # a deliberately broken doc must fail
    bad = {"nvdm": "1.0", "dataset": "data-root/facts", "scope": {"kind": "city"}}
    errs = validate(bad, {"$ref": "envelope.schema.json#/$defs/envelope"}, schemas, "envelope.schema.json")
    print(f"negative case: {'OK (rejected)' if errs else 'FAIL (accepted bad doc)'}")
    ok = ok and bool(errs)
    # claim-dataset rule (spec 5.1): a fact without a source ref must fail;
    # a dangling source_ids reference must fail
    doc = json.loads((SCHEMA_DIR / "examples/example-facts.json").read_text())
    stripped = json.loads(json.dumps(doc))
    stripped["facts"][0].pop("sources", None)
    e1 = claim_provenance_errors(stripped, "data-root/facts")
    print(f"claim record w/o source: {'OK (rejected)' if e1 else 'FAIL (accepted)'}")
    dangling = json.loads(json.dumps(doc))
    dangling["facts"][0]["source_ids"] = ["no-such-source"]
    e2 = claim_provenance_errors(dangling, "data-root/facts")
    print(f"dangling source_ids: {'OK (rejected)' if e2 else 'FAIL (accepted)'}")
    ok = ok and bool(e1) and bool(e2)
    return 0 if ok else 1


def main(argv: list[str]) -> int:
    schemas = load_schemas()
    if "--selftest" in argv:
        return selftest(schemas)

    cat = json.loads(CATALOGUE.read_text())
    records = cat["files"]
    results = [assess(r, schemas) for r in records]
    by_path = {r["path"]: r for r in results}

    if "--check" in argv:
        targets = argv[argv.index("--check") + 1 :]
        failed = False
        for t in targets:
            rel = str(Path(t).resolve().relative_to(ROOT)) if Path(t).is_absolute() else t
            res = by_path.get(rel)
            if res is None:
                print(f"{t}: not in catalogue (run scripts/build_dataset_catalogue.py)")
                failed = True
            elif res["level"] < 2:
                print(f"{t}: L{res['level']} - below L2")
                for n in res["notes"]:
                    print(f"  {n}")
                failed = True
            else:
                print(f"{t}: L{res['level']} OK")
        return 1 if failed else 0

    # ---- report ----
    counts = defaultdict(int)
    fam_levels: dict[str, list[int]] = defaultdict(list)
    for rec, res in zip(records, results):
        counts[res["level"]] += 1
        fam_levels[rec["family"]].append(res["level"])
    n = len(results)
    lines = [
        "# NVDM conformance report",
        "",
        "Generated by `scripts/validate_nvdm.py` from the dataset catalogue.",
        "Levels per `docs/specs/nvdm-v1.md` Part 10: L0 catalogued, L1 registered, L2 enveloped, L3 contracted.",
        "",
        f"**{n} artifacts: "
        + " · ".join(f"L{lv}: {sum(counts[k] for k in counts if k >= lv)}" for lv in range(4))
        + "**",
        "",
        "| family | files | ≥L1 | ≥L2 | L3 |",
        "|---|--:|--:|--:|--:|",
    ]
    for fam, lvls in sorted(fam_levels.items()):
        lines.append(
            f"| {fam} | {len(lvls)} | {sum(1 for l in lvls if l >= 1)} | "
            f"{sum(1 for l in lvls if l >= 2)} | {sum(1 for l in lvls if l >= 3)} |"
        )
    enveloped = [r for r in results if r["level"] >= 2]
    lines += ["", f"## Enveloped artifacts (≥L2): {len(enveloped)}", ""]
    for r in enveloped:
        lines.append(f"- L{r['level']} `{r['path']}`" + (f" - {r['notes'][0]}" if r["notes"] else ""))
    lines += [
        "",
        "## Reading the baseline",
        "",
        "- L2/L3 at zero is the expected starting point: no production artifact predates the spec.",
        "- The L1 number is the Headwaters coverage gap (worst family: cascade).",
        "- Gate mode (`--check`) is wired for CI to require L2 on NEW artifacts only;",
        "  legacy files are report-only until migrated (spec 9.4).",
        "",
    ]
    OUT_MD.write_text("\n".join(lines))
    print(f"L0 {n} / L1 {sum(counts[k] for k in counts if k >= 1)} / "
          f"L2 {sum(counts[k] for k in counts if k >= 2)} / L3 {counts[3]} -> {OUT_MD.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

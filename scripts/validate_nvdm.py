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
            # Every element is inspected (a gate that samples is not a gate);
            # only the error OUTPUT is capped once the artifact is already failing.
            before = len(errs)
            for i, el in enumerate(doc):
                errs += validate(el, schema["items"], schemas, owner, f"{path}[{i}]")
                if len(errs) - before > 40:
                    errs.append(f"{path}: further element errors suppressed")
                    break
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


# Contracts are keyed by FULL dataset id - a stem alone is ambiguous
# (geojson-layers/rivers has a contract; basins/rivers is Tier C, envelope-only).
CONTRACTS = {
    "data-root/facts": "facts.schema.json",
    "data-root/commitments": "commitments.schema.json",
    "data-root/allocations": "allocations.schema.json",
    "data-root/ward-profiles": "ward-profiles.schema.json",
    "data-root/cgwb-stations": "cgwb-stations.schema.json",
    "data-root/restoration-priority": "restoration-priority.schema.json",
    "geojson-layers/water-bodies-current": "water-bodies-current.schema.json",
    "geojson-layers/rivers": "rivers.schema.json",
}

ENVELOPE_KEYS = {"nvdm", "dataset", "scope", "provenance", "projection", "ext"}
GEOJSON_MEMBERS = {"type", "features", "bbox"}

# Spec 9.3/9.4: documented legacy aliases stay in place until their consumers
# move; they are grandfathered, not undeclared extensions. Underscore-prefixed
# keys are the legacy metadata idiom and get the same tolerance. NEW payload
# keys outside the contract still fail - this list is closed.
LEGACY_GRANDFATHERED = {
    "place_id", "city_id", "district_id",
    "generated_at", "compiled_at", "computed_at", "updated", "last_updated",
    "fetched_at", "retrieved",
    "source", "sources", "source_label", "source_url", "attribution",
    "primary_source", "secondary_sources",
    "note", "unit_note", "provisional_note",
    "schema_version", "manifest_version",
}

# Underscore-prefixed grandfathering is a CLOSED census of the keys that exist
# in the corpus today (generated from the catalogue fingerprints, 2026-07-30),
# NOT a namespace exemption - review found `_hyderabad_special` passing L3
# under a wildcard. New underscore keys fail like any other undeclared key.
LEGACY_UNDERSCORE = {
    "_2025_context", "_api_contract", "_archival", "_archive_warning",
    "_citation_audit", "_coordinates", "_coverage_limit",
    "_data_provenance_caveats", "_excluded", "_extraction", "_factors",
    "_feed_status", "_fetched", "_location_note", "_meta", "_methodology",
    "_note", "_osm_coverage_note", "_provenance", "_readings_status",
    "_report_date", "_secondary_local_source", "_sign_convention", "_source",
    "_source_caveats", "_source_url", "_sources", "_sources_of_truth",
    "_supply_total_note", "_view_overrides", "_wqr_source",
    # dated audit-trail keys - enumerated, NOT a prefix wildcard (review
    # 2026-07-30: _citation_trace_totally_new passed under the prefix). New
    # audit trails belong in provenance.note.
    "_citation_trace_2026_07_26", "_citation_trace_newslaundry", "_citation_trace_ngt_2018",
}


def registry_source_ids() -> set[str]:
    ids = set()
    for f in (ROOT / "scripts/source-registry").glob("*.json"):
        for s in json.loads(f.read_text()).get("sources", []):
            if s.get("id"):
                ids.add(s["id"])
    return ids


def load_scopes() -> dict[str, str]:
    return json.loads((SCHEMA_DIR / "scopes.json").read_text())["scopes"]


def scope_registry_errors(doc: dict, scopes: dict[str, str]) -> list[str]:
    """scope.id must be registered and scope.kind must match the registry -
    {kind: basin, id: hyderabad} is a lie the enum alone cannot catch."""
    sc = doc.get("scope", {})
    registered = scopes.get(sc.get("id"))
    if registered is None:
        return [f"scope.id '{sc.get('id')}' is not in the scope registry (schemas/nvdm/scopes.json)"]
    if registered != sc.get("kind"):
        return [f"scope.kind '{sc.get('kind')}' contradicts the registry ('{sc.get('id')}' is a {registered})"]
    return []


def source_accountability_errors(
    doc: dict, joined: set[str], reg_ids: set[str], dataset: str = ""
) -> list[str]:
    """L2 half of the cumulative ladder (spec Part 10). Accountability is
    strictly PER SOURCE, exactly two ways to satisfy it (ratification review
    2026-07-30 removed the continuous/aggregate envelope exemptions - living
    upstreams incl. OSM/Dynamic World/WRIS are now REGISTRY entries with
    detection.method 'continuous', registered for lineage and never polled):
      - registry id that exists AND joins this file via dependsOn
      - closed: true + as_of (one-time documents)
    Empty sources[] is legal only for self-authored manifests and
    claim-dataset compilations (per-record citations carry accountability),
    and always requires an explanatory provenance.note."""
    prov = doc.get("provenance", {})
    sources = prov.get("sources", [])
    errs = []
    if not sources:
        if not prov.get("note"):
            errs.append("empty provenance.sources without an explanatory note")
        elif dataset not in CLAIM_DATASETS and not prov.get("produced_by"):
            errs.append(
                "empty provenance.sources is only legal for claim-dataset compilations "
                "(per-record citations) or self-authored artifacts naming produced_by"
            )
        return errs
    for i, s in enumerate(sources):
        if not isinstance(s, dict):
            continue
        # Methodology sources are NOT exempt (review 2026-07-30: the skip let
        # any unregistered source reach L2 by claiming role methodology). They
        # satisfy the same two-way rule; only the licence requirement (L3)
        # exempts them, since a method is cited, not redistributed.
        sid = s.get("id")
        if sid:
            if sid not in reg_ids:
                errs.append(f"provenance.sources[{i}] id '{sid}' is not a known Headwaters registry id")
            elif sid not in joined:
                errs.append(
                    f"provenance.sources[{i}] id '{sid}' exists in the registry but its "
                    "dependsOn does not name this file - add the path so edition alerts reach it"
                )
        elif s.get("closed") is True:
            if not s.get("as_of"):
                errs.append(f"provenance.sources[{i}] is closed but has no as_of (closed sources must be dated)")
        else:
            errs.append(
                f"provenance.sources[{i}] '{str(s.get('title', '?'))[:40]}' has no registry id and is not "
                "closed+as_of - register it (continuous upstreams use detection.method 'continuous')"
            )
    return errs


def calendar_date_errors(doc: dict) -> list[str]:
    """Bounded patterns admit 2026-02-30; real calendars do not. Checks every
    envelope date and claim-record data_date/as_of."""
    from datetime import date

    def bad(v) -> bool:
        if not isinstance(v, str) or len(v) != 10:
            return False  # year / year-month forms carry no day to mis-state
        try:
            date.fromisoformat(v)
            return False
        except ValueError:
            return True

    errs = []
    prov = doc.get("provenance", {})
    if bad(prov.get("produced_at")):
        errs.append(f"produced_at '{prov.get('produced_at')}' is not a real calendar date")
    for i, s in enumerate(prov.get("sources", [])):
        if isinstance(s, dict):
            for k in ("as_of", "retrieved"):
                if bad(s.get(k)):
                    errs.append(f"provenance.sources[{i}].{k} '{s.get(k)}' is not a real calendar date")
    for coll in ("facts", "commitments", "arrangements"):
        for i, r in enumerate(doc.get(coll, []) if isinstance(doc.get(coll), list) else []):
            if isinstance(r, dict):
                for k in ("as_of", "data_date"):
                    if bad(r.get(k)):
                        errs.append(f"$.{coll}[{i}].{k} '{r.get(k)}' is not a real calendar date")
    return errs


def license_errors(doc: dict) -> list[str]:
    """L3: every asserting or input source must carry its upstream licence
    terms - this is the per-row resale audit made executable (spec Part 5)."""
    errs = []
    for i, s in enumerate(doc.get("provenance", {}).get("sources", [])):
        if isinstance(s, dict) and s.get("role") != "methodology" and not s.get("license"):
            errs.append(f"provenance.sources[{i}] '{str(s.get('title', '?'))[:40]}' has no license terms recorded")
    return errs


def provenance_rule_errors(doc: dict) -> list[str]:
    """Method-dependent envelope rules (spec 5.2), enforced at L2."""
    errs = []
    prov = doc.get("provenance", {})
    if prov.get("method") in ("derived", "gee"):
        if not prov.get("produced_by"):
            errs.append("derived artifact without provenance.produced_by (spec 5.2)")
        sources = [s for s in prov.get("sources", []) if isinstance(s, dict)]
        # Derived-from-internal-artifacts legitimately has no external sources;
        # the empty-sources rule (note + produced_by) covers that case. When
        # external sources ARE listed, at least one must be the input.
        if sources and not any(s.get("role") == "input" for s in sources):
            errs.append("derived artifact lists no source with role 'input' (spec 5.2)")
    return errs


def unknown_key_errors(doc: dict, contract: dict) -> list[str]:
    """Top-level keys must be envelope, GeoJSON members, or contract-declared;
    everything else belongs in ext (spec 6.3). Deliberately NOT recursive:
    record-level optional fields (name_<lang>, city-optional keys) are legal."""
    allowed = (
        ENVELOPE_KEYS | GEOJSON_MEMBERS | LEGACY_GRANDFATHERED | LEGACY_UNDERSCORE
        | set(contract.get("properties", {}).keys())
    )
    return [
        f"top-level key '{k}' is not envelope, GeoJSON, contract-declared, or grandfathered legacy - "
        "per-scope additions must live in ext (spec 6.3)"
        for k in doc
        if k not in allowed
    ]


def contract_schema_for(rec: dict, schemas: dict[str, dict]) -> str | None:
    name = CONTRACTS.get(f"{rec['family']}/{rec['dataset']}")
    return name if name and name in schemas else None


def apply_internal_input_floor(results: list[dict]) -> None:
    """An L3 claim cannot rest on ungoverned inputs (review 2026-07-30: Chennai
    ward-profiles reached L3 over an L0 boundary geometry). Any artifact
    declaring provenance.internal_inputs is capped at L2 while any listed
    input is below L2 - an input missing from the catalogue counts as L0.
    Runs to a FIXPOINT so demotions propagate through chains (round-2 review:
    A(L3)->B(L3)->C(L0) must cap A too, not just B)."""
    # Round-3 review: taint is a property of LINEAGE, computed for every
    # declaring node regardless of its own level - an L2 intermediary (no
    # contract published) over an L0 input must still pass taint upward, or
    # A(L3)->B(L2)->C(L0) leaves A laundered at L3. Fixpoint over the graph
    # first; only then cap tainted L3 nodes.
    by_path = {r["path"]: r for r in results}
    taint: dict[str, bool] = {}
    # Round-4 review: a derived/gee/mixed node that DOESN'T declare its
    # lineage is lineage-unknown - conservatively tainted, or an undeclared
    # L2 intermediary hides an L0 dependency from its L3 consumer. (Asserted
    # methods - manual/api/scrape/pdf-extract - carry no internal lineage
    # obligation and are not tainted by omission.)
    for r in results:
        if "internal_inputs" not in r and r.get("method") in ("derived", "gee", "mixed"):
            taint[r["path"]] = True
            r["_weak"] = ["<lineage undeclared>"]
    changed = True
    while changed:
        changed = False
        for r in results:
            if "internal_inputs" not in r or taint.get(r["path"]):
                continue
            weak = [
                p for p in r["internal_inputs"]
                if by_path.get(p) is None
                or by_path[p]["level"] < 2
                or taint.get(p, False)
            ]
            if weak:
                taint[r["path"]] = True
                r["_weak"] = weak
                changed = True
    for r in results:
        if taint.get(r["path"]) and r["level"] >= 3:
            r["level"] = 2
            r["notes"].append(
                "capped at L2: lineage rests (transitively) on ungoverned inputs - "
                + ", ".join(r.get("_weak", [])[:3])
            )
    for r in results:
        r.pop("_weak", None)


# Claim datasets (spec 5.1): every record makes an independently quotable claim
# and MUST carry its own source reference. Maps dataset id -> (collection key,
# acceptable per-record source keys).
CLAIM_DATASETS = {
    "data-root/facts": ("facts", ("source_ids", "sources", "source_label")),
    "data-root/commitments": ("commitments", ("source_ids", "sources", "commitment_source")),
    "data-root/allocations": ("arrangements", ("source_ids", "sources", "source")),
    "data-root/water-bodies-lost": ("lost_bodies", ("source_ids", "sources", "source")),
    "data-root/water-bodies-flagship": ("bodies", ("source_ids", "sources", "source")),
    "data-root/restoration-projects": ("projects", ("source_ids", "sources", "source")),
    "data-root/river-events": ("events", ("source_ids", "sources", "source", "url")),
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
    env_sources = [s for s in doc.get("provenance", {}).get("sources", []) if isinstance(s, dict)]
    env_map = {s.get("id"): s for s in env_sources if s.get("id")}
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
        # Commitments: the dated-citation-only discipline, executable. Every
        # history entry needs a citation (all 107 existing entries corpus-wide
        # already have one - the contract now says what practice always did).
        if coll_key == "commitments":
            for j, h in enumerate(r.get("status_history") or []):
                if isinstance(h, dict) and not (h.get("source_label") or h.get("source_url")):
                    errs.append(f"$.commitments[{i}].status_history[{j}]: no citation (source_label or source_url)")
        # Date signal (spec 5.1): a record's evidence date may live on the
        # record OR on its cited sources - requiring both would be duplication.
        # Commitments are exempt (dates live in status_history by design).
        if coll_key in ("facts", "arrangements") and not r.get("as_of") and not r.get("data_date"):
            resolved = [s for s in r.get("sources", []) if isinstance(s, dict)]
            resolved += [env_map[sid] for sid in r.get("source_ids", []) if sid in env_map]
            if resolved and not any(s.get("as_of") or s.get("retrieved") for s in resolved):
                errs.append(f"$.{coll_key}[{i}]: no date signal - record as_of/data_date or a dated source (spec 5.1)")
    return errs


def assess(rec: dict, schemas: dict[str, dict], scopes: dict[str, str], reg_ids: set[str]) -> dict:
    path = ROOT / rec["path"]
    level = 0  # L0: it's in the catalogue by construction
    notes: list[str] = []
    # L1 = accounted for: registry lineage (watched) OR an explicit coverage-
    # allowlist reason (the UNWATCHED track). Only 'unaccounted' fails L1.
    allowlisted = rec.get("accountability") == "allowlisted"
    if rec["headwaters_sources"] or allowlisted:
        level = 1
    try:
        doc = json.loads(path.read_text())
    except Exception as e:  # noqa: BLE001
        return {"path": rec["path"], "level": level, "notes": [f"unparseable: {e}"][:1]}
    env_errs = envelope_check(doc, rec, schemas)
    if not env_errs:
        # Cumulative ladder: L2 additionally requires scope-registry agreement,
        # source accountability (registry join, declared-closed, or the
        # allowlist track), and the method-dependent provenance rules.
        env_errs += scope_registry_errors(doc, scopes)
        env_errs += source_accountability_errors(
            doc, set(rec["headwaters_sources"]), reg_ids, f"{rec['family']}/{rec['dataset']}"
        )
        env_errs += provenance_rule_errors(doc)
        env_errs += calendar_date_errors(doc)
    if not env_errs:
        if level < 1:
            # The ladder is cumulative for real: a valid envelope on an
            # unaccounted artifact stays L1-blocked until the file gains
            # registry lineage or an allowlist reason.
            notes.append("envelope valid but artifact is unaccounted (no registry lineage, no allowlist reason) - L2 blocked")
            return {"path": rec["path"], "level": level, "notes": notes}
        level = 2
        contract = contract_schema_for(rec, schemas)
        if contract:
            c_errs = validate(doc, schemas[contract], schemas, contract)
            c_errs += claim_provenance_errors(doc, f"{rec['family']}/{rec['dataset']}")
            c_errs += unknown_key_errors(doc, schemas[contract])
            c_errs += license_errors(doc)
            # Fail-closed internal lineage (rounds 2-3: omission kept L3, and
            # `mixed` was exempt while its producer read five repo artifacts):
            # derived/gee/mixed artifacts must DECLARE internal_inputs -
            # explicitly [] when they truly consume no repo artifacts.
            if doc.get("provenance", {}).get("method") in ("derived", "gee", "mixed") and \
                    "internal_inputs" not in doc.get("provenance", {}):
                c_errs.append(
                    "derived/mixed artifact seeking L3 must declare provenance.internal_inputs "
                    "(explicitly [] if none) - the dependency floor is fail-closed"
                )
            if c_errs:
                notes += [f"L3 fail: {e}" for e in c_errs[:5]]
            else:
                level = 3
        else:
            notes.append("no contract published for this dataset (L3 not applicable yet)")
    else:
        notes += [f"L2 fail: {e}" for e in env_errs[:3]]
    result = {"path": rec["path"], "level": level, "notes": notes}
    ii = doc.get("provenance", {}).get("internal_inputs") if isinstance(doc, dict) else None
    if isinstance(ii, list):
        result["internal_inputs"] = [str(p) for p in ii]
    if isinstance(doc, dict):
        m = doc.get("provenance", {}).get("method")
        if m:
            result["method"] = m
    return result


def selftest(schemas: dict[str, dict]) -> int:
    scopes = load_scopes()
    fails: list[str] = []

    def check(name: str, cond: bool) -> None:
        print(f"{name}: {'OK' if cond else 'FAIL'}")
        if not cond:
            fails.append(name)

    def env(d) -> list[str]:
        return validate(d, {"$ref": "envelope.schema.json#/$defs/envelope"}, schemas, "envelope.schema.json")

    def dup(d):
        return json.loads(json.dumps(d))

    facts = json.loads((SCHEMA_DIR / "examples/example-facts.json").read_text())
    wb = json.loads((SCHEMA_DIR / "examples/example-water-bodies-current.geojson").read_text())

    # Positives: examples must pass the FULL L3 path (envelope + registry
    # agreement + accountability + contract + claim + unknown-key), with the
    # examples' own source ids treated as registered-and-joined.
    for name, doc, schema in (("example-facts", facts, "facts.schema.json"),
                              ("example-water-bodies", wb, "water-bodies-current.schema.json")):
        ids = {s["id"] for s in doc["provenance"]["sources"] if s.get("id")}
        errs = env(doc) + validate(doc, schemas[schema], schemas, schema)
        errs += scope_registry_errors(doc, scopes)
        errs += source_accountability_errors(doc, ids, ids)
        errs += provenance_rule_errors(doc)
        errs += claim_provenance_errors(doc, doc["dataset"])
        errs += unknown_key_errors(doc, schemas[schema])
        check(f"{name} passes full L3 path", not errs)
        for e in errs[:6]:
            print(f"  {e}")

    # Negatives: each acceptance gap found in review must stay closed.
    bad = {"nvdm": "1.0", "dataset": "data-root/facts", "scope": {"kind": "city"}}
    check("incomplete envelope rejected", bool(env(bad)))
    d = dup(facts); d["facts"][0].pop("sources")
    check("claim record w/o source rejected", bool(claim_provenance_errors(d, "data-root/facts")))
    d = dup(facts); d["facts"][0]["source_ids"] = ["no-such-source"]
    check("dangling source_ids rejected", bool(claim_provenance_errors(d, "data-root/facts")))
    d = dup(facts); d["scope"] = {"kind": "basin", "id": "hyderabad"}
    check("scope.kind contradicting registry rejected", bool(scope_registry_errors(d, scopes)))
    d = dup(facts); d["provenance"]["method"] = "derived"
    check("derived w/o input-role sources rejected", bool(provenance_rule_errors(d)))
    d = dup(facts); d["provenance"]["sources"][0].pop("id")
    check("undeclared living source rejected", bool(source_accountability_errors(d, set(), set())))
    d["provenance"]["sources"][0]["continuous"] = True
    check("envelope-level continuous flag no longer exempts",
          bool(source_accountability_errors(d, set(), set())))
    d = dup(facts); d["provenance"]["sources"] = []
    check("empty sources on claim dataset with note accepted",
          not source_accountability_errors(d, set(), set(), "data-root/facts"))
    d["provenance"].pop("note")
    check("empty sources without note rejected",
          bool(source_accountability_errors(d, set(), set(), "data-root/facts")))
    d = dup(facts); d["provenance"]["produced_at"] = "2026-02-30"
    check("calendar-invalid date rejected", bool(calendar_date_errors(d)))
    d = dup(facts); d["provenance"]["sources"][0].pop("license")
    check("missing licence terms rejected at L3", bool(license_errors(d)))
    d = dup(facts); d["_hyderabad_special"] = {"leak": True}
    check("new underscore key rejected (closed census, not namespace)",
          bool(unknown_key_errors(d, schemas["facts.schema.json"])))
    d = dup(facts); d["_citation_trace_totally_new"] = {}
    check("new _citation_trace_* key rejected (no prefix wildcard)",
          bool(unknown_key_errors(d, schemas["facts.schema.json"])))
    # Isolated doc: the methodology source is the ONLY source, so the check
    # cannot pass on some other source's failure (review 2026-07-30 found the
    # earlier form was a false positive - the base example's registry id
    # already errored against empty sets).
    meth = {"provenance": {"sources": [{"title": "Sketchy method", "publisher": "nobody", "role": "methodology"}]}}
    check("unregistered methodology source rejected (isolated)",
          bool(source_accountability_errors(meth, set(), set(), "data-root/facts")))
    meth["provenance"]["sources"][0].update({"closed": True, "as_of": "2016"})
    check("closed+as_of methodology source accepted (isolated)",
          not source_accountability_errors(meth, set(), set(), "data-root/facts"))
    d = dup(facts); d["facts"][0].pop("tier")
    check("fact without tier rejected",
          bool(validate(d, schemas["facts.schema.json"], schemas, "facts.schema.json")))
    cm = {"provenance": {"sources": []},
          "commitments": [{"id": "x", "what": "w", "status": "on-track", "due": "2027",
                            "commitment_source": "GO 12",
                            "status_history": [{"date": "2026-07-01", "status": "on-track"}]}]}
    check("history entry without citation rejected",
          bool(claim_provenance_errors(cm, "data-root/commitments")))
    d = dup(facts); d["facts"][0]["data_date"] = "2026-99-99"
    check("out-of-range data_date rejected", bool(validate(d, schemas["facts.schema.json"], schemas, "facts.schema.json")))
    d = dup(facts); d["provenance"]["produced_at"] = "2026-99-99"
    check("out-of-range date rejected", bool(env(d)))
    d = dup(facts); d["hyderabad_special"] = {"leak": True}
    check("undeclared top-level key rejected", bool(unknown_key_errors(d, schemas["facts.schema.json"])))
    d = dup(wb); d["features"] = [dup(wb["features"][0]) for _ in range(501)]
    d["features"].append({"type": "Feature", "geometry": None, "properties": {}})
    errs = validate(d, schemas["water-bodies-current.schema.json"], schemas, "water-bodies-current.schema.json")
    check("invalid record beyond position 500 caught", any("[501]" in e for e in errs))

    # ---- L2 gate selector regression (2026-07-30 review: --diff-filter=A
    # missed renames into serving; unprefixed pathspecs missed path shapes).
    # Selector cases run against a scratch git repo with a stub checker; the
    # accept/reject semantics run the real --check against this repo.
    import subprocess as sp
    import tempfile

    with tempfile.TemporaryDirectory() as td:
        def g(*args):
            sp.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
                   cwd=td, check=True, capture_output=True)
        g("init", "-q")
        (Path(td) / "pipeline-inputs").mkdir()
        (Path(td) / "pipeline-inputs/moved.geojson").write_text("{}")
        (Path(td) / "unrelated.txt").write_text("x")
        g("add", "-A"); g("commit", "-qm", "base")
        base = sp.run(["git", "rev-parse", "HEAD"], cwd=td, check=True,
                      capture_output=True, text=True).stdout.strip()
        (Path(td) / "public/data/nested/deep").mkdir(parents=True)
        (Path(td) / "public/data/direct.json").write_text("{}")
        (Path(td) / "public/data/nested/deep/naked.geojson").write_text("{}")
        (Path(td) / "public/geojson").mkdir()
        (Path(td) / "docs").mkdir()
        (Path(td) / "docs/not-served.json").write_text("{}")
        g("mv", "pipeline-inputs/moved.geojson", "public/geojson/moved.geojson")
        g("add", "-A"); g("commit", "-qm", "pr")
        out = sp.run(["bash", str(ROOT / "scripts/nvdm-l2-gate.sh"), base],
                     cwd=td, capture_output=True, text=True,
                     env={**__import__("os").environ, "NVDM_CHECK_CMD": "echo SELECTED"})
        sel = out.stdout
        check("gate selects direct naked artifact", "public/data/direct.json" in sel)
        check("gate selects nested naked artifact", "public/data/nested/deep/naked.geojson" in sel)
        check("gate selects artifact renamed into serving", "public/geojson/moved.geojson" in sel)
        check("gate ignores non-served paths", "docs/not-served.json" not in sel and "unrelated" not in sel)

    r_ok = sp.run([sys.executable, str(ROOT / "scripts/validate_nvdm.py"),
                   "--check", "public/data/facts-madurai.json"], capture_output=True)
    check("gate accepts a valid L2 artifact", r_ok.returncode == 0)
    r_bad = sp.run([sys.executable, str(ROOT / "scripts/validate_nvdm.py"),
                    "--check", "public/data/hypothetical-naked-artifact.json"], capture_output=True)
    check("gate rejects an uncatalogued naked artifact", r_bad.returncode != 0)

    # Internal-dependency floor (review 2026-07-30): an L3 artifact declaring
    # an internal input below L2 - or missing from the catalogue - caps at L2.
    res = [
        {"path": "a.json", "level": 3, "notes": [], "internal_inputs": ["b.json", "missing.json"]},
        {"path": "b.json", "level": 1, "notes": []},
        {"path": "c.json", "level": 3, "notes": [], "internal_inputs": ["d.json"]},
        {"path": "d.json", "level": 2, "notes": []},
    ]
    apply_internal_input_floor(res)
    check("L3 capped at L2 over sub-L2/missing internal inputs",
          res[0]["level"] == 2 and any("capped" in n for n in res[0]["notes"]))
    check("L3 stands when internal inputs are >= L2", res[2]["level"] == 3)

    # Transitive chain (round-2 review): A(L3)->B(L3)->C(L0) must cap BOTH
    # B and A - the floor runs to a fixpoint, not a single snapshot pass.
    chain = [
        {"path": "A.json", "level": 3, "notes": [], "internal_inputs": ["B.json"]},
        {"path": "B.json", "level": 3, "notes": [], "internal_inputs": ["C.json"]},
        {"path": "C.json", "level": 0, "notes": []},
    ]
    apply_internal_input_floor(chain)
    check("dependency floor propagates transitively (A over B over L0-C)",
          chain[0]["level"] == 2 and chain[1]["level"] == 2)

    # Round-3 regression: an L2 INTERMEDIARY (no contract, legitimately L2)
    # must still pass taint upward - A(L3)->B(L2, declares C)->C(L0) caps A.
    chain2 = [
        {"path": "A.json", "level": 3, "notes": [], "internal_inputs": ["B.json"]},
        {"path": "B.json", "level": 2, "notes": [], "internal_inputs": ["C.json"]},
        {"path": "C.json", "level": 0, "notes": []},
    ]
    apply_internal_input_floor(chain2)
    check("L2 intermediary does not launder weak lineage (round 3)",
          chain2[0]["level"] == 2 and any("capped" in n for n in chain2[0]["notes"]))
    # And a governed L2 intermediary does NOT taint its dependent.
    chain3 = [
        {"path": "A.json", "level": 3, "notes": [], "internal_inputs": ["B.json"]},
        {"path": "B.json", "level": 2, "notes": [], "internal_inputs": ["D.json"]},
        {"path": "D.json", "level": 2, "notes": []},
    ]
    apply_internal_input_floor(chain3)
    check("governed L2 intermediary leaves L3 dependent standing", chain3[0]["level"] == 3)

    # Round-4: an UNDECLARED derived intermediary is lineage-unknown ->
    # tainted; an undeclared asserted-method (api) node carries no lineage
    # obligation and does not taint by omission.
    chain4 = [
        {"path": "A.json", "level": 3, "notes": [], "internal_inputs": ["B.json"]},
        {"path": "B.json", "level": 2, "notes": [], "method": "derived"},
    ]
    apply_internal_input_floor(chain4)
    check("undeclared derived intermediary taints its L3 dependent (round 4)",
          chain4[0]["level"] == 2 and any("undeclared" in n or "ungoverned" in n for n in chain4[0]["notes"]))
    chain5 = [
        {"path": "A.json", "level": 3, "notes": [], "internal_inputs": ["B.json"]},
        {"path": "B.json", "level": 2, "notes": [], "method": "api"},
    ]
    apply_internal_input_floor(chain5)
    check("undeclared asserted-method node does not taint by omission", chain5[0]["level"] == 3)

    # Refresh gate (round-2 review: report mode cannot fail, so workflows now
    # call scripts/nvdm-refresh-gate.sh): a file enveloped at HEAD is enforced;
    # an unenveloped file is skipped, not silently passed through the checker.
    with tempfile.TemporaryDirectory() as td:
        def g2(*args):
            sp.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
                   cwd=td, check=True, capture_output=True)
        g2("init", "-q")
        (Path(td) / "public/data").mkdir(parents=True)
        (Path(td) / "public/data/enveloped.json").write_text('{"nvdm": "1.0", "x": 1}')
        (Path(td) / "public/data/bare.json").write_text('{"x": 1}')
        # Large one-line enveloped artifact (> pipe buffer): under pipefail,
        # `git show | head -c 400` SIGPIPEs git show and the old gate silently
        # SKIPPED big enveloped files (found on the 331 KB coastal transects,
        # 2026-07-31) - pin the fix.
        (Path(td) / "public/data/big-enveloped.geojson").write_text(
            '{"nvdm": "1.0", "features": [' + ", ".join(["0"] * 1_000_000) + "]}"
        )
        g2("add", "-A"); g2("commit", "-qm", "base")
        out = sp.run(["bash", str(ROOT / "scripts/nvdm-refresh-gate.sh"),
                      "public/data/enveloped.json", "public/data/bare.json",
                      "public/data/big-enveloped.geojson"],
                     cwd=td, capture_output=True, text=True,
                     env={**__import__("os").environ, "NVDM_CHECK_CMD": "echo ENFORCED"})
        check("refresh gate enforces files enveloped at HEAD",
              "public/data/enveloped.json" in out.stdout.split("ENFORCED")[-1])
        check("refresh gate skips unenveloped files without passing them",
              "bare.json not enveloped at HEAD - skipped" in out.stdout
              and "bare.json" not in out.stdout.split("ENFORCED")[-1])
        check("refresh gate enforces LARGE enveloped files (no SIGPIPE skip)",
              "big-enveloped.geojson" in out.stdout.split("ENFORCED")[-1])

    return 1 if fails else 0


def main(argv: list[str]) -> int:
    schemas = load_schemas()
    if "--selftest" in argv:
        return selftest(schemas)

    cat = json.loads(CATALOGUE.read_text())
    records = cat["files"]
    scopes = load_scopes()
    reg_ids = registry_source_ids()
    results = [assess(r, schemas, scopes, reg_ids) for r in records]
    apply_internal_input_floor(results)
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
        f"- Accountability tracks (L1): watched = registry dependsOn lineage; allowlisted = explicit",
        f"  UNWATCHED reason; {sum(1 for r in results if r['level'] < 1)} artifacts remain unaccounted (largest block: basins packs).",
        f"- L2/L3 progress is the migration meter: the Madurai pilot moved first; each city's",
        f"  migration lifts its artifacts (spec Part 9 order).",
        "- CI (`.github/workflows/nvdm-conformance.yml`): selftest, catalogue/report freshness,",
        "  and the `--check` L2 gate on newly added data artifacts are all BLOCKING (NVDM v1",
        "  accepted 2026-07-30). Legacy files stay report-only until migrated (spec 9.4).",
        "",
    ]
    OUT_MD.write_text("\n".join(lines))
    print(f"L0 {n} / L1 {sum(counts[k] for k in counts if k >= 1)} / "
          f"L2 {sum(counts[k] for k in counts if k >= 2)} / L3 {counts[3]} -> {OUT_MD.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

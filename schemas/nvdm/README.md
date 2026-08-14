# NVDM - Neer Vazhvu Data Model (machine-readable contracts)

This directory is the authoritative machine-readable form of the NVDM data-model
standard: the envelope every data artifact carries (identity + scope +
provenance + conventions), per-dataset payload contracts, the scope registry,
and worked examples.

**Status: NVDM v1 ACCEPTED 2026-07-30** after four adversarial review rounds.
The L2 gate on newly added data artifacts is ENFORCING.

The full normative prose specification is maintained privately while its
publication is decided; for validation purposes **these schemas and the
validator are authoritative**. Spec section references in schema descriptions
(e.g. "spec 5.1") refer to that document.

## Layout

- `envelope.schema.json` - the identity/provenance envelope (all artifacts).
  `$defs`: `scope`, `source` (with `role` and `closed`), `provenance`,
  `projection`, `envelope`.
- `<dataset>.schema.json` - Tier-A payload contracts, keyed by full dataset id
  in `scripts/validate_nvdm.py` (`CONTRACTS`).
- `scopes.json` - the scope registry (id -> kind, append-only).
- `examples/` - conformant artifacts, one per major shape; exercised by the
  validator selftest.

## Conformance levels (assessed by `scripts/validate_nvdm.py`)

- **L0 Catalogued** - inventoried in `docs/architecture/dataset-catalogue.json`.
- **L1 Registered** - upstream sources joined to the Headwaters registry
  (`scripts/source-registry/`) via `dependsOn`.
- **L2 Enveloped** - valid envelope; identity agrees with path and scope
  registry; every source registered or explicitly `closed` + dated; derived
  artifacts name their generator and input sources.
- **L3 Contracted** - payload validates against the dataset's schema;
  per-record source references on claim datasets; undeclared top-level keys
  rejected (per-scope additions live in `ext`).

## Commands

```sh
python3 scripts/validate_nvdm.py --selftest     # schema + rule self-checks
python3 scripts/build_dataset_catalogue.py      # regenerate the catalogue
python3 scripts/validate_nvdm.py                # regenerate the conformance report
python3 scripts/validate_nvdm.py --check FILE…  # gate: exit 1 unless FILE reaches L2
```

CI (`.github/workflows/nvdm-conformance.yml`) runs the selftest, the freshness
checks, and the L2 gate on newly added data artifacts - all **blocking**
(v1 accepted 2026-07-30). New artifacts carry the envelope from their first
commit; legacy files remain report-only until their city migrates.

## Semantic core candidate

`semantic-core.schema.json` and `semantic-records.schema.json` are a
**0.1 candidate**, pressure-tested with the synthetic
`examples/example-semantic-records.json` bundle. They define the interoperable
shape for canonical subjects, explicit subject sets, immutable evidence and
typed claims. The validator selftest exercises both schema conformance and
cross-record graph integrity.

This candidate does **not** change accepted NVDM v1. `semantic-core/records` is
intentionally absent from `CONTRACTS`, no production artifact uses it, and no
concept vocabulary has been accepted by implication. Registration is a later
decision after the public/private ontology boundary, projector compatibility
and persistence implications have been reviewed. See
`docs/architecture/nvdm-semantic-core.md`.

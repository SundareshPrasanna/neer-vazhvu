# NVDM - Neer Vazhvu Data Model (machine-readable contracts)

This directory is the authoritative machine-readable form of the NVDM data-model
standard: the envelope every data artifact carries (identity + scope +
provenance + conventions), per-dataset payload contracts, the scope registry,
and worked examples.

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

CI (`.github/workflows/nvdm-conformance.yml`) runs the selftest and freshness
checks as blocking, and the L2 gate on newly added data artifacts as
**advisory** until NVDM v1 is accepted, after which it becomes enforcing.
New artifacts should carry the envelope from their first commit regardless -
retrofit is migration debt.

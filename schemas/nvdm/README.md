# NVDM - Neer Vazhvu Data Model (machine-readable contracts)

This directory is the authoritative machine-readable form of the NVDM data-model
standard: the envelope every data artifact carries (identity + scope +
provenance + conventions), per-dataset payload contracts, the scope registry,
and worked examples.

**Status: NVDM v1 ACCEPTED 2026-07-30** after four adversarial review rounds.
The gate on changed data artifacts (`scripts/nvdm-gate.sh`) is ENFORCING. **1.1** (additive,
no artifact changes) gives places their hierarchy and external identities in
the scope registry; see below.

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
- `scopes.json` - the scope registry (append-only), one place registry for
  the platform; `scopes.schema.json` closes its vocabularies. Read it through
  `scripts/nvdm_scopes.py` or `src/lib/scopes.ts`, never directly.
- `examples/` - conformant artifacts, one per major shape; exercised by the
  validator selftest.

## 1.1: places carry their hierarchy in the registry

- **Ids are opaque.** A scope id is a name, never parsed. The `tn-` of
  `tn-thanjavur` is part of a legacy name; hierarchy is a relation, not a spelling.
- **Entry shape.** `{kind, name, refs[], relations[]}`. `refs` are namespaced
  external identities in the PlaceRef grammar (`system`, `level`, `code`,
  `as_of` = source vintage): `iso3166-1`, `iso3166-2`, `lgd`, `census-2011`.
  `relations` are typed: `administrative-parent` (place to parent place),
  `intersects` (water system to a place it crosses, geometry only) and
  `projection-of` (an administrative view to its canonical water system:
  `cauvery-ka` and `cauvery-tn` are views of `cauvery`).
- **Country is derived, never stored.** A place walks `administrative-parent`
  to a `country` scope (`country` is a new scope kind); a water system goes
  through the places it intersects and may legitimately reach two.
- **Validator rules.** Closed vocabularies, registered targets on the right
  axis, an acyclic parent graph, exactly one country per place, and no
  external code claimed by two scopes. A TypeScript test holds `CITY_IDS`,
  the city configs and the seeded `cities` table to the registry.

## Conformance levels (assessed by `scripts/validate_nvdm.py`)

- **L0 Catalogued** - inventoried in `docs/architecture/dataset-catalogue.json`.
- **L1 Registered** - upstream sources joined to the Headwaters registry
  (`scripts/source-registry/`) via `dependsOn`.
- **L2 Enveloped** - valid envelope; identity agrees with path and scope
  registry; every source registered or explicitly `closed` + dated; dates
  real, none in the future, production dates from 2000 on; derived artifacts
  name their generator and input sources; per-record source references on
  claim datasets, contracted or not.
- **L3 Contracted** - payload validates against the dataset's schema;
  undeclared top-level keys rejected (per-scope additions live in `ext`).

## Commands

```sh
python3 scripts/validate_nvdm.py --selftest     # schema + rule self-checks
python3 scripts/build_dataset_catalogue.py      # regenerate the catalogue
python3 scripts/validate_nvdm.py                # regenerate the conformance report
python3 scripts/validate_nvdm.py --check FILE…  # exit 1 unless FILE reaches L2
bash scripts/nvdm-gate.sh origin/main           # the gate, as CI runs it on a PR
```

`scripts/nvdm-gate.sh` judges every added, renamed, modified or untracked file
under `public/data` and `public/geojson` against the base: a new file must
reach L2, a file at L2 or L3 must keep its level, a file below L2 is skipped
until it migrates. Both sides are assessed under the current rules, so only the
data change can move a level. CI (`.github/workflows/nvdm-conformance.yml`)
runs the selftest, the freshness checks and the gate on every PR, and every
workflow that pushes data runs the gate against `HEAD` before committing - all
**blocking** (v1 accepted 2026-07-30).

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

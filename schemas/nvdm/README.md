# NVDM: the Neer Vazhvu Data Model

NVDM is the standard every data file in this repository follows. Each file
carries an **envelope** that states what the file is, which place or water
system it is about, and where its values came from, and the content of the most
used datasets is fixed by a schema. A validator measures every file against the
standard, and a gate in CI stops a change that adds a non-conforming file or
weakens a conforming one.

This directory holds the standard: the rules, the schemas, the register of
places, worked examples, and the documents below.

## Status

| What | Status | Date |
|---|---|---|
| NVDM 1.0: the envelope, the four conformance levels, the first payload contracts | Accepted, in force | 2026-07-30 |
| NVDM 1.1: place identity (external identities, typed relations and the `country` kind in the scope registry) | In force; no artifact had to change | 2026-09-30 |
| The gate on changed data files | Enforcing on every pull request and every scheduled data refresh | 2026-07-30 |
| Semantic core 0.1 (`semantic-core.schema.json`, `semantic-records.schema.json`) | Candidate, not in force; no artifact uses it | 2026-08-04 |

## Conformance levels

Every data file is at one of four levels. They are cumulative: a file reaches a
level only when it has reached every level below it.

| Level | Name | What it takes |
|---|---|---|
| L0 | Catalogued | The file is listed in the dataset catalogue, `docs/architecture/dataset-catalogue.json`. |
| L1 | Accounted | The file is tied to its upstream: a source registry entry names it in `dependsOn`, or the coverage allowlist names it with a reason. |
| L2 | Enveloped | The file carries a valid envelope; its dataset and scope agree with its path and with the scope registry; every source is either registered with this file in its `dependsOn`, or declared closed and dated; dates are real and not in the future; derived files name their generator and an input; on claim datasets every record cites its source. |
| L3 | Contracted | The file's dataset has a payload contract and the file satisfies it: the payload validates, no undeclared top-level key, every data source records its licence, a derived file declares its internal inputs, and none of those inputs is below L2. |

The gate requires a new file to reach L2, and a file that is at L2 or L3 to
keep its level. RULES.md Part 10 has the full statement.

## The documents

| Document | Read it when |
|---|---|
| [RULES.md](RULES.md) | You need to know exactly what is required. It states each rule as the validator enforces it, and marks the conventions nothing checks. |
| [GUIDE.md](GUIDE.md) | You have a job to do: add a file, cite a source, register a place, add a contract, or fix a failed gate. Copyable steps, and a table of every error message with its fix. |
| [REFERENCE.md](REFERENCE.md) | You need a list: envelope fields and types, allowed values, registered scopes, contracts, legacy keys. Generated; do not edit. |
| [CHANGELOG.md](CHANGELOG.md) | You want to know what changed and when. |

Schema descriptions and validator messages cite the rules as "spec 5.1": that
is section 5.1 of RULES.md.

## What is in this directory

- `envelope.schema.json`: the envelope. Its definitions are `date`, `scope`,
  `projection`, `source`, `provenance`, `rights_determination` and `envelope`.
- `<dataset>.schema.json`: one payload contract per dataset. A contract is in
  force when `CONTRACTS` in `scripts/validate_nvdm.py` lists it.
- `scopes.json`: the scope registry, the list of every place and water system
  a file may be about. `scopes.schema.json` fixes the shape of an entry.
- `examples/`: small conforming files that the validator's selftest runs
  through the full check: `example-facts.json`,
  `example-water-bodies-current.geojson`, `example-atlas-briefs.json`,
  `example-atlas-assessments.json`, and `example-semantic-records.json` for the
  candidate semantic core.
- `semantic-core.schema.json`, `semantic-records.schema.json`: the candidate
  semantic core (RULES.md 11.5).
- `LICENSE`: the licence notice for the specification (see Licence below).

The tools live in `scripts/`:

| Tool | What it does |
|---|---|
| `scripts/build_dataset_catalogue.py` | Lists every data file with its family, scope, dataset and source joins. |
| `scripts/validate_nvdm.py` | Assesses every catalogued file and writes the conformance report; `--check` judges named files; `--selftest` tests the schemas, the scope registry and the rules themselves. |
| `scripts/build_nvdm_reference.py` | Generates REFERENCE.md. |
| `scripts/nvdm-gate.sh` | The gate: judges every changed data file against a base revision. |
| `scripts/nvdm_write.py`, `scripts/lib/nvdm-write.ts` | The writers: rewrite a data file without losing its envelope. |
| `scripts/nvdm_scopes.py`, `src/lib/scopes.ts` | The readers of the scope registry. |
| `scripts/source-registry/` | The Headwaters registry: one entry per upstream source, with its licence and the files that depend on it. |

## Commands

```sh
python3 scripts/build_dataset_catalogue.py      # 1. regenerate the catalogue
python3 scripts/validate_nvdm.py                # 2. regenerate the conformance report
python3 scripts/build_nvdm_reference.py         # 3. regenerate REFERENCE.md
python3 scripts/validate_nvdm.py --selftest     # test the schemas, the registry and the rules
python3 scripts/validate_nvdm.py --check FILE   # does FILE reach L2?
bash scripts/nvdm-gate.sh origin/main           # the gate, as CI runs it on a pull request
```

Run the catalogue before the conformance report: the report is assessed from
the catalogue. The report,
[docs/architecture/nvdm-conformance.md](../../docs/architecture/nvdm-conformance.md),
gives the current level of every file. CI
(`.github/workflows/nvdm-conformance.yml`) runs the selftest, checks that all
three generated outputs are fresh, and runs the gate.

## Licence

The NVDM specification in this directory (these documents, the schemas, the
scope registry and the examples) is licensed under CC BY 4.0, with attribution
to "Neer Vazhvu"; the full notice is [LICENSE](LICENSE). The validator and the
other tools in `scripts/` stay under the repository's MIT licence. The data
files that follow the standard are not covered by either grant and keep the
terms of their own sources, as [DATA-LICENSE.md](../../DATA-LICENSE.md) sets
out.

## What is not here

This directory states the rules and how to follow them. The reasoning behind
individual design choices and the project's planning notes are kept outside the
repository. Nothing a contributor or an implementer needs in order to conform
is held back: if the validator enforces it, RULES.md states it.

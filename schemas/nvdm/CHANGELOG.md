# NVDM changelog

What changed for someone who writes or changes a data file, newest first. Each
line is one change. Version numbers are explained in [RULES.md](RULES.md) Part
11. New scopes are not listed one by one: the scope registry only grows, and
[REFERENCE.md](REFERENCE.md) lists every scope registered today.

## 1.1: place identity (2026-09-30)

No artifact had to change for 1.1.

- 2026-09-30: The rules are published as RULES.md, with GUIDE.md, a generated REFERENCE.md and this changelog. After regenerating the conformance report, also run `python3 scripts/build_nvdm_reference.py`; CI checks that REFERENCE.md is fresh.
- 2026-09-30: The specification in this directory (documents, schemas, scope registry, examples) is licensed under CC BY 4.0; see LICENSE. The tools stay MIT, and data files keep the terms of their sources.
- 2026-09-30: Level L1 is named "accounted" everywhere. Its meaning did not change: a registry entry names the file, or the coverage allowlist gives a reason.
- 2026-09-30: Every "spec N.N" in a schema description or a validator message now points at a section of RULES.md, and the selftest fails if one does not.
- 2026-09-30: A scope registry entry is now an object with `kind`, `name`, `refs` and `relations`. Read the registry through `scripts/nvdm_scopes.py` or `src/lib/scopes.ts`.
- 2026-09-30: New scope kind `country`. Every place must reach exactly one country through `administrative-parent`; a water system must reach at least one through the places it intersects.
- 2026-09-30: Scopes can carry external identities (`refs`) in four systems: `iso3166-1`, `iso3166-2`, `lgd`, `census-2011`. One system and code pair belongs to one scope.
- 2026-09-30: Scopes carry typed relations: `administrative-parent`, `intersects` and `projection-of`. Every `intersects` needs a `method` and an `evidence` path or URL.
- 2026-09-30: Scope ids are opaque. A prefix such as `tn-` is part of the name and is never parsed; hierarchy is read from relations.
- 2026-09-30: The selftest checks the scope registry's own rules.

## 1.0 (accepted 2026-07-30)

- 2026-09-30: One gate, `scripts/nvdm-gate.sh`, replaces the two earlier gate scripts. It also judges modified files: a file at L2 or L3 must keep its level.
- 2026-09-30: No envelope date may be in the future, and `produced_at` and `retrieved` must not be earlier than 2000.
- 2026-09-30: Per-record citations on claim datasets are checked at L2, and on all seven claim datasets whether or not they have a contract. Before, they were checked at L3 on contracted datasets only.
- 2026-09-30: A schema that uses a JSON Schema keyword the validator does not implement fails the selftest. A contract named in `CONTRACTS` whose schema file is missing is an error.
- 2026-09-29: `atlas/briefs` accepts an optional `detail.groundwaterWells`.
- 2026-09-29: The TypeScript writer writes a bare list as it is when there is no envelope on disk to keep.
- 2026-09-01: New scope kinds `block` and `gram-panchayat`.
- 2026-09-01: New contracts `atlas/briefs` and `atlas/assessments`, each with an example.
- 2026-08-19: New scope kind `waterway`.
- 2026-08-04: Candidate semantic core 0.1 added: two schemas and an example that the selftest exercises. It is not in force and no artifact uses it.
- 2026-08-02: New optional `provenance.rights_determination`, with a closed shape.
- 2026-08-02: The `license` of a source that has a registry id must equal the registry's licence string.
- 2026-07-31: `data-root/cgwb-stations` declares five more optional keys: `quality_note`, `series_label`, `unit_label`, `reading_kind`, `cadence_note`.
- 2026-07-31: The Python writer gains `merge_envelope` and the `indent` option.
- 2026-07-30: New optional `provenance.internal_inputs`. A `derived`, `gee` or `mixed` file must declare it to reach L3, and a file is capped at L2 while any input in its chain is below L2, missing, or undeclared.
- 2026-07-30: Writers added: `write_artifact` in `scripts/nvdm_write.py` and `writeArtifact` in `scripts/lib/nvdm-write.ts` keep a file's envelope when a script rewrites it. The Python writer's `envelope_from` option takes the envelope from another file.
- 2026-07-30: Workflows that push refreshed data run the gate before they commit.
- 2026-07-30: The gate becomes enforcing: a new data file must reach L2.
- 2026-07-30: L1 counts a file as accounted when the coverage allowlist gives a reason for it, not only when a registry entry names it.
- 2026-07-30: Each source must be accountable on its own: a registry id whose `dependsOn` names the file, or `closed` with `as_of`. Continuous sources are registered with `detection.method` `continuous`. A `methodology` source is not exempt.
- 2026-07-30: `provenance.sources` may be empty only for a claim dataset or a self-authored file naming `produced_by`, and always with a `note`.
- 2026-07-30: A full date must be a real calendar date.
- 2026-07-30: Every source whose role is not `methodology` must record its `license` to reach L3.
- 2026-07-30: On a contracted dataset, an undeclared top-level key is rejected. Two closed lists of legacy keys are tolerated; a new underscore-prefixed key is not.
- 2026-07-30: Facts require `tier` and `unit`. Commitments require `due` and `status_history`, and every history entry needs a citation.
- 2026-07-30: `year_book_summaries` is promoted from an extension into the `data-root/cgwb-stations` contract as an optional key.
- 2026-07-30: First release: the envelope, the scope registry, the four conformance levels, the validator, and contracts for `data-root/facts`, `data-root/commitments`, `data-root/allocations`, `data-root/ward-profiles`, `data-root/cgwb-stations`, `data-root/restoration-priority`, `geojson-layers/water-bodies-current` and `geojson-layers/rivers`.

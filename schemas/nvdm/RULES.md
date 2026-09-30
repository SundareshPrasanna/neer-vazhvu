# NVDM rules

NVDM (the Neer Vazhvu Data Model) is the standard every data file in this
repository follows: how a file says what it is, which place it is about, where
its values came from, and what shape its content takes.

This document states the rules exactly as `scripts/validate_nvdm.py` enforces
them. If this document and the validator ever disagree, the validator is right
and this document has a bug.

## How to read this document

Every rule carries one of four tags, so you always know what stands behind it.

| Tag | Meaning |
|---|---|
| **Checked at L2** | The validator tests it. A file that breaks it cannot reach level L2 (Part 10). |
| **Checked at L3** | The validator tests it on datasets that have a payload contract. A file that breaks it stays at L2. |
| **Checked by the selftest** | `python3 scripts/validate_nvdm.py --selftest` tests it. CI runs the selftest. |
| **Convention, not checked** | The practice this repository follows. Nothing tests it. |

Section numbers are stable identifiers. When a schema description or a
validator message says "spec 5.1", it means section 5.1 of this document. The
numbers are not consecutive: Parts 3, 8 and 12 are not used.

This document explains meaning. Exact field types, the allowed values of every
closed list and the registered scopes are generated into
[REFERENCE.md](REFERENCE.md) and are not repeated here. The current level of
every file is in the conformance report,
[docs/architecture/nvdm-conformance.md](../../docs/architecture/nvdm-conformance.md). Worked, copyable
steps are in [GUIDE.md](GUIDE.md).

## Part 1 - What NVDM governs

### 1.1 What is governed

NVDM governs every `.json` and `.geojson` file under `public/data/` and
`public/geojson/`. Each such file is called an **artifact**.

`scripts/build_dataset_catalogue.py` lists every artifact in
`docs/architecture/dataset-catalogue.json`, and the validator assesses each
listed artifact.

The validator reads files only. Files of other types (imagery, map tiles,
PDFs), database tables, API responses and application configuration are not
assessed.

## Part 2 - Vocabulary

| Term | Meaning |
|---|---|
| Artifact | One `.json` or `.geojson` file under `public/data/` or `public/geojson/`. |
| Dataset | A named kind of artifact, written `<family>/<stem>`, for example `data-root/ward-profiles`. One dataset has one artifact per place. |
| Family | The group a dataset belongs to, taken from the directory the file is in (section 4.2). |
| Scope | The one place or water system an artifact is about, for example the city `madurai` or the basin `kabini`. |
| Scope registry | `schemas/nvdm/scopes.json`: the list of every scope an artifact may name. |
| Envelope | The top-level keys that state an artifact's identity and provenance: `nvdm`, `dataset`, `scope`, `provenance`, and optionally `projection` and `ext`. |
| Payload | Everything in the artifact that is not the envelope: the data itself. |
| Contract | A JSON Schema in `schemas/nvdm/` that fixes the payload of one dataset. |
| Source | An upstream publication or service that values were taken from. |
| Headwaters registry | `scripts/source-registry/*.json`: one entry per upstream source, recording its publisher, URL, licence, how a new edition is detected, and `dependsOn`, the list of repository files that rest on it. |
| Coverage allowlist | The `UNWATCHED` map in `scripts/lib/headwaters-coverage.ts`: artifacts that have no registry entry, each with a written reason. |
| Dataset catalogue | `docs/architecture/dataset-catalogue.json`, generated: every artifact with its family, scope, dataset and registry joins. |
| Conformance level | L0 to L3: how much of NVDM an artifact satisfies (Part 10). |
| Gate | `scripts/nvdm-gate.sh`: the check that blocks a change which adds a non-conforming artifact or lowers the level of a conforming one (section 10.3). |
| Claim dataset | A dataset whose records each make an independently quotable claim, so each record must cite its own source (section 5.1). |

## Part 4 - Identity and scope

### 4.1 Scope ids and the scope registry

Every artifact is about exactly one scope. The envelope states it as
`"scope": { "kind": "...", "id": "..." }`.

- The `id` must be a key of `schemas/nvdm/scopes.json`. **Checked at L2.**
- The `kind` must equal the kind the registry records for that id. An artifact
  that says `{ "kind": "basin", "id": "hyderabad" }` fails, because the
  registry says `hyderabad` is a city. **Checked at L2.**
- An id is a lowercase slug: a lowercase letter followed by lowercase letters,
  digits and hyphens. **Checked at L2** (in the artifact) and **checked by the
  selftest** (in the registry).
- An id is an opaque name. No code reads meaning out of its spelling. The `tn-`
  in `tn-thanjavur` is part of the name and nothing more; the fact that
  Thanjavur is in Tamil Nadu is recorded as a relation (section 4.5).
  **Convention, not checked**, and supported by the two registry readers
  (`scripts/nvdm_scopes.py` and `src/lib/scopes.ts`), which expose hierarchy
  only through relations.
- An id is stable forever. The display `name` may change; the id may not.
  **Convention, not checked.**

A registry entry has four keys: `kind`, `name`, and optionally `refs` and
`relations`. No other key is allowed. **Checked by the selftest.**

The list of kinds is closed. Appending a kind is a one-line change to
`envelope.schema.json` and counts as a MINOR version change (section 11.2).

Read the registry through `scripts/nvdm_scopes.py` (Python) or
`src/lib/scopes.ts` (TypeScript), not by parsing the file yourself.

### 4.2 Dataset ids

A dataset id is `<family>/<stem>`, for example `geojson-layers/rivers`.

- It must match `^[a-z-]+/[a-z0-9-]+$`: lowercase letters, digits and hyphens,
  with exactly one slash. **Checked at L2.**
- The **family** comes from where the file is:

  | File location | Family |
  |---|---|
  | anywhere under `public/geojson/` | `geojson-layers` |
  | directly in `public/data/` | `data-root` |
  | `public/data/<directory>/...` | the directory name, for example `atlas`, `basins`, `cascade`, `corridors`, `ingres`, `rich-bodies`, `waterways` |

- The **stem** is the file name with the scope and the extension removed
  (section 4.3).

There is no central list of datasets to edit. A dataset exists as soon as the
catalogue lists its first artifact.

### 4.3 File paths and identity agreement

The catalogue builder derives a scope and a dataset from each file's path. The
envelope must state the same two values. **Checked at L2**: a mismatch is
reported as `identity: dataset '...' != path-derived '...'` or
`identity: scope.id '...' != path-derived '...'`.

How the path is read:

| Path | Scope | Stem |
|---|---|---|
| `public/data/<scope>-<stem>.json`, `public/geojson/<scope>-<stem>.geojson` | the leading id, when it is a registered city or region | the rest of the name |
| `public/data/<stem>-<scope>.json` | the trailing id, when it is a registered city or region | the rest of the name |
| `public/data/basins/<scope>/<file>` | the registered basin id in the path | the file name |
| `public/data/basins/<scope>/<layer>/<file>` | the registered basin id in the path | `<layer>`: every file in the directory belongs to one dataset |
| `public/data/corridors/<scope>/...`, `public/data/waterways/<scope>/...` | the directory name | the file name, or the subdirectory when nested |
| `public/data/atlas/<state>/<district>/<file>` | `<state>-<district>`, for example `tn-thanjavur` | the file name |
| `public/data/atlas/<state>/<district>/<layer>/<file>` | `<state>-<district>` | `<layer>`: every file in the directory belongs to one dataset |
| `public/data/atlas/<state>/<file>` | the registered state whose ISO 3166-2 code ends in `<state>` (`tn` is `IN-TN`, so `tamil-nadu`) | the file name |
| files in a `rich-bodies/` directory | the city of the water body whose slug starts the file name, from `src/lib/water-bodies/rich-bodies.json` | the rest of the name, or `polygon` when nothing is left |

A short fixed list of older file names that carry no city id (for example
`ward-profiles.json`, which is Chennai's) is mapped to a scope by name inside
the catalogue builder. The list exists for files that predate the naming rule.

A file whose scope cannot be derived gets the scope `unknown`. `unknown` is not
a registered scope, so such a file cannot reach L2.

For new city files, put the city id first (`<scope>-<stem>`).
**Convention, not checked**: the catalogue accepts the id at either end.

### 4.4 External identities (refs)

A registry entry may list the scope's identities in outside systems, so the
scope can be matched to other people's data without guessing:

```json
"tn-thanjavur": {
  "kind": "district",
  "name": "Thanjavur",
  "refs": [
    { "system": "lgd", "level": "district", "code": "586" },
    { "system": "census-2011", "level": "district", "code": "620", "as_of": "2011" }
  ],
  "relations": [{ "type": "administrative-parent", "target": "tamil-nadu" }]
}
```

- A ref has `system`, `level` and `code`, and optionally `as_of` (the vintage of
  the source the code was read from). No other key is allowed.
  **Checked by the selftest.**
- `system` and `level` come from closed lists. **Checked by the selftest.**
- One `system` and `code` pair belongs to one scope. Two scopes claiming the
  same pair is an error. **Checked by the selftest.**
- A code is read from a file in the repository or verified at its publisher,
  never guessed. **Convention, not checked.**

Refs were introduced in NVDM 1.1. They live in the registry only; an artifact's
envelope does not repeat them.

### 4.5 Relations

Hierarchy and geography are recorded as typed relations from one registered
scope to another. There are three types.

| Type | From | To | Meaning |
|---|---|---|---|
| `administrative-parent` | a place | a place | The place sits inside the target: a district inside a state, a state inside a country. |
| `intersects` | a water system | a place | The water system's geometry crosses the place. It says nothing about supply or entitlement. |
| `projection-of` | a view of a water system | a water system | The scope is an administrative view of the target: `cauvery-tn` is the Tamil Nadu view of `cauvery`. |

A **water system** is a scope of kind `basin`, `waterway` or `body`. Every
other kind is a **place**.

Rules, all **checked by the selftest**:

- The `target` must be another registered scope, not the scope itself.
- `projection-of` must point at a water system. `administrative-parent` and
  `intersects` must point at a place.
- A water system and a country have no `administrative-parent`.
- `administrative-parent` relations must not form a cycle.
- Every `intersects` must carry a `method` (how the relation was established,
  from a closed list) and an `evidence` string that lets someone re-check it.
  The evidence must be either a URL starting with `http://` or `https://`, or
  the path of a file that exists in the repository.

```json
"kabini": {
  "kind": "basin",
  "name": "Kabini",
  "relations": [
    { "type": "intersects", "target": "karnataka", "method": "geometry",
      "evidence": "public/data/basins/kabini/boundary.geojson" },
    { "type": "intersects", "target": "kerala", "method": "geometry",
      "evidence": "public/data/basins/kabini/context-boundary.geojson" }
  ]
}
```

The registry does not check that an `intersects` starts from a water system;
it checks only where the relation points. Starting it from a water system is a
**convention, not checked**.

### 4.6 Country is derived, never stored

No entry has a `country` key, and the schema rejects one. The country of a
scope is worked out from its relations:

- A place follows `administrative-parent` upward until it reaches a scope of
  kind `country`.
- A water system takes the countries of the places it `intersects`.

Rules, **checked by the selftest**:

- A place must reach exactly one country.
- A water system must reach at least one country. It may reach more than one:
  a river that crosses a border is legal, and then has no single country.

### 4.7 What is checked in the registry, and when

The rules in 4.4 to 4.6 describe the registry file itself. They run in the
selftest, not when an artifact is assessed. CI runs the selftest on every pull
request that changes `schemas/nvdm/` (section 10.4), so a registry that breaks
a rule cannot be merged.

When an artifact is assessed, only the two rules in 4.1 apply to it: its
`scope.id` is registered and its `scope.kind` matches.

One further agreement is held by a TypeScript test,
`src/lib/cities/onboarding-contract.test.ts`: the registry's `city` and
`region` scopes must be exactly the application's list of cities.

## Part 5 - The envelope

Every artifact carries an envelope: a small set of top-level keys that say what
the file is and where its values came from. In an ordinary JSON object the keys
sit at the top level beside the payload. In a GeoJSON FeatureCollection they
sit at the top level too, beside `type` and `features`; RFC 7946 allows such
extra members and GeoJSON readers ignore them.

```json
{
  "nvdm": "1.0",
  "dataset": "data-root/tank-levels",
  "scope": { "kind": "city", "id": "madurai" },
  "provenance": {
    "sources": [
      {
        "id": "example-tank-bulletin",
        "title": "Tank level bulletin",
        "publisher": "Example Water Department",
        "url": "https://example.org/tank-bulletins/",
        "license": "government publication, cited with attribution",
        "as_of": "2026-08",
        "retrieved": "2026-09-30"
      },
      {
        "title": "Tank survey report",
        "publisher": "Example Water Department",
        "closed": true,
        "as_of": "2016",
        "license": "government publication, cited with attribution"
      }
    ],
    "method": "scrape",
    "produced_at": "2026-09-30",
    "produced_by": "scripts/build_madurai_tank_levels.py",
    "note": "Two tanks had no reading in August.",
    "conventions": { "units": "levels in metres above the sill" }
  },
  "tanks": [{ "name": "Example tank", "level_m": 2.4, "as_of": "2026-08" }]
}
```

The envelope keys, all **checked at L2**:

| Key | Required | What it states |
|---|---|---|
| `nvdm` | yes | The NVDM version the file is written against, as `MAJOR.MINOR` (Part 11). |
| `dataset` | yes | The dataset id (section 4.2). Must agree with the path (section 4.3). |
| `scope` | yes | The one place or water system the file is about (section 4.1). |
| `provenance` | yes | Where the values came from and how the file was produced. |
| `projection` | no | Present when the file is a view of evidence that belongs to another scope (section 5.7). |
| `ext` | no | Additions specific to this scope (section 6.3). |

Inside `provenance`:

| Key | Required | What it states |
|---|---|---|
| `sources` | yes | The upstream sources, as a list (section 5.3). May be empty only in the two cases section 5.3 names. |
| `method` | yes | How the values were obtained, from a closed list (section 5.2). |
| `produced_at` | yes | The date this file was generated or compiled (section 5.6). |
| `produced_by` | sometimes | The script that generated the file, as a repository path, or `"manual"`. Required for derived files (section 5.2) and for files with no sources (section 5.3). |
| `note` | sometimes | Caveats and gaps in plain words: a string or a list. Required when `sources` is empty. |
| `internal_inputs` | sometimes | The other artifacts this file was computed from (section 5.4). |
| `conventions` | no | Traps a reader must know about, such as sign conventions (section 7.5). |
| `rights_determination` | no | An audited judgement about a restricted input (section 5.5). |

A source must have a `title` and a `publisher`. **Checked at L2.** Its other
keys are `id`, `closed`, `role`, `url`, `license`, `as_of` and `retrieved`.

A source whose `role` is not `methodology` must record its upstream `license`
terms. **Checked at L3.** The licence of a source that has a registry `id`
must be the same string the Headwaters registry records for that id: the
registry owns the licence and the envelope mirrors it, so that a file can be
read on its own. **Checked at L2**, reported as `records a licence that
disagrees with scripts/source-registry/`.

The envelope schema does not forbid extra keys inside `provenance` or a
source, so an unrecognised key there is not an error.

### 5.1 Per-record provenance on claim datasets

Some datasets are lists of separate claims: facts, commitments, allocation
arrangements, lost water bodies, flagship water bodies, restoration projects,
river events. A reader quotes one record, not the file, so each record must
carry its own citation. These are the **claim datasets**; REFERENCE.md lists
them with the record collection and the keys each one accepts.

Rules, all **checked at L2**, whether or not the dataset has a contract:

- Every record must have a non-empty value in at least one of the accepted
  source keys. For facts these are `source_ids`, `sources` and `source_label`.
- `source_ids` is a list of ids. Each must be the `id` of a source in the
  file's own `provenance.sources`.
- `sources` on a record is a list of full source objects, for a one-off
  citation that is not worth an envelope entry.
- In commitments, every `status_history` entry must carry `source_label` or
  `source_url`.
- In facts and allocation arrangements, a record needs a date signal. If the
  record has no `as_of` and no `data_date`, and it cites sources through
  `sources` or `source_ids`, at least one of those sources must carry `as_of`
  or `retrieved`.

Datasets that are not claim datasets need no per-record citation. Their records
inherit the envelope's sources: one acquisition, one citation.

### 5.2 Method and role: asserted and derived values

`provenance.method` says how the values were obtained. `role` on each source
says what that source contributed.

Values are either **asserted** or **derived**:

- Asserted: a publisher stands behind the values and this file carries them.
  The methods `manual`, `scrape`, `api` and `pdf-extract` describe how they
  were carried. The source's role is `asserts`, which is the default when no
  role is given.
- Derived: the values were computed here from inputs. The method is `derived`,
  or `gee` for a Google Earth Engine computation. Each source that supplied
  raw material has the role `input`.
- `mixed` is for a file that holds both.
- A source with the role `methodology` is a cited method (a paper, a manual),
  not data.

Rules, **checked at L2**:

- A file whose method is `derived` or `gee` must name `produced_by`.
- A file whose method is `derived` or `gee` and that lists any sources must
  give at least one of them the role `input`.

A derived dataset that publishes scores should also publish the formula in its
payload, as `restoration-priority` does with `weights` and
`algorithm_version`. `weights` is required by that contract (**checked at
L3**); for other datasets this is a **convention, not checked**.

### 5.3 Source accountability

Every source must be accountable: someone must be able to tell whether it has
published again. There is no waiver for a whole file. Each source satisfies
the rule in exactly one of two ways. **Checked at L2.**

1. **A registered source.** The source carries an `id`. That id must exist in
   the Headwaters registry, and the registry entry's `dependsOn` must name this
   file, either by its exact path or by a directory that contains it. The join
   runs both ways on purpose: when the upstream publishes a new edition, the
   registry entry says which files to revisit.

   This is the way for any source that could publish again, including
   continuously updated ones such as OpenStreetMap. A continuous source is
   registered with `detection.method` set to `continuous`: it is recorded for
   lineage and licence and is never polled.

2. **A closed source.** The source carries `"closed": true` and an `as_of`
   date. This is the way for a one-time document that will never publish
   again: a dated letter, a single study. `as_of` alone does not mark a source
   as closed, because living sources have dates too.

A source that does neither fails with `has no registry id and is not
closed+as_of`. A source with `role: "methodology"` is not exempt: it must also
be registered or closed.

**When `sources` may be empty.** Only in two cases, and always with a `note`
that explains why:

- The dataset is a claim dataset. The per-record citations (section 5.1) carry
  the accountability.
- The file is self-authored and names `produced_by`.

**The file itself must also be accounted for.** Source accountability is about
each source. Level L1 (section 10.2) is about the file: a registry entry's
`dependsOn` names it, or the coverage allowlist gives a reason for it. A file
whose sources are all closed has no registry entry pointing at it, so it needs
an allowlist reason to pass L1. A file with a valid envelope that is not
accounted for stays below L2, with the message `envelope valid but artifact
is unaccounted`.

### 5.4 Internal inputs and the lineage floor

`provenance.sources` lists upstream sources outside this repository. When a
file is computed from other artifacts in this repository, those go in
`provenance.internal_inputs`, as a list of repository paths:

```json
"internal_inputs": [
  "public/geojson/madurai-water-bodies-current.geojson",
  "public/geojson/madurai-rivers.geojson"
]
```

Rules:

- A file whose method is `derived`, `gee` or `mixed` must declare
  `internal_inputs` to reach L3. If it uses no other artifact, it declares an
  empty list, `[]`. Leaving the key out is not the same as declaring none.
  **Checked at L3.**
- **The lineage floor.** A file cannot sit at L3 on top of inputs that are not
  themselves governed. A file is capped at L2 when any listed input is below
  L2, is missing from the catalogue, or itself rests on an input that fails
  this test. The rule follows the chain to the end: if A lists B and B lists
  C, a problem at C caps A as well.
  **Checked at L3**, reported as `capped at L2: lineage rests (transitively)
  on ungoverned inputs`.
- A file whose method is `derived`, `gee` or `mixed` and that does not declare
  `internal_inputs` counts as an unknown link in the chain: any file that lists
  it as an input is capped. A file with an asserted method (`manual`, `api`,
  `scrape`, `pdf-extract`) carries no such obligation.

### 5.5 Rights determinations

`provenance.rights_determination` is optional and rare. It records an audited
judgement that the terms of a named restricted input do not reach this file,
for example because the file holds an indicator computed here from measured
facts.

Its shape is closed: `basis`, `clears`, `reasoning` and `reviewed_on`, all
required, and no other key. `clears` is a non-empty list with no repeats,
naming each restricted input the judgement covers, by source id or as
`<path>#inline` for a source with no id. `reasoning` is at least 80
characters. **Checked at L2.**

The validator checks the shape only. What a determination may clear, and
whether it still describes the file, is decided by
`scripts/nvdm-encumbrance-report.py`, which is a licence audit and not part of
the conformance levels. [`DATA-LICENSE.md`](../../DATA-LICENSE.md) explains how
to read a determination.

The encumbrance report also reads two provenance keys that the envelope schema
does not declare, `rights_basis` and `rights_note`. The validator does not
check them.

### 5.6 Dates

The envelope has three dates. `as_of` on a source is the period the data
describes. `retrieved` on a source is when it was acquired. `produced_at` is
when this file was generated.

Rules, all **checked at L2**:

- A date is a year, a year and month, or a full date, in ISO form: `2026`,
  `2026-08` or `2026-08-15`. Prose such as "March 2024" fails. This holds for
  every date the envelope schema declares.
- In `produced_at`, and in `as_of` and `retrieved` on each envelope source, a
  full date must be a real calendar date (`2026-02-30` fails) and no date may
  be in the future. One day of slack is allowed, because files are stamped in
  Indian time and checked on machines running in UTC.
- `produced_at` and `retrieved` must not be earlier than the year 2000. A
  date such as `1970-01-01` is a software fallback, not a production date.
  `as_of` has no lower limit: a source may describe the year 1872.
- The real-date and not-in-the-future tests also apply to `as_of` and
  `data_date` on the records of `facts`, `commitments` and `arrangements`
  collections. A value there that is not in the ISO form, such as
  "c. 750-1100 CE", is left alone by this test. A contract may still require
  the ISO form, as the facts contract does for `data_date` (**checked at L3**).

The writers (section 10.3 and GUIDE.md) set `produced_at` to today every time
they rewrite a file that has an envelope.

### 5.7 Projection

Most artifacts hold evidence that belongs to their own scope. Some hold a view
of evidence that belongs to another scope, for example a city file that shows
part of a basin's data. Such a file says so:

```json
"projection": {
  "of": { "kind": "basin", "id": "arkavathi" },
  "method": "spatial-intersection",
  "limitations": ["Basin evidence clipped to the city boundary."]
}
```

`of` and `method` are required when `projection` is present; `method` comes
from a closed list. **Checked at L2.** Leaving `projection` out asserts that
the file is the canonical evidence for its scope.

The validator checks the shape of `projection.of` but does not look the id up
in the scope registry. Using a registered scope there is a **convention, not
checked**.

## Part 6 - Shapes, contracts and extensions

### 6.1 The four shapes

An artifact takes one of four shapes.

1. **Object.** A JSON object: the envelope keys plus named payload keys, where
   collections are lists of records. Facts, commitments and allocations are
   objects.
2. **Feature collection.** A GeoJSON FeatureCollection with the envelope keys
   beside `type` and `features`. Water bodies and rivers are feature
   collections.
3. **Indexed collection.** An object whose payload keys are identifiers from
   an outside system, each mapping to one record, with the envelope keys beside
   them. The catchment files, keyed by OpenStreetMap id, are indexed
   collections.
4. **Series.** Dated observations of one thing, carried as a list inside an
   object artifact: the `readings` of each well in `cgwb-stations`.

What is checked:

- An artifact must be a JSON object. A file that is a bare list has nowhere to
  carry an envelope and cannot reach L2; wrap the list in an object, as
  `ward-profiles` does with `"wards": [...]`. **Checked at L2.**
- Nothing requires a file to declare its shape. A contract fixes the shape of
  its own dataset (section 6.2).
- In a series, each reading carries an ISO date and value keys that name their
  unit. **Convention, not checked**: the `cgwb-stations` contract requires only
  that `readings` is a list.

### 6.2 Payload contracts

A contract is a JSON Schema file in `schemas/nvdm/` that fixes the payload of
one dataset: which keys must be present and what type each has. A dataset has
a contract when it is listed in `CONTRACTS` in `scripts/validate_nvdm.py`.
REFERENCE.md lists the contracts and the keys each requires.

Rules, all **checked at L3**:

- The file must validate against its dataset's contract. Every record is
  inspected, not a sample.
- Top-level keys are closed. A top-level key must be an envelope key, a
  GeoJSON member (`type`, `features`, `bbox`), a key the contract declares, or
  a grandfathered legacy key (section 9.3). Anything else is rejected with
  `per-scope additions must live in ext`.
- The closed rule applies to the top level only. Inside a record, keys the
  contract does not mention are allowed, so a record may carry optional
  attributes such as `name_ta`.

A dataset with no contract cannot reach L3. It stops at L2 with the note `no
contract published for this dataset`.

A contract may use only the JSON Schema keywords the validator implements
(listed in REFERENCE.md). A schema that uses any other keyword fails the
selftest, because the validator would otherwise ignore the keyword silently.
**Checked by the selftest.** A `$ref` may point only within the files of
`schemas/nvdm/`.

A contract should come with an example file in `schemas/nvdm/examples/` that
the selftest takes through the full L3 path, so the contract is shown to accept
a real file. **Convention, not checked**: nothing forces a new contract to add
an example, and not every existing contract has one.

Contract titles carry the label "(Tier A)". It marks the first group of
datasets to receive contracts and has no effect on validation.

### 6.3 Extensions (`ext`)

When one scope needs payload beyond what the contract declares, it goes under
`ext`, in an object named for the concern:

```json
"ext": {
  "tanker-market": { "survey_year": 2025 }
}
```

- `ext` must be an object. **Checked at L2.**
- On a contracted dataset, a new top-level key outside `ext` is rejected
  (section 6.2). **Checked at L3.** This is what keeps one city's addition from
  silently becoming a different schema.
- The contents of `ext` are not validated. Naming each entry for its concern
  is a **convention, not checked**.
- When two or more scopes need the same extension, it is promoted into the
  contract as an optional key, which is a MINOR change (section 11.2).
  `year_book_summaries` in `cgwb-stations` was promoted this way.
  **Convention, not checked.**

## Part 7 - Conventions

These are the working practices for payload content. Most are not tested by
the validator; each section says what is.

### 7.1 Units

A quantity carries its unit, either in the key name (`area_ha`, `length_km`,
`level_m`) or in a `unit` field beside the value, as facts do with `value` and
`unit`. A figure a publisher reports in its own unit is kept in that unit; a
converted figure sits beside it and never replaces it.

**Convention, not checked**, with one exception: where a contract requires a
unit-named key, the key's presence and type are **checked at L3**. There is no
machine-readable list of units.

### 7.2 Names in more than one language

`name` holds the English or romanised name. A name in another language uses a
key with the ISO 639-1 language code as suffix: `name_ta`, `name_kn`,
`name_te`.

**Convention, not checked.** Contracts require only `name`.

### 7.3 External identifiers

An identifier taken from an outside system is named for that system:
`osm_id` with `osm_type`, `census_id`, `station_code`. A bare `id` is an
identifier local to the dataset.

**Convention, not checked**, except where a contract requires the key. The
`water-bodies-current` contract requires `osm_id` and `osm_type` on every
feature (**checked at L3**); the pair identifies the feature and should stay
the same from one edition to the next.

### 7.4 Geometry

Spatial artifacts are GeoJSON as defined by RFC 7946.

The `water-bodies-current` and `rivers` contracts check that the file is a
FeatureCollection, that each feature has `type`, `geometry` and `properties`,
and that `geometry` is an object or null. **Checked at L3.** The validator does
not inspect coordinates.

### 7.5 Declared conventions

When a careful reader could still compute a wrong answer from the data, the
file says so in `provenance.conventions`: a sign convention (is depth positive
downward?), the basis of an aggregate (monthly mean or single reading?), a
break in comparability between years.

`conventions` must be an object when present. **Checked at L2.** Its contents
are a **convention, not checked**.

### 7.6 Absence of a value

What is checked: a key that a contract requires must be present, and `null` is
accepted only where the contract's type list includes it. **Checked at L3.**

**Convention, not checked**: a value that is not known is left out, or is
`null` where the contract allows it, and `provenance.note` says why. An unknown
value is never written as `0` and never filled with a placeholder.

## Part 9 - Legacy keys and files below L2

### 9.3 Grandfathered legacy keys

Files written before NVDM used many different top-level keys for the same
ideas: `source`, `sources`, `attribution`, `fetched_at`, `generated_at`,
`last_updated`, `_note`, `_sources`, `schema_version` and others. The envelope
replaces them all.

So that an existing file can gain an envelope without breaking the code that
still reads its old keys, a fixed set of legacy top-level keys is tolerated on
contracted datasets. REFERENCE.md lists both sets: the plain legacy keys and
the underscore-prefixed ones.

- The lists are closed. A key on a list passes the top-level rule of section
  6.2. **Checked at L3.**
- A new key does not pass because it looks like the old ones. A new
  underscore-prefixed key is rejected like any other undeclared key: the
  underscore is not an exemption. **Checked at L3.**
- New information goes in the envelope: a caveat in `provenance.note`, a sign
  convention in `provenance.conventions`, a per-scope addition in `ext`.

### 9.4 Files below L2

Not every file has an envelope yet. A file that is below L2 on the main branch
is reported in the conformance report and is otherwise left alone: the gate
skips it (section 10.3) until a change lifts it to L2. From then on the gate
holds it there.

When you give such a file an envelope, change its shape and leave its values
alone. **Convention, not checked.**

## Part 10 - Conformance levels and the gate

### 10.1 The four levels

| Level | Name | In one line |
|---|---|---|
| L0 | Catalogued | The file is listed in the dataset catalogue. |
| L1 | Accounted | The file is tied to a registered source, or is allowlisted with a reason. |
| L2 | Enveloped | The file has a valid envelope, a true identity and accountable sources. |
| L3 | Contracted | The file's payload validates against its dataset's contract. |

The levels are cumulative. A file reaches a level only if it has reached every
level below it.

### 10.2 What each level requires

**L0 Catalogued.** The file is under `public/data/` or `public/geojson/`, ends
in `.json` or `.geojson`, and appears in
`docs/architecture/dataset-catalogue.json`. Running
`scripts/build_dataset_catalogue.py` is enough.

**L1 Accounted.** Either of:

- A Headwaters registry entry's `dependsOn` names the file, by its exact path
  or by a directory that contains it.
- The coverage allowlist names the file, by its exact path or by a directory
  that contains it, with a reason.

A file that satisfies neither is **unaccounted** and stays at L0.

**L2 Enveloped.** All of L1, and:

1. The file parses as JSON and is an object (section 6.1).
2. The envelope is valid against `envelope.schema.json` (Part 5).
3. `dataset` and `scope.id` agree with the path (section 4.3).
4. `scope.id` is registered and `scope.kind` matches the registry (section
   4.1).
5. Every source is accountable, and the licence of each registered source
   matches the registry (section 5.3 and Part 5).
6. Derived files name their generator and an input source (section 5.2).
7. Dates are real, not in the future, and not fallback stamps (section 5.6).
8. On a claim dataset, every record cites its source (section 5.1).

**L3 Contracted.** All of L2, the dataset has a contract, and:

1. The payload validates against the contract (section 6.2).
2. No undeclared top-level key (sections 6.2 and 9.3).
3. Every source whose role is not `methodology` records its licence (Part 5).
4. A `derived`, `gee` or `mixed` file declares `internal_inputs` (section 5.4).
5. The lineage floor holds: no input in the chain is below L2, missing from the
   catalogue, or an undeclared derived file (section 5.4).

### 10.3 The gate

The gate is `scripts/nvdm-gate.sh <base>`. It compares the working tree with a
base revision and judges every data file that was added, renamed, modified or
is new and untracked, under `public/data/` and `public/geojson/`. Deleted files
are not judged.

For each such file:

| The file at the base revision | What the gate requires now |
|---|---|
| Did not exist | The file must reach L2. |
| Was at L2 | The file must still be at L2 or above. |
| Was at L3 | The file must still be at L3. |
| Existed and was below L2 | Nothing. The file is skipped. |

Both sides are assessed under the current rules and the current catalogue, so
only a change to the data can move a file's level.

The gate does not require a new file to reach L3, even when its dataset has a
contract. Once a file reaches L3 on the main branch, the gate holds it there.

The gate reads the catalogue. A file that is not in the catalogue fails with
`not in catalogue`, so run `scripts/build_dataset_catalogue.py` before the gate
whenever files were added.

**Writers.** A script that rewrites an existing artifact must not drop its
envelope. The writers `write_artifact` and `merge_envelope` in
`scripts/nvdm_write.py`, and `writeArtifact` in `scripts/lib/nvdm-write.ts`,
read the envelope from the file already on disk, keep it, put the fresh
payload after it, and set `produced_at` to today. Writing through them is a
**convention, not checked** by the validator; the gate catches the result if a
script strips an envelope, because the file's level drops.

### 10.4 What CI runs

The workflow `.github/workflows/nvdm-conformance.yml` runs on every pull
request that changes data files, `schemas/nvdm/`, the source registry or the
NVDM scripts. Every step blocks the merge:

1. The validator selftest.
2. Freshness of the catalogue: it is regenerated and must equal the committed
   copy.
3. Freshness of the conformance report, the same way.
4. Freshness of REFERENCE.md, the same way.
5. The gate, against the base of the pull request.

Workflows that refresh data on a schedule push straight to the main branch and
never pass through a pull request. Each such workflow in `.github/workflows/`
runs the gate against `HEAD` on the files it rewrote, before it commits.

## Part 11 - Versioning and change control

### 11.1 The version number

`nvdm` is a string of the form `MAJOR.MINOR`. The validator accepts `1.`
followed by digits, and nothing else. **Checked at L2.**

| Version | Date | What it is |
|---|---|---|
| 1.0 | 2026-07-30 | The envelope, the four levels, the first payload contracts. |
| 1.1 | 2026-09-30 | Place identity: refs, typed relations and the `country` kind in the scope registry. |

1.1 changed the registry and required no change to any artifact. The validator
does not compare the `nvdm` value with the features a file uses, and every
enveloped artifact in this repository currently states `1.0`.

### 11.2 What counts as a MINOR change

A MINOR change adds something and leaves every file that conformed before
still conforming. The schemas name these as MINOR:

- appending a scope kind;
- appending a ref system, a ref level or a relation type.

By the same test, these are MINOR too: a new optional envelope key, a new
payload contract, a new optional key in an existing contract.

A change that would make a conforming file stop conforming is MAJOR.

**Convention, not checked.** The validator does not classify changes. Two
things have happened inside 1.x without a new number, and
[CHANGELOG.md](CHANGELOG.md) records each one: optional envelope keys were
added under 1.0, and some checks were tightened. A tightened check can lower
the level of a file on the main branch. It cannot fail a later change to that
file, because the gate assesses the base under the same current rules.

### 11.3 Registries are append-only

- A scope id, once registered, is never renamed or removed.
- A Headwaters source id, once an envelope cites it, is never renamed: the
  envelope would stop resolving and fail with `is not a known Headwaters
  registry id`.

**Convention, not checked.** The validator reads each registry as it stands
and does not compare it with its history.

### 11.4 Change control

A change to a schema, to the scope registry or to the validator ships together
with the regenerated catalogue, conformance report and REFERENCE.md, and with
a line in CHANGELOG.md. The change in the conformance report shows which files
moved level. CI rejects the change if any of the three generated files is
stale or the selftest fails (section 10.4).

### 11.5 Candidate: the semantic core

`semantic-core.schema.json` and `semantic-records.schema.json` are a 0.1
candidate. They are not in force: `semantic-core/records` is not in
`CONTRACTS`, no artifact uses it, and nothing in Parts 1 to 10 depends on it.
The selftest exercises the two schemas against
`examples/example-semantic-records.json` so they stay internally consistent
while the design is reviewed. See
[docs/architecture/nvdm-semantic-core.md](../../docs/architecture/nvdm-semantic-core.md).

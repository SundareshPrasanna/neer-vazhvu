# NVDM guide

Step-by-step recipes for the common jobs: adding a data file, citing its
sources, registering a place, adding a contract, and fixing a failed gate.

The rules behind each step are in [RULES.md](RULES.md). Lists of allowed values
are in [REFERENCE.md](REFERENCE.md). If a word here is unfamiliar, RULES.md
Part 2 defines it.

Run every command from the repository root. The Python scripts need Python
3.11 or later and no packages. The registry check in recipe 3 needs Node
(`npm install` once).

## The example used throughout

The recipes add one new file, tank water levels for the city of Madurai, at
`public/data/madurai-tank-levels.json`. The file and its sources are made up
for this guide; every command below was run on it as shown.

The path already decides the file's identity (RULES.md 4.2 and 4.3):

- It sits directly in `public/data/`, so its family is `data-root`.
- Its name starts with `madurai`, a registered city, so its scope is `madurai`.
- What is left of the name is `tank-levels`, so its dataset is
  `data-root/tank-levels`.

## 1. Give a new file its envelope

Write the file through the writer, with the envelope in the payload. Save this
as `scripts/build_madurai_tank_levels.py`:

```python
#!/usr/bin/env python3
"""Build public/data/madurai-tank-levels.json."""
from datetime import date
from pathlib import Path

from nvdm_write import write_artifact

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "public/data/madurai-tank-levels.json"

write_artifact(OUT, {
    "nvdm": "1.0",
    "dataset": "data-root/tank-levels",
    "scope": {"kind": "city", "id": "madurai"},
    "provenance": {
        "sources": [{
            "title": "Tank level survey, one-time report",
            "publisher": "Example Water Department",
            "closed": True,
            "as_of": "2024-03",
            "license": "government publication, cited with attribution",
        }],
        "method": "manual",
        "produced_at": date.today().isoformat(),
        "produced_by": "scripts/build_madurai_tank_levels.py",
    },
    "tanks": [{"name": "Example tank", "level_m": 2.4, "as_of": "2024-03"}],
})
```

Run it, rebuild the catalogue so the new file is listed, and check the file:

```sh
python3 scripts/build_madurai_tank_levels.py
python3 scripts/build_dataset_catalogue.py
python3 scripts/validate_nvdm.py --check public/data/madurai-tank-levels.json
```

The check prints:

```text
public/data/madurai-tank-levels.json: L0 - below L2
  envelope valid but artifact is unaccounted (no registry lineage, no allowlist reason) - L2 blocked
```

The envelope is valid. What is missing is level L1: nothing yet says why this
file exists and who watches its source. The only source here is a closed,
one-time report, so there is no registry entry to point at the file. Record
the reason in the coverage allowlist instead: add one line to the `UNWATCHED`
map in `scripts/lib/headwaters-coverage.ts`.

```ts
  "public/data/madurai-tank-levels.json": "closed series: one-time tank level survey, March 2024",
```

Rebuild the catalogue and check again:

```sh
python3 scripts/build_dataset_catalogue.py
python3 scripts/validate_nvdm.py --check public/data/madurai-tank-levels.json
```

```text
public/data/madurai-tank-levels.json: L2 OK
```

If the file's source can publish again, do not allowlist it. Register the
source instead (recipe 3).

### What the writers do, and why you must use them

There are three writers, one behaviour:

| Language | Import | Call |
|---|---|---|
| Python, scripts in `scripts/` | `from nvdm_write import write_artifact` | `write_artifact(path, payload)` |
| Python, code in `neer-vazhvu-api/app/` | `from app.nvdm_io import write_artifact, merge_envelope` | the same |
| TypeScript, scripts in `scripts/` | `import { writeArtifact } from "./lib/nvdm-write";` | `writeArtifact(path, payload)` |

- If the file on disk already has an envelope, the writer keeps it, sets
  `provenance.produced_at` to today, and writes your payload after it. Envelope
  keys already on disk win over the same keys in your payload.
- If there is no file on disk, or the file has no envelope, the writer writes
  your payload as it is.

So the envelope enters through the payload once, on the first write. After
that the file is its home. A later run of the producer can pass the data alone
and the envelope survives:

```python
write_artifact(OUT, {"tanks": [{"name": "Example tank", "level_m": 2.9, "as_of": "2024-03"}]})
```

To change the envelope later (a new source, a corrected note), edit those keys
in the file itself.

Never write a data file with a plain `json.dump` or `writeFileSync` of the
payload. That replaces the file, the envelope is gone, the file drops below
L2, and the gate fails the change.

Options on the Python writer: `compact=True` keeps a minified file minified,
`indent=1` matches files stored with one-space indentation, and
`envelope_from=other_path` takes the envelope from another file. A producer
that needs its own formatting can call `merge_envelope(path, payload)` to get
the merged object and serialise it itself. The TypeScript writer takes
`{ compact: true }`.

## 2. Choose the method, the roles, and closed or registered

**Method.** Pick the one that describes how the values got into the file.

| How the values were obtained | `method` | What else is required |
|---|---|---|
| Compiled by hand from documents | `manual` | nothing more |
| Read from a web page by a script | `scrape` | nothing more |
| Pulled from an API | `api` | nothing more |
| Extracted from a PDF | `pdf-extract` | nothing more |
| Computed by a script from inputs | `derived` | `produced_by`; role `input` on at least one listed source; `internal_inputs` to reach L3 |
| Computed in Google Earth Engine | `gee` | the same as `derived` |
| Part carried from a publisher, part computed | `mixed` | `internal_inputs` to reach L3 |

**Role.** Set it on each source.

| What the source contributed | `role` |
|---|---|
| The values themselves; the publisher stands behind them | `asserts`, or leave `role` out |
| Raw material for values your script computed | `input` |
| A method you applied (a paper, a manual), not data | `methodology` |

**Closed or registered.** Ask one question of each source: could it publish
again?

| Answer | What to do |
|---|---|
| Yes: a new edition, next month's bulletin, continuous edits | Register it in the Headwaters registry and cite it by `id` (recipe 3). |
| No: a dated letter, a single study, a one-time delivery | Mark it `"closed": true` and give it an `as_of` date. |

A source that is neither fails the check. There is no third option.

## 3. Register a source and its `dependsOn`

The Headwaters registry is the set of JSON files in `scripts/source-registry/`:
one per city, plus `platform.json` for sources used by every city, and
`basins.json`, `atlas.json` and `corridors.json`. Add the entry to the file
that matches where the source is used.

Add this to the `sources` list in `scripts/source-registry/madurai.json`:

```json
{
  "id": "example-tank-bulletin",
  "scope": "madurai",
  "publisher": "Example Water Department",
  "url": "https://example.org/tank-bulletins/",
  "license": "government publication, cited with attribution",
  "type": "page",
  "cadence": "monthly",
  "tier": 2,
  "detection": { "method": "human-review", "reviewEveryDays": 90 },
  "dependsOn": ["public/data/madurai-tank-levels.json"],
  "refreshMethod": "manual",
  "notes": "Monthly tank level bulletin. Terms read at the publisher on 2026-09-30."
}
```

What each part is for:

- `id` is what envelopes cite. Pick it once; it is never renamed.
- `dependsOn` lists every repository file that rests on this source, by exact
  path or by a directory. This is the join the validator checks. The paths must
  exist, so create the data file before you register the source.
- `license` is the source's terms in words. For a registered source this
  string is the record, and every envelope must carry exactly the same string.
  Reuse the wording of an existing entry with the same terms where you can: a
  wording the licence classifier does not recognise fails its selftest.
- `detection.method` says how a new edition is noticed. Use `continuous` for a
  source with no editions, such as OpenStreetMap, and `human-review` with
  `reviewEveryDays` for a source no script can watch. The registry check lists
  the other methods when you use an unknown one.
- `type` is one of `pdf-listing`, `page`, `api`, `file`.

Now cite the source from the file's envelope. In a producer, take the licence
from the registry so the two can never drift:

```python
from registry_license import registry_license

source = {
    "id": "example-tank-bulletin",
    "title": "Tank level bulletin",
    "publisher": "Example Water Department",
    "url": "https://example.org/tank-bulletins/",
    "license": registry_license("example-tank-bulletin"),
    "as_of": "2026-08",
    "retrieved": "2026-09-30",
}
```

In TypeScript the same function is `registryLicense` from
`scripts/lib/registry-contract.ts`.

Check the registry, the licence wording, and the file:

```sh
npx tsx scripts/check-upstream-editions.ts --validate
python3 scripts/nvdm-encumbrance-report.py --selftest
python3 scripts/build_dataset_catalogue.py
python3 scripts/validate_nvdm.py --check public/data/madurai-tank-levels.json
```

The first prints `Registry valid.`, the second ends with `OK: 0 failures`, and
the last prints `L2 OK`.

Once a registered source's `dependsOn` names the file, the file is accounted
for through the registry, and an allowlist line for it is no longer needed.

## 4. Add a scope, and a relation

A scope is one entry in `schemas/nvdm/scopes.json`. Add it before the first
file that names it.

**A place.** Give it its kind, its name and its parent:

```json
"tn-coimbatore": {
  "kind": "district",
  "name": "Coimbatore",
  "relations": [{ "type": "administrative-parent", "target": "tamil-nadu" }]
}
```

The parent chain must end at a country: `tamil-nadu` already points at `india`.

When you have verified the place's code in an outside system, add it as a ref,
the way `tn-thanjavur` carries its Local Government Directory code:
`"refs": [{ "system": "lgd", "level": "district", "code": "586" }]`. Leave
`refs` out rather than guess a code.

**A water system.** A basin, waterway or water body has no parent. It lists
the places its geometry crosses, and each `intersects` says how that is known
and where to re-check it:

```json
"noyyal": {
  "kind": "basin",
  "name": "Noyyal",
  "relations": [
    { "type": "intersects", "target": "tamil-nadu", "method": "published",
      "evidence": "https://example.org/noyyal-basin-report" }
  ]
}
```

`method` is one of `geometry`, `published`, `crosswalk`, `manual`. `evidence`
is a URL, or the path of a file in the repository: for `geometry`, the boundary
or centreline that was tested against the place.

Check the registry, then confirm the country that the relations give:

```sh
python3 scripts/validate_nvdm.py --selftest
python3 -c "import sys; sys.path.insert(0, 'scripts'); import nvdm_scopes as s; print(s.kind('noyyal'), s.country('noyyal'))"
```

The selftest must print `scope registry passes its graph rules: OK`. The second
command prints `basin india`.

Two things to know:

- **A city or region is also an application city.** The registry's `city` and
  `region` scopes must equal the application's city list, `CITY_IDS` in
  `src/lib/cities/ids.ts`. Add the two together, following "Adding a new city"
  in [CONTRIBUTING.md](../../CONTRIBUTING.md); `npm run test` fails if they
  differ.
- **An Atlas state directory is found through the state's ISO code.** Files
  under `public/data/atlas/<state>/` are matched to the registered state whose
  `iso3166-2` ref ends in `<state>`. A new state needs that ref.

## 5. Add a payload contract

A contract lets a dataset reach L3. Four edits, then the generators.

1. **Write the schema** as `schemas/nvdm/tank-levels.schema.json`. Start from
   the envelope and declare the payload:

   ```json
   {
     "$id": "tank-levels.schema.json",
     "title": "data-root/tank-levels contract",
     "description": "Tank water levels, one record per tank.",
     "allOf": [{ "$ref": "envelope.schema.json#/$defs/envelope" }],
     "type": "object",
     "required": ["tanks"],
     "properties": {
       "tanks": {
         "type": "array",
         "minItems": 1,
         "items": {
           "type": "object",
           "required": ["name", "level_m", "as_of"],
           "properties": {
             "name": { "type": "string", "minLength": 1 },
             "level_m": { "type": "number" },
             "as_of": { "$ref": "envelope.schema.json#/$defs/date" }
           }
         }
       }
     }
   }
   ```

   Use only the JSON Schema keywords listed in REFERENCE.md. The selftest fails
   on any other keyword.

2. **Register the contract** in `CONTRACTS` in `scripts/validate_nvdm.py`, keyed
   by the full dataset id:

   ```python
   "data-root/tank-levels": "tank-levels.schema.json",
   ```

3. **Add an example** as `schemas/nvdm/examples/example-tank-levels.json`: a
   small, complete file that satisfies the contract.

4. **Put the example in the selftest.** In `selftest()` in
   `scripts/validate_nvdm.py`, load the file and add it to the list of examples
   that must pass the full L3 path:

   ```python
   tank_levels = json.loads((SCHEMA_DIR / "examples/example-tank-levels.json").read_text())
   ```

   ```python
   ("example-tank-levels", tank_levels, "tank-levels.schema.json"),
   ```

   The selftest treats the example's own source ids as registered, so an
   example may cite a source id that the registry does not hold.

Then run the selftest and regenerate the three generated files:

```sh
python3 scripts/validate_nvdm.py --selftest
python3 scripts/build_dataset_catalogue.py
python3 scripts/validate_nvdm.py
python3 scripts/build_nvdm_reference.py
```

The selftest prints `example-tank-levels passes full L3 path: OK`, and
`--check` on the data file now prints `L3 OK`.

Every existing file of that dataset is now measured against the contract. A
file that does not satisfy it stays at L2, with the reason in the conformance
report (recipe 6). Add a line to [CHANGELOG.md](CHANGELOG.md).

## 6. Reach L3

A file reaches L3 when its dataset has a contract and all of these hold:

- [ ] The payload validates against the contract: every required key is
      present and has the declared type.
- [ ] Every top-level key is an envelope key, a key the contract declares, or
      a listed legacy key. Anything specific to this scope is under `ext`.
- [ ] Every source whose role is not `methodology` has a `license`.
- [ ] If the method is `derived`, `gee` or `mixed`, the envelope declares
      `provenance.internal_inputs`: the repository paths of the artifacts the
      file was computed from, or `[]` when there are none.
- [ ] Every path in `internal_inputs` is itself at L2 or above.

`--check` does not explain a file that stops at L2, because L2 is all it asks
of a new file. To see the reason, regenerate the conformance report and read
the file's line:

```sh
python3 scripts/validate_nvdm.py
grep madurai-tank-levels docs/architecture/nvdm-conformance.md
```

```text
- L2 `public/data/madurai-tank-levels.json` - L3 fail: top-level key 'survey_notes' is not envelope, GeoJSON, contract-declared, or grandfathered legacy - per-scope additions must live in ext (spec 6.3)
```

The report shows the first reason. Fix it and run the two commands again until
the line reads `- L3`.

## 7. When a refresh job rewrites a file

A scheduled job that refreshes data and pushes straight to the main branch
never passes through a pull request, so it must run the gate itself.

1. The job's script writes through a writer (recipe 1). That is what keeps the
   envelope and moves `produced_at` forward.
2. Before it commits, the workflow rebuilds the catalogue, runs the gate
   against `HEAD` on the paths it rewrote, regenerates the conformance report,
   and runs the selftest. If any step fails, nothing is committed:

   ```sh
   python3 scripts/build_dataset_catalogue.py
   bash scripts/nvdm-gate.sh HEAD public/data/madurai-tank-levels.json
   python3 scripts/validate_nvdm.py
   python3 scripts/validate_nvdm.py --selftest
   git add public/data/madurai-tank-levels.json docs/architecture/dataset-catalogue.json docs/architecture/dataset-catalogue.md docs/architecture/nvdm-conformance.md
   ```

   `.github/workflows/pravah-dam-refresh.yml` is a complete example.
3. To rehearse locally, run the job's script, then the gate against `HEAD`:

   ```sh
   bash scripts/nvdm-gate.sh HEAD public/data/madurai-tank-levels.json
   ```

   It prints `nvdm-gate: no changed served artifacts` when the run changed
   nothing, and one line per changed file otherwise.

## 8. Before you open a pull request

Run the three generators in this order, then the selftest and the gate:

```sh
python3 scripts/build_dataset_catalogue.py
python3 scripts/validate_nvdm.py
python3 scripts/build_nvdm_reference.py
python3 scripts/validate_nvdm.py --selftest
bash scripts/nvdm-gate.sh origin/main
```

Commit the files the generators changed:
`docs/architecture/dataset-catalogue.json`,
`docs/architecture/dataset-catalogue.md`,
`docs/architecture/nvdm-conformance.md` and `schemas/nvdm/REFERENCE.md`. CI
regenerates all four and fails if the committed copies differ.

## The gate failed

Find the message you got in the left column. `<file>`, `<id>` and `[i]` stand
for your own values. The validator prints at most three L2 reasons and five L3
reasons per file, so fix what you see and run it again.

### Lines that are not failures

| Message | Meaning |
|---|---|
| `nvdm-gate: no changed served artifacts` | The change touches no data file. Nothing to check. |
| `<file>: L2 OK`, `<file>: L3 OK` | The file passes. |
| `<file>: L1 at base, below L2 there - skipped` | The file had no valid envelope before your change, so the gate does not judge it. |

### The file's level

| Message | Meaning | Fix |
|---|---|---|
| `<file>: not in catalogue (run scripts/build_dataset_catalogue.py)` | The file is new and the catalogue has not been rebuilt. | Run `python3 scripts/build_dataset_catalogue.py`, then the gate again. |
| `<file>: L0 - below L2` or `<file>: L1 - below L2` | A new file does not reach L2. The indented lines say why. | Fix each reason below. |
| `<file>: L2 - below L3 (its level at base)` | The file was at L3 and your change dropped it to L2. | Fix the `L3 fail` reasons below. |
| `<file>: L1 - below L2 (its level at base)` | The file had a valid envelope and your change broke or removed it. | Usually a script wrote the file without a writer (recipe 1). Restore the envelope and write through the writer. |

### Reasons a file is below L2

| Message | Fix |
|---|---|
| `envelope valid but artifact is unaccounted (no registry lineage, no allowlist reason) - L2 blocked` | Add the file's path to the `dependsOn` of the registry entry for its source (recipe 3), or give it a reason in the coverage allowlist (recipe 1). Rebuild the catalogue. |
| `unparseable: ...` | The file is not valid JSON. Fix the syntax. |
| `L2 fail: artifact is not an object (bare arrays cannot carry an envelope)` | Wrap the list in an object: `{ envelope keys, "records": [...] }`. |
| `L2 fail: $: missing required key 'nvdm'` (or `'dataset'`, `'scope'`, `'provenance'`) | The file has no envelope, or part of it is missing. Add it (recipe 1). |
| `L2 fail: $.provenance: missing required key 'sources'` (or `'method'`, `'produced_at'`) | Add the key. `sources` may be `[]` only in the two cases in RULES.md 5.3. |
| `L2 fail: $.provenance.method: "..." not in [...]` | Use one of the listed values (recipe 2). The same message shape appears for any closed list. |
| `L2 fail: $.nvdm: '...' fails pattern ^1\.\d+$` | `nvdm` must be `1.` followed by digits, for example `"1.0"`. |
| `L2 fail: $.provenance.sources[i].as_of: '...' fails pattern ...` | Write the date as `2026`, `2026-08` or `2026-08-15`. |
| `L2 fail: identity: dataset '...' != path-derived '...'` | Set `dataset` to the path-derived value shown, or rename the file (RULES.md 4.3). |
| `L2 fail: identity: scope.id '...' != path-derived '...'` | Set `scope.id` to the path-derived value shown, or rename or move the file. A path-derived `unknown` means the file name carries no registered scope. |
| `L2 fail: scope.id '...' is not in the scope registry (schemas/nvdm/scopes.json)` | Register the scope (recipe 4). |
| `L2 fail: scope.kind '...' contradicts the registry ('...' is a ...)` | Use the kind the registry gives. |
| `L2 fail: provenance.sources[i] '...' has no registry id and is not closed+as_of - register it (continuous upstreams use detection.method 'continuous')` | Decide: register the source and cite its `id`, or mark it `closed` with `as_of` (recipe 2). |
| `L2 fail: provenance.sources[i] is closed but has no as_of (closed sources must be dated)` | Add `as_of` to the source. |
| `L2 fail: provenance.sources[i] id '...' is not a known Headwaters registry id` | The id is misspelt or not registered. Correct it or register the source (recipe 3). |
| `L2 fail: provenance.sources[i] id '...' exists in the registry but its dependsOn does not name this file - add the path so edition alerts reach it` | Add the file's path to that registry entry's `dependsOn`. Rebuild the catalogue. |
| `L2 fail: provenance.sources[i] id '...' records a licence that disagrees with scripts/source-registry/ ...` | Copy the registry's licence string into the envelope exactly, or take it with `registry_license()`. If the registry is wrong, correct the registry. |
| `L2 fail: empty provenance.sources without an explanatory note` | Add `provenance.note` saying why there are no sources, or list the sources. |
| `L2 fail: empty provenance.sources is only legal for claim-dataset compilations (per-record citations) or self-authored artifacts naming produced_by` | List the sources, or name `produced_by` if the file really has no upstream. |
| `L2 fail: derived artifact without provenance.produced_by (spec 5.2)` | Name the script that computed the file. |
| `L2 fail: derived artifact lists no source with role 'input' (spec 5.2)` | Give the data sources `"role": "input"`. |
| `L2 fail: produced_at '...' is in the future` | Correct the date. The same message appears for a source's `as_of` and `retrieved`. |
| `L2 fail: produced_at '...' predates 2000 (a fallback stamp, not a production date)` | A script stamped a default date. Set the real one. |
| `L2 fail: produced_at '...' is not a real calendar date` | Correct the date. |
| `L2 fail: $.facts[i] (<id>): no per-record source ref (needs one of source_ids/sources/source_label)` | The record has no citation. Add one of the named keys (RULES.md 5.1). The key names differ by dataset. |
| `L2 fail: $.facts[i]: source_ids '...' not found in provenance.sources ids` | The record cites an id the envelope does not list. Add the source to the envelope or correct the id. |
| `L2 fail: $.commitments[i].status_history[j]: no citation (source_label or source_url)` | Give the history entry a citation. |
| `L2 fail: $.facts[i]: no date signal - record as_of/data_date or a dated source (spec 5.1)` | Add `as_of` to the record, or a date to the source it cites. |

### Reasons a file is below L3

| Message | Fix |
|---|---|
| `no contract published for this dataset (L3 not applicable yet)` | Not a failure. The dataset has no contract; L2 is the most it can reach (recipe 5 adds one). |
| `L3 fail: $.<path>: missing required key '...'` | Add the key the contract requires. |
| `L3 fail: $.<path>: expected ['number'], got str` | Give the value the type the contract declares. `got NoneType` means a `null` where the contract does not allow one. |
| `L3 fail: top-level key '...' is not envelope, GeoJSON, contract-declared, or grandfathered legacy - per-scope additions must live in ext (spec 6.3)` | Move the key under `ext`, or add it to the contract if every scope should carry it. |
| `L3 fail: provenance.sources[i] '...' has no license terms recorded` | Add the source's `license`. |
| `L3 fail: derived/mixed artifact seeking L3 must declare provenance.internal_inputs (explicitly [] if none) - the dependency floor is fail-closed` | Add `internal_inputs` to the envelope. |
| `capped at L2: lineage rests (transitively) on ungoverned inputs - <paths>` | One of the files this file is computed from is below L2, or does not declare its own inputs. Lift that file first. |

### The selftest

| Message | Fix |
|---|---|
| `scope registry passes its graph rules: FAIL`, followed by `<id>: ...` lines | The scope registry breaks a rule. The lines name the entry and the rule; see the next table. |
| `every schema keyword is one validate() enforces [...]: FAIL` | A schema uses a JSON Schema keyword the validator does not implement. Use a supported one (REFERENCE.md). |
| `every cited spec section is a RULES.md heading [...]: FAIL` | A schema description or the validator cites a section number that RULES.md does not have. Correct the number. |
| `CONTRACTS names schema file(s) missing from schemas/nvdm: [...]` | `CONTRACTS` points at a schema file that does not exist. Add the file or correct the name. |
| `example-... passes full L3 path: FAIL` | An example no longer satisfies its contract. The indented lines say why. |

| Scope registry line | Fix |
|---|---|
| `<id>: reaches 0 countries (a place needs exactly one, a water system at least one)` | A place needs an `administrative-parent` chain that ends at a country. A water system needs at least one `intersects`. |
| `<id>: administrative-parent target '...' is not another registered scope` | The target is misspelt or not registered. |
| `<id>: intersects <target> needs a method and evidence that is a repo file or a URL` | Add `method` and `evidence`. A path must be a file that exists. |
| `<id>: a basin has no administrative parent` | Remove the `administrative-parent`; use `intersects`. |
| `<id>: projection-of must point at a water system, not <target>` | Point it at a basin, waterway or body. |
| `<id>: intersects must point at a place, not <target>` | Point it at a place, not another water system. |
| `<id>: lgd 586 is already tn-thanjavur's identity` | Two scopes claim the same external code. One of them is wrong. |
| `<id>: id is not a lowercase slug` | Use lowercase letters, digits and hyphens, starting with a letter. |
| `<id>: $: undeclared key '...'` | An entry has only `kind`, `name`, `refs` and `relations`. |
| `<id>: administrative-parent cycle` | Two places name each other as parent, directly or through a chain. |

### The freshness steps in CI

| Step that failed | Fix |
|---|---|
| Catalogue freshness | `python3 scripts/build_dataset_catalogue.py`, commit the two catalogue files. |
| Conformance report freshness | `python3 scripts/validate_nvdm.py`, commit `docs/architecture/nvdm-conformance.md`. |
| Reference freshness | `python3 scripts/build_nvdm_reference.py`, commit `schemas/nvdm/REFERENCE.md`. |

Run the catalogue before the report: the report is assessed from the catalogue.

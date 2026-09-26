# Adding a district to the Atlas

This is the step-by-step walkthrough for onboarding a new district to the
District Atlas, the config-driven companion to "Adding a new city" in
CONTRIBUTING.md. The shipped methodology - why each artifact exists, what each
holds, how gating works - is `district-atlas-v1.md`; this note is the *steps*,
with Kolar as the worked example. **Before starting, read
`docs/methodology/district-atlas-v1.md`**, and skim
`docs/methodology/pan-india-source-playbook.md` for the per-source acquisition
tricks (OCR recipes, network constraints, cache discipline).

The Kolar entry is the most recent onboarding: the first Karnataka district,
shipped on the LGD adapter with four state-specific differences that became
four named gaps. Tracing its path from zero to published is exactly what this
document is. Start by reading these, in order:

1. `pipeline-inputs/atlas/ka/kolar/refresh-plan.json` - what a reviewed plan says and why every code in it was read from a primary artifact, not typed.
2. `src/lib/atlas/registry.ts` (the `kolar` entry) - what a registry entry is.
3. `pipeline-inputs/atlas/ka/kolar/block-alignment.json` and `crosswalk-resolution.json` - the shape of a staged, human-reviewed identity resolution.
4. `pipeline-inputs/atlas/ka/kolar/environment-plan.json` - the reviewed-extraction pattern: every figure with a quote, a PDF page, and a review block.

Two hard-won lessons from the Kolar onboarding, both of which cost real time:

- **Which adapter builds the district decides the whole shape.** Tamil Nadu
  runs on the TNRD register adapter (TNGIS boundaries, Season and Crop Report
  irrigation, per-block water-body counts); every other state runs on the LGD
  adapter (data.gov.in catalog, DataMeet village polygons, First Census of
  Water Bodies, the MPCB District Environment Plan) - and a brand-new state has
  no LGD upstreams registered at all. This is a one-hour Ambiguity, not an
  implementation detail. Decide it first; rereading later is waste.
- **Where a register cannot be joined, it becomes a named gap, never a
  guess.** Three of Kolar's four state differences are exactly this: the DCHB
  release prints Panchayat names without codes, DataMeet's Karnataka file
  joins on 2001 codes, and the LGD coverage register lists one or two villages
  per Panchayat (286 rows for 1,825 villages), so the union of the two is not
  the Panchayat's extent and the polygons are withheld. Each is a reviewed
  field in the plan, and each is answered with a policy ("withheld",
  "names-without-codes", "village-code-mapping"), not with a fabricated join.
  The page counts unbound units rather than dropping them, and the
  `waterBodiesGapNote` on the registry entry tells the reader exactly why
  nothing is counted.

## 1. Pick the district and the adapter

Choose a district, then answer one question: is its state already built?

- **Tamil Nadu** -> TNRD register adapter. The identity step is
  `scripts/atlas-refresh-tn-district.ts`, boundaries come from TNGIS, water
  bodies are TNGIS counts, and irrigation comes from the Season and Crop
  Report.
- **Maharashtra or Karnataka** -> LGD adapter. The identity step is
  `scripts/atlas-refresh-lgd-district.ts`, boundaries come from DataMeet
  (ODbL), water bodies come from the First Census of Water Bodies, and the
  environment plan is the MPCB District Environment Plan.
- **Any other state -> this is a new-state onboarding, not a new district.**
  Stop and read step 2's "first time on a state" note before writing anything.

A new district on an existing adapter is roughly a day of register fetches
plus human review of the staged name-resolution proposals. A new state is
materially more: fewer than half the artifact families will resolve the first
time, and each missing join becomes a reviewed gap.

## 2. Register the district

A district is one registry entry plus its artifacts; the route tree, directory
and brief pages are shared and take the district as configuration. Three
places name it, and all four must agree:

1. **`schemas/nvdm/scopes.json`** - add `"<state>-<slug>": "district"` (Kolar:
   `"ka-kolar": "district"`). This is the NVDM scope id the served artifacts
   are enveloped with.
2. **`src/lib/atlas/registry.ts`** - add one entry to `ATLAS_DISTRICTS`:
   `slug` and `scopeId` (matching the scopes entry), `stateSlug`/`stateCode`/
   `stateName`, `name`, the one-line `hook` the landing card shows, an optional
   `basin` / `deepDive` when the district sits in a mapped basin, and
   `hasCuratedBriefs: false` unless a reviewer wrote briefs. Set
   `published: false` - a district ships preview-gated first. Note that
   `buildDistrictBoard()` (`src/components/atlas/district-card.tsx:33`) pulls from
   `listAtlasDistricts()` and shows an "onboarding" card for unpublished
   entries regardless. The hook, name, and mark must be reviewed BEFORE the
   registry entry merges, since `published: false` only gates the district's
   pages, not its landing card. Pick the `irrigationCurrentSource` constant:
   `TN_IRRIGATION_SOURCE` for Tamil Nadu, `MH_IRRIGATION_GAP` for Maharashtra,
   `KA_IRRIGATION_GAP` for Karnataka (the constant is copy, not data - it names
   the gap when no extraction is served). Add a `waterBodiesGapNote` where the
   state's register exists but is not joined (see the Kolar entry).
3. **`.github/workflows/atlas-refresh.yml`** - add the slug to the district
   matrix (two occurrences: the manual-dispatch description and the `matrix`
   array).
4. **`src/components/atlas/district-mark.tsx`** - needs an entry in both
   `DISTRICT_MARKS` and `DISTRICT_ACCENT`, keyed by `scopeId`. Each district's
   mark is chosen for the water that defines it.

This file is client-imported, so it is **metadata only**: no district data may
be imported here (registry.ts comment, lines 1-15). The 45 MB of Gram
Panchayat payloads stay in `public/data/`.

### First time on a state

A brand-new state needs, beyond the registry:

- **`scripts/lib/atlas-producer.ts`** - a `LGD_STATE_UPSTREAMS[<state>]`
  entry (see the `mh` and `ka` entries). The lookup throws otherwise:
  `no LGD upstreams registered for state ...; add them in scripts/lib/atlas-producer.ts`.
- **New source-registry entries** under `scripts/source-registry/atlas.json`
  for anything the state introduces (LGD catalog resources, the DCHB release,
  DataMeet polygons, the water-bodies census return).
- The plan's state-difference fields, decided by reading the primary
  artifacts, not by copying Kolar's.

## 3. Write the four reviewed inputs

`pipeline-inputs/atlas/<state>/<slug>/` holds exactly four files for every
district. Nothing in `src/` may read from this directory (pipeline-inputs
de-publicization ruling); the producers read it and write `public/data/atlas/`.

1. **`refresh-plan.json`** - the reviewed plan: the `identityAdapter`
   (`"tnrd"` or `"lgd-directory"` - the refresh script branches on this), the
   register ids read from primary artifacts (`lgdStateCode`,
   `lgdDistrictCode`, `jjmStateId`, `jjmDistrictId`, `censusStateCode`,
   `censusDistrictCode`, the DCHB sheet, the IN-GRES state/district name), and
   `expectedCounts` for every register. The Kolar plan's `_doc` says it
   plainly: *"Every code here was read from a primary artifact ..., none
   typed."* A fetch that returns a different count fails loudly instead of
   shipping a shorter directory. Where the state deviates from the adapter's
   defaults, name the deviation as a reviewed field
   (`censusGramPanchayatColumns: "names-without-codes"`,
   `crosswalkFormat: "village-code-mapping"`,
   `polygons: "withheld"`, `ingresTalukaAliases`, ...).

Before block and crosswalk staging can run, execute the identity-fetch step:

```bash
npm run atlas:refresh -- --district <slug> --fetch --as-of <date>       # Tamil Nadu
npm run atlas:refresh-lgd -- --district <slug> --fetch --as-of <date>   # LGD states
```

2. **`block-alignment.json`** - run `npm run atlas:stage-blocks -- --district <slug>`; it proposes
   the block alignment across registers (MAC. CHOULTTRY = Macdonalds Choultry;
   Bangarapet = Bangarpet). Every proposal carries
   `review.status: "proposed"`; the script refuses to overwrite a reviewed
   file without `--force`.
3. **`crosswalk-resolution.json`** - run `npm run atlas:stage-resolution -- --district <slug>`; it
   proposes JJM-to-directory pairings that name similarity alone cannot
   settle, and writes the leftovers to a local `review-queue.md` that is
   deliberately **not committed**. Proposed pairings are already live/binding
   downstream, so every staged pairing needs human review BEFORE the PR is
   opened — not after. To confirm a pairing, set `status: "verified"` with a
   real `verifiedBy` and ISO `verifiedAt`; changing `matchClass` alone fails
   validation. Weak matches are not rejected outright — Kolar's `Annihalli` vs
   `Annenahalli` pairing at similarity 0.625 is an example of a
   manually-rejected (not auto-rejected) low-similarity match.
4. **`environment-plan.json`** - a reviewed transcription of the District
   Environment Plan's water figures, each with a quote, the PDF page, and the
   `review` block naming who verified it. Where the plan prints no water
   balance, `waterBalance` stays `null` and the page says so; where the plan's
   own totals disagree, the disagreement is recorded, never corrected (the
   Kolar plan's eight `quirks`).

The discipline for all four: every proposal stays `proposed` until a human
confirms it, and units that stay unbound render as directory-only rows -
counted on the page, never dropped.

## 4. Run the chain

The whole district is refreshed by one shared script, fail-closed by design:

```bash
bash scripts/atlas-refresh-district.sh <slug>            # as of today
bash scripts/atlas-refresh-district.sh <slug> 2026-09-01 # as of a date
```

It resolves the adapter from `refresh-plan.json`, then runs in dependency
order (from the script's own header):

1. **refresh** - identity sources -> `directory.json` (fetch)
2. **jjm** - Jal Jeevan Mission service per block (fetch, paced - this is the
   long pole)
3. **census** - Census 2011 roll-up per block. **Closed source**: only reruns
   after a real identity refresh; otherwise the served shards stand.
4. **groundwater** - IN-GRES taluk assessment (fetch)
5. **project-gw** - assessment projected onto GPs (geometry step; runs only
   when identity or the assessment itself changed)
6. **rainfall** - Open-Meteo 30-day window per GP (fetch)
7. **water-bodies** - TNGIS counts (TN) or First Census of Water Bodies
   (LGD) - another geometry step; **7b boundaries** (LGD only) serves the
   DataMeet polygons
8. **assess** - capability assessments + briefs per block (derived)
9. **validate** - whole-corpus assertions over the served tree

Two failure classes, treated differently:

- **Drift** - a count or payload that disagrees with the reviewed plan. Stops
  the chain. A person reviews and updates the plan, then reruns.
- **Unreachable** - a government host that does not answer (TNRD has been down
  for hours). Only the identity step tolerates it; every other step stops on
  any failure. The skip is announced, and the 45-day freshness gate turns a
  persistent outage into an alert.

What the script shares matters: it is the same program run by the monthly
workflow, the launchd fallback when a government host blocks GitHub runners,
and a person at a terminal.

## 5. The stuck points

You will get stuck exactly where the data refuses a clean join. Kolar's four,
with the answer each taught:

- **The DCHB release prints each Panchayat's name without a code.** Named
  `censusGramPanchayatColumns: "names-without-codes"`; composition still comes
  from the LGD register, and the Census extract keeps the row under its name
  so the enumeration stays complete. Any *unlisted* row without a Panchayat
  stops the run (`censusVillagesWithoutGramPanchayat` in the plan).
- **DataMeet's Karnataka file carries 2001 codes, not 2011.** Named
  `crosswalkFormat: "village-code-mapping"`; the join reads the semicolon
  2001-to-2011 mapping each polygon carries.
- **The LGD export lists only one or two villages per Panchayat** (286 of
  Kolar's 1,825), so their union is not the Panchayat's extent. Answer:
  `polygons: "withheld"` - the centroid places the marker, no outline or area
  is shown, and the boundary capability is not evidenced.
- **The First Census of Water Bodies Karnataka return carries a local serial,
  not the Census 2011 village code.** Answer: `waterBodiesGapNote` on the
  registry entry, and no count served. Not "none listed" - "not yet joined".

The pattern is always review-and-name, never invent. When the sums do not
add, note it, then get the numbers from a human who reads the document.

## 6. Assessments and validation

`npm run atlas:assess -- --district <slug>` (via `scripts/atlas-generate-assessments.ts`) generates
the per-place capability assessments and briefs. The chain's final step runs
the same script with `--validate`, which asserts over the whole served
corpus. For an LGD-built district, the unit-test fixture under
`fixtures/atlas/<state>/<district>/` is regenerated, never hand-edited:
`npx tsx scripts/atlas-cut-fixture.ts --district <slug> --block <code> --panchayats <n>`.

## 7. Preview, then publish

1. Leave `published: false`, and set `NEXT_PUBLIC_PREVIEW_DISTRICTS=<slug>`
   in `.env.local`. Every user-facing surface reads
   `listVisibleAtlasDistricts()`, so a district cannot be linked from one
   place and 404 in another.
2. **HTTP 200 means nothing.** The Kolkata onboarding lesson applies verbatim
   to districts: these pages catch their own errors and still render a shell.
   Drive the pages in a real browser - the district page, `blocks/`, and
   `panchayats/` for a block whose polygons were withheld - and check console
   errors and rendered feature counts, not status codes.
3. Flip `published: true` once the pages are reviewed. That is what makes the
   landing card live (it already renders as an onboarding card while
   unpublished) and activates the district's pages, sitemap entries and
   freshness checks — usually folded into the corpus pin PR once review is done.

## 8. Close the loop

- Add the shipped row to the README's District Atlas table (GPs, blocks /
  talukas, the one-line hook), and update the count in the paragraph above it.
- Add the district to the "Adding a new district" pointer if the walkthrough
  gains a worked example.
- The catalogue and conformance docs under `docs/architecture/` must not wait
  for the monthly regen — a district PR touching `schemas/nvdm/scopes.json` and
  `scripts/source-registry/` triggers `.github/workflows/nvdm-conformance.yml`,
  which fails on any diff. Never hand-edit them. Regenerate and commit them
  with the district:
  `python3 scripts/build_dataset_catalogue.py && python3 scripts/validate_nvdm.py`
- Shipping to production is the corpus release chain, not a merge: data-repo
  PR, immutable `corpus-YYYY-MM-DD-<slug>` tag, then a pin PR moving
  `corpus.lock` (`scripts/release_corpus.py prepare` / `pin`). See
  `district-atlas-v1.md` section 6.

## Cost and expectations

Roughly a day per district on an existing adapter, dominated by register
fetches and human review of the staged proposals (JJM is the long pole: a few
seconds per village). A fresh state is a different budget. Keep the plan's
`expectedCounts` honest, review the staged pairings in full, and publish only
what a person has confirmed.
# District Atlas: Methodology Note

**neer-vazhvu district atlas v1**
**Status: as-built, shipped for Thanjavur, Tiruchirappalli, Salem, Tirupathur (Tamil Nadu) and Satara (Maharashtra)**

## Abstract

The District Atlas is the platform's rural surface: a district page at `/atlas/[state]/[district]`, a page per block (TN) or taluka (MH) under `blocks/`, and a page per Gram Panchayat under `panchayats/` - 3,088 GP pages across the five shipped districts. Where a city dashboard reads utility feeds, a district's water state lives in government registers: the panchayat directory, the Jal Jeevan Mission service ledger, the Census 2011 village tables, the IN-GRES groundwater assessment, the state's irrigation statistics. The Atlas turns those registers into place pages without inventing anything between them: every joined identity is either exact, or a staged proposal a human reviewed, and every page states which registers could not be bound and why.

This note is the as-built record of how a district is onboarded, what each artifact family holds, and how the monthly refresh runs. The Lake Catchment Atlas (`catchment-atlas-v1.md`) is a different feature - a per-lake drainage view on the city water-bodies map - that happens to share a word.

## 1. Places, registry, gating

`src/lib/atlas/registry.ts` is the list of Atlas districts. Each entry carries the slug, the NVDM scope id (`tn-salem`, `mh-satara`), an optional basin join (Thanjavur, Tiruchirappalli and Salem hang off `cauvery-tn` sub-basins), the one-line hook the landing card shows, and `published`. A district ships `published: false` first: its data can be released to the corpus and its pages reviewed on a dev server (`NEXT_PUBLIC_PREVIEW_DISTRICTS=<slug>`) while the routes 404 in production. Flipping `published: true` is what activates the landing card, the sitemap entries and the freshness checks - usually folded into the corpus pin PR once review is done.

## 2. Adapters

Two identity adapters exist. A district's `pipeline-inputs/atlas/<state>/<slug>/refresh-plan.json` names its adapter, its register ids, and `expectedCounts` for every register - a fetch that returns a different count fails loudly instead of shipping a shorter directory.

| | Tamil Nadu (registers adapter) | Maharashtra (LGD adapter) |
|---|---|---|
| GP directory | TNRD LGD PDF + TNRD master codes | LGD Local Bodies via the data.gov.in catalog (Ministry of Panchayati Raj, monthly) |
| Blocks | TNRD master | LGD Sub-Districts (talukas stand in for blocks, 1:1 in Satara, documented) |
| Villages / Census | Census 2011 DCHB workbook, sha-pinned | LGD Villages (carries the Census 2011 code) + Census 2011 MH workbook |
| Service ledger | JJM Citizen Corner, per village | same, joined through the crosswalk |
| Boundaries | TNGIS panchayat/taluk layers | DataMeet village polygons (ODbL, share-alike), GP = MultiPolygon of member villages |
| Groundwater | IN-GRES taluk assessment | IN-GRES taluka assessment |
| Irrigation | Season and Crop Report Table III-B (reviewed extraction) | named gap: the District Socio-Economic Review stops at 2015-16 with wells not stated |
| Water bodies | TNGIS all-water-bodies layer (counts) | First Census of Water Bodies via data.gov.in (GODL), assigned to GPs by village code |
| Environment plan | not yet on file | MPCB District Environment Plan, reviewed figure-by-figure with page cites |

Adapter firsts are made byte-neutral for existing districts before they merge: the 2021 TNRD PDF lists 2019-formed districts with six-digit codes (Tirupathur 296958), and `censusSubdistrictCodes` scopes a Census extract to the parent district's taluks (Tirupathur's villages sit under Vellore in Census 2011, and the page's vintage line says so from the rows themselves).

## 3. Identity resolution, and what a human reviews

Registers disagree on names, so binding them is staged, never silent:

- `atlas:stage-blocks` proposes the block alignment across registers (`block-alignment.json`: MAC. CHOULTRY = Macdonalds Choultry; Jaoli = Jawali).
- `atlas:stage-resolution` proposes JJM-to-directory pairings that name similarity alone cannot settle (`crosswalk-resolution.json`), and writes the leftovers to a local `review-queue.md` that is deliberately not committed.
- Every proposal carries `review.status: proposed` until a human confirms it. Units that stay unbound render as directory-only rows, counted on the page rather than dropped.

The same discipline covers reviewed inputs that are extractions rather than joins: the irrigation table rows (`irrigation-des.json`, from the Season and Crop Report PDF with the printed page cited) and Satara's environment-plan figures (each with a quote and a PDF page) enter as `pipeline-inputs/` files a human verifies.

## 4. Artifact families (per district, `public/data/atlas/<state>/<slug>/`)

| Artifact | Content | Source |
|---|---|---|
| `directory.json` | GPs, blocks, crosswalk state, uncovered villages, unbound units, per-register vintages | TNRD / LGD + JJM + Census |
| `boundaries/` (MH) | taluka shards of GP MultiPolygons, simplified ~20 m | DataMeet (ODbL) |
| `groundwater-taluks.json` | stage of extraction and category per taluk/taluka, all published assessment years | IN-GRES |
| `groundwater-projection.json` | each GP assigned to its assessment unit (spatial for TN, membership for MH); deferrals named per GP | derived |
| `census-2011/` | per-block village shards: households, water source and availability | Census 2011 DCHB |
| `jjm-service/` | per-village tap connections and sample history | JJM Citizen Corner |
| `rainfall.json` | last-30-day reading per GP centroid against the normal | Open-Meteo (grid-node assignment, exact-point escalation past 10 km) |
| `water-bodies/` | counts per GP (TN); census register rows with points, unassigned rows counted per block (MH) | TNGIS / First Census of Water Bodies |
| `irrigation-current.json` (TN) | net area irrigated by source, district row | Season and Crop Report 2024-25 |
| `environment-plan.json` (MH) | reviewed DEP figures with page cites, water balance explicitly null where the plan prints none | MPCB DEP |
| `polluted-stretches.json` | CPCB polluted river stretches touching the district: priority, max BOD 2022-23, stations with 2024 BOD, change since 2018, and the basis for the district join (named in the report or on the river's course) | CPCB PRS October 2025 (national reviewed input `pipeline-inputs/atlas/prs/`) |
| `assessments/`, `briefs/`, `curated-briefs.json` | per-place capability assessment and the brief each page renders; curated briefs are hand-written and reviewed | derived |

All artifacts are NVDM-enveloped at L2 and validated by the same gates as city data.

## 5. Verdict composition

A district verdict is composed, not scored: each family contributes a reading under its own contract, the severest present reading leads, and unmeasured dimensions are named on the page rather than averaged away. Salem leads with 13 of 14 taluks over-exploited; Satara reads "Within limits" with its tap-coverage gap named; a JJM register that reports exactly 100.0% is flagged as a reporting convention, not celebrated. There is no composite index anywhere in the Atlas, by rule.

## 6. Refresh and operations

- `.github/workflows/atlas-refresh.yml` runs monthly (2nd, 07:00 IST) over the district matrix, or on dispatch per slug. The chain (`scripts/atlas-refresh-district.sh`) re-runs registers whose upstream digests moved, skips what has not changed, revalidates, regenerates the catalogue and conformance docs, and commits to main.
- Production serves the corpus at `corpus.lock`, not the git checkout - so a refresh reaches the site only through the release chain: data-repo PR, merge, immutable `corpus-YYYY-MM-DD-<slug>` tag, and a pin PR moving `corpus.lock` (helper: `scripts/release_corpus.py prepare` / `pin`).
- JJM is the long pole (a few seconds per village; Satara's 1,742 villages run in hours), so the workflow ceiling is set accordingly.

## 7. Honest limits, as shipped

- TNGIS layers are used for counts and boundaries while the licence question is open; water-body detail beyond counts waits on it.
- Satara has no current irrigation reading - the gap and its reason are on the page (see the registry's `irrigationCurrentSource`).
- The MH water-bodies census templates its waterspread column, so area is `withheld` rather than reprinted.
- Tirupathur's Census axis is weak by construction (238 Vellore-taluk rows for 208 GPs); binding rates are printed, not smoothed.
- A GP whose centroid falls outside every taluk polygon defers its groundwater projection, named per GP (`no-containing-taluk`).

## 8. Shipped districts

| District | State | GPs | Blocks/Talukas | Groundwater | Hook |
|---|---|---|---|---|---|
| Thanjavur | TN | 589 | 14 | canal-fed delta | The rice bowl: the district's water year is decided upstream at Mettur |
| Tiruchirappalli | TN | 404 | 14 | wells-led | Thanjavur's inverse: water security is a groundwater question |
| Salem | TN | 385 | 20 | 147.5%, 13 of 14 taluks OE | Holds Mettur, the delta's canal head, and irrigates almost none of its own farmland from it |
| Tirupathur | TN | 208 | 6 | 142.9%, 4 of 4 taluks OE | The Palar tannery belt without a canal: all irrigation is from wells |
| Satara | MH | 1,502 | 11 | Within limits (2 talukas semi-critical) | Koyna country with a dry eastern edge |

Onboarding cost after the adapters: roughly a day per district on an existing adapter, dominated by register fetches and human review of the staged proposals.

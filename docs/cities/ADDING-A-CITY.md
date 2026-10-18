# Adding a city

This is the whole job, start to finish: from a folder of research to a city
that is live on the site with its data refreshing every day. It is written for
someone doing it for the first time. Every step says what to do, how to check
it, and what usually goes wrong.

Reference pages it links to:

- [src/cities/README.md](../../src/cities/README.md): what goes in a city folder.
- [src/lib/cities/types.ts](../../src/lib/cities/types.ts): every config field, documented.
- [schemas/nvdm/GUIDE.md](../../schemas/nvdm/GUIDE.md): the data standard, step by step.

## The job on one page

```
 research ─► city folder ─► data ─► data release ─► database ─► daily refresh ─► checks ─► ONE pull request ─► live
 (sources)   (config,       (build   (data repo PR,  (migrations, (proven from      (CI,      (the switch-on
             content)        files)   corpus.lock)    backfills)   where it runs)   browser)   goes in it too)
```

A city is three things:

1. **Its folder**, `src/cities/<id>/`: config, written content, pipeline settings.
2. **Its data**: JSON and GeoJSON files built by scripts into `public/data/` and
   `public/geojson/`, shipped through the data repository.
3. **Its database rows**: the city, its water sources, and the daily readings
   the scrapers write.

Everything else (navigation, sitemap, route guards, the landing card, the
footer, the exemptions register) is derived from the config.

## Two repositories, two pins

This trips up everyone once, so read it before touching data.

- **This repository** holds the code, and also keeps a working copy of the data
  under `public/`.
- **The data repository** (`neer-vazhvu-data`, private) is what production
  serves. Every production build replaces `public/data` and `public/geojson`
  with the data repository at the commit pinned in `corpus.lock`.

So **a data file merged here does not reach the site.** It reaches the site
when it is released to the data repository and `corpus.lock` points at that
release. The reverse pin, `toolchain.lock` in the data repository, names the
commit of this repository whose checks the data must pass.

For a new city the two pins depend on each other: the data needs your branch's
source registry to pass its checks, and your branch needs the data to pass
its own. Break the loop the way the release script does: the data PR points
`toolchain.lock` at your pushed branch head, and your PR moves `corpus.lock` to
the merged data commit. Step 6 has the commands.

If you cannot read the data repository, you can still do everything up to
step 6: local builds use the copy under `public/` (`CORPUS_SOURCE=repo`, the
default).

## Before you start

- **Read [docs/cities/kolkata/parity-scorecard.md](kolkata/parity-scorecard.md).**
  It grades a city against Chennai feature by feature, and makes the distinction
  that matters most: a *structural* absence (Kolkata impounds no water, so it
  has no reservoir cards) is a fact about the city, not a gap in the build.
- **Official sources first.** Prefer the publisher's own document or portal to
  a news report or an aggregator, and record every source as you go (step 5).
- **Plan for one pull request** that adds the city and switches it on. Do the
  database, refresh and review steps on your branch before opening it, so that
  nothing found later needs a second PR.

## Step 1: Create the city folder

1. Copy the folder of the most similar city, for example
   `cp -r src/cities/ahmedabad src/cities/coimbatore`. Ids are lowercase
   (`a-z`, `0-9`, `-`) and permanent.
2. In `config.ts` set `cityId` (the folder name), `listOrder` (its place in
   the city lists: the last city's number + 10, or a number between two
   cities), `displayName`, `stateCode`, `center`, `bbox`, and leave
   `enabled: false` until step 11.
3. Run `npm run cities:gen`. It writes `src/cities/generated/` and adds the
   city's row to `schemas/nvdm/scopes.json`. If the city's state is new, it
   stops and asks you to add the state's row first (copy an existing state row).
   Then run `python3 scripts/build_nvdm_reference.py`.
4. Run `npx tsc --noEmit` and `npm test`. The type checker and the onboarding
   contract (`src/lib/cities/onboarding-contract.test.ts`) list what the city
   is still missing. Work through them.

The required config fields are the decisions:

- **`routes`**: only routes with real content behind them. Every route you
  leave out needs a reason in `routes-off.ts` (`npm run data:check` fails
  otherwise). A reason is a fact about what is published, not "not built yet"
  unless that is the truth.
- **`landing`** (the card's hook and accent), **`footerSources`** (the core live
  sources), **`wardsVintage`** (`null` until the city has ward geometry),
  **`originsTagline`** (one line, heads the Origins page).
- **`heroMode`** and its payload: step 2.

For a metropolitan **region** rather than one corporation, set
`placeKind: 'region'` and list `corporations` (Mumbai is the worked example).

## Step 2: Pick the hero

The dashboard hero is the city's headline number. Pick the one that is honest
for how the city gets its water:

| Mode | Use when | Needs | Example |
|---|---|---|---|
| `days-left` | the tracked dams ARE the city's supply | `defaultConsumptionMld`, `defaultDesalinationMld` | Chennai |
| `allocation` | the dams are upstream irrigation reservoirs and the city has a published drinking-water allocation | `urbanSupply` | Madurai |
| `cauvery-pumping` | the water is carried from far away and the limit is capacity against design | `hero_copy` in `<id>-supply-overview.json` | Bengaluru, Delhi, Pune, Ahmedabad |
| `drainage-capacity` | the city impounds nothing and its emergency is water it cannot get rid of | `drainageCapacity`, `rainfall-intensity-<id>.json` | Kolkata |
| `flood-headroom` | the publisher gives live readings and the thresholds they are measured against | `floodChain` | Surat |

`isPrimaryDrinkingSource` on a water source marks a reservoir the city draws
from. A shared reservoir the city draws from directly is `true`; upstream
storage that only governs releases to a river the city pumps from is `false`.

If none fits, check whether the city is refusing the question rather than
lacking the data. Kolkata needed a new mode because `days-left` was undefined
there, not merely awkward. `none` hides the hero and usually throws away what
the city does measure.

## Step 3: Write the content

All in the city folder (table in [src/cities/README.md](../../src/cities/README.md)):

- `about.tsx` and `about-pages.tsx`: what each page shows and where its numbers
  come from.
- `story-en.tsx`: the Origins long-read, built from the shortcodes in
  `src/components/story/story-shortcodes.tsx`. Every image needs its licence
  checked at the source and an entry in `public/images/story/<id>/MANIFEST.json`;
  ship without images rather than with an unchecked one.
- `rivers.ts`, `flood.ts`, `my-ward.ts` for the routes that are on.
  Helplines and portals in `my-ward.ts` must be the city's own, from the
  agency's own page. If a number cannot be verified, use `value: null` and a URL.
- `routes-off.ts` for every route that is off.

Also write `docs/cities/<id>/data-sources.md` (every source and how it is
read) and `docs/cities/<id>/features.md` (what is on, what is off and why).

## Step 4: Languages

If the city has a regional language, set `availableLanguages: ['en', '<code>']`
and translate every key in `src/lib/i18n/translations.ts`
(`npm run i18n:check`). If the translation pass will come later, list the
language in `upcomingLanguages` instead; the switcher shows it greyed out.

## Step 5: Build the data

Every file under `public/data` and `public/geojson` follows NVDM, the data
standard in [schemas/nvdm/](../../schemas/nvdm/README.md). New files must reach
level L2. In practice:

- **Register every source** in `scripts/source-registry/<id>.json` (copy a
  recent city's), with each data file it feeds in `dependsOn`. A one-time
  document is `closed` with an `as_of` date.
- **Write through the writers**, `write_artifact` (`scripts/nvdm_write.py`) or
  `writeArtifact` (`scripts/lib/nvdm-write.ts`), with the envelope in the
  payload on the first write. A bare `json.dump` strips the envelope on the
  next refresh, and `check-generator-drift.py` fails it.
- **Licence wording is a closed list.** Use an id the registry already knows or
  the pattern `"<Publisher> publication, cited with attribution"`. Never put a
  licence string in a script; read it with `registry_license(source_id)`.

Shared pipelines that only need the city's settings, in
`src/cities/<id>/pipeline.json` (copy a city that has the section):

| Section | Script | What it makes |
|---|---|---|
| `rainfall.imdGrid` | `neer-vazhvu-api/scripts/generate_imd_rainfall.py --city <id>` | `imd-rainfall-monthly-<id>.json`, the long-term series. Validate the grid cell against the nearest IMD observatory normal and say so in `note`. Run it on a machine IMD answers, and check the output is not all zeros. |
| `rainfall.recent` | `neer-vazhvu-api/scripts/fetch_recent_rainfall.py --city <id>` | `rainfall-recent-<id>.json`, the provisional months. Use the same point as `imdGrid`. Every city must have this file. |
| `ingres` | `neer-vazhvu-api/scripts/build_ingres_gwr.py --city <id>` | `gwr-blocks-<id>.json`, the IN-GRES groundwater assessment. Drill below the district when the district figure hides the city's unit. |
| `elevationBands` | `neer-vazhvu-api/scripts/build_elevation_bands.py --city <id>` | `elevation-bands-<id>.geojson` (view only, never downloadable). |

Other shared builders take a per-city file in their own directory:
`scripts/osm-layers/<id>.json` for `scripts/fetch-osm-layers.ts` (water bodies,
rivers, drainage, localities), and the config dict in
`neer-vazhvu-api/scripts/build_ward_profiles.py` for ward profiles.

Curated research is an input file, not a script. Commitments, lake-restoration
projects, flagship lakes and the allocation ledger each live in the city folder
(`commitments.json`, `restoration-projects.json`, `water-bodies-flagship.json`,
`allocations.json`; copy Nagpur's commitments or Ahmedabad's lake files), and
`python3 neer-vazhvu-api/scripts/build_curated.py all --city <id>` builds them.
The builder fails on a broken row (a duplicate id, a status the page does not
know, a status that is not its latest history entry, a commitment linking an
allocation that does not exist, counts that disagree with `build.expect`) and
warns on the rest (a history entry with no citation, a recheck date that has
passed, a crore split that does not add up). `all --all --check` lists the
warnings for every city.

Write a builder only when the numbers are transcribed from a document's table
whose printed totals can be checked, or are read from another artifact; then
the builder checks them (Nagpur's lakes and allocations are the examples).

Everything else (supply, facts, river quality, the dam scraper) is still a
per-city script today:
`neer-vazhvu-api/scripts/build_<id>_<what>.py`. Start from the most recent
city's version. These are being replaced by shared builders that read per-city
JSON inputs, so keep curated content (rows, citations, wording) in clearly
separated data structures rather than mixed into logic.

Facts and commitments carry statuses and dates that readers quote. Every
status rests on a dated citation; a promise with no progress figure is
`unverified`, and a passed date with no completion record is `overdue`.

When the data is built, regenerate the docs that describe it, from a clean
checkout rebased on the latest `main` (scheduled refreshes land on `main`
during the day, and a stale base shows up as a two-byte diff in another city's
file):

```bash
python3 scripts/build_dataset_catalogue.py
python3 scripts/validate_nvdm.py
npx tsx scripts/build-exemptions-register.ts
python3 scripts/build_nvdm_reference.py
```

## Step 6: Release the data

Production serves the data repository (see "Two repositories, two pins").

```bash
git push -u origin <your-branch>                                  # the release reads your pushed head
python3 scripts/release_corpus.py prepare --slug <id>             # dry run: lists what changes
python3 scripts/release_corpus.py prepare --slug <id> --execute   # opens the data PR
```

`prepare` copies new and changed files to the data repository (it never
deletes) and points `toolchain.lock` at your branch head. A maintainer reviews
and merges the data PR and tags it `corpus-YYYY-MM-DD-<id>`. Then:

```bash
python3 scripts/release_corpus.py pin --sha <data merge sha> --execute
```

This rewrites `corpus.lock` (the commit and the expected file counts). Commit
it on your branch. Until the pin moves, the CI job that builds against the
real corpus fails on the city's missing files; that is expected.

Do one data release per city. After your PR merges, the next data release
moves `toolchain.lock` back to `main`; do not open a PR just for that.

## Step 7: Database

Migrations live in `supabase/migrations/`, numbered in sequence. A city has
three (Visakhapatnam's 057 to 059 are the worked example):

1. `<n>_<id>_seed_disabled.sql`: the city row, `enabled = false`.
2. `<n>_<id>_water_sources.sql`: its reservoirs or other sources, matching
   `waterSources` in the config.
3. `<n>_<id>_enable.sql`: flips the city on. This one goes in the same PR as
   `enabled: true` in the config.

Apply the first two before opening the PR (a disabled city is harmless), then
run any history backfill. Backfills fetch years of daily reports; run them in
small date chunks so one failed fetch does not lose a year, and keep the
machine awake.

Expect the publisher's own errors. Daily bulletins contain misprints (a level
ten times too high, a column shifted). Withhold them with an explicit list and
a sanity bound in the scraper, never by editing the database by hand.

## Step 8: Daily refresh

Every daily feed the city has must run on a schedule, like every other city's.
Where it runs depends on whether the publisher answers GitHub's servers:

- **A GitHub workflow** (`.github/workflows/`) if it does.
- **The maintainers' scheduled local job** if it does not. Many state portals
  refuse data-centre addresses: the request hangs rather than failing.

Prove the first scheduled run from where it will really run, before opening
the PR: a workflow run on your branch, or a run of the local job. Then add the
feed to the freshness check (`EXTRA_FEEDS` in `scripts/check-data-freshness.ts`
for file feeds) so a stale feed raises an alert.

## Step 9: Citizen reports

Add the city to its state's file in `src/lib/sightings/routing/states/`
(create the file and list it in `index.ts` if the state is new). For each of
the seven report roles, name the public body that handles it and the channels
it officially publishes, each with the official page that says so. A body the
whole state shares goes once in the state's `roles`. Never invent a channel: a
body with none gets `channels: []`. The onboarding contract fails until every
role resolves.

## Step 10: Check everything

Run both CI jobs locally. Lint and tests are the easy half; the drift checks
and generated docs are where pull requests fail.

```bash
# Frontend
npx tsc --noEmit && npm run lint && npm test && npm run i18n:check && npm run data:check
npm run build

# API and scripts
cd neer-vazhvu-api && ruff check . && ruff format --check . && pytest -q && cd ..
ruff check scripts/ --select F821,F822,E902
python3 scripts/check-generator-drift.py
python3 scripts/nvdm-encumbrance-report.py --selftest
python3 scripts/validate_nvdm.py --selftest
bash scripts/nvdm-gate.sh $(git merge-base HEAD origin/main)
```

Then look at the pages in a browser. **An HTTP 200 means nothing:** pages
catch their own errors and still render a shell. Drive every route against a
control city and read what the script reports:

```bash
npm run dev   # or a production build: npm run build && npm start
uvx --with playwright python scripts/check-city-surfaces.py --city <id> --control bangalore
```

It flags blank values, `undefined`, and other cities' names on the page. An
other-city mention that is true and needed (a river that flows into Delhi)
goes in `surfaceAudit.adjudicated` in `pipeline.json` with the reason.

Last, review every claim a reader could quote: each number against its source,
each status against its dated citation. Anything that cannot be verified ships
labelled as unverified, or does not ship.

## Step 11: Open one pull request

The PR carries the city folder, the builders, the source registry, the docs,
the migrations, the `corpus.lock` pin and the switch-on:

- `enabled: true` in `config.ts` and the `_enable.sql` migration, once the
  checks in step 10 pass.
- Fixes to shared components that the new city exposed (a component that
  assumed a reservoir, a label written for another city). Declare each one in
  the PR description; they change other cities' pages.

If something time-bound is pending (a due date passing next week, a source
about to publish), hold the PR open rather than merging and following up.

After merge: apply the enable migration, confirm every route returns the city's
own content on the live site, and watch the first scheduled refresh land.

## Still edited outside the folder

A few things are still shared files. Each is listed so nothing is forgotten:

| What | Where | When |
|---|---|---|
| Shared-source data paths | `dependsOn` in `scripts/source-registry/platform.json` (IMD gridded rainfall, Open-Meteo, OSM, FABDEM, CPCB) | the city uses one of those sources |
| Freshness feeds | `EXTRA_FEEDS` in `scripts/check-data-freshness.ts` | the city has a file feed beyond rainfall |
| Coastline | `COASTS` in `neer-vazhvu-api/app/gee/coastline.py` and the matrix in `.github/workflows/coastal-shoreline-refresh.yml` | the city has a `shoreline` route |
| Satellite summaries | `neer-vazhvu-api/app/gee/cities.py` | the city joins the Earth Engine water-body cohort |
| Ward profiles | the `CITIES` dict in `neer-vazhvu-api/scripts/build_ward_profiles.py` | the city has `my-ward` |
| New translation keys | `src/lib/i18n/translations.ts` | the city needs a label no city has needed |
| A new hero mode, tanker kind or language | `src/lib/cities/types.ts` and its component | the city needs something no city has |
| The local refresh job | maintainers' machine | the city has a feed GitHub cannot reach |

## Things that will bite you

- **Production serves the pin.** A green merge of a data change is not a
  shipped change. Check the live file:
  `curl -s https://www.neervazhvu.org/data/<file>`.
- **A failed download is not a dry year.** A rainfall run that cannot reach
  IMD must abort, not write zeros; look at the numbers before committing.
- **Never fall back to another city.** A missing value renders nothing. A
  fallback to Chennai's helplines once showed CMWSSB's number to Gurugram's
  residents for weeks.
- **The writers keep the envelope already on disk.** Deleting a file and
  re-running a script that builds no envelope writes a bare file.
- **Rebase before regenerating docs.** CI checks the merge result, and the
  scheduled refreshes move `main` during the day.
- **Do not run `fetch-corpus.sh` in your working checkout.** It replaces
  `public/` wholesale; use a throwaway worktree if you need the real corpus.
- **`npm ci`, not `npm install`,** in a fresh checkout or worktree.

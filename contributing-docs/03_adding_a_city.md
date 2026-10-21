## Adding a new city

The multi-city architecture is config-driven. **Before starting, read
`docs/cities/kolkata/parity-scorecard.md`** - it is the worked example of grading a new city against
Chennai feature by feature, and of the distinction that matters most: a structural N/A (Kolkata has
no reservoirs, so it cannot have reservoir cards) is a difference in the city, not a deficiency in
the build, and should never be reported as a gap.

Two hard-won lessons from the Kolkata onboarding, both of which cost real time:

- **HTTP 200 means nothing.** A live browser audit of all 11 Kolkata routes found every one
  returning 200 while four were broken - these pages catch their own errors and still render a
  shell. Drive the pages in a real browser and check console errors and rendered feature counts,
  not status codes. Note also that the About page uses `<details>` sections with one open by
  default, so `innerText` under-reads it dramatically unless you expand them first.
- **Landing the data files is roughly half the work.** Each page's curated content (river
  narratives, flood configs, the Origins story, the About page) is per-city content too, and the
  shared components carry earlier-city assumptions that only surface when a city without them
  renders. Generalise these rather than forking.

A city is its config file, its content modules and its data. Everything else - nav, sitemap, route
guards, landing card, footer, exemptions - derives from the registry, and most omissions are a
`tsc` error or a failing test rather than another city's facts on the page. To add (say) Coimbatore:

1. **Register the id.** Add `"coimbatore"` to `CITY_IDS` in `src/lib/cities/ids.ts`. `tsc` now
   fails everywhere the city is still missing (the registry, the Origins taglines, the About
   modules) - work through those errors. Add the same id to the scope registry,
   `schemas/nvdm/scopes.json`, with its state as `administrative-parent`; `npm run test` holds the
   two lists equal.
2. **Write the config.** Create `src/lib/cities/coimbatore.ts` exporting a `PlaceConfig` and add it
   to `REGISTRY` in `src/lib/cities/index.ts`. The required fields are the decisions:
   - `routes` - only routes with content behind them. Give every route you leave out a reason in
     `scripts/lib/exemptions.ts` (`npm run data:check` fails otherwise).
   - `landing` (card hook + accent class), `footerSources` (the core live sources), and
     `wardsVintage` (`null` until the city has ward geometry).
   - `heroMode` and its payload, which the type keeps together:
     - `"days-left"` if the tracked dams ARE the urban supply (Chennai-pattern). Set
       `defaultConsumptionMld` and `defaultDesalinationMld`.
     - `"allocation"` if the dams are upstream irrigation reservoirs and the city has a published
       drinking-water allocation (Madurai-pattern). Provide `urbanSupply`.
     - `"cauvery-pumping"` if the city's water is carried from a distant source and the constraint
       is capacity against design (Bengaluru, Delhi, Gurugram, Pune). The narrative comes from the
       city's own `hero_copy` in `<cityId>-supply-overview.json`; nothing falls back to another
       city. Track upstream reservoirs in `waterSources`. `isPrimaryDrinkingSource` marks a
       reservoir the city draws from: it drives the About badge and the missed-ingestion check, and
       this hero computes no runway from it. A shared reservoir the city draws from directly sets it
       `true` (Pune's Khadakwasla chain, Visakhapatnam's reservoirs); upstream basin storage that
       only governs releases to a river the city pumps from sets it `false` (Bengaluru's four Cauvery
       dams above T.K. Halli).
     - `"drainage-capacity"` if the city impounds nothing and its emergency is water it cannot get
       rid of (Kolkata-pattern). Provide `drainageCapacity` and build
       `rainfall-intensity-<cityId>.json` with `neer-vazhvu-api/scripts/fetch_rainfall_intensity.py`.
     - `"flood-headroom"` if the publisher gives live readings AND the operational thresholds they
       are measured against (Surat-pattern). Provide `floodChain`.
     - **If none fit, stop and check whether the city is refusing the question rather than lacking
       the data** - Kolkata needed a new mode because `days-left` was undefined there, not merely
       awkward. `"none"` suppresses the hero, and usually throws away what the city does measure.
3. **Write the content** in `src/content/`:
   - Origins: `story-coimbatore-en.tsx`, its `STORY_TAGLINES` entry, and a line in
     `src/components/story/city-story.tsx`.
   - About: `about/coimbatore.tsx` (it must fill the `pages-1` slot) with
     `about/coimbatore-pages.tsx`, and a line in `src/components/about/city-about.tsx`.
   - `rivers/coimbatore.ts` and `flood/coimbatore.ts` if those routes are on.
4. **Languages.** If the city has a regional language, set `availableLanguages: ['en', '<iso>']` and
   translate every key (`npm run i18n:check`); if the pass will follow later, declare it in
   `upcomingLanguages` instead.
5. **Data.** Drop files into `public/data/coimbatore-*.json` and `public/geojson/coimbatore-*.geojson`.
   Mirror `compute-ward-profiles.ts` for the ward layers, emitting `_data_status: "not_available"`
   for sections you don't have yet. For IMD rainfall, add the city's grid cell to `CITY_DEFAULTS` in
   `neer-vazhvu-api/scripts/generate_imd_rainfall.py` - the quarterly refresh picks it up from there.
   Production serves the corpus pinned in `corpus.lock`, so new data ships through
   `scripts/release_corpus.py` and a pin bump, not by merging the files alone.

   Every data file follows NVDM, the data standard in [`schemas/nvdm/`](../schemas/nvdm/README.md),
   and CI rejects a new file that does not reach level L2:
   - **Write through the writers.** Producers write with `write_artifact` (`scripts/nvdm_write.py`)
     or `writeArtifact` (`scripts/lib/nvdm-write.ts`), with the envelope in the payload on the
     first write. The writers keep the envelope on every later rewrite.
   - **Account for every source.** Register each upstream that can publish again in
     `scripts/source-registry/coimbatore.json`, with the data file in its `dependsOn`, and cite it
     by `id`. Mark a one-time document `closed` with an `as_of` date.
   - **Run the generators** and commit what they change: `python3 scripts/build_dataset_catalogue.py`,
     `python3 scripts/validate_nvdm.py`, then `python3 scripts/build_nvdm_reference.py`.
   - **Aim for L3** on the datasets that have a payload contract (facts, commitments, allocations,
     ward profiles, groundwater stations, restoration priority, current water bodies, rivers).

   [`schemas/nvdm/GUIDE.md`](../schemas/nvdm/GUIDE.md) walks through each of these with a worked
   example, and lists every message the check can print with its fix.
6. **Database.** Add a `<nnn>_coimbatore_seed_disabled.sql` migration (and `_water_sources.sql` if
   it has reservoirs), following 046-048 for Surat.
7. **Citizen reports.** Add the city to its state's file in `src/lib/sightings/routing/states/`
   (create the state file and list it in `index.ts` if it is the first place there): for each of
   the seven report roles, the public body that handles it and the channels it officially publishes,
   each with the official page that says so. A body the whole state shares (the pollution control
   board, usually) goes once in the state's `roles`; a region's per-corporation bodies go under
   `corporations`, keyed as `src/lib/sightings/locate-server.ts` resolves them. Never invent a
   channel: a body with none gets `channels: []`. The onboarding contract fails until every role
   resolves.
8. **Check before cutover.** `npm test` runs the onboarding contract
   (`src/lib/cities/onboarding-contract.test.ts`), `npm run data:check` the exemptions register.
   Then drive every route in a browser:
   `uvx --with playwright python scripts/check-city-surfaces.py --city coimbatore --control bangalore`.

For a **metropolitan region** rather than a single corporation, set `placeKind: 'region'` and a
`corporations[]` array (the Mumbai pattern: 9 MMR corporations); the regional dashboard section,
scope badges (`dashboardScopes`) and per-corporation data file hang off that structure.

Worked examples: Madurai (PR #97) for the `allocation` pattern; Bengaluru for `cauvery-pumping` plus
Kannada localization; Mumbai (PR #147) for the region pattern; Surat (PR #274) for `flood-headroom`.

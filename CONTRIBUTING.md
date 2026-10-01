# Contributing to Neer Vazhvu

Thanks for your interest in contributing! This project tracks Indian cities' water systems (Chennai, Madurai, Bengaluru, Mumbai and Delhi live, more on the way) and aims to make civic data accessible to everyone.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+ (3.12 recommended; used in CI)
- npm

### Frontend (Next.js)

```bash
npm install
npm run dev
```

Without Supabase configured, pages render from the static files in `public/data` and the database-backed panels show as unavailable, so most UI work needs no database setup.

### Python API (FastAPI)

```bash
cd neer-vazhvu-api
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

### Full Setup (with live data)

If you need real data flowing through, you'll need a [Supabase](https://supabase.com) project:

1. Create a Supabase project
2. Run the migrations in `supabase/migrations/` against your database
3. Copy `.env.example` to `.env.local` (frontend) and `neer-vazhvu-api/.env.example` to `neer-vazhvu-api/.env`
4. Fill in your Supabase credentials
5. Seed historical data using the scripts in `scripts/`

## Project Structure

```
neer-vazhvu/
├── src/                  # Next.js frontend (App Router)
│   ├── app/
│   │   ├── (chennai-flat)/        # Legacy Chennai-only routes (/, /my-ward, /groundwater, /water-bodies, /rivers, /flood-risk, /about, /facts, /origins)
│   │   └── [cityId]/              # Multi-city parallel routes for Madurai, Bengaluru, Mumbai, Delhi and future cities
│   ├── components/                # React components (most are city-agnostic; per-city forks live in dashboard/, my-ward/, water-bodies/)
│   ├── lib/
│   │   ├── cities/                # *** Place config registry — add a city by adding a file here ***
│   │   │   ├── chennai.ts         # CityConfig: GCC 200 wards, CMWSSB reservoirs, days-left hero, etc.
│   │   │   ├── madurai.ts         # CityConfig: MMC 100 wards, Vaigai/Mullaperiyar/Sothuparai, allocation hero, urbanSupply
│   │   │   ├── bangalore.ts       # CityConfig: GBA 369 wards, 4 upstream Cauvery reservoirs (all isPrimaryDrinkingSource=false), cauvery-pumping hero, KN locale
│   │   │   ├── mumbai.ts          # CityConfig: first region place — 9 MMR corporations, 7 BMC lakes, days-left hero with upper-bound heroNote
│   │   │   ├── delhi.ts           # CityConfig: MCD 250 wards, 6 sources ALL hasPublicFeed=false (no authority publishes daily), cauvery-pumping hero w/ hero_copy overrides, HI upcoming
│   │   │   └── types.ts           # PlaceConfig union + GroundwaterViewsConfig + UrbanSupplyConfig + heroMode discriminator
│   │   ├── hooks/                 # Per-city promise caches: use-ward-profile, use-my-ward-data, use-ward-representatives
│   │   ├── i18n/                  # ~1,500 EN/TA/KN translation keys (one file)
│   │   └── utils/                 # Shared utils incl. river-classification (CPCB Best-Use thresholds, used by all cities)
│   └── types/                     # TypeScript definitions
├── neer-vazhvu-api/               # Python API (FastAPI)
│   ├── app/scrapers/              # CMWSSB, NASA POWER, Open-Meteo, OpenCity, WRIS (Madurai + Bangalore), TN Agriculture ARS (Madurai), KWRIS (Bengaluru), Pravah (Mumbai). Delhi has none - no authority publishes a daily feed for it (see docs/cities/delhi/features.md)
│   ├── app/etl/                   # Pipeline orchestrator, constants
│   ├── app/gee/                   # Earth Engine Phase 1 summaries and catchment tooling
│   ├── app/intelligence/          # ARIMAX forecaster, risk scorer, briefing
│   └── app/routers/               # API endpoints
├── public/
│   ├── data/                      # Static JSON: per-city files carry the city id in the name, as a prefix (madurai-supply-overview.json) or a suffix (imd-rainfall-monthly-bangalore.json); a few older Chennai files carry none. Every file follows NVDM (schemas/nvdm/)
│   └── geojson/                   # Static spatial: same per-city naming convention
├── scripts/                       # One-time + build-time scripts
│   ├── compute-ward-profiles.ts             # Chennai 200-ward profile compute
│   ├── compute-madurai-ward-profiles.ts     # Madurai 100-ward profile compute (mirror, emits not_available markers for layers Madurai doesn't have)
│   ├── compute-bangalore-ward-risk.py       # Bangalore ward-risk composite (over 198 BBMP wards; 3-factor reduced variant)
│   ├── ingest_rich_body_imagery.py          # Body-agnostic Sentinel-2 / Landsat chip ingest (merges with existing manifest)
│   ├── verify_rich_body_dw_water_trend.py   # DW water class (2022-present) per body; bridges JRC's 2021 cutoff
│   ├── fetch-osm-layers.ts                  # City OSM layers (water bodies, rivers, drainage, localities); per-city rules in osm-layers/<city>.json
│   ├── osm-layers/                          # Per-city bbox, Overpass select statements, river-name rules, ward join
│   └── fetch-localities-osm.ts              # Chennai OSM neighbourhood points (not yet folded into fetch-osm-layers.ts)
├── neer-vazhvu-api/scripts/
│   └── generate_imd_rainfall.py             # Multi-city IMD gridded rainfall extractor (Chennai 13.0/80.0, Madurai 9.9/78.0, Bangalore 13.0/77.5)
├── supabase/migrations/           # Database schema
└── .github/workflows/             # CI (daily pipeline, keepalive)
```

### Adding a new city

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
       city. Track upstream reservoirs in `waterSources` with `isPrimaryDrinkingSource: false` if
       they are shared with irrigation or other cities.
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

   Every data file follows NVDM, the data standard in [`schemas/nvdm/`](schemas/nvdm/README.md),
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

   [`schemas/nvdm/GUIDE.md`](schemas/nvdm/GUIDE.md) walks through each of these with a worked
   example, and lists every message the check can print with its fix.
6. **Database.** Add a `<nnn>_coimbatore_seed_disabled.sql` migration (and `_water_sources.sql` if
   it has reservoirs), following 046-048 for Surat.
7. **Check before cutover.** `npm test` runs the onboarding contract
   (`src/lib/cities/onboarding-contract.test.ts`), `npm run data:check` the exemptions register.
   Then drive every route in a browser:
   `uvx --with playwright python scripts/check-city-surfaces.py --city coimbatore --control bangalore`.

For a **metropolitan region** rather than a single corporation, set `placeKind: 'region'` and a
`corporations[]` array (the Mumbai pattern: 9 MMR corporations); the regional dashboard section,
scope badges (`dashboardScopes`) and per-corporation data file hang off that structure.

Worked examples: Madurai (PR #97) for the `allocation` pattern; Bengaluru for `cauvery-pumping` plus
Kannada localization; Mumbai (PR #147) for the region pattern; Surat (PR #274) for `flood-headroom`.

### Adding or changing a data file

Any `.json` or `.geojson` file under `public/data/` or `public/geojson/` follows NVDM (the Neer
Vazhvu Data Model). In short: the file carries an envelope naming its dataset, its place and its
sources; scripts rewrite it through the writers so the envelope survives; and a CI gate requires a
new file to reach level L2 and an existing conforming file to keep its level.

- What is required: [`schemas/nvdm/RULES.md`](schemas/nvdm/RULES.md).
- How to do it, step by step: [`schemas/nvdm/GUIDE.md`](schemas/nvdm/GUIDE.md).
- Before you push: `bash scripts/nvdm-gate.sh origin/main`
  ([the full list](schemas/nvdm/GUIDE.md#8-before-you-open-a-pull-request)).

## Earth Engine Phase 1

If you are working on the satellite summary layer, also read [GEE_PHASE2_3_PLAN.md](GEE_PHASE2_3_PLAN.md) and the shipped-method write-ups under [docs/methodology/](docs/methodology/).

Local prerequisites for GEE work:

- an Earth Engine-enabled Google Cloud project
- a service account with `Earth Engine Resource Writer` and `Service Usage Consumer`
- `GEE_CLOUD_PROJECT` plus either `GEE_SERVICE_ACCOUNT_FILE` or `GEE_SERVICE_ACCOUNT_JSON`

Useful commands from `neer-vazhvu-api/`:

```bash
python scripts/run_gee_phase1.py check-auth
python scripts/run_gee_phase1.py build-targets --write
python scripts/run_gee_phase1.py validate-catchments
python scripts/run_gee_phase1.py run-reservoir-context --write
python scripts/run_gee_phase1.py run-water-body-summaries --write
```

Current workflow note:

- `.github/workflows/gee-phase1.yml` is wired for manual dispatch in this branch
- if you change the GEE data model or methodology, update both [README.md](README.md) and [GEE_PHASE2_3_PLAN.md](GEE_PHASE2_3_PLAN.md) and the shipped-method write-ups under [docs/methodology/](docs/methodology/) in the same PR

## Development Workflow

1. **Fork** the repository and clone your fork
2. **Create a branch** from `main`:
   - `feat/description` — new features
   - `fix/description` — bug fixes
   - `docs/description` — documentation
   - `chore/description` — tooling, deps, CI
3. **Make your changes** — keep PRs focused (one feature or fix per PR)
4. **Open an issue first** for significant changes so we can discuss the approach

## Code Style

### Frontend (TypeScript)

- ESLint: `npm run lint`
- TypeScript strict mode enabled
- Follow existing patterns — shadcn/ui components, Tailwind CSS

### Python API

- Lint: `ruff check .`
- Format: `ruff format .`
- Type hints encouraged on public functions

## Testing

- **Frontend**: `npm run test` (runs `tsx --test` for utility tests) and `npm run build` (catches type errors)
- **Python API**: `cd neer-vazhvu-api && pytest`
- **i18n validation**: `npm run i18n:check` (verifies TA + KN translations exist for all keys)
- Test coverage is thin, and writing tests is a great way to contribute. See [docs/backlog.md](docs/backlog.md) for open test work.

## Areas Where Help Is Needed

### Chennai
- **Data quality** - Improving CMWSSB scraper resilience, handling page-format changes
- **Models** - Better forecasting (Prophet, LSTM), evaporation modelling
- **Frontend** - Daily briefing card integration, chart clarity, mobile polish

### Madurai
- **RTI follow-ups for layers MMC tracks internally but doesn't publish** - daily Pannaipatty WTP raw-water intake + treated output, OHT-wise live storage (23 OHTs), per-zone supply (81 zones), non-revenue water, LPCD actuals. See the "What's missing today" subsection at `/madurai/about` for the institutional landscape.
- **Parsing the ADB TNUFIP IEEs** (`docs/research/adb-tnufip/49107-005-iee-en_10.pdf` and `49107-010-iee-en_0.pdf`) for zone-level demand projections and OHT capacity tables. Powers the deferred "structural at-a-glance heatmap" tile.
- **Lost-tank coordinate research** - the 26 Vencatesan/DHAN documented lost tanks have name + status but no lat/lng. Geocoding historical tank names is research-heavy and most have no OSM presence (they're lost).
- **PWD-WRD Vaigai release log** - currently scraped from episodic news coverage; a structured RTI to PWD-WRD Vaigai Basin Circle would unlock daily releases-by-purpose.

### Bengaluru
- **BWSSB Stage V actual-vs-design RTI** - The Ken (Feb 2026) reported Stage V is delivering ~400 MLD against 775 MLD design. A structured RTI to BWSSB for weekly lift logs would unlock the daily Cauvery-pumping series, not just episodic reporting.
- **Lost-tank coordinate research** - similar to Madurai. The Bangalore lost-tank inventory (~100 documented bodies via T.V. Ramachandra et al.) has name + status but sparse lat/lng. Most have no OSM presence (they're built over).
- **KSPCB OCMMS scraping** - the Karnataka State Pollution Control Board publishes effluent monitoring for red-category industries. We don't yet pull it into the industrial-sources overlay.
- **Long-form Kannada story review** - `src/content/story-bangalore-kn.tsx` is a 4-chapter / ~4,000-word translation pending native-speaker review.
- **More rich-body candidates** - 13 onboarded today. Other candidates: Begur, Allalasandra, Doddabommasandra, Yele Mallappa Shetty. Pattern is registry-driven; see [src/lib/water-bodies/rich-body-registry.ts](src/lib/water-bodies/rich-body-registry.ts).

### Cross-city / shared
- **Tamil prose review** - especially `src/app/[cityId]/about/madurai-page-descriptions.tsx` and the Madurai story pages. Native-speaker review wanted.
- **Kannada prose review** - `src/content/about/bangalore-pages.tsx`, the BangaloreDailyBriefing variants in `src/content/briefing/bangalore.ts`, and the long-form story (`src/content/story-bangalore-kn.tsx`). Native-speaker review wanted.
- **Localization (UI)** - ~1,500 i18n keys covering EN + TA + KN; `npm run i18n:check` enforces parity.
- **Testing** - Unit tests for scrapers, calculator, intelligence modules, and the shared `src/lib/utils/river-classification.ts` (CPCB Best-Use classifier).
- **Adding a fifth city** - see the "Adding a new city" subsection above.

## Submitting a Pull Request

Before opening a PR, please check:

- [ ] Branch is based on latest `main`
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] `npm run i18n:check` passes (if UI text changed)
- [ ] For Python changes: `ruff check .` and `pytest` pass
- [ ] For data changes: the NVDM generators are re-run and `bash scripts/nvdm-gate.sh origin/main` passes ([steps](schemas/nvdm/GUIDE.md#8-before-you-open-a-pull-request))
- [ ] PR description explains **what** changed and **why**

We aim to review PRs within a few days. Thank you for contributing!

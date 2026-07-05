# Contributing to Neer Vazhvu

Thanks for your interest in contributing! This project tracks Indian cities' water systems (Chennai, Madurai, and Bengaluru live, more on the way) and aims to make civic data accessible to everyone.

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

The app runs in **demo mode** with realistic mock data when Supabase is not configured — no database setup needed to start contributing to the UI.

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
│   │   └── [cityId]/              # Multi-city parallel routes for Madurai, Bengaluru, and future cities
│   ├── components/                # React components (most are city-agnostic; per-city forks live in dashboard/, my-ward/, water-bodies/)
│   ├── lib/
│   │   ├── cities/                # *** Place config registry — add a city by adding a file here ***
│   │   │   ├── chennai.ts         # CityConfig: GCC 200 wards, CMWSSB reservoirs, days-left hero, etc.
│   │   │   ├── madurai.ts         # CityConfig: MMC 100 wards, Vaigai/Mullaperiyar/Sothuparai, allocation hero, urbanSupply
│   │   │   ├── bangalore.ts       # CityConfig: GBA 369 wards, 4 upstream Cauvery reservoirs (all isPrimaryDrinkingSource=false), cauvery-pumping hero, KN locale
│   │   │   ├── kaveri.ts          # RegionConfig (region, not city) — work-in-progress
│   │   │   └── types.ts           # PlaceConfig union + GroundwaterViewsConfig + UrbanSupplyConfig + heroMode discriminator
│   │   ├── hooks/                 # Per-city promise caches: use-ward-profile, use-my-ward-data, use-ward-representatives
│   │   ├── i18n/                  # ~1,500 EN/TA/KN translation keys (one file)
│   │   └── utils/                 # Shared utils incl. river-classification (CPCB Best-Use thresholds, used by all cities)
│   └── types/                     # TypeScript definitions
├── neer-vazhvu-api/               # Python API (FastAPI)
│   ├── app/scrapers/              # CMWSSB, NASA POWER, Open-Meteo, OpenCity, WRIS (Madurai + Bangalore), TN Agriculture ARS (Madurai)
│   ├── app/etl/                   # Pipeline orchestrator, constants
│   ├── app/gee/                   # Earth Engine Phase 1 summaries and catchment tooling
│   ├── app/intelligence/          # ARIMAX forecaster, risk scorer, briefing
│   └── app/routers/               # API endpoints
├── public/
│   ├── data/                      # Static JSON: per-city files use a -<cityId> suffix (e.g. madurai-supply-overview.json, bangalore-iisc-stress-wards-2025.json, imd-rainfall-monthly-bangalore.json) except Chennai which keeps legacy unsuffixed paths for back-compat
│   └── geojson/                   # Static spatial: same per-city naming convention
├── scripts/                       # One-time + build-time scripts
│   ├── compute-ward-profiles.ts             # Chennai 200-ward profile compute
│   ├── compute-madurai-ward-profiles.ts     # Madurai 100-ward profile compute (mirror, emits not_available markers for layers Madurai doesn't have)
│   ├── compute-bangalore-ward-risk.py       # Bangalore ward-risk composite (over 198 BBMP wards; 3-factor reduced variant)
│   ├── ingest_rich_body_imagery.py          # Body-agnostic Sentinel-2 / Landsat chip ingest (merges with existing manifest)
│   ├── verify_rich_body_dw_water_trend.py   # DW water class (2022-present) per body; bridges JRC's 2021 cutoff
│   ├── fetch-localities-osm.ts              # Chennai OSM neighbourhood points
│   └── fetch-localities-osm-madurai.ts      # Madurai equivalent (51 OSM points + Wikidata SPARQL fallback)
├── neer-vazhvu-api/scripts/
│   └── generate_imd_rainfall.py             # Multi-city IMD gridded rainfall extractor (Chennai 13.0/80.0, Madurai 9.9/78.0, Bangalore 13.0/77.5)
├── supabase/migrations/           # Database schema
└── .github/workflows/             # CI (daily pipeline, keepalive)
```

### Adding a new city

The multi-city architecture is config-driven. To add (say) Coimbatore:

1. Create `src/lib/cities/coimbatore.ts` exporting a `CityConfig`. Pick a `heroMode`:
   - `"days-left"` if the tracked dams ARE the urban supply (Chennai-pattern). Set `defaultConsumptionMld` and `defaultDesalinationMld`.
   - `"allocation"` if the dams are upstream irrigation reservoirs and the city has a published drinking-water allocation (Madurai-pattern). Provide an `urbanSupply` block with `annualAllocationMcft`, `recentDrawMcft`, `wtpCapacityMld`.
   - `"cauvery-pumping"` if the city's drinking water is lifted from a distant source via dedicated pumping infrastructure and the headline constraint is pump capacity vs design (Bengaluru-pattern). Track the upstream reservoirs in `waterSources` but flag all of them `isPrimaryDrinkingSource: false` if they're shared with irrigation / other cities. Provide a `cauveryPumping` block with current lift, Stage design capacity, Stage actual delivery.
   - `"none"` to suppress the hero entirely.
2. Register it in `src/lib/cities/index.ts`.
3. If the city has a regional language other than EN, set `availableLanguages: ['en', '<iso>']` and add translations for every key in `src/lib/i18n/translations.ts` (validated by `npm run i18n:check`). If the translation pass will follow later, declare it in `upcomingLanguages` instead - the switcher renders a greyed "coming soon" chip (the Mumbai launch pattern).
4. Drop city-specific files into `public/data/coimbatore-*.json` and `public/geojson/coimbatore-*.geojson` matching the existing naming convention.
5. Mirror `compute-ward-profiles.ts` for the new city's ward count + data layers. Emit `_data_status: "not_available"` for sections you don't yet have data for — the UI cards branch on this and render honest "data not yet sourced" disclaimers.
6. For long-term IMD rainfall, add the city's grid intersection to `CITY_DEFAULTS` in `neer-vazhvu-api/scripts/generate_imd_rainfall.py` and run `python generate_imd_rainfall.py --city coimbatore`.
7. The routes at `src/app/[cityId]/...` will pick up the new city automatically once `tryGetPlaceConfig(cityId)` resolves it.

For a **metropolitan region** rather than a single corporation, set `placeKind: 'region'` and a `corporations[]` array (the Mumbai pattern: 9 MMR corporations). The regional dashboard section (`RegionalWaterSystem`), scope badges (`dashboardScopes`) and per-corporation data file (`mmr-corporations-water.json`-style) hang off that structure. Gate any page that is not ready by omitting its feature from `FEATURE_AVAILABILITY` in `src/lib/cities/routing.ts` - nav, sitemap and direct URLs all respect it (the Mumbai my-ward launch pattern).

Worked examples: Madurai onboarding (`madurai_onboarding`, PR #97) is the canonical reference for the `allocation` pattern; Bengaluru onboarding (`bangalore_onboarding`) covers the `cauvery-pumping` pattern + Kannada localization + 13-body rich-data deep-zoom batch; Mumbai onboarding (`mumbai_onboarding`, PR #147) is the most recent and covers the region pattern, the days-left-with-caveats hero, the Allocation Ledger + Commitments Register data files, and workflow-based (GitHub Actions artifact-commit) data feeds.

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
- Test coverage is thin — writing tests is a great way to contribute! See [todo_tests.md](todo_tests.md) for the test roadmap.

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
- **Kannada prose review** - `src/app/[cityId]/about/bangalore-page-descriptions.tsx`, the BangaloreDailyBriefing variants in `translations.ts`, and the long-form story (`src/content/story-bangalore-kn.tsx`). Native-speaker review wanted.
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
- [ ] PR description explains **what** changed and **why**

We aim to review PRs within a few days. Thank you for contributing!

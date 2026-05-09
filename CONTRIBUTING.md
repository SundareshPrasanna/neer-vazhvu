# Contributing to Neer Vazhvu

Thanks for your interest in contributing! This project tracks Tamil Nadu cities' water systems (Chennai and Madurai live, more on the way) and aims to make civic data accessible to everyone.

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
│   │   └── [cityId]/              # Multi-city parallel routes for Madurai (and future cities)
│   ├── components/                # React components (most are city-agnostic; Madurai-specific live in dashboard/, my-ward/, water-bodies/)
│   ├── lib/
│   │   ├── cities/                # *** Place config registry — add a city by adding a file here ***
│   │   │   ├── chennai.ts         # CityConfig: GCC wards, CMWSSB reservoirs, days-left hero, etc.
│   │   │   ├── madurai.ts         # CityConfig: MMC wards, Vaigai/Mullaperiyar/Sothuparai, allocation hero, urbanSupply
│   │   │   ├── kaveri.ts          # RegionConfig (region, not city) — work-in-progress
│   │   │   └── types.ts           # PlaceConfig union + GroundwaterViewsConfig + UrbanSupplyConfig + heroMode discriminator
│   │   ├── hooks/                 # Per-city promise caches: use-ward-profile, use-my-ward-data, use-ward-representatives
│   │   ├── i18n/                  # ~700 EN/TA translation keys (one file)
│   │   └── utils/                 # Shared utils incl. river-classification (CPCB Best-Use thresholds, used by both cities)
│   └── types/                     # TypeScript definitions
├── neer-vazhvu-api/               # Python API (FastAPI)
│   ├── app/scrapers/              # CMWSSB, NASA POWER, Open-Meteo, OpenCity, WRIS (Madurai), TN Agriculture ARS (Madurai)
│   ├── app/etl/                   # Pipeline orchestrator, constants
│   ├── app/gee/                   # Earth Engine Phase 1 summaries and catchment tooling
│   ├── app/intelligence/          # ARIMAX forecaster, risk scorer, briefing
│   └── app/routers/               # API endpoints
├── public/
│   ├── data/                      # Static JSON: per-city files use a -<cityId> suffix (e.g. madurai-supply-overview.json) except Chennai which keeps legacy unsuffixed paths for back-compat
│   └── geojson/                   # Static spatial: same per-city naming convention (madurai-wards-2022.geojson, madurai-gwr-blocks.geojson, etc.)
├── scripts/                       # One-time + build-time scripts
│   ├── compute-ward-profiles.ts            # Chennai 200-ward profile compute
│   ├── compute-madurai-ward-profiles.ts    # Madurai 100-ward profile compute (mirror, emits not_available markers for layers Madurai doesn't have)
│   ├── fetch-localities-osm.ts             # Chennai OSM neighbourhood points
│   └── fetch-localities-osm-madurai.ts     # Madurai equivalent (51 OSM points + Wikidata SPARQL fallback)
├── supabase/migrations/           # Database schema
└── .github/workflows/             # CI (daily pipeline, keepalive)
```

### Adding a new city

The multi-city architecture is config-driven. To add (say) Coimbatore:

1. Create `src/lib/cities/coimbatore.ts` exporting a `CityConfig`. Pick a `heroMode`:
   - `"days-left"` if the tracked dams ARE the urban supply (Chennai-pattern). Set `defaultConsumptionMld` and `defaultDesalinationMld`.
   - `"allocation"` if the dams are upstream irrigation reservoirs and the city has a published drinking-water allocation (Madurai-pattern). Provide an `urbanSupply` block with `annualAllocationMcft`, `recentDrawMcft`, `wtpCapacityMld`.
   - `"none"` to suppress the hero entirely.
2. Register it in `src/lib/cities/index.ts`.
3. Drop city-specific files into `public/data/coimbatore-*.json` and `public/geojson/coimbatore-*.geojson` matching the existing naming convention.
4. Mirror `compute-ward-profiles.ts` for the new city's ward count + data layers. Emit `_data_status: "not_available"` for sections you don't yet have data for — the UI cards branch on this and render honest "data not yet sourced" disclaimers.
5. The routes at `src/app/[cityId]/...` will pick up the new city automatically once `tryGetPlaceConfig(cityId)` resolves it.

A worked example of all five steps lives in the recent `madurai_onboarding` branch (PR #97).

## Earth Engine Phase 1

If you are working on the satellite summary layer, also read [GEE_PHASE1_METHODS.md](GEE_PHASE1_METHODS.md).

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
- if you change the GEE data model or methodology, update both [README.md](README.md) and [GEE_PHASE1_METHODS.md](GEE_PHASE1_METHODS.md) in the same PR

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
- **i18n validation**: `npm run i18n:check` (verifies Tamil translations exist for all keys)
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

### Cross-city / shared
- **Tamil prose review** - especially `src/app/[cityId]/about/madurai-page-descriptions.tsx` and the Madurai story pages. Native-speaker review wanted.
- **Tamil localization (UI)** - ~700 i18n keys; `npm run i18n:check` enforces parity.
- **Testing** - Unit tests for scrapers, calculator, intelligence modules, and the new `src/lib/utils/river-classification.ts` (CPCB Best-Use classifier shared across all cities).
- **Adding a third city** - see the "Adding a new city" subsection above.

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

# Contributing to Neer Vazhvu

Thanks for your interest in contributing! This project tracks the water systems of Indian cities and aims to make civic data accessible to everyone.

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
│   ├── cities/                    # *** One folder per city: config, About, Origins, rivers, flood, My Ward, pipeline settings ***
│   │   ├── README.md              # What goes in a city folder
│   │   ├── <city>/config.ts       # The city's PlaceConfig
│   │   └── generated/             # Written by `npm run cities:gen`; never edit by hand
│   ├── lib/
│   │   ├── cities/                # The config types (types.ts), lookups and routing; reads src/cities/generated
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

**Follow [docs/cities/ADDING-A-CITY.md](docs/cities/ADDING-A-CITY.md).** It is the whole job, from
research to a live city with a daily refresh, step by step.

The short version: a city is a folder, `src/cities/<id>/`
([what goes in it](src/cities/README.md)), plus its data files and its database rows. Copy the
folder of the most similar city, edit it, and run `npm run cities:gen`; the app's city lists,
loaders and scope row follow from the folder. The type checker and the onboarding contract
(`npm test`) then list what the city is still missing. Data reaches production only through a
data-repository release and the `corpus.lock` pin, and the switch-on goes in the same pull request
as the city.

### Adding or changing a data file

Any `.json` or `.geojson` file under `public/data/` or `public/geojson/` follows NVDM (the Neer
Vazhvu Data Model). In short: the file carries an envelope naming its dataset, its place and its
sources; scripts rewrite it through the writers so the envelope survives; and a CI gate requires a
new file to reach level L2 and an existing conforming file to keep its level.

- What is required: [`schemas/nvdm/RULES.md`](schemas/nvdm/RULES.md).
- How to do it, step by step: [`schemas/nvdm/GUIDE.md`](schemas/nvdm/GUIDE.md).
- Before you push: `bash scripts/nvdm-gate.sh origin/main`
  ([the full list](schemas/nvdm/GUIDE.md#8-before-you-open-a-pull-request)).

### Adding a new district

The District Atlas is the same config-driven architecture for India's districts: a page per district at `/atlas/[state]/[district]`, a page per block (TN) or taluka (MH), and a page per Gram Panchayat, all turning government registers into place pages without inventing anything between them. **Before starting, read `docs/methodology/add-a-district.md`** - the step-by-step walkthrough with Kolar (the most recent district, and the first beyond TN and MH) as the worked example - and `docs/methodology/district-atlas-v1.md` for the as-built methodology. The walkthrough covers the three hard parts: which adapter builds the district (TNRD for Tamil Nadu, the LGD adapter for other states, a much bigger job for a brand-new state), the four reviewed `pipeline-inputs/atlas/<state>/<slug>/` files every district commits, and the rule that a register that cannot be joined becomes a named gap, never a guess (Kolar's withheld polygons and unnamed water-body serials are the patterns to copy).

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
- **Long-form Kannada story review** - `src/cities/bangalore/story-kn.tsx` is a 4-chapter / ~4,000-word translation pending native-speaker review.
- **More rich-body candidates** - 13 onboarded today. Other candidates: Begur, Allalasandra, Doddabommasandra, Yele Mallappa Shetty. Pattern is registry-driven; see [src/lib/water-bodies/rich-body-registry.ts](src/lib/water-bodies/rich-body-registry.ts).

### Cross-city / shared
- **Tamil prose review** - especially `src/app/[cityId]/about/madurai-page-descriptions.tsx` and the Madurai story pages. Native-speaker review wanted.
- **Kannada prose review** - `src/cities/bangalore/about-pages.tsx`, the BangaloreDailyBriefing variants in `src/content/briefing/bangalore.ts`, and the long-form story (`src/cities/bangalore/story-kn.tsx`). Native-speaker review wanted.
- **Localization (UI)** - ~1,500 i18n keys covering EN + TA + KN; `npm run i18n:check` enforces parity.
- **Testing** - Unit tests for scrapers, calculator, intelligence modules, and the shared `src/lib/utils/river-classification.ts` (CPCB Best-Use classifier).
- **Adding a fifth city** - see the "Adding a new city" subsection above.
- **Adding a district** - see the "Adding a new district" subsection above (and `docs/methodology/add-a-district.md`).

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

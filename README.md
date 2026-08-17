# Neer Vazhvu

**Urban Water Intelligence** - An open-source platform that turns public water data into actionable intelligence for Indian cities. Live for Chennai, Madurai, Bengaluru, Mumbai, Delhi, Hyderabad, Kolkata and Gurugram today, with Surat onboarding.

**Live:** [neervazhvu.org](https://neervazhvu.org)

Neer Vazhvu (நீர் வாழ்வு, Tamil for "Water Life") tracks reservoir levels, groundwater health, river water quality, flood risk, sewerage infrastructure, and water body loss across Indian cities. Each city's dashboard reflects what's actually knowable for that city - so Chennai surfaces CMWSSB-fed days-of-water-left + 5-factor ward risk, Madurai surfaces a Vaigai allocation hero + 3-factor ward risk because its dams are irrigation-primary, Bengaluru surfaces a Cauvery-pumping hero (BWSSB lifts treated water 100 km from T.K. Halli, so reservoir storage is not the right runway metric) layered on the IISc 80-ward stress overlay since all 6 Bangalore Urban CGWB blocks are over-exploited, and Mumbai - the first *region* place, modelled as the full Metropolitan Region's 9 corporations - surfaces a days-of-water-left hero over BMC's 7 lakes (explicitly labelled an upper bound) alongside a Metropolitan Water System view of the region's 3.6x per-capita inequality, and Delhi - which owns no reservoir at all - surfaces the five-state supply chain it depends on (1994 Yamuna MoU, the 102-km Munak carrier, Bhakra 240 km away) against the CAG's audited finding that half the water earns no revenue, because no authority publishes a daily storage figure for any Delhi source. Kolkata goes further still: it impounds nothing at all, so instead of a runway it surfaces **Drains vs the Sky** - KMC's own published promise that the sewers were "designed to discharge a rainfall of 6 mm. per hour", measured against 26 years of hourly rainfall that now beats it 44.5 hours a year against 19.2 two decades ago - beside the fact that 910 of the city's 1,400 MLD of sewage is treated not by any plant but by 12,500 hectares of fish ponds lying outside the corporation's own boundary.

## What we track (city-agnostic)

Every city dashboard, where the data exists, surfaces:

- **Reservoirs** - Daily storage / inflow / outflow with multi-source history chart and (Chennai-only today) 30-day AutoARIMA forecasts
- **Groundwater** - CGWB block exploitation classification, station-level depth time-series, and (where well density supports it) ward-level depth interpolation
- **Rivers** - CPCB NWMP DO/BOD time-series with status badges derived from current readings via the shared CPCB Designated Best-Use classifier
- **Water bodies** - OSM polygons, lost-tank inventory, restoration priority scoring (algorithm varies per city)
- **Rich-data deep-zoom panel** - 21 flagship bodies onboarded (8 in Chennai + 13 in Bangalore). A click opens a full-screen panel with yearly satellite imagery 1984-present, cumulative water-loss and built-gain tints over the polygon and 1 km halo, per-year stats (water surface, built share, building counts in body vs halo), a play/pause timeline with event stamps, and a sources & methodology modal. Water-fraction series splices JRC GSW v1.4 (1984-2021) with Dynamic World V1 (2022-present) so the chart doesn't truncate at JRC's cutoff
- **Flood risk** - Hazard zones / drainage / sewerage where layers are public; narrative-only stub where they're not
- **Shoreline change** (`/shoreline`, Chennai + Mumbai today) - Erosion/accretion along the Chennai coast, Mahabalipuram to Pulicat. The primary layer is our own MNDWI/DSAS satellite measurement (Landsat 5/7/8 + Sentinel-2 via Earth Engine, ~1,200 transects, **1990-2026** - extending past the study's 2024 cutoff), with a per-transect movement-over-time chart, an early-vs-recent acceleration check (≈72% of the eroding coast is eroding faster than before), and a per-transect confidence flag. The six study zones + named port hotspots from Anagha, Singh & Frappart (2026, *Environmental Challenges*) are drawn as faint context that validates the measurement
- **My Ward** - Per-ward report aggregating every layer above with comparison + uplift planner (Chennai, Madurai, Bengaluru, Delhi; deliberately withheld for Mumbai until the ward build lands, and for Kolkata because the only public ward geometry covers 141 of 144 wards - the three missing ones are 9.2% of the city)
- **Allocation Ledger** (`/[cityId]/allocations`, all 4 cities) - Who is owed what water: every arrangement (source → authority → recipient) with entitled vs received, the legal/administrative instrument it rests on, and a confidence grade - including the honest "unreported" class for quotas whose deliveries nobody publishes
- **Commitments Register** (`/[cityId]/commitments`, all 4 cities) - 52 dated commitments by named institutions (commissioning dates, court deadlines, mitigation claims) checked against time; statuses change only with a dated citation and history appends, never overwrites
- **Rainfall** - IMD gridded history + normals (quarterly-refreshed backbone) plus a daily provisional layer (Open-Meteo archive fill) so monsoon bursts appear as they happen, asterisked until IMD's authoritative series supersedes them
- **About** - Per-city methodology, data-source index, transparency-gap inventory
- **Tanker market** (Bengaluru only today) - Longitudinal OpenCity household-survey data (2015 / 2019 / 2024) on what households actually pay vs BWSSB's official tariff
- **IISc 80-ward stress overlay** (Bengaluru only today) - 80 critically-over-extracted BBMP wards from the April 2025 IISc Groundwater Outlook layered as a choropleth on /bangalore

Per-city deep-dives:

- [docs/cities/chennai/features.md](docs/cities/chennai/features.md) - Chennai feature inventory + risk-score, ward-report-card, uplift-planner, and restoration-priority methodologies
- [docs/cities/madurai/features.md](docs/cities/madurai/features.md) - Madurai-specific surfaces (allocation hero, supply-overview tile, transparency-gap panel, missing-data card) and how Madurai differs from Chennai
- [docs/cities/bangalore/features.md](docs/cities/bangalore/features.md) - Bengaluru-specific surfaces (cauvery-pumping hero, daily briefing, IISc stress overlay, tanker market, 13 rich-body lakes) and Kannada localization
- [docs/cities/surat/features.md](docs/cities/surat/features.md) - Surat-specific surfaces (flood-headroom hero, the live khadi chain against published danger levels, the reuse commitments) and why it has no ward surfaces
- [docs/cities/mumbai/features.md](docs/cities/mumbai/features.md) - Mumbai/MMR-specific surfaces (region model + scope badges, upper-bound days-left hero, Metropolitan Water System, WRD flood lines, Pravah/CWC reservoir feeds) and what is deliberately absent at launch
- City-specific long-form water stories: [`/origins`](https://neervazhvu.org/origins) (Chennai), [`/madurai/origins`](https://neervazhvu.org/madurai/origins), [`/bangalore/origins`](https://neervazhvu.org/bangalore/origins) (EN + KN), [`/mumbai/origins`](https://neervazhvu.org/mumbai/origins)

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                  Python FastAPI Service (Railway)                  │
│                                                                    │
│  Scrapers (per-city)     ETL              Intelligence             │
│  ├─ cmwssb.py            ├─ pipeline.py   ├─ forecaster (ARIMAX)   │
│  ├─ open_meteo.py        ├─ estimate.py   ├─ risk_scorer (200 wd)  │
│  ├─ nasa_power.py        └─ constants     └─ briefing + AI         │
│  ├─ opencity.py                                                    │
│  ├─ wris_telemetry.py    (Madurai: WRIS district scrape)           │
│  ├─ tn_pwd_reservoirs.py (Madurai: TN Agriculture ARS daily)       │
│  └─ openmeteo_basin_rainfall.py                                    │
│                                                                    │
│  Mumbai feeds run as GitHub Actions (artifact-commit), not in the  │
│  API runtime: scrape_pravah_dams.py (WRD daily), backfill_cwc_     │
│  reservoirs.py (2015-25 one-off), fetch_recent_rainfall.py (daily  │
│  provisional rainfall, all cities), scrape_bmc_flood_spots.py      │
│                                                                    │
│  Writes computed results to Supabase ────┐                         │
└──────────────────────────────────────────┘                         │
                                                                     │
┌──────────────────────────────────────────┐                         │
│       Next.js Frontend (Vercel)          │<────────────────────────┘
│  Reads from Supabase + renders UI        │
│                                          │
│  Multi-city routing:                     │
│  • / (Chennai legacy flat routes)         │
│  • /[cityId]/* (Madurai, Bangalore,      │
│    future cities)                         │
│  • src/lib/cities/{chennai,madurai,      │
│    bangalore,mumbai}.ts drives heroMode, │
│    water sources, ward count,            │
│    allocation config, placeKind          │
│    ('city' | 'region' - Mumbai is the    │
│    MMR: 9 corporations)                  │
│                                          │
│  Static GeoJSON + JSON served from       │
│  /public (per-city -<cityId> suffix)     │
└──────────────────────────────────────────┘
```

**Place-config-driven multi-city.** Adding a city = adding a `CityConfig` in `src/lib/cities/`. The routes at `src/app/[cityId]/...` resolve it via `tryGetPlaceConfig(cityId)`. `heroMode` (`days-left` | `allocation` | `cauvery-pumping` | `none`) picks the dashboard hero variant. Per-city water sources, ward counts, `urbanSupply` allocation context, capability flags (`hasCommitments`, `hasAllocationLedger`, `hasShoreline`, ...), language state (`availableLanguages` + `upcomingLanguages` for greyed coming-soon toggles), and region structure (`placeKind: 'region'` + `corporations[]` for the MMR) all flow from the same config. See [CONTRIBUTING.md](CONTRIBUTING.md#adding-a-new-city) for the full walkthrough.

Earth Engine Phase 1 jobs live under `neer-vazhvu-api/app/gee/` and write small summary tables into Supabase instead of serving raster layers directly to the frontend.

## Data Sources

We integrate 50+ distinct sources across the cities we cover - from utility-published reservoir feeds (CMWSSB for Chennai, TN Agriculture ARS for Madurai, KSNDMC + Karnataka WRD for Bengaluru, Maharashtra WRD's Pravah bulletin + CWC weekly bulletins for Mumbai), to CGWB groundwater telemetry, to CPCB/MPCB river quality, to IISc research outputs (Bengaluru stress wards), to OpenCity household-survey panels (Bengaluru tanker market), to Praja Foundation RTI tables (Mumbai ward equity), to legal/administrative instruments (WRD GRs, board minutes, NGT and High Court records backing the Allocation Ledger and Commitments Register), to OSM/Wikidata for spatial geometry, to apex-audit and legislature documents (the CAG's DJB performance audit and the Delhi Economic Survey behind Delhi's dashboard, with DPCC's monthly Yamuna + drain analysis - the highest-cadence public river feed we carry anywhere), to WBPCB's EMIS portal for Kolkata (41 stations and 3,209 samples from 2010-2026 - the deepest river series on the platform, and the only one sampling each point separately at high and low tide), and to ADB-disclosed safeguard documents (the KMC-SHARP semi-annual monitoring reports that give Kolkata's Commitments Register named contractors, contractual completion dates and a percentage-progress figure). The full breakdown lives in per-city documents:

- [docs/cities/chennai/data-sources.md](docs/cities/chennai/data-sources.md)
- [docs/cities/madurai/data-sources.md](docs/cities/madurai/data-sources.md)
- [docs/cities/bangalore/data-sources.md](docs/cities/bangalore/data-sources.md)
- [docs/cities/mumbai/data-sources.md](docs/cities/mumbai/data-sources.md)
- [docs/cities/delhi/data-sources.md](docs/cities/delhi/data-sources.md)
- [docs/cities/kolkata/data-sources.md](docs/cities/kolkata/data-sources.md)
- [DATA_SOURCES.md](DATA_SOURCES.md) - top-level index with a cross-city parity matrix (the contributor cheat-sheet for what each city has covered)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| Charts | Recharts |
| Maps | Leaflet + react-leaflet — GCC ward boundaries, flood hazard zones, storm water drains, sewerage network, water body polygons, river polylines (GeoJSON) |
| Backend API | Python 3.11+, FastAPI, statsforecast, pandas |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel (frontend), Railway (Python API) |
| CI/CD | GitHub Actions (daily data pipeline) |
| AI Narratives | Anthropic Claude API (Sonnet 4 for city, Haiku 4.5 for ward narratives) |

## Earth Engine Phase 1

Earth Engine is used as a summary layer (catchment rainfall context, water-body NDWI seasonality) and as the build-time source for the rich-data deep-zoom panel's yearly chips and zonal stats — not a raster explorer. Methodology, guardrails, and operations live in dedicated docs:

- [GEE_PHASE2_3_PLAN.md](GEE_PHASE2_3_PLAN.md), [GEE_PHASE2_CHECKLIST.md](GEE_PHASE2_CHECKLIST.md)
- Shipped-method write-ups: [docs/methodology/catchment-atlas-v1.md](docs/methodology/catchment-atlas-v1.md), [docs/methodology/coastal-shoreline-change-v1.md](docs/methodology/coastal-shoreline-change-v1.md), [docs/methodology/cascade-reconstruction-v1.md](docs/methodology/cascade-reconstruction-v1.md)
- (The phase-1 planning documents were retired to local archives once the work shipped; the methodology folder is the maintained record.)

## Rich-Data Deep-Zoom Panel

21 flagship bodies have a dedicated deep-zoom experience layered on top of the standard `/water-bodies` map. Onboarded bodies today: 8 in Chennai (Pallikaranai Marsh, Sholavaram, Red Hills/Puzhal, Chembarambakkam, Porur, Velachery, Perumbakkam, Chitlapakkam) + 13 in Bengaluru (Bellandur, Varthur, Hesaraghatta, Hebbal, Ulsoor, Sankey, Madivala, Agara, Jakkur, Rachenahalli, Iblur, Kempambudhi, Puttenahalli, Yelahanka).

For each body the build-time pipeline produces:

- A primary polygon (Tamil Nadu State Wetland Authority gazetted boundary for Pallikaranai; OpenStreetMap relation/way for the others) and a 1 km buffer halo
- ~37 yearly satellite chips (Landsat 5/7/8 1984-2018, Sentinel-2 SR Harmonized 2019-present) via Google Earth Engine
- Cumulative water-loss and built-gain tint PNGs reflecting two-window methodology: water lost = pixels that were water in ≥3 of [1988-92] AND not water in ≥3 of [2017-21]; built gain = pixels built in ≥2 of [2023-25] but not in ≥2 of [2016-18]
- Zonal water trend per year spliced from JRC GSW v1.4 (1984-2021) + Dynamic World V1 (2022-present) so the chart doesn't truncate at JRC's cutoff; built fraction % (Dynamic World); building counts (Overture Maps; falls back to Open Buildings v3 if Overture is missing)
- Per-body timeline events and status badges driven from the registry at [src/lib/water-bodies/rich-body-registry.ts](src/lib/water-bodies/rich-body-registry.ts)

Overture building counts refresh monthly via [.github/workflows/overture-buildings-refresh.yml](.github/workflows/overture-buildings-refresh.yml), which queries Overture's quarterly parquet release through DuckDB and opens a candidate-data PR when month-over-month change exceeds a tunable threshold.

To onboard a new body, see [docs/cities/chennai/features.md](docs/cities/chennai/features.md#rich-data-deep-zoom-panel) for the registry pattern and `scripts/fetch-rich-body-polygon.ts`, `scripts/_rich_body_zones.py`, `scripts/verify_rich_body_*.py`, `scripts/ingest_rich_body_imagery.py`, and `scripts/ingest_rich_body_{water_loss,built_gain}_tint.py` for the pipeline scripts.

## Lake Catchment Atlas

The "Catchments" view mode on `/[city]/water-bodies` makes every lake clickable to show its **area of influence**: the catchment that drains into it, the feeder streams, the upstream/downstream tanks, the downstream flow path to the river, and a rooftop rainwater-harvest estimate. Live for Chennai, Madurai, and Bengaluru; quality bar is the Hyderabad Lake Atlas.

Catchments are delineated from a 30 m bare-earth DEM (FABDEM) with WhiteboxTools hydrology - a threshold-free own / received / total contributing-area model, plus a per-lake downstream flow path traced through the cascade to the river. Lake names are backfilled from authoritative open sources where OSM is sparse (Bengaluru: the ATREE/CSEI named-lake census on OpenCity), and the downstream river is named by snapping the flow path to the mapped river network. Full methodology: [docs/methodology/catchment-atlas-v1.md](docs/methodology/catchment-atlas-v1.md).

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+ (3.12 recommended; used in CI)
- [pyenv](https://github.com/pyenv/pyenv) (recommended)
- A [Supabase](https://supabase.com/) project (free tier works)

### 1. Clone the repo

```bash
git clone https://github.com/SundareshPrasanna/neer-vazhvu.git
cd neer-vazhvu
```

### 2. Frontend Setup

```bash
npm install
```

Create `.env.local` for the frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-secret
ANTHROPIC_API_KEY=your-anthropic-key  # Required for AI narrative generation only
```

Run in demo mode (no Supabase required):

```bash
npm run dev
# Open http://localhost:3000
```

The app automatically falls back to demo mode with realistic mock data when Supabase isn't configured.

### 3. Database Setup

Run all migrations against your Supabase project:

```sql
-- In the Supabase SQL Editor, run in order:
-- 1. supabase/migrations/001_initial_schema.sql
-- 2. supabase/migrations/002_intelligence_tables.sql
-- 3. supabase/migrations/003_open_meteo_weather.sql
-- 4. supabase/migrations/004_water_bodies_census.sql
-- 5. supabase/migrations/005_water_bodies_census_table.sql
-- 6. supabase/migrations/006_ward_narratives.sql
-- 7. supabase/migrations/007_security_hardening.sql
-- 8. supabase/migrations/008_news_articles.sql
-- 9. supabase/migrations/009_deduplicate_news.sql
-- 10. supabase/migrations/010_gee_phase1.sql
-- 11. supabase/migrations/011_gee_satellite_evidence.sql (legacy; superseded by 023)
-- ... (later migrations live in supabase/migrations/)
-- N. supabase/migrations/023_drop_satellite_evidence.sql (drops the table + Storage bucket from #011)
```

Or if using the Supabase CLI:

```bash
supabase db push
```

### 4. Python Intelligence Service

```bash
cd neer-vazhvu-api

# Create a dedicated virtual environment
pyenv virtualenv 3.12.2 neer-vazhvu-api
pyenv local neer-vazhvu-api

# Install dependencies
pip install -e ".[dev]"
```

Create `.env` in the `neer-vazhvu-api/` directory:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
CRON_SECRET=your-secret
GEE_CLOUD_PROJECT=your-earth-engine-enabled-project-id
GEE_SERVICE_ACCOUNT_FILE=/absolute/path/to/service-account.json
# Alternative for CI:
# GEE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

Run the API locally:

```bash
uvicorn app.main:app --reload --port 8000
# API docs at http://localhost:8000/docs
```

### 5. Google Earth Engine Setup

Phase 1 GEE commands expect:

- an Earth Engine-enabled Google Cloud project
- a service account with `Earth Engine Resource Writer` and `Service Usage Consumer`
- the `GEE_CLOUD_PROJECT` and service-account env vars shown above

Smoke test:

```bash
python scripts/run_gee_phase1.py check-auth
```

Useful Phase 1 commands:

```bash
python scripts/run_gee_phase1.py build-targets --write
python scripts/run_gee_phase1.py validate-catchments
python scripts/run_gee_phase1.py run-reservoir-context --write
python scripts/run_gee_phase1.py run-water-body-summaries --write
```

Current workflow note:

- `.github/workflows/gee-phase1.yml` supports manual dispatch for `check-auth`, `build-targets`, `validate-catchments`, `run-reservoir-context`, `run-water-body-summaries`, and `run-all-refresh`
- if you need the live app data refreshed today, run the CLI locally or trigger that workflow manually

### 6. Seed Historical Data

```bash
# From the repo root
npx tsx scripts/seed-kaggle.ts                 # Reservoir history
npx tsx scripts/seed-opencity-groundwater.ts   # Groundwater history
npx tsx scripts/seed-opencity-lakes.ts         # Optional lake-level history
```

### 7. Refresh Static GeoJSON Data (optional)

The water body, river, and industrial zone GeoJSON files are pre-generated and committed. Re-fetch from OpenStreetMap if you want the latest OSM edits:

```bash
# Current water bodies (lakes, tanks, reservoirs, ponds)
npx tsx scripts/fetch-water-bodies-osm.ts

# River polylines (Cooum, Adyar, Buckingham Canal, Kosasthalaiyar)
npx tsx scripts/fetch-rivers-osm.ts

# Industrial zone polygons (north Chennai bbox)
npx tsx scripts/fetch-industrial-zones-osm.ts

# Drainage network from OSM (supplementary)
npx tsx scripts/fetch-drainage-osm.ts

# CMWSSB sewerage network (STPs, pumping stations, pumping mains)
python3 scripts/convert-sewerage-kml.py

# Coastal zones + port hotspots seed (OSM coastline + published study rates)
python3 scripts/build-chennai-coastal-seed.py
```

Flood hazard zones and GCC storm water drain data are converted from OpenCity KML files via `scripts/simplify-flood-geojson.ts`. CMWSSB sewerage data is converted via `python3 scripts/convert-sewerage-kml.py`. The `/shoreline` transect layer (our own MNDWI/DSAS shoreline-change measurement) is regenerated with `python neer-vazhvu-api/scripts/run_gee_coastline.py build-geojson --write` (needs Earth Engine auth; ~12-15 min). It also refreshes **automatically once a year** (mid-June, after the dry season closes) via `.github/workflows/coastal-shoreline-refresh.yml`, which opens a PR with the new epoch for review - the pipeline auto-appends the latest year, so no code edit is needed. Full method, validation, and operational cadence: [docs/methodology/coastal-shoreline-change-v1.md](docs/methodology/coastal-shoreline-change-v1.md) (publication-style write-up); internal notes in [docs/research/chennai-coast-paper/METHODS.md](docs/research/chennai-coast-paper/METHODS.md).

### 7. Refresh River Quality Data (optional, annual)

`public/data/river-quality.json` is manually curated from CPCB annual reports. When a new report is published:

1. Update the `readings` arrays with the new year's DO/BOD values
2. Update `last_updated` (e.g. `"2026-01"`) and `data_year_range`
3. Commit: `data: update river quality readings to 2025`

## API Endpoints

### Pipeline (protected -requires `Authorization: Bearer <CRON_SECRET>`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/pipeline/run-daily` | Full pipeline in API runtime: scrape → ETL → forecast → briefing |
| POST | `/pipeline/run-post-scrape` | Pipeline without scrape (used by GitHub Actions after external CMWSSB scrape) |
| POST | `/pipeline/run-monthly` | Groundwater fetch + risk scoring |
| POST | `/pipeline/run-intelligence` | Forecast + risk + briefing only (backfills) |

### Intelligence (public read)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/intelligence/forecast?reservoir=all&horizon=30` | Reservoir storage forecasts |
| GET | `/intelligence/risk-scores?date=latest` | Ward-level risk scores |
| GET | `/intelligence/briefing?date=latest` | Daily intelligence briefing |
| GET | `/health` | Service health + last pipeline status |

## Project Structure

```
neer-vazhvu/
├── src/                # Next.js frontend (App Router)
│   ├── app/            # / (Chennai legacy flat routes), /[cityId]/* (Madurai, Bangalore, future cities)
│   ├── components/     # City-agnostic where possible; per-city forks live in dashboard/, my-ward/, water-bodies/
│   ├── lib/cities/     # Place-config registry (chennai.ts, madurai.ts, bangalore.ts, mumbai.ts, types.ts)
│   ├── lib/i18n/       # ~1,500 EN/TA/KN translation keys (MR declared as upcoming)
│   └── lib/utils/      # Shared utilities incl. river-classification.ts (CPCB Best-Use)
├── neer-vazhvu-api/    # Python FastAPI service: scrapers, ETL, intelligence, GEE
├── public/
│   ├── data/           # Per-city JSON, -<cityId> suffix (Chennai is unsuffixed for back-compat)
│   └── geojson/        # Per-city spatial files, same naming convention
├── scripts/            # Build-time spatial joins, OSM fetchers, validation, narrative generation
├── docs/
│   ├── cities/         # Per-city documentation (features, data sources)
│   │   ├── chennai/
│   │   ├── madurai/
│   │   ├── bangalore/
│   │   └── mumbai/
│   └── research/       # Authoritative source PDFs (CGWB, ADB IEE, IISc Outlook)
└── supabase/migrations/ # SQL schema
```

For the full per-city file inventory, see [docs/cities/chennai/data-sources.md](docs/cities/chennai/data-sources.md), [docs/cities/madurai/data-sources.md](docs/cities/madurai/data-sources.md), [docs/cities/bangalore/data-sources.md](docs/cities/bangalore/data-sources.md), [docs/cities/mumbai/data-sources.md](docs/cities/mumbai/data-sources.md), [docs/cities/delhi/data-sources.md](docs/cities/delhi/data-sources.md), and [docs/cities/kolkata/data-sources.md](docs/cities/kolkata/data-sources.md).

## Limitations

- This is an independent, educational project -not an official government tool.
- Estimates are approximations. Actual water availability depends on factors not modeled (Krishna water transfer, distribution losses, industrial use).
- CMWSSB data may occasionally be stale (weekends, holidays, or when their site blocks datacenter IPs). The pipeline gracefully continues with existing data for up to 4 days.
- Groundwater data from OpenCity may lag by months.
- Forecasts use AutoARIMA which works best with 90+ days of history.
- Lost water body coordinates and historical areas are approximate, sourced from academic and civic studies.
- Restoration priority scores use spatial proximity as a proxy; they do not account for population density, land ownership, or restoration cost -factors that require non-public data.
- Mumbai's days-of-water-left is an upper bound (storage counts full live water in state-owned dams, part of which serves users beyond BMC) and the card says so. Vihar + Tulsi (~3% of capacity) have no public feed. Rain scenarios are not computed for Mumbai because the Pravah feed publishes no inflow data.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

Areas where help is needed:

- **Data quality** -Improving scraper resilience, handling CMWSSB / BWSSB / TN Agriculture page format changes
- **Models** -Better forecasting (Prophet, LSTM), improved evaporation integration
- **Water bodies data** -Adding more documented lost water bodies with verified coordinates and sources
- **Localization** -Translating the UI for local accessibility. Today: ~1,500 keys covering EN + TA (Chennai/Madurai) + KN (Bangalore). **Marathi (Mumbai) is the biggest open item** - declared as coming-soon in the UI, 0 of ~1,509 keys translated. Native-speaker review wanted for TA prose review and KN long-form story (`src/content/story-bangalore-kn.tsx`)
- **Testing** -Unit tests for scrapers, calculator, and intelligence modules

Please open an issue first to discuss significant changes.

## Corpus build source

Local development uses the corpus committed under `public/data/` and
`public/geojson/` by default. Full-corpus CI and hosted deployments can instead
set `CORPUS_SOURCE=remote` and provide a `CORPUS_REPO_TOKEN` with read-only
Contents access to `neer-vazhvu-data`. The build then fetches the exact commit
and file counts recorded in [`corpus.lock`](corpus.lock), and fails rather than
falling back to partial data. Preview and Production variables are configured
separately; promote the remote mode to Production only after its Preview build
and rollback checks pass. The token is removed from the environment before the
Next.js compiler runs.

## License

[MIT](LICENSE) - for the **code**.

The **data corpus** under `public/data/` and `public/geojson/` is not
MIT-licensed. It aggregates many upstream publishers, and each publisher's own
terms govern. **[`DATA-LICENSE.md`](DATA-LICENSE.md) is the data-specific
notice**: it states the code/data separation, lists the notable restricted
inputs, and carries the mandatory upstream attributions (HydroSHEDS Exhibit B,
Copernicus WorldDEM-30, OpenStreetMap, JRC, USGS, GODL-India and others).

The authoritative per-artifact record is the artifact's NVDM envelope
(`provenance.sources[].license`, see [`schemas/nvdm/`](schemas/nvdm/)) together
with the Headwaters source registries
([`scripts/source-registry/`](scripts/source-registry/)). Consult the envelope
before reuse: some upstream sources are non-commercial, some are ShareAlike, and
some require the publisher's permission.
`python3 scripts/nvdm-encumbrance-report.py` prints the per-artifact position,
and [`scripts/sample-corpus.json`](scripts/sample-corpus.json) defines the
reduced licence-clean reference set used by the no-secrets CI job.

## Acknowledgments

- **CMWSSB** for publishing daily reservoir data publicly and for sewerage infrastructure data (STPs, pumping stations, pumping mains)
- **[Open-Meteo](https://open-meteo.com/)** for free, zero-lag weather data with evapotranspiration
- **NASA POWER** for free, open weather data (fallback source)
- **OpenCity Chennai** for ward-level groundwater datasets
- **[data.gov.in](https://data.gov.in/)** / **Ministry of Jal Shakti** for the First Census of Water Bodies (2018-19)
- **GCC** for ward boundary delimitation data and storm water drain survey data (10,308 drain segments)
- **OpenStreetMap contributors** for water body polygon and river geometry data
- **Care Earth Trust** for comprehensive water body surveys and documentation
- **Tamil Nadu State Wetland Authority (TNSWA)** for the gazetted Pallikaranai Ramsar Site #2481 boundary used in the rich-data deep-zoom panel
- **European Commission Joint Research Centre (JRC)** for the Global Surface Water v1.4 dataset (1984-2021 annual water occurrence)
- **Google Dynamic World V1** for near-real-time land-cover classification (2016-present)
- **Google Open Buildings v3** and **Overture Maps Foundation** for building footprints used in halo/body building counts
- **NASA / USGS Landsat 5/7/8** and **ESA / Copernicus Sentinel-2** for the multi-decadal yearly imagery in the deep-zoom panel
- **IIT Madras** and the **National Green Tribunal** for research and legal records on water body encroachments and industrial pollution
- **[CPCB National Water Monitoring Programme (NWMP)](https://cpcb.nic.in/nwmp-data-2024/)** for annual river water quality monitoring data
- **[Chennai Rivers Restoration Trust (CRRT)](https://www.crrt.tn.gov.in/)** for restoration project data across Chennai's rivers
- **Nethaji Mariappan et al.** for sewage inlet survey data along the Cooum river (Nature Environment and Pollution Technology, 2017)
- **IMD (Indian Meteorological Department)** for historical gridded rainfall data (via imdlib)
- **CGWB / India WRIS** for block-level groundwater exploitation data and monitoring station locations
- **TNPCB** and **KSPCB** for enforcement records and industrial consent data used in the pollution sources overlays
- **Carbon Copy** and **The Wire** for investigative reporting on the Ennore-Manali industrial corridor
- **Indian Institute of Science (IISc)** for the Groundwater Outlook for Bengaluru (April 2025) - 80 critically-over-extracted BBMP wards used as the headline stress layer on `/bangalore`
- **OpenCity Bengaluru** for longitudinal household water-tariff surveys (2015 / 2019 / 2024) powering the `/bangalore/tanker` market view
- **BWSSB** for Cauvery pumping disclosures used in the cauvery-pumping hero
- **Maharashtra Water Resources Department** for the daily Pravah dam-safety bulletin (Mumbai's live reservoir feed) and the red/blue flood-line map sheets
- **Central Water Commission (CWC)** for the weekly Reservoir Storage Bulletins that provide Mumbai's 2015-2025 reservoir history
- **Praja Foundation** for RTI-sourced ward-level water data (connections, supply hours, quality samples) in its Status of Civic Issues reports
- **BMC / MCGM** for the Environment Status Report, Climate Budget and Hydraulic Engineer RTI manuals mined for Mumbai's supply structure
- **MPCB** for the annual Water Quality Status reports behind the Mithi/Ulhas river series
- **DataMeet** for Mumbai's 24-ward boundary geometry
- **Wikimedia Commons contributors** (Alexey Komarov, Planemad, Sailee5, Rakesh) for the licensed images in Mumbai's Origins story
- **[Anthropic](https://www.anthropic.com/)** for Claude API powering city and ward AI narratives
- Chennai's, Madurai's, Bengaluru's, and Mumbai's civic data communities for making public data accessible

# Neer Vazhvu

**Chennai Water Intelligence Dashboard** — An open-source platform that turns public water data into actionable intelligence for Chennai's 11 million residents.

Neer Vazhvu (நீர் வாழ்வு, Tamil for "Water Life") tracks reservoir levels, groundwater health, and water body loss across Chennai. It goes beyond simple dashboards by providing **30-day reservoir forecasts**, **ward-level risk scoring**, **daily intelligence briefings**, and an **interactive lost water bodies map**.

## Features

### Dashboard
- **Days of Water Left** — Three-scenario estimate (pessimistic / current trend / seasonal rains)
- **Reservoir Cards** — Live storage, inflow, outflow, and rainfall for all 6 reservoirs
- **Per-Reservoir Drilldown** — Click any reservoir for 365-day charts (storage, inflow vs outflow, rainfall)
- **Historical Comparison** — Overlay any year from 2019–2025 on the storage trend chart
- **Storage Trend Chart** — 90-day combined storage with interactive year comparison

### Groundwater Map
- **Choropleth Map** — Depth to water table across all 200 GCC wards
- **Ward Detail Panel** — Click any ward for depth, status, and year-over-year trend
- **Zone-level Aggregation** — Color-coded by CGWB classification (Healthy → Crisis)

### Water Bodies Map
- **1,635 Existing Water Bodies** — All current lakes, tanks, ponds, and reservoirs from OpenStreetMap
- **15 Documented Lost / Encroached Water Bodies** — Curated from Care Earth Trust, NGT records, and IIT Madras research
- **Toggle Layers** — Show/hide current and lost water bodies independently
- **Status-coded Circles** — Fully lost (red), severely reduced (orange), partially encroached (yellow)
- **Detail Panel** — Click any water body for historical area, surviving area, what replaced it, and source citations
- **Area Loss Bar** — Visual indicator of how much of each water body survives

### Intelligence Layer (Python Service)
- **Reservoir Forecasting** — 30-day storage predictions using AutoARIMA with confidence intervals
- **Ward Risk Scoring** — Composite 0–100 risk score per ward (groundwater depth, trend, reservoir stress, seasonal vulnerability)
- **Daily Briefing** — Template-based intelligence summary with headlines, alerts, and recommendations

### Other
- **Dark Mode** — Full dark mode with system preference detection
- **Responsive** — Works on desktop, tablet, and mobile
- **Demo Mode** — Runs with realistic mock data when Supabase isn't configured

## Architecture

```
┌──────────────────────────────────────────────────┐
│        Python FastAPI Service (Railway)           │
│                                                  │
│  Scrapers         ETL            Intelligence     │
│  ├─ cmwssb.py     ├─ pipeline.py ├─ forecaster   │
│  ├─ nasa_power.py ├─ estimate.py ├─ risk_scorer  │
│  └─ opencity.py   └─ seed.py     └─ briefing     │
│                                                  │
│  Writes computed results to Supabase ────┐       │
└──────────────────────────────────────────┘       │
                                                   │
┌──────────────────────────────────────────┐       │
│       Next.js Frontend (Vercel)          │◄──────┘
│  Reads from Supabase + renders UI        │
│  Static GeoJSON served from /public      │
└──────────────────────────────────────────┘
```

## Data Sources

| Source | Data | Frequency |
|--------|------|-----------|
| [CMWSSB Lake Level Page](https://cmwssb.tn.gov.in/lake-level) | Reservoir levels, inflow, outflow, rainfall | Daily |
| [NASA POWER](https://power.larc.nasa.gov/) | Precipitation, temperature, humidity | Daily (2-day lag) |
| [OpenCity Chennai](https://data.opencity.in/) | Ward-wise groundwater levels (200 wards) | Monthly |
| [Kaggle Chennai Water Management](https://www.kaggle.com/datasets/sudalairajkumar/chennai-water-management) | 15 years of historical reservoir data (2004–2019) | One-time seed |
| [OpenStreetMap Overpass API](https://overpass-api.de/) | Current water body polygons (lakes, tanks, reservoirs) | One-time fetch (script: `scripts/fetch-water-bodies-osm.ts`) |
| Care Earth Trust / NGT / IIT Madras | Documented lost and encroached water bodies | Curated dataset |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| Charts | Recharts |
| Maps | Leaflet + react-leaflet — GCC ward boundaries (GeoJSON) + OSM water body polygons + curated lost bodies (GeoJSON) |
| Backend API | Python 3.12, FastAPI, statsforecast, pandas |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel (frontend), Railway (Python API) |
| CI/CD | GitHub Actions (daily data pipeline) |

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
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
```

Run in demo mode (no Supabase required):

```bash
npm run dev
# Open http://localhost:3000
```

The app automatically falls back to demo mode with realistic mock data when Supabase isn't configured.

### 3. Database Setup

Run both migrations against your Supabase project:

```sql
-- In the Supabase SQL Editor, run in order:
-- 1. supabase/migrations/001_initial_schema.sql
-- 2. supabase/migrations/002_intelligence_tables.sql
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
```

Run the API locally:

```bash
uvicorn app.main:app --reload --port 8000
# API docs at http://localhost:8000/docs
```

### 5. Seed Historical Data

```bash
# From the neer-vazhvu-api directory
python -m scripts.seed_kaggle      # 15 years of reservoir data
python -m scripts.seed_opencity    # Groundwater data (2021-2024)
```

### 6. Refresh Water Body Data (optional)

The current water bodies GeoJSON (`public/geojson/chennai-water-bodies-current.geojson`) is pre-generated and committed. To re-fetch from OpenStreetMap:

```bash
npx tsx scripts/fetch-water-bodies-osm.ts
```

This queries the Overpass API for all water bodies within the Chennai bounding box and saves 1,600+ polygon features to `public/geojson/`.

## API Endpoints

### Pipeline (protected — requires `Authorization: Bearer <CRON_SECRET>`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/pipeline/run-daily` | Full pipeline: scrape → ETL → forecast → briefing |
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
├── scripts/                      # One-time data scripts
│   └── fetch-water-bodies-osm.ts # Fetch current water bodies from Overpass API
├── src/                          # Next.js frontend
│   ├── app/                      # App Router pages
│   │   ├── page.tsx              # Main dashboard
│   │   ├── groundwater/          # Groundwater map page
│   │   ├── water-bodies/         # Water bodies map page
│   │   └── about/                # About/methodology page
│   ├── components/
│   │   ├── dashboard/            # Dashboard components
│   │   ├── groundwater/          # Map, legend, ward panel
│   │   ├── water-bodies/         # Map, legend, detail panel
│   │   ├── layout/               # Header, footer
│   │   └── ui/                   # shadcn/ui primitives
│   ├── lib/
│   │   ├── scrapers/             # TypeScript scrapers (legacy)
│   │   ├── calculator/           # Days-left calculator
│   │   └── mock-data.ts          # Demo mode data
│   └── types/                    # TypeScript type definitions
├── neer-vazhvu-api/              # Python intelligence service
│   ├── app/
│   │   ├── scrapers/             # CMWSSB, NASA POWER, OpenCity
│   │   ├── etl/                  # Pipeline orchestrator, calculator
│   │   ├── intelligence/         # Forecaster, risk scorer, briefing
│   │   ├── models/               # Pydantic data models
│   │   └── routers/              # FastAPI route handlers
│   ├── Dockerfile
│   └── pyproject.toml
├── supabase/
│   └── migrations/               # SQL migrations (001, 002)
├── public/
│   └── geojson/                  # Static GeoJSON data
│       ├── gcc-wards.geojson     # GCC ward boundaries (choropleth)
│       ├── chennai-water-bodies-current.geojson  # OSM water bodies (1,635 features)
│       └── chennai-water-bodies-lost.geojson     # Curated lost water bodies (15 entries)
└── .github/
    └── workflows/                # CI + daily data pipeline
```

## Default Assumptions

| Parameter | Default | Source |
|-----------|---------|--------|
| Daily consumption | 830 MLD | CMWSSB annual report |
| Desalination output | 190 MLD | Minjur (100) + Nemmeli (100) |
| Groundwater supply | Not modeled | Conservative assumption |
| Evaporation losses | Not modeled | Planned for V2 |

Users can adjust consumption and desalination via sliders on the dashboard.

## Risk Score Methodology

Each ward receives a composite score from 0 (safe) to 100 (critical):

| Component | Weight | What it measures |
|-----------|--------|-----------------|
| Groundwater depth | 40% | Current depth to water table (mbgl) |
| Year-over-year trend | 30% | Is the water table rising or falling? |
| Reservoir stress | 20% | City-wide reservoir storage percentage |
| Seasonal vulnerability | 10% | Time of year (pre-monsoon = highest risk) |

Risk levels: **Low** (0–25) · **Moderate** (26–50) · **High** (51–75) · **Critical** (76–100)

## Limitations

- This is an independent, educational project — not an official government tool.
- Estimates are approximations. Actual water availability depends on factors not modeled (Krishna water transfer, distribution losses, industrial use).
- CMWSSB data may occasionally be stale (weekends, holidays).
- Groundwater data from OpenCity may lag by months.
- Forecasts use AutoARIMA which works best with 90+ days of history.
- Lost water body coordinates and historical areas are approximate, sourced from academic and civic studies.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

Areas where help is needed:

- **Data quality** — Improving scraper resilience, handling CMWSSB page format changes
- **Models** — Better forecasting (Prophet, LSTM), evaporation modeling
- **Water bodies data** — Adding more documented lost water bodies with verified coordinates and sources
- **Tamil localization** — Translating the UI for local accessibility
- **Testing** — Unit tests for scrapers, calculator, and intelligence modules

Please open an issue first to discuss significant changes.

## License

[MIT](LICENSE)

## Acknowledgments

- **CMWSSB** for publishing daily reservoir data publicly
- **NASA POWER** for free, open weather data
- **OpenCity Chennai** for ward-level groundwater datasets
- **GCC** for ward boundary delimitation data
- **OpenStreetMap contributors** for water body polygon data
- **Care Earth Trust** for comprehensive water body surveys and documentation
- **IIT Madras** and the **National Green Tribunal** for research and legal records on water body encroachments
- Chennai's civic data community for making public data accessible

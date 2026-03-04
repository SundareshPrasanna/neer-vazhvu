# Neer Vazhvu

**Chennai Water Intelligence Dashboard** — An open-source platform that turns public water data into actionable intelligence for Chennai's 11 million residents.

Neer Vazhvu (நீர் வாழ்வு, Tamil for "Water Life") tracks reservoir levels, groundwater health, river water quality, and water body loss across Chennai. It goes beyond simple dashboards by providing **30-day reservoir forecasts**, **ward-level risk scoring with an interactive risk map**, **river DO/BOD time-series**, **daily intelligence briefings**, and an **interactive lost water bodies map**.

## Features

### Dashboard
- **Days of Water Left** — Three-scenario estimate (pessimistic / current trend / seasonal rains)
- **Reservoir Cards** — Live storage, inflow, outflow, and rainfall for all 6 reservoirs
- **Per-Reservoir Drilldown** — Click any reservoir for 365-day charts (storage, inflow vs outflow, rainfall)
- **Historical Comparison** — Overlay any year from 2019–2025 on the storage trend chart
- **Storage Trend Chart** — 90-day combined storage with interactive year comparison

### Groundwater Map
- **Choropleth Map** — Depth to water table across all 200 GCC wards, color-coded by CGWB classification (Healthy → Crisis)
- **Risk Score View** — Toggle between depth choropleth and composite risk score choropleth (Low / Moderate / High / Critical) when pipeline data is available
- **Ward Detail Panel** — Click any ward for depth, year-over-year trend, historical chart, and composite risk score breakdown
- **Risk Score Breakdown** — Each of the four components (groundwater depth 40%, trend 30%, reservoir stress 20%, seasonal 10%) shown with weighted contribution bars

### Water Bodies Map
- **1,635 Existing Water Bodies** — All current lakes, tanks, ponds, and reservoirs from OpenStreetMap
- **15 Documented Lost / Encroached Water Bodies** — Curated from Care Earth Trust, NGT records, and IIT Madras research
- **Toggle Layers** — Show/hide current and lost water bodies independently
- **Status-coded Circles** — Fully lost (red), severely reduced (orange), partially encroached (yellow)
- **Detail Panel** — Click any water body for historical area, surviving area, what replaced it, and source citations
- **Area Loss Bar** — Visual indicator of how much of each water body survives

### River Health Map
- **Interactive Polyline Map** — 4 rivers (Cooum, Adyar, Buckingham Canal, Kosasthalaiyar) colour-coded by CPCB water quality status
- **Monitoring Station Markers** — 10 stations with individual DO/BOD readings
- **DO/BOD Time-Series Chart** — Dual-axis line chart (2015–2024) per station with reference lines at the aquatic life minimum (DO = 4 mg/L) and clean river standard (BOD = 2 mg/L)
- **River Detail Panel** — Status badge, CPCB class, 3-year trend indicator, station selector, embedded explainer for DO and BOD
- **3-Year Trend** — Per monitoring station: direction badge (Improving / Worsening / Stable / Mixed) with signed DO and BOD deltas derived from the last 3 annual readings. Threshold: ≥ 0.3 mg/L DO or ≥ 3 mg/L BOD = meaningful change.
- **Industrial Pollution Sources Overlay** — 7 major facilities (NCTPS, CPCL, Kamarajar Port, SIPCOT Manali, MFL, TPL, Ennore Creek) colour-coded by type; click for operator details, pollutant pills, incident timeline, and NGT orders. OSM `landuse=industrial` polygons shown as translucent overlay

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
| [OpenStreetMap Overpass API](https://overpass-api.de/) | Current water body polygons (lakes, tanks, reservoirs) + river polyline geometry + industrial zone polygons | One-time fetch |
| Care Earth Trust / NGT / IIT Madras | Documented lost and encroached water bodies | Curated dataset |
| [CPCB NWMP Annual Reports](https://cpcb.nic.in/nwmp-data/) | DO, BOD, pH, conductivity at 10 river monitoring stations (2015–2024) | Annual (manual refresh) |
| NGT Southern Bench / TNPCB / CPCB | 7 major industrial pollution sources — facility data, pollutant types, incident records, NGT orders | Manually curated |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
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
# From the repo root
npx tsx scripts/seed-kaggle.ts                 # Reservoir history
npx tsx scripts/seed-opencity-groundwater.ts   # Groundwater history
npx tsx scripts/seed-opencity-lakes.ts         # Optional lake-level history
```

### 6. Refresh Static GeoJSON Data (optional)

The water body, river, and industrial zone GeoJSON files are pre-generated and committed. Re-fetch from OpenStreetMap if you want the latest OSM edits:

```bash
# Current water bodies (lakes, tanks, reservoirs, ponds)
npx tsx scripts/fetch-water-bodies-osm.ts

# River polylines (Cooum, Adyar, Buckingham Canal, Kosasthalaiyar)
npx tsx scripts/fetch-rivers-osm.ts

# Industrial zone polygons (north Chennai bbox)
npx tsx scripts/fetch-industrial-zones-osm.ts
```

### 7. Refresh River Quality Data (optional, annual)

`public/data/river-quality.json` is manually curated from CPCB annual reports. When a new report is published:

1. Update the `readings` arrays with the new year's DO/BOD values
2. Update `last_updated` (e.g. `"2026-01"`) and `data_year_range`
3. Commit: `data: update river quality readings to 2025`

## API Endpoints

### Pipeline (protected — requires `Authorization: Bearer <CRON_SECRET>`)

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
├── scripts/                      # One-time data scripts
│   ├── fetch-water-bodies-osm.ts      # Fetch current water bodies from Overpass API
│   ├── fetch-rivers-osm.ts            # Fetch river polylines from Overpass API
│   └── fetch-industrial-zones-osm.ts  # Fetch industrial zone polygons from Overpass API
├── src/                          # Next.js frontend
│   ├── app/                      # App Router pages
│   │   ├── page.tsx              # Main dashboard
│   │   ├── groundwater/          # Groundwater map page
│   │   ├── water-bodies/         # Water bodies map page
│   │   ├── rivers/               # River health + industrial pollution map page
│   │   └── about/                # About/methodology page
│   ├── components/
│   │   ├── dashboard/            # Dashboard components
│   │   ├── groundwater/          # Map, legend, ward panel
│   │   ├── water-bodies/         # Map, legend, detail panel
│   │   ├── rivers/               # River map, panel, chart, legend
│   │   ├── pollution/            # Industrial pollution map overlay, panel, legend
│   │   ├── layout/               # Header, footer
│   │   └── ui/                   # shadcn/ui primitives
│   ├── lib/
│   │   ├── scrapers/             # TypeScript scrapers (legacy)
│   │   ├── calculator/           # Days-left calculator
│   │   └── mock-data.ts          # Demo mode data
│   └── types/                    # TypeScript type definitions
│       └── industrial-pollution.ts  # Industrial source types, colours, labels
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
│   ├── geojson/                  # Static GeoJSON data
│   │   ├── chennai-wards-2022.geojson           # GCC ward boundaries (choropleth)
│   │   ├── chennai-water-bodies-current.geojson # OSM water bodies (1,635 features)
│   │   ├── chennai-water-bodies-lost.geojson    # Curated lost water bodies (15 entries)
│   │   ├── chennai-rivers.geojson               # River polylines (Cooum, Adyar, etc.)
│   │   └── chennai-industrial-zones.geojson     # OSM industrial zone polygons
│   └── data/                     # Static JSON datasets
│       ├── river-quality.json        # CPCB monitoring station readings (2015–2024)
│       └── industrial-sources.json   # Industrial pollution sources (NGT/TNPCB/CPCB)
└── .github/
    └── workflows/                # CI + daily data pipeline
```

## Default Assumptions

| Parameter | Default | Source |
|-----------|---------|--------|
| Daily consumption | 830 MLD | CMWSSB annual report |
| Desalination output | 190 MLD | Model baseline constant (`DEFAULT_DESALINATION_MLD`) |
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
- **OpenStreetMap contributors** for water body polygon and river geometry data
- **Care Earth Trust** for comprehensive water body surveys and documentation
- **IIT Madras** and the **National Green Tribunal** for research and legal records on water body encroachments and industrial pollution
- **CPCB** for annual river water quality monitoring reports
- **TNPCB** for enforcement records and industrial consent data used in the pollution sources overlay
- **Carbon Copy** and **The Wire** for investigative reporting on the Ennore-Manali industrial corridor
- Chennai's civic data community for making public data accessible

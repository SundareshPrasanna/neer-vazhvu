# Neer Vazhvu

**Chennai Water Intelligence Dashboard** - An open-source platform that turns public water data into actionable intelligence for Chennai's 11 million residents.

**Live:** [neervazhvu.org](https://neervazhvu.org)

Neer Vazhvu (நீர் வாழ்வு, Tamil for "Water Life") tracks reservoir levels, groundwater health, river water quality, flood risk, sewerage infrastructure, and water body loss across Chennai. It goes beyond simple dashboards by providing **30-day reservoir forecasts**, **ward-level risk scoring with an interactive risk map**, **river DO/BOD time-series**, **daily intelligence briefings**, an **interactive water bodies and restoration priority map**, a **flood risk, drainage, and sewerage network map**, and a **unified My Ward report page** that aggregates all data for any of Chennai's 200 wards into a single shareable view.

## Features

### Dashboard
- **Days of Water Left** - Three-scenario estimate (pessimistic / current trend / seasonal rains)
- **Reservoir Cards** - Live storage, inflow, outflow, and rainfall for all 6 reservoirs
- **Catchment Rainfall Context** - CHIRPS-based 30-day and 90-day catchment signals for the 4 core Chennai supply reservoirs, summarized as below / near normal / above normal
- **Per-Reservoir Drilldown** - Click any reservoir for 365-day charts (storage, inflow vs outflow, rainfall)
- **Historical Comparison** - Overlay any year from 2019-2025 on the storage trend chart
- **Storage Trend Chart** - 90-day combined storage with interactive year comparison
- **Rainfall Trends** - 56-year IMD rainfall history (1970-2025) with annual bar chart color-coded for drought/flood/Day Zero years, plus monthly actual vs long-term normal comparison

### Groundwater Map
- **Choropleth Map** - Depth to water table across all 200 GCC wards, color-coded by CGWB classification (Healthy to Crisis)
- **Risk Score View** - Toggle between depth choropleth and composite risk score choropleth (Low / Moderate / High / Critical) when pipeline data is available
- **CGWB Exploitation View** - Block-level groundwater exploitation from India WRIS/CGWB (2011-2024), showing Safe/Semi-Critical/Critical/Over-Exploited classification with development percentage trends
- **Live CGWB Station Overlay** - ~35 CGWB/India WRIS stations in Chennai district plotted as circle markers over the ward choropleth, mixing Manual (quarterly dug wells) and Telemetric (daily DWLR bore wells) with well type, well depth, and aquifer type in the station panel
- **Sensor Data Quality Layer** - Each station is scored server-side with a `stuck` / `stale` / `ok` flag (stuck detection uses median daily delta < 1cm over 60 days; stale is mode-aware - 14 days for DWLR, 180 days for manual). Suspect stations render with a dashed amber ring and get an explicit warning banner in the panel, and the legend exposes filters so reviewers can hide them
- **Ward Detail Panel** - Click any ward for depth, year-over-year trend, historical chart, and composite risk score breakdown
- **Block Detail Panel** - Click any exploitation block for development %, availability, draft totals, and historical trend bar chart with 100% threshold line
- **Risk Score Breakdown** - Each of the four components (groundwater depth 40%, trend 30%, reservoir stress 20%, seasonal 10%) shown with weighted contribution bars
- **Connected Insights** - Threshold-gated cross-domain intelligence blocks that surface when a risk component is dominant (e.g., "Reservoir stress contributes X/20 to this ward's risk score") with deep links to the relevant page
- **Action Nudges** - Context-aware action recommendations based on the dominant risk factor (rainwater harvesting, recharge wells, or reservoir advocacy)
- **Panel Pre-selection** - Each view mode auto-selects a notable item on load (deepest ward, highest-risk ward, or most over-exploited block) so users see the detail panel immediately
- **Ward Context Panel** - Cross-domain intelligence for each ward showing groundwater depth/trend, water body count with restoration needs, dominant flood hazard, nearest river station, and drainage line count - all clickable deep links that navigate to the relevant page and pre-select the ward
- **AI Ward Analysis** - AI-generated narrative per ward connecting groundwater, infrastructure, and risk data into a contextual story (refreshed monthly)

### Water Bodies and Restoration Map
A unified map at `/water-bodies` with a **view-mode toggle** to switch between "Water Bodies" and "Restoration Priority" views. Both views share the same detail panel and data.

**Water Bodies view:**
- **1,787 Existing Water Bodies** - All current lakes, tanks, ponds, and reservoirs from OpenStreetMap and Census of Water Bodies
- **15 Documented Lost / Encroached Water Bodies** - Curated from Care Earth Trust, NGT records, and IIT Madras research
- **Toggle Layers** - Show/hide current and lost water bodies independently
- **Status-coded Circles** - Fully lost (red), severely reduced (orange), partially encroached (yellow)

**Restoration Priority view:**
- **1,787 Water Bodies Scored** - OSM and census water bodies ranked on restoration priority using spatial analysis
- **6-Component Scoring Model** - Water body size (25%), proximity to lost water bodies (18%), proximity to polluted rivers (18%), industrial pollution proximity (14%), water body type (15%), census condition (15%)
- **Priority Levels** - Critical (75-100), High (50-74), Moderate (25-49), Low (0-24)
- **Color-coded Polygons** - Red to green showing restoration priority across Chennai

**Shared features:**
- **Ranking Table** - Sortable by score, area, or name; switch via Map/Ranking tabs
- **Detail Panel** - Click any water body for basic info plus restoration score breakdown, nearest lost water body, nearest river station, nearest industrial source. Connected insights surface when lost-proximity or industrial-proximity scores are dominant
- **Satellite Context** - For reviewed Phase 1 lakes and reservoirs, the detail panel shows historical persistence, current surface spread versus the usual seasonal baseline, and a freshness/confidence label
- **Ward Context + AI Analysis** - Each detail panel shows the ward's cross-domain water context and AI-generated narrative
- **Deep Linking** - Ward context links navigate to the water bodies page and pre-select the ward's top water body (`?mode=restoration&ward=N`)
- **Stats Bar** - Adapts to show water body counts or priority breakdown based on view mode

### River Health Map
- **Interactive Polyline Map** - 4 rivers (Cooum, Adyar, Buckingham Canal, Kosasthalaiyar) colour-coded by CPCB water quality status
- **Monitoring Station Markers** - 10 stations with individual DO/BOD readings
- **DO/BOD/Nitrate Time-Series Chart** - Dual-axis line chart (2015-2024) per station with reference lines at the aquatic life minimum (DO = 4 mg/L) and clean river standard (BOD = 2 mg/L)
- **Pollution Profile with BIS Limits** - DO, BOD, fecal coliform, TDS, nitrate, and heavy metals (Cr, Pb, Cd) shown as severity cards with BIS drinking water limit baselines, ratio bars, and multiplier labels (e.g., "22x above limit", "13x below min" for critically low DO)
- **River Detail Panel** - Status badge, CPCB class, 3-year trend indicator (separate DO and BOD rows with direction hints), station selector, embedded explainers for DO, BOD, nitrate, and fecal coliform
- **3-Year Trend** - Per monitoring station: direction badge (Improving / Worsening / Stable / Mixed) with signed DO and BOD deltas derived from the last 3 annual readings
- **Stretch Highlighting** - Selecting a station highlights the corresponding river stretch on the map; station clicks on the map sync with the panel
- **Sewage Inlet Layer** - 31 geo-located sewage inlets along the Cooum river with discharge volumes (size-encoded circles), from Nethaji Mariappan et al. (2017)
- **CRRT Restoration Tracker** - 9 restoration projects from the Chennai Rivers Restoration Trust shown per river, with status, budget, area, metrics, and source links
- **No-Monitoring Alarm** - Rivers without CPCB monitoring stations (Kosasthalaiyar) show a prominent alarm with a link to report alternative data sources
- **Industrial Pollution Sources Overlay** - 7 major facilities (NCTPS, CPCL, Kamarajar Port, SIPCOT Manali, MFL, TPL, Ennore Creek) colour-coded by type; click for operator details, pollutant pills, incident timeline, and NGT orders. OSM `landuse=industrial` polygons shown as translucent overlay

### Flood Risk, Drainage, and Sewerage
- **Hazard Zone Map** - CFLOWS 1.0 flood hazard zones (Very High to Very Low) from the Nov 2019 model by IIT Bombay + IIT Madras + NCCR, via OpenCity Chennai. Model has not received a public update since; visible caveat on the page explains the vintage. Ward boundary overlay for area context.
- **Historical Flood Events** - Toggle between 2015 Chennai floods (327 hotspots with vulnerability ratings, 192 inundation depth points) and 2020 Cyclone Nivar (53 hotspots)
- **GCC Storm Water Drain Network** - 10,308 official drain segments from Greater Chennai Corporation survey (2023), showing street-level detail with drain type, depth, width, material, and condition status
- **Macro and Micro Drains** - 52 major drainage channels from Chennai Basin Drainage Maps
- **Drain Detail Panel** - Click any drain for street name, ward/zone, dimensions, open/closed status, condition (Good/Bad), and material type
- **CMWSSB Sewerage Network** - 13 operational sewage treatment plants totalling 745 MLD installed capacity (CMWSSB 2026) shown as 8 campus points, 348 pumping stations (SPS) with STP linkage, and 3,834 pumping main segments with pipe material and size
- **Return Period Maps** - 5/10/25/50/100/200-year flood extent polygons
- **Ward Boundary Overlay** - 200 GCC wards with zone names on hover across all view modes
- **Ward Context + AI Analysis** - Detail panels show ward-level cross-domain context and AI narrative for any clicked feature
- **Deep Linking** - Ward context links navigate to the flood risk page and fly to the ward centroid (`?ward=N`), with view mode preserved (`?view=drainage`)
- **Click Tolerance** - Drainage lines and pumping mains use a Canvas renderer with 10px tolerance for easier interaction with thin features

### My Ward
A unified ward report page at `/my-ward` that aggregates all data layers for any of Chennai's 200 wards into a single scrollable page. Supports deep linking via `?ward=N`.

- **Ward Selector** - Search by ward number, area name, or zone name; recent wards remembered in localStorage
- **AI Narrative** - AI-generated ward analysis connecting groundwater, infrastructure, and risk data
- **Groundwater Card** - Depth to water table, year-over-year trend, composite risk score with 4-component breakdown (groundwater depth 40%, trend 30%, reservoir stress 20%, seasonal 10%), and historical chart
- **Water Bodies Card** - Total count, restoration priority breakdown (critical/high/moderate/low), top 3 bodies by score, lost water bodies count with provenance
- **Flood Risk Card** - Worst-case-first hazard display (very high and high zone counts shown prominently), category breakdown bar, 2015/2020 historical hotspot counts
- **Infrastructure Card** - Drainage network length (km/sq km), STP count and capacity (MLD), pumping main length and station count
- **River Card** - Nearest river, monitoring station, straight-line distance
- **Actions Card** - GCC grievance portal link, CMWSSB portal link, ward councillor/MLA/MP with party and contact info
- **News Context** - Zone-level news articles related to water issues
- **Cross-page Links** - Each card links to the relevant Explore page with the ward pre-selected
- **Source Attribution** - Every card shows data source and caveats (data age, model limitations, units explained)
- **Export** - CSV download of all ward data, share via URL, print-friendly layout
- **Ward Report Card** - Print-optimized one-pager at `/my-ward/report?ward=N` ranking a ward among all 200 on 5 governance-quality metrics (water body health, water body density, flood risk exposure, drainage coverage, sewage network coverage). Percentile-based A-F grades, zone/city median comparisons, elected representatives, methodology disclosure with known limitations. All density metrics area-normalized; line-based infrastructure apportioned across ward boundaries by sampling
- **Uplift Planner** - Interactive budget optimizer answering "If I had INR X crore for my ward, where should I invest?" A greedy algorithm allocates a hypothetical budget (10-500 Cr slider) across 5 intervention types (storm drains, sewerage, flood mitigation, water body restoration, water body revival), maximizing composite-score improvement per crore spent. Data-backed caps prevent over-allocation (e.g. can't restore more bodies than actually need it). After-state uses exact ranking engine recompute (not approximation) for grade projections. Cost ranges from published GCC/CMWSSB/NDMA project reports

### Chennai Water Facts
A journalist-ready snapshot page at `/facts` that surfaces Chennai's water state as quotable numbers with sources, dates, and methodology attached. Organised by freshness tier so staleness is never hidden.

- **Live tier** (Tier 1) - Reservoir storage today, Day Zero comparison to 2019, last-30-day rainfall, and year-over-year water body area change for 12+ tracked water bodies. Computed at request time from `reservoir_daily`, `weather_daily`, and `water_body_satellite_summary` tables with hourly ISR.
- **Annual tier** (Tier 2) - Latest published government data: CGWB over-exploited blocks (13 of 16 in 2024), peak river pollution records (Cooum DO 0.0 mg/L in 2022, Buckingham Canal DO 0.3 mg/L in 2024), ward-level groundwater crisis count, and a Data Transparency Watch meta-card flagging how long it has been since authorities published.
- **Historical tier** (Tier 3) - Documented events and peak records: 2019 Day Zero (~19 MCFT usable storage), 2015 Chennai floods (77-494 mm station rainfall range per WWA), CFLOWS 1.0 model vintage (Nov 2019), Pallikaranai Marsh decline (~6,000 to ~593 ha per 2016 research).
- **Infrastructure tier** (Tier 4) - Structural capacity facts: 13 STPs / 745 MLD installed, 200 MLD desalination installed, 13,222 MCFT total reservoir capacity, piped supply vs demand gap.
- **Copy-quote buttons** produce paste-ready attribution including the canonical fact URL (`neervazhvu.org/facts#id`).
- **JSON-LD Dataset + Observation** structured data for search engines.
- **Public JSON API** at `/api/facts` for RSS, embeds, and partner integrations.

### Intelligence Layer (Python Service)
- **Reservoir Forecasting** - 30-day storage predictions using AutoARIMA with confidence intervals; uses inflow/outflow, precipitation, and ET₀ (evapotranspiration) as exogenous regressors when data variance is sufficient
- **Ward Risk Scoring** - Composite 0-100 risk score per ward (groundwater depth, trend, reservoir stress, seasonal vulnerability)
- **Daily Briefing** - Template-based intelligence summary with headlines, alerts, and recommendations; optionally enhanced with an AI-generated city narrative using Claude (Sonnet for city, Haiku for 200 ward narratives)
- **GEE Phase 1 Summaries** - Earth Engine-derived water-body spread seasonality and reservoir catchment rainfall summaries, written into Supabase for dashboard and water-body detail use

### Ward Profile Index
- **Build-Time Spatial Join** - Every data layer (water bodies, flood zones, drainage, sewerage, rivers, industrial zones) is mapped to each of Chennai's 200 wards using centroid point-in-polygon attribution. Line-based infrastructure (drainage, pumping mains) is apportioned across ward boundaries by sampling at 50m intervals along each line
- **Deterministic Output** - `scripts/compute-ward-profiles.ts` reads only committed repo files (no Supabase), producing `public/data/ward-profiles.json` with byte-identical output for identical inputs
- **Ward Area** - Each ward's polygon area (sq km) is computed from GCC 2022 boundaries via `@turf/area`, enabling area-normalized density metrics
- **CI Freshness Check** - Reruns the script and diffs output; catches stale profiles when source GeoJSON changes

### Other
- **Navigation** - 4 top-level tabs: Dashboard, My Ward, Explore (dropdown grouping Groundwater, Water Bodies, Rivers, Flood Risk), About. Mobile menu has collapsible Explore section
- **Tamil Localization** - Full English/Tamil toggle (~700 translation keys) with localStorage persistence; locale-aware date formatting and reservoir name translations
- **Dark Mode** - Full dark mode with system preference detection; maps use OSM tiles with CSS invert filter for consistent label coverage across themes
- **Responsive** - Works on desktop, tablet, and mobile
- **Demo Mode** - Runs with realistic mock data when Supabase isn't configured
- **OG Image** - Auto-generated Open Graph image for social sharing (LinkedIn, Twitter)

## Architecture

```
┌──────────────────────────────────────────────────┐
│        Python FastAPI Service (Railway)           │
│                                                  │
│  Scrapers         ETL            Intelligence     │
│  ├─ cmwssb.py     ├─ pipeline.py ├─ forecaster   │
│  ├─ open_meteo.py ├─ estimate.py ├─ risk_scorer  │
│  ├─ nasa_power.py └─ constants   └─ briefing     │
│  └─ opencity.py                                   │
│                                                  │
│  Writes computed results to Supabase ────┐        │
└──────────────────────────────────────────┘        │
                                                    │
┌──────────────────────────────────────────┐        │
│       Next.js Frontend (Vercel)          │<───────┘
│  Reads from Supabase + renders UI        │
│  Static GeoJSON + JSON served from /public│
└──────────────────────────────────────────┘

```

Earth Engine Phase 1 jobs live under `neer-vazhvu-api/app/gee/` and write small summary tables into Supabase instead of serving raster layers directly to the frontend.

## Data Sources

| Source | Data | Frequency |
|--------|------|-----------|
| [CMWSSB Lake Level Page](https://cmwssb.tn.gov.in/lake-level) | Reservoir levels, inflow, outflow, rainfall | Daily |
| [Open-Meteo](https://open-meteo.com/) | Precipitation, temperature, humidity, ET₀, wind speed | Daily (zero lag) |
| [NASA POWER](https://power.larc.nasa.gov/) | Precipitation, temperature, humidity (fallback) | Daily (2-day lag) |
| [OpenCity Chennai](https://data.opencity.in/) | Ward-wise groundwater levels (200 wards) | Monthly |
| [First Census of Water Bodies (data.gov.in)](https://data.gov.in/resource/state-wise-data-first-census-water-bodies-tamil-nadu) | 305 Chennai water bodies — ownership, capacity, encroachment | One-time fetch |
| [Kaggle Chennai Water Management](https://www.kaggle.com/datasets/sudalairajkumar/chennai-water-management) | 15 years of historical reservoir data (2004–2019) | One-time seed |
| [OpenStreetMap Overpass API](https://overpass-api.de/) | Current water body polygons (lakes, tanks, reservoirs) + river polyline geometry + industrial zone polygons | One-time fetch |
| [Sentinel-2 NDWI (via Earth Engine)](https://en.wikipedia.org/wiki/Normalized_difference_water_index) | NDWI water detection from Sentinel-2 green/NIR bands used to estimate recent visible spread for reviewed Phase 1 lakes and reservoirs | Periodic summary refresh |
| [JRC Global Surface Water Monthly Recurrence](https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_MonthlyRecurrence) | Historical month-by-month wetness baseline used to judge whether recent spread is lower or higher than usual for the season | Historical monthly baseline |
| [CHIRPS Daily Rainfall](https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY) | Catchment rainfall totals and seasonal anomaly baselines for Poondi, Red Hills, Chembarambakkam, and Cholavaram | Daily |
| [Copernicus Sentinel-2 (via Earth Engine)](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED) | True-color satellite imagery for reviewed evidence frames at flagship water bodies | Evidence refresh (manual dispatch) |
| [HydroBASINS / MERIT Hydro](https://www.hydrosheds.org/products/hydrobasins) | Reviewed operational catchment geometries used for reservoir rainfall context | Reviewed periodically |
| Care Earth Trust / NGT / IIT Madras | Documented lost and encroached water bodies | Curated dataset |
| [CPCB National Water Monitoring Programme (NWMP)](https://cpcb.nic.in/nwmp-data-2024/) | DO, BOD, pH, conductivity, fecal coliform, nitrate at 13 CPCB monitoring stations (2020-2024) | Annual (manual refresh) |
| [Nethaji Mariappan et al. (2017)](https://neptjournal.com/upload-images/NL-61-47-(45)B-3437.pdf) | 31 sewage inlets along Cooum river with discharge volumes (30,708 m3/day total) | One-time (2017 data) |
| [Chennai Rivers Restoration Trust (CRRT)](https://www.crrt.tn.gov.in/) | 9 restoration projects across Adyar, Cooum, Buckingham Canal, Kosasthalaiyar | Manually curated |
| NGT Southern Bench / TNPCB / CPCB | 7 major industrial pollution sources - facility data, pollutant types, incident records, NGT orders | Manually curated |
| [IMD Gridded Rainfall (via imdlib)](https://imdlib.readthedocs.io/) | Monthly rainfall at 0.25 deg resolution for Chennai (1970-2025), long-term normals | One-time generation |
| [India WRIS / CGWB](https://indiawris.gov.in/) | Block-level groundwater exploitation (%), classification (Safe to Over-Exploited), block boundaries (2011-2024) | Static fetch |
| [India WRIS Ground Water Level API](https://indiawris.gov.in/Dataset/Ground%20Water%20Level) | CGWB station-level time series (~35 Chennai stations, depth to water, Manual vs Telemetric/DWLR, well type, well depth, aquifer type) with server-side stuck/stale sensor detection | Daily scrape |
| [OpenCity Chennai (Flood Data)](https://data.opencity.in/) | CFLOWS 1.0 (Nov 2019) flood hazard zones, 2015 flood hotspots/depth, 2020 Cyclone Nivar hotspots, return period maps. Model not publicly updated since 2019. | Static fetch |
| [GCC Storm Water Drain Survey](https://data.opencity.in/) | 10,308 drain segments with type, depth, width, material, status across 197 wards | Static fetch |
| [CMWSSB Sewerage Network](https://cmwssb.tn.gov.in/sewerage-system) | 13 operational STPs (745 MLD installed capacity; 8 campus points in geojson), 348 pumping stations, 3,834 pumping mains with pipe material and size | Static fetch (capacity cross-referenced with CMWSSB page) |
| [Anthropic Claude API](https://docs.anthropic.com/) | AI-generated city and ward narratives (Sonnet for city, Haiku for wards) | Daily (city) / Monthly (wards) |

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

Neer Vazhvu uses Google Earth Engine as a summary layer, not a raster explorer.

Phase 1 currently does three things:

- computes catchment rainfall context for Poondi, Red Hills, Chembarambakkam, and Cholavaram
- computes seasonal surface-spread summaries for a curated 150-water-body target set
- builds reviewed Sentinel-2 evidence frames with NDWI water-mask overlays for flagship water bodies

Current product surfaces:

- dashboard catchment rainfall card
- water-body detail panel satellite context block
- satellite evidence dialog with true-color imagery and toggleable water-mask overlay

Current behavior and guardrails:

- water-body summaries are limited to a curated 150-target manifest rather than every mapped polygon
- satellite evidence frames are limited to a 12-body flagship cohort; only reviewed frames are shown by default
- low-confidence satellite rows are hidden from the detail panel
- catchment polygons are reviewed operational geometries, not legal survey boundaries
- current water-body observation uses optical Sentinel-2 NDWI only; Sentinel-1 radar fallback is not implemented yet
- the frontend reads Supabase summaries and Storage images; it does not request Earth Engine directly

Current operations:

- local runs happen through `neer-vazhvu-api/scripts/run_gee_phase1.py`
- GitHub workflow support lives in `.github/workflows/gee-phase1.yml`
- reservoir context refreshes daily in GitHub Actions
- water-body satellite summaries refresh weekly in GitHub Actions
- satellite evidence is included in `run-all-refresh` and available via manual dispatch
- historical water-body snapshots can be backfilled monthly for chart support
- a lighter `flagship-history` cohort is used for chart-ready history seeding and evidence frames
- the workflow also supports manual `workflow_dispatch` for validation, backfill, and ad hoc reruns

Current implementation docs:

- [GEE_PHASE1_METHODS.md](GEE_PHASE1_METHODS.md)
- [GEE_PHASE2_3_PLAN.md](GEE_PHASE2_3_PLAN.md)
- [GEE_PHASE2_CHECKLIST.md](GEE_PHASE2_CHECKLIST.md)
- [GEE_SATELLITE_EVIDENCE_PLAN.md](GEE_SATELLITE_EVIDENCE_PLAN.md)
- [GEE_SATELLITE_EVIDENCE_CHECKLIST.md](GEE_SATELLITE_EVIDENCE_CHECKLIST.md)
- [GEE_PHASE1_PLAN.md](GEE_PHASE1_PLAN.md)
- [GEE_CATCHMENT_DERIVATION_PLAN.md](GEE_CATCHMENT_DERIVATION_PLAN.md)
- [GEE_RESEARCH.md](GEE_RESEARCH.md)

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
-- 11. supabase/migrations/011_gee_satellite_evidence.sql
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
python scripts/run_gee_phase1.py build-satellite-evidence --write
```

Current workflow note:

- `.github/workflows/gee-phase1.yml` supports manual dispatch for `check-auth`, `build-targets`, `validate-catchments`, `run-reservoir-context`, `run-water-body-summaries`, `build-satellite-evidence`, and `run-all-refresh`
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
```

Flood hazard zones and GCC storm water drain data are converted from OpenCity KML files via `scripts/simplify-flood-geojson.ts`. CMWSSB sewerage data is converted via `python3 scripts/convert-sewerage-kml.py`.

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
├── scripts/                      # One-time data + validation scripts
│   ├── seed-kaggle.ts                     # Import historical reservoir data (2004–2019)
│   ├── seed-opencity-groundwater.ts       # Import groundwater history (2021–2024)
│   ├── seed-opencity-lakes.ts             # Import lake-level history (optional)
│   ├── fetch-water-bodies-osm.ts          # Fetch current water bodies from Overpass API
│   ├── fetch-rivers-osm.ts                # Fetch river polylines from Overpass API
│   ├── fetch-industrial-zones-osm.ts      # Fetch industrial zone polygons from Overpass API
│   ├── compute-restoration-priority.ts    # Score water bodies for restoration priority
│   ├── fetch-wris-groundwater.ts          # Fetch CGWB groundwater exploitation from India WRIS
│   ├── compute-ward-profiles.ts         # Spatial join: map all data layers to 200 wards
│   ├── generate-narratives.ts           # AI narrative generation (city + ward, uses Claude API)
│   ├── check-restoration-data.ts        # Validate restoration-projects.json schema
│   └── check-i18n.mjs                     # Validate Tamil translation coverage
├── src/                          # Next.js frontend
│   ├── app/                      # App Router pages
│   │   ├── page.tsx              # Main dashboard
│   │   ├── my-ward/              # Unified ward report page + report card (/report)
│   │   ├── groundwater/          # Groundwater map page
│   │   ├── water-bodies/         # Unified water bodies + restoration map
│   │   ├── rivers/               # River health + industrial pollution map page
│   │   ├── flood-risk/           # Flood risk, historical events, and drainage network
│   │   ├── lake-restoration/     # Redirects to /water-bodies
│   │   └── about/                # About/methodology page
│   ├── components/
│   │   ├── dashboard/            # Dashboard components
│   │   ├── my-ward/              # Ward cards (groundwater, water bodies, flood, infra, river, actions) + report card with rankings
│   │   ├── groundwater/          # Map, legend, ward panel
│   │   ├── water-bodies/         # Unified map, legend, detail panel, view-mode toggle
│   │   ├── rivers/               # River map, panel, chart, legend
│   │   ├── pollution/            # Industrial pollution map overlay, panel, legend
│   │   ├── flood-risk/           # Flood risk map, legend, detail panel, view toggle
│   │   ├── insights/               # Cross-domain ward context, AI narratives, connected insights
│   │   ├── lake-restoration/     # Restoration ranking table
│   │   ├── layout/               # Header (Explore dropdown nav), footer
│   │   └── ui/                   # shadcn/ui primitives
│   ├── lib/
│   │   ├── i18n/                 # English/Tamil translations + LanguageProvider context
│   │   ├── supabase/             # Supabase client (admin + server)
│   │   ├── api-clients/          # NASA POWER, OpenCity API clients
│   │   ├── calculator/           # Days-left calculator
│   │   ├── scrapers/             # TypeScript scrapers (legacy, superseded by Python)
│   │   ├── data/                   # Shared data loaders (ward GeoJSON cache)
│   │   ├── hooks/                  # Ward lookup (PIP), ward profile loader, my-ward data aggregation
│   │   ├── utils/                # Formatting, date helpers, ward rankings engine, ward export
│   │   └── mock-data.ts          # Demo mode data
│   └── types/                    # TypeScript type definitions
├── neer-vazhvu-api/              # Python intelligence service
│   ├── app/
│   │   ├── scrapers/             # CMWSSB, Open-Meteo, NASA POWER, OpenCity, data.gov.in
│   │   ├── etl/                  # Pipeline orchestrator, calculator
│   │   ├── gee/                  # Earth Engine: summaries, context, evidence
│   │   ├── intelligence/         # Forecaster, risk scorer, briefing
│   │   ├── models/               # Pydantic data models
│   │   └── routers/              # FastAPI route handlers
│   ├── scripts/
│   │   ├── scrape_cmwssb.py              # CMWSSB scraper (used by GitHub Actions)
│   │   ├── run_gee_phase1.py             # GEE Phase 1 CLI (summaries, context, evidence)
│   │   └── generate_imd_rainfall.py      # Generate IMD rainfall data from imdlib
│   ├── Dockerfile
│   └── pyproject.toml
├── supabase/
│   └── migrations/               # SQL migrations (001-011)
├── public/
│   ├── geojson/                  # Static GeoJSON data
│   │   ├── chennai-wards-2022.geojson           # GCC ward boundaries (choropleth)
│   │   ├── chennai-water-bodies-current.geojson # OSM water bodies (1,635 features)
│   │   ├── chennai-water-bodies-lost.geojson    # Curated lost water bodies (15 entries)
│   │   ├── chennai-rivers.geojson               # River polylines (Cooum, Adyar, etc.)
│   │   ├── chennai-industrial-zones.geojson     # OSM industrial zone polygons
│   │   ├── chennai-gwr-blocks.geojson           # CGWB groundwater resource block boundaries
│   │   ├── chennai-flood-hazard-zones.geojson   # CFLOWS flood hazard zones (5 categories)
│   │   ├── chennai-flood-2015-hotspots.geojson  # 2015 flood hotspots (327 points)
│   │   ├── chennai-flood-2020-hotspots.geojson  # 2020 Cyclone Nivar hotspots (53 points)
│   │   ├── chennai-flood-inundation-depth.geojson # 2015 inundation depth points (192)
│   │   ├── chennai-flood-return-periods.geojson # Return period flood maps (5-200yr)
│   │   ├── chennai-drainage.geojson             # GCC storm water drains (10,308 segments)
│   │   └── chennai-sewerage.geojson             # CMWSSB sewerage (13 STPs / 745 MLD; 8 campus points, 348 SPS, 3,834 mains)
│   └── data/                     # Static JSON datasets
│       ├── river-quality.json            # CPCB monitoring station readings (2015-2024)
│       ├── cooum-sewage-inlets.json     # 31 sewage inlets along Cooum (Nethaji Mariappan et al. 2017)
│       ├── restoration-projects.json    # 9 CRRT restoration projects across 4 rivers
│       ├── industrial-sources.json       # Industrial pollution sources (NGT/TNPCB/CPCB)
│       ├── restoration-priority.json     # Pre-computed restoration priority scores (1,787 water bodies)
│       ├── imd-rainfall-monthly.json     # IMD historical rainfall (1970-2025, monthly + annual)
│       ├── gwr-blocks.json              # CGWB block-level groundwater exploitation data (2011-2024)
│       ├── gw-stations.json             # CGWB groundwater monitoring station locations
│       ├── ward-names.json              # GCC ward numbering and zone assignments
│       ├── ward-profiles.json             # Build-time ward spatial profiles (200 wards, all layers)
│       └── ward-representatives.json    # GCC ward councilors, MLAs, MPs
└── .github/
    └── workflows/                # CI + daily data pipeline
```

## Default Assumptions

| Parameter | Default | Source |
|-----------|---------|--------|
| Daily consumption | 830 MLD | CMWSSB annual report |
| Desalination output | 190 MLD | Model baseline constant (`DEFAULT_DESALINATION_MLD`) |
| Groundwater supply | Not modeled | Conservative assumption |
| Evaporation losses | ET₀ from Open-Meteo (FAO Penman-Monteith) | Used as ARIMAX exogenous regressor when variance is sufficient |

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

## Ward Report Card Methodology

Each of Chennai's 200 wards receives a composite score (0-100) based on 5 governance-quality metrics, each ranked independently with percentile-based A-F grades:

| Metric | Weight | Unit | Direction | Tiebreaker |
|--------|--------|------|-----------|------------|
| Drainage coverage | 25% | km/sq km | Higher = better | - |
| Sewerage infrastructure | 25% | km/sq km | Higher = better | SPS density |
| Flood risk exposure | 25% | zones/sq km | Lower = better | - |
| Water body health | 15% | restoration score | Lower = better | Body count |
| Water body density | 10% | bodies/sq km | Higher = better | - |

**Grading:** A (80th+ percentile), B (60-79th), C (40-59th), D (20-39th), F (below 20th). Percentile formula: `(total - rank) / (total - 1) * 100`. The overall grade applies the same thresholds to the composite score's percentile rank.

**Implementation:** `src/lib/utils/ward-rankings.ts` - `computeWardRankings()` computes per-metric ranks with tiebreakers, composite scores via `computeCompositeScore()`, and overall ranking via `rankEntries()`.

## Uplift Planner Methodology

The uplift planner answers: "If I had INR X crore for my ward, where should I invest it to improve its grade the most?"

**Algorithm:** Greedy budget optimizer (`src/lib/utils/ward-uplift.ts`)
1. **Gap analysis** - Compares the ward's current value on each metric against the city distribution to identify where it lags
2. **Greedy loop** - At each step, evaluates every feasible intervention and picks the one with the highest weighted-percentile improvement per crore. Repeats until budget is spent or all caps are hit
3. **Exact projection** - Builds a modified ward profile with projected metric values and reruns `computeWardRankings()` on the full 200-ward dataset to get the exact after-state grade and percentile (not an approximation)

**Interventions & costs** (from published government project reports):

| Intervention | Cost/unit (Cr) | Metric | Cap logic |
|-------------|---------------|--------|-----------|
| Build storm drains | 1.5-3.0/km | Drainage coverage | 20 km/ward |
| Extend sewage network | 3.0-6.0/km | Sewerage infra | 15 km/ward |
| Flood zone mitigation | 5-15/zone | Flood risk | Actual high+very-high zones |
| Restore water bodies | 2-8/body | WB health | Bodies rated critical/high |
| Revive lost water bodies | 10-25/body | WB density | Documented lost bodies |

**Ranking parity:** Both before-state and after-state achieve 0/200 disagreements with the authoritative `computeWardRankings()` engine across all wards. Verified by exhaustive tests in `ward-uplift.test.ts`.

## Restoration Priority Methodology

Each of Chennai's 1,787 water bodies (1,635 OSM + 152 census-only) receives a composite priority score from 0 (low priority) to 100 (critical restoration candidate), computed from 6 weighted spatial components:

| Component | Weight | What it measures |
|-----------|--------|-----------------|
| Water body size | 25% | Larger bodies provide greater recharge and flood mitigation impact |
| Proximity to lost water bodies | 18% | Near historically lost lakes = stressed area needing compensation |
| Proximity to polluted rivers | 18% | Near dead/degraded river stretches (by DO readings from CPCB stations) |
| Industrial pollution proximity | 14% | Near industrial discharge zones = higher contamination risk |
| Water body type | 15% | Reservoirs and lakes prioritised over canals, drains, wastewater ponds |
| Census condition | 15% | Encroachment status and storage capacity loss from government census data |

Priority levels: **Low** (0–24) · **Moderate** (25–49) · **High** (50–74) · **Critical** (75–100)

Scores are pre-computed by `scripts/compute-restoration-priority.ts` using Haversine distance calculations against all input datasets. Output is saved to `public/data/restoration-priority.json`.

## Limitations

- This is an independent, educational project -not an official government tool.
- Estimates are approximations. Actual water availability depends on factors not modeled (Krishna water transfer, distribution losses, industrial use).
- CMWSSB data may occasionally be stale (weekends, holidays, or when their site blocks datacenter IPs). The pipeline gracefully continues with existing data for up to 4 days.
- Groundwater data from OpenCity may lag by months.
- Forecasts use AutoARIMA which works best with 90+ days of history.
- Lost water body coordinates and historical areas are approximate, sourced from academic and civic studies.
- Restoration priority scores use spatial proximity as a proxy; they do not account for population density, land ownership, or restoration cost -factors that require non-public data.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

Areas where help is needed:

- **Data quality** -Improving scraper resilience, handling CMWSSB page format changes
- **Models** -Better forecasting (Prophet, LSTM), improved evaporation integration
- **Water bodies data** -Adding more documented lost water bodies with verified coordinates and sources
- **Tamil localization** -Translating the UI for local accessibility
- **Testing** -Unit tests for scrapers, calculator, and intelligence modules

Please open an issue first to discuss significant changes.

## License

[MIT](LICENSE)

## Acknowledgments

- **CMWSSB** for publishing daily reservoir data publicly and for sewerage infrastructure data (STPs, pumping stations, pumping mains)
- **[Open-Meteo](https://open-meteo.com/)** for free, zero-lag weather data with evapotranspiration
- **NASA POWER** for free, open weather data (fallback source)
- **OpenCity Chennai** for ward-level groundwater datasets
- **[data.gov.in](https://data.gov.in/)** / **Ministry of Jal Shakti** for the First Census of Water Bodies (2018-19)
- **GCC** for ward boundary delimitation data and storm water drain survey data (10,308 drain segments)
- **OpenStreetMap contributors** for water body polygon and river geometry data
- **Care Earth Trust** for comprehensive water body surveys and documentation
- **IIT Madras** and the **National Green Tribunal** for research and legal records on water body encroachments and industrial pollution
- **[CPCB National Water Monitoring Programme (NWMP)](https://cpcb.nic.in/nwmp-data-2024/)** for annual river water quality monitoring data
- **[Chennai Rivers Restoration Trust (CRRT)](https://www.crrt.tn.gov.in/)** for restoration project data across Chennai's rivers
- **Nethaji Mariappan et al.** for sewage inlet survey data along the Cooum river (Nature Environment and Pollution Technology, 2017)
- **IMD (Indian Meteorological Department)** for historical gridded rainfall data (via imdlib)
- **CGWB / India WRIS** for block-level groundwater exploitation data and monitoring station locations
- **TNPCB** for enforcement records and industrial consent data used in the pollution sources overlay
- **Carbon Copy** and **The Wire** for investigative reporting on the Ennore-Manali industrial corridor
- **[Anthropic](https://www.anthropic.com/)** for Claude API powering city and ward AI narratives
- Chennai's civic data community for making public data accessible

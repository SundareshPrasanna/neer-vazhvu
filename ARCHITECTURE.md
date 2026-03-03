# Architecture

> Technical overview of Neer Vazhvu — Chennai Water Intelligence Dashboard.

## System Overview

```mermaid
graph TB
    subgraph External Data Sources
        CMWSSB["CMWSSB Website<br/>(Reservoir levels)"]
        NASA["NASA POWER API<br/>(Weather)"]
        OC["OpenCity CKAN<br/>(Groundwater)"]
        CPCB["CPCB Annual Reports<br/>(River quality — manual)"]
        OSM["OpenStreetMap / Overpass<br/>(River geometry — one-time)"]
    end

    subgraph Backend ["Python API (FastAPI)"]
        Scrapers["Scrapers"]
        ETL["ETL Pipeline"]
        Intel["Intelligence Layer"]
    end

    subgraph Database ["Supabase (PostgreSQL)"]
        Core["Core Tables<br/>reservoir_daily<br/>weather_daily<br/>groundwater_monthly"]
        Computed["Computed Tables<br/>water_estimate_daily<br/>reservoir_forecast<br/>ward_risk_score<br/>daily_briefing"]
        Log["pipeline_log"]
    end

    subgraph Frontend ["Next.js (App Router)"]
        Dashboard["Dashboard /"]
        GW["Groundwater /groundwater"]
        Rivers["Rivers /rivers"]
        About["About /about"]
    end

    subgraph CI ["GitHub Actions"]
        Cron["Daily cron (06:00 IST)"]
        KA["Keepalive (every 2 days)"]
    end

    CMWSSB -->|HTML scrape| Scrapers
    NASA -->|REST API| Scrapers
    OC -->|CKAN API| Scrapers
    CPCB -->|manual JSON| StaticFiles["public/data/river-quality.json"]
    OSM -->|fetch-rivers-osm.ts| StaticFiles2["public/geojson/chennai-rivers.geojson"]

    Scrapers --> ETL
    ETL -->|upsert| Core
    Core --> Intel
    Intel -->|upsert| Computed

    ETL -->|log| Log
    Intel -->|log| Log

    Core -->|read| Frontend
    Computed -->|read| Frontend
    StaticFiles -->|static| Frontend
    StaticFiles2 -->|static| Frontend

    Cron -->|POST /pipeline/run-daily| ETL
    KA -->|GET /health| Backend
```

## Daily Pipeline

Triggered by GitHub Actions at 06:00 IST, or manually via `POST /pipeline/run-daily`.

```mermaid
flowchart LR
    S1["1. Scrape CMWSSB<br/>(6 reservoirs)"]
    S2["2. Fetch NASA POWER<br/>(5-day backfill)"]
    S3["3. Fetch OpenCity<br/>(days 1-3 only)"]
    S4["4. Compute Estimate<br/>(3 scenarios)"]
    S5["5. Forecast<br/>(ARIMAX × 6)"]
    S6["6. Risk Scores<br/>(200 wards)"]
    S7["7. Briefing<br/>(headline + alerts)"]

    S1 --> S4
    S2 --> S4
    S3 -.->|optional| S4
    S4 --> S5
    S5 --> S6
    S6 --> S7
```

| Step | Source | Output Table | Frequency |
|------|--------|-------------|-----------|
| Scrape CMWSSB | cmwssb.tn.gov.in | `reservoir_daily` | Daily |
| Fetch NASA POWER | power.larc.nasa.gov | `weather_daily` | Daily (2-day lag) |
| Fetch OpenCity | data.opencity.in | `groundwater_monthly` | Monthly (days 1-3) |
| Compute Estimate | Aggregated storage + inflow | `water_estimate_daily` | Daily |
| Forecast | StatsForecast ARIMAX | `reservoir_forecast` | Daily |
| Risk Scores | Groundwater + reservoir stress | `ward_risk_score` | Monthly |
| Briefing | Template-based rules | `daily_briefing` | Daily |

## Data Model

```mermaid
erDiagram
    reservoir_daily {
        text reservoir PK
        date date PK
        float current_level_ft
        float current_storage_mcft
        float capacity_mcft
        float storage_pct
        float inflow_cusecs
        float outflow_cusecs
        float rainfall_mm
    }

    weather_daily {
        date date PK
        float precipitation_mm
        float temp_max_c
        float temp_min_c
        float humidity_pct
    }

    groundwater_monthly {
        int ward_number PK
        int year PK
        int month PK
        text ward_name
        text zone_name
        float depth_to_water_m
    }

    water_estimate_daily {
        date date PK
        float total_storage_mcft
        float storage_pct
        float consumption_mld
        float avg_inflow_mcft_day
        int days_left_pessimistic
        int days_left_moderate
        int days_left_optimistic
    }

    reservoir_forecast {
        text reservoir PK
        date forecast_date PK
        date target_date PK
        float predicted_storage_mcft
        float confidence_lower_mcft
        float confidence_upper_mcft
        text model_name
    }

    ward_risk_score {
        int ward_number PK
        date computed_date PK
        float risk_score
        text risk_level
        float groundwater_component
        float trend_component
        float reservoir_component
        float seasonal_component
    }

    daily_briefing {
        date briefing_date PK
        text headline
        text summary
        json key_metrics
        json alerts
        json recommendations
    }

    reservoir_daily ||--o{ water_estimate_daily : "aggregated into"
    reservoir_daily ||--o{ reservoir_forecast : "forecasted by"
    groundwater_monthly ||--o{ ward_risk_score : "scored into"
```

## Intelligence Layer

### ARIMAX Forecaster

Predicts reservoir storage 30 days ahead using [statsforecast](https://nixtla.github.io/statsforecast/) AutoARIMA with optional exogenous regressors (inflow/outflow).

```mermaid
flowchart TD
    A["Fetch reservoir history<br/>(storage + inflow + outflow)"]
    B{"Data frequency?"}
    C["Daily<br/>season=365, horizon=30"]
    D["Monthly<br/>season=12, horizon=6"]
    E{"Inflow coverage<br/>≥30% in last 2 years?"}
    F["ARIMAX<br/>(with exogenous inflow/outflow)"]
    G["ARIMA<br/>(storage only)"]
    H["Compute seasonal avg<br/>future inflow/outflow"]
    I["Forecast → clamp to 0..capacity"]

    A --> B
    B -->|gap ≤ 15 days| C
    B -->|gap > 15 days| D
    C --> E
    D --> E
    E -->|Yes| H
    H --> F
    E -->|No| G
    F --> I
    G --> I
```

### Risk Scorer

Composite score (0–100) per ward, four weighted components:

| Component | Weight | Input |
|-----------|--------|-------|
| Groundwater depth | 40% | `groundwater_monthly` (≤3m = safe, >25m = crisis) |
| Year-on-year trend | 30% | Same month last year comparison |
| City reservoir stress | 20% | Total storage % across 6 reservoirs |
| Seasonal vulnerability | 10% | Month-based (monsoon = lower risk) |

### Days-Left Estimate

Three scenarios computed daily from current storage and net demand:

| Scenario | Inflow Assumption | Use Case |
|----------|-------------------|----------|
| Pessimistic | Zero inflow | Worst case / drought planning |
| Moderate | 7-day rolling avg inflow | Current conditions |
| Optimistic | Historical seasonal avg | Expected monsoon patterns |

**Key constants:** Consumption = 830 MLD, Desalination = 190 MLD (Minjur + Nemmeli).

## Frontend

```mermaid
graph TD
    Layout["RootLayout<br/>(Header + ThemeProvider)"]

    Layout --> Dashboard
    Layout --> GW["Groundwater Page"]
    Layout --> RV["Rivers Page"]
    Layout --> About["About Page"]

    subgraph Dashboard["Dashboard Page /"]
        DLH["DaysLeftHero<br/>Storage ring + 3 scenarios"]
        DC["DashboardContent<br/>(client component)"]
        GWS["GroundwaterSnapshot"]
    end

    subgraph DC_Children["DashboardContent"]
        RC["ReservoirCards<br/>(6 reservoirs)"]
        STC["StorageTrendChart<br/>(area + line, forecast overlay,<br/>inflow/outflow toggle)"]
    end

    DC --> DC_Children

    subgraph GW_Children["Groundwater Page"]
        GM["GroundwaterMap<br/>(Leaflet choropleth)"]
        GT["GroundwaterTrendChart"]
    end

    GW --> GW_Children

    subgraph RV_Children["Rivers Page"]
        RM["RiversMap<br/>(Leaflet polylines + station markers)"]
        RP["RiverPanel<br/>(status, chart, DO/BOD explainer)"]
        RQC["RiverQualityChart<br/>(Recharts dual-axis 2015–2024)"]
    end

    RV --> RV_Children
```

**Data flow:** Supabase → Server Component (ISR, 15-min revalidation) → Client Components (charts, interactivity). Demo mode with mock data when Supabase is not configured.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Service health + recent pipeline runs |
| POST | `/pipeline/run-daily` | Bearer | Full daily pipeline |
| POST | `/pipeline/run-monthly` | Bearer | Groundwater + risk scoring |
| POST | `/pipeline/run-intelligence` | Bearer | Forecast + risk + briefing only |
| GET | `/intelligence/forecast` | None | Latest reservoir forecasts |
| GET | `/intelligence/risk-scores` | None | Ward-level risk scores |
| GET | `/intelligence/briefing` | None | Daily intelligence briefing |

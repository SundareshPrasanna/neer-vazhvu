## Project Structure

A simplified map of the repository. For the full annotated tree, see
[CONTRIBUTING.md](../CONTRIBUTING.md#project-structure).

```
neer-vazhvu/
├── src/                          # Next.js frontend (App Router)
│   ├── app/
│   │   └── [cityId]/             # Per-city routes (dashboard, about, groundwater, rivers, ...)
│   ├── components/               # React components, mostly city-agnostic
│   ├── content/                  # Per-city written content (Origins, About, rivers, flood)
│   ├── lib/
│   │   ├── cities/               # City config registry: add a city by adding a file here
│   │   ├── hooks/                # Data-fetching hooks
│   │   ├── i18n/                 # EN/TA/KN translation keys
│   │   └── utils/                # Shared utilities
│   └── types/                    # TypeScript definitions
├── neer-vazhvu-api/              # Python API (FastAPI)
│   ├── app/
│   │   ├── scrapers/             # Data scrapers (CMWSSB, WRIS, Open-Meteo, ...)
│   │   ├── etl/                  # Pipeline orchestrator
│   │   ├── gee/                  # Earth Engine summaries
│   │   ├── intelligence/         # Forecaster, risk scorer, briefing
│   │   └── routers/              # API endpoints
│   ├── scripts/                  # API-side scripts (e.g. IMD rainfall extractor)
│   └── tests/                    # pytest suite
├── public/
│   ├── data/                     # Static JSON, follows the NVDM data standard
│   └── geojson/                  # Static spatial data
├── scripts/                      # One-time and build-time scripts
├── schemas/nvdm/                 # NVDM data standard (rules, guide, scopes)
├── supabase/migrations/          # Database schema
├── docs/                         # Design notes, methodology, per-city docs
└── .github/workflows/            # CI and scheduled data refreshes
```

The city list is longer than the five in `CONTRIBUTING.md`: every id in
`src/lib/cities/ids.ts` is a registered place.

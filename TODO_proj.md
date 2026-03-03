# Neer Vazhvu — Project TODO

> A living document for tracking ideas, tasks, and priorities.
> Add new ideas freely — we'll break them down into actionable tasks here.

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| P0 | Must-have before next launch |
| P1 | Important, do soon |
| P2 | Nice to have |
| P3 | Future / aspirational |

---

## River Health Dashboard (P1)

> Interactive map of Chennai's 4 major rivers color-coded by CPCB water quality class.
> Station-level DO/BOD time-series charts 2015–2024.
> Data: CPCB Annual Reports + IIT Madras studies. Static JSON, refreshed manually once per year.

### Data & Infrastructure
- [x] **OSM fetch script** — `scripts/fetch-rivers-osm.ts`: query Overpass for river ways/relations (Cooum, Adyar, Buckingham Canal, Kosasthalaiyar), group by name into MultiLineString features, write `public/geojson/chennai-rivers.geojson`
- [x] **Curate quality data** — `public/data/river-quality.json`: research DO/BOD values from CPCB annual reports (`cpcb.nic.in/nwmp-data/`), IIT Madras/Anna University studies, NGT bench orders — 4 rivers × ~3 stations × 10 years (2015–2024)
- [x] **TypeScript types** — `src/types/river-quality.ts`: `RiverQualityStatus`, `RiverQualityReading`, `RiverStation`, `RiverData`, `RiverQualityData`, `SelectedRiver`, `QUALITY_COLORS`, `QUALITY_LABELS`

### Frontend Components
- [x] **Legend** — `src/components/rivers/rivers-legend.tsx`: 5-item card (Dead/red · Severely Degraded/orange · Degraded/yellow · Stressed/lime · Healthy/green)
- [x] **Quality chart** — `src/components/rivers/river-quality-chart.tsx`: Recharts `LineChart` with two lines (DO blue left-axis, BOD orange right-axis), reference lines at DO=4 and BOD=2, custom tooltip, `ResponsiveContainer`
- [x] **Rivers map** — `src/components/rivers/rivers-map.tsx`: Leaflet `GeoJSON` polylines (colored by `overall_status` via `river_id` join), station `circleMarker` layer, `LayersControl` toggles, hover highlight, click → `onSelect`
- [x] **River panel** — `src/components/rivers/river-panel.tsx`: status badge, stats row (length/CPCB class/latest DO), station tab selector, `RiverQualityChart`, callout note, description/notes, source + `last_updated`
- [x] **Rivers page** — `src/app/rivers/page.tsx`: `"use client"`, fetch `river-quality.json`, stats bar (4 rivers · Cooum DO ~0 mg/L · last updated), `dynamic()` SSR-disabled map, panel bottom-sheet/sidebar layout

### Integration
- [x] **Header nav** — add `{ href: "/rivers", label: "Rivers" }` between Groundwater Map and About in `src/components/layout/header.tsx`

### Quality & Docs
- [ ] **Lint + build** — `npm run lint && npm run build` zero errors; `ruff check . && ruff format --check .` clean
- [ ] **Annual refresh process** — when CPCB publishes next report: update readings in `river-quality.json`, bump `last_updated` field, commit `data: update river quality readings to {year}`

---

## Water Dashboard Enhancements (P1)

- [ ] **Rainfall visualization** — Dedicated rainfall chart/overlay using NASA POWER precipitation data (already fetched daily)
- [ ] **Day Zero comparison** — Prominent "Today vs 2019 Day Zero" widget (data already in `comparison2019Storage`)
- [ ] **Daily briefing card** — Display `daily_briefing` (headline, alerts, recommendations) on dashboard — API generates it, frontend doesn't show it yet
- [ ] **Risk map layer** — Visualize `ward_risk_score` on groundwater Leaflet map (color wards by risk level)
- [ ] **Mobile responsiveness polish** — Dashboard is desktop-first; test and fix on mobile breakpoints

## Tamil Localization (P1)

- [ ] **i18n setup** — Add `next-intl` for Tamil + English toggle
- [ ] **Translate UI** — Dashboard labels, hero text, nav, about page
- [ ] **Tamil typography** — Test line-height, flexible layouts (Tamil text is 20-40% longer)
- [ ] **Indian number formatting** — Lakhs/crores where appropriate

## Testing (P1)

- [ ] **Python API tests** — Scrapers, ETL pipeline, forecaster, risk scorer (empty `tests/` dir exists, pytest installed)
- [ ] **Frontend build validation** — Add Vitest or Jest for component smoke tests
- [ ] **Scraper resilience tests** — Mock CMWSSB HTML changes, NASA API failures

## V2 Features (P2)

- [ ] **Personal water calculator** — "How much water does your household use vs. what's sustainable?"
- [ ] **Citizen water quality reporting** — Report water issues with photo + geolocation
- [x] **Lost water bodies map** — Interactive map showing 150+ lakes/tanks lost to development (OSM data)
- [ ] **Flood risk overlay** — Address-based flood risk using elevation + proximity to water bodies
- [ ] **Seawater intrusion map** — Coastal areas where borewell water is turning saline (CGWB data)
- [ ] **Open data downloads** — Let researchers download cleaned datasets via API/CSV

## Multi-Environmental Expansion — Suzhal Vision (P3)

> Long-term goal: evolve from water dashboard → full Chennai Environmental Atlas

- [ ] **Air quality layer** — Real-time AQI from OpenAQ/CPCB (excellent free API, ~4 Chennai stations)
- [ ] **Heat island layer** — Satellite-derived land surface temperature from Google Earth Engine
- [ ] **Waste & industrial pollution** — GCC solid waste data, TNPCB industrial zones
- [ ] **Story mode** — Guided narratives: "The Day Zero Story", "The Marsh That Saves Chennai"
- [ ] **Gamification** — Eco-challenges, streaks, badges tied to water conservation actions
- [ ] **PWA / offline support** — Service worker for areas with spotty connectivity

## Infra & DX (P2)

- [ ] **Staging environment** — Preview deploys on PRs (Vercel preview)
- [ ] **Error monitoring** — Sentry or similar for production error tracking
- [ ] **API rate limiting & caching** — Protect FastAPI endpoints
- [ ] **Evaporation modeling** — Factor evaporation into days-left estimate (not currently modeled)

## Ideas / Backlog

> Drop raw ideas here — we'll prioritize and break them down later.

-
-
-

---

*Last updated: 2026-03-03*

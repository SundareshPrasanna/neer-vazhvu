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

## Risk Map Layer (P1)

> Add a **Depth | Risk** toggle to the existing groundwater page. Risk mode recolors the 200-ward
> choropleth by composite risk score (0–100) from `ward_risk_score`, showing Low/Moderate/High/Critical
> instead of the 7-level depth scale. Ward detail panel gains a risk score breakdown section.
> No new page or nav item — all within `/groundwater`.

### Data

Risk score schema (`ward_risk_score`): `ward_number`, `computed_date`, `risk_score` (0–100),
`risk_level` (Low / Moderate / High / Critical), plus four component columns:
`groundwater_component`, `trend_component`, `reservoir_component`, `seasonal_component`.
Weights: groundwater 40%, trend 30%, reservoir 20%, seasonal 10%.
Risk levels: Low 0–25 · Moderate 26–50 · High 51–75 · Critical 76–100.

### Files to create (2)

| File | Purpose |
|------|---------|
| `src/app/api/groundwater/risk/route.ts` | GET — fetch latest `ward_risk_score` from Supabase; mock fallback |
| *(extend)* `src/lib/mock-data.ts` | Add `generateMockRiskScores()` with realistic spread across 200 wards |

### Files to modify (4)

| File | Change |
|------|--------|
| `src/types/groundwater.ts` | Add `WardRiskData` interface, `getRiskColor(level)`, `getRiskLabel(level)` helpers |
| `src/components/groundwater/ward-map.tsx` | Accept `viewMode: 'depth' \| 'risk'` + `riskData: Map<number, WardRiskData>` props; branch coloring on `viewMode` |
| `src/components/groundwater/legend.tsx` | Accept `viewMode` prop; show 4-level risk legend or existing 7-level depth legend |
| `src/components/groundwater/ward-detail-panel.tsx` | When `riskData` available: show risk score badge + 4 component progress bars below depth stats |
| `src/app/groundwater/page.tsx` | Add `viewMode` state; fetch `/api/groundwater/risk` in parallel with depth data; pass both to map + legend + panel; render toggle buttons above map |

### Toggle UI

Two-button pill toggle anchored top-right inside the map overlay (same area as the period label):

```
[ Depth ]  [ Risk Score ]
```

Active button: `bg-blue-600 text-white`, inactive: `bg-white text-slate-600 border`.

### Risk color scale

| Level | Score | Color | Tailwind |
|-------|-------|-------|---------|
| Low | 0–25 | `#22c55e` | green-500 |
| Moderate | 26–50 | `#eab308` | yellow-500 |
| High | 51–75 | `#f97316` | orange-500 |
| Critical | 76–100 | `#dc2626` | red-600 |
| No data | — | `#9ca3af` | gray-400 |

### Ward panel risk section

Below the existing depth/trend stats, add a collapsible (or always-visible) section:

```
Risk Score: 68 / 100          [HIGH badge]

Groundwater depth    ████████░░  40/40
Year-on-year trend   █████░░░░░  20/30
Reservoir stress     ████░░░░░░  16/20
Seasonal factor      ██░░░░░░░░   8/10
```

Progress bars: proportional fill, coloured by component contribution.
Only shown when `riskData` has an entry for this ward.

### API route — `GET /api/groundwater/risk`

- Query `ward_risk_score` for the most recent `computed_date`
- Return `{ computed_date, wards: Array<{ wardNumber, riskScore, riskLevel, groundwaterComponent, trendComponent, reservoirComponent, seasonalComponent }> }`
- Mock fallback: `generateMockRiskScores()` with realistic distribution (40% low, 35% moderate, 15% high, 10% critical)

### Implementation order

1. Type additions (`src/types/groundwater.ts`)
2. Mock data (`src/lib/mock-data.ts` — `generateMockRiskScores`)
3. API route (`src/app/api/groundwater/risk/route.ts`)
4. Map component — `viewMode` branch
5. Legend — `viewMode` branch
6. Ward panel — risk section
7. Page — fetch + state + toggle UI
8. `npm run lint && npm run build` — zero errors

---

## Water Dashboard Enhancements (P1)

- [ ] **Daily briefing card** — Display `daily_briefing` (headline, alerts, recommendations) on dashboard — API generates it, frontend doesn't surface it yet
- [ ] **Day Zero comparison** — Prominent "Today vs 2019 Day Zero" widget (data already in `comparison2019Storage`)
- [ ] **Rainfall visualization** — Dedicated rainfall chart/overlay using NASA POWER precipitation data (already fetched daily)

## Tamil Localization (P1)

- [ ] **i18n setup** — Add `next-intl` for Tamil + English toggle
- [ ] **Translate UI** — Dashboard labels, hero text, nav, about page
- [ ] **Tamil typography** — Test line-height, flexible layouts (Tamil text is 20-40% longer)
- [ ] **Indian number formatting** — Lakhs/crores where appropriate

## Testing (P1)

- [ ] **Python API tests** — Scrapers, ETL pipeline, forecaster, risk scorer (empty `tests/` dir exists, pytest installed)
- [ ] **Frontend build validation** — Add Vitest or Jest for component smoke tests
- [ ] **Scraper resilience tests** — Mock CMWSSB HTML changes, NASA API failures

## Annual Data Refresh

- [ ] **River quality** — When CPCB publishes next annual report: update readings in `public/data/river-quality.json`, bump `last_updated` and `data_year_range`, commit `data: update river quality readings to {year}`
- [ ] **Water bodies OSM** — Re-run `scripts/fetch-water-bodies-osm.ts` once a year to pull fresh polygon data from OpenStreetMap
- [ ] **River geometry OSM** — Re-run `scripts/fetch-rivers-osm.ts` if river alignments change significantly in OSM

## V2 Features (P2)

- [ ] **Personal water calculator** — "How much water does your household use vs. what's sustainable?"
- [ ] **Citizen water quality reporting** — Report water issues with photo + geolocation
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

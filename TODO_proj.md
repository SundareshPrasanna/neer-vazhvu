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

## Water Dashboard Enhancements (P1)

- [x] **Daily briefing card** - Rendered via CityStory + NewsSection components with AI-generated narrative
- [x] **Day Zero comparison** - "Today vs 2019 Day Zero" shown prominently in DaysLeftHero with live diff
- [x] **Rainfall visualization** - RainfallTrends component on dashboard showing monthly rainfall vs 1970-2020 IMD normal

## Tamil Localization (P1)

- [x] **i18n setup** — Custom context-based i18n with `LanguageProvider`, `useLanguage()` hook, localStorage persistence (done — no external library needed)
- [x] **Translate UI** — ~500 translation keys covering dashboard, hero, nav, about, groundwater, rivers, water bodies, reservoir names, chart labels, ARIA labels
- [x] **Locale-aware formatting** — Date formatting uses `ta-IN`/`en-IN` locales; reservoir names translated
- [x] **i18n validation** — `npm run i18n:check` script ensures Tamil parity; see [TRANSLATION_GAP_TODOS.md](TRANSLATION_GAP_TODOS.md) for remaining edge cases
- [ ] **Tamil typography** — Test line-height, flexible layouts (Tamil text is 20-40% longer)
- [ ] **Typed translation keys** — Compile-time safety for translation key usage (see TRANSLATION_GAP_TODOS.md P2)
- [ ] **Language flash** — Avoid first-paint English flash for Tamil users (see TRANSLATION_GAP_TODOS.md P3)

## Testing (P1)

> See [todo_tests.md](todo_tests.md) for the detailed test coverage roadmap.

- [x] **Baseline tests** — Frontend utility tests (`date.test.ts`, `format.test.ts`) and API tests (`test_estimate.py`, `test_timezone.py`) running in CI
- [ ] **P0: Scraper resilience tests** — Mock CMWSSB HTML changes, fixture replay, retry behavior
- [ ] **P0: Pipeline orchestration tests** — Idempotent upserts, date-window handling, partial failures
- [ ] **P1: Forecast/risk scoring regression** — Deterministic golden-fixture tests
- [ ] **P1: Frontend API route contracts** — Success/failure shape tests with mocked Supabase
- [ ] **P2: Component smoke tests** — Critical panels with empty/partial/outlier data

## Annual Data Refresh

- [ ] **River quality** — When CPCB publishes next annual report: update readings in `public/data/river-quality.json`, bump `last_updated` and `data_year_range`, commit `data: update river quality readings to {year}`
- [ ] **Water bodies OSM** — Re-run `scripts/fetch-water-bodies-osm.ts` once a year to pull fresh polygon data from OpenStreetMap
- [ ] **River geometry OSM** — Re-run `scripts/fetch-rivers-osm.ts` if river alignments change significantly in OSM

## My Ward & Navigation (P1) - Done

- [x] **My Ward tab** - Unified ward report page at `/my-ward` aggregating groundwater, water bodies, flood risk, infrastructure, rivers, representatives, and AI narrative for any ward. Source attribution and caveats on every card. CSV export, share URL, print layout
- [x] **Nav consolidation** - Dashboard, My Ward, Facts, Explore (dropdown: Groundwater, Water Bodies, Rivers, Flood Risk), About. Mobile menu has collapsible Explore section
- [x] **Ward Report Card** - Print-optimized one-pager at `/my-ward/report?ward=N` ranking wards on 5 governance-quality metrics with A-F grades. Length-based infrastructure metrics apportioned across ward boundaries, area-normalized densities, zone/city median comparisons, methodology disclosure
- [x] **Ward comparison tool** - Side-by-side comparison of multiple wards at `/my-ward/compare?wards=N,M,...`
- [x] **Chennai Water Facts page** - Quotable journalist-ready snapshot at `/facts` with 4 freshness tiers (Today/This Year/History/Infrastructure), Schema.org Observation structured data, public JSON API at `/api/facts`, copy-quote / tweet / link buttons

## V2 Features (P2)

- [ ] **Personal water calculator** - "How much water does your household use vs. what's sustainable?" (current calculator is city-level, not household)
- [ ] **Citizen water quality reporting** - Report water issues with photo + geolocation
- [ ] **Address-level flood risk** - Exact geocoded address flood score (currently ward-level resolution only)
- [ ] **Seawater intrusion / groundwater quality map** - Coastal salinity, fluoride, arsenic (CGWB WDO_GWQ; automated readings not currently accessible as public API)
- [ ] **Open data downloads** - Bulk dataset download for researchers (currently ward-level CSV export only)
- [ ] **Tanker dependency map** - Ward-level tanker dependency index (OpenCity CSV data available, not yet integrated)

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

---

*Last updated: 2026-04-19*

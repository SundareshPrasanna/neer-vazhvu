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

- [ ] **Daily briefing card** — Display `daily_briefing` (headline, alerts, recommendations) on dashboard — API generates it, frontend doesn't surface it yet
- [ ] **Day Zero comparison** — Prominent "Today vs 2019 Day Zero" widget (data already in `comparison2019Storage`)
- [ ] **Rainfall visualization** — Dedicated rainfall chart/overlay using NASA POWER precipitation data (already fetched daily)

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

## IUDX Real-Time Flood Monitoring (P1)

> 241 water level sensors across Chennai (canals, lakes, subways, rivers) via IUDX.
> Data: water level in cm at 1-minute intervals. Access policy: SECURE (client credentials obtained).
> Resource group ID: `257aab1b-1258-445a-a37e-058486a2fa13`
> Catalogue API: `https://api.catalogue.iudx.org.in/iudx/cat/v1/`
> Resource server: `https://rs.iudx.org.in/ngsi-ld/v1/entities/`

- [ ] **Auth integration** — Token flow using client ID/secret via IUDX auth server. Store credentials in env, implement token refresh in backend.
- [ ] **Sensor catalogue fetch** — Pull all 241 sensor IDs + names + locations from catalogue API. Map to our ward/river geometry.
- [ ] **Live water level layer** — Real-time sensor readings on the flood risk map. Color-code by level (normal/warning/danger).
- [ ] **Subway flooding alerts** — 27 subway/underpass sensors - surface current water levels on flood risk page.
- [ ] **Canal & river level overlay** — 29 canal + 5 river sensors - show water levels along river/canal polylines.
- [ ] **Lake level monitoring** — 5 lake sensors (Ambattur, Narayanapuram, Korattur, etc.) - integrate with water bodies page.

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

---

*Last updated: 2026-04-02*

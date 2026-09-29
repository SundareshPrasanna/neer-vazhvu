# Backlog

Open items carried over from the three root TODO files, retired on 2026-09-29. Items since shipped, or about code that no longer exists, were dropped.

## TODO_proj.md: product ideas and platform work (last updated 2026-04-19)

- [ ] Tamil typography: test line-height and flexible layouts, since Tamil text runs 20-40% longer than English.
- [ ] Personal water calculator: a household's use against a sustainable level.
- [ ] Citizen water quality reporting with photo and geolocation.
- [ ] Address-level flood risk (resolution today is the ward).
- [ ] Groundwater quality map: salinity, fluoride, arsenic (CGWB WDO_GWQ readings are not available as a public API).
- [ ] Open data downloads: bulk datasets for researchers.
- [ ] Tanker dependency map: a ward-level tanker dependency index.
- [ ] Air quality layer: AQI from OpenAQ or CPCB.
- [ ] Heat island layer: land surface temperature from Google Earth Engine.
- [ ] Solid waste layer from GCC data.
- [ ] Gamification: challenges, streaks and badges tied to water conservation.
- [ ] Offline support: a service worker for areas with patchy connectivity.
- [ ] Production error monitoring (Sentry or similar).
- [ ] Rate limiting and caching on the FastAPI endpoints.
- [ ] Evaporation in the days-left estimate (not modelled today).

## TRANSLATION_GAP_TODOS.md: translation quality and i18n (last updated 2026-03-22)

- [ ] Typed translation keys: export `TranslationKey = keyof typeof translations` and type `t` with it, with an escape hatch for dynamic keys, so an invalid key fails `tsc`.
- [ ] Extend `scripts/check-i18n.ts` to flag likely hardcoded user-facing strings in JSX text and ARIA attributes, with an allowlist for false positives.
- [ ] No first-paint English flash for returning Tamil users: bootstrap the language from a cookie or inline script (`src/lib/i18n/context.tsx`, `src/app/layout.tsx`).
- [ ] A Tamil QA checklist for release validation: headers, loaders, tooltips, charts, overlays, ARIA labels and `*_ta` data fields.

## todo_tests.md: test coverage roadmap (2026-03-04)

- [ ] CMWSSB scraper (`neer-vazhvu-api/app/scrapers/cmwssb.py`): replay stored HTML snapshots and test retry and timeout behaviour. Row parsing is covered in `neer-vazhvu-api/tests/test_cmwssb_scraper.py`.
- [ ] Pipeline orchestration (`neer-vazhvu-api/app/etl/pipeline.py`, `app/routers/pipeline.py`): idempotent upserts, IST date windows, partial upstream failures, status codes.
- [ ] Forecast and risk scoring (`neer-vazhvu-api/app/intelligence/`): golden-fixture regression tests, including risk bucket boundaries.
- [ ] Next.js API route contracts: success and failure response shapes against a mocked Supabase client.
- [ ] Data scripts (`scripts/fetch-*.ts` and similar): fixture-based parsing tests and clear exit codes.
- [ ] Component smoke tests for dashboard and groundwater panels with empty, partial and outlier data.
- [ ] End-to-end smoke in CI: synthetic scrape, pipeline and API read path.
- [ ] Coverage reporting in CI, with thresholds raised gradually.

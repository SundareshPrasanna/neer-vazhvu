# Phase 2 Backend Architecture Refactor Research

Status: draft design report, no implementation changes.

Main inspected without checking out the worktree: `f53e6c40409933b2925dff7b9ef5dc3b3a222585`.

Active branch also inspected for future-baseline impact: `mumbai_onboarding`.

Phase 2 should begin only after Phase 1 database decisions are accepted. The webapp is live and Vercel auto-deploys on merge, so every backend PR must be deploy-safe on its own: additive interfaces first, route/job cutover second, old endpoint/script cleanup last.

## Scope

Backend here means five surfaces:

- Python FastAPI service under `neer-vazhvu-api/app`.
- Python one-off and scheduled scripts under `neer-vazhvu-api/scripts`.
- TypeScript scripts under root `scripts`, when executed by workflows as backend jobs.
- Next.js API and cron routes under `src/app/api`.
- GitHub Actions workflows that run backend jobs or publish generated artifacts.

Out of scope for this report:

- UI component refactors.
- Database schema changes, except where backend sequencing depends on Phase 1.
- Admin app implementation, except where backend APIs should prepare for it.

## Current Backend Shape

### FastAPI Service

FastAPI currently exposes a small service:

- `/health`
- `/pipeline/run-daily`
- `/pipeline/run-post-scrape`
- `/pipeline/run-monthly`
- `/pipeline/run-intelligence`
- `/pipeline/run-wris-fetch`
- `/pipeline/run-census-fetch`
- `/intelligence/forecast`
- `/intelligence/risk-scores`
- `/intelligence/briefing`

The service uses a singleton Supabase service-role client from `app/db.py`. That is fine for trusted server jobs, but it means most service modules are tightly coupled to live Supabase calls and are hard to test without patching global state.

The pipeline orchestrator in `app/etl/pipeline.py` remains Chennai-v1 shaped. It directly writes:

- `pipeline_log`
- `reservoir_daily`
- `weather_daily`
- `groundwater_monthly`
- `groundwater_wris`
- `wris_river_level`
- `wris_rainfall`
- `water_estimate_daily`
- `water_bodies_census`

Through the intelligence modules it calls, it also orchestrates writes to:

- `reservoir_forecast`
- `ward_risk_score`
- `daily_briefing`

The orchestrator does useful sequencing and logging, but it is no longer the only daily pipeline. GitHub Actions already runs several standalone scripts directly.

### Standalone Python Scripts

Several production-relevant scripts bypass the FastAPI orchestrator and write directly to Supabase:

- Chennai CMWSSB scraper writes `reservoir_daily`.
- Madurai/Bangalore TN PWD scraper writes `reservoir_daily_v2`.
- Madurai/Bangalore v2 forecasters write `reservoir_forecast_v2`.
- Madurai/Bangalore WRIS groundwater scripts write `groundwater_wris`.
- Madurai WRIS river/rainfall scripts write `wris_river_level` and `wris_rainfall`.
- Mumbai numerical/BMC lake scraper writes `reservoir_daily_v2`.
- Mumbai Pravah script writes both `public/data/mmr-dam-storage.json` and, with `--supabase`, BMC lake rows into `reservoir_daily_v2`.

The scripts often include their own copies of:

- env loading and validation
- Supabase client creation
- retry loops
- stale-data fallback checks
- pagination
- logging to stdout/stderr
- city/source constants

That duplication is understandable from fast onboarding, but it will compound with each city.

### Next.js API Routes

The Next app has a second backend plane under `src/app/api`.

Read-oriented routes include:

- reservoir snapshot/history
- calculator
- groundwater current/history/risk/stations/ward/interpolated
- narratives
- water body census and GEE summaries
- cascade catchment payloads
- facts
- localities and wards
- OG image routes
- health

Cron/write routes still exist:

- `/api/cron/scrape-cmwssb`
- `/api/cron/fetch-nasa`
- `/api/cron/fetch-opencity`
- `/api/cron/compute-estimate`

These cron routes use the Supabase service-role client inside Vercel. They duplicate logic now also present in Python. Some may be legacy, but as long as they are routable they are part of the live backend surface.

Repo evidence strongly suggests they have no scheduled callers today: there is no `vercel.json`, so Vercel Cron cannot be configured from this repo, and no GitHub workflow references `/api/cron/**`. The residual unknown is only manual or external POST callers that know `CRON_SECRET`.

### GitHub Actions

The daily pipeline on `main` already treats FastAPI as best-effort:

- city scrapers run directly in GitHub Actions
- FastAPI `/pipeline/run-post-scrape` is called with `continue-on-error`
- v2 reservoir forecasts run as standalone scripts
- Node narrative generation runs separately and writes to Supabase

The active Mumbai branch adds:

- daily Mumbai lake scrape into `reservoir_daily_v2`
- daily Pravah dam-storage static artifact refresh, with optional Supabase upsert
- weekly BMC flood-hotspot artifact refresh

This means Phase 2 is not just "refactor FastAPI." The true backend is a distributed job system made of GitHub Actions, Python scripts, FastAPI, Next API routes, Supabase, and static artifacts.

## Scheduled Job Inventory

This inventory is intentionally backend-oriented: what runs, where it runs, and what it mutates.

| Workflow | Schedule | Runtime | Primary writes |
| --- | --- | --- | --- |
| `daily-data-pipeline.yml` | daily 06:00 IST | Python scripts, FastAPI call, Node script | Supabase reservoir/weather/groundwater/estimate/forecast/briefing/narrative tables |
| `gee-phase1.yml` | daily, weekly, monthly | Python GEE scripts | Supabase GEE tables: `reservoir_catchment_context`, `water_body_satellite_summary` |
| `imd-rainfall-refresh.yml` | quarterly | Python script | committed static JSON under `public/data/imd-rainfall-monthly*.json` |
| `overture-buildings-refresh.yml` | monthly | Python script | committed rich-body JSON, or candidate PR on anomaly |
| `coastal-shoreline-refresh.yml` | yearly | Python GEE script | PR with refreshed `public/geojson/chennai-coastal-transects.geojson` |
| `supabase-keepalive.yml` | every 2 days | curl | no data write; pings `/api/health` |
| `pravah-dam-refresh.yml` on Mumbai branch | daily | Python script | committed `public/data/mmr-dam-storage.json`; optional `reservoir_daily_v2` upsert |
| `bmc-floodspots-refresh.yml` on Mumbai branch | weekly | Python script | committed `public/data/mumbai-flood-hotspots.geojson` |

Job categories:

- DB ingestion jobs: write canonical/observation tables.
- DB derived jobs: compute forecasts, estimates, risk, briefings.
- Static artifact jobs: regenerate public files and commit or open PR.
- Hybrid jobs: produce static artifacts and also upsert DB rows.
- Health jobs: ping deployed endpoints.

Phase 2 should name these categories explicitly. A static artifact job should not be migrated into a DB write merely because it runs in Python.

## API Route Inventory

### FastAPI

| Route family | Role | Phase 2 direction |
| --- | --- | --- |
| `/pipeline/**` | authenticated job triggers | keep short term; make routes thin wrappers over reusable jobs |
| `/intelligence/**` | public read API over legacy computed tables | keep only if external consumers exist; otherwise prefer Next BFF/public routes |
| `/health` | service health | keep; expand with job freshness only after logging is standardized |

### Next.js API Routes

| Route family | Role | Phase 2 direction |
| --- | --- | --- |
| `/api/cron/**` | routable authenticated write routes, with no repo-managed schedule found | retire or disable after manual/external caller audit |
| `/api/reservoir/**` | public reservoir adapter | keep, but move legacy/v2 branching into server query modules |
| `/api/calculator` | public Chennai v1 calculator | merge into shared city water-estimate adapter after reservoir v2 cutover |
| `/api/groundwater/**` | public DB/static adapters | keep, standardize city validation/cache/error behavior |
| `/api/water-bodies/**` | public DB adapters for census/GEE | keep, align city/body scoping with Phase 1 DB work |
| `/api/cascade/**` | public static-file composer | keep near frontend; register assets/provenance rather than DB-normalizing now |
| `/api/facts`, `/api/narratives/**` | public content/data adapters | keep, move domain queries behind shared server modules |
| `/api/wards`, `/api/localities` | public static JSON adapters | keep until admin/data registry work changes source of truth |
| `/api/og/**` | image generation | keep in Next |
| `/api/health` | app/Supabase health | keep; do not confuse with FastAPI `/health` |

The report should treat FastAPI `/health` and Next `/api/health` as separate endpoints. The keepalive workflow hits the Next endpoint through `APP_URL`.

## Evidence Snapshot

Useful anchors for future implementation PRs:

- FastAPI app is thin: `neer-vazhvu-api/app/main.py` only mounts health, pipeline, and intelligence routers.
- Supabase service-role singleton lives in `neer-vazhvu-api/app/db.py`.
- Chennai v1 orchestration lives in `neer-vazhvu-api/app/etl/pipeline.py`, `neer-vazhvu-api/app/intelligence/forecaster.py`, `neer-vazhvu-api/app/intelligence/risk_scorer.py`, and `neer-vazhvu-api/app/intelligence/briefing.py`.
- v2 reservoir ingestion already exists in `neer-vazhvu-api/scripts/scrape_tn_pwd_reservoirs.py` and, on the Mumbai branch, `neer-vazhvu-api/scripts/scrape_numerical_mumbai_lakes.py`.
- v2 reservoir forecasting is duplicated in `compute_reservoir_forecast_madurai.py` and `compute_reservoir_forecast_bangalore.py`.
- Next cron write routes still exist in `src/app/api/cron/**`.
- No `vercel.json` exists and no GitHub workflow references `/api/cron/**`, so these routes have no repo-managed scheduled caller.
- Next public read routes use direct Supabase reads and static-file composition under `src/app/api/**`.
- The main city loader, `src/app/[cityId]/data.ts`, already has v2 reservoir loaders plus legacy Chennai fallback.
- The GitHub Actions daily pipeline treats the FastAPI post-scrape call as best-effort and runs several scripts directly.
- The GitHub Actions daily/monthly narrative step runs `scripts/generate-narratives.ts`, which writes to `daily_briefing` and `ward_narrative` with `SUPABASE_SERVICE_ROLE_KEY`.
- The Mumbai branch adds DB ingestion jobs and static artifact refresh jobs; both must be recognized in Phase 2 planning.

## Dependency On Phase 1 DB Work

Backend refactoring should follow Phase 1's database safety sequence:

- Do not schedule second-city writes into city-blind tables while old city-blind constraints still coexist with new city-aware keys.
- Keep Chennai reservoir v1 compatibility until the reservoir v2 backfill, writer cutover, reader cutover, and RPC cutover are complete.
- Treat migration 026/live-schema reconciliation as a prerequisite for backend jobs that rely on `city_id` constraints.
- When backend writers change `on_conflict` targets, deploy them only after the matching database arbiter index exists.
- When old constraints are later dropped, confirm deployed backend writers no longer use the old conflict key.

This matters most for weather, groundwater, WRIS telemetry, water estimates, daily briefings, ward risk, ward narratives, census rows, and GEE summary writes.

## First Findings

### 1. The backend has three DB write planes

Writes happen from Python, Next.js cron routes, and TypeScript scripts running in GitHub Actions:

- Python service/scripts use `SUPABASE_SERVICE_KEY`.
- Next cron routes use `SUPABASE_SERVICE_ROLE_KEY`.
- `scripts/generate-narratives.ts` also uses `SUPABASE_SERVICE_ROLE_KEY` from GitHub Actions and writes AI fields in `daily_briefing` plus monthly `ward_narrative` rows.

The direct duplicate examples are strongest for Chennai:

- `neer-vazhvu-api/scripts/scrape_cmwssb.py`
- `src/app/api/cron/scrape-cmwssb/route.ts`
- `app/etl/pipeline.py::_step_scrape_cmwssb`

All write the v1 reservoir family.

Similarly, estimate/weather/OpenCity logic exists in both Python and Next cron routes.

The Next cron routes are a routable security/maintenance surface, but repo evidence indicates they are not scheduled: no `vercel.json` exists, and no GitHub workflow references `/api/cron/**`. Their likely live use is manual/external POST only.

Recommendation:

- Pick Python jobs as the preferred production write plane for data ingestion and derived DB writes.
- Either migrate narrative generation into the Python job framework, or explicitly document `scripts/generate-narratives.ts` as the one TypeScript DB-writing exception while it remains.
- Keep Next API routes read-only, plus OG/static payload adapters.
- Retire or disable Next cron write routes after confirming no manual or external callers depend on them.
- If a Vercel route must write in the future, make it a thin authenticated trigger for a named job, not an implementation of the job itself.

### 2. The FastAPI orchestrator is less production-critical than the workflow file implies

`daily-data-pipeline.yml` already marks the FastAPI post-scrape call `continue-on-error`. Madurai/Bangalore v2 forecasts do not depend on it. Mumbai ingestion on the active branch also does not depend on it.

Today the FastAPI orchestrator mainly owns:

- Chennai weather fetch and estimate
- Chennai v1 forecast
- Chennai briefing
- Chennai WRIS fetches when called through pipeline endpoints
- monthly OpenCity/risk scoring when the endpoint is reachable

Recommendation:

- Reframe FastAPI as a job API and shared library host, not as the only orchestrator.
- In the short term, keep GitHub Actions as the scheduler because it is already operating that way.
- Move duplicated job internals into importable Python modules used by both CLI scripts and FastAPI routes.
- Only later decide whether to centralize scheduling into FastAPI, a worker, Supabase scheduled jobs, or keep Actions.

### 3. Reservoir v2 has a better backend pattern, but it is duplicated per city

Madurai and Bangalore forecast scripts are almost identical. The Bangalore script even logs "Madurai" in user-facing output, which confirms copy/paste drift.

The right abstraction is not one script per city. It is:

```text
python -m app.jobs.reservoir_forecast --city madurai
python -m app.jobs.reservoir_forecast --city bangalore
python -m app.jobs.reservoir_forecast --city mumbai
```

The job should read `water_sources` for the city, fetch `reservoir_daily_v2`, forecast each source, and upsert `reservoir_forecast_v2`.

Recommendation:

- Create a generic v2 reservoir forecast job before adding more city-specific forecast scripts.
- Parameterize city, horizon, history window, minimum history, and model options.
- Keep city-specific source inclusion/exclusion in DB/config, not script filenames.
- Keep Chennai on a compatibility path until Phase 1 reservoir cutover is done.

### 4. City config is split across Python, TypeScript, SQL, and workflows

The frontend `PlaceConfig` is now richer than Python `CityConfig`. It includes feature flags, hero modes, language availability, water-body capabilities, route availability, and preview-city behavior.

Python `CityConfig` contains only scraper/job-relevant facts. That is acceptable if intentional, but dangerous if both are treated as product truth.

Mumbai makes this sharper:

- frontend models Mumbai as a `region` with corporations
- Python models Mumbai as BMC/city-shaped with 24 wards
- SQL adds `place_kind`, `corporations`, and `source_corporation`

Recommendation:

- Define ownership explicitly:
  - DB/manifest owns factual place/source/admin-unit metadata.
  - frontend config owns UI feature availability and renderer choices.
  - Python config owns job defaults only until it can be generated.
- Add a consistency check that compares shared factual fields across SQL seed data, TypeScript config, and Python config.
- Do not expand Python `CityConfig` into a second full product config model.

### 5. Ingestion, transformation, and persistence are interleaved

Most scraper scripts do all of this in one file:

- fetch upstream data
- parse source-specific payloads
- normalize units and names
- decide stale fallback behavior
- write to Supabase
- print operational logs

That makes the parsing code harder to unit-test and makes DB cutovers risky because a schema change touches fetching/parsing logic.

Recommendation:

- Standardize each ingestion job into three layers:
  - source client/parser: no Supabase, pure return models
  - domain mapper: source payload to canonical rows, unit conversions, source aliases
  - sink/job runner: retries, stale fallback, Supabase upsert, lineage logging
- Existing scraper modules under `app/scrapers` are already a start; move more logic from scripts into reusable job modules.

### 6. Logging exists, but lineage is too thin for multi-city operations

`pipeline_log` records step, status, row count, duration, and error message. It does not consistently capture:

- city/place scope
- source system
- job parameters
- input/output date ranges
- upstream URL or artifact path
- code version
- data freshness outcome
- partial success details by city/source

Recommendation:

- Keep `pipeline_log` short term for compatibility.
- Add a richer `ingestion_runs` / `job_runs` abstraction after Phase 1 DB design lands.
- Update job wrappers to log one parent run plus child results per city/source.
- Use the same run model for DB writes and generated static artifact refreshes.

### 7. Next read routes should become typed backend adapters

Many Next API routes are useful product adapters, not just pass-throughs. Examples:

- `/api/cascade/[cityId]/catchment` reads multiple static JSON/GeoJSON files and returns a composed payload.
- groundwater routes combine DB rows, ward names, mock fallback, and interpolation.
- reservoir history has a v2 path plus Chennai legacy path.

These routes are fine to keep in Next because they are close to the frontend and benefit from Vercel caching. The problem is inconsistency:

- error handling varies by route
- cache headers are partly middleware, partly route-local
- some routes silently return empty/mock data
- some routes read DB directly, others read static files, others do both
- city scoping is inconsistent

Recommendation:

- Keep Next public read routes, but standardize them as "BFF adapters" for the app.
- Add shared route helpers for:
  - city/place parsing and enabled/preview checks
  - cache policy
  - error shape
  - Supabase read client construction
  - optional demo/mock fallback
- Move domain queries into `src/server/**` or `src/lib/server/**` modules so routes stay thin.

### 8. Auth and write safety need clearer boundaries

FastAPI pipeline routes and Next cron routes both use bearer cron auth. Next has a development bypass only when both `NODE_ENV === "development"` and `ALLOW_UNPROTECTED_CRON=true`; FastAPI does not.

Recommendation:

- Keep bearer auth for scheduler-triggered jobs, but centralize policy per backend plane.
- For production writes, prefer GitHub Actions with environment secrets or a Python job API.
- Avoid leaving legacy Vercel cron write routes routable after they stop being used.
- Add job-level allowlists so a generic trigger cannot accidentally run destructive/backfill jobs.

### 9. Some public read routes are still Chennai-assumed

Some Next read routes are already city-aware, for example `groundwater/stations` accepts a `city` parameter and maps city to WRIS district.

Others are still implicitly Chennai:

- `/api/groundwater/ward` accepts only `ward`, validates `1..200`, and queries `groundwater_monthly` / `ward_risk_score` without city scope.
- `/api/groundwater` reads `public/data/ward-names.json`, limits 200 rows, and queries `groundwater_monthly` without city scope.
- `/api/narratives/ward` accepts only `ward`, validates `1..200`, and queries `ward_narrative` without city scope.
- `/api/narratives/city` reads today's `daily_briefing` without city scope.
- `/api/water-bodies-census` has no city/place filter.

This is fine as legacy compatibility, but these routes should not be treated as generic multi-city APIs until Phase 1 DB keys and backend route contracts are updated.

Recommendation:

- Add explicit route contract labels: `legacy-chennai`, `city-aware`, `global`, or `static-asset`.
- For city-aware replacements, introduce new optional `cityId`/`placeId` params without breaking current callers.
- Keep response shapes stable while moving queries behind server modules.
- Do not enable multi-city callers against city-blind read routes.

### 10. CLI packaging is ad hoc

Many scripts manipulate `sys.path` to import `app.*`, and there are no first-class console entrypoints in `pyproject.toml`.

This is not a product bug, but it keeps the job surface informal:

- workflows call file paths directly
- scripts create Supabase clients themselves
- jobs cannot share a standard context/logger without repeated boilerplate
- imports differ between scripts in `neer-vazhvu-api/scripts` and root `scripts`

Recommendation:

- Add package entrypoints or `python -m app.jobs.<job>` modules.
- Keep old script paths as thin wrappers during migration so workflows can cut over one at a time.
- Prefer `pip install -e .` plus module execution over `sys.path.insert` in production jobs.

### 11. Test coverage is good for pure algorithms, weaker for production wrappers

CI runs Python `ruff`, format checks, and `pytest`, plus frontend lint/build/tests and data checks. Existing Python tests cover cascade, GEE target logic, reservoir context, timezone, city config, water bodies, estimate math, and Mumbai numerical parsing on the active branch.

The weaker area is production wrappers:

- retry and stale-fallback paths
- Supabase upsert key selection
- workflow-facing CLI argument handling
- logging records
- route response shape consistency

Recommendation:

- As jobs are refactored into source client, mapper, and sink layers, add tests at those boundaries.
- Keep network calls mocked at parser/client boundaries.
- Add smoke tests for every generic job entrypoint using fake repositories.
- Add contract tests for public Next route response shapes before moving route internals.

## Mumbai Branch Addendum

The active branch reinforces the Phase 2 direction:

- Mumbai daily lake scraping follows the v2 reservoir shape and should plug into a generic reservoir ingestion framework.
- Pravah refresh is both a static artifact generator and optional DB upsert. That needs an explicit "artifact job" category separate from "database ingestion job."
- BMC floodspots refresh is static-only and commit-backed. It should register provenance in the future dataset registry, not become a DB write by default.
- Mumbai is disabled in product UI but actively ingests reservoir data. Backend jobs must treat `enabled=false` as "hidden from users," not "do not run jobs."
- The Python Mumbai config is BMC-shaped, while frontend/SQL are region-shaped. Treat Python config as scraper/job metadata until generated factual config exists.

## Proposed Backend Target Architecture

Use this vocabulary for Phase 2 implementation:

```text
app/
  clients/        external HTTP/API clients, no Supabase writes
  parsers/        source-specific parsing and validation
  domains/        reservoir, groundwater, weather, census, narratives
  repositories/   Supabase table/RPC adapters
  jobs/           idempotent runnable jobs with typed inputs/results
  orchestrators/  daily/monthly sequences made of jobs
  routers/        thin FastAPI route adapters
```

For Next:

```text
src/server/
  queries/        typed Supabase/static-file read queries
  adapters/       API payload composition for frontend routes
  route-utils/    errors, cache policy, city parsing
```

Important boundary:

- Python owns writes and scheduled data jobs by default.
- TypeScript DB-writing jobs are named exceptions during transition; currently this means AI narrative generation.
- Next owns public read adapters and frontend-near payload shaping.
- GitHub Actions owns scheduling until there is a deliberate worker/scheduler replacement.
- Static artifact refreshes remain static/CDN-first, with DB provenance added later.

## Recommended Phase 2 Migration Sequence

### P2-0: Backend inventory and live-call audit

Before changing behavior:

- Confirm which FastAPI endpoints are called by GitHub Actions, Vercel cron, external monitors, or humans.
- Confirm whether any manual or external caller still POSTs to `/api/cron/**`. Repo evidence already rules out scheduled callers: there is no `vercel.json`, and no GitHub workflow references these routes.
- Capture current workflow schedules and secrets used by each job.
- Add a backend endpoint/job inventory table to this report.

### P2-1: Standardize job result and logging helpers

Add shared Python helpers without changing existing job behavior:

- `JobResult`
- `JobError`
- `JobContext`
- `run_job_with_logging`
- Supabase client factory
- stale-data fallback helper
- pagination helper

Adopt them one job at a time. This is low product risk because it can preserve output tables and schedules.

### P2-2: Consolidate reservoir v2 jobs

Create generic jobs for:

- reservoir v2 ingestion
- reservoir v2 forecast
- reservoir v2 history/freshness checks

Then replace per-city forecast scripts with one generic script/entrypoint.

Do not remove legacy Chennai v1 forecast/estimate until Phase 1 reservoir cutover is complete.

### P2-3: Disable uncalled Next cron write routes

Because there is no repo-managed schedule for `/api/cron/**`, these can likely be disabled earlier than a full replacement ladder. For each Next cron route:

1. Confirm no manual runbook, monitor, or external caller still posts to it.
2. If no caller exists, replace the implementation with an authenticated disabled response or delete it in a small PR.
3. If a caller exists, move that runbook to the existing Python script/FastAPI job path first.
4. Delete once logs confirm no calls.

Priority order:

- `/api/cron/scrape-cmwssb`
- `/api/cron/fetch-nasa`
- `/api/cron/fetch-opencity`
- `/api/cron/compute-estimate`

### P2-4: Introduce typed repository modules

Move direct Supabase table calls out of domain logic:

- `ReservoirRepository`
- `WeatherRepository`
- `GroundwaterRepository`
- `WrisRepository`
- `NarrativeRepository`
- `DatasetAssetRepository`

This makes Phase 1 DB cutovers easier because table/key changes are localized.

### P2-5: Normalize city/place metadata consumption

Do not try to solve all config ownership in backend code first.

Recommended order:

- Add consistency checks across SQL seed, TypeScript config, and Python config.
- Generate a minimal Python job manifest from DB/curated manifest if practical.
- Keep UI-only flags in TypeScript until the admin app/data registry design is ready.
- Move factual source metadata out of Python constants over time.

### P2-6: Standardize Next public read adapters

Create shared helpers for:

- cache headers
- error responses
- city/place validation
- Supabase read client fallback
- static JSON loading
- demo/mock fallback

Then migrate routes gradually without changing response shapes.

### P2-7: Retire legacy backend surfaces

Only after observability confirms no callers remain:

- delete unused Next cron routes
- delete per-city duplicate forecast scripts
- delete Chennai v1-specific FastAPI endpoints/logic after v2 cutover
- shrink `app/etl/pipeline.py` into an orchestrator over reusable jobs

## Phase 2 Acceptance Criteria

Phase 2 can be considered complete when:

- Production DB writes have one preferred backend plane, with any TypeScript DB-writing exceptions documented or migrated.
- Every scheduled workflow is classified as DB ingestion, DB derived, static artifact, hybrid, or health.
- Every job has a typed result shape and a consistent logging path.
- Reservoir v2 forecasting is one generic job, not one script per city.
- Existing per-city scripts are either removed or thin wrappers around generic jobs.
- Next cron write routes are retired, disabled, or explicitly documented as temporary compatibility triggers.
- Public Next read routes have route-contract labels and shared error/cache/city-validation helpers.
- Direct Supabase calls in core backend logic are isolated behind repository/query modules for the highest-churn tables.
- Phase 1 DB cutover constraints are reflected in backend writer deployment order.

## Explicit Non-Goals For Early Phase 2

- Do not replace GitHub Actions scheduling until the current jobs are standardized.
- Do not move large static artifact payloads into the database just because a backend refactor is underway.
- Do not expand Python city config into a second full product metadata source.
- Do not delete legacy Chennai v1 backend paths until reservoir v2 cutover is complete and observed.
- Do not make FastAPI the mandatory runtime path for every public read route; Next BFF adapters are useful and can stay.

## Suggested PR Boundaries

Phase 2 should not be one giant backend PR. Suggested deploy-safe PRs:

1. `backend-inventory`
   - docs-only inventory and call graph
   - no runtime change

2. `job-runner-foundation`
   - add shared job result/logging helpers
   - migrate one low-risk script as proof

3. `reservoir-v2-job-consolidation`
   - generic v2 forecast job
   - keep old city scripts as wrappers
   - update workflow to call generic entrypoint after wrapper parity

4. `next-cron-retirement-plan`
   - instrument or disable unused Next cron write routes
   - no data model changes

5. `repository-layer`
   - introduce typed Supabase repositories around hot tables
   - migrate one domain at a time

6. `bff-route-standardization`
   - shared route helpers
   - preserve public API response shapes

## Open Questions

- Are the FastAPI endpoints externally consumed by anything other than GitHub Actions and manual maintenance?
- Is `PYTHON_API_URL` always available in production, or should Phase 2 assume it can be down and keep Actions as the scheduler?
- Do we want Python to own all generated static artifact jobs, or should TypeScript build scripts remain first-class for frontend-shaped public assets?
- Should AI narrative generation move into Python jobs, or remain a documented TypeScript DB-writing exception?
- Do any manual runbooks, external monitors, or private callers still POST to old Next cron routes?
- Should old Next cron routes return 404/410 once retired, stay as authenticated no-op compatibility endpoints for one release, or be deleted immediately if no callers exist?
- Should job logs live in the existing `pipeline_log` until Phase 1 DB work adds `ingestion_runs`, or should Phase 2 introduce `job_runs` independently?

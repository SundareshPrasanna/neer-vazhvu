# Test Coverage Roadmap (`todo_tests.md`)

## Why this exists
Neer Vazhvu serves public-interest decisions, so correctness and freshness matter more than cosmetic stability.
This roadmap defines a practical, phased approach to increase confidence in data ingestion, API behavior, and user-facing calculations.

## Baseline after this branch
Implemented now:
- Frontend automated tests via Node test runner (`tsx --test`) for core utility logic.
- API automated tests via `pytest` for core estimate and timezone helpers.
- CI executes tests on `pull_request` and `push` to `main`.

Current baseline coverage is intentionally small and focused on deterministic logic.
The next phases below are prioritized by impact to production correctness.

## Coverage Targets
- P0 target: protect all critical business logic and scheduler entry points with deterministic tests.
- P1 target: protect API contracts and data normalization/parsing behavior with fixture-based tests.
- P2 target: add integration/end-to-end confidence, non-functional checks, and regression suites.

## Prioritization Rules
- Priority is based on user impact and recovery cost.
- Anything that can silently corrupt data or produce misleading dashboard insights is higher priority.
- Visual-only regressions are lower priority unless they hide or invert meaning.

## Test Matrix (By System)
| System | Current Risk | Primary Test Type | Priority |
|---|---|---|---|
| CMWSSB scraper + parser | High (source instability/timeouts/schema drift) | Unit + fixture replay + retry behavior tests | P0 |
| Daily pipeline orchestration | High (date shifts/idempotency failures) | Integration-style unit tests with mocked DB client | P0 |
| Cron authorization routes | High (misconfiguration/security drift) | Route-level unit tests | P0 |
| Forecast/risk scoring logic | High (decision support correctness) | Deterministic algorithm tests with golden fixtures | P1 |
| Frontend API routes (`/api/*`) | Medium-High | Contract tests with mocked Supabase | P1 |
| UI dashboard calculations/charts | Medium | Component and utility tests | P1 |
| Data-source scripts (`scripts/*.ts`) | Medium | CLI tests + fixture-based parsing tests | P1 |
| Full pipeline + dashboard smoke | Medium | E2E test in ephemeral env | P2 |
| Performance/latency + load | Medium | Benchmarks / synthetic checks | P2 |

## P0 Backlog (Do First)

### P0-1: CMWSSB scraper resilience and parsing
Scope:
- `neer-vazhvu-api/app/scrapers/cmwssb.py`
- `neer-vazhvu-api/scripts/scrape_cmwssb.py`

Add tests for:
- HTML table parsing of expected rows/headers.
- Handling missing columns and malformed numeric fields.
- Retry behavior across transient network failures.
- Timeout behavior with explicit error classification.
- Date extraction and normalization edge cases.

Implementation notes:
- Store multiple real HTML snapshots under `neer-vazhvu-api/tests/fixtures/cmwssb/`.
- Use mocked HTTP client responses to avoid external network dependency.
- Validate that final transformed rows map to canonical schema.

Definition of done:
- Parser handles known historical page variants.
- Retry loop behavior is deterministic in tests.
- Failure modes produce actionable logs and non-zero exit in script path.

### P0-2: Pipeline orchestration correctness
Scope:
- `neer-vazhvu-api/app/etl/pipeline.py`
- `neer-vazhvu-api/app/routers/pipeline.py`

Add tests for:
- Idempotent upsert semantics (no duplicate rows for same day/source).
- Date-window handling in IST across day boundaries.
- Empty-source handling (partial upstream failures).
- Correct propagation of row counts/summary stats.
- Post-scrape endpoint behavior when prerequisite data missing.

Implementation notes:
- Mock Supabase client at repository boundary (not inside every helper).
- Use table-level fixture payloads for reservoirs, rainfall, groundwater.

Definition of done:
- Pipeline outputs stable summary for fixed fixture inputs.
- Re-running same run-date does not duplicate rows.
- Route returns clear status codes for expected error classes.

### P0-3: Cron auth and scheduler route hardening
Scope:
- `src/lib/cron-auth.ts`
- `src/app/api/cron/*/route.ts`

Add tests for:
- Missing `CRON_SECRET` behavior in production vs development mode.
- Unauthorized request returns 401 without side effects.
- Authorized request passes to handler path.
- `ALLOW_UNPROTECTED_CRON` behavior only in `development`.

Definition of done:
- Unauthorized or misconfigured states are explicit and consistent across all cron routes.

### P0-4: API health and critical route contracts
Scope:
- `src/app/api/health/route.ts`
- `src/app/api/reservoir/route.ts`
- `src/app/api/calculator/route.ts`

Add tests for:
- Success contract shape and types.
- Database failure fallback behavior/status code.
- Empty datasets return safe defaults, not crashes.

Definition of done:
- API route outputs are stable and documented.
- Contract tests fail on accidental response-shape drift.

## P1 Backlog (Next)

### P1-1: Forecast and risk scoring regression suite
Scope:
- `neer-vazhvu-api/app/intelligence/forecaster.py`
- `neer-vazhvu-api/app/intelligence/risk_scorer.py`
- `neer-vazhvu-api/app/intelligence/briefing.py`

Add tests for:
- Deterministic outputs using frozen input datasets.
- Threshold boundary checks (risk bucket transitions).
- Missing data behavior and fallback summaries.
- Formatting/parsing of AI briefing payload components.

Definition of done:
- Golden fixtures prevent silent behavior drift.

### P1-2: Frontend calculation and formatting correctness
Scope:
- `src/lib/calculator/days-left.ts`
- `src/lib/utils/date.ts`
- `src/lib/utils/format.ts`

Add tests for:
- Boundary scenarios where inflow >= demand.
- Rounding behavior and displayed precision.
- IST date handling around midnight UTC transitions.

Definition of done:
- Utility and calculator logic covered for common and edge cases.

### P1-3: Supabase query adapter tests
Scope:
- `src/lib/supabase/server.ts`
- `src/lib/supabase/admin.ts`
- API route handlers relying on these clients.

Add tests for:
- Query failure handling and surfaced messages.
- Head/count query consistency.
- Defensive handling for null rows and type coercion.

Definition of done:
- All route handlers are tested without live DB dependency.

### P1-4: Data-source script contract tests
Scope:
- `scripts/seed-*.ts`
- `scripts/fetch-*.ts`

Add tests for:
- Input file format validation.
- Mapping to internal schema.
- Error exit codes and human-readable diagnostics.

Definition of done:
- Script behavior is stable and testable in CI with fixture input files.

## P2 Backlog (Broader Confidence)

### P2-1: End-to-end pipeline smoke in CI
Scope:
- Synthetic data run from scrape -> pipeline -> API read path.

Add:
- Ephemeral DB (or mocked persistence service) job in CI.
- Smoke assertion that dashboard-critical endpoints return expected values.

### P2-2: Frontend component tests for critical panels
Scope:
- `src/components/dashboard/*`
- `src/components/groundwater/*`

Add tests for:
- Rendering with empty, partial, and outlier datasets.
- Accessibility baseline (semantic roles/labels).
- Visualization legends and value consistency.

### P2-3: Non-functional checks
Add:
- Budget checks for API route latency in test mode.
- Basic load profile on compute-heavy paths.
- Snapshot alerting for major response-size regressions.

## Recommended Directory Conventions
- Frontend tests: colocated as `*.test.ts` next to utilities/components.
- API tests: `neer-vazhvu-api/tests/` with clear domain grouping:
  - `tests/scrapers/`
  - `tests/etl/`
  - `tests/intelligence/`
  - `tests/routers/`
- Fixtures:
  - `neer-vazhvu-api/tests/fixtures/`
  - `src/tests/fixtures/` (if frontend route tests are added)

## CI Evolution Plan
Phase 1 (this branch):
- Run `npm run test` in frontend job.
- Run `pytest -q` in API job.

Phase 2:
- Add coverage reports (`--coverage`) and upload artifacts.
- Fail PR if coverage drops below agreed threshold per package.

Phase 3:
- Add nightly extended test suite (fixture replay + integration smoke).

## Suggested Coverage Thresholds
Use gradual thresholds to avoid blocking momentum:
- Frontend utilities/routes: start at 35%, move to 55%, then 70%.
- API business logic/routes: start at 40%, move to 60%, then 75%.
- Critical modules (`scrapers`, `etl`, `intelligence`): target >= 80% eventually.

## Practical Execution Order (First 2 Weeks)
1. Complete all P0 scraper + pipeline tests.
2. Add cron-auth and critical API route contract tests.
3. Add calculator and date edge-case tests.
4. Introduce coverage metrics in CI once deterministic test base is stable.

## Risks and Mitigations
- Risk: flaky tests due to clock/network dependencies.
  Mitigation: freeze time, use fixtures, and mock external calls.
- Risk: brittle tests on frequently changing UI text.
  Mitigation: prioritize behavior/state tests over text snapshots.
- Risk: CI runtime inflation.
  Mitigation: split fast PR suite vs nightly extended suite.

## Exit Criteria for “Good Coverage”
- Critical ingestion and pipeline paths have deterministic tests.
- All public API routes have contract tests for success and failure cases.
- Known historical failures are represented as regression tests.
- CI blocks merges on failing tests and significant coverage regressions.

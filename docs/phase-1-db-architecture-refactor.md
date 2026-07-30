# Phase 1: Database Architecture Refactor Notes

Working notes for the database-first refactoring pass against `main` without checking out the active worktree.

## Scope

- Branch inspected: `main`
- Main commit inspected initially: `f53e6c40409933b2925dff7b9ef5dc3b3a222585`
- Also inspected: active worktree branch `mumbai_onboarding` as likely near-future baseline after merge
- Temporary export used for analysis: `/tmp/neer-vazhvu-main.ZqJZO1`
- Current phase: database architecture, schema ownership, duplicate tables, and JSON/static dataset migration opportunities
- Original phase-1 output was design-report only. Implementation began on `2026-07-06` on branch `db-architecture-refactor` after the design direction was accepted.

## Implementation Log

### M0.1: city-scoped schema stabilization started

Branch base: `4b5a0c035e9008098d37f335bab199a2b15eb7c6`.

Implemented in this slice:

- Repaired migration `026_multi_city_city_id.sql` for fresh databases by recreating `groundwater_wris_latest` as a city-aware view instead of trying to add a column to a view.
- Added migration `035_m0_city_scoped_keys.sql`.
- `035` idempotently ensures `city_id` exists/defaults/backfills on the existing retrofitted tables.
- `035` recreates `groundwater_wris_latest` with `DISTINCT ON (city_id, station_code)`.
- `035` adds city-aware unique indexes for the next writer cutover while keeping every old city-blind unique/primary key in place.
- `026` and `035` map the full Vaigai WRIS telemetry district set (`Madurai`, `Theni`, `Dindigul`, `Virudhunagar`) to `city_id = 'madurai'`.
- Madurai WRIS river-level and rainfall scripts now stamp `city_id = 'madurai'` explicitly so new telemetry rows do not rely on the Chennai default.
- Added `supabase/checks/035_m0_city_scoped_keys_preflight.sql` for manual live schema-drift, null, duplicate, and district-ownership checks before applying `035`.
- Added `npm run db:check` as a local guard for the M0 city-scoped key migration.

Verified locally:

- `npm run db:check`
- Full migration replay from `001` through `035` against a throwaway local Postgres database with minimal Supabase role/storage fixtures.
- Temp schema confirmed `groundwater_wris_latest.city_id`, all 12 city-aware unique indexes, and non-null `city_id` defaults on the stabilized tables.

Still required before applying to live Supabase:

- Dump/diff the live schema, because production may have been manually reconciled after the original migration `026` view error.
- Run `supabase/checks/035_m0_city_scoped_keys_preflight.sql` for every new city-aware key. The new unique indexes intentionally fail fast if unexpected duplicate rows already exist.
- Merge/deploy the Madurai WRIS telemetry script fix in the same release as, or before, applying migration `035`. If the migration backfill runs while old scripts are still deployed, gap rows can still receive the `'chennai'` default; recent rows may self-heal on the next upsert window, but older gap rows would need a manual backfill rerun.
- Keep backend writer cutover separate. Current deployed writers can keep using old `on_conflict` keys because old city-blind arbiters are still present.
- The `026` and `035` district helpers are not perfectly identical: `035` includes a few extra Bangalore/Mumbai aliases as live-repair scaffolding. That is inert for current tables because `035` runs after `026` and re-repairs the affected rows.

## Live App Constraints

The webapp is live and Vercel auto-deploys on merge, so later implementation phases need a conservative release discipline:

- Treat every merged code change as production-bound.
- Phase-1 design shipped docs-only; implementation slices follow the deploy-safe rules below.
- Prefer additive migrations first, code cutover second, destructive cleanup last.
- Do not drop or rename tables, columns, RPCs, or public asset paths in the same release that first moves readers.
- Make database migrations safe for both the old deployed Vercel build and the new build.
- Use compatibility views, fallback reads, and dual writes where needed.
- Keep existing `public/data` and `public/geojson` paths stable until all routes and cached clients are known to be off them.
- Make rollback boring: if a Vercel deploy rolls back, the previous build should still work against the migrated database.

## Early Observations

- The application uses Supabase migrations under `supabase/migrations`.
- The backend service has a separate database helper at `neer-vazhvu-api/app/db.py`.
- The repo contains many generated/static JSON and GeoJSON files under `public/data`, `public/geojson`, and city/basin subfolders.
- Multi-city support has started in the database layer through `026_multi_city_city_id.sql`, while many JSON files are still city-suffixed or path-partitioned.

## Questions To Resolve

- Which datasets are considered source-of-truth versus generated build artifacts? Current answer: infer from docs/scripts and document by dataset family.
- Which public JSON files must remain CDN-friendly static assets for performance/offline use? Current answer: keep heavy UI layers static/CDN-first; use DB for provenance and selective structured facts.
- Which tables are known duplicate candidates from recent fast-moving work? Current answer: reservoir v1/v2 is the clear duplicate stack; other cases are scope/grain problems rather than exact duplicates.
- Is the intended long-term database still Supabase Postgres with PostGIS, or should this phase assume plain Postgres compatibility where possible? Current answer: defer PostGIS until there is a concrete database-side spatial query need; no current migrations enable PostGIS.

## Running Inventory

### Database Tables And Views

Core Supabase objects on `main`:

- `cities`, `water_sources`, `water_source_name_aliases`
- Legacy Chennai reservoir tables: `reservoir_daily`, `reservoir_meta`, `reservoir_forecast`
- Legacy Chennai reservoir RPC/function: `avg_monthly_inflow()`
- Multi-city reservoir tables: `reservoir_daily_v2`, `reservoir_forecast_v2`
- Multi-city reservoir RPC/function: `avg_monthly_inflow_v2()`
- Groundwater: `groundwater_monthly`, `groundwater_wris`, `groundwater_wris_latest`
- WRIS surface telemetry: `wris_river_level`, `wris_rainfall`
- Weather and estimates: `weather_daily`, `water_estimate_daily`
- Intelligence/narratives: `daily_briefing`, `ward_risk_score`, `ward_narrative`, `news_articles`
- GEE/satellite: `reservoir_catchment_context`, `water_body_satellite_summary`
- Water bodies census: `water_bodies_census`
- Kaveri-specific region tables: `flow_station_daily`, `basin_rainfall_daily`, `mettur_release_signal`, `delta_infrastructure_assets`, `delta_capex_projects`

### Static JSON / GeoJSON Surface

- `public/data` contains about 150 MB.
- `public/geojson` contains about 39 MB.
- There are 357 JSON/GeoJSON files under `public/data` and `public/geojson`.
- Largest families:
  - cascade/catchment outputs under `public/data/cascade`
  - basin atlas layers under `public/data/basins`
  - base map layers under `public/geojson`
  - per-water-body rich analysis files under `public/data/rich-bodies` and `public/geojson/rich-bodies`

On the active `mumbai_onboarding` branch:

- `public/data` grows to about 302 MB.
- `public/geojson` grows to about 43 MB.
- `public/tiles` is present at about 2 MB.
- New Mumbai static families include allocations, promises, MMR corporation water, MMR dam storage, Praja ward-water data, Mumbai CGWB stations, flood hotspots, ward risk, restoration, river quality, and cascade/PMTiles outputs.

### Static Asset Strategy

The current static-file strategy has real UX value and should not be thrown away. Large maps and precomputed layers are fast because they are CDN-cacheable, immutable within a deployment, and do not add runtime database latency to every pan/click/load.

Recommended split:

- Database as control plane:
  - canonical structured facts
  - provenance and version metadata
  - source documents
  - ingestion/run history
  - queryable small observations and admin-facing records
- Static/CDN assets as data plane:
  - large GeoJSON, PMTiles, imagery manifests, chips, tints
  - cascade topology outputs
  - frontend-ready denormalized payloads
  - public files whose shape is optimized for page load, not authoring

This gives the app the loading behavior it already has while making city onboarding less chaotic. A future city should be able to add facts/sources into DB or a source manifest, run deterministic generators, register the resulting assets in `dataset_assets`, and serve the same fast public payloads.

PostGIS should be adopted only when a feature needs database-side spatial queries, such as search-by-radius, database-backed admin editing, server-side clipping, deduping overlaps, or cross-layer joins at request time. It should not be adopted merely because a file is GeoJSON.

## First Findings

### 1. The clearest duplicate is the reservoir v1/v2 split

`reservoir_daily` is Chennai-only and keyed by the `reservoir_name` enum plus `date`. It stores storage in Mcft and repeats capacity on every observation.

`reservoir_daily_v2` is the intended multi-place replacement. It is keyed by `(city_id, source_code, date)`, references `water_sources`, and stores storage in TMC.

`reservoir_forecast` and `reservoir_forecast_v2` repeat the same split. The v2 migration explicitly says v2 was added because the v1 enum could not represent Vaigai / Mullaperiyar cleanly.

Recommendation:

- Make `reservoir_daily_v2` and `reservoir_forecast_v2` canonical.
- Backfill Chennai into v2.
- Convert runtime reads/writes to v2.
- Replace v1 tables with compatibility views only if needed during backend cutover.
- Retire `reservoir_meta`; `water_sources` should own that metadata.

### 2. `city_id` was retrofitted, but uniqueness stayed mostly single-city

Migration `026_multi_city_city_id.sql` adds `city_id` to many legacy tables, but most original unique constraints remain city-blind:

- `weather_daily`: unique `date`
- `water_estimate_daily`: unique `date`
- `daily_briefing`: unique `briefing_date`
- `groundwater_monthly`: unique `(ward_number, year, month)`
- `ward_risk_score`: unique `(ward_number, computed_date)`
- `ward_narrative`: unique `(ward_number, narrative_date)`
- `groundwater_wris`: unique `(station_code, reading_date)`
- `wris_river_level`: primary key `(station_code, reading_date)`
- `wris_rainfall`: primary key `(station_code, reading_date)`
- `reservoir_catchment_context`: unique `(reservoir, context_date, window_days)`
- `water_body_satellite_summary`: unique `(gee_target_id, summary_date)`

This makes `city_id` a filter column, not a true tenant dimension. Future multi-city inserts can collide or overwrite when natural identifiers overlap.

Recommendation:

- Move all city-scoped tables to city-aware primary/unique keys.
- Make `city_id` `NOT NULL` after backfill.
- Update all upsert `on_conflict` clauses after adding city-aware arbiter indexes and before dropping old city-blind keys.
- Keep source-specific identifiers as metadata unless the source guarantees global uniqueness.

### 3. `groundwater_wris_latest` is a view, and migration 026 should be treated as suspect

Migrations 013-016 create/recreate `groundwater_wris_latest` as a view. Migration 026 then tries to `ALTER TABLE groundwater_wris_latest ADD COLUMN IF NOT EXISTS city_id ...`.

That is stronger than a harmless modeling mistake: `ALTER TABLE ... ADD COLUMN` against a view is a hard Postgres error. As written, migration 026 cannot have applied cleanly unless it was edited, skipped, or partly reconciled manually at apply time. Production schema therefore cannot be assumed to match the migration files.

Recommendation:

- Before any M0 constraint work, dump the live schema and reconcile it against `supabase/migrations`.
- Recreate `groundwater_wris_latest` with `city_id` selected from `groundwater_wris`.
- Use `DISTINCT ON (city_id, station_code)`, not just `station_code`.
- Do not attempt to add storage columns to the view.

### 4. Groundwater is not exactly duplicate, but it mixes grain and scope

`groundwater_monthly` is ward/month data, originally Chennai OpenCity.

`groundwater_wris` is station/date data from WRIS.

`groundwater_wris_latest` is a latest-station view.

These are related but not duplicate. The architecture problem is that some runtime code still uses `district` string filters while the database has a `city_id` column.

Recommendation:

- Introduce explicit station metadata and observation tables:
  - `monitoring_stations`
  - `groundwater_observations`
  - optional `ward_groundwater_monthly`
- Use `city_id` for app ownership and filtering.
- Keep `district`, `state`, `agency`, and `acquisition_mode` as source metadata.

### 5. City/source metadata has three divergent owners

The same city and water-source facts exist in:

- SQL seed migrations: `cities`, `water_sources`
- frontend TS configs under `src/lib/cities`
- backend Python configs under `neer-vazhvu-api/app/cities`

This has already drifted:

- Chennai capacities differ between SQL owners: `reservoir_meta` seeds `cholavaram = 881` and `kannankottai = 1574`, while `water_sources` seeds `cholavaram = 1081` and `kannankottai = 500`.
- Madurai capacities in frontend config differ from SQL seed and backend Python config.
- Bangalore is `enabled: true` in frontend config, but the SQL seed still inserts `enabled = FALSE`, and backend Python config still has `enabled=False`.

Recommendation:

- Decide ownership:
  - database owns factual place/source metadata
  - code owns UI capability flags and render variants
- Generate typed frontend/backend fixtures from the database or from a single checked-in source manifest.
- Add a CI consistency check until generation exists.

### 6. JSON/GeoJSON should be split into three storage strategies

Not all JSON should move into relational tables.

Move to relational/JSONB tables soon:

- ward profiles, ward names, localities, ward representatives
- river quality, river events, industrial sources
- restoration projects and restoration priority scores
- supply overview facts
- GWR block summaries and station lists
- city facts
- rich-water-body timeseries and per-body analysis manifests

Move to PostGIS-backed feature tables when querying/filtering matters:

- wards
- water bodies
- rivers
- flood zones and hotspots
- drainage/sewerage assets
- industrial zones
- GWR blocks
- basin atlas vector layers

Keep as generated static/object-storage assets for now:

- large cascade/catchment topology outputs
- large public map payloads where the frontend fetches whole layers
- PMTiles/vector tiles and imagery manifests
- download/research artifacts that do not need transactional app queries

The important shift is to add a `dataset_assets` registry so static assets have database provenance, versioning, city/basin ownership, checksums, generated-at timestamps, and source links.

## Evidence Snapshot

Not exhaustive, but useful anchors for future implementation PRs:

- Active v1 reservoir writes still exist in `neer-vazhvu-api/app/etl/pipeline.py`, `neer-vazhvu-api/scripts/scrape_cmwssb.py`, and `src/app/api/cron/scrape-cmwssb/route.ts`.
- Active v1 reservoir reads still exist in `src/lib/facts/live-facts.ts`, `src/app/api/reservoir/**`, `src/app/api/calculator/route.ts`, and `neer-vazhvu-api/app/intelligence/forecaster.py`.
- The main city loader, `src/app/[cityId]/data.ts`, already reads `reservoir_daily_v2`; M1 is smaller than a full app-loader cutover.
- Newer Madurai/Bangalore reservoir scripts already write `reservoir_daily_v2` and `reservoir_forecast_v2`, so the split is runtime-active, not just historical schema.
- Upsert conflict keys remain city-blind in the Python ETL for weather, groundwater, WRIS river level, WRIS rainfall, water estimates, water bodies census, daily briefings, ward risk, and ward narratives.
- `water_bodies_census` currently upserts on `census_code`; census codes are only source/state scoped, so Maharashtra rows can collide with Tamil Nadu rows unless the key includes `city_id` or source scope.
- GEE rows carry city context in commands, but `reservoir_catchment_context` and `water_body_satellite_summary` writes still key by reservoir/target IDs without city or canonical body/source IDs.
- PostGIS is not currently enabled in migrations: there are no `CREATE EXTENSION postgis`, `geometry`, `geography`, `USING gist`, or `ST_` migration references.
- `public/data/cascade` is about 115 MB, `public/data/basins` about 29 MB, and `public/geojson` about 39 MB. These should not be blindly loaded into relational tables.
- Top-level structured JSON is much smaller and more database-shaped: ward profiles, localities, river quality, restoration priority, supply overviews, facts, GWR summaries, and CGWB stations.

## Mumbai Branch Addendum

The active `mumbai_onboarding` branch should be treated as the likely baseline for implementation planning once it merges.

### DB/schema changes on the branch

- Adds `027_mumbai_seed_disabled.sql`: seeds `mumbai` as `enabled = FALSE`.
- Adds `028_mumbai_water_sources.sql`: seeds Mumbai's seven BMC supply lakes into `water_sources` and aliases into `water_source_name_aliases`.
- Adds `029_mmr_corporations.sql`: flips `cities.place_kind` for Mumbai to `region`, adds `corporations`, and adds `source_corporation` as the source-to-corporation supply graph.
- Adds `030_rls_hardening_reference_tables.sql`: enables RLS/read-only policies on reference tables including `cities`, `water_sources`, `water_source_name_aliases`, and `reservoir_daily_v2`.

Implications:

- The `cities` table is now definitely a `places` table in practice. `city_id` is increasingly a place identifier, not always a municipal city.
- Renaming `cities` to `places` can still be deferred. Revisit it when a second region beyond MMR appears, or when the name mismatch starts causing implementation churn.
- The target reference layer should include `corporations` or a more generic `administrative_units` table.
- The water model should include a supply graph. `source_corporation` is a good concrete start and generalizes better than storing `servedBySourceCodes` only in frontend config.
- Ward-level tables eventually need either `corporation_id` or a canonical `admin_unit_id`, because region places can have wards nested under only some corporations.
- RLS hardening is valuable and should stay part of the future safety baseline.

### Mumbai reinforces the reservoir v2 cutover

Mumbai scrapers write to `reservoir_daily_v2` using the correct conflict key `(city_id, source_code, date)`. The daily workflow also starts accumulating Mumbai reservoir history while Mumbai is disabled in the UI.

That means:

- `reservoir_daily_v2` is no longer just Madurai/Bangalore/Kaveri; it will be the active home for Mumbai too.
- The old Chennai `reservoir_daily` stack becomes even more isolated as the only major v1 holdout.
- "Disabled city" does not mean "no production data writes." Refactor sequencing must account for disabled-but-ingesting places.

### Mumbai adds new static/curated dataset families

New families that should be added to the manifest taxonomy:

- `allocations-*.json`: curated allocation ledger / entitlement-vs-received data.
- `promises-*.json`: curated promise tracker with dated commitments and status history.
- `mmr-corporations-water.json`: curated/synthesized regional corporation water inventory.
- `mmr-dam-storage.json`: generated daily snapshot from Pravah; public serving artifact and optional DB upsert input.
- `mumbai-ward-water-praja.json`: curated/extracted Praja ward water equity data.
- Mumbai flood hotspot GeoJSON: generated/refreshed source extract.
- Mumbai cascade PMTiles: generated serving assets, not DB candidates.

These fit the proposed folder structure well: most belong in `datasets/curated/mumbai/**` or `datasets/generated/mumbai/**` with stable copies emitted to `public/**`.

### Drift risk found on the branch

Frontend `src/lib/cities/mumbai.ts` already models Mumbai as `placeKind: 'region'` with nine corporations. Backend `neer-vazhvu-api/app/cities/mumbai.py` remains BMC/city-shaped and the backend `CityConfig` type has no `place_kind` or `corporations`.

That may be acceptable for current backend usage, but it is a live example of metadata drift. The refactor should either:

- make the DB/manifest the canonical owner and generate both frontend and backend config, or
- explicitly document that backend city config is a thin scraper-only registry and must not be treated as the product metadata source.

### Updated architecture principle

Do not model the platform as `city -> ward`. Use:

```text
place -> administrative unit -> ward/locality
place -> water source -> served administrative unit
```

For Chennai/Madurai/Bangalore, the administrative-unit layer can be implicit or a single local government row. For Mumbai/MMR, it is explicit and first-class.

## Future Target Architecture

The refactor should aim for a database shape like this:

- Reference layer:
  - `places`
  - `authorities`
  - `administrative_units` or `corporations`
  - `water_sources`
  - `source_place_edges` or `source_corporation`
  - `wards`
  - `water_bodies`
  - `monitoring_stations`
  - `data_sources`
  - `source_documents`
  - `dataset_versions`
- Observation layer:
  - `reservoir_observations`
  - `groundwater_observations`
  - `weather_observations`
  - `rainfall_observations`
  - `river_level_observations`
  - `river_quality_observations`
  - `satellite_water_observations`
- Derived layer:
  - `city_water_estimates`
  - `reservoir_forecasts`
  - `ward_scores`
  - `restoration_scores`
  - `city_facts`
  - `narratives`
- Asset/cache layer:
  - `dataset_assets`
  - `ingestion_runs`
  - materialized views for latest station readings, latest reservoir snapshots, and public API payloads

## Recommended Future Migration Sequence

Before implementation starts, re-run this audit against `main` after `mumbai_onboarding` is merged. Treat the Mumbai branch findings above as likely but not final until the merge commit is the baseline.

### Pre-M0: Reconcile live schema with migrations

This should happen before any constraint work. Migration 026 contains a hard-error statement against `groundwater_wris_latest`, so the production schema may no longer be safely inferable from `supabase/migrations` alone.

- Dump the live schema with Supabase `db diff` or `pg_dump --schema-only`.
- Confirm whether migration 026 failed, was edited at apply time, or was later reconciled manually.
- Verify which `city_id` columns, indexes, policies, views, and constraints actually exist in production.
- Record schema drift in this report before writing M0 migrations.

### M0: Stabilize the current multi-city schema

This is the safest first implementation move after live-schema reconciliation because it reduces future collisions without changing the product surface. It is not purely additive if old constraints are dropped too early, so the deployment order matters.

- Fix `groundwater_wris_latest`: recreate the view with `city_id` from `groundwater_wris` and `DISTINCT ON (city_id, station_code)`.
- Add city-aware unique constraints or indexes for every table that now has `city_id`, while leaving existing city-blind arbiter constraints in place.
- Make `city_id` `NOT NULL` after backfill validation.
- Deploy writer code so all Supabase upserts use the new city-aware `on_conflict` keys.
- Verify no deployed reader/writer still relies on old city-blind conflict targets such as `on_conflict="date"`.
- Drop old city-blind constraints only in a later cleanup release.
- Add a small consistency test or script that fails when a table has `city_id` but no city-scoped natural key.

Postgres upsert requires a matching arbiter index or constraint. For example, dropping `UNIQUE(date)` on `weather_daily` before the deployed build stops using `on_conflict="date"` would make current writes error. The safe sequence is: add new city-aware key, deploy code using it, observe, then drop the old key.

During that overlap window, second-city writes to these tables must wait for the cleanup release. While both `UNIQUE(date)` and `UNIQUE(city_id, date)` coexist on `weather_daily` and analogous old/new key pairs coexist elsewhere, a second city's row for the same natural key can still violate the old city-blind constraint.

City-aware keys to target:

| Table | Current key | Target key |
| --- | --- | --- |
| `weather_daily` | `date` | `(city_id, date)` |
| `water_estimate_daily` | `date` | `(city_id, date)` |
| `daily_briefing` | `briefing_date` | `(city_id, briefing_date)` |
| `groundwater_monthly` | `(ward_number, year, month)` | `(city_id, ward_number, year, month)` |
| `ward_risk_score` | `(ward_number, computed_date)` | `(city_id, ward_number, computed_date)` |
| `ward_narrative` | `(ward_number, narrative_date)` | `(city_id, ward_number, narrative_date)` |
| `groundwater_wris` | `(station_code, reading_date)` | `(city_id, station_code, reading_date)` |
| `wris_river_level` | `(station_code, reading_date)` | `(city_id, station_code, reading_date)` |
| `wris_rainfall` | `(station_code, reading_date)` | `(city_id, station_code, reading_date)` |
| `water_bodies_census` | `census_code` | `(city_id, census_code)` or `(city_id, source_system, census_code)` |
| `reservoir_catchment_context` | `(reservoir, context_date, window_days)` | `(city_id, reservoir, context_date, window_days)` or `(city_id, source_code, context_date, window_days)` |
| `water_body_satellite_summary` | `(gee_target_id, summary_date)` | `(city_id, gee_target_id, summary_date)` or `(water_body_id, summary_date)` |

### M1: Consolidate reservoir v1/v2

The duplicate reservoir stack is the cleanest and highest-value simplification.

- Backfill Chennai `reservoir_daily` rows into `reservoir_daily_v2`.
- Convert Chennai ingestion from `reservoir_daily` to `reservoir_daily_v2`.
- Convert Chennai forecasts from `reservoir_forecast` to `reservoir_forecast_v2`.
- Convert `avg_monthly_inflow()` callers to `avg_monthly_inflow_v2()`. These are SQL RPCs/functions invoked through Supabase `.rpc()`, not tables, so keep the old function through the caller cutover and remove it only after no deployed caller uses it.
- Keep short-lived compatibility views for old API routes if phase-2 backend work needs a softer cutover.
- Drop or archive `reservoir_daily`, `reservoir_forecast`, `avg_monthly_inflow()`, and `reservoir_meta` after all reads/writes are off them.

The main city loader already uses `reservoir_daily_v2`, so M1 is focused on the remaining v1-only scripts, live facts helper, API routes, calculator route, forecaster, and Chennai write paths.

Unit conversion has to be explicit: v1 stores `current_storage_mcft`; v2 stores `storage_tmc`. The migration should preserve source values and compute `storage_tmc = current_storage_mcft / 1000`.

### M2: Establish database ownership for reference metadata

Right now city/source facts live in SQL, frontend config, backend config, and GEE registries. That is already drifting.

- Make `cities` / `water_sources` the canonical store for factual metadata.
- Include `corporations` / future `administrative_units` and source-consumer edges in the ownership decision; Mumbai/MMR makes these first-class metadata, not UI-only data.
- Keep code config for UI-only behavior such as enabled nav sections, hero modes, and renderer choices.
- Add one generated or checked-in manifest layer consumed by both frontend and backend.
- Add a CI consistency check for capacities, enabled state, source codes, and city IDs until generation is in place.

### M3: Normalize monitoring stations and observations

Groundwater, river level, and rainfall tables repeat station metadata on every reading. This makes multi-city ingestion fragile and makes station identity source-dependent.

Target split:

- `monitoring_stations`
  - `station_id` primary key, preferably internal stable ID
  - `city_id`, `source_system`, `source_station_code`, `station_name`
  - `monitoring_domain` such as `groundwater`, `river_level`, `rainfall`, `water_quality`
  - `latitude`, `longitude`, `district`, `block`, `basin`, `aquifer`, `well_type`
- `groundwater_observations`
  - `station_id`, `reading_date`, `depth_to_water_m`, `water_level_m`, quality flags
- `river_level_observations`
  - `station_id`, `reading_date`, `level_m`, `discharge_cumecs`, quality flags
- `rainfall_observations`
  - `station_id`, `reading_date`, `rainfall_mm`, source metadata

This can be introduced without breaking current code by creating views named `groundwater_wris`, `wris_river_level`, and `wris_rainfall` during phase-2 backend migration.

### M4: Add dataset provenance before moving all static files

The static JSON surface is large and mixed. Moving everything into tables first would create churn without much product value.

Add `dataset_assets` and register every generated/static artifact before moving data:

- `asset_id`
- `city_id` nullable for region/global assets
- `place_kind` or `scope_type`
- `asset_kind` such as `geojson`, `json`, `pmtiles`, `image_manifest`, `raster`
- `public_path`
- `source_system`
- `generated_by`
- `generated_at`
- `content_hash`
- `size_bytes`
- `schema_version`
- `metadata JSONB`

Then migrate the small structured files into domain tables selectively.

## Table Disposition Matrix

| Object | Disposition | Why |
| --- | --- | --- |
| `cities` | Keep, maybe rename later | Already the routing/place anchor. `place_kind` now supports regions. Renaming to `places` can wait. |
| `corporations` | Keep, generalize later | Added by Mumbai/MMR. It is the first explicit sub-place admin unit table. Could later become `administrative_units`. |
| `source_corporation` | Keep, generalize later | Added by Mumbai/MMR. It models the source-to-consumer supply graph and should influence the broader water-source model. |
| `water_sources` | Keep as canonical | Replaces `reservoir_meta`; already city/source keyed. |
| `water_source_name_aliases` | Keep | Useful for scraper name normalization. |
| `reservoir_daily` | Merge into v2, then retire | Duplicate of `reservoir_daily_v2` with Chennai-only enum and Mcft unit. |
| `reservoir_daily_v2` | Keep, rename later | Current best canonical shape. Later rename to `reservoir_observations`. |
| `reservoir_forecast` | Merge into v2, then retire | Duplicate of `reservoir_forecast_v2`; blocked by enum source list. |
| `reservoir_forecast_v2` | Keep, rename later | Current best canonical shape. |
| `avg_monthly_inflow()` | Retire | SQL RPC/function over the v1 table. Switch `.rpc()` callers first; do not rename/drop in the same release. |
| `avg_monthly_inflow_v2()` | Keep | SQL RPC/function over the city/source-scoped v2 table. |
| `reservoir_meta` | Retire | Duplicates `water_sources`. |
| `weather_daily` | Keep, city-scope key | Daily city weather is valid; current key is single-city. |
| `water_estimate_daily` | Keep, rename later | City-level derived estimate; should become `city_water_estimates`. |
| `groundwater_monthly` | Keep but rename/scope | Ward-month aggregate, not duplicate of station data. Rename later to `ward_groundwater_monthly`. |
| `groundwater_wris` | Split later | Observation table currently repeats station metadata; city key must be fixed first. |
| `groundwater_wris_latest` | Recreate view | Should be a city-aware latest-station view, not altered as a table. |
| `wris_river_level` | Keep short-term, split later | Same station/observation issue as groundwater. |
| `wris_rainfall` | Keep short-term, split later | Same station/observation issue as groundwater. |
| `daily_briefing` | Keep, city-scope key | Derived narrative/cache table; can later merge into generic `narratives`. |
| `ward_risk_score` | Keep, city-scope key | Derived ward scoring; can later become `ward_scores`. |
| `ward_narrative` | Keep, city-scope key | Similar narrative cache; city key and ward identity are the immediate issue. |
| `news_articles` | Keep, scope later if needed | Global/news-cache table today. Add city/place scoping only if product behavior becomes city-specific. |
| `water_bodies_census` | Keep as source table, city-scope key | Source-specific census rows should link to canonical `water_bodies`; `census_code` is not safe as a global upsert key across states. |
| `water_body_satellite_summary` | Keep, add city/body identity | Good derived observation table, but source target IDs are not enough for multi-city. |
| `reservoir_catchment_context` | Keep, add city/source identity | GEE-derived evidence; should reference `water_sources`. |
| `flow_station_daily` | Keep | Kaveri-specific observation table; already city/source/date keyed. |
| `basin_rainfall_daily` | Keep | Region/basin observation; already city/basin/date/season keyed. |
| `mettur_release_signal` | Keep, consider city/scope key | Computed Kaveri signal. If more regions use it, key by `city_id` or `place_id`. |
| `delta_infrastructure_assets` | Keep as region/domain seed | Useful but should eventually share provenance/source tables. |
| `delta_capex_projects` | Keep as region/domain seed | Same as above. |
| `pipeline_log` | Replace gradually | Too generic for lineage. Add `ingestion_runs` and `dataset_versions`. |

## JSON And GeoJSON Disposition Matrix

### Inferred Source-Of-Truth Model

The current repo mixes source extracts, manually curated canonical data, deterministic build outputs, and frontend serving artifacts in the same `public/` tree. That was pragmatic while moving fast, but it will get harder with every new city.

Use this inferred model until a formal registry exists:

| Dataset family | Current examples | Inferred current role | Recommended canonical owner | Serving strategy |
| --- | --- | --- | --- | --- |
| Live observations | Reservoir/weather/WRIS tables | Database source of truth | Supabase tables | API/query from DB, optionally cache public summaries |
| City/source config | `cities`, `water_sources`, `src/lib/cities/*`, `app/cities/*` | Split source of truth | DB or single checked-in manifest | Generate typed frontend/backend adapters |
| Manual civic facts | `facts-*.json`, `*-supply-overview.json`, `*-tanker-context.json` | Curated repo data | DB tables plus source docs | Generate static public JSON for fast UI |
| Allocation and promise ledgers | `allocations-*.json`, `promises-*.json` | Curated civic/accountability data | `allocation_arrangements`, `tracked_promises`, `source_documents` | Generate static public JSON for fast UI |
| Regional admin water inventory | `mmr-corporations-water.json`, `mumbai-ward-water-praja.json` | Curated/extracted regional and ward equity data | `administrative_units`, `supply_metrics`, `equity_metrics` | Generate regional dashboard payloads |
| Daily static snapshots | `mmr-dam-storage.json` | Generated/refreshed source extract | `dataset_assets` plus optional observation rows | Keep static public snapshot; write DB rows only where canonical |
| Manual water quality / pollution | `river-quality*.json`, `industrial-sources*.json`, `river-events*.json`, `cooum-sewage-inlets.json` | Curated repo data with citations | Domain tables linked to `source_documents` | Generate static route payloads |
| Ward admin/search | `ward-names.json`, `ward-representatives.json`, `*-localities.json` | Small structured app data | `wards`, `ward_aliases`, `ward_representatives`, `localities` | API or generated JSON; both are fine |
| Ward profiles/risk | `ward-profiles*.json`, `ward-risk-*.json` | Deterministic build output | Inputs in DB/assets; outputs reproducible | Keep static generated payloads, register versions |
| Restoration scoring | `restoration-priority*.json`, `restoration-projects*.json`, `water-bodies-flagship-*.json` | Mix of curated inputs and computed outputs | `water_bodies`, `restoration_projects`, `restoration_scores` | Generate map-ready JSON |
| GWR block summaries | `gwr-blocks*.json`, `gw-stations*.json`, `*-cgwb-stations.json` | Source extract / curated extract | `groundwater_blocks`, `monitoring_stations`, `groundwater_observations` | Static overlays can remain generated |
| OSM/KML/ArcGIS geometry extracts | `*-rivers.geojson`, `*-water-bodies-current.geojson`, `*-wards-*.geojson`, `*-gwr-blocks.geojson` | Generated source extracts | Raw source docs + script + optional PostGIS tables | Static GeoJSON/PMTiles unless DB spatial query needed |
| Basin atlas layers | `public/data/basins/**` | Feature-pack assets | `dataset_assets` first; domain tables later if queried | Static assets |
| Cascade atlas | `public/data/cascade/**`, `public/tiles/cascade/**` | Heavy deterministic build output | `dataset_assets` + pipeline metadata | Keep static/PMTiles; do not relationalize first |
| Rich-body trends | `public/data/rich-bodies/*-trend.json`, `*-verification.json`, `*-overture-buildings.json` | Generated per-body analytics | Summary/series tables for search; assets registered | Keep UI manifests/chips/tints static |
| Imagery chips/tints | `public/data/rich-bodies/imagery/**`, tints | Derived media assets | Object/static storage with `dataset_assets` | Static/object storage only |
| Research/download artifacts | `docs/research/**`, raw KML/CSV/PDF files | Source evidence | `source_documents` registry | Keep files; link from DB metadata |

The rule of thumb: if humans edit it as an authoritative fact, move it toward DB tables with citations. If scripts generate it deterministically for rendering, keep it static but register how it was produced. If it is large geometry or imagery, keep it static/CDN-first unless a product feature needs spatial querying.

### Proposed Dataset Folder Structure

Yes: the repo should make generated-vs-curated obvious from the path. The important constraint is that existing `public/data` and `public/geojson` paths are part of the live app contract, so they should be treated as serving outputs and moved only behind compatibility shims or not moved at all.

Recommended end-state:

```text
datasets/
  curated/
    shared/
    chennai/
    madurai/
    bangalore/
    mumbai/
  raw/
    cpcb/
    cgwb/
    osm/
    opencity/
    adb/
    jica/
    kspcb/
  generated/
    chennai/
    madurai/
    bangalore/
    mumbai/
  manifests/
    datasets.yml
  schemas/
    curated/
    generated/

public/
  data/
  geojson/
  tiles/
  images/
```

Meaning:

- `datasets/curated`: human-edited canonical facts, citations, translations, and editorial choices. These should be reviewed like source code.
- `datasets/raw`: downloaded or lightly converted source extracts. Keep originals when license/size allows; do not hand-edit except for documented normalization.
- `datasets/generated`: deterministic intermediate outputs from scripts. These may be committed when they are useful for review, debugging, or downstream generation.
- `public/data`, `public/geojson`, `public/tiles`, `public/images`: frontend-serving artifacts optimized for load speed and stable URLs. Ideally generated or copied from curated/raw/generated inputs, not manually edited.
- `datasets/manifests/datasets.yml`: one registry for ownership, source, script, refresh cadence, public output path, checksum, and whether the artifact is curated/generated/raw.
- `datasets/schemas`: JSON Schemas or Zod-derived schemas for validating curated and generated files before they reach `public/`.

Example manifest entry:

```yaml
- dataset_id: chennai_river_quality
  city_id: chennai
  domain: rivers
  lifecycle: curated
  canonical_path: datasets/curated/chennai/rivers/river-quality.json
  public_path: public/data/river-quality.json
  source_system: CPCB NWMP
  source_documents:
    - docs/research/cpcb/status-of-water-quality-2024.pdf
  generator: null
  refresh_cadence: annual
  owner: data-curation
  schema: datasets/schemas/curated/river-quality.schema.json
```

Example generated entry:

```yaml
- dataset_id: bangalore_ward_profiles
  city_id: bangalore
  domain: wards
  lifecycle: generated
  canonical_path: datasets/generated/bangalore/wards/ward-profiles.json
  public_path: public/data/bangalore-ward-profiles.json
  inputs:
    - public/geojson/bangalore-wards-2025.geojson
    - public/geojson/bangalore-water-bodies-current.geojson
    - public/data/gwr-blocks-bangalore.json
  generator: scripts/compute-bangalore-ward-profiles.ts
  refresh_cadence: on-input-change
  owner: build-pipeline
  schema: datasets/schemas/generated/ward-profiles.schema.json
```

Migration path:

1. Add `datasets/manifests/datasets.yml` for current files without moving anything.
2. Add validation that every public JSON/GeoJSON has a manifest entry.
3. Move clearly curated files into `datasets/curated/**`, then generate/copy the same current `public/**` paths.
4. Move generated intermediates into `datasets/generated/**` only when scripts can reproduce them.
5. Keep large static serving outputs in `public/` or object storage; register them in DB via `dataset_assets`.

This creates an obvious editing rule: humans edit `datasets/curated`, scripts write `datasets/generated` and `public`, and the app reads `public` or DB-backed APIs.

### Admin Editing Model

This folder structure also gives the future admin app a safe editing boundary. Experts should be pointed at specific curated datasets, not at broad repo access and not at generated/public outputs.

Recommended model:

- Editable through admin UI:
  - `datasets/curated/<city>/<domain>/**`
  - selected structured DB-backed tables such as `source_documents`, `data_sources`, `wards`, `water_bodies`, `restoration_projects`, or `city_facts`
- Read-only in admin UI:
  - `datasets/raw/**`
  - `datasets/generated/**`
  - `public/**`
  - migration files and app code
- Never manually edited:
  - generated map payloads
  - PMTiles
  - imagery chips/tints
  - public serving copies

The manifest should become the admin app's permission and validation map. Each dataset entry can declare:

```yaml
dataset_id: madurai_restoration_projects
city_id: madurai
domain: restoration
lifecycle: curated
canonical_path: datasets/curated/madurai/restoration/projects.json
public_path: public/data/restoration-projects-madurai.json
schema: datasets/schemas/curated/restoration-projects.schema.json
edit_policy:
  editable: true
  roles:
    - restoration_editor
    - madurai_reviewer
  required_reviewers: 1
  publish_mode: pull_request
  required_fields:
    - source_documents
    - updated_reason
    - confidence
```

Access control should be dataset-scoped, not folder-wide by default:

- city/place scope: `chennai`, `madurai`, `bangalore`, `mumbai`, `kaveri`
- domain scope: `rivers`, `groundwater`, `restoration`, `supply`, `wards`, `facts`
- lifecycle scope: most experts edit only `curated`; pipeline maintainers can regenerate `generated`
- action scope: propose, edit draft, approve, publish

For the live webapp, the admin app should not write directly to `public/**` or production tables that immediately affect users unless the dataset is explicitly marked safe for live update. The safer default is:

1. Expert edits a curated dataset in a draft workspace.
2. Admin app validates schema, required citations, and domain-specific rules.
3. A preview build or generated diff shows the exact public output change.
4. Reviewer approves.
5. A PR or controlled publish job updates curated files and regenerates serving assets.
6. `dataset_assets` / `dataset_versions` records the published version, editor, reviewer, source docs, checksum, and generated public paths.

This gives experts a precise editing surface while preserving the current fast UI path and avoiding accidental live breakage.

## PR And Commit Strategy

Plan at individual commit level, but do not assume every named "phase" must be one large PR. Because the app is live and Vercel auto-deploys on merge, the better unit is a deploy-safe PR: each merged PR should leave production healthy even if the next PR is delayed.

If this work starts after `mumbai_onboarding` merges, first create a short audit commit that updates this report against the merged baseline. Mumbai adds active ingestion, bot-refreshed public artifacts, regional admin units, and new JSON families; these should be treated as baseline, not follow-up surprises.

Recommended structure:

- Phase-1 design report:
  - one docs-only PR is fine
  - commits can mirror major ideas: DB findings, static asset strategy, admin editing model, future migration plan
- Future implementation:
  - prefer several small PRs over one large DB/backend/UI PR
  - each PR should be backward-compatible with the currently deployed app
  - destructive cleanup gets its own final PR only after observability confirms no active readers/writers remain

Example future PR breakdown:

1. `db-safety-foundation`
   - commit: dump/reconcile live schema against migrations, especially migration 026
   - commit: add DB audit/validation query or script for city-scoped keys
   - commit: recreate `groundwater_wris_latest` correctly as a city-aware view
   - commit: add additive city-aware indexes/constraints where safe
   - commit: update affected upsert conflict keys to use the new city-aware constraints
   - later cleanup PR: drop old city-blind constraints after deployed writers no longer use them

2. `reservoir-v2-cutover`
   - commit: backfill Chennai into `reservoir_daily_v2`
   - commit: dual-read or fallback-read reservoir data from v2 first
   - commit: switch Chennai scraper/ETL writes to v2
   - commit: switch forecast reads/writes to `reservoir_forecast_v2`
   - commit: add compatibility views or temporary adapters for old readers

3. `metadata-source-of-truth`
   - commit: choose DB or manifest as factual city/source owner
   - commit: add consistency checks for city/source drift
   - commit: generate frontend/backend typed adapters or document manual sync while generation is pending

4. `dataset-registry`
   - commit: add `datasets/manifests/datasets.yml` for existing public files without moving paths
   - commit: add validation that every public JSON/GeoJSON has a manifest entry
   - commit: add `dataset_assets` / `dataset_versions` schema if implementation has started

5. `curated-generated-folder-migration`
   - commit: move one low-risk curated dataset into `datasets/curated/**`
   - commit: add copy/generate step preserving the same `public/**` output path
   - commit: repeat by domain after the pattern is proven

Commit-level planning is still valuable inside each PR because reviewers can reason about intent and rollback. The PR boundary should be based on production safety, not just architecture neatness.

### Move to DB first

These are small, structured, frequently filtered, or likely to become multi-city admin data.

| File family | Target |
| --- | --- |
| `ward-profiles*.json` | `wards`, `ward_profiles`, `ward_profile_components` |
| `ward-names.json` | `wards` aliases / localized names |
| `ward-representatives.json` | `ward_representatives`, `elected_offices` |
| `*-localities.json` | `localities` with city/ward references |
| `ward-risk-*.json` | `ward_scores` or city-scoped `ward_risk_score` |
| `river-quality*.json` | `river_quality_observations`, `rivers`, `monitoring_stations` |
| `river-events*.json` | `river_events` |
| `industrial-sources*.json` | `pollution_sources` |
| `restoration-priority*.json` | `restoration_scores`, `water_body_restoration_rankings` |
| `restoration-projects*.json` | `restoration_projects` |
| `*-supply-overview.json` | `city_supply_facts`, `supply_assets`, `supply_mix_observations` |
| `facts-*.json` | `city_facts` |
| `allocations-*.json` | `allocation_arrangements`, `allocation_events`, `water_entitlements` |
| `promises-*.json` | `tracked_promises`, `promise_status_events` |
| `mmr-corporations-water.json` | `administrative_units`, `supply_metrics`, `equity_metrics` |
| `mumbai-ward-water-praja.json` | `ward_supply_metrics`, `ward_equity_metrics` |
| `gwr-blocks*.json` and `gw-stations*.json` | `groundwater_blocks`, `monitoring_stations` |
| `*-cgwb-stations.json` | `monitoring_stations`, `groundwater_observations` |
| `gee-phase1-water-body-targets*.json` | `water_bodies`, `satellite_targets` |
| `rich-bodies/*-jrc-water-trend.json` | `satellite_water_observations` |
| `rich-bodies/*-dw-water-trend.json` | `satellite_water_observations` |
| `rich-bodies/*-dynamic-world-built-trend.json` | `landcover_observations` |
| `rich-bodies/*-open-buildings-verification.json` | `building_observations` |
| `rich-bodies/*-overture-buildings.json` | `building_observations` or `dataset_assets` plus summary table |
| `rich-bodies/*-imagery-manifest.json` | `dataset_assets` plus optional `imagery_assets` |

### Register as assets now, consider PostGIS later

These are geospatial layers where static serving may still be the right product choice until the app needs database-side spatial queries.

| File family | Target |
| --- | --- |
| `public/geojson/*-wards-*.geojson` | `wards.geom` if PostGIS is adopted |
| `public/geojson/*-water-bodies-current.geojson` | `water_bodies.geom` if PostGIS is adopted |
| `public/geojson/*-water-bodies-lost.geojson` | `water_body_extents` or static asset registry |
| `public/geojson/*-rivers.geojson` | `rivers.geom` / `river_segments` |
| `public/geojson/*-gwr-blocks.geojson` | `groundwater_blocks.geom` |
| `public/geojson/*-flood-*.geojson` | `hazard_zones` |
| `public/geojson/*-drainage.geojson` | `drainage_assets` |
| `public/geojson/*-sewerage*.geojson` | `sewerage_assets` |
| `public/geojson/*-industrial-zones.geojson` | `industrial_zones` |
| `public/data/basins/**/*.geojson` | `basin_layers` if basin querying becomes interactive |

### Keep static/object-storage for now

These are large generated products or map payloads where Postgres is not automatically better.

| File family | Why |
| --- | --- |
| `public/data/cascade/*catchment*.json` | Large graph/topology outputs; frontend fetches by lake/city and can keep using static cache. |
| `public/data/cascade/*streams.json` | Large derived linework; better as static asset or vector tiles unless server-side filtering is needed. |
| `public/data/cascade/*downstream.json` | Large per-node traces; register provenance before normalizing. |
| Large whole-city GeoJSON layers | Keep static until map queries require PostGIS. |
| Imagery chips and tints | Asset registry/object storage, not relational rows. |

## Suggested New Core Tables

These are not all phase-1 migrations. They are the target vocabulary that makes later backend refactoring simpler.

| Table | Purpose |
| --- | --- |
| `data_sources` | One row per external/source system: CMWSSB, TN PWD, India-WRIS, CPCB, OpenCity, GEE, OSM, ADB, JICA, manual curation. |
| `source_documents` | URLs, report PDFs, API endpoints, publication dates, citation metadata. |
| `dataset_versions` | Versioned snapshots from a source, linked to source documents and ingestion runs. |
| `ingestion_runs` | Runtime lineage: job name, city/scope, status, started/completed timestamps, row counts, error payload. |
| `dataset_assets` | Registry for every static JSON/GeoJSON/tile/image artifact. |
| `wards` | Canonical ward identity, localized names, city, active date range, optional geometry. |
| `water_bodies` | Canonical lake/tank/reservoir/body identity, aliases, source IDs, city, optional geometry. |
| `monitoring_stations` | Canonical station identity across groundwater, river, rainfall, and quality measurements. |
| `observations_*` | Domain-specific observation tables keyed by internal IDs and dates. |

## Phase-1 Design Deliverables

Phase-1 can be considered complete when this report gives enough direction to plan implementation safely:

- Duplicate/overlapping DB tables are identified.
- City-scoping and uniqueness risks are identified.
- JSON/static asset families are classified by source-of-truth role.
- The static asset strategy preserves current UI/UX performance.
- A future migration order is proposed without shipping any production-impacting change.
- Open decisions are explicit enough for review before phase-2 backend work.

## Future DB Refactor Acceptance Criteria

The later implementation phase can be considered complete when:

- No canonical domain has both a legacy single-city table and a v2 table receiving active writes.
- Every table with `city_id` has a city-aware natural key and city-aware upsert path.
- All factual city/source metadata has one owner.
- The largest JSON/GeoJSON assets are registered in the database with provenance, even if their contents remain static.
- PostGIS remains deferred until the app needs database-side spatial queries such as radius search, server-side clipping, overlap dedupe, or request-time spatial joins.
- The `cities` to `places` rename remains deferred until a second region beyond MMR appears or the naming mismatch creates repeated code churn.
- Backend phase-2 can consume compatibility views or canonical tables without guessing which storage family is authoritative.

## Open Design Decisions

- Do we want one generic `observations` table by metric type, or domain-specific observation tables?
- What is the migration tolerance for renaming public JSON paths? Current code already centralizes some legacy Chennai exceptions, but many client fetches still assume path conventions.

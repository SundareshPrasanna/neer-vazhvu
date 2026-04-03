# GEE Phase 1 Implementation Plan

Current implementation reference:

- [GEE_PHASE1_METHODS.md](GEE_PHASE1_METHODS.md)

Companion research note:

- [GEE_RESEARCH.md](/Users/sundaresh/Documents/health_safety/neer-vazhvu/GEE_RESEARCH.md)
- [GEE_CATCHMENT_DERIVATION_PLAN.md](/Users/sundaresh/Documents/health_safety/neer-vazhvu/GEE_CATCHMENT_DERIVATION_PLAN.md)

## Goal

Ship one focused Earth Engine phase that makes Neer Vazhvu better at explaining water stress and restoration need, without turning the product into a satellite-data explorer.

Phase 1 should answer two user-facing questions:

- Are key reservoirs and lakes wetter or drier than usual for this season?
- Is catchment rainfall helping or hurting the current reservoir story?

## Phase 1 outcomes

### Must ship

- Reservoir catchment rainfall context for the major Chennai supply reservoirs.
- Water-body persistence and seasonal anomaly for a curated Phase 1 target set.
- Small, readable UI additions on the dashboard and water-body detail panel.

### Nice to have if the core work lands cleanly

- A city-level narrative sentence when many priority water bodies are below seasonal norm.
- A ward-level aggregate count of stressed water bodies for later use in `WardContext`.

### Explicitly out of scope

- Standalone heat layer
- Live Earth Engine map tiles
- Remote-sensed water quality score
- Blue-green buffer pressure scoring
- Terrain or flood-topography scoring

## Product stance

The app should expose only the summary, not the remote-sensing machinery.

Good Phase 1 phrasing:

- "Surface spread is below usual for this time of year."
- "This lake usually retains water longer into summer."
- "Poondi catchment rainfall is below normal over the last 30 days."

Bad Phase 1 phrasing:

- "NDWI is low."
- "SAR backscatter changed."
- "Dynamic World water probability is 0.61."

## Recommended scope

### 1. Reservoir context

Target reservoirs for Phase 1:

- Poondi
- Red Hills
- Chembarambakkam
- Cholavaram

Why only these four first:

- They are the core Chennai supply story.
- Repo metadata already includes catchment area for these four in [src/lib/utils/constants.ts](/Users/sundaresh/Documents/health_safety/neer-vazhvu/src/lib/utils/constants.ts):43.
- They are geographically close enough that we can validate them against known seasonal behavior.

Defer for Phase 1.5 unless catchments are verified:

- Veeranam
- Kannankottai / Thervoy Kandigai

Reservoir metrics to compute:

- `rain_7d_mm`
- `rain_30d_mm`
- `rain_30d_anomaly_pct`
- `rain_90d_anomaly_pct`
- `rainfall_context_level` = `well_below`, `below`, `near_normal`, `above`, `well_above`

Optional only if easy and stable:

- `surface_water_vs_usual_level`

### 2. Water-body context

Phase 1 should not run against every tiny pond and unnamed polygon in Chennai.

Use a curated target set:

- all OSM or matched water bodies with `priority_level in ('critical', 'high')`
- all current bodies with `area_ha >= 5`
- all named reservoirs and major named lakes
- key marsh or wetland systems if present in the current dataset

Exclude in Phase 1:

- tiny unnamed ponds
- wastewater or oxidation ponds
- industrial ash ponds and settlement ponds
- features where observed "water" is not meaningful to the public water story

This target set should be material enough to matter, but small enough to QA well. Expect roughly 150-400 bodies depending on the final filters.

Water-body metrics to compute:

- `historical_persistence_pct`
- `latest_observed_area_ha`
- `seasonal_baseline_area_ha`
- `anomaly_ratio`
- `surface_water_anomaly_level` = `much_lower`, `lower`, `near_normal`, `higher`, `much_higher`
- `observation_date`
- `sensor_source`
- `confidence_level`

## Data sources and how they work together

Phase 1 needs a split between historical baseline and current observation.

### Historical baseline

Use `JRC/GSW1_4/MonthlyHistory` for long-run seasonality and persistence.

Why:

- strong historical baseline
- monthly cadence is enough for persistence
- simple to explain

Important limitation:

- the JRC monthly history collection covers March 1984 through December 2021, so it is not enough by itself for "current" anomaly.

### Current observation

Use optical first, radar fallback.

Recommended order:

1. `GOOGLE/DYNAMICWORLD/V1` water probability composite over the last 30-45 days
2. `COPERNICUS/S1_GRD` fallback during cloudy monsoon windows or low optical coverage

Why this combination:

- Dynamic World gives a near-real-time, 10 m water signal derived from Sentinel-2 and is easier to work with than hand-tuned thresholds on every image.
- Sentinel-1 lets us avoid cloud blindness when Chennai is cloudy precisely when water conditions matter most.

Optional supporting input:

- `COPERNICUS/S2_SR_HARMONIZED` if we need a direct optical water mask for debugging or cross-checking.

### Catchment rainfall

Use `UCSB-CHG/CHIRPS/DAILY`.

Why:

- long baseline
- daily cadence
- straightforward anomaly calculation
- good fit for catchment-scale context

Do not block Phase 1 on runoff modeling. Rainfall anomaly is enough for the first release.

## Core architectural decision

Run GEE Phase 1 as a scheduled backend job outside the live app request path.

Recommended execution model:

- implement logic in the Python service codebase under `neer-vazhvu-api/`
- run it from GitHub Actions on a schedule
- write outputs to Supabase
- let the Next.js app read those summaries like any other computed data

Why this is the best fit:

- the repo already uses GitHub Actions for scheduled data work in [.github/workflows/daily-data-pipeline.yml](/Users/sundaresh/Documents/health_safety/neer-vazhvu/.github/workflows/daily-data-pipeline.yml):1
- Earth Engine jobs can run longer and are easier to operate from GitHub Actions than from an HTTP-triggered Railway request
- scheduled outputs belong in Supabase, not in generated files inside `public/`, because Vercel will not see files written on Railway or a runner after deploy

## Recommended code layout

Add a small GEE package inside the Python service:

- `neer-vazhvu-api/app/gee/__init__.py`
- `neer-vazhvu-api/app/gee/client.py`
- `neer-vazhvu-api/app/gee/config.py`
- `neer-vazhvu-api/app/gee/reservoir_context.py`
- `neer-vazhvu-api/app/gee/water_bodies.py`
- `neer-vazhvu-api/app/gee/targets.py`

Add a scheduled entrypoint:

- `neer-vazhvu-api/scripts/run_gee_phase1.py`

Add one workflow:

- `.github/workflows/gee-phase1.yml`

Add one migration:

- `supabase/migrations/010_gee_phase1.sql`

Add a frontend API route for water-body detail fetches:

- `src/app/api/water-bodies/gee/route.ts`

## Storage decision

Use Supabase, not committed JSON, for Phase 1 outputs.

Reason:

- reservoir context is scheduled and should refresh without redeploys
- water-body anomaly should update on a cadence without committing generated data
- city story and future daily briefings should be able to query the latest rows directly

## Proposed tables

### 1. `reservoir_catchment_context`

Purpose:

- latest catchment rainfall context for the dashboard and intelligence layer

Recommended columns:

- `id BIGSERIAL PRIMARY KEY`
- `reservoir reservoir_name NOT NULL`
- `context_date DATE NOT NULL`
- `window_days INTEGER NOT NULL`
- `rain_total_mm NUMERIC(8,2) NOT NULL`
- `baseline_mm NUMERIC(8,2)`
- `anomaly_pct NUMERIC(8,2)`
- `context_level TEXT NOT NULL`
- `source_dataset TEXT NOT NULL DEFAULT 'chirps_daily'`
- `geometry_version TEXT`
- `computed_at TIMESTAMPTZ DEFAULT NOW()`
- `UNIQUE(reservoir, context_date, window_days)`

Expected rows:

- 4 reservoirs x 2 windows per run if we store 30d and 90d separately

### 2. `water_body_satellite_summary`

Purpose:

- latest Earth Engine summary per curated water body target

Recommended columns:

- `id BIGSERIAL PRIMARY KEY`
- `gee_target_id TEXT NOT NULL`
- `osm_id BIGINT`
- `census_id BIGINT`
- `name TEXT`
- `summary_date DATE NOT NULL`
- `historical_persistence_pct NUMERIC(5,2)`
- `latest_observed_area_ha NUMERIC(10,2)`
- `seasonal_baseline_area_ha NUMERIC(10,2)`
- `anomaly_ratio NUMERIC(8,3)`
- `surface_water_anomaly_level TEXT NOT NULL`
- `observation_start DATE`
- `observation_end DATE`
- `sensor_source TEXT NOT NULL`
- `confidence_level TEXT NOT NULL`
- `valid_pixel_pct NUMERIC(5,2)`
- `computed_at TIMESTAMPTZ DEFAULT NOW()`
- `UNIQUE(gee_target_id, summary_date)`

This table should store latest snapshots over time. We do not need a second history table in Phase 1.

## 3. Optional later: `ward_water_body_context`

Do not make this table part of the blocking scope unless the core work is already stable.

## Geometry inputs

Phase 1 needs two geometry inputs that are not currently modeled as first-class analysis assets.

### 1. Reservoir catchment polygons

Create and commit:

- `public/geojson/chennai-reservoir-catchments.geojson`

Each feature should include:

- `reservoir`
- `display_name`
- `source`
- `geometry_version`

Important:

- these must be verified catchments, not circles around reservoir centroids
- if a reliable catchment is not available for Veeranam or Kannankottai, leave them out of Phase 1

### 2. Phase 1 water-body target manifest

Create and commit:

- `public/data/gee-phase1-water-body-targets.json`

This should be generated from:

- [public/geojson/chennai-water-bodies-current.geojson](/Users/sundaresh/Documents/health_safety/neer-vazhvu/public/geojson/chennai-water-bodies-current.geojson)
- [public/data/restoration-priority.json](/Users/sundaresh/Documents/health_safety/neer-vazhvu/public/data/restoration-priority.json)

Each target should include:

- `gee_target_id`
- `osm_id`
- `census_id`
- `name`
- `water_type`
- `area_ha`
- `priority_level`
- `include_reason`

Why keep a target manifest:

- stable IDs
- easy QA
- easy allowlist or denylist changes without touching Earth Engine code

## Processing logic

### Reservoir rainfall context

For each catchment polygon:

1. Sum CHIRPS precipitation over the last 7, 30, and 90 days.
2. Compute a historical baseline for the same seasonal window.
3. Calculate anomaly percent.
4. Bucket into human-readable levels.

Recommended baseline rule:

- use 1991-2020 where available
- if not, use the longest stable CHIRPS period available

Recommended thresholds:

- `well_below`: anomaly <= -40%
- `below`: -40% < anomaly <= -15%
- `near_normal`: -15% < anomaly < 15%
- `above`: 15% <= anomaly < 40%
- `well_above`: anomaly >= 40%

Keep thresholds configurable in code.

### Water-body summary

For each Phase 1 water-body target:

1. Compute `historical_persistence_pct` from JRC monthly history:
   - percent of months with water present over the historical window
2. Build a current optical observation:
   - composite Dynamic World water probability across the last 30-45 days
3. If optical coverage is weak:
   - use Sentinel-1 fallback
4. Estimate `latest_observed_area_ha`
5. Build a seasonal baseline area for the same month or same recent seasonal window
6. Compare current area to baseline and assign anomaly level
7. Compute confidence

Recommended anomaly thresholds:

- `much_lower`: observed / baseline < 0.60
- `lower`: 0.60-0.85
- `near_normal`: 0.85-1.15
- `higher`: 1.15-1.40
- `much_higher`: > 1.40

Recommended confidence rules:

- `high`: optical coverage good and polygon area >= 5 ha
- `medium`: some coverage gaps or complex geometry
- `low`: fallback-only or very limited valid coverage

Confidence should suppress UI when weak.

## UI plan

### Dashboard

Do not cram extra text into every reservoir card on day one.

Recommended Phase 1 UI:

- keep [src/components/dashboard/reservoir-cards.tsx](/Users/sundaresh/Documents/health_safety/neer-vazhvu/src/components/dashboard/reservoir-cards.tsx):1 mostly unchanged
- surface catchment context in the selected-reservoir drilldown area inside [src/components/dashboard/dashboard-content.tsx](/Users/sundaresh/Documents/health_safety/neer-vazhvu/src/components/dashboard/dashboard-content.tsx):1 or the chart header section
- optionally add one compact badge to a card only when the signal is strong

Text examples:

- "30-day catchment rain below normal"
- "Catchment rain near normal"

### Water-body detail panel

Add one compact "Satellite context" section in [src/components/water-bodies/unified-detail-panel.tsx](/Users/sundaresh/Documents/health_safety/neer-vazhvu/src/components/water-bodies/unified-detail-panel.tsx):1.

Show at most three lines:

- historical persistence
- latest spread vs seasonal norm
- observation freshness and confidence

Example copy:

- "Historically holds water in 68% of months"
- "Current spread is below usual for April"
- "Observed from satellite data, last updated Apr 2026"

Only show this section when:

- the selected body is in the Phase 1 target set
- confidence is not low
- a valid latest row exists

### City story

Only add this if the signal is strong and the data is fresh.

Example:

- "Many priority lakes are holding less water than usual for this season."

This can be added in [src/components/insights/city-story.tsx](/Users/sundaresh/Documents/health_safety/neer-vazhvu/src/components/insights/city-story.tsx):1 after the core data path is stable.

## API plan

### Reservoir data path

Read directly from Supabase in [src/app/page.tsx](/Users/sundaresh/Documents/health_safety/neer-vazhvu/src/app/page.tsx):1 because the page already does server-side Supabase reads.

### Water-body data path

Add a dedicated Next API route:

- `GET /api/water-bodies/gee`

Suggested behavior:

- accept `osm_id` or `census_id`
- return the latest matching `water_body_satellite_summary` row
- no bulk all-city fetch required for Phase 1 UI

Why not fetch all rows on page load:

- Phase 1 only needs detail-panel enrichment
- avoids large client fetches
- keeps the first rollout low-risk

## Scheduling

Use a new workflow instead of overloading the current daily pipeline.

Recommended workflow structure:

- `workflow_dispatch`
- daily job for reservoir catchment rainfall
- weekly job for water-body summaries

Recommended cadence:

- reservoir catchment context: daily at 06:30 IST
- water-body summaries: weekly, e.g. Monday 07:00 IST

Why split cadence:

- reservoir rainfall is useful daily
- water-body anomaly does not need daily refresh
- weekly water-body runs reduce quota pressure and QA churn

## Secrets and auth

Add these secrets:

- `GEE_SERVICE_ACCOUNT_JSON`
- `GEE_CLOUD_PROJECT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Python dependency to add:

- `earthengine-api`

Auth rules:

- decode the service account JSON in the GitHub runner
- initialize Earth Engine inside the Python job
- never commit the key

This follows the Earth Engine guidance that the Cloud project must be Earth Engine-enabled and the private key must not be stored publicly.

## QA plan

Phase 1 needs manual QA before broad rollout because water polygons in cities are messy.

### QA set

Create a fixed QA checklist of around 15 bodies:

- 4 major reservoirs
- 2 marsh or wetland systems
- 5 medium lakes across north, central, and south Chennai
- 2 edge cases with seasonal behavior
- 2 known exclusions such as industrial ponds to verify they stay out

### Validation checks

- reservoir spread direction should roughly agree with reported reservoir storage changes
- very small polygons should not produce confident anomalies
- monsoon clouds should trigger fallback or low confidence, not false certainty
- anomaly labels should match manual satellite inspection for the QA set

### Release gates

Ship Phase 1 only if:

- at least 90% of the QA set looks directionally correct
- no major reservoir has an obviously wrong anomaly label
- excluded industrial or wastewater bodies are not surfacing as public water insights

## Delivery sequence

### PR 1. Foundations

- add `earthengine-api` to [neer-vazhvu-api/pyproject.toml](/Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/pyproject.toml):1
- add GEE client/auth package
- add target-manifest builder or curated manifest
- add catchment GeoJSON asset
- add Supabase migration for Phase 1 tables

### PR 2. Reservoir context

- implement CHIRPS catchment aggregation
- write `reservoir_catchment_context`
- add workflow daily job
- surface context on the dashboard

### PR 3. Water-body summaries

- implement JRC baseline + Dynamic World current observation + Sentinel-1 fallback
- write `water_body_satellite_summary`
- add weekly workflow job
- add `/api/water-bodies/gee`

### PR 4. UI polish and validation

- add water-body detail panel section
- optionally add city-story hook
- run QA set and tune thresholds
- document freshness and limitations on the About page if needed

## Risks and mitigations

### 1. Catchment geometry risk

Risk:

- inaccurate catchments would create misleading rainfall context

Mitigation:

- do not use estimated circles
- ship only the four reservoirs with verified polygons

### 2. Urban water classification noise

Risk:

- shadows, built edges, and small ponds can create false positives

Mitigation:

- curated Phase 1 target list
- minimum size threshold
- confidence gating
- radar fallback only when needed

### 3. Quota and runtime risk

Risk:

- Earth Engine batch concurrency is limited and should not be relied on for lots of parallel exports

Mitigation:

- keep runs small
- favor direct reductions and targeted jobs over mass export pipelines
- separate daily reservoir job from weekly water-body job

### 4. UI clutter risk

Risk:

- too much new context can dilute the existing clean product

Mitigation:

- add only one compact section per surface
- hide low-confidence insights
- use narrative labels, not raw remote-sensing metrics

## Open decisions to settle before implementation

1. Catchment source:
Do we already have a trusted source for Chennai reservoir catchment polygons, or do we need to curate and verify one first?

2. Target-set size:
Do we want a strict high-confidence set first, or a broader set with more low-confidence cases hidden from UI?

3. Water-body freshness:
Is weekly refresh enough, or do we want twice-weekly refresh during monsoon months?

## Recommended decisions

- Use a strict target set first.
- Use daily reservoir context and weekly water-body refresh.
- Keep ward-level aggregation out of the blocking scope.

## Definition of done

Phase 1 is done when:

- the dashboard can explain reservoir conditions with catchment rainfall context
- selected priority water bodies can show historical persistence and current seasonal anomaly
- the insights are fresh enough to matter and restrained enough not to overwhelm users
- the implementation sits cleanly inside the existing Python + Supabase + Next.js architecture

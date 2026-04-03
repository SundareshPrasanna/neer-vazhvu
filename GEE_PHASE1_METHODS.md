# GEE Phase 1 Methods

This document is the source of truth for the Earth Engine Phase 1 behavior currently implemented in this repository.

If this file conflicts with the broader idea docs in [GEE_RESEARCH.md](GEE_RESEARCH.md), [GEE_PHASE1_PLAN.md](GEE_PHASE1_PLAN.md), or [GEE_CATCHMENT_DERIVATION_PLAN.md](GEE_CATCHMENT_DERIVATION_PLAN.md), follow this file for what the app actually does today.

## Product Surfaces

Phase 1 currently powers two user-facing surfaces:

- `Satellite Context` inside the water-body detail panel
- `Catchment Rainfall Context` on the dashboard

Phase 1 deliberately does not expose raw rasters, indices, or live Earth Engine tiles in the frontend. It writes small summary tables into Supabase and the app reads those summaries like any other product data.

## Architecture

- Earth Engine code lives in `neer-vazhvu-api/app/gee/`
- CLI entrypoint lives in `neer-vazhvu-api/scripts/run_gee_phase1.py`
- Manual workflow entrypoint lives in `.github/workflows/gee-phase1.yml`
- Water-body summaries are stored in `water_body_satellite_summary`
- Reservoir rainfall summaries are stored in `reservoir_catchment_context`

The current workflow file is `workflow_dispatch` only. In other words, Phase 1 is operational, but it is not yet on an automated schedule in this branch.

## Datasets In Use

| Dataset | Role in Phase 1 | Notes |
| --- | --- | --- |
| `GOOGLE/DYNAMICWORLD/V1` | Recent water observation for visible spread | Optical, 10 m, 45-day lookback window |
| `JRC/GSW1_4/MonthlyRecurrence` | Historical seasonal baseline | Month-level expected wetness, not day-level |
| `UCSB-CHG/CHIRPS/DAILY` | Catchment rainfall context | Used for 7, 30, and 90 day windows |
| `WWF/HydroSHEDS/HydroBASINS` | Reservoir catchment derivation support | Used to build reviewed operational polygons |
| `MERIT/Hydro/v1_0_1` | Local upstream trace support for tricky catchments | Currently important for Cholavaram refinement |

## Water-Body Satellite Summary Method

Implementation lives mainly in `neer-vazhvu-api/app/gee/water_bodies.py` and `neer-vazhvu-api/app/gee/targets.py`.

### 1. Target selection

Phase 1 does not run against every mapped water body in Chennai.

The checked-in manifest lives at `public/data/gee-phase1-water-body-targets.json`, and the selection logic is built from `public/data/restoration-priority.json`.

Current inclusion rules:

- named reservoirs
- named wetlands and marsh systems
- critical or high priority water bodies with enough usable area
- large named lakes
- selected large unnamed water bodies

Current exclusions:

- wastewater ponds
- fly ash ponds
- oxidation ponds
- settling ponds
- drains and ditches
- tiny noisy polygons that are not useful to the public water story

The checked-in Phase 1 manifest currently contains 150 reviewed targets.

### 2. Geometry source

Each target must have a current polygon from:

- `public/geojson/chennai-water-bodies-current.geojson`

The Earth Engine summary is tied to that current polygon geometry. If the polygon is missing, the target is rejected.

### 3. Current observation

For each target polygon:

1. Query Dynamic World over the last 45 days ending at the requested reference date.
2. Compute the mean `water` band across the whole window.
3. Multiply that mean water signal by pixel area.
4. Sum the result inside the polygon and convert to hectares.
5. Search backward within that window for the latest target-specific image with usable coverage and store that as `observation_end`.
6. Keep `summary_date` as the run date for the summary row.

Important interpretation note:

- this is an estimated recent visible surface-water area, not a field-survey shoreline
- because the method uses a 45-day mean probability-like water signal, it should be read as a smoothed operational estimate rather than a strict binary water mask
- the displayed observation date is the latest usable image for that specific water body, not always the newest scene seen anywhere in the batch

### 4. Seasonal baseline

For each target polygon and each month:

1. Read `JRC/GSW1_4/MonthlyRecurrence`
2. Take the `monthly_recurrence` band for that calendar month
3. Convert recurrence percent into expected wet area by multiplying by pixel area
4. Sum inside the polygon

The app uses the same calendar month as the target's latest usable observation month. That means a water body last seen clearly in March is compared to the historical March wetness pattern, not automatically to April and not to a year-round average.

### 5. Historical persistence

Historical persistence is not derived from the current 45-day window.

Instead, the code computes twelve month-level baseline areas from JRC monthly recurrence and then counts how many months meaningfully hold water.

The current persistence threshold is:

- `max(target_area_ha * 0.15, 1.0 ha)`

Persistence is then:

- `months_above_threshold / 12 * 100`

This now powers the seasonality interpretation in the UI, for example:

- `Year-round water`
- `Water most of year`
- `Seasonal water`

### 6. Water anomaly ratio and labels

The current anomaly ratio is:

- `latest_observed_area_ha / seasonal_baseline_area_ha`

Current buckets:

- `< 0.60` -> `much_lower`
- `< 0.85` -> `lower`
- `<= 1.15` -> `near_normal`
- `<= 1.40` -> `higher`
- `> 1.40` -> `much_higher`

The detail panel collapses these into user-facing tones:

- `much_lower` and `lower` -> below usual
- `near_normal` -> near usual
- `higher` and `much_higher` -> above usual

### 7. Coverage and confidence

The code also estimates usable observation coverage inside each polygon.

Current calculation:

- `valid_pixel_pct = min(valid_observed_area_ha / target_area_ha * 100, 100)`

Current confidence rules:

- `low` if coverage is missing or below `40%`
- `high` if coverage is at least `80%` and the target area is at least `5 ha`
- `medium` otherwise

Current UI rule:

- low-confidence rows are hidden from the water-body detail panel

That means some water bodies in the reviewed target set will still show no satellite block when the optical coverage is not good enough to trust.

### 8. Current limitations

- only Dynamic World is implemented today
- Sentinel-1 fallback is planned but not yet implemented
- this is a surface-water story, not a storage-volume story
- this does not infer water quality
- month-level JRC recurrence is a seasonal baseline, not a day-specific expected shoreline

## Reservoir Catchment Rainfall Method

Implementation lives mainly in `neer-vazhvu-api/app/gee/reservoir_context.py`.

### 1. Reservoir scope

Phase 1 currently covers four supply reservoirs:

- Poondi
- Red Hills
- Chembarambakkam
- Cholavaram

Veeranam and Kannankottai / Thervoy Kandigai are intentionally out of scope for now.

### 2. Catchment geometry source

Reviewed operational catchments live in:

- `public/geojson/chennai-reservoir-catchments.geojson`

These are not legal cadastral or statutory boundaries. They are reviewed operational geometries assembled from HydroBASINS, MERIT Hydro, and local drainage review so the app can say something useful about rainfall support.

This distinction matters in Chennai because linked canals, managed transfers, and reservoir operations can break a simple terrain-only story.

### 3. Rainfall aggregation

For each catchment polygon, the code computes rainfall windows of:

- 7 days
- 30 days
- 90 days

The method:

1. Sum CHIRPS daily precipitation over the window.
2. Reduce the summed image over the catchment using `Reducer.mean()`.

Interpretation note:

- the stored `rain_total_mm` is catchment-average rainfall depth in millimeters over the window, not a volumetric inflow estimate

### 4. Seasonal baseline

For each window, the code builds a same-season historical baseline from the prior 20 years of CHIRPS windows.

For example:

- the current 30-day window ending on a chosen date is compared to the same shifted 30-day window from prior years

Only valid historical windows after the CHIRPS start date are used.

### 5. Rainfall anomaly and labels

Current anomaly formula:

- `(rain_total_mm - baseline_mm) / baseline_mm * 100`

Current buckets:

- `<= -50%` -> `well_below`
- `<= -20%` -> `below`
- `< 20%` -> `near_normal`
- `< 50%` -> `above`
- `>= 50%` -> `well_above`

### 6. Current dashboard behavior

The table stores 7, 30, and 90 day rows, but the dashboard currently reads only the latest 30-day rows.

It then:

- summarizes the overall headline across the four reservoirs
- chooses one standout reservoir when anomaly magnitude is strong enough
- shows one compact status chip per reservoir

## Storage Schema

Current Supabase tables were added in `supabase/migrations/010_gee_phase1.sql`.

### `water_body_satellite_summary`

Important fields:

- `gee_target_id`
- `summary_date`
- `historical_persistence_pct`
- `latest_observed_area_ha`
- `seasonal_baseline_area_ha`
- `anomaly_ratio`
- `surface_water_anomaly_level`
- `observation_start`
- `observation_end`
- `sensor_source`
- `confidence_level`
- `valid_pixel_pct`

### `reservoir_catchment_context`

Important fields:

- `reservoir`
- `context_date`
- `window_days`
- `rain_total_mm`
- `baseline_mm`
- `anomaly_pct`
- `context_level`
- `geometry_version`

## Operational Commands

From `neer-vazhvu-api/`:

```bash
python scripts/run_gee_phase1.py check-auth
python scripts/run_gee_phase1.py build-targets --write
python scripts/run_gee_phase1.py validate-catchments
python scripts/run_gee_phase1.py run-reservoir-context --write
python scripts/run_gee_phase1.py run-water-body-summaries --write
```

Helpful notes:

- `check-auth` verifies Earth Engine service-account access
- `build-targets --write` refreshes the curated 150-target manifest
- `validate-catchments` checks that all four reviewed catchments are present
- `run-reservoir-context --write` upserts 7, 30, and 90 day reservoir rows
- `run-water-body-summaries --write` upserts the water-body satellite summaries

## Known Gaps And Next Improvements

- add Sentinel-1 fallback for cloudy periods
- automate the workflow schedule instead of manual dispatch only
- expand the reviewed target set carefully beyond the current 150 bodies
- keep refining catchment review, especially where Chennai's managed system can distort a simple rainfall story
- consider later city-story and ward-story reuse once Phase 1 behavior proves stable

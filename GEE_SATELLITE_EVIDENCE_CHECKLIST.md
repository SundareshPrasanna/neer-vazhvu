# GEE Satellite Evidence Prototype Checklist

Current implementation reference:

- [GEE_PHASE1_METHODS.md](GEE_PHASE1_METHODS.md)

Planning note:

- [GEE_SATELLITE_EVIDENCE_PLAN.md](GEE_SATELLITE_EVIDENCE_PLAN.md)

This note turns the satellite-evidence idea into a concrete build checklist for the first prototype.

## Prototype scope

Lock these decisions first:

- Use the existing `flagship-history` cohort only.
- Start with `6` reviewed frames per water body.
- Use `Sentinel-2 Harmonized` true-color as the default visual evidence.
- Support an optional `Dynamic World` water overlay toggle.
- Use still frames first, not GIF.
- Persist stable derived assets, not expiring Earth Engine thumbnail URLs.
- Keep the evidence layer behind a button or modal instead of adding more map clutter.

## Target outcome

The first prototype should let a user open a flagship lake and inspect:

- six dated satellite frames over roughly the last 12 months
- the lake outline on top of the image
- an optional water overlay derived from Dynamic World
- a plain-English explanation of what the image shows
- the actual acquisition date and source

The prototype does not need:

- full coverage for all 150 reviewed targets
- video exports
- Sentinel-1
- chart alignment on day one

## Repo touchpoints

The cleanest first implementation uses these repo locations.

### Backend and generation

- `neer-vazhvu-api/app/gee/config.py`
- `neer-vazhvu-api/app/gee/water_bodies.py`
- `neer-vazhvu-api/app/gee/targets.py`
- `neer-vazhvu-api/app/gee/client.py`
- `neer-vazhvu-api/scripts/run_gee_phase1.py`
- `.github/workflows/gee-phase1.yml`

### Frontend and API

- `src/app/api/water-bodies/gee/route.ts`
- `src/components/water-bodies/unified-detail-panel.tsx`
- `src/lib/gee/water-body-satellite.ts`
- `src/lib/i18n/translations.ts`
- `src/app/about/about-content.tsx`

### New files likely needed

- `neer-vazhvu-api/app/gee/evidence.py`
- `neer-vazhvu-api/tests/test_satellite_evidence.py`
- `src/app/api/water-bodies/gee/evidence/route.ts`
- `src/components/water-bodies/satellite-evidence-modal.tsx`
- `src/lib/gee/water-body-satellite-evidence.ts`
- `supabase/migrations/011_gee_satellite_evidence.sql`

## Implementation decision for metadata

For the first prototype, use:

- `Supabase Storage` for the image assets
- a small Supabase table for frame metadata

Recommended table name:

- `water_body_satellite_evidence`

Why this is the best first cut:

- asset URLs stay stable
- provenance lives in the same data stack the app already uses
- review and QA are easier than with a scattered local JSON file
- it keeps room for later public endpoints without changing the storage model

## Recommended metadata schema

The first table should include:

- `gee_target_id`
- `reference_date`
- `frame_date`
- `frame_rank`
- `source_dataset`
- `source_asset_id`
- `dynamic_world_asset_id`
- `image_path`
- `overlay_path`
- `usable_coverage_pct`
- `cloud_note`
- `geometry_version`
- `is_same_scene_as_overlay`
- `is_reviewed`
- `notes`
- `created_at`

Recommended uniqueness:

- unique on `gee_target_id + reference_date`

Recommended query behavior:

- latest reviewed six frames per selected target
- ordered by `frame_date`

## Recommended storage layout

Use a dedicated storage bucket such as:

- `satellite-evidence`

Recommended path pattern:

- `flagship-history/<gee_target_id>/<frame_date>/true-color.webp`
- `flagship-history/<gee_target_id>/<frame_date>/water-overlay.webp`

Why this path shape works:

- stable and human-readable
- easy to invalidate or regenerate one water body
- easy to keep different cohorts separate later

## Generation checklist

### 1. Add configuration constants

- Add `SATELLITE_EVIDENCE_BUCKET`.
- Add default frame count `6`.
- Add default evidence cohort `flagship-history`.
- Add evidence coverage threshold `80%`.
- Add image size and visualization defaults for true color and overlay.

### 2. Add an evidence module

Create `neer-vazhvu-api/app/gee/evidence.py` with functions for:

- selecting target features for the evidence cohort
- selecting candidate monthly reference dates
- finding the nearest usable Sentinel-2 scene for each target and month
- matching the corresponding Dynamic World scene where possible
- computing usable coverage for the selected scene
- building true-color and overlay visualization parameters
- generating signed Earth Engine thumbnail URLs for internal download only
- returning a structured metadata payload ready for upload and upsert

### 3. Add a local generation command

Extend `neer-vazhvu-api/scripts/run_gee_phase1.py` with a command such as:

- `build-satellite-evidence`

Recommended flags:

- `--target-cohort flagship-history`
- `--gee-target-id`
- `--months-back 12`
- `--frame-count 6`
- `--write`
- `--reviewed-only`

Expected output:

- dry-run summary by target
- selected frame dates
- selected asset IDs
- coverage values
- write mode that uploads assets and upserts metadata

### 4. Download and persist assets

The generation job should:

1. get an internal Earth Engine thumbnail URL
2. download the image server-side
3. optimize and normalize the file extension
4. upload to Supabase Storage
5. write metadata to `water_body_satellite_evidence`

Do not:

- expose the raw Earth Engine thumbnail URL in public responses
- store temporary thumbnail URLs in the DB

## Frame-selection checklist

The selection algorithm should be explicit and reviewable.

### Required rules

- Start from the monthly history window already used for `flagship-history`.
- Prefer one good frame every 1 to 2 months over the last year.
- Use the actual acquisition date of the selected scene.
- Require `usable_coverage_pct >= 80`.
- Allow nearby substitute dates when the ideal month is too cloudy.
- Publish fewer than six frames if quality is not good enough.

### Recommended ranking order

- higher usable coverage first
- closer to the target reference month second
- lower cloud contamination third
- closer Dynamic World scene match fourth

## Review and QA checklist

Before any public UI is enabled, review all flagship water bodies manually.

### For each frame, verify:

- the water body outline is correctly aligned
- the lake is readable in true color
- the overlay is directionally sensible
- the acquisition date is correct
- the stored source asset ID looks valid
- the frame is not obviously clouded, glinted, or misleading

### For each water body, verify:

- at least `4` good frames exist
- the set covers both wetter and drier points if available
- the evidence broadly matches the existing spread summaries
- the metadata row count matches the expected frame count

### Do not ship a water body if:

- all good frames are too cloudy
- the geometry looks misaligned
- the overlay consistently disagrees with obvious visible water
- the source lineage is incomplete

## Frontend checklist

### 1. Add a read path

Add `src/app/api/water-bodies/gee/evidence/route.ts` that:

- accepts `gee_target_id`, `osm_id`, or `census_id`
- resolves the selected target
- returns reviewed evidence frames for that target
- never returns expired Earth Engine links

### 2. Add a typed frontend model

Create `src/lib/gee/water-body-satellite-evidence.ts` to:

- normalize the API payload
- validate expected fields
- prepare UI-friendly labels

### 3. Add the modal

Create `src/components/water-bodies/satellite-evidence-modal.tsx` with:

- frame scrubber or date picker
- true-color image
- optional overlay toggle
- source and date labels
- short explanation of Sentinel-2 and Dynamic World
- graceful empty state when no reviewed evidence exists

### 4. Wire the detail panel

Update `src/components/water-bodies/unified-detail-panel.tsx` to:

- show a `See Satellite Evidence` button only when evidence exists
- keep the main panel compact
- avoid loading all imagery by default on page load

## Copy and public-methods checklist

Update user-facing docs so the evidence layer is understandable.

### About page

Add one short section explaining:

- the image is Sentinel-2 true color
- the optional overlay is derived from Dynamic World
- the evidence shows visible surface spread, not storage volume
- some months may be skipped when the view is not usable

### Detail-panel copy

The evidence modal should say:

- what date the image is from
- what the overlay represents
- what users should not infer from it

### Public methods docs

After the prototype ships, update:

- `GEE_PHASE1_METHODS.md`
- `README.md`
- `src/app/about/about-content.tsx`
- `src/lib/i18n/translations.ts`

## Workflow checklist

The first rollout should not be fully automated until the generated frames are reviewed.

### Prototype phase

- manual CLI generation
- manual QA review
- manual upload and metadata write

### After review is stable

Add a manual GitHub Actions task to `.github/workflows/gee-phase1.yml`:

- `build-satellite-evidence`

Do not schedule this immediately.

Reason:

- evidence assets need human QA
- they change more slowly than the summary tables
- generation mistakes are much more visible than summary mistakes

## Rollout sequence

Use this order.

### PR 1. Schema and generation foundation

- add storage/table migration
- add backend evidence module
- add CLI command
- add tests for frame selection and metadata shaping

### PR 2. First reviewed dataset

- generate six reviewed frames for all 12 flagship lakes
- upload assets
- write metadata rows
- record any gaps or excluded lakes

### PR 3. Frontend modal

- add evidence API route
- add modal component
- wire the detail panel button
- add empty states and copy

### PR 4. Public docs and QA notes

- update About-page copy
- update methods docs
- add operator notes for regeneration and review

## Acceptance criteria

Call the prototype done only if:

- all 12 flagship targets have at least one reviewed evidence row
- at least 10 of the 12 have four or more good frames
- the modal loads stable stored assets, not Earth Engine URLs
- each visible frame shows exact date and source
- the copy clearly distinguishes true-color imagery from derived overlay
- the evidence does not make the panel feel crowded on mobile

## Best next build step

The next implementation step should be:

- create the schema and backend generation foundation first

That keeps the UI work blocked on real reviewed data rather than mock placeholders.

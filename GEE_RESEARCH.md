# Google Earth Engine Research for Neer Vazhvu

Current implementation reference:

- [GEE_PHASE1_METHODS.md](GEE_PHASE1_METHODS.md)
- [GEE_SATELLITE_EVIDENCE_PLAN.md](GEE_SATELLITE_EVIDENCE_PLAN.md)

This note captures the broader product research and option space. For the behavior currently implemented in the repo, follow the methods doc above.

## Why GEE fits this project

Neer Vazhvu already does a good job of turning public water data into readable, low-noise stories. Google Earth Engine (GEE) should extend that pattern, not replace it.

The best use of GEE here is:

- derive a few strong, spatially grounded water indicators that Chennai users can understand quickly
- improve existing scoring and narratives behind the scenes
- export small summaries into the app, instead of serving raw satellite layers directly to end users

The wrong use of GEE here would be:

- adding a generic "satellite" page
- exposing too many raster layers and indices
- showing remote sensing outputs that are not validated or easily explainable

## Product principle

Use GEE for observed change, not data theater.

For this app, the highest-value satellite questions are:

- Is this lake or reservoir actually holding water, and how unusual is that for this season?
- Is a ward losing blue-green buffering around water bodies and marshes?
- Are reservoir catchments or flood-prone basins wetter or drier than normal?
- Is heat telling us something about water stress, recharge loss, or flood buffering loss?

## Current app surfaces GEE can strengthen

- Dashboard: catchment rainfall and runoff context can make the reservoir story less dependent on one weather point.
- Water bodies / restoration: historical water persistence and nearby built-up pressure are a strong fit for the existing restoration model.
- Groundwater: a blue-green / recharge proxy can strengthen ward narratives when groundwater data is stale.
- Flood risk: antecedent wetness and terrain-derived drainage burden can sharpen flood context without replacing the existing OpenCity hazard layers.
- City story / AI narratives: GEE is best as one sentence of evidence, not as a dense new dashboard.

Relevant integration points in this repo already exist:

- `scripts/compute-restoration-priority.ts`
- `scripts/compute-ward-profiles.ts`
- `src/components/insights/ward-context.tsx`
- `src/components/insights/city-story.tsx`
- `src/components/groundwater/ward-detail-panel.tsx`

## Recommended shortlist

### 1. Water spread persistence and seasonal anomaly

This is the strongest GEE opportunity for Neer Vazhvu.

What to compute:

- monthly or seasonal water presence for major reservoirs, marshes, and important urban lakes
- historical persistence baseline for each water body
- current-season anomaly: wetter than usual, near normal, drier than usual
- dry-season and wet-season area ranges for each water body

Best datasets:

- `JRC/GSW1_4/MonthlyHistory`
- `JRC/GSW1_4/YearlyHistory`
- `JRC/GSW1_4/GlobalSurfaceWater`
- `COPERNICUS/S1_GRD` for monsoon-season updates when cloud blocks optical imagery
- `COPERNICUS/S2_SR_HARMONIZED` for clearer optical water masks

Why it fits:

- The app already maps water bodies, lost water bodies, reservoirs, marsh-adjacent flood systems, and restoration priority.
- Users understand "this lake usually holds water for 6 months, but recently it holds water for 2" far more easily than NDWI or SAR backscatter.
- It gives you a clean bridge between water scarcity, restoration, and flood buffering.

Where to surface it:

- reservoir cards or reservoir drilldown: "catchment wetness" and "surface spread vs usual"
- water body detail panel: "historical persistence", "last 3 monsoons", "dry season stress"
- ward context: count of low-persistence water bodies in the ward
- city story: one sentence when a large share of critical water bodies are below seasonal persistence

Why it matters for Chennai:

- A Chennai study using Landsat imagery found NDWI was well suited for extracting surface water bodies, while MNDWI was useful for inundated areas in urban settings and could support urban planning and flood-disaster management.

Implementation note:

- Start with static monthly summaries exported to JSON for key water bodies.
- Do not start by streaming live Earth Engine tiles to the frontend.

### 2. Blue-green buffer loss and encroachment pressure

This is the best way to improve the restoration page without overwhelming the user.

What to compute:

- built-up share within 100m / 250m / 500m of each water body
- tree and vegetation cover around lakes, marshes, and river corridors
- change in built-up and green cover since 2016 around selected water bodies and ward buffers
- ward-level "blue-green deficit" or "buffer pressure" summary

Best datasets:

- `GOOGLE/DYNAMICWORLD/V1`
- `ESA/WorldCover/v200`
- `COPERNICUS/S2_SR_HARMONIZED` if you want direct custom vegetation / bare-soil composites

Why it fits:

- The restoration model currently depends on size, lost-water-body proximity, river pollution, industrial proximity, type, and census condition.
- GEE can add real observed landscape pressure without making the model unreadable.
- This is also a better story than a generic "encroachment map", because it ties directly to recharge, flood storage, and restoration urgency.

Where to surface it:

- water body detail panel: one line such as "built-up cover within 250m is high and rising"
- restoration ranking: use as a tie-breaker or hidden secondary score first
- ward context: low blue-green buffer can support flood and groundwater narratives

Implementation note:

- Do not immediately add this to the public restoration score.
- First ship it as an explanatory insight. If it behaves well and matches on-the-ground reality, then fold it into scoring later.

### 3. Catchment rainfall and runoff context for reservoirs and flood basins

This is the best backstage GEE use because it can improve existing intelligence with very little new UI.

What to compute:

- 7-day, 30-day, and seasonal rainfall over each reservoir catchment
- rainfall anomaly versus historical normal
- antecedent wetness / runoff context for the Adyar, Cooum, Kovalam, and Pallikaranai-connected basins
- simple saturation flag for flood briefings

Best datasets:

- `UCSB-CHG/CHIRPS/DAILY`
- `ECMWF/ERA5_LAND/DAILY_AGGR`
- optional terrain support from `NASA/NASADEM_HGT/001` or `WWF/HydroSHEDS/15ACC`

Why it fits:

- The current pipeline uses one Chennai weather point for the reservoir model.
- Reservoir inflow and flood response are catchment problems, not city-centroid problems.
- This improves the dashboard and daily intelligence layer even if the user never sees a new map.

Where to surface it:

- dashboard: "Poondi catchment rainfall is 38% below its 30-year normal"
- daily briefing: "Adyar basin is already wet before today's rain"
- flood page banner: "antecedent runoff is elevated"

Important caution:

- This needs reasonable catchment geometries. If high-quality local catchments are not available, do not fake precision with simple circles.

### 4. Heat as a water story, not as a separate product

Heat belongs here only when framed as a consequence of blue-green loss and a signal for water stress.

Good framing:

- hotter wards often have less vegetation, less open water, more impervious area, faster runoff, weaker local cooling, and lower recharge opportunity
- marshes, lakes, and tree cover are both water infrastructure and cooling infrastructure
- restoring a lake can be presented as a triple benefit: recharge, flood buffering, and local cooling

Bad framing:

- a standalone heat map with no connection to water bodies, recharge, or flooding

What to compute:

- summer median land surface temperature anomaly by ward
- co-analysis with water cover and vegetation cover
- optional "cooling and recharge deficit" composite for wards with high LST plus low blue-green cover

Best datasets:

- `LANDSAT/LC08/C02/T1_L2`
- `LANDSAT/LC09/C02/T1_L2`
- optional city-scale smoothing from `MODIS/061/MOD11A2`
- use `GOOGLE/DYNAMICWORLD/V1` or Sentinel-2 to explain whether heat aligns with built-up expansion and blue-green loss

Why it fits:

- A Chennai study reported green cover loss of 13.33% and LST increase of 6.53 C between 2013 and 2022, with a substantial negative relationship between NDVI and LST.
- That is useful here only if it helps explain why certain wards are becoming more water-stressed, runoff-prone, or less buffered by lakes and vegetation.

Where to surface it:

- ward detail panel as a small contextual chip, only when the signal is strong
- water body restoration narrative: "this corridor has lost blue-green cooling"
- city story when a heat anomaly overlaps with low water persistence and weak vegetation

Recommendation:

- Do not launch this as its own map layer first.
- Start with a ward-level narrative metric called something like `blue_green_cooling_gap` or `cooling_and_recharge_pressure`.

### 5. Terrain-derived drainage burden

This is useful, but lower priority because the app already has strong flood layers.

What to compute:

- low-lying pockets
- upstream accumulation / drainage burden
- relative topographic wetness or simple depression / flow concentration indicators

Best datasets:

- `NASA/NASADEM_HGT/001`
- `WWF/HydroSHEDS/15ACC`

Why it is lower priority:

- OpenCity CFLOWS hazard zones and drainage layers already give users a practical flood picture.
- DEM-derived flood proxies are better for internal scoring and validation than for public-facing maps at the start.

Use this later for:

- address-based flood-risk experiments
- identifying wards where drainage gaps align with topographic burden and lost wetlands

## What not to prioritize yet

### Remote-sensed water quality for public display

Sentinel-2 can support turbidity or bloom-style proxies, but for Chennai's urban rivers and many small lakes this is easy to overstate and hard to validate. Without local calibration or field sampling, this should not become a user-facing "water quality" score.

### Groundwater from coarse global products

Products like GRACE are much too coarse for Chennai ward-scale groundwater storytelling. They can mislead more than help.

### Live Earth Engine tiles in the frontend

This app already performs well with committed GeoJSON and JSON. For this product, scheduled exports of compact summaries are a better fit than live authenticated tile serving.

## Suggested data model additions

Add small derived products rather than another giant map payload.

Suggested water-body summary fields:

- `historical_water_persistence_pct`
- `wet_season_area_ha`
- `dry_season_area_ha`
- `last_3y_monsoon_fill_pct`
- `buffer_built_pct_250m`
- `buffer_tree_pct_250m`
- `surface_water_anomaly_level`

Suggested ward summary fields:

- `summer_lst_anomaly_c`
- `blue_green_cover_pct`
- `cooling_and_recharge_pressure`
- `water_persistence_stressed_count`
- `catchment_rainfall_anomaly_pct` where a ward cleanly maps to a basin
- `antecedent_wetness_flag`

## Recommended implementation shape

### Pipeline

- Run Earth Engine as a scheduled backend job, not from the client.
- Use zonal summaries with `ee.Image.reduceRegions()` over wards, water-body polygons, and catchment polygons.
- Export small tables or vectors with `Export.table.toDrive()`, `Export.table.toCloudStorage()`, or `Export.table.toAsset()`.
- Ingest the exported results into committed JSON files or Supabase tables.

### Auth and ops

- Use an Earth Engine-enabled Google Cloud project.
- Authenticate jobs with a service account.
- Keep the service account key out of the repo.
- Design around Earth Engine batch limits; default quotas are not built for lots of parallel export jobs.

### Repo fit

For this codebase, the cleanest path is likely:

- Python Earth Engine script or small standalone Node/Python worker
- scheduled weekly or monthly export
- write summarized outputs into either:
  - `public/data/gee-water-body-insights.json`
  - `public/data/gee-ward-insights.json`
  - or new Supabase tables if freshness matters

## Suggested rollout plan

### Phase 1: highest confidence

- historical water persistence for reservoirs and priority lakes
- seasonal anomaly labels for selected water bodies
- catchment rainfall anomaly for reservoir narrative

### Phase 2: strengthen restoration and ward context

- blue-green buffer pressure around water bodies
- ward-level cooling and recharge pressure
- GEE-backed narrative hooks in ward and city insights

### Phase 3: advanced flood support

- antecedent wetness and runoff flags for flood briefings
- terrain-derived drainage burden for internal scoring and experimentation

## Final recommendation

If we only do one GEE feature first, it should be:

- water spread persistence and seasonal anomaly for reservoirs, marshes, and top restoration-priority lakes

If we do a second:

- blue-green buffer loss around water bodies, because it connects restoration, flooding, and heat without needing a new app surface

If heat is included:

- ship it as a water-linked "cooling and recharge pressure" insight, not as a separate heat product

## Sources

- Earth Engine data catalog: JRC Global Surface Water Mapping Layers v1.4
  - https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_GlobalSurfaceWater
- Earth Engine data catalog: JRC Monthly Water History v1.4
  - https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_MonthlyHistory
- Earth Engine data catalog: JRC Yearly Water Classification History v1.4
  - https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_YearlyHistory
- Earth Engine data catalog: Dynamic World V1
  - https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1
- Earth Engine data catalog: Sentinel-2 SR Harmonized
  - https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED
- Earth Engine data catalog: Sentinel-1 GRD
  - https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD
- Earth Engine data catalog: CHIRPS Daily
  - https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY
- Earth Engine data catalog: Landsat 8 Level 2 Collection 2 Tier 1
  - https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LC08_C02_T1_L2
- Earth Engine data catalog: Landsat 9 Level 2 Collection 2 Tier 1
  - https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LC09_C02_T1_L2
- Earth Engine data catalog: MODIS MOD11A2 Land Surface Temperature
  - https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD11A2
- Earth Engine data catalog: MODIS MOD16A2GF Evapotranspiration
  - https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD16A2GF
- Earth Engine data catalog: ERA5-Land Daily Aggregated
  - https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_DAILY_AGGR
- Earth Engine data catalog: NASADEM 30m DEM
  - https://developers.google.com/earth-engine/datasets/catalog/NASA_NASADEM_HGT_001
- Earth Engine data catalog: WWF HydroSHEDS Flow Accumulation
  - https://developers.google.com/earth-engine/datasets/catalog/WWF_HydroSHEDS_15ACC
- Earth Engine guide: service accounts
  - https://developers.google.com/earth-engine/guides/service_account
- Earth Engine guide: usage and quotas
  - https://developers.google.com/earth-engine/guides/usage
- Earth Engine API docs: `ee.Image.reduceRegions`
  - https://developers.google.com/earth-engine/apidocs/ee-image-reduceregions
- Earth Engine guide: exporting table and vector data
  - https://developers.google.com/earth-engine/guides/exporting_tables
- Chennai water-body remote sensing paper
  - https://indjst.org/articles/assessment-of-the-temporal-variations-of-surface-water-bodies-in-and-around-chennai-using-landsat-imagery
- Chennai vegetation / heat paper
  - https://indjst.org/articles/impact-of-urban-vegetation-loss-on-urban-heat-islands-a-case-study-of-chennai-metropolitan-area

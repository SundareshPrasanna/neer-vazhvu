# Lake Catchment Atlas - catchment delineation + clickable area-of-influence

Status: SHIPPED (Chennai, Madurai, Bengaluru). This file is the original planning spec, kept for context.
Owner: Sundaresh
Reference benchmark: [Hyderabad Lake Atlas](https://lakeatlas.hyderabad.urbanobservatory.in/) (Hyderabad Urban Lab)

> **As-built note.** The authoritative description of what shipped is
> [docs/methodology/catchment-atlas-v1.md](../methodology/catchment-atlas-v1.md).
> Several decisions below changed during the build:
> - **Tooling:** WhiteboxTools (not pysheds) for breach/flow/streams.
> - **Catchment definition:** a threshold-free **incremental own / received / total**
>   model (upstream BFS barriered by other water bodies), not pour-point snapping +
>   a single watershed. own + received = total; no impound-vs-transit heuristics.
> - **Downstream:** each lake's overflow is traced as a **flow path to the river**
>   (the "click-anywhere downhill trace" of section 5.3 Phase 2, delivered per-lake).
> - **Home:** it lives as the **"Catchments" view mode on `/[city]/water-bodies`**
>   (section 5.1), not a separate `/water-map` route.
> - **Added after this spec:** the false-river ribbon filter, authoritative
>   lake-name backfill (ATREE/CSEI for Bengaluru) + downstream-river naming, both
>   reconciled by `app/cascade/enrich_names.py`.
> - **Deferred / not built:** client-side rainfall window toggles (5.4) and PMTiles
>   for catchments (the lake layer ships as static GeoJSON; per-lake catchment /
>   basin / streams / downstream are fetched on click).

## 1. Goal

Make every lake/tank clickable so a reader can see its **area of influence**: the
catchment that drains into it, the streams that feed it, where its overflow goes
downstream, its rainfall history, and how much rooftop harvest its catchment could
yield. The quality bar is the Hyderabad Lake Atlas per-lake panel, reproduced for
our cities.

This is the keystone that turns the existing cascade graph (edges between tanks)
into a catchment model (the contributing area of each tank). Without catchment
polygons we cannot compute catchment area, buildings-in-catchment, rooftop area,
rooftop harvest, area-weighted rainfall, or the cumulative-network roll-ups. With
them, every number in the benchmark panel falls out automatically and scales to
every lake in the city.

## 2. What we already have (do not rebuild)

From the cascade pipeline (`neer-vazhvu-api/scripts/run_cascade.py` →
`app.cascade.*`), per district, in `public/data/cascade/`:

- `{district}-cascade-nodes.geojson` - tank centroids with `osm_id`, `area_ha`,
  `elevation_m`, `flow_direction_d8`, `degree_in/out`, `cascade_position`,
  `drains_to_river`, `river_outlet_distance_km`, `isolation_reason`.
- `{district}-cascade-edges.geojson` - directed tank-to-tank LineStrings with
  `distance_km`, `elevation_drop_m`, `score_m_per_km`, `confidence`.
- `{district}-cascade-river-outlets.geojson` - tanks draining to a river.
- Bangalore: 1,033 nodes, 1,053 edges, 43 river outlets, max cascade depth 11.

Other assets the new stage joins against:

- **Overture building footprints** (refreshed 2026-06-08, commit `6cefc17`).
- **Rainfall**: NASA POWER + IMD already pulled; for Bangalore, KSNDMC telemetric
  rain gauges are a denser option worth wiring (see 5.4).
- **GEE** is already authenticated and used (`app.gee.client`, `run_gee_phase1.py`,
  `earthengine-api` dependency).
- Leaflet map components: `src/components/cascade/cascade-map-layer.tsx`,
  `src/components/water-bodies/unified-map.tsx`; the Pallikaranai
  `rich-body-overlay.tsx` is the side-panel styling precedent.

The two deltas vs the benchmark: (a) we infer tank-to-tank **edges** but never
delineate the **contributing area** (step missing), and (b) we sample elevation at
90 m (HydroSHEDS); the benchmark uses 30 m bare-earth (FABDEM).

## 3. DEM choice + licensing (DECISION REQUIRED)

Catchment quality is bounded by the DEM. This is a real decision because it
interacts with monetization.

| DEM | Res | Bare-earth? | License | Fit |
| --- | --- | --- | --- | --- |
| HydroSHEDS 03CONDEM (current) | 90 m | conditioned | CC-BY 4.0 (commercial OK) | coarse for urban catchments; what we use today |
| FABDEM | 30 m | yes (buildings + canopy removed) | CC-BY-NC-SA 4.0 (**non-commercial**) | benchmark's choice; best urban accuracy; license blocks commercial use |
| Copernicus GLO-30 (COP-DEM) | 30 m | no (DSM - includes buildings) | open, commercial OK | buildings act as false dams in flat urban terrain |
| MERIT Hydro | 90 m | conditioned, on GEE (`MERIT/Hydro`) | CC-BY-NC 4.0 (non-commercial) | ships flow dir + accumulation + upstream-area precomputed |

Recommendation: **FABDEM 30 m for V0** (we are currently a free civic/research
platform, so NC is fine and accuracy matters most), and treat the commercial-DEM
swap as a known follow-up flagged in the methodology - either license FABDEM
commercially or derive a bare-earth surface from Copernicus GLO-30 if/when the
platform monetizes. Document the resolution and bare-earth choice in the per-lake
provenance, same discipline as the existing cascade methodology.

## 4. New pipeline stage: `delineate-catchments`

Add one subcommand to `run_cascade.py`, dispatching to a new
`app/cascade/catchments.py`. It runs after `build-topology` (which produces the
nodes we delineate from) and before `score`/`publish`.

```
python scripts/run_cascade.py --district bangalore delineate-catchments
```

### 4.1 Tooling

Add a local raster hydrology library. GEE does watershed delineation poorly;
per-pour-point watersheds are exactly what these tools do well:

- **Primary: `pysheds`** (pure pip: numpy/scipy/rasterio) - lightweight, integrates
  as a library, matches the pipeline's pure-Python ethos.
- **Alternative: `whitebox`** (pip-installs a binary) - more robust pour-point
  snapping (`SnapPourPoints`/`JensonSnapPourPoints`), `Watershed`, `UnnestBasins`,
  `StrahlerStreamOrder`. Use if pysheds snapping proves fiddly.

New optional dependency group in `pyproject.toml`:
`hydro = ["pysheds>=0.4", "rasterio>=1.3"]` (or `whitebox`).

### 4.2 Algorithm (`catchments_v1`)

1. **Acquire + mosaic DEM**: download FABDEM 1°x1° tiles covering the district
   bbox (buffered ~5 km so edge catchments close), mosaic + clip to a cached
   GeoTIFF. Record an `inputs_hash` (same discipline as the existing stats
   manifest).
2. **Condition**: breach depressions (preferred over fill for urban - preserves
   channels under roads/culverts), then resolve flats.
3. **Flow direction (D8)** and **flow accumulation**.
4. **Stream network**: threshold accumulation (contributing-area cutoff, tunable,
   e.g. >= 0.5 km^2) -> stream raster -> vectorize -> **Strahler order**. Write
   `{district}-streams.geojson` (the blue feeder-stream layer).
5. **Pour points**: for each tank node, outlet = the lake-boundary cell with max
   flow accumulation; then **snap to the stream network** within ~2 cells. THIS
   SNAP IS THE #1 CORRECTNESS GOTCHA - an unsnapped pour point sitting one cell off
   the channel yields a tiny or empty catchment. Snapping is mandatory.
6. **Watershed delineation** per snapped pour point -> catchment polygon. Write
   `{district}-cascade-catchments.geojson`, one polygon per `osm_id` with
   `catchment_area_sqkm`.
7. **Cheap rich attributes** (joins, no new modelling):
   - `buildings_in_catchment` + `rooftop_area_sqkm`: clip Overture footprints to
     the catchment polygon; count + sum area.
   - `rooftop_harvest_litres = rooftop_area_m2 * rainfall_depth_m * 0.8` (same
     0.8 runoff coefficient the benchmark uses; document it).
   - rainfall: see 5.4.
8. **Cumulative network** (reuse the existing directed edge graph - we already have
   it): transitive upstream closure per node; sum `catchment_area`,
   `rooftop_area`, `buildings` over self + all upstream nodes. Compute
   `distance_to_river` as path length along the downstream edge chain to the river
   outlet. Write these back into node properties.

### 4.3 New / changed outputs

- `{district}-cascade-catchments.geojson` (NEW) - per-lake catchment polygons +
  `catchment_area_sqkm`, `buildings_in_catchment`, `rooftop_area_sqkm`,
  `rooftop_harvest_litres`.
- `{district}-streams.geojson` (NEW) - Strahler-ordered feeder streams.
- `{district}-cascade-nodes.geojson` (EXTENDED) - add `catchment_area_sqkm`,
  `cumulative_catchment_sqkm`, `cumulative_rooftop_sqkm`, `cumulative_buildings`,
  `distance_to_river_km`.
- `{district}-catchment-rainfall.json` (NEW) - per-catchment daily rainfall series
  + a shared series so the client recomputes windows instantly (see 5.4).
- PMTiles: extend the existing `tile` stage to emit catchment polygons + streams
  (1,000+ polygons is too heavy as raw GeoJSON on the client).

## 5. Frontend: the clickable area-of-influence

### 5.1 Where it lives

Promote this to the flagship deep-object map view. Either evolve `/[cityId]/cascades`
(currently a health *list* panel) into a full-bleed map, or add `/[cityId]/water-map`.
Recommendation: new full-bleed route, keep the health panel as a secondary tab.

### 5.2 Map

- Full-bleed Leaflet (reuse `unified-map.tsx` / `cascade-map-layer.tsx`).
- **Styled basemap** (the cartography upgrade) + satellite toggle. 3D terrain is
  Phase 2.
- Layers: lake polygons (always), feeder streams (Strahler width-graded),
  catchment polygons + cascade edges (revealed on selection), from PMTiles.

### 5.3 Interaction (mirrors the benchmark)

- **Hover a lake** -> highlight.
- **Click a lake** ->
  - its catchment polygon fades in (the area of influence),
  - upstream lakes + feeding edges highlight in one colour; the downstream chain to
    the river in another (we have the directed graph + river outlets),
  - feeder streams inside the catchment show,
  - a side panel slides in (Pallikaranai `rich-body-overlay` styling) with:
    lake area, catchment area, rainfall block with 7d/30d/90d/1y/Full toggles,
    rooftop harvest, drainage network (upstream/downstream counts, drains-to,
    distance to river), cumulative network. Field-for-field the benchmark panel.
- **Rainfall window toggles** recompute client-side from the shipped daily series
  (instant, like the benchmark) - no refetch.
- **Click anywhere -> trace downhill** to the terminal lake/river: Phase 2 (needs
  the flow-direction raster or a precomputed flow-path service shipped to the
  client). V0 restricts clickability to lakes, which already delivers the
  area-of-influence the benchmark is known for.

### 5.4 Rainfall honesty

The benchmark area-weights ~1,090 ground stations via Thiessen polygons. Our
default grids (NASA POWER ~0.5deg, IMD 0.25deg) are coarser; be explicit about it
in provenance. **Bangalore opportunity**: KSNDMC runs a dense telemetric rain-gauge
network (hobli/ward level) - wiring that for Bangalore could match or beat the
benchmark's station density. Method per catchment: area-weighted overlap of the
rainfall grid/stations with the catchment polygon; derive total/avg/max/dry-spell/
rain-spell as pure timeseries stats.

## 6. Phasing

- **Phase 0 - pipeline keystone (backend only)**: `delineate-catchments` stage;
  catchments + streams + extended nodes + cumulative roll-ups. Validate numbers
  (see 7) before any UI. This unblocks everything.
- **Phase 1 - clickable area-of-influence**: full-bleed styled map; click-lake ->
  catchment + drainage + side panel with rainfall (windowed), rooftop harvest,
  cumulative network. The deliverable as asked.
- **Phase 2 - depth**: 3D terrain; click-anywhere downhill trace; denser rainfall
  (KSNDMC for Bangalore).
- **Phase 3 - breadth + integration**: roll to all cascade cities; per-catchment
  honesty/confidence layer; overlay citizen sightings + pollution-profile per
  catchment.

## 7. Validation (to hit the quality bar)

- **Pour-point snapping** is mandatory; spot-check that catchments are not
  degenerate (no near-zero areas for real tanks).
- **Ground-truth check**: Bellandur catchment is well documented (~148 km^2 in
  IISc/BWSSB literature) and famous - delineate it first and compare. Varthur,
  Hebbal cascades similarly documented.
- **Internal consistency**: cumulative catchment of a terminal tank should
  approximate the sum of its sub-catchments; total district catchment should not
  exceed district + buffer area.
- **Rooftop sanity**: rooftop_area / catchment_area ratio should track known
  built-up fraction (e.g. dense core ~10-15%, peri-urban lower). The benchmark's
  lake_12461 shows 1.69 / 16.08 ≈ 10.5%.

## 8. Known limitations (carry into methodology, same as cascade v1)

- DEM resolution + bare-earth choice (section 3); commercial-DEM swap deferred.
- Single-outflow assumption inherited from the edge graph (Bangalore already uses
  multi-outflow) affects downstream-chain rendering.
- Rainfall grid coarseness vs the benchmark's station Thiessen (section 5.4).
- OSM tank-coverage gaps (documented chains resolve to OSM at ~18% Madurai / ~65%
  Chennai) limit completeness, not correctness.

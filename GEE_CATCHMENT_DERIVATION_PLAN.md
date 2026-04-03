# GEE Catchment Derivation Plan

Current implementation reference:

- [GEE_PHASE1_METHODS.md](GEE_PHASE1_METHODS.md)

This note turns the catchment question into an execution plan for Phase 1.

## Bottom line

We should not wait for a single perfect official shapefile to appear online.

For Phase 1, the best path is:

1. Use official or quasi-official artifacts where they exist.
2. Derive upstream catchments from hydrologic terrain data where they do not.
3. Validate every polygon against Chennai drainage and reservoir layers before putting it into the app.
4. Be explicit in product copy when a reservoir is heavily influenced by canals or inter-basin transfers.

The goal is not a legal boundary. The goal is a reviewed operational catchment that is good enough for rainfall context and inflow support narratives.

## Important constraint

Catchments cannot be reliably inferred from optical satellite imagery alone.

They are inferred from:

- elevation
- flow direction
- upstream drainage area
- a reviewed pour point at the reservoir outlet or inflow control point

That means the core derivation inputs should be hydrologic terrain datasets such as:

- `MERIT/Hydro/v1_0_1` in Earth Engine
- HydroBASINS / HydroSHEDS
- Bhuvan hydrologic base layers
- Copernicus DEM GLO-30 as a secondary terrain cross-check

## Recommended shared workflow

### 1. Build a common review stack

Use these layers for all four reservoirs:

- reservoir waterbody polygon
- rivers and streams
- macro and micro drains
- Krishna Water Canal
- Buckingham Canal where relevant
- ward or village context only for QA, not for hydrologic delineation

Recommended sources:

- Bhuvan 2D hydrologic base for basin, sub-basin, and watershed viewing
- HydroBASINS for downloadable upstream basin structure
- OpenCity Chennai Basin drainage and waterbody KML layers
- Copernicus DEM and MERIT Hydro for terrain and flow logic

### 2. Create an initial polygon

For each reservoir:

1. Identify the review point that best represents the reservoir control location.
2. Delineate the upstream contributing area from hydrologic terrain data.
3. Simplify only after review, not before.

### 3. Review against engineered water movement

For Chennai, terrain-only output is not enough.

We must check whether the polygon conflicts with:

- Krishna transfer canals
- linked reservoir operations
- surplus channels
- urban drains that are hydraulically important but not terrain-obvious

### 4. Store as curated geometry

Each final feature in `public/geojson/chennai-reservoir-catchments.geojson` should carry:

- `reservoir`
- `geometry_version`
- `source_type` with values like `official`, `derived`, or `hybrid`
- `confidence` with values like `high`, `medium`, `low`
- `notes`

## Reservoir-by-reservoir plan

### 1. Red Hills / Puzhal

Recommended approach:

- Use a hybrid polygon.
- Start from the official CMDA Red Hills Catchment Area map and village list.
- Reconcile that planning boundary with a DEM-derived upstream area to the reservoir.

Why this is the strongest candidate:

- CMDA explicitly defines a protected Red Hills catchment area tied to Red Hills and Puzhal lakes.
- This is the best official boundary artifact we have for any of the four reservoirs.

Primary sources:

- CMDA Second Master Plan map index, which includes `CMA – Redhills Catchment Area`
- CMDA Development Regulations Appendix B for Redhills catchment villages and restrictions

Derivation workflow:

1. Digitize the CMDA Red Hills catchment map.
2. Build a terrain-derived upstream polygon from MERIT Hydro or HydroBASINS.
3. Compare the two.
4. Keep a reviewed hybrid polygon for product use.

Validation layers:

- OpenCity Chennai Basin Rivers and Streams
- OpenCity Chennai Basin Waterbodies
- OpenCity Chennai Basin Krishna Water Canal
- OpenCity Chennai Basin Buckingham Canal where needed

Confidence:

- `medium_high`

Main risk:

- The CMDA boundary is a planning and protection map, not necessarily a pure hydrologic watershed.
- In product copy we should treat it as a reviewed operational catchment, not as a statutory hydrology boundary.

### 2. Chembarambakkam

Recommended approach:

- Use a derived polygon with literature-backed validation.
- Treat the upstream catchment to Chembarambakkam as a hydrologic model boundary, not just a local rim around the reservoir.

Why this is workable:

- Recent hydrologic studies model the Adyar catchment and explicitly discuss Chembarambakkam within that system.
- This is the best-supported reservoir for a research-backed hydrologic delineation.

Primary sources:

- Adyar catchment hydrologic modeling paper
- Supporting Chennai flood and tank-retention studies referenced within that literature

Derivation workflow:

1. Delineate the upstream catchment to Chembarambakkam using MERIT Hydro or HydroBASINS plus a reviewed pour point.
2. Compare the result with the model boundary and river network shown in the Adyar catchment study.
3. Adjust only where the derived boundary clearly conflicts with published hydrologic context or known tank groups.

Validation layers:

- OpenCity Chennai Basin Rivers and Streams
- OpenCity Chennai Basin Waterbodies
- Adyar catchment map and river-network figures from the hydrologic study

Confidence:

- `medium_high`

Main risk:

- The published Adyar figures reflect a modeled catchment and may not map perfectly to a production-ready polygon.
- We should label this as a reviewed derived catchment.

### 3. Poondi

Recommended approach:

- Use a derived polygon and explicitly distinguish between local catchment support and imported supply.

Why this needs care:

- Poondi sits inside the older interconnected reservoir system.
- Literature and planning sources describe Poondi as part of the Poondi-Cholavaram-Puzhal system and note Krishna water diversion into Poondi through the Telugu Ganga canal system.

Primary sources:

- Chennai water-infrastructure literature describing the interconnected Poondi-Cholavaram-Puzhal system
- Kosasthalaiyar sub-basin literature for basin-scale context

Derivation workflow:

1. Delineate the natural upstream terrain catchment to Poondi.
2. Keep transfer canals out of the polygon logic.
3. Add separate notes that imported water can materially change storage behavior independent of local rainfall.

Validation layers:

- OpenCity Chennai Basin Rivers and Streams
- OpenCity Chennai Basin Krishna Water Canal
- OpenCity Chennai Basin Waterbodies
- HydroBASINS / Bhuvan basin hierarchy for Kosasthalaiyar context

Confidence:

- `medium`

Main risk:

- A user may assume rainfall anomaly fully explains storage behavior.
- For Poondi, product wording should say `local catchment rainfall` rather than implying complete inflow accounting.

### 4. Cholavaram

Recommended approach:

- Use a derived local runoff support zone, not an overconfident "full catchment" story.

Why this is the hardest case:

- Cholavaram is part of the same interconnected northern reservoir system.
- It behaves less like an isolated natural-basin reservoir and more like a managed storage element inside a larger engineered network.

Primary sources:

- Chennai water-infrastructure literature describing Poondi, Cholavaram, and Puzhal as an interconnected system
- Kosasthalaiyar basin context

Derivation workflow:

1. Delineate the local terrain-driven upstream area to Cholavaram.
2. Review closely against canal and drainage layers.
3. Keep the product framing modest: this is local runoff support, not the full managed supply system.

Validation layers:

- OpenCity Chennai Basin Rivers and Streams
- OpenCity Chennai Basin Krishna Water Canal
- OpenCity Chennai Basin Waterbodies
- HydroBASINS / Bhuvan basin hierarchy

Confidence:

- `low_medium`

Main risk:

- A neat polygon may create false confidence.
- Cholavaram should probably be the last of the four we mark as "verified".

## Product implications

These geometry differences should change the language we use in the app.

Safe wording:

- `30-day rainfall over Poondi's local catchment is below seasonal normal.`
- `Chembarambakkam's upstream catchment has been wetter than usual this month.`
- `Red Hills catchment conditions are supportive, but reservoir behavior also depends on linked system operations.`

Avoid:

- `This is the exact catchment boundary.`
- `Rainfall here fully explains reservoir storage change.`

## Recommended order of execution

1. Red Hills
2. Chembarambakkam
3. Poondi
4. Cholavaram

Why this order:

- Red Hills has the best official artifact.
- Chembarambakkam has the best hydrologic study support.
- Poondi is usable with careful wording.
- Cholavaram has the highest risk of misleading precision.

## Decision for Phase 1

Proceed with a mixed-source approach:

- `Red Hills`: `hybrid`
- `Chembarambakkam`: `derived`
- `Poondi`: `derived`
- `Cholavaram`: `derived_local_support`

If Cholavaram does not review well, we should still ship the other three rather than holding the whole Phase 1 rollout.

## Implemented workflow

The repo now includes a first-pass HydroBASINS acquisition helper:

```bash
cd /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api
GEE_SERVICE_ACCOUNT_FILE=/Users/sundaresh/Documents/health_safety/neer-vazhvu/motiveloop-play-a6c60c9fa760.json \
GEE_CLOUD_PROJECT=motiveloop-play \
python scripts/run_gee_phase1.py derive-catchment-candidate --reservoir redhills --write
```

For reservoirs with meaningful upstream HydroBASINS topology, the helper also supports:

```bash
cd /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api
GEE_SERVICE_ACCOUNT_FILE=/Users/sundaresh/Documents/health_safety/neer-vazhvu/motiveloop-play-a6c60c9fa760.json \
GEE_CLOUD_PROJECT=motiveloop-play \
python scripts/run_gee_phase1.py derive-catchment-candidate --reservoir chembarambakkam --include-upstream --write
```

Current state:

- `Red Hills` has been added to `public/geojson/chennai-reservoir-catchments.geojson` as a `reviewed_candidate`.
- Source dataset: `WWF/HydroSHEDS/v1/Basins/hybas_12`
- Derived `up_area_sqkm`: `193.3`
- `Chembarambakkam` has been added as a `reviewed_candidate` using `hydrobasins_upstream_union`.
- Source dataset: `WWF/HydroSHEDS/v1/Basins/hybas_12`
- Derived `sub_area_sqkm`: `89.9`
- Derived `up_area_sqkm`: `491.3`
- Upstream union feature count: `5`
- `Poondi` has been added as a `reviewed_candidate` using `hydrobasins_upstream_union`.
- Source dataset: `WWF/HydroSHEDS/v1/Basins/hybas_12`
- Derived `sub_area_sqkm`: `129.3`
- Derived `up_area_sqkm`: `1113.9`
- Upstream union feature count: `8`
- `Cholavaram` has been upgraded to a `reviewed_candidate` using `merit_local_upstream_trace`.
- Source dataset: `MERIT/Hydro/v1_0_1`
- `source_type`: `derived_local_support`
- `confidence`: `medium`
- `seed_upa_sqkm`: `28.33`
- `visited_cell_count`: `3403`
- This replaces the earlier HydroBASINS placeholder that collapsed into the same level-12 basin as `Red Hills`.
- File metadata now uses `geometry_version: hybrid-catchment-candidates-v1` to reflect the mixed HydroBASINS plus local MERIT workflow.

This is intentionally not treated as the final verified boundary. The next review step is to reconcile it with the CMDA Red Hills catchment map and Chennai drainage layers.

The current dry-run reservoir rainfall extractor works end to end against these four candidates. After the Cholavaram MERIT update, `Red Hills` and `Cholavaram` no longer produce identical rainfall context. On the latest available CHIRPS date (`2026-02-28`), the 30-day totals diverged to `4.73 mm` for `Red Hills` versus `6.15 mm` for `Cholavaram`, which is the expected QA signal that the duplicate-basin issue has been resolved.

## Sources

- CMDA Second Master Plan: <https://www.cmdachennai.gov.in/smp_main.html>
- CMDA Development Regulations, catchment section: <https://www.cmdachennai.gov.in/Volume2_English_PDF/DR-English.pdf>
- CMDA Red Hills catchment map PDF: <https://www.cmdachennai.gov.in/Volume2_English_PDF/Redhills.pdf>
- Bhuvan 2D hydrologic base: <https://bhuvan.nrsc.gov.in/wiki/index.php/Bhuvan_2D>
- HydroBASINS: <https://www.hydrosheds.org/products/hydrobasins>
- MERIT Hydro in Earth Engine: <https://developers.google.com/earth-engine/datasets/catalog/MERIT_Hydro_v1_0_1>
- Copernicus DEM GLO-30 in Earth Engine: <https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_DEM_GLO30>
- OpenCity Chennai Basin Drainage Maps: <https://data.opencity.in/dataset/chennai-basin-drainage-maps>
- OpenCity Chennai Basin Waterbodies: <https://data.opencity.in/dataset/chennai-waterbodies/resource/chennai-basin-waterbodies-map>
- Adyar catchment hydrologic modeling paper: <https://link.springer.com/article/10.1007/s12665-023-11047-2>
- Chennai water infrastructure and interconnected reservoir system paper: <https://link.springer.com/article/10.1007/s00267-024-02022-z>
- Kosasthalaiyar sub-basin paper: <https://indianjournals.com/article/ijggs-4-1-009>

## Key inferences

The following are informed inferences rather than directly published official boundaries:

- Poondi and Cholavaram should be treated as rainfall-support zones inside a managed reservoir network, not as self-explanatory natural catchments.
- Red Hills can use an official planning boundary as a starting point, but it still needs hydrologic review before product use.
- Chembarambakkam is the cleanest candidate for a literature-backed derived catchment.

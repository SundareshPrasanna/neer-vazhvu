# Lake Catchment Atlas: Methodology Note

**neer-vazhvu catchment delineation v1**
**Algorithm: `catchments_fabdem_wbt_v1`**
**Status: as-built, shipped for Chennai, Madurai, Bengaluru**

## Abstract

The catchment atlas is the "Catchments" view mode on `/[city]/water-bodies`. It makes every lake/tank clickable to reveal its **area of influence**: the catchment that drains into it, the feeder streams, the upstream and downstream tanks, the downstream flow path to the river, and a rooftop rainwater-harvest estimate. Where the cascade reconstruction (see `cascade-reconstruction-v1.md`) answers "which tank drains into which", the catchment atlas answers the prior question, "where does each lake's water come from", by delineating the contributing area from a 30 m bare-earth DEM. This note is the as-built record; the original planning spec is `docs/specs/lake-catchment-atlas.md`.

## 1. Relationship to the cascade overlay

The two layers are complementary and use **different DEMs on purpose**:

| | Cascade reconstruction | Catchment atlas |
|---|---|---|
| Question | tank-to-tank links | contributing area per tank |
| DEM | HydroSHEDS 90 m conditioned | FABDEM 30 m bare-earth |
| Method | D8 cone + steepest-descent between centroids | full flow accumulation + upstream watershed per lake |
| Output | nodes + edges + river outlets | catchment polygons + streams + downstream paths |

The cascade graph is a fast district-scale skeleton; the catchment atlas is the finer, area-resolved layer. The atlas embeds its own cascade graph (`drains_to`) computed from the FABDEM flow accumulation, independent of the 90 m cascade edges.

## 2. Inputs

| Input | Source | Resolution / note |
|---|---|---|
| Elevation | FABDEM (Forest And Buildings removed Copernicus DEM), via GEE asset `projects/sat-io/open-datasets/FABDEM` | 30 m, bare-earth (canopy + buildings removed). License CC-BY-NC-SA 4.0 (non-commercial); fine while we are a free civic/research platform. |
| Lake polygons | OpenStreetMap `water=*` | same set as the water-bodies map |
| Buildings | Overture Maps building footprints (via DuckDB over S3 parquet) | rooftop-harvest estimate |
| Rainfall | IMD long-period annual normals, per district | rooftop-harvest estimate |
| Rivers | `{city}-rivers.geojson` | downstream-river naming |
| Lake names | OSM, plus authoritative open sources where available (Bengaluru: ATREE/CSEI named-lake census on OpenCity) | see section 6 |

## 3. Delineation algorithm (`catchments_fabdem_wbt_v1`)

Implemented in `neer-vazhvu-api/app/cascade/catchments.py`.

1. **Mosaic + condition.** Pull FABDEM tiles over the district bbox (buffered ~0.35 deg so edge catchments close), reproject to the district UTM zone (TN 32644, Karnataka 32643), and condition with WhiteboxTools `breach_depressions_least_cost` (preferred over fill in cities: it carves channels under roads/culverts rather than flooding flats).
2. **Flow routing.** WhiteboxTools `d8_pointer` then `d8_flow_accumulation`.
3. **Streams.** `extract_streams` at an accumulation threshold, `strahler_stream_order`, then `raster_streams_to_vector`. Vector reaches are Chaikin corner-cut smoothed and simplified so they trace natural curves rather than blocky raster steps. Strahler order sampled at each reach midpoint sets the rendered line width.
4. **Own / received / total catchment (threshold-free).** For each lake, an upstream BFS over the D8 pointer from the lake footprint. With a **barrier** at every other water body, the trace yields the **own (direct) catchment** - land draining to this lake before any other tank intercepts it. Without the barrier it yields the **total upstream basin**. `received = total - own` is the inherited area. There are no impound-vs-transit tuning parameters; the partition is purely "first downstream water body".
5. **Downstream flow path + cascade `drains_to`.** From the lake outlet (its highest-accumulation boundary cell) follow the channel by stepping to the highest-accumulation neighbour (pointer-free: max-accumulation is reliably downstream where the D8 pointer convention was not) until it enters another lake. Chaining these one-hop segments along `drains_to` yields the full downstream path to the river, written per-lake (decimated, Chaikin-smoothed) to `{city}-catchment-downstream.json`.
6. **False-river filter.** A water body is dropped as a conduit if its name matches a river/canal pattern, OR it is a thin ribbon: Polsby-Popper compactness `< 0.05` AND total-catchment-to-polygon-area ratio `> 100`. The ratio is the real discriminator - a genuine elongated lake (Pulicat, ratio ~3) is kept while a river mis-tagged as water (Vrishabhavati, ratio ~450) is dropped. This applies to named bodies too.
7. **Rooftop harvest.** Clip Overture footprints to the own catchment (planar area at the district latitude for speed), then `rooftop_area_m2 x annual_rainfall_m x 0.8` (0.8 runoff coefficient), reported in million litres/year.

## 4. Outputs (per district, `public/data/cascade/`)

| File | Content |
|---|---|
| `{city}-cascade-lakes.geojson` | clickable lake polygons with the panel stats: own / received / total catchment km^2, `drains_to_osm_id` / `drains_to_name`, `drains_to_river_name`, rooftop harvest, buildings, rainfall |
| `{city}-cascade-catchments.geojson` | own (incremental) catchment polygon per lake |
| `{city}-catchment-basin.json` | total upstream basin polygon per lake (served on click) |
| `{city}-catchment-streams.json` | Strahler-ordered feeder streams per lake |
| `{city}-catchment-downstream.json` | downstream flow path per lake (outlet to river) |
| `{city}-catchment-quality.json` | run summary: delineated count, flagged/excluded, area distribution, DEM cache |

The API route `src/app/api/cascade/[cityId]/catchment/route.ts` serves `{ catchment, basin, streams, downstream }` for one `osm_id` on click; the lake layer is fetched once as a static file.

## 5. Frontend

`src/components/cascade/catchment-atlas.tsx`, mounted as the "Catchments" view mode on `/[city]/water-bodies`. One map, no toggle: everything is shown and click emphasises. On click a lake's own catchment (solid orange), inherited basin (dashed amber), feeder streams (blue, Strahler-graded), and downstream flow path (dotted violet) render, the map zooms to the basin, and the side panel shows the own/received/total hierarchy, named clickable upstream/downstream connectivity lists, the named downstream river, and the rooftop-harvest estimate. The panel footer deep-links to this methodology note on the about page (`#catchment-methodology`).

## 6. Naming

OSM leaves a large share of bodies unnamed (Chennai ~78%, Bengaluru ~67% at ingest; Madurai ~3% after an earlier Nominatim backfill). Two name fixes, both keyed by `osm_id` and reconciled by `app/cascade/enrich_names.py` (called automatically at the end of `build_catchments`, and runnable standalone):

- **Lake names from an authoritative source.** `scripts/name-bangalore-water-bodies.py` joins the ATREE/CSEI named-lake census (1,349 named polygons, open on OpenCity) to OSM polygons by polygon overlap (accept IoU >= 0.2, or OSM-mostly-inside-ref with a reverse-overlap guard so a small pond inside a big lake's outline is not mislabelled). 446 real toponyms backfilled into the Bengaluru source with `name_source` + `name_match_iou` provenance; OSM-native names are never overwritten. Bengaluru source 19% -> 43% named; cascade lakes 332 -> 752 named. Chennai's only named-polygon source (OpenCity 2019) recovers ~101 and is deferred pending Wikidata flagships + the Sep-2025 WELL Labs datajam.
- **River names.** For each river-terminal lake, snap its downstream flow path to the nearest named river in `{city}-rivers.geojson` (within 0.5 km - the path follows the real channel, so a true drain meets the river at ~0 m). Names Chennai 133 / Madurai 52 / Bengaluru 109 terminal lakes. Lakes whose path stays far from any named river (off-map flows) honestly show no river name.

## 7. Validation

- **Ground-truth.** Bellandur's catchment is well documented (~148 km^2 in IISc/BWSSB literature); delineated first as a sanity check.
- **Internal consistency.** own + received = total for every lake by construction.
- **Naming precision.** Join thresholds chosen to drop the "small body inside a big outline" mislabel; river-snap calibrated on Bengaluru (matches at ~0 m, non-matches > 5 km, so 0.5 km has no false positives).
- 12 cascade/catchment unit + integration tests pass.

## 8. Known limitations

- **DEM resolution 30 m.** Resolves urban catchments well but misses sub-cell culverts, storm drains, and engineered diversions that move water against the terrain.
- **Bounded by map extent.** A lake near the edge can drain to a river/reservoir outside our coverage (e.g. a southern Bengaluru tank toward the Krishnagiri reservoir, off-map). The flow path is traced correctly but the sink cannot be named.
- **Rainfall is a normal,** not an actual year, so rooftop harvest is a typical annual potential, not a measured yield.
- **Backfilled names are a join,** not ground truth; they carry a source tag and match confidence.
- **Non-commercial DEM.** FABDEM is CC-BY-NC-SA; a commercial-DEM swap (licensed FABDEM, or a bare-earth surface from Copernicus GLO-30) is a known follow-up if the platform monetizes.

## 9. Reproducibility

```
cd neer-vazhvu-api
python -c "from pathlib import Path; from app.cascade import catchments; \
  from app.cascade.districts import get_district_cascade_config; \
  catchments.build_catchments(get_district_cascade_config('bangalore'))"
# names only, no re-delineation:
python -m app.cascade.enrich_names bangalore
# refresh an authoritative name source then re-sync:
python scripts/name-bangalore-water-bodies.py
```

`build_catchments` caches the conditioned DEM + WhiteboxTools rasters under a temp working dir (recorded as `dem_cache` in the quality JSON) so re-delineation skips the slow GEE + WBT steps. Names + downstream-river labels are applied automatically by `enrich_cascade_lakes` at the end of every build.

## References

- Hawker L. et al. (2022). FABDEM: a 30 m global map of elevation with forests and buildings removed. *Environmental Research Letters* 17(2). [data.bris FABDEM](https://data.bris.ac.uk/data/dataset/25wfy0f9ukoge2gs7a5mqpq2j7)
- Lindsay J.B. (2016). WhiteboxTools geospatial analysis. [whiteboxgeo.com](https://www.whiteboxgeo.com/)
- ATREE / CSEI. Map of Lakes in Bengaluru Urban and Rural Districts. [OpenCity](https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area)
- Overture Maps Foundation. Buildings theme. [overturemaps.org](https://overturemaps.org/)
- Hyderabad Urban Lab. Hyderabad Lake Atlas (quality benchmark). [lakeatlas.hyderabad.urbanobservatory.in](https://lakeatlas.hyderabad.urbanobservatory.in/)

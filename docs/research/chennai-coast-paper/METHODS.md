# Chennai coastal shoreline-change: reproduction method (Option B)

How the `/coastal` page is built, and the recipe to replace its SEED layer with
our own computed CoastSat + DSAS transect rates.

## Two layers, two provenance states

| Layer | File | `source` | Built by | Status |
|---|---|---|---|---|
| SEED (zones) | `public/geojson/chennai-coastal-zones.geojson` | `study-reported` | `scripts/build-chennai-coastal-seed.py` | **shipped** |
| SEED (hotspots) | `public/geojson/chennai-coastal-hotspots.geojson` | `study-reported` | same | **shipped** |
| COMPUTED (transects) | `public/geojson/chennai-coastal-transects.geojson` | `computed` | `neer-vazhvu-api/scripts/run_gee_coastline.py` | **not yet run** |

The UI labels provenance from the `source` field. Until the computed layer
exists, `/coastal` honestly shows "cited overview, not our own reproduction".

## SEED layer (shipped)

`python scripts/build-chennai-coastal-seed.py`

1. Fetch `natural=coastline` ways for the Chennai bbox from Overpass.
2. Stitch into one chain; extract the seaward shore (easternmost point per
   latitude bin) so Pulicat lagoon inner shores don't pollute the line.
3. Split the shore into the study's six zones by their published along-shore
   lengths (14, 10.3, 9.4, 12.2, 24.6, 15.6 km).
4. Attach the study's per-zone mean erosion rates + dominant trend, and five
   named port hotspots with their specific rates.

Geometry = OSM. Numbers = Anagha, Singh & Frappart (2026). No independent
measurement is claimed.

## COMPUTED layer (the reproduction, needs a GEE run)

`neer-vazhvu-api/app/gee/coastline.py` + `scripts/run_gee_coastline.py`.

Prereqs:
- `pip install -e neer-vazhvu-api[coastal]` (CoastSat, scikit-image, geopandas).
- GEE service-account creds via `GEE_CLOUD_PROJECT` + `GEE_SERVICE_ACCOUNT_FILE`
  / `GEE_SERVICE_ACCOUNT_JSON` (same path as the existing GEE jobs;
  `python scripts/run_gee_coastline.py check-auth` to verify).

Stage 1 - shoreline extraction (CoastSat, GEE):
- Imagery: Landsat 5 TM / 7 ETM+ / 8 OLI and Sentinel-2 MSI, epochs 1990, 1995,
  2000, 2005, 2010, 2015, 2020, 2024 (Table 1 of the paper).
- Index: MNDWI = (Green - SWIR1)/(Green + SWIR1); Otsu threshold; sub-pixel
  shoreline via marching squares (CoastSat default). Resample Landsat to 15 m,
  Sentinel-2 to 10 m; CoastSat's sub-pixel mapping gives ~10 m horizontal
  accuracy across sensors.
- The single block to fill on first authenticated run is the CoastSat
  `retrieve_images` / `save_shorelines` call (reference shoreline + cloud/beach
  settings) - left guarded with `NotImplementedError` because its parameters
  can't be validated without creds.

Stage 2 - DSAS-equivalent rates (pure NumPy, reviewable now):
- Cast shore-normal transects every 100 m along the earliest baseline
  (`build_transects`).
- Per transect, intersect each epoch's shoreline (`_signed_offset_m`).
- End Point Rate = NSM / years; Weighted Linear Regression slope with
  weights = 1 / Esp^2 using the paper's per-epoch positional errors (Table 2:
  16.33, 17.21, 15.78, 16.04, 15.67, 15.14, 8.66, 8.66 m). `_wlr` returns slope
  + R^2.
- Classify erosion / accretion / stable at +/-0.5 m/yr.
- Zone assignment splits the baseline by the same published per-zone lengths as
  the seed (wire `zone_of` in `run_gee_coastline.py` on run).

Output: `public/geojson/chennai-coastal-transects.geojson`, `source:"computed"`.

## Validation before it supersedes the seed

The first computed run is a draft. Check against the paper before swapping the
default layer on `/coastal`:
- 58.65% of transects eroding, mean -1.89 m/yr overall.
- Zone V the most erosive (mean 4.34 m/yr); down-drift Ennore ~-21.3, Kattupalli
  ~-16 m/yr; Chennai Port accretion ~+34.8 m/yr.
- Per-zone means within a few m/yr of 0.48 / 1.15 / 0.76 / 1.66 / 4.34 / 2.97.

Differences are expected (CoastSat vs the paper's exact reference shoreline and
tide handling), but the spatial pattern and signs should match. Once validated,
point the map's primary layer at the transect file and flip the page copy from
"cited overview" to "computed by neervazhvu (CoastSat + DSAS)".

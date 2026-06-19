# Chennai coastal shoreline-change: reproduction method (Option B)

How the `/coastal` page is built, and the recipe to replace its SEED layer with
our own computed transect rates.

> For the publication-style write-up (abstract, study area, validation table,
> limitations, references), see
> [docs/methodology/coastal-shoreline-change-v1.md](../../methodology/coastal-shoreline-change-v1.md).
> This file is the terse internal build note.
>
> **Cadence:** yearly. The epochs are annual dry-season composites, so re-running
> more often recomputes identical data. `active_epoch_config()` auto-appends the
> latest complete dry-season year, and `.github/workflows/coastal-shoreline-refresh.yml`
> opens a refresh PR each 15 June.

## Two layers, two provenance states

| Layer | File | `source` | Built by | Status |
|---|---|---|---|---|
| SEED (zones) | `public/geojson/chennai-coastal-zones.geojson` | `study-reported` | `scripts/build-chennai-coastal-seed.py` | **shipped** |
| SEED (hotspots) | `public/geojson/chennai-coastal-hotspots.geojson` | `study-reported` | same | **shipped** |
| COMPUTED (transects) | `public/geojson/chennai-coastal-transects.geojson` | `computed` | `neer-vazhvu-api/scripts/run_gee_coastline.py` | **run + validated (2026-06)** |

The `/shoreline` page shows one map: our rate-coloured transects as the primary
layer, the study's zones as faint context bands, and its named hotspots as quiet
validating annotations. The UI labels provenance from the `source` field.

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

We use a transparent MNDWI/GEE pipeline rather than CoastSat (no extra deps; the
whole thing runs on the existing `earthengine-api` install). `run` in
`app/gee/coastline.py`:

Stage 1 - per-epoch waterline offsets (`sample_transect_offsets`, GEE):
- Baseline = the seed zone segments concatenated south->north (the study's six
  zones plus our southern "S" extension to Mahabalipuram).
- Cast shore-normal transects every 100 m (`build_transects`) -> ~1,200 transects.
- Build a 10-band MNDWI image, one band per epoch (Table 1 sensors): Landsat 5
  (1990, 1995), Landsat 7 (2000, 2005, 2010), Landsat 8 (2015; the paper used L7
  - we use L8 to avoid SLC-off gaps), Sentinel-2 (2020, 2024, **2025, 2026**).
  2025-2026 extend our measurement past the study's 2024 cutoff with current
  Sentinel-2 (the 2026 dry-season window Dec 2025-May 2026 is complete).
  Dry-season Dec-May median composite, cloud-masked (QA_PIXEL / SCL). MNDWI =
  (Green - SWIR1)/(Green + SWIR1), reflectance-scaled.
- Sample MNDWI at 20 m steps along each transect (-260..+400 m) and take the
  land->water crossing (MNDWI = 0) as that epoch's shoreline offset.

Stage 2 - DSAS-equivalent rates (`compute_rates`, pure Python):
- End Point Rate = NSM / years; Weighted Linear Regression slope with
  weights = 1 / Esp^2 using the paper's per-epoch positional errors (Table 2;
  2025/2026 reuse the Sentinel-2 value 8.66 m). `_wlr` returns slope + R^2.
  Transects with < 3 usable epochs are dropped.
- Classify erosion / accretion / stable at +/-0.5 m/yr.
- **Temporal axis:** each transect also carries `series` (net shoreline
  movement vs the earliest epoch, per year) and split-period WLR rates -
  `early_rate_m_yr` (<= 2012) and `recent_rate_m_yr` (> 2012) - so the UI can
  draw a movement-over-time chart and flag acceleration (recent steeper than
  early by > 1 m/yr).
- Zone assignment splits the baseline by the published per-zone lengths.

Output: `public/geojson/chennai-coastal-transects.geojson`, `source:"computed"`
(1,137 transects had >= 3 usable epochs over 1990-2026). Each carries a
`confidence` flag (judged on the recent Sentinel-2-era trajectory; ~8% "low") and
one `showcase` flag for the UI's pre-selected example. Headline temporal finding
(high-confidence only): of ~420 eroding transects with both split rates, **~72%
are eroding faster in 2015-2026 than in 1990-2010** - the erosion is accelerating.

## Validation (run 2026-06)

Computed over high-confidence transects:

| Signal | Paper | Our run |
|---|---|---|
| Direction overall | 58.65% eroding (erosion-dominant) | 41% eroding vs 24% accreting (erosion-dominant) |
| Ennore/Kattupalli (Zone V) erode | down-drift -21.3 / -16; port accretion | Zone V eroding (worst clean transect ~-13 m/yr; the most extreme port-adjacent spots are flagged low-confidence) |
| Zone II/III accretion | up to +7.78 (Adyar/Cooum), Chennai Port gain | Chennai Port mean +1.4, Adyar/Cooum positive |
| Zone I stable | marginal (turtle sector) | near-stable |

The **spatial pattern and signs match**. Absolute magnitudes run lower than the
paper because (a) fixed MNDWI = 0, no tidal correction, 20 m sampling vs CoastSat's
sub-pixel extraction, and (b) the paper's per-zone figure is the mean of *eroding*
transects only, while ours is the net mean. The paper's most extreme Ennore/
Kattupalli figures sit exactly where our method is least reliable (port + creek
ambiguity), so those transects are flagged low-confidence rather than trusted. So
this is **independent corroboration of the pattern, not a replica**. To re-run:
`python scripts/run_gee_coastline.py build-geojson --write` (~15 min, needs GEE auth).

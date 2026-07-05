# Mapping shoreline change on the Chennai coast with open satellite data

> **Multi-city note (Jul 2026):** the same pipeline now also runs for Mumbai
> (west-coast orientation, `public/geojson/mumbai-coastal-transects.geojson`),
> corroborated against the published record (NCCR 1990-2016 district table +
> MSMP 2017 risk grades) since no rate-publishing study exists for Mumbai.
> The annual refresh workflow (`coastal-shoreline-refresh.yml`) is still
> Chennai-hardcoded - parameterising it for Mumbai is a logged follow-up.
> The methodology below is written against the Chennai build.

**An independent, transparent reproduction and 2026 extension of a published shoreline-change study**

Version 1 - Neer Vazhvu - June 2026

---

## Summary

We reproduce the shoreline-change analysis of Anagha, Singh & Frappart (2026) for
the 86 km Chennai-Ennore-Pulicat coast using only open data and a dependency-light
pipeline, and extend it past the study's 2024 cutoff to 2026 with current
Sentinel-2 imagery. Where the original study used the CoastSat sub-pixel toolkit
and ArcGIS DSAS, we use a Modified Normalised Difference Water Index (MNDWI)
sampled along shore-normal transects in Google Earth Engine, followed by a
weighted-linear-regression rate per transect. The two independent methods agree
on the spatial pattern and the sign of change at every zone: the Ennore-Kattupalli
port sector (Zone V) erodes on its down-drift flanks (a clean run of -10 to -18
m/yr accelerating recently, consistent with the study's -21.3 m/yr at Ennore; the
most extreme port-adjacent spots are flagged low-confidence rather than trusted),
the Adyar/Cooum and Chennai Port stretches accrete, and the southern
turtle-nesting sector is stable. Adding 2025 and 2026 lets us ask a question the
original window could not: **of the eroding high-confidence transects, about 72%
are eroding faster in 2015-2026 than they were in 1990-2010 - the erosion is
accelerating.** All code and outputs are open; the
method is offered as independent corroboration and a live monitoring layer, not
as a replacement for the peer-reviewed study.

## 1. Background and motivation

Anagha, Singh & Frappart (2026, *Environmental Challenges*, DOI
10.1016/j.envc.2026.101514) quantified shoreline change and seawater intrusion
along the Chennai coast over 1990-2024 and linked port-driven down-drift erosion
to seawater intrusion in the coastal aquifer and to declining Olive Ridley turtle
hatching success. The paper is an authoritative description of the problem.

Three things motivated an independent reproduction:

1. **Verification.** A second method, built from different tools on the same open
   imagery, is a strong test of whether the headline pattern is real or an
   artefact of one processing chain.
2. **Currency.** The study stops at 2024. A reproducible pipeline can extend the
   record each year and keep a public monitoring layer live.
3. **Transparency and reuse.** A fully open, scripted pipeline lets anyone
   re-run, audit, or adapt the analysis - the data is the contribution, the code
   is open.

This document describes the method precisely enough to reproduce or critique.

## 2. Study area

The 86 km coast from Uthandi (~12.80 N) in the south to Pulicat (~13.56 N) in the
north, divided into the study's six along-shore zones:

| Zone | Stretch | Length (km) | Character |
|------|---------|-------------|-----------|
| I | Uthandi - Thiruvanmiyur | 14.0 | Conservation / Olive Ridley nesting; most stable |
| II | Adyar & Cooum river mouths | 10.3 | River-mouth accretion (Besant Nagar, Marina) |
| III | Chennai Port | 9.4 | Port-breakwater accretion, seawall-protected |
| IV | Kasimedu groyne field | 12.2 | Engineered; local accretion, down-drift starvation |
| V | Ennore - Kattupalli ports | 24.6 | Most volatile; severe down-drift erosion |
| VI | Pulicat lagoon | 15.6 | Sensitive lagoon/sanctuary; highly variable |

We also extend our own measurement ~22 km **south of the study**, along the East
Coast Road from Uthandi down to **Mahabalipuram** (zone "S", greater-Chennai
coast). That stretch has no published study rate, so it carries our transect
measurement only and is labelled as beyond the study.

## 3. Data

### 3.1 Satellite imagery (Google Earth Engine)

One dry-season (December-May) median composite per epoch, cloud-masked, from USGS
Landsat Collection 2 Level-2 surface reflectance and Copernicus Sentinel-2 L2A
(harmonized):

| Epoch(s) | Sensor | GEE collection | Green / SWIR1 bands |
|----------|--------|----------------|---------------------|
| 1990, 1995 | Landsat 5 TM | `LANDSAT/LT05/C02/T1_L2` | SR_B2 / SR_B5 |
| 2000, 2005, 2010 | Landsat 7 ETM+ | `LANDSAT/LE07/C02/T1_L2` | SR_B2 / SR_B5 |
| 2015 | Landsat 8 OLI | `LANDSAT/LC08/C02/T1_L2` | SR_B3 / SR_B6 |
| 2020, 2024, 2025, 2026 | Sentinel-2 MSI | `COPERNICUS/S2_SR_HARMONIZED` | B3 / B11 |

We use Landsat 8 for 2015 (the study used Landsat 7) to avoid the Landsat 7
SLC-off scan-line gaps. Cloud masking uses the Landsat `QA_PIXEL` bits
(dilated cloud, cirrus, cloud, cloud-shadow) and the Sentinel-2 `SCL` classes
(saturated, cloud-shadow, cloud medium/high, cirrus). 2025 and 2026 extend the
record past the study's 2024 cutoff; the 2026 dry-season window (Dec 2025-May
2026) is complete as of this writing.

### 3.2 Coastline geometry

The reference baseline is the OpenStreetMap `natural=coastline`, fetched via
Overpass, stitched into one chain, reduced to the seaward shore (easternmost
vertex per latitude bin so the Pulicat lagoon inner shore is excluded), and split
into the six study zones by their published along-shore lengths
(`scripts/build-chennai-coastal-seed.py`).

### 3.3 Reference study

Anagha, Singh & Frappart (2026) provides the zone definitions, the per-epoch
positional-uncertainty values used as regression weights (their Table 2), and the
published rates we validate against.

## 4. Methods

### 4.1 Baseline and transects

Shore-normal transects are cast every 100 m along the baseline (972 transects).
Each transect has an origin on the baseline and a unit normal pointing seaward
(the south-to-north tangent rotated 90 degrees), expressed in degrees-per-metre so
distances along it are in metres. This mirrors the DSAS transect convention
(Thieler et al.); the study used 861 transects at the same 100 m spacing.

### 4.2 Per-epoch water index

For each epoch we build a median composite over its dry-season window and compute

> MNDWI = (Green - SWIR1) / (Green + SWIR1)

on reflectance (DN scaled and offset per sensor; the offset does not cancel in the
ratio, so it is applied). MNDWI > 0 is water. The eight-to-ten epoch MNDWI bands
are stacked into one image for a single sampling pass.

### 4.3 Waterline position along each transect

We sample MNDWI at 20 m steps along each transect normal from 260 m landward to
400 m seaward, and take the **land-to-water crossing** (the interpolated point
where MNDWI passes 0 going seaward) as that epoch's shoreline position on that
transect. A transect-and-epoch with no clean crossing in the window (cloud gaps,
harbour structures, inland-pointing normals) is left empty.

### 4.4 Change rates

For each transect with at least three usable epochs we compute, on the shoreline
positions vs year:

- **End Point Rate (EPR)** = (last - first) / years.
- **Weighted Linear Regression (WLR)** slope, with weights = 1 / Esp^2 using the
  study's per-epoch positional errors (Table 2: 16.33, 17.21, 15.78, 16.04,
  15.67, 15.14 m for the Landsat epochs; 8.66 m for Sentinel-2, applied to 2020
  onward). The regression also yields R^2.

The WLR slope (m/yr) is the headline rate: negative = erosion (landward retreat),
positive = accretion. Transects are classified erosion / accretion / stable at
+/-0.5 m/yr. Each transect is assigned its zone by along-shore position.

### 4.5 Temporal trajectory and acceleration

Beyond a single rate, each transect carries:

- a **movement-over-time series**: net shoreline movement (m) relative to its
  earliest epoch, at each measured year - the raw trajectory; and
- **split-period rates**: a WLR over the early half (epochs <= 2012) and over the
  recent half (> 2012). When the recent rate is more than 1 m/yr steeper than the
  early rate in the erosion direction, the transect is flagged as
  **accelerating** (and symmetrically for accretion, or *reversed* when the sign
  flips). This is what lets the platform say whether erosion is getting worse, not
  just that it is happening.

### 4.6 Provenance tagging

Every output feature carries a `source` field: the zone/hotspot seed layer is
`study-reported` (the paper's published numbers on the OSM coastline); the
transect layer is `computed` (our own measurement). The UI labels both, so a
reader never mistakes a cited figure for an independent one.

## 5. Validation against the published study

Computed over high-confidence transects:

| Signal | Study (1990-2024) | Our run (1990-2026) |
|--------|-------------------|---------------------|
| Overall direction | erosion-dominant, 58.65% eroding, mean -1.89 m/yr | erosion-dominant, 41% eroding vs 24% accreting |
| Zone V (Ennore/Kattupalli) | most erosive; Ennore down-drift -21.3, Kattupalli -16 m/yr | down-drift erosion; cleanest run -10 to -18 m/yr (the most extreme port-adjacent spots flagged low-confidence) |
| Zone II/III accretion | Adyar/Cooum +7.78 m/yr; Chennai Port land gain | Chennai Port mean +1.6 (max +6.6), Adyar/Cooum positive |
| Zone I | marginal / stable | near-stable |

The spatial pattern and signs match. Our absolute magnitudes are smaller for two
understood reasons: (1) we use a fixed MNDWI = 0 threshold with no tidal
correction at 20 m sampling, where CoastSat extracts a sub-pixel waterline and
corrects for tide - this damps and adds noise to individual rates; and (2) the
study's per-zone figure is the mean over *eroding* transects, while our net mean
mixes erosion and accretion. Notably, the study's most extreme Ennore/Kattupalli
figures fall exactly where our method is least reliable (port + creek ambiguity),
so those transects are flagged low-confidence rather than trusted. The agreement
on pattern, sign, and the *clean* down-drift erosion run is the substantive result.

## 6. Results

1,137 transects (of ~1,200, Mahabalipuram to Pulicat) had at least three usable
epochs. Headline findings:

- **Where:** erosion concentrates on the down-drift (north) flanks of the Ennore
  and Kattupalli ports and along the northern Pulicat shore; accretion concentrates
  at the Adyar/Cooum mouths and behind the Chennai Port breakwaters - the classic
  engineered-coast signature.
- **Acceleration:** of the eroding high-confidence transects with both split-period
  rates, **~72% are eroding faster in 2015-2026 than in 1990-2010.** The erosion is
  not merely persistent; it is intensifying.
- **Currency:** extending to 2026 keeps the clean Ennore/Kattupalli down-drift
  erosion in the -10 to -18 m/yr range, consistent with the study's -21.3 m/yr and
  with continued down-drift sediment starvation north of the ports.

## 7. Limitations

- **Fixed threshold, no tidal correction.** MNDWI = 0 and a microtidal coast keep
  the bias small but not zero; individual transect rates are noisier than
  sub-pixel CoastSat. We report pattern and extremes, not precise per-transect
  magnitudes. *Planned v2: per-composite Otsu threshold and a tidal-stage filter.*
- **Unreliable transects flagged, not trusted.** A transect carries a
  `confidence` flag judged on its **recent (Sentinel-2-era, >= 2015) trajectory**
  - "low" when the recent positions scatter > 30 m RMS about their trend, take an
  isolated > 70 m/yr jump (a feature-snap, e.g. the water-edge catching an inner
  creek/lagoon bank), or it has too few epochs (about 8% of transects). We score
  the *recent* half deliberately: the early Landsat-5 years are noisy even on
  genuinely eroding shorelines, so scoring the full series wrongly flagged real
  fast-erosion stretches (the open coast north of Ennore) as unreliable.
  Low-confidence transects are dimmed, excluded from the headline statistics, and
  never pre-selected; a `showcase` flag marks one clean, strongly + currently
  eroding transect for that. *Planned v2: a robust (Theil-Sen) per-transect slope
  so a single bad epoch can't drag the rate.*
- **Annual dry-season snapshot.** One composite per year smooths seasonal
  beach cycling but cannot resolve sub-annual change.
- **Sensor heterogeneity.** Landsat (30 m) and Sentinel-2 (10 m) differ in
  resolution; the 100 m transect spacing and decadal signal dominate this, but
  cross-sensor offset is a known source of low-level noise.
- **Baseline geometry.** Zone boundaries follow the study's published along-shore
  lengths over the OSM coastline, not a re-digitised reference shoreline.
- **No causal claim.** This layer measures shoreline position; attribution to
  specific ports, sea-level rise, or sediment budgets follows the published study,
  not our pixels.

## 8. Reproducibility

- **Code:** `neer-vazhvu-api/app/gee/coastline.py` (pipeline),
  `neer-vazhvu-api/scripts/run_gee_coastline.py` (CLI),
  `scripts/build-chennai-coastal-seed.py` (zone/hotspot seed).
- **Run:** `python scripts/run_gee_coastline.py build-geojson --write` (needs
  Earth Engine auth; ~12-15 min). Stage 2 (transect geometry + DSAS regression) is
  pure Python and unit-testable without GEE.
- **Output:** `public/geojson/chennai-coastal-transects.geojson` (`computed`) and
  `public/geojson/chennai-coastal-{zones,hotspots}.geojson` (`study-reported`).
- **Operational cadence (yearly).** Because the epochs are annual dry-season
  composites, the meaningful refresh interval is **once per year**, after the
  Dec-May season closes; quarterly or half-yearly runs would recompute identical
  data. `active_epoch_config()` auto-appends the latest complete dry-season year,
  so the refresh needs no code edit. The GitHub Actions workflow
  `.github/workflows/coastal-shoreline-refresh.yml` runs on 15 June each year and
  opens a PR with the regenerated transects for human review before merge.

## 9. Provenance, attribution, and ethics

- The peer-reviewed study (Anagha, Singh & Frappart 2026) is the source of the
  zone definitions, the published rates we corroborate, and the uncertainty
  weights. This work is **independent corroboration and extension**, credited as
  such throughout the product and this document.
- Code is open source; curated outputs are served as small GeoJSON. The
  copyrighted article text and figures are **not** redistributed.
- Imagery: contains modified Copernicus Sentinel-2 data; Landsat courtesy of the
  U.S. Geological Survey; coastline (c) OpenStreetMap contributors.

## 10. References and data

- Anagha V.S., Singh A., Frappart F. (2026). *Shoreline and salinity shifts along
  the Chennai coast: Environmental and ecological implications.* Environmental
  Challenges. DOI 10.1016/j.envc.2026.101514.
- Vos K. et al. (2019). *CoastSat: a Google Earth Engine-enabled Python toolkit to
  extract shorelines from publicly available satellite imagery.* Environmental
  Modelling & Software. (Method used by the reference study; not used here.)
- Xu H. (2006). *Modification of normalised difference water index (NDWI) to
  enhance open water features in remotely sensed imagery.* Int. J. Remote Sensing.
- Thieler E.R. et al. *Digital Shoreline Analysis System (DSAS).* U.S. Geological
  Survey. (EPR/WLR convention.)
- Gorelick N. et al. (2017). *Google Earth Engine: planetary-scale geospatial
  analysis for everyone.* Remote Sensing of Environment.
- USGS Landsat Collection 2 Level-2 Surface Reflectance; Copernicus Sentinel-2
  L2A; OpenStreetMap (`natural=coastline`).

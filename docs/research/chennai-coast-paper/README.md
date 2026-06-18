# Chennai coast: shoreline + seawater intrusion (Anagha, Singh & Frappart 2026)

Integration notes for a peer-reviewed coastal study flagged by Nityanand Jayaraman
(Coastal Resource Centre / Ennore). This file is our own summary and plan; the
copyrighted full text and figures are not committed (kept in local refs only).

## Citation

- **Title:** Shoreline and salinity shifts along the Chennai coast: Environmental and ecological implications
- **Authors:** Anagha V.S., Alka Singh, Frédéric Frappart
- **Journal:** Environmental Challenges (Elsevier), June 2026
- **DOI:** 10.1016/j.envc.2026.101514
- **URL (as shared):** https://www.sciencedirect.com/science/article/pii/S2667010026001083
- **Data availability:** "Data will be made available on request" (no public deposit).

## What the study does

A 1990-2024 assessment of the 86 km coast from Uthandi (south) to Pulicat (north),
split into six zones, coupling three analyses:

1. **Shoreline change** - DSAS (End Point Rate + Weighted Linear Regression) on
   CoastSat-extracted shorelines from Landsat 5/7/8 + Sentinel-2, 861 transects at
   100 m spacing.
2. **Seawater intrusion** - Hydrochemical Facies Evolution diagram (HFE-D) on CGWB
   major-ion data (2014/2018/2020/2022) within 7 km of the coast, plus GWL trends
   from 49 CGWB wells (14 in the coastal buffer), 2002-2021.
3. **Ecology** - Olive Ridley turtle hatching/nesting (SSTCN, 1989-2011) vs a
   multi-stressor index (sand LST, sea-surface salinity, night-lights, erosion).

## Headline findings (shipped as cited facts)

Added to `src/lib/facts/static-facts.ts` under a new `coastal` bucket
(`src/lib/facts/buckets.ts`), rendered on `/facts`:

| Fact id | Number |
|---|---|
| `coastal-port-downdrift-erosion` | Ennore 21.3 m/yr, Kattupalli 16 m/yr down-drift erosion; Chennai Port +34.8 m/yr accretion |
| `coastal-erosion-share` | 58.65% of 86 km eroding, mean -1.89 m/yr (1990-2024) |
| `coastal-aquifer-salinisation` | 100% of coastal GW samples saline/mixing (2014-2022), peaks 2014 & 2020 |
| `coastal-gwl-decline` | Vepery -18 cm/yr, Tondiarpet -17 cm/yr (p<0.05), sub-sea-level at Vepery & Pallikaranai |
| `coastal-sea-level-rise` | 3.45 mm/yr, ~100 mm above 1990 baseline |
| `coastal-turtle-hatching` | Hatching 84% -> 20% in high-erosion zones (R² = 0.63) |

### Caveats carried into the copy (the study states both)

- HFE-D **cannot separate** modern marine intrusion from legacy/paleosaline,
  salt-pan runoff, and Buckingham Canal leakage. Framed as multi-source salinity.
- Turtle biological record **ends in 2011**; the erosion-hatching link is
  associative, not proven causation.

All six tagged tier 3 (reference/historical context), not live-state claims.

## Why this matters to us

This is the quantitative academic backbone for several threads already in our
Ennore work (fly-ash atlas, coastal-erosion / salt-intrusion / Pulicat angles):
ports erase the sediment buffer (same mechanism that exposes fly-ash), and the
coastal aquifer is under chronic saline + over-abstraction stress.

## Option B: shoreline-change map (shipped seed + scripted reproduction)

**B1 (shipped):** `/coastal` page (`src/app/coastal/`) - a Leaflet map of the
six study zones (coloured by dominant trend) plus the named port hotspots, over
the real OSM coastline. Seed data built by `scripts/build-chennai-coastal-seed.py`
(`source: "study-reported"`). The UI labels this as a cited overview, not our
own reproduction.

**B2 (run + validated, June 2026):** `neer-vazhvu-api/app/gee/coastline.py` +
`scripts/run_gee_coastline.py` compute our own per-transect rates (MNDWI on
Landsat 5/7/8 + Sentinel-2 via GEE, 100 m transects, DSAS-equivalent WLR over 8
epochs) -> `chennai-coastal-transects.geojson` (`source: "computed"`, 895
transects), surfaced as the "Our transects" toggle on `/coastal`. Validated
against the paper: spatial pattern + signs match (Zone V min -19 m/yr vs the
paper's -21.3 Ennore down-drift; Zone II/III accretion max +7.4 vs +7.78), with
absolute means lower by method (fixed MNDWI threshold, no tide correction). It is
independent corroboration, not a replica - the UI says so. Recipe + validation
table in [METHODS.md](./METHODS.md).

Almost every input is public and reproducible by us:

- **Shoreline change** - CoastSat (Landsat + Sentinel-2 via Google Earth Engine)
  + DSAS. Methodology fully specified in the paper: MNDWI, Otsu threshold,
  Marching Squares, 100 m transects, EPR + WLR, 6 zones. Reproducible -> a new
  `/chennai/coastal` erosion/accretion map layer (would back-fill the `coastal`
  bucket's `pagePathSuffix`).
- **CGWB ions + GWL** - we already scrape WRIS/CGWB; HFE-D facies and per-well
  trends are recomputable.
- **HYCOM SSS, CHIRPS, AVISO sea level** - public via GEE.
- **Turtle data (SSTCN, 1989-2011)** - the one non-public input; a
  Nityanand/SSTCN relationship is the unlock, and post-2011 records would extend it.

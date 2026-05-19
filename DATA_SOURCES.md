# Data Sources

> Index of where each city's datasets come from, how often they refresh, and the documentation principles we follow when describing what's missing.

## Per-city documents

The detailed source-by-source breakdown lives in per-city files. Each file documents methodology, output paths, frequencies, coverage caveats, and known limitations for that city's data layers.

- [docs/cities/chennai/data-sources.md](docs/cities/chennai/data-sources.md) - Chennai (CMWSSB reservoirs, OpenCity groundwater, CFLOWS flood, CRRT, etc.)
- [docs/cities/madurai/data-sources.md](docs/cities/madurai/data-sources.md) - Madurai (TN Agriculture ARS, ADB TNUFIP IEE, CGWB Year Book, Vencatesan/DHAN water bodies, CPCB NWMP Vaigai, etc.)

Per-city *features* live alongside in the same folder: [docs/cities/chennai/features.md](docs/cities/chennai/features.md) and [docs/cities/madurai/features.md](docs/cities/madurai/features.md).

When adding a third city, copy the Madurai folder (`docs/cities/madurai/`) as a template - those docs are more recent and reflect the multi-city naming convention (per-city `-<cityId>` suffix on data files). Chennai's docs predate that and use unsuffixed legacy paths for back-compat.

## Documentation principle: avoid absolute-absence claims

When describing layers we don't have data for, hedge with "no known public X" or "we haven't yet found a public daily feed for X" rather than "no public X exists" or "the utility doesn't publish X". Our research is bounded; somewhere a PDF, internal portal, or unindexed dataset might exist. Categorical claims of absolute absence get a counter-example fast and discredit the broader narrative.

The Madurai documents follow this principle throughout. The Chennai documents predate it and may have older absolutist phrasing in places; soften when revisiting.

## Cross-city parity matrix

A contributor cheat-sheet for what each city has covered. If you're adding a third city, this is your checklist - replicate the green column items first, then file the red column as known gaps to track.

| Domain | Chennai | Madurai |
|---|---|---|
| Reservoir daily | CMWSSB scrape | TN Agriculture ARS scrape |
| Weather daily | Open-Meteo + NASA POWER | Same |
| Long-term rainfall | IMD gridded (Chennai grid) | IMD gridded (Madurai grid) |
| Groundwater wards | OpenCity ward-monthly choropleth | (Not surfaced - too sparse to interpolate; CGWB Year Book points + block classification instead) |
| Groundwater stations | India WRIS GWL API daily scrape | India WRIS GWL API daily scrape (Madurai district) |
| Groundwater blocks | India WRIS / CGWB block GWR | CGWB block GWR (11 MMC blocks of 66 district-wide) |
| Rivers (CPCB NWMP) | Cooum (7 stations) + Adyar (5) + Buckingham (1) | Vaigai (2 stations: U/S + D/S Madurai) |
| Water bodies | OSM (1,635) + Census (305) + Lost (15) | OSM (715, 638 named via Nominatim) + Flagship (19) + Lost (26) |
| Restoration priority | 6-component spatial scoring | 4-component status+cultural+size+confidence (different algorithm) |
| Flood hazard | CFLOWS 1.0 (Nov 2019) + 2015/2020 hotspots | Not sourced (no known public layer); narrative-only |
| Drainage | GCC 10,308-segment survey | Not sourced (RTI follow-up) |
| Sewerage | CMWSSB 13 STPs / 745 MLD | Not sourced (RTI follow-up) |
| Industrial sources | NGT/TNPCB/CPCB curated | TNPCB + HC PIL curated |
| Urban supply structure | (Implicit in CMWSSB reservoirs) | ADB TNUFIP Tranche 2 IEE structural extract |
| Ward representatives | GCC councillors / MLAs / MPs | Not yet sourced |
| AI narratives | Daily city + monthly per-ward | Not yet wired (chennai-only AI summary store today) |
| Localities for search | OSM (~500) | OSM (51, Wikidata fallback queued) |
| Ward profiles | 200 GCC wards, 5-factor composite | 100 MMC wards, 3-factor composite (reduced) |
| Rich-data deep-zoom (flagship bodies) | 7 onboarded: Pallikaranai (TNSWA gazette) + Sholavaram + Red Hills + Chembarambakkam + Porur + Velachery + Perumbakkam (all OSM). Yearly chips (Landsat 5/7/8 + Sentinel-2), JRC water trend, Dynamic World built trend, Overture buildings (monthly) | Not yet wired (Madurai pattern would re-use the same scripts; flagship candidates: Vandiyur, Anaipatti tanks) |

## Shared utilities (city-agnostic)

A few classifiers / scorers are shared across cities and described once rather than per-city:

- **`src/lib/utils/river-classification.ts`** - CPCB Designated Best-Use class thresholds (DO + BOD), maps each NWMP reading to one of `dead` / `severely_degraded` / `degraded` / `stressed` / `healthy`. Powers river status badges on both `/rivers` and `/madurai/rivers`. Falls back to the JSON-declared `overall_status` only when no station has any classifiable reading. Documented at the river-classification subsection on the city's About page.
- **`scripts/compute-ward-profiles.ts`** + **`scripts/compute-madurai-ward-profiles.ts`** - Build-time spatial-join scripts. Identical structure; per-city differences are which layers exist (Madurai emits `_data_status: "not_available"` for flood/drainage/sewerage/industrial since those layers aren't publicly sourced).
- **`scripts/fetch-localities-osm.ts`** + **`scripts/fetch-localities-osm-madurai.ts`** - Same Overpass query template; per-city differences are bounding box and place taxonomy width (Madurai widens to include `village`/`hamlet` since tier-2 OSM tagging is sparser).
- **`scripts/_rich_body_zones.py`** + **`scripts/verify_rich_body_*.py`** + **`scripts/ingest_rich_body_*.py`** - Body-agnostic pipeline for the rich-data deep-zoom panel. Same script set powers every onboarded body regardless of city; only the registry entry ([src/lib/water-bodies/rich-body-registry.ts](src/lib/water-bodies/rich-body-registry.ts)) is per-body. Outputs land under `public/data/rich-bodies/` and `public/geojson/rich-bodies/`. Underlying datasets: JRC Global Surface Water v1.4 (annual water occurrence 1984-2021), Google Dynamic World V1 (land-cover classification 2016-present), Overture Maps Foundation buildings (quarterly), Open Buildings v3 (fallback), Landsat 5/7/8 + Sentinel-2 SR Harmonized for chips. Tamil Nadu State Wetland Authority (TNSWA) gazetted polygon used for Pallikaranai; OSM relation/way for the rest.

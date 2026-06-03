# Data Sources

> Index of where each city's datasets come from, how often they refresh, and the documentation principles we follow when describing what's missing.

## Per-city documents

The detailed source-by-source breakdown lives in per-city files. Each file documents methodology, output paths, frequencies, coverage caveats, and known limitations for that city's data layers.

- [docs/cities/chennai/data-sources.md](docs/cities/chennai/data-sources.md) - Chennai (CMWSSB reservoirs, OpenCity groundwater, CFLOWS flood, CRRT, etc.)
- [docs/cities/madurai/data-sources.md](docs/cities/madurai/data-sources.md) - Madurai (TN Agriculture ARS, ADB TNUFIP IEE, CGWB Year Book, Vencatesan/DHAN water bodies, CPCB NWMP Vaigai, etc.)
- [docs/cities/bangalore/data-sources.md](docs/cities/bangalore/data-sources.md) - Bengaluru (4 upstream Cauvery reservoirs via TN Agriculture / WRIS, IISc Groundwater Outlook 2025, CGWB block GWR via WRIS GEC 2024, OpenCity tanker surveys, IMD gridded rainfall, 13 flagship water bodies, etc.)

Per-city *features* live alongside in the same folder: [docs/cities/chennai/features.md](docs/cities/chennai/features.md), [docs/cities/madurai/features.md](docs/cities/madurai/features.md), and [docs/cities/bangalore/features.md](docs/cities/bangalore/features.md).

When adding a fourth city, copy the Bengaluru or Madurai folder as a template - those docs reflect the multi-city naming convention (per-city `-<cityId>` suffix on data files). Chennai's docs predate that and use unsuffixed legacy paths for back-compat.

## Documentation principle: avoid absolute-absence claims

When describing layers we don't have data for, hedge with "no known public X" or "we haven't yet found a public daily feed for X" rather than "no public X exists" or "the utility doesn't publish X". Our research is bounded; somewhere a PDF, internal portal, or unindexed dataset might exist. Categorical claims of absolute absence get a counter-example fast and discredit the broader narrative.

The Madurai documents follow this principle throughout. The Chennai documents predate it and may have older absolutist phrasing in places; soften when revisiting.

## Cross-city parity matrix

A contributor cheat-sheet for what each city has covered. If you're adding a third city, this is your checklist - replicate the green column items first, then file the red column as known gaps to track.

| Domain | Chennai | Madurai | Bengaluru |
|---|---|---|---|
| Hero pattern | days-left (reservoirs ARE supply) | allocation (irrigation-primary dams) | cauvery-pumping (lift vs Stage design) |
| Reservoir daily | CMWSSB scrape | TN Agriculture ARS scrape | TN Agriculture ARS scrape (4 upstream Cauvery: KRS, Hemavathi, Kabini, Harangi; all isPrimaryDrinkingSource=false) |
| Weather daily | Open-Meteo + NASA POWER | Same | Same |
| Long-term rainfall | IMD gridded (Chennai grid 13.0/80.0) | IMD gridded (Madurai grid 9.9/78.0) | IMD gridded (Bangalore grid 13.0/77.5; 1970-2025; 843 mm long-term annual mean) |
| Groundwater wards | OpenCity ward-monthly choropleth | (Not surfaced - too sparse to interpolate) | (Not surfaced - 13 stations across 369 wards too sparse to IDW) |
| Groundwater stations | India WRIS GWL API daily scrape | India WRIS GWL API daily scrape (Madurai district) | India WRIS GWL API daily scrape (Bangalore Urban + Rural districts; 13 CGWB telemetric stations) |
| Groundwater blocks | India WRIS / CGWB block GWR | CGWB block GWR (11 MMC blocks of 66 district-wide) | CGWB block GWR via WRIS GEC 2024 (6 Bangalore Urban blocks; ALL Over-Exploited every year on record; Bangalore-East 306% draft/recharge, Yelahanka 140%→260% in 4 yrs) |
| Headline GW layer | OpenCity ward choropleth | CGWB Year Book + block exploitation | IISc Groundwater Outlook for Bengaluru (April 2025) - 80 critically-over-extracted BBMP wards rendered as a percentile choropleth |
| Rivers (CPCB NWMP) | Cooum (7 stations) + Adyar (5) + Buckingham (1) | Vaigai (2 stations) | Vrishabhavathi + Arkavathy + Dakshina Pinakini (partial coverage; KSPCB cross-check pending) |
| Water bodies | OSM (1,635) + Census (305) + Lost (15) | OSM (715, 638 named) + Flagship (19) + Lost (26) | OSM (~900) + Flagship-curated + Lost-tank inventory (T.V. Ramachandra et al.) |
| Restoration priority | 6-component spatial scoring | 4-component (different algorithm) | Composite incl. encroachment + sewage stress (Bangalore-specific) |
| Flood hazard | CFLOWS 1.0 (Nov 2019) + 2015/2020 hotspots | Not sourced (narrative-only) | KSNDMC flood-prone zones + BBMP Sept 2022 hotspots (custom flood-risk-bangalore-leaflet-map) |
| Drainage | GCC 10,308-segment survey | Not sourced (RTI follow-up) | BBMP SWM master plan partial - RTI follow-up for full RWD network |
| Sewerage | CMWSSB 13 STPs / 745 MLD | Not sourced (RTI follow-up) | BWSSB 33 STPs / ~1,440 MLD design (per Stage V program docs) - RTI for actual treatment volumes |
| Industrial sources | NGT/TNPCB/CPCB curated | TNPCB + HC PIL curated | KSPCB + The Hindu BlueLine curated (Bellandur/Varthur foam cluster, Peenya cluster) |
| Tanker market | (Not surfaced) | Not yet sourced | OpenCity longitudinal household survey 2015 / 2019 / 2024 - what households actually pay vs BWSSB tariff |
| Cauvery pumping | n/a | n/a | BWSSB Stage I-V design capacity (~2,225 MLD) vs current lift (~1,450 MLD); Stage V actual ~400 MLD per The Ken Feb 2026 |
| Urban supply structure | (Implicit in CMWSSB reservoirs) | ADB TNUFIP Tranche 2 IEE structural extract | BWSSB Stage I-V infrastructure + cauvery-pumping-hero callouts |
| Ward representatives | GCC councillors / MLAs / MPs | Not yet sourced | BBMP councillors (partial pre-GBA reorganization) |
| AI narratives | Daily city + monthly per-ward | Not yet wired | Template-based daily briefing (BangaloreDailyBriefing); Claude AI uplift slot |
| Localities for search | OSM (~500) | OSM (51, Wikidata fallback queued) | OSM + Wikidata SPARQL (Bangalore neighbourhoods + suburbs) |
| Ward profiles | 200 GCC wards, 5-factor composite | 100 MMC wards, 3-factor composite (reduced) | 198 BBMP wards (pre-GBA), 3-factor reduced composite (no public flood/drainage layer); GBA 369-ward migration pending |
| Languages | EN + TA | EN + TA | EN + KN |
| Long-form story | `/origins` (EN + TA) | `/madurai/origins` (EN + TA) | `/bangalore/origins` (EN + KN; 4-chapter, ~4,000 words) |
| Rich-data deep-zoom (flagship bodies) | 8 onboarded: Pallikaranai (TNSWA gazette) + Sholavaram + Red Hills + Chembarambakkam + Porur + Velachery + Perumbakkam + Chitlapakkam (all OSM). Yearly chips (Landsat 5/7/8 + Sentinel-2), JRC water trend + DW splice 2022+, DW built trend, Overture buildings (monthly) | Not yet wired (flagship candidates: Vandiyur, Anaipatti tanks) | 13 onboarded: Bellandur, Varthur, Hesaraghatta, Hebbal, Ulsoor, Sankey, Madivala, Agara, Jakkur, Rachenahalli, Iblur, Kempambudhi, Puttenahalli, Yelahanka. Same pipeline + JRC/DW splice |

## Shared utilities (city-agnostic)

A few classifiers / scorers are shared across cities and described once rather than per-city:

- **`src/lib/utils/river-classification.ts`** - CPCB Designated Best-Use class thresholds (DO + BOD), maps each NWMP reading to one of `dead` / `severely_degraded` / `degraded` / `stressed` / `healthy`. Powers river status badges on both `/rivers` and `/madurai/rivers`. Falls back to the JSON-declared `overall_status` only when no station has any classifiable reading. Documented at the river-classification subsection on the city's About page.
- **`scripts/compute-ward-profiles.ts`** + **`scripts/compute-madurai-ward-profiles.ts`** - Build-time spatial-join scripts. Identical structure; per-city differences are which layers exist (Madurai emits `_data_status: "not_available"` for flood/drainage/sewerage/industrial since those layers aren't publicly sourced).
- **`scripts/fetch-localities-osm.ts`** + **`scripts/fetch-localities-osm-madurai.ts`** - Same Overpass query template; per-city differences are bounding box and place taxonomy width (Madurai widens to include `village`/`hamlet` since tier-2 OSM tagging is sparser).
- **`scripts/_rich_body_zones.py`** + **`scripts/verify_rich_body_*.py`** + **`scripts/ingest_rich_body_*.py`** - Body-agnostic pipeline for the rich-data deep-zoom panel. Same script set powers every onboarded body regardless of city; only the registry entry ([src/lib/water-bodies/rich-body-registry.ts](src/lib/water-bodies/rich-body-registry.ts)) is per-body. Outputs land under `public/data/rich-bodies/` and `public/geojson/rich-bodies/`. Underlying datasets: JRC Global Surface Water v1.4 (annual water occurrence 1984-2021), Google Dynamic World V1 (land-cover classification 2016-present), Overture Maps Foundation buildings (quarterly), Open Buildings v3 (fallback), Landsat 5/7/8 + Sentinel-2 SR Harmonized for chips. Tamil Nadu State Wetland Authority (TNSWA) gazetted polygon used for Pallikaranai; OSM relation/way for the rest.

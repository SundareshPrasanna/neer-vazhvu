# Data Sources

> Index of where each city's datasets come from, how often they refresh, and the documentation principles we follow when describing what's missing.

## Per-city documents

The detailed source-by-source breakdown lives in per-city files. Each file documents methodology, output paths, frequencies, coverage caveats, and known limitations for that city's data layers.

- [docs/cities/chennai/data-sources.md](docs/cities/chennai/data-sources.md) - Chennai (CMWSSB reservoirs, OpenCity groundwater, CFLOWS flood, CRRT, etc.)
- [docs/cities/madurai/data-sources.md](docs/cities/madurai/data-sources.md) - Madurai (TN Agriculture ARS, ADB TNUFIP IEE, CGWB Year Book, Vencatesan/DHAN water bodies, CPCB NWMP Vaigai, etc.)
- [docs/cities/bangalore/data-sources.md](docs/cities/bangalore/data-sources.md) - Bengaluru (4 upstream Cauvery reservoirs via KWRIS / Karnataka WRIS, IISc Groundwater Outlook 2025, CGWB block GWR via WRIS GEC 2024, OpenCity tanker surveys, IMD gridded rainfall, 13 flagship water bodies, etc.)
- [docs/cities/delhi/data-sources.md](docs/cities/delhi/data-sources.md) - Delhi (CAG performance audit of DJB, Delhi Economic Survey Ch. 13, DPCC monthly Yamuna + drain analysis, CGWB/IN-GRES district groundwater assessments, Jal Dharohar water-bodies census, DUSIB JJ-basti roster, MCD 2022 ward geometry + election results, IMD gridded rainfall, etc.)
- [docs/cities/kolkata/data-sources.md](docs/cities/kolkata/data-sources.md) - Kolkata/KMA (WBPCB EMIS water quality with tidal station pairs, KMC's weekly waterlogging register, KMC District Environment Plan 2021 sewage balance, IN-GRES + India-WRIS groundwater, Open-Meteo hourly rainfall intensity, KMC-SHARP/ADB safeguard disclosures, 1st Census of Water Bodies, etc.)
- [docs/cities/mumbai/data-sources.md](docs/cities/mumbai/data-sources.md) - Mumbai/MMR (Maharashtra WRD Pravah daily reservoir bulletin, CWC weekly bulletins 2015-2025 backfill, BMC ESR/Climate Budget/RTI manuals, Praja Foundation RTI ward tables, MPCB water-quality series, WRD red/blue flood-line sheets, allocation instruments incl. WRD GRs + STEM board minutes, etc.)
- [docs/cities/pune/data-sources.md](docs/cities/pune/data-sources.md) - Pune/PMC (PMC's own Environment Status Report 2025-26 via an open Drupal JSON:API, MWRRA entitlement orders 19/2018 + 01/2025, Maharashtra WRD Pravah shared with Mumbai and cross-checked against CWC's NRLD-2019, IN-GRES drilled to TALUKA level - the platform's first sub-district groundwater drill - CPCB polluted river stretches Oct 2025, OpenCity 2025 prabhag delimitation, OSM water bodies, IMD gridded rainfall, etc.)

Per-city *features* live alongside in the same folder: [docs/cities/chennai/features.md](docs/cities/chennai/features.md), [docs/cities/madurai/features.md](docs/cities/madurai/features.md), [docs/cities/bangalore/features.md](docs/cities/bangalore/features.md), [docs/cities/mumbai/features.md](docs/cities/mumbai/features.md), [docs/cities/delhi/features.md](docs/cities/delhi/features.md), [docs/cities/kolkata/features.md](docs/cities/kolkata/features.md), and [docs/cities/pune/features.md](docs/cities/pune/features.md). Kolkata and Pune additionally ship a graded parity scorecard against Chennai at [docs/cities/kolkata/parity-scorecard.md](docs/cities/kolkata/parity-scorecard.md) and [docs/cities/pune/parity-scorecard.md](docs/cities/pune/parity-scorecard.md) - every feature scored XHigh/High/Medium/Low/N-A with the reason recorded wherever parity is not reachable.

When adding another city, copy the Kolkata, Pune, Delhi or Mumbai folder as a template - those docs reflect the multi-city naming convention (per-city `-<cityId>` suffix on data files). Chennai's docs predate that and use unsuffixed legacy paths for back-compat.

## Documentation principle: record what the source refuses to say

Kolkata added a second discipline alongside the hedging rule below. Where a publisher contradicts
itself or leaves a statutory field empty, that is a finding to surface rather than a gap to fill from
weaker sources. Three numbers are therefore absent from Kolkata *on purpose*, each with the reason on
the page: no total supply capacity (KMC's own page lists plants summing to 2,324.7 MLD beside a
~1,900 MLD target, labelled DRAFT and footered 2013), no litres-per-capita (KMC contests its own
denominator - 4.5m residents plus 6m daily floating, against a "static population" of 44.96 lakh),
and no non-revenue water (never published). The industrial-wastewater section of KMC's statutory
Environment Plan is blank in the original, and we show it as blank.

## Data licensing

The repository's MIT licence covers the code only. The data corpus under
`public/data/` and `public/geojson/` is compiled from many upstream publishers
whose own terms govern each artifact. The authoritative per-artifact record is:

- the artifact's NVDM envelope - `provenance.sources[].license` records each
  upstream source's licence terms (required for L3 conformance; see
  [`schemas/nvdm/`](schemas/nvdm/));
- the Headwaters source registries
  ([`scripts/source-registry/`](scripts/source-registry/)) - the per-source
  licence record that envelope source ids join to.

Some upstream sources carry non-commercial (e.g. CC BY-NC) or share-alike
(e.g. ODbL) terms. `python3 scripts/nvdm-encumbrance-report.py` buckets every
enveloped artifact by its worst source licence, propagated recursively through
`provenance.internal_inputs` (an artifact derived from ODbL inputs is
share-alike even if its own sources are clean), and is the mechanical basis for
licence-clean corpus editions ([`scripts/sample-corpus.json`](scripts/sample-corpus.json)
is the first). A data-specific notice is forthcoming.

## Documentation principle: avoid absolute-absence claims

When describing layers we don't have data for, hedge with "no known public X" or "we haven't yet found a public daily feed for X" rather than "no public X exists" or "the utility doesn't publish X". Our research is bounded; somewhere a PDF, internal portal, or unindexed dataset might exist. Categorical claims of absolute absence get a counter-example fast and discredit the broader narrative.

The Madurai documents follow this principle throughout. The Chennai documents predate it and may have older absolutist phrasing in places; soften when revisiting.

## Cross-city parity matrix

A contributor cheat-sheet for what each city has covered. If you're adding a new city, this is your checklist - replicate the green column items first, then file the red column as known gaps to track.

> **This table is stale by five cities: it predates Delhi, Hyderabad, Kolkata, Gurugram and Pune.** Rather than half-fill
> thirty rows, the modern and more rigorous version of this comparison lives at
> [docs/cities/kolkata/parity-scorecard.md](docs/cities/kolkata/parity-scorecard.md), which grades
> every feature XHigh / High / Medium / Low / N-A against Chennai with the reason recorded wherever
> parity is not reachable, and separates *structural* N-A (the city cannot have this) from a real
> gap (we have not built it). Use that shape for the next city; this table stays as the historical
> four-city snapshot.

| Domain | Chennai | Madurai | Bengaluru | Mumbai |
|---|---|---|---|---|
| Hero pattern | days-left (reservoirs ARE supply) | allocation (irrigation-primary dams) | cauvery-pumping (lift vs Stage design) | days-left, labelled an upper bound (whole-dam storage vs BMC share); rain scenarios collapsed (no public inflow data) |
| Reservoir daily | CMWSSB scrape | TN Agriculture ARS scrape | KWRIS / Karnataka WRIS GeoServer (4 upstream Cauvery: KRS, Hemavathi, Kabini, Harangi; all isPrimaryDrinkingSource=false; native KA feed replacing the second-hand TN-Agri numbers, 2026-07 cutover) | WRD Pravah daily bulletin (5 of 7 BMC lakes; Vihar/Tulsi have no public feed) + CWC weekly 2015-2025 backfill |
| Weather daily | Open-Meteo + NASA POWER | Same | Same | Same |
| Long-term rainfall | IMD gridded (Chennai grid 13.0/80.0) | IMD gridded (Madurai grid 9.9/78.0) | IMD gridded (Bangalore grid 13.0/77.5; 1970-2025; 843 mm long-term annual mean) | IMD gridded (grid 19.0/73.0) + all cities now carry the daily Open-Meteo provisional layer |
| Groundwater wards | OpenCity ward-monthly choropleth | (Not surfaced - too sparse to interpolate) | (Not surfaced - 13 stations across 369 wards too sparse to IDW) | (Not surfaced - excluded from CGWB assessment; Year Book wells only) |
| Groundwater stations | India WRIS GWL API daily scrape | India WRIS GWL API daily scrape (Madurai district) | India WRIS GWL API daily scrape (Bangalore Urban + Rural districts; 13 CGWB telemetric stations) | CGWB Year Book transcription (~53 wells, Mumbai/Thane/Palghar/Raigad, incl. chemistry; WRIS wells stale, ending May 2023) |
| Groundwater blocks | India WRIS / CGWB block GWR | CGWB block GWR (11 MMC blocks of 66 district-wide) | CGWB block GWR via WRIS GEC 2024 (6 Bangalore Urban blocks; ALL Over-Exploited every year on record; Bangalore-East 306% draft/recharge, Yelahanka 140%→260% in 4 yrs) | n/a - Mumbai City + Suburban are the only 2 of Maharashtra's 35 districts excluded from the assessment (stated on-page) |
| Headline GW layer | OpenCity ward choropleth | CGWB Year Book + block exploitation | IISc Groundwater Outlook for Bengaluru (April 2025) - 80 critically-over-extracted BBMP wards rendered as a percentile choropleth | CGWB Year Book well points (monitored-not-assessed framing) |
| Rivers (CPCB NWMP) | Cooum (7 stations) + Adyar (5) + Buckingham (1) | Vaigai (2 stations) | Vrishabhavathi + Arkavathy + Dakshina Pinakini (partial coverage; KSPCB cross-check pending) | MPCB annual WQR series (Mithi stn 2168, Ulhas stations; 2019-20 edition never published) + CPCB PRS 2025 (Mithi = India's worst stretch, 210 mg/l) |
| Water bodies | OSM (1,635) + Census (305) + Lost (15) | OSM (715, 638 named) + Flagship (19) + Lost (26) | OSM (~900) + Flagship-curated + Lost-tank inventory (T.V. Ramachandra et al.) | OSM + flagship + lost-tank inventory (Powai/Vihar/Tulsi + talao record) |
| Restoration priority | 6-component spatial scoring | 4-component (different algorithm) | Composite incl. encroachment + sewage stress (Bangalore-specific) | Priority scoring + flagship + projects (NGT Powai record) |
| Flood hazard | CFLOWS 1.0 (Nov 2019) + 2015/2020 hotspots | Not sourced (narrative-only) | KSNDMC flood-prone zones + BBMP Sept 2022 hotspots (custom flood-risk-bangalore-leaflet-map) | BMC chronic-flooding register (weekly scrape) + 26/7/2005 layer + WRD red/blue flood-line sheets (41, six MMR rivers); iFLOWS documented as not public |
| Drainage | GCC 10,308-segment survey | Not sourced (RTI follow-up) | BBMP SWM master plan partial - RTI follow-up for full RWD network | OSM-traced (labelled community-traced; BRIMSTOWAD as-builts not public) |
| Sewerage | CMWSSB 13 STPs / 745 MLD | Not sourced (RTI follow-up) | BWSSB 33 STPs / ~1,440 MLD design (per Stage V program docs) - RTI for actual treatment volumes | BMC ESR Table 11.5 (2,723 MLD installed vs 1,313 reaching plants) + WwTF upgrade %s in the Commitments Register |
| Industrial sources | NGT/TNPCB/CPCB curated | TNPCB + HC PIL curated | KSPCB + The Hindu BlueLine curated (Bellandur/Varthur foam cluster, Peenya cluster) | Curated (Mahul refinery ring, Taloja MIDC) |
| Tanker market | (Not surfaced) | Not yet sourced | OpenCity longitudinal household survey 2015 / 2019 / 2024 - what households actually pay vs BWSSB tariff | Not surfaced (RTI-gated; Rs 729 vs 25 per-person-month fact from Praja) |
| Cauvery pumping | n/a | n/a | BWSSB Stage I-V design capacity (~2,225 MLD) vs current lift (~1,450 MLD); Stage V actual ~400 MLD per The Ken Feb 2026 | n/a (gravity-fed lakes) |
| Urban supply structure | (Implicit in CMWSSB reservoirs) | ADB TNUFIP Tranche 2 IEE structural extract | BWSSB Stage I-V infrastructure + cauvery-pumping-hero callouts | BMC HE RTI manuals + ESR (3 MBRs → 27 service reservoirs → 109 zones; connections with denominator note) |
| Ward representatives | GCC councillors / MLAs / MPs | Not yet sourced | BBMP councillors (partial pre-GBA reorganization) | Not yet sourced (my-ward withheld at launch) |
| AI narratives | Daily city + monthly per-ward | Not yet wired | Template-based daily briefing (BangaloreDailyBriefing); Claude AI uplift slot | Not yet wired |
| Localities for search | OSM (~500) | OSM (51, Wikidata fallback queued) | OSM + Wikidata SPARQL (Bangalore neighbourhoods + suburbs) | OSM |
| Ward profiles | 200 GCC wards, 5-factor composite | 100 MMC wards, 3-factor composite (reduced) | 198 BBMP wards (pre-GBA), 3-factor reduced composite (no public flood/drainage layer); GBA 369-ward migration pending | 24 BMC wards, equity-first risk model on real Praja supply-hours (my-ward page withheld until ward build completes) |
| Languages | EN + TA | EN + TA | EN + KN | EN (MR advertised as coming soon) |
| Long-form story | `/origins` (EN + TA) | `/madurai/origins` (EN + TA) | `/bangalore/origins` (EN + KN; 4-chapter, ~4,000 words) | `/mumbai/origins` (EN; 4-chapter + 5 licensed Wikimedia images with provenance manifest) |
| Allocation Ledger | Krishna/Telugu Ganga chain + Veeranam + desal contracts | 1,500 mcft/yr PWD-letter entitlement + 1886 Periyar lease ancestry | CWDT award chain (1.75 → +4.75 TMC SC 2018 → 19+10 TMC GoK-BWSSB) | 15 arrangements incl. STEM/MIDC/MMRDA middlemen; 10 of 15 'unreported' (quota on paper, delivery unpublished) |
| Commitments Register | 16 (metering policy, desal trio, ring main, NGT sewage, Cooum/Adyar/Buckingham) | 7 (Manibharathi HC order, Mullaiperiyar 125 MLD, 24x7, UGSS, Vaigai riverfront/cleanup) | 10 (Bellandur/Varthur NGT, Cauvery Stage V/VI, K-100, reuse, Mekedatu) | 19 (WwTFs, BRIMSTOWAD, Gargai/Kalu/Manori, flood spots, climate budget) |
| Rich-data deep-zoom (flagship bodies) | 8 onboarded: Pallikaranai (TNSWA gazette) + Sholavaram + Red Hills + Chembarambakkam + Porur + Velachery + Perumbakkam + Chitlapakkam (all OSM). Yearly chips (Landsat 5/7/8 + Sentinel-2), JRC water trend + DW splice 2022+, DW built trend, Overture buildings (monthly) | Not yet wired (flagship candidates: Vandiyur, Anaipatti tanks) | 13 onboarded: Bellandur, Varthur, Hesaraghatta, Hebbal, Ulsoor, Sankey, Madivala, Agara, Jakkur, Rachenahalli, Iblur, Kempambudhi, Puttenahalli, Yelahanka. Same pipeline + JRC/DW splice | Not yet wired (flagship candidates: Powai, Vihar) |
| Catchment atlas (every lake) | FABDEM 30 m + WhiteboxTools; own/received/total catchment, feeder streams, downstream flow path, rooftop harvest (Overture + IMD normals). River names from `chennai-rivers.geojson`. Lake names: OSM + OpenCity 2019 polygons (~101 recoverable; deferred) | Same pipeline; Vaigai/Varaha/Manjalar river names | Same pipeline; lake names backfilled from three named sources - ATREE/CSEI census (446) + BBMP masterlist (1) + KWRIS `KA:MI_Tanks` open GeoServer (24); rivers Arkavati/Vrishabhavathi/Dakshina Pinakini | Same pipeline; Mithi/Dahisar/Poisar/Oshiwara + supply-lake catchments |

## Shared utilities (city-agnostic)

A few classifiers / scorers are shared across cities and described once rather than per-city:

- **`src/lib/utils/river-classification.ts`** - CPCB Designated Best-Use class thresholds (DO + BOD), maps each NWMP reading to one of `dead` / `severely_degraded` / `degraded` / `stressed` / `healthy`. Powers river status badges on both `/rivers` and `/madurai/rivers`. Falls back to the JSON-declared `overall_status` only when no station has any classifiable reading. Documented at the river-classification subsection on the city's About page.
- **`scripts/compute-ward-profiles.ts`** + **`scripts/compute-madurai-ward-profiles.ts`** - Build-time spatial-join scripts. Identical structure; per-city differences are which layers exist (Madurai emits `_data_status: "not_available"` for flood/drainage/sewerage/industrial since those layers aren't publicly sourced).
- **`scripts/fetch-localities-osm.ts`** + **`scripts/fetch-localities-osm-madurai.ts`** - Same Overpass query template; per-city differences are bounding box and place taxonomy width (Madurai widens to include `village`/`hamlet` since tier-2 OSM tagging is sparser).
- **`scripts/_rich_body_zones.py`** + **`scripts/verify_rich_body_*.py`** + **`scripts/ingest_rich_body_*.py`** - Body-agnostic pipeline for the rich-data deep-zoom panel. Same script set powers every onboarded body regardless of city; only the registry entry ([src/lib/water-bodies/rich-body-registry.ts](src/lib/water-bodies/rich-body-registry.ts)) is per-body. Outputs land under `public/data/rich-bodies/` and `public/geojson/rich-bodies/`. Underlying datasets: JRC Global Surface Water v1.4 (annual water occurrence 1984-2021), Google Dynamic World V1 (land-cover classification 2016-present), Overture Maps Foundation buildings (quarterly), Open Buildings v3 (fallback), Landsat 5/7/8 + Sentinel-2 SR Harmonized for chips. Tamil Nadu State Wetland Authority (TNSWA) gazetted polygon used for Pallikaranai; OSM relation/way for the rest.
- **`neer-vazhvu-api/app/cascade/catchments.py`** + **`app/cascade/enrich_names.py`** - District-agnostic lake catchment atlas. FABDEM 30 m bare-earth DEM (GEE `projects/sat-io/open-datasets/FABDEM`, CC-BY-NC-SA) + WhiteboxTools hydrology produce per-lake own/received/total catchments, Strahler-graded feeder streams, and a downstream flow path traced to the river; Overture buildings (DuckDB) + IMD rainfall normals give the rooftop-harvest estimate. `enrich_names.py` (auto at build end) syncs lake names from source and snaps each terminal lake's path to the nearest named river. Lake-name backfill from three authoritative open sources via **`scripts/name-bangalore-water-bodies.py`** (priority-ordered join: ATREE/CSEI named-lake census + BBMP masterlist via [OpenCity](https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area) as polygon overlap, and KWRIS `KA:MI_Tanks` open GeoServer as point-in-polygon; `name_source`/`name_match_iou`/`name_match_m` provenance, OSM-native names preserved, idempotent). Raw sources under `scripts/data-raw/bangalore/`. Full methodology: [docs/methodology/catchment-atlas-v1.md](docs/methodology/catchment-atlas-v1.md).

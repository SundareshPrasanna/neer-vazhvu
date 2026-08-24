# Data Sources - Bengaluru

> Where each Bengaluru dataset comes from, how often it refreshes, and what to watch out for.


Bengaluru is the third onboarded city after Chennai and Madurai. The data landscape is structurally different from both: the city does not drink directly from any reservoir it owns. BWSSB lifts ~1,400-1,450 MLD of Cauvery water from T.K. Halli (100 km away, 600 m below the city's elevation), pipes it uphill through Stage I-V pumping infrastructure, treats it, and distributes it across 198 BBMP wards (369 wards post-GBA reorganization). Reservoir storage (KRS, Hemavathi, Kabini, Harangi) is upstream basin context, not city runway. So the headline numbers we surface are pumping volume vs Stage design, the IISc 80-ward stress overlay (where the system is failing households), and the longitudinal tanker-market panel (what households actually pay).

Sources below are organised by feature. The Madurai documentation principle on absolute-absence claims (hedge with "no known public X") applies here too.

## Reservoir Levels - KWRIS / Karnataka WRIS (4 upstream Cauvery reservoirs)

| | |
|---|---|
| **Source** | [Karnataka WRIS reservoir feed](https://water.karnataka.gov.in/geoserver/KA/ows) - the open GeoServer layer `KA:reservoir_landing`, Karnataka's own daily storage feed for its reservoirs (KRS, Hemavathi, Kabini, Harangi, keyed on ReservoirID 6/5/7/4) |
| **Method** | WFS GeoJSON pull (handled in `neer-vazhvu-api/app/scrapers/kwris_reservoirs.py`); each reservoir's own observation `Date` is recorded verbatim, so a stale feed writes its real older date rather than a fake "today" |
| **Frequency** | Daily, via the local scheduled job (`~/.local/neervazhvu-ops/`) - KWRIS's GeoServer may block datacenter runner IPs, so it runs from a residential IP alongside CMWSSB/Pravah |
| **Coverage** | KRS (48,400 mcft FRL), Hemavathi/Gorur (35,700), Kabini/Beechanahalli (19,520), Harangi (8,500) |
| **Fields** | Storage (TMC), % of design FRL, level (ft), inflow/outflow (cusecs) |
| **Table** | `reservoir_daily_v2` (PK `city_id`,`source_code`,`date`; `city_id='bangalore'`, `source='kwris_scrape'`) |
| **Why KWRIS, not TN Agriculture** | Bengaluru previously drew these from the TN Agriculture page (still used for Madurai's Vaigai/Mullaperiyar). But those are Tamil Nadu's figures for Karnataka's dams, published for downstream Cauvery release-monitoring: they ran ~12-30% below Karnataka's native numbers, and the archive served a stale page for missing dates (fake flatlines). KWRIS is Karnataka's own authority for its own dams. History before the 2026-07 cutover remains from the TN-Agri feed (`source='tn_pwd_scrape'`); KWRIS writes going forward. |

**Why these reservoirs are flagged `isPrimaryDrinkingSource: false`:** they feed irrigation across Karnataka, drinking water for Mysuru and Mandya, Bengaluru drinking water (Stage I-V via T.K. Halli), and the inter-state release to Tamil Nadu under the 2018 Supreme Court order. Bengaluru is one off-take among many. Dividing total upstream storage by Bengaluru's daily demand would overstate runway by an order of magnitude. So the dashboard hero is `cauvery-pumping`, not `days-left`.

**Known limitations:**
- Daily lift volume from T.K. Halli (the actual Bengaluru-drinking metric) is **not in any public daily feed**. We surface design capacity vs actual reporting from The Ken's Feb 2026 investigation (Stage V designed 775 MLD, delivering ~400 MLD). A structured RTI to BWSSB for weekly Stage I-V lift logs is logged as a contributor entry-point.
- The 2018 SC order requires Karnataka to release ~177 TMC/year to TN even in drought years. Mandya farmer protests over releases (notably 2023) are a recurring drag on Bengaluru's share of upstream storage.

## Cauvery Pumping Stage I-V (Bengaluru's actual supply)

| | |
|---|---|
| **Sources** | BWSSB Stage V program documents; The Ken (Feb 2026) investigation; Karnataka Water Resources Department release schedule |
| **Method** | Manual extraction; episodic press citations |
| **Frequency** | Static (per Stage commissioning); cross-checked against media reporting |
| **Output** | Hardcoded in `src/components/dashboard/cauvery-pumping-hero.tsx` callouts; constants in `src/lib/cities/bangalore.ts` |

Surfaces:
- Headline: BWSSB lifts ~1,450 MLD against Stage V's 2,225 MLD design capacity (Stage I-IV ~1,450 + Stage V design +775)
- 6 callouts: 100 km / 600 m elevation pump chain; ~33% of BBMP wards still on tankers + over-extracted borewells (IISc Outlook 2025); all 6 Bangalore Urban CGWB blocks Over-Exploited; Stage V actual ~400 MLD per The Ken Feb 2026; Cauvery Tribunal release obligation drags Karnataka share; pumping cost ≈ ₹100 cr/yr in electricity alone

**Cross-reference paths:** BWSSB's website publishes Stage I-V design figures but not weekly lift logs. The Ken's Feb 2026 reporting fills the actual-vs-design gap. Episodic Hindu/DH coverage corroborates.

## Groundwater - IISc Outlook (Bengaluru) - HEADLINE LAYER

| | |
|---|---|
| **Source** | Indian Institute of Science (IISc) Groundwater Outlook for Bengaluru (April 2025), BWSSB-commissioned |
| **Method** | PDF parse + manual digitization of the 80-ward critically-over-extracted list |
| **Frequency** | Annual (refresh when IISc publishes a new edition) |
| **Coverage** | 80 of 198 BBMP wards flagged as critically-over-extracted (operating beyond CGWB's safe-yield limit) |
| **Output** | `public/data/bangalore-iisc-stress-wards-2025.json` (80 wards with composite score 0-100 percentile) |

Surfaces:
- Bangalore's headline groundwater layer is the IISc choropleth, not a CGWB depth interpolation. Rendered by `src/components/dashboard/iisc-stress-wards-{leaflet-,}map.tsx` directly on `/bangalore`.
- Click any ward for severity tier + composite score breakdown.
- Pairs with the cauvery-pumping hero: 80 wards critically over-extracted is the failure-mode marker for Stage V's under-delivery.

**Why this is the headline rather than CGWB station depth:** with only 13 CGWB telemetric stations across 369 GBA wards (or 198 BBMP wards), IDW interpolation would manufacture per-ward precision the data doesn't support. The IISc Outlook integrates monitoring + extraction + recharge into a per-ward classification using local geophysics, which is the right granularity for a city dashboard.

## CGWB Block Groundwater (Bangalore Urban district)

| | |
|---|---|
| **Source** | India WRIS GEC 2024 (Dynamic Groundwater Resource Assessment) ArcGIS REST endpoint |
| **Method** | `scripts/fetch-wris-groundwater-bangalore.ts` extracts 6 canonical blocks across 7 vintages (2011-2024) |
| **Frequency** | Annual (refresh when GEC publishes) |
| **Coverage** | 6 Bangalore Urban blocks: Bangalore (North), Bangalore-East, Bangalore-South, Bangalore-City, Yelahanka, Anekal |
| **Output** | `public/data/gwr-blocks-bangalore.json` + `public/geojson/bangalore-gwr-blocks.geojson` |

Surfaces:
- Block exploitation classification on `/bangalore/groundwater` (Safe / Semi Critical / Critical / Over Exploited).
- **All 6 blocks have been Over-Exploited every year on record.** Bangalore-East worst at **306% draft-vs-recharge** in GEC 2024; Yelahanka accelerated **140% → 260% in 4 years** (2020-2024).
- Used as the systemic-extraction marker in the BangaloreDailyBriefing template variants.

## CGWB Station-Level Groundwater (Bangalore + Bangalore Rural districts)

Same India WRIS Ground Water Level API as Chennai's and Madurai's scrape, scoped to Bangalore Urban + Bangalore Rural districts (and parts of Tumakuru / Kolar / Ramanagaram where the periphery falls).
- `neer-vazhvu-api/scripts/scrape_wris_bangalore.py` (initial discovery)
- Daily ingest fans across the 5-district set to capture peri-urban wells used by the corridor (Sarjapur, Whitefield, Devanahalli, etc.)
- 13 CGWB telemetric stations across Bangalore Urban (sparse - the reason no IDW interpolation is shown)

The station overlay renders as `cgwbStations: true` in `groundwaterViews` - point markers, not a choropleth. Each marker shows depth + reading date + station code on click.

## IMD Rainfall (Bengaluru)

| | |
|---|---|
| **Source** | [IMD Gridded Rainfall via imdlib](https://imdlib.readthedocs.io/) |
| **Method** | `neer-vazhvu-api/scripts/generate_imd_rainfall.py --city bangalore` |
| **Frequency** | One-time generation per fiscal-year refresh (`--end-year` defaults to last full year) |
| **Coverage** | Bangalore grid cell at 13.0°N, 77.5°E, 1970-2025 (Deccan plateau, nearest 0.25° intersection to the 12.97/77.59 city centre) |
| **Output** | `public/data/imd-rainfall-monthly-bangalore.json` (56 years monthly + annual + 1970-2020 normals) |
| **Long-term annual mean** | 843.4 mm (gridded cell; the widely-quoted Bangalore station LPA of ~970 mm reflects IMD Bangalore-City urban station, which is wetter than the leeward-side gridded cell) |

Same pipeline as Chennai (13.0/80.0) and Madurai (9.9/78.0); just a different grid point in CITY_DEFAULTS.

## Water Bodies - OSM + Flagship + Lost (Bengaluru)

| | |
|---|---|
| **Sources** | OpenStreetMap; T.V. Ramachandra et al. (IISc) lost-lake inventory; KTCDA (Karnataka Tank Conservation and Development Authority); BBMP lake-rejuvenation list; Madras HC / NGT orders on Bellandur/Varthur |
| **Output** | `public/geojson/bangalore-water-bodies-current.geojson` (OSM polygons), `public/geojson/bangalore-water-bodies-lost.geojson` (documented lost tanks), `public/data/water-bodies-flagship-bangalore.json` (curated flagship tanks with metadata) |
| **Frequency** | Periodic (when KTCDA / BBMP publish, or NGT orders update) |

Notable entries:
- **Bellandur / Varthur** - foam + fire flagship case (multiple NGT orders, Madras HC monitoring, KSPCB consent issues)
- **Hesaraghatta** - drying tank, periodic civic controversy on de-notification proposals
- **Ulsoor / Sankey** - heritage urban tanks
- **Hebbal, Madivala, Agara, Jakkur, Rachenahalli, Iblur** - rejuvenation-priority tanks
- **Kempambudhi, Puttenahalli, Yelahanka** - flagship rejuvenation completed / in progress

13 of these are onboarded as **rich-data deep-zoom bodies** (see below).

### Lake names - three-source named-lake join (catchment atlas)

| | |
|---|---|
| **Sources** | 1. **ATREE-CSEI** - "Map of Lakes in Bengaluru Urban and Rural Districts" via [OpenCity](https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area) (1,349 named lake polygons, open). 2. **BBMP-Masterlist** - BBMP lake masterlist via OpenCity (181 named polygons inside BBMP limits). 3. **KGIS-MI-Tanks** - Karnataka WRIS (KWRIS) open GeoServer layer `KA:MI_Tanks`, the state Minor Irrigation tank register (3,419 named tank points statewide; 328 in the Bengaluru bbox), from `https://water.karnataka.gov.in/geoserver/KA/ows` (no auth). |
| **Why** | ~67% of OSM Bengaluru water polygons are unnamed; the Jal Dharohar census carries no name field (only village/ward); Nominatim only yields locality guesses. ATREE/CSEI is the canonical named lake census; BBMP + KWRIS MI_Tanks fill rural/fringe tanks ATREE thins out on. |
| **Method** | `scripts/name-bangalore-water-bodies.py` - priority-ordered spatial join onto still-unnamed OSM polygons. Polygon sources (ATREE, BBMP): overlap join, accept IoU >= 0.2 or OSM-mostly-inside-ref with a reverse-overlap guard, `name_match_iou`. Point source (MI_Tanks): point-in-polygon or within 15 m, `name_match_m`. Each name carries its `name_source`; OSM-native names never overwritten; higher-priority source wins; idempotent (re-runs touch only changed names). Backfilled 446 ATREE + 1 BBMP + 24 MI_Tanks. |
| **Output** | names written into `bangalore-water-bodies-current.geojson` (source of truth, 848/1,897 = 44% named); re-synced onto the cascade lake + node layers by `app/cascade/enrich_names.py` (no re-delineation needed; also refreshes `drains_to_name`). Raw sources committed under `scripts/data-raw/bangalore/` (ATREE KMZ, BBMP KML, `kwris-mi-tanks-bengaluru.geojson` snapshot). Still unnamed: rural tanks absent from all three sources; the gated KGIS Tank Information System would extend coverage further. |

Powers the **Lake Catchment Atlas** ("Catchments" view on `/bangalore/water-bodies`): per-lake own/received/total catchment, feeder streams, downstream flow path, and rooftop-harvest potential, delineated from FABDEM 30 m + WhiteboxTools. Downstream rivers (Arkavati / Vrishabhavathi / Dakshina Pinakini) named by snapping each terminal lake's flow path to `bangalore-rivers.geojson`. Full methodology: [docs/methodology/catchment-atlas-v1.md](../../methodology/catchment-atlas-v1.md).

### Basin atlas terrain layer (Arkavathi elevation bands)

| | |
|---|---|
| **Source** | FABDEM V1-2 (Hawker et al. 2022, University of Bristol - Copernicus GLO-30 with forests and buildings removed), GEE asset `projects/sat-io/open-datasets/FABDEM`. Same asset and fetch path as the catchment atlas. |
| **License** | CC BY-NC-SA 4.0 (non-commercial) - fine for the free civic platform; a commercial-DEM swap is the known follow-up if this surface ever feeds a paid product. |
| **Method** | `neer-vazhvu-api/scripts/build_elevation_bands.py --basin arkavathi` - 30 m mosaic over the basin bbox, masked to the basin boundary polygon (bands stop at the watershed divide), classified into 7 hypsometric bands whose edges sit on the basin's elevation percentiles (Sangama confluence 366 m -> Nandi Hills 1,452 m, plateau cut finer than the tails), polygonized, simplified ~110 m for basin-scale display. |
| **Output** | `public/data/basins/arkavathi/elevation-bands.geojson` (~950 KB raw / ~260 KB gzipped), rendered by the shared basin atlas as the default-off "Terrain (elevation bands)" toggle - loaded only when enabled, drawn beneath every data layer, dimmed while a treatment-gap choropleth is visible. |

## Rich-Data Deep-Zoom Panel (14 Bengaluru flagship bodies)

| | |
|---|---|
| **Bodies** | Bellandur, Varthur, Hesaraghatta, Hebbal, Ulsoor, Sankey, Madivala, Agara, Jakkur, Rachenahalli, Iblur, Kempambudhi, Puttenahalli, Yelahanka |
| **Pipeline** | Body-agnostic scripts under `scripts/` and `scripts/_rich_body_zones.py`; per-body registry entry in [src/lib/water-bodies/rich-body-registry.ts](../../../src/lib/water-bodies/rich-body-registry.ts) |
| **Outputs** | `public/data/rich-bodies/{body}-imagery-manifest.json`, `{body}-jrc-water-trend.json`, `{body}-dw-water-trend.json`, `{body}-dynamic-world-built-trend.json`, `{body}-open-buildings-verification.json`, `{body}-overture-buildings.json` + chips in `public/data/rich-bodies/imagery/{body}/*.jpg` + tints in Supabase Storage |

**JRC → DW water-trend splice.** JRC GSW v1.4 ships annual water classification through 2021. Without a bridge, the per-body water-fraction chart would truncate at 2021 - misleading for Bengaluru bodies whose recent dynamics matter (Bellandur, Varthur, Hesaraghatta especially). The DW water-class extension (class 0) provides 2022-present in the same shape (`any_water_pct` key); `rich-body-stats-strip.tsx` reads JRC for ≤2021 and DW for ≥2022.

**Imagery refresh pattern.** `scripts/ingest_rich_body_imagery.py` now merges new chips with the existing manifest (read existing → merge → write), so partial-year re-runs (`--years 2025,2026`) don't wipe 1990-2024 chips. Critical fix - earlier behaviour overwrote.

**Tint methodology** (disclosed in the in-panel sources modal + on legend labels):
- **Water lost (1988-92 → 2017-21)**: pixels that were water in ≥3 of 5 baseline years AND not water in ≥3 of 5 end years
- **New built (2016-18 → 2023-25)**: pixels that became built in ≥2 of 3 end years but were not built in ≥2 of 3 baseline years

## Tanker Market - OpenCity Bengaluru (longitudinal survey)

| | |
|---|---|
| **Source** | OpenCity Bengaluru household water-tariff surveys, 2015 / 2019 / 2024 |
| **Method** | Curated extraction (panel data + corridor-specific sites) |
| **Frequency** | Refresh when OpenCity publishes a new survey wave |
| **Output** | `public/data/bangalore-tanker-context.json` (events, tier-by-tier official-vs-informal pricing, corridor notes, structural anchor, data gaps with RTI targets) |

Surfaces:
- `/bangalore/tanker` longitudinal panel: what households actually pay vs BWSSB's official tariff, by corridor and survey wave
- Tier-by-tier breakdown (sub-2K-litre / 4K / 6K / 8K / 12K tanker capacities)
- Section headings + all narrative fields carry `_kn` and `_ta` variants for full Kannada parity

**Why this matters:** the gap between BWSSB's published tariff and what households on the city's periphery actually pay for tanker water is the single sharpest metric of system failure that doesn't require any official disclosure. OpenCity's longitudinal panel - rare in Indian civic data - lets us show the trajectory, not just a snapshot.

## Rivers - CPCB NWMP (Bengaluru waterways)

| | |
|---|---|
| **Source** | [CPCB National Water Monitoring Programme](https://cpcb.gov.in/nwmp-data-2/) annual River Water Quality reports |
| **Method** | Annual PDF parse, scoped to Karnataka rivers crossing Bangalore basin |
| **Frequency** | Annual (refresh when CPCB publishes) |
| **Coverage** | Partial - Vrishabhavathi, Arkavathy, and the upper reaches of the Dakshina Pinakini. KSPCB-monitored stations on Bellandur/Varthur outflows are tracked separately under the water-bodies overlay |
| **Output** | `public/data/river-quality-bangalore.json` |

**Methodology note:** River status badges use the shared `src/lib/utils/river-classification.ts` (CPCB Designated Best-Use class thresholds). Vrishabhavathi reads "severely_degraded" given peri-urban sewage + industrial discharge along its course.

## Flood Risk - KSNDMC + BBMP (Bengaluru)

| | |
|---|---|
| **Sources** | Karnataka State Natural Disaster Monitoring Centre (KSNDMC) flood-prone zones; BBMP Sept 2022 flood hotspots; news reporting on Sep 2022, Aug 2024 events |
| **Method** | Manual extraction; ground-truthed against media + KSNDMC station rainfall data |
| **Frequency** | Episodic (refresh after each major event) |
| **Output** | `public/geojson/bangalore-flood-prone-zones.geojson`, `public/data/bangalore-flood-hotspots.json` |

Surfaces on `/bangalore/flood-risk` via `flood-risk-bangalore-leaflet-map.tsx`. The Sep 2022 IT corridor flooding (Whitefield, Sarjapur Road) is annotated; KSNDMC ward-day rainfall layer pending.

**Compared to Chennai's CFLOWS:** narrower coverage and lower-resolution hazard tiers (KSNDMC doesn't publish a CFLOWS-equivalent probabilistic surface). The page leans on the BBMP hotspot inventory + corridor narrative rather than a hazard choropleth.

## Industrial Sources (Bengaluru)

| | |
|---|---|
| **Source** | KSPCB consent records (where public); The Hindu BlueLine + DH curated reporting; NGT orders on Bellandur/Varthur foam |
| **Method** | Manual curation; cross-check against media |
| **Frequency** | Periodic (when NGT/KSPCB action triggers updates) |
| **Output** | `public/data/industrial-sources-bangalore.json` |
| **Coverage** | Bellandur/Varthur foam cluster (apparel + dyeing + electroplating in surrounding SEZs); Peenya industrial area (engineering + auto); legacy KIADB / KSSIDC industrial estates feeding into Vrishabhavathi |

A KSPCB OCMMS scrape (effluent monitoring for red-category industries) is logged as a contributor entry-point - currently we extract episodically from press coverage.

## Ward Profile + Ward Risk Composite (Bengaluru)

| | |
|---|---|
| **Method** | `scripts/compute-bangalore-ward-risk.py` (mirror of Chennai's compute-ward-profiles.ts, applied over 198 BBMP wards) |
| **Frequency** | Build-time spatial join (re-run when underlying layers update) |
| **Coverage** | 198 BBMP wards (pre-GBA reorganization); 369-ward GBA migration pending |
| **Output** | `public/data/ward-risk-bangalore.json` |

3-factor reduced composite (water bodies proximity, lost-tank proximity, IISc stress + CGWB block exploitation) rather than Chennai's 5-factor model. Flood / drainage / industrial layers don't have ward-level public coverage in Bengaluru, so `_data_status: "not_available"` markers render as honest "not yet sourced" disclaimers in the My Ward card grid rather than fabricated zero counts.

**GBA 369-ward migration:** the 15 May 2025 Greater Bengaluru Authority delimitation re-cut the city into 369 wards across 5 city corporations (notified 19 Nov 2025). The dashboard still uses 198 BBMP wards because the GBA boundary file isn't yet available in any public format we can ingest. Migration tracked as a follow-up.

## Facts Page (Bengaluru)

| | |
|---|---|
| **Source** | Curated by maintainer with citations to primary sources (IISc Outlook, The Ken, CGWB, KSPCB, NGT orders) |
| **Output** | `public/data/facts-bangalore.json` (32 facts, each with title + interpretation + source + EN/TA/KN variants) |
| **Frequency** | Refresh as new authoritative numbers land |

Each fact card carries `title_ta`, `interpretation_ta`, `title_kn`, `interpretation_kn` for full TA + KN parity.

## Localities for search (Bengaluru)

| | |
|---|---|
| **Sources** | OpenStreetMap (Overpass `place=suburb/neighbourhood/quarter/village/hamlet` widened for peri-urban coverage) + Wikidata SPARQL fallback for Kannada-named entries |
| **Method** | Same script template as Madurai (`fetch-localities-osm-{madurai,bangalore}.ts`) |
| **Frequency** | Periodic |
| **Output** | `public/data/bangalore-localities.json` |

Powers locality-name search on `/bangalore/my-ward`. Kannada names captured via the OSM `name:kn` tag where present; Wikidata SPARQL retry queued for entries missing the script.

## Long-form story (Bengaluru)

| | |
|---|---|
| **Path** | `/bangalore/origins` (live for both EN and KN) |
| **Source files** | `src/content/story-bangalore-en.tsx` (English), `src/content/story-bangalore-kn.tsx` (Kannada, ~4,000 words across 4 chapters); dispatcher in `src/content/story-bangalore.tsx` |
| **Images** | `public/images/story/bangalore/bangalore-1854-map.jpg`, `ulsoor-1834.jpg` with MANIFEST.json |

4-chapter long-form covering tank-economy history → colonial pipe rotation → Cauvery scheme commissioning → present-day Cauvery Stage V + groundwater collapse. Native-speaker Kannada review pending; copy is AI-drafted and flagged "pending review" in the UI.

## Documentation principle: avoid absolute-absence claims

Same as Madurai - hedge with "no known public X" rather than "no public X exists". Multiple Bengaluru data layers (daily Stage V lift, KSPCB OCMMS detail, GBA 369-ward boundary, BWSSB STP actual treatment volumes) are tracked as **RTI follow-ups** rather than declared absent. The "What's missing today" subsection at `/bangalore/about` lists each gap with the institutional landscape behind it.

# Data Sources - Madurai

> Where each Madurai dataset comes from, how often it refreshes, and what to watch out for.


The sections above cover Chennai. Madurai is a first-class second city with a meaningfully different data landscape - irrigation-primary dams (Vaigai, Mullaperiyar, Sothuparai) instead of CMWSSB reservoirs, sparser groundwater telemetry (4 live India-WRIS stations across the district), no published flood-hazard layer, no public WTP / OHT / per-zone supply feed, and a heavier reliance on engineering documents (ADB IEE, CGWB Year Books) and academic curation (Vencatesan, DHAN). Where a Chennai equivalent exists, the Madurai section below cross-references it; where it doesn't, the section explains the substitute.

## Documentation principle: avoid absolute-absence claims

Throughout the Madurai sections we hedge gap claims with "no known public X" rather than "no public X exists". Our research is bounded; somewhere a PDF, an internal portal, or an unindexed dataset might exist. Categorical claims of absolute absence get a counter-example fast and discredit the broader narrative. New data-source pages should follow the same pattern - prefer "we haven't found a public daily feed" over "the utility doesn't publish daily" unless we have institutional confirmation.

## Reservoir Levels - TN Agriculture (Madurai)

| | |
|---|---|
| **Source** | [Tamil Nadu Agriculture Reservoir Status](https://tnagriculture.in/ARS/home/reservoir) |
| **Method** | HTML scrape (handled in `neer-vazhvu-api/app/scrapers/wris.py` and `scrape_tn_pwd_reservoirs.py`) |
| **Frequency** | Daily |
| **Coverage** | Vaigai Dam + Mullaperiyar (listed as Periyar) + Sothuparai (when published) |
| **Fields** | Storage (mcft), level (ft), inflow/outflow (cusecs), gross/dead storage |
| **Table** | `reservoir_daily` (city-keyed) + `reservoir_history_v2` for the dated archive |
| **Historical** | Dated archive on the same site goes back to 2018; backfilled via `scripts/backfill_tn_pwd_reservoirs.py` |

**Why this source for Madurai instead of CMWSSB:** TN Agriculture's ARS portal is the only public daily feed covering Madurai's reservoirs. It's not a Madurai-utility publication - it's a state irrigation department dashboard, and we piggyback on it for surface-water context. MMC publishes nothing daily about urban water supply.

**Known limitations:**
- Sothuparai (~1,272 mcft capacity) doesn't appear in the daily feed today; surfaced via the `MissingDataCard` component on `/madurai`.
- Mullaperiyar is Kerala-side irrigation storage; Madurai's drinking-water slice is a small fraction (~1,500 mcft/year sanctioned vs ~10,560 mcft FRL).
- Vaigai is shared across Madurai + Theni + Sivagangai + Ramanathapuram for fields and drinking water both.

## Urban water supply (structural) - ADB TNUFIP IEE

| | |
|---|---|
| **Source** | [ADB Tamil Nadu Urban Flagship Investment Program Tranche 2 IEE](https://www.adb.org/sites/default/files/project-documents/49107/49107-005-iee-en_10.pdf) (Project 49107-005, December 2025) |
| **Local copy** | `docs/research/adb-tnufip/49107-005-iee-en_10.pdf` |
| **Method** | Manual extraction (browser UA required - default WebFetch returns 403) |
| **Frequency** | Static (refresh per ADB tranche publication) |
| **Output** | `public/data/madurai-supply-overview.json` |

Fields extracted and surfaced via the `UrbanSupplyOverview` tile on `/madurai`:
- **Existing supply mix** (192 MLD across 7 schemes): Vaigai WSS Line-I 68 + Line-II 47 (surface, from Vaigai Dam intake well) + Vaigai riverbed 17.54 + Thachampathu Melakkal 14 + Kochadai 8.46 + Manalur/Thiruppuvanam 7 (all sub-surface) + Melur CWSS / Cauvery 30
- **Pannaipatty WTP capacity** (118.6 MLD existing = 71.6 MLD Line-I + 47.0 MLD Line-II, both built 1995/2009; +125 MLD planned via Tranche 2 = 243.6 MLD post-build)
- **Distribution scale**: 28 existing OHTs (12 N + 16 S, 410.5 LL aggregate); 37 new OHTs being added under Tranche 2 (589 LL aggregate); 28 distribution zones / 81 DMAs (42 covered today via 24x7 + Smart City; 39 in Tranche 3 scope; 115 newly-established post-Tranche 3); 764 km existing mains; 95,487 connections (94,487 dom + 600 non-dom + 400 com)
- **Demand**: 2034 design 317 MLD with 125 MLD gap driving the Mullai Periyar dedicated supply scheme; Tranche 3 targets 100% household coverage at 163,958 households
- **Allocation context** (PWD letter Dec 2018): MMC drinking 51.09 cusecs continuous (= 125 MLD); combined drinking demand 209.80 MLD across 59 schemes between Mullaperiyar and Vaigai dams

Tranche 3 IEE (`49107-010-iee-en_0.pdf`) parsed for distribution-network detail. Tranche 2 IEE Parts 2 + 3 (`49107-005-iee-en_11.pdf` and `_12.pdf`) parsed for the existing-system tables, OHT details, and water-quality test reports.

**Cross-reference with MMC's public water-supply page**: a few numbers diverge (MMC's page shows 23 OHTs / 81 distribution zones / 467 km mains / 125 MLD WTP / 96,048 connections). The IEE values supersede because they're the engineering-grade DPR submitted to ADB; the MMC public page uses simpler/rounded figures and conflates DMAs with distribution zones in places. The `madurai-supply-overview.json._secondary_local_source.known_disagreements` array enumerates each disagreement.

## Groundwater - CGWB Year Book + Block GWR (Madurai)

| | |
|---|---|
| **Sources** | CGWB Tamil Nadu Ground Water Year Book 2023-24 + 2024-25; CGWB India Annual Reports 2020-21 to 2024-25 |
| **Local copies** | `docs/research/cgwb/tn-state-yearbook-*.pdf`, `docs/research/cgwb/india-annual-report-*.pdf` (see `docs/research/cgwb/README.md`) |
| **Method** | Manual extraction of Annexure-I station tables + GEC 2022 block-level dynamic resource assessment |
| **Frequency** | Annual (refresh when CGWB publishes) |
| **Outputs** | `public/data/madurai-cgwb-stations.json` (21 wells, quarterly readings) + `public/data/gwr-blocks-madurai.json` (66 blocks district-wide) + `public/geojson/madurai-gwr-blocks.geojson` (11 polygons covering MMC) |

Surfaces:
- Year Book stations render as a point overlay on `/madurai/groundwater` (replaces the IDW-interpolated ward choropleth Chennai uses - 4 live India-WRIS stations across Madurai district is too sparse to interpolate honestly).
- Block exploitation drives the headline classification (Safe / Semi-Critical / Critical / Over Exploited) on `/madurai/my-ward` ward-groundwater cards via spatial join in `scripts/compute-madurai-ward-profiles.ts`.
- Madurai West sits at 105.8% extraction (Over Exploited) - the auto-selected default block on `/madurai/groundwater`.

**Why no IDW choropleth for Madurai:** the four live India WRIS stations in Madurai district are too sparse to manufacture an honest 100-ward depth interpolation. We surface real point readings (CGWB Year Book) plus block-level classification (GEC 2022) rather than fabricate per-ward precision the data doesn't support. See the "Open data gaps in Madurai" subsection on `/madurai/about`.

## CGWB Station-Level Groundwater (Madurai district)

Same India WRIS Ground Water Level API as Chennai's CGWB station scrape, but scoped to Madurai district. Live scrape via:
- `neer-vazhvu-api/scripts/scrape_wris_madurai.py` (initial discovery)
- `neer-vazhvu-api/scripts/scrape_wris_river_level_madurai.py` and `scrape_wris_rainfall_madurai.py` (daily ingest, fans across Madurai + Theni + Dindigul + Virudhunagar to capture the full Vaigai system)
- `neer-vazhvu-api/scripts/backfill_wris_madurai.py` (historical backfill)

## River Quality - CPCB NWMP (Vaigai)

| | |
|---|---|
| **Source** | [CPCB National Water Monitoring Programme](https://cpcb.nic.in/nwmp-data-2/) annual River Water Quality reports (2021-2024 PDFs in `docs/cpcb/`) |
| **Method** | Annual PDF parse via `neer-vazhvu-api/scripts/scrape_cpcb_nwmp_vaigai.py` |
| **Frequency** | Annual (refresh when CPCB publishes) |
| **Coverage** | 2 stations: Vaigai U/S Madurai (NWMP 10059 / `vaigai-sellur`) and Vaigai D/S Madurai (10060 / `vaigai-anuppanadi`) |
| **Output** | `public/data/river-quality-madurai.json` |

Vaigai dam, Andipatti, Manamadurai, and Ramanathapuram are seeded in the rivers config for future expansion but stay readings-empty until CPCB adds them to NWMP.

**Methodology note:** River status badges (`dead`, `severely_degraded`, `degraded`, `stressed`, `healthy`) are derived from current readings via `src/lib/utils/river-classification.ts` using CPCB Designated Best-Use class thresholds (DO + BOD), taking the worst classification across stations. The CPCB Polluted River Stretch (PRS) Priority I-V designation is treated as historical context, not as the headline status. See the "How we classify river health" subsection on `/madurai/about` for the full methodology.

## Water Bodies - Flagship + Lost (Madurai)

| | |
|---|---|
| **Flagship source** | DHAN Foundation curation + city records |
| **Lost source** | Vencatesan (2014) urban tanks audit + DHAN field studies |
| **Output** | `public/data/water-bodies-flagship-madurai.json` (19 named tanks with metadata, ramsar status, restoration history), `public/geojson/madurai-water-bodies-lost.geojson` (26 documented lost tanks as Points), `public/geojson/madurai-water-bodies-current.geojson` (715 OSM polygons, 638 named via OSM Nominatim) |
| **Frequency** | Periodic (when DHAN publishes a new audit, or when Madras HC PIL records get updated) |

Notable entries: Vandiyur tank (~278 ha, on the Madras HC PIL anchor list), Mariamman Teppakulam (Meenakshi temple), Samanatham, Anaikondan, Avaniyapuram. Several lack lat/lng - tracked as a contributor entry-point.

## Restoration Priority Scoring (Madurai)

Madurai's restoration scoring uses a **different algorithm** than Chennai. Chennai's 6-component spatial model (size, lost-proximity, river-pollution, industrial-proximity, type, census-condition) doesn't fit because Madurai lacks census water-body data and the institutional anchor is the Madras HC March 2024 order rather than CFLOWS-style spatial proximity to lost bodies.

| Component | Weight | What it measures |
|---|---|---|
| status_severity | up to 80 | Documented restoration urgency (encroachment, sewage impact, dry status) |
| cultural_bonus | up to 15 | HC PIL listing, Ramsar proposal, religious anchor |
| size | up to 25 | Area in hectares - larger bodies prioritised |
| confidence_multiplier | 0.5-1.0 | Source confidence (V = verified, P = probable, U = unverified) |

Output: `public/data/restoration-priority-madurai.json` (17 scored bodies: 11 flagship-curated + 6 OSM-matched). Renders on `/madurai/water-bodies?mode=restoration`.

**Flagship-curated bodies have no OSM polygon** - they render as `<Circle>` markers in a high-z pane (z=560) so they sit above polygons and stay clickable. Logic in `src/components/water-bodies/unified-map.tsx`.

## Industrial Pollution Sources (Madurai)

| | |
|---|---|
| **Source** | TNPCB consent records + Madras HC Madurai Bench Vaigai pollution PIL filings |
| **Output** | `public/data/industrial-sources-madurai.json` |
| **Coverage** | Vaigai-basin industrial pollution: textile dyeing units, sugar/paper mills, sewage outfalls. 177 sewage / industrial discharge points across 5 districts noted in HC orders (December 2024 suo motu cognisance). |

## IMD Rainfall (Madurai)

| | |
|---|---|
| **Source** | [IMD Gridded Rainfall via imdlib](https://imdlib.readthedocs.io/) |
| **Method** | `neer-vazhvu-api/scripts/generate_imd_rainfall.py` |
| **Frequency** | One-time generation per fiscal-year refresh |
| **Coverage** | Madurai grid cell at 9.9°N, 78.0°E, 1970-2025 |
| **Output** | `public/data/imd-rainfall-monthly-madurai.json` (56 years monthly + annual) |

Same pipeline as Chennai's IMD generator; just a different point.

## Localities for search (Madurai)

| | |
|---|---|
| **Sources** | OpenStreetMap (Overpass `place=suburb/neighbourhood/quarter/village/hamlet`) + Wikidata SPARQL fallback |
| **Method** | `scripts/fetch-localities-osm-madurai.ts` |
| **Frequency** | Periodic (one-off for now) |
| **Output** | `public/data/madurai-localities.json` (51 entries, 49/51 with Tamil names) |

Powers locality-name search on `/madurai/my-ward`. Tier-2 city OSM tagging is sparser than Chennai's, so we widen the place taxonomy to include `village`/`hamlet` (mapped back to "suburb" in the LocalityEntry union). Wikidata SPARQL retry is a deferred follow-up.

## Ward Profile Index (Madurai)

| | |
|---|---|
| **Method** | `scripts/compute-madurai-ward-profiles.ts` (mirrors Chennai's `compute-ward-profiles.ts`) |
| **Frequency** | Build-time spatial join |
| **Coverage** | 100 MMC wards (vs Chennai's 200 GCC wards) |
| **Output** | `public/data/madurai-ward-profiles.json` |

Layers indexed per ward:
- Water bodies (87 of 715 OSM bodies assigned)
- Lost water bodies (25 of 26 documented Vencatesan/DHAN tanks)
- Restoration priority (high/critical counts + top 3 bodies)
- Rivers (nearest CPCB station from `river-quality-madurai.json`)
- CGWB groundwater assessment (block class via PIP centroid -> 11 GWR polygons; nearest CGWB Year Book well gated to ≤5 km - 97/100 wards have one within range)

Layers explicitly emitted as `_data_status: "not_available"` (rendering as honest disclaimer cards in the UI rather than fabricated zero counts):
- `flood` - no public CFLOWS-equivalent hazard layer
- `drainage` - no public drainage GeoJSON (RTI follow-up to MMC)
- `sewerage` - no public sewerage GeoJSON
- `industrial` - no public industrial-zone polygons

The 3-factor ward-risk composite (water bodies, lost bodies, groundwater) is in `public/data/ward-risk-madurai.json` - a reduced variant of Chennai's 5-factor composite, applied because flood/drainage/sewerage layers aren't sourced.

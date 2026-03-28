# Data Sources

> Where each dataset comes from, how often it refreshes, and what to watch out for.

## Reservoir Levels -CMWSSB

| | |
|---|---|
| **Source** | [Chennai Metropolitan Water Supply and Sewerage Board](https://cmwssb.tn.gov.in/lake-level) |
| **Method** | HTML scrape (BeautifulSoup) |
| **Frequency** | Daily (06:00 IST via GitHub Actions) |
| **Coverage** | 6 reservoirs: Poondi, Cholavaram, Red Hills, Chembarambakkam, Veeranam, Kannankottai |
| **Fields** | Water level (ft), storage (mcft), capacity (mcft), storage %, inflow (cusecs), outflow (cusecs), rainfall (mm) |
| **Table** | `reservoir_daily` |
| **Historical** | Kaggle dataset back to 2004 (monthly storage only); daily inflow/outflow available from ~2022 onward |

**Known limitations:**
- Page format changes without notice; scraper needs periodic updates
- Data may not update on weekends or public holidays
- CMWSSB may block some datacenter IPs; the pipeline tolerates up to 4 days of stale data and continues with ETL/intelligence updates
- Inflow/outflow fields were added later; pre-2022 records have nulls for these
- Occasional duplicate or stale rows when CMWSSB delays their update

## Weather — Open-Meteo (primary) + NASA POWER (fallback)

| | |
|---|---|
| **Primary Source** | [Open-Meteo API](https://open-meteo.com/) (free, no auth required) |
| **Fallback Source** | [NASA POWER API](https://power.larc.nasa.gov/) (Prediction Of Worldwide Energy Resources) |
| **Method** | REST API (Open-Meteo: `/v1/forecast`; NASA POWER: `/api/temporal/daily/point`) |
| **Frequency** | Daily (5-day backfill window; Open-Meteo has zero lag, NASA POWER has 2-day lag) |
| **Coverage** | Single point: Chennai (13.0827°N, 80.2707°E) |
| **Fields** | Precipitation (mm), temperature max/min (°C), relative humidity (%), reference evapotranspiration ET₀ (mm/day), max wind speed (km/h) |
| **Table** | `weather_daily` |
| **Historical** | Open-Meteo archive API back to 1940; NASA POWER back to 1981 |

**Why two sources?**
- Open-Meteo provides same-day data (zero lag) and includes ET₀ (reference evapotranspiration, FAO Penman-Monteith method) — critical for reservoir evaporation modeling
- NASA POWER serves as an automatic fallback if Open-Meteo is unreachable
- The pipeline tries Open-Meteo first; on failure, logs a warning and falls back to NASA POWER

**Known limitations:**
- Single point for all of Chennai — no ward-level granularity
- Open-Meteo uses ERA5 reanalysis + weather model blends; can differ from ground-station readings
- ET₀ is reference evapotranspiration (grass-based), not actual reservoir surface evaporation; still a strong proxy
- NASA POWER fallback has a 2-day data lag

## Groundwater -OpenCity Chennai

| | |
|---|---|
| **Source** | [OpenCity Chennai](https://data.opencity.in/) (CKAN API) |
| **Method** | CKAN `datastore_search` API |
| **Frequency** | Monthly (pipeline runs days 1-3 of each month) |
| **Coverage** | ~200 wards across 15 zones in Greater Chennai Corporation |
| **Fields** | Ward number, ward name, zone, year, month, depth to water level (meters) |
| **Table** | `groundwater_monthly` |
| **Historical** | 2021–2024 datasets available (separate resource IDs per year) |

**Known limitations:**
- Data lags by several months (latest available may be 3-6 months old)
- Not all wards report every month -coverage varies
- Measurement methodology may differ across wards
- New year datasets require adding the resource ID to the scraper config

## Water Bodies Census — data.gov.in

| | |
|---|---|
| **Source** | [First Census of Water Bodies — Tamil Nadu](https://data.gov.in/resource/state-wise-data-first-census-water-bodies-tamil-nadu) (Ministry of Jal Shakti) |
| **Method** | REST API (data.gov.in Open Government Data Platform) |
| **Frequency** | One-time / quarterly re-fetch (static 2018-19 census data) |
| **Coverage** | 305 water bodies in Chennai district |
| **Fields** | Name, type, ownership, lat/lon, storage capacity (original + present), encroachment status/%, depth, construction year, renovation year, basin/sub-basin, in-use status |
| **Table** | `water_bodies_census` |
| **API** | `https://api.data.gov.in/resource/f252ddd7-...?filters[district_name]=CHENNAI` |
| **Auth** | Free API key from data.gov.in |

**Why this source?**
- Official government census data — authoritative ownership, encroachment, and capacity information
- 305 individually geolocated water bodies with lat/lon coordinates
- Storage capacity degradation (original vs present) shows water body health
- Encroachment status is unique data not available from OSM
- Complements the existing 1,635 OSM water body polygons with government metadata

**Known limitations:**
- Census data is from 2018-19 — not real-time; encroachment and capacity may have changed
- Some records have missing lat/lon or capacity values (filtered out during import)
- Storage capacity units in the census may not directly correspond to mcft
- Not all 305 records will match to an OSM polygon (different names, geometries)
- Requires a free data.gov.in API key (set `DATA_GOV_IN_API_KEY` env var)
- To refresh: `POST /pipeline/run-census-fetch` (requires cron auth)

## River Water Quality -CPCB

| | |
|---|---|
| **Source** | [CPCB National Water Monitoring Programme](https://cpcb.nic.in/nwmp-data/) -"Status of Water Quality in India" annual reports |
| **Method** | Manual curation (PDF/Excel → JSON) |
| **Frequency** | Annual (refreshed when CPCB publishes the next report, typically Jan–Mar) |
| **Coverage** | 4 rivers: Cooum, Adyar, Buckingham Canal, Kosasthalaiyar -10 monitoring stations total |
| **Fields** | Dissolved oxygen (DO, mg/L), Biochemical oxygen demand (BOD, mg/L), pH, conductivity (µS/cm) |
| **File** | `public/data/river-quality.json` (static, served directly from Next.js `public/`) |
| **Historical** | 2015–2024 |

**Supplementary sources:**
- IIT Madras and Anna University peer-reviewed studies on Chennai river water quality
- NGT Chennai bench orders (which cite measured DO/BOD values)
- Care Earth Trust / Coastal Management Society published reports

**CPCB classification scale used:**

| Status | DO (mg/L) | BOD (mg/L) | CPCB Class |
|--------|-----------|-----------|------------|
| Dead | < 0.5 | > 50 | Below E |
| Severely Degraded | 0.5–2 | 10–50 | E |
| Degraded | 2–4 | 5–10 | D |
| Stressed | 4–6 | 3–5 | C |
| Healthy | > 6 | < 2 | A / B |

**Known limitations:**
- CPCB reports are published as PDFs -no programmatic API; data must be extracted manually
- Monitoring station locations and frequencies can change between annual reports
- Pre-2015 data is sparse for smaller rivers (Buckingham Canal, Kosasthalaiyar)
- The overall `status` field is a judgement call for the river reach, not a single measurement
- To update: download the latest CPCB report, update `readings` in `river-quality.json`, bump `last_updated` and `data_year_range`, commit `data: update river quality readings to {year}`

## River Geometry -OpenStreetMap

| | |
|---|---|
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via [Overpass API](https://overpass-api.de/) |
| **Method** | Script: `scripts/fetch-rivers-osm.ts` (run once, re-run after major OSM edits) |
| **Frequency** | One-time fetch; re-run manually if OSM geometry improves |
| **Coverage** | 4 rivers clipped to Chennai city bbox (12.75–13.35°N, 80.0–80.35°E) |
| **Fields** | MultiLineString geometry (way coordinate arrays grouped by river name tag) |
| **File** | `public/geojson/chennai-rivers.geojson` (static GeoJSON, ~200 KB) |

**Known limitations:**
- OSM river way coverage varies -some urban stretches may be missing or misaligned
- The Buckingham Canal is a national waterway; bbox clipping limits it to the Chennai stretch (~72 km)
- Run `npx tsx scripts/fetch-rivers-osm.ts` to regenerate after OSM data improves

## Industrial Pollution Sources -NGT / TNPCB / CPCB

| | |
|---|---|
| **Source** | NGT Southern Bench orders (2017–2022); TNPCB consent records and enforcement reports; CPCB industrial discharge monitoring; academic studies (Global NEST Journal, Springer Nature); The Wire; Carbon Copy |
| **Method** | Manual curation (PDF court orders, enforcement records, published studies → JSON) |
| **Frequency** | Static dataset (updated when major new NGT orders or incidents are documented) |
| **Coverage** | 7 major industrial facilities in north Chennai / Ennore-Manali corridor: NCTPS, CPCL, Kamarajar Port, SIPCOT Manali, MFL, TPL, Ennore Creek Discharge Zone |
| **Fields** | Facility name (English + Tamil), type, coordinates, operator, rivers affected, pollutant types, incident records (date, volume, source), NGT order summaries |
| **File** | `public/data/industrial-sources.json` (static, served directly from Next.js `public/`) |

**Key evidence sources:**
- NGT Southern Bench, Sept 2017: Expert committee findings on NCTPS fly ash -heavy metals (Cd, Hg, Cr, Cu, Mn, Se, Pb, Ni) in Seppakkam village borewells; 5.67 million tonnes ash deposited over 3.51 km²
- TNPCB enforcement records, Dec 2023: CPCL Cyclone Michaung spill -517 tonnes of oil into Buckingham Canal and Ennore Creek; ₹74 crore compensation demanded
- Indian Coast Guard / Wikipedia: 2017 Ennore oil spill -BW Maple × Dawn Kanchipuram collision; ~75–196 tonnes bunker fuel; 25 miles of coastline affected
- Global NEST Journal (2025): Heavy metal contamination in Ennore ecosystem sediments (16 parameters)
- Springer Nature (2025): Microplastics in Kosasthalaiyar estuary

**Known limitations:**
- Incident descriptions summarised from primary sources; exact volumes are estimates in many cases
- TNPCB consent records are not publicly searchable by facility -some data inferred from secondary sources
- Coordinates represent facility centroid, not specific discharge points
- To update: verify new NGT orders via egriwas.nic.in or TNPCB press releases; add new `incidents` entries and update `ngt_orders` array in `industrial-sources.json`

## Industrial Zone Geometry -OpenStreetMap

| | |
|---|---|
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via [Overpass API](https://overpass-api.de/) |
| **Method** | Script: `scripts/fetch-industrial-zones-osm.ts` (run once, re-run after major OSM edits) |
| **Frequency** | One-time fetch; re-run manually if OSM industrial zone coverage improves |
| **Coverage** | North Chennai industrial corridor (bbox: 13.0–13.4°N, 80.1–80.4°E) |
| **Fields** | Polygon geometry for `landuse=industrial` ways and relations; properties: `osm_id`, `name`, `area_ha` |
| **File** | `public/geojson/chennai-industrial-zones.geojson` (static GeoJSON, filtered to area > 5 ha) |

**Known limitations:**
- OSM industrial zone coverage varies -some facilities may be partially mapped or missing
- Run `npx tsx scripts/fetch-industrial-zones-osm.ts` to regenerate after OSM data improves

## IMD Historical Rainfall

| | |
|---|---|
| **Source** | [IMD Gridded Rainfall](https://imdlib.readthedocs.io/) (Indian Meteorological Department, via imdlib Python library) |
| **Method** | Script: `neer-vazhvu-api/scripts/generate_imd_rainfall.py` (extracts 0.25-degree grid cell for Chennai) |
| **Frequency** | One-time generation; re-run when new years of IMD data become available |
| **Coverage** | Monthly rainfall for Chennai (13.0°N, 80.25°E grid cell), 1970-2025 |
| **Fields** | Year, month, rainfall (mm), annual total, long-term monthly normals |
| **File** | `public/data/imd-rainfall-monthly.json` (static, served from Next.js `public/`) |

**Why this source?**
- 56 years of monthly rainfall history enables drought/flood/Day Zero year identification
- Long-term normals provide a baseline for comparing current year's monsoon performance
- IMD is the authoritative source for Indian precipitation data

**Known limitations:**
- Gridded data at 0.25-degree resolution - represents area average, not point measurements
- imdlib downloads binary `.grd` files from IMD servers; availability depends on IMD maintaining these archives
- Data for the most recent year may be incomplete until IMD finalizes it

## CGWB Groundwater Exploitation - India WRIS

| | |
|---|---|
| **Source** | [India WRIS](https://indiawris.gov.in/) / Central Ground Water Board (CGWB) |
| **Method** | Script: `scripts/fetch-wris-groundwater.ts` (ArcGIS REST API query for Chennai-area blocks) |
| **Frequency** | Static fetch; re-run when CGWB publishes updated assessment data |
| **Coverage** | ~15 blocks in and around Chennai district (2011-2024 assessments) |
| **Fields** | Block name, assessment year, classification (Safe/Semi-Critical/Critical/Over-Exploited), development %, net availability, existing draft, domestic/industrial draft |
| **Files** | `public/data/gwr-blocks.json` (exploitation data), `public/data/gw-stations.json` (monitoring stations), `public/geojson/chennai-gwr-blocks.geojson` (block boundaries) |

**Why this source?**
- CGWB is the authoritative national agency for groundwater assessment
- Block-level exploitation classification shows which areas are drawing more groundwater than is recharged
- Development percentage trends over multiple assessment years reveal long-term sustainability
- Complements the ward-level depth data from OpenCity with a broader resource sustainability view

**Known limitations:**
- Assessment data is periodic (not real-time) - latest available may be from 2023 or 2024
- Block boundaries from India WRIS ArcGIS may not align exactly with GCC administrative boundaries
- Some blocks cover areas beyond Chennai city limits
- To regenerate: `npx tsx scripts/fetch-wris-groundwater.ts`

## Flood Risk Data - OpenCity Chennai

| | |
|---|---|
| **Source** | [OpenCity Chennai](https://data.opencity.in/) (multiple flood-related KML datasets) |
| **Method** | KML download + conversion to simplified GeoJSON via `scripts/simplify-flood-geojson.ts` |
| **Frequency** | One-time fetch; static datasets |
| **Coverage** | Chennai metropolitan area |
| **Datasets** | 6 GeoJSON files derived from OpenCity KML resources |
| **Files** | `public/geojson/chennai-flood-hazard-zones.geojson`, `chennai-flood-2015-hotspots.geojson`, `chennai-flood-2020-hotspots.geojson`, `chennai-flood-inundation-depth.geojson`, `chennai-flood-return-periods.geojson` |

**Sub-datasets:**
- **Flood Hazard Zones** (CFLOWS model): 15,524 polygons in 5 categories (very high, high, moderate, low, very low). Simplified from 35MB to 3.6MB.
- **2015 Flood Hotspots**: 327 GCC-identified flood-affected points with vulnerability ratings (Very High/High/Low), ward and zone numbers
- **2015 Inundation Depth**: 192 crowd-sourced depth readings (5-60 ft) with location remarks
- **2020 Cyclone Nivar Hotspots**: 53 named flood-affected neighborhoods
- **Return Period Maps**: 5/10/25/50/100/200-year flood extents, merged from 6 KMLs into 1.1MB file

**Known limitations:**
- CFLOWS hazard zones are model outputs, not observed flood extents
- 2015 depth points are crowd-sourced and may have accuracy variations
- Return period maps are planning-grade, not site-specific predictions
- Hazard zone polygons have no location names; ward boundary overlay provides spatial context

## GCC Storm Water Drain Network

| | |
|---|---|
| **Source** | [GCC Storm Water Drain Survey](https://data.opencity.in/dataset/chennai-stormwater-drain-swd-maps) + [Chennai Basin Drainage Maps](https://data.opencity.in/dataset/chennai-basin-drainage-maps) |
| **Method** | KML download + Python conversion to GeoJSON |
| **Frequency** | Static (survey data from 2023) |
| **Coverage** | 197 wards across Greater Chennai Corporation |
| **Features** | 10,308 drain segments (8,092 SWD + 2,089 side drains + 62 open drains + 15 macro + 37 micro + others) |
| **Fields** | Street name, location, ward, zone, drain type, open/closed detail, depth (m), width (m), length (m), material, condition status (Good/Bad), cover |
| **File** | `public/geojson/chennai-drainage.geojson` (~4.3 MB) |

**Why this source?**
- Official GCC survey data with street-level drain detail across nearly all wards
- Includes condition status (Good/Bad) and construction type - useful for maintenance prioritization
- Ward and zone assignment enables cross-referencing with groundwater and flood hazard data
- Replaces the earlier OSM drainage data (739 features) with 14x more features and richer attributes

**Known limitations:**
- Survey data from 2023 - new construction or repairs since then are not reflected
- Some fields (CONST_DATE, CONTRACTOR, FUND) are sparsely populated
- Drain depth/width values are nominal design values, not field measurements
- File size is 4.3MB; may be slow to render all 10,308 segments on lower-end devices

## CMWSSB Sewerage Network

| | |
|---|---|
| **Source** | [Chennai Sewerage Collection System](https://data.opencity.in/dataset/chennai-sewerage-collection-system) + [Chennai Sewage Pumping Network](https://data.opencity.in/dataset/chennai-sewage-pumping-network) + [Chennai Sewage Treatment Plants](https://data.opencity.in/dataset/chennai-sewage-treatment-plants) |
| **Method** | KML/KMZ download + Python conversion to GeoJSON (`scripts/convert-sewerage-kml.py`) |
| **Frequency** | Static (CMWSSB infrastructure data) |
| **Coverage** | City-wide sewerage infrastructure |
| **Features** | 4,190 features: 8 STPs + 348 pumping stations + 3,834 pumping main segments |
| **File** | `public/geojson/chennai-sewerage.geojson` (~1.2 MB) |

**Layers:**

| Layer | Count | Geometry | Key fields |
|-------|-------|----------|------------|
| Treatment Plants (STP) | 8 | Point (centroid) | Name, capacity (MLD), effluent quality, disposal point |
| Pumping Stations (SPS) | 348 | Point (centroid) | Name, linked STP, streets served, ground water level |
| Pumping Mains | 3,834 | LineString | Origin SPS/STP, destination SPS/STP, pipe material, pipe size (mm) |

**Why this source?**
- Official CMWSSB infrastructure data - the only source for sewerage network geometry in Chennai
- SPS-to-STP linkage shows how sewage flows through the city
- Pipe material and size codes decoded from CMWSSB lookup tables
- Directly relevant to flood risk: SPS failures during floods cause raw sewage overflows

**Known limitations:**
- The full sewer main network (181,147 segments, 237 MB KML) is too large for web delivery; only trunk infrastructure (STPs, SPS, pumping mains) is included
- Release points (372,223 individual household connections) are excluded for the same reason
- Some STP capacity values are missing in the source data
- Pipe material and size are stored as codes in the source; decoded using the sewer-codes.txt lookup table

## Restoration Priority Scores -Computed

| | |
|---|---|
| **Source** | Pre-computed from existing project datasets using spatial analysis |
| **Method** | Build script: `scripts/compute-restoration-priority.ts` (Haversine distance calculations) |
| **Frequency** | Re-run when input data changes (water bodies GeoJSON, river quality, industrial sources) |
| **Coverage** | 1,787 water bodies (1,635 OSM + 152 census-only) |
| **Fields** | Priority score (0–100), priority level, 6 component scores, centroid, nearest lost body / river station / industrial source with distances |
| **File** | `public/data/restoration-priority.json` (static, served from Next.js `public/`) |

**Input datasets used:**
- `public/geojson/chennai-water-bodies-current.geojson` -water body polygons and area
- `public/geojson/chennai-water-bodies-lost.geojson` -15 lost/encroached water body locations
- `public/data/river-quality.json` -10 CPCB monitoring station locations and latest DO readings
- `public/data/industrial-sources.json` -7 industrial facility coordinates
- Water Bodies Census (data.gov.in) -305 census records with encroachment and capacity data

**Scoring components:**

| Component | Weight | Logic |
|-----------|--------|-------|
| Water body size | 25% | Threshold-based on `area_ha` (capped at 200 ha): ≥50ha → 100, <0.5ha → 10 |
| Proximity to lost water bodies | 18% | Distance to nearest of 15 lost bodies: ≤2km → 100, >10km → 10 |
| Proximity to polluted rivers | 18% | Distance to CPCB stations weighted by DO: dead river <3km → 100 |
| Industrial pollution proximity | 14% | Distance to nearest of 7 facilities: ≤2km → 100, >10km → 10 |
| Water body type | 15% | reservoir → 100, lake → 95, water → 70, pond → 65, canal → 15, drain → 5 |
| Census condition | 15% | Encroachment status + storage capacity loss from government census (matched by proximity) |

**Known limitations:**
- Scores are spatial proxies only -do not account for population density, land ownership, sedimentation, or restoration cost
- Water body centroids are simple vertex averages (sufficient for km-scale distance calculations)
- ~1,360 water bodies have no name in OSM -shown as "Unnamed water body"; unnamed polygon water bodies are labeled with the nearest river name
- Census records are matched to OSM polygons by proximity; 152 census water bodies with no OSM match are included as point-only entries
- To regenerate: `npx tsx scripts/compute-restoration-priority.ts`

## Ward Profiles - Computed

| | |
|---|---|
| **Source** | Pre-computed spatial join from all existing project datasets |
| **Method** | Build script: `scripts/compute-ward-profiles.ts` (centroid point-in-polygon attribution) |
| **Frequency** | Re-run when any input GeoJSON changes; CI reruns and diffs to catch staleness |
| **Coverage** | All 200 GCC wards |
| **Fields** | Water body count (OSM + census), restoration priority counts, lost water body count/names, flood hazard zones by category, drainage line count, sewerage infrastructure (STP/SPS/pumping main counts + STP capacity), nearest river station (ID + distance), industrial zone count |
| **File** | `public/data/ward-profiles.json` (static, committed, ~100 KB) |

**Input datasets used:**
- `public/geojson/chennai-wards-2022.geojson` - 200 ward polygons (boundaries)
- `public/geojson/chennai-water-bodies-current.geojson` - 1,635 water body polygons
- `public/data/restoration-priority.json` - 1,787 scored water bodies (including census records)
- `public/geojson/chennai-water-bodies-lost.geojson` - 15 lost water bodies
- `public/geojson/chennai-flood-hazard-zones.geojson` - 15,524 flood hazard zone polygons
- `public/geojson/chennai-flood-2015-hotspots.geojson` - 327 flood hotspots
- `public/geojson/chennai-flood-2020-hotspots.geojson` - 53 flood hotspots
- `public/geojson/chennai-drainage.geojson` - 10,308 drainage lines
- `public/geojson/chennai-sewerage.geojson` - 4,190 sewerage features
- `public/data/river-quality.json` - river monitoring station locations
- `public/geojson/chennai-industrial-zones.geojson` - 218 industrial zone polygons

**Determinism:** No Supabase dependency. No `computed_at` field. Identical inputs produce byte-identical output. Deterministic ordering: wards by number, top_bodies by score (then name for ties), lost_bodies.names alphabetically. CI reruns the script and `git diff --exit-code` catches stale profiles.

**Known limitations:**
- Centroid attribution assigns each feature to exactly one ward - cross-ward features are counted in one ward only
- Counts only, no derived areas or lengths (centroid attribution makes area/length calculations misleading)
- To regenerate: `npx tsx scripts/compute-ward-profiles.ts`

## AI-Generated Narratives - Anthropic Claude API

| | |
|---|---|
| **Source** | [Anthropic Claude API](https://docs.anthropic.com/) |
| **Method** | Script: `scripts/generate-narratives.ts` (reads Supabase live data + ward profiles, calls Claude API) |
| **Frequency** | City narrative: daily (after post-scrape pipeline). Ward narratives: monthly (IST days 1-3) |
| **Coverage** | 1 city-level narrative + 200 ward-level narratives |
| **Models** | Claude Sonnet (city narrative), Claude Haiku (ward narratives, batched 5 wards per API call) |
| **Tables** | `daily_briefing` (AI columns: `ai_headline_en/ta`, `ai_body_en/ta`, `ai_source_dates`, `ai_model`), `ward_narrative` (full table) |
| **Cost** | ~$0.75/month |

**City narrative context includes:**
- Reservoir storage %, days-left estimates (3 scenarios), average inflow
- Ward risk distribution (low/moderate/high/critical counts)
- Alerts from daily briefing
- Source data freshness dates

**Ward narrative context includes:**
- Ward profile data (water bodies, flood hazard, drainage, sewerage, river proximity)
- Live groundwater depth and trend (from `groundwater_monthly`)
- Risk score and level (from `ward_risk_score`)
- Ward locality name (from `groundwater_monthly.ward_name`, not zone name)

**Output format:**
- Bilingual: English + Tamil (translated naturally, not literally)
- City: headline + 3-5 bullet points
- Ward: headline + 2-3 sentence body + 2-3 key facts
- Source date freshness tracked per narrative (reservoir date, groundwater period, risk date)

**IST day gating:**
- Daily job exits on IST days 1-3 (monthly job handles city narrative on those days)
- Prevents race conditions between daily and monthly city narrative writes
- `--monthly` flag generates both ward (200 wards) and city narratives

**Known limitations:**
- Ward names come from `groundwater_monthly.ward_name` - wards without groundwater data fall back to zone name from `ward-profiles.json`
- Haiku occasionally wraps JSON output in markdown code fences; stripped by `stripCodeFences()` before parsing
- Tamil translations are AI-generated and may vary in quality; reviewed periodically
- To regenerate: `npx tsx scripts/generate-narratives.ts` (city only) or `npx tsx scripts/generate-narratives.ts --monthly` (all)
- Requires `ANTHROPIC_API_KEY` environment variable

## Reservoir Metadata

| | |
|---|---|
| **Source** | Manually curated from CMWSSB and public records |
| **Table** | `reservoir_meta` |
| **Fields** | Display name, full capacity (mcft), latitude, longitude |

**Total system capacity:** 14,096 mcft across 6 reservoirs.

| Reservoir | Capacity (mcft) |
|-----------|----------------|
| Poondi | 3,231 |
| Cholavaram | 881 |
| Red Hills (Puzhal) | 3,300 |
| Chembarambakkam | 3,645 |
| Veeranam | 1,465 |
| Kannankottai (Thervoikandigai) | 1,574 |

## Historical Seeding

For initial database population, seed scripts in `scripts/` import from:

- **Kaggle** (`seed-kaggle.ts`) -Monthly reservoir storage 2004–2024
- **OpenCity** (`seed-opencity-groundwater.ts`) -Ward groundwater 2021–2024
- **OpenCity** (`seed-opencity-lakes.ts`) -Historical lake-level readings

These are one-time imports; daily pipeline keeps data current after seeding.

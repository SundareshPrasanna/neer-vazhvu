# Data Sources

> Where each dataset comes from, how often it refreshes, and what to watch out for.

## Reservoir Levels — CMWSSB

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
- Page format changes without notice — scraper needs periodic updates
- Data may not update on weekends or public holidays
- Inflow/outflow fields were added later; pre-2022 records have nulls for these
- Occasional duplicate or stale rows when CMWSSB delays their update

## Weather — NASA POWER

| | |
|---|---|
| **Source** | [NASA POWER API](https://power.larc.nasa.gov/) (Prediction Of Worldwide Energy Resources) |
| **Method** | REST API (`/api/temporal/daily/point`) |
| **Frequency** | Daily (5-day backfill window, 2-day data lag) |
| **Coverage** | Single point: Chennai (13.0827°N, 80.2707°E) |
| **Fields** | Precipitation (mm), temperature max/min (°C), relative humidity (%) |
| **Table** | `weather_daily` |
| **Historical** | Available back to 1981 |

**Known limitations:**
- 2-day lag on data availability (today's weather appears day after tomorrow)
- Single point for all of Chennai — no ward-level granularity
- Satellite-derived precipitation can differ from ground-station readings
- Free tier has rate limits (undocumented but generally generous)

## Groundwater — OpenCity Chennai

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
- Not all wards report every month — coverage varies
- Measurement methodology may differ across wards
- New year datasets require adding the resource ID to the scraper config

## River Water Quality — CPCB

| | |
|---|---|
| **Source** | [CPCB National Water Monitoring Programme](https://cpcb.nic.in/nwmp-data/) — "Status of Water Quality in India" annual reports |
| **Method** | Manual curation (PDF/Excel → JSON) |
| **Frequency** | Annual (refreshed when CPCB publishes the next report, typically Jan–Mar) |
| **Coverage** | 4 rivers: Cooum, Adyar, Buckingham Canal, Kosasthalaiyar — 10 monitoring stations total |
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
- CPCB reports are published as PDFs — no programmatic API; data must be extracted manually
- Monitoring station locations and frequencies can change between annual reports
- Pre-2015 data is sparse for smaller rivers (Buckingham Canal, Kosasthalaiyar)
- The overall `status` field is a judgement call for the river reach, not a single measurement
- To update: download the latest CPCB report, update `readings` in `river-quality.json`, bump `last_updated` and `data_year_range`, commit `data: update river quality readings to {year}`

## River Geometry — OpenStreetMap

| | |
|---|---|
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via [Overpass API](https://overpass-api.de/) |
| **Method** | Script: `scripts/fetch-rivers-osm.ts` (run once, re-run after major OSM edits) |
| **Frequency** | One-time fetch; re-run manually if OSM geometry improves |
| **Coverage** | 4 rivers clipped to Chennai city bbox (12.75–13.35°N, 80.0–80.35°E) |
| **Fields** | MultiLineString geometry (way coordinate arrays grouped by river name tag) |
| **File** | `public/geojson/chennai-rivers.geojson` (static GeoJSON, ~200 KB) |

**Known limitations:**
- OSM river way coverage varies — some urban stretches may be missing or misaligned
- The Buckingham Canal is a national waterway; bbox clipping limits it to the Chennai stretch (~72 km)
- Run `npx tsx scripts/fetch-rivers-osm.ts` to regenerate after OSM data improves

## Industrial Pollution Sources — NGT / TNPCB / CPCB

| | |
|---|---|
| **Source** | NGT Southern Bench orders (2017–2022); TNPCB consent records and enforcement reports; CPCB industrial discharge monitoring; academic studies (Global NEST Journal, Springer Nature); The Wire; Carbon Copy |
| **Method** | Manual curation (PDF court orders, enforcement records, published studies → JSON) |
| **Frequency** | Static dataset (updated when major new NGT orders or incidents are documented) |
| **Coverage** | 7 major industrial facilities in north Chennai / Ennore-Manali corridor: NCTPS, CPCL, Kamarajar Port, SIPCOT Manali, MFL, TPL, Ennore Creek Discharge Zone |
| **Fields** | Facility name (English + Tamil), type, coordinates, operator, rivers affected, pollutant types, incident records (date, volume, source), NGT order summaries |
| **File** | `public/data/industrial-sources.json` (static, served directly from Next.js `public/`) |

**Key evidence sources:**
- NGT Southern Bench, Sept 2017: Expert committee findings on NCTPS fly ash — heavy metals (Cd, Hg, Cr, Cu, Mn, Se, Pb, Ni) in Seppakkam village borewells; 5.67 million tonnes ash deposited over 3.51 km²
- TNPCB enforcement records, Dec 2023: CPCL Cyclone Michaung spill — 517 tonnes of oil into Buckingham Canal and Ennore Creek; ₹74 crore compensation demanded
- Indian Coast Guard / Wikipedia: 2017 Ennore oil spill — BW Maple × Dawn Kanchipuram collision; ~75–196 tonnes bunker fuel; 25 miles of coastline affected
- Global NEST Journal (2025): Heavy metal contamination in Ennore ecosystem sediments (16 parameters)
- Springer Nature (2025): Microplastics in Kosasthalaiyar estuary

**Known limitations:**
- Incident descriptions summarised from primary sources; exact volumes are estimates in many cases
- TNPCB consent records are not publicly searchable by facility — some data inferred from secondary sources
- Coordinates represent facility centroid, not specific discharge points
- To update: verify new NGT orders via egriwas.nic.in or TNPCB press releases; add new `incidents` entries and update `ngt_orders` array in `industrial-sources.json`

## Industrial Zone Geometry — OpenStreetMap

| | |
|---|---|
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via [Overpass API](https://overpass-api.de/) |
| **Method** | Script: `scripts/fetch-industrial-zones-osm.ts` (run once, re-run after major OSM edits) |
| **Frequency** | One-time fetch; re-run manually if OSM industrial zone coverage improves |
| **Coverage** | North Chennai industrial corridor (bbox: 13.0–13.4°N, 80.1–80.4°E) |
| **Fields** | Polygon geometry for `landuse=industrial` ways and relations; properties: `osm_id`, `name`, `area_ha` |
| **File** | `public/geojson/chennai-industrial-zones.geojson` (static GeoJSON, filtered to area > 5 ha) |

**Known limitations:**
- OSM industrial zone coverage varies — some facilities may be partially mapped or missing
- Run `npx tsx scripts/fetch-industrial-zones-osm.ts` to regenerate after OSM data improves

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

- **Kaggle** (`seed-kaggle.ts`) — Monthly reservoir storage 2004–2024
- **OpenCity** (`seed-opencity-groundwater.ts`) — Ward groundwater 2021–2024
- **OpenCity** (`seed-opencity-lakes.ts`) — Historical lake-level readings

These are one-time imports; daily pipeline keeps data current after seeding.

# Jaipur - Features

The platform's first Rajasthan city, built in October 2026 on branch `jaipur-city` and not live yet
(`enabled: false`). Sources behind each surface: `data-sources.md`.

## What kind of city this is

Jaipur drinks a dam it shares, about 120 km away, and pumps an aquifer far past what the rain puts
back. The state's Public Health Engineering Department (PHED), not Nagar Nigam Jaipur, runs the
water: 766.73 MLD on 31 December 2025, 590 from Bisalpur dam on the Banas and 176 from 3,633 PHED
tube wells (PHED Annual Progress Report 2025-26, printed p.85). A year earlier Bisalpur gave 492.08;
the whole rise came from the dam. Bisalpur also supplies Ajmer, Tonk and irrigation, and no order
fixes the city's share, so the dashboard opens on the supply chain, not a days-left figure.
Ramgarh, the city's old reservoir, held nothing on 8 October 2026 or on the same date in 2025,
when the state's dams were 90.38% full.

Under the city, IN-GRES assesses a unit of its own, Jaipur Urban, at 349.88% in 2025-2026, the
highest of the district's 16 units, all of them over-exploited. The city's own river, the
Dravyavati, has no published water-quality readings on its channel. Floods come from rain on the
city, not from a river in spate.

## Built surfaces

Each row's artifact is built and its route is on in `src/cities/jaipur/config.ts`.

| Route | Renderer | What it shows |
|---|---|---|
| `/jaipur` | `heroMode: 'cauvery-pumping'` (the supply-overview hero) | PHED's production by source (status 31 December 2025) and the chain from Bisalpur through Surajpura and Balawala to 590,385 connections; about an hour of supply a day in most zones (PHED schedule, 15 April 2024); the June 2025 tanker peak. Two reservoir cards from the Water Resources Department's report: Bisalpur, labelled shared, as % of designed gross capacity, and Ramgarh, empty. Storage history in TMC: the state report from 16 June 2023, with CWC weekly points for Bisalpur before it, once written to the database (see Launch state). IMD gridded rainfall with Open-Meteo's provisional fill. Four key findings (the facts flagged featured or tier 1) |
| `/jaipur/groundwater` | shared block choropleth + station overlay | 16 IN-GRES units on IN-GRES's own 2021 polygons, five editions 2021-2022 to 2025-2026, all over-exploited; Jaipur Urban 349.88%, the undivided district 210.41%. 148 NWDP telemetry wells (108 Rajasthan Ground Water Department, 40 CGWB), 16 in Jaipur Urban, monthly means from January 2021 |
| `/jaipur/rivers` | shared `RiversClient` | The Dravyavati (default; JDA's 47.50 km; CPCB 2952 at Newta dam shown as indirect, with no marker), the Dhund (Kanota, 4781, 2021 only), the Banas (Bisalpur, 2951, 2018-2024) and the Banganga (Ramgarh, no station). CPCB annual minimum and maximum, 2018-2024; the three polluted-stretch editions, each dated |
| `/jaipur/flood-risk` | shared narrative stack (`flood: { variant: 'narrative' }`) | The district plan's wording, five events (2025, 2024, 2020, 2012, 1981) from IMD and the state's plans, seven places to look, seven stated gaps. No trigger, no map, no damage figures (none official) |
| `/jaipur/water-bodies` | shared map | 36 OpenStreetMap polygons in a box wider than the corporation, so Ramgarh, Kanota, Nevta and Chandlai are on it; three of them are not lakes (the Amanishah Nala polygon, a building-material pit, a fountain) and are named as such on the About page |
| `/jaipur/lake-restoration` | shared | 8 flagship water bodies (4 graded V, 4 N), 7 programmes, 7 court and tribunal orders from 2004 to August 2026; storage of 8 October 2026 |
| `/jaipur/my-ward` | shared, ward-table mode (`wardsVintage: null`) | 150 wards from the LSG notification of 16 September 2025: zone (13), assembly seat (10), population (3,197,135 in all), zone office lines and emails for the 8 zones that publish them. PHED, Nagar Nigam, Rajasthan Sampark (181) and 1077 contacts. No map, no per-ward layers; Report Card and Compare are hidden |
| `/jaipur/commitments` | shared register | 21 commitments: 4 delivered, 4 overdue, 13 unverified, each status cited |
| `/jaipur/facts` | shared (static) | 16 cards read from the artifacts or their cited documents, one a gap card (sewage generated) |
| `/jaipur/origins` | shared story | 8 chapters, from the wells of the walled city to Bisalpur and the aquifer; 8 licence-checked plates (`public/images/story/jaipur/MANIFEST.json`). English only |
| `/jaipur/about` | shared frame; Jaipur fills `pages-1` and `data-sources-1` from `src/cities/jaipur/about*.tsx` | What each page shows, with its gaps, and every source in eight groups of the city's own |

## Off, with reasons (`src/cities/jaipur/routes-off.ts`, read by `scripts/lib/exemptions.ts`)

- **`allocations`.** No public order states Jaipur's share of Bisalpur. A Water Resources
  Department study (February 2020) describes 11.1 TMC a year for Jaipur and its pipeline villages,
  5.1 TMC for Ajmer and about 8 TMC for irrigation, but that is a description, not an order, and an
  entitled-versus-received ledger cannot be drawn without one. PHED's draw by source is on the
  dashboard.
- **`tanker`.** PHED publishes summer totals for the city (230 tankers making 1,283 trips a day at
  the June 2025 peak) but no register by area, month or price. The totals are on the dashboard.
- **`shoreline`.** Landlocked.
- **`climate-risk`.** Not built. The state's only climate plan (SAPCC 1.0, 2014) gives state-wide
  projections, and the sub-basin risk surface has not been run for the Banas or the Banganga.

## Off inside the routes that ship (`src/cities/jaipur/config.ts`)

| Where | Off | Why |
|---|---|---|
| Dashboard | days-left runway (`defaultConsumptionMld: null`) | Bisalpur is shared and the city's share is not set by any order found; a runway would credit the city with Ajmer's, Tonk's and farmers' water |
| Dashboard | treatment capacity | PHED's 200 MLD Surajpura plant is one stage; no primary source gives the whole works' capacity |
| Dashboard | non-revenue water | No city-wide figure since JICA's 37% for 2015, which JICA flags as likely unreliable; PHED gives figures only for its trial areas |
| Groundwater | ward depth surface (`depth: false`) | Shallow and deep piezometers stand side by side (Durgapura about 8 m, Mansarovar about 42 m) |
| Groundwater | risk composite and stress overlay (`risk`, `iisc`) | Not built for this city |
| Water bodies | census source, ranking, ward search, lost bodies, ground-height bands | No city lake register; the first census recorded no urban water body in the district; no ward geometry to search by; bands not built |
| Water bodies | catchment and cascade view (`hasCatchments: false`) | Not built yet: the cascade pipeline has not been run for Jaipur. Backlog, not a reasoned absence |
| Rivers | treatment-plant discharge panel (`hasTreatmentDischarge: false`) | No published sewage-plant outlet series: CPCB's 2024 drains and plants table has no Rajasthan rows, and RSPCB publishes sample counts only |
| Rivers | marker for CPCB 2952 | CPCB's coordinate is at Kanota dam, while RSPCB maps Nevta south-west of the city |
| Flood risk | trigger, dam-release threshold, map | No CWC gauge in the district, no numeric trigger in the district plan, no drain design rainfall, no published flood map or waterlogging list |
| My Ward | map, per-ward layers, Report Card, Compare | The official 2025 ward map is a raster without coordinates; no vector is published |
| Language | Hindi (`upcomingLanguages: ['hi']`) | The city name is localised; no translation pass has run |

## Refresh homes

| Layer | How it refreshes |
|---|---|
| Reservoir cards and history | Daily, from the maintainers' scheduled local job: `scrape_rajasthan_wrd_dams.py --artifact --supabase`, then `--backfill-from` seven days back, so a late upload or a missed day fills in on the next run. The portal's list interface and the PDFs sit on the Rajasthan state data centre and were not tested from GitHub's runners. The publisher posts off-season reports on the 1st and 16th, often weeks late, so from mid-October to mid-June the cards can be weeks old by the publisher's own cadence; no freshness check is registered for the file yet |
| Rainfall | IMD gridded base: quarterly, `imd-rainfall-refresh.yml` (`generate_imd_rainfall.py --city jaipur`; the city is picked up from `pipeline.json`). Provisional months: daily, `rainfall-recent-refresh.yml` (`fetch_recent_rainfall.py --all`) |
| Groundwater telemetry | By hand today: `build_nwdp_gw_stations.py --city jaipur` after `build_ingres_gwr.py --city jaipur`, whose unit polygons place the wells. The portal answers GitHub's runners, but no workflow runs the builder yet |
| Groundwater assessment | By hand on a new IN-GRES edition: `build_ingres_gwr.py --city jaipur` |
| Everything else | Edition-driven: the Headwaters registry reviews each upstream every 60 to 180 days and opens an issue when a new edition appears. Supply: `build_jaipur_supply.py` (each January's PHED report); commitments, restoration and flagship files: `build_curated.py <family> --city jaipur`; river quality: `build_jaipur_river_quality.py` from `pipeline-inputs/jaipur/`; wards: `build_jaipur_ward_table.py`; facts last: `build_jaipur_facts.py` |

## Launch state

Not live. As of 21 October 2026 every route above is built on `jaipur-city`. Still to do before the
switch-on, per `docs/cities/ADDING-A-CITY.md`: the data-repo release and its `corpus.lock` pin; the
city's seed and water-source migrations applied; the state report's history (16 June 2023 to 8
October 2026, 265 dates per dam, read on 21 October 2026 but not yet written) and the CWC weekly
Bisalpur points written to `reservoir_daily_v2`, insert-only; the local job's daily step; a browser
sweep (`check-city-surfaces.py --city jaipur --control bangalore`); and every review-gated label
read for wording that would be untrue on a live page.

Outreach the owner may choose to make (nothing sent): PHED for the Bisalpur allocation order, the
whole system's draw, a city loss figure and a ward-to-division map; Nagar Nigam Jaipur or LSG for
the 2025 ward shapefile; RSPCB or CPCB for where station 2952 is sampled; CGWB for the final Jaipur
Urban aquifer report.

# Visakhapatnam - Features

City twelve and the first in Andhra Pradesh, live since 16 October 2026. Sources behind each
surface: `data-sources.md`. Measured depth against Chennai and Bengaluru: `parity-scorecard.md`.

## What kind of city this is

A port with no large perennial river of its own (CGWB: "No major river/perennial rivers"). The
harbour was dug at the mouth of a gedda, one of the hill streams that cross the city, and the
city's largest source arrives by canal. About 380 MLD is available from nine sources (GVMC's
figures; CGWB's tables carry the same quantities unchanged since its June 2022 report, which said
GVMC was able to draw 345.5 MLD). The largest is the Godavari and Yeleru system, at 182 to 204 MLD,
which CGWB lists at 190 km from the city; that is a distance to the source, not the length of the
route. Two lifts bring Godavari water in: VIWSCO's Kateru pump house, through a 56 km pipeline to
the Yeleru canal (December 2004), and the Purushottapatnam lift, through the Polavaram Left Main
Canal into Yeleru reservoir (since July 2018). The canal is about 150 km in the draft Green City
Action Plan, 156 km on GVMC's 2021 sheet and 152.3 km in VIWSCO's network. It was built first for
the steel plant and is still shared with it, NTPC, APIIC's industrial parks, rural water supply and
the port. On 11 March 2021, the only day for which I have found GVMC's split, about 46% of the
canal's tail-end water went to the city and 39% to the steel plant.

Every reservoir behind the city except Mudasarlova is shared (irrigation, industry and the city
draw on the same storage), and the two lifts top the system up from the Godavari, so a
days-of-water-left runway computed from storage would overstate what is the city's to drink. The
dashboard opens on the supply chain instead. Floods come from cyclones and deep depressions over a
city of hills and narrow valleys, drained by geddas to the harbour and the beach, not from a large
river. The coast is mostly steady, sheltered by hills and headlands, with four stretches classed
Low Erosion.

## Shipped surfaces

| Route | Renderer | What it shows |
|---|---|---|
| `/visakhapatnam` | `heroMode: 'cauvery-pumping'` (the supply-overview hero) | Headline: "A port with no large river, drawing on the Godavari and Yeleru from up to 190 km away". GVMC's nine sources as CGWB prints them (about 380 MLD available; the same quantities since CGWB's June 2022 report, which said GVMC was able to draw 345.5 MLD; the artifact also records, in a note the page does not display, the 334.03 MLD present supply in the Chief Secretary's report of 10.07.2024 in NGT Principal Bench OA 606/2018, Annexure-VI, and lists that report in its sources); the canal's tail-end split from GVMC's 11 March 2021 sheet; treatment capacity and litres a person from the draft Green City Action Plan. Six reservoir cards: Yeleru, Raiwada, Thatipudi and Meghadrigedda on APWRIMS daily live storage, Mudasarlova and Gambheeram with no feed, each card saying why. Storage history (three years by default; the archive reaches 2012; 16,098 readings at cutover). Thatipudi and Raiwada carry two level records from late 2021 to 7 March 2024, which show as one-day jumps and an overnight step on 8 March 2024; the chart note and the About page's Data quality say so. IMD gridded rainfall, with Open-Meteo filling the months after IMD's last |
| `/visakhapatnam/groundwater` | shared mandal choropleth + well overlay | 11 IN-GRES mandals on IN-GRES's own polygons, editions 2023-24 to 2025-26 (the map colours the 2025-26 IN-GRES edition, newer than CGWB's December 2025 report; 2024-25 matches CGWB's Dynamic Ground Water Resources of Andhra Pradesh 2025 for these mandals); wells from APWRIMS recorders and the AP Ground Water Department's manual monthly record, as monthly mean depth below ground, recorders and manual wells kept as separate series |
| `/visakhapatnam/water-bodies` | shared map | 1,088 OpenStreetMap polygons (212 named) over GVMC and about 5 km around it; ground-height bands from FABDEM with the sea removed |
| `/visakhapatnam/rivers` | shared `RiversClient` | Three channels drawn from OpenStreetMap: the Meghadri Gedda, the Gosthani and the Yeleru Left Main Canal, whose panel calls it a supply canal, not a river. No river tally in the header. Four CPCB station markers on them (the Meghadrigedda and Thatipudi reservoirs, the Naval Dockyard creek and the canal near Pharma City). Clicking a channel opens its panel (the Meghadri Gedda's opens on load): a status badge worked out from the latest readings at its stations, a CPCB class tile reading "Not assessed", CPCB's annual minimum and maximum readings at its stations, 2019-2024; APPCB's COMAPS annual averages where the Meghadri Gedda and the Gosthani meet the sea, and its March 2025 samples on all three, quoted as text in the notes; and the dated official events on that channel, six in all (four on the Meghadri Gedda, one each on the Gosthani and the canal). Two more markers, the steel plant's recommended marine outfall point and the JN Pharma City CETP, show a name and type on hover and open no panel. CETP compliance counts from APPCB's consent orders, committee minutes and reports to the NGT are published as data (`cetp-compliance-visakhapatnam.json`) but not shown on the page, because the shared compliance card is written for Surat's per-sample record |
| `/visakhapatnam/flood-risk` | shared narrative stack (`flood: { variant: 'narrative' }`) | A dated record of six events, each credited to its own source: IMD's RSMC reports for the five cyclones and depressions, the Government of Andhra Pradesh's flood memorandum for the 2024 rain; three channels as OpenStreetMap maps them (the Meghadri Gedda, the Gosthani and the Yeleru supply canal); where to look during an event; the gaps, stated |
| `/visakhapatnam/shoreline` | shared coastal client | 476 transects (421 reliable) measured from Landsat and Sentinel-2, 1990-2026, from Appikonda to Pedda Nagamayyapalem, just north of Bheemunipatnam; 8 zones over 53.3 km: four carry the Low Erosion class from the MoES reply of December 2024 (in zone II, at Yarada only), and four are not on that reply's list of erosion-prone stretches and rest on NCCR's 1990-2016 assessment, which gives only a district total; harbour basins left out and low-confidence transects marked; no hotspot file |
| `/visakhapatnam/lake-restoration` | shared | 5 flagship cards (Mudasarlova, Meghadrigedda, Kondakarla Ava, the Kanithi balancing reservoir, Gambheeram) and the 11 GVMC water-body projects in MoHUA's AMRUT 2.0 list of 5 March 2026; no court orders found to the file's standard. No list of lost tanks is shown: I have not found a published official one |
| `/visakhapatnam/allocations` | shared register | Documented claims on the raw water, each with its instrument: the Polavaram share (three official figures, all shown), the Yeleru and Godavari allocations, each reservoir's share, the steel plant, NTPC, APIIC, the port and HPCL. The delivered side is mostly one dated sheet (11 March 2021). Orders cited but not found are named as gaps; future claims (Polavaram water through the Left Main Canal, data-centre campuses, a new steel plant) are listed apart. Press appears only beside the latest official figure and is named as press |
| `/visakhapatnam/commitments` | shared register | Dated promises, mostly about sewage, from GVMC's and the state's filings to the NGT and the High Court's committee, the AP High Court's orders and MoHUA's AMRUT 2.0 lists. APPCB's reports are cited for dated status, and the draft Green City Action Plan for context only; the draft's 2034 water-loss target has no row because a draft is not a commitment. A status changes only against a dated document |
| `/visakhapatnam/facts` | shared `FactsPage` (static snapshot) | Cards grouped by category: supply and the shared canal, sewage, reservoir storage, groundwater by mandal, water quality on the creeks and the coast, the shoreline, restoration, water bodies, rainfall and governance, with the stated gaps as cards of their own. Each card names its source |
| `/visakhapatnam/origins` | shared story | 8 chapters, from the salt swamp the harbour was dug out of, through the 1903 water works, the port and the army's water, the steel plant and the borrowed Godavari, to Hudhud and the next demand. English only; no images yet, because no archival image has had its licence checked at source |
| `/visakhapatnam/about` | shared About frame; Visakhapatnam fills its slots from `src/content/about/visakhapatnam*.tsx` | The frame's sections, each with the city's own content in place of the defaults. What we track for Visakhapatnam, with the city's own list of the six reservoirs. Reading this dashboard: why there is no days-of-water-left number, then the dashboard card by card. What each page shows for Visakhapatnam: a subsection for each page (dashboard, reservoirs, allocations, commitments, groundwater, rivers, flood risk, shoreline, water bodies, lake restoration, facts and rainfall, origins), then what is not shown, and why. Intelligence & AI narratives: the city has no AI layer yet. Data sources for Visakhapatnam, in eight groups of the city's own (reservoirs and supply, weather and rainfall, groundwater, water bodies and restoration, rivers and pollution, flood and civic infrastructure, satellite and remote sensing, base geometry). Data quality & limitations: how river health is classified and what that means for a city with no CPCB-monitored river stretch, data quality for Visakhapatnam, the city's own known limitations in place of the frame's default list, and where official figures disagree. About the project. No catchment-atlas section, because the city has no catchment view |

## Off, with reasons (`scripts/lib/exemptions.ts`)

- **`my-ward`.** No ward geometry that can be published. The 98-ward boundaries in circulation are
  an Esri India tracing of a GVMC CAD drawing. I have not found a licence anywhere in the chain,
  their zone field disagrees with GVMC's own ward list for 94 of 98 wards, and GVMC notified 120
  wards in 2026 with no map that I have found. Closes when GVMC publishes official ward
  boundaries.
- **`tanker`.** The only tanker figures from GVMC that I have found are for a single day (615 trips
  on 11 March 2021, in an NGT filing). GVMC runs a Dial-a-Tanker line, but I have not found a series
  by day, zone or ward.
- **`climate-risk`.** Buildable but not built: the sub-basin risk layer comes from HydroBASINS,
  which covers the north Andhra coast. Backlog, not a refusal.

## Off inside the routes that ship (`src/cities/visakhapatnam/config.ts`)

| Where | Off | Why |
|---|---|---|
| Groundwater | ward depth surface, ward risk composite | The well sites across eleven mandals are too few to draw a depth map per ward (the counts are in the `_note` of `visakhapatnam-cgwb-stations.json`) |
| Water bodies | encroachment census, restoration ranking, ward search, lost-tank list | OSM polygons with no official register behind them and no ward geometry to search by. No list of lost tanks is shown: I have not found a published official one |
| Water bodies | catchment and cascade view | Not built yet (`hasCatchments: false`): the cascade pipeline has not been run for this city. Backlog, not a reasoned absence |
| Dashboard | days-left runway | The four dams with a feed are all shared with irrigation or industry, and Yeleru is refilled from the Godavari |
| Dashboard | Mudasarlova and Gambheeram readings | Neither is in APWRIMS; each card says so |
| Flood risk | dam-release and rainfall threshold cards | No dam upstream decides the flooding, and I have not found a GVMC drainage design standard to set a trigger by |
| Rivers | header river tally | It would count a gedda and a canal as rivers |
| Language | Telugu | The `te` dictionary is not populated and must be translated by a native speaker; the chip shows as coming soon and the UI stays in English |

## Launch state

Live since 16 October 2026 (`enabled: true`, `059_visakhapatnam_enable.sql`). At cutover:

- Twelve routes on main (#461), with the data-repo release `corpus-2026-10-16-visakhapatnam`
  (data#93, `958244a0`) pinned in `corpus.lock` at 2044/174 files.
- Migrations 057 (city seed, disabled) and 058 (the six water sources) applied to production on
  16 October 2026. 059 flips the `enabled` column, which no code reads, and is applied after the
  switch-on merges.
- `reservoir_daily_v2` holds the APWRIMS archive from 1 January 2012: 16,098 readings at cutover
  (Yeleru 5,255, Raiwada 3,768, Thatipudi 3,352, Meghadrigedda 3,723), with the readings that fail
  the scraper's checks left out. For Thatipudi from 7 September 2021 and Raiwada from 13 December
  2021, only the level record APWRIMS has carried alone since 8 March 2024 is kept, so both have
  gaps until March 2024.
- The daily refresh runs as step 7 of the local scheduled job (12:00 IST), the same shape as the
  Gujarat dam report's step 6: it re-reads the last 7 days, so a late reading or a missed day fills
  in on the next run, and it commits `visakhapatnam-dam-storage.json`. The provisional rainfall file
  is refreshed with every other city's by the daily rainfall workflow.
- A browser sweep of every route against Bengaluru, in live mode: the twelve routes render, `my-ward`
  and `tanker` return 404 and `climate-risk` shows the shared not-available page, as on other live
  cities without them. The freshness check reads all four reservoir feeds as fresh.
- The 7 commitments that read UNVERIFIED ship labelled unverified, by decision, as Ahmedabad's did.

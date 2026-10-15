# Data Sources - Visakhapatnam

Visakhapatnam is city twelve and the platform's first Andhra Pradesh city (scope `visakhapatnam`,
parent `andhra-pradesh`). The scope is GVMC, the Greater Visakhapatnam Municipal Corporation, which is
both the water utility and the local government. Every upstream is registered in
`scripts/source-registry/visakhapatnam.json`, or in `scripts/source-registry/platform.json` for the
shared imagery, elevation and rainfall feeds. This page is the reading guide: where each source
lives, how it is read, what it allows, and the traps found on the way in. Research pass 2026-10-14;
artifacts built 2026-10-14 and 2026-10-15.

## Licence postures

The registry carries three postures for this city, and one more arrives through the shared feeds.

1. **Restricted, cited with attribution.** I have not found a licence or terms of use on APWRIMS
   or APPCB, and both sites print "All Rights Reserved" in the footer. The data is served openly,
   but it is carried as restricted. APSDMA (footer "Copyrights © 2022 APSDMA. All rights
   reserved.") and VIWSCO's site (footer "Copyright © 2026 VIWSCO") are in the same position.
2. **Government publications, cited with attribution.** CGWB, MoHUA, NWDP, IMD's gridded rainfall
   and its climatological tables, NGT records, the AP High Court's orders, GVMC's own documents,
   NCCR and MoES, the Polavaram Project Authority, CAG, CWC, the Ministry of Jal Shakti, MoEFCC
   and SEIAA clearances, NRSC, NDMA, the Visakhapatnam Port Authority, PIB, the census and
   Parliament's records, and operators' statutory filings. I have not found terms of use, a
   disclaimer or a licence on IN-GRES, and it is cited the same way. Two portals state a
   reproduction policy: the AP Government Orders Issue Register and the MoEFCC Wetlands of India
   portal both allow reproduction free of charge, reproduced accurately and with the source
   acknowledged. Three in this group are stricter: CPCB's website policy allows download but puts
   any other use "subject to the approval of competent authority of CPCB", IMD's RSMC cyclone
   reports may not be reproduced without permission, so only event figures are cited, and INCOIS
   does not permit reproduction for commercial purposes without permission, so it is linked and
   nothing is reproduced.
3. **Open licences.** OpenStreetMap (ODbL, share-alike), Copernicus Sentinel-2 (free and open,
   attribution), Landsat (public domain), Open-Meteo (CC BY 4.0). The 1907 and 1908 gazetteers
   are public domain.
4. **Encumbered.** FABDEM, behind the ground-height bands, is CC BY-NC-SA 4.0: non-commercial and
   share-alike.

World Bank project documents, peer-reviewed papers and the institutions' own history pages and
releases are cited with attribution, for dates and figures only. Licence strings in artifacts
are meant to come only from `registry_license()`.

## The register

| Registry id | Publisher | Where | Access path | Posture | Read | Cadence |
|---|---|---|---|---|---|---|
| `apwrims-reservoirs` | AP Water Resources Department (APWRIMS) | `https://apwrims.ap.gov.in/api/reservoir/timeseries` | Open JSON API, POST, no login; `scrape_apwrims_reservoirs.py` | Restricted | 2026-10-14 | Daily |
| `apwrims-groundwater` | AP Water Resources Department (APWRIMS sensors) | `https://apwrims2.0.vassarlabs.com/iot/api/groundwater/` | Open JSON API (station list, daily series) plus the archive at `apwrims.ap.gov.in/api/v2/gw/gwReport`, and the mandal layer `APWRIMS:AP_MANDAL_V3` from `https://geo.vassarlabs.com/geoserver/APWRIMS/ows`; `build_apwrims_gw_stations.py` | Restricted | 2026-10-15 | Daily |
| `apwrims-mi-tanks` | AP Water Resources Department (minor-irrigation tank layer) | `https://apwrims.ap.gov.in/geoserver-vassar/ows`, layer `APWRIMS:apmitanks_withmapping_31021nos_11122023` | WFS; read by hand for one record | Restricted | 2026-10-14 | Irregular |
| `ingres-groundwater-andhra` | IN-GRES (CGWB and the AP Ground Water and Water Audit Department), IIT Hyderabad | `https://ingres.iith.ac.in/` | Assessment API plus the GeoServer WFS; `build_ingres_gwr.py --city visakhapatnam` | Government, attributed | 2026-10-15 | Yearly |
| `nwic-nwdp-groundwater-andhra` | National Water Informatics Centre (National Water Data Portal) | `https://nwdp.nwic.gov.in/` | CKAN datastore API: the manual monthly resource, plus two telemetry resources read only to check which recorder is which; `build_apwrims_gw_stations.py` | Government, reproduction allowed with acknowledgement | 2026-10-15 | Continuous |
| `imd-gridded-rainfall-visakhapatnam` | India Meteorological Department (0.25 degree grid) | `https://imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html` | `imdlib`; `generate_imd_rainfall.py --city visakhapatnam` on the quarterly workflow | Government, attributed | 2026-10-15 | Yearly |
| `imd-gridded-rain`, `open-meteo-archive` (platform) | IMD; Open-Meteo | `https://www.imdpune.gov.in/`; `https://open-meteo.com/` | `fetch_recent_rainfall.py`, daily | Government; CC BY 4.0 | 2026-10-14 | Daily |
| `osm-visakhapatnam-water` | OpenStreetMap contributors | `https://overpass-api.de/api/interpreter` | `fetch-osm-layers.ts --city visakhapatnam` (rules in `scripts/osm-layers/visakhapatnam.json`) | ODbL | 2026-10-14 | Continuous |
| `osm-overpass` (platform) | OpenStreetMap contributors | Overpass | Coastline, breakwaters and river mouths, fetched live by `scripts/build-visakhapatnam-coastal-seed.py` | ODbL | 2026-10-15 | Continuous |
| `cpcb-nwmp-visakhapatnam` | CPCB, National Water Quality Monitoring Programme | `https://cpcb.gov.in/nwmp-data-2024/` | Annual PDF tables, 2019-2024 editions, transcribed with page numbers; `build_visakhapatnam_water_quality.py` | Government, permission needed beyond download | 2026-10-14 | Yearly |
| `appcb-coastal-monitoring` | AP Pollution Control Board (COMAPS and NWMP tables) | `https://pcb.ap.gov.in/PCBLive/PCB/QualityMonitoring` | Monthly and annual PDFs, by hand | Restricted | 2026-10-14 | Monthly |
| `appcb-consents-directions-visakhapatnam` | AP Pollution Control Board (consent orders, CTO committee agendas and minutes, directions orders, CETP status statements) | `https://pcb.ap.gov.in/` (documents under `APPCBDOCS`) | PDFs, by hand; `build_visakhapatnam_water_quality.py` | Restricted | 2026-10-15 | Irregular |
| `industry-ec-compliance-visakhapatnam` | Operators' statutory filings (RINL, HPCL, Visakhapatnam Port Authority) and the Visakha Pharmacity operator's website | `https://www.vizagsteel.com/` and the other operators' sites | PDFs and web pages, by hand | Attributed | 2026-10-15 | Half-yearly |
| `ngt-andhra-filings` | National Green Tribunal (filings by GVMC, APPCB, CPCB and the state) | `https://www.greentribunal.gov.in/news-update` | PDFs, several of them scanned images | Government, attributed | 2026-10-14 | Irregular |
| `gvmc-whats-new` | GVMC | `https://www.gvmc.gov.in/wss/WhatsNewAll.htm` | PDF listing, watched as a link set | Government, attributed | 2026-10-14 | Irregular |
| `mohua-amrut-status-ap` | Ministry of Housing and Urban Affairs (AMRUT 2.0) | `https://amrut.mohua.gov.in/assets/Status-of-Approved-Projects-under-AMRUT-2-in-Andhra-Pradesh-as-on-05-03-2026_.pdf` | PDF plus the live project list | Government, attributed | 2026-10-14 | Irregular |
| `cgwb-visakhapatnam-aquifer-plans` | CGWB, State Unit Office Visakhapatnam | `https://cgwb.gov.in/cgwbpnm/public/uploads/documents/1750331736769645187file.pdf` | PDF, by hand | Government, attributed | 2026-10-14 | Irregular |
| `nccr-shoreline-assessment` | National Centre for Coastal Research, MoES | `https://www.nccr.gov.in/sites/default/files/schangenew.pdf` | PDF, plus the MoES Lok Sabha reply (USQ 2638), the PIB release of 31 March 2022 and the Rajya Sabha reply (USQ 498), all read from the Wayback Machine | Government, attributed | 2026-10-14 | Irregular |
| `ppa-polavaram` | Polavaram Project Authority | `https://ppa.gov.in/WPSCore/Common/WebPages/Home/AboutProject.aspx` | Web page | Government, attributed | 2026-10-14 | Irregular |
| `imd-rsmc-cyclone-reports` | IMD, RSMC New Delhi | `https://rsmcnewdelhi.imd.gov.in/` | Per-event PDF reports; figures only | Government, no reproduction | 2026-10-14 | Per event |
| `seiaa-ap-clearances` | SEIAA Andhra Pradesh, via PARIVESH | `https://parivesh.nic.in/` | Clearance letters; project, date, quantity and source only | Government, attributed | 2026-10-14 | Per clearance |
| `fabdem-dem` (platform) | Fathom / University of Bristol | Google Earth Engine | `build_elevation_bands.py --city visakhapatnam` | Encumbered | 2026-10-14 | Versioned |
| `sentinel-2-l2a`, `usgs-landsat` (platform) | ESA Copernicus; USGS and NASA | Google Earth Engine | `app/gee/coastline.py` via `run_gee_coastline.py`; yearly on `coastal-shoreline-refresh.yml` | Open | 2026-10-14 | Yearly refresh |

**Documents registered as closed or reviewed records.** Every document a Vizag surface cites
that is not one of the feeds above has its own entry, watched by a human-review cadence. For a
closed document the review only confirms the URL still serves it: yearly, or every 180 days where
a newer report or an amendment may follow (CAG's Polavaram audit, the AM/NS clearance). Each
review is recorded in the entry's `lastSeen`, so the checker knows when it is next due. Each
entry's `dependsOn` names the artifacts and content files that cite it.

| Registry id | Document | Used on |
|---|---|---|
| `viwsco-project-pages` | VIWSCO's About and Project Infrastructure pages | Supply overview, allocations, dam-storage note, rivers, origins |
| `apiic-viwsco-note-2009` | APIIC's VIWSCO project note (Aug 2009) | Allocations |
| `cwc-nrld-2019` | CWC National Register of Large Dams 2019 | Allocations, supply overview, water-body cards, origins, city config |
| `ap-wrd-project-pages-wayback` | AP WRD project pages for Yeleru, Raiwada and Thatipudi (Wayback) | Allocations, origins |
| `cag-polavaram-audit-2025` | CAG Report No. 4 of 2025, Polavaram Irrigation Project | Supply overview, allocations, facts |
| `mojs-dowr-polavaram-note-2024` | Ministry of Jal Shakti note on the Polavaram project (May 2024) | Allocations, facts |
| `moefcc-ec-amns-anakapalli-2026` | MoEFCC clearance for the AM/NS plant at Anakapalli (20 Mar 2026) | Allocations |
| `goap-go-ms-76-2024`, `goap-go-ms-100-2016`, `goap-go-ms-202-2014`, `goap-go-ms-24-2015`, `goap-go-rt-203-2026` | AP government orders on the AM/NS plant, the Purushottapatnam lift, industrial water allotment, VIWSCO's rate and a Yeleru release | Allocations |
| `aphc-wp-pil-248-2020` | AP High Court orders of 12.11.2025 and 11.03.2026 (read as annexed to NGT filings) | Commitments, river events |
| `imd-climatological-tables-visakhapatnam` | IMD Climatological Tables 1991-2020, stations 43149 and 43150 | Rainfall artifact note, facts |
| `gvmc-adb-iee-meghadrigedda-solar-2018` | GVMC's IEE for the Meghadrigedda floating solar plant, for the Asian Development Bank (Oct 2018) | Allocations, supply overview, water-body cards, origins, city config |
| `gvmc-adb-mudasarlova-2018` | GVMC's IEE and resettlement due-diligence report for Mudasarlova, for the Asian Development Bank (Sep and Oct 2018) | Water-body cards, city config |
| `gvmc-adb-iee-24x7-nw-2019` | GVMC's IEE for 24x7 water supply in the North-West sector, for the Asian Development Bank (Jan 2019; draft Mar 2016) | Allocations, river events, water-body cards, rivers, origins |
| `moefcc-wetlands-portal` | MoEFCC Wetlands of India portal | Water-body cards |
| `ap-hpc-lg-polymers-2020` | AP High-Power Committee report on LG Polymers (Jul 2020) | River events, origins |
| `goap-flood-memorandum-2024`, `apsdma-andhra-pradesh` | The state's 2024 flood memorandum and APSDMA | Flood |
| `vmrda-draft-master-plan-2041` | VMRDA draft Master Plan 2041 (June 2021) | Flood, water-body cards |
| `incois-ocean-services` | INCOIS storm surge and ocean state | Flood (linked only) |
| `gvmc-city-disaster-plan-2015`, `gvmc-city-development-plan-2006` | GVMC's 2015 draft disaster plan and its 2006 City Development Plan | Flood, origins, city config |
| `nrsc-flood-hazard-atlas-ap`, `worldbank-ap-disaster-recovery-project`, `ndma-hudhud-lessons-2015` | NRSC's flood hazard atlas, the World Bank's AP recovery project, NDMA's Hudhud lessons | Flood, origins |
| `cwc-coastal-erosion-guidelines-2020`, `vpa-administration-report-2022-23` | CWC/NIO coastal erosion guidelines (Dec 2020) and the VPA Administration Report 2022-23 | Shoreline |
| `historical-gazetteers-visakhapatnam`, `census-handbooks-visakhapatnam`, `parliament-records-visakhapatnam`, `state-legislature-records-visakhapatnam`, `institution-pages-visakhapatnam`, `pib-releases-visakhapatnam`, `research-papers-visakhapatnam` | Gazetteers, census handbooks, Parliament and Assembly records, institutions' own pages, a PIB release and peer-reviewed papers | Origins, water-body cards, allocations, rivers, facts, shoreline transects |
| `gvmc-ward-records`, `goap-go-ms-18-2020` | GVMC's 98-ward map and ward list, and the 2020 order that set 98 wards | City config (the ward gap) |

Covered by an existing entry rather than a new one: the Chief Secretary's report of 10.07.2024
and the other NGT filings, including the joint committee report in Principal Bench OA 175/2018
and the February 2024 progress report in OA 673/2018 (`ngt-andhra-filings`); RINL's 2018 filings
with MoEFCC, its Form V statements, HPCL's compliance report and NTPC's 2021 compliance report
(`industry-ec-compliance-visakhapatnam`); the MoES Lok Sabha reply, the PIB release of 31 March
2022 and Rajya Sabha USQ 498 (`nccr-shoreline-assessment`); CGWB's 2023 report, and the AP
planning department's rainfall normal its 2025 plan cites (`cgwb-visakhapatnam-aquifer-plans`); CGWB's December 2025
assessment report (`ingres-groundwater-andhra`); the polluted river stretch lists
(`cpcb-nwmp-visakhapatnam`); MoHUA's live AMRUT list (`mohua-amrut-status-ap`); and CWC's weekly
reservoir bulletin, used only as a cross-check on Yeleru, under the national
`cwc-reservoir-bulletin-archive` in `mumbai.json`. Press reports are named as press where they
appear and are not registered.

Host traps that apply across the list: the bare `gvmc.gov.in` does not resolve (use `www.`), and
GVMC answers HEAD with 405, so watchers poll with GET; `www.cgwb.gov.in` fails TLS, while the bare
`cgwb.gov.in` works; `appcb.ap.gov.in` does not resolve (use `pcb.ap.gov.in`); `moes.gov.in` returns
404 for the Lok Sabha reply, so it is read from the Wayback copy.

## Supply: a CGWB table carried since 2022, and one day of GVMC's own split

Visakhapatnam has no large perennial river of its own (CGWB: "No major river/perennial rivers").
I have not found a current source-by-source supply table from GVMC itself. The table the dashboard
uses is GVMC's figures as CGWB prints them: the 2025 Aquifer Management Plan for the Visakhapatnam
and Anakapalli urban agglomerations, Table 9.1, introduced "as per the data provided by GVMC". About
380 MLD (83.67 MGD) is available from nine sources, with the Godavari and Yeleru system the largest
row at 182 to 204 MLD. CGWB gives that system one row; I have not found a figure that splits its
share between the two rivers. The dashboard's headline is "A port with no large river, drawing on
the Godavari and Yeleru from up to 190 km away".

Two lifts bring Godavari water into the system: VIWSCO's Kateru pump house, through a 56 km
pipeline to the Yeleru canal (commissioned December 2004), and the Purushottapatnam lift, through
the Polavaram Left Main Canal into Yeleru reservoir (since July 2018, per CAG Report 4 of 2025).

**Trap: the table is not new in 2025.** CGWB's June 2022 district report (Table 5.1; the "AAP
2020-21" on its title page is CGWB's annual action plan year, and the report covers the old,
undivided district of 43 mandals) and its November 2023 report print the same nine rows, the same
quantities and the same 380 MLD total, so CGWB's tables carry GVMC's quantities unchanged since June
2022. The 2022 report calls 380 the raw water *available* and says GVMC "is able to drawn 345.5 MLD
due to shortage of water from Raiwada reservoir and Gostani River", that is, GVMC was able to draw
345.5 MLD; the 2025 report drops that sentence. So 380 is dated to June 2022 wherever it appears,
and it is never described as what GVMC draws. A later state figure sits beside it: the Chief
Secretary's report in NGT Principal Bench OA 606/2018, dated 10.07.2024 (Annexure-VI, PDF p33),
gives GVMC's present water supply as 334.03 MLD. The supply overview lists that report in its
sources and provenance.

Three smaller traps sit in the same table:

- The rows add to anywhere from 380 to 402 MLD, depending on where in its 182 to 204 range the
  Godavari/Yeleru row is taken. The printed 380 matches the low end, so 182 is carried. Table 9.3
  of the same report gives 391, and the draft Green City Action Plan gives about 395.5.
- The distances change between editions (Raiwada 56 km in 2022 and 2023 and 60 km in 2025,
  Thatipudi 60 and 56, the Gosthani wells 25 and 40), and GVMC's own 2021 sheet gives others
  (Raiwada 76 km, Meghadrigedda 20 km against CGWB 2025's 5 km). The 190 km for Godavari/Yeleru is
  CGWB's listed distance from GVMC to the source, not the length of the journey. The hero's shared
  `transmission_distance_km` field carries it, and the tile's caption calls it CGWB's distance for
  the Godavari/Yeleru source. The Yeleru canal is about 150 km in the draft Green City Action Plan and 156 km on
  GVMC's 2021 sheet (printed against Yeleru reservoir), and VIWSCO gives its conveyance network as
  152.3 km. The sheet's 56 km against the Kateru pump house is the length of
  VIWSCO's pipeline from Kateru to the canal, not a distance from the city.
- The "490 MLD demand against 391 MLD supply" row (23 lakh people at 135 litres a day) is CGWB
  2022's row for 2020, repeated in 2023 and 2025. It is a projection, never shown as current.

**GVMC's own split is one day.** GVMC's "Daily Water Supply" sheet for 11 March 2021 (report of
12 March 2021) is annexed to its action-taken report in NGT OA 14/2021 (SZ), at
`https://www.greentribunal.gov.in/sites/default/files/news_updates/1421_0.pdf`, PDF page 20, as a
scanned image. It is the only source-by-source sheet from GVMC I have found. It gives each source's
normal and present supply in imperial million gallons a day (4.546 million litres each), each
reservoir's allocation per irrigation year, and the canal's tail-end split between the city, the
steel plant, NTPC, APIIC, rural water supply and the port. Two of its columns look like
measurements and are not:

- **The net total is a fixed 0.85 of the gross.** 88.11 MGD normal gives 74.89 net and 76.69
  present gives 65.19 net, exactly 85% both times: a flat 15% deduction, not a measured loss.
- **The litres per person is a ratio over an assumed population.** 101.41 litres a day is the
  domestic share (65.19 net less a 13.88 MGD industrial figure, so 51.31 MGD) divided by an
  assumed 2.30 million people. The 13.88 is itself derived: 70% of the metered bulk supply to
  industry, with raw-water supply first converted to treated at 90%. Neither the net total nor
  the litres per person is presented as a measurement on any page.

The tail-end split prints no unit; it is read as million gallons a day, like the sheet's other
columns, and the dashboard says so.

**APPCB's 2021 drawal figures repeat an older GVMC table.** APPCB's report of 22.07.2021 in
NGT OA 14/2021 (SZ) gives the city's drawal as 41.0 MLD from Meghadrigedda and 26.05 MLD from
Thatipudi. Both are the "Drawl" column of Table 4 in GVMC's environmental examination for the Asian
Development Bank on 24x7 supply in the North-West sector (draft March 2016, final January 2019; its
demand columns are for 2014), so they are not dated to 2021. The rivers page, its dated events and
the Meghadrigedda flagship card say so, and set GVMC's sheet for 11 March 2021 beside them.

**The draft Green City Action Plan** (IFC for GVMC, dated September 2024, posted by GVMC for
comment on 19 October 2024, with suggestions due by 22 October 2024;
`https://www.gvmc.gov.in/WhatsNew/Whats_New_DocOct_658.pdf`) supplies the treatment capacity
(11 plants, 489 MLD) and the 105 to 110 litres a person a day estimate. It is cited as a draft
everywhere, and its targets are described as proposed in the draft, never as GVMC commitments.
Some lines on its supply page (p30) do not agree with each other or with its own annex and are not
repeated.

**Sewage** comes from the Government of Andhra Pradesh's February 2026 affidavit in the same NGT
Principal Bench case: 248 MLD generated (PDF p71), 237 MLD installed and 179 MLD of that capacity
in use (PDF p78), 60% of people on sewers. The 69 MLD gap is generation less capacity in use, not
generation less installed capacity. GVMC's own March 2024 affidavit (NGT OA 40/2024 (SZ)) estimated
generation at 215.05 MLD as 85% of supply at 110 litres a person, a planning factor.

**Non-revenue water.** The draft plan puts water losses at nearly 30% (p30) and at 35% (p72)
without saying how either was measured. I have not found a measured non-revenue water figure for
GVMC, so none is shown, and the commitments register has no row for the draft's 2034 water-loss
target, because a draft is not a commitment.

## Reservoirs: APWRIMS daily, as live storage

APWRIMS, the AP Water Resources Department's portal (built by Vassar Labs), serves daily level,
storage, inflow and outflow for Yeleru, Raiwada, Thatipudi and Meghadrigedda through a public JSON
API with no login, cookies or token. The archive runs from 2012 for Yeleru; Raiwada has most of
2012, nothing in 2013, then runs from October 2014 with no usable values from November 2015 to June
2016; Thatipudi runs from October 2014 and Meghadrigedda from November 2015. Yeleru's record is
near-complete, not complete: some months from 2015 to 2017 are short, and April to June 2017 carry
storage but no level.

APWRIMS publishes **gross** storage in TMC. The platform shows **live** storage, gross less the design
dead storage, floored at zero, which is the convention Pune's feed set. On 8 October 2026 the
scraper's Yeleru live storage (10.89 TMC, 60.67%) matched CWC's weekly bulletin for that date
(0.308 BCM, 60.63%), and CWC's National Register of Large Dams 2019 agrees with APWRIMS's design
capacities for Yeleru, Raiwada and Thatipudi. The register lists Meghadrigedda as "Mehadrigedda"
(AP01MH0042, PDF p59), completed in 1977 and operated and maintained by the Water Resources
Department, with a gross storage of 33,102,000 m3, which is APWRIMS's 1.169 TMC. GVMC's 2018
floating-solar environmental examination says the reservoir was constructed in 1977 and
commissioned in 1979, and describes its surface as owned by GVMC; CGWB lists the source from 1976.
The scraper checks each dam's design values (full level, gross, dead storage and its level) against
APWRIMS on every run and stops on any change.

Traps:

- **A key is not a date.** Single-day requests for 2016 to 2019 return the next morning's reading
  under the requested key; range requests do not. Readings are dated by the IST date of their own
  `levelStorageEventGenTS`.
- **Bad rows look like data.** November 2015 has zero levels beside random storage values; 2020 has
  Yeleru levels filed in feet under a metre field; blank entries appear as exactly 0.0 storage.
  Each is rejected and counted in the artifact.
- **Meghadrigedda's basis changed on 16 September 2026.** Up to 15 September 2026 APWRIMS's
  storage figures for Meghadrigedda were already live storage: they reach 1.04 TMC at full
  reservoir level (31 December 2019, 18.593 m), the design live capacity, where gross storage
  would be 1.169 TMC. From 16 September 2026 the same levels read about 0.13 TMC higher, the dead
  storage (at 14.417 m: 0.102 TMC on 4 September, 0.228 on 23 September). The scraper
  (`published_live_until` in `scrape_apwrims_reservoirs.py`) uses the figures up to 15 September
  as live storage, as published, and writes gross for those days as the published figure plus
  the dead storage. Two readings either side of the change are pinned (0.0807 TMC on 15 September
  at 14.234 m, 0.204 on 16 September at 14.204 m) and checked on every run that fetches them; a
  restated archive stops the run. The artifact's `storage_note` says so.
- **Storage that does not fit its level is rejected (`level_storage_mismatch`).** Two tests on
  gross storage: storage below the dead storage while the level is more than 0.1 m above the
  dead-storage level (Raiwada, August 2012 and March 2019, 2 to 3 m above it); and storage more
  than 5% of live capacity above the straight line from dead storage at the dead-storage level to
  design gross at full level, because a reservoir widens as it fills and its storage curve sits
  below that line (the scraper names "Meghadrigedda, four days in May-Jun 2017, Apr-Jul 2024 and
  6-10 Sep 2026" and Thatipudi on 31 December 2014 and 1 January 2015). Rejected days are counted
  in the artifact's `quality.rejected`. `visakhapatnam-dam-storage.json` (window 8 October 2025
  to 15 October 2026) counts 5 such rejections: Meghadrigedda's readings of 6 to 10 September
  2026, 0.84 to 0.98 TMC at 14.27 to 14.39 m, where the days either side read 0.08 to 0.10 TMC at
  much the same level (checked against the API on 15 October 2026). They fall before the 30 days
  of `rejected_last_30_days`, which is empty.
- **Names.** Meghadrigedda is "MEHADRIGADD RESERVOIR" in APWRIMS, "Mehadrigedda" in the National
  Register of Large Dams and "Meghadrigadda" in CGWB's 2022 and 2025 tables.
- **Certificates.** When checked on 2026-10-14, the certificate for `apwrims.ap.gov.in` ran to
  13 December 2026 and the one for the sensor host `apwrims2.0.vassarlabs.com` to 17 October 2026.
  Whether GitHub's runners can reach either host has not been tested.

Two reservoirs are not in the feed and carry a stated reason instead: Mudasarlova, GVMC's own
reservoir inside the city, and Gambhiramgedda, a Water Resources Department irrigation reservoir that
GVMC draws on from March to June. Gambhiramgedda's point is from the National Register of Large Dams
(AP01LH0008), not APWRIMS tank MI012862, which is a smaller tank about 4 km east on the same stream.
Mudasarlova's capacity is left blank: GVMC's 2018 environmental examination gives 1,500,000 m3
(PDF p15), which it calls the original capacity, and 0.75 Mcum as the present capacity at full tank
level (PDF p18), with no survey or date behind either. The 1907 district gazetteer gives 25 million
cubic feet (about 0.71 million m3) for the reservoir it describes when the works were handed over in
1903.

Not used as feeds: CWC's weekly bulletin, which covers only Yeleru among these dams and whose
file names end in a serial number that cannot be predicted from the date
(`rsms.cwc.gov.in/admin/storage/bulletins/bulletin-DD-MM-YYYY-N.pdf`), so it serves as the
cross-check above rather than as a source; India-WRIS river levels, which carry only the Anakapalli
Sarada gauge and stop on 4 June 2026.

## Groundwater: IN-GRES by mandal, wells from two state feeds

**The assessment.** IN-GRES assesses Visakhapatnam district by mandal. Its 2024-2025 edition
matches CGWB's "Dynamic Ground Water Resources of Andhra Pradesh State 2025" (December 2025,
district table PDF p95, mandal table pp108-109) for these mandals; the artifact reproduces that
edition's eleven mandal figures to one decimal. Three editions ship: 2023-2024, 2024-2025 and
2025-2026, and the map colours the newest, the 2025-26 IN-GRES edition, newer than CGWB's December
2025 report. Unit polygons come from IN-GRES's own GeoServer, layer `gec:indgec_mandal_all` with
`year=2023` (Andhra Pradesh's per-state layer holds villages only), joined to the assessment by
mandal name.

Traps:

- **One district id, two districts.** Andhra Pradesh split Visakhapatnam district in April 2022 and
  IN-GRES kept the id. Its district rows cover 8,547.7 km2 in 2016-2017 and 11,050.6 km2 in
  2019-2020, then 1,001.7 km2 of assessed area from 2021-2022 (CGWB gives the new district's
  geographical area as 1,049 km2). The district's stage moves from 27.22% to 45.96% across that
  change, which is the boundary, not the aquifer. No district trend is shown here.
- **The city was one unit until 2022-2023.** The single 513.8 km2 "GVMC" unit became seven urban
  mandals (430.2 km2 together) in 2023-2024, and Bheemunipatnam was redrawn from 93.8 to 124.2 to
  207.9 km2. The series starts at 2023-2024, the first edition on today's eleven units, so no unit's
  history crosses a redraw.
- **Read the extractable figure.** For Andhra Pradesh, `totalGWAvailability` adds the in-storage
  resource (Gopalapatnam 2024-2025: 72,849.24 ham against 383.53 ham extractable). The stage of
  extraction divides by `currentAvailabilityForAllPurposes`, which is what the producer reads.
- **The newest edition moves on its inputs.** In 2025-2026 every mandal's rainfall input repeats
  its 2024-2025 figure, and surface-irrigation recharge differs from 2024-2025 in all eleven
  mandals. Four urban mandals move by more than 15 points, all on revised inputs rather than
  measured change:
  - Visakhapatnam Rural: the extractable resource nearly doubles (225.3 to 437.1 ham, with 223.88
    ham of surface-irrigation recharge where 2024-2025 had none), taking it from 95.06% (critical)
    to 47.87% (safe).
  - Gajuwaka: the estimated industrial draft goes from 5.4 to 97.0 ham while surface-irrigation
    recharge is cut from 111.95 to 19.19 ham (extractable resource 605.3 to 519.4 ham), taking it
    from 60.47% to 89.39% (semi-critical). The industrial change alone would not take it that far.
  - Maharanipeta: surface-irrigation recharge rises from 171.18 to 561.40 ham (extractable
    resource 1,058.35 to 1,411.17 ham), taking it from 67.26% to 51.34%.
  - Seethammadhara: surface-irrigation recharge falls from 103.69 to 53.36 ham (extractable
    resource 205.65 to 156.98 ham), taking it from 49.78% to 66.40%.

  Each of these mandals carries its own caveat in the artifact.
- No unit is assessed on the salinity axis and none carries poor-quality area.

**The wells.** Two state feeds, kept as separate series even where they share a site:

- APWRIMS recorders: the Ground Water Department's older piezometers (mostly from September 2022,
  daily archive) and a recorder network installed from December 2025 to January 2026.
- The AP Ground Water Department's manual monthly record on NWDP (resource
  `7df4b96d-3af5-4b16-b714-74ff6426ff5f`, May 2002 to April 2026). Readings from 2015 and earlier
  are labelled history.

The counts of series, recorders, manual wells and same-site pairs are stated once, in the `_note`
of `public/data/visakhapatnam-cgwb-stations.json`, and are not repeated here. Wells are kept by
their coordinates inside the IN-GRES unit polygons, never by their district tag, and named by the
AP mandal (`AP_MANDAL_V3`) the point falls in; each record also carries the IN-GRES unit, because
the two sets of lines do not match in the urban mandals. Recorder and manual series at a shared
site are kept apart. The department's own telemetry on NWDP is used only to check which recorder is
which. The archive needs the most care:

- **Carried-forward values.** The archive repeats one value for months (195 days at Visalakshinagar
  in 2026) and fills gaps with straight lines of up to 30 days. Runs of identical values and of
  constant daily slope are dropped, keeping the first real reading.
- **Spikes** of 909, 476, 254 and 153 m; the shared physical envelope and spike rules remove them.
- **One id, several names.** The station list, the archive summary and NWDP's telemetry can name one
  recorder three ways. Recorders whose names disagree are flagged and never paired with a manual
  well.
- **An unknown id returns the whole state.** The archive endpoint, given a station id it does not
  know, silently returns every station in Andhra Pradesh (about 112 MB). Only ids from the archive's
  own station summary are sent, and a reply with more than one station is refused.
- **Signs and lines.** NWDP telemetry is negative-down while the manual record is positive-down;
  NWDP district tags follow pre-2022 lines; some manual positions carry typing errors (83.84 for
  83.34), and such a well is placed at its same-site recorder when its name and other coordinate
  match. APWRIMS's manual-history tables answer "permission denied", which is why the manual record
  comes from NWDP.

CGWB's aquifer reports list key wells by toposheet grid reference, without coordinates, so they are
not used as points.

## Water quality: no river station in CPCB's 2019-2024 tables, so reservoirs, a creek and a canal

CPCB's NWMP tables for 2019 to 2024 list no river-type station on any river in Visakhapatnam or
Anakapalli district. That is an absence of stations, not a finding about the rivers, and the rivers
page says so. The stations that do sit on the city's channels are attached to them: 5160
Meghadrigedda Reservoir and 5678, a tidal creek at the Naval Dockyard bridge, on the Meghadri Gedda
(5678 by its measured 49 m distance from the OSM line, re-checked on every run); 4927 Tatipudi
Reservoir on the Gosthani; 4356 on the Yeleru canal near Pharma City. Station 5155, the Yeleru river
at Yeleru reservoir (Yeleswaram; East Godavari district as CPCB lists it), is the canal's source and
is listed, not attached. Yeleswaram has been in Kakinada district since the 2022 reorganisation, so
the district is given as CPCB prints it. 2353 Kondakarla Ava is a lake and appears with the water
bodies.

Traps:

- **CPCB's "Gostani" is a different river.** Stations 4372 and 4373 and the "Gostani along Vendra"
  polluted stretch are in West Godavari, at about 16.58 N, 81.57 E. They are not Visakhapatnam's
  Gosthani and are not used.
- **The 2024 split files misalign under plain text extraction**, which attaches a neighbouring
  station's values to a name. They were read by word bounding box. Their real file names contain
  spaces, which must be URL-encoded rather than replaced.
- **CPCB's "nitrate" column is nitrogen as N** (nitrate plus nitrite in most editions, nitrate alone
  in 2023 and the 2024 split files). It cannot be compared with BIS's 45 mg/L, which is measured as
  nitrate, so it travels as `nitrogen_n_mgl` with its basis and no exceedance is drawn.
- CPCB prints annual minimum and maximum per station. They are carried as ranges; no midpoint is
  derived.

APPCB's COMAPS programme samples the points where named sewage channels and geddas meet the sea,
monthly, with annual averages up to FY2024-25; the latest edition when read was March 2025.
**I have not found published coordinates for the COMAPS stations**, so COMAPS figures appear as
text, never as map points.

Industry figures come from three kinds of record, each under its own registry id: the operators'
own statutory filings (`industry-ec-compliance-visakhapatnam`); APPCB's own regulatory documents
for the two CETPs (`appcb-consents-directions-visakhapatnam`: the Visakha Pharmacity consent order
of 07.04.2025 and CTO committee agenda of 17.03.2025, Directions Order 692 of 14.12.2023 for the
Atchutapuram CETP, CTO committee minutes of 14.02.2025, 29.10.2025 and 08.12.2025, and the CETP
status statement of 13.03.2020); and APPCB's, CPCB's and MoEFCC's reports in NGT OA 14/2021 (SZ),
NGT OA 141/2023 (SZ), NGT OA 130/2024 (SZ) and NGT OA 240/2025 (SZ). Cover letters that say
"within norms" sit beside tables that show exceedances; both are carried. Only units with a
published coordinate are mapped, and each marker says what it marks. The CETP compliance counts
are published as data (`cetp-compliance-visakhapatnam.json`) but are not yet shown on the rivers
page: the shared compliance card is written for Surat's per-sample record, so no industrial source
carries a `cetp_id` until that card is generalised.

The joint committee's report of 4 December 2023, filed by CPCB in NGT OA 240/2025 (SZ), lists
discharges into the Meghadrigedda surplus course in KLD. Its volumes were read from the text layer
of a scanned copy, and are marked as such. HPCL's own Environmental Statement (Form V) for 2023-24
is carried beside them, also in KLD. Form V counts water consumed and effluent generated, where the
committee lists discharges, so the two sets of figures are carried as published and not compared.

## Wards: none I have found that can be published

The trap here is legal, not technical. **I have not found ward geometry for Visakhapatnam that can
be published under a licence.**

- GVMC's own 98-ward map is an AutoCAD plot exported to PDF (8 January 2021,
  `https://www.gvmc.gov.in/wss/image_uploads/gvmcnewward98.pdf`), with no coordinates. The council
  elected in March 2021 sits on those 98 wards (G.O.Ms.18 of 10-01-2020).
- The polygons in circulation are Esri India's tracing of that plot (Living Atlas layer "India
  Ward Boundary"), whose copyright field is empty. I have not found a licence anywhere in the
  chain: OpenCity's re-host labels it public domain on its own say-so, and GVMC's site terms are a
  disclaimer, not a licence. Its zone field disagrees with GVMC's own ward list (16 March 2023) for
  94 of 98 wards, and its area field is computed in Web Mercator, so it overstates.
- **The 98 wards are superseded.** GVMC's preliminary notification Rc.No.00165/2026/TP Section/G1/G2
  of 17-05-2026 (`https://www.gvmc.gov.in/WhatsNew/Whats_New_DocMay_909.pdf`) divides the
  corporation into 120 wards, described in text by roads, survey numbers and drains, with no map.
  The press reported the final notification on 14 September 2026; I have not seen the gazette. I
  have not found public 120-ward geometry.

The rule is official-or-nothing, as for Hyderabad: `my-ward` is off, `wardsVintage` is null, and the
ward count stays at the sitting council's 98 until GVMC publishes the new boundaries. Ward numbers in
older documents (the 2006 City Development Plan and the 2015 draft city disaster plan, which uses
GVMC's earlier 72-ward scheme) are never mapped onto today's wards.

## Flood: an event record credited row by row, and maps drawn at region scale

The event record has six rows, and each is credited to its own source and links it. The five
cyclones and depressions (Hudhud 2014, the deep depression of October 2020, Gulab 2021, Michaung
2023, Montha 2025) come from IMD's RSMC reports: date, track and the 24-hour rainfall IMD recorded
at its Visakhapatnam stations. The 2024 row comes from the Government of Andhra Pradesh's memorandum
on the floods of August and September 2024 and says so: it is the six-day district-average
rainfall, not a station reading. Hudhud's water-infrastructure damage is the state's four-district
table as IMD's report carries it, and its death toll is given both ways (46 in that table; 61 from
the World Bank's 2015 project appraisal and the AP State Disaster Management Authority's disaster
history page).

The only modelled flood maps I have found that cover the city are the AP State Development Planning
Society's storm-surge and river-flood maps, reproduced in VMRDA's draft Master Plan 2041 (June 2021,
PDF pp47-48) and drawn at region scale. GVMC's 2015 draft disaster plan lists inundation-prone areas
in 14 of its earlier 72 wards (13 rows; one row covers wards 31 and 33), and its second volume maps
storm-water drainage in 14 zones at city scale (Figure 8), as a picture with no geometry. The older
list, in section 4.4.2 of the 2006 City Development Plan ("Flood Prone Areas in GVMC"), is prose:
low-lying areas of the Old City (wards 1 to 20) and parts of divisions 30 to 40, the airport area,
and divisions 45 to 50 and Gajuwaka for flash floods in cyclonic rain. Both lists use ward numbers no
longer in use. The 2006 plan also proposed a drainage master plan; I have not found a published
one, a gedda register or GVMC drain geometry. The AP State Disaster Management Authority's public
GIS portal has a drain layer (`drainage_network`) from a 2019 survey that covers GVMC, with no drain
names or capacities and no licence statement that I have found, so it is mentioned on the page and
not drawn. The page draws three channels from OpenStreetMap (the Meghadri Gedda, the Gosthani and
the Yeleru supply canal) and says that OSM names other geddas it does not draw.

## Shoreline: our measurement, set beside the official stretch classes

The transects are a Neer Vazhvu computation on the shared Google Earth Engine pipeline, with the
same constants as Chennai and Mumbai: MNDWI shorelines from Landsat 5/7/8 and Sentinel-2, 100 m
transects, weighted linear regression over ten epochs from 1990 to 2026, December to May median
composites. There is no tidal correction; the spring range is 1.43 m (Survey of India tide tables,
2017, via the CWC/NIO coastal-erosion guidelines of 2020). The per-epoch weights are the Chennai
study's published shoreline-position errors, borrowed as relative weights.

The transects run from Appikonda to Pedda Nagamayyapalem, just north of Bheemunipatnam. I have not
found a published per-transect rate for this coast. The official record is stretch classes:
NCCR's National Assessment of Shoreline Changes 1990-2016 (Table 16: the undivided district, 136.98
km of coast, 102.74 km stable) and the MoES reply to Lok Sabha USQ 2638 of 11 December 2024 (today's
district, 68.08 km, with Yarada, RK Beach, Mangamari Peta to Bheemili and Bheemunipatnam to
Pedanagamayyapalem classed Low Erosion). **The two district figures describe different boundaries
and are never compared.** USQ 2638 states no analysis window, so the 1990-2018 period on the four
zones it classes is my inference: it is the window MoES gives for the same updated NCCR atlas (PIB
release of 31 March 2022; Rajya Sabha USQ 498 of 21 July 2022). The other four zones carry the
label "Not on the erosion-prone list (MoES 2024)", because USQ 2638 lists only the erosion-prone
stretches; they rest on NCCR's Table 16, a district total, and carry 1990-2016.

The page's stats bar counts high-confidence transects on both sides: 147 eroding of 421 reliable.
The other 55 of the 476 transects are low confidence and are left out of both numbers.

Traps: the two harbour basins (the Visakhapatnam Port inner harbour and Gangavaram) have no beach,
so their transects are dropped; transects at breakwaters, port-built shore, the Dolphin's Nose
headland and river and stream mouths are marked low confidence. Two more, one at RK Beach and one
north of the Gosthani mouth, are marked low confidence by hand (`JUMP_LOW` in the seed): their
measured waterline jumps about 180 m or more between epochs up to 2015, most likely where the
reading caught a different edge, and the pipeline's own confidence test reads only 2015 on, so it
does not see those jumps. Those 48 carry a named reason. Seven more (one in zone V, two in VII,
four in VIII) are marked low by the pipeline's own test on the positions from 2015 on, with no
named reason: six scatter more than 30 m about their trend, and one has no reading after 2010. The
panel gives them its general low-confidence note. RK Beach is a managed beach: the port moves sand
around its breakwaters onto it, and a Rs 20 crore sand-trap dredging for beach nourishment was
inaugurated on 12 February 2023, so a steady line there is partly man-made. The coast bears about 50
degrees, so the seed bins the OSM coastline along that axis rather than by latitude. The shared
transect writer used to stamp the Chennai study's attribution on every city's file; the anchor is
now set per city, in `COASTS` in `app/gee/coastline.py`. Mumbai's entry keeps the Chennai strings
its committed transects carry, so Mumbai's output does not change until its owner relabels it.

## Water bodies, lakes and the restoration register

The water-body layer is OpenStreetMap polygons in a box that covers GVMC and about 5 km around it.
OSM is a map, not a register: small or seasonal tanks may be missing, and names are as mapped. The
APWRIMS minor-irrigation tank layer (38,443 tanks statewide) is used only for identity, name and
place, because its capacity field has no unit and its fill field no timestamp.

The restoration register is MoHUA's AMRUT 2.0 status list for Andhra Pradesh as on 5 March 2026: 11
GVMC water-body projects, Rs 23.31 crore, 10 marked completed. Traps:

- The edition date is in the file name, so a new edition is a new URL. Two different files carry
  this title and date (53 and 58 pages), served at URLs that differ by a trailing underscore; the
  one MoHUA's site links (with the underscore) is the one cited.
- MoHUA's live list (checked 14 October 2026) has no project IDs and no Thungalam row. Its 12 GVMC
  water-body rows total Rs 25.31 crore: ten of the March tanks under the same names and costs
  (Rs 22.04 crore), a new Rs 2.00 crore Rajupalem project at DPR stage (not in the March list and
  not carried), and a Rs 1.27 crore "Thimmaraju Tank" project at Contract Awarded, the cost of the
  March list's Thungalam row. Thimmaraju appears to be the same project under a new name; MoHUA's
  live list has no project IDs and does not say so. The register keeps the Thungalam row under its
  March name and states this.
- Plans without a sanction, such as the ponds and sponge parks proposed in the draft Green City
  Action Plan, are not counted as programmes.

No list of lost tanks is shown: I have not found a published official one. The flagship cards
cite CWC's National Register of Large Dams (2019), the MoEFCC wetlands portal, VMRDA's draft Master
Plan 2041 and the 1907 district gazetteer per record. Each now has a registry id (`cwc-nrld-2019`,
`moefcc-wetlands-portal`, `vmrda-draft-master-plan-2041`, `historical-gazetteers-visakhapatnam`).

## Ground-height bands: FABDEM stores this sea as 0 m

FABDEM stores the Bay of Bengal off Visakhapatnam as exact 0 m, not as masked pixels, so a builder
that removes only the no-data sentinel draws the sea as the lowest band. `build_elevation_bands.py`
carries `sea_is_zero: True` for this city and removes those pixels. There is no city-boundary clip,
because I have not found published GVMC boundary geometry, so the bands also cover land just
outside GVMC.

## Rainfall: a land cell on a coast of ocean cells

IMD grid cell 17.75 N, 83.25 E, inside GVMC on the Gopalapatnam and Simhachalam side. The coastal
trap is real: 17.5/83.0, 17.5/83.25 and 17.75/83.5 are empty in every year checked (1991-2025), and
a nearest-cell pick there writes zeros. The cell is checked against IMD's Visakhapatnam airport
observatory normal of 1,054.5 mm (station 43149, Climatological Table 1991-2020): its 1991-2020
mean is 1,053.4 mm. IMD's other Visakhapatnam observatory (station 43150) has a 1991-2020 normal
of 1,113.1 mm, and the AP planning department's district normal, cited in CGWB's 2025 plan, is
1,117.7 mm; the cell is 5.4% and 5.8% below them. The producer's `CITY_DEFAULTS` note carries the
same comparison, and the station tables are registered as
`imd-climatological-tables-visakhapatnam`. The page's long-term mean is our own 1970-2020 average
of this one cell, not a normal IMD publishes.
Open-Meteo fills the months after IMD's last, on the same point.

## Allocations: claims, not a ledger

The allocations page is a register of documented claims on the raw water, not a verified
entitlement ledger. The Polavaram share has three official figures for different scopes, all
carried: 24 TMC (G.O.Ms.96 of 2004, quoted in an ADB environmental examination; the order itself not
seen), 23.44 TMC ("in and around Visakhapatnam city including Vizag Steel Plant", the Polavaram
Project Authority) and 12 TMC (CGWB 2025, for the urban area). Several operative documents are cited
by others but were not found, and the page names them. SEIAA clearances carry a company contact's
name and email; only the project, date, water quantity and source are used. The three data-centre
clearances of 2026 split each campus's water into fresh water from Rural Water Supply and
Sanitation and its own treated wastewater, so that row counts the fresh water only and states the
recycled part beside it. Press appears only beside the latest official figure and is named as
press. The Polavaram Left Main Canal row gives CAG's 76.05% physical progress on the canal works in
March 2023 (CAG Report 4 of 2025), the latest official figure I have found, and beside it the press
report of 2 September 2026 that Godavari water was released through the canal's regulator at
Payakaraopeta that day; I have not found an official record of the release. The data-centre row
sets beside the clearances the press report of 19 August 2026 on the IT minister's remark in the
Assembly; I have not found the Assembly's own record. Other press-only figures are left out.

## Not used, and why

- **GVMC's tanker trips.** The only published figure I have found is one day, 11 March 2021 (615
  trips, in the same NGT sheet). One day is not a tanker record, so the tanker route is off.
- **The Smart Cities "Water Tax: Visakhapatnam: 2013-2018" file.** Its "collected" column equals its
  "billed" column in every row, and its header says lakhs while the values are rupees.
- **CWC's 1993 Yeleru acceptance.** The only copy I have found online is an RTI reply carrying
  a private applicant's details; the steel plant's allocation is cited from Rajya Sabha records instead.
- **Ward numbers from older plans** (above), and **CGWB's 1991-2011 population series**, which
  matches no census table.

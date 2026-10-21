# Data Sources - Jaipur

Jaipur is the platform's first Rajasthan city (scope `jaipur`). Water is the state's Public Health
Engineering Department's (PHED), the dams are the Water Resources Department's (WRD), and the
local government is Nagar Nigam Jaipur (JMC), merged back into one corporation of 150 wards in
2025. Every upstream is in `scripts/source-registry/jaipur.json`, or under a shared id that lists
Jaipur's files in its `dependsOn`. This page is the reading guide: where each source lives, how it
is read, how often it changes and where the refresh runs, and the traps found on the way in.
Research pass 2026-10-20 (`.onboarding-state/research/`); artifacts built 2026-10-20 and 21.

## Licence postures

1. **Reproduction allowed with acknowledgement.** PHED, the Finance Department (budget speeches)
   and Nagar Nigam Jaipur print the same policy: material "may be reproduced free of charge in any
   format or media without requiring specific permission", with the source "prominently
   acknowledged". The National Water Data Portal's copyright policy says the same.
2. **Government publications, cited with attribution.** WRD (its terms say the content "should not
   be construed as a statement of law or used for any legal purposes"; no reuse licence is stated),
   the LSG Department's gazette, JDA, MoHUA, NWDA, the Ministry of Jal Shakti's census, the
   Disaster Management and Relief Department, IMD (data policy), and the court record. IN-GRES
   publishes no terms of use, disclaimer or licence at all; it is cited the same way and the
   registry says so.
3. **Permission needed beyond download.** CPCB's website policy allows download and print and puts
   "any other proposed use" under its approval, so the NWMP tables, the polluted-stretch reports
   and the sewage-plant inventory are cited, values extracted, and no report is mirrored. CWC
   (weekly bulletin, dam register) asks for permission before reproduction: cited, not republished.
4. **Open licences.** OpenStreetMap (ODbL 1.0, share-alike), Open-Meteo (CC BY 4.0). Hendley (1895)
   and the Imperial Gazetteer (1908) are public domain; the origins photographs are CC BY-SA, each
   credited (`public/images/story/jaipur/MANIFEST.json`).
5. **Project documents**, cited with attribution for dates and figures only: JICA's ex-post
   evaluation, ADB's validation report, and WRD's 2020 dam-rehabilitation assessment published by
   the World Bank.

Licence strings in artifacts come only from `registry_license()`.

## The register

| Registry id | Publisher | Where | How it is read | Cadence | Refresh runs |
|---|---|---|---|---|---|
| `rajasthan-wrd-dam-storage` | WRD, Government of Rajasthan | `https://water.rajasthan.gov.in/wr/#/` (list: POST `medicalportal.rajasthan.gov.in/webapi/api/OrderPortal/GetList`; files on `jankalyanfile.rajasthan.gov.in`) | `scrape_rajasthan_wrd_dams.py`: the portal's own list interface, then each report PDF's text, row by row, self-checked | Daily mid-June to mid-October; 1st and 16th otherwise, posted up to about 70 days late | Daily, the maintainers' scheduled local job |
| `phed-rajasthan-progress-reports` | PHED, Government of Rajasthan | `https://phedwater.rajasthan.gov.in/` | Annual Progress Report PDFs (Hindi, Kruti Dev), read from the page images; `build_jaipur_supply.py`, the curated commitments file | Yearly (January) | Manual |
| `rajasthan-budget-speeches` | Finance Department | `https://finance.rajasthan.gov.in/` | Budget speech PDFs and the reply-to-debate announcement lists, page images | Yearly (February) | Manual |
| `nwda-mpkc-note` | National Water Development Agency | `https://nwda.gov.in/` | One PDF note (Modified PKC-ERCP) | Irregular | Manual |
| `jda-dravyavati` | Jaipur Development Authority | `https://jda.rajasthan.gov.in/` | The 2017 EIA/EMP (on `environmentclearance.nic.in`) and the April 2018 project sheet | Irregular | Manual |
| `jaipur-court-docket` | Rajasthan High Court; Supreme Court | `https://hcraj.nic.in/` | Court-signed order PDFs, read where LiveLaw and Verdictum publish them; cited by court, case and date | Per order | Manual, reviewed every 60 days |
| `ingres-groundwater-rajasthan` | IN-GRES (CGWB and the state department) | `https://ingres.iith.ac.in/` | Assessment API plus the GeoServer unit layer; `build_ingres_gwr.py --city jaipur` | Yearly (new edition) | Manual |
| `nwic-nwdp-groundwater-rajasthan` | National Water Informatics Centre | `https://nwdp.nwic.gov.in/` | CKAN datastore, four telemetry resources; `build_nwdp_gw_stations.py --city jaipur` | Six-hourly telemetry | By hand (no workflow runs it yet) |
| `imd-gridded-rainfall-jaipur` | IMD | `https://imdlib.readthedocs.io/en/latest/` | `imdlib`; `generate_imd_rainfall.py --city jaipur` | Monthly archive | Quarterly, `imd-rainfall-refresh.yml` |
| `imd-gridded-rain`, `open-meteo-archive` (platform) | IMD; Open-Meteo | `https://www.imdpune.gov.in/`; `https://open-meteo.com/` | `fetch_recent_rainfall.py --all` | Daily | Daily, `rainfall-recent-refresh.yml` |
| `lsg-rajasthan-ward-gazette-2025` | LSG Department | `https://lsg.rajasthan.gov.in/lsg/#/pages/sm/department-page/371474/2380` | Gazette PDF (Devanagari text layer broken; checked on page images) into `pipeline-inputs/jaipur/wards-2025.csv`; `build_jaipur_ward_table.py` | Per delimitation | Manual |
| `jmc-jaipur-directory` | Nagar Nigam Jaipur | `https://jaipurmc.org/` | Corporators list (zone and assembly seat per ward) and Administrative Directory p.2 (page images); same CSV and builder | Irregular | Manual, reviewed every 90 days |
| `cpcb-nwmp-annual` (in `chennai.json`) | CPCB | `https://cpcb.gov.in/nwmp-data/` | Annual PDF tables transcribed with page numbers into `pipeline-inputs/jaipur/cpcb-nwmp-jaipur-2018-2024.csv` and `jaipur-wq-stations.csv`; `build_jaipur_river_quality.py` | Yearly | Manual |
| `cpcb-prs-report` (platform) | CPCB | `https://cpcb.gov.in/polluted-river-stretches/` | Read by hand; never mirrored | Every 2 to 3 years | Manual |
| `osm-overpass` (platform) | OpenStreetMap contributors | `https://overpass-api.de/` | `fetch-osm-layers.ts --city jaipur` (rules in `scripts/osm-layers/jaipur.json`) | Continuous | Manual |
| `mohua-amrut-status` (in `ahmedabad.json`) | MoHUA | `https://amrut.mohua.gov.in/` | The weekly AMRUT 2.0 progress PDF | Weekly | Manual, re-checked monthly |
| `mojs-water-bodies-census-2023` (in `ahmedabad.json`) | Ministry of Jal Shakti | `https://mowr.nic.in/irrigationcensus/Reports/6MIC/WBS/` | Rajasthan district tables (XLS) and unit rows on the Open Government Data Platform | Closed (second census pending) | Manual |

Each shared id carries Jaipur's files in its `dependsOn` except `imd-gridded-rain` and
`open-meteo-archive`, which do not yet list `public/data/rainfall-recent-jaipur.json` (the file's
own envelope cites both).

**Documents cited as closed records.** These carry no registry id; each artifact's envelope names
them with `closed: true`, or the content file cites them in its comments and text.

| Document | Used on |
|---|---|
| JICA ex-post evaluation, Bisalpur-Jaipur Water Supply Project (2016); ADB validation report PVR-254 (2013) | Supply overview, facts, origins |
| WRD revised ESIA, Dam Rehabilitation and Improvement Project 2 (February 2020, World Bank) | Supply overview (the Bisalpur shares) |
| CWC National Register of Large Dams 2019 (`nrld-2019.pdf`, pp.259 and 263) | Config source positions, flagship cards, rivers |
| CWC weekly reservoir storage bulletin (`cwc-reservoir-bulletin-archive`, in `mumbai.json`) | Bisalpur history before June 2023 |
| IMD Climatological Tables 1991-2020 (Jaipur, 42348, printed p.166); IMD Jaipur monsoon reports 2022 to 2025; IMD's Jaipur record pages; "Climate of Jaipur" | Facts, flood risk, rainfall note |
| CPCB National Inventory of Sewage Treatment Plants (March 2021) | Facts (the sewage gap card) |
| RSPCB / MNIT River Rejuvenation Committee action plan (December 2018) | Rivers, river quality |
| CGWB district brochure (2013) and NAQUIM 2.0 inception report (2023) | Rivers, origins |
| Jaipur District Disaster Management Plan 2025; State Disaster Management Plan 2014; Flood Action Plan 2024; DM&R administrative reports 2024-25 and 2025-26 | Flood risk |
| Supreme Court: Jal Mahal Resorts (25 April 2014), NIMS University (9 November 2017), Nagar Nigam Heritage v. Rajendra Tiwari (28 February 2025); NGT Central Zone OA 53/2023 (3 November 2023); High Court DBCWP 1536/2003 (2 August 2004) | Flagship cards, restoration register |
| Nagar Nigam Jaipur NIB 05/2016-17 (Talkatora and Brahmapuri, AMRUT) | Flagship cards, restoration register |
| Rajya Sabha answer on renovation of traditional water bodies (Open Government Data Platform) | Restoration register |
| T. H. Hendley, A Medico-topographical Account of Jeypore (1895); Imperial Gazetteer of India, vols VI and XIII (1908) | Origins |

## Supply: PHED's progress report, read from the page images

The source of record is **PHED's Annual Progress Report 2025-26** (pragati vivaranika, January
2026), Parishisht-21, the Jaipur city row (status 31.12.2025, printed p.85, PDF p.89): Bisalpur
590.00 MLD and 3,633 PHED tube wells 176.00, **766.73 MLD**; and the same row a year earlier in the
2024-25 report (printed p.84): 492.08 + 176.01 = 668.09. Connections 590,385 (519,165 a year
earlier). The summer tanker table (Appendix 7, printed pp.41-42) gives the city's peak on 24 June
2025: 230 tankers and 1,283 trips a day. PHED's zone schedule (status 15.04.2024) gives most zones
about an hour a day. `build_jaipur_supply.py` writes `jaipur-supply-overview.json`, every figure
listed with its page.

**Trap: the text layer is unreadable.** Both reports are Hindi in the legacy Kruti Dev font, so
pdftotext returns Latin glyph codes. Figures are read from the page image and checked against the
row's digits, which survive in the text layer.

**Trap: carried-forward columns.** The tube-well count and output and the population column are the
same in both editions, so the population is left out and the tube-well figures are shown as
printed, with a note.

**Gaps, stated:** no allocation order for Bisalpur (WRD's February 2020 study describes 11.1 TMC a
year for Jaipur and its pipeline villages, 5.1 TMC for Ajmer, about 8 TMC for irrigation; a
description, not an order); no city-wide non-revenue water (JICA's 37% for 2015, flagged by JICA as
likely unreliable; PHED gives 44.2% in Bajaj Nagar and 27% in Chitrakoot for its round-the-clock
trial, January 2025); no treatment capacity (the 200 MLD Surajpura plant in PHED's project list is
one stage); no PHED demand figure; no tanker register or rates.

## Reservoirs: the state's dam report, as gross storage

WRD's "Water Storage Data" report covers all 693 of the state's dams. The portal is an app over one
list interface: `scrape_rajasthan_wrd_dams.py` asks it for the file list with the two static
headers the portal's own public script sends on every page load (read from that script on each run,
never stored), then reads each report PDF. File names carry a random id, so the list always comes
first. Storage reports run from 1 May 2025; the monsoon Daily Rainfall Bulletins (from 16 June 2023)
embed the same tables, so the history runs from there. The backfill read on 21 October 2026 gives
265 dates per dam from 16.06.2023 to 08.10.2026 (every storage file plus every 14th earlier
bulletin); last year's column agrees with the measured reading on 966 of 967 dates.

**Storage is gross.** The report prints present gross storage and its percentage of designed gross
capacity (8 October 2026: Bisalpur 781.410 of 1,095.840 Mcum, 71.31%, at 313.90 m). It prints no
live storage. CWC's weekly bulletin is live storage against 1.076 BCM: CWC put Bisalpur at 59.39% on
8 May 2025, the state's report at 57.87% on 16 May 2025. **Never splice the two percentages.** The
CWC weekly rows written beneath the state's (insert-only, `backfill_cwc_reservoirs.py`, Jaipur in
`PCT_ON_OTHER_BASE`) keep the volume and leave the percentage empty. The CWC listing stops at the
bulletin of 8 May 2025, and from early 2025 it prints Rana Pratap Sagar's FRL (352.810) on
Bisalpur's row; the backfill accepts that misprint as a second anchor.

**Self-checking parse.** A row is kept only if its printed percentage equals storage over designed
capacity to the printed rounding, and its level and storage sit inside the dam's bounds. A figure
the department's neighbouring reports contradict is withheld in `MISPRINTS`, never corrected
(Chhaparwara on 18.06.2026, which prints Kalakhsagar's figures; Isarda's first row, 10.07.2025, an
RL of 0.00). A gauge printed 0.00 beside a positive storage is a blank cell (Ramsagar Newta, June
2025 to June 2026): the level is dropped, the storage kept.

Traps: the data date is the report's own "Date :" line, never the list's date field (an upload
date, once null); titles carry tabs and typos, and the lists misfile (a canal rotation titled
"Morning Rainfall Bulletin" in the storage list, storage files under Monsoon Rainfall); designed
values drift (Ramgarh 75.022 Mcum in 2025, 75.040 in 2026), warned, never failed; the "*" filled
marker is unreliable; district labels lag (Kanota "Jaipur-Rural" in 2025), so rows match by dam
name; names repeat (a 6.600 Mcum Bisalpur in Jodhpur, a Tonk Mansagar, two Chandlais), so each
target carries its designed capacity; the 2023 bulletins print the tables in Kruti Dev, matched on
glyph strings read against page images; the 05.08.2025 storage file answers 404 and is read from
that day's bulletin; the Jaipur-row Chandlai never leaves 1.99 to 2.04 Mcum in any report read.

**Ramgarh** was at zero on 8 October 2026 and on 8 October 2025, when the state's dams were 90.38%
full (61.80% in 2026), and on every date read from June 2023. Its 19.82 m designed figure is a
gauge reading, not an FRL.

Reachability: the portal, the list interface and the file host answered from a laptop in India in
under 2 s; all sit on the Rajasthan state data centre, and `wrd.rajasthan.gov.in` does not resolve.
They were not tested from GitHub's runners, so the daily refresh runs from the local scheduled job
(`--artifact --supabase`, then `--backfill-from` seven days back). Off-season uploads come in
batches up to about 70 days late; any freshness check must allow for that.

## Groundwater: IN-GRES to the city unit, NWDP for levels

IN-GRES assesses Rajasthan by block. In 2021-2022 it carved **JAIPUR_URBAN** (38,141 ha) out of
Sanganer, Amber and Jhotwara (167,376 ha before and after the split); about 96% of the OSM
corporation outline lies inside it. `build_ingres_gwr.py --city jaipur` reads the assessment API
(`gec/getBusinessDataForUserOpen`, no key; Rajasthan's state id came from the country-level call)
and the unit polygons from IN-GRES's GeoServer (`gec:indgec_versi_block`, `year=2021`), joined on
normalised name because the two use different ids. Editions start at 2021-2022 so no series crosses
the redraw. Jaipur Urban: 344.61, 341.52, 338.55, 328.41 and **349.88%** (2025-2026). The 2024-2025
district figures equal Rajasthan's printed Dynamic Ground Water Resources 2025 (printed p.168), and
Jaipur Urban's 2022-2023 row equals the state's 2023 report (printed p.49).

Traps: inputs are carried forward (industrial draft 244.81 ham in four editions, 826.39 in
2025-2026; domestic 3,662.09 ham in two), recharge is credited from rainfall only, and Jaipur
Urban's rainfall is copied from Jhotwara Rural, so read the category, not a trend; the 2021 redraw
halved domestic draft across the old blocks (21,170 to 10,507 ham) by a change of estimation; the
district's only "future availability" sits in Phagi's 34,006 ha saline zone, so never quote the
API's total; IN-GRES still serves the 33 districts before 2023, so its Jaipur includes Kotputli,
Viratnagar, Paota and Dudu (label it "as assessed (undivided)").

Levels: NWDP's CKAN datastore, Rajasthan Ground Water Department six-hourly resources
`2fe60c40-217d-43da-8927-d881c80d17d4` (2021-2025) and `f33c4e60-7dbf-4b15-802a-ec8737cdd319`
(2026-2030), and CGWB telemetry `467fe983-e1f0-4428-91b7-0ade87b39f6d` and
`931ff862-f13e-4754-83f9-55e0dc894f2d`. `build_nwdp_gw_stations.py --city jaipur` writes 148 wells
(108 state, 40 CGWB; 16 in Jaipur Urban) as monthly means from January 2021, placed by coordinates
in the IN-GRES polygons. Traps: the district tag is upper case and follows the lines before 2023;
999.0 is the state series' placeholder, and zeros and sign flips occur; Durgapura_1 (about 8 m) is
not CGWB's 100 m Durgapura piezometer; shallow and deep wells stand side by side (Mansarovar about
42 m), which is why there is no ward depth surface; Jaisingpur Khor_1 steps from about 56 m to 3 m;
about 70 state wells report only from 27 July to 3 September 2026. NWDP answers GitHub's runners,
but the builder is run by hand today.

## Rivers: CPCB's annual tables, and one station without a place

CPCB NWMP tables 2018-2024 for Bisalpur dam (2951) and the river near Newta dam (2952), and Kanota
dam (4781) in 2021 only, transcribed row by row with PDF pages into
`pipeline-inputs/jaipur/cpcb-nwmp-jaipur-2018-2024.csv`; coordinates from CPCB's station list
(`WQMN_list.pdf`, October 2020) in `jaipur-wq-stations.csv`. `build_jaipur_river_quality.py` writes
each year's minimum and maximum as printed. BDL is kept as null with the cell named; a "-" or blank
is null. CPCB's 2025 river file covers the Yamuna only, so 2024 is the latest year.

**No readings on the Dravyavati's channel.** 2952 is shown under the Dravyavati as an indirect
signal: RSPCB's December 2018 action plan says Nevta dam "is fed from Dravyavati River through a
diversion channel" from Gular dam. Its highest BOD was above 3 mg/L every year from 2018 to 2024
(36.5 mg/L in 2024); Bisalpur's was 1.6 mg/L in 2024.

**Station 2952's coordinate is withheld.** CPCB's list prints 26.919491 N, 75.930328 E, which is
0.37 km from 4781 at Kanota dam on the Dhund, east of the city; RSPCB's plan maps Nevta near Muhana,
south-west. Nevta is not in the national dam register and no official coordinate was found. Readings
shown, marker withheld, until RSPCB or CPCB says where it is sampled. 2944 (Jal Mahal) is a lake on
the Darbhawati, not on a drawn river; its rows stay in the input CSV and out of the artifact.

**Polluted stretches.** 2018: Banas "along Bisalpur Dam, Swaroopganj, Newta Dam", Priority III
(RSPCB's 2018 plan; CPCB task-team minutes of 12.09.2019; the 2025 report's annex). November 2022:
Banas "Bassi to Bisalpur", Priority I, on 35.7 mg/L, the same figure as Newta dam's 2019 maximum
(read from Lok Sabha USQ 1734, answered 05.12.2024); "Kanota, along Sumel", Priority IV. 2025:
"Vishwamitri near Newta Dam", Priority II (the copy hosted by the Puducherry Pollution Control
Committee), pairing Newta dam's 16 mg/L with 30 mg/L at Khalipur village, a station the same report
lists under Gujarat; Newta dam's own figure falls in Priority III's band. All three are shown dated,
with one neutral note on the 2025 pairing.

**Geometry.** `fetch-osm-layers.ts --city jaipur` (method `walk`) draws the Dhund past Kanota, the
Banas clipped to the Bisalpur reach and the Banganga to Ramgarh. OpenStreetMap maps the Dravyavati
as water outlines (`natural=water`, `water=river`, plus "Amanishah Nala"), not a centre line, so its
drawn length (82.3 km) is a perimeter; the rivers page uses JDA's corridor, 47.50 km (EIA/EMP
Chapter 2, 2017). Contract figures (Rs 1,470.85 crore to build, Rs 206.08 crore for ten years'
upkeep, 18.03.2016) and the commissioning certificate (09.12.2022) are from the High Court's order
of 19.12.2024 in S.B. CWP 14997/2024.

**Not ingested, and why:** RSPCB publishes monthly sample counts, not results; CPCB's 2024 drains
and sewage-plant table has no Rajasthan rows; RSPCB's online monitoring portal does not answer the
recipe used elsewhere (parked); NWDP's CPCB surface-quality rows for Jal Mahal, Kanota and Newta
cover April to August 2021 only.

## Flood: a written record, no trigger

The Jaipur District Disaster Management Plan 2025 (DM&R, 461 pp): flooding "of minor nature",
waterlogging "largely due to inadequate drainage", 1981 and 2012 named, low-lying pockets "have
been identified" with pumps placed by the first week of June but not listed, no numeric trigger.
IMD's Jaipur record (station 42348): 326.0 mm on 19 July 1981, July 1981 956.9 mm; 170.1 mm on 22
August 2012; 102.7 mm on 15 August 2020. IMD Jaipur's monsoon reports: district June to September
986.6 mm (2024) and 918.5 mm (2025) against 524.3. Rain deaths are counted for the state only (133
in 2024, 193 in 2025, DM&R reports). CWC has no station in the district (nearest Tonk, warning
262.0 m, danger 262.8 m, and a Bisalpur inflow forecast), so `flood.ts` is narrative only.

Traps: IMD's two figures for 1981 as a whole disagree (1,403.9 mm in the 1991-2020 tables, 1,180 mm
in "Climate of Jaipur"), so only July 1981 is used; the plan's dam table follows the district before
2023; the 1 August 2024 basement deaths and the 2020 deaths are in the press only and are held out.
Not found: a waterlogging list, a flood map, drain design rainfall, a gauge on the Dravyavati or the
Dhund, any damage figure for the city.

## Water bodies and lake restoration

No city lake register was found from JMC or JDA. The water-bodies map is
`public/geojson/jaipur-water-bodies-current.geojson`: 36 OpenStreetMap polygons (14 named) in the
box 26.65-27.10 N, 75.60-76.10 E, wider than the corporation so Ramgarh, Kanota, Nevta and Chandlai
are in it; `water=river`, drains and wastewater are excluded (23 Dravyavati channel segments belong
to the rivers page). **OSM caveat:** three features are not lakes and the fetcher cannot filter them
by tag: the "Amanishah Nala" polygon (way 261520236, a Dravyavati channel segment, also in the
rivers layer), "ghodela bulding material" (way 1180129919, a pit) and "Fountain RD" (way
1434523050). OSM maps Ramgarh at about 113 ha against the register's 1,035 ha reservoir area.

The first Census of Water Bodies (reference year 2017-18): Jaipur district 82, all rural, almost all
in Shahpura and Phulera tehsils; no urban water body; none recorded as encroached. The second census (2023-24) gives Rajasthan 14,400, 1,081 urban; its
district tables were not on the Ministry's table page on 20 October 2026.

The lake-restoration files (`water-bodies-flagship-jaipur.json`, `restoration-projects-jaipur.json`,
built by `build_curated.py` from `src/cities/jaipur/*.json`) carry 8 graded bodies, 7 programmes and
7 orders. WRD's report of 8 October 2026 lists 27 dams in Jaipur district: 33.978 of 208.747 Mcum
(16.3%) against the state's 61.80%; eleven held nothing; Ramgarh alone is 75.040 of the 208.747.
Traps: two Chandlai rows (Jaipur 2.04, Tonk 4.53 Mcum), identity unsettled; the register's Kukas
(43.75 Mcum gross, 4.375 effective) cannot both be right and neither is published; Ramgarh's year
is 1901 in the register and 1903 in the Supreme Court's judgment; Mansagar's builder and the lake's
area rest on a party's account and are labelled so; Sagar and Galta are held back (no official
status found).

### Satellite deep zoom (five bodies)

Ramgarh, Man Sagar, Kanota, Nevta and Chandlai run through the shared rich-body
pipeline (`src/lib/water-bodies/rich-bodies.json`): Landsat and Sentinel-2
yearly images, JRC Global Surface Water 1984-2021, Dynamic World 2016-2026,
Google Open Buildings and Overture footprints. Four outlines are OpenStreetMap's.
OpenStreetMap maps only about 112 ha of Ramgarh, so its outline is the
connected region where JRC saw water at least once in 1984-2021, 328 ha
(`scripts/build_jrc_max_extent_outline.py`, `public/geojson/jaipur-jrc-max-extent.geojson`);
CWC's register gives 1,035 ha at full supply, which the record never shows.
Ramgarh's bed is labelled crops by Dynamic World's most common label in each
year from 2022 to 2026 (64% to 93%), read from a per-year histogram.

## Wards and contacts

The LSG notification of 16 September 2025 (Rajasthan Gazette Extraordinary Part 6(A), 20 September
2025) sets 150 wards with population (3,197,135 in all; census basis not stated), described in
words. Its Devanagari text layer is broken: two extractions agree on 149 wards and ward 116 (24,725)
was read from the page image. JMC's corporators list (6 October 2026) gives each ward's zone (13)
and assembly seat (10); its Administrative Directory p.2 gives zone office lines and emails for 8
zones. `build_jaipur_ward_table.py` writes `jaipur-ward-profiles.json`: a table, no geometry.

**No ward geometry.** JMC's official 2025 map (`jaipurmc.org/PDF/wardmap.pdf`) is one raster image
with no coordinates. Traps: the OpenCity KML "Greater Jaipur Nagar Nigam Wards 2024" is the old
Greater corporation only (279 sq km, different numbering); the OpenCity "150-ward map" PDF is a
December 2019 proposal. `wardsVintage` stays null until the raster is digitised or JMC or LSG
release a shapefile.

Contacts in `my-ward.ts`, each from the agency's own page (20 October 2026): PHED's district control
room (control-room list of 13 May 2026), the City Circle North and South offices (PHED's Contact
Us), Jaipur Samadhan and the call centre (jaipurmc.org), Rajasthan Sampark 181, and DM&R's 1077.
Jaipur Samadhan has no water category, so water complaints route to PHED through Sampark. Officers'
mobile numbers, councillor names and parties are never used.

## Commitments

21 rows (`commitments-jaipur.json`, from `src/cities/jaipur/commitments.json`): PHED's progress
reports (2024-25 and 2025-26), the budget speeches (2023-24 to 2026-27), MoHUA's AMRUT 2.0 weekly
report (week to 18 October 2026), NWDA's note (file of 13 August 2025), JDA's 2018 sheet and the
court record. 4 delivered, 4 overdue, 13 unverified. The 24x7 trial's due month is derived from
PHED's "in the next two months" (January 2025), stated on the row. MoHUA still prints the former
Heritage and Greater corporations' names, kept as printed. Re-checks: January (PHED), February
(budget), monthly (MoHUA), after High Court hearings (Ramgarh, Dravyavati). The Ramgarh hearing of
15 September 2026 has no order on record by 20 October 2026.

## Rainfall

IMD gridded cell 26.75 N, 75.75 E (`pipeline.json`, `rainfall.imdGrid`): it contains IMD's Jaipur
(Sanganer) observatory, 42348, and about 36% of the corporation outline (the cell north, 27.0/75.75,
holds about 55%). Checked 2026-10-20: 591.9 mm over 1991-2020 against the observatory's 600.3 mm
(-1.4%); the northern cell 612.7 mm (+2.1%). Every year 1991-2020 is within 0.75 to 1.27 times
the state's manual gauge at Sanganer (NWDP, one value a day; its 2016-2018 rows are duplicated at
08:00 and 08:30). No zero or missing year 1970-2025. 1970-2020 mean 611.2 mm.

Provisional months (after IMD's December 2025) are Open-Meteo at the same cell. Over 1 June to 8
October 2026 it gave 383.4 mm against 527.9 mm at IMD's airport gauge as WRD's rainfall report of
8 October prints it, about 27% low; kept for parity, with the bias stated on the About page.

## Not used, and why

- **CWC flood forecasting** for Bisalpur: the station code was not decoded; linked for context only.
- **India-WRIS river levels** for Tonk and Jaipur: "No data found" for 2010-2026.
- **NWDP state river levels and Bisalpur gate discharge:** no Tonk rows; discharge rows from March
  2024 only, none in 2026.
- **NWDP state manual rainfall:** history only (Jaipur rows stop in September 2024, 2026 undercounts
  WRD's gauges).
- **`city.imd.gov.in` city-weather pages:** the feeds research found an injected script on them
  that opens an outside URL on Android, so the About page does not link them. The flood page's
  record-day citations (`IMD_JUL`, `IMD_AUG` in `flood.ts`) still use their URLs.
- **DM&R heavy-rain bulletin:** empty; the site was last updated 26 September 2024.
- **OpenCity ward files:** see Wards.
- **RSPCB online monitoring (GLens):** the interface returns failures; parked.

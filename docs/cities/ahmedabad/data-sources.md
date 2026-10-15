# Data Sources - Ahmedabad

Ahmedabad is the platform's second Gujarat city. It reuses two state-wide upstreams Surat registered
(IN-GRES Gujarat and CPCB NWMP) and adds AMC, the Gujarat water department's daily dam report, the
National Water Data Portal's Gujarat telemetry, the State Election Commission and the court record
on the Sabarmati. Every upstream is in `scripts/source-registry/ahmedabad.json` with its traps;
this page is the reading guide. Research pass 2026-10-14.

## Supply: AMC's budget, not AMC's web page

The source of record is **AMC Budget 2026-27 (Gujarati), printed pp.63-64**, which lists every
raw-water source and treatment plant with capacity and current use: Narmada Main Canal head
regulators 1 and 2 (330 and 800 MLD used), the Dholka branch canal (420), the Shedhi branch canal
from the Mahi (200), and 555 borewells (100). 1,550 of 1,850 MLD, 84%, comes down the Narmada
canal. `build_ahmedabad_supply.py --verify <pdf>` re-reads every figure on its cited page.

**Trap: the "Water Project" web page is four budgets stale.** Its 2,100 / 1,535 MLD table went up
between October 2021 and March 2022 (Wayback) and has not changed since; it still lists French wells
on the Sabarmati that the budget shows supplying nothing.

**Gaps, stated:** no measured non-revenue water (the 2023-24 budget says connections are
unmetered); no published entitlement from the Narmada or Mahi (the annual sanction mechanism is in a
3 Feb 2007 resolution and a 9 Sep 2008 circular, but the quantity is not public); two population
figures in the same budget. The 2023-24 budget is the last to state supply hours (two hours a day,
6 to 8 am).

**Trap: sewage "generation" is derived.** The state's NGT affidavits give Ahmedabad's generation as
"Calculated as per 80% of Water Supply" and treated as equal to it, so the reported gap is zero by
method. GPCB's own filings record pumping-station bypasses of 284.18 and 163.95 MLD. That is why the
sewage-balance card is off.

## Reservoirs: one frozen PDF per day since 2019

`wrd-dam.gujarat.gov.in/downloads/home_pdf.php?dt=<base64("YYYY-MM-DD")>` returns the department's
daily report; the index lists every date from 2019-06-01 and the first non-empty one is 2019-06-07.
Reports are frozen as generated (a re-fetch is byte-identical), so the archive is the history.
`scrape_gujarat_wrd_dams.py` reads Sardar Sarovar's own block and the dam statement for Kadana and
Dharoi, and accepts a row only if its storage arithmetic holds (gross = live + dead, design and
present, and the printed percentage). It parses every sampled report from June 2019 to October 2026.

Traps: a missing date returns HTTP 200 with zero bytes; row order changes between years; 2019-20
reports lack the SchemeId and Taluka columns; page 3 is in feet and the statement in metres; words
wrap across lines; design capacities are revised over time; Mazum is printed Mazam. The
department misprints a figure a few times a year: in 2,680 reports, Sardar Sarovar's level six
times (11849.00 m on 4 May 2023) and Dharoi's whole row once (3 July 2024). These are withheld, not
corrected (`MISPRINTS` in the scraper), and any level above FRL + 2 m is dropped. The host
answered from a non-India datacenter on 2026-10-14 but not from GitHub's runners on 2026-10-15
(the IPv4 connect hangs past 60 s), so the daily refresh runs from the local scheduled job; each
run re-reads the last 7 days, which fills any day the job missed. The CWC weekly bulletin (frozen at 08-05-2025)
uses different live capacities and must not be mixed in.

## Groundwater: IN-GRES to taluka, NWDP for levels

IN-GRES assesses Gujarat by taluka, not only by district. Ahmedabad district has ten units in the
current editions, including **AHMEDABAD URBAN**, carved out of CITY & DASKROI in 2021-2022 (95,627 ha
became 47,359 + 49,642). Every one of AMC's 48 ward centroids falls inside the Urban unit. Unit
polygons come from IN-GRES's own GeoServer (`gec:indgec_vers_gujarat`, `year=2021`), whose areas
match the assessment to the hectare.

Traps: editions before 2021-2022 use the old units, so the series starts there; the Urban unit's
extraction is filed under different uses in each edition (read the category, not a trend); Dholera
and Dhandhuka are `salinity` and carry no extraction figures; the API's `total` key includes the
saline tract and more than doubles the district's extraction (use command + non-command); the
district's own `total` row has no category (read it from the state call).

Levels: Gujarat Surface Water and Ground Water Department and CGWB six-hourly telemetry on NWDP
(resources in the registry). The 1.1 GB CSV in the research drop is row-for-row the 2021-2025 state
resource; its 2026 file was a stale snapshot. District tags follow old lines, so stations are placed
by coordinates in the IN-GRES polygons; names repeat across districts; -1.0 is a placeholder.

## Rivers: CPCB's annual tables, vendored

CPCB NWMP Table 7 (Sabarmati) for 2018-2024, transcribed row by row with PDF pages into
`pipeline-inputs/ahmedabad/cpcb-nwmp-sabarmati-2018-2024.csv`, with coordinates from CPCB's station
list. Ten rows with blank cells were assigned by column position and carry that note. CPCB's 2025
river file covers the Yamuna only.

Traps: BDL means below detection (DO 0.3 mg/L, BOD 1 mg/L) and a coliform 1600 is the top of CPCB's
scale; 10014 duplicates 1866 (Hansol); station 1408 (Miroli) is placed 18.9 km from its village in
CPCB's list, so its coordinate is withheld; the polluted-stretch definition narrows in each CPCB
edition (Kheroj to Vautha, Raysan to Vautha, V.N. Bridge to Vautha).

**Not ingested, and why:** GPCB's monthly CETP results (12 Ahmedabad CETPs, May 2022 to June 2026)
are extracted but carry no plant coordinates, which the shared industrial-sources layer needs; the
STP outlet data public for AMC is 2023-24 averages for ten plants, which the shared treatment panel
cannot show as a monthly series. There is no live water-quality station on the Sabarmati.

## Wards: AMC's own map, from its app

AMC's "Know Your Ward" link opens its City Map app, whose bundle carries a `Ward_Boundary` GeoJSON:
48 wards in 7 zones, matching the State Election Commission's final delimitation of 3 Oct 2020
(including Bopal, Ghuma and Kathwada, added on 18 Jun 2020). `build_ahmedabad_wards.py` reads it from
the live app. Two attribute faults are corrected: `area_ha` holds km2, and Navrangpura's area is
copied from Jodhpur. Ward populations are Census 2011 from the SEC order's Schedule 2, checked
against its printed total of 56,64,062.

**Not used:** the OpenCity "Wards Map 2024" KML in the research drop predates the 2020 extension.
The same AMC app serves lake points only through an encrypted API; they are not read.

## Flood: CWC thresholds, Information Department releases

CWC's flood-forecasting service gives the Sabarmati at Subhash Bridge a warning level of 44.09 m, a
danger level of 45.34 m and a highest flood level of 47.45 m (20 Aug 2006). AMC's waterlogging
counts and the July 2026 event come from Gujarat Information Department releases quoting AMC (148
identified spots). The "147 locations in the 2025 monsoon" figure in the research drop has no
source and is not used. AMC publishes no named hotspot list, no drain geometry and no live rain page.

## Lakes and commitments

AMC counts 122 lakes in its 2020-21 budget and 176 in 2026-27, publishes no lake register or layer,
and spreads its lake works across budgets, the AMRUT 2.0 portal and the NDMA grant. The lake
restoration and commitments artifacts cite each record's page; where AMC's budget and MoHUA's portal
disagree on a status or cost, both are stated.

## Rich-data deep-zoom panel (2 Ahmedabad lakes)

| | |
|---|---|
| **Bodies** | Kankaria (way 29340465, ~26 ha) and Chandola (ways 84639248 and 84639247, ~72 ha) |
| **Pipeline** | Body-agnostic scripts under `scripts/`; per-body entry in [rich-bodies.json](../../../src/lib/water-bodies/rich-bodies.json) |

The other six flagship lakes are too small for the satellite series (Isanpur ~2.9 ha and Vastrapur
~1.8 ha are a few dozen 30 m pixels) or are not matched by name in OpenStreetMap. Chandola has no
OSM relation: its two traces are drawn as one body (`fetch-rich-body-polygon.ts --osm-way` takes a
comma list).

**Chandola became a lake that fills every year in 2002, and the satellite record dates it.** JRC
detects no water in 4 of the 13 years from 1989 to 2001 (1990, 1993, 1996, 1999), with full coverage
in each, and water in every year since 2002. That matches the 1879 Gazetteer's tank that "seldom
retains any depth of water long after the close of the rains", and the Irrigation Department's 2000
affidavit that urban growth had ended its irrigation use; what changed in 2002 is not in any source
we hold, so the panel does not say.

**But it is open water for only part of the year.** Dynamic World labels each pixel by its most common
class across the year; from 2022 to 2026 that is "crops" on 62% to 67% of the bed, "built" on 18% to
23% and water on only 8% to 21%. "Crops" may be cultivation of the dry bed or vegetation on the
water, and the classifier cannot tell which; "built" is any hard surface, and Overture maps 9
buildings inside the outline. Kankaria, a walled lake, reads water on 99% to 100% every year.

Traps: OSM's 72 ha for Chandola is the traced water surface, not the 121 ha of the 2000 affidavit;
JRC classes Kankaria's water as permanent to 2008 and seasonal from 2009, which says it is not full in
every month, not that it dries; both 1 km halos were already 95% to 97% built in 2016, so their
built-up series move within classifier noise.

## Rainfall

IMD gridded cell 23.0 N, 72.5 E: 800.4 mm over 1991-2020 against IMD's own Ahmedabad observatory
normal of 783.6 mm (+2.1%); the cell east of it reads 10.8% high. Open-Meteo fills the months after
IMD's last, on the same cell.

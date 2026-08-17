# Data Sources - Surat

Surat is the platform's first Gujarat city, so nothing here was inherited. Every prior onboarding
arrived on top of a state tier someone had already worked (TNGIS, KWRIS, MPCB, TGPCB, WBPCB); this
one is first contact with SMC, GWRDC, GPCB and the Gujarat Water Resources Department.

## The hero: a live flood chain with the thresholds attached

`suratmunicipal.gov.in/Home/RainfallInfo` is plain server-rendered HTML, five tables, no auth, no
JS. It publishes Ukai dam's level, inflow and outflow; the weir-cum-causeway's level and outflow;
rainfall for eight zones; the season total; and five urban khadis.

What makes it the hero rather than another feed is that **every reading arrives with the threshold
it is measured against**: Ukai's full reservoir level (345 ft), the causeway's overflow level
(6.0 m), and a published Danger Level for each khadi (Kakara 8.48 m, Bhedwad 7.2 m, Mithi 9.35 m,
Bhatena 8.25 m, Simada 4.50 m). A reading without a threshold is trivia. A reading against a
published threshold is a warning, and it lets the platform state headroom as a subtraction rather
than modelling a risk of its own.

**This is a rolling window of about ten readings with no archive, no dated URL and no API.** History
exists only from the day `scrape_smc_flood_chain.py` first ran (2026-08-14) and cannot be
backfilled from anywhere. That is why the scraper landed before any UI work on this branch and why
it belongs in the daily launchd job rather than CI.

## The SMC GIS, and exactly what it will and will not give

`gis.suratmunicipal.org:8443/cgi-bin/IGiS_Ent_service.exe?IEG_PROJECT=Surat_ws_25` is an IGiS
(Scanpoint Geomatics) portal, MapServer underneath, serving a public unauthenticated WMS with about
390 layers. It is the richest municipal GIS found on this platform.

Verified contract:

| Operation | Status |
|---|---|
| `GetCapabilities` | Works. No stated fees, no access constraints. |
| `GetMap` | Works. Renders PNG, including `flood_map_2006`. |
| `GetFeatureInfo` | Works with `application/vnd.ogc.gml`: full attribute records. `text/plain` returns feature ids only, so always use GML. `application/json` is rejected. |
| Vector geometry | **Not available.** GML carries `gml:Box` only. |
| `WFS` | **Disabled** (`IEG Code 1027`). |

So: attributes yes, rendered tiles yes, geometry no. `surat-zones.json` was harvested by sweeping
GetFeatureInfo over a point grid and deduplicating by `zone_code`. Central Zone needed a targeted
query because at 8.28 km2 the coarse grid stepped over it.

Layers worth naming for a future ask: `flood_map_2006` (depth-classed via a `water_level`
attribute), the full `w_*` supply network, `se_*` sewerage including `se_ttp`, `sw_*` storm water,
`resistivity_0_5m` through `_45_50m`, `siren`, dated `water_logging_spots_<ddmmyyyy>` snapshots, and
imagery back to 2006. **Enabling WFS is the single highest-value thing SMC could do for this city's
page**, and naming the layer and the disabled setting makes that a credible request rather than a
vague one.

## Zones - the analytical unit

"Ward" in Surat means three incompatible things: 30 electoral wards (120 corporators), about 134
census/administrative wards in SMC's own 1961-2011 table, and a third scheme inside the GIS
`ward_boundary` layer. None has downloadable geometry.

The zone is the only unit that carries live data (rainfall is reported per zone, every khadi is
attributed to one), an official current denominator, and the city's own supply breakdown. Nine
zones, from the GIS `zone_boundary` layer, each with area, 2011 census population, an SMC 2024
population estimate and a household estimate.

Two independent cross-checks passed, which is why this is trusted:

- the nine zones sum to **461.64 km2** against the **462.149 km2** SMC states on its wardwise area
  table, a 0.1% difference between two separate SMC surfaces;
- 2011 population sums to **4,645,384**, matching the ~4.65 million in the corporation's own
  1961-2011 wardwise table.

**Vintage conflict, stated rather than smoothed:** the Zones page and the GIS layer both describe
nine zones (South split into A and B); the live rainfall feed still reports eight, with a single
South Zone. The flood-chain artifact carries the feed's eight names verbatim rather than remapping
them, so no artifact asserts a structure its own source does not use.

## Supply - and the two columns we refuse to publish

The Smart Cities Mission open-data releases for Surat give three things worth having: monthly total
supply Jan-2018 to Dec-2021 (48 real points, 1,080 to 1,326 MLD), property connection coverage for
three years, and per-sub-ward capacity across 233 sub-wards in 8 zones totalling 1,342 MLD.

They also give two columns that are constants wearing a measurement's clothes:

- `Losses_includingNRW_MLD` is exactly **20.0000%** of total supply on all 48 rows, and the
  accompanying `ActualWaterSupplied_MLD` equals total supply on every row, which contradicts the
  existence of the losses column;
- the per-sub-ward "domestic consumption" column is exactly **0.750000 x capacity** on all 233 rows.

Neither enters the product. **Surat publishes no measured non-revenue water and no measured
per-ward consumption**, and that absence is a fact on the facts page rather than a hole we filled.
The builder asserts both ratios still hold, so a future edition that starts publishing real
measurements trips the assertion instead of being silently discarded.

SMC's Hydraulic page (980 MLD gross daily, 1,300 MLD installed, 95% piped) is explicitly dated
2015. It describes the system; it is never used as a current number.

## Rivers - the Tapi profile, and a finding that inverts the assumption

CPCB NWMP 2022, Table 9, gives seven Gujarat Tapi stations that happen to form a clean
upstream-to-sea profile: Ukai (Sherula Bridge), Mandavi, Bardoli/Kakrapar, Kathore NH-8, Surat u/s
Kathore, Rander Bridge, ONGC Bridge at Hazira.

The profile says something counter-intuitive and worth checking again before it is leaned on. BOD
is at or below detection limit at most Surat stations, so the Tapi is **not** organically polluted
through the city the way the Musi or the Adi Ganga are. What climbs is conductivity: 369-513
umhos/cm at Ukai, 363-7,656 at Kathore, and 1,537-49,720 at Hazira, which is seawater. Surat's river
problem is salinity and the estuary, not sewage.

**Six editions ingested (2019-2024), 45 station-years.** That is one year MORE span than Chennai
carries, across 8 stations rather than 13 - and 8 is what CPCB monitors in this reach, so the
station count is the network's limit rather than ours.

Two extraction notes worth keeping. The editions are not laid out consistently: major-river tables
lead each row with the station code, while the 2022 medium/minor table trails it, so the extractor
matches on a unique name keyword as well. And `pdftotext -layout` is used rather than a Python PDF
parser, because pdfplumber spent over thirty minutes of CPU on these six files without finishing
while pdftotext does one in under two seconds.

The Mindhola is the counterpoint that makes the Tapi finding legible: at Sachin it runs BOD 2.2-7.0
against the Tapi's at-or-below-detection. The textile belt's river IS organically loaded; the city's
river is not.

River geometry is OSM, not SMC: the GIS holds `tapi_river` and `creek` layers but serves WMS only,
so its geometry cannot be redistributed. **OSM names none of the five khadis SMC monitors against
danger levels**, so the creeks most central to the flood chain have no geometry. Named gap.

## Groundwater

India-WRIS exports filtered to `District == SURAT`: 94 stations, 6,563 readings, 1970 to 2026. Deep
in time, thin in space, so the page renders the points rather than interpolating a surface.

Three traps in the source:

1. **The export filenames misstate their own coverage.** The file named `1991_2020` holds Aug-Dec
   2020; the one named `2026_2030` holds Jan-May 2026. Coverage is derived from the readings.
2. **The `Block` column is `-` for every Surat row**, so block-level joins are impossible from this
   export. Block assessment has to come from IN-GRES.
3. **Telemetry sign convention is mixed** (min -35.31, max +31.37 m). Raw values are carried
   unaltered so the per-station sign rule stays visible rather than baked in.

## Water bodies

SAC National Wetland Atlas hydrological layer for Gujarat clipped to a Surat district box (3,401
polygons), plus **17 more contributed by OpenStreetMap** where the national-scale atlas missed a
body - small urban talavs fall below its minimum mapping unit while being perfectly well known on
the ground. 3,418 total, 1,451 inside city limits.

Two things about the drop it arrived in. Three of its four files were **Himachal Pradesh** (2,045
features, 657 pro-glacial lakes) and are discarded; `hp` in the filename was the state, not a data
grade. The usable Gujarat file arrived as an interrupted Chrome download and is parsed to its last
complete placemark, 18,279 of 18,280.

Thin semantics, partly recovered. `level_iii` and `l4type` are empty for every Surat feature, and
only 34 carry a name; OpenStreetMap lends 10 more by bounding-box containment (never
nearest-neighbour - a wrong name is worse than none), giving **44 named of 3,418**. That is still
about one in eighty, and it is the source's limit rather than a processing choice.

What IS recoverable is the `wetcode`, populated on 3,084 of them. Its structure was derived from
the data rather than an external table: across all 18,279 Gujarat features the first digit maps
one-to-one onto `level_i` (1 = Inland, 2 = Coastal) and the second onto `level_ii` (1 = Natural,
2 = Man-made), with no code ever appearing against two different pairs. Those two axes are decoded
and published. **The leaf digits are not**, because no primary SAC code table was obtained this
pass and a secondary summary of it contradicted the data - it gives 1201 as a natural lake while
every 1201 feature in this file is flagged man-made. The raw code is carried so that verifying the
table later is a data change rather than a re-extraction.

Two avenues tried and not landed: SMC's own GIS `water_body` layer would be authoritative for
names, but the server throttles a GetFeatureInfo sweep beyond usability and a probe of that layer
returned empty; and the First Census of Water Bodies would give a district denominator, but its
state volume is a scanned PDF that did not yield text this pass.

## Reuse - the thing Surat is actually known for

Primary source: "Reuse of Treated Used Water: A Successful Model", Surat Municipal Corporation,
dated 8 March 2024, hosted by CSE India. SMC's own figures: 11 STPs (1,726.50 MLD), 3 TTPs
(164 MLD in, 115 MLD out, 249 industrial units across Pandesara and Sachin), **330 MLD total reuse**
itemised across eleven uses, capital cost Rs 314.39 Cr, **Rs 496.23 Cr cumulative revenue to
January 2024**, tariff Rs 18.20/KL in 2014 rising to Rs 36.2/KL, and dated targets of 70% by 2030
and 100% with zero liquid discharge by 2035.

**Press coverage of this programme disagrees with the corporation** (reporting Rs 340 Cr and
Rs 140 Cr annually). The deck's figures are used and cited; the press figures are not.

## Named gaps

- **No ward geometry.** Three competing ward schemes, none downloadable. Closes when SMC enables
  WFS or publishes boundaries.
- **No storage history, ever.** Surat impounds nothing; the weir pond is a river reach and Ukai's
  volume is the state's to publish. The dashboard says so rather than promising a chart.
- **No 2006 flood figures.** The defining event, and every number for it currently traces to
  Wikipedia, news coverage or advocacy reports. Held until replaced from the People's Committee on
  Gujarat Floods report or the Surat Citizens' Council Trust report. The flood page carries the
  inundation footprint (SMC's own depth-classed layer) without the discharge numbers.
- **No measured NRW, no measured per-ward consumption** (see Supply).
- **No khadi geometry** (see Rivers).
- **No restoration register.** SMC restores lakes and routes 2 MLD of treated water to
  rejuvenation, but publishes no project list, dates, budgets or per-body status.
- **No allocation instrument.** No published drinking-water entitlement from Ukai or the Tapi was
  found, so the ledger has no entitled half to render.
- **Origins unwritten.** The spine is identified (8 km2 and 12 wards in 1961 to 462.149 km2 and 134
  wards today, across six annexations, the most recent June 2020) but the long-read is not drafted.
- **Industrial effluent not ingested.** GPCB's OCEMS dashboard and the Gujarat Environment
  Management Institute's discharge-point monitoring for the Pandesara and Sachin CETPs are both
  identified and neither is built.

## Retired / rejected

- `wb_hp.kml` and its two byte-identical zips: Himachal Pradesh, wrong state.
- `Unconfirmed 659707.crdownload`: truncated zip, no central directory, unrecoverable.
- The disaster-management dashboard at `office.suratmunicipal.org/DisasterManagementSystemweb`:
  publicly reachable, and its data is frozen at 28/09/2022 with the date hardcoded in the served
  HTML and no data endpoints behind it. This is the public face of the ACCCRN/SCCT early warning
  system that took Surat's flood warning from 6-8 hours to 72. Not used, and the staleness claim
  needs one more verification pass plus a note to SCCT before it is published as a finding.

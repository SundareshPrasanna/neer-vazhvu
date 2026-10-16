# Visakhapatnam vs Chennai and Bengaluru: graded parity scorecard

> Measured 2026-10-15 from the shipped files with a script, while the onboarding branch was being
> corrected; the launch state updated on 2026-10-16, at cutover. Grades follow `docs/cities/kolkata/parity-scorecard.md`. Sources and traps:
> `data-sources.md`. What each route shows: `features.md`.

| Grade | Meaning |
|---|---|
| **XHigh** | Visakhapatnam carries materially more than the benchmark |
| **High** | Comparable in kind and depth |
| **Medium** | Present and usable, thinner |
| **Low** | Minimal or absent; reason stated |
| **N/A** | Structurally inapplicable; a difference in the city, not the build |

**12 of 15 routes built** (live since 16 October 2026): dashboard, about, groundwater, water-bodies, rivers,
flood-risk, shoreline, lake-restoration, facts, origins, allocations, commitments. Chennai ships 14
(no tanker) and Bengaluru 13 (no shoreline, no climate-risk).

The one-line summary: **Visakhapatnam is deep where a state portal or a central report is the
source, and thin where the source would have to be GVMC's own geometry.** The reservoir feed, the
wells and the shoreline measurement are comparable with the benchmarks; ward geometry and flood
hazard layers are not public for this city as far as I have found, and CPCB's 2019-2024 tables
list no river station in it.

## Route by route

| Route | Feature | Chennai | Bengaluru | Visakhapatnam | Grade |
|---|---|---|---|---|---|
| Dashboard | Hero | days-left (the reservoirs are the supply) | Cauvery pumping against design | supply overview on CGWB's GVMC table (dated June 2022) and GVMC's 2021 canal split | High, different by design |
| Dashboard | Reservoir sources | 6, daily | 4 upstream dams, daily | 6, of which 4 on APWRIMS daily with an archive from 2012 (Yeleru); 16,098 readings at cutover | High |
| Dashboard | Rainfall | 672 monthly records, 56 years | 672 / 56 | 672 / 56 (1970-2025), one land cell checked against official normals | High |
| Groundwater | Assessment units | 16 blocks | 6 | 11 mandals on IN-GRES's own polygons | High |
| Groundwater | Assessment editions | 8 | 9 | 3 (today's units exist from 2023-24); the map colours the 2025-26 IN-GRES edition, newer than CGWB's December 2025 report | Medium |
| Groundwater | Wells | 49 stations | 13 | daily recorders and manual wells as separate series, more series than sites, monthly means from May 2002 (counts in the stations file's `_note`) | High (XHigh against Bengaluru) |
| Groundwater | Ward depth surface | yes | no | no | Low |
| Water bodies | Polygons | 1,636 | 1,897 | 1,088 (OSM; 212 named) | Medium |
| Water bodies | Register layers | census, ranking, ward search, lost tanks | lost-tank inventory | ground-height bands only | Low |
| Rivers | Channels | 4 | 3 | 3 (a gedda, a river and a supply canal) | High |
| Rivers | Monitoring stations | 13 | 9 | 4, none on a river (2 reservoirs, a creek, a canal) | Low |
| Rivers | Station-years | 51 | 25 | 12 (2019-2024) | Low |
| Rivers | Mapped industrial sources | 7 | 14 | 2 map markers (only units with a published coordinate), name and type only; compliance counts for 2 CETPs published as data, not yet shown on the page; 6 dated events in the channel panels, among them the joint committee's list of discharges into the Meghadrigedda surplus course | Medium |
| Flood risk | Hazard layers | 5 | flood-prone zones and hotspots | 0; narrative variant with 6 dated events, each credited to its own source (IMD for five, the state's memorandum for 2024) | Low |
| Shoreline | Transects | 1,137 over 108 km of zones | N/A (landlocked) | 476 (421 reliable) over 53 km of zones, Appikonda to Pedda Nagamayyapalem, just north of Bheemunipatnam | High |
| Shoreline | Anchor | a published study's zones and hotspots | N/A | official stretch classes only: four zones Low Erosion (MoES 2024), four not on its erosion-prone list; NCCR's 1990-2016 figures are district totals | Medium |
| Lake restoration | Register | priority scoring, 1,787 water bodies | flagship register, 17 scored | 5 flagship cards and 11 AMRUT 2.0 projects; no court orders, no lost-tank list | Medium |
| Allocations | Arrangements | 5 | 2 | 14 claims; the delivered side is mostly one 2021 day | High |
| Commitments | Rows | 16 | 15 | 18 at measurement, mostly sewage; no row for the draft Green City Action Plan's target | High |
| Facts | Cards | dynamic pipeline | 32, static | static snapshot, cards by category | Medium |
| Origins | Story | yes | 4 chapters, with images | 8 chapters, no images | Medium |
| About | City section | yes | yes | every section of the shared frame with the city's own content: what we track, why there is no days-left number and the dashboard card by card, a subsection per page plus what is not shown and why, the AI layer (none yet), sources in eight groups of its own, data quality, its own known limitations and where official figures disagree | High |
| My ward | Ward geometry | 200 | 369 | 0 | Low |
| My ward | Localities | 519 | 369 | 0 | Low |
| Tanker | Panel | not built | survey panel | off | Low |
| Climate risk | Sub-basin risk | yes | not built | not built | Low |
| All | UI languages | English, Tamil | English, Kannada | English; Telugu not yet translated | Medium |

## Notes on the grades

- **The reservoir feed is the strongest layer.** APWRIMS gives daily level and storage for four dams
  with no login and an archive from 2012 for Yeleru, and the live-storage arithmetic reproduces
  CWC's weekly bulletin for Yeleru to within 0.04 percentage points. The scraper checks every dam's
  design values on every run. The archive from 2012 is in the database (16,098 readings at
  cutover) and refreshes daily from the local scheduled job. It is graded High, not XHigh, because
  Thatipudi and Raiwada carry two level records from late 2021 to 7 March 2024 (Thatipudi's about
  4.4 m apart on most days). I keep only the record APWRIMS has carried alone since 8 March 2024,
  from 7 September 2021 for Thatipudi and 13 December 2021 for Raiwada, so both lines have gaps
  until March 2024 and Thatipudi's steps where the kept record begins. I have not found which
  record the department treats as correct.
- **The wells are many series at fewer sites.** Most recorders stand at a manual well's site
  (every recorder installed in 2025-26 and most of the older piezometers), and the two are kept
  apart rather than spliced. The older recorders that carry different names in different station
  lists are left unpaired. The counts are stated once, in the `_note` of
  `visakhapatnam-cgwb-stations.json`. Counted by site, the layer is thinner than Chennai's 49
  stations and well ahead of Bengaluru's 13; the manual record reaches back to 2002 at some sites.
- **Groundwater editions are three by necessity.** IN-GRES publishes earlier editions under the same
  district id, but on a district split in 2022 and a single city unit split into seven mandals in
  2023-24. Joining them would show boundary changes as trends.
- **The hero is different by design.** Every reservoir behind the city except Mudasarlova is shared,
  and two lifts top the system up from the Godavari, so Chennai's days-left runway would be false
  here. The supply overview is the
  right kind of hero, though its table is GVMC's data as CGWB printed it in June 2022 and repeated
  unchanged since, which the dashboard says.
- **Allocations carry more rows than either benchmark,** but most received figures come from one day
  (11 March 2021), and several operative orders are cited by other documents but were not found.
  More claims, same thinness on delivery, so High rather than XHigh.

## Low, with reasons

| Feature | Why |
|---|---|
| Ward geometry, localities, My ward | The 98-ward polygons in circulation are a tracing of a GVMC CAD plot for which I have not found a licence, and GVMC notified 120 wards in 2026 with no public map that I have found. Not ours to fix: it closes when GVMC publishes boundaries |
| River stations and station-years | CPCB's 2019-2024 tables list no river-type station in Visakhapatnam or Anakapalli district. The four stations used are on reservoirs, a creek and a canal. A gap in stations, not a finding about the rivers |
| Flood hazard layers | I have not found a GVMC flood map, return-period zones or GVMC's own drain geometry; GVMC's 2015 draft disaster plan maps storm-water drainage zones only as a picture. The AP State Disaster Management Authority's GIS portal has a drain layer from a 2019 survey that covers GVMC, with no drain names or capacities and no licence statement that I have found, so the flood page mentions it and does not draw it. The only modelled flood maps I have found that cover the city are regional ones in VMRDA's draft Master Plan 2041. The narrative stack ships the event record, each event credited to its own source, and the gaps instead |
| Water-body register layers | The layer is OSM, with no official register behind it and no ward geometry to search by. No list of lost tanks is shown: I have not found a published official one |
| Ward depth surface | The well sites across eleven mandals are too few for a per-ward surface (counts in the stations file's `_note`) |
| Tanker | One published day of tanker trips (11 March 2021) is not a record |
| Climate risk | Buildable from HydroBASINS and not built: backlog, not a refusal |

## N/A or off by decision

| Route | Why |
|---|---|
| My ward | No licensable ward geometry (above) |
| Tanker | One day of data |
| Climate risk | Not built (backlog) |

Bengaluru's shoreline row is N/A because Bengaluru is landlocked; Visakhapatnam has no N/A row.
Every Low row above is an upstream publishing gap, a property of the data, or backlog.

## Where Visakhapatnam is deeper in kind, not count

1. **A checked daily reservoir feed.** Design values are re-read and compared on every run, and live
   storage agrees with CWC's independent bulletin.
2. **Two well networks kept honest.** The archive's carried-forward values, straight-line gap fills
   and spikes are removed and counted, and recorder and manual series at the same site stay separate
   so a change of method is not hidden.
3. **A coast with its harbours masked.** The two harbour basins are dropped. 48 of the 55
   low-confidence transects carry a named reason (breakwater, port-built shore, headland, river or
   stream mouth, or a jump of about 180 m or more in its measured waterline). The other 7 are
   marked low by the pipeline's own test on the positions from 2015 on: six scatter too far about
   their trend, and one has no reading after 2010. Their panel gives the general low-confidence
   note instead of a named reason. RK Beach is labelled as a nourished beach.

## What would move the grades

In rough order of value per unit of work:

1. **Settling Thatipudi's and Raiwada's two level records (late 2021 to March 2024)** with the
   Water Resources Department, so the days now left out can be restored on the right datum.
2. **Archival images with licences checked at source,** for Origins.
3. **The HydroBASINS climate-risk layer,** already built for Chennai.
4. **A Telugu translation by a native speaker.**
5. **Not ours, but decisive:** published geometry for GVMC's 120 wards (My ward, localities, ward
   search), a CPCB river station in the city, and published coordinates for APPCB's COMAPS
   stations, none of which I have found.

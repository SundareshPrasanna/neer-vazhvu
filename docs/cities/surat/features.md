# Features - Surat

What ships for Surat, and what each surface is doing differently from the Chennai baseline. Sources
and their traps live alongside in [data-sources.md](data-sources.md); measured parity is in
[parity-scorecard.md](parity-scorecard.md).

Surat is registered `enabled: false` and reachable only behind
`NEXT_PUBLIC_PREVIEW_CITIES=surat` until cutover.

## The shape of the city, and what follows from it

| Axis | Surat | Config consequence |
|---|---|---|
| Supply model | Run-of-river Tapi, abstracted at a weir-cum-causeway; upstream control is Ukai dam, operated by the state | `heroMode: 'flood-headroom'`. Not `days-left`: there is no stored volume to divide |
| Defining risk | Arrival, not scarcity | Flood is the dashboard, not a sub-page |
| Threshold data | Published by the operator alongside every reading | Headroom is stated as a subtraction, never modelled |
| Analytical unit | 9 zones | Ward surfaces off; zones carry live data and an official 2024 denominator |
| Groundwater | 94 stations over a district, 1970-2026 | Points, not an interpolated surface |
| Water bodies | 3,401 SAC polygons, 34 named | Basic map; no census, ranking, lost or cascade layers |
| Language | Gujarati | `gu` added to `LanguageCode`, carried in `upcomingLanguages` |

## Dashboard - the `flood-headroom` hero

The platform's **fifth generic hero mode**, and the reason it exists rather than reusing
Kolkata's fourth: `drainage-capacity` **models** exceedance of a design standard quoted from an
engineering document, while `flood-headroom` **states** distance to an operational trigger level
that the operator publishes beside the reading. One is an inference we draw; the other is a
subtraction.

Renders the chain in the order water travels it - rain over the city, Ukai, the weir-cum-causeway,
then five khadis - with the distance to each published threshold, and leads on the tightest margin
anywhere on the chain rather than an average.

Load-bearing behaviours, all deliberate:

- **No threshold is ours.** Every one is scraped from the publisher into `surat-flood-chain.json`.
  None is in config, precisely so config and source cannot drift apart silently.
- **Negative headroom renders as negative.** The causeway routinely sits above its overflow level
  during the monsoon and is closed; clamping that to zero would hide the true state.
- **No storage-history chart.** `reservoirHistoryAbsentNote` explains that Surat will never have
  one, rather than promising a chart that "fills in automatically" (the Delhi lesson: a live feed
  does not imply a storage series).
- **No 2006 comparison**, though today's release in cusec is directly comparable to it. The 2006
  figures are secondary-sourced and are held until primary.

Below the hero: the supply-at-a-glance card (single-source, so the mix reads 100%), the fact
strip, both water-source cards, and the rainfall panel.

## Origins - "The city the river made, unmade, and made again"

Eight chapters on a genuinely unusual arc: a city founded around a tank in 1516, made the richest
port in Mughal India because a rival harbour silted, unmade when its own harbour silted, nearly
killed in 1994 by drainage it had outgrown fifty-fold, and rebuilt around water management to the
point where it now sells its sewage back to industry.

Four licence-verified plates (CC0, public domain, CC BY-SA 4.0, GODL-India), each checked against
the Wikimedia Commons API at download time rather than trusted from a search result. Provenance in
`public/images/story/surat/MANIFEST.json`.

**Chapter 4 contains no numbers**, and says why in the text. It is the 2006 flood chapter.

## Rivers

The Tapi and the Mindhola, with CPCB NWMP across **six editions (2019-2024), 45 station-years** at
eight stations. The Tapi's seven Gujarat stations
form an upstream-to-sea profile, and reading them in order produces the finding the page leads on:
**BOD at or below detection limit through the city while conductivity climbs to 49,720 umhos/cm at
Hazira.** A salinity story, not a sewage one.

Geometry is OSM, because SMC's GIS serves rendered tiles only. OSM names neither of the five
monitored khadis, so the creeks central to the flood chain have no line on the map.

## Groundwater

94 India-WRIS stations, 6,563 readings, 1970-2026, rendered as click-through points.
`groundwaterViews.depth` and `.risk` are **off**: 94 stations across a district cannot support a
per-zone depth surface, the same call Madurai made at four. Raw telemetry values are carried
unaltered so the mixed-sign correction stays visible.

## Water bodies

3,418 polygons - the SAC wetland atlas plus 17 bodies OpenStreetMap maps and the atlas missed -
with area, inland/coastal, man-made/natural, turbidity and a decoded wetcode. 44 are named
(34 atlas, 10 from OSM by containment). Strong geometric base, weak semantic one, and the naming
gap is the source's.

`catchmentsGapNote` explains the absent cascade view as an editorial judgement rather than a
missing file: Surat's bodies are coastal wetlands, tidal creeks and urban talavs, not a chained
kanmoi or kere system.

## Flood risk

The corporation's own depth-classed footprint of the 2006 inundation, plus the live khadi network.
The discharge figures are absent for the reason Origins gives.

## Facts and Commitments

Seven static facts, each primary-cited. One of them is an absence: Surat publishes no measured
non-revenue water, and the page says why rather than filling the hole.

Three commitments, all from one dated corporation document and all owned by it: 70% reuse by 2030,
100% with zero liquid discharge by 2035, and comprehensive sewerage coverage by 2033. The sewerage
entry carries the caveat the slide itself supplies - its percentages predate the June 2020
extension that moved the denominator.

## About

Per-page methodology in Surat's own terms, including the three-way ward ambiguity, the eight-versus-
nine zone vintage conflict, and each named gap with an attribution of whose gap it is.

## Routes deliberately off

Each carries a written reason in `scripts/lib/exemptions.ts`, surfaced in
`docs/architecture/exemptions.md`.

| Route | Why |
|---|---|
| `my-ward` | Three incompatible ward schemes, none with downloadable geometry; WFS disabled on SMC's GIS |
| `allocations` | No published entitlement instrument exists - the ledger has no entitled half |
| `lake-restoration` | SMC restores lakes and publishes no register: no list, dates, budgets or status |
| `cascades` | Not a cascade geography |
| `tanker` | 95% piped coverage; tanker-served properties recorded NA in every year of the open data |
| `shoreline` | Genuinely coastal, but the surface still reads Chennai coastal data. Backlog, not refusal |
| `climate-risk` | Buildable from HydroBASINS L12, simply not built. Backlog, not refusal |

## Pipelines

| Script | Cadence | Notes |
|---|---|---|
| `scrape_smc_flood_chain.py` | **Daily, launchd noon IST** | Rolling ~10-reading window with no archive. Every missed day is lost permanently. |
| `build_surat_artifacts.py` | Manual | Groundwater, water bodies, river quality, supply, rivers, facts, commitments. Asserts the two synthetic open-data ratios still hold. |
| `generate_imd_rainfall.py` | Quarterly | Grid point 21.25/72.75, chosen inland because the westward cells fall over the Arabian Sea |
| `fetch_recent_rainfall.py` | Daily | Open-Meteo provisional fill after IMD's last month |

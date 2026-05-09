# Madurai - features and methodology

> Detailed feature inventory for Madurai, including how it differs from Chennai. The high-level overview lives in [README.md](../../../README.md); the data-source breakdown in [data-sources.md](data-sources.md).


Madurai is a first-class second city with a meaningfully different surface area. The headline difference: Chennai's reservoirs ARE the urban water supply (CMWSSB owns and operates them), so a "Days of Water Left" calculation against urban demand is honest. Madurai's tracked dams (Vaigai, Mullaperiyar, Sothuparai) are upstream irrigation reservoirs operated by PWD/WRD and shared across multiple districts; only a small allocated slice is for drinking water. Dividing total dam storage by city demand would overstate runway by an order of magnitude. So the Madurai dashboard hero is fundamentally different.

### Dashboard (Madurai-specific surfaces)
- **Allocation Hero** (replaces Days of Water Left) - Vaigai live storage % + four anchored stats: annual sanctioned drinking-water allocation (1,500 mcft/yr per MMC), recent annual draw (~900 mcft = 70 MLD), allocation utilisation, and Pannaipatty WTP capacity (118.6 MLD existing, 243.6 MLD planned post-Tranche 2). No misleading days-of-water headline.
- **Urban Supply Overview tile** - Structural at-a-glance derived from the ADB TNUFIP Tranche 2 IEE Parts 1-3 (December 2025): supply chain (Mullaperiyar -> Vaigai -> Pannaipatty 118.6 MLD WTP -> 28 existing OHTs across 28 distribution zones / 81 District Metering Areas -> 764 km mains -> 95,487 connections), source mix (7 schemes summing to 192 MLD: Vaigai surface 115 + Vaigai sub-surface 47 + Cauvery via Melur 30), and 2034 demand 317 MLD with 125 MLD gap. Tranche 2 adds 37 OHTs (+58.9 MLD storage) and Pannaipatty +125 MLD; Tranche 3 adds 813 km new pipelines and a 100% household-coverage target across 115 newly-established DMAs.
- **Reservoir Cards** - Vaigai + Mullaperiyar live; Sothuparai renders as a `MissingDataCard` (dashed border, hatched bar) because TN Agriculture's daily feed doesn't cover it.
- **Data Gap Panel** - "What's missing today" explicitly lists the daily-operations layers MMC's ICCC SCADA tracks but doesn't publish (WTP intake/output, OHT levels, zone supply, NRW, LPCD).

### Groundwater Map (Madurai)
Different methodology because the four India-WRIS live stations across Madurai district are too sparse to honestly interpolate a 100-ward depth choropleth. Instead we surface:
- **Block-level CGWB exploitation** - 11 GWR blocks tile MMC; Madurai West sits at 105.8% (Over Exploited).
- **CGWB Year Book point overlay** - 21 manually monitored wells with quarterly readings, sourced from the Tamil Nadu Ground Water Year Book 2023-24 + 2024-25.

### Water Bodies (Madurai)
- 715 OSM water bodies (638 named via OSM Nominatim) + 19 flagship-curated tanks (DHAN Foundation + Madras HC PIL anchors) + 26 documented lost tanks (Vencatesan 2014).
- Restoration priority uses a **different algorithm** than Chennai: 4 components (status_severity, cultural_bonus, size, confidence_multiplier) instead of Chennai's 6-component spatial model. Output: `public/data/restoration-priority-madurai.json` (17 scored bodies).
- Flagship-curated bodies have no OSM polygon, so they render as `<Circle>` markers in a high-z pane to stay clickable above polygons.

### My Ward (Madurai)
- 100 MMC wards (vs Chennai's 200 GCC wards). Same UI shape (selector, cards, comparison table, report card) but with Madurai-honest data.
- Ward-risk composite is a **3-factor reduced variant** (water bodies, lost bodies, groundwater) since Madurai lacks the 5-factor inputs Chennai uses (no public flood / drainage / sewerage layers).
- Cards for sections we don't yet have data for render as honest "not yet sourced" disclaimers - branched on a `_data_status: "not_available"` marker emitted by the compute script.
- Per-city quick actions + helplines (MMC + TWAD instead of GCC + CMWSSB).

### Rivers (Madurai)
- CPCB NWMP coverage: 2 stations (Vaigai U/S Madurai 10059, D/S Madurai 10060). Vaigai dam, Andipatti, Manamadurai, Ramanathapuram are seeded for future expansion.
- River status badges (`dead`, `severely_degraded`, `degraded`, `stressed`, `healthy`) are computed from current readings via CPCB Designated Best-Use class thresholds (`src/lib/utils/river-classification.ts`), shared with Chennai. Vaigai reads "Degraded" today (Anuppanadi BOD ~4.2 mg/L fails Class B/C, meets Class D fisheries).
- Court orders + key events panel surfaces the December 2024 Madras HC suo motu cognisance (177 sewage / industrial discharge points across 5 districts) and the 2014 Mullaperiyar SC verdict (142 ft storage cap).

### Flood Risk (Madurai)
Narrative-only stub - no known public CFLOWS-equivalent hazard layer for Madurai. The page surfaces the Vaigai dam-release threshold (~6,000 cusecs as Madurai-city flood warning, 12,000+ during 2018) as the operational signal. Drainage / sewerage GeoJSONs aren't publicly published either; tracked as RTI follow-ups to MMC.

### About (Madurai)
- **Supply chain explainer** (Mullaperiyar -> Vaigai -> Pannaipatty -> MMC distribution -> 96k connections -> tap)
- **What's missing today** - institutional gaps reframed as observation, not demand
- **How we classify river health** - documents CPCB Best-Use vs PRS Priority methodology
- **Open data gaps in Madurai** - per-layer workarounds + RTI tracker

### Long-form story (Madurai)
- `/madurai/origins` - long-form water history (EN + TA), parallel to Chennai's `/origins`


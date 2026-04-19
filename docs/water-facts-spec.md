# Chennai Water Facts - Page Spec

**Route:** `/facts`
**Goal:** Journalist-ready, quote-safe snapshot of Chennai water state. Every number dated, sourced, vintage-labelled.
**Design principle:** Surface conclusions, not exploration tools. Tiered by data freshness so staleness is explicit.

## Layout

- Single scrollable page
- 4 sections by freshness tier
- Tier 1 expanded by default; Tiers 2, 3, 4 collapsed (user can expand)
- Sticky table of contents in sidebar (desktop) / top anchor bar (mobile)
- Prominent "As of {date}" banner + download PDF press kit button at top
- Methodology & data sources appendix at bottom
- Each card has: number, unit, interpretation, source link, vintage badge, copy-quote button, share link

## Fact cards

### TIER 1 · TODAY (Live - updated daily/weekly, auto-computed)

Section banner: *These numbers auto-update from live monitoring feeds. Cadence and timestamp on each card.*

| # | ID | Card title | Number (live formula) | Interpretation | Source | Cadence |
|---|---|---|---|---|---|---|
| 1 | `reservoir-today` | Reservoir storage today | `{sum(current_storage_mcft)}` MCFT (`{storage_pct}%` of `{total_capacity}` MCFT capacity) | Chennai's 6 combined reservoirs are {pct}% full today. | CMWSSB daily scrape (`reservoir_daily`) | Daily |
| 2 | `day-zero-compare` | Today vs 2019 Day Zero | Today: `{today_mcft}` MCFT &middot; Same day 2019: `{2019_mcft}` MCFT | Chennai's reservoirs today are `{diff}` MCFT `{higher/lower}` than same date during the 2019 Day Zero crisis (when reservoirs were effectively dry at ~19 MCFT usable). | CMWSSB + 2019 archive (`DAY_ZERO_2019.totalStorageMcft = 19.0`) | Daily |
| 3 | `days-since-rain` | Days since substantive rain | `{days}` days | It has been {days} days since Chennai received more than 5mm of rain. | Open-Meteo daily | Daily |
| 4 | `rainfall-last-30d` | Rainfall last 30 days | `{mm}` mm (`{pct}%` of 30-day normal) | Chennai received {mm} mm in the last 30 days - {pct}% of the 1970–2020 IMD normal for this period. | Open-Meteo + IMD gridded | Daily |
| 5 | `monsoon-progress` | NE monsoon 2025 delivery | `{pct}%` of normal cumulative | The 2025 northeast monsoon (Oct–Dec) delivered {pct}% of Chennai's 50-year average NE monsoon rainfall. | IMD gridded data | Daily during monsoon |
| 6 | `water-body-area-change` | Water body area change (24 months) | `{net_ha_change}` ha net | Across 150 tracked water bodies, satellite data shows a net {change} ha change over the last 24 months. | GEE Sentinel-2 NDWI | Monthly |
| 7 | `water-body-biggest-loser` | Biggest-shrinking water body (24 months) | `{name}`: −`{pct}%` area | {name} has lost {pct}% of its surface area since {start_date} - the largest relative decline among the 150 tracked. | GEE satellite | Monthly |
| 8 | `water-body-biggest-gainer` | Biggest-growing water body (24 months) | `{name}`: +`{pct}%` area | {name} has grown {pct}% in surface area since {start_date}. Consistent with restoration, rainfall retention, or seasonal hydrology - causal attribution requires field verification. | GEE satellite | Monthly |

**Card count:** 8

---

### TIER 2 · THIS YEAR (Annual - latest published government data, year-stamped)

Section banner: *These numbers are the latest publicly-released data from government agencies. Each card shows its vintage year and next expected update. When agencies are slow to publish, we flag it.*

| # | ID | Card title | Number | Interpretation | Source | Vintage |
|---|---|---|---|---|---|---|
| 9 | `cgwb-over-exploited-blocks` | CGWB over-exploited blocks | 13 of 16 Chennai blocks | **81% of Chennai's groundwater blocks are classified "Over-Exploited"** by CGWB - water drawn exceeds recharge. Only 2 blocks remain "Safe." | CGWB Dynamic GW Resource Assessment | 2024 assessment (published 2025) |
| 10 | `over-exploited-block-names` | Blocks in crisis | Ambattur, Tondiarpet, Velacheri, Mambalam, Mylapore, Egmore, Aminjikarai, Maduravoyal, Guindy, Perambur, Ayanavaram, Purasaivakkam, Thiruvottiyur | 13 named Chennai blocks are drawing groundwater faster than they recharge. | CGWB 2024 | 2024 assessment |
| 11 | `cooum-do-2022` | Cooum oxygen collapse | 0.0 mg/L | At Cooum's Central Jail station, dissolved oxygen dropped to 0.0 mg/L in 2022 - aquatic life cannot survive. CPCB's Class D criterion for "Propagation of Wildlife and Fisheries" requires DO ≥ 4 mg/L. (WHO does not publish a health-based DO guideline.) | CPCB NWMP station 10045; threshold: CPCB designated-best-use criteria | 2022 data, 2024 report |
| 12 | `cooum-bod-2021` | Cooum sewage load peak | 177 mg/L | Peak annual midpoint BOD on the Cooum reached 177 mg/L at Amanjikarai in 2021 - a clean river is <2 mg/L. | CPCB NWMP station 10042 | 2021 data |
| 13 | `buckingham-do-2024` | Buckingham Canal DO collapse | 0.3 mg/L | Dissolved oxygen at Buckingham Canal (Ice House) fell to 0.3 mg/L in 2024 - the canal effectively functions as an open drain. | CPCB NWMP station 0054 | 2024 data |
| 14 | `ward-gw-crisis` | Wards at crisis groundwater depth | `{count}` wards | `{count}` Chennai wards show groundwater depth at >25m (crisis threshold) in the latest 2024 CMWSSB data. | CMWSSB piezometer network via OpenCity | 2024 data |
| 15 | `data-gap-gw` | Data Transparency Watch: groundwater | 18 months | Chennai's ward-level groundwater depth data was last published in November 2025, covering 2024. No 2025 data has been released - 18 months of monitoring is currently unavailable to the public. | OpenCity / CMWSSB | Meta-fact |

**Card count:** 7

---

### TIER 3 · CHENNAI WATER HISTORY (Historical / milestone reference)

Section banner: *Reference facts from documented events and peak records. These are historical markers, useful for context - not claims about current state.*

| # | ID | Card title | Number | Interpretation | Event/Source |
|---|---|---|---|---|---|
| 16 | `day-zero-2019` | 2019 Day Zero | 0 MCFT | On 19 June 2019, Chennai's 4 main reservoirs hit 0 MCFT of usable storage. City-wide piped supply collapsed. 700–900 CMWSSB tankers made 9,700 trips/day. | CMWSSB archive |
| 17 | `2015-floods` | 2015 Chennai floods | up to 494 mm at one station | In December 2015, Chennai region rainfall ranged from 77 mm to 494 mm across monitoring stations, with a 24-hour regional average of 286 mm (per World Weather Attribution). Over 3 million people lost basic services; economic damage estimated at US$3 billion. 327 GCC-identified flood hotspots documented; 192 crowd-sourced depth readings of 5-60 ft in inundated areas. WWA analysis found no detectable climate-change signal in the one-day extreme rainfall. | WWA + GCC + IIT Madras |
| 18 | `cflows-hazard-zones` | Flood hazard mapping vintage | CFLOWS 1.0 (Nov 2019) | Chennai's public flood hazard map is based on the CFLOWS model operationalized in November 2019 by IIT Bombay + IIT Madras + NCCR. The model has not received a public update since. 11 wards are classified "very high" hazard. | NCCR / OpenCity Chennai |
| 19 | `pallikaranai-loss` | Pallikaranai Marsh decline | ~6,000 ha → ~593 ha | Pallikaranai Marsh shrunk from an estimated ~6,000 hectares (mid-1900s baseline) to ~593 hectares as reported in 2016 research. A 90%+ loss attributed to decades of encroachment, landfilling, and sewage dumping. Current extent may differ as some restoration and further loss have occurred since; we surface this figure as a historical marker, not as today's value. | Nagendran et al. 2016 (ResearchGate 312003950) |
| 20 | `restoration-projects` | Major river restoration projects | Rs 4,450 Cr | Chennai Rivers Restoration Trust is executing 9 major projects (3 complete, 3 in progress, 3 planned) with a combined budget of Rs 4,450 Cr. | CRRT (crrt.tn.gov.in) |

**Card count:** 5

---

### TIER 4 · INFRASTRUCTURE (Structural - changes on multi-year scales)

Section banner: *Chennai's water system at a glance. These numbers reflect installed capacity, inventory, and structural facts that change slowly.*

| # | ID | Card title | Number | Interpretation | Source |
|---|---|---|---|---|---|
| 21 | `stp-capacity-vs-demand` | Sewage treatment capacity gap | 745 MLD installed · ~1,073 MLD generated (independent estimate) | Chennai officially operates 13 sewage treatment plants with 745 MLD installed treatment capacity (CMWSSB, 2026). Independent academic estimates place daily sewage generation at ~1,073 MLD; the resulting ~328 MLD gap flows untreated into rivers, canals, and the sea. Labelled separately: the 745 MLD figure is official inventory; the 1,073 MLD figure is an independent estimate. | CMWSSB (installed); Arappor Iyakkam / academic sources (generation estimate) |
| 22 | `desalination-capacity-status` | Desalination capacity and status | 200 MLD installed · operating output varies | Minjur (100 MLD, since 2010) and Nemmeli (100 MLD) together represent 200 MLD of installed desalination capacity - roughly 20% of Chennai's piped supply when both run at full capacity. Operating output has varied: Minjur operating status has been affected by maintenance, and CMWSSB has cut Nemmeli output during periods when reservoir storage is high (TNIE, Feb 2026). This card reports installed capacity, not current production. | CMWSSB water supply page (installed); TNIE Feb 2026 (operating context) |
| 23 | `reservoir-total-capacity` | Total reservoir capacity | 13,222 MCFT | Chennai's 6 storage reservoirs (Poondi, Cholavaram, Puzhal, Chembarambakkam, Thervoy Kandigai, Veeranam) have a combined capacity of 13,222 MCFT (~374 million cubic metres) per the CMWSSB lake level page as of April 2026. | CMWSSB lake level page |
| 24 | `water-body-inventory` | Documented water bodies | 305 / 433 | Chennai's 2018–19 Census of Water Bodies documented 305 bodies. Cross-referenced with current OSM and satellite data, 433 water bodies are currently tracked across 200 wards. | Census 2018–19 + Neer Vazhvu |
| 25 | `piped-supply-demand` | Piped supply vs demand | ~1,040 MLD vs 2,232 MLD | CMWSSB delivers ~1,040 MLD against an estimated city demand of 2,232 MLD - a ~52% gap filled by groundwater extraction, desalination, and the ~15,000-tanker informal water market. | CMWSSB + academic estimates |

**Card count:** 5

---

## Total: 25 fact cards across 4 tiers

- Tier 1 Live: 8
- Tier 2 Annual: 7
- Tier 3 History: 5
- Tier 4 Infrastructure: 5

## Card component spec

```
┌───────────────────────────────────────────┐
│ [TIER ICON] [CATEGORY]     [VINTAGE BADGE]│
│                                           │
│           BIG NUMBER                      │
│           unit/label                      │
│                                           │
│ Interpretation sentence that makes the    │
│ number immediately understandable.        │
│                                           │
│ Source: [link] · As of: [date]            │
│                                           │
│ [📋 Copy quote] [🐦 Tweet] [🔗 Link]     │
└───────────────────────────────────────────┘
```

### Copy-quote format

Every card's copy button produces:
> `{interpretation_sentence} Source: {source_citation}. Data as of {vintage_label}. Reference: neer-vazhvu.org/facts#{card_id}`

Example for card 11:
> "At Cooum's Central Jail station, dissolved oxygen dropped to 0.0 mg/L in 2022 - aquatic life cannot survive. CPCB's Class D criterion for Propagation of Wildlife and Fisheries requires DO ≥ 4 mg/L. Source: CPCB NWMP station 10045, annual report 2024. Reference: neer-vazhvu.org/facts#cooum-do-2022"

### Tweet format

> "{short_interpretation} via @neervazhvu neer-vazhvu.org/facts#{card_id}"

### Vintage badge colours

- 🟢 Green "Live · {timestamp}" - Tier 1
- 🟡 Amber "As of {year}" - Tier 2
- ⚪ Grey "Historical · {year}" - Tier 3
- 🔵 Blue "Structural" - Tier 4

## Canonical fact data model

Every fact card is rendered from a single canonical object. The same object powers the card UI, the copy-quote button, the JSON API, the PDF press kit, and the JSON-LD structured data. Maintaining one source of truth prevents drift between what the card shows and what a journalist pastes.

```typescript
interface Fact {
  // Identity
  id: string;                    // stable slug for URL anchors (e.g., "cooum-do-2022")
  tier: 1 | 2 | 3 | 4;           // freshness tier (live / annual / historical / structural)
  category: string;              // section grouping (e.g., "rivers", "groundwater")

  // Headline
  title: string;                 // card title
  value: string | number;        // the big number (e.g., "0.0")
  unit: string;                  // unit label (e.g., "mg/L", "MCFT", "ha")
  interpretation: string;        // one-sentence story that makes the number meaningful

  // Temporal
  data_date: string;             // ISO date the observation refers to (e.g., "2022-01-01" for annual 2022)
  published_date: string | null; // when the source published this value
  retrieved_at: string;          // when we last fetched / ingested
  computed_at: string | null;    // when we last computed (for Tier 1 derived numbers)

  // Provenance
  source_url: string;            // canonical URL for the raw data
  source_label: string;          // human-readable source citation (e.g., "CPCB NWMP station 10045")
  method_id: string;             // slug referencing the methodology note in the appendix

  // Quality
  confidence: "high" | "medium" | "low";
  claim_status: "observed" | "modelled" | "estimated" | "historical";

  // Presentation
  quote_text: string;            // the full paste-ready quote produced by the copy button
  threshold?: {                  // optional comparison benchmark
    value: number;
    source: string;              // e.g., "CPCB Class D"
    label: string;               // e.g., "Propagation of Wildlife and Fisheries"
  };

  // i18n
  title_ta: string;
  interpretation_ta: string;
  quote_text_ta: string;
}
```

Rules:
- `interpretation` and `quote_text` are the only free-text fields; they must never contain values that aren't in the structured fields (the number itself, date, source) so we can guard against drift via a schema check.
- `data_date` vs `published_date` vs `retrieved_at` must all be rendered so journalists can cite the correct date (observation date is usually what matters for a quote).
- `claim_status` drives the vintage badge: `observed` → green/amber depending on tier, `modelled` → orange warning, `historical` → grey.

## Technical notes

- Server-side render (SSR) for SEO
- Tier 1 numbers computed at request time from Supabase queries (same queries as existing routes where possible)
- Tier 2-4 numbers from `public/data/*.json` files at build time (revalidated daily)
- JSON-LD uses the Schema.org [`Observation`](https://schema.org/Observation) type per fact, with properties `observationDate`, `value`, `unitText`, `measurementMethod`, and a `citation` referencing the source dataset/report. `Statistic` is not a Schema.org type; avoid it.
- `/api/facts` returns all `Fact` objects as JSON for RSS, embed, partner integrations
- Each card has a stable `id` field for URL anchors + JSON lookups
- Puppeteer-generated PDF press kit: `/facts/press-kit.pdf`
- i18n keys for all card titles and interpretation sentences (Tamil parity required)

## Verified source URLs

| Source | URL | Used for |
|---|---|---|
| CMWSSB Lake Level | https://cmwssb.tn.gov.in/lake-level | Reservoir storage (live), total capacity |
| CMWSSB Water Supply System | https://cmwssb.tn.gov.in/water-supply-system | Piped supply, desalination installed capacity |
| CMWSSB Sewerage System | https://cmwssb.tn.gov.in/sewerage-system | STP count (13), installed capacity (745 MLD) |
| CPCB Water Quality Criteria | https://cpcb.nic.in/water-quality-criteria/ | Class D DO threshold (≥ 4 mg/L) |
| WHO Drinking Water Guidelines | (cited for fluoride, nitrate, arsenic etc.; DO has no WHO threshold) | Future groundwater quality cards |
| World Weather Attribution - Chennai floods | https://www.worldweatherattribution.org/chennai-floods-december-2015/ | 2015 station rainfall range 77-494 mm; no climate attribution |
| TNIE - Nemmeli output cut | https://www.newindianexpress.com/cities/chennai/2026/Feb/09/chennai-metro-water-supply-cuts-nemmeli-plant-output-as-lakes-near-full-capacity | Desalination operating-vs-installed context |
| Pallikaranai 593 ha (Nagendran et al. 2016) | https://www.researchgate.net/publication/312003950_Characterization_and_Management_Concerns_of_Water_Resources_around_Pallikaranai_Marsh_South_Chennai | Pallikaranai historical extent vintage |
| NCCR CFLOWS 1.0 brochure | https://www.nccr.gov.in/sites/default/files/C-FLOWS%20Brochure.pdf | Flood hazard model vintage (Nov 2019) |
| India WRIS | https://indiawris.gov.in/ | Groundwater stations (live telemetric) |
| CGWB Dynamic GW Assessment | https://cgwb.gov.in/ | Block exploitation classes |
| OpenCity Chennai | https://data.opencity.in/ | Ward GW depth (via CMWSSB), flood hazard redistribution |

## Staleness handling

- Tier 1 cards show last data timestamp; if >24h stale, show amber warning ("Data refresh overdue")
- Tier 2 cards always show vintage year prominently; cannot be mistaken for current
- Tier 3 cards are framed as historical markers, not current claims
- Tier 4 cards show source date; most don't need to "update"
- Meta-facts (like card 15) actively flag data gaps as newsworthy

## Methodology appendix (bottom of page)

- Full list of data sources with links (same as /about data sources section)
- Computation notes for every fact (how the number is derived)
- Update cadences
- Contact email for corrections

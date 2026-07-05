# Data Sources - Mumbai

> Where each Mumbai dataset comes from, how often it refreshes, and what to watch out for.

Mumbai is the fourth onboarded city, modelled as the full Metropolitan Region (9 corporations). Its data landscape has a defining quirk: **the official BMC lake-level page is a SAP portal iView that renders only inside a browser session** - it cannot be scraped and shows nothing to a curl. Every live number therefore comes from state-level feeds (Maharashtra WRD) and document mining (BMC's own reports via RTI manuals, ESR, climate budget; Praja Foundation's RTI-sourced tables). The hedging principle from the Madurai docs applies throughout: absence claims are "no known public X".

## Reservoir storage - WRD Pravah (daily, 5 of 7 BMC lakes)

| | |
|---|---|
| **Source** | Maharashtra WRD "Pravah" dam-safety bulletin - a daily all-Maharashtra PDF (139 dams). Stable human entry: `mwrdpravah.in/damsafety/control/main`; the PDF endpoint (`.../pdfLatestReportEng`) is what the scraper parses |
| **Method** | `neer-vazhvu-api/scripts/scrape_pravah_dams.py`, daily via `.github/workflows/pravah-dam-refresh.yml` (09:30 IST) |
| **Coverage** | Bhatsa, Upper/Middle Vaitarna, Modak Sagar, Tansa (~97% of BMC system capacity). **Vihar + Tulsi have no public feed at all** |
| **Gotchas** | Cert chain incomplete (fetch with verification off); dated URLs 404 - only "latest" works; per-dam timestamps stagger, so rows are stamped with the report date; the bulletin's same-date-last-year column is harvested too, so every run grows the history at both ends; the PDF endpoint intermittently serves an OFBiz error page (the workflow tolerates failed runs) |
| **Table** | `reservoir_daily_v2` (city_id='mumbai'), upsert on (city_id, source_code, date) |

Also parsed but not written as city rows: Barvi (eastern-corridor corporations) and the Surya scheme's Dhamni/Kawdas (western corridor) - these feed the regional corporation cards via `public/data/mmr-dam-storage.json`.

## Reservoir history - CWC weekly bulletins (2015-2025 backfill, one-off)

| | |
|---|---|
| **Source** | Central Water Commission weekly Reservoir Storage Bulletin PDFs (`cwc.gov.in/reservoirs-storage-bulletin`, 527 bulletins, 16-Apr-2015 → 08-May-2025 where the archive ends) |
| **Method** | `neer-vazhvu-api/scripts/backfill_cwc_reservoirs.py` - listing-page scrape (URL naming drifts across eras), pdftotext, four table-format eras handled, FRL sanity anchors against misparses |
| **Result** | 996 rows: Bhatsa 498 weekly dates + Upper Vaitarna 502, 2015-2025. Insert-only-missing - the backfill never overwrites the live feed |
| **Gotchas** | ~20 weeks of 2022 are 404 on CWC's own server (unrecoverable); bulletin titles contain typos, so the per-dam row date is the date of record; old-era dates are US-style M/D/YYYY |

## Supply structure - BMC's own documents

| | |
|---|---|
| **Sources** | BMC Hydraulic Engineer RTI manuals (Dec 2024), BMC Environment Status Report 2024-25 (first mined here: supply pair 4,000 vs 4,505 MLD; per-source yield Table 9.1; sewage Table 11.5 - 2,723 MLD installed vs 1,313 reaching plants), MCGM O&M handbook, 2018 24x7 White Paper, BMC Climate Budget 2025-26 (via OpenCity) |
| **Feeds** | `public/data/mumbai-supply-overview.json` (structural tile), facts, commitments entries |
| **Refresh** | Annual/on-publication (document calendar, not a cron) |

## Ward-level equity feedstock - Praja Foundation

| | |
|---|---|
| **Source** | Praja Foundation, *Status of Civic Issues in Mumbai* (May 2025; RTI-sourced tables). praja.org is poorly indexed - the OpenCity mirror is the reliable fetch |
| **Data** | Connections 5,51,459 as on Mar-2025 per ward (building-level - one connection often serves a whole society or chawl); 24-ward supply hours (city 5.37 h/day; T ward 24 h; C ward 1.5 h); yield→losses→supply reconciliation (4,370 − 395 = 3,975 MLD); per-ward %-unfit samples 2020-24; shortage complaints +64% |
| **Feeds** | `public/data/mumbai-ward-water-praja.json` (ward-equity build feedstock - no UI yet), supply overview, facts |
| **Refresh** | Annual (the 2026 edition launched 30-Jun-2026; PDF lands on praja.org ~late July) |

## Rainfall - IMD gridded + Open-Meteo provisional (two layers)

| | |
|---|---|
| **Backbone** | IMD 0.25° gridded rainfall via imdlib (1970-present, grid point 19.0/73.0) - authoritative history + normals; refreshed quarterly (`imd-rainfall-refresh.yml`, Mumbai included); publishes with weeks-to-a-year lag |
| **Provisional layer** | Open-Meteo archive API (ERA5-family reanalysis, CC BY 4.0), daily precipitation from IMD's last published month through yesterday; `fetch_recent_rainfall.py`, daily via `rainfall-recent-refresh.yml` (08:15 IST). Rendered as asterisked provisional months; IMD wins wherever both cover a month |

## Groundwater - CGWB (static, honest gaps)

Mumbai City + Mumbai Suburban are the only 2 of Maharashtra's 35 districts **excluded from the CGWB Dynamic Ground Water Resources Assessment** - no safe/critical/over-exploited categories exist. What we surface instead: CGWB National Hydrograph Network wells transcribed from the Ground Water Year Book of Maharashtra (~53 wells across Mumbai/Thane/Palghar/Raigad, to Jan-2025, with water chemistry), via `public/data/mumbai-cgwb-stations.json`. WRIS has ~24 stale manual wells (ending May 2023) - documented, not used as a live layer.

## Rivers - MPCB + CPCB

| | |
|---|---|
| **MPCB** | Annual Water Quality Status reports (5 editions mined; **2019-20 was never published**): Mithi station 2168 annual-avg BOD series 45.3 → 18.3 → 28.2 → 37.3 → 53.0 (2023-24, WQI 32); Ulhas mainstem consistently clean; **Waldhuni is not an MPCB station** - no public series exists. FC units are inconsistent across editions (directional only) |
| **CPCB** | Polluted River Stretches for Restoration of Water Quality - 2025 (Oct 2025, on 2022-23 data): the Mithi at Mahim is **India's worst stretch** (Priority I, max BOD 210 mg/l); the Ulhas is Priority V (least severe); Dahisar/Poisar/Oshiwara/Waldhuni are not in the national list at all |
| **Feeds** | `public/data/river-quality-mumbai.json` (`mpcb_wqr_series` blocks; note the rivers `notes` field is a STRING, not a list), facts |

## Flood - BMC register + WRD flood lines

| | |
|---|---|
| **BMC flood spots** | Chronic-flooding register scraped weekly (`bmc-floodspots-refresh.yml`, Mondays); the list grew 386 → 453 → 496 across recent years while the climate budget tracks mitigation as a KPI |
| **WRD flood lines** | The legal red/blue flood-boundary map sheets (blue = 25-yr level, construction prohibited; red = 100-yr, restricted): 41 sheets for 6 MMR rivers from WRD's 494-sheet statewide list (`wrd.maharashtra.gov.in/Site/1315/Flood-Line-Maps`). Scanned A0 plots, not georeferenced - linked as cited documents (`public/data/flood-lines-mumbai.json`); georeferencing into an overlay is a logged follow-up. **Named gap**: BMC publishes no equivalent for the city's own rivers |
| **26/7/2005** | Reference layer from the Chitale Fact-Finding Committee record + curated hotspot geojson |
| **iFLOWS** | Built with public money, briefs officials only - documented as a transparency gap |

## Allocation instruments (the Ledger's paper)

WRD Government Resolutions via the orgpedia mahGRs mirror (the way to full-text-search Maharashtra GRs; e.g. BMC's Bhatsa share, GR 11-Sep-2019, 427.93 Mm³/yr), STEM Water's own board minutes (8-Dec-2016, on environmentclearance.nic.in: 285 MLD sanctioned), MBMC's official supply page (211 = STEM 86 + MIDC 125), MMRDA Annual Report 2021-22 (Surya allocation 146.33 Mm³/yr), EC compliance tables. **Not public**: STEM's Thane/Bhiwandi split, MIDC per-buyer quantities, the MWRRA entitlement register (page literally "Under Construction"), Barvi sharing GR 18-Sep-2017 (number known, PDF unretrievable), BMC→Thane 90 MLD instrument - all named in the Ledger's gaps section.

## Spatial

DataMeet Mumbai 24-ward boundaries (`public/geojson/mumbai-wards-2023.geojson`), corporation boundaries 2024, OSM water bodies/rivers/drainage, FABDEM-derived lake catchments (`public/data/cascade/mumbai-*`), GEE MNDWI shoreline transects (`public/geojson/mumbai-coastal-transects.geojson`).

## Retired / rejected sources

- **numerical.co.in** (a third-party mirror of the BMC lake feed): died with 500s in 2026 and appears SEO-gamed; scraper, workflow step and all citations removed. The DB never held rows from it.
- **India-WRIS reservoir module**: unreachable in repeated probes; CWC PDFs used instead.
- **IMD AWS city endpoints**: 403 to non-browser clients.

# Chennai - features and methodology

> Detailed feature inventory for Chennai. The high-level overview lives in [README.md](../../../README.md); the data-source breakdown in [data-sources.md](data-sources.md).

## Features

### Dashboard
- **Days of Water Left** - Three-scenario estimate (pessimistic / current trend / seasonal rains)
- **Reservoir Cards** - Live storage, inflow, outflow, and rainfall for all 6 reservoirs
- **Catchment Rainfall Context** - CHIRPS-based 30-day and 90-day catchment signals for the 4 core Chennai supply reservoirs, summarized as below / near normal / above normal
- **Per-Reservoir Drilldown** - Click any reservoir for 365-day charts (storage, inflow vs outflow, rainfall)
- **Historical Comparison** - Overlay any year from 2019-2025 on the storage trend chart
- **Storage Trend Chart** - 90-day combined storage with interactive year comparison
- **Rainfall Trends** - 56-year IMD rainfall history (1970-2025) with annual bar chart color-coded for drought/flood/Day Zero years, plus monthly actual vs long-term normal comparison

### Groundwater Map
- **Choropleth Map** - Depth to water table across all 200 GCC wards, color-coded by CGWB classification (Healthy to Crisis)
- **Risk Score View** - Toggle between depth choropleth and composite risk score choropleth (Low / Moderate / High / Critical) when pipeline data is available
- **CGWB Exploitation View** - Block-level groundwater exploitation from India WRIS/CGWB (2011-2024), showing Safe/Semi-Critical/Critical/Over-Exploited classification with development percentage trends
- **Live CGWB Station Overlay** - ~35 CGWB/India WRIS stations in Chennai district plotted as circle markers over the ward choropleth, mixing Manual (quarterly dug wells) and Telemetric (daily DWLR bore wells) with well type, well depth, and aquifer type in the station panel
- **Sensor Data Quality Layer** - Each station is scored server-side with a `stuck` / `stale` / `ok` flag (stuck detection uses median daily delta < 1cm over 60 days; stale is mode-aware - 14 days for DWLR, 180 days for manual). Suspect stations render with a dashed amber ring and get an explicit warning banner in the panel, and the legend exposes filters so reviewers can hide them
- **Ward Detail Panel** - Click any ward for depth, year-over-year trend, historical chart, and composite risk score breakdown
- **Block Detail Panel** - Click any exploitation block for development %, availability, draft totals, and historical trend bar chart with 100% threshold line
- **Risk Score Breakdown** - Each of the four components (groundwater depth 40%, trend 30%, reservoir stress 20%, seasonal 10%) shown with weighted contribution bars
- **Connected Insights** - Threshold-gated cross-domain intelligence blocks that surface when a risk component is dominant (e.g., "Reservoir stress contributes X/20 to this ward's risk score") with deep links to the relevant page
- **Action Nudges** - Context-aware action recommendations based on the dominant risk factor (rainwater harvesting, recharge wells, or reservoir advocacy)
- **Panel Pre-selection** - Each view mode auto-selects a notable item on load (deepest ward, highest-risk ward, or most over-exploited block) so users see the detail panel immediately
- **Ward Context Panel** - Cross-domain intelligence for each ward showing groundwater depth/trend, water body count with restoration needs, dominant flood hazard, nearest river station, and drainage line count - all clickable deep links that navigate to the relevant page and pre-select the ward
- **AI Ward Analysis** - AI-generated narrative per ward connecting groundwater, infrastructure, and risk data into a contextual story (refreshed monthly)

### Water Bodies and Restoration Map
A unified map at `/water-bodies` with a **view-mode toggle** to switch between "Water Bodies" and "Restoration Priority" views. Both views share the same detail panel and data.

**Water Bodies view:**
- **1,787 Existing Water Bodies** - All current lakes, tanks, ponds, and reservoirs from OpenStreetMap and Census of Water Bodies
- **15 Documented Lost / Encroached Water Bodies** - Curated from Care Earth Trust, NGT records, and IIT Madras research
- **Toggle Layers** - Show/hide current and lost water bodies independently
- **Status-coded Circles** - Fully lost (red), severely reduced (orange), partially encroached (yellow)

**Restoration Priority view:**
- **1,787 Water Bodies Scored** - OSM and census water bodies ranked on restoration priority using spatial analysis
- **6-Component Scoring Model** - Water body size (25%), proximity to lost water bodies (18%), proximity to polluted rivers (18%), industrial pollution proximity (14%), water body type (15%), census condition (15%)
- **Priority Levels** - Critical (75-100), High (50-74), Moderate (25-49), Low (0-24)
- **Color-coded Polygons** - Red to green showing restoration priority across Chennai

**Shared features:**
- **Ranking Table** - Sortable by score, area, or name; switch via Map/Ranking tabs
- **Detail Panel** - Click any water body for basic info plus restoration score breakdown, nearest lost water body, nearest river station, nearest industrial source. Connected insights surface when lost-proximity or industrial-proximity scores are dominant
- **Satellite Context** - For reviewed Phase 1 lakes and reservoirs, the detail panel shows historical persistence, current surface spread versus the usual seasonal baseline, and a freshness/confidence label
- **Ward Context + AI Analysis** - Each detail panel shows the ward's cross-domain water context and AI-generated narrative
- **Deep Linking** - Ward context links navigate to the water bodies page and pre-select the ward's top water body (`?mode=restoration&ward=N`)
- **Stats Bar** - Adapts to show water body counts or priority breakdown based on view mode

### River Health Map
- **Interactive Polyline Map** - 4 rivers (Cooum, Adyar, Buckingham Canal, Kosasthalaiyar) colour-coded by CPCB water quality status
- **Monitoring Station Markers** - 10 stations with individual DO/BOD readings
- **DO/BOD/Nitrate Time-Series Chart** - Dual-axis line chart (2015-2024) per station with reference lines at the aquatic life minimum (DO = 4 mg/L) and clean river standard (BOD = 2 mg/L)
- **Pollution Profile with BIS Limits** - DO, BOD, fecal coliform, TDS, nitrate, and heavy metals (Cr, Pb, Cd) shown as severity cards with BIS drinking water limit baselines, ratio bars, and multiplier labels (e.g., "22x above limit", "13x below min" for critically low DO)
- **River Detail Panel** - Status badge, CPCB class, 3-year trend indicator (separate DO and BOD rows with direction hints), station selector, embedded explainers for DO, BOD, nitrate, and fecal coliform
- **3-Year Trend** - Per monitoring station: direction badge (Improving / Worsening / Stable / Mixed) with signed DO and BOD deltas derived from the last 3 annual readings
- **Stretch Highlighting** - Selecting a station highlights the corresponding river stretch on the map; station clicks on the map sync with the panel
- **Sewage Inlet Layer** - 31 geo-located sewage inlets along the Cooum river with discharge volumes (size-encoded circles), from Nethaji Mariappan et al. (2017)
- **CRRT Restoration Tracker** - 9 restoration projects from the Chennai Rivers Restoration Trust shown per river, with status, budget, area, metrics, and source links
- **No-Monitoring Alarm** - Rivers without CPCB monitoring stations (Kosasthalaiyar) show a prominent alarm with a link to report alternative data sources
- **Industrial Pollution Sources Overlay** - 7 major facilities (NCTPS, CPCL, Kamarajar Port, SIPCOT Manali, MFL, TPL, Ennore Creek) colour-coded by type; click for operator details, pollutant pills, incident timeline, and NGT orders. OSM `landuse=industrial` polygons shown as translucent overlay

### Flood Risk, Drainage, and Sewerage
- **Hazard Zone Map** - CFLOWS 1.0 flood hazard zones (Very High to Very Low) from the Nov 2019 model by IIT Bombay + IIT Madras + NCCR, via OpenCity Chennai. Model has not received a public update since; visible caveat on the page explains the vintage. Ward boundary overlay for area context.
- **Historical Flood Events** - Toggle between 2015 Chennai floods (327 hotspots with vulnerability ratings, 192 inundation depth points) and 2020 Cyclone Nivar (53 hotspots)
- **GCC Storm Water Drain Network** - 10,308 official drain segments from Greater Chennai Corporation survey (2023), showing street-level detail with drain type, depth, width, material, and condition status
- **Macro and Micro Drains** - 52 major drainage channels from Chennai Basin Drainage Maps
- **Drain Detail Panel** - Click any drain for street name, ward/zone, dimensions, open/closed status, condition (Good/Bad), and material type
- **CMWSSB Sewerage Network** - 13 operational sewage treatment plants totalling 745 MLD installed capacity (CMWSSB 2026) shown as 8 campus points, 348 pumping stations (SPS) with STP linkage, and 3,834 pumping main segments with pipe material and size
- **Return Period Maps** - 5/10/25/50/100/200-year flood extent polygons
- **Ward Boundary Overlay** - 200 GCC wards with zone names on hover across all view modes
- **Ward Context + AI Analysis** - Detail panels show ward-level cross-domain context and AI narrative for any clicked feature
- **Deep Linking** - Ward context links navigate to the flood risk page and fly to the ward centroid (`?ward=N`), with view mode preserved (`?view=drainage`)
- **Click Tolerance** - Drainage lines and pumping mains use a Canvas renderer with 10px tolerance for easier interaction with thin features

### My Ward
A unified ward report page at `/my-ward` that aggregates all data layers for any of Chennai's 200 wards into a single scrollable page. Supports deep linking via `?ward=N`.

- **Ward Selector** - Search by ward number, area name, or zone name; recent wards remembered in localStorage
- **AI Narrative** - AI-generated ward analysis connecting groundwater, infrastructure, and risk data
- **Groundwater Card** - Depth to water table, year-over-year trend, composite risk score with 4-component breakdown (groundwater depth 40%, trend 30%, reservoir stress 20%, seasonal 10%), and historical chart
- **Water Bodies Card** - Total count, restoration priority breakdown (critical/high/moderate/low), top 3 bodies by score, lost water bodies count with provenance
- **Flood Risk Card** - Worst-case-first hazard display (very high and high zone counts shown prominently), category breakdown bar, 2015/2020 historical hotspot counts
- **Infrastructure Card** - Drainage network length (km/sq km), STP count and capacity (MLD), pumping main length and station count
- **River Card** - Nearest river, monitoring station, straight-line distance
- **Actions Card** - GCC grievance portal link, CMWSSB portal link, ward councillor/MLA/MP with party and contact info
- **News Context** - Zone-level news articles related to water issues
- **Cross-page Links** - Each card links to the relevant Explore page with the ward pre-selected
- **Source Attribution** - Every card shows data source and caveats (data age, model limitations, units explained)
- **Export** - CSV download of all ward data, share via URL, print-friendly layout
- **Ward Report Card** - Print-optimized one-pager at `/my-ward/report?ward=N` ranking a ward among all 200 on 5 governance-quality metrics (water body health, water body density, flood risk exposure, drainage coverage, sewage network coverage). Percentile-based A-F grades, zone/city median comparisons, elected representatives, methodology disclosure with known limitations. All density metrics area-normalized; line-based infrastructure apportioned across ward boundaries by sampling
- **Uplift Planner** - Interactive budget optimizer answering "If I had INR X crore for my ward, where should I invest?" A greedy algorithm allocates a hypothetical budget (10-500 Cr slider) across 5 intervention types (storm drains, sewerage, flood mitigation, water body restoration, water body revival), maximizing composite-score improvement per crore spent. Data-backed caps prevent over-allocation (e.g. can't restore more bodies than actually need it). After-state uses exact ranking engine recompute (not approximation) for grade projections. Cost ranges from published GCC/CMWSSB/NDMA project reports

### Chennai Water Facts
A journalist-ready snapshot page at `/facts` that surfaces Chennai's water state as quotable numbers with sources, dates, and methodology attached. Organised by freshness tier so staleness is never hidden.

- **Live tier** (Tier 1) - Reservoir storage today, Day Zero comparison to 2019, last-30-day rainfall, and year-over-year water body area change for 12+ tracked water bodies. Computed at request time from `reservoir_daily`, `weather_daily`, and `water_body_satellite_summary` tables with hourly ISR.
- **Annual tier** (Tier 2) - Latest published government data: CGWB over-exploited blocks (13 of 16 in 2024), peak river pollution records (Cooum DO 0.0 mg/L in 2022, Buckingham Canal DO 0.3 mg/L in 2024), ward-level groundwater crisis count, and a Data Transparency Watch meta-card flagging how long it has been since authorities published.
- **Historical tier** (Tier 3) - Documented events and peak records: 2019 Day Zero (~19 MCFT usable storage), 2015 Chennai floods (77-494 mm station rainfall range per WWA), CFLOWS 1.0 model vintage (Nov 2019), Pallikaranai Marsh decline (~6,000 to ~593 ha per 2016 research).
- **Infrastructure tier** (Tier 4) - Structural capacity facts: 13 STPs / 745 MLD installed, 200 MLD desalination installed, 13,222 MCFT total reservoir capacity, piped supply vs demand gap.
- **Copy-quote buttons** produce paste-ready attribution including the canonical fact URL (`neervazhvu.org/facts#id`).
- **JSON-LD Dataset + Observation** structured data for search engines.
- **Public JSON API** at `/api/facts` for RSS, embeds, and partner integrations.

### Intelligence Layer (Python Service)
- **Reservoir Forecasting** - 30-day storage predictions using AutoARIMA with confidence intervals; uses inflow/outflow, precipitation, and ET₀ (evapotranspiration) as exogenous regressors when data variance is sufficient
- **Ward Risk Scoring** - Composite 0-100 risk score per ward (groundwater depth, trend, reservoir stress, seasonal vulnerability)
- **Daily Briefing** - Template-based intelligence summary with headlines, alerts, and recommendations; optionally enhanced with an AI-generated city narrative using Claude (Sonnet for city, Haiku for 200 ward narratives)
- **GEE Phase 1 Summaries** - Earth Engine-derived water-body spread seasonality and reservoir catchment rainfall summaries, written into Supabase for dashboard and water-body detail use

### Ward Profile Index
- **Build-Time Spatial Join** - Every data layer (water bodies, flood zones, drainage, sewerage, rivers, industrial zones) is mapped to each of Chennai's 200 wards using centroid point-in-polygon attribution. Line-based infrastructure (drainage, pumping mains) is apportioned across ward boundaries by sampling at 50m intervals along each line
- **Deterministic Output** - `scripts/compute-ward-profiles.ts` reads only committed repo files (no Supabase), producing `public/data/ward-profiles.json` with byte-identical output for identical inputs
- **Ward Area** - Each ward's polygon area (sq km) is computed from GCC 2022 boundaries via `@turf/area`, enabling area-normalized density metrics
- **CI Freshness Check** - Reruns the script and diffs output; catches stale profiles when source GeoJSON changes

### Other
- **Navigation** - 4 top-level tabs: Dashboard, My Ward, Explore (dropdown grouping Groundwater, Water Bodies, Rivers, Flood Risk), About. Mobile menu has collapsible Explore section
- **Tamil Localization** - Full English/Tamil toggle (~700 translation keys) with localStorage persistence; locale-aware date formatting and reservoir name translations
- **Dark Mode** - Full dark mode with system preference detection; maps use OSM tiles with CSS invert filter for consistent label coverage across themes
- **Responsive** - Works on desktop, tablet, and mobile
- **Demo Mode** - Runs with realistic mock data when Supabase isn't configured
- **OG Image** - Auto-generated Open Graph image for social sharing (LinkedIn, Twitter)


---

## Risk Score Methodology

Each ward receives a composite score from 0 (safe) to 100 (critical):

| Component | Weight | What it measures |
|-----------|--------|-----------------|
| Groundwater depth | 40% | Current depth to water table (mbgl) |
| Year-over-year trend | 30% | Is the water table rising or falling? |
| Reservoir stress | 20% | City-wide reservoir storage percentage |
| Seasonal vulnerability | 10% | Time of year (pre-monsoon = highest risk) |

Risk levels: **Low** (0–25) · **Moderate** (26–50) · **High** (51–75) · **Critical** (76–100)

## Ward Report Card Methodology

Each of Chennai's 200 wards receives a composite score (0-100) based on 5 governance-quality metrics, each ranked independently with percentile-based A-F grades:

| Metric | Weight | Unit | Direction | Tiebreaker |
|--------|--------|------|-----------|------------|
| Drainage coverage | 25% | km/sq km | Higher = better | - |
| Sewerage infrastructure | 25% | km/sq km | Higher = better | SPS density |
| Flood risk exposure | 25% | zones/sq km | Lower = better | - |
| Water body health | 15% | restoration score | Lower = better | Body count |
| Water body density | 10% | bodies/sq km | Higher = better | - |

**Grading:** A (80th+ percentile), B (60-79th), C (40-59th), D (20-39th), F (below 20th). Percentile formula: `(total - rank) / (total - 1) * 100`. The overall grade applies the same thresholds to the composite score's percentile rank.

**Implementation:** `src/lib/utils/ward-rankings.ts` - `computeWardRankings()` computes per-metric ranks with tiebreakers, composite scores via `computeCompositeScore()`, and overall ranking via `rankEntries()`.

## Uplift Planner Methodology

The uplift planner answers: "If I had INR X crore for my ward, where should I invest it to improve its grade the most?"

**Algorithm:** Greedy budget optimizer (`src/lib/utils/ward-uplift.ts`)
1. **Gap analysis** - Compares the ward's current value on each metric against the city distribution to identify where it lags
2. **Greedy loop** - At each step, evaluates every feasible intervention and picks the one with the highest weighted-percentile improvement per crore. Repeats until budget is spent or all caps are hit
3. **Exact projection** - Builds a modified ward profile with projected metric values and reruns `computeWardRankings()` on the full 200-ward dataset to get the exact after-state grade and percentile (not an approximation)

**Interventions & costs** (from published government project reports):

| Intervention | Cost/unit (Cr) | Metric | Cap logic |
|-------------|---------------|--------|-----------|
| Build storm drains | 1.5-3.0/km | Drainage coverage | 20 km/ward |
| Extend sewage network | 3.0-6.0/km | Sewerage infra | 15 km/ward |
| Flood zone mitigation | 5-15/zone | Flood risk | Actual high+very-high zones |
| Restore water bodies | 2-8/body | WB health | Bodies rated critical/high |
| Revive lost water bodies | 10-25/body | WB density | Documented lost bodies |

**Ranking parity:** Both before-state and after-state achieve 0/200 disagreements with the authoritative `computeWardRankings()` engine across all wards. Verified by exhaustive tests in `ward-uplift.test.ts`.

## Restoration Priority Methodology

Each of Chennai's 1,787 water bodies (1,635 OSM + 152 census-only) receives a composite priority score from 0 (low priority) to 100 (critical restoration candidate), computed from 6 weighted spatial components:

| Component | Weight | What it measures |
|-----------|--------|-----------------|
| Water body size | 25% | Larger bodies provide greater recharge and flood mitigation impact |
| Proximity to lost water bodies | 18% | Near historically lost lakes = stressed area needing compensation |
| Proximity to polluted rivers | 18% | Near dead/degraded river stretches (by DO readings from CPCB stations) |
| Industrial pollution proximity | 14% | Near industrial discharge zones = higher contamination risk |
| Water body type | 15% | Reservoirs and lakes prioritised over canals, drains, wastewater ponds |
| Census condition | 15% | Encroachment status and storage capacity loss from government census data |

Priority levels: **Low** (0–24) · **Moderate** (25–49) · **High** (50–74) · **Critical** (75–100)

Scores are pre-computed by `scripts/compute-restoration-priority.ts` using Haversine distance calculations against all input datasets. Output is saved to `public/data/restoration-priority.json`.


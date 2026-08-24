# Bengaluru - features and methodology

> Detailed feature inventory for Bengaluru, including how it differs from Chennai and Madurai. The high-level overview lives in [README.md](../../../README.md); the data-source breakdown in [data-sources.md](data-sources.md).


Bengaluru is the third onboarded city. The headline difference from Chennai: Chennai's reservoirs ARE the urban water supply (CMWSSB owns and operates them), so a "Days of Water Left" calculation against urban demand is honest. The headline difference from Madurai: Madurai's dams are upstream irrigation reservoirs but the city has a clean published *allocation* (1,500 mcft/yr drinking share) you can anchor on. Bengaluru has neither - the 4 upstream Cauvery reservoirs (KRS, Hemavathi, Kabini, Harangi) serve irrigation + Mysuru + Mandya + Bengaluru drinking + the inter-state release to Tamil Nadu, and no single number tells you what's specifically Bengaluru's. So the dashboard hero is fundamentally different: it tracks BWSSB's actual lift volume against Stage I-V design capacity, with the IISc 80-ward stress overlay underneath as the headline failure-mode layer.

### Dashboard (Bengaluru-specific surfaces)

- **Cauvery Pumping Hero** (`CauveryPumpingHero`, replaces `DaysLeftHero`/`AllocationHero`) - Headline tracks current Cauvery lift volume from T.K. Halli (~1,450 MLD) against Stage I-V design capacity (~2,225 MLD post-Stage V). Four stat tiles: current lift, Stage V design (775 MLD), Stage V actual (~400 MLD per The Ken Feb 2026), deficit. Six callouts cover: 100 km / 600 m elevation pump chain; ~33% of BBMP wards on tankers + over-extracted borewells (IISc Outlook 2025); all 6 Bangalore Urban CGWB blocks Over-Exploited; Stage V actual ~400 MLD per The Ken Feb 2026; Cauvery Tribunal release obligation drags Karnataka's share; ~₹100 cr/yr in pumping electricity alone. Fully `t()`-driven for EN + KN parity.
- **Bangalore Daily Briefing** (`BangaloreDailyBriefing`) - Template-based daily briefing card rendered just below the badge row. Composes prose from `t()` keys against structured `fields` (returned by `buildBangaloreBriefing()` in `src/lib/insights/bangalore-briefing.ts`) so the briefing is fully localised. Five briefing variants pick by reservoir storage trend + tanker dependency + Stage V status. Open `aiOverride` slot for a Claude-pipeline AI uplift; today it's deterministic templates only.
- **IISc Stress Wards Map** (`IIScStressWardsMap` + `IIScStressWardsLeafletMap`) - The headline groundwater layer rendered directly on `/bangalore`. 80 critically-over-extracted BBMP wards (April 2025 IISc Groundwater Outlook) as a percentile-coloured choropleth (0-100 composite score) over the 198 BBMP polygon set. Click any ward for its severity tier + composite score breakdown.
- **Reservoir Cards** - 4 upstream Cauvery reservoirs (KRS, Hemavathi, Kabini, Harangi) live via TN Agriculture ARS scrape, with the structural caveat surfaced inline that these are *Karnataka basin* storage, not Bengaluru's tap supply.
- **Rainfall trends** - IMD gridded long-term rainfall (1970-2025, grid 13.0°N/77.5°E, 843.4 mm long-term annual mean). Annual rainfall bar chart with drought/flood colouring + monthly current-year vs long-term normal comparison.

### Tanker Market (`/bangalore/tanker`)

Bengaluru-only longitudinal panel. The single sharpest metric of system failure that requires no official disclosure - what households on the city's periphery actually pay for tanker water vs BWSSB's published tariff.

- **Source**: OpenCity Bengaluru household water-tariff surveys, 2015 / 2019 / 2024 (rare longitudinal coverage in Indian civic data)
- **Components**: `TankerExpandedContext`, `TankerMarketPanel`, `TankerPageChrome` (client wrapper providing localised header + footer so the Server Component page can be localised)
- **Sections**: Tier-by-tier official vs informal pricing (sub-2K / 4K / 6K / 8K / 12K litre tanker capacities), corridor-specific sites with narrative, structural anchor on BWSSB's underlying tariff structure, RTI-target data gaps
- **Localisation**: All section headings + body fields carry `_kn` and `_ta` variants; `pick()` helper reads `_${language}` suffixed JSON fields

### Groundwater Map (Bengaluru)

Different methodology from Chennai. With only 13 CGWB telemetric stations across 369 GBA wards (or 198 BBMP wards), IDW-interpolating a per-ward depth choropleth would manufacture precision the data doesn't support. So:

- **IISc 80-ward stress overlay (headline)** - 80 critically-over-extracted BBMP wards from the April 2025 IISc Groundwater Outlook; rendered as a percentile choropleth (0-100 composite) directly on `/bangalore` (above the fold) and on `/bangalore/groundwater`.
- **Block-level CGWB exploitation** - 6 Bangalore Urban blocks (Bangalore N/S/E/City, Yelahanka, Anekal) tile the city; ALL six are Over-Exploited every year on record. Bangalore-East worst at 306% draft-vs-recharge (GEC 2024); Yelahanka 140% → 260% in 4 years (2020-2024).
- **CGWB Year Book + WRIS station point overlay** - 13 telemetric stations with daily readings; tagged with block + well type + aquifer.

Disables `groundwaterViews.depth` for the reason above; enables `exploitation`, `risk`, `cgwbStations`.

### Water Bodies (Bengaluru)

- Roughly 900 OSM water bodies + flagship-curated tanks (KTCDA / BBMP rejuvenation list) + lost-tank inventory (T.V. Ramachandra et al. at IISc).
- **14 rich-data deep-zoom bodies onboarded**: Bellandur, Varthur, Hesaraghatta, Hebbal, Ulsoor, Sankey, Madivala, Agara, Jakkur, Rachenahalli, Iblur, Kempambudhi, Puttenahalli, Yelahanka. Same body-agnostic pipeline as Chennai's 7 (Pallikaranai + 6 others); same registry pattern in `src/lib/water-bodies/rich-body-registry.ts`. See [data-sources.md](data-sources.md#rich-data-deep-zoom-panel-14-bengaluru-flagship-bodies) for the pipeline detail.
- **JRC → DW water-trend splice** - the per-body water-fraction chart reads JRC GSW v1.4 for years ≤2021 and Dynamic World V1 (water class 0) for ≥2022, so the chart doesn't truncate at JRC's cutoff. Methodology disclosed in the in-panel sources modal. Critical for bodies whose recent dynamics matter most: Bellandur (sewage + foam), Varthur (NGT monitoring), Hesaraghatta (drying tank).
- **Tint legend labels** reflect the two-window methodology, not a continuum: "Water lost (1988-92 → 2017-21)" and "New built (2016-18 → 2023-25)". Earlier labels said "Water lost (1990-2021)" which was misleading.

### My Ward (Bengaluru)

- 198 BBMP wards today (GBA 369-ward boundary file pending public availability for migration).
- Same UI shape as Chennai/Madurai (selector, cards, comparison table, report card) but with Bengaluru-honest data:
  - **3-factor reduced ward-risk composite** (water bodies proximity, lost-tank proximity, IISc stress + CGWB block exploitation) - matches Madurai's reduced model, not Chennai's 5-factor.
  - Cards for sections without ward-level public coverage (flood, drainage, sewerage, industrial) render as honest "not yet sourced" disclaimers via `_data_status: "not_available"` markers from `compute-bangalore-ward-risk.py`.
  - **`profile.industrial` undefined guard** in `my-ward-page.tsx` - Bangalore ward profiles legitimately lack the industrial section (no public ward-level KIADB polygon), so the My Ward component guards before the `in` operator: `profile.industrial && !("_data_status" in profile.industrial) && profile.industrial.zone_count > 0`.
- Per-city quick actions + helplines (BWSSB / BBMP / KSPCB instead of CMWSSB / GCC).

### Rivers (Bengaluru)

- CPCB NWMP coverage is partial: Vrishabhavathi, Arkavathy, upper reaches of the Dakshina Pinakini. KSPCB cross-check pending.
- River status badges via shared `src/lib/utils/river-classification.ts` (CPCB Designated Best-Use thresholds). Vrishabhavathi reads "severely_degraded" given peri-urban sewage + industrial discharge along its course.
- Court orders panel surfaces the NGT Bellandur/Varthur foam orders + KSPCB consent issues for the SEZ ring.

### Flood Risk (Bengaluru)

- **KSNDMC flood-prone zones** + **BBMP Sept 2022 hotspots** rendered via `flood-risk-bangalore-content.tsx` and `flood-risk-bangalore-leaflet-map.tsx`.
- The Sep 2022 IT corridor flooding (Whitefield, Sarjapur Road) is annotated as an event marker.
- **Narrower than Chennai's CFLOWS.** No CFLOWS-equivalent probabilistic hazard surface for Bengaluru; the page leans on the BBMP hotspot inventory + corridor narrative. Full `t()`-driven for EN + KN parity.

### About (Bengaluru)

- **Supply chain explainer** (Cauvery → KRS / Hemavathi / Kabini → T.K. Halli intake → Stage I-V pumping → BWSSB distribution → 198 BBMP ward zones → tap)
- **What's missing today** - institutional gaps reframed as observation (BWSSB Stage V actual weekly lift; KSPCB OCMMS detail; GBA 369-ward boundary file; BWSSB STP actual treatment volumes; per-zone supply telemetry)
- **How we classify river health** - documents CPCB Best-Use vs PRS Priority methodology (shared with Chennai/Madurai)
- **Open data gaps in Bengaluru** - per-layer workarounds + RTI tracker

### Facts page (Bengaluru)

- 32 curated facts at `/bangalore/facts`, each with title + interpretation + source + EN/TA/KN variants
- `pickLang()` helper in `fact-card.tsx` resolves `title_ta` / `title_kn` (and the interpretation variants) generically; falls back to EN.

### Long-form story (Bengaluru)

- `/bangalore/origins` - 4-chapter / ~4,000-word long-form covering tank-economy history → colonial pipe rotation → Cauvery scheme commissioning → present-day Cauvery Stage V + groundwater collapse. Hero image: 1854 Bangalore Cantonment map; Figure: 1834 Ulsoor engraving.
- EN + KN. Kannada is in `src/content/story-bangalore-kn.tsx` as a parallel module; dispatcher in `src/content/story-bangalore.tsx` reads the active language and routes.
- Native-speaker Kannada review pending; copy is AI-drafted and flagged "pending native-speaker review" in the UI.

### Localisation (Kannada)

- Bengaluru's `availableLanguages` is `['en', 'kn']`. The language toggle in the header surfaces "ಕನ್ನಡ" alongside English.
- Translation file (`src/lib/i18n/translations.ts`) covers ~1,500 keys with 100% Kannada coverage. Major chrome surfaces routed through `t()`:
  - BangaloreDailyBriefing (variants + structured fields)
  - CauveryPumpingHero (eyebrow, headline, body, stat labels, callouts, footer)
  - TankerExpandedContext + TankerPageChrome (section headings + footer)
  - flood-risk-bangalore-content (`frb.*` keys)
  - bangalore-page-descriptions (`bpd.*` keys, complete rewrite as single t()-driven renderer)
  - IIScStressWardsMap (`iisc_map.*` keys)
  - Facts page (`facts.bucket.*` + per-fact `_kn` variants in the JSON)
- Per-language JSON field picking: city data files where prose differs per-language (tanker-context, facts) carry parallel `_kn` suffixes on every user-facing string. The `pick()` helper reads `_${language}` suffixed fields.


# Mumbai - features and methodology

> Detailed feature inventory for Mumbai, including how it differs from Chennai, Madurai and Bengaluru. The high-level overview lives in [README.md](../../../README.md); the data-source breakdown in [data-sources.md](data-sources.md).

Mumbai is the fourth onboarded city and the first **region place** (`placeKind: 'region'`): it is modelled as the full Mumbai Metropolitan Region - nine municipal corporations (Greater Mumbai/BMC, Thane, Navi Mumbai, Kalyan-Dombivli, Mira-Bhayandar, Vasai-Virar, Bhiwandi-Nizampur, Ulhasnagar, Panvel) drawing on one contested source pool with no regional utility above them. The dashboard therefore carries **two geographies at once**, and every card names which one it covers via a scope badge: "Greater Mumbai · BMC's 7 lakes" or "Mumbai Metropolitan Region · 9 corporations".

The supply model is Chennai-like, not Bengaluru-like: BMC's seven impounded lakes ARE the city's tap (Bhatsa alone ~48%), so a days-of-water-left hero is honest - with two caveats the card itself states (see below).

### Dashboard (Mumbai-specific surfaces)

- **Days-Left Hero** (`DaysLeftHero`, `heroMode: 'days-left'`) with three honesty features that other cities inherit where applicable:
  - **Upper-bound caveat** (`heroNote`): storage counts the full live water in the five state-owned dams, part of which serves users beyond BMC (Bhatsa's BMC share is ~76% per WRD GR 11-Sep-2019). The figure is labelled an upper bound; the share-adjusted computation is a logged follow-up.
  - **Collapsed rain scenarios**: the Pravah feed publishes storage only - no inflow data - so the worst-case / current-trend / seasonal scenarios would be three identical numbers. The hero collapses them to one line that states its divisor ("At a draw of 3,850 MLD") and says why rain scenarios can't be computed. The inflow and desalination sliders are hidden (Mumbai has no operating desal plant - Manori's 200 MLD is a proposal, tracked in the Commitments Register).
  - **Linked attribution**: storage data attributed to the Maharashtra WRD Pravah portal (the stable `damsafety/control/main` entry, not the flaky PDF endpoint).
- **The Metropolitan Water System** (`RegionalWaterSystem`, region places only) - the MMR view: LPCD-inequality ranking (~252 LPCD in Mumbai to ~70 in Vasai-Virar, against the CPHEEO 135 norm), scoreboard chips (below-norm / at-norm / unverified counts), per-corporation cards with deficit verdict chips + live source-storage pills (Pravah), the augmentation pipeline (Gargai, Kalu, Surya phases), and numbered scholarly citations with a collapsed source list.
- **Supply-overview tile** (`UrbanSupplyOverview`) - BMC's engineering chain dam-to-tap: 3 Master Balancing Reservoirs → 27 service reservoirs → 109 supply zones; connections shown with the denominator explained (5.5 lakh **building-level** connections, ~23 people per connection - not comparable across cities).
- **Reservoir history chart** - opens on **All time** by default (`reservoirHistoryDefaultRange: 'all'`): the recent windows hold only the young daily feed, while All-time spans a decade (CWC weekly 2015-2025 + Pravah daily from Jul 2026). A config-driven coverage note states exactly which dams have history and which never had a public archive (Vihar + Tulsi have no feed at all).
- **Rainfall** - two-layer model (all cities): IMD gridded history + normals as the authoritative backbone, plus a daily provisional layer (Open-Meteo archive fill from IMD's last published month through yesterday) rendered as asterisked months. IMD supersedes the fill automatically as its quarterly series catches up.

### Accountability surfaces (all four cities; Mumbai-first design)

- **Allocation Ledger** (`/mumbai/allocations`) - who is owed what water: 15 arrangements (source → authority → recipient) with entitled vs received, the instrument each rests on (WRD GRs, STEM board minutes, MMRDA Annual Report), and a confidence grade. The honest verdict classes include **"unreported"** - a quota exists on paper but no delivery figure is published - which covers 10 of Mumbai's 15 rows and is the ledger's central finding.
- **Commitments Register** (`/mumbai/commitments`) - 19 dated commitments (WwTF commissioning dates, Gargai/Kalu/Manori, BRIMSTOWAD, flood-spot mitigation, climate-budget delivery) with citation-gated status changes and append-only history. Cross-linked with the Ledger in both directions, landing on the exact entry (hash deep-links with auto-expand + highlight).

### Flood risk (`/mumbai/flood-risk`)

- Interactive map: BMC's chronic-flooding register (weekly refresh workflow), the 26/7/2005 reference layer, OSM drainage (labelled as community-traced, not BRIMSTOWAD as-builts).
- **WRD flood-line sheets** (`FloodLinesSection`, shared component, data-file driven): the legal red/blue flood-boundary maps for 6 MMR rivers - 41 sheets, including the Ulhas 0-84 km (the Badlapur-Ulhasnagar-Kalyan flood corridor) - with the named gap that BMC publishes no equivalent for the city's own rivers (Mithi, Dahisar, Poisar, Oshiwara).
- iFLOWS-Mumbai (the public-money flood model) briefs officials only; documented as a transparency gap, not silently omitted.

### Other pages

- **Groundwater** - Mumbai City + Suburban are excluded from CGWB's Dynamic Ground Water Resources Assessment (the only 2 of Maharashtra's 35 districts), so exploitation/depth/risk views are off; the page surfaces CGWB National Hydrograph Network wells (Year Book transcription, ~53 wells across Mumbai/Thane/Palghar/Raigad) as the honest signal.
- **Water bodies + Catchments** - OSM bodies + lost-tank inventory + the FABDEM-derived lake-catchment atlas (same WhiteboxTools pipeline as the other cities).
- **Rivers** - Mithi/Dahisar/Poisar/Oshiwara + regional Ulhas, with the MPCB annual Water Quality Status series where it exists (Mithi station 2168 BOD series; the 2019-20 edition was never published) and named reading gaps where it doesn't. Facts carry CPCB's Oct-2025 finding that the Mithi at Mahim is now **India's worst river stretch** (max BOD 210 mg/l).
- **Shoreline** (`/mumbai/shoreline`) - same GEE MNDWI transect pipeline as Chennai, west-coast orientation, corroborated against the published record (NCCR 1990-2016 district table + MSMP 2017 risk grades) because no rate-publishing paper exists for Mumbai. Copy is config-driven per city (`ShorelineSummaryCopy`).
- **Facts** (21 curated, each with a source URL) and **Origins** - the four-chapter water history (seven islands → Vihar 1860 → hydraulic citizenship → 26/7 and the forty-five litres) with five licensed Wikimedia images; provenance in `public/images/story/mumbai/MANIFEST.json`.

### Deliberately absent at launch

- **My Ward** - the ward panels are still in build (non-BMC corporation ward geometry has no public source). Removed from `FEATURE_AVAILABILITY`, so nav, sitemap and direct URLs all 404 for Mumbai. Returns with the ward-equity build (the per-ward Praja feedstock - supply hours, unfit samples, metering - is already in `public/data/mumbai-ward-water-praja.json`).
- **Marathi** - declared as upcoming (`upcomingLanguages: ['mr']`): the language switcher shows a greyed "coming soon" chip. The translation pass is a dedicated follow-up PR; ~1,509 keys.
- **Forecasts** - shipped without AutoARIMA forecasts (Chennai-only today); the Pravah history is too young.
- **Cascades / tanker** - not applicable (reservoir-pumped geography; tanker data is RTI-gated).

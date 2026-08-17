import type { LanguageCode } from '@/lib/i18n/translations';

export type WaterSourceType =
  | 'reservoir'
  | 'borewell_field'
  | 'river'
  | 'flow_station';

export interface GeoBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Authority {
  code: string;
  name: string;
  acronym: string;
}

export interface LocalGovernment {
  code: string;
  name: string;
  acronym: string;
  wardCount: number;
}

export interface WaterSourceConfig {
  sourceCode: string;
  displayName: string;
  type: WaterSourceType;
  fullCapacityMcft: number | null;
  fullTankLevelFt: number | null;
  latitude: number;
  longitude: number;
  catchmentAreaSqkm: number | null;
  displayOrder: number;
  isPrimaryDrinkingSource: boolean;
  /** False when no public data feed exists for this source (e.g. Mumbai's
   *  Vihar and Tulsi - BMC-owned, absent from every state/central bulletin).
   *  Such sources are excluded from ingestion-liveness checks: they can
   *  never have a reading, so "waiting for first daily ingestion" would
   *  show forever. Undefined = true. */
  hasPublicFeed?: boolean;
  /** Shown on the reservoir card in place of the generic
   *  "<authority> does not publish daily levels" line. Use it when the
   *  authority that WOULD publish is not the city's own utility, or when a
   *  feed existed and died - the generic line would then misattribute the
   *  gap (e.g. Bhakra is BBMB's to publish, not DJB's). */
  noFeedNote?: string;
}

/**
 * Per-city feature flags for the Groundwater page's view layers.
 * Each flag controls whether a particular choropleth / overlay is
 * available in the view-mode toggle. Honest-data-or-off: only enable
 * a view if the underlying data supports the granularity the view
 * implies (e.g. don't enable per-ward IDW depth when only 4 stations
 * exist across a 2,700 sq km district).
 *
 * Undefined fields fall back to legacy behaviour (treated as enabled
 * where the underlying data is present), so adding this config is
 * additive - cities without it keep working.
 */
export interface GroundwaterViewsConfig {
  /** Block-level CGWB exploitation (GWR%) choropleth. The canonical
   *  authoritative map for any city; available wherever gwr-blocks data
   *  exists. Default true. */
  exploitation?: boolean;
  /** Per-ward IDW-interpolated depth choropleth from sparse stations.
   *  Honest only when ward-survey data is dense (Chennai: OpenCity
   *  monthly per-ward survey). Set false where station density is too
   *  low to manufacture per-ward precision (e.g. Madurai's 4 WRIS
   *  stations across 100 wards). Default treats it as enabled if the
   *  /api/groundwater/wards-interpolated endpoint returns data. */
  depth?: boolean;
  /** Ward-level risk composite (3- or 5-factor weighted score).
   *  Depends on the same ward-level data as `depth`; turn off in
   *  parallel where the underlying composite is too thinly supported
   *  to be journalist-quotable per-ward. Default treats it as enabled
   *  if /data/ward-risk-<city>.json exists. */
  risk?: boolean;
  /** CGWB Year Book point overlay - peer-reviewed quarterly station
   *  readings rendered as click-through markers with hydrograph
   *  panels. Set true where the live WRIS network is too sparse for
   *  honest interpolation but the CGWB Year Book point network is
   *  available. Loads public/data/<city>-cgwb-stations.json.
   *  Default false. */
  cgwbStations?: boolean;
  /** Shown on the groundwater page's not-yet-available state when NO view
   *  is enabled - names the city's specific blockers instead of a generic
   *  line. Ignored once any view is on. */
  gapNote?: string;
  /** IISc Groundwater Outlook ward-level stress choropleth. Currently
   *  available only for Bangalore (April 2025 Outlook by Prof. T.V.
   *  Ramachandra's group flags 80 of 198 BBMP wards as critically
   *  over-extracted). Loads public/data/<city>-iisc-stress-wards-*.json
   *  and renders the IIScStressWardsMap component instead of the
   *  block/ward WardMap when active. Default false. */
  iisc?: boolean;
}

/**
 * Per-city capability flags for the home dashboard's optional sections.
 * Each section renders only where the city has the backing data; the
 * components are shared, so any city opts in by setting the flag once it
 * has the pipeline. Undefined -> section omitted (additive default).
 *
 * See docs/specs/multi-city-component-discipline.md.
 */
export interface DashboardSectionsConfig {
  /** AI daily briefing (the synthesized TL;DR from the `daily_briefing`
   *  pipeline). Chennai is the first city with this pipeline. */
  aiBriefing?: boolean;
  /** Rainfall-anomaly context strip for the tracked reservoirs
   *  (`reservoir_catchment_context`). */
  reservoirCatchmentContext?: boolean;
  /** Groundwater status snapshot card (needs dense per-ward GW data). */
  groundwaterSnapshot?: boolean;
  /** WEAP water-balance tile (basin demand vs unmet-demand projection +
   *  the reuse/micro-irrigation levers). Needs a published basin water
   *  balance; Chennai today (TNGCC+CEEW 2026). Links to the climate-risk
   *  surface. */
  weapBalance?: boolean;
  /** Sewage-balance card: where a city's sewage actually goes, against what
   *  it generates. Needs `<cityId>-sewage-balance.json`. Kolkata is the first
   *  city with one, and the reason the card exists: 65% of its sewage is
   *  treated by a wetland OUTSIDE the corporation's boundary, which no
   *  supply-side surface can express. Generic - any city that publishes a
   *  generated-vs-treated balance can turn this on. */
  sewageBalance?: boolean;
}

/**
 * Per-city climate-risk theme flags. The shared `/<city>/climate-risk`
 * surface decomposes the basin into sub-basins and recolors the same
 * polygons by each risk component (the four subthemes). Each flag gates
 * one subtheme in the toggle; the data lives in
 * `<cityId>-sub-basins-risk.geojson`. Chennai today (TNGCC+CEEW 2026).
 * Omit -> the theme is hidden for the city.
 */
export interface ClimateRiskConfig {
  /** Composite Risk = Hazard x Exposure x Vulnerability (default subtheme). */
  risk?: boolean;
  hazard?: boolean;
  exposure?: boolean;
  vulnerability?: boolean;
}

/**
 * Per-city facts-page sourcing.
 *
 * - dynamicPipeline true: the page runs the live + derived fact builders
 *   at request time and merges them with the static layer (Chennai today;
 *   reservoir storage, Day Zero compare, CGWB blocks, river quality).
 * - dynamicPipeline false/omitted: the page loads the static
 *   `facts-<cityId>.json` snapshot (Madurai, Bangalore).
 */
export interface FactsConfig {
  dynamicPipeline?: boolean;
}

/**
 * Per-city flood-risk renderer selection. A named variant (like
 * `heroMode`) so any city can adopt any renderer:
 *
 * - `interactive`: the full hazard / historical / drainage / sewerage map
 *   (city-agnostic; reads `<cityId>-flood-*`, `<cityId>-drainage`,
 *   `<cityId>-sewerage`, `<cityId>-rivers` GeoJSON). Chennai today.
 * - `bangalore`: Bangalore's bespoke hotspot + drain-toggle map.
 * - `narrative` (default when a narrative config exists): dam-threshold +
 *   historical-events card stack (Madurai).
 */
export interface FloodViewConfig {
  variant?: 'interactive' | 'bangalore' | 'narrative';
}

/**
 * The drainage design standard a city's storm-water network was built to,
 * plus its citation. Consumed by the `drainage-capacity` hero, which asks how
 * often measured rainfall intensity beats it.
 *
 * This exists because for some cities the honest headline is not "how much
 * water is left" but "how much water the city cannot get rid of". Kolkata has
 * no impounded storage at all, so the days-left runway is undefined there;
 * what it does have is a published, falsifiable engineering promise that the
 * sky routinely breaks.
 */
export interface DrainageCapacityConfig {
  /** The design standard, in mm of rainfall per hour. Must be one of the
   *  thresholds on the ladder precomputed by
   *  neer-vazhvu-api/scripts/fetch_rainfall_intensity.py, since the hero's
   *  slider selects from that ladder rather than recomputing client-side. */
  standardMmPerHour: number;

  /** Where the standard is published. Rendered under the hero: this number is
   *  a design property quoted from a document, not a measurement, and readers
   *  must be able to go check it. */
  standardSource: { publisher: string; document: string; year: number; url?: string };

  /** WHAT the standard actually governs, as the grammatical subject of "___
   *  were built to carry N mm of rain an hour". Defaults to "<City>'s drains",
   *  which is almost always broader than the source claims.
   *
   *  Set it wherever the citation scopes itself. Kolkata's source says "the
   *  main sewer network / brick sewer ... was designed to discharge a rainfall
   *  of 6 mm. per hour" - a statement about a specific 180 km trunk network,
   *  not about every drain in the city. Rendering the default there would have
   *  the hero assert something its own citation does not. */
  standardAppliesTo?: string;

  /** What the network is, in one clause ("180 km of century-old brick sewer,
   *  mostly combined"). Gives the standard its physical meaning. */
  networkNote?: string;

  /** Optional deep-link to the city's live waterlogging/flood register, which
   *  is the independent check on the modelled exceedance: reanalysis says the
   *  standard was beaten, the register says where the street actually flooded. */
  registerLink?: { label: string; href: string };
}

/**
 * Per-city water-bodies capability flags. The shared water-bodies surface
 * reads these to decide which richer affordances to mount; defaults off so
 * a new city degrades to the basic map until its data lands.
 */
export interface WaterBodiesConfig {
  /** Pull the encroachment census from /api/water-bodies-census and join it
   *  to the OSM polygons. Chennai today. */
  censusSource?: boolean;
  /** Show the Map / Ranking tabbed layout with the restoration ranking
   *  table. */
  rankingTab?: boolean;
  /** Mount the ward-search box + ward deep-linking (needs
   *  `<cityId>-ward-profiles.json`). */
  wardSearch?: boolean;
  /** Overlay the lost / vanished water bodies layer
   *  (`<cityId>-water-bodies-lost.geojson`). */
  lostBodies?: boolean;
  /** Show the gazetted lake-register tab (`<cityId>-lake-register.json`).
   *  A different POPULATION from the map layer: the map draws visible OSM
   *  polygons, the register lists every statutorily gazetted lake and whether
   *  its FTL boundary is legally settled. Hyderabad today (HMDA). */
  legalRegister?: boolean;
}

/**
 * Public urban-supply numbers for the dashboard's allocation hero.
 * Used when the city's tracked dams are irrigation-primary (so the
 * Chennai "storage / demand" math is misleading) but a published
 * drinking-water allocation exists to anchor an honest headline.
 *
 * For Madurai today: Vaigai dam is the operational source, MMC's
 * 1,500 mcft/yr sanctioned allocation is published on
 * maduraicorporation.co.in/aboutus/water-supply/, and current draw
 * (~70 MLD ≈ 900 mcft/yr) is from the same page.
 */
export interface UrbanSupplyConfig {
  /** Source code(s) the allocation is drawn from. Must be a subset of
   *  this city's `waterSources`. */
  allocatedSourceCodes: string[];
  /** Sanctioned annual drinking-water allocation, mcft/year. */
  annualAllocationMcft: number;
  /** Most recent actual annual draw, mcft/year (publicly stated). */
  recentDrawMcft: number;
  /** WTP design capacity in MLD (Pannaipatty for Madurai). */
  wtpCapacityMld: number;
  /** Treatment plant name, used in copy. */
  wtpName: string;
  /** Optional: sentence describing the supply chain ("Mullaperiyar
   *  → Vaigai → Pannaipatty WTP → MMC distribution"). */
  supplyChainDescription?: string;
  /** Source URL for the allocation + draw numbers. */
  sourceUrl: string;
}

/**
 * A place is either a single municipal `city` (the original and default model)
 * or a `region` made of several municipal corporations (the MMR model). This is
 * additive: omit `placeKind` and a place behaves exactly as before. Mirrors the
 * `cities.place_kind` column.
 */
export type PlaceKind = 'city' | 'region';

/**
 * Per-corporation data-availability flags. A region's corporations have wildly
 * uneven data (BMC is rich; smaller corporations are thin). Rather than block a
 * corporation on missing data, we render its boundary + identity always and
 * flag what deeper data exists, surfacing the rest as named gaps. See
 * docs/specs/mumbai-mmr.md (the "corporation = always-present unit, ward =
 * enrichment" contract).
 */
export interface AdminUnitDataFlags {
  /** A `{corporationId}-wards-{vintage}.geojson` exists for ward drill-down. */
  hasWardGeometry?: boolean;
  /** Per-corporation supply (draw, sources, hours) data exists. */
  hasSupplyData?: boolean;
  /** Per-corporation equity data (LPCD / supply-hours / coverage) exists. */
  hasEquityData?: boolean;
  /** This corporation participates in the region-level risk ranking. */
  hasRiskComposite?: boolean;
}

/**
 * One municipal corporation within a `region` place. The corporation is the
 * region's always-present comparable sub-unit (every one has a boundary +
 * identity + the sources that feed it); wards are an optional enrichment per
 * corporation. Only present on region configs; a `city` config never carries
 * these (its single ULB lives in `localGovernment`).
 */
export interface CorporationConfig {
  corporationId: string;
  displayName: string;
  displayNameLocalized?: Partial<Record<LanguageCode, string>>;
  acronym: string;
  unitType: 'municipal_corporation' | 'municipal_council';
  /** Primary administrative district (Thane / Palghar / Raigad / ...). */
  district: string;
  center: Coordinates;
  bbox: GeoBounds;
  /** Published ward count, or null where wards aren't available. */
  wardCount: number | null;
  /** Vintage tag for `{corporationId}-wards-{vintage}.geojson`, if any. */
  wardsVintage?: string;
  /** Source codes (subset of the region's `waterSources`) feeding this
   *  corporation - the edges of the source -> corporation supply graph. */
  servedBySourceCodes: string[];
  data: AdminUnitDataFlags;
}

export interface BasePlaceConfig {
  cityId: string;
  displayName: string;
  /** Localized display names per language. Used wherever copy renders
   *  the city name in a specific regional script (e.g. `{ ta: 'சென்னை' }`
   *  for Chennai's Tamil rendering, `{ kn: 'ಬೆಂಗಳೂರು' }` for Bangalore).
   *  Falls back to `displayName` when the requested language is missing. */
  displayNameLocalized?: Partial<Record<LanguageCode, string>>;
  stateCode: string;
  timezone: string;
  center: Coordinates;
  bbox: GeoBounds;
  primaryAuthority: Authority;
  defaultConsumptionMld: number | null;
  defaultDesalinationMld: number | null;
  waterSources: WaterSourceConfig[];
  sourceNameAliases: Record<string, string>;
  /** Per-city feature flags for the Groundwater page's view layers.
   *  Omit to inherit legacy behaviour (all views shown when their
   *  underlying data is present). */
  groundwaterViews?: GroundwaterViewsConfig;

  /** Per-city home-dashboard optional sections (AI briefing, catchment
   *  context, groundwater snapshot). Omit -> none of the optional
   *  sections render. See docs/specs/multi-city-component-discipline.md. */
  dashboard?: DashboardSectionsConfig;

  /** Facts-page sourcing: dynamic live+derived pipeline vs static JSON
   *  snapshot. Omit -> static `facts-<cityId>.json`. */
  facts?: FactsConfig;

  /** Flood-risk renderer variant. Omit -> narrative card stack when a
   *  narrative config exists for the city, else "not yet available". */
  flood?: FloodViewConfig;

  /** Climate-risk theme subtheme flags (sub-basin risk choropleth).
   *  Omit -> the /<city>/climate-risk theme is hidden. */
  climateRisk?: ClimateRiskConfig;

  /** Water-bodies capability flags (census, ranking tab, ward search,
   *  lost bodies). Omit -> the basic map only. */
  waterBodies?: WaterBodiesConfig;

  /** Show the treatment & discharge panel on the rivers page: per-plant STP
   *  capacity and effluent compliance from the state pollution board, joined to
   *  the river stations downstream. Reads `<cityId>-stps.json`. Omit -> hidden. */
  hasTreatmentDischarge?: boolean;

  /** Which KIND of tanker data this city has. The three are not
   *  interchangeable and must not share a renderer - they answer different
   *  questions off different evidence:
   *  - `household-survey` (default, Bengaluru): longitudinal price surveys of
   *    what households pay a private market. Sampled, demand-side. Reads
   *    `<cityId>-tanker-survey.json`.
   *  - `utility-ledger` (Hyderabad): the utility's own booking/delivery
   *    record, because HMWSSB runs the fleet itself. No prices exist in it.
   *    Reads `<cityId>-tankers.json`.
   *  - `utility-sales-ledger` (Gurugram): the utility's own SALES record -
   *    every tanker load GMDA sold, from which dispensing point, of which
   *    water grade, to which named buyer, at which tariff. A census of
   *    priced transactions. There is no delivery confirmation to measure
   *    because a booking here IS a collection, and no ward or section unit
   *    because the analytical dimensions are station, water type and buyer.
   *    Reads `<cityId>-tanker-sales.json`.
   *
   *  Adding a fourth kind is cheaper than bending one of these: forcing a
   *  city through the wrong panel means making its required fields optional
   *  and gutting its copy, which damages the city the panel was written for. */
  tankerDataKind?: 'household-survey' | 'utility-ledger' | 'utility-sales-ledger';

  /** One-line description of what this city's tanker page actually shows.
   *  The shape of tanker data differs fundamentally by city - Bangalore has
   *  longitudinal HOUSEHOLD PRICE surveys, Hyderabad has the utility's own
   *  BOOKING/DELIVERY ledger - so the teaser card and the page metadata must
   *  not assume one shape. Omit -> the household-survey wording. */
  tankerSummary?: string;

  /** Which reservoir tables this city's data lives in.
   *  - `v2` (default): the multi-city `reservoir_daily_v2` schema
   *    (city_id + source_code), used by every city onboarded after the
   *    multi-city refactor (Madurai, Bangalore, ...).
   *  - `legacy-v1`: Chennai's original `reservoir_daily` /
   *    `reservoir_forecast` tables (no city column). The shared loaders
   *    and the history API select the source from this flag so Chennai
   *    flows through the same dashboard as every other city.
   *  Tracked for migration to v2 in
   *  docs/specs/multi-city-component-discipline.md. */
  reservoirDataSource?: 'v2' | 'legacy-v1';

  /** Reference year for the hero's "On this day in {year}" storage
   *  comparison. Chennai anchors to 2019 (Day Zero). Omit -> same day
   *  LAST year, which is meaningful for every city. The loader only
   *  shows the comparison when the reference day covers the same
   *  sources as today (Mumbai's 2019 backfill holds 2 of 5 dams -
   *  comparing against it would be false comfort). */
  heroComparisonYear?: number;

  /** Storage unit the history chart + reservoir cards render in. Chennai's
   *  legacy data is stored in Mcft; v2 cities use TMC. Default 'TMC'. */
  historyUnit?: 'TMC' | 'Mcft';

  /** Whether this city has the coastal shoreline-change surface
   *  (/<city>/shoreline). Coastal cities only (Chennai today). The
   *  shoreline map currently reads Chennai coastal data; a second coastal
   *  city would parametrize it. Default false. */
  hasShoreline?: boolean;

  /** Ships /:cityId/allocations - the Allocation Ledger (entitled vs received
   *  per supply arrangement, with instruments + confidence grades). Requires a
   *  compiled public/data/allocations-{cityId}.json. See
   *  docs/specs/allocation-ledger.md. */
  hasAllocationLedger?: boolean;

  /** Optional honesty caveat rendered under the days-left hero's number -
   *  e.g. Mumbai's, naming the figure an upper bound because storage counts
   *  whole-dam water while capacity is the city's share. */
  heroNote?: string;

  /** Optional source link rendered after heroNote. */
  heroNoteSource?: { label: string; url: string };

  /** For region places whose dashboard mixes two geographies (the MMR):
   *  short scope labels rendered as badges on each dashboard card, so a
   *  reader always knows whether a card covers the core city or the whole
   *  region. Absent for single-city places - no badges render. */
  dashboardScopes?: { city: string; region: string };

  /** Default time-range tab for the reservoir history chart. Cities whose
   *  recent windows are still sparse (e.g. Mumbai: daily feed just started,
   *  weekly history is 2015-2025) should open on 'all' so the chart doesn't
   *  greet readers with a single dot. Defaults to '1yr'. */
  reservoirHistoryDefaultRange?: '90d' | '1yr' | '3yr' | 'all';

  /** Optional data-coverage note rendered under the dashboard reservoir
   *  history chart - names which sources have archives and since when, so a
   *  sparse window (e.g. a feed that just started) reads as a known gap,
   *  not a bug. */
  reservoirHistoryNote?: string;

  /** Why no storage history exists for this place, when the answer is "nobody
   *  publishes one" rather than "we have not backfilled it yet".
   *
   *  The chart used to infer this from `hasPublicFeed` across the sources, but
   *  that is the wrong question: Delhi's BBMB feed is live and still yields no
   *  storage series, because level over FRL is not a volume and Delhi's share
   *  of Bhakra is unpublished. With a live feed present the inferred branch
   *  promised the chart "fills in automatically", which will never happen.
   *  Set this and that promise is replaced by the actual reason. */
  reservoirHistoryAbsentNote?: string;

  /** Ships /:cityId/commitments - the Commitments Register (dated commitments
   *  by named institutions with a cited status lifecycle; history kept, never
   *  overwritten). Requires public/data/commitments-{cityId}.json. */
  hasCommitments?: boolean;

  /** Which dashboard hero to render for this city.
   *
   *  - `days-left`: Chennai-style runway = total reservoir storage /
   *    (urban demand - desalination). Honest only when the tracked
   *    sources ARE the urban tap supply (CMWSSB reservoirs).
   *  - `allocation`: Vaigai-style status, used where the tracked
   *    sources are upstream irrigation dams with a small allocated
   *    drinking slice (Madurai). Shows live storage + the city's
   *    annual allocation + current draw, without the misleading
   *    days-of-water headline.
   *  - `cauvery-pumping`: Bangalore-style supply-chain story for cities
   *    where the headline is "we pump it from a long way away + local
   *    groundwater + tankers". Renders engineering-document numbers
   *    (Cauvery stages, transmission distance, NRW, IISc stress wards,
   *    Stage V under-delivery) from `<cityId>-supply-overview.json`.
   *    Honest for any pumped-from-far city (Delhi/Mumbai future fits).
   *  - `drainage-capacity`: Kolkata-style story for cities whose water
   *    emergency is drainage, not scarcity. Compares the drainage
   *    system's stated design standard (mm of rain per hour) against
   *    measured hourly rainfall intensity, from
   *    `rainfall-intensity-{cityId}.json`. The only hero that needs no
   *    impounded storage at all, so it is the honest choice for
   *    run-of-river cities where `days-left` is undefined rather than
   *    merely awkward. Requires `drainageCapacity`.
   *  - `none`: suppress hero entirely (cities with no useful summary
   *    yet). Reservoir cards + history chart still render below.
   *
   *  Defaults to `days-left` for back-compat with Chennai. */
  heroMode?:
    | 'days-left'
    | 'allocation'
    | 'cauvery-pumping'
    | 'drainage-capacity'
    | 'none';

  /** Drainage design standard for the `drainage-capacity` hero.
   *  Required when heroMode === 'drainage-capacity'; ignored otherwise.
   *
   *  The standard is CONFIG, not a constant in the component, for two
   *  reasons. It varies by city (Kolkata's British-era sewers are rated
   *  6 mm/h; modern Indian storm-water codes use 12-25 mm/h), and
   *  Kolkata's own figure comes from a 2009 document describing
   *  Victorian brick sewers - if a rehabilitated stretch turns out to
   *  carry a different rating, that is a config edit and a re-cited
   *  source, not a code change. */
  drainageCapacity?: DrainageCapacityConfig;

  /** When the days-left runway is ALREADY published by the source (e.g. BMC's
   *  Mumbai-lakes feed states "days of supply left"), set this so the shared
   *  days-left hero surfaces + attributes + deep-links to it instead of posing
   *  as the calculator: the what-if sliders are hidden and an attribution line
   *  + outbound link replace them. Omit it (Chennai, Madurai) and the hero keeps
   *  its full interactive behaviour - we compute the runway no one else does. */
  runwaySource?: { publisher: string; url: string };

  /** Public, audited urban supply numbers for the allocation hero.
   *  Required when heroMode === 'allocation'; ignored otherwise. */
  urbanSupply?: UrbanSupplyConfig;

  /**
   * Languages this city's UI offers, in display order. First entry is
   * the default. 'en' MUST appear (accessibility floor + translation
   * fallback).
   *
   * For Tamil Nadu cities use ['en', 'ta']; future Karnataka cities
   * use ['en', 'kn']; Maharashtra ['en', 'mr']; Delhi ['en', 'hi']; etc.
   *
   * Cities can ship before any city-language strings are translated -
   * unmatched keys fall back to English at runtime via `t()` in
   * `src/lib/i18n/context.tsx`. Translating `src/lib/i18n/translations.ts`
   * to a new language is independent content work.
   *
   * Defaults to ['en', 'ta'] when omitted (preserves current behaviour
   * for any in-flight city configs that haven't been updated yet).
   */
  availableLanguages?: readonly LanguageCode[];

  /** Languages advertised as coming soon: the switcher renders them
   *  greyed-out/disabled. Move a code to availableLanguages once its
   *  translation pass lands. */
  upcomingLanguages?: readonly LanguageCode[];

  /** Whether the cascade reconstruction overlay is available for this
   *  place. When true, /<city>/water-bodies surfaces a "Show cascade
   *  overlay" toggle that lazy-loads the PMTiles layer from
   *  /tiles/cascade/<cityId>-cascade-{nodes,edges}.pmtiles.
   *
   *  The toggle is opt-in (default off) so initial page weight stays
   *  unchanged. PMTiles use byte-range fetches; a typical district-zoom
   *  view transfers tens of KB.
   *
   *  Default false. Cities/districts get this enabled once the cascade
   *  pipeline (`scripts/run_cascade.py --district <id> run-all`) has
   *  produced the corresponding PMTiles. */
  hasCascadeOverlay?: boolean;

  /** Why this city has NO catchment view, shown on the water-bodies page in
   *  place of the missing toggle. Without it a city that cannot support
   *  catchment delineation just silently lacks a view mode, which reads as an
   *  oversight rather than a decision. Set it wherever `hasCascadeOverlay` is
   *  false for a REASON (Kolkata: 11 m of relief across 40 km of delta);
   *  omit it where the layer is merely not built yet. */
  catchmentsGapNote?: string;

  /** Basin Atlas surfaces hosted by this city. Each id must have a manifest
   *  in src/lib/basins/ and ingested data under public/data/basins/<id>/.
   *  Drives the /<city>/basins/<id> route guard and any basin nav entry.
   *  Basins legitimately exceed city limits; the page states its true extent.
   *  Omit/empty -> the city offers no basin atlas. */
  basinIds?: string[];

  /** When false, the city is registered (data + scrapers can be wired
   *  up) but excluded from user-facing surfaces: listEnabledPlaces(),
   *  the [cityId] route guard, the city switcher, the nav. Mirrors the
   *  `enabled` column on the `cities` table.
   *
   *  Treated as enabled when omitted, so existing Chennai/Madurai
   *  configs stay exposed without modification. */
  enabled?: boolean;

  /** Whether this place is a single municipal `city` (default) or a
   *  multi-corporation `region` (the MMR). Omit -> 'city'; existing
   *  configs are unaffected. Corporation-aware code paths are entered
   *  only when this is 'region' and `corporations` is present, so flat
   *  city -> ward behaviour is the untouched default. */
  placeKind?: PlaceKind;

  /** One-line framing for the regional-water-system card. Required in
   *  practice for any `region` place: the card's default copy used to be
   *  Mumbai's ("nine corporations drawing from one contested source pool"),
   *  which leaked onto Kolkata verbatim. Omit and a neutral line is used. */
  regionIntro?: string;

  /** The municipal corporations of a `region` place, in display order.
   *  Present iff placeKind === 'region'. Absent for every `city` (whose
   *  single ULB lives in `localGovernment`). Each corporation is a
   *  first-class comparable sub-unit with a boundary; ward + deep data
   *  are optional per-corporation enrichments. See docs/specs/mumbai-mmr.md. */
  corporations?: CorporationConfig[];
}

export interface CityConfig extends BasePlaceConfig {
  localGovernment: LocalGovernment;
}

export type PlaceConfig = CityConfig;

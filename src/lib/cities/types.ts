import type { LanguageCode } from '@/lib/i18n/translations';

export type WaterSourceType =
  | 'reservoir'
  | 'cauvery_stage'
  | 'borewell_field'
  | 'river'
  | 'flow_station';

export type PlaceKind = 'city' | 'region';

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

export interface BasePlaceConfig {
  cityId: string;
  displayName: string;
  /** Localized display name in the city's primary regional language
   *  (e.g. Tamil for TN cities). Used wherever copy renders the city
   *  name in that language. Falls back to `displayName` when omitted. */
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
   *  - `none`: suppress hero entirely (cities with no useful summary
   *    yet). Reservoir cards + history chart still render below.
   *
   *  Defaults to `days-left` for back-compat with Chennai. */
  heroMode?: 'days-left' | 'allocation' | 'none';

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
  /**
   * Hide from public-facing discovery surfaces (CitySwitcher dropdown,
   * sitemap.xml). The route itself stays alive so engineers + direct-
   * link visitors can still reach the page; users browsing via nav just
   * don't see it. Default false. Set true for WIP places.
   */
  hiddenFromDiscovery?: boolean;
}

export interface CityConfig extends BasePlaceConfig {
  placeKind: 'city';
  localGovernment: LocalGovernment;
}

export interface RegionConfig extends BasePlaceConfig {
  placeKind: 'region';
}

export type PlaceConfig = CityConfig | RegionConfig;

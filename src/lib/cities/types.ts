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

export interface BasePlaceConfig {
  cityId: string;
  displayName: string;
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

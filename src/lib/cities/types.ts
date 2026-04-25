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
}

export interface CityConfig extends BasePlaceConfig {
  placeKind: 'city';
  localGovernment: LocalGovernment;
}

export interface RegionConfig extends BasePlaceConfig {
  placeKind: 'region';
}

export type PlaceConfig = CityConfig | RegionConfig;

import { CHENNAI } from './chennai';
import { MADURAI } from './madurai';
import type { PlaceConfig } from './types';

export * from './types';
export { CHENNAI, MADURAI };

const REGISTRY: Record<string, PlaceConfig> = {
  [CHENNAI.cityId]: CHENNAI,
  [MADURAI.cityId]: MADURAI,
};

export const DEFAULT_CITY_ID = CHENNAI.cityId;

export function getPlaceConfig(placeId: string = DEFAULT_CITY_ID): PlaceConfig {
  const config = REGISTRY[placeId];
  if (!config) {
    throw new Error(`Unknown place: ${placeId}`);
  }
  return config;
}

export function tryGetPlaceConfig(placeId: string): PlaceConfig | null {
  return REGISTRY[placeId] ?? null;
}

export function listEnabledPlaces(): PlaceConfig[] {
  return Object.values(REGISTRY);
}

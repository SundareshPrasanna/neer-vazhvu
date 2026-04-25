import { CHENNAI } from './chennai';
import type { CityConfig } from './types';

export * from './types';
export { CHENNAI };

const REGISTRY: Record<string, CityConfig> = {
  [CHENNAI.cityId]: CHENNAI,
};

export const DEFAULT_CITY_ID = CHENNAI.cityId;

export function getCityConfig(cityId: string = DEFAULT_CITY_ID): CityConfig {
  const config = REGISTRY[cityId];
  if (!config) {
    throw new Error(`Unknown city: ${cityId}`);
  }
  return config;
}

export function tryGetCityConfig(cityId: string): CityConfig | null {
  return REGISTRY[cityId] ?? null;
}

export function listEnabledCities(): CityConfig[] {
  return Object.values(REGISTRY);
}

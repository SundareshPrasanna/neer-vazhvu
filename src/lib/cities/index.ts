import { CHENNAI } from './chennai';
import { KAVERI } from './kaveri';
import { MADURAI } from './madurai';
import type { PlaceConfig } from './types';

export * from './types';
export { CHENNAI, KAVERI, MADURAI };

const REGISTRY: Record<string, PlaceConfig> = {
  [CHENNAI.cityId]: CHENNAI,
  [KAVERI.cityId]: KAVERI,
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

/**
 * Public-facing places to surface in user-discoverable navigation
 * (CitySwitcher dropdown, sitemap.xml). Excludes places marked
 * hiddenFromDiscovery (typically WIP places whose routes work but
 * aren't ready for public traffic).
 */
export function listDiscoverablePlaces(): PlaceConfig[] {
  return Object.values(REGISTRY).filter((p) => !p.hiddenFromDiscovery);
}

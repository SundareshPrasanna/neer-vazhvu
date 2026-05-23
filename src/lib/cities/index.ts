import { BANGALORE } from './bangalore';
import { CHENNAI } from './chennai';
import { MADURAI } from './madurai';
import type { PlaceConfig } from './types';

export * from './types';
export { BANGALORE, CHENNAI, MADURAI };

// Registry contains every known city, enabled or not. Disabled cities
// (config.enabled === false) are usable internally for scaffolding but
// filtered out of listEnabledPlaces() and out of any user-facing surface
// that calls it. Switch a city on by setting `enabled: true` on its
// CityConfig AND flipping `enabled` to TRUE in the `cities` table.
const REGISTRY: Record<string, PlaceConfig> = {
  [CHENNAI.cityId]: CHENNAI,
  [MADURAI.cityId]: MADURAI,
  [BANGALORE.cityId]: BANGALORE,
};

export const DEFAULT_CITY_ID = CHENNAI.cityId;

export function getPlaceConfig(placeId: string = DEFAULT_CITY_ID): PlaceConfig {
  const config = REGISTRY[placeId];
  if (!config) {
    throw new Error(`Unknown place: ${placeId}`);
  }
  return config;
}

/**
 * Lookup any registered place by id, including disabled ones. Callers
 * rendering user-facing surfaces must additionally check `config.enabled`
 * or use listEnabledPlaces().
 */
export function tryGetPlaceConfig(placeId: string): PlaceConfig | null {
  return REGISTRY[placeId] ?? null;
}

/** Cities visible to end users. Disabled cities are excluded. */
export function listEnabledPlaces(): PlaceConfig[] {
  return Object.values(REGISTRY).filter((p) => p.enabled !== false);
}

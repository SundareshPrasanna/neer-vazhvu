import { BANGALORE } from './bangalore';
import { CHENNAI } from './chennai';
import { DELHI } from './delhi';
import { GURUGRAM } from './gurugram';
import { HYDERABAD } from './hyderabad';
import { KOLKATA } from './kolkata';
import { MADURAI } from './madurai';
import { MUMBAI } from './mumbai';
import { PUNE } from './pune';
import type { PlaceConfig } from './types';

export * from './types';
export {
  BANGALORE,
  CHENNAI,
  DELHI,
  GURUGRAM,
  HYDERABAD,
  KOLKATA,
  MADURAI,
  MUMBAI,
  PUNE,
};

// Registry contains every known city, enabled or not. Disabled cities
// (config.enabled === false) are usable internally for scaffolding but
// filtered out of listEnabledPlaces() and out of any user-facing surface
// that calls it. Switch a city on by setting `enabled: true` on its
// CityConfig AND flipping `enabled` to TRUE in the `cities` table.
const REGISTRY: Record<string, PlaceConfig> = {
  [CHENNAI.cityId]: CHENNAI,
  [MADURAI.cityId]: MADURAI,
  [BANGALORE.cityId]: BANGALORE,
  [MUMBAI.cityId]: MUMBAI,
  [DELHI.cityId]: DELHI,
  [HYDERABAD.cityId]: HYDERABAD,
  [KOLKATA.cityId]: KOLKATA,
  [GURUGRAM.cityId]: GURUGRAM,
  [PUNE.cityId]: PUNE,
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

/** ALL registered cities, including disabled ones. Used for URL parsing
 *  (parsePath / rewriteNavHref) so that navigation to /<disabled-city>/*
 *  still resolves to the correct city instead of falling back to Chennai.
 *  User-facing surfaces (city switcher, sitemap, nav-rewrite targets)
 *  should keep using listVisiblePlaces() or listEnabledPlaces(); only
 *  the URL parser needs to recognise disabled cities. */
export function listAllPlaces(): PlaceConfig[] {
  return Object.values(REGISTRY);
}

/** Enabled cities + any cities listed in NEXT_PUBLIC_PREVIEW_CITIES.
 *  Use this for surfaces that should expose preview cities during
 *  local/branch-deploy development (city switcher, sitemap if you want
 *  preview URLs indexed by Vercel's bot, etc.) but stay hidden in
 *  production unless NEXT_PUBLIC_PREVIEW_CITIES is set on that
 *  deployment.
 *
 *  Production behaviour: NEXT_PUBLIC_PREVIEW_CITIES is unset, so this
 *  returns the same set as listEnabledPlaces().
 *
 *  Branch deploy / local: set NEXT_PUBLIC_PREVIEW_CITIES=bangalore in
 *  .env.local or the Vercel branch-env, and Bangalore (still
 *  enabled=false) becomes visible in switchers/nav. The layout guard
 *  in [cityId]/layout.tsx ALSO checks this env var, so the route
 *  resolves end-to-end. */
export function listVisiblePlaces(): PlaceConfig[] {
  const enabled = Object.values(REGISTRY).filter((p) => p.enabled !== false);
  const previewRaw = process.env.NEXT_PUBLIC_PREVIEW_CITIES;
  if (!previewRaw) return enabled;
  const previewIds = new Set(
    previewRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  const previewExtras = Object.values(REGISTRY).filter(
    (p) => previewIds.has(p.cityId) && p.enabled === false,
  );
  return [...enabled, ...previewExtras];
}

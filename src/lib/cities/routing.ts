/**
 * Shared client-side helpers for city-aware URL routing. Every city lives
 * under /[cityId] ("/madurai", "/madurai/groundwater"); "/" is the landing.
 *
 * The nav header and CitySwitcher both need to parse a pathname into
 * (cityId, feature) and build city-aware hrefs. Keep this logic in one
 * place so the two stay in lockstep.
 */

import { listAllPlaces } from "./index";

/** Each city's routes ("" is the dashboard), from its PlaceConfig. Derived
 *  from the registry, so no city can be missing from it. */
export const FEATURE_AVAILABILITY: Record<string, ReadonlySet<string>> = Object.fromEntries(
  listAllPlaces().map((p) => [p.cityId, new Set<string>(p.routes)]),
);

/**
 * City IDs the URL parser should recognise. Uses listAllPlaces() (NOT
 * listEnabledPlaces) so that disabled cities under PREVIEW_CITIES still
 * get correctly identified by parsePath - otherwise /bangalore/origins
 * would parse as ("chennai", "bangalore/origins") and the nav-rewriter
 * would route Origins clicks to /origins (Chennai's flat URL).
 *
 * Production exposure of disabled cities is gated by the [cityId]/layout
 * route guard (404 when enabled=false and not in PREVIEW_CITIES) - not
 * by this URL-parsing set.
 */
export function knownCityIds(): Set<string> {
  return new Set(listAllPlaces().map((p) => p.cityId));
}

/**
 * Parse a pathname into (cityId, featurePath). A path outside a city is not
 * any city's: the landing page, /atlas/* and /waterways/* resolve to null.
 * /                       -> (null, "")
 * /atlas/tn/salem         -> (null, "")
 * /madurai                -> ("madurai", "")
 * /madurai/groundwater    -> ("madurai", "groundwater")
 */
export function parsePath(
  pathname: string,
  cityIds: Set<string> = knownCityIds(),
): { cityId: string | null; feature: string } {
  const [first = "", ...rest] = pathname.split("/").filter(Boolean);
  return cityIds.has(first) ? { cityId: first, feature: rest.join("/") } : { cityId: null, feature: "" };
}

/**
 * Build the URL for a feature inside a given city. Every city (Chennai
 * included, since the namespace migration) uses /<cityId>/<feature>; the
 * city home is /<cityId>. Falls back to the city's home if the city does
 * not yet support the requested feature. The root path "/" is the project
 * landing page, not a city.
 */
export function buildCityHref(targetCityId: string, feature: string): string {
  const supported = FEATURE_AVAILABILITY[targetCityId];
  const featureToUse = supported && supported.has(feature) ? feature : "";

  return featureToUse === "" ? `/${targetCityId}` : `/${targetCityId}/${featureToUse}`;
}

/**
 * Returns true iff the given Chennai-flat nav href ("/facts", "/flood-risk"
 * etc.) is a feature this city has built. Used by the top-nav to hide nav
 * items that would otherwise silently redirect to city home and show as
 * "active" simultaneously with Dashboard (the multi-highlight bug).
 */
export function isFeatureSupportedForCity(navHref: string, cityId: string): boolean {
  const feature = navHref === "/" ? "" : navHref.replace(/^\//, "");
  const supported = FEATURE_AVAILABILITY[cityId];
  if (!supported) return false; // unknown city: no routes, not every route
  return supported.has(feature);
}

/**
 * Take a Chennai-flat nav href like "/groundwater" or "/" and rewrite it
 * for the city the user is currently on. Used by the top-nav so that
 * clicking "Dashboard" while browsing Madurai stays on Madurai.
 */
export function rewriteNavHref(navHref: string, currentCityId: string): string {
  const feature = navHref === "/" ? "" : navHref.replace(/^\//, "");
  return buildCityHref(currentCityId, feature);
}

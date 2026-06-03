/**
 * Shared client-side helpers for city-aware URL routing.
 *
 * Convention:
 *   - Chennai uses flat URLs at the root: "/", "/groundwater", "/about"
 *   - Other cities use a /[cityId] prefix: "/madurai", "/madurai/groundwater"
 *
 * The nav header and CitySwitcher both need to parse a pathname into
 * (cityId, feature) and build city-aware hrefs. Keep this logic in one
 * place so the two stay in lockstep.
 */

import { listAllPlaces } from "./index";

const CHENNAI_CITY_ID = "chennai";

/** Per-city feature availability. Keep in sync with src/app/[cityId]/<feature>/page.tsx. */
export const FEATURE_AVAILABILITY: Record<string, Set<string>> = {
  chennai: new Set([
    "",
    "about",
    "groundwater",
    "water-bodies",
    "rivers",
    "flood-risk",
    "lake-restoration",
    "my-ward",
    "facts",
    "origins",
    "cascades",
  ]),
  madurai: new Set([
    "",
    "about",
    "groundwater",
    "water-bodies",
    "rivers",
    "flood-risk",
    "lake-restoration",
    "my-ward",
    "facts",
    "origins",
    "cascades",
  ]),
  bangalore: new Set([
    "",
    "about",
    "groundwater",
    "water-bodies",
    "rivers",
    "flood-risk",
    "lake-restoration",
    "my-ward",
    "facts",
    "origins",
    "tanker",
    "cascades",
  ]),
};

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
 * Parse a pathname into (cityId, featurePath).
 * /                       -> ("chennai", "")
 * /groundwater            -> ("chennai", "groundwater")
 * /madurai                -> ("madurai", "")
 * /madurai/groundwater    -> ("madurai", "groundwater")
 * /my-ward/compare        -> ("chennai", "my-ward/compare")
 */
export function parsePath(
  pathname: string,
  cityIds: Set<string> = knownCityIds(),
): { cityId: string; feature: string } {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return { cityId: CHENNAI_CITY_ID, feature: "" };
  if (cityIds.has(segments[0])) {
    return { cityId: segments[0], feature: segments.slice(1).join("/") };
  }
  return { cityId: CHENNAI_CITY_ID, feature: segments.join("/") };
}

/**
 * Build the URL for a feature inside a given city. Chennai uses flat URLs;
 * other cities use /<cityId>/<feature>. Falls back to the city's home if
 * the city does not yet support the requested feature.
 */
export function buildCityHref(targetCityId: string, feature: string): string {
  const supported = FEATURE_AVAILABILITY[targetCityId];
  const featureToUse = supported && supported.has(feature) ? feature : "";

  if (targetCityId === CHENNAI_CITY_ID) {
    return featureToUse === "" ? "/" : `/${featureToUse}`;
  }
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
  if (!supported) return true; // unknown city, fall back to permissive
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

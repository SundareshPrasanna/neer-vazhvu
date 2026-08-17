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
    "climate-risk",
    "shoreline",
    "lake-restoration",
    "my-ward",
    "facts",
    "origins",
    "cascades",
    "allocations",
    "commitments",
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
    "allocations",
    "commitments",
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
    "allocations",
    "commitments",
  ]),
  // Mumbai V1 target set. No `cascades` (Mumbai is reservoir-pumped, not a
  // tank-cascade geography) and no `tanker` (deferred, RTI-gated). Features
  // fill in across M1-M3; this set drives nav rendering while the city is
  // preview-gated (NEXT_PUBLIC_PREVIEW_CITIES=mumbai).
  mumbai: new Set([
    "",
    "about",
    "groundwater",
    "water-bodies",
    "rivers",
    "flood-risk",
    "lake-restoration",
    "facts",
    "origins",
    "shoreline",
    "allocations",
    "commitments",
  ]),
  // Delhi V1 target set (preview-gated until cutover). No `cascades`
  // (baoli/hauz heritage is not a tank-cascade geography), no `shoreline`
  // (landlocked), no `tanker` (DJB booking portal scrape deferred).
  // `allocations` + `commitments` are the signature surfaces: Delhi's supply
  // is instrument-governed inter-state transfers, and the Yamuna programme
  // is a stack of dated deadlines.
  delhi: new Set([
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
    "allocations",
    "commitments",
  ]),
  // Hyderabad V1 target set (preview-gated until cutover). No `shoreline`
  // (landlocked). No `my-ward` at launch: the 300-ward delimitation gazetted
  // 25 Dec 2025 has no public geometry yet, and with the corporations under a
  // Special Officer there are no sitting councillors to attach to a ward
  // either - it returns with the ward build, the Mumbai precedent.
  // `tanker` IS in the set and is a signature surface rather than a
  // nice-to-have: HMWSSB runs the tanker fleet itself and publishes monthly
  // bookings AND deliveries per division/section. Note the fulfilment rate we
  // expected to headline turned out flat at 99.95%, so that page leads on
  // demand volume and seasonality instead.
  // `cascades` shipped 2026-07-26: 428 nodes, 411 edges, max depth 9. The
  // Musi is the only cascade on the platform with a documented catastrophic
  // failure - 221 of 788 tanks breached on 28 September 1908.
  hyderabad: new Set([
    "",
    "about",
    "cascades",
    "groundwater",
    "water-bodies",
    "rivers",
    "flood-risk",
    "lake-restoration",
    "tanker",
    "facts",
    "origins",
    "allocations",
    "commitments",
  ]),
  // Kolkata V1 target set (preview-gated until cutover). Drainage-and-sewage
  // first, which is what the city's data actually supports.
  // No `cascades` (not a cascade geography), no `shoreline` (the riverbank /
  // estuary variant is a different surface and is unbuilt), no `tanker`
  // (KMC runs a municipal tanker service with published per-trip rates but
  // publishes no volumes). `my-ward` is OFF until wards 142-144 are recovered
  // and a ward-name/borough join exists - the KML carries bare numbers only.
  kolkata: new Set([
    "",
    "about",
    "groundwater",
    "water-bodies",
    "rivers",
    "flood-risk",
    "lake-restoration",
    "facts",
    "origins",
    "allocations",
    "commitments",
  ]),
  // Gurugram's live set, deliberately small: six of the platform's sixteen
  // routes. Only surfaces with measured content behind them are listed - see
  // docs/cities/gurugram/parity-scorecard.md, which records the count for each
  // (824 water-body features, 6 groundwater polygons, 29,284 tanker bookings).
  //
  // `groundwater` IS here, and it is here on the IN-GRES *assessment* (six
  // districts, four years, Gurugram at 194.6% extraction), not on water-level
  // depth. The depth series is the thinnest data in the city - 37 India-WRIS
  // stations ending June 2020, and zero telemetry rows - so the page shows the
  // stage-of-extraction choropleth and says plainly that current depth is not
  // published. That distinction is the whole reason the page is honest.
  //
  // `rivers` is absent because Gurugram HAS no river: every NWMP station in
  // the district is a lake or a borewell. That is N/A, not a gap - and it is
  // the entry that exposed the hardcoded "parity: EASY" badge.
  //
  // `my-ward` is absent although the 36 ward polygons are harvested: nothing
  // is joined to them yet, and the page rendered 296 characters. A route in
  // the nav must have something in it.
  //
  // Features fill in as their artifacts land. Adding one here without content
  // behind it is the failure mode this comment exists to prevent.
  gurugram: new Set([
    "",
    "about",
    "origins",
    "groundwater",
    "water-bodies",
    "tanker",
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

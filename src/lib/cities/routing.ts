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
  // Gurugram preview set, deliberately small. Only the surfaces with data
  // behind them are listed: the tanker sales ledger, the water-body register
  // and the ward map. No `groundwater` - the signature issue is the thinnest
  // data (37 WRIS stations ending June 2020, no telemetry) and an empty
  // groundwater page on a dark-zone city would read as a bug rather than as
  // the gap it is. No `rivers`, because Gurugram has no river. Features fill
  // in as their artifacts land; this set drives nav while the city is
  // preview-gated (NEXT_PUBLIC_PREVIEW_CITIES=gurugram).
  gurugram: new Set([
    "",
    "about",
    "origins",
    "groundwater",
    "water-bodies",
    "my-ward",
    "tanker",
  ]),
  // Pune preview set. Only surfaces with real artifacts behind them.
  //
  // `groundwater` is in and is the strongest layer: 14 talukas x 6 IN-GRES
  // editions, reproducing CGWB's National Compilation 2025 exactly, with
  // Shirur critical at 95.71% inside a district that reads SAFE at 63.73%.
  // `rivers` is in because Pune has five and CPCB rates four of those
  // stretches Priority I or II. `facts` is in because facts-pune.json
  // ships 22 cards, every figure of which is READ from an artifact already in
  // the repo rather than transcribed again, so a quoted card cannot drift from
  // the dashboard it came from. `tanker` is in on the fourth tankerDataKind,
  // `delivery-register`, added rather than bending Hyderabad's utility-ledger
  // panel: PMC's register is a DISPATCH record with no bookings in it, so the
  // fulfilment rate that page is built on does not exist here.
  //
  // `flood-risk` is in on the NARRATIVE variant, which needs no hazard
  // polygons. It was off on the reasoning that WRD publishes Pune's flood lines
  // as 518 scanned PDF sheets so the hazard layer does not exist - true, but
  // that was an argument about the INTERACTIVE variant. The narrative stack
  // carries the event register plus PMC's 1,014 km nalla network, and the
  // flood-line absence ships as a data gap on the page.
  //
  // NOT in, each for a stated reason rather than pending work:
  // `my-ward` - the 41 prabhags exist as NAMED GEOMETRY in the repo, but no
  //   ward rows exist in the database, so /api/wards?city=pune 404s and the
  //   page renders a heading over nothing. Turned off at cutover rather than
  //   shipped empty: a live-and-empty page is issue #279, filed against
  //   Gurugram during this same onboarding. Kolkata is off for the same
  //   reason. Returns with the ward seeding, not with a better endpoint.
  // `lake-restoration`, `allocations`, `commitments` - no artifacts built.
  // `cascades` - the cascade pipeline has not been run for Pune district.
  // `shoreline` - landlocked.
  pune: new Set([
    "",
    "about",
    "origins",
    "facts",
    "groundwater",
    "water-bodies",
    "rivers",
    "flood-risk",
    "tanker",
  ]),
  // Surat V1 target set. No `cascades` (not a cascade geography), no `my-ward`
  // (zone is the analytical unit and all three ward schemes lack downloadable
  // geometry - WFS is disabled on SMC's own GIS), no `allocations` (no
  // published entitlement instrument exists), no `shoreline` (genuinely
  // coastal, but the surface still reads Chennai coastal data), no `tanker`
  // (95% piped coverage; tanker-served properties are NA in every year of the
  // open data). Every omission carries a written reason in
  // scripts/lib/exemptions.ts.
  surat: new Set([
    "",
    "about",
    "groundwater",
    "water-bodies",
    "rivers",
    "flood-risk",
    "facts",
    "origins",
    "commitments",
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

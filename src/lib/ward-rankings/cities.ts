/**
 * Which cities have a ward-rankings bundle.
 *
 * SINGLE SOURCE OF TRUTH, and it exists because there were two. `loadWardRankings`
 * carried this list inline as a chain of `if (cityId === ...) return load...()`,
 * and `ward-selector.tsx` rendered its "Browse all wards ranked" link with no
 * check at all. Gurugram has a my-ward page but no rankings bundle, so the link
 * rendered and the route it pointed at 404ed - `/gurugram/my-ward/rankings`
 * calls `loadWardRankings`, gets null, and calls notFound().
 *
 * This module is deliberately free of `fs` so a client component can import it;
 * load-rankings.ts reads files and cannot be imported from the browser.
 *
 * Adding a city: add its id here AND a loader branch in load-rankings.ts. The
 * test in ward-rankings-cities.test.ts asserts the two agree.
 */
export const CITIES_WITH_WARD_RANKINGS: ReadonlySet<string> = new Set([
  "chennai",
  "madurai",
  "bangalore",
  "mumbai",
  "delhi",
]);

export function hasWardRankings(cityId: string): boolean {
  return CITIES_WITH_WARD_RANKINGS.has(cityId);
}

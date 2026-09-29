import { PREBAKED_RANKING_SPECS } from "./specs";

/**
 * Which cities have a ward-rankings bundle: Chennai (computed live from its
 * ward profiles) plus every city with a pre-baked spec. Derived, so the
 * "Browse all wards ranked" link and the rankings route cannot disagree.
 * Free of `fs` so a client component can import it.
 */
export const CITIES_WITH_WARD_RANKINGS: ReadonlySet<string> = new Set([
  "chennai",
  ...Object.keys(PREBAKED_RANKING_SPECS),
]);

export function hasWardRankings(cityId: string): boolean {
  return CITIES_WITH_WARD_RANKINGS.has(cityId);
}

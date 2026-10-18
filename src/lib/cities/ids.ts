import { CITY_IDS } from "../../cities/generated/ids";

/** Every registered place, in list order: one per folder in src/cities/,
 *  listed by scripts/gen-city-index.ts. A new folder makes every
 *  `Record<CityId, X>` (the registry included) a type error until it is filled in. */
export { CITY_IDS };

export type CityId = (typeof CITY_IDS)[number];

const IDS: ReadonlySet<string> = new Set(CITY_IDS);

export function isCityId(id: string): id is CityId {
  return IDS.has(id);
}

/** Every /[cityId]/<route> directory ("" is the dashboard). A city lists the
 *  ones it ships in PlaceConfig.routes; nav, sitemap, route guards and the
 *  exemptions register all derive from that list. */
export const ROUTE_KEYS = [
  "",
  "about",
  "allocations",
  "climate-risk",
  "commitments",
  "facts",
  "flood-risk",
  "groundwater",
  "lake-restoration",
  "my-ward",
  "origins",
  "rivers",
  "shoreline",
  "tanker",
  "water-bodies",
] as const;

export type RouteKey = (typeof ROUTE_KEYS)[number];

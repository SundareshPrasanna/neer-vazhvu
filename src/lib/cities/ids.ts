/** Every registered place. Adding an id here makes every `Record<CityId, X>`
 *  (the registry included) a type error until the new city is filled in. */
export const CITY_IDS = [
  "chennai",
  "madurai",
  "bangalore",
  "mumbai",
  "delhi",
  "hyderabad",
  "kolkata",
  "gurugram",
  "pune",
  "surat",
] as const;

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

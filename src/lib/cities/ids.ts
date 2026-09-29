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

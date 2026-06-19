/**
 * Single source of truth for per-city data-file names under public/data
 * and public/geojson.
 *
 * Most files already follow the convention (`<cityId>-<dataset>.geojson`
 * or `<dataset>-<cityId>.json`). Chennai retains a few legacy UNPREFIXED
 * names from when it was the only city. That exception is encapsulated
 * here so no shared component ever inlines a `cityId === "chennai"` path
 * check. Tracked for rename in
 * docs/specs/multi-city-component-discipline.md.
 *
 * Functions return file names (for fs joins under public/) and URL helpers
 * return the public path (for client `fetch`).
 */

const CHENNAI = "chennai";

/** public/data/restoration-priority[-<cityId>].json */
export function restorationPriorityFile(cityId: string): string {
  return cityId === CHENNAI
    ? "restoration-priority.json"
    : `restoration-priority-${cityId}.json`;
}
export function restorationPriorityUrl(cityId: string): string {
  return `/data/${restorationPriorityFile(cityId)}`;
}

/** public/data/<cityId>-ward-profiles.json (Chennai: ward-profiles.json) */
export function wardProfilesFile(cityId: string): string {
  return cityId === CHENNAI ? "ward-profiles.json" : `${cityId}-ward-profiles.json`;
}
export function wardProfilesUrl(cityId: string): string {
  return `/data/${wardProfilesFile(cityId)}`;
}

/** public/data/<cityId>-ward-names.json (Chennai: ward-names.json) */
export function wardNamesFile(cityId: string): string {
  return cityId === CHENNAI ? "ward-names.json" : `${cityId}-ward-names.json`;
}

/** public/geojson/<cityId>-water-bodies-current.geojson (already conventional) */
export function waterBodiesCurrentUrl(cityId: string): string {
  return `/geojson/${cityId}-water-bodies-current.geojson`;
}
/** public/geojson/<cityId>-water-bodies-lost.geojson (already conventional) */
export function waterBodiesLostUrl(cityId: string): string {
  return `/geojson/${cityId}-water-bodies-lost.geojson`;
}
/** public/geojson/<cityId>-rivers.geojson (already conventional) */
export function riversUrl(cityId: string): string {
  return `/geojson/${cityId}-rivers.geojson`;
}

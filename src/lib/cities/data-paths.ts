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

/**
 * Rivers-page renderer selection, derived from the city's data layout (not a
 * city-id check in render code - see multi-city-component-discipline.md rule 3
 * and rule 4: legacy-data exceptions live in this single module).
 *
 * - `"chennai-combined"`: the richer combined-rivers map (CPCB stations +
 *   industrial pollution sources + Cooum sewage inlets overlay, legend
 *   toggles, ward search, pollution detail panel). Backed by Chennai's legacy
 *   unprefixed `river-quality.json` / `industrial-sources.json` /
 *   `cooum-sewage-inlets.json`. Any city that lands that data layout can adopt
 *   this variant by extending the map below.
 * - `null`: the shared RiversClient (Madurai, Bangalore, and every new city).
 */
export type RiversVariant = "chennai-combined";
export function riversVariant(cityId: string): RiversVariant | null {
  return cityId === CHENNAI ? "chennai-combined" : null;
}

/** public/data/river-quality[-<cityId>].json (Chennai: river-quality.json) */
export function riverQualityUrl(cityId: string): string {
  return cityId === CHENNAI
    ? "/data/river-quality.json"
    : `/data/river-quality-${cityId}.json`;
}

/** public/data/industrial-sources[-<cityId>].json (Chennai: industrial-sources.json) */
export function industrialSourcesUrl(cityId: string): string {
  return cityId === CHENNAI
    ? "/data/industrial-sources.json"
    : `/data/industrial-sources-${cityId}.json`;
}

/** public/data/<cityId>-sewage-inlets.json (Chennai: cooum-sewage-inlets.json).
 *  Only Chennai ships this overlay today; returns null where absent. */
export function sewageInletsUrl(cityId: string): string | null {
  return cityId === CHENNAI ? "/data/cooum-sewage-inlets.json" : null;
}

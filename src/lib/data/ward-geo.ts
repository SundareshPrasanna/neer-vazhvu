/**
 * Shared, module-cached loader for ward GeoJSON.
 * Ensures a single fetch per URL across ward-map, flood-risk-map, and
 * use-ward-lookup. Defaults to Chennai's wards GeoJSON; pass a different
 * URL for other cities (e.g. /geojson/madurai-wards-2022.geojson).
 */

const DEFAULT_URL = "/geojson/chennai-wards-2022.geojson";
const cache = new Map<string, Promise<GeoJSON.FeatureCollection>>();

export function getWardGeoJSON(
  url: string = DEFAULT_URL,
): Promise<GeoJSON.FeatureCollection> {
  let entry = cache.get(url);
  if (!entry) {
    entry = fetch(url)
      .then((r) => r.json())
      .catch((err) => {
        cache.delete(url);
        throw err;
      });
    cache.set(url, entry);
  }
  return entry;
}

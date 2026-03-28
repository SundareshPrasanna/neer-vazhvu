/**
 * Shared, module-cached loader for Chennai ward GeoJSON.
 * Ensures a single fetch across ward-map, flood-risk-map, and use-ward-lookup.
 */

let cached: Promise<GeoJSON.FeatureCollection> | null = null;

export function getWardGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  if (!cached) {
    cached = fetch("/geojson/chennai-wards-2022.geojson")
      .then((r) => r.json())
      .catch((err) => {
        cached = null;
        throw err;
      });
  }
  return cached;
}

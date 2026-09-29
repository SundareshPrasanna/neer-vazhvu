/**
 * Shared, module-cached loader for ward GeoJSON.
 * Ensures a single fetch per URL across ward-map, flood-risk-map, and
 * use-ward-lookup. Callers pass the city's URL (wardsGeoJsonPathFor); there is
 * no default city.
 *
 * MISSING WARD GEOMETRY IS A LEGITIMATE STATE, not an error. Hyderabad has
 * no public ward file at all - its 300-ward delimitation was gazetted in
 * December 2025 and the geometry has not been released - and any future city
 * will be in the same position between registration and the ward build. So a
 * 404 resolves to an EMPTY FeatureCollection rather than throwing.
 *
 * Without the r.ok guard, a 404 returns Next.js's HTML error page, r.json()
 * throws a SyntaxError, and callers that forgot a .catch() raise an unhandled
 * rejection (ward-map.tsx did exactly this). The block-layer fetches in
 * ward-map already guard r.ok for the same reason; this brings the ward
 * loader in line.
 */
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const cache = new Map<string, Promise<GeoJSON.FeatureCollection>>();

export function getWardGeoJSON(url: string | null): Promise<GeoJSON.FeatureCollection> {
  if (!url) return Promise.resolve(EMPTY);
  let entry = cache.get(url);
  if (!entry) {
    entry = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<GeoJSON.FeatureCollection>) : EMPTY))
      .catch((err) => {
        // Network-level failure (offline, DNS). Do NOT cache it - a later
        // call should retry rather than inherit a permanent empty layer.
        cache.delete(url);
        console.error(`ward geojson fetch failed for ${url}:`, err);
        return EMPTY;
      });
    cache.set(url, entry);
  }
  return entry;
}

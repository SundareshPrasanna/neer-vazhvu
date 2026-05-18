/**
 * Esri Wayback Imagery release IDs mapped to calendar years.
 *
 * Esri Wayback publishes ~150 historical snapshots of the World Imagery
 * basemap going back to 2014. Each release is a global mosaic at a
 * point in time, at the same high-resolution (0.3-1m) as current
 * World Imagery. For each year, we pick the release closest to
 * mid-year (July 1) so the snapshot is reasonably representative of
 * that calendar year.
 *
 * URL pattern:
 *   https://wayback.maptiles.arcgis.com/arcgis/rest/services/world_imagery/MapServer/tile/{releaseId}/{z}/{y}/{x}
 *
 * Coverage:
 *   - Pre-2014: no Wayback. Fall back to our static Landsat-era chips.
 *   - 2014-present: Wayback releases at ~1-3 month intervals.
 *
 * License: same as Esri World Imagery - free for non-commercial use
 * with attribution. Resolution varies by location; ~0.3-1m where
 * commercial imagery is available, lower in remote areas.
 *
 * Refresh: re-run scripts/fetch-wayback-releases.ts (or hand-update)
 * when a new calendar year starts or when Esri publishes major new
 * release coverage.
 *
 * Last updated: 2026-05-18.
 */

export const WAYBACK_FIRST_YEAR = 2014;

// Mid-year-closest release per calendar year, verified against the live
// waybackconfig.json on 2026-05-18. Each entry's source-date is the
// actual Wayback snapshot date the release ID maps to. Refresh by re-
// running scripts/fetch-wayback-releases.ts (TODO).
export const WAYBACK_RELEASE_BY_YEAR: Record<number, number> = {
  2014: 3026,   // 2014-07-02
  2015: 11952,  // 2015-06-24
  2016: 13240,  // 2016-07-06
  2017: 4073,   // 2017-06-27
  2018: 11334,  // 2018-06-27
  2019: 645,    // 2019-06-26
  2020: 18289,  // 2020-07-01 (exact)
  2021: 13534,  // 2021-06-30
  2022: 4905,   // 2022-06-29
  2023: 47963,  // 2023-06-29
  2024: 39767,  // 2024-06-27
  2025: 48925,  // 2025-06-26
  2026: 49059,  // 2026-04-30 (latest available; 62d off mid-year)
};

export const WAYBACK_TILE_URL_TEMPLATE =
  "https://wayback.maptiles.arcgis.com/arcgis/rest/services/world_imagery/MapServer/tile/{releaseId}/{z}/{y}/{x}";

export const WAYBACK_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, GIS User Community';

/**
 * Returns the Wayback tile URL for a given year, with the {releaseId}
 * placeholder substituted. Returns null when the year predates Wayback
 * coverage (the caller falls back to a static Landsat-era chip).
 */
export function getWaybackTileUrl(year: number): string | null {
  const releaseId = WAYBACK_RELEASE_BY_YEAR[year];
  if (releaseId == null) return null;
  return WAYBACK_TILE_URL_TEMPLATE.replace("{releaseId}", String(releaseId));
}

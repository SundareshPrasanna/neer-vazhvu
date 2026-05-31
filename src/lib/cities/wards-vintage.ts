/**
 * Per-city ward delimitation vintage. Chennai and Madurai use the 2022
 * GCC / MMC delimitation; Bengaluru uses the GBA 2025 delimitation
 * (Karnataka Act 36 of 2025, notified November 2025).
 *
 * Single source of truth so the my-ward map, the groundwater ward
 * choropleth, the ward-risk overlay, and the wards-interpolated API
 * all read the same vintage per city instead of hard-coding 2022 in
 * five places.
 *
 * Adding a new city: append its city_id + vintage string here, drop
 * the matching `<city_id>-wards-<vintage>.geojson` into
 * /public/geojson/, and every ward-aware surface picks it up.
 */

const WARDS_VINTAGE: Record<string, string> = {
  chennai: "2022",
  madurai: "2022",
  bangalore: "2025",
};

const DEFAULT_VINTAGE = "2022";

export function wardsVintageFor(cityId: string): string {
  return WARDS_VINTAGE[cityId] ?? DEFAULT_VINTAGE;
}

export function wardsGeoJsonPathFor(cityId: string): string {
  return `/geojson/${cityId}-wards-${wardsVintageFor(cityId)}.geojson`;
}

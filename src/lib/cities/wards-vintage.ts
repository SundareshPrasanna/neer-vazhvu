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
  // Mumbai uses the 24 BMC administrative wards (A..T), not the 227
  // electoral wards; "2023" tags the DataMeet source vintage.
  mumbai: "2023",
  // Delhi uses the 250 post-unification MCD wards, final delimitation
  // notified September 2022 (NOT the pre-merger 272).
  delhi: "2022",
  // Gurugram uses MCG's 36 wards as published on GMDA OneMap
  // (harvest_arcgis_rest.py). "2026" tags the harvest vintage, not a
  // delimitation year: the layer carries ward_no and a zone code but no
  // delimitation date, and GMDA publishes none alongside it.
  gurugram: "2026",
};

const DEFAULT_VINTAGE = "2022";

export function wardsVintageFor(cityId: string): string {
  return WARDS_VINTAGE[cityId] ?? DEFAULT_VINTAGE;
}

export function wardsGeoJsonPathFor(cityId: string): string {
  return `/geojson/${cityId}-wards-${wardsVintageFor(cityId)}.geojson`;
}

/**
 * Per-region municipal-corporation boundary vintage (region places only, e.g.
 * the MMR). Mirrors the wards pattern: the `<cityId>-corporations-<vintage>`
 * GeoJSON is the admin layer of the 9 corporations. Only defined for region
 * places; city places have no entry and no corporations file.
 */
const CORPORATIONS_VINTAGE: Record<string, string> = {
  mumbai: "2024",
};

export function corporationsVintageFor(cityId: string): string | null {
  return CORPORATIONS_VINTAGE[cityId] ?? null;
}

export function corporationsGeoJsonPathFor(cityId: string): string | null {
  const v = corporationsVintageFor(cityId);
  return v ? `/geojson/${cityId}-corporations-${v}.geojson` : null;
}

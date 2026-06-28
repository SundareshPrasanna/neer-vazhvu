/* ── Climate Risk (sub-basin risk index) types and constants ──────────
 *
 * Source: TNGCC and CEEW. 2026. "Towards Climate-resilient River Systems in
 * Chennai" (CC BY-NC 4.0). Risk = Hazard x Exposure x Vulnerability (IPCC AR5),
 * 33 indicators, 5-class Jenks. One GeoJSON of 6 sub-basin polygons; each
 * subtheme recolors the same polygons by its `<subtheme>_class` property.
 */

export type ClimateSubtheme = "risk" | "hazard" | "exposure" | "vulnerability";

export type ClimateClass = "very_low" | "low" | "moderate" | "high" | "very_high";

export const CLIMATE_SUBTHEMES: ClimateSubtheme[] = [
  "risk",
  "hazard",
  "exposure",
  "vulnerability",
];

export const CLIMATE_CLASSES: ClimateClass[] = [
  "very_high",
  "high",
  "moderate",
  "low",
  "very_low",
];

/** Sequential OrRd-style ramp: pale (very low) -> dark red (very high). */
export const CLIMATE_RISK_COLORS: Record<ClimateClass, string> = {
  very_high: "#b30000",
  high: "#e34a33",
  moderate: "#fc8d59",
  low: "#fdcc8a",
  very_low: "#fef0d9",
};

/** The four indicator groups reported per sub-basin (Figs ES6-ES11). */
export type DriverGroup = "hazard" | "exposure" | "adaptive_capacity" | "sensitivity";

export const DRIVER_GROUPS: DriverGroup[] = [
  "hazard",
  "exposure",
  "adaptive_capacity",
  "sensitivity",
];

export interface SubBasinDrivers {
  hazard: string[];
  exposure: string[];
  adaptive_capacity: string[];
  sensitivity: string[];
}

export interface SubBasinProperties {
  sub_basin: string;
  boundary_quality: "derived" | "approximate";
  credit: string;
  risk_class: ClimateClass;
  hazard_class: ClimateClass;
  exposure_class: ClimateClass;
  vulnerability_class: ClimateClass;
  risk_score: number;
  unmet_mcm_2020: number | null;
  unmet_mcm_2050: number | null;
  drivers: SubBasinDrivers;
}

/** Read the class for the active subtheme off a feature's properties. */
export function classForSubtheme(
  props: SubBasinProperties,
  subtheme: ClimateSubtheme,
): ClimateClass {
  return props[`${subtheme}_class` as const];
}

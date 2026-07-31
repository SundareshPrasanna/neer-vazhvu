/**
 * CGWB assessment classification scale for corridor pages.
 *
 * The color scale IS the content on a corridor map, so it is validated, not
 * eyeballed. Light-mode palette passes all checks of the dataviz palette
 * validator (lightness band, chroma floor, adjacent-pair CVD separation
 * >= 8, normal-vision floor >= 15, run 2026-07-27). Dark mode is a separate
 * selection: the dark surface's narrow lightness band (L 0.48-0.67) cannot
 * hold three warm hues at full margins, so the dark set maximizes the
 * perceptual floors (worst adjacent CVD 9.3, normal 15.9, both PASS) and
 * accepts a <=0.031 breach of the aesthetic lightness band on two steps.
 * Secondary encoding is therefore always on: dashed strokes on the two
 * stressed classes, labels in every tooltip, and a full table view.
 *
 * `salinity` is a CGWB category meaning "poor-quality aquifer, not assessed
 * on extraction". It carries no stage percentage and must never be rendered
 * on the severity ramp (DECISIONS.md D9).
 */

export type AssessmentCategory =
  | "safe"
  | "semi_critical"
  | "critical"
  | "over_exploited"
  | "salinity";

export const CATEGORY_ORDER: AssessmentCategory[] = [
  "safe",
  "semi_critical",
  "critical",
  "over_exploited",
  "salinity",
];

export const CATEGORY_LABELS: Record<AssessmentCategory, string> = {
  safe: "Safe",
  semi_critical: "Semi-Critical",
  critical: "Critical",
  over_exploited: "Over-Exploited",
  salinity: "Saline (not assessed)",
};

export const CATEGORY_COLORS_LIGHT: Record<AssessmentCategory, string> = {
  safe: "#047857",
  semi_critical: "#e0a408",
  critical: "#e64040",
  over_exploited: "#961b1b",
  salinity: "#7c3aed",
};

export const CATEGORY_COLORS_DARK: Record<AssessmentCategory, string> = {
  safe: "#0f9186",
  semi_critical: "#c99508",
  critical: "#df4d4d",
  over_exploited: "#a61045",
  salinity: "#8b5cf6",
};

export const NO_DATA_COLOR_LIGHT = "#9ca3af";
export const NO_DATA_COLOR_DARK = "#6b7280";

/** Dashed-stroke secondary encoding for the two stressed classes. */
export function strokeDashFor(category: AssessmentCategory | null): string | undefined {
  if (category === "over_exploited") return "2 4";
  if (category === "critical") return "6 4";
  return undefined;
}

export function categoryColor(
  category: string | null | undefined,
  dark: boolean,
): string {
  const palette = dark ? CATEGORY_COLORS_DARK : CATEGORY_COLORS_LIGHT;
  if (category && category in palette) return palette[category as AssessmentCategory];
  return dark ? NO_DATA_COLOR_DARK : NO_DATA_COLOR_LIGHT;
}

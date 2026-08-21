// Shared plain-language labels for the Basin Atlas panels AND the PDF export.
//
// The atlas component (basin-atlas.tsx) pairs these with its Tailwind chip
// classes; the PDF report (basin-pdf-report.tsx) pairs them with its own print
// colors. Keeping the words here - and only the words - means the two surfaces
// can never drift apart, and the PDF module never has to import the Leaflet
// component tree at runtime.

/** Accountability-matrix verdict labels: the value of the matrix is making
 *  "exists in MPR vs doesn't" explicit per region x category, so absence
 *  reads as a finding, not a blank. */
export const ACC_VERDICT_LABEL: Record<"tracked" | "in-plan-not-reported" | "reported-not-in-plan" | "silent", string> = {
  tracked: "In plan + MPR",
  "in-plan-not-reported": "In plan, not in MPR",
  "reported-not-in-plan": "In MPR, not in plan",
  silent: "Not in plan or MPR",
};

export const ACC_KIND_LABEL: Record<"ulb" | "ia" | "gp", string> = {
  ulb: "ULBs",
  ia: "Industrial Areas",
  gp: "Gram Panchayats",
};

/** DEP thematic-area coverage labels (covered / district-level / not-covered). */
export const DEP_STATUS_LABEL: Record<"covered" | "district-level" | "not-covered", string> = {
  covered: "In the plan",
  "district-level": "District-level only",
  "not-covered": "Not covered",
};

// Display order and labels of the 7 NGT thematic areas (OA 360/2018).
export const DEP_THEME_LABEL: Record<string, string> = {
  "waste-management": "Waste Management",
  "water-quality": "Water Quality",
  "domestic-sewage": "Domestic Sewage",
  "industrial-wastewater": "Industrial Wastewater",
  "air-quality": "Air Quality",
  mining: "Mining Activity",
  noise: "Noise Pollution",
};
export const DEP_THEME_ORDER = Object.keys(DEP_THEME_LABEL);
export const DEP_SUBTHEME_LABEL: Record<string, string> = {
  "solid-waste": "Solid Waste",
  "plastic-waste": "Plastic Waste",
  "cd-waste": "C&D Waste",
  "biomedical-waste": "Biomedical Waste",
  "hazardous-waste": "Hazardous Waste",
  "e-waste": "E-Waste",
};

export function depThemeTitle(t: { theme: string; subtheme?: string }): string {
  const base = DEP_THEME_LABEL[t.theme] ?? t.theme;
  return t.subtheme ? `${base}: ${DEP_SUBTHEME_LABEL[t.subtheme] ?? t.subtheme}` : base;
}

/** Bar accents for the PRS status editions, oldest to newest. Sliced from the
 *  END, so a two-edition basin gets exactly the rose/crimson pair the
 *  Arkavathi has always used and a third edition extends it backwards. */
const EPOCH_ACCENTS = ["#fecdd3", "#fda4af", "#fb7185", "#b91c1c"];
export function withEpochAccents<T>(epochs: T[]): (T & { accent: string })[] {
  const accents = EPOCH_ACCENTS.slice(-Math.max(epochs.length, 1));
  return epochs.map((e, i) => ({ ...e, accent: accents[i] ?? EPOCH_ACCENTS[0] }));
}

/** Map colours for the stretch, indexed from the NEWEST edition backwards. The
 *  growth view draws older reaches on top and thicker, so each newer band
 *  shows only where the stretch extended in that edition. */
const PRS_MAP_COLORS = ["#dc2626", "#f97316", "#fbbf24", "#fde68a"];
export const prsMapColor = (fromNewest: number) =>
  PRS_MAP_COLORS[Math.min(Math.max(fromNewest, 0), PRS_MAP_COLORS.length - 1)];

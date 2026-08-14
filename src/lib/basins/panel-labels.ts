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

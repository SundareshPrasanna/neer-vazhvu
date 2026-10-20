/**
 * Water-test parameters a resident can report from a home meter or a Jal
 * Jeevan Mission field test kit, with the BIS IS 10500:2012 limits including
 * Amendment 1 (2015: iron acceptable 1.0; arsenic no relaxation) and
 * Amendment 2 (2018). Read from the BIS copy at
 * https://consumerhelpline.gov.in/public/assets/docs/bis/IS10500-2012.pdf
 */

export const BIS_SOURCE = "https://consumerhelpline.gov.in/public/assets/docs/bis/IS10500-2012.pdf";

type Limit =
  /** acceptable max; permissible max where no other source exists (null = no relaxation) */
  | { kind: "max"; acceptable: number; permissible: number | null }
  | { kind: "range"; min: number; max: number }
  /** chlorinated supply, tested at the tap: at least `min`, at most `max` */
  | { kind: "min"; min: number; max: number }
  /** not detectable in 100 ml */
  | { kind: "absent" };

export interface Parameter {
  key: string;
  name: string;
  unit: string;
  /** Largest value accepted; 1 for the present/absent bacteria test. */
  max: number;
  limit: Limit;
}

export const PARAMETERS: readonly Parameter[] = [
  { key: "tds", name: "TDS", unit: "mg/L", max: 10000, limit: { kind: "max", acceptable: 500, permissible: 2000 } },
  { key: "ph", name: "pH", unit: "", max: 14, limit: { kind: "range", min: 6.5, max: 8.5 } },
  { key: "fluoride", name: "Fluoride", unit: "mg/L", max: 50, limit: { kind: "max", acceptable: 1.0, permissible: 1.5 } },
  { key: "nitrate", name: "Nitrate", unit: "mg/L", max: 1000, limit: { kind: "max", acceptable: 45, permissible: null } },
  { key: "hardness", name: "Total hardness", unit: "mg/L as CaCO3", max: 5000, limit: { kind: "max", acceptable: 200, permissible: 600 } },
  { key: "alkalinity", name: "Total alkalinity", unit: "mg/L as CaCO3", max: 5000, limit: { kind: "max", acceptable: 200, permissible: 600 } },
  { key: "chloride", name: "Chloride", unit: "mg/L", max: 20000, limit: { kind: "max", acceptable: 250, permissible: 1000 } },
  { key: "iron", name: "Iron", unit: "mg/L", max: 50, limit: { kind: "max", acceptable: 1.0, permissible: null } },
  { key: "arsenic", name: "Arsenic", unit: "mg/L", max: 5, limit: { kind: "max", acceptable: 0.01, permissible: null } },
  { key: "chlorine", name: "Free residual chlorine", unit: "mg/L", max: 20, limit: { kind: "min", min: 0.2, max: 1 } },
  { key: "turbidity", name: "Turbidity", unit: "NTU", max: 1000, limit: { kind: "max", acceptable: 1, permissible: 5 } },
  { key: "bacteria", name: "Bacteria (H2S or coliform test)", unit: "", max: 1, limit: { kind: "absent" } },
];

const BY_KEY = new Map(PARAMETERS.map((p) => [p.key, p]));

export function getParameter(key: string): Parameter | undefined {
  return BY_KEY.get(key);
}

const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 3 });

/** "Fluoride 1.2 mg/L", or "Bacteria (...) detected". */
export function valueText(p: Parameter, v: number): string {
  if (p.limit.kind === "absent") return `${p.name}: ${v ? "detected" : "not detected"}`;
  return `${p.name} ${fmt(v)}${p.unit ? ` ${p.unit}` : ""}`;
}

/** How a value sits against the BIS limits, as plain sentences; null when within the acceptable limit. */
export function assess(p: Parameter, v: number): string | null {
  const l = p.limit;
  switch (l.kind) {
    case "max":
      if (v <= l.acceptable) return null;
      if (l.permissible == null) return `Above the national standard's limit of ${fmt(l.acceptable)}.`;
      // BIS's "permissible limit in the absence of alternate source".
      return v <= l.permissible
        ? `Above the ${fmt(l.acceptable)} the national standard recommends. Up to ${fmt(l.permissible)} is allowed only if no better water source is available.`
        : `Above ${fmt(l.permissible)}, the most the national standard allows even when no better source is available.`;
    case "range":
      return v >= l.min && v <= l.max ? null : `Outside the national standard's range of ${fmt(l.min)} to ${fmt(l.max)}.`;
    case "min":
      if (v < l.min) return `Below the national standard's minimum of ${fmt(l.min)} for chlorinated supply.`;
      return v > l.max ? `Above the national standard's limit of ${fmt(l.max)}.` : null;
    case "absent":
      return v ? "The national standard allows none in any 100 ml sample." : null;
  }
}

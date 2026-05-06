/**
 * Pollution source type. Historically a Chennai-only union; widened to
 * plain string so Madurai's tannery / textile_dyeing / sewage_outfall
 * fit without forking the type. Chennai-specific call sites that need
 * exhaustive narrow typing should reference ChennaiPollutionSourceType.
 */
export type PollutionSourceType = string;

export type ChennaiPollutionSourceType =
  | "thermal_power"
  | "petrochemical"
  | "chemical"
  | "port"
  | "industrial_estate"
  | "discharge_zone";

/**
 * Pollutant tag. Widened the same way - new cities can carry
 * "azo_dyes", "chromium", "surfactants", etc. without forking.
 */
export type PollutantType = string;

export type ChennaiPollutantType =
  | "fly_ash"
  | "heavy_metals"
  | "petroleum"
  | "ammonia"
  | "thermal"
  | "general_industrial";

export interface IncidentRecord {
  date: string;       // "YYYY-MM"
  description: string;
  description_ta?: string;
  volume?: string;
  volume_ta?: string;
  source: string;
}

export interface PollutionSource {
  id: string;
  name: string;
  name_ta?: string;
  type: PollutionSourceType;
  lat: number;
  lng: number;
  operator: string;
  rivers_affected: string[]; // river IDs from river-quality.json
  pollutants: PollutantType[];
  description: string;
  description_ta?: string;
  ngt_orders?: string[];
  ngt_orders_ta?: string[];
  incidents?: IncidentRecord[];
  source: string;
}

export interface IndustrialPollutionData {
  last_updated: string; // "YYYY-MM"
  source: string;
  sources: PollutionSource[];
}

export const SOURCE_TYPE_COLORS: Record<string, string> = {
  thermal_power:     "#dc2626", // red
  petrochemical:     "#7c3aed", // purple
  chemical:          "#f97316", // orange
  port:              "#0ea5e9", // blue
  industrial_estate: "#4d7c0f", // dark lime
  discharge_zone:    "#64748b", // slate
  // Madurai-region additions:
  tannery:           "#7c2d12", // brown
  textile_dyeing:    "#be185d", // pink
  sewage_outfall:    "#0f172a", // slate-900
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  thermal_power:     "Thermal Power",
  petrochemical:     "Petrochemical",
  chemical:          "Chemical / Fertilizer",
  port:              "Port",
  industrial_estate: "Industrial Estate",
  discharge_zone:    "Discharge Zone",
  tannery:           "Tannery",
  textile_dyeing:    "Textile Dyeing",
  sewage_outfall:    "Sewage Outfall",
};

/** Lookup with a friendly fallback for new types. */
export function sourceTypeColor(type: string): string {
  return SOURCE_TYPE_COLORS[type] ?? "#475569"; // slate-600
}

export function sourceTypeLabel(type: string): string {
  return SOURCE_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

export const POLLUTANT_LABELS: Record<string, string> = {
  fly_ash:            "Fly Ash",
  heavy_metals:       "Heavy Metals",
  petroleum:          "Petroleum / Oil",
  ammonia:            "Ammonia",
  thermal:            "Thermal Discharge",
  general_industrial: "Industrial Effluent",
};

export const POLLUTANT_COLORS: Record<string, string> = {
  fly_ash:            "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  heavy_metals:       "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  petroleum:          "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  ammonia:            "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  thermal:            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  general_industrial: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function pollutantLabel(p: string): string {
  return POLLUTANT_LABELS[p] ?? p.replace(/_/g, " ");
}

export function pollutantColor(p: string): string {
  return POLLUTANT_COLORS[p] ?? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300";
}

export const RIVER_DISPLAY_NAMES: Record<string, string> = {
  cooum: "Cooum",
  adyar: "Adyar",
  "buckingham-canal": "Buckingham Canal",
  kosasthalaiyar: "Kosasthalaiyar",
};

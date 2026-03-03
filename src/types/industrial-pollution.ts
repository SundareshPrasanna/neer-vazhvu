export type PollutionSourceType =
  | "thermal_power"
  | "petrochemical"
  | "chemical"
  | "port"
  | "industrial_estate"
  | "discharge_zone";

export type PollutantType =
  | "fly_ash"
  | "heavy_metals"
  | "petroleum"
  | "ammonia"
  | "thermal"
  | "general_industrial";

export interface IncidentRecord {
  date: string;       // "YYYY-MM"
  description: string;
  volume?: string;
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
  ngt_orders?: string[];
  incidents?: IncidentRecord[];
  source: string;
}

export interface IndustrialPollutionData {
  last_updated: string; // "YYYY-MM"
  source: string;
  sources: PollutionSource[];
}

export const SOURCE_TYPE_COLORS: Record<PollutionSourceType, string> = {
  thermal_power: "#dc2626",     // red
  petrochemical: "#7c3aed",     // purple
  chemical: "#f97316",          // orange
  port: "#0ea5e9",              // blue
  industrial_estate: "#84cc16", // lime
  discharge_zone: "#64748b",    // slate
};

export const SOURCE_TYPE_LABELS: Record<PollutionSourceType, string> = {
  thermal_power: "Thermal Power",
  petrochemical: "Petrochemical",
  chemical: "Chemical / Fertilizer",
  port: "Port",
  industrial_estate: "Industrial Estate",
  discharge_zone: "Discharge Zone",
};

export const POLLUTANT_LABELS: Record<PollutantType, string> = {
  fly_ash: "Fly Ash",
  heavy_metals: "Heavy Metals",
  petroleum: "Petroleum / Oil",
  ammonia: "Ammonia",
  thermal: "Thermal Discharge",
  general_industrial: "Industrial Effluent",
};

export const POLLUTANT_COLORS: Record<PollutantType, string> = {
  fly_ash: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  heavy_metals: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  petroleum: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  ammonia: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  thermal: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  general_industrial: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export const RIVER_DISPLAY_NAMES: Record<string, string> = {
  cooum: "Cooum",
  adyar: "Adyar",
  "buckingham-canal": "Buckingham Canal",
  kosasthalaiyar: "Kosasthalaiyar",
};

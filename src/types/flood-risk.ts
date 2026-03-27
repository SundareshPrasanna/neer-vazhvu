/* ── Flood Risk types and constants ─────────────────────────── */

export type FloodViewMode = "hazard" | "historical" | "drainage";

export type HazardCategory = "very_high" | "high" | "moderate" | "low" | "very_low";

export type VulnerabilityLevel = "Very High Vulnerability" | "High Vulnerability" | "Low Vulnerability";

export const HAZARD_COLORS: Record<HazardCategory, string> = {
  very_high: "#dc2626",
  high: "#f97316",
  moderate: "#eab308",
  low: "#22c55e",
  very_low: "#3b82f6",
};

export const VULNERABILITY_COLORS: Record<string, string> = {
  "Very High Vulnerability": "#dc2626",
  "High Vulnerability": "#f97316",
  "Low Vulnerability": "#22c55e",
};

export const DRAINAGE_COLORS: Record<string, string> = {
  "Macro Drain": "#dc2626",
  "Micro Drain": "#f97316",
  "SWD": "#3b82f6",
  "Side Drain": "#8b5cf6",
  "Side drain": "#8b5cf6",
  "Open Drain": "#f59e0b",
  "Closed": "#64748b",
};

export const DRAINAGE_WIDTHS: Record<string, number> = {
  "Macro Drain": 4,
  "Micro Drain": 3,
  "SWD": 2,
  "Side Drain": 1.5,
  "Side drain": 1.5,
  "Open Drain": 2,
  "Closed": 1.5,
};

export const RETURN_PERIODS = [5, 10, 25, 50, 100, 200] as const;
export type ReturnPeriod = (typeof RETURN_PERIODS)[number];

/* ── GeoJSON property interfaces ───────────────────────────── */

export interface HazardZoneProperties {
  category: HazardCategory;
  area: number;
}

export interface DepthPointProperties {
  DEPTH: number;
  F_REMARKS: string;
  F_LATITUDE: number;
  F_LONGITUDE: number;
}

export interface Hotspot2015Properties {
  location: string;
  vulnerability: string;
  inundation_ft: string;
  inundation_level: string;
  zone: number;
  ward: number;
  latitude: number;
  longitude: number;
}

export interface Hotspot2020Properties {
  name: string;
  latitude: number;
  longitude: number;
}

export interface DrainageProperties {
  street: string;
  location: string;
  ward: string;
  zone: string;
  drain_type: string;
  detail: string;
  material: string;
  status: string;
  cover: string;
  drain_dep: number;
  drain_wid: number;
  drain_len: number;
  source: string;
}

export interface ReturnPeriodProperties {
  return_period: number;
  risk_level: string;
}

/* ── Selected feature discriminated union ──────────────────── */

export type SelectedFloodFeature =
  | { kind: "hazard"; props: HazardZoneProperties; latlng: [number, number] }
  | { kind: "depth"; props: DepthPointProperties; latlng: [number, number] }
  | { kind: "hotspot2015"; props: Hotspot2015Properties; latlng: [number, number] }
  | { kind: "hotspot2020"; props: Hotspot2020Properties; latlng: [number, number] }
  | { kind: "drainage"; props: DrainageProperties; latlng: [number, number] }
  | { kind: "return_period"; props: ReturnPeriodProperties; latlng: [number, number] };

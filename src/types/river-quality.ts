export type RiverQualityStatus =
  | "dead"
  | "severely_degraded"
  | "degraded"
  | "stressed"
  | "healthy";

export interface RiverQualityReading {
  year: number;
  do_mgl: number | null; // Dissolved oxygen mg/L
  bod_mgl: number | null; // Biochemical oxygen demand mg/L
  ph: number | null;
  conductivity_us: number | null; // µS/cm
}

export interface RiverStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  stretch: string; // "Upper" | "Middle" | "Lower" | "Estuary" | etc.
  readings: RiverQualityReading[];
}

export interface RiverData {
  id: string;
  name: string;
  name_ta: string;
  length_km: number;
  overall_status: RiverQualityStatus;
  cpcb_class: string;
  description: string;
  notes: string;
  stations: RiverStation[];
}

export interface RiverQualityData {
  last_updated: string; // "YYYY-MM"
  data_year_range: [number, number];
  source: string;
  rivers: RiverData[];
}

export interface SelectedRiver {
  riverId: string;
  stationId?: string; // undefined = river-level click
  latlng: [number, number];
}

export const QUALITY_COLORS: Record<RiverQualityStatus, string> = {
  dead: "#dc2626",
  severely_degraded: "#f97316",
  degraded: "#eab308",
  stressed: "#84cc16",
  healthy: "#22c55e",
};

export const QUALITY_LABELS: Record<RiverQualityStatus, string> = {
  dead: "Dead",
  severely_degraded: "Severely Degraded",
  degraded: "Degraded",
  stressed: "Stressed",
  healthy: "Healthy",
};

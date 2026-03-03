export type WaterBodyStatus =
  | "fully_lost"
  | "severely_reduced"
  | "partially_encroached";

export type WaterBodyType =
  | "lake"
  | "tank"
  | "eri"
  | "marsh"
  | "pond"
  | "reservoir";

export interface CurrentWaterBodyProperties {
  osm_id: number;
  osm_type: string;
  name: string;
  name_ta: string;
  water_type: string;
  area_ha: number | null;
}

export interface LostWaterBodyProperties {
  name: string;
  name_ta: string;
  type: WaterBodyType;
  status: WaterBodyStatus;
  historical_area_ha: number;
  current_area_ha?: number;
  replaced_by: string;
  approx_radius_m: number;
  source: string;
  notes: string;
  notes_ta?: string;
}

export type SelectedWaterBody =
  | { kind: "current"; props: CurrentWaterBodyProperties; latlng: [number, number] }
  | { kind: "lost"; props: LostWaterBodyProperties; latlng: [number, number] };

export const STATUS_LABELS: Record<WaterBodyStatus, string> = {
  fully_lost: "Fully Lost",
  severely_reduced: "Severely Reduced",
  partially_encroached: "Partially Encroached",
};

export const STATUS_COLORS: Record<WaterBodyStatus, string> = {
  fully_lost: "#dc2626",
  severely_reduced: "#f97316",
  partially_encroached: "#eab308",
};

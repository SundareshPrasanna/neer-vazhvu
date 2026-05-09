import type { ScoredWaterBody } from "@/types/restoration";

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

export interface CensusWaterBodyProperties {
  id: number;
  census_code: string | null;
  name: string | null;
  water_body_type: string | null;
  nature: string | null;
  ownership: string | null;
  latitude: number;
  longitude: number;
  storage_capacity_original: number | null;
  storage_capacity_present: number | null;
  storage_loss_pct: number | null;
  max_depth_m: number | null;
  water_spread_area: number | null;
  construction_year: number | null;
  renovation_year: number | null;
  basin: string | null;
  sub_basin: string | null;
  is_in_use: boolean | null;
  encroachment_status: string | null;
  encroachment_pct: number | null;
  ward_name: string | null;
  village: string | null;
}

export type SelectedWaterBody =
  | { kind: "current"; props: CurrentWaterBodyProperties; latlng: [number, number]; censusMatch?: CensusWaterBodyProperties }
  | { kind: "lost"; props: LostWaterBodyProperties; latlng: [number, number] }
  | { kind: "census"; props: CensusWaterBodyProperties; latlng: [number, number] }
  // Flagship-curated scored body that has no OSM polygon and no census
  // match (Madurai's Vandiyur tank etc.). The detail panel reads
  // restoration metadata from the embedded ScoredWaterBody directly,
  // bypassing the osm_id-based lookup the other kinds use.
  | { kind: "scored"; scored: ScoredWaterBody; latlng: [number, number] };

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

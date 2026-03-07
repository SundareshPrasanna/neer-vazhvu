export type PriorityLevel = "critical" | "high" | "moderate" | "low";

export interface ScoredWaterBody {
  osm_id: number;
  name: string;
  name_ta: string;
  water_type: string;
  area_ha: number;
  centroid: [number, number]; // [lat, lng]
  priority_score: number;
  priority_level: PriorityLevel;
  components: {
    size: number;
    lost_proximity: number;
    river_pollution: number;
    industrial_proximity: number;
    type_bonus: number;
  };
  nearest_lost_body: string | null;
  nearest_lost_km: number | null;
  nearest_river_station: string | null;
  nearest_river_km: number | null;
  nearest_industrial: string | null;
  nearest_industrial_km: number | null;
}

export interface RestorationPriorityData {
  computed_at: string;
  total_scored: number;
  weights: Record<string, number>;
  water_bodies: ScoredWaterBody[];
}

const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  critical: "#dc2626",
  high: "#f97316",
  moderate: "#eab308",
  low: "#22c55e",
};

export function getPriorityColor(level: PriorityLevel): string {
  return PRIORITY_COLORS[level];
}

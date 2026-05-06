export type PriorityLevel = "critical" | "high" | "moderate" | "low";

/**
 * One scored water body. The shape is shared across cities; algorithm-
 * specific component breakdowns live in `components` (free-form
 * record) and the Chennai-only "nearest X" lookups are optional so
 * Madurai (and future cities) can omit them without forking the type.
 */
export interface ScoredWaterBody {
  id: string; // "osm:12345" or "census:67" or "flagship:Vandiyur tank"
  source: "osm" | "census" | "matched" | "flagship"; // "flagship" = hand-curated entry
  osm_id: number | null;
  census_id: number | null;
  name: string;
  name_ta: string;
  water_type: string;
  area_ha: number;
  centroid: [number, number]; // [lat, lng]
  priority_score: number;
  priority_level: PriorityLevel;
  /**
   * Algorithm-specific component breakdown. Chennai uses
   * { size, lost_proximity, river_pollution, industrial_proximity,
   *   type_bonus, census_condition }. Madurai uses
   * { status_severity, cultural_bonus, size, confidence_multiplier }.
   * Render generically; show whichever keys are present.
   */
  components: Record<string, number>;
  /** One-line summary of the score's drivers. Optional. */
  rationale?: string;
  /** Chennai-only lookup fields (omitted by other cities). */
  nearest_lost_body?: string | null;
  nearest_lost_body_ta?: string | null;
  nearest_lost_km?: number | null;
  nearest_river_station?: string | null;
  nearest_river_station_ta?: string | null;
  nearest_river_km?: number | null;
  nearest_industrial?: string | null;
  nearest_industrial_ta?: string | null;
  nearest_industrial_km?: number | null;
}

export interface RiverSection {
  osm_id: number;
  name: string;
  name_ta: string;
  water_type: string;
  area_ha: number;
}

export interface RestorationPriorityData {
  computed_at: string;
  total_scored: number;
  weights: Record<string, number>;
  water_bodies: ScoredWaterBody[];
  river_sections: RiverSection[];
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

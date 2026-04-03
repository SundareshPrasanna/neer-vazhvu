export type SurfaceWaterAnomalyLevel =
  | "much_lower"
  | "lower"
  | "near_normal"
  | "higher"
  | "much_higher";

export type WaterBodySatelliteConfidenceLevel = "low" | "medium" | "high";

export interface WaterBodySatelliteSummary {
  geeTargetId: string;
  summaryDate: string;
  osmId: number | null;
  censusId: number | null;
  name: string | null;
  historicalPersistencePct: number | null;
  latestObservedAreaHa: number | null;
  seasonalBaselineAreaHa: number | null;
  anomalyRatio: number | null;
  surfaceWaterAnomalyLevel: SurfaceWaterAnomalyLevel;
  observationStart: string | null;
  observationEnd: string | null;
  sensorSource: string;
  confidenceLevel: WaterBodySatelliteConfidenceLevel;
  validPixelPct: number | null;
}

interface WaterBodySatelliteSummaryApiRow {
  gee_target_id: string;
  summary_date: string;
  osm_id: number | null;
  census_id: number | null;
  name: string | null;
  historical_persistence_pct: number | null;
  latest_observed_area_ha: number | null;
  seasonal_baseline_area_ha: number | null;
  anomaly_ratio: number | null;
  surface_water_anomaly_level: SurfaceWaterAnomalyLevel;
  observation_start: string | null;
  observation_end: string | null;
  sensor_source: string;
  confidence_level: WaterBodySatelliteConfidenceLevel;
  valid_pixel_pct: number | null;
}

export function normalizeWaterBodySatelliteSummary(
  row: WaterBodySatelliteSummaryApiRow,
): WaterBodySatelliteSummary {
  return {
    geeTargetId: row.gee_target_id,
    summaryDate: row.summary_date,
    osmId: row.osm_id,
    censusId: row.census_id,
    name: row.name,
    historicalPersistencePct: row.historical_persistence_pct,
    latestObservedAreaHa: row.latest_observed_area_ha,
    seasonalBaselineAreaHa: row.seasonal_baseline_area_ha,
    anomalyRatio: row.anomaly_ratio,
    surfaceWaterAnomalyLevel: row.surface_water_anomaly_level,
    observationStart: row.observation_start,
    observationEnd: row.observation_end,
    sensorSource: row.sensor_source,
    confidenceLevel: row.confidence_level,
    validPixelPct: row.valid_pixel_pct,
  };
}

export function shouldShowWaterBodySatelliteSummary(
  row: WaterBodySatelliteSummary | null,
): row is WaterBodySatelliteSummary {
  return Boolean(row && row.confidenceLevel !== "low");
}

export function satelliteAnomalyTone(
  level: SurfaceWaterAnomalyLevel,
): "lower" | "near_normal" | "higher" {
  if (level === "much_lower" || level === "lower") {
    return "lower";
  }
  if (level === "higher" || level === "much_higher") {
    return "higher";
  }
  return "near_normal";
}

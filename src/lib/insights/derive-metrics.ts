/**
 * Pure functions that extract numeric summaries from raw data.
 * These are the inputs to narrative variant selection.
 */

import type { GroundwaterApiResponse } from "@/types/groundwater";
import type { PriorityLevel } from "@/types/restoration";

// -- Types --

export interface ReservoirMetrics {
  storagePct: number;
  totalStorageMcft: number;
  totalCapacityMcft: number;
  lastUpdated: string; // date string, e.g. "2026-03-27"
}

export interface GroundwaterMetrics {
  totalWards: number;
  stressedCount: number; // stressed + critical + crisis
  declineCount: number; // wards with trend === "declining"
  cityAverage: number | null;
  period: { year: number; month: number };
}

export interface RestorationMetrics {
  totalScored: number;
  criticalCount: number;
  highCount: number;
  moderateCount: number;
  lowCount: number;
}

export interface CityStoryMetrics {
  reservoir: ReservoirMetrics;
  groundwater: GroundwaterMetrics;
  restoration: RestorationMetrics;
}

// -- Derivation functions --

export function deriveReservoirMetrics(
  totalStorage: number,
  totalCapacity: number,
  lastUpdated: string,
): ReservoirMetrics {
  return {
    storagePct: totalCapacity > 0 ? (totalStorage / totalCapacity) * 100 : 0,
    totalStorageMcft: totalStorage,
    totalCapacityMcft: totalCapacity,
    lastUpdated,
  };
}

export function deriveGroundwaterMetrics(
  data: GroundwaterApiResponse,
): GroundwaterMetrics {
  const { summary, wards, cityAverage, period } = data;
  return {
    totalWards: wards.length,
    stressedCount: summary.stressed + summary.critical + summary.crisis,
    declineCount: wards.filter((w) => w.trend === "declining").length,
    cityAverage,
    period,
  };
}

export function deriveRestorationMetrics(
  restorationJson: { total_scored: number; water_bodies: Array<{ priority_level: PriorityLevel }> },
): RestorationMetrics {
  const counts: Record<PriorityLevel, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
  for (const wb of restorationJson.water_bodies) {
    counts[wb.priority_level]++;
  }
  return {
    totalScored: restorationJson.total_scored,
    criticalCount: counts.critical,
    highCount: counts.high,
    moderateCount: counts.moderate,
    lowCount: counts.low,
  };
}

import type { CensusWaterBodyProperties } from "@/types/water-bodies";

export type CensusCapacityIssue =
  | "present_gt_original"
  | "original_exceeds_area_depth_upper_bound"
  | "present_exceeds_area_depth_upper_bound"
  | "near_zero_present_but_in_use_no_encroachment"
  | "encroachment_mismatch";

export interface CensusCapacityAssessment {
  hasCapacity: boolean;
  capacityPct: number | null;
  issues: CensusCapacityIssue[];
  shouldHideCapacity: boolean;
}

const AREA_DEPTH_TOLERANCE = 1.05;

export function getCensusCapacityUpperBoundM3(
  census: Pick<CensusWaterBodyProperties, "water_spread_area" | "max_depth_m">,
): number | null {
  if (
    census.water_spread_area == null ||
    census.max_depth_m == null ||
    census.water_spread_area <= 0 ||
    census.max_depth_m <= 0
  ) {
    return null;
  }

  return census.water_spread_area * 10_000 * census.max_depth_m;
}

export function assessCensusCapacity(
  census: Pick<
    CensusWaterBodyProperties,
    | "storage_capacity_original"
    | "storage_capacity_present"
    | "water_spread_area"
    | "max_depth_m"
    | "is_in_use"
    | "encroachment_status"
    | "encroachment_pct"
  >,
): CensusCapacityAssessment {
  const original = census.storage_capacity_original;
  const present = census.storage_capacity_present;
  const hasCapacity = original != null && original > 0;
  const capacityPct =
    hasCapacity && present != null ? Math.round((present / original) * 100) : null;

  const issues: CensusCapacityIssue[] = [];

  if (hasCapacity && present != null && present > original) {
    issues.push("present_gt_original");
  }

  const upperBound = getCensusCapacityUpperBoundM3(census);
  if (hasCapacity && upperBound != null && original > upperBound * AREA_DEPTH_TOLERANCE) {
    issues.push("original_exceeds_area_depth_upper_bound");
  }
  if (
    hasCapacity &&
    present != null &&
    upperBound != null &&
    present > upperBound * AREA_DEPTH_TOLERANCE
  ) {
    issues.push("present_exceeds_area_depth_upper_bound");
  }

  if (
    hasCapacity &&
    present != null &&
    census.is_in_use === true &&
    census.encroachment_status !== "yes" &&
    capacityPct != null &&
    capacityPct < 1
  ) {
    issues.push("near_zero_present_but_in_use_no_encroachment");
  }

  if (
    census.encroachment_status === "yes" &&
    (census.encroachment_pct ?? 0) > 0 &&
    capacityPct != null &&
    capacityPct >= 90
  ) {
    issues.push("encroachment_mismatch");
  }

  const shouldHideCapacity = issues.some((issue) => issue !== "encroachment_mismatch");

  return {
    hasCapacity,
    capacityPct,
    issues,
    shouldHideCapacity,
  };
}

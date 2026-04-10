import type { WardProfile } from "@/lib/hooks/use-ward-profile";
import type { Grade } from "@/lib/utils/ward-rankings";
import {
  METRICS,
  computeMetric,
  percentileToGrade,
  percentileForValue,
  getSortedValues,
  computeCompositeScore,
  percentileFromRank,
  type MetricComputation,
} from "@/lib/utils/ward-rankings";
import { INTERVENTIONS, type Intervention } from "@/lib/data/uplift-benchmarks";

/* ── Types ──────────────────────────────────────────────────────────── */

export interface MetricGap {
  metricKey: string;
  labelKey: string;
  descriptionKey: string;
  unit: string;
  weight: number;
  higherIsBetter: boolean;
  /** null when the metric is not applicable to this ward. */
  currentValue: number | null;
  currentPercentile: number;
  currentGrade: Grade;
  cityMedian: number | null;
  thresholdD: number | null;
  thresholdC: number | null;
  thresholdB: number | null;
  thresholdA: number | null;
  /** How much the raw value must change to reach the next grade up. null if N/A or already A. */
  gapToNextGrade: number | null;
  nextGrade: Grade | null;
  applicable: boolean;
}

export interface InterventionAllocation {
  interventionId: string;
  labelKey: string;
  descriptionKey: string;
  metricKey: string;
  units: number;
  unitLabelKey: string;
  costCrLow: number;
  costCrHigh: number;
  costCrMid: number;
  metricBefore: number;
  metricAfter: number;
  percentileBefore: number;
  percentileAfter: number;
  gradeBefore: Grade;
  gradeAfter: Grade;
}

export interface UpliftPlan {
  wardNumber: number;
  totalBudgetCr: number;
  budgetSpentCr: number;
  budgetRemainingCr: number;
  gapAnalysis: MetricGap[];
  allocations: InterventionAllocation[];
  overallPercentileBefore: number;
  overallPercentileAfter: number;
  overallGradeBefore: Grade;
  overallGradeAfter: Grade;
}

/* ── Precomputed city distributions ────────────────────────────────── */

interface CityDistributions {
  metricComps: MetricComputation[];
  /** Sorted ascending arrays of metric values, one per metric key. */
  sortedValues: Map<string, number[]>;
  /** Raw value at each grade boundary, per metric key. */
  thresholds: Map<string, { p20: number; p40: number; p60: number; p80: number }>;
}

/**
 * Pre-compute all city-wide distributions once. Reusable across
 * multiple budget slider values for the same ward.
 */
export function buildCityDistributions(allProfiles: WardProfile[]): CityDistributions {
  const metricComps = METRICS.map((def) => computeMetric(def, allProfiles));
  const sortedValues = new Map<string, number[]>();
  const thresholds = new Map<string, { p20: number; p40: number; p60: number; p80: number }>();

  for (const mc of metricComps) {
    const sv = getSortedValues(mc);
    sortedValues.set(mc.def.key, sv);

    // Find the raw values at each percentile boundary.
    // For higherIsBetter: p80 means "value at which you'd beat 80% of wards"
    // For lowerIsBetter: p80 means "value low enough to beat 80% of wards"
    if (sv.length > 0) {
      thresholds.set(mc.def.key, {
        p20: valueAtPercentile(sv, 20, mc.def.higherIsBetter),
        p40: valueAtPercentile(sv, 40, mc.def.higherIsBetter),
        p60: valueAtPercentile(sv, 60, mc.def.higherIsBetter),
        p80: valueAtPercentile(sv, 80, mc.def.higherIsBetter),
      });
    }
  }

  return { metricComps, sortedValues, thresholds };
}

/**
 * Find the raw metric value that would achieve approximately the given
 * percentile in the sorted distribution.
 */
function valueAtPercentile(sortedAsc: number[], targetPct: number, higherIsBetter: boolean): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;

  // The percentile formula is: pct = (total - rank) / (total - 1) * 100
  // Invert: rank = total - pct * (total - 1) / 100
  // Index in sorted order depends on higherIsBetter:
  //   higherIsBetter: rank 1 = highest value (last in ascending)
  //   lowerIsBetter:  rank 1 = lowest value (first in ascending)
  const rank = Math.max(1, Math.round(n - (targetPct * (n - 1)) / 100));

  if (higherIsBetter) {
    // rank 1 = sortedAsc[n-1], rank n = sortedAsc[0]
    const idx = Math.max(0, Math.min(n - 1, n - rank));
    return sortedAsc[idx];
  } else {
    // rank 1 = sortedAsc[0], rank n = sortedAsc[n-1]
    const idx = Math.max(0, Math.min(n - 1, rank - 1));
    return sortedAsc[idx];
  }
}

/* ── Gap analysis ──────────────────────────────────────────────────── */

export function computeGapAnalysis(
  wardNumber: number,
  allProfiles: WardProfile[],
  cityDist: CityDistributions,
): MetricGap[] {
  const ward = allProfiles.find((p) => p.ward_number === wardNumber);
  if (!ward) return [];

  return cityDist.metricComps.map((mc) => {
    const def = mc.def;
    const isApplicable = !def.applicable || def.applicable(ward);
    const currentPct = isApplicable
      ? mc.percentileByWard.get(wardNumber) ?? 50
      : 50;
    const currentGrade = percentileToGrade(currentPct);
    const currentValue = isApplicable ? def.extract(ward) : null;
    const th = cityDist.thresholds.get(def.key) ?? null;

    let gapToNextGrade: number | null = null;
    let nextGrade: Grade | null = null;

    if (isApplicable && currentValue != null && th) {
      const thresholdForNext = getNextThreshold(currentGrade, th, def.higherIsBetter);
      if (thresholdForNext != null) {
        gapToNextGrade = Math.abs(thresholdForNext - currentValue);
        nextGrade = getNextGradeUp(currentGrade);
      }
    }

    return {
      metricKey: def.key,
      labelKey: def.label,
      descriptionKey: def.description,
      unit: def.unit,
      weight: def.weight,
      higherIsBetter: def.higherIsBetter,
      currentValue,
      currentPercentile: Math.round(currentPct),
      currentGrade,
      cityMedian: mc.cityMedian,
      thresholdD: th?.p20 ?? null,
      thresholdC: th?.p40 ?? null,
      thresholdB: th?.p60 ?? null,
      thresholdA: th?.p80 ?? null,
      gapToNextGrade,
      nextGrade,
      applicable: isApplicable,
    };
  });
}

function getNextGradeUp(grade: Grade): Grade | null {
  switch (grade) {
    case "F": return "D";
    case "D": return "C";
    case "C": return "B";
    case "B": return "A";
    case "A": return null;
  }
}

function getNextThreshold(
  grade: Grade,
  th: { p20: number; p40: number; p60: number; p80: number },
  higherIsBetter: boolean,
): number | null {
  // Return the raw metric value needed to reach the next grade.
  // For higherIsBetter: need to reach the threshold value.
  // For lowerIsBetter: need to go below the threshold value.
  switch (grade) {
    case "F": return th.p20;
    case "D": return th.p40;
    case "C": return th.p60;
    case "B": return th.p80;
    case "A": return null; // already top
  }
}

/* ── Greedy budget optimizer ───────────────────────────────────────── */

interface ProjectedState {
  /** Current projected raw metric value per metric key. */
  values: Map<string, number>;
  /** Units already allocated per intervention id. */
  allocated: Map<string, number>;
}

/**
 * Compute the raw metric value of a ward after applying projected changes.
 * For area-normalized metrics this uses the ward's area.
 */
function applyIntervention(
  currentRawValue: number,
  intervention: Intervention,
  units: number,
  ward: WardProfile,
): number {
  const metricDef = METRICS.find((m) => m.key === intervention.metricKey);
  if (!metricDef) return currentRawValue;

  // wb_health is special: the metric is avg_restoration_score, not area-normalized.
  // Restoring one body reduces avg score by impactPerUnit / current_count.
  if (intervention.metricKey === "wb_health") {
    const bodyCount = ward.water_bodies.current_count;
    if (bodyCount === 0) return currentRawValue;
    const delta = (intervention.impactPerUnit * units) / bodyCount;
    return Math.max(0, currentRawValue - delta);
  }

  // All other metrics are area-normalized: the raw value is quantity/area.
  // Adding `units` of physical quantity changes the numerator.
  const area = ward.area_sq_km;
  if (!area || area <= 0) return currentRawValue;

  if (intervention.impactDirection === "add") {
    return currentRawValue + (intervention.impactPerUnit * units) / area;
  } else {
    return Math.max(0, currentRawValue - (intervention.impactPerUnit * units) / area);
  }
}

/**
 * Compute the composite overall percentile for the ward given projected
 * metric values. Uses the same weighted-sum-of-percentiles formula as
 * the report card, but with projected values ranked against the real
 * city distribution.
 */
function projectedOverallPercentile(
  ward: WardProfile,
  projectedValues: Map<string, number>,
  cityDist: CityDistributions,
  allProfiles: WardProfile[],
): number {
  let compositeScore = 0;

  for (const mc of cityDist.metricComps) {
    const def = mc.def;
    const isApplicable = !def.applicable || def.applicable(ward);
    if (!isApplicable) {
      compositeScore += 50 * def.weight; // neutral
      continue;
    }

    const projectedValue = projectedValues.get(def.key);
    if (projectedValue == null) {
      compositeScore += 50 * def.weight;
      continue;
    }

    const sv = cityDist.sortedValues.get(def.key);
    if (!sv || sv.length === 0) {
      compositeScore += 50 * def.weight;
      continue;
    }

    const pct = percentileForValue(projectedValue, sv, def.higherIsBetter);
    compositeScore += pct * def.weight;
  }

  // Now find what percentile this composite score would be among all wards.
  // Compute composite scores for all other wards.
  const allComposites: number[] = [];
  for (const p of allProfiles) {
    if (p.ward_number === ward.ward_number) continue;
    allComposites.push(computeCompositeScore(p, cityDist.metricComps));
  }
  allComposites.sort((a, b) => a - b);

  // Binary search: how many wards does our composite beat?
  let lo = 0, hi = allComposites.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (allComposites[mid] < compositeScore) lo = mid + 1;
    else hi = mid;
  }
  const beatCount = lo;
  const total = allComposites.length + 1;
  const rank = total - beatCount;
  return Math.round(percentileFromRank(rank, total));
}

export function computeUpliftPlan(
  wardNumber: number,
  allProfiles: WardProfile[],
  totalBudgetCr: number,
  cityDist: CityDistributions,
): UpliftPlan | null {
  const ward = allProfiles.find((p) => p.ward_number === wardNumber);
  if (!ward) return null;

  const gapAnalysis = computeGapAnalysis(wardNumber, allProfiles, cityDist);

  // Initialize projected state with current values
  const projectedValues = new Map<string, number>();
  for (const mc of cityDist.metricComps) {
    const def = mc.def;
    const isApplicable = !def.applicable || def.applicable(ward);
    if (isApplicable) {
      projectedValues.set(def.key, def.extract(ward));
    }
  }
  const allocated = new Map<string, number>();

  // Compute "before" overall percentile
  const overallPercentileBefore = projectedOverallPercentile(
    ward, projectedValues, cityDist, allProfiles,
  );

  let budgetRemaining = totalBudgetCr;

  // Greedy loop: at each step, try adding one stepSize unit of each
  // feasible intervention, pick the one with highest composite improvement
  // per crore spent.
  const MAX_ITERATIONS = 5000; // safety valve
  for (let iter = 0; iter < MAX_ITERATIONS && budgetRemaining > 0; iter++) {
    let bestIntervention: Intervention | null = null;
    let bestEfficiency = 0; // composite score improvement per crore
    let bestStepCost = 0;
    let bestNewValue = 0;
    let bestMetricKey = "";

    for (const intervention of INTERVENTIONS) {
      // Check if this intervention applies to this ward
      const metricDef = METRICS.find((m) => m.key === intervention.metricKey);
      if (!metricDef) continue;
      const isApplicable = !metricDef.applicable || metricDef.applicable(ward);
      if (!isApplicable) continue;

      // Check unit cap
      const currentAlloc = allocated.get(intervention.id) ?? 0;
      const maxUnits = Math.min(intervention.maxUnits(ward), intervention.flatMaxUnits);
      if (currentAlloc >= maxUnits) continue;

      // Compute step cost
      const stepCost =
        ((intervention.costPerUnitCrLow + intervention.costPerUnitCrHigh) / 2) *
        intervention.stepSize;
      if (stepCost > budgetRemaining) continue;

      // Compute new metric value after adding one step
      const currentValue = projectedValues.get(intervention.metricKey);
      if (currentValue == null) continue;
      const newValue = applyIntervention(
        currentValue,
        intervention,
        intervention.stepSize,
        ward,
      );

      // Compute marginal composite improvement
      const sv = cityDist.sortedValues.get(intervention.metricKey);
      if (!sv || sv.length === 0) continue;

      const currentPct = percentileForValue(currentValue, sv, metricDef.higherIsBetter);
      const newPct = percentileForValue(newValue, sv, metricDef.higherIsBetter);
      const deltaPct = newPct - currentPct;
      if (deltaPct <= 0) continue;

      const deltaComposite = deltaPct * metricDef.weight;
      const efficiency = deltaComposite / stepCost;

      if (efficiency > bestEfficiency) {
        bestEfficiency = efficiency;
        bestIntervention = intervention;
        bestStepCost = stepCost;
        bestNewValue = newValue;
        bestMetricKey = intervention.metricKey;
      }
    }

    if (!bestIntervention) break; // no further improvement possible

    // Apply the best step
    projectedValues.set(bestMetricKey, bestNewValue);
    budgetRemaining -= bestStepCost;
    allocated.set(
      bestIntervention.id,
      (allocated.get(bestIntervention.id) ?? 0) + bestIntervention.stepSize,
    );
  }

  // Build allocation results
  const allocations: InterventionAllocation[] = [];
  for (const intervention of INTERVENTIONS) {
    const units = allocated.get(intervention.id) ?? 0;
    if (units <= 0) continue;

    const metricDef = METRICS.find((m) => m.key === intervention.metricKey);
    if (!metricDef) continue;

    const sv = cityDist.sortedValues.get(intervention.metricKey);
    const originalValue = metricDef.extract(ward);
    const projectedValue = projectedValues.get(intervention.metricKey) ?? originalValue;

    const pctBefore = sv
      ? percentileForValue(originalValue, sv, metricDef.higherIsBetter)
      : 50;
    const pctAfter = sv
      ? percentileForValue(projectedValue, sv, metricDef.higherIsBetter)
      : 50;

    allocations.push({
      interventionId: intervention.id,
      labelKey: intervention.labelKey,
      descriptionKey: intervention.descriptionKey,
      metricKey: intervention.metricKey,
      units,
      unitLabelKey: intervention.unitLabelKey,
      costCrLow: intervention.costPerUnitCrLow * units,
      costCrHigh: intervention.costPerUnitCrHigh * units,
      costCrMid: ((intervention.costPerUnitCrLow + intervention.costPerUnitCrHigh) / 2) * units,
      metricBefore: originalValue,
      metricAfter: projectedValue,
      percentileBefore: Math.round(pctBefore),
      percentileAfter: Math.round(pctAfter),
      gradeBefore: percentileToGrade(pctBefore),
      gradeAfter: percentileToGrade(pctAfter),
    });
  }

  // Sort allocations by cost descending (biggest investment first)
  allocations.sort((a, b) => b.costCrMid - a.costCrMid);

  const overallPercentileAfter = projectedOverallPercentile(
    ward, projectedValues, cityDist, allProfiles,
  );

  return {
    wardNumber,
    totalBudgetCr,
    budgetSpentCr: Math.round((totalBudgetCr - budgetRemaining) * 10) / 10,
    budgetRemainingCr: Math.round(budgetRemaining * 10) / 10,
    gapAnalysis,
    allocations,
    overallPercentileBefore,
    overallPercentileAfter,
    overallGradeBefore: percentileToGrade(overallPercentileBefore),
    overallGradeAfter: percentileToGrade(overallPercentileAfter),
  };
}

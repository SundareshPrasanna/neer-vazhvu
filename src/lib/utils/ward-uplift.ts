import type { WardProfile } from "@/lib/hooks/use-ward-profile";
import type { Grade } from "@/lib/utils/ward-rankings";
import {
  METRICS,
  computeMetric,
  computeWardRankings,
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
  /**
   * How much the raw value must change to reach the next grade up.
   * null if N/A, already A, or at grade boundary (value matches threshold
   * but ties hold the ward in the lower grade).
   */
  gapToNextGrade: number | null;
  /** Next grade up. null if already A. Non-null with gapToNextGrade=null means at boundary. */
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

export interface CityDistributions {
  metricComps: MetricComputation[];
  /** Sorted ascending arrays of metric values, one per metric key. */
  sortedValues: Map<string, number[]>;
  /** Raw value at each grade boundary, per metric key. */
  thresholds: Map<string, { p20: number; p40: number; p60: number; p80: number }>;
  /** Real composite score per ward (same formula as report card). */
  compositeByWard: Map<number, number>;
  /** Real overall percentile per ward (from report-card ranking). */
  overallPercentileByWard: Map<number, number>;
  overallGradeByWard: Map<number, Grade>;
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

  // Compute real composite scores and overall rankings (exact match with report card)
  const compositeByWard = new Map<number, number>();
  for (const p of allProfiles) {
    compositeByWard.set(p.ward_number, computeCompositeScore(p, metricComps));
  }

  // Rank composites: higher is better, no tiebreaker (matches computeWardRankings)
  const compositeEntries = allProfiles.map(p => ({
    id: p.ward_number,
    value: compositeByWard.get(p.ward_number)!,
  }));
  compositeEntries.sort((a, b) => b.value - a.value);

  const overallPercentileByWard = new Map<number, number>();
  const overallGradeByWard = new Map<number, Grade>();
  let currentRank = 1;
  for (let i = 0; i < compositeEntries.length; i++) {
    if (i > 0 && compositeEntries[i].value !== compositeEntries[i - 1].value) {
      currentRank = i + 1;
    }
    const pct = Math.round(percentileFromRank(currentRank, compositeEntries.length));
    overallPercentileByWard.set(compositeEntries[i].id, pct);
    overallGradeByWard.set(compositeEntries[i].id, percentileToGrade(pct));
  }

  return {
    metricComps, sortedValues, thresholds,
    compositeByWard, overallPercentileByWard, overallGradeByWard,
  };
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
        nextGrade = getNextGradeUp(currentGrade);
        const rawGap = Math.abs(thresholdForNext - currentValue);
        // If gap is effectively zero the ward sits at the grade boundary
        // but ties hold it in the lower grade. Leave nextGrade set so the
        // UI can distinguish "at boundary" from "already A".
        gapToNextGrade = rawGap < 1e-9 ? null : rawGap;
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
 * Build a modified WardProfile where extract() returns projected metric
 * values.  Used to rerun computeWardRankings() for exact after-state.
 */
export function buildProjectedProfile(
  ward: WardProfile,
  projectedValues: Map<string, number>,
): WardProfile {
  const p: WardProfile = JSON.parse(JSON.stringify(ward));
  const area = p.area_sq_km;

  for (const [key, value] of projectedValues) {
    const metricDef = METRICS.find((m) => m.key === key);
    if (!metricDef) continue;
    const original = metricDef.extract(ward);
    if (Math.abs(value - original) < 1e-12) continue;

    switch (key) {
      case "wb_health":
        p.water_bodies.avg_restoration_score = value;
        break;
      case "wb_density":
        p.water_bodies.current_count = Math.round(value * area);
        break;
      case "flood_risk": {
        // Cities without a MODELLED flood layer can't have an uplift applied
        // to it - covers both not_available (Madurai) and the
        // chronic-hotspot shape (Delhi).
        if (!("by_category" in p.flood)) break;
        const targetSevere = value * area;
        const cat = p.flood.by_category;
        const currentSevere = (cat["very_high"] ?? 0) + (cat["high"] ?? 0);
        if (currentSevere > 0) {
          const ratio = targetSevere / currentSevere;
          cat["very_high"] = (cat["very_high"] ?? 0) * ratio;
          cat["high"] = (cat["high"] ?? 0) * ratio;
        }
        break;
      }
      case "drainage":
        if ("_data_status" in p.drainage) break;
        p.drainage.total_length_km = value * area;
        break;
      case "sewerage_infra":
        if ("_data_status" in p.sewerage) break;
        p.sewerage.pumping_main_length_km = value * area;
        break;
    }
  }

  return p;
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

  // Use real report-card percentile for the before state (exact parity)
  const overallPercentileBefore = cityDist.overallPercentileByWard.get(wardNumber) ?? 50;

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

      // Check unit cap (tolerance for floating-point accumulation)
      const currentAlloc = allocated.get(intervention.id) ?? 0;
      const maxUnits = Math.min(intervention.maxUnits(ward), intervention.flatMaxUnits);
      if (currentAlloc + 1e-9 >= maxUnits) continue;

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
      let deltaPct = newPct - currentPct;

      // In flat distribution regions many wards share the same value, so
      // a single step may not jump enough wards to register a percentile
      // change.  When the raw value did improve but deltaPct rounds to 0,
      // use a tiny positive delta so the optimizer keeps investing.  The
      // final exact computeWardRankings() recompute determines the true
      // after-state regardless of this heuristic.
      const rawImproved = metricDef.higherIsBetter
        ? newValue > currentValue + 1e-12
        : newValue < currentValue - 1e-12;
      if (deltaPct <= 0 && rawImproved) {
        deltaPct = 0.01; // small nudge to keep allocating
      }
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

  // Build projected profile and rerun exact ranking engine
  const projectedProfile = buildProjectedProfile(ward, projectedValues);
  const modifiedProfiles = allProfiles.map((p) =>
    p.ward_number === wardNumber ? projectedProfile : p,
  );
  const afterRankings = computeWardRankings(wardNumber, modifiedProfiles);

  // Per-metric exact percentiles and grades from after ranking
  const afterMetricInfo = new Map<string, { pct: number; grade: Grade }>();
  if (afterRankings) {
    for (const m of afterRankings.metrics) {
      if (m.rank != null && m.grade != null) {
        afterMetricInfo.set(m.key, {
          pct: Math.round(percentileFromRank(m.rank, m.total)),
          grade: m.grade,
        });
      }
    }
  }

  // Build allocation results
  const allocations: InterventionAllocation[] = [];
  for (const intervention of INTERVENTIONS) {
    const units = allocated.get(intervention.id) ?? 0;
    if (units <= 0) continue;

    const metricDef = METRICS.find((m) => m.key === intervention.metricKey);
    if (!metricDef) continue;

    const mc = cityDist.metricComps.find(m => m.def.key === intervention.metricKey);
    const originalValue = metricDef.extract(ward);
    const projectedValue = projectedValues.get(intervention.metricKey) ?? originalValue;

    // Use real report-card percentile for before; exact recompute for after
    const pctBefore = mc?.percentileByWard.get(wardNumber) ?? 50;
    const after = afterMetricInfo.get(intervention.metricKey);

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
      percentileAfter: after?.pct ?? Math.round(pctBefore),
      gradeBefore: percentileToGrade(pctBefore),
      gradeAfter: after?.grade ?? percentileToGrade(pctBefore),
    });
  }

  // Sort allocations by cost descending (biggest investment first)
  allocations.sort((a, b) => b.costCrMid - a.costCrMid);

  const overallPercentileAfter = afterRankings?.overallPercentile ?? overallPercentileBefore;

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

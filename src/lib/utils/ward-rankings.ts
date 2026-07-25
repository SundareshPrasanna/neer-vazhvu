import type { WardProfile } from "@/lib/hooks/use-ward-profile";

/* ── Types ──────────────────────────────────────────────────────────── */

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface MetricRank {
  key: string;
  label: string;
  description: string;
  unit: string;
  value: number | null; // null = not applicable for this ward
  rank: number | null; // null = not ranked
  total: number;
  zoneMedian: number | null;
  cityMedian: number | null;
  grade: Grade | null; // null = not graded
  higherIsBetter: boolean;
}

export interface WardRankings {
  wardNumber: number;
  zoneName: string;
  zoneNo: string;
  metrics: MetricRank[];
  overallRank: number;
  overallTotal: number;
  overallScore: number;
  overallGrade: Grade;
  overallPercentile: number; // 0-100, higher = better
}

/* ── Metric definitions ─────────────────────────────────────────────── */

export interface MetricDef {
  key: string;
  label: string;
  description: string;
  unit: string;
  extract: (p: WardProfile) => number;
  higherIsBetter: boolean;
  weight: number;
  /** If set, metric is not graded/ranked when this returns false. */
  applicable?: (p: WardProfile) => boolean;
  /** Secondary sort when main values tie. Higher = better rank. */
  tiebreaker?: (p: WardProfile) => number;
}

interface RankedEntry {
  id: number;
  value: number;
  tb: number;
}

export interface MetricComputation {
  def: MetricDef;
  ranked: Map<number, { value: number; rank: number }>;
  rankTotal: number;
  cityMedian: number | null;
  zoneMedianByZone: Map<string, number>;
  percentileByWard: Map<number, number>;
}

export const METRICS: MetricDef[] = [
  {
    key: "wb_health",
    label: "report.metric_wb_health",
    description: "report.metric_wb_health_desc",
    unit: "score",
    extract: (p) => p.water_bodies.avg_restoration_score ?? 0,
    higherIsBetter: false,
    weight: 0.15,
    applicable: (p) => p.water_bodies.avg_restoration_score != null,
    tiebreaker: (p) => p.water_bodies.current_count,
  },
  {
    key: "wb_density",
    label: "report.metric_wb_density",
    description: "report.metric_wb_density_desc",
    unit: "bodies/sq km",
    extract: (p) => {
      if (!p.area_sq_km || p.area_sq_km <= 0) return 0;
      return p.water_bodies.current_count / p.area_sq_km;
    },
    higherIsBetter: true,
    weight: 0.10,
    applicable: (p) => p.area_sq_km > 0,
  },
  {
    key: "flood_risk",
    label: "report.metric_flood_severe",
    description: "report.metric_flood_severe_desc",
    unit: "zones/sq km",
    extract: (p) => {
      if (!p.area_sq_km || p.area_sq_km <= 0) return 0;
      // Only the modelled-hazard shape ranks here; not_available (Madurai)
      // and chronic-hotspot (Delhi) cities score 0 on this metric.
      if (!("by_category" in p.flood)) return 0;
      const cat = p.flood.by_category;
      const severe = (cat["very_high"] ?? 0) + (cat["high"] ?? 0);
      return severe / p.area_sq_km;
    },
    higherIsBetter: false,
    weight: 0.25,
    // Cities without a public flood-hazard layer (Madurai today) get
    // this metric skipped from the ranking composite.
    applicable: (p) => p.area_sq_km > 0 && !("_data_status" in p.flood),
  },
  {
    key: "drainage",
    label: "report.metric_drainage",
    description: "report.metric_drainage_desc",
    unit: "km/sq km",
    extract: (p) => {
      if (!p.area_sq_km || p.area_sq_km <= 0) return 0;
      if ("_data_status" in p.drainage) return 0;
      return p.drainage.total_length_km / p.area_sq_km;
    },
    higherIsBetter: true,
    weight: 0.25,
    applicable: (p) => p.area_sq_km > 0 && !("_data_status" in p.drainage),
  },
  {
    key: "sewerage_infra",
    label: "report.metric_sewerage",
    description: "report.metric_sewerage_desc",
    unit: "km/sq km",
    extract: (p) => {
      if (!p.area_sq_km || p.area_sq_km <= 0) return 0;
      if ("_data_status" in p.sewerage) return 0;
      return p.sewerage.pumping_main_length_km / p.area_sq_km;
    },
    higherIsBetter: true,
    weight: 0.25,
    applicable: (p) => p.area_sq_km > 0 && !("_data_status" in p.sewerage),
    tiebreaker: (p) =>
      p.area_sq_km > 0 && !("_data_status" in p.sewerage)
        ? p.sewerage.sps_count / p.area_sq_km
        : 0,
  },
];

/* ── Helpers (exported for reuse by uplift planner) ────────────────── */

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentileToGrade(pct: number): Grade {
  if (pct >= 80) return "A";
  if (pct >= 60) return "B";
  if (pct >= 40) return "C";
  if (pct >= 20) return "D";
  return "F";
}

export function percentileFromRank(rank: number, total: number): number {
  return total > 1 ? ((total - rank) / (total - 1)) * 100 : 50;
}

function buildNullMetricRank(def: MetricDef, total: number): MetricRank {
  return {
    key: def.key,
    label: def.label,
    description: def.description,
    unit: def.unit,
    value: null,
    rank: null,
    total,
    zoneMedian: null,
    cityMedian: null,
    grade: null,
    higherIsBetter: def.higherIsBetter,
  };
}

function rankEntries(
  entries: RankedEntry[],
  higherIsBetter: boolean,
  useTiebreaker = true,
): Map<number, { value: number; rank: number }> {
  entries.sort((a, b) => {
    const cmp = higherIsBetter ? b.value - a.value : a.value - b.value;
    if (cmp !== 0) return cmp;
    return useTiebreaker ? b.tb - a.tb : 0;
  });

  const result = new Map<number, { value: number; rank: number }>();
  let currentRank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (
      i > 0 &&
      (entries[i].value !== entries[i - 1].value ||
        (useTiebreaker && entries[i].tb !== entries[i - 1].tb))
    ) {
      currentRank = i + 1;
    }
    result.set(entries[i].id, {
      value: entries[i].value,
      rank: currentRank,
    });
  }
  return result;
}

function rankValues(
  profiles: WardProfile[],
  extract: (p: WardProfile) => number,
  higherIsBetter: boolean,
  tiebreaker?: (p: WardProfile) => number,
): Map<number, { value: number; rank: number }> {
  return rankEntries(
    profiles.map((p) => ({
      id: p.ward_number,
      value: extract(p),
      tb: tiebreaker ? tiebreaker(p) : 0,
    })),
    higherIsBetter,
    Boolean(tiebreaker),
  );
}

export function computeMetric(def: MetricDef, allProfiles: WardProfile[]): MetricComputation {
  const applicableProfiles = def.applicable
    ? allProfiles.filter(def.applicable)
    : allProfiles;
  const ranked = rankValues(
    applicableProfiles,
    def.extract,
    def.higherIsBetter,
    def.tiebreaker,
  );
  const rankTotal = applicableProfiles.length;
  const percentileByWard = new Map<number, number>();
  const zoneValues = new Map<string, number[]>();

  for (const profile of applicableProfiles) {
    const row = ranked.get(profile.ward_number);
    if (row) {
      percentileByWard.set(
        profile.ward_number,
        percentileFromRank(row.rank, rankTotal),
      );
    }

    const values = zoneValues.get(profile.zone_no);
    const value = def.extract(profile);
    if (values) values.push(value);
    else zoneValues.set(profile.zone_no, [value]);
  }

  return {
    def,
    ranked,
    rankTotal,
    cityMedian: applicableProfiles.length > 0
      ? median(applicableProfiles.map((p) => def.extract(p)))
      : null,
    zoneMedianByZone: new Map(
      Array.from(zoneValues.entries(), ([zone, values]) => [zone, median(values)]),
    ),
    percentileByWard,
  };
}

/**
 * Return the sorted array of raw metric values from a MetricComputation.
 * Sorted ascending (regardless of higherIsBetter).  Used by the uplift
 * planner to binary-search projected values against the city distribution.
 */
export function getSortedValues(mc: MetricComputation): number[] {
  const values: number[] = [];
  for (const { value } of mc.ranked.values()) values.push(value);
  return values.sort((a, b) => a - b);
}

/**
 * Given a raw metric value and the city-wide sorted distribution,
 * return the percentile (0-100) that value would occupy.
 * Uses the same rank-based formula as the report card:
 *   percentile = (total - rank) / (total - 1) * 100
 * where rank is the 1-based position after sorting by quality
 * (best = rank 1).
 */
export function percentileForValue(
  value: number,
  sortedAsc: number[],
  higherIsBetter: boolean,
): number {
  const n = sortedAsc.length;
  if (n <= 1) return 50;

  // Count how many existing values this new value would beat.
  // "beat" means: for higherIsBetter, count entries strictly below value.
  //               for lowerIsBetter, count entries strictly above value.
  let beatCount: number;
  if (higherIsBetter) {
    // Binary search: find index of first element >= value
    let lo = 0, hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedAsc[mid] < value) lo = mid + 1;
      else hi = mid;
    }
    beatCount = lo; // number of elements strictly < value
  } else {
    // Lower is better: count entries strictly > value
    let lo = 0, hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedAsc[mid] <= value) lo = mid + 1;
      else hi = mid;
    }
    beatCount = n - lo; // number of elements strictly > value
  }

  // Approximate rank among n+1 entries (the n existing + this hypothetical)
  const total = n + 1;
  const rank = total - beatCount;
  return percentileFromRank(rank, total);
}

export function computeCompositeScore(
  profile: WardProfile,
  metricComputations: MetricComputation[],
): number {
  let score = 0;

  for (const metric of metricComputations) {
    const isApplicable = !metric.def.applicable || metric.def.applicable(profile);
    const percentile = isApplicable
      ? metric.percentileByWard.get(profile.ward_number) ?? 50
      : 50;
    score += percentile * metric.def.weight;
  }

  return score;
}

/* ── Main computation ───────────────────────────────────────────────── */

export function computeWardRankings(
  wardNumber: number,
  allProfiles: WardProfile[],
): WardRankings | null {
  const ward = allProfiles.find((p) => p.ward_number === wardNumber);
  if (!ward) return null;

  const metricComputations = METRICS.map((def) => computeMetric(def, allProfiles));
  const metrics: MetricRank[] = [];

  for (const metric of metricComputations) {
    const { def } = metric;
    const isApplicable = !def.applicable || def.applicable(ward);

    if (!isApplicable) {
      metrics.push(buildNullMetricRank(def, metric.rankTotal));
      continue;
    }

    const wardRank = metric.ranked.get(wardNumber);
    if (!wardRank) {
      metrics.push(buildNullMetricRank(def, metric.rankTotal));
      continue;
    }

    const percentile = metric.percentileByWard.get(wardNumber) ?? 50;

    metrics.push({
      key: def.key,
      label: def.label,
      description: def.description,
      unit: def.unit,
      value: wardRank.value,
      rank: wardRank.rank,
      total: metric.rankTotal,
      zoneMedian: metric.zoneMedianByZone.has(ward.zone_no)
        ? metric.zoneMedianByZone.get(ward.zone_no)!
        : null,
      cityMedian: metric.cityMedian,
      grade: percentileToGrade(percentile),
      higherIsBetter: def.higherIsBetter,
    });
  }

  const compositeScores = allProfiles.map((profile) => ({
    id: profile.ward_number,
    value: computeCompositeScore(profile, metricComputations),
    tb: 0,
  }));
  const overallRanked = rankEntries(compositeScores, true, false);
  const overall = overallRanked.get(wardNumber);
  if (!overall) return null;

  const overallPercentile = percentileFromRank(overall.rank, allProfiles.length);
  const roundedPercentile = Math.round(overallPercentile);

  return {
    wardNumber,
    zoneName: ward.zone_name,
    zoneNo: ward.zone_no,
    metrics,
    overallRank: overall.rank,
    overallTotal: allProfiles.length,
    overallScore: Math.round(overall.value * 10) / 10,
    overallGrade: percentileToGrade(roundedPercentile),
    overallPercentile: roundedPercentile,
  };
}

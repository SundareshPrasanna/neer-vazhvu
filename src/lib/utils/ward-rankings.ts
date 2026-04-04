import type { WardProfile } from "@/lib/hooks/use-ward-profile";

/* ── Types ──────────────────────────────────────────────────────────── */

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface MetricRank {
  key: string;
  label: string;
  description: string;
  unit: string;
  value: number | null;       // null = not applicable for this ward
  rank: number | null;         // null = not ranked
  total: number;
  zoneAvg: number | null;
  cityAvg: number | null;
  grade: Grade | null;         // null = not graded
  higherIsBetter: boolean;
}

export interface WardRankings {
  wardNumber: number;
  zoneName: string;
  zoneNo: string;
  metrics: MetricRank[];
  overallGrade: Grade;
  overallPercentile: number; // 0-100, higher = better
}

/* ── Metric definitions ─────────────────────────────────────────────── */

interface MetricDef {
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

const METRICS: MetricDef[] = [
  {
    key: "wb_health",
    label: "report.metric_wb_health",
    description: "report.metric_wb_health_desc",
    unit: "",
    // Average restoration priority score (lower = healthier, better managed)
    extract: (p) => p.water_bodies.avg_restoration_score ?? 0,
    higherIsBetter: false,
    weight: 0.15,
    applicable: (p) => p.water_bodies.avg_restoration_score != null,
    // Tie-break: managing more bodies at same avg score is harder
    tiebreaker: (p) => p.water_bodies.current_count,
  },
  {
    key: "wb_density",
    label: "report.metric_wb_density",
    description: "report.metric_wb_density_desc",
    unit: "/sq km",
    // Water bodies per sq km - rewards having and preserving natural water infra
    extract: (p) => {
      if (!p.area_sq_km || p.area_sq_km <= 0) return 0;
      return Math.round((p.water_bodies.current_count / p.area_sq_km) * 10) / 10;
    },
    higherIsBetter: true,
    weight: 0.10,
  },
  {
    key: "flood_risk",
    label: "report.metric_flood_severe",
    description: "report.metric_flood_severe_desc",
    unit: "/sq km",
    // Severe flood hazard zones per sq km - captures actual risk exposure
    extract: (p) => {
      if (!p.area_sq_km || p.area_sq_km <= 0) return 0;
      const cat = p.flood.by_category;
      const severe = (cat["very high"] ?? 0) + (cat["high"] ?? 0);
      return Math.round((severe / p.area_sq_km) * 10) / 10;
    },
    higherIsBetter: false,
    weight: 0.25,
    applicable: (p) => p.flood.hazard_zone_count > 0,
  },
  {
    key: "drainage",
    label: "report.metric_drainage",
    description: "report.metric_drainage_desc",
    unit: "/sq km",
    // Drainage line density - normalized by ward area
    extract: (p) => {
      if (!p.area_sq_km || p.area_sq_km <= 0) return 0;
      return Math.round((p.drainage.line_count / p.area_sq_km) * 10) / 10;
    },
    higherIsBetter: true,
    weight: 0.25,
  },
  {
    key: "sewerage_infra",
    label: "report.metric_sewerage",
    description: "report.metric_sewerage_desc",
    unit: "/sq km",
    // Ward-level sewerage infrastructure density (pumping stations + mains per sq km)
    extract: (p) => {
      if (!p.area_sq_km || p.area_sq_km <= 0) return 0;
      const count = p.sewerage.sps_count + p.sewerage.pumping_main_count;
      return Math.round((count / p.area_sq_km) * 10) / 10;
    },
    higherIsBetter: true,
    weight: 0.25,
  },
];

/* ── Helpers ────────────────────────────────────────────────────────── */

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentileToGrade(pct: number): Grade {
  if (pct >= 80) return "A";
  if (pct >= 60) return "B";
  if (pct >= 40) return "C";
  if (pct >= 20) return "D";
  return "F";
}

/** Rank values among given profiles. Tied values use optional tiebreaker. */
function rankValues(
  profiles: WardProfile[],
  extract: (p: WardProfile) => number,
  higherIsBetter: boolean,
  tiebreaker?: (p: WardProfile) => number,
): Map<number, { value: number; rank: number }> {
  const entries = profiles.map((p) => ({
    ward: p.ward_number,
    value: extract(p),
    tb: tiebreaker ? tiebreaker(p) : 0,
  }));

  // Sort: best first. Tiebreaker: higher is always better.
  entries.sort((a, b) => {
    const cmp = higherIsBetter ? b.value - a.value : a.value - b.value;
    if (cmp !== 0) return cmp;
    return b.tb - a.tb;
  });

  // Assign ranks. With tiebreaker, ties only occur at identical value + tb.
  const result = new Map<number, { value: number; rank: number }>();
  let currentRank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (
      i > 0 &&
      (entries[i].value !== entries[i - 1].value ||
        entries[i].tb !== entries[i - 1].tb)
    ) {
      currentRank = i + 1;
    }
    result.set(entries[i].ward, {
      value: entries[i].value,
      rank: currentRank,
    });
  }
  return result;
}

/* ── Main computation ───────────────────────────────────────────────── */

export function computeWardRankings(
  wardNumber: number,
  allProfiles: WardProfile[],
): WardRankings | null {
  const ward = allProfiles.find((p) => p.ward_number === wardNumber);
  if (!ward) return null;

  const zoneProfiles = allProfiles.filter((p) => p.zone_no === ward.zone_no);

  const metrics: MetricRank[] = [];
  let weightedPercentileSum = 0;
  let totalWeight = 0;

  for (const def of METRICS) {
    const isApplicable = !def.applicable || def.applicable(ward);

    if (!isApplicable) {
      // Show the row but don't grade it
      metrics.push({
        key: def.key,
        label: def.label,
        description: def.description,
        unit: def.unit,
        value: null,
        rank: null,
        total: allProfiles.length,
        zoneAvg: null,
        cityAvg: null,
        grade: null,
        higherIsBetter: def.higherIsBetter,
      });
      continue;
    }

    // Rank among applicable wards only
    const applicableProfiles = def.applicable
      ? allProfiles.filter(def.applicable)
      : allProfiles;
    const applicableZone = def.applicable
      ? zoneProfiles.filter(def.applicable)
      : zoneProfiles;

    const ranked = rankValues(
      applicableProfiles,
      def.extract,
      def.higherIsBetter,
      def.tiebreaker,
    );
    const wardRank = ranked.get(wardNumber);
    if (!wardRank) continue;

    const rankTotal = applicableProfiles.length;

    // Zone median among applicable wards (robust to outliers from tiny wards)
    const zoneValues = applicableZone.map((p) => def.extract(p));
    const zoneAvg = median(zoneValues);

    // City median among applicable wards
    const cityValues = applicableProfiles.map((p) => def.extract(p));
    const cityAvg = median(cityValues);

    const percentile =
      rankTotal > 1
        ? ((rankTotal - wardRank.rank) / (rankTotal - 1)) * 100
        : 50;

    metrics.push({
      key: def.key,
      label: def.label,
      description: def.description,
      unit: def.unit,
      value: wardRank.value,
      rank: wardRank.rank,
      total: rankTotal,
      zoneAvg: Math.round(zoneAvg * 10) / 10,
      cityAvg: Math.round(cityAvg * 10) / 10,
      grade: percentileToGrade(percentile),
      higherIsBetter: def.higherIsBetter,
    });

    weightedPercentileSum += percentile * def.weight;
    totalWeight += def.weight;
  }

  const overallPercentile =
    totalWeight > 0 ? weightedPercentileSum / totalWeight : 50;

  return {
    wardNumber,
    zoneName: ward.zone_name,
    zoneNo: ward.zone_no,
    metrics,
    overallGrade: percentileToGrade(overallPercentile),
    overallPercentile: Math.round(overallPercentile),
  };
}

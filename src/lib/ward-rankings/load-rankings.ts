import { readFileSync } from "fs";
import { resolve } from "path";

import {
  computeWardRankings,
  type Grade,
  type WardRankings,
} from "@/lib/utils/ward-rankings";
import { loadProfilesServer } from "@/lib/utils/load-profiles-server";

/**
 * Normalised "one row per ward" shape that powers the rankings table.
 * Both data sources (Chennai's computed ward-profiles and Madurai's
 * pre-baked ward-risk JSON) project into this shape so the table
 * component stays city-agnostic.
 *
 * `metricColumns` is a free-form per-city list of secondary metric
 * values to render as additional columns. Different cities surface
 * different metrics (Chennai has flood/drainage/sewerage; Madurai has
 * groundwater depth + water-body density), so the table renders
 * whichever columns the city's loader emits.
 */
export interface WardRankingRow {
  wardNumber: number;
  wardName: string;
  zone: string;
  grade: Grade;
  /** Composite score; lower or higher = better depends on the city's
   *  scoring model. The `compositeScoreLowerIsBetter` flag on the
   *  bundle below tells the table which arrow direction to use for
   *  default sort. */
  compositeScore: number;
  /** Rank within the city, 1 = best. */
  rank: number;
  /** Total number of wards in the city. Used by the table for
   *  "rank N of M" labels. */
  totalWards: number;
  /** Percentile, 0-100; higher = better. */
  percentile: number;
  metricColumns: WardRankingMetricColumn[];
  /** Up to 3 representative locality names that fall inside this ward,
   *  used as a human-recognisable label below "Ward N" in the table.
   *  Empty when no locality data is available for the city or the
   *  specific ward. */
  localities: string[];
}

export interface WardRankingMetricColumn {
  /** Stable id for sort/filter wiring. */
  key: string;
  /** Short column header label (English; i18n later). */
  label: string;
  /** Display value as a string (formatted; "-" if not applicable). */
  display: string;
  /** Underlying numeric value for sort comparisons; null if N/A. */
  numeric: number | null;
}

export interface WardRankingsBundle {
  cityId: string;
  rows: WardRankingRow[];
  /** Counts per grade across the city, for the headline summary. */
  gradeCounts: Record<Grade, number>;
  /** Distinct zone names present, for the zone filter chips. */
  zones: string[];
  /** Source label used by the methodology blurb under the table. */
  sourceLabel: string;
  /** Sort default: lower compositeScore is better (Madurai uses risk-
   *  composite where high = bad; Chennai uses percentile-derived
   *  composite where low = bad). */
  compositeScoreLowerIsBetter: boolean;
}

/** Public entry point: returns the ranking bundle for a city, or null
 *  if no ranking data is available for that city. */
export function loadWardRankings(cityId: string): WardRankingsBundle | null {
  if (cityId === "madurai") return loadMaduraiRankings();
  if (cityId === "chennai") return loadChennaiRankings();
  if (cityId === "bangalore") return loadBangaloreRankings();
  if (cityId === "mumbai") return loadMumbaiRankings();
  return null;
}

// ── Locality lookup: ward_number -> representative locality names ─────

interface LocalityEntry {
  name: string;
  ward_number?: number;
}

const localityCacheByCity = new Map<string, Map<number, string[]>>();

/**
 * Read the per-city localities JSON (chennai-localities.json /
 * madurai-localities.json) and build a ward-number → top-3 locality
 * names lookup. Localities are de-duplicated by name and trimmed to
 * the first three encountered for each ward (no special ranking;
 * insertion order is "as they appear in the file"). Caches per
 * city for the lifetime of the Node process.
 *
 * Returns an empty Map when the city has no locality file.
 */
function loadLocalitiesByWard(cityId: string): Map<number, string[]> {
  const hit = localityCacheByCity.get(cityId);
  if (hit) return hit;

  const path = resolve(
    process.cwd(),
    "public/data",
    `${cityId}-localities.json`,
  );
  const result = new Map<number, string[]>();
  try {
    const entries = JSON.parse(readFileSync(path, "utf-8")) as LocalityEntry[];
    const seenByWard = new Map<number, Set<string>>();
    for (const entry of entries) {
      const w = entry.ward_number;
      const name = (entry.name ?? "").trim();
      if (!w || !name) continue;
      let names = result.get(w);
      let seen = seenByWard.get(w);
      if (!names) {
        names = [];
        result.set(w, names);
      }
      if (!seen) {
        seen = new Set();
        seenByWard.set(w, seen);
      }
      const key = name.toLowerCase();
      if (seen.has(key) || names.length >= 3) continue;
      seen.add(key);
      names.push(name);
    }
  } catch {
    // No locality file for this city; leave the lookup empty so the
    // table renders just "Ward N" without a locality preview.
  }
  localityCacheByCity.set(cityId, result);
  return result;
}

// ── Chennai: compute on the fly from ward-profiles.json ───────────────

function loadChennaiRankings(): WardRankingsBundle {
  const profiles = loadProfilesServer("chennai");
  const localities = loadLocalitiesByWard("chennai");

  // computeWardRankings recomputes every metric across the full city
  // for each call. For 200 wards it's noticeable but acceptable on
  // a daily ISR rebuild; if this becomes a hotspot, factor out a
  // batched version that calls computeMetric() once per metric.
  const rows: WardRankingRow[] = [];
  for (const profile of profiles) {
    const ranking = computeWardRankings(profile.ward_number, profiles);
    if (!ranking) continue;
    rows.push(chennaiRankingToRow(ranking, localities));
  }
  rows.sort((a, b) => a.rank - b.rank);
  // computeWardRankings may return null for wards with insufficient
  // metric data, leaving gaps in `overallRank`. Renumber after the
  // filter so the table's rank column is always 1..N contiguous and
  // matches the row's position in the sorted list.
  const total = rows.length;
  for (let i = 0; i < rows.length; i++) {
    rows[i] = { ...rows[i], rank: i + 1, totalWards: total };
  }

  return {
    cityId: "chennai",
    rows,
    gradeCounts: countsByGrade(rows),
    zones: distinctZones(rows),
    sourceLabel:
      "Computed live from public/data/ward-profiles.json - 5-factor composite (water bodies, flood, drainage, sewerage)",
    compositeScoreLowerIsBetter: true,
  };
}

function chennaiRankingToRow(
  r: WardRankings,
  localities: Map<number, string[]>,
): WardRankingRow {
  const metricColumns: WardRankingMetricColumn[] = [];
  for (const m of r.metrics) {
    metricColumns.push({
      key: m.key,
      label: shortLabelForMetric(m.key),
      display: m.value === null ? "-" : formatMetricValue(m.value, m.unit),
      numeric: m.value,
    });
  }
  return {
    wardNumber: r.wardNumber,
    wardName: `Ward ${r.wardNumber}`,
    zone: r.zoneName,
    grade: r.overallGrade,
    localities: localities.get(r.wardNumber) ?? [],
    compositeScore: r.overallScore,
    rank: r.overallRank,
    totalWards: r.overallTotal,
    percentile: r.overallPercentile,
    metricColumns,
  };
}

function shortLabelForMetric(key: string): string {
  switch (key) {
    case "wb_health":
      return "Water-body health";
    case "wb_density":
      return "Water-body density";
    case "flood_risk":
      return "Flood risk";
    case "drainage":
      return "Drainage";
    case "sewerage_infra":
      return "Sewerage";
    default:
      return key;
  }
}

function formatMetricValue(v: number, unit: string): string {
  // Compact formatting: small values show 1-2 decimals, big values
  // show no decimals. Unit kept short so columns stay narrow.
  const abs = Math.abs(v);
  if (abs === 0) return `0 ${unit}`;
  if (abs < 1) return `${v.toFixed(2)} ${unit}`;
  if (abs < 10) return `${v.toFixed(1)} ${unit}`;
  return `${Math.round(v).toLocaleString()} ${unit}`;
}

// ── Madurai: read pre-baked ward-risk-madurai.json ────────────────────

interface MaduraiWardRisk {
  ward_number: number;
  ward_name: string;
  zone: string;
  composite_score: number; // higher = worse risk in Madurai's model
  grade: Grade;
  gw_depth_m: number | null;
  wb_density_per_sqkm: number | null;
  wb_health_score: number | null;
}

interface MaduraiWardRiskFile {
  algorithm_version: string;
  weights: Record<string, number>;
  wards: MaduraiWardRisk[];
}

let maduraiCache: MaduraiWardRiskFile | null = null;

function loadMaduraiRankings(): WardRankingsBundle {
  if (!maduraiCache) {
    const path = resolve(
      process.cwd(),
      "public/data/ward-risk-madurai.json",
    );
    maduraiCache = JSON.parse(
      readFileSync(path, "utf-8"),
    ) as MaduraiWardRiskFile;
  }
  const localities = loadLocalitiesByWard("madurai");

  // Madurai composite_score is risk: higher = worse. Sort ascending so
  // best (lowest-risk) wards land at the top.
  const sorted = [...maduraiCache.wards].sort(
    (a, b) => a.composite_score - b.composite_score,
  );
  const total = sorted.length;

  const rows: WardRankingRow[] = sorted.map((w, idx) => {
    const rank = idx + 1;
    const percentile = total > 1 ? ((total - rank) / (total - 1)) * 100 : 50;
    return {
      wardNumber: w.ward_number,
      wardName: w.ward_name || `Ward ${w.ward_number}`,
      localities: localities.get(w.ward_number) ?? [],
      zone: w.zone,
      grade: w.grade,
      compositeScore: w.composite_score,
      rank,
      totalWards: total,
      percentile,
      metricColumns: [
        {
          key: "gw_depth_m",
          label: "Groundwater depth",
          display:
            w.gw_depth_m === null ? "-" : `${w.gw_depth_m.toFixed(1)} m`,
          numeric: w.gw_depth_m,
        },
        {
          key: "wb_density_per_sqkm",
          label: "Water-body density",
          display:
            w.wb_density_per_sqkm === null
              ? "-"
              : `${w.wb_density_per_sqkm.toFixed(2)} /km²`,
          numeric: w.wb_density_per_sqkm,
        },
        {
          key: "wb_health_score",
          label: "Water-body health",
          display:
            w.wb_health_score === null
              ? "-"
              : w.wb_health_score.toFixed(0),
          numeric: w.wb_health_score,
        },
      ],
    };
  });

  return {
    cityId: "madurai",
    rows,
    gradeCounts: countsByGrade(rows),
    zones: distinctZones(rows),
    sourceLabel: `Pre-baked ${maduraiCache.algorithm_version} composite from public/data/ward-risk-madurai.json (groundwater depth, water-body density, water-body health)`,
    // Madurai stores risk where lower = better; the table sorts the
    // composite column ascending by default which matches "best first".
    compositeScoreLowerIsBetter: true,
  };
}

// ── Mumbai: read pre-baked ward-risk-mumbai.json (risk_v2_mum) ────────
//
// Equity-first model (scripts/compute-mumbai-ward-risk.py). Mumbai is
// excluded from the CGWB groundwater assessment, so the groundwater-led
// composite is replaced by:
//   - supply_deficit (0.50): real per-ward average daily water-supply
//     HOURS (Praja 2024 Table 4; fewer hours = worse). Replaces the
//     earlier slum-area-share proxy.
//   - flood_hotspot_count (0.30): chronic monsoon flooding spots in ward
//   - river_vertex_count (0.20): Priority-I river polyline length in ward
//   - slum_area_share: retained as context (unweighted)
//   - composite_score: 0-100 city percentile (higher = worse), grade by quintile

interface MumbaiWardRisk {
  ward_number: number;
  ward_name: string;
  zone: string;
  composite_score: number; // higher = worse risk
  grade: Grade;
  supply_hours: number;
  slum_area_share: number;
  flood_hotspot_count: number;
  river_vertex_count: number;
}

interface MumbaiWardRiskFile {
  algorithm_version: string;
  weights: Record<string, number>;
  wards: MumbaiWardRisk[];
}

let mumbaiCache: MumbaiWardRiskFile | null = null;

function loadMumbaiRankings(): WardRankingsBundle {
  if (!mumbaiCache) {
    const path = resolve(process.cwd(), "public/data/ward-risk-mumbai.json");
    mumbaiCache = JSON.parse(readFileSync(path, "utf-8")) as MumbaiWardRiskFile;
  }
  const localities = loadLocalitiesByWard("mumbai");

  // composite_score is risk (higher = worse); sort ascending so the
  // lowest-risk wards land at the top.
  const sorted = [...mumbaiCache.wards].sort(
    (a, b) => a.composite_score - b.composite_score,
  );
  const total = sorted.length;

  const rows: WardRankingRow[] = sorted.map((w, idx) => {
    const rank = idx + 1;
    const percentile = total > 1 ? ((total - rank) / (total - 1)) * 100 : 50;
    return {
      wardNumber: w.ward_number,
      wardName: w.ward_name || `Ward ${w.ward_number}`,
      localities: localities.get(w.ward_number) ?? [],
      zone: w.zone,
      grade: w.grade,
      compositeScore: w.composite_score,
      rank,
      totalWards: total,
      percentile,
      metricColumns: [
        {
          key: "supply_hours",
          label: "Water supply (hrs/day)",
          display: `${w.supply_hours.toFixed(1)} h`,
          numeric: w.supply_hours,
        },
        {
          key: "flood_hotspot_count",
          label: "Chronic flood spots",
          display: String(w.flood_hotspot_count),
          numeric: w.flood_hotspot_count,
        },
        {
          key: "slum_area_share",
          label: "Slum-area share",
          display: `${Math.round(w.slum_area_share * 100)}%`,
          numeric: w.slum_area_share,
        },
      ],
    };
  });

  return {
    cityId: "mumbai",
    rows,
    gradeCounts: countsByGrade(rows),
    zones: distinctZones(rows),
    sourceLabel: `Pre-baked ${mumbaiCache.algorithm_version} equity composite from public/data/ward-risk-mumbai.json (per-ward water-supply hours from Praja 2024, chronic flood spots, Priority-I river burden)`,
    compositeScoreLowerIsBetter: true,
  };
}

// ── Bangalore: read pre-baked ward-risk-bangalore.json ────────────────
//
// V0 methodology (will refine as IISc 65 stress wards + per-ward
// groundwater interpolation land):
//   - wb_density_per_sqkm: count of OSM water-body centroids inside
//     each ward polygon / ward area (computed offline by
//     scripts/compute-bangalore-ward-risk.py)
//   - wb_health_score: 100 if ward contains a named flagship kere
//     (Bellandur, Halsoor, Hesaraghatta, Sankey, etc.); else 50
//   - gw_depth_m: NULL (no per-ward groundwater yet for Bengaluru)
//   - composite_score weighted: pop_density (+0.5) - wb_density (-0.3)
//     - wb_health (-0.2); higher composite = worse stress
//   - grade by quintile of composite_score

interface BangaloreWardRisk {
  ward_number: number;
  ward_name: string;
  zone: string;
  composite_score: number;
  grade: Grade;
  gw_depth_m: number | null;
  wb_density_per_sqkm: number | null;
  wb_health_score: number | null;
}

interface BangaloreWardRiskFile {
  algorithm_version: string;
  weights: Record<string, number>;
  wards: BangaloreWardRisk[];
}

let bangaloreCache: BangaloreWardRiskFile | null = null;

function loadBangaloreRankings(): WardRankingsBundle {
  if (!bangaloreCache) {
    const path = resolve(
      process.cwd(),
      "public/data/ward-risk-bangalore.json",
    );
    bangaloreCache = JSON.parse(
      readFileSync(path, "utf-8"),
    ) as BangaloreWardRiskFile;
  }
  const localities = loadLocalitiesByWard("bangalore");

  // composite_score: higher = worse stress (same convention as Madurai)
  // Sort ascending so best-ranked wards land at the top of the table.
  const sorted = [...bangaloreCache.wards].sort(
    (a, b) => a.composite_score - b.composite_score,
  );
  const total = sorted.length;

  const rows: WardRankingRow[] = sorted.map((w, idx) => {
    const rank = idx + 1;
    const percentile = total > 1 ? ((total - rank) / (total - 1)) * 100 : 50;
    return {
      wardNumber: w.ward_number,
      wardName: w.ward_name || `Ward ${w.ward_number}`,
      localities: localities.get(w.ward_number) ?? [],
      zone: w.zone,
      grade: w.grade,
      compositeScore: w.composite_score,
      rank,
      totalWards: total,
      percentile,
      metricColumns: [
        {
          key: "wb_density_per_sqkm",
          label: "Water-body density",
          display:
            w.wb_density_per_sqkm === null
              ? "-"
              : `${w.wb_density_per_sqkm.toFixed(2)} /km²`,
          numeric: w.wb_density_per_sqkm,
        },
        {
          key: "wb_health_score",
          label: "Flagship-kere flag",
          display:
            w.wb_health_score === null
              ? "-"
              : w.wb_health_score >= 100
                ? "Flagship"
                : "—",
          numeric: w.wb_health_score,
        },
        {
          key: "gw_depth_m",
          label: "Groundwater depth",
          display: w.gw_depth_m === null ? "-" : `${w.gw_depth_m.toFixed(1)} m`,
          numeric: w.gw_depth_m,
        },
      ],
    };
  });

  return {
    cityId: "bangalore",
    rows,
    gradeCounts: countsByGrade(rows),
    zones: distinctZones(rows),
    sourceLabel: `Pre-baked ${bangaloreCache.algorithm_version} composite from public/data/ward-risk-bangalore.json (population density, OSM water-body density per ward, flagship-kere flag). Per-ward groundwater depth + IISc 65 stress-ward overlay are roadmap follow-ups.`,
    compositeScoreLowerIsBetter: true,
  };
}

// ── shared helpers ────────────────────────────────────────────────────

function countsByGrade(rows: WardRankingRow[]): Record<Grade, number> {
  const counts: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const r of rows) counts[r.grade]++;
  return counts;
}

function distinctZones(rows: WardRankingRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.zone) set.add(r.zone);
  return [...set].sort();
}

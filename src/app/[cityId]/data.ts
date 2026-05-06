import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { PlaceConfig } from "@/lib/cities";

export interface ReservoirReadingV2 {
  city_id: string;
  source_code: string;
  date: string;
  storage_tmc: number | null;
  storage_pct_frl: number | null;
  level_ft: number | null;
  inflow_cusecs: number | null;
  outflow_cusecs: number | null;
  source: string;
}

export interface CitySnapshot {
  asOf: string | null;
  readingsBySource: Record<string, ReservoirReadingV2 | null>;
  reservoirIsLive: boolean;
}

export interface HistorySeriesPoint {
  date: string;
  storage_tmc: number | null;
  storage_pct_frl: number | null;
}

export interface HistorySeries {
  source_code: string;
  display_name: string;
  full_capacity_mcft: number | null;
  full_tank_level_ft: number | null;
  is_primary: boolean;
  points: HistorySeriesPoint[];
}

export interface CityHistory {
  earliestDate: string | null;
  latestDate: string | null;
  pointCount: number;
  series: HistorySeries[];
}

export interface ForecastSeriesPoint {
  date: string;
  predicted_tmc: number;
  lower_tmc: number;
  upper_tmc: number;
}

export interface ForecastSeries {
  source_code: string;
  forecast_date: string;
  model_name: string;
  points: ForecastSeriesPoint[];
}

export interface CityForecast {
  /** When the forecast was generated (forecast_date column on the latest row). */
  forecastDate: string | null;
  series: ForecastSeries[];
}

export interface CityWaterEstimate {
  totalStorageMcft: number;
  totalCapacityMcft: number;
  recentAvgInflowMcftPerDay: number;
  seasonalAvgInflowMcftPerDay: number;
  comparison2019Storage: number | null;
  lastUpdated: string | null;
}

const EMPTY_ESTIMATE: CityWaterEstimate = {
  totalStorageMcft: 0,
  totalCapacityMcft: 0,
  recentAvgInflowMcftPerDay: 0,
  seasonalAvgInflowMcftPerDay: 0,
  comparison2019Storage: null,
  lastUpdated: null,
};

const TMC_TO_MCFT = 1000;
const CUSEC_DAY_TO_MCFT = 0.0864;

/**
 * Roll the city's primary-drinking sources up into a single
 * water-estimate row, using the same shape Chennai's DaysLeftHero card
 * consumes. Computed live from reservoir_daily_v2 (snapshot + 7d
 * inflow window + seasonal-month average + 2019-same-day comparison).
 */
export async function loadCityWaterEstimate(config: PlaceConfig): Promise<CityWaterEstimate> {
  const primary = config.waterSources.filter((s) => s.isPrimaryDrinkingSource);
  if (primary.length === 0) return EMPTY_ESTIMATE;
  const sourceCodes = primary.map((s) => s.sourceCode);

  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return EMPTY_ESTIMATE;
  }

  // Latest available date for any of the primary sources.
  const { data: latest } = await supabase
    .from("reservoir_daily_v2")
    .select("date")
    .eq("city_id", config.cityId)
    .in("source_code", sourceCodes)
    .order("date", { ascending: false })
    .limit(1);

  if (!latest || latest.length === 0) return EMPTY_ESTIMATE;
  const asOf = latest[0].date as string;

  // Snapshot: current storage across primary sources for asOf.
  const { data: rows } = await supabase
    .from("reservoir_daily_v2")
    .select("source_code, storage_tmc, inflow_cusecs")
    .eq("city_id", config.cityId)
    .in("source_code", sourceCodes)
    .eq("date", asOf);

  const totalStorageMcft = (rows ?? []).reduce(
    (s, r) => s + ((r.storage_tmc as number | null) ?? 0) * TMC_TO_MCFT,
    0,
  );
  const totalCapacityMcft = primary.reduce((s, p) => s + (p.fullCapacityMcft ?? 0), 0);

  // 7-day inflow average (Mcft/day): sum across primary sources per day,
  // then average across the days observed.
  const sevenDaysAgo = new Date(asOf);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
  const { data: recentRows } = await supabase
    .from("reservoir_daily_v2")
    .select("date, inflow_cusecs")
    .eq("city_id", config.cityId)
    .in("source_code", sourceCodes)
    .gte("date", sevenDaysAgoStr)
    .lte("date", asOf)
    .not("inflow_cusecs", "is", null);

  let recentAvgInflowMcftPerDay = 0;
  if (recentRows && recentRows.length > 0) {
    const byDate = new Map<string, number>();
    for (const r of recentRows) {
      byDate.set(
        r.date as string,
        (byDate.get(r.date as string) ?? 0) + ((r.inflow_cusecs as number | null) ?? 0),
      );
    }
    const totals = Array.from(byDate.values());
    if (totals.length > 0) {
      const avgCusecs = totals.reduce((s, v) => s + v, 0) / totals.length;
      recentAvgInflowMcftPerDay = avgCusecs * CUSEC_DAY_TO_MCFT;
    }
  }

  // Seasonal (same-month) average inflow over all years of history.
  const month = Number(asOf.slice(5, 7));
  const { data: seasonalRows } = await supabase
    .from("reservoir_daily_v2")
    .select("date, inflow_cusecs")
    .eq("city_id", config.cityId)
    .in("source_code", sourceCodes)
    .not("inflow_cusecs", "is", null);

  let seasonalAvgInflowMcftPerDay = 0;
  if (seasonalRows && seasonalRows.length > 0) {
    const byDate = new Map<string, number>();
    for (const r of seasonalRows) {
      const d = r.date as string;
      if (Number(d.slice(5, 7)) !== month) continue;
      byDate.set(d, (byDate.get(d) ?? 0) + ((r.inflow_cusecs as number | null) ?? 0));
    }
    const totals = Array.from(byDate.values());
    if (totals.length > 0) {
      const avgCusecs = totals.reduce((s, v) => s + v, 0) / totals.length;
      seasonalAvgInflowMcftPerDay = avgCusecs * CUSEC_DAY_TO_MCFT;
    }
  }

  // 2019 same-day comparison.
  const sameDay2019 = `2019-${asOf.slice(5)}`;
  const { data: data2019 } = await supabase
    .from("reservoir_daily_v2")
    .select("storage_tmc")
    .eq("city_id", config.cityId)
    .in("source_code", sourceCodes)
    .eq("date", sameDay2019);

  const comparison2019Storage =
    data2019 && data2019.length > 0
      ? data2019.reduce((s, r) => s + ((r.storage_tmc as number | null) ?? 0) * TMC_TO_MCFT, 0)
      : null;

  return {
    totalStorageMcft,
    totalCapacityMcft,
    recentAvgInflowMcftPerDay,
    seasonalAvgInflowMcftPerDay,
    comparison2019Storage,
    lastUpdated: asOf,
  };
}

const EMPTY_SNAPSHOT: CitySnapshot = {
  asOf: null,
  readingsBySource: {},
  reservoirIsLive: false,
};

export async function loadCitySnapshot(config: PlaceConfig): Promise<CitySnapshot> {
  const sourceCodes = config.waterSources.map((s) => s.sourceCode);
  if (sourceCodes.length === 0) return EMPTY_SNAPSHOT;

  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return EMPTY_SNAPSHOT;
  }

  const { data: latest, error: latestErr } = await supabase
    .from("reservoir_daily_v2")
    .select("date")
    .eq("city_id", config.cityId)
    .in("source_code", sourceCodes)
    .order("date", { ascending: false })
    .limit(1);

  if (latestErr || !latest || latest.length === 0) {
    return EMPTY_SNAPSHOT;
  }

  const asOf = latest[0].date as string;

  const { data: rows, error } = await supabase
    .from("reservoir_daily_v2")
    .select(
      "city_id, source_code, date, storage_tmc, storage_pct_frl, level_ft, inflow_cusecs, outflow_cusecs, source",
    )
    .eq("city_id", config.cityId)
    .eq("date", asOf)
    .in("source_code", sourceCodes);

  if (error || !rows) {
    return EMPTY_SNAPSHOT;
  }

  const typed = rows as ReservoirReadingV2[];
  const readingsBySource: Record<string, ReservoirReadingV2 | null> = {};
  for (const code of sourceCodes) {
    readingsBySource[code] = typed.find((r) => r.source_code === code) ?? null;
  }

  // "Live" means we have at least one primary-drinking-source reading.
  const primaryCodes = config.waterSources
    .filter((s) => s.isPrimaryDrinkingSource)
    .map((s) => s.sourceCode);
  const liveSources = primaryCodes.filter((c) => readingsBySource[c] !== null);
  const reservoirIsLive = primaryCodes.length > 0 && liveSources.length === primaryCodes.length;

  return { asOf, readingsBySource, reservoirIsLive };
}

const EMPTY_HISTORY: CityHistory = {
  earliestDate: null,
  latestDate: null,
  pointCount: 0,
  series: [],
};

/**
 * Pull the full daily history for this city's water sources from
 * reservoir_daily_v2 (back to whatever the backfill has populated).
 * Used by the history-trend chart on the city home page.
 *
 * Per Supabase row-limit defaults (1000 rows/page), we paginate so that
 * a 9-year backfill (~9 * 365 * 3 sources = ~10k rows for Madurai) lands
 * in a single response across multiple page requests.
 */
export async function loadCityHistory(config: PlaceConfig): Promise<CityHistory> {
  const sourceCodes = config.waterSources.map((s) => s.sourceCode);
  if (sourceCodes.length === 0) return EMPTY_HISTORY;

  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return EMPTY_HISTORY;
  }

  const all: { source_code: string; date: string; storage_tmc: number | null; storage_pct_frl: number | null }[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  let safety = 30; // up to 30k rows
  while (safety-- > 0) {
    const { data, error } = await supabase
      .from("reservoir_daily_v2")
      .select("source_code, date, storage_tmc, storage_pct_frl")
      .eq("city_id", config.cityId)
      .in("source_code", sourceCodes)
      .order("date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data) break;
    if (data.length === 0) break;
    for (const row of data) {
      all.push({
        source_code: row.source_code as string,
        date: row.date as string,
        storage_tmc: row.storage_tmc as number | null,
        storage_pct_frl: row.storage_pct_frl as number | null,
      });
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (all.length === 0) return EMPTY_HISTORY;

  // Group by source.
  const bySource = new Map<string, HistorySeriesPoint[]>();
  for (const r of all) {
    const arr = bySource.get(r.source_code) ?? [];
    arr.push({ date: r.date, storage_tmc: r.storage_tmc, storage_pct_frl: r.storage_pct_frl });
    bySource.set(r.source_code, arr);
  }

  const primaryCodes = new Set(
    config.waterSources.filter((s) => s.isPrimaryDrinkingSource).map((s) => s.sourceCode),
  );

  const series: HistorySeries[] = config.waterSources
    .map((s) => ({
      source_code: s.sourceCode,
      display_name: s.displayName,
      full_capacity_mcft: s.fullCapacityMcft,
      full_tank_level_ft: s.fullTankLevelFt,
      is_primary: primaryCodes.has(s.sourceCode),
      points: bySource.get(s.sourceCode) ?? [],
    }))
    .filter((s) => s.points.length > 0);

  // Find overall date envelope.
  const dates = all.map((r) => r.date).sort();
  return {
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
    pointCount: all.length,
    series,
  };
}

const EMPTY_FORECAST: CityForecast = { forecastDate: null, series: [] };

/**
 * Load the most-recent forecast for each of this city's water sources from
 * reservoir_forecast_v2. Returns empty when the forecast table is absent
 * (mig 020 not yet applied) or no rows exist (run the forecast script).
 */
export async function loadCityForecast(config: PlaceConfig): Promise<CityForecast> {
  const sourceCodes = config.waterSources.map((s) => s.sourceCode);
  if (sourceCodes.length === 0) return EMPTY_FORECAST;

  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return EMPTY_FORECAST;
  }

  // 1. Find the latest forecast_date per source.
  const { data: latestRows, error: latestErr } = await supabase
    .from("reservoir_forecast_v2")
    .select("source_code, forecast_date")
    .eq("city_id", config.cityId)
    .in("source_code", sourceCodes)
    .order("forecast_date", { ascending: false });

  if (latestErr || !latestRows || latestRows.length === 0) return EMPTY_FORECAST;

  const latestPerSource = new Map<string, string>();
  for (const r of latestRows) {
    if (!latestPerSource.has(r.source_code as string)) {
      latestPerSource.set(r.source_code as string, r.forecast_date as string);
    }
  }
  if (latestPerSource.size === 0) return EMPTY_FORECAST;

  // 2. Fetch all rows for the latest forecast per source.
  const { data: rows, error } = await supabase
    .from("reservoir_forecast_v2")
    .select(
      "source_code, forecast_date, target_date, predicted_storage_tmc, confidence_lower_tmc, confidence_upper_tmc, model_name",
    )
    .eq("city_id", config.cityId)
    .in("source_code", Array.from(latestPerSource.keys()))
    .order("target_date", { ascending: true });

  if (error || !rows) return EMPTY_FORECAST;

  const series: ForecastSeries[] = [];
  let overallForecastDate: string | null = null;
  for (const [code, latestDate] of latestPerSource) {
    if (!overallForecastDate || latestDate > overallForecastDate) overallForecastDate = latestDate;
    const sourceRows = rows.filter(
      (r) => r.source_code === code && r.forecast_date === latestDate,
    );
    if (sourceRows.length === 0) continue;
    series.push({
      source_code: code,
      forecast_date: latestDate,
      model_name: (sourceRows[0].model_name as string) ?? "auto_arima",
      points: sourceRows.map((r) => ({
        date: r.target_date as string,
        predicted_tmc: Number(r.predicted_storage_tmc),
        lower_tmc: Number(r.confidence_lower_tmc),
        upper_tmc: Number(r.confidence_upper_tmc),
      })),
    });
  }

  return { forecastDate: overallForecastDate, series };
}

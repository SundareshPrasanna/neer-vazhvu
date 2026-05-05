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

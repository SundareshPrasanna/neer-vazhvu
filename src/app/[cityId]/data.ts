import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { PlaceConfig } from "@/lib/cities";
import { RESERVOIR_DISPLAY_ORDER, RESERVOIR_METADATA } from "@/lib/utils/constants";
import type { ChennaiReservoirName } from "@/types/reservoir";

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

// HistorySeries / ForecastSeries types live in @/types/reservoir so the
// chart component can be reused by any city.
export type { HistorySeries, HistorySeriesPoint, ForecastSeries, ForecastSeriesPoint } from "@/types/reservoir";
import type { HistorySeries, HistorySeriesPoint, ForecastSeries, ReservoirSummary } from "@/types/reservoir";

const TMC_TO_MCFT = 1000;

/**
 * Convert a CitySnapshot to the ReservoirSummary[] shape that Chennai's
 * shared ReservoirCards consumes. Storage_tmc x 1000 = mcft; the capacity
 * comes from the place config so the percent-of-FRL is consistent across
 * cities even when the database row's own pct column is missing.
 */
export function snapshotToSummaries(
  config: PlaceConfig,
  snapshot: CitySnapshot,
): ReservoirSummary[] {
  return config.waterSources.map((source) => {
    const reading = snapshot.readingsBySource[source.sourceCode];
    const capacityMcft = source.fullCapacityMcft ?? 0;
    const storageMcft = ((reading?.storage_tmc as number | null | undefined) ?? 0) * TMC_TO_MCFT;
    const pct =
      reading?.storage_pct_frl != null
        ? (reading.storage_pct_frl as number)
        : capacityMcft > 0
          ? (storageMcft / capacityMcft) * 100
          : 0;
    // A registered source with no reading isn't "the dam is empty" - it
    // means our ingest pipeline doesn't currently publish a level for
    // it (e.g. Madurai's Sothuparai - TWAD doesn't publish daily
    // levels). Surface this honestly so the UI renders a "data not
    // available" card instead of a misleading 0% storage bar.
    const isLive = reading != null;
    return {
      name: source.sourceCode,
      displayName: source.displayName,
      currentStorage: storageMcft,
      capacity: capacityMcft,
      storagePct: Math.max(0, Math.min(100, pct)),
      inflowCusecs: (reading?.inflow_cusecs as number | null | undefined) ?? null,
      outflowCusecs: (reading?.outflow_cusecs as number | null | undefined) ?? null,
      rainfallMm: 0, // not tracked in v2 ingest yet
      isLive,
      noLiveDataReason: isLive
        ? undefined
        : `${config.primaryAuthority.acronym} does not publish daily levels for this source.`,
    };
  });
}

export interface CityHistory {
  earliestDate: string | null;
  latestDate: string | null;
  pointCount: number;
  series: HistorySeries[];
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
  comparisonStorage: number | null;
  comparisonYear: number | null;
  /** Observed storage change (mcft/day, +/-) over the last 7 reporting
   *  days, net of draw - derived from the daily storage record for feeds
   *  that publish no inflow column. null when the record is too short. */
  observedTrendMcftPerDay?: number | null;
  /** True when the reference reading is the nearest within a window
   *  rather than the exact same date (legacy weekly/monthly history). */
  comparisonIsApprox?: boolean;
  lastUpdated: string | null;
}

const EMPTY_ESTIMATE: CityWaterEstimate = {
  totalStorageMcft: 0,
  totalCapacityMcft: 0,
  recentAvgInflowMcftPerDay: 0,
  seasonalAvgInflowMcftPerDay: 0,
  comparisonStorage: null,
  comparisonYear: null,
  lastUpdated: null,
};

const CUSEC_DAY_TO_MCFT = 0.0864;

async function loadSeasonalAvgInflowMcftPerDay(
  supabase: ReturnType<typeof createServerClient>,
  config: PlaceConfig,
  sourceCodes: string[],
  month: number,
): Promise<number> {
  const { data, error } = await supabase.rpc("avg_monthly_inflow_v2", {
    target_city_id: config.cityId,
    target_source_codes: sourceCodes,
    target_month: month,
  });

  if (!error) {
    return Number(data?.[0]?.avg_inflow_mcft_per_day ?? 0);
  }

  // Back-compat for databases that have not run migration 022 yet.
  // This preserves behaviour, but the RPC path above avoids pulling the
  // full inflow archive into the Server Component render.
  const { data: seasonalRows } = await supabase
    .from("reservoir_daily_v2")
    .select("date, inflow_cusecs")
    .eq("city_id", config.cityId)
    .in("source_code", sourceCodes)
    .not("inflow_cusecs", "is", null);

  if (!seasonalRows || seasonalRows.length === 0) return 0;

  const byDate = new Map<string, number>();
  for (const r of seasonalRows) {
    const d = r.date as string;
    if (Number(d.slice(5, 7)) !== month) continue;
    byDate.set(d, (byDate.get(d) ?? 0) + ((r.inflow_cusecs as number | null) ?? 0));
  }

  const totals = Array.from(byDate.values());
  if (totals.length === 0) return 0;

  const avgCusecs = totals.reduce((s, v) => s + v, 0) / totals.length;
  return avgCusecs * CUSEC_DAY_TO_MCFT;
}

/**
 * Roll the city's primary-drinking sources up into a single
 * water-estimate row, using the same shape Chennai's DaysLeftHero card
 * consumes. Computed live from reservoir_daily_v2 (snapshot + 7d
 * inflow window + seasonal-month average + 2019-same-day comparison).
 */
export async function loadCityWaterEstimate(config: PlaceConfig): Promise<CityWaterEstimate> {
  if (config.reservoirDataSource === "legacy-v1") {
    return loadLegacyChennaiWaterEstimate();
  }
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
  // Prefer the database aggregate helper so page render time does not
  // grow with every year of backfilled rows.
  const month = Number(asOf.slice(5, 7));
  const seasonalAvgInflowMcftPerDay = await loadSeasonalAvgInflowMcftPerDay(
    supabase,
    config,
    sourceCodes,
    month,
  );

  // Observed 7-day storage trend: for storage-only bulletins (Pravah)
  // the daily record itself shows the monsoon working - sum storage by
  // date (only dates where every feed source reported) and take the
  // per-day slope between the earliest and latest complete dates.
  const eightDaysAgo = new Date(asOf);
  eightDaysAgo.setDate(eightDaysAgo.getDate() - 7);
  const { data: trendRows } = await supabase
    .from("reservoir_daily_v2")
    .select("date, source_code, storage_tmc")
    .eq("city_id", config.cityId)
    .in("source_code", sourceCodes)
    .gte("date", eightDaysAgo.toISOString().slice(0, 10))
    .lte("date", asOf);
  let observedTrendMcftPerDay: number | null = null;
  // "Complete" = every source that CAN report did (feedless sources like
  // Vihar/Tulsi never appear in the bulletin and must not gate the trend).
  const feedSourceCount = primary.filter((p) => p.hasPublicFeed !== false).length;
  if (trendRows && trendRows.length > 0 && feedSourceCount > 0) {
    const byDate = new Map<string, { sum: number; n: number }>();
    for (const r of trendRows) {
      const e = byDate.get(r.date as string) ?? { sum: 0, n: 0 };
      e.sum += ((r.storage_tmc as number | null) ?? 0) * TMC_TO_MCFT;
      e.n += 1;
      byDate.set(r.date as string, e);
    }
    const complete = [...byDate.entries()]
      .filter(([, v]) => v.n === feedSourceCount)
      .sort(([a], [b]) => a.localeCompare(b));
    if (complete.length >= 2) {
      const [firstDate, first] = complete[0];
      const [lastDate, last] = complete[complete.length - 1];
      const spanDays =
        (new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86_400_000;
      if (spanDays >= 1) {
        observedTrendMcftPerDay = (last.sum - first.sum) / spanDays;
      }
    }
  }

  // Same-day storage comparison against the reference year (config
  // override, else last year). Guard: only comparable when the reference
  // day covers every source reporting today - Mumbai's 2019 backfill holds
  // 2 of 5 dams, and summing those against a 5-dam today would read
  // "(better today)" off a false base.
  const comparisonYear = config.heroComparisonYear ?? Number(asOf.slice(0, 4)) - 1;
  const sameDayRef = `${comparisonYear}-${asOf.slice(5)}`;
  const { data: dataRef } = await supabase
    .from("reservoir_daily_v2")
    .select("source_code, storage_tmc")
    .eq("city_id", config.cityId)
    .in("source_code", sourceCodes)
    .eq("date", sameDayRef);

  const todayCodes = new Set((rows ?? []).map((r) => r.source_code as string));
  const refCodes = new Set((dataRef ?? []).map((r) => r.source_code as string));
  const refCoversToday = [...todayCodes].every((c) => refCodes.has(c));

  const comparisonStorage =
    dataRef && dataRef.length > 0 && refCoversToday
      ? dataRef.reduce((s, r) => s + ((r.storage_tmc as number | null) ?? 0) * TMC_TO_MCFT, 0)
      : null;

  return {
    totalStorageMcft,
    totalCapacityMcft,
    recentAvgInflowMcftPerDay,
    seasonalAvgInflowMcftPerDay,
    comparisonStorage,
    comparisonYear: comparisonStorage !== null ? comparisonYear : null,
    comparisonIsApprox: false,
    observedTrendMcftPerDay,
    lastUpdated: asOf,
  };
}

const EMPTY_SNAPSHOT: CitySnapshot = {
  asOf: null,
  readingsBySource: {},
  reservoirIsLive: false,
};

// ---------------------------------------------------------------------------
// Legacy v1 (Chennai) reservoir loaders.
//
// Chennai's reservoir history lives in the original single-tenant `reservoir_daily`
// table, storing storage in Mcft (column current_storage_mcft) rather than the
// multi-city `reservoir_daily_v2` schema (storage_tmc). The seasonal-average RPC
// is the v1 `avg_monthly_inflow` (no city/source args), not `avg_monthly_inflow_v2`.
// These helpers reproduce the exact query logic that previously lived in
// chennai-home.tsx getReservoirData(), so the shared dashboard renders Chennai's
// numbers identically. loadCitySnapshot / loadCityWaterEstimate delegate here
// when config.reservoirDataSource === 'legacy-v1'.
// ---------------------------------------------------------------------------

async function loadLegacyChennaiSnapshot(config: PlaceConfig): Promise<CitySnapshot> {
  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return EMPTY_SNAPSHOT;
  }

  const { data: latest } = await supabase
    .from("reservoir_daily")
    .select("*")
    .order("date", { ascending: false })
    .limit(12);

  if (!latest || latest.length === 0) return EMPTY_SNAPSHOT;

  const asOf = latest[0].date as string;
  const todayRows = latest.filter((r: { date: string }) => r.date === asOf);

  const sourceCodes = config.waterSources.map((s) => s.sourceCode);
  const readingsBySource: Record<string, ReservoirReadingV2 | null> = {};
  for (const code of sourceCodes) readingsBySource[code] = null;

  for (const r of todayRows as Record<string, unknown>[]) {
    const code = r.reservoir as string;
    if (!(code in readingsBySource)) continue;
    // Express legacy Mcft storage in the v2 reading shape (storage_tmc) so
    // snapshotToSummaries renders identical cards. storage_pct_frl carries the
    // DB's own storage_pct so the percentage bar matches chennai-home exactly.
    readingsBySource[code] = {
      city_id: config.cityId,
      source_code: code,
      date: asOf,
      storage_tmc: ((r.current_storage_mcft as number) || 0) / TMC_TO_MCFT,
      storage_pct_frl: (r.storage_pct as number) ?? null,
      level_ft: null,
      inflow_cusecs: (r.inflow_cusecs as number) ?? null,
      outflow_cusecs: (r.outflow_cusecs as number) ?? null,
      source: "reservoir_daily",
    };
  }

  const primaryCodes = config.waterSources
    .filter((s) => s.isPrimaryDrinkingSource && s.hasPublicFeed !== false)
    .map((s) => s.sourceCode);
  const liveSources = primaryCodes.filter((c) => readingsBySource[c] !== null);
  const reservoirIsLive =
    primaryCodes.length === 0 || liveSources.length === primaryCodes.length;

  return { asOf, readingsBySource, reservoirIsLive };
}

/**
 * Roll Chennai's legacy `reservoir_daily` rows into the shared
 * CityWaterEstimate shape DaysLeftHero consumes. Mirrors the prior
 * chennai-home.tsx getReservoirData() math exactly: storage already in Mcft,
 * 7-day inflow window, seasonal average via the v1 `avg_monthly_inflow` RPC,
 * and a 2019 same-day storage comparison.
 */
async function loadLegacyChennaiWaterEstimate(): Promise<CityWaterEstimate> {
  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return EMPTY_ESTIMATE;
  }

  const { data: latest } = await supabase
    .from("reservoir_daily")
    .select("*")
    .order("date", { ascending: false })
    .limit(12);

  if (!latest || latest.length === 0) return EMPTY_ESTIMATE;

  const mostRecentDate = latest[0].date as string;
  const todayReservoirs = latest.filter(
    (r: { date: string }) => r.date === mostRecentDate,
  );

  // Cards/summary use the same display-ordered set chennai-home rendered.
  const reservoirs = (todayReservoirs as Record<string, unknown>[])
    .map((r) => {
      const m = RESERVOIR_METADATA[r.reservoir as ChennaiReservoirName];
      return {
        name: r.reservoir as ChennaiReservoirName,
        currentStorage: (r.current_storage_mcft as number) || 0,
        capacity: (r.capacity_mcft as number) || m?.fullCapacityMcft || 0,
      };
    })
    .sort((a, b) => {
      const ai = RESERVOIR_DISPLAY_ORDER.indexOf(
        a.name as (typeof RESERVOIR_DISPLAY_ORDER)[number],
      );
      const bi = RESERVOIR_DISPLAY_ORDER.indexOf(
        b.name as (typeof RESERVOIR_DISPLAY_ORDER)[number],
      );
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  // 7-day avg inflow (Mcft/day).
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: recentInflow } = await supabase
    .from("reservoir_daily")
    .select("date, inflow_cusecs")
    .gte("date", sevenDaysAgo.toISOString().split("T")[0])
    .not("inflow_cusecs", "is", null);

  let recentAvgInflowMcftPerDay = 0;
  if (recentInflow && recentInflow.length > 0) {
    const byDate = new Map<string, number>();
    for (const row of recentInflow) {
      byDate.set(
        row.date as string,
        (byDate.get(row.date as string) || 0) + ((row.inflow_cusecs as number) || 0),
      );
    }
    const dailyTotals = Array.from(byDate.values());
    const avgCusecs = dailyTotals.reduce((s, v) => s + v, 0) / dailyTotals.length;
    recentAvgInflowMcftPerDay = avgCusecs * CUSEC_DAY_TO_MCFT;
  }

  // Seasonal avg via the v1 RPC (current month).
  const currentMonth = new Date().getMonth() + 1;
  const { data: seasonalData } = await supabase.rpc("avg_monthly_inflow", {
    target_month: currentMonth,
  });
  const seasonalAvgInflowMcftPerDay =
    seasonalData?.[0]?.avg_inflow_mcft_per_day || 0;

  // 2019 comparison. The legacy history is weekly today and monthly back
  // in 2019 (12 dates in the whole year), so an exact same-date match
  // almost never exists - which is why this line never rendered in
  // production. Take the nearest 2019 reading within +/-10 days and label
  // it "around this day" rather than "on this day".
  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  const target2019 = new Date(`2019-${mmdd}T00:00:00Z`).getTime();
  const lo = new Date(target2019 - 10 * 86_400_000).toISOString().slice(0, 10);
  const hi = new Date(target2019 + 10 * 86_400_000).toISOString().slice(0, 10);
  const { data: windowRows } = await supabase
    .from("reservoir_daily")
    .select("date, current_storage_mcft")
    .gte("date", lo)
    .lte("date", hi);
  let data2019: { current_storage_mcft: number }[] | null = null;
  let comparisonIsApprox = false;
  if (windowRows && windowRows.length > 0) {
    const dates = [...new Set(windowRows.map((r) => r.date as string))];
    const nearest = dates.sort(
      (a, b) =>
        Math.abs(new Date(a).getTime() - target2019) -
        Math.abs(new Date(b).getTime() - target2019),
    )[0];
    data2019 = windowRows.filter((r) => r.date === nearest);
    comparisonIsApprox = nearest !== `2019-${mmdd}`;
  }

  // Chennai-only path: 2019 IS the anchor (Day Zero) and the legacy table
  // is complete across all reservoirs back past 2019.
  const comparisonStorage = data2019
    ? data2019.reduce(
        (sum: number, r: { current_storage_mcft: number }) =>
          sum + (r.current_storage_mcft || 0),
        0,
      ) || null
    : null;

  const totalStorageMcft = reservoirs.reduce((sum, r) => sum + r.currentStorage, 0);
  const totalCapacityMcft = reservoirs.reduce((sum, r) => sum + r.capacity, 0);

  return {
    totalStorageMcft,
    totalCapacityMcft,
    recentAvgInflowMcftPerDay,
    seasonalAvgInflowMcftPerDay,
    comparisonStorage,
    comparisonYear: comparisonStorage !== null ? 2019 : null,
    comparisonIsApprox: comparisonStorage !== null ? comparisonIsApprox : false,
    lastUpdated: mostRecentDate,
  };
}

export async function loadCitySnapshot(config: PlaceConfig): Promise<CitySnapshot> {
  if (config.reservoirDataSource === "legacy-v1") {
    return loadLegacyChennaiSnapshot(config);
  }
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

  // "Live" means either (a) the city has no primary-drinking-source defined
  // because its data model doesn't include a city-owned reservoir (Bangalore -
  // BWSSB drinks Cauvery via T.K. Halli, not from any single reservoir), or
  // (b) the city has primaries defined AND every one has a current reading.
  // The previous form (`primaryCodes.length > 0 && ...`) flipped to false
  // for cities like Bangalore that legitimately have zero primaries, which
  // surfaced a misleading "waiting for first daily ingestion" pill.
  const primaryCodes = config.waterSources
    .filter((s) => s.isPrimaryDrinkingSource && s.hasPublicFeed !== false)
    .map((s) => s.sourceCode);
  const liveSources = primaryCodes.filter((c) => readingsBySource[c] !== null);
  const reservoirIsLive = primaryCodes.length === 0 || liveSources.length === primaryCodes.length;

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

import { DaysLeftHero } from "@/components/dashboard/days-left-hero";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { GroundwaterSnapshot } from "@/components/dashboard/groundwater-snapshot";
import { DemoDashboard } from "@/components/dashboard/demo-dashboard";
import { CUSEC_DAY_TO_MCFT, RESERVOIR_DISPLAY_ORDER } from "@/lib/utils/constants";
import { getGroundwaterStatus } from "@/types/groundwater";
import type { ReservoirSummary, ReservoirName } from "@/types/reservoir";
import type { GroundwaterApiResponse } from "@/types/groundwater";
import { formatDate } from "@/lib/utils/format";

export const revalidate = 900; // ISR: revalidate every 15 minutes

function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

async function getReservoirData() {
  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const { data: latest } = await supabase
    .from("reservoir_daily")
    .select("*")
    .order("date", { ascending: false })
    .limit(12);

  if (!latest || latest.length === 0) return null;

  const mostRecentDate = latest[0].date;
  const todayReservoirs = latest.filter((r: { date: string }) => r.date === mostRecentDate);

  const { data: meta } = await supabase.from("reservoir_meta").select("*");
  const metaMap = new Map(meta?.map((m: { reservoir: string }) => [m.reservoir, m]) || []);

  const reservoirs: ReservoirSummary[] = todayReservoirs
    .map((r: Record<string, unknown>) => {
      const m = metaMap.get(r.reservoir as string) as Record<string, unknown> | undefined;
      return {
        name: r.reservoir as ReservoirName,
        displayName: (m?.display_name as string) || (r.reservoir as string),
        currentStorage: (r.current_storage_mcft as number) || 0,
        capacity: (r.capacity_mcft as number) || (m?.full_capacity_mcft as number) || 0,
        storagePct: (r.storage_pct as number) || 0,
        inflowCusecs: (r.inflow_cusecs as number) || 0,
        outflowCusecs: (r.outflow_cusecs as number) || 0,
        rainfallMm: (r.rainfall_mm as number) || 0,
      };
    })
    .sort((a: ReservoirSummary, b: ReservoirSummary) => {
      const ai = RESERVOIR_DISPLAY_ORDER.indexOf(a.name as (typeof RESERVOIR_DISPLAY_ORDER)[number]);
      const bi = RESERVOIR_DISPLAY_ORDER.indexOf(b.name as (typeof RESERVOIR_DISPLAY_ORDER)[number]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  // Historical data (all available — chart tabs handle filtering client-side)
  // Supabase/PostgREST caps at 1000 rows per request; paginate to get all
  const historyRaw: { date: string; reservoir: string; current_storage_mcft: number; inflow_cusecs: number | null; outflow_cusecs: number | null }[] = [];
  let offset = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data: page } = await supabase
      .from("reservoir_daily")
      .select("date, reservoir, current_storage_mcft, inflow_cusecs, outflow_cusecs")
      .not("current_storage_mcft", "is", null)
      .order("date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    historyRaw.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Per-reservoir history (used for individual reservoir charts)
  const perReservoirMap = new Map<string, Map<string, { storage: number; inflow: number; outflow: number }>>();
  for (const row of historyRaw) {
    if (row.reservoir) {
      if (!perReservoirMap.has(row.reservoir)) {
        perReservoirMap.set(row.reservoir, new Map());
      }
      perReservoirMap.get(row.reservoir)!.set(row.date, {
        storage: row.current_storage_mcft || 0,
        inflow: row.inflow_cusecs || 0,
        outflow: row.outflow_cusecs || 0,
      });
    }
  }

  // Combined totals per date — forward-fill storage for reservoirs with
  // sparse (monthly) data so the combined chart doesn't drop to near-zero
  // on dates where only daily-frequency reservoirs report.
  const allDates = Array.from(new Set(historyRaw.map((r) => r.date))).sort();
  const reservoirNames = Array.from(perReservoirMap.keys());
  const lastKnownStorage = new Map<string, number>();
  const history: Array<{ date: string; totalStorage: number; totalInflow: number; totalOutflow: number }> = [];

  for (const date of allDates) {
    let totalStorage = 0;
    let totalInflow = 0;
    let totalOutflow = 0;

    for (const res of reservoirNames) {
      const resMap = perReservoirMap.get(res)!;
      if (resMap.has(date)) {
        const val = resMap.get(date)!;
        lastKnownStorage.set(res, val.storage);
        totalStorage += val.storage;
        totalInflow += val.inflow;
        totalOutflow += val.outflow;
      } else if (lastKnownStorage.has(res)) {
        // Forward-fill storage only (inflow/outflow are instantaneous, not carried)
        totalStorage += lastKnownStorage.get(res)!;
      }
    }

    history.push({ date, totalStorage, totalInflow, totalOutflow });
  }
  const perReservoirHistory: Record<string, Array<{ date: string; totalStorage: number; totalInflow: number; totalOutflow: number }>> = {};
  for (const [reservoir, dateMap] of perReservoirMap) {
    perReservoirHistory[reservoir] = Array.from(dateMap.entries()).map(([date, vals]) => ({
      date,
      totalStorage: vals.storage,
      totalInflow: vals.inflow,
      totalOutflow: vals.outflow,
    }));
  }

  // Forecast data from reservoir_forecast table
  type ForecastPoint = { date: string; predicted: number; lower: number; upper: number };
  const forecast: ForecastPoint[] = [];
  const perReservoirForecast: Record<string, ForecastPoint[]> = {};

  const { data: latestForecastRow } = await supabase
    .from("reservoir_forecast")
    .select("forecast_date")
    .order("forecast_date", { ascending: false })
    .limit(1);

  if (latestForecastRow && latestForecastRow.length > 0) {
    const { data: forecastRaw } = await supabase
      .from("reservoir_forecast")
      .select("reservoir, target_date, predicted_storage_mcft, confidence_lower_mcft, confidence_upper_mcft")
      .eq("forecast_date", latestForecastRow[0].forecast_date)
      .order("target_date", { ascending: true });

    // Build per-reservoir forecast and count contributors per date
    const combinedMap = new Map<string, { predicted: number; lower: number; upper: number }>();
    const dateContributors = new Map<string, number>();
    for (const row of forecastRaw || []) {
      const point: ForecastPoint = {
        date: row.target_date,
        predicted: row.predicted_storage_mcft || 0,
        lower: row.confidence_lower_mcft || 0,
        upper: row.confidence_upper_mcft || 0,
      };
      if (!perReservoirForecast[row.reservoir]) {
        perReservoirForecast[row.reservoir] = [];
      }
      perReservoirForecast[row.reservoir].push(point);

      // Sum for combined forecast
      const existing = combinedMap.get(row.target_date);
      if (existing) {
        existing.predicted += point.predicted;
        existing.lower += point.lower;
        existing.upper += point.upper;
      } else {
        combinedMap.set(row.target_date, { ...point });
      }
      dateContributors.set(row.target_date, (dateContributors.get(row.target_date) || 0) + 1);
    }
    // Only include dates where all forecasting reservoirs contribute.
    // Partial sums (e.g. only 1 of 6 reservoirs) create misleading jumps.
    const maxContributors = Math.max(...dateContributors.values(), 0);
    for (const [date, vals] of combinedMap) {
      if ((dateContributors.get(date) || 0) >= maxContributors) {
        forecast.push({ date, ...vals });
      }
    }
    forecast.sort((a, b) => a.date.localeCompare(b.date));
  }

  // 7-day avg inflow
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
      byDate.set(row.date, (byDate.get(row.date) || 0) + (row.inflow_cusecs || 0));
    }
    const dailyTotals = Array.from(byDate.values());
    const avgCusecs = dailyTotals.reduce((s, v) => s + v, 0) / dailyTotals.length;
    recentAvgInflowMcftPerDay = avgCusecs * CUSEC_DAY_TO_MCFT;
  }

  // Seasonal avg
  const currentMonth = new Date().getMonth() + 1;
  const { data: seasonalData } = await supabase.rpc("avg_monthly_inflow", {
    target_month: currentMonth,
  });
  const seasonalAvgInflowMcftPerDay = seasonalData?.[0]?.avg_inflow_mcft_per_day || 0;

  // 2019 comparison
  const today = new Date();
  const sameDay2019 = `2019-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const { data: data2019 } = await supabase
    .from("reservoir_daily")
    .select("current_storage_mcft")
    .eq("date", sameDay2019);

  const comparison2019Storage = data2019
    ? data2019.reduce((sum: number, r: { current_storage_mcft: number }) => sum + (r.current_storage_mcft || 0), 0) || null
    : null;

  const totalStorage = reservoirs.reduce((sum, r) => sum + r.currentStorage, 0);
  const totalCapacity = reservoirs.reduce((sum, r) => sum + r.capacity, 0);

  return {
    reservoirs,
    totalStorage,
    totalCapacity,
    history,
    perReservoirHistory,
    forecast,
    perReservoirForecast,
    lastUpdated: mostRecentDate,
    recentAvgInflowMcftPerDay,
    seasonalAvgInflowMcftPerDay,
    comparison2019Storage,
  };
}

async function getGroundwaterData(): Promise<GroundwaterApiResponse | null> {
  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const { data: latest } = await supabase
    .from("groundwater_monthly")
    .select("year, month")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1);

  if (!latest || latest.length === 0) return null;

  const { year, month } = latest[0];

  const { data: currentData } = await supabase
    .from("groundwater_monthly")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .order("ward_number", { ascending: true });

  const { data: prevYearData } = await supabase
    .from("groundwater_monthly")
    .select("ward_number, depth_to_water_m")
    .eq("year", year - 1)
    .eq("month", month);

  const prevYearMap = new Map(prevYearData?.map((r: { ward_number: number; depth_to_water_m: number }) => [r.ward_number, r.depth_to_water_m]) || []);

  const wards = (currentData || []).map((r: Record<string, unknown>) => {
    const prevDepth = prevYearMap.get(r.ward_number as number);
    let trend: "improving" | "stable" | "declining" | "unknown" = "unknown";
    if (prevDepth != null && r.depth_to_water_m != null) {
      const diff = (r.depth_to_water_m as number) - prevDepth;
      if (diff < -0.5) trend = "improving";
      else if (diff > 0.5) trend = "declining";
      else trend = "stable";
    }
    return {
      wardNumber: r.ward_number as number,
      wardName: (r.ward_name as string) || `Ward ${r.ward_number}`,
      zone: (r.zone_name as string) || "",
      depthM: r.depth_to_water_m as number,
      trend,
    };
  });

  const summary = { healthy: 0, moderate: 0, declining: 0, stressed: 0, critical: 0, crisis: 0, noData: 0 };
  for (const w of wards) {
    summary[getGroundwaterStatus(w.depthM)]++;
  }

  const withData = wards.filter((w: { depthM: number | null }) => w.depthM !== null);
  const cityAverage = withData.length > 0
    ? parseFloat((withData.reduce((sum: number, w: { depthM: number }) => sum + w.depthM, 0) / withData.length).toFixed(1))
    : null;

  return { period: { year, month }, cityAverage, wards, summary };
}

export default async function DashboardPage() {
  // If Supabase is not configured, render demo mode with scenario switcher
  if (!isSupabaseConfigured()) {
    return <DemoDashboard />;
  }

  // Try to fetch real data; fall back to demo on any error
  let reservoirData: Awaited<ReturnType<typeof getReservoirData>>;
  let groundwaterData: Awaited<ReturnType<typeof getGroundwaterData>>;
  try {
    [reservoirData, groundwaterData] = await Promise.all([
      getReservoirData(),
      getGroundwaterData(),
    ]);
  } catch {
    // Supabase connection failed — show demo mode
    return <DemoDashboard />;
  }

  if (!reservoirData) {
    return <DemoDashboard />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <DaysLeftHero
        totalStorageMcft={reservoirData.totalStorage}
        totalCapacityMcft={reservoirData.totalCapacity}
        recentAvgInflowMcftPerDay={reservoirData.recentAvgInflowMcftPerDay}
        seasonalAvgInflowMcftPerDay={reservoirData.seasonalAvgInflowMcftPerDay}
        lastUpdated={formatDate(reservoirData.lastUpdated)}
        comparison2019Storage={reservoirData.comparison2019Storage}
      />

      <DashboardContent
        reservoirs={reservoirData.reservoirs.filter((r) =>
          (RESERVOIR_DISPLAY_ORDER as readonly string[]).includes(r.name)
        )}
        history={reservoirData.history}
        perReservoirHistory={reservoirData.perReservoirHistory}
        forecast={reservoirData.forecast}
        perReservoirForecast={reservoirData.perReservoirForecast}
      />

      {groundwaterData && <GroundwaterSnapshot data={groundwaterData} />}
    </div>
  );
}

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
  const { data: historyRaw } = await supabase
    .from("reservoir_daily")
    .select("date, reservoir, current_storage_mcft")
    .not("current_storage_mcft", "is", null)
    .order("date", { ascending: true });

  // Combined totals per date
  const historyMap = new Map<string, number>();
  // Per-reservoir history
  const perReservoirMap = new Map<string, Map<string, number>>();
  for (const row of historyRaw || []) {
    historyMap.set(row.date, (historyMap.get(row.date) || 0) + (row.current_storage_mcft || 0));
    if (row.reservoir) {
      if (!perReservoirMap.has(row.reservoir)) {
        perReservoirMap.set(row.reservoir, new Map());
      }
      perReservoirMap.get(row.reservoir)!.set(row.date, row.current_storage_mcft || 0);
    }
  }
  const history = Array.from(historyMap.entries()).map(([date, totalStorage]) => ({
    date,
    totalStorage,
  }));
  const perReservoirHistory: Record<string, Array<{ date: string; totalStorage: number }>> = {};
  for (const [reservoir, dateMap] of perReservoirMap) {
    perReservoirHistory[reservoir] = Array.from(dateMap.entries()).map(([date, totalStorage]) => ({
      date,
      totalStorage,
    }));
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
  try {
    const [reservoirData, groundwaterData] = await Promise.all([
      getReservoirData(),
      getGroundwaterData(),
    ]);

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
        />

        {groundwaterData && <GroundwaterSnapshot data={groundwaterData} />}
      </div>
    );
  } catch {
    // Supabase connection failed — show demo mode
    return <DemoDashboard />;
  }
}

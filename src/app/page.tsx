import { readFileSync } from "fs";
import { resolve } from "path";
import { DaysLeftHero } from "@/components/dashboard/days-left-hero";
import { UrbanSupplyOverview } from "@/components/dashboard/urban-supply-overview";
import { ReservoirCards } from "@/components/dashboard/reservoir-cards";
import { DashboardHistorySection } from "@/components/dashboard/dashboard-history-section";
import { ReservoirCatchmentContext } from "@/components/dashboard/reservoir-catchment-context";
import { GroundwaterSnapshot } from "@/components/dashboard/groundwater-snapshot";
import { DeferredRainfallTrends } from "@/components/dashboard/deferred-rainfall-trends";
import { DemoDashboard } from "@/components/dashboard/demo-dashboard";
import { CityStory } from "@/components/insights/city-story";
import type { AiNarrative } from "@/components/insights/city-story";
import {
  CUSEC_DAY_TO_MCFT,
  RESERVOIR_DISPLAY_ORDER,
  RESERVOIR_METADATA,
} from "@/lib/utils/constants";
import { getGroundwaterStatus } from "@/types/groundwater";
import type { ReservoirSummary, ChennaiReservoirName } from "@/types/reservoir";
import type { GroundwaterApiResponse } from "@/types/groundwater";
import type { ReservoirCatchmentContextRow } from "@/lib/gee/reservoir-context";
import { formatDate } from "@/lib/utils/format";
import { deriveReservoirMetrics, deriveGroundwaterMetrics, deriveRestorationMetrics } from "@/lib/insights/derive-metrics";
import { selectNarrative } from "@/lib/insights/select-narrative";
import { readFile } from "fs/promises";
import { join } from "path";
import { NewsSection } from "@/components/insights/news-section";

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

  const reservoirs: ReservoirSummary[] = todayReservoirs
    .map((r: Record<string, unknown>) => {
      const m = RESERVOIR_METADATA[r.reservoir as ChennaiReservoirName];
      return {
        name: r.reservoir as ChennaiReservoirName,
        displayName: m?.displayName || (r.reservoir as string),
        currentStorage: (r.current_storage_mcft as number) || 0,
        capacity: (r.capacity_mcft as number) || m?.fullCapacityMcft || 0,
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
    lastUpdated: mostRecentDate,
    recentAvgInflowMcftPerDay,
    seasonalAvgInflowMcftPerDay,
    comparison2019Storage,
  };
}

// Load canonical ward zone names once at module level
const wardNamesPath = resolve(process.cwd(), "public/data/ward-names.json");
const canonicalNames = new Map<number, string>(
  (JSON.parse(readFileSync(wardNamesPath, "utf-8")) as { ward_number: number; zone_name: string }[])
    .map((w) => [w.ward_number, `Ward ${w.ward_number}`])
);

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
      wardName: canonicalNames.get(r.ward_number as number) || (r.ward_name as string) || `Ward ${r.ward_number}`,
      wardNameTa: (r.ward_name_ta as string) || (r.ward_name_tamil as string) || undefined,
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

async function getAiNarrative(): Promise<AiNarrative | null> {
  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  // Scope to today's briefing (IST) so stale AI narratives trigger template fallback
  const todayIST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const { data } = await supabase
    .from("daily_briefing")
    .select("briefing_date, ai_headline_en, ai_headline_ta, ai_body_en, ai_body_ta, ai_source_dates, ai_model")
    .eq("briefing_date", todayIST)
    .not("ai_headline_en", "is", null)
    .limit(1);

  if (!data?.[0]) return null;

  const row = data[0];
  return {
    date: row.briefing_date,
    headline_en: row.ai_headline_en,
    headline_ta: row.ai_headline_ta,
    body_en: row.ai_body_en,
    body_ta: row.ai_body_ta,
    source_dates: row.ai_source_dates,
    model: row.ai_model,
  };
}

async function getReservoirCatchmentContextRows(): Promise<ReservoirCatchmentContextRow[] | null> {
  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const latestDateResult = await supabase
    .from("reservoir_catchment_context")
    .select("context_date")
    .eq("window_days", 30)
    .order("context_date", { ascending: false })
    .limit(1);

  if (latestDateResult.error || !latestDateResult.data?.[0]?.context_date) {
    return null;
  }

  const contextDate = latestDateResult.data[0].context_date;
  const rowsResult = await supabase
    .from("reservoir_catchment_context")
    .select(
      "reservoir, context_date, window_days, rain_total_mm, baseline_mm, anomaly_pct, context_level",
    )
    .eq("context_date", contextDate)
    .eq("window_days", 30);

  if (rowsResult.error || !rowsResult.data?.length) {
    return null;
  }

  return rowsResult.data.map((row) => ({
    reservoir: row.reservoir as ChennaiReservoirName,
    contextDate: row.context_date,
    windowDays: row.window_days,
    rainTotalMm: Number(row.rain_total_mm ?? 0),
    baselineMm: row.baseline_mm == null ? null : Number(row.baseline_mm),
    anomalyPct: row.anomaly_pct == null ? null : Number(row.anomaly_pct),
    contextLevel: row.context_level as ReservoirCatchmentContextRow["contextLevel"],
  }));
}

export default async function DashboardPage() {
  // If Supabase is not configured, render demo mode with scenario switcher
  if (!isSupabaseConfigured()) {
    return <DemoDashboard />;
  }

  // Try to fetch real data; fall back to demo on any error
  let reservoirData = null;
  let groundwaterData = null;
  let aiNarrative: AiNarrative | null = null;
  let reservoirCatchmentContextRows: ReservoirCatchmentContextRow[] | null = null;
  try {
    [reservoirData, groundwaterData, aiNarrative, reservoirCatchmentContextRows] = await Promise.all([
      getReservoirData(),
      getGroundwaterData(),
      getAiNarrative(),
      getReservoirCatchmentContextRows(),
    ]);
  } catch {
    // Supabase connection failed  -  show demo mode
  }

  if (!reservoirData) {
    return <DemoDashboard />;
  }

  // Compute CityStory narrative from available data
  let cityStoryNarrative = null;
  if (groundwaterData) {
    try {
      const restorationPath = join(process.cwd(), "public", "data", "restoration-priority.json");
      const restorationRaw = JSON.parse(await readFile(restorationPath, "utf-8"));

      const metrics = {
        reservoir: deriveReservoirMetrics(
          reservoirData.totalStorage,
          reservoirData.totalCapacity,
          reservoirData.lastUpdated,
        ),
        groundwater: deriveGroundwaterMetrics(groundwaterData),
        restoration: deriveRestorationMetrics(restorationRaw),
      };
      cityStoryNarrative = selectNarrative(metrics);
    } catch {
      // Restoration data unavailable - skip CityStory
    }
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

      {/* Page flow: hero (runway headline) -> CityStory (TL;DR
          synthesis - the visible anchor most visitors read first) ->
          live data block (catchment, reservoirs, history) ->
          UrbanSupplyOverview (structural depth: where the water
          actually comes from) -> other water sources -> long-term
          context -> news. */}

      {cityStoryNarrative && <CityStory narrative={cityStoryNarrative} aiNarrative={aiNarrative} />}

      {reservoirCatchmentContextRows && reservoirCatchmentContextRows.length > 0 ? (
        <ReservoirCatchmentContext rows={reservoirCatchmentContextRows} />
      ) : null}

      {/* Reservoir snapshot grid + shared multi-source chart. The chart
          accepts data in any storage unit; Chennai passes Mcft, Madurai
          passes TMC. Both render identical UI (per-source toggles,
          summed-total mode, drag-to-zoom, pinch-to-zoom, forecast band).
          Earlier this was a Chennai-specific DashboardContent +
          StorageTrendChart pair; replaced so both cities share the
          component. */}
      <ReservoirCards
        reservoirs={reservoirData.reservoirs.filter((r) =>
          (RESERVOIR_DISPLAY_ORDER as readonly string[]).includes(r.name)
        )}
      />
      <DashboardHistorySection
        cityId="chennai"
        cityDisplayName="Chennai"
        unit="Mcft"
      />

      {/* Structural at-a-glance tile: source mix across CMWSSB's 5 WTPs +
          3 DSPs, distribution scale (5,247 km), demand projections to
          2057, and the proposed Ring Main System. Sits AFTER the live
          data so it reads as the structural explainer for the numbers
          above. The component fetches /data/chennai-supply-overview.json
          client-side and self-hides if missing. Toggle/tab UX between
          days-left and structural views is a planned follow-up. */}
      <UrbanSupplyOverview cityId="chennai" cityDisplayName="Chennai" />

      {groundwaterData && <GroundwaterSnapshot data={groundwaterData} />}

      <DeferredRainfallTrends />

      <NewsSection />
    </div>
  );
}

import { readFile } from "fs/promises";
import { join } from "path";
import Link from "next/link";

import { CityHeaderBadges } from "@/components/dashboard/city-header-badges";
import { getPlaceConfig } from "@/lib/cities";
import type { PlaceConfig } from "@/lib/cities";
import {
  loadCitySnapshot,
  loadCityWaterEstimate,
  snapshotToSummaries,
} from "./data";
import { DaysLeftHero } from "@/components/dashboard/days-left-hero";
import { AllocationHero } from "@/components/dashboard/allocation-hero";
import { CauveryPumpingHero } from "@/components/dashboard/cauvery-pumping-hero";
import { BangaloreDailyBriefing } from "@/components/dashboard/bangalore-daily-briefing";
import { buildBangaloreBriefing } from "@/lib/insights/bangalore-briefing";
import { DataGapPanel, URBAN_SUPPLY_DATA_GAPS } from "@/components/dashboard/data-gap-panel";
import { UrbanSupplyOverview } from "@/components/dashboard/urban-supply-overview";
import { RegionalWaterSystem } from "@/components/dashboard/regional-water-system";
import { DashboardHistorySection } from "@/components/dashboard/dashboard-history-section";
import { DeferredRainfallTrends } from "@/components/dashboard/deferred-rainfall-trends";
import { ReservoirCards } from "@/components/dashboard/reservoir-cards";
import { ReservoirCatchmentContext } from "@/components/dashboard/reservoir-catchment-context";
import { GroundwaterSnapshot } from "@/components/dashboard/groundwater-snapshot";
import { WeapBalanceTile } from "@/components/dashboard/weap-balance-tile";
import { DemoDashboard } from "@/components/dashboard/demo-dashboard";
import { CityStory } from "@/components/insights/city-story";
import type { AiNarrative } from "@/components/insights/city-story";
import { NewsSection } from "@/components/insights/news-section";
import { getGroundwaterStatus } from "@/types/groundwater";
import type { GroundwaterApiResponse } from "@/types/groundwater";
import type { ChennaiReservoirName } from "@/types/reservoir";
import type { ReservoirCatchmentContextRow } from "@/lib/gee/reservoir-context";
import {
  deriveReservoirMetrics,
  deriveGroundwaterMetrics,
  deriveRestorationMetrics,
} from "@/lib/insights/derive-metrics";
import { selectNarrative } from "@/lib/insights/select-narrative";
import { restorationPriorityFile, wardNamesFile } from "@/lib/cities/data-paths";
import { formatDate } from "@/lib/utils/format";

function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// ---------------------------------------------------------------------------
// Optional dashboard sections (flag-gated, not cityId-gated).
//
// The three loaders below currently assume single-tenant tables (daily_briefing,
// groundwater_monthly, reservoir_catchment_context have no city_id column) that
// only Chennai populates today. They are invoked solely when the matching
// config.dashboard flag is set; per-city parametrization of these tables is a
// pending follow-up tracked in docs/specs/multi-city-component-discipline.md.
// ---------------------------------------------------------------------------

async function getAiNarrative(): Promise<AiNarrative | null> {
  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  // Scope to today's briefing (IST) so stale AI narratives trigger template fallback
  const todayIST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  const { data } = await supabase
    .from("daily_briefing")
    .select(
      "briefing_date, ai_headline_en, ai_headline_ta, ai_body_en, ai_body_ta, ai_source_dates, ai_model",
    )
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

async function getReservoirCatchmentContextRows(): Promise<
  ReservoirCatchmentContextRow[] | null
> {
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

async function getGroundwaterData(
  cityId: string,
): Promise<GroundwaterApiResponse | null> {
  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  // Canonical ward zone names for this city (Chennai: ward-names.json).
  let canonicalNames = new Map<number, string>();
  try {
    const wardNamesPath = join(process.cwd(), "public/data", wardNamesFile(cityId));
    const wardRows = JSON.parse(await readFile(wardNamesPath, "utf-8")) as {
      ward_number: number;
      zone_name: string;
    }[];
    canonicalNames = new Map(wardRows.map((w) => [w.ward_number, `Ward ${w.ward_number}`]));
  } catch {
    // No ward-names file for this city; fall back to per-row ward names.
  }

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

  const prevYearMap = new Map(
    prevYearData?.map(
      (r: { ward_number: number; depth_to_water_m: number }) => [
        r.ward_number,
        r.depth_to_water_m,
      ],
    ) || [],
  );

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
      wardName:
        canonicalNames.get(r.ward_number as number) ||
        (r.ward_name as string) ||
        `Ward ${r.ward_number}`,
      wardNameTa: (r.ward_name_ta as string) || (r.ward_name_tamil as string) || undefined,
      zone: (r.zone_name as string) || "",
      depthM: r.depth_to_water_m as number,
      trend,
    };
  });

  const summary = {
    healthy: 0,
    moderate: 0,
    declining: 0,
    stressed: 0,
    critical: 0,
    crisis: 0,
    noData: 0,
  };
  for (const w of wards) {
    summary[getGroundwaterStatus(w.depthM)]++;
  }

  const withData = wards.filter((w: { depthM: number | null }) => w.depthM !== null);
  const cityAverage =
    withData.length > 0
      ? parseFloat(
          (
            withData.reduce((sum: number, w: { depthM: number }) => sum + w.depthM, 0) /
            withData.length
          ).toFixed(1),
        )
      : null;

  return { period: { year, month }, cityAverage, wards, summary };
}

/**
 * Compute the CityStory narrative (template + optional AI overlay) for cities
 * whose dashboard.aiBriefing flag is set. Returns null when the restoration
 * priority data is unavailable, in which case CityStory is skipped.
 */
async function buildCityStoryNarrative(
  config: PlaceConfig,
  waterEstimate: { totalStorageMcft: number; totalCapacityMcft: number; lastUpdated: string | null },
  groundwaterData: GroundwaterApiResponse | null,
) {
  if (!groundwaterData || !waterEstimate.lastUpdated) return null;
  try {
    const restorationPath = join(
      process.cwd(),
      "public",
      "data",
      restorationPriorityFile(config.cityId),
    );
    const restorationRaw = JSON.parse(await readFile(restorationPath, "utf-8"));

    const metrics = {
      reservoir: deriveReservoirMetrics(
        waterEstimate.totalStorageMcft,
        waterEstimate.totalCapacityMcft,
        waterEstimate.lastUpdated,
      ),
      groundwater: deriveGroundwaterMetrics(groundwaterData),
      restoration: deriveRestorationMetrics(restorationRaw),
    };
    return selectNarrative(metrics);
  } catch {
    // Restoration data unavailable - skip CityStory.
    return null;
  }
}

export async function CityDashboard({ cityId }: { cityId: string }) {
  // The layout has already validated cityId and redirected /chennai; we can
  // safely look up the config here.
  const config = getPlaceConfig(cityId);
  const isLegacy = config.reservoirDataSource === "legacy-v1";

  // Legacy-v1 cities (Chennai) keep the demo-mode fallback: when Supabase is
  // unconfigured the page renders the scenario-switcher demo dashboard instead
  // of an empty page. v2 cities never hit this path.
  if (isLegacy && !isSupabaseConfigured()) {
    return <DemoDashboard />;
  }

  const [snapshot, waterEstimate] = await Promise.all([
    loadCitySnapshot(config),
    loadCityWaterEstimate(config),
  ]);

  // For legacy-v1 cities, no reservoir reading (e.g. Supabase connection failed)
  // falls back to demo mode, preserving Chennai's prior behaviour.
  if (isLegacy && !waterEstimate.lastUpdated) {
    return <DemoDashboard />;
  }

  // Compute the preview pill semantically.
  // The "PREVIEW - waiting for first daily ingestion" pill is meaningful only
  // for cities that drink directly from a tracked reservoir. Bangalore tracks
  // 4 upstream Cauvery reservoirs as basin context but none are primary
  // drinking sources (BWSSB lifts treated water 100 km from T.K. Halli), so
  // "waiting for ingestion" would misrepresent the data model. Only consider
  // a city "in preview" if it has a primary source configured AND that
  // source's reading is missing.
  const hasPrimaryDrinkingSource = config.waterSources.some(
    (s) => s.isPrimaryDrinkingSource,
  );
  const reservoirIsLive = !hasPrimaryDrinkingSource || snapshot.reservoirIsLive;

  // Convert the per-city snapshot into the shared ReservoirSummary[]
  // shape Chennai's ReservoirCards consumes.
  const summaries = snapshotToSummaries(config, snapshot);

  // Optional flag-gated sections (Chennai today). The loaders assume
  // single-tenant tables; gate strictly on the config flags so other cities
  // never query tables they don't populate.
  const [aiNarrative, groundwaterData, reservoirCatchmentContextRows] =
    await Promise.all([
      config.dashboard?.aiBriefing ? getAiNarrative() : Promise.resolve(null),
      config.dashboard?.groundwaterSnapshot
        ? getGroundwaterData(cityId)
        : Promise.resolve(null),
      config.dashboard?.reservoirCatchmentContext
        ? getReservoirCatchmentContextRows()
        : Promise.resolve(null),
    ]);

  const cityStoryNarrative = config.dashboard?.aiBriefing
    ? await buildCityStoryNarrative(config, waterEstimate, groundwaterData)
    : null;

  // Bengaluru-specific daily briefing - template-based for V1, with an
  // open slot for a later Claude-pipeline AI uplift. Renders just below
  // the city badge row, above the Cauvery Pumping hero.
  const bangaloreBriefing =
    cityId === "bangalore"
      ? buildBangaloreBriefing(
          summaries,
          waterEstimate.lastUpdated ? formatDate(waterEstimate.lastUpdated) : null,
        )
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <CityHeaderBadges
        displayName={config.displayName}
        stateCode={config.stateCode}
        preview={!reservoirIsLive}
      />

      {/* Hero swap: cities whose tracked sources ARE the urban supply
          (Chennai's CMWSSB reservoirs) get the days-left runway; cities
          where tracked storage is upstream irrigation (Madurai's Vaigai)
          get the allocation hero, which shows live dam fill + the city's
          published drinking-water allocation without the misleading
          days-of-water headline. heroMode defaults to 'days-left' for
          back-compat. */}
      {(config.heroMode ?? "days-left") === "days-left" && waterEstimate.lastUpdated && (
        <DaysLeftHero
          totalStorageMcft={waterEstimate.totalStorageMcft}
          totalCapacityMcft={waterEstimate.totalCapacityMcft}
          recentAvgInflowMcftPerDay={waterEstimate.recentAvgInflowMcftPerDay}
          seasonalAvgInflowMcftPerDay={waterEstimate.seasonalAvgInflowMcftPerDay}
          lastUpdated={formatDate(waterEstimate.lastUpdated)}
          comparisonStorage={waterEstimate.comparisonStorage}
          comparisonYear={waterEstimate.comparisonYear}
          comparisonIsApprox={waterEstimate.comparisonIsApprox}
          observedTrendMcftPerDay={waterEstimate.observedTrendMcftPerDay}
          defaultConsumptionMld={config.defaultConsumptionMld ?? undefined}
          // null in the city config means "this city has no desalination" -
          // pass 0 so DaysLeftHero doesn't fall back to Chennai's 190 MLD.
          defaultDesalinationMld={config.defaultDesalinationMld ?? 0}
          runwaySource={config.runwaySource}
          scopeLabel={config.dashboardScopes?.city}
          heroNote={config.heroNote}
          heroNoteSource={config.heroNoteSource}
        />
      )}
      {bangaloreBriefing && <BangaloreDailyBriefing briefing={bangaloreBriefing} />}
      {config.heroMode === "cauvery-pumping" && (
        <CauveryPumpingHero cityId={cityId} cityDisplayName={config.displayName} />
      )}
      {config.heroMode === "allocation" && config.urbanSupply && (
        <AllocationHero
          cityDisplayName={config.displayName}
          supply={config.urbanSupply}
          sources={config.urbanSupply.allocatedSourceCodes
            .map((code) => {
              const r = summaries.find((s) => s.name === code);
              const source = config.waterSources.find((s) => s.sourceCode === code);
              if (!r || !source) return null;
              return {
                sourceCode: code,
                displayName: r.displayName,
                liveStorageMcft: r.isLive === false ? null : r.currentStorage,
                capacityMcft: source.fullCapacityMcft ?? 0,
                storagePct: r.isLive === false ? null : r.storagePct,
                lastUpdated: waterEstimate.lastUpdated
                  ? formatDate(waterEstimate.lastUpdated)
                  : null,
              };
            })
            .filter((x): x is NonNullable<typeof x> => x != null)}
        />
      )}

      {/* Page flow for cities with the synthesized briefing (Chennai today):
          hero (runway headline) -> CityStory (TL;DR synthesis, the visible
          anchor most visitors read first) -> live data block (catchment,
          reservoirs, history). */}
      {config.dashboard?.aiBriefing && cityStoryNarrative && (
        <CityStory narrative={cityStoryNarrative} aiNarrative={aiNarrative} hrefPrefix={`/${cityId}`} />
      )}

      {config.dashboard?.reservoirCatchmentContext &&
        reservoirCatchmentContextRows &&
        reservoirCatchmentContextRows.length > 0 && (
          <ReservoirCatchmentContext rows={reservoirCatchmentContextRows} />
        )}

      {/* Region places (the MMR): the metropolitan water-system view -
          per-corporation supply/demand + LPCD inequality + augmentation
          pipeline. Sits below the days-left hero (which is Greater Mumbai's
          BMC slice). No-op for single-city places. */}
      {config.placeKind === "region" && <RegionalWaterSystem cityId={cityId} />}

      {/* Structural at-a-glance tile - sits below whichever hero
          the city uses (days-left for Chennai, allocation for
          Madurai). The component self-hides if the city has no
          <cityId>-supply-overview.json, so cities without a
          published engineering document don't render an empty card. */}
      <UrbanSupplyOverview cityId={cityId} cityDisplayName={config.displayName} />

      {/* Reservoir snapshot grid + shared multi-source history chart. */}
      <ReservoirCards reservoirs={summaries} />

      <DashboardHistorySection
        cityId={cityId}
        cityDisplayName={config.displayName}
        unit={config.historyUnit ?? "TMC"}
      />

      {config.dashboard?.groundwaterSnapshot && groundwaterData && (
        <GroundwaterSnapshot data={groundwaterData} />
      )}

      {/* Basin water-balance tile (WEAP). Static figures; deep-links to the
          sub-basin climate-risk surface. */}
      {config.dashboard?.weapBalance && <WeapBalanceTile cityId={cityId} />}

      {/* Long-term IMD rainfall - identical component to Chennai's, with
          the city's own IMD file. Falls back to a "data pending" card
          when the city's rainfall file hasn't been generated yet. */}
      <DeferredRainfallTrends cityId={cityId} cityDisplayName={config.displayName} />

      {/* Google-News quick-link, seeded with the city name. */}
      <NewsSection cityDisplayName={config.displayName} />

      {/* Data-gap panel: shown for cities where the utility doesn't
          publish daily downstream-of-dam data. Placed near the end of
          the dashboard so it reads as "we've shown all our cards;
          here's what's still missing" rather than interrupting the
          live-data flow mid-page. */}
      {config.heroMode === "allocation" && (
        <DataGapPanel
          titleKey="gap.title_madurai"
          bodyKey="gap.body_madurai"
          gaps={URBAN_SUPPLY_DATA_GAPS}
          cta={{ labelKey: "gap.cta_about", href: `/${cityId}/about` }}
        />
      )}

      {/* Per-feature deep-dive nav. Tanker-market card only appears for
          cities that have a tanker-survey JSON (Bangalore today). */}
      <div
        className={`grid grid-cols-1 ${config.heroMode === "cauvery-pumping" ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-3`}
      >
        <Link
          href={`/${cityId}/groundwater`}
          className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Groundwater
            </h3>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            CGWB block exploitation, ward depth (interpolated), live WRIS station overlay.
          </p>
        </Link>
        <Link
          href={`/${cityId}/water-bodies`}
          className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Water bodies
            </h3>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            OSM polygons, flagship tanks, restoration priority badges, lost-tank inventory.
          </p>
        </Link>
        {config.heroMode === "cauvery-pumping" && (
          <Link
            href={`/${cityId}/tanker`}
            className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Tanker market
              </h3>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              What households actually pay - longitudinal OpenCity surveys (2015 / 2019 / 2024).
            </p>
          </Link>
        )}
        <Link
          href={`/${cityId}/about`}
          className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              About this dashboard
            </h3>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Methodology, data sources, water sources tracked, and the data
            gaps we&apos;re honest about.
          </p>
        </Link>
      </div>

      {/* Footer methodology */}
      <div className="text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
        <p>
          <span className="font-semibold">Methodology:</span> Reservoir
          levels for {config.displayName} from {config.primaryAuthority.acronym}.
          Daily consumption assumptions (~{config.defaultConsumptionMld ?? "-"} MLD demand) are starting
          points; the sliders above let you substitute your own. See the
          <Link href={`/${cityId}/about`} className="text-blue-600 dark:text-blue-400 hover:underline mx-1">
            About page
          </Link>
          for the full data-source index and methodology.
        </p>
      </div>
    </div>
  );
}

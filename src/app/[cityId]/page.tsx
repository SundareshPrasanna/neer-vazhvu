import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getPlaceConfig } from "@/lib/cities";
import {
  loadCitySnapshot,
  loadCityWaterEstimate,
  snapshotToSummaries,
} from "./data";
import { DaysLeftHero } from "@/components/dashboard/days-left-hero";
import { AllocationHero } from "@/components/dashboard/allocation-hero";
import { CauveryPumpingHero } from "@/components/dashboard/cauvery-pumping-hero";
import { DataGapPanel, URBAN_SUPPLY_DATA_GAPS } from "@/components/dashboard/data-gap-panel";
import { UrbanSupplyOverview } from "@/components/dashboard/urban-supply-overview";
import { DashboardHistorySection } from "@/components/dashboard/dashboard-history-section";
import { DeferredRainfallTrends } from "@/components/dashboard/deferred-rainfall-trends";
import { ReservoirCards } from "@/components/dashboard/reservoir-cards";
import { NewsSection } from "@/components/insights/news-section";
import { formatDate } from "@/lib/utils/format";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

// Re-fetch every 15 minutes (matches /api/reservoir cache TTL).
export const revalidate = 900;

export default async function CityHomePage({ params }: PageProps) {
  const { cityId } = await params;
  // The layout has already validated cityId and redirected /chennai; we can
  // safely look up the config here.
  const config = getPlaceConfig(cityId);
  const [snapshot, waterEstimate] = await Promise.all([
    loadCitySnapshot(config),
    loadCityWaterEstimate(config),
  ]);
  const reservoirIsLive = snapshot.reservoirIsLive;

  // Convert the per-city snapshot into the shared ReservoirSummary[]
  // shape Chennai's ReservoirCards consumes.
  const summaries = snapshotToSummaries(config, snapshot);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {config.displayName} · {config.stateCode}
        </Badge>
        {!reservoirIsLive && (
          <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            PREVIEW · waiting for first daily ingestion
          </Badge>
        )}
      </div>

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
          comparison2019Storage={waterEstimate.comparison2019Storage}
          defaultConsumptionMld={config.defaultConsumptionMld ?? undefined}
          // null in the city config means "this city has no desalination" -
          // pass 0 so DaysLeftHero doesn't fall back to Chennai's 190 MLD.
          defaultDesalinationMld={config.defaultDesalinationMld ?? 0}
        />
      )}
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
        unit="TMC"
      />

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
      <div className={`grid grid-cols-1 ${config.heroMode === "cauvery-pumping" ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-3`}>
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
            className="block rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 p-4 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Tanker market
              </h3>
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
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

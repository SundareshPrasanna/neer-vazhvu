import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getPlaceConfig } from "@/lib/cities";
import {
  loadCitySnapshot,
  loadCityHistory,
  loadCityForecast,
  loadCityWaterEstimate,
  snapshotToSummaries,
} from "./data";
import { MultiSourceHistoryChart } from "@/components/dashboard/multi-source-history-chart";
import { DaysLeftHero } from "@/components/dashboard/days-left-hero";
import { RainfallTrends } from "@/components/dashboard/rainfall-trends";
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
  const [snapshot, history, forecast, waterEstimate] = await Promise.all([
    loadCitySnapshot(config),
    loadCityHistory(config),
    loadCityForecast(config),
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

      {/* Days-of-water-left hero. Shared with Chennai's home; defaults
          come from the place config (consumption, desalination). */}
      {waterEstimate.lastUpdated && (
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

      {/* Reservoir snapshot grid + shared multi-source history chart. */}
      <ReservoirCards reservoirs={summaries} />

      <MultiSourceHistoryChart
        cityDisplayName={config.displayName}
        unit="TMC"
        series={history.series}
        forecast={forecast.series}
        forecastDate={forecast.forecastDate}
        earliestDate={history.earliestDate}
        latestDate={history.latestDate}
        pointCount={history.pointCount}
      />

      {/* Long-term IMD rainfall - identical component to Chennai's, with
          the city's own IMD file. Falls back to a "data pending" card
          when the city's rainfall file hasn't been generated yet. */}
      <RainfallTrends cityId={cityId} />

      {/* Google-News quick-link, seeded with the city name. */}
      <NewsSection cityDisplayName={config.displayName} />

      {/* Per-feature deep-dive nav. Same shape for every city; the routes
          themselves render the city's data. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

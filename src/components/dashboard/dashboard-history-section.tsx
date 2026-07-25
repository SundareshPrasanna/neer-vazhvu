"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ForecastSeries, HistorySeries } from "@/types/reservoir";
import { tryGetPlaceConfig } from "@/lib/cities";

interface DashboardHistoryPayload {
  earliestDate: string | null;
  latestDate: string | null;
  pointCount: number;
  series: HistorySeries[];
  forecast: ForecastSeries[];
  forecastDate: string | null;
}

interface DashboardHistorySectionProps {
  cityId: string;
  cityDisplayName: string;
  unit?: string;
}

interface LoadState {
  cityId: string;
  payload: DashboardHistoryPayload | null;
  error: boolean;
}

const MultiSourceHistoryChart = dynamic(
  () =>
    import("./multi-source-history-chart").then(
      (mod) => mod.MultiSourceHistoryChart,
    ),
  {
    ssr: false,
    loading: () => <HistoryChartSkeleton />,
  },
);

function HistoryChartSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4 bg-white dark:bg-slate-900/30">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-3 w-36" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-16" />
      </div>
      <Skeleton className="h-[300px] w-full" />
    </div>
  );
}

function HistoryChartMessage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-4 text-sm text-slate-700 dark:text-slate-300">
      <div className="font-semibold text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wider mb-1">
        {title}
      </div>
      <p>{children}</p>
    </div>
  );
}

export function DashboardHistorySection({
  cityId,
  cityDisplayName,
  unit = "TMC",
}: DashboardHistorySectionProps) {
  const [state, setState] = useState<LoadState>({
    cityId,
    payload: null,
    error: false,
  });

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/reservoir/history?cityId=${encodeURIComponent(cityId)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok && response.status !== 404) {
          throw new Error("Failed to load reservoir history");
        }
        return response.json() as Promise<DashboardHistoryPayload>;
      })
      .then((data) => {
        setState({ cityId, payload: data, error: false });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({ cityId, payload: null, error: true });
      });

    return () => controller.abort();
  }, [cityId]);

  if (state.cityId !== cityId) return <HistoryChartSkeleton />;

  if (state.error) {
    return (
      <HistoryChartMessage title="Reservoir history unavailable">
        The live snapshot loaded, but the historical chart could not be
        fetched. Try refreshing once the data endpoint is reachable.
      </HistoryChartMessage>
    );
  }

  if (!state.payload) return <HistoryChartSkeleton />;

  return (
    <MultiSourceHistoryChart
      cityDisplayName={cityDisplayName}
      coverageNote={tryGetPlaceConfig(cityId)?.reservoirHistoryNote}
      scopeLabel={tryGetPlaceConfig(cityId)?.dashboardScopes?.city}
      defaultTab={tryGetPlaceConfig(cityId)?.reservoirHistoryDefaultRange}
      noPublicFeed={
        tryGetPlaceConfig(cityId)?.waterSources.every(
          (s) => s.hasPublicFeed === false,
        ) ?? false
      }
      unit={unit}
      series={state.payload.series}
      forecast={state.payload.forecast}
      forecastDate={state.payload.forecastDate}
      earliestDate={state.payload.earliestDate}
      latestDate={state.payload.latestDate}
      pointCount={state.payload.pointCount}
    />
  );
}

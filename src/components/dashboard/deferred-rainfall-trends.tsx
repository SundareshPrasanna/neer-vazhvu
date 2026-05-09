"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

interface DeferredRainfallTrendsProps {
  cityId?: string;
  cityDisplayName?: string;
}

const RainfallTrends = dynamic(
  () => import("./rainfall-trends").then((mod) => mod.RainfallTrends),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-6 space-y-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[180px] w-full" />
        <Skeleton className="h-[140px] w-full" />
      </div>
    ),
  },
);

export function DeferredRainfallTrends(props: DeferredRainfallTrendsProps) {
  return <RainfallTrends {...props} />;
}

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { GroundwaterApiResponse } from "@/types/groundwater";

interface GroundwaterSnapshotProps {
  data: GroundwaterApiResponse;
}

const STATUS_COLORS = {
  healthy: "bg-green-500",
  moderate: "bg-lime-500",
  declining: "bg-yellow-500",
  stressed: "bg-orange-500",
  critical: "bg-red-500",
  crisis: "bg-red-900",
} as const;

export function GroundwaterSnapshot({ data }: GroundwaterSnapshotProps) {
  const { summary, cityAverage, wards } = data;
  const totalWards = Object.values(summary).reduce((a, b) => a + b, 0);

  // Find extremes
  const wardsWithData = wards.filter((w) => w.depthM !== null);
  const healthiest = wardsWithData.reduce(
    (best, w) => (!best || w.depthM! < best.depthM! ? w : best),
    null as (typeof wards)[0] | null
  );
  const mostStressed = wardsWithData.reduce(
    (worst, w) => (!worst || w.depthM! > worst.depthM! ? w : worst),
    null as (typeof wards)[0] | null
  );

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Groundwater Health
          </h2>
          <Link
            href="/groundwater"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1"
          >
            Explore map
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Stats */}
          <div className="space-y-3">
            {cityAverage !== null && (
              <div>
                <div className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                  {cityAverage.toFixed(1)}m
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">city average depth to water table</div>
              </div>
            )}

            {healthiest && (
              <div className="text-sm">
                <span className="text-green-600 font-medium">Healthiest:</span>{" "}
                {healthiest.wardName} ({healthiest.depthM!.toFixed(1)}m)
              </div>
            )}

            {mostStressed && (
              <div className="text-sm">
                <span className="text-red-600 font-medium">Most stressed:</span>{" "}
                {mostStressed.wardName} ({mostStressed.depthM!.toFixed(1)}m)
              </div>
            )}
          </div>

          {/* Ward status distribution bar */}
          <div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Ward distribution ({totalWards} wards)
            </div>

            {/* Stacked bar */}
            <div className="w-full h-6 rounded-full overflow-hidden flex">
              {(Object.entries(STATUS_COLORS) as [keyof typeof STATUS_COLORS, string][]).map(
                ([status, color]) => {
                  const count = summary[status];
                  if (count === 0) return null;
                  const widthPct = (count / totalWards) * 100;
                  return (
                    <div
                      key={status}
                      className={`${color} h-full`}
                      style={{ width: `${widthPct}%` }}
                      title={`${status}: ${count} wards`}
                    />
                  );
                }
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-600 dark:text-slate-400">
              {summary.healthy > 0 && (
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
                  {summary.healthy} healthy
                </span>
              )}
              {summary.moderate > 0 && (
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-lime-500 mr-1" />
                  {summary.moderate} moderate
                </span>
              )}
              {summary.stressed > 0 && (
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1" />
                  {summary.stressed} stressed
                </span>
              )}
              {summary.critical + summary.crisis > 0 && (
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
                  {summary.critical + summary.crisis} critical
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { QUALITY_COLORS, QUALITY_LABELS } from "@/types/river-quality";
import type { RiverQualityStatus } from "@/types/river-quality";

const LEGEND_ITEMS: RiverQualityStatus[] = [
  "dead",
  "severely_degraded",
  "degraded",
  "stressed",
  "healthy",
];

export function RiversLegend() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
        Water Quality
      </p>
      <div className="flex flex-col gap-1">
        {LEGEND_ITEMS.map((status) => (
          <div key={status} className="flex items-center gap-2">
            <span
              className="w-6 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: QUALITY_COLORS[status] }}
            />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {QUALITY_LABELS[status]}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-slate-400 bg-white dark:bg-slate-600 flex-shrink-0" />
          <span className="text-xs text-slate-500 dark:text-slate-500">
            Monitoring station
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { TREND_COLORS, TREND_LABELS, type CoastalTrend } from "@/types/coastal";

const ORDER: CoastalTrend[] = ["erosion", "accretion", "mixed", "stable"];

export function CoastalLegend() {
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-lg shadow-md border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs">
      <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
        Shoreline trend (1990-2024)
      </div>
      <div className="space-y-1">
        {ORDER.map((trend) => (
          <div key={trend} className="flex items-center gap-2">
            <span className="w-4 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TREND_COLORS[trend] }} />
            <span className="text-slate-600 dark:text-slate-400">{TREND_LABELS[trend]}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 mt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0 border-2 border-white dark:border-slate-900" />
          <span className="text-slate-600 dark:text-slate-400">Named hotspot (sized by rate)</span>
        </div>
      </div>
    </div>
  );
}

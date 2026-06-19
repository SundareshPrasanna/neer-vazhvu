"use client";

import { rateColor } from "@/types/coastal";

const RATE_STOPS = [-8, -3, -1, 0, 1, 3, 8];

export function CoastalLegend() {
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-lg shadow-md border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs">
      <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
        Shoreline change rate (m/yr)
      </div>
      <div className="flex items-center gap-0.5">
        {RATE_STOPS.map((r) => (
          <span key={r} className="w-5 h-3 first:rounded-l last:rounded-r" style={{ backgroundColor: rateColor(r) }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
        <span>erosion</span>
        <span>0</span>
        <span>accretion</span>
      </div>
      <div className="space-y-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 rounded-full shrink-0 bg-slate-400" />
          <span className="text-slate-500 dark:text-slate-400">Study zone (context)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0 border-2 border-white dark:border-slate-900" />
          <span className="text-slate-500 dark:text-slate-400">Study hotspot (labelled)</span>
        </div>
      </div>
      <div className="text-[10px] text-slate-400 mt-1.5">Dots = our measurement - 1990-2026</div>
    </div>
  );
}

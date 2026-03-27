"use client";

import {
  SOURCE_TYPE_COLORS,
  SOURCE_TYPE_LABELS,
} from "@/types/industrial-pollution";
import type { PollutionSourceType } from "@/types/industrial-pollution";

const LEGEND_ITEMS: PollutionSourceType[] = [
  "thermal_power",
  "petrochemical",
  "chemical",
  "port",
  "industrial_estate",
  "discharge_zone",
];

export function PollutionLegend() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
        Pollution Sources
      </p>
      <div className="flex flex-col gap-1">
        {LEGEND_ITEMS.map((type) => (
          <div key={type} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full border-2 border-white dark:border-slate-600 flex-shrink-0 shadow-sm"
              style={{ backgroundColor: SOURCE_TYPE_COLORS[type] }}
            />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {SOURCE_TYPE_LABELS[type]}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-3 rounded flex-shrink-0 border border-dashed"
            style={{
              backgroundColor: "rgba(249,115,22,0.12)",
              borderColor: "#f97316",
            }}
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Industrial zone
          </span>
        </div>
      </div>
    </div>
  );
}

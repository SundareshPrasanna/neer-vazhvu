"use client";

import { useState } from "react";
import { QUALITY_COLORS } from "@/types/river-quality";
import type { RiverQualityStatus } from "@/types/river-quality";
import { SOURCE_TYPE_COLORS } from "@/types/industrial-pollution";
import type { PollutionSourceType } from "@/types/industrial-pollution";
import { useLanguage } from "@/lib/i18n/context";

const QUALITY_ITEMS: RiverQualityStatus[] = [
  "dead",
  "severely_degraded",
  "degraded",
  "stressed",
  "healthy",
];

/** Statuses actually present in Chennai river data */
const ACTIVE_STATUSES = new Set<RiverQualityStatus>(["dead", "severely_degraded", "degraded"]);

const SOURCE_ITEMS: PollutionSourceType[] = [
  "thermal_power",
  "petrochemical",
  "chemical",
  "port",
  "industrial_estate",
  "discharge_zone",
];

interface RiversLegendProps {
  hiddenCategories?: Set<string>;
  onToggleCategory?: (category: string) => void;
}

export function RiversLegend({ hiddenCategories, onToggleCategory }: RiversLegendProps = {}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
      {/* Tap header to toggle on mobile */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full"
      >
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {t("rivers_legend.water_quality")}
        </p>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className={`${expanded ? "block" : "hidden"} mt-1.5 space-y-2`}>
        {/* Water quality section */}
        <div className="flex flex-col gap-1">
          {QUALITY_ITEMS.map((status) => {
            const active = ACTIVE_STATUSES.has(status);
            const hidden = hiddenCategories?.has(status) ?? false;
            return (
              <button
                key={status}
                onClick={() => onToggleCategory?.(status)}
                className={`flex items-center gap-2 whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : active ? "" : "opacity-35"} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
              >
                <span
                  className="w-6 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: QUALITY_COLORS[status] }}
                />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {t(`rivers_legend.${status}`)}
                </span>
              </button>
            );
          })}
        </div>
        {(() => {
          const hidden = hiddenCategories?.has("station") ?? false;
          return (
            <button
              onClick={() => onToggleCategory?.("station")}
              className={`flex items-center gap-2 whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
            >
              <span className="w-3 h-3 rounded-full border-2 border-slate-400 bg-white dark:bg-slate-600 flex-shrink-0" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t("rivers_legend.monitoring_station")}
              </span>
            </button>
          );
        })()}

        {(() => {
          const hidden = hiddenCategories?.has("sewage_inlet") ?? false;
          return (
            <button
              onClick={() => onToggleCategory?.("sewage_inlet")}
              className={`flex items-center gap-2 w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
            >
              <span className="flex items-center gap-0.5 flex-shrink-0 w-6 justify-center">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#92400e" }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#92400e" }} />
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t("rivers_legend.sewage_inlet")}
              </span>
            </button>
          );
        })()}

        {/* Divider */}
        <div className="border-t border-slate-100 dark:border-slate-700" />

        {/* Pollution sources section */}
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t("rivers_legend.pollution_sources")}
          </p>
          <div className="flex flex-col gap-1">
            {SOURCE_ITEMS.map((type) => {
              const hidden = hiddenCategories?.has(`source_${type}`) ?? false;
              return (
                <button
                  key={type}
                  onClick={() => onToggleCategory?.(`source_${type}`)}
                  className={`flex items-center gap-2 whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
                >
                  <span
                    className="w-3 h-3 rounded-full border-2 border-white dark:border-slate-600 flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: SOURCE_TYPE_COLORS[type] }}
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    {t(`rivers_legend.${type}`)}
                  </span>
                </button>
              );
            })}
          </div>
          {(() => {
            const hidden = hiddenCategories?.has("industrial_zone") ?? false;
            return (
              <button
                onClick={() => onToggleCategory?.("industrial_zone")}
                className={`mt-1.5 flex items-center gap-2 w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
              >
                <span
                  className="w-6 h-3 rounded flex-shrink-0 border border-dashed"
                  style={{
                    backgroundColor: "rgba(249,115,22,0.10)",
                    borderColor: "#f97316",
                  }}
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("rivers_legend.industrial_zone")}
                </span>
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

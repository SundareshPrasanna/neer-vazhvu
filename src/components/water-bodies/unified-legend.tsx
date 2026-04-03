"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { getPriorityColor } from "@/types/restoration";
import type { PriorityLevel } from "@/types/restoration";
import type { ViewMode } from "./view-mode-toggle";

const WB_LEGEND_DEFS = [
  { id: "existing",         color: "#3b82f6", labelKey: "wb_legend.existing",         descKey: "wb_legend.surviving" },
  { id: "fully_lost",       color: "#dc2626", labelKey: "wb_legend.fully_lost",       descKey: "wb_legend.fully_lost_desc" },
  { id: "severely_reduced", color: "#f97316", labelKey: "wb_legend.severely_reduced", descKey: "wb_legend.severely_reduced_desc" },
  { id: "encroached",       color: "#eab308", labelKey: "wb_legend.encroached",       descKey: "wb_legend.encroached_desc" },
  { id: "census_healthy",   color: "#10b981", labelKey: "wb_legend.census_healthy",   descKey: "wb_legend.census_healthy_desc" },
  { id: "census_encroached", color: "#ef4444", labelKey: "wb_legend.census_encroached", descKey: "wb_legend.census_encroached_desc" },
  { id: "census_degraded",  color: "#f97316", labelKey: "wb_legend.census_degraded",  descKey: "wb_legend.census_degraded_desc" },
] as const;

const PRIORITY_ITEMS: Array<{ level: PriorityLevel; labelKey: string }> = [
  { level: "critical", labelKey: "lr.critical" },
  { level: "high",     labelKey: "lr.high" },
  { level: "moderate", labelKey: "lr.moderate" },
  { level: "low",      labelKey: "lr.low" },
];

interface UnifiedLegendProps {
  viewMode: ViewMode;
  hiddenCategories?: Set<string>;
  onToggleCategory?: (category: string) => void;
}

export function UnifiedLegend({ viewMode, hiddenCategories, onToggleCategory }: UnifiedLegendProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full"
      >
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
          {viewMode === "water-bodies" ? t("wb_legend.title") : t("lr.priority_level")}
        </h4>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`${expanded ? "block" : "hidden"} mt-2 space-y-1`}>
        {viewMode === "water-bodies"
          ? WB_LEGEND_DEFS.map((item) => {
              const hidden = hiddenCategories?.has(item.id) ?? false;
              return (
                <button
                  key={item.id}
                  onClick={() => onToggleCategory?.(item.id)}
                  className={`flex items-center gap-2 text-xs whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
                >
                  <span
                    className="w-4 h-3 rounded-sm border flex-shrink-0"
                    style={{
                      backgroundColor: item.color + "80",
                      borderColor: item.color,
                    }}
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300 shrink-0">{t(item.labelKey)}</span>
                  <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">{t(item.descKey)}</span>
                </button>
              );
            })
          : PRIORITY_ITEMS.map((item) => {
              const hidden = hiddenCategories?.has(item.level) ?? false;
              return (
                <button
                  key={item.level}
                  onClick={() => onToggleCategory?.(item.level)}
                  className={`flex items-center gap-2 text-xs whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
                >
                  <span
                    className="w-4 h-3 rounded-sm border flex-shrink-0"
                    style={{
                      backgroundColor: getPriorityColor(item.level) + "80",
                      borderColor: getPriorityColor(item.level),
                    }}
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {t(item.labelKey)}
                  </span>
                </button>
              );
            })}
      </div>
    </div>
  );
}

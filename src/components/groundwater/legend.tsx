"use client";

import { useState } from "react";
import type { ViewMode } from "@/types/groundwater";
import { useLanguage } from "@/lib/i18n/context";

interface GroundwaterLegendProps {
  viewMode: ViewMode;
  hiddenCategories?: Set<string>;
  onToggleCategory?: (category: string) => void;
}

export function GroundwaterLegend({ viewMode, hiddenCategories, onToggleCategory }: GroundwaterLegendProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(true);

  const DEPTH_ITEMS = [
    { id: "healthy",  color: "#22c55e", label: "0-3m",   tKey: "gw.healthy" },
    { id: "moderate", color: "#84cc16", label: "3-6m",   tKey: "gw.moderate" },
    { id: "declining", color: "#eab308", label: "6-10m",  tKey: "gw.declining" },
    { id: "stressed", color: "#f97316", label: "10-15m", tKey: "gw.stressed" },
    { id: "critical", color: "#ef4444", label: "15-25m", tKey: "gw.critical" },
    { id: "crisis",   color: "#7f1d1d", label: ">25m",   tKey: "gw.crisis" },
    { id: "noData",   color: "#9ca3af", label: "-",      tKey: "gw.no_data_lc" },
  ];

  const RISK_ITEMS = [
    { id: "low",      color: "#22c55e", label: "0-25",   tKey: "legend.low_risk" },
    { id: "moderate", color: "#eab308", label: "26-50",  tKey: "legend.moderate_risk" },
    { id: "high",     color: "#f97316", label: "51-75",  tKey: "legend.high_risk" },
    { id: "critical", color: "#dc2626", label: "76-100", tKey: "gw.critical" },
    { id: "noData",   color: "#9ca3af", label: "-",      tKey: "gw.no_data_lc" },
  ];

  const EXPLOIT_ITEMS = [
    { id: "safe",             color: "#22c55e", label: "<70%",    tKey: "legend.safe" },
    { id: "semi_critical",    color: "#eab308", label: "70-90%",  tKey: "legend.semi_critical_lbl" },
    { id: "critical",         color: "#f97316", label: "90-100%", tKey: "legend.critical_lbl" },
    { id: "over_exploited",   color: "#dc2626", label: ">100%",   tKey: "legend.over_exploited" },
  ];

  const items = viewMode === "exploitation" ? EXPLOIT_ITEMS : viewMode === "risk" ? RISK_ITEMS : DEPTH_ITEMS;
  const title = viewMode === "exploitation" ? t("legend.exploit_title") : viewMode === "risk" ? t("legend.risk_title") : t("legend.depth_title");

  // "CGWB sensor status" sub-section only applies to the depth view where
  // WRIS station circle markers are overlaid. These are filterable so users
  // can hide suspect/old readings from the map.
  const WRIS_ITEMS = [
    {
      id: "wris_stuck",
      tKey: "legend.wris_stuck",
      // Amber dashed ring - matches the marker style in ward-map.tsx
      render: (
        <span
          className="w-4 h-4 rounded-full flex-shrink-0 border-2 border-dashed"
          style={{ borderColor: "#b45309", backgroundColor: "#94a3b8" }}
        />
      ),
    },
    {
      id: "wris_stale",
      tKey: "legend.wris_stale",
      render: (
        <span
          className="w-4 h-4 rounded-full flex-shrink-0 border"
          style={{ borderColor: "#475569", backgroundColor: "#94a3b8", opacity: 0.6 }}
        />
      ),
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full"
      >
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
          {title}
        </h4>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`${expanded ? "block" : "hidden"} mt-2 space-y-1`}>
        {items.map((item) => {
          const hidden = hiddenCategories?.has(item.id) ?? false;
          return (
            <button
              key={item.id}
              onClick={() => onToggleCategory?.(item.id)}
              className={`flex items-center gap-2 text-xs whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
            >
              <span className="w-4 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{item.label}</span>
              <span className="text-slate-500 dark:text-slate-400">{t(item.tKey)}</span>
            </button>
          );
        })}

        {viewMode === "depth" && (
          <>
            <div className="pt-2 mt-1 border-t border-slate-200 dark:border-slate-700">
              <h5 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                {t("legend.wris_status_title")}
              </h5>
            </div>
            {WRIS_ITEMS.map((item) => {
              const hidden = hiddenCategories?.has(item.id) ?? false;
              return (
                <button
                  key={item.id}
                  onClick={() => onToggleCategory?.(item.id)}
                  className={`flex items-center gap-2 text-xs whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
                  title={t(`${item.tKey}.tooltip`)}
                >
                  {item.render}
                  <span className="text-slate-500 dark:text-slate-400">
                    {t(item.tKey)}
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

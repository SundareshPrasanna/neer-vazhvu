"use client";

import { useState } from "react";
import type { ViewMode } from "@/types/groundwater";
import { useLanguage } from "@/lib/i18n/context";

interface GroundwaterLegendProps {
  viewMode: ViewMode;
}

export function GroundwaterLegend({ viewMode }: GroundwaterLegendProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const DEPTH_ITEMS = [
    { color: "#22c55e", label: "0-3m",   tKey: "gw.healthy" },
    { color: "#84cc16", label: "3-6m",   tKey: "gw.moderate" },
    { color: "#eab308", label: "6-10m",  tKey: "gw.declining" },
    { color: "#f97316", label: "10-15m", tKey: "gw.stressed" },
    { color: "#ef4444", label: "15-25m", tKey: "gw.critical" },
    { color: "#7f1d1d", label: ">25m",   tKey: "gw.crisis" },
    { color: "#9ca3af", label: "-",      tKey: "gw.no_data_lc" },
  ];

  const RISK_ITEMS = [
    { color: "#22c55e", label: "0-25",   tKey: "legend.low_risk" },
    { color: "#eab308", label: "26-50",  tKey: "legend.moderate_risk" },
    { color: "#f97316", label: "51-75",  tKey: "legend.high_risk" },
    { color: "#dc2626", label: "76-100", tKey: "gw.critical" },
    { color: "#9ca3af", label: "-",      tKey: "gw.no_data_lc" },
  ];

  const EXPLOIT_ITEMS = [
    { color: "#22c55e", label: "<70%",    tKey: "legend.safe" },
    { color: "#eab308", label: "70-90%",  tKey: "legend.semi_critical_lbl" },
    { color: "#f97316", label: "90-100%", tKey: "legend.critical_lbl" },
    { color: "#dc2626", label: ">100%",   tKey: "legend.over_exploited" },
  ];

  const items = viewMode === "exploitation" ? EXPLOIT_ITEMS : viewMode === "risk" ? RISK_ITEMS : DEPTH_ITEMS;
  const title = viewMode === "exploitation" ? t("legend.exploit_title") : viewMode === "risk" ? t("legend.risk_title") : t("legend.depth_title");

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full sm:pointer-events-none"
      >
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
          {title}
        </h4>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 sm:hidden transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`${expanded ? "block" : "hidden"} sm:block mt-2 space-y-1`}>
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs whitespace-nowrap">
            <span className="w-4 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{item.label}</span>
            <span className="text-slate-500 dark:text-slate-400">{t(item.tKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

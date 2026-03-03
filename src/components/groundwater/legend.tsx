"use client";

import type { ViewMode } from "@/types/groundwater";
import { useLanguage } from "@/lib/i18n/context";

interface GroundwaterLegendProps {
  viewMode: ViewMode;
}

export function GroundwaterLegend({ viewMode }: GroundwaterLegendProps) {
  const { t } = useLanguage();

  const DEPTH_ITEMS = [
    { color: "#22c55e", label: "0–3m",   tKey: "gw.healthy" },
    { color: "#84cc16", label: "3–6m",   tKey: "gw.moderate" },
    { color: "#eab308", label: "6–10m",  tKey: "gw.declining" },
    { color: "#f97316", label: "10–15m", tKey: "gw.stressed" },
    { color: "#ef4444", label: "15–25m", tKey: "gw.critical" },
    { color: "#7f1d1d", label: ">25m",   tKey: "gw.crisis" },
    { color: "#9ca3af", label: "—",      tKey: "gw.no_data_lc" },
  ];

  const RISK_ITEMS = [
    { color: "#22c55e", label: "0–25",   tKey: "legend.low_risk" },
    { color: "#eab308", label: "26–50",  tKey: "legend.moderate_risk" },
    { color: "#f97316", label: "51–75",  tKey: "legend.high_risk" },
    { color: "#dc2626", label: "76–100", tKey: "gw.critical" },
    { color: "#9ca3af", label: "—",      tKey: "gw.no_data_lc" },
  ];

  const items = viewMode === "risk" ? RISK_ITEMS : DEPTH_ITEMS;
  const title = viewMode === "risk" ? t("legend.risk_title") : t("legend.depth_title");

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
        {title}
      </h4>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs">
            <span className="w-4 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="font-mono text-slate-600 dark:text-slate-400 w-10">{item.label}</span>
            <span className="text-slate-500 dark:text-slate-400">{t(item.tKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useLanguage } from "@/lib/i18n/context";

const LEGEND_DEFS = [
  { id: "existing",         color: "#3b82f6", labelKey: "wb_legend.existing",         descKey: "wb_legend.surviving" },
  { id: "fully_lost",       color: "#dc2626", labelKey: "wb_legend.fully_lost",       descKey: "wb_legend.fully_lost_desc" },
  { id: "severely_reduced", color: "#f97316", labelKey: "wb_legend.severely_reduced", descKey: "wb_legend.severely_reduced_desc" },
  { id: "encroached",       color: "#eab308", labelKey: "wb_legend.encroached",       descKey: "wb_legend.encroached_desc" },
] as const;

export function WaterBodiesLegend() {
  const { t } = useLanguage();
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
        {t("wb_legend.title")}
      </h4>
      <div className="space-y-1">
        {LEGEND_DEFS.map((item) => (
          <div key={item.id} className="flex items-center gap-2 text-xs">
            <span
              className="w-4 h-3 rounded-sm border"
              style={{
                backgroundColor: item.color + "80",
                borderColor: item.color,
              }}
            />
            <span className="font-medium text-slate-700 dark:text-slate-300 w-24">{t(item.labelKey)}</span>
            <span className="text-slate-500 dark:text-slate-400">{t(item.descKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

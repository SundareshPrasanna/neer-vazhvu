"use client";

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

const SOURCE_ITEMS: PollutionSourceType[] = [
  "thermal_power",
  "petrochemical",
  "chemical",
  "port",
  "industrial_estate",
  "discharge_zone",
];

export function RiversLegend() {
  const { t } = useLanguage();
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2 space-y-2">
      {/* Water quality section */}
      <div>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {t("rivers_legend.water_quality")}
        </p>
        <div className="flex flex-col gap-1">
          {QUALITY_ITEMS.map((status) => (
            <div key={status} className="flex items-center gap-2">
              <span
                className="w-6 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: QUALITY_COLORS[status] }}
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t(`rivers_legend.${status}`)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-slate-400 bg-white dark:bg-slate-600 flex-shrink-0" />
          <span className="text-xs text-slate-500 dark:text-slate-500">
            {t("rivers_legend.monitoring_station")}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-100 dark:border-slate-700" />

      {/* Pollution sources section */}
      <div>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {t("rivers_legend.pollution_sources")}
        </p>
        <div className="flex flex-col gap-1">
          {SOURCE_ITEMS.map((type) => (
            <div key={type} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full border-2 border-white dark:border-slate-600 flex-shrink-0 shadow-sm"
                style={{ backgroundColor: SOURCE_TYPE_COLORS[type] }}
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t(`rivers_legend.${type}`)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className="w-6 h-3 rounded flex-shrink-0 border border-dashed"
            style={{
              backgroundColor: "rgba(249,115,22,0.10)",
              borderColor: "#f97316",
            }}
          />
          <span className="text-xs text-slate-500 dark:text-slate-500">
            {t("rivers_legend.industrial_zone")}
          </span>
        </div>
      </div>
    </div>
  );
}

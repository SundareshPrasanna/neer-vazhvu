"use client";

import { useLanguage } from "@/lib/i18n/context";
import { HAZARD_COLORS, DRAINAGE_COLORS } from "@/types/flood-risk";
import type { FloodViewMode, HazardCategory } from "@/types/flood-risk";

const HAZARD_ITEMS: Array<{ cat: HazardCategory; key: string }> = [
  { cat: "very_high", key: "flood.very_high" },
  { cat: "high", key: "flood.high" },
  { cat: "moderate", key: "flood.moderate" },
  { cat: "low", key: "flood.low" },
  { cat: "very_low", key: "flood.very_low" },
];

const DRAINAGE_ITEMS: Array<{ type: string; key: string }> = [
  { type: "canal", key: "flood.legend_canal" },
  { type: "drain", key: "flood.legend_drain" },
  { type: "ditch", key: "flood.legend_ditch" },
];

interface FloodLegendProps {
  viewMode: FloodViewMode;
}

export function FloodLegend({ viewMode }: FloodLegendProps) {
  const { t } = useLanguage();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
        {viewMode === "hazard"
          ? t("flood.legend_hazard")
          : viewMode === "historical"
            ? t("flood.legend_impact")
            : t("flood.legend_drainage")}
      </h4>
      <div className="space-y-1">
        {viewMode === "hazard" &&
          HAZARD_ITEMS.map((item) => (
            <div key={item.cat} className="flex items-center gap-2 text-xs">
              <span
                className="w-4 h-3 rounded-sm border"
                style={{
                  backgroundColor: HAZARD_COLORS[item.cat] + "80",
                  borderColor: HAZARD_COLORS[item.cat],
                }}
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t(item.key)}
              </span>
            </div>
          ))}

        {viewMode === "historical" && (
          <>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-4 h-3 rounded-full bg-red-500 border border-red-600" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t("flood.legend_hotspot")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-4 h-3 rounded-full bg-blue-500 border border-blue-600" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t("flood.legend_depth")}
              </span>
            </div>
          </>
        )}

        {viewMode === "drainage" && (
          <>
            {DRAINAGE_ITEMS.map((item) => (
              <div key={item.type} className="flex items-center gap-2 text-xs">
                <span
                  className="w-4 h-0 border-t-2"
                  style={{ borderColor: DRAINAGE_COLORS[item.type] }}
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t(item.key)}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs">
              <span className="w-4 h-0 border-t-2 border-cyan-500" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t("flood.legend_river")}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

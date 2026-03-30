"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { HAZARD_COLORS, DRAINAGE_COLORS, SEWERAGE_COLORS } from "@/types/flood-risk";
import type { FloodViewMode, HazardCategory, SewerageLayer } from "@/types/flood-risk";

const HAZARD_ITEMS: Array<{ cat: HazardCategory; key: string }> = [
  { cat: "very_high", key: "flood.very_high" },
  { cat: "high", key: "flood.high" },
  { cat: "moderate", key: "flood.moderate" },
  { cat: "low", key: "flood.low" },
  { cat: "very_low", key: "flood.very_low" },
];

const DRAINAGE_ITEMS: Array<{ type: string; key: string }> = [
  { type: "Macro Drain", key: "flood.legend_macro" },
  { type: "Micro Drain", key: "flood.legend_micro" },
  { type: "SWD", key: "flood.legend_swd" },
  { type: "Side Drain", key: "flood.legend_side" },
  { type: "Open Drain", key: "flood.legend_open" },
];

interface FloodLegendProps {
  viewMode: FloodViewMode;
}

export function FloodLegend({ viewMode }: FloodLegendProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const title =
    viewMode === "hazard"
      ? t("flood.legend_hazard")
      : viewMode === "historical"
        ? t("flood.legend_impact")
        : viewMode === "sewerage"
          ? t("flood.legend_sewerage")
          : t("flood.legend_drainage");

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
        {viewMode === "hazard" &&
          HAZARD_ITEMS.map((item) => (
            <div key={item.cat} className="flex items-center gap-2 text-xs whitespace-nowrap">
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
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span className="w-4 h-3 rounded-full bg-red-500 border border-red-600" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t("flood.legend_hotspot")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
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
              <div key={item.type} className="flex items-center gap-2 text-xs whitespace-nowrap">
                <span
                  className="w-4 h-0 border-t-2"
                  style={{ borderColor: DRAINAGE_COLORS[item.type] }}
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t(item.key)}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span className="w-4 h-0 border-t-2 border-cyan-500" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t("flood.legend_river")}
              </span>
            </div>
          </>
        )}

        {viewMode === "sewerage" && (
          <>
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span
                className="w-4 h-3 rounded-sm border"
                style={{ backgroundColor: SEWERAGE_COLORS.stp + "80", borderColor: SEWERAGE_COLORS.stp }}
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t("flood.legend_stp")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span
                className="w-3 h-3 rounded-full border"
                style={{ backgroundColor: SEWERAGE_COLORS.sps + "80", borderColor: SEWERAGE_COLORS.sps }}
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t("flood.legend_sps")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span
                className="w-4 h-0 border-t-2"
                style={{ borderColor: SEWERAGE_COLORS.pumping_main }}
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t("flood.legend_pm")}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { CLIMATE_CLASSES, CLIMATE_RISK_COLORS } from "@/types/climate-risk";

interface ClimateRiskLegendProps {
  hiddenClasses?: Set<string>;
  onToggleClass?: (cls: string) => void;
}

export function ClimateRiskLegend({ hiddenClasses, onToggleClass }: ClimateRiskLegendProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full"
      >
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
          {t("climate.legend_title")}
        </h4>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`${expanded ? "block" : "hidden"} mt-2 space-y-1`}>
        {CLIMATE_CLASSES.map((cls) => {
          const hidden = hiddenClasses?.has(cls) ?? false;
          const color = CLIMATE_RISK_COLORS[cls];
          return (
            <button
              key={cls}
              onClick={() => onToggleClass?.(cls)}
              className={`flex items-center gap-2 text-xs whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleClass ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
            >
              <span
                className="w-4 h-3 rounded-sm border"
                style={{ backgroundColor: color, borderColor: "#94a3b8" }}
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t(`climate.class.${cls}`)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

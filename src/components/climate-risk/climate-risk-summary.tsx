"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import {
  CLIMATE_CLASSES,
  CLIMATE_RISK_COLORS,
  type ClimateClass,
  type SubBasinProperties,
} from "@/types/climate-risk";

/**
 * "At a glance" overview for the climate-risk page - a semi-transparent card
 * overlaid top-right of the map, open by default and collapsible to a pill.
 * Leads with the Chennai-wide conclusion + the risk-class split of the six
 * sub-basins, mirroring the shoreline summary pattern.
 */
export function ClimateRiskSummary({
  subBasins,
  onShowHighest,
}: {
  subBasins: SubBasinProperties[];
  onShowHighest: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:bg-white dark:hover:bg-slate-900"
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CLIMATE_RISK_COLORS.very_high }} />
        {t("climate.summary.collapsed")}
        <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    );
  }

  // Risk-class distribution of the six sub-basins (high -> low).
  const counts = CLIMATE_CLASSES.map((cls) => ({
    cls,
    n: subBasins.filter((s) => s.risk_class === cls).length,
  })).filter((c) => c.n > 0);
  const total = subBasins.length || 1;

  return (
    <div className="w-[260px] sm:w-[290px] bg-white/85 dark:bg-slate-900/85 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3.5 text-sm">
      <div className="flex items-start justify-between mb-2">
        <h2 className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
          {t("climate.summary.title")}
          <span className="block text-[11px] font-normal text-slate-500">
            {t("climate.summary.subtitle")}
          </span>
        </h2>
        <button
          onClick={() => setOpen(false)}
          className="p-1 -m-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
          aria-label="Collapse summary"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>

      <p className="text-slate-700 dark:text-slate-200 font-medium leading-snug mb-3">
        {t("climate.headline")}
      </p>

      {/* Risk-class split of the 6 sub-basins */}
      <div className="mb-1.5">
        <div className="flex h-2.5 rounded-full overflow-hidden">
          {counts.map(({ cls, n }) => (
            <div key={cls} style={{ width: `${(100 * n) / total}%`, backgroundColor: CLIMATE_RISK_COLORS[cls] }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] mt-1.5">
          {counts.map(({ cls, n }) => (
            <span key={cls} className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
              <span className="w-2 h-2 rounded-sm border border-slate-400" style={{ backgroundColor: CLIMATE_RISK_COLORS[cls as ClimateClass] }} />
              {n} {t(`climate.class.${cls}`).toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 leading-snug">
        {t("climate.summary.balance")}
      </p>

      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-snug">
        <span className="font-semibold">{t("climate.summary.why_label")}:</span> {t("climate.summary.why")}
      </p>

      <button
        onClick={onShowHighest}
        className="mt-3 w-full text-xs font-semibold text-white rounded-md py-1.5"
        style={{ backgroundColor: CLIMATE_RISK_COLORS.very_high }}
      >
        {t("climate.summary.cta")} →
      </button>

      <p className="text-[10px] text-slate-400 mt-2.5 leading-snug">
        {t("climate.summary.source")}
      </p>
    </div>
  );
}

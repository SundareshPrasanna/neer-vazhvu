"use client";

import { useLanguage } from "@/lib/i18n/context";
import { CLIMATE_SUBTHEMES, type ClimateSubtheme } from "@/types/climate-risk";

interface ClimateRiskToggleProps {
  value: ClimateSubtheme;
  onChange: (value: ClimateSubtheme) => void;
  /** Subthemes the city actually supports (from config.climateRisk). */
  available: ClimateSubtheme[];
}

export function ClimateRiskToggle({ value, onChange, available }: ClimateRiskToggleProps) {
  const { t } = useLanguage();
  const subthemes = CLIMATE_SUBTHEMES.filter((s) => available.includes(s));

  return (
    <div className="inline-flex flex-wrap rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
      {subthemes.map((sub) => (
        <button
          key={sub}
          onClick={() => onChange(sub)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === sub
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          {t(`climate.sub.${sub}`)}
        </button>
      ))}
    </div>
  );
}

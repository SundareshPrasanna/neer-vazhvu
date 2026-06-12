"use client";

import { useLanguage } from "@/lib/i18n/context";

export type ViewMode = "water-bodies" | "restoration" | "catchments";

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** Show the Catchments mode (only where terrain-derived catchment data exists). */
  catchmentsAvailable?: boolean;
}

export function ViewModeToggle({ value, onChange, catchmentsAvailable = false }: ViewModeToggleProps) {
  const { t } = useLanguage();

  const btn = (mode: ViewMode, label: string) => (
    <button
      onClick={() => onChange(mode)}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
        value === mode
          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
      {btn("water-bodies", t("wb.view_bodies"))}
      {btn("restoration", t("wb.view_restoration"))}
      {catchmentsAvailable && btn("catchments", t("wb.view_catchments"))}
    </div>
  );
}

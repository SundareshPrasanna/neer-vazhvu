"use client";

import { useLanguage } from "@/lib/i18n/context";

export type ViewMode = "water-bodies" | "restoration";

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  const { t } = useLanguage();

  return (
    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
      <button
        onClick={() => onChange("water-bodies")}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          value === "water-bodies"
            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
        }`}
      >
        {t("wb.view_bodies")}
      </button>
      <button
        onClick={() => onChange("restoration")}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          value === "restoration"
            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
        }`}
      >
        {t("wb.view_restoration")}
      </button>
    </div>
  );
}

"use client";

import { useLanguage } from "@/lib/i18n/context";
import type { FloodViewMode } from "@/types/flood-risk";

interface FloodViewToggleProps {
  value: FloodViewMode;
  onChange: (mode: FloodViewMode) => void;
}

const MODES: Array<{ mode: FloodViewMode; key: string }> = [
  { mode: "hazard", key: "flood.view_hazard" },
  { mode: "historical", key: "flood.view_historical" },
  { mode: "drainage", key: "flood.view_drainage" },
  { mode: "sewerage", key: "flood.view_sewerage" },
];

export function FloodViewToggle({ value, onChange }: FloodViewToggleProps) {
  const { t } = useLanguage();

  return (
    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 max-w-full overflow-x-auto">
      {MODES.map(({ mode, key }) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
            value === mode
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}

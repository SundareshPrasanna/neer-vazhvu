"use client";

import { useLanguage } from "@/lib/i18n/context";

export type ViewMode = "water-bodies" | "restoration" | "catchments";

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** Show the Catchments mode (only where terrain-derived catchment data exists). */
  catchmentsAvailable?: boolean;
  /** Why catchments are unavailable. When present and catchments are off, the
   *  toggle renders a disclosure in place of the button rather than hiding it
   *  silently - a missing view mode should say why it is missing. */
  catchmentsGapNote?: string;
}

export function ViewModeToggle({ value, onChange, catchmentsAvailable = false, catchmentsGapNote }: ViewModeToggleProps) {
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
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
        {btn("water-bodies", t("wb.view_bodies"))}
        {btn("restoration", t("wb.view_restoration"))}
        {catchmentsAvailable && btn("catchments", t("wb.view_catchments"))}
      </div>
      {/* Explained absence. A <details> rather than a tooltip so it works on
          touch, and so the reason is readable rather than hover-only. */}
      {!catchmentsAvailable && catchmentsGapNote && (
        <details className="group max-w-full">
          <summary className="cursor-pointer list-none text-xs text-slate-500 dark:text-slate-400 underline decoration-dotted underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">
            {t("wb.view_catchments")}: {t("wb.catchments_unavailable")}
          </summary>
          <p className="mt-2 max-w-prose text-xs leading-snug text-slate-600 dark:text-slate-400">
            {catchmentsGapNote}
          </p>
        </details>
      )}
    </div>
  );
}

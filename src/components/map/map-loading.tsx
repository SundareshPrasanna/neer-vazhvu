"use client";

import { useLanguage } from "@/lib/i18n/context";

/** Placeholder while a map's code or first data loads. */
export function MapLoading({ className = "h-full w-full" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <div role="status" className={`${className} bg-slate-100 dark:bg-slate-800 flex items-center justify-center`}>
      <span className="text-slate-500 dark:text-slate-400">{t("common.loading_map")}</span>
    </div>
  );
}

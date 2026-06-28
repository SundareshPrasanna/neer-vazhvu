"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";

/**
 * Chennai basin water-balance tile. Static figures from the TNGCC + CEEW 2026
 * WEAP model (business-as-usual scenario). Non-spatial headline; deep-links to
 * the sub-basin climate-risk surface. Gated by `dashboard.weapBalance`.
 */
export function WeapBalanceTile({ cityId }: { cityId: string }) {
  const { t } = useLanguage();

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {t("climate.weap.title")}
        </h2>
        <Link
          href={`/${cityId}/climate-risk`}
          className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap"
        >
          {t("climate.weap.explore")} &rarr;
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("climate.weap.demand")}</div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            2,479 <span className="text-base font-normal text-slate-400">&rarr;</span> 2,728
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400"> MCM</span>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500">2025 &rarr; 2050</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("climate.weap.unmet")}</div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            546 <span className="text-base font-normal text-slate-400">&rarr;</span> 654
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400"> MCM</span>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500">{t("climate.weap.by_2050")}</div>
        </div>
      </div>

      <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
        {t("climate.weap.lever")}
      </p>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        {t("climate.source")}
      </p>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import type { CityStoryNarrative } from "@/lib/insights/select-narrative";

interface CityStoryProps {
  narrative: CityStoryNarrative;
}

/** Interpolate template params into a translated string */
function interpolate(
  template: string,
  params: Record<string, string | number>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

const VARIANT_BORDER: Record<CityStoryNarrative["variant"], string> = {
  crisis: "border-l-red-500",
  stress: "border-l-amber-500",
  mixed: "border-l-yellow-500",
  stable: "border-l-green-500",
};

export function CityStory({ narrative }: CityStoryProps) {
  const { t } = useLanguage();

  const headline = t(narrative.headlineKey);
  const freshness = interpolate(
    t(narrative.freshnessKey),
    narrative.freshnessParams,
  );

  return (
    <div
      className={`border-l-4 ${VARIANT_BORDER[narrative.variant]} bg-white dark:bg-slate-900 rounded-r-lg shadow-sm px-5 py-4`}
    >
      <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
        {t("city_story.heading")}
      </h3>

      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        <span className="font-semibold">{headline}</span>{" "}
        {narrative.sentences.map((s, i) => (
          <span key={s.key}>
            {interpolate(t(s.key), s.params)}
            {i < narrative.sentences.length - 1 ? " " : ""}
          </span>
        ))}
      </p>

      {/* Cross-links */}
      <div className="flex flex-wrap gap-4 mt-3">
        <Link
          href="/groundwater"
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1"
        >
          {t("city_story.explore_gw")}
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          href="/water-bodies?mode=restoration"
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1"
        >
          {t("city_story.see_restoration")}
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          href="/flood-risk"
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1"
        >
          {t("city_story.see_flood_risk")}
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Data freshness */}
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
        {freshness}
      </p>
    </div>
  );
}

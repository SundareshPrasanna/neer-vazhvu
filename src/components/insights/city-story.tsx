"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import type { CityStoryNarrative } from "@/lib/insights/select-narrative";

export interface AiNarrative {
  date: string;
  headline_en: string;
  headline_ta: string;
  body_en: string;
  body_ta: string;
  source_dates: {
    reservoir_date: string | null;
    gw_period: string | null;
    risk_date: string | null;
  } | null;
  model: string;
}

interface CityStoryProps {
  narrative: CityStoryNarrative;
  aiNarrative?: AiNarrative | null;
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

function AiFreshness({ sourceDates, t }: { sourceDates: AiNarrative["source_dates"]; t: (key: string) => string }) {
  if (!sourceDates) return null;
  const parts: string[] = [];
  if (sourceDates.reservoir_date) {
    parts.push(`${t("ai_narrative.reservoirs")}: ${sourceDates.reservoir_date}`);
  }
  if (sourceDates.gw_period) {
    parts.push(`${t("ai_narrative.groundwater")}: ${sourceDates.gw_period}`);
  }
  if (sourceDates.risk_date) {
    parts.push(`${t("ai_narrative.risk_scores")}: ${sourceDates.risk_date}`);
  }
  if (parts.length === 0) return null;
  return (
    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
      {parts.join(" | ")}
    </p>
  );
}

export function CityStory({ narrative, aiNarrative }: CityStoryProps) {
  const { t, language } = useLanguage();

  const useAi = !!aiNarrative;

  // AI narrative content
  const aiHeadline = useAi
    ? language === "ta" ? aiNarrative.headline_ta : aiNarrative.headline_en
    : "";
  const aiBody = useAi
    ? language === "ta" ? aiNarrative.body_ta : aiNarrative.body_en
    : "";

  // Template narrative content
  const templateHeadline = t(narrative.headlineKey);
  const templateFreshness = interpolate(
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

      {useAi ? (
        <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <p className="font-semibold mb-2">{aiHeadline}</p>
          <ul className="space-y-1">
            {aiBody.split("\n").filter((line) => line.trim().startsWith("-")).map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5 shrink-0">-</span>
                <span>{line.replace(/^-\s*/, "")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <span className="font-semibold">{templateHeadline}</span>{" "}
          {narrative.sentences.map((s, i) => (
            <span key={s.key}>
              {interpolate(t(s.key), s.params)}
              {i < narrative.sentences.length - 1 ? " " : ""}
            </span>
          ))}
        </p>
      )}

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
      {useAi ? (
        <AiFreshness sourceDates={aiNarrative.source_dates} t={t} />
      ) : (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
          {templateFreshness}
        </p>
      )}
    </div>
  );
}

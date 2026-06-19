"use client";

import Link from "next/link";
import type { BangaloreBriefing } from "@/lib/insights/bangalore-briefing";
import { useLanguage } from "@/lib/i18n/context";

interface Props {
  briefing: BangaloreBriefing;
  /** Optional AI-generated override. When a daily_briefing row exists
   *  for today + cityId='bangalore', the server passes its headline +
   *  body here and the template falls back to "freshness only".
   *  V1 is template-only; this prop is the open slot for a follow-up
   *  Anthropic Claude pipeline mirroring Chennai's daily_briefing
   *  table. */
  aiOverride?: {
    headline: string;
    body: string;
    sourceDates?: { reservoir_date: string | null };
    model?: string;
  } | null;
}

const VARIANT_BORDER: Record<BangaloreBriefing["variant"], string> = {
  drought_drawdown: "border-l-red-500",
  pre_monsoon: "border-l-amber-500",
  monsoon_recharge: "border-l-blue-500",
  post_monsoon: "border-l-emerald-500",
  steady_drawdown: "border-l-yellow-500",
};

const VARIANT_BADGE_CLS: Record<BangaloreBriefing["variant"], string> = {
  drought_drawdown: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  pre_monsoon:      "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  monsoon_recharge: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  post_monsoon:     "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  steady_drawdown:  "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300",
};

function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

export function BangaloreDailyBriefing({ briefing, aiOverride }: Props) {
  const { t } = useLanguage();
  const useAi = !!aiOverride;

  const f = briefing.fields;
  const fieldsAsStrings: Record<string, string | number> = { ...f };

  // Compose localised headline + bullets from t() templates. Falls back
  // to the AI override prose when one is present (those are typically
  // already pre-translated by the upstream pipeline).
  const headline = useAi
    ? aiOverride!.headline
    : format(t(`briefing.headline.${briefing.variant}`), fieldsAsStrings);

  const bullets = useAi
    ? aiOverride!.body
        .split("\n")
        .map((line) => line.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean)
    : [
        f.lowName && f.highName
          ? format(t("briefing.sentence.dam_range"), fieldsAsStrings)
          : null,
        format(t("briefing.sentence.stage_v"), { design: f.stageVDesign, actual: f.stageVActual }),
        format(t("briefing.sentence.demand_side"), {
          served: f.served,
          gba: f.gba,
          tankers: f.tankers,
          wards: f.wards,
        }),
        format(t(`briefing.sentence.tail.${briefing.variant}`), fieldsAsStrings),
      ].filter((s): s is string => Boolean(s));

  const badgeCls = VARIANT_BADGE_CLS[briefing.variant];
  const badgeLabel = t(`briefing.variant.${briefing.variant}`);

  return (
    <div
      className={`border-l-4 ${VARIANT_BORDER[briefing.variant]} bg-white dark:bg-slate-900 rounded-r-lg shadow-sm px-5 py-4`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {t("briefing.heading")}
        </h3>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${badgeCls}`}
        >
          {badgeLabel}
        </span>
      </div>

      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed mb-2">
        {headline}
      </p>

      <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-slate-400 mt-0.5 shrink-0">-</span>
            <span className="leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-4 mt-3 text-xs">
        <Link
          href="/bangalore/groundwater"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium inline-flex items-center gap-1"
        >
          {t("briefing.link_groundwater")}
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          href="/bangalore/tanker"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium inline-flex items-center gap-1"
        >
          {t("briefing.link_tanker")}
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          href="/bangalore/water-bodies"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium inline-flex items-center gap-1"
        >
          {t("briefing.link_lakes")}
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
        {useAi && aiOverride?.sourceDates?.reservoir_date
          ? `${t("briefing.cauvery_storage_label")}: ${aiOverride.sourceDates.reservoir_date}${aiOverride.model ? ` - ${aiOverride.model}` : ""}`
          : briefing.freshnessDate
            ? format(t("briefing.freshness.with_date"), { date: briefing.freshnessDate })
            : t("briefing.freshness.pending")}
      </p>
    </div>
  );
}

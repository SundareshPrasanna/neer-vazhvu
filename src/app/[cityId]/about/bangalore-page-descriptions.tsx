"use client";

/**
 * Bangalore-specific "What each page shows" subsections.
 *
 * Each section + paragraph is routed through the bpd.* translation
 * keys so the entire About-page Bangalore description localises with
 * the user's chosen language (en / ta / kn). Mirrors the structure
 * of madurai-page-descriptions.tsx so cross-city navigation between
 * about-page anchors stays predictable.
 */

import { useLanguage } from "@/lib/i18n/context";

function tFmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

function SubSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
    >
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
        {title}
      </h3>
      {children}
    </div>
  );
}

interface Props {
  cityId: string;
  cityName: string;
}

export function BangalorePageDescriptions({ cityId, cityName }: Props) {
  const { t } = useLanguage();
  const tf = (key: string) => tFmt(t(key), { city: cityName });

  return (
    <>
      <SubSection id="page-dashboard" title={t("bpd.dashboard.title")}>
        <p className="text-slate-600 dark:text-slate-400">{tf("bpd.dashboard.p1")}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t("bpd.dashboard.h_cauvery")}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.dashboard.p2")}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t("bpd.dashboard.h_basin")}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.dashboard.p3")}</p>
      </SubSection>

      <SubSection id="page-tanker" title={t("bpd.tanker.title")}>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.tanker.p1")}</p>
      </SubSection>

      <SubSection id="page-groundwater" title={t("bpd.gw.title")}>
        <p className="text-slate-600 dark:text-slate-400">{tf("bpd.gw.p1")}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {t("bpd.gw.h_block")}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.gw.p2")}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t("bpd.gw.h_station")}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.gw.p3")}</p>
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {t("bpd.gw.gap_title")}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t("bpd.gw.gap_body")}</p>
        </div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t("bpd.gw.h_composite")}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.gw.p_composite_intro")}</p>
        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
          <li>{t("bpd.gw.factor1")}</li>
          <li>{t("bpd.gw.factor2")}</li>
          <li>{t("bpd.gw.factor3")}</li>
        </ul>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">{t("bpd.gw.composite_caveat")}</p>
      </SubSection>

      <SubSection id="page-water-bodies" title={t("bpd.wb.title")}>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.wb.p1")}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t("bpd.wb.h_lost")}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.wb.p2")}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t("bpd.wb.h_cascade")}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.wb.p3")}</p>
      </SubSection>

      <SubSection id="page-rivers" title={t("bpd.rivers.title")}>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.rivers.p1")}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t("bpd.rivers.h_stations")}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.rivers.p2")}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t("bpd.rivers.h_events")}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.rivers.p3")}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t("bpd.rivers.h_industry")}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.rivers.p4")}</p>
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {t("bpd.rivers.gap_title")}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t("bpd.rivers.gap_body")}</p>
        </div>
      </SubSection>

      <SubSection id="page-flood" title={t("bpd.flood.title")}>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.flood.p1")}</p>
      </SubSection>

      <SubSection id="page-my-ward" title={t("bpd.myward.title")}>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.myward.p1")}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t("bpd.myward.h_risk_panel")}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.myward.p2")}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">{t("bpd.myward.caveat")}</p>
      </SubSection>

      <SubSection id="page-facts" title={t("bpd.facts.title")}>
        <p className="text-slate-600 dark:text-slate-400">{tf("bpd.facts.p1")}</p>
      </SubSection>

      <SubSection id="page-origins" title={t("bpd.origins.title")}>
        <p className="text-slate-600 dark:text-slate-400">{t("bpd.origins.p1")}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <a
            href={`/${cityId}/origins`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            /{cityId}/origins
          </a>
        </p>
      </SubSection>
    </>
  );
}

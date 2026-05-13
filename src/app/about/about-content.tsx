"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { CHENNAI } from "@/lib/cities/chennai";
import type { CascadeStats } from "@/lib/cascade-stats";
import { resolveConvergenceExample } from "@/lib/cascade-stats";
import { CascadeMethodologySection } from "@/components/cascade/cascade-methodology-section";

const LOST_WATER_BODY_SOURCES: {
  name: string;
  status: "Fully lost" | "Severely reduced" | "Partially encroached";
  source: string;
}[] = [
  { name: "Long Tank (Otteri Nullah)", status: "Fully lost", source: "Care Earth Trust / IIT Madras Water Bodies Study" },
  { name: "Nungambakkam Tank", status: "Fully lost", source: "Survey of India historical maps / CMDA" },
  { name: "Kodambakkam Lake", status: "Fully lost", source: "Care Earth Trust water body survey" },
  { name: "Virugambakkam Lake", status: "Severely reduced", source: "CMDA Master Plan / Care Earth Trust" },
  { name: "Pallikaranai Marsh", status: "Severely reduced", source: "Care Earth Trust / Ashoka Trust for Research in Ecology" },
  { name: "Perungudi Lake", status: "Fully lost", source: "Care Earth Trust / Greater Chennai Corporation records" },
  { name: "Madipakkam Lake", status: "Partially encroached", source: "Madras High Court / NGT records" },
  { name: "Sholinganallur Marshland", status: "Severely reduced", source: "Salim Ali Centre for Ornithology / Care Earth Trust" },
  { name: "Villivakkam Lake", status: "Partially encroached", source: "CMDA / Revenue records / Care Earth Trust" },
  { name: "Kolathur Lake", status: "Partially encroached", source: "Care Earth Trust water body inventory" },
  { name: "Tambaram Tank", status: "Severely reduced", source: "Survey of India maps / Tamil Nadu PWD records" },
  { name: "Manali Wetlands", status: "Severely reduced", source: "TNPCB / Tamil Nadu Pollution Control Board reports" },
  { name: "Ennore Creek Wetlands", status: "Severely reduced", source: "Coastal Management Society / National Green Tribunal (Chennai)" },
  { name: "Muttukadu Backwaters", status: "Partially encroached", source: "CMDA Coastal Regulation Zone / Care Earth Trust" },
  { name: "Chetpet Lake", status: "Severely reduced", source: "GCC / Care Earth Trust / Madras High Court order 2018" },
];

/**
 * Collapsible top-level section using a native <details> element. The About
 * page carries a lot of methodology; reviewers want to scan parent headers
 * and expand only what they care about. Native <details> keeps this
 * accessible by default (keyboard, screen readers, "find in page" still
 * searches hidden content in modern browsers) and requires no JS state.
 */
function Section({
  id,
  title,
  children,
  defaultOpen = false,
}: {
  id?: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 open:shadow-sm"
    >
      <summary className="flex items-center justify-between gap-3 cursor-pointer list-none select-none p-4 sm:p-5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 [&::-webkit-details-marker]:hidden">
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        <svg
          className="w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 space-y-5">{children}</div>
    </details>
  );
}

/**
 * A bordered block used to group related content under a parent Section.
 * Not collapsible - the user opts in by opening the parent Section, then
 * scans h3 sub-sections inside it.
 */
function SubSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
    >
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      {children}
    </div>
  );
}

/** Thin uppercase divider used between grouped DataSource lists. */
function DataSourceGroupHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 pt-2 pb-1">
      {title}
    </h3>
  );
}

function DataSource({
  name,
  url,
  description,
  frequency,
}: {
  name: string;
  url: string;
  description: string;
  frequency: string;
}) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {name}
        </a>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{frequency}</span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
    </div>
  );
}

export function AboutContent({
  cascadeStats,
}: {
  cascadeStats: CascadeStats | null;
}) {
  const { t } = useLanguage();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t("about.title")}</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">
        {t("about.intro")}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-500 mb-6 italic">
        {t("about.collapsed_hint")}
      </p>

      <div className="space-y-3">

        {/* ──────────────────────────────────────────────────────────────
            1. Reading this dashboard
            - Days of Water Left methodology
            - Default assumptions
            ────────────────────────────────────────────────────────────── */}
        <Section title={t("about.group_reading")}>
          <SubSection title={t("about.days_heading")}>
            <p className="text-slate-600 dark:text-slate-400">
              {t("about.days_intro")}
            </p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.pessimistic")}</span>
                  <span className="text-slate-600 dark:text-slate-400"> {t("about.pessimistic_desc")}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.current_trend")}</span>
                  <span className="text-slate-600 dark:text-slate-400"> {t("about.current_desc")}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.seasonal")}</span>
                  <span className="text-slate-600 dark:text-slate-400"> {t("about.seasonal_desc")}</span>
                </div>
              </div>
            </div>
          </SubSection>

          <SubSection title={t("about.assumptions")}>
            {/* Desktop table */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                    <th className="pb-2 font-medium">{t("about.param")}</th>
                    <th className="pb-2 font-medium">{t("about.default")}</th>
                    <th className="pb-2 font-medium">{t("about.source_col")}</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">{t("about.row_consumption")}</td>
                    <td className="py-2 font-mono">830 MLD</td>
                    <td className="py-2 text-slate-500 dark:text-slate-400">{t("about.src_cmwssb_report")}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">{t("about.row_desalination")}</td>
                    <td className="py-2 font-mono">190 MLD</td>
                    <td className="py-2 text-slate-500 dark:text-slate-400">{t("about.row_desalination_source")}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">{t("about.row_groundwater")}</td>
                    <td className="py-2 font-mono">{t("about.not_modeled")}</td>
                    <td className="py-2 text-slate-500 dark:text-slate-400">{t("about.src_conservative")}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">{t("about.row_evaporation")}</td>
                    <td className="py-2 font-mono">{t("about.not_modeled")}</td>
                    <td className="py-2 text-slate-500 dark:text-slate-400">{t("about.planned_v2")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {[
                { param: t("about.row_consumption"), value: "830 MLD", source: t("about.src_cmwssb_report") },
                { param: t("about.row_desalination"), value: "190 MLD", source: t("about.row_desalination_source") },
                { param: t("about.row_groundwater"), value: t("about.not_modeled"), source: t("about.src_conservative") },
                { param: t("about.row_evaporation"), value: t("about.not_modeled"), source: t("about.planned_v2") },
              ].map((row) => (
                <div key={row.param} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{row.param}</div>
                  <div className="font-mono text-slate-700 dark:text-slate-300 mt-1">{row.value}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{row.source}</div>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("about.adjust_note")}
            </p>
          </SubSection>
        </Section>

        {/* ──────────────────────────────────────────────────────────────
            2. What each page shows - one SubSection per map/page
            ────────────────────────────────────────────────────────────── */}
        <Section id="pages" title={t("about.group_pages")}>
          {/* 2.1 Dashboard & reservoirs (includes forecasting + GEE catchment) */}
          <SubSection id="page-dashboard" title={t("about.page_dashboard_title")}>
            <p className="text-slate-600 dark:text-slate-400">
              {t("about.forecast_intro")}
            </p>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">{t("about.technique")}</h4>
            <p className="text-slate-600 dark:text-slate-400">
              {t("about.technique_before_link")} <span className="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">AutoARIMA</span> {t("about.technique_after_link")}{" "}
              <a href="https://nixtla.github.io/statsforecast/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">statsforecast</a>{" "}
              <span className="font-medium">{t("about.technique_exogenous_term")}</span> {t("about.technique_after_term")}
            </p>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1.5 text-sm">
              <li>{t("about.tech_bullet_independent")}</li>
              <li>{t("about.tech_bullet_retrained")}</li>
              <li>
                <span className="font-medium text-slate-700 dark:text-slate-300">{t("about.tech_exogenous_label")}</span> {t("about.tech_exogenous_desc")}
              </li>
              <li>
                <span className="font-medium text-slate-700 dark:text-slate-300">{t("about.tech_future_label")}</span> {t("about.tech_future_desc")}
              </li>
              <li>
                <span className="font-medium text-slate-700 dark:text-slate-300">{t("about.tech_fallback_label")}</span> {t("about.tech_fallback_desc")}
              </li>
              <li>{t("about.tech_bullet_clamped")}</li>
            </ul>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 mt-3">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("about.gee_catchment_title")}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t("about.gee_catchment_desc")}
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-3">
                <li>{t("about.gee_catchment_step1")}</li>
                <li>{t("about.gee_catchment_step2")}</li>
                <li>{t("about.gee_catchment_step3")}</li>
                <li>{t("about.gee_catchment_step4")}</li>
              </ul>
            </div>
          </SubSection>

          {/* 2.2 Groundwater page (choropleth + CGWB stations + ward risk) */}
          <SubSection id="page-groundwater" title={t("about.page_gw_title")}>
            <p className="text-slate-600 dark:text-slate-400">
              {t("about.gw_map_desc1")}
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              {t("about.gw_map_desc2")}
            </p>

            {/* Ward risk composite lives on this page - move the existing blurb
                here so readers see it alongside the choropleth description. */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40">
              <div className="flex gap-3">
                <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.ward_risk_title")}</span>
                  <span className="text-slate-600 dark:text-slate-400"> {t("about.ward_risk_desc")}</span>
                </div>
              </div>
            </div>

            {/* CGWB live station overlay + sensor QA explainer. Reviewers keep
                asking why some markers look different - document it so they
                can find it next to the groundwater page explainer. */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {t("about.gw_cgwb_stations_title")}
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  {t("about.gw_cgwb_stations_intro")}
                </p>
              </div>

              <div>
                <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  {t("about.gw_cgwb_modes_title")}
                </h5>
                <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-2">
                  <li>{t("about.gw_cgwb_modes_manual")}</li>
                  <li>{t("about.gw_cgwb_modes_telem")}</li>
                  <li>{t("about.gw_cgwb_modes_meta")}</li>
                </ul>
              </div>

              <div>
                <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  {t("about.gw_cgwb_quality_title")}
                </h5>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  {t("about.gw_cgwb_quality_intro")}
                </p>
                <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-2">
                  <li>
                    <span className="font-mono text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded">stuck</span>{" "}
                    {t("about.gw_cgwb_quality_stuck")}
                  </li>
                  <li>
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">stale</span>{" "}
                    {t("about.gw_cgwb_quality_stale")}
                  </li>
                  <li>
                    <span className="font-mono text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded">ok</span>{" "}
                    {t("about.gw_cgwb_quality_ok")}
                  </li>
                </ul>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">
                  {t("about.gw_cgwb_quality_ui")}
                </p>
              </div>
            </div>
          </SubSection>

          {/* 2.3 Water bodies & restoration (includes GEE NDWI + lost WBs + restoration priority) */}
          <SubSection id="page-water-bodies" title={t("about.page_wb_title")}>
            <p className="text-slate-600 dark:text-slate-400">
              {t("about.wb_map_desc")}
            </p>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("about.gee_surface_title")}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t("about.gee_surface_desc")}
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-3">
                <li>{t("about.gee_surface_step1")}</li>
                <li>{t("about.gee_surface_step2")}</li>
                <li>{t("about.gee_surface_step3")}</li>
                <li>{t("about.gee_surface_step4")}</li>
              </ul>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("about.gee_evidence_title")}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t("about.gee_evidence_desc")}
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-3">
                <li>{t("about.gee_evidence_step1")}</li>
                <li>{t("about.gee_evidence_step2")}</li>
                <li>{t("about.gee_evidence_step3")}</li>
                <li>{t("about.gee_evidence_step4")}</li>
              </ul>
            </div>

            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">{t("about.gee_thresholds_title")}</h4>
              <ul className="list-disc list-inside text-sm text-blue-800 dark:text-blue-200 space-y-2 mt-3">
                <li>{t("about.gee_thresholds_water")}</li>
                <li>{t("about.gee_thresholds_rain")}</li>
                <li>{t("about.gee_thresholds_confidence")}</li>
                <li>{t("about.gee_thresholds_scope")}</li>
              </ul>
            </div>

            {/* Restoration priority scoring */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("about.restoration")}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("about.restoration_desc")}
              </p>
              <div className="space-y-2">
                <div className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.restoration_comp_size")}</span>
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.restoration_comp_lost")}</span>
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.restoration_comp_river")}</span>
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.restoration_comp_industrial")}</span>
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.restoration_comp_type")}</span>
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                {t("about.restoration_note")}
              </p>
            </div>

            {/* Lost water bodies table */}
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">{t("about.wb_lost_heading")}</h4>
            {/* Desktop table */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                    <th className="pb-2 font-medium">{t("about.wb_col_name")}</th>
                    <th className="pb-2 font-medium">{t("about.wb_col_status")}</th>
                    <th className="pb-2 font-medium">{t("about.wb_col_source_ref")}</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  {LOST_WATER_BODY_SOURCES.map((row) => (
                    <tr key={row.name} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 font-medium">{row.name}</td>
                      <td className="py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.status === "Fully lost"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                            : row.status === "Severely reduced"
                            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                            : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                        }`}>
                          {row.status === "Fully lost"
                            ? t("about.fully_lost")
                            : row.status === "Severely reduced"
                            ? t("about.severely_reduced")
                            : t("about.partially_encroached")}
                        </span>
                      </td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {LOST_WATER_BODY_SOURCES.map((row) => (
                <div key={row.name} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{row.name}</span>
                    <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      row.status === "Fully lost"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        : row.status === "Severely reduced"
                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                        : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                    }`}>
                      {row.status === "Fully lost"
                        ? t("about.fully_lost")
                        : row.status === "Severely reduced"
                        ? t("about.severely_reduced")
                        : t("about.partially_encroached")}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{row.source}</div>
                </div>
              ))}
            </div>
          </SubSection>

          {/* 2.4 Rivers */}
          <SubSection id="page-rivers" title={t("about.page_rivers_title")}>
            <p className="text-slate-600 dark:text-slate-400">
              {t("about.river_map_desc")}
            </p>
          </SubSection>

          {/* 2.5 Flood */}
          <SubSection id="page-flood" title={t("about.page_flood_title")}>
            <p className="text-slate-600 dark:text-slate-400">
              {t("about.page_flood_desc")}
            </p>
          </SubSection>

          {/* 2.6 My Ward */}
          <SubSection id="page-my-ward" title={t("about.page_my_ward_title")}>
            <p className="text-slate-600 dark:text-slate-400">
              {t("about.page_my_ward_desc")}
            </p>

            {/* Report card methodology */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("about.report_card_title")}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("about.report_card_desc")}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                      <th className="pb-2 font-medium">Metric</th>
                      <th className="pb-2 font-medium">Weight</th>
                      <th className="pb-2 font-medium">Direction</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300 text-xs">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5">{t("uplift.factor_drainage")}</td>
                      <td className="py-1.5 font-mono">25%</td>
                      <td className="py-1.5">Higher = better</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5">{t("uplift.factor_sewerage_infra")}</td>
                      <td className="py-1.5 font-mono">25%</td>
                      <td className="py-1.5">Higher = better</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5">{t("uplift.factor_flood_risk")}</td>
                      <td className="py-1.5 font-mono">25%</td>
                      <td className="py-1.5">Lower = better</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5">{t("uplift.factor_wb_health")}</td>
                      <td className="py-1.5 font-mono">15%</td>
                      <td className="py-1.5">Lower = better</td>
                    </tr>
                    <tr>
                      <td className="py-1.5">{t("uplift.factor_wb_density")}</td>
                      <td className="py-1.5 font-mono">10%</td>
                      <td className="py-1.5">Higher = better</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("about.report_card_grading")}
              </p>
            </div>

            {/* Uplift planner methodology */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("about.uplift_title")}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("about.uplift_desc")}
              </p>

              <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                {t("about.uplift_how_title")}
              </h5>
              <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <li>{t("about.uplift_step1")}</li>
                <li>{t("about.uplift_step2")}</li>
                <li>{t("about.uplift_step3")}</li>
              </ol>

              <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide pt-1">
                {t("about.uplift_caps_title")}
              </h5>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("about.uplift_caps_desc")}
              </p>

              <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide pt-1">
                {t("about.uplift_costs_title")}
              </h5>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("about.uplift_costs_desc")}
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                      <th className="pb-2 font-medium">Intervention</th>
                      <th className="pb-2 font-medium">Cost/unit</th>
                      <th className="pb-2 font-medium">Metric</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300 text-xs">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5">{t("uplift.int_build_drain")}</td>
                      <td className="py-1.5 font-mono">1.5-3.0 Cr/km</td>
                      <td className="py-1.5">{t("uplift.factor_drainage")}</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5">{t("uplift.int_build_pumping_main")}</td>
                      <td className="py-1.5 font-mono">3.0-6.0 Cr/km</td>
                      <td className="py-1.5">{t("uplift.factor_sewerage_infra")}</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5">{t("uplift.int_flood_mitigation")}</td>
                      <td className="py-1.5 font-mono">5-15 Cr/zone</td>
                      <td className="py-1.5">{t("uplift.factor_flood_risk")}</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5">{t("uplift.int_restore_wb")}</td>
                      <td className="py-1.5 font-mono">2-8 Cr/body</td>
                      <td className="py-1.5">{t("uplift.factor_wb_health")}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5">{t("uplift.int_revive_wb")}</td>
                      <td className="py-1.5 font-mono">10-25 Cr/body</td>
                      <td className="py-1.5">{t("uplift.factor_wb_density")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </SubSection>

          {/* 2.7 Chennai Water Facts */}
          <SubSection id="page-facts" title={t("about.page_facts_title")}>
            <p className="text-slate-600 dark:text-slate-400">
              {t("about.page_facts_desc")}
            </p>
          </SubSection>
        </Section>

        {/* ──────────────────────────────────────────────────────────────
            3. Intelligence & AI narratives
            (daily briefing, AI narrative, ward profile - ward risk lives
             with the Groundwater page because that's where it's rendered)
            ────────────────────────────────────────────────────────────── */}
        <Section id="intelligence" title={t("about.intelligence")}>
          <p className="text-slate-600 dark:text-slate-400">
            {t("about.intelligence_intro")}
          </p>
          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.daily_briefing_title")}</span>
                <span className="text-slate-600 dark:text-slate-400"> {t("about.daily_briefing_desc")}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.ai_narrative_title")}</span>
                <span className="text-slate-600 dark:text-slate-400"> {t("about.ai_narrative_desc")}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="w-2 h-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.ward_profile_title")}</span>
                <span className="text-slate-600 dark:text-slate-400"> {t("about.ward_profile_desc")}</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ──────────────────────────────────────────────────────────────
            Cascade Reconstruction Methodology - shown only when the
            city has the overlay enabled. Anchor id is referenced from
            the on-map "Full methodology -->" link.
            ────────────────────────────────────────────────────────────── */}
        {CHENNAI.hasCascadeOverlay && cascadeStats && (
          <Section
            id="cascade-methodology"
            title="Cascade reconstruction methodology - Chennai"
          >
            <CascadeMethodologySection
              cityDisplayName="Chennai"
              nodeCount={cascadeStats.node_count}
              edgeCount={cascadeStats.edge_count}
              riverOutletCount={cascadeStats.river_outlet_count}
              maxCascadeDepth={cascadeStats.max_cascade_depth}
              topConvergenceExample={
                resolveConvergenceExample(cascadeStats) ?? undefined
              }
            />
          </Section>
        )}

        {/* ──────────────────────────────────────────────────────────────
            4. Data Source Index - grouped by data domain
            ────────────────────────────────────────────────────────────── */}
        <Section id="data-sources" title={t("about.data_sources")}>
          <p className="text-slate-600 dark:text-slate-400">
            {t("about.data_pipeline")}
            {" "}{t("about.data_pipeline2")}
          </p>
          <div className="space-y-3">
            <DataSourceGroupHeader title={t("about.ds_group_reservoir")} />
            <DataSource
              name="CMWSSB Lake Level Page"
              url="https://cmwssb.tn.gov.in/lake-level"
              description={t("about.ds_cmwssb_desc")}
              frequency={t("about.freq_daily_scraped")}
            />
            <DataSource
              name="Open-Meteo"
              url="https://open-meteo.com/"
              description={t("about.ds_open_meteo_desc")}
              frequency={t("about.freq_daily")}
            />
            <DataSource
              name="NASA POWER (fallback)"
              url="https://power.larc.nasa.gov/"
              description={t("about.ds_nasa_desc")}
              frequency={t("about.freq_daily_lag")}
            />
            <DataSource
              name="OpenCity Chennai (Lake Storage)"
              url="https://data.opencity.in/"
              description={t("about.ds_opencity_lake_desc")}
              frequency={t("about.freq_historical")}
            />
            <DataSource
              name="IMD Gridded Rainfall (via imdlib)"
              url="https://imdlib.readthedocs.io/"
              description={t("about.ds_imd_desc")}
              frequency={t("about.freq_one_time_gen")}
            />

            <DataSourceGroupHeader title={t("about.ds_group_gw")} />
            <DataSource
              name="India WRIS Ground Water Level API (CGWB Stations)"
              url="https://indiawris.gov.in/Dataset/Ground%20Water%20Level"
              description={t("about.ds_wris_stations_desc")}
              frequency={t("about.freq_daily")}
            />
            <DataSource
              name="India WRIS / CGWB (Block Exploitation)"
              url="https://indiawris.gov.in/"
              description={t("about.ds_cgwb_desc")}
              frequency={t("about.freq_static_fetch")}
            />
            <DataSource
              name="OpenCity Chennai (Groundwater)"
              url="https://data.opencity.in/"
              description={t("about.ds_opencity_gw_desc")}
              frequency={t("about.freq_monthly")}
            />

            <DataSourceGroupHeader title={t("about.ds_group_wb")} />
            <DataSource
              name="First Census of Water Bodies (data.gov.in)"
              url="https://data.gov.in/resource/state-wise-data-first-census-water-bodies-tamil-nadu"
              description={t("about.ds_census_wb_desc")}
              frequency={t("about.freq_one_time")}
            />
            <DataSource
              name="Kaggle Chennai Water Management"
              url="https://www.kaggle.com/datasets/sudalairajkumar/chennai-water-management"
              description={t("about.ds_kaggle_desc")}
              frequency={t("about.freq_one_time")}
            />
            <DataSource
              name="Care Earth Trust / NGT / CMDA: Lost Water Bodies"
              url="https://www.careearth.org/"
              description={t("about.ds_careearth_desc")}
              frequency={t("about.freq_manual")}
            />

            <DataSourceGroupHeader title={t("about.ds_group_rivers")} />
            <DataSource
              name="Chennai Rivers Restoration Trust (CRRT)"
              url="https://www.crrt.tn.gov.in/"
              description={t("about.ds_crrt_desc")}
              frequency={t("about.freq_manual")}
            />
            <DataSource
              name="CPCB National Water Monitoring Programme (NWMP)"
              url="https://cpcb.nic.in/nwmp-data-2024/"
              description={t("about.ds_cpcb_desc")}
              frequency={t("about.freq_annual")}
            />
            <DataSource
              name="Nethaji Mariappan et al. (2017): Cooum Sewage Inlets"
              url="https://neptjournal.com/upload-images/NL-61-47-(45)B-3437.pdf"
              description={t("about.ds_sewage_inlets_desc")}
              frequency={t("about.freq_one_time")}
            />
            <DataSource
              name="NGT Southern Bench / TNPCB / CPCB: Industrial Pollution Sources"
              url="https://www.tnpcb.gov.in/"
              description={t("about.ds_ngt_desc")}
              frequency={t("about.freq_manual")}
            />

            <DataSourceGroupHeader title={t("about.ds_group_flood")} />
            <DataSource
              name="OpenCity Chennai (Flood Hazard Data)"
              url="https://data.opencity.in/"
              description={t("about.ds_flood_desc")}
              frequency={t("about.freq_static")}
            />
            <DataSource
              name="GCC Storm Water Drain Survey"
              url="https://data.opencity.in/dataset/chennai-stormwater-drain-swd-maps"
              description={t("about.ds_swd_desc")}
              frequency={t("about.freq_static")}
            />
            <DataSource
              name="CMWSSB Sewerage Network"
              url="https://data.opencity.in/dataset/chennai-sewerage-collection-system"
              description={t("about.ds_sewerage_desc")}
              frequency={t("about.freq_static")}
            />

            <DataSourceGroupHeader title={t("about.ds_group_satellite")} />
            <DataSource
              name="NDWI Water Detection (via Sentinel-2)"
              url="https://en.wikipedia.org/wiki/Normalized_difference_water_index"
              description={t("about.ds_ndwi_desc")}
              frequency={t("about.freq_periodic_summary")}
            />
            <DataSource
              name="JRC Global Surface Water (Monthly Recurrence)"
              url="https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_MonthlyRecurrence"
              description={t("about.ds_gee_jrc_desc")}
              frequency={t("about.freq_historical_monthly")}
            />
            <DataSource
              name="CHIRPS Daily Rainfall"
              url="https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY"
              description={t("about.ds_gee_chirps_desc")}
              frequency={t("about.freq_daily")}
            />
            <DataSource
              name="Copernicus Sentinel-2 (via Earth Engine)"
              url="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED"
              description={t("about.ds_sentinel2_desc")}
              frequency={t("about.freq_evidence_refresh")}
            />
            <DataSource
              name="HydroBASINS / MERIT Hydro"
              url="https://www.hydrosheds.org/products/hydrobasins"
              description={t("about.ds_gee_catchments_desc")}
              frequency={t("about.freq_static_fetch")}
            />

            <DataSourceGroupHeader title={t("about.ds_group_base")} />
            <DataSource
              name="OpenStreetMap (Overpass API)"
              url="https://overpass-api.de/"
              description={t("about.ds_osm_desc")}
              frequency={t("about.freq_static")}
            />

            <DataSourceGroupHeader title={t("about.ds_group_ai")} />
            <DataSource
              name="Anthropic Claude API"
              url="https://docs.anthropic.com/"
              description={t("about.ds_anthropic_desc")}
              frequency={t("about.freq_daily_monthly")}
            />
          </div>
        </Section>

        {/* ──────────────────────────────────────────────────────────────
            5. Data quality & limitations - merged section
            ────────────────────────────────────────────────────────────── */}
        <Section id="data-quality" title={t("about.group_quality")}>
          <SubSection title="How we classify river health">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              CPCB publishes <span className="font-semibold">two parallel</span> river-water-quality classification systems, and they don&apos;t always agree. Knowing which one drives our river status badges matters for reading the dashboard honestly.
            </p>
            <div className="space-y-3 mt-3">
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Designated Best-Use classes (A-E)</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Computed from <span className="font-semibold">current</span> dissolved-oxygen, BOD and coliform thresholds at each NWMP station. Updates every reading. Class A = drinking with disinfection only; Class B = outdoor bathing; Class C = drinking with conventional treatment; Class D = fisheries/wildlife; Class E = irrigation only. <span className="font-semibold">Below E = practically dead.</span>
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Polluted River Stretch (PRS) Priority I-V</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  A <span className="font-semibold">historical, multi-year</span> stretch-level designation reflecting cumulative pollution. Slow to update; once a stretch is on the list it tends to stay there even if recent readings improve. Priority I = worst, Priority V = least bad of the polluted stretches.
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">
              <span className="font-semibold">Our status badges (&quot;dead&quot;, &quot;severely degraded&quot;, &quot;degraded&quot;, &quot;stressed&quot;, &quot;healthy&quot;) are computed from current readings via the Designated Best-Use thresholds</span> — not from the PRS Priority list. We take the worst classification across a river&apos;s monitored stations and surface that as the river-level status. Cooum, Adyar, and Buckingham Canal hold their labels under both signals (data and PRS Priority I agree); rivers where the two disagree (Vaigai&apos;s PRS Priority III vs Class C/D NWMP readings) reflect what the data shows now.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
              Methodology lives in <span className="font-mono">src/lib/utils/river-classification.ts</span>; readings come from CPCB NWMP annual River Water Quality reports.
            </p>
          </SubSection>

          <SubSection title={t("about.data_quality")}>
            <p className="text-slate-600 dark:text-slate-400">
              {t("about.dq_intro")}
            </p>
            <div className="space-y-3">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  {t("about.dq_census_units_title")}
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t("about.dq_census_units_desc")}
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  {t("about.dq_census_capacity_title")}
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t("about.dq_census_capacity_desc")}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  {t("about.dq_census_shape_title")}
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t("about.dq_census_shape_desc")}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  {t("about.dq_satellite_baseline_title")}
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t("about.dq_satellite_baseline_desc")}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  {t("about.dq_catchment_geometry_title")}
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t("about.dq_catchment_geometry_desc")}
                </p>
              </div>
            </div>
          </SubSection>

          <SubSection title={t("about.limitations")}>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 text-sm">
              <li>{t("about.limit1")}</li>
              <li>{t("about.limit2")}</li>
              <li>{t("about.limit3")}</li>
              <li>{t("about.limit4")}</li>
              <li>{t("about.limit5")}</li>
              <li>{t("about.limit6")}</li>
              <li>{t("about.limit7")}</li>
              <li>{t("about.limit8")}</li>
            </ul>
          </SubSection>
        </Section>

        {/* ──────────────────────────────────────────────────────────────
            6. About the project - disclaimer + open source
            ────────────────────────────────────────────────────────────── */}
        <Section id="about-project" title={t("about.group_project")}>
          <SubSection title={t("about.disclaimer")}>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <p>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.disclaimer_gov_title")}</span>{" "}
                {t("about.disclaimer_gov_desc")}
              </p>
              <p>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.disclaimer_info_title")}</span>{" "}
                {t("about.disclaimer_info_desc")}
              </p>
              <p>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.disclaimer_privacy_title")}</span>{" "}
                {t("about.disclaimer_privacy_desc")}
              </p>
            </div>
          </SubSection>

          <SubSection title={t("about.open_source")}>
            <p className="text-slate-600 dark:text-slate-400">
              {t("about.open_source_desc")}
            </p>
            <a
              href="https://github.com/SundareshPrasanna/neer-vazhvu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              {t("about.view_github")}
            </a>
          </SubSection>

          <SubSection title={t("about.support")}>
            <p className="text-slate-600 dark:text-slate-400">
              {t("about.support_desc")}
            </p>
            <a
              href="https://www.patreon.com/NeerVazhvu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF424D] text-white rounded-lg text-sm font-medium hover:bg-[#e03840] transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15.386 2c-3.49 0-6.322 2.832-6.322 6.322 0 3.49 2.832 6.322 6.322 6.322 3.49 0 6.322-2.832 6.322-6.322C21.708 4.832 18.876 2 15.386 2M2.292 22h3.449V2H2.292v20z" />
              </svg>
              {t("about.view_patreon")}
            </a>
          </SubSection>
        </Section>

      </div>
    </div>
  );
}

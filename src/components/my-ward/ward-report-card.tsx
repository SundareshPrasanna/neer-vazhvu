"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { loadProfiles, type WardProfile } from "@/lib/hooks/use-ward-profile";
import { useWardRepresentatives } from "@/lib/hooks/use-ward-representatives";
import {
  computeWardRankings,
  type WardRankings,
  type Grade,
} from "@/lib/utils/ward-rankings";

/* ── Grade colors ───────────────────────────────────────────────────── */

const GRADE_STYLES: Record<Grade, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  B: { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200" },
  C: { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  D: { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200" },
  F: { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200" },
};

const GRADE_PRINT: Record<Grade, string> = {
  A: "Excellent", B: "Good", C: "Average", D: "Below average", F: "Needs attention",
};

function GradeBadge({ grade, size = "sm" }: { grade: Grade; size?: "sm" | "lg" }) {
  const s = GRADE_STYLES[grade];
  const cls = size === "lg"
    ? `w-16 h-16 text-3xl font-black rounded-xl border-2 ${s.bg} ${s.text} ${s.border}`
    : `w-7 h-7 text-sm font-bold rounded-md border ${s.bg} ${s.text} ${s.border}`;
  return (
    <div className={`inline-flex items-center justify-center ${cls} report-grade`}>
      {grade}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────── */

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <span className="relative inline-flex print:hidden" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 text-[9px] font-bold leading-none"
        aria-label="More info"
      >
        i
      </button>
      {open && (
        <div className="absolute left-0 top-5 z-10 w-64 p-2.5 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg leading-relaxed">
          {text}
        </div>
      )}
    </span>
  );
}

export function WardReportCard() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [rankings, setRankings] = useState<WardRankings | null>(null);
  const [allProfiles, setAllProfiles] = useState<WardProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const wardParam = searchParams.get("ward");
  const wardNumber = wardParam ? parseInt(wardParam, 10) || null : null;

  const { representatives } = useWardRepresentatives(wardNumber);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (wardNumber == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRankings(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    setLoading(true);
    loadProfiles().then((profiles) => {
      setAllProfiles(profiles);
      const r = computeWardRankings(wardNumber, profiles);
      setRankings(r);
      setLoading(false);
    });
  }, [wardNumber]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        Loading...
      </div>
    );
  }

  if (wardNumber == null) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t("report.title")}
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          {t("report.select_ward")}
        </p>
        <Link
          href="/my-ward"
          className="inline-block px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          &larr; {t("report.go_to_my_ward")}
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        Loading report...
      </div>
    );
  }

  if (!rankings) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-500">
        Ward {wardNumber} not found.
      </div>
    );
  }

  // Get ward profile for additional details
  const ward = allProfiles.find((p) => p.ward_number === wardNumber);

  return (
    <div className="report-card max-w-3xl mx-auto px-4 sm:px-8 py-6 print:px-0 print:py-0">
      {/* Print button - hidden in print */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link
          href={`/my-ward?ward=${wardNumber}`}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          &larr; {t("report.back_to_ward")}
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          {t("my_ward.print")}
        </button>
      </div>

      {/* ── Report Card Container ─────────────────────────────── */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 print:border-slate-300 print:rounded-none print:shadow-none overflow-hidden">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="bg-slate-50 dark:bg-slate-800 px-6 py-5 border-b border-slate-200 dark:border-slate-700 print:bg-white print:border-slate-300">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                {t("report.title")}
              </p>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 print:text-black">
                {t("ward.ward")} {wardNumber} - {rankings.zoneName}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {t("report.zone")} {rankings.zoneNo} - {rankings.zoneName}
              </p>
            </div>
            <div className="text-center shrink-0">
              <GradeBadge grade={rankings.overallGrade} size="lg" />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {t("report.overall")}
              </p>
            </div>
          </div>
        </div>

        {/* ── Overall summary row ─────────────────────────────── */}
        <div className="px-6 py-3 bg-slate-25 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("report.percentile_prefix")} <span className="font-semibold text-slate-900 dark:text-slate-100">{rankings.overallPercentile}th</span> {t("report.percentile_suffix")}
            {" - "}
            <span className={`font-medium ${GRADE_STYLES[rankings.overallGrade].text}`}>
              {GRADE_PRINT[rankings.overallGrade]}
            </span>
          </p>
        </div>

        {/* ── Metrics table ───────────────────────────────────── */}
        <div className="px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="pb-2 pr-2">{t("report.col_metric")}</th>
                <th className="pb-2 pr-2 text-right">{t("report.col_value")}</th>
                <th className="pb-2 pr-2 text-right">{t("report.col_zone_avg")}</th>
                <th className="pb-2 pr-2 text-right">{t("report.col_city_avg")}</th>
                <th className="pb-2 pr-2 text-center">{t("report.col_rank")}</th>
                <th className="pb-2 text-center">{t("report.col_grade")}</th>
              </tr>
            </thead>
            <tbody>
              {rankings.metrics.map((m) => {
                const graded = m.value != null && !Number.isNaN(m.value) && m.grade != null;

                // Compare ward value to averages, accounting for metric direction
                function compArrow(avg: number | null) {
                  if (!graded || avg == null) return { arrow: "", color: "text-slate-400" };
                  const diff = m.value! - avg;
                  const isBetter = m.higherIsBetter ? diff >= 0 : diff <= 0;
                  return {
                    arrow: Math.abs(diff) < 0.1 ? "=" : isBetter ? "\u25B2" : "\u25BC",
                    color: Math.abs(diff) < 0.1 ? "text-slate-400" : isBetter ? "text-emerald-600" : "text-red-500",
                  };
                }
                const zone = compArrow(m.zoneAvg);
                const city = compArrow(m.cityAvg);

                return (
                  <tr
                    key={m.key}
                    className={`border-b border-slate-50 dark:border-slate-800/50 last:border-0 ${!graded ? "opacity-50" : ""}`}
                  >
                    <td className="py-2.5 pr-2 text-slate-700 dark:text-slate-300 print:text-black">
                      {t(m.label)}
                      {m.unit && <span className="text-xs text-slate-400 ml-1">{m.unit}</span>}
                      <InfoTooltip text={t(m.description)} />
                    </td>
                    <td className="py-2.5 pr-2 text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums print:text-black">
                      {graded ? m.value : "-"}
                    </td>
                    <td className="py-2.5 pr-2 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                      {graded ? (
                        <>
                          {m.zoneAvg}
                          <span className={`ml-1.5 text-xs ${zone.color}`}>{zone.arrow}</span>
                        </>
                      ) : "-"}
                    </td>
                    <td className="py-2.5 pr-2 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                      {graded ? (
                        <>
                          {m.cityAvg}
                          <span className={`ml-1.5 text-xs ${city.color}`}>{city.arrow}</span>
                        </>
                      ) : "-"}
                    </td>
                    <td className="py-2.5 pr-2 text-center text-slate-600 dark:text-slate-400 tabular-nums">
                      {graded ? (
                        <>#{m.rank}<span className="text-slate-400 text-xs">/{m.total}</span></>
                      ) : "-"}
                    </td>
                    <td className="py-2.5 text-center">
                      {m.grade ? <GradeBadge grade={m.grade} /> : <span className="text-slate-400">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Quick facts ─────────────────────────────────────── */}
        {ward && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              {t("report.quick_facts")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-slate-400 dark:text-slate-500 text-xs">{t("report.fact_dominant_flood")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black capitalize">
                  {ward.flood.dominant_hazard ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500 text-xs">{t("report.fact_flood_hotspots")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                  {ward.flood.hotspot_2015_count + ward.flood.hotspot_2020_count}
                  <span className="text-xs text-slate-400 ml-1">(2015+2020)</span>
                </p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500 text-xs">{t("report.fact_stps")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                  {ward.sewerage.stp_count}
                  {ward.sewerage.total_stp_capacity_mld > 0 && (
                    <span className="text-xs text-slate-400 ml-1">
                      ({ward.sewerage.total_stp_capacity_mld} MLD)
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500 text-xs">{t("report.fact_pumping")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                  {ward.sewerage.sps_count} {t("my_ward.pumping_stations")}
                </p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500 text-xs">{t("report.fact_industrial")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                  {ward.industrial.zone_count === 0
                    ? t("report.none")
                    : `${ward.industrial.zone_count} zone${ward.industrial.zone_count !== 1 ? "s" : ""}`}
                </p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500 text-xs">{t("report.fact_water_body_names")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black text-xs leading-relaxed">
                  {ward.water_bodies.top_bodies.length > 0
                    ? ward.water_bodies.top_bodies.map((b) => b.name).join(", ")
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Representatives ─────────────────────────────────── */}
        {representatives && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              {t("report.representatives")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">{t("report.councillor")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                  {representatives.councillor.name}
                </p>
                <p className="text-xs text-slate-500">{representatives.councillor.party}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t("report.mla")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                  {representatives.mla.name}
                </p>
                <p className="text-xs text-slate-500">
                  {representatives.mla.party} - {representatives.mla.constituency}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t("report.mp")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                  {representatives.mp.name}
                </p>
                <p className="text-xs text-slate-500">
                  {representatives.mp.party} - {representatives.mp.constituency}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 print:bg-white">
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
            <span>{t("report.generated_by")}</span>
            <span>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {t("report.data_sources")}
          </p>
        </div>
      </div>

      {/* ── Methodology disclosure (below card, shown on print too) */}
      <div className="mt-4 px-2 text-xs text-slate-400 dark:text-slate-500 print:text-slate-600 space-y-2">
        <p className="font-medium">{t("report.grade_legend")}</p>
        <p>A = Top 20% | B = 21-40% | C = 41-60% | D = 61-80% | F = Bottom 20%</p>
        <p>{t("report.ranking_note")}</p>
        <details className="mt-2">
          <summary className="font-medium cursor-pointer hover:text-slate-600 dark:hover:text-slate-300">
            {t("report.methodology")}
          </summary>
          <p className="mt-1 leading-relaxed">{t("report.methodology_body")}</p>
        </details>
        <details>
          <summary className="font-medium cursor-pointer hover:text-slate-600 dark:hover:text-slate-300">
            {t("report.limitations")}
          </summary>
          <p className="mt-1 leading-relaxed whitespace-pre-line">{t("report.limitations_body")}</p>
        </details>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
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
import { ShareMenu } from "@/components/share-menu";

/* ── Grade colors ───────────────────────────────────────────────────── */

const GRADE_STYLES: Record<Grade, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  B: { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200" },
  C: { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  D: { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200" },
  F: { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200" },
};

const GRADE_PRINT_KEY: Record<Grade, string> = {
  A: "report.grade_label_a",
  B: "report.grade_label_b",
  C: "report.grade_label_c",
  D: "report.grade_label_d",
  F: "report.grade_label_f",
};

const METRIC_NUMBER_FORMAT = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

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

function InfoTooltip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }

    function closeOnEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <span className="relative inline-flex print:hidden" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 text-[9px] font-bold leading-none"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
      >
        i
      </button>
      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute left-1/2 top-5 z-10 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs leading-relaxed text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:left-0 sm:translate-x-0"
        >
          {text}
        </div>
      )}
    </span>
  );
}

export function WardReportCard() {
  const searchParams = useSearchParams();
  const { language, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [rankings, setRankings] = useState<WardRankings | null>(null);
  const [allProfiles, setAllProfiles] = useState<WardProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const wardParam = searchParams.get("ward");
  const wardNumber = wardParam ? parseInt(wardParam, 10) || null : null;

  const { representatives } = useWardRepresentatives(wardNumber);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (wardNumber == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRankings(null);
      setAllProfiles([]);
      setLoadError(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    loadProfiles()
      .then((profiles) => {
        if (cancelled) return;
        setAllProfiles(profiles);
        const r = computeWardRankings(wardNumber, profiles);
        setRankings(r);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAllProfiles([]);
        setRankings(null);
        setLoadError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [wardNumber]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        {t("report.loading")}
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
        {t("report.loading_report")}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-500">
        {t("report.load_error")}
      </div>
    );
  }

  if (!rankings) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-500">
        {t("report.ward_not_found").replace("{ward}", String(wardNumber))}
      </div>
    );
  }

  // Get ward profile for additional details
  const ward = allProfiles.find((p) => p.ward_number === wardNumber);

  function formatMetricNumber(value: number): string {
    return METRIC_NUMBER_FORMAT.format(value);
  }

  function formatOrdinal(value: number): string {
    if (language !== "en") return String(value);
    const mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
    switch (value % 10) {
      case 1:
        return `${value}st`;
      case 2:
        return `${value}nd`;
      case 3:
        return `${value}rd`;
      default:
        return `${value}th`;
    }
  }

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
        <div className="flex items-center gap-2">
          <ShareMenu
            url={typeof window !== "undefined" ? `${window.location.origin}/my-ward/report?ward=${wardNumber}` : `/my-ward/report?ward=${wardNumber}`}
            title={`Ward ${wardNumber} Report Card | Neer Vazhvu`}
            description={rankings ? `Grade ${rankings.overallGrade} - Ranked #${rankings.overallRank} of ${rankings.overallTotal}` : undefined}
            ogImageUrl={`/api/og/ward?ward=${wardNumber}`}
          />
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
                {t("ward.ward")} {wardNumber}
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
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("report.percentile_prefix")} <span className="font-semibold text-slate-900 dark:text-slate-100">{formatOrdinal(rankings.overallPercentile)}</span> {t("report.percentile_suffix")}
            {" - "}
            <span className={`font-medium ${GRADE_STYLES[rankings.overallGrade].text}`}>
              {t(GRADE_PRINT_KEY[rankings.overallGrade])}
            </span>
          </p>
        </div>

        {/* ── Metrics table ───────────────────────────────────── */}
        <div className="px-6 py-4">
          <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[42rem] text-sm print:min-w-0 sm:min-w-0">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th scope="col" className="pb-2 pr-2">{t("report.col_metric")}</th>
                <th scope="col" className="pb-2 pr-2 text-right">{t("report.col_value")}</th>
                <th scope="col" className="pb-2 pr-2 text-right">{t("report.col_zone_avg")}</th>
                <th scope="col" className="pb-2 pr-2 text-right">{t("report.col_city_avg")}</th>
                <th scope="col" className="pb-2 pr-2 text-center">{t("report.col_rank")}</th>
                <th scope="col" className="pb-2 text-center">{t("report.col_grade")}</th>
              </tr>
            </thead>
            <tbody>
              {rankings.metrics.map((m) => {
                const graded = m.value != null && !Number.isNaN(m.value) && m.grade != null;

                // Compare the ward value to the zone/city median.
                function compArrow(avg: number | null) {
                  if (!graded || avg == null) {
                    return { arrow: "", color: "text-slate-400", srLabel: "" };
                  }

                  const diff = m.value! - avg;
                  if (Math.abs(diff) < 0.1) {
                    return {
                      arrow: "=",
                      color: "text-slate-400",
                      srLabel: t("report.arrow_same"),
                    };
                  }

                  const isBetter = m.higherIsBetter ? diff >= 0 : diff <= 0;
                  return {
                    arrow: diff > 0 ? "\u25B2" : "\u25BC",
                    color: isBetter ? "text-emerald-600" : "text-red-500",
                    srLabel: isBetter ? t("report.arrow_better") : t("report.arrow_worse"),
                  };
                }
                const zone = compArrow(m.zoneMedian);
                const city = compArrow(m.cityMedian);

                return (
                  <tr
                    key={m.key}
                    className={`border-b border-slate-50 dark:border-slate-800/50 last:border-0 ${!graded ? "opacity-50" : ""}`}
                  >
                    <td className="py-2.5 pr-2 text-slate-700 dark:text-slate-300 print:text-black">
                      {t(m.label)}
                      {m.unit && <span className="text-xs text-slate-400 ml-1">{m.unit}</span>}
                      <InfoTooltip text={t(m.description)} label={t("report.more_info")} />
                    </td>
                    <td className="py-2.5 pr-2 text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums print:text-black">
                      {graded ? formatMetricNumber(m.value!) : "-"}
                    </td>
                    <td className="py-2.5 pr-2 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                      {graded ? (
                        <>
                          {formatMetricNumber(m.zoneMedian!)}
                          {zone.arrow && (
                            <span className={`ml-1.5 text-xs ${zone.color}`}>
                              <span aria-hidden="true">{zone.arrow}</span>
                              <span className="sr-only">{zone.srLabel}</span>
                            </span>
                          )}
                        </>
                      ) : "-"}
                    </td>
                    <td className="py-2.5 pr-2 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                      {graded ? (
                        <>
                          {formatMetricNumber(m.cityMedian!)}
                          {city.arrow && (
                            <span className={`ml-1.5 text-xs ${city.color}`}>
                              <span aria-hidden="true">{city.arrow}</span>
                              <span className="sr-only">{city.srLabel}</span>
                            </span>
                          )}
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
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 print:hidden">
            {t("report.action_cta")}{" "}
            <Link
              href={`/my-ward?ward=${wardNumber}`}
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {t("report.action_link")}
            </Link>
          </p>
        </div>

        {/* ── Quick facts ─────────────────────────────────────── */}
        {ward && (() => {
          // Sections marked _data_status: "not_available" (e.g. Madurai
          // without public CFLOWS / drainage / sewerage layers) collapse
          // to a placeholder dash instead of crashing or fabricating zero.
          // Read each into a narrowed local up-front so TypeScript keeps
          // the narrow inside the JSX below.
          const floodSec = "_data_status" in ward.flood ? null : ward.flood;
          const sewerSec = "_data_status" in ward.sewerage ? null : ward.sewerage;
          const industrialSec = "_data_status" in ward.industrial ? null : ward.industrial;
          return (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              {t("report.quick_facts")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-slate-400 dark:text-slate-500 text-xs">{t("report.fact_dominant_flood")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black capitalize">
                  {floodSec ? (floodSec.dominant_hazard ?? "-") : "-"}
                </p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500 text-xs">{t("report.fact_flood_hotspots")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                  {floodSec ? floodSec.hotspot_2015_count + floodSec.hotspot_2020_count : "-"}
                  <span className="text-xs text-slate-400 ml-1">{t("report.fact_flood_hotspots_years")}</span>
                </p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500 text-xs">{t("report.fact_stps")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                  {sewerSec ? sewerSec.stp_count : "-"}
                  {sewerSec && sewerSec.total_stp_capacity_mld > 0 && (
                    <span className="text-xs text-slate-400 ml-1">
                      ({sewerSec.total_stp_capacity_mld} MLD)
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500 text-xs">{t("report.fact_pumping")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                  {sewerSec ? `${sewerSec.sps_count} ${t("my_ward.pumping_stations")}` : "-"}
                </p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500 text-xs">{t("report.fact_industrial")}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                  {!industrialSec
                    ? "-"
                    : industrialSec.zone_count === 0
                      ? t("report.none")
                      : t(
                          industrialSec.zone_count === 1
                            ? "report.zone_count_one"
                            : "report.zone_count_other",
                        ).replace("{count}", String(industrialSec.zone_count))}
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
          );
        })()}

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
            <span>
              {new Date().toLocaleDateString(language === "ta" ? "ta-IN" : "en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {t("report.data_sources")}
          </p>
        </div>
      </div>

      {/* ── Methodology disclosure (below card, shown on print too) */}
      <div className="mt-4 px-2 text-xs text-slate-400 dark:text-slate-500 print:text-slate-600 space-y-2">
        <p className="font-medium">{t("report.grade_legend")}</p>
        <p>{t("report.grade_scale_detail")}</p>
        <p>{t("report.ranking_note")}</p>
        <div className="hidden print:block space-y-2">
          <p className="font-medium">{t("report.methodology")}</p>
          <p className="leading-relaxed">{t("report.methodology_body")}</p>
          <p className="font-medium">{t("report.limitations")}</p>
          <p className="leading-relaxed whitespace-pre-line">{t("report.limitations_body")}</p>
        </div>
        <details className="mt-2 print:hidden">
          <summary className="font-medium cursor-pointer hover:text-slate-600 dark:hover:text-slate-300">
            {t("report.methodology")}
          </summary>
          <p className="mt-1 leading-relaxed">{t("report.methodology_body")}</p>
        </details>
        <details className="print:hidden">
          <summary className="font-medium cursor-pointer hover:text-slate-600 dark:hover:text-slate-300">
            {t("report.limitations")}
          </summary>
          <p className="mt-1 leading-relaxed whitespace-pre-line">{t("report.limitations_body")}</p>
        </details>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import type { WardRankings, Grade } from "@/lib/utils/ward-rankings";
import { GRADE_STYLES, GRADE_PRINT_KEY, GradeBadge } from "@/lib/utils/grade-styles";
import { InfoTooltip } from "./info-tooltip";

const METRIC_PAGE: Record<string, string> = {
  wb_health: "/water-bodies",
  wb_density: "/water-bodies",
  flood_risk: "/flood-risk?view=hazard",
  drainage: "/flood-risk?view=drainage",
  sewerage_infra: "/flood-risk?view=sewerage",
};

const NUMBER_FORMAT = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function formatValue(value: number | null): string {
  if (value == null) return "-";
  return NUMBER_FORMAT.format(value);
}

function bestAndWorst(
  rankings: WardRankings[],
  metricKey: string,
): { bestIdx: number; worstIdx: number } {
  let bestIdx = -1;
  let worstIdx = -1;
  let bestRank = Infinity;
  let worstRank = -Infinity;

  rankings.forEach((r, idx) => {
    const m = r.metrics.find((entry) => entry.key === metricKey);
    if (!m || m.rank == null) return;
    if (m.rank < bestRank) { bestRank = m.rank; bestIdx = idx; }
    if (m.rank > worstRank) { worstRank = m.rank; worstIdx = idx; }
  });

  return { bestIdx, worstIdx };
}

function overallBestAndWorst(rankings: WardRankings[]): { bestIdx: number; worstIdx: number } {
  let bestIdx = 0;
  let worstIdx = 0;
  for (let i = 1; i < rankings.length; i++) {
    if (rankings[i].overallRank < rankings[bestIdx].overallRank) bestIdx = i;
    if (rankings[i].overallRank > rankings[worstIdx].overallRank) worstIdx = i;
  }
  return { bestIdx, worstIdx };
}

function cellRole(idx: number, bestIdx: number, worstIdx: number, count: number): "best" | "worst" | null {
  if (count < 2) return null;
  if (bestIdx === worstIdx) return null; // all tied
  if (idx === bestIdx) return "best";
  if (idx === worstIdx) return "worst";
  return null;
}

function cellBg(role: "best" | "worst" | null): string {
  if (role === "best") return "bg-emerald-50/60 dark:bg-emerald-950/20 rounded-lg";
  return "";
}

interface ComparisonTableProps {
  rankings: WardRankings[];
}

export function ComparisonTable({ rankings }: ComparisonTableProps) {
  const { t } = useLanguage();

  if (rankings.length === 0) return null;

  const overallHL = overallBestAndWorst(rankings);
  // Use first ranking's metrics as the canonical list
  const metricKeys = rankings[0].metrics.map((m) => m.key);

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="comparison-table w-full text-sm">
          {/* Column headers: ward names */}
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th scope="col" className="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t("report.col_metric")}
              </th>
              {rankings.map((r) => (
                <th key={r.wardNumber} scope="col" className="pb-2 px-2 text-center">
                  <Link href={`/my-ward/report?ward=${r.wardNumber}`} className="group">
                    <p className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-sm">
                      {t("ward.ward")} {r.wardNumber}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-normal">{r.zoneName}</p>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Overall row */}
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <td className="py-2 pr-3 font-semibold text-slate-700 dark:text-slate-300 text-sm">
                {t("compare.overall")}
              </td>
              {rankings.map((r, idx) => (
                <td key={r.wardNumber} className="py-2 px-2">
                  <Link href={`/my-ward/report?ward=${r.wardNumber}`} className={`flex flex-col items-center gap-0.5 py-1 px-1.5 hover:bg-slate-100/80 dark:hover:bg-slate-700/30 transition-colors rounded-lg ${cellBg(cellRole(idx, overallHL.bestIdx, overallHL.worstIdx, rankings.length))}`}>
                    <GradeBadge grade={r.overallGrade} size="sm" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                      #{r.overallRank}<span className="text-slate-400">/{r.overallTotal}</span>
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {r.overallPercentile}%
                    </span>
                  </Link>
                </td>
              ))}
            </tr>

            {/* Metric rows */}
            {metricKeys.map((key) => {
              const hl = bestAndWorst(rankings, key);
              const metricDef = rankings[0].metrics.find((m) => m.key === key);
              return (
                <tr key={key} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-300 text-sm">
                    <span className="inline-flex items-center flex-wrap">
                      {METRIC_PAGE[key] ? (
                        <Link href={METRIC_PAGE[key]} className="group hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          <span>{t(metricDef?.label ?? key)}</span>
                          <span className="text-xs text-slate-400 ml-1">
                            {metricDef?.unit}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600 group-hover:text-blue-400 ml-1 text-xs print:hidden">&rarr;</span>
                        </Link>
                      ) : (
                        <>
                          <span>{t(metricDef?.label ?? key)}</span>
                          <span className="text-xs text-slate-400 ml-1">
                            {metricDef?.unit}
                          </span>
                        </>
                      )}
                      {metricDef?.description && (
                        <InfoTooltip text={t(metricDef.description)} label={t("report.more_info")} />
                      )}
                    </span>
                  </td>
                  {rankings.map((r, idx) => {
                    const m = r.metrics.find((entry) => entry.key === key);
                    if (!m || m.value == null || m.grade == null) {
                      return (
                        <td key={r.wardNumber} className="py-2 px-2 text-center text-slate-400">-</td>
                      );
                    }
                    const base = METRIC_PAGE[key];
                    const cellLink = base ? `${base}${base.includes("?") ? "&" : "?"}ward=${r.wardNumber}` : null;
                    const cellContent = (
                      <>
                        <GradeBadge grade={m.grade} />
                        <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatValue(m.value)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          #{m.rank}<span className="text-slate-400">/{m.total}</span>
                        </span>
                      </>
                    );
                    return (
                      <td key={r.wardNumber} className="py-2 px-2">
                        {cellLink ? (
                          <Link href={cellLink} className={`flex flex-col items-center gap-0.5 py-1 px-1 hover:bg-slate-100/80 dark:hover:bg-slate-700/30 transition-colors rounded-lg ${cellBg(cellRole(idx, hl.bestIdx, hl.worstIdx, rankings.length))}`}>
                            {cellContent}
                          </Link>
                        ) : (
                          <div className={`flex flex-col items-center gap-0.5 py-1 px-1 ${cellBg(cellRole(idx, hl.bestIdx, hl.worstIdx, rankings.length))}`}>
                            {cellContent}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="sm:hidden space-y-4">
        {rankings.map((r, idx) => {
          const overallRole = cellRole(idx, overallHL.bestIdx, overallHL.worstIdx, rankings.length);
          const overallHighlight = cellBg(overallRole);
          return (
            <div
              key={r.wardNumber}
              className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 overflow-hidden"
            >
              {/* Card header */}
              <Link href={`/my-ward/report?ward=${r.wardNumber}`} className={`flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 ${overallHighlight}`}>
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{t("ward.ward")} {r.wardNumber}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{r.zoneName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-center">
                    <GradeBadge grade={r.overallGrade} size="sm" />
                    <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                      #{r.overallRank}/{r.overallTotal}
                    </p>
                  </div>
                  <span className="text-slate-300 dark:text-slate-600 text-sm print:hidden">&rsaquo;</span>
                </div>
              </Link>

              {/* Metric rows */}
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {r.metrics.map((m) => {
                  const hl = bestAndWorst(rankings, m.key);
                  const mobileRole = cellRole(idx, hl.bestIdx, hl.worstIdx, rankings.length);
                  const mBase = METRIC_PAGE[m.key];
                  const mobileLink = mBase ? `${mBase}${mBase.includes("?") ? "&" : "?"}ward=${r.wardNumber}` : null;
                  const mobileInner = (
                    <>
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex items-center">
                          <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                            {t(m.label)}
                          </span>
                          {m.description && (
                            <InfoTooltip text={t(m.description)} label={t("report.more_info")} />
                          )}
                        </span>
                        <p className="text-xs text-slate-400">{m.unit}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatValue(m.value)}
                        </span>
                        {m.grade ? (
                          <GradeBadge grade={m.grade} />
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                        {mobileLink && <span className="text-slate-300 dark:text-slate-600 text-xs print:hidden">&rsaquo;</span>}
                      </div>
                    </>
                  );
                  return mobileLink ? (
                    <Link key={m.key} href={mobileLink} className={`flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${mobileRole === "best" ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}>
                      {mobileInner}
                    </Link>
                  ) : (
                    <div key={m.key} className={`flex items-center justify-between px-4 py-2.5 ${mobileRole === "best" ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}>
                      {mobileInner}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
        {(["A", "B", "C", "D", "F"] as Grade[]).map((g) => (
          <span key={g} className="inline-flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded-sm border ${GRADE_STYLES[g].bg} ${GRADE_STYLES[g].border} report-grade`} />
            {g} = {t(GRADE_PRINT_KEY[g])}
          </span>
        ))}
      </div>
    </>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { GradeBadge } from "@/lib/utils/grade-styles";
import { loadProfiles, type WardProfile } from "@/lib/hooks/use-ward-profile";
import {
  buildCityDistributions,
  computeUpliftPlan,
  type MetricGap,
} from "@/lib/utils/ward-uplift";

/* ── Props ─────────────────────────────────────────────────────────── */

interface Props {
  wardNumber: number;
  profile: WardProfile;
}

/* ── Constants ─────────────────────────────────────────────────────── */

const NUM = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const FACTOR_LABEL: Record<string, string> = {
  wb_health: "uplift.factor_wb_health",
  wb_density: "uplift.factor_wb_density",
  flood_risk: "uplift.factor_flood_risk",
  drainage: "uplift.factor_drainage",
  sewerage_infra: "uplift.factor_sewerage_infra",
};

/* ── Component ─────────────────────────────────────────────────────── */

export function WardUpliftCard({ wardNumber }: Props) {
  const { t } = useLanguage();
  const [allProfiles, setAllProfiles] = useState<WardProfile[] | null>(null);
  const [budget, setBudget] = useState(100);

  // Load all profiles (cached in module)
  useEffect(() => {
    let cancelled = false;
    loadProfiles().then((profiles) => {
      if (!cancelled) setAllProfiles(profiles);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-compute city distributions once
  const cityDist = useMemo(() => {
    if (!allProfiles) return null;
    return buildCityDistributions(allProfiles);
  }, [allProfiles]);

  // Re-compute plan when budget or ward changes
  const plan = useMemo(() => {
    if (!allProfiles || !cityDist) return null;
    return computeUpliftPlan(wardNumber, allProfiles, budget, cityDist);
  }, [wardNumber, allProfiles, budget, cityDist]);

  if (!plan) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("uplift.title")}
          </h2>
        </CardHeader>
        <CardContent>
          <div className="h-20 flex items-center justify-center text-slate-400 text-sm">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  const pctDelta = plan.overallPercentileAfter - plan.overallPercentileBefore;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
          {t("uplift.title")}
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {t("uplift.subtitle")}
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Budget slider ───────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t("uplift.budget_label")}
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {t("uplift.budget_cr").replace("{amount}", String(budget))}
            </span>
          </div>
          <Slider
            value={[budget]}
            onValueChange={(v) => setBudget(v[0])}
            min={10}
            max={500}
            step={10}
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 tabular-nums">
            <span>10 Cr</span>
            <span>500 Cr</span>
          </div>
        </div>

        {/* ── Grade projection hero ───────────────────────────── */}
        <div className="flex items-center justify-center gap-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <div className="text-center">
            <GradeBadge grade={plan.overallGradeBefore} size="lg" />
            <p className="text-xs text-slate-500 mt-1">{t("uplift.grade_before")}</p>
            <p className="text-[10px] text-slate-400 tabular-nums">
              {t("uplift.percentile").replace("{value}", String(plan.overallPercentileBefore))}
            </p>
          </div>

          <div className="flex flex-col items-center">
            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            {pctDelta > 0 && (
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                +{pctDelta}
              </span>
            )}
          </div>

          <div className="text-center">
            <GradeBadge grade={plan.overallGradeAfter} size="lg" />
            <p className="text-xs text-slate-500 mt-1">{t("uplift.grade_after")}</p>
            <p className="text-[10px] text-slate-400 tabular-nums">
              {t("uplift.percentile").replace("{value}", String(plan.overallPercentileAfter))}
            </p>
          </div>
        </div>

        {/* ── Budget summary bar ──────────────────────────────── */}
        {plan.allocations.length > 0 && (
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>
              {t("uplift.budget_spent")
                .replace("{spent}", String(plan.budgetSpentCr))
                .replace("{total}", String(plan.totalBudgetCr))}
            </span>
            {plan.budgetRemainingCr > 0 && (
              <span className="text-slate-400">
                {t("uplift.budget_remaining").replace("{amount}", String(plan.budgetRemainingCr))}
              </span>
            )}
          </div>
        )}

        {/* ── Recommended allocations ─────────────────────────── */}
        {plan.allocations.length > 0 ? (
          <div>
            <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">
              {t("uplift.alloc_heading")}
            </h3>
            <div className="space-y-2">
              {plan.allocations.map((alloc) => (
                <div
                  key={alloc.interventionId}
                  className="flex items-start justify-between gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {t(alloc.labelKey)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                      {t(alloc.descriptionKey)}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                        {NUM.format(alloc.units)} {t(alloc.unitLabelKey)}
                      </span>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {t("uplift.cost_range")
                          .replace("{low}", NUM.format(alloc.costCrLow))
                          .replace("{high}", NUM.format(alloc.costCrHigh))}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 mt-1">
                    <div className="flex items-center gap-1">
                      <GradeBadge grade={alloc.gradeBefore} />
                      <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <GradeBadge grade={alloc.gradeAfter} />
                    </div>
                    {alloc.percentileAfter > alloc.percentileBefore && (
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                        +{alloc.percentileAfter - alloc.percentileBefore} pct
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : budget > 0 ? (
          <p className="text-xs text-slate-400 italic">{t("uplift.no_improvement")}</p>
        ) : (
          <p className="text-xs text-slate-400 italic">{t("uplift.no_allocations")}</p>
        )}

        {/* ── Gap analysis (collapsible) ──────────────────────── */}
        <details>
          <summary className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-800 dark:hover:text-slate-200">
            {t("uplift.gap_heading")}
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-1.5 pr-2">{t("uplift.col_factor")}</th>
                  <th className="pb-1.5 pr-2 text-right">{t("uplift.col_current")}</th>
                  <th className="pb-1.5 pr-2 text-right">{t("uplift.col_city_median")}</th>
                  <th className="pb-1.5 pr-2 text-right">{t("uplift.col_gap")}</th>
                  <th className="pb-1.5 text-center">{t("uplift.col_grade")}</th>
                </tr>
              </thead>
              <tbody>
                {plan.gapAnalysis.map((gap) => (
                  <tr
                    key={gap.metricKey}
                    className={`border-b border-slate-50 dark:border-slate-800/50 last:border-0 ${!gap.applicable ? "opacity-40" : ""}`}
                  >
                    <td className="py-1.5 pr-2 text-slate-700 dark:text-slate-300">
                      {t(FACTOR_LABEL[gap.metricKey] ?? gap.labelKey)}
                      <span className="text-slate-400 ml-1 text-[10px]">
                        ({Math.round(gap.weight * 100)}%)
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {gap.applicable && gap.currentValue != null
                        ? <>{NUM.format(gap.currentValue)} <span className="text-[10px] text-slate-400 font-normal">{gap.unit}</span></>
                        : t("uplift.not_applicable")}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-slate-500">
                      {gap.cityMedian != null
                        ? <>{NUM.format(gap.cityMedian)} <span className="text-[10px] text-slate-400">{gap.unit}</span></>
                        : "-"}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-slate-500">
                      <GapCell gap={gap} />
                    </td>
                    <td className="py-1.5 text-center">
                      {gap.applicable
                        ? <GradeBadge grade={gap.currentGrade} />
                        : <span className="text-slate-400">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        {/* ── Disclaimer ──────────────────────────────────────── */}
        <p className="text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2">
          {t("uplift.disclaimer")}
        </p>
      </CardContent>
    </Card>
  );
}

/* ── Gap cell helper ───────────────────────────────────────────────── */

function GapCell({ gap }: { gap: MetricGap }) {
  const { t } = useLanguage();

  if (!gap.applicable) {
    return <span>{t("uplift.not_applicable")}</span>;
  }
  // gapToNextGrade=null, nextGrade=null => already A
  if (gap.gapToNextGrade == null && gap.nextGrade == null) {
    return (
      <span className="text-emerald-600 dark:text-emerald-400">
        {t("uplift.no_gap")}
      </span>
    );
  }
  // gapToNextGrade=null, nextGrade set => at grade boundary (ties hold ward back)
  if (gap.gapToNextGrade == null && gap.nextGrade != null) {
    return (
      <span className="text-amber-600 dark:text-amber-400">
        {t("uplift.at_boundary")}
      </span>
    );
  }

  // Guard against near-zero gaps that round to "0" in display
  const displayNum = NUM.format(gap.gapToNextGrade!);
  if (displayNum === "0") {
    return (
      <span className="text-amber-600 dark:text-amber-400">
        {t("uplift.at_boundary")}
      </span>
    );
  }

  const formatted = `${displayNum} ${gap.unit}`;
  if (gap.higherIsBetter) {
    return <span>{t("uplift.gap_needs_more").replace("{amount}", formatted)}</span>;
  }
  return <span>{t("uplift.gap_needs_less").replace("{amount}", formatted)}</span>;
}

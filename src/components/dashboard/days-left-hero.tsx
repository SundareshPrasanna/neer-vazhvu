"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_CONSUMPTION_MLD, DEFAULT_DESALINATION_MLD, MLD_TO_MCFT } from "@/lib/utils/constants";
import { formatNumber, formatPct } from "@/lib/utils/format";
import { useLanguage } from "@/lib/i18n/context";

interface DaysLeftHeroProps {
  totalStorageMcft: number;
  totalCapacityMcft: number;
  recentAvgInflowMcftPerDay: number;
  seasonalAvgInflowMcftPerDay: number;
  lastUpdated: string;
  comparison2019Storage: number | null;
}

/** Upper display cap — anything above this is "won't run out" */
const MAX_DAYS = 9999;

function computeClientDaysLeft(
  storageMcft: number,
  consumptionMLD: number,
  desalinationMLD: number,
  recentInflowMcft: number,
  seasonalInflowMcft: number,
  inflowPct: number
) {
  const netDemandMcft = (consumptionMLD - desalinationMLD) * MLD_TO_MCFT;
  const inflowScale = inflowPct / 100;

  const pessimistic = netDemandMcft > 0 ? Math.floor(storageMcft / netDemandMcft) : MAX_DAYS;

  const netModerate = netDemandMcft - recentInflowMcft * inflowScale;
  const rawModerate = netModerate > 0 ? Math.floor(storageMcft / netModerate) : MAX_DAYS;

  const netOptimistic = netDemandMcft - seasonalInflowMcft * inflowScale;
  const rawOptimistic = netOptimistic > 0 ? Math.floor(storageMcft / netOptimistic) : MAX_DAYS;

  // Ensure ordering: pessimistic <= moderate <= optimistic
  const moderate = Math.min(rawModerate, rawOptimistic);
  const optimistic = Math.max(rawModerate, rawOptimistic);

  return {
    pessimistic: Math.min(pessimistic, MAX_DAYS),
    moderate: Math.min(moderate, MAX_DAYS),
    optimistic: Math.min(optimistic, MAX_DAYS),
    // Surplus info for display when inflow > demand
    netDemandMcft,
    recentInflowScaled: recentInflowMcft * inflowScale,
    seasonalInflowScaled: seasonalInflowMcft * inflowScale,
  };
}

function formatDays(days: number, t: (key: string) => string): string {
  if (days >= MAX_DAYS) return t("hero.wont_run_out");
  if (days >= 365) {
    const yrs = (days / 365).toFixed(1);
    return `${yrs} ${parseFloat(yrs) >= 2 ? t("hero.yrs_unit") : t("hero.yr_unit")}`;
  }
  return `${days} ${days === 1 ? t("hero.day_unit") : t("hero.days_unit")}`;
}

function getSeverityColor(days: number): string {
  if (days > 180) return "text-green-600 dark:text-green-400";
  if (days > 90) return "text-yellow-600 dark:text-yellow-400";
  if (days > 45) return "text-orange-500 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function getBarColor(pct: number): string {
  if (pct > 60) return "bg-green-500";
  if (pct > 30) return "bg-yellow-500";
  if (pct > 15) return "bg-orange-500";
  return "bg-red-500";
}

/** Format mcft/day surplus as a readable ratio */
function formatSurplus(inflowMcft: number, demandMcft: number): string {
  if (demandMcft <= 0) return "";
  const ratio = (inflowMcft / demandMcft).toFixed(1);
  return `${ratio}x`;
}

export function DaysLeftHero({
  totalStorageMcft,
  totalCapacityMcft,
  recentAvgInflowMcftPerDay,
  seasonalAvgInflowMcftPerDay,
  lastUpdated,
  comparison2019Storage,
}: DaysLeftHeroProps) {
  const { t } = useLanguage();
  const [consumption, setConsumption] = useState(DEFAULT_CONSUMPTION_MLD);
  const [desalination, setDesalination] = useState(DEFAULT_DESALINATION_MLD);
  const [inflowPct, setInflowPct] = useState(100);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const result = computeClientDaysLeft(
    totalStorageMcft,
    consumption,
    desalination,
    recentAvgInflowMcftPerDay,
    seasonalAvgInflowMcftPerDay,
    inflowPct
  );

  const days = { pessimistic: result.pessimistic, moderate: result.moderate, optimistic: result.optimistic };
  const storagePct = totalCapacityMcft > 0 ? (totalStorageMcft / totalCapacityMcft) * 100 : 0;

  // Whether each inflow scenario exceeds demand
  const moderateSurplus = result.recentInflowScaled > result.netDemandMcft;
  const optimisticSurplus = result.seasonalInflowScaled > result.netDemandMcft;

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("hero.title")}
          </h2>
          <Badge variant="outline" className="text-xs">
            {t("hero.updated")} {lastUpdated}
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mt-4">
          {/* Big number */}
          <div className="text-center sm:text-left">
            <div className={`text-5xl sm:text-6xl font-bold ${getSeverityColor(days.pessimistic)}`}>
              {days.pessimistic >= MAX_DAYS ? (
                <>{t("hero.safe")}</>
              ) : days.optimistic >= MAX_DAYS ? (
                <>{formatDays(days.pessimistic, t)}<span className="text-2xl text-slate-400 dark:text-slate-500">+</span></>
              ) : (
                <>{formatDays(days.pessimistic, t)}<span className="text-2xl mx-1">-</span>{formatDays(days.optimistic, t)}</>
              )}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {days.pessimistic >= MAX_DAYS ? t("hero.inflows_exceed") : t("hero.days_remaining")}
            </div>
          </div>

          {/* Scenario breakdown */}
          <div className="flex-1 space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-600 dark:text-slate-400">{t("hero.worst_case")}</span>
              <span className="font-semibold">{formatDays(days.pessimistic, t)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-slate-600 dark:text-slate-400">{t("hero.current_trend")}</span>
              <span className="font-semibold">{formatDays(days.moderate, t)}</span>
              {moderateSurplus && (
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  ({t("hero.inflow")} {formatSurplus(result.recentInflowScaled, result.netDemandMcft)} {t("hero.of_demand")})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-slate-600 dark:text-slate-400">{t("hero.seasonal_rains")}</span>
              <span className="font-semibold">{formatDays(days.optimistic, t)}</span>
              {optimisticSurplus && (
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  ({t("hero.inflow")} {formatSurplus(result.seasonalInflowScaled, result.netDemandMcft)} {t("hero.of_demand")})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Storage bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-600 dark:text-slate-400">
              {t("hero.reservoir_storage")} {formatNumber(totalStorageMcft)} / {formatNumber(totalCapacityMcft)} mcft
            </span>
            <span className="font-semibold">{formatPct(storagePct)}</span>
          </div>
          <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getBarColor(storagePct)}`}
              style={{ width: `${Math.min(storagePct, 100)}%` }}
            />
          </div>

          {comparison2019Storage !== null && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {t("hero.2019_comparison")} {formatNumber(comparison2019Storage)} mcft
              {comparison2019Storage < totalStorageMcft ? (
                <span className="text-green-600 dark:text-green-400 ml-1">{t("hero.better_today")}</span>
              ) : (
                <span className="text-red-600 dark:text-red-400 ml-1">{t("hero.worse_today")}</span>
              )}
            </div>
          )}
        </div>

        {/* Collapsible assumptions panel */}
        <div className="mt-4">
          <button
            onClick={() => setShowAssumptions(!showAssumptions)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showAssumptions ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {t("hero.adjust")}
          </button>

          {showAssumptions && (
            <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600 dark:text-slate-400">{t("hero.consumption")}</span>
                  <span className="font-mono font-semibold">{consumption} MLD</span>
                </div>
                <Slider
                  value={[consumption]}
                  onValueChange={([v]) => setConsumption(v)}
                  min={500}
                  max={1200}
                  step={10}
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600 dark:text-slate-400">{t("hero.desalination")}</span>
                  <span className="font-mono font-semibold">{desalination} MLD</span>
                </div>
                <Slider
                  value={[desalination]}
                  onValueChange={([v]) => setDesalination(v)}
                  min={0}
                  max={400}
                  step={10}
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600 dark:text-slate-400">{t("hero.inflow_pct")}</span>
                  <span className="font-mono font-semibold">{inflowPct}%</span>
                </div>
                <Slider
                  value={[inflowPct]}
                  onValueChange={([v]) => setInflowPct(v)}
                  min={0}
                  max={150}
                  step={5}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {t("hero.inflow_hint")}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  {t("hero.last_7d")}: {result.recentInflowScaled.toFixed(1)} mcft/{t("hero.day_unit")} &middot; {t("hero.month_avg").replace("{month}", new Date().toLocaleString("default", { month: "short" }))}: {result.seasonalInflowScaled.toFixed(1)} mcft/{t("hero.day_unit")}
                </p>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {t("hero.slider_note")}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

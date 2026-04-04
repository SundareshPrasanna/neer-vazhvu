"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { WardHistoryChart } from "@/components/groundwater/ward-history-chart";
import type { GroundwaterData } from "@/lib/hooks/use-my-ward-data";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const TREND_ICONS: Record<string, { symbol: string; color: string }> = {
  improving: { symbol: "\u2191", color: "text-green-600 dark:text-green-400" },
  stable: { symbol: "\u2192", color: "text-slate-500 dark:text-slate-400" },
  declining: { symbol: "\u2193", color: "text-red-600 dark:text-red-400" },
  unknown: { symbol: "?", color: "text-slate-400" },
};

interface Props {
  wardNumber: number;
  groundwater: GroundwaterData | null;
  loading: boolean;
}

export function WardGroundwaterCard({ wardNumber, groundwater, loading }: Props) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("my_ward.groundwater")}
          </h2>
        </CardHeader>
        <CardContent><Skeleton className="h-48 w-full rounded-lg" /></CardContent>
      </Card>
    );
  }

  if (!groundwater || (groundwater.depthM == null && groundwater.riskScore == null)) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("my_ward.groundwater")}
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 dark:text-slate-500">{t("ward.no_data")}</p>
        </CardContent>
      </Card>
    );
  }

  const trend = TREND_ICONS[groundwater.trend] ?? TREND_ICONS.unknown;
  const badgeClass = STATUS_COLORS[groundwater.riskLevel] ?? "";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("my_ward.groundwater")}
          </h2>
          <Link
            href={`/groundwater?ward=${wardNumber}`}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline print:hidden"
          >
            {t("my_ward.view_on_map")} &rarr;
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            {groundwater.depthM != null ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {groundwater.depthM.toFixed(1)}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">m bgl</span>
                  <span className={`text-lg font-semibold ${trend.color}`}>{trend.symbol}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("ward.depth_label")}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                {t("ward.no_depth_data")}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {groundwater.riskLevel !== "noData" && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
                {groundwater.riskLevel}
              </span>
            )}
            {groundwater.riskScore != null && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {t("ward.risk_score")}: {groundwater.riskScore}/100
              </span>
            )}
          </div>
        </div>

        {/* Trend explanation */}
        {groundwater.depthM != null && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(`ward.${groundwater.trend === "improving" ? "improving" : groundwater.trend === "declining" ? "declining_trend" : groundwater.trend === "stable" ? "stable" : "unknown_trend"}`)}
            {" - "}
            {t("ward.depth_note3")}
          </p>
        )}

        {/* Risk components */}
        {groundwater.riskComponents && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              {t("ward.risk_score")}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {t("my_ward.gw_risk_explainer")}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { key: "gw_depth_comp", value: groundwater.riskComponents.groundwater_depth, weight: "40%" },
                { key: "trend_comp", value: groundwater.riskComponents.trend, weight: "30%" },
                { key: "reservoir_comp", value: groundwater.riskComponents.reservoir, weight: "20%" },
                { key: "seasonal_comp", value: groundwater.riskComponents.seasonal, weight: "10%" },
              ].map(({ key, value, weight }) => (
                <div key={key} className="flex justify-between px-2 py-1 bg-slate-50 dark:bg-slate-800/50 rounded">
                  <span className="text-slate-500 dark:text-slate-400">
                    {t(`ward.${key}`)} <span className="text-slate-400 dark:text-slate-500">({weight})</span>
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{value}/100</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Explanatory notes */}
        <div className="text-[10px] text-slate-400 dark:text-slate-500 space-y-0.5 border-t border-slate-100 dark:border-slate-800 pt-2">
          <p>{t("ward.depth_note1")}</p>
          <p>{t("ward.depth_note2")}</p>
          <p>{t("my_ward.gw_seasonal_note")}</p>
          <p>{t("my_ward.gw_source")}</p>
        </div>

        {/* History chart */}
        <WardHistoryChart wardNumber={wardNumber} />
      </CardContent>
    </Card>
  );
}

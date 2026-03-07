"use client";

import { Badge } from "@/components/ui/badge";
import { WardHistoryChart } from "@/components/groundwater/ward-history-chart";
import { getGroundwaterStatus, getGroundwaterColor, getRiskColor } from "@/types/groundwater";
import type { GroundwaterWard, WardRiskData } from "@/types/groundwater";
import { useLanguage } from "@/lib/i18n/context";

interface WardDetailPanelProps {
  ward: GroundwaterWard;
  riskData?: WardRiskData;
  onClose: () => void;
}

const TREND_ICONS: Record<string, { icon: string; color: string; tKey: string }> = {
  improving: { icon: "↑", color: "text-green-600", tKey: "ward.improving" },
  stable:    { icon: "→", color: "text-yellow-600", tKey: "ward.stable" },
  declining: { icon: "↓", color: "text-red-600",   tKey: "ward.declining_trend" },
  unknown:   { icon: "?", color: "text-slate-400",  tKey: "ward.unknown_trend" },
};

// Components are stored as raw 0–100 sub-scores; contribution = sub_score × weight
const RISK_COMPONENTS = [
  { key: "groundwaterComponent" as const, tKey: "ward.gw_depth_comp",    weight: 0.40, max: 40 },
  { key: "trendComponent"       as const, tKey: "ward.trend_comp",        weight: 0.30, max: 30 },
  { key: "reservoirComponent"   as const, tKey: "ward.reservoir_comp",    weight: 0.20, max: 20 },
  { key: "seasonalComponent"    as const, tKey: "ward.seasonal_comp",     weight: 0.10, max: 10 },
];

export function WardDetailPanel({ ward, riskData, onClose }: WardDetailPanelProps) {
  const { t, language } = useLanguage();
  const status = getGroundwaterStatus(ward.depthM);
  const color = getGroundwaterColor(ward.depthM);
  const trend = TREND_ICONS[ward.trend];
  const wardPrimaryName = language === "ta"
    ? (ward.wardNameTa ?? `${t("ward.ward")} ${ward.wardNumber}`)
    : ward.wardName;
  const wardSecondaryName = language === "ta" ? ward.wardName : ward.wardNameTa;
  const riskLabels: Record<NonNullable<WardRiskData["riskLevel"]>, string> = {
    low: t("legend.low_risk"),
    moderate: t("legend.moderate_risk"),
    high: t("legend.high_risk"),
    critical: t("gw.critical"),
    noData: t("gw.no_data"),
  };

  // Status labels via t()
  const STATUS_LABELS: Record<string, string> = {
    healthy: t("gw.healthy"),
    moderate: t("gw.moderate"),
    declining: t("gw.declining"),
    stressed: t("gw.stressed"),
    critical: t("gw.critical"),
    crisis: t("gw.crisis"),
    noData: t("gw.no_data"),
  };

  return (
    <div className="bg-white dark:bg-slate-900 w-full h-full p-4 sm:p-6 overflow-y-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{wardPrimaryName}</h3>
          {wardSecondaryName && (
            <span className="text-sm text-slate-500 dark:text-slate-400 block">
              {wardSecondaryName}
            </span>
          )}
          <span className="text-sm text-slate-500 dark:text-slate-400">{t("ward.ward")} {ward.wardNumber}</span>
          {ward.zone && <span className="text-sm text-slate-400 dark:text-slate-500 ml-2">· {ward.zone}</span>}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
          aria-label={t("common.close_panel")}
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {ward.depthM !== null ? (
        <>
          <div className="mb-6">
            <div className="text-4xl font-bold" style={{ color }}>
              {ward.depthM.toFixed(1)}m
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("ward.depth_label")}</div>
            <Badge className="mt-2" style={{ backgroundColor: color, color: "white" }}>
              {STATUS_LABELS[status]}
            </Badge>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t("ward.yoy_trend")}</h4>
            <div className="flex items-center gap-2">
              <span className={`text-2xl ${trend.color}`}>{trend.icon}</span>
              <span className={`text-sm ${trend.color} font-medium`}>{t(trend.tKey)}</span>
            </div>
          </div>

          <div className="mb-6">
            <WardHistoryChart wardNumber={ward.wardNumber} />
          </div>
        </>
      ) : (
        <div className="text-slate-500 dark:text-slate-400 text-sm mb-6">
          {t("ward.no_data")}
        </div>
      )}

      {riskData && (
        <div className="mb-6 border-t border-slate-100 dark:border-slate-800 pt-6">
          <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
            {t("ward.risk_score")}
          </h4>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold" style={{ color: getRiskColor(riskData.riskLevel) }}>
              {riskData.riskScore.toFixed(0)}
            </span>
            <span className="text-sm text-slate-400 dark:text-slate-500">/ 100</span>
            <Badge
              className="ml-1"
              style={{ backgroundColor: getRiskColor(riskData.riskLevel), color: "white" }}
            >
              {riskLabels[riskData.riskLevel]}
            </Badge>
          </div>
          <div className="space-y-3">
            {RISK_COMPONENTS.map(({ key, tKey, weight, max }) => {
              const subScore = riskData[key];                        // 0–100 raw sub-score
              const contribution = subScore != null ? subScore * weight : null; // weighted points
              const pct = contribution != null ? (contribution / max) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>{t(tKey)}</span>
                    <span className="font-mono tabular-nums">
                      {contribution != null ? contribution.toFixed(0) : "-"} / {max}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: getRiskColor(riskData.riskLevel),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
            {t("ward.weights_note")}
          </p>
        </div>
      )}

      <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1">
        <p>{t("ward.depth_note1")}</p>
        <p>{t("ward.depth_note2")}</p>
        <p>{t("ward.depth_note3")}</p>
      </div>
    </div>
  );
}

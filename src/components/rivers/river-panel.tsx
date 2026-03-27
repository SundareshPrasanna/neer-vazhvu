"use client";

import { useState } from "react";
import { RiverQualityChart } from "@/components/rivers/river-quality-chart";
import type { RiverQualityData, SelectedRiver } from "@/types/river-quality";
import {
  QUALITY_COLORS,
  TREND_DO_THRESHOLD,
  TREND_BOD_THRESHOLD,
  computeStationTrend,
} from "@/types/river-quality";
import { useLanguage } from "@/lib/i18n/context";

interface RiverPanelProps {
  selected: SelectedRiver;
  qualityData: RiverQualityData;
  onClose: () => void;
}

export function RiverPanel({ selected, qualityData, onClose }: RiverPanelProps) {
  const { t, language } = useLanguage();
  const river = qualityData.rivers.find((r) => r.id === selected.riverId);

  const initialStation =
    selected.stationId
      ? river?.stations.find((s) => s.id === selected.stationId)
      : river?.stations[0];

  const [activeStationId, setActiveStationId] = useState(
    initialStation?.id ?? river?.stations[0]?.id
  );

  if (!river) return null;

  const primaryRiverName = language === "ta" ? (river.name_ta ?? river.name) : river.name;
  const secondaryRiverName = language === "ta" ? river.name : river.name_ta;

  const activeStation =
    river.stations.find((s) => s.id === activeStationId) ?? river.stations[0];

  const statusColor = QUALITY_COLORS[river.overall_status];
  const statusLabel = t(`rivers_legend.${river.overall_status}`);

  // Latest DO reading from active station
  const latestReading = [...activeStation.readings].sort((a, b) => b.year - a.year)[0];
  const latestDO = latestReading?.do_mgl;

  // 3-year trend for the active station
  const trend = computeStationTrend(activeStation.readings);

  const TREND_CONFIG = {
    improving: { tKey: "rivers.improving", className: "text-green-600 dark:text-green-400" },
    worsening: { tKey: "rivers.worsening", className: "text-red-600 dark:text-red-400" },
    mixed:     { tKey: "rivers.mixed",     className: "text-orange-500 dark:text-orange-400" },
    stable:    { tKey: "rivers.stable",    className: "text-slate-500 dark:text-slate-400" },
  } as const;

  const formatStretch = (stretch: string): string => {
    const normalized = stretch.trim().toLowerCase();
    if (normalized === "upper") return t("rivers.upper");
    if (normalized === "middle") return t("rivers.middle");
    if (normalized === "lower") return t("rivers.lower");
    if (normalized === "estuary") return t("rivers.estuary");
    if (normalized === "north chennai") return t("rivers.north_chennai");
    if (normalized === "south chennai") return t("rivers.south_chennai");
    if (normalized === "lower (ennore)" || normalized === "lower ennore") return t("rivers.lower_ennore");
    return stretch;
  };

  return (
    <div className="bg-white dark:bg-slate-900 w-full h-full p-4 sm:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
            {primaryRiverName}
          </h3>
          {secondaryRiverName && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {secondaryRiverName}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
          aria-label={t("common.close_panel")}
        >
          <svg
            className="w-5 h-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Status badge */}
      <div className="mb-4">
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium text-white"
          style={{ backgroundColor: statusColor }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-center">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
          <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {river.length_km} km
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("rivers.length")}</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
          <div
            className="text-base font-semibold"
            style={{ color: latestDO !== null && latestDO !== undefined ? statusColor : undefined }}
          >
            {latestDO !== null && latestDO !== undefined
              ? `${latestDO} mg/L`
              : t("common.not_available")}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            DO ({latestReading?.year ?? "-"})
          </div>
        </div>
      </div>
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 mb-5 flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">{t("rivers.cpcb_class")}</span>
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 text-right ml-2">
          {river.cpcb_class}
        </span>
      </div>

      {/* 3-year trend */}
      {trend && (
        <div className="border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-2.5 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {t("rivers.trend_label")}
            </span>
            <span className={`text-xs font-semibold whitespace-nowrap ${TREND_CONFIG[trend.direction].className}`}>
              {t(TREND_CONFIG[trend.direction].tKey)}
              <span className="font-normal text-slate-400 dark:text-slate-500 ml-1">
                ({trend.start_year}-{trend.end_year})
              </span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 text-xs">
            {trend.do_delta !== null && (
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-500 dark:text-slate-400">DO</span>
                <span className={`font-mono ${
                  trend.do_delta >= TREND_DO_THRESHOLD
                    ? "text-green-600 dark:text-green-400"
                    : trend.do_delta <= -TREND_DO_THRESHOLD
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-500 dark:text-slate-400"
                }`}>
                  {trend.do_delta > 0
                    ? `↑ +${trend.do_delta.toFixed(1)}`
                    : trend.do_delta < 0
                    ? `↓ ${trend.do_delta.toFixed(1)}`
                    : "→ 0.0"}{" "}
                  mg/L
                </span>
              </div>
            )}
            {trend.bod_delta !== null && (
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-500 dark:text-slate-400">BOD</span>
                <span className={`font-mono ${
                  trend.bod_delta <= -TREND_BOD_THRESHOLD
                    ? "text-green-600 dark:text-green-400"
                    : trend.bod_delta >= TREND_BOD_THRESHOLD
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-500 dark:text-slate-400"
                }`}>
                  {trend.bod_delta > 0
                    ? `↑ +${trend.bod_delta.toFixed(1)}`
                    : trend.bod_delta < 0
                    ? `↓ ${trend.bod_delta.toFixed(1)}`
                    : "→ 0.0"}{" "}
                  mg/L
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 leading-snug">
            {t("rivers.do_better")}
          </p>
        </div>
      )}

      {/* Station selector */}
      {river.stations.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {river.stations.map((station) => (
            <button
              key={station.id}
              onClick={() => setActiveStationId(station.id)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                activeStationId === station.id
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {formatStretch(station.stretch)}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
          {t("rivers.water_quality")}: {activeStation.name}
        </div>
        <RiverQualityChart
          readings={activeStation.readings}
          stationName={activeStation.name}
        />
      </div>

      {/* Pollution profile - latest readings */}
      {latestReading && (
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            {t("rivers.pollution_profile")} ({latestReading.year})
          </h4>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {/* COD */}
            {latestReading.cod_mgl != null && (() => {
              const limit = 250;
              const val = latestReading.cod_mgl;
              const ratio = val / limit;
              const exceeded = val > limit;
              const warning = val > 100;
              return (
                <div className={`rounded-lg px-2.5 py-1.5 ${exceeded ? "bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800" : "bg-slate-50 dark:bg-slate-800"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">COD</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{t("rivers.limit")}: {limit} mg/L</span>
                  </div>
                  <div className={`font-mono font-bold ${exceeded ? "text-red-600 dark:text-red-400" : warning ? "text-orange-600 dark:text-orange-400" : "text-slate-900 dark:text-slate-100"}`}>
                    {val} <span className="font-normal text-slate-400">mg/L</span>
                    {exceeded && <span className="ml-1 text-[10px] font-semibold text-red-500 dark:text-red-400">{ratio.toFixed(1)}x</span>}
                  </div>
                  {/* severity bar */}
                  <div className="mt-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full ${exceeded ? "bg-red-500" : warning ? "bg-orange-400" : "bg-green-400"}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                  </div>
                </div>
              );
            })()}
            {/* Fecal Coliform */}
            {latestReading.fecal_coliform_mpn != null && (() => {
              const limit = 500;
              const val = latestReading.fecal_coliform_mpn;
              const ratio = val / limit;
              const exceeded = val > limit;
              const severe = val > 10000;
              return (
                <div className={`rounded-lg px-2.5 py-1.5 ${exceeded ? "bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800" : "bg-slate-50 dark:bg-slate-800"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{t("rivers.fc_title")}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{t("rivers.limit")}: {limit} MPN</span>
                  </div>
                  <div className={`font-mono font-bold ${severe ? "text-red-600 dark:text-red-400" : exceeded ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                    {val.toLocaleString()} <span className="font-normal text-slate-400">MPN</span>
                    {exceeded && <span className="ml-1 text-[10px] font-semibold text-red-500 dark:text-red-400">{ratio.toFixed(0)}x</span>}
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full ${severe ? "bg-red-500" : exceeded ? "bg-orange-400" : "bg-green-400"}`} style={{ width: `${Math.min((ratio / 20) * 100, 100)}%` }} />
                  </div>
                </div>
              );
            })()}
            {/* TDS */}
            {latestReading.tds_mgl != null && (() => {
              const limit = 500;
              const val = latestReading.tds_mgl;
              const ratio = val / limit;
              const exceeded = val > limit;
              const severe = val > 2000;
              return (
                <div className={`rounded-lg px-2.5 py-1.5 ${exceeded ? "bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800" : "bg-slate-50 dark:bg-slate-800"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">TDS</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{t("rivers.limit")}: {limit} mg/L</span>
                  </div>
                  <div className={`font-mono font-bold ${severe ? "text-red-600 dark:text-red-400" : exceeded ? "text-orange-600 dark:text-orange-400" : "text-slate-900 dark:text-slate-100"}`}>
                    {val.toLocaleString()} <span className="font-normal text-slate-400">mg/L</span>
                    {exceeded && <span className="ml-1 text-[10px] font-semibold text-red-500 dark:text-red-400">{ratio.toFixed(1)}x</span>}
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full ${severe ? "bg-red-500" : exceeded ? "bg-orange-400" : "bg-green-400"}`} style={{ width: `${Math.min((ratio / 4) * 100, 100)}%` }} />
                  </div>
                </div>
              );
            })()}
            {/* Nitrate */}
            {latestReading.nitrate_mgl != null && (() => {
              const limit = 45;
              const val = latestReading.nitrate_mgl;
              const ratio = val / limit;
              const exceeded = val > limit;
              const warning = val > 20;
              return (
                <div className={`rounded-lg px-2.5 py-1.5 ${exceeded ? "bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800" : "bg-slate-50 dark:bg-slate-800"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{t("rivers.nitrate_title")}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{t("rivers.limit")}: {limit} mg/L</span>
                  </div>
                  <div className={`font-mono font-bold ${exceeded ? "text-red-600 dark:text-red-400" : warning ? "text-orange-600 dark:text-orange-400" : "text-slate-900 dark:text-slate-100"}`}>
                    {val} <span className="font-normal text-slate-400">mg/L</span>
                    {exceeded && <span className="ml-1 text-[10px] font-semibold text-red-500 dark:text-red-400">{ratio.toFixed(1)}x</span>}
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full ${exceeded ? "bg-red-500" : warning ? "bg-orange-400" : "bg-green-400"}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                  </div>
                </div>
              );
            })()}
          </div>
          {/* Heavy metals row */}
          {(latestReading.chromium_mgl != null || latestReading.lead_mgl != null || latestReading.cadmium_mgl != null) && (
            <div className={`mt-1.5 rounded-lg px-2.5 py-1.5 ${
              (latestReading.chromium_mgl != null && latestReading.chromium_mgl > 0.05) ||
              (latestReading.lead_mgl != null && latestReading.lead_mgl > 0.01) ||
              (latestReading.cadmium_mgl != null && latestReading.cadmium_mgl > 0.003)
                ? "bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800"
                : "bg-slate-50 dark:bg-slate-800"
            }`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-slate-500 dark:text-slate-400">{t("rivers.metals_title")}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">BIS {t("rivers.limits")}</span>
              </div>
              <div className="space-y-1 font-mono text-xs">
                {latestReading.chromium_mgl != null && (() => {
                  const limit = 0.05;
                  const val = latestReading.chromium_mgl;
                  const ratio = val / limit;
                  const exceeded = val > limit;
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={exceeded ? "text-red-600 dark:text-red-400 font-bold" : "text-slate-700 dark:text-slate-300"}>
                          Cr: {val} mg/L
                          {exceeded && <span className="ml-1 text-[10px] font-semibold text-red-500 dark:text-red-400">{ratio.toFixed(1)}x above limit</span>}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{t("rivers.limit")}: {limit}</span>
                      </div>
                      <div className="mt-0.5 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-full rounded-full ${exceeded ? "bg-red-500" : "bg-green-400"}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                      </div>
                    </div>
                  );
                })()}
                {latestReading.lead_mgl != null && (() => {
                  const limit = 0.01;
                  const val = latestReading.lead_mgl;
                  const ratio = val / limit;
                  const exceeded = val > limit;
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={exceeded ? "text-red-600 dark:text-red-400 font-bold" : "text-slate-700 dark:text-slate-300"}>
                          Pb: {val} mg/L
                          {exceeded && <span className="ml-1 text-[10px] font-semibold text-red-500 dark:text-red-400">{ratio.toFixed(1)}x above limit</span>}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{t("rivers.limit")}: {limit}</span>
                      </div>
                      <div className="mt-0.5 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-full rounded-full ${exceeded ? "bg-red-500" : "bg-green-400"}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                      </div>
                    </div>
                  );
                })()}
                {latestReading.cadmium_mgl != null && (() => {
                  const limit = 0.003;
                  const val = latestReading.cadmium_mgl;
                  const ratio = val / limit;
                  const exceeded = val > limit;
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={exceeded ? "text-red-600 dark:text-red-400 font-bold" : "text-slate-700 dark:text-slate-300"}>
                          Cd: {val} mg/L
                          {exceeded && <span className="ml-1 text-[10px] font-semibold text-red-500 dark:text-red-400">{ratio.toFixed(1)}x above limit</span>}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{t("rivers.limit")}: {limit}</span>
                      </div>
                      <div className="mt-0.5 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-full rounded-full ${exceeded ? "bg-red-500" : "bg-green-400"}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Parameter explainers */}
      <div className="grid grid-cols-2 gap-2 mb-5 text-xs">
        <div className="rounded-lg border border-sky-100 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/30 p-2.5">
          <span className="font-semibold text-sky-700 dark:text-sky-400">{t("rivers.do_title")}</span>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
            {t("rivers.do_desc")}
          </p>
        </div>
        <div className="rounded-lg border border-orange-100 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 p-2.5">
          <span className="font-semibold text-orange-700 dark:text-orange-400">{t("rivers.bod_title")}</span>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
            {t("rivers.bod_desc")}
          </p>
        </div>
        <div className="rounded-lg border border-purple-100 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/30 p-2.5">
          <span className="font-semibold text-purple-700 dark:text-purple-400">{t("rivers.cod_title")}</span>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
            {t("rivers.cod_desc")}
          </p>
        </div>
        <div className="rounded-lg border border-rose-100 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-2.5">
          <span className="font-semibold text-rose-700 dark:text-rose-400">{t("rivers.fc_title")}</span>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
            {t("rivers.fc_desc")}
          </p>
        </div>
      </div>

      {/* Callout note */}
      {river.notes && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-5">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {language === "ta" ? (river.notes_ta ?? river.notes) : river.notes}
          </p>
        </div>
      )}

      {/* Description */}
      {river.description && (
        <div className="mb-5">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {language === "ta" ? (river.description_ta ?? river.description) : river.description}
          </p>
        </div>
      )}

      {/* Source */}
      <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-0.5">
        <p>{t("rivers.source")} {qualityData.source}</p>
        <p>{t("rivers.last_updated")} {qualityData.last_updated}</p>
      </div>
    </div>
  );
}

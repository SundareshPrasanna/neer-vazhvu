"use client";

import { useState, type ReactNode } from "react";
import { measureWorst, measureLabel } from "@/lib/rivers/measure";
import { RiverQualityChart } from "@/components/rivers/river-quality-chart";
import { ConnectedInsight } from "@/components/insights/connected-insight";
import type { RiverQualityData, SelectedRiver } from "@/types/river-quality";
import {
  QUALITY_COLORS,
  TREND_DO_THRESHOLD,
  TREND_BOD_THRESHOLD,
  computeStationTrend,
} from "@/types/river-quality";
import { useLanguage } from "@/lib/i18n/context";
import { NewsContext } from "@/components/insights/news-context";
import { RestorationSection } from "@/components/rivers/restoration-section";
import { computeRiverStatus } from "@/lib/utils/river-classification";

interface RiverPanelProps {
  selected: SelectedRiver;
  qualityData: RiverQualityData;
  onClose: () => void;
  onStationChange?: (stationId: string) => void;
  /** City id - threads through to RestorationSection so the right city's
   *  restoration-projects-{cityId}.json gets loaded. Defaults to Chennai. */
  cityId?: string;
  /** City display name - seeds NewsContext's Google News query. */
  cityDisplayName?: string;
  /** Optional extra sections rendered after the standard panel content
   *  (e.g. court-orders / events panel for Madurai, industrial sources
   *  filtered to the selected river). */
  additionalSections?: ReactNode;
}


export function RiverPanel({
  selected,
  qualityData,
  onClose,
  onStationChange,
  cityId,
  cityDisplayName,
  additionalSections,
}: RiverPanelProps) {
  const { t, language } = useLanguage();
  const river = qualityData.rivers.find((r) => r.id === selected.riverId);
  const [fallbackStationId, setFallbackStationId] = useState<string | undefined>(
    selected.stationId
  );

  if (!river) return null;
  // Default to the first station that actually has readings - opening
  // the panel on an empty station would show a blank chart. Stations
  // without data still appear in the selector below (greyed out) to
  // surface the gap.
  const firstStationWithReadings = river.stations.find((s) => s.readings.length > 0);
  const defaultStationId = firstStationWithReadings?.id ?? river.stations[0]?.id;
  const activeStationId = onStationChange
    ? (selected.stationId ?? defaultStationId)
    : (fallbackStationId ?? defaultStationId);

  const primaryRiverName = language === "ta" ? (river.name_ta ?? river.name) : river.name;
  const secondaryRiverName = language === "ta" ? river.name : river.name_ta;
  // Status is derived from current readings via CPCB Designated
  // Best-Use thresholds, not from the JSON's hardcoded label - so a
  // river's status reflects what the data actually shows today, not
  // a multi-year stretch-level designation that may have drifted.
  // The JSON value remains a fallback when no station has readings.
  const computedStatus = computeRiverStatus(river);
  const statusColor = QUALITY_COLORS[computedStatus];
  const statusLabel = t(`rivers_legend.${computedStatus}`);

  // No monitoring stations - show alarm state
  if (river.stations.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 w-full h-full p-4 sm:p-6 overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{primaryRiverName}</h3>
            {secondaryRiverName && (
              <span className="text-sm text-slate-500 dark:text-slate-400">{secondaryRiverName}</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md" aria-label={t("common.close_panel")}>
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium text-white" style={{ backgroundColor: statusColor }}>
            {statusLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3 text-center">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{river.length_km} km</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("rivers.length")}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{river.cpcb_class}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("rivers.cpcb_class")}</div>
          </div>
        </div>

        {/* No monitoring data alarm */}
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-lg p-4 mb-5">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="font-semibold text-red-800 dark:text-red-200 text-sm">{t("rivers.no_monitoring_title")}</h4>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{t("rivers.no_monitoring_desc")}</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                {t("rivers.no_monitoring_cta_before")}{" "}
                <a
                  href={`https://github.com/SundareshPrasanna/neer-vazhvu/issues/new?title=${encodeURIComponent(`[Data] Water quality monitoring source for ${river.name}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline hover:text-red-900 dark:hover:text-red-100"
                >
                  {t("rivers.no_monitoring_cta_link")}
                </a>.
              </p>
            </div>
          </div>
        </div>

        {/* Connected insight */}
        {(computedStatus === "dead" || computedStatus === "severely_degraded" || computedStatus === "degraded") && (
          <div className="mb-4">
            <ConnectedInsight
              messageKey="connected.river_recharge"
              linkHref="/water-bodies"
              linkKey="connected.river_wb_link"
            />
          </div>
        )}

        {/* Notes */}
        {river.notes && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-5">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              {language === "ta" ? (river.notes_ta ?? river.notes) : river.notes}
            </p>
          </div>
        )}

        <RestorationSection riverId={river.id} cityId={cityId} />

        {/* Description */}
        {river.description && (
          <div className="mb-5">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {language === "ta" ? (river.description_ta ?? river.description) : river.description}
            </p>
          </div>
        )}

        {additionalSections}

        <NewsContext domain="rivers" locationName={`${river.name} river`} cityName={cityDisplayName} />

        <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-0.5">
          <p>
            {t("rivers.source")}{" "}
            <a href={qualityData.source_url ?? "https://cpcb.gov.in/nwmp-data-2024/"} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 hover:underline">
              {qualityData.source_label ?? "NWMP Data by CPCB"}
            </a>
          </p>
          <p>{t("rivers.last_updated")} {qualityData.last_updated}</p>
        </div>
      </div>
    );
  }

  const activeStation =
    river.stations.find((s) => s.id === activeStationId) ?? firstStationWithReadings ?? river.stations[0];

  // Latest DO reading from active station
  const latestReading = [...activeStation.readings].sort((a, b) => b.year - a.year)[0];
  const latestDO = measureWorst(latestReading?.do_mgl, "lower-is-worse");

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
          <div className="space-y-1.5 text-xs">
            {trend.do_delta !== null && (
              <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 rounded px-2 py-1">
                <span className="text-slate-500 dark:text-slate-400 font-medium">DO <span className="font-normal text-slate-400 dark:text-slate-500">(↑ = better)</span></span>
                <span className={`font-mono font-semibold ${
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
              <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 rounded px-2 py-1">
                <span className="text-slate-500 dark:text-slate-400 font-medium">BOD <span className="font-normal text-slate-400 dark:text-slate-500">(↓ = better)</span></span>
                <span className={`font-mono font-semibold ${
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
        </div>
      )}

      {/* Connected insight: degraded river blocks recharge */}
      {(computedStatus === "dead" || computedStatus === "severely_degraded") && (
        <div className="mb-4">
          <ConnectedInsight
            messageKey="connected.river_recharge"
            linkHref="/water-bodies"
            linkKey="connected.river_wb_link"
          />
        </div>
      )}

      {/* Station selector - stations without readings are kept visible
          but greyed out, to surface the editorial point that those
          stations exist on the CPCB roster but publish no data. */}
      {river.stations.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {river.stations.map((station) => {
            const hasReadings = station.readings.length > 0;
            return (
              <button
                key={station.id}
                onClick={() => {
                  if (onStationChange) {
                    onStationChange(station.id);
                    return;
                  }
                  setFallbackStationId(station.id);
                }}
                title={hasReadings ? undefined : t("rivers.station_no_data")}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                  activeStationId === station.id
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                    : hasReadings
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-600 line-through hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {formatStretch(station.stretch)}
                {!hasReadings && (
                  <span className="ml-1 text-[10px] font-normal opacity-70">no data</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Chart - falls back to a "no data published" callout when the
          selected station has no readings (CPCB has it on the roster
          but doesn't publish results). */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
          {t("rivers.water_quality")}: {activeStation.name}
        </div>
        {activeStation.readings.length === 0 ? (
          <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-3 text-xs text-amber-900 dark:text-amber-200">
            <span className="font-semibold">No CPCB data published.</span>{" "}
            This station appears on the National Water Monitoring Programme
            roster, but no annual readings have been released for it. The
            station&apos;s job is to monitor this stretch - the data gap
            is itself the story.
          </div>
        ) : (
          <RiverQualityChart
            readings={activeStation.readings}
            stationName={activeStation.name}
          />
        )}
      </div>

      {/* Pollution profile - latest readings */}
      {latestReading && (
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            {t("rivers.pollution_profile")} ({latestReading.year})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            {/* DO - Dissolved Oxygen (inverted: higher = better) */}
            {measureWorst(latestReading.do_mgl, "lower-is-worse") != null && (() => {
              const minHealthy = 4; // mg/L for aquatic life
              const val = measureWorst(latestReading.do_mgl, "lower-is-worse") as number;
              const shown = measureLabel(latestReading.do_mgl);
              const dead = val < 1;
              const critical = val < 4;
              return (
                <div className={`rounded-lg px-2.5 py-1.5 ${dead ? "bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800" : critical ? "bg-orange-50 dark:bg-orange-950/30 ring-1 ring-orange-200 dark:ring-orange-800" : "bg-slate-50 dark:bg-slate-800"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">DO</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{t("rivers.limit")}: {"\u2265"}{minHealthy} mg/L</span>
                  </div>
                  <div className={`font-mono font-bold ${dead ? "text-red-600 dark:text-red-400" : critical ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                    {shown} <span className="font-normal text-slate-400">mg/L</span>
                    {critical && val > 0 && <span className="ml-1.5 text-[10px] font-semibold text-red-500 dark:text-red-400">{(minHealthy / val).toFixed(0)}x {t("rivers.below_min")}</span>}
                    {dead && val === 0 && <span className="ml-1.5 text-[10px] font-semibold text-red-500 dark:text-red-400">{t("rivers.dead_zone")}</span>}
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full ${dead ? "bg-red-500" : critical ? "bg-orange-400" : "bg-green-400"}`} style={{ width: `${Math.min((val / minHealthy) * 100, 100)}%` }} />
                  </div>
                </div>
              );
            })()}
            {/* BOD - Biochemical Oxygen Demand (higher = worse) */}
            {measureWorst(latestReading.bod_mgl, "higher-is-worse") != null && (() => {
              const limit = 3; // Class C standard
              const val = measureWorst(latestReading.bod_mgl, "higher-is-worse") as number;
              const shown = measureLabel(latestReading.bod_mgl);
              const ratio = val / limit;
              const exceeded = val > limit;
              const severe = val > 30;
              return (
                <div className={`rounded-lg px-2.5 py-1.5 ${severe ? "bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800" : exceeded ? "bg-orange-50 dark:bg-orange-950/30 ring-1 ring-orange-200 dark:ring-orange-800" : "bg-slate-50 dark:bg-slate-800"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">BOD</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{t("rivers.limit")}: {limit} mg/L</span>
                  </div>
                  <div className={`font-mono font-bold ${severe ? "text-red-600 dark:text-red-400" : exceeded ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                    {shown} <span className="font-normal text-slate-400">mg/L</span>
                    {exceeded && <span className="ml-1 text-[10px] font-semibold text-red-500 dark:text-red-400">{ratio.toFixed(0)}x</span>}
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full ${severe ? "bg-red-500" : exceeded ? "bg-orange-400" : "bg-green-400"}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                  </div>
                </div>
              );
            })()}
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
                    <div className={`h-full rounded-full ${severe ? "bg-red-500" : exceeded ? "bg-orange-400" : "bg-green-400"}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                  </div>
                  {latestReading.fecal_coliform_note && (
                    <p className="mt-1.5 text-[10px] leading-snug text-amber-700 dark:text-amber-400 italic">
                      ⚠ {latestReading.fecal_coliform_note}
                    </p>
                  )}
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
                    <div className={`h-full rounded-full ${severe ? "bg-red-500" : exceeded ? "bg-orange-400" : "bg-green-400"}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5 text-xs">
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
        <div className="rounded-lg border border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-2.5">
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">{t("rivers.nitrate_title")}</span>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
            {t("rivers.nitrate_desc")}
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

      <RestorationSection riverId={river.id} cityId={cityId} />

      {/* Description */}
      {river.description && (
        <div className="mb-5">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {language === "ta" ? (river.description_ta ?? river.description) : river.description}
          </p>
        </div>
      )}

      {additionalSections}

      <NewsContext domain="rivers" locationName={`${river.name} river`} cityName={cityDisplayName} />

      {/* Source */}
      <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-0.5">
        <p>
          {t("rivers.source")}{" "}
          <a
            href={qualityData.source_url ?? "https://cpcb.gov.in/nwmp-data-2024/"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 dark:text-blue-400 hover:underline"
          >
            {qualityData.source_label ?? "NWMP Data by CPCB"}
          </a>
        </p>
        <p>{t("rivers.last_updated")} {qualityData.last_updated}</p>
        <p>
          {t("rivers.report_issue_before")}{" "}
          <a
            href={`https://github.com/SundareshPrasanna/neer-vazhvu/issues/new?title=${encodeURIComponent(`[Data] ${river.name} - data inconsistency`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 dark:text-blue-400 hover:underline"
          >
            {t("rivers.report_issue_link")}
          </a>
        </p>
      </div>
    </div>
  );
}

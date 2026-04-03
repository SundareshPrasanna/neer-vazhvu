"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ConnectedInsight } from "@/components/insights/connected-insight";
import { WardContext } from "@/components/insights/ward-context";
import { WardNarrative } from "@/components/insights/ward-narrative";
import { WardRepresentatives } from "@/components/insights/ward-representatives";
import { useWardLookup } from "@/lib/hooks/use-ward-lookup";
import type { CensusWaterBodyProperties, SelectedWaterBody, WaterBodyStatus } from "@/types/water-bodies";
import { STATUS_COLORS } from "@/types/water-bodies";
import type { ScoredWaterBody } from "@/types/restoration";
import { getPriorityColor } from "@/types/restoration";
import { useLanguage } from "@/lib/i18n/context";
import { NewsContext } from "@/components/insights/news-context";
import { formatDate, formatNumber } from "@/lib/utils/format";
import {
  normalizeWaterBodySatelliteSummary,
  satelliteAnomalyPercent,
  satelliteAnomalyTone,
  shouldShowWaterBodySatelliteSummary,
  type WaterBodySatelliteSummary,
} from "@/lib/gee/water-body-satellite";
import {
  RIVER_POLLUTION_COMPONENT_THRESHOLD,
  RIVER_POLLUTION_COMPONENT_MAX,
  LOST_PROXIMITY_COMPONENT_THRESHOLD,
  INDUSTRIAL_PROXIMITY_COMPONENT_THRESHOLD,
} from "@/lib/insights/constants";
import { assessCensusCapacity } from "@/lib/water-bodies/census-capacity";

interface UnifiedDetailPanelProps {
  selected: SelectedWaterBody;
  restorationData: ScoredWaterBody | null;
  onClose: () => void;
}

const STATUS_TKEYS: Record<WaterBodyStatus, string> = {
  fully_lost: "wb_panel.fully_lost",
  severely_reduced: "wb_panel.severely_reduced",
  partially_encroached: "wb_panel.partially_encroached",
};

const SCORE_COMPONENTS = [
  { key: "size"                 as const, tKey: "lr.comp_size",       weight: 0.20, max: 20 },
  { key: "lost_proximity"      as const, tKey: "lr.comp_lost",       weight: 0.18, max: 18 },
  { key: "river_pollution"     as const, tKey: "lr.comp_river",      weight: 0.18, max: 18 },
  { key: "industrial_proximity" as const, tKey: "lr.comp_industrial", weight: 0.14, max: 14 },
  { key: "type_bonus"          as const, tKey: "lr.comp_type",       weight: 0.15, max: 15 },
  { key: "census_condition"    as const, tKey: "lr.comp_census",     weight: 0.15, max: 15 },
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
        {value}
      </span>
    </div>
  );
}

function CloseButton({ onClose, ariaLabel }: { onClose: () => void; ariaLabel: string }) {
  return (
    <button
      onClick={onClose}
      className="ml-2 p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
      aria-label={ariaLabel}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

function interpolate(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

function formatHectares(area: number | null): string {
  if (area === null || Number.isNaN(area)) {
    return "\u2014";
  }

  const decimals = area >= 100 ? 0 : 1;
  return `${formatNumber(area, decimals)} ha`;
}

function formatCapacityM3(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "\u2014";
  }

  return formatNumber(value, 0);
}

function sourceLabel(source: string, t: (key: string) => string): string {
  if (source === "dynamic_world") {
    return t("wb_panel.satellite_source_dynamic_world");
  }

  return source
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function currentSpreadToneClasses(tone: "lower" | "near_normal" | "higher"): string {
  switch (tone) {
    case "lower":
      return "bg-amber-500";
    case "higher":
      return "bg-sky-500";
    case "near_normal":
    default:
      return "bg-emerald-500";
  }
}

function persistenceInsightKey(persistencePct: number | null): string | null {
  if (persistencePct === null || Number.isNaN(persistencePct)) {
    return null;
  }
  if (persistencePct >= 95) {
    return "wb_panel.satellite_persistence_year_round";
  }
  if (persistencePct >= 75) {
    return "wb_panel.satellite_persistence_most_year";
  }
  if (persistencePct >= 40) {
    return "wb_panel.satellite_persistence_seasonal";
  }
  if (persistencePct >= 15) {
    return "wb_panel.satellite_persistence_wet_months";
  }
  return "wb_panel.satellite_persistence_ephemeral";
}

const SATELLITE_CARD_CLASS =
  "rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-3";
const SATELLITE_LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
const SATELLITE_VALUE_CLASS = "mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100";
const DYNAMIC_WORLD_INFO_URL =
  "https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1";

function SatelliteContextSection({ summary }: { summary: WaterBodySatelliteSummary }) {
  const { t } = useLanguage();
  const tone = satelliteAnomalyTone(summary.surfaceWaterAnomalyLevel);
  const observationDate = summary.observationEnd || summary.summaryDate;
  const confidenceLabel = t(`wb_panel.satellite_confidence_${summary.confidenceLevel}`);
  const observedAreaText = formatHectares(summary.latestObservedAreaHa);
  const baselineAreaText = formatHectares(summary.seasonalBaselineAreaHa);
  const persistenceText =
    summary.historicalPersistencePct == null
      ? "\u2014"
      : `${Math.round(summary.historicalPersistencePct)}%`;
  const coverageText =
    summary.validPixelPct == null
      ? "\u2014"
      : interpolate(t("wb_panel.satellite_coverage_value"), {
          pct: Math.round(summary.validPixelPct),
        });
  const anomalyPct = satelliteAnomalyPercent(summary.anomalyRatio);
  const compareMax = Math.max(
    summary.latestObservedAreaHa ?? 0,
    summary.seasonalBaselineAreaHa ?? 0,
    1,
  );
  const currentBarWidth = Math.max(
    6,
    Math.round((((summary.latestObservedAreaHa ?? 0) / compareMax) * 100)),
  );
  const baselineBarWidth = Math.max(
    6,
    Math.round((((summary.seasonalBaselineAreaHa ?? 0) / compareMax) * 100)),
  );
  const hasAreaComparison =
    summary.latestObservedAreaHa != null && summary.seasonalBaselineAreaHa != null;
  const hasAnomalyEvidence = hasAreaComparison && anomalyPct !== null;
  const summaryText = hasAnomalyEvidence
    ? interpolate(t(`wb_panel.satellite_summary_${tone}`), {
        observed: observedAreaText,
        baseline: baselineAreaText,
        delta: `${Math.abs(anomalyPct)}%`,
      })
    : t(`wb_panel.satellite_current_${tone}`);
  const sensorLabel = sourceLabel(summary.sensorSource, t);
  const persistenceInsight = persistenceInsightKey(summary.historicalPersistencePct);

  return (
    <div className="border-t border-slate-200 dark:border-slate-700">
      <div className="px-4 pt-3 pb-1.5">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {t("wb_panel.satellite_context")}
        </h3>
      </div>
      <div className="px-4 pb-4 space-y-3.5">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
          {summaryText}
        </p>

        {persistenceInsight ? (
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {t("wb_panel.satellite_metric_persistence")}:
            </span>{" "}
            {t(persistenceInsight)}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className={SATELLITE_CARD_CLASS}>
            <div className={SATELLITE_LABEL_CLASS}>
              {t("wb_panel.satellite_metric_current")}
            </div>
            <div className={SATELLITE_VALUE_CLASS}>
              {observedAreaText}
            </div>
          </div>
          <div className={SATELLITE_CARD_CLASS}>
            <div className={SATELLITE_LABEL_CLASS}>
              {t("wb_panel.satellite_metric_baseline")}
            </div>
            <div className={SATELLITE_VALUE_CLASS}>
              {baselineAreaText}
            </div>
          </div>
          <div className={SATELLITE_CARD_CLASS}>
            <div className={SATELLITE_LABEL_CLASS}>
              {t("wb_panel.satellite_metric_persistence")}
            </div>
            <div className={SATELLITE_VALUE_CLASS}>
              {persistenceText}
            </div>
          </div>
          <div className={SATELLITE_CARD_CLASS}>
            <div className={SATELLITE_LABEL_CLASS}>
              {t("wb_panel.satellite_metric_coverage")}
            </div>
            <div className={SATELLITE_VALUE_CLASS}>
              {coverageText}
            </div>
          </div>
        </div>

        {hasAreaComparison ? (
          <div className={`${SATELLITE_CARD_CLASS} space-y-3`}>
            <div className={SATELLITE_LABEL_CLASS}>
              {t("wb_panel.satellite_compare_title")}
            </div>

            <div className="space-y-2">
              <div>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">{t("wb_panel.satellite_compare_current")}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{observedAreaText}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full transition-all ${currentSpreadToneClasses(tone)}`}
                    style={{ width: `${currentBarWidth}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">{t("wb_panel.satellite_compare_baseline")}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{baselineAreaText}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all"
                    style={{ width: `${baselineBarWidth}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {interpolate(t("wb_panel.satellite_observed"), {
            source: sensorLabel,
            date: formatDate(observationDate),
            confidence: confidenceLabel,
          })}
        </p>

        {summary.sensorSource === "dynamic_world" ? (
          <div className={`${SATELLITE_CARD_CLASS} space-y-2`}>
            <div className={SATELLITE_LABEL_CLASS}>{sensorLabel}</div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {t("wb_panel.satellite_source_explainer_dynamic_world")}
            </p>
            <a
              href={DYNAMIC_WORLD_INFO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {t("wb_panel.satellite_source_link_dynamic_world")}
              <span className="ml-1" aria-hidden="true">↗</span>
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CensusCapacitySection({ census }: { census: CensusWaterBodyProperties }) {
  const { t } = useLanguage();
  const assessment = assessCensusCapacity(census);

  if (!assessment.hasCapacity) {
    return null;
  }

  if (assessment.shouldHideCapacity) {
    return (
      <div className="px-4 pb-4">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
          {t("wb_panel.storage_capacity")}
        </h4>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
            {t("wb_panel.capacity_hidden_suspect")}
          </p>
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            {t("wb_panel.capacity_units_note")}
          </p>
        </div>
      </div>
    );
  }

  const capacityPct = assessment.capacityPct == null
    ? null
    : Math.max(0, Math.min(assessment.capacityPct, 100));
  const capacityEncroachMismatch = assessment.issues.includes("encroachment_mismatch");

  return (
    <div className="px-4 pb-4">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
        {t("wb_panel.storage_capacity")}
      </h4>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
        <span>{t("wb_panel.capacity_remaining")}</span>
        <span>{capacityPct == null ? "\u2014" : `${capacityPct}%`}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${capacityPct ?? 0}%`,
            backgroundColor: capacityEncroachMismatch
              ? "#f59e0b"
              : (capacityPct ?? 0) > 70 ? "#10b981" : (capacityPct ?? 0) > 40 ? "#f59e0b" : "#ef4444",
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-1 gap-4">
        <span>{t("wb_panel.original_capacity")}: {formatCapacityM3(census.storage_capacity_original)}</span>
        <span>{t("wb_panel.present_capacity")}: {formatCapacityM3(census.storage_capacity_present)}</span>
      </div>
      {capacityEncroachMismatch ? (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 leading-snug">
          {t("wb_panel.capacity_vs_encroach")}
        </p>
      ) : null}
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
        {t("wb_panel.capacity_units_note")}
      </p>
    </div>
  );
}

function RestorationSection({ wb }: { wb: ScoredWaterBody }) {
  const { t, language } = useLanguage();
  const color = getPriorityColor(wb.priority_level);
  const levelLabel = t(`lr.${wb.priority_level}`);

  return (
    <>
      {/* Priority score */}
      <div className="px-4 pt-4 pb-2 border-t border-slate-100 dark:border-slate-800">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
          {t("lr.priority_score")}
        </h4>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color }}>
            {wb.priority_score}
          </span>
          <span className="text-sm text-slate-400 dark:text-slate-500">/ 100</span>
          <Badge className="ml-1" style={{ backgroundColor: color, color: "white" }}>
            {levelLabel}
          </Badge>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="px-4 py-3">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
          {t("lr.score_breakdown")}
        </h4>
        <div className="space-y-3">
          {SCORE_COMPONENTS.map(({ key, tKey, weight, max }) => {
            const subScore = wb.components[key];
            const contribution = subScore * weight;
            const pct = (contribution / max) * 100;
            return (
              <div key={key}>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span>{t(tKey)}</span>
                  <span className="font-mono tabular-nums">
                    {contribution.toFixed(0)} / {max}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connected insight: river pollution proximity */}
      {wb.components.river_pollution >= RIVER_POLLUTION_COMPONENT_THRESHOLD && wb.nearest_river_station && (
        <div className="px-4">
          <ConnectedInsight
            messageKey="connected.wb_river_pollution"
            params={{
              n: Math.round(wb.components.river_pollution * 0.18),
              max: RIVER_POLLUTION_COMPONENT_MAX,
              station: wb.nearest_river_station,
              status: wb.components.river_pollution >= 70 ? "degraded" : "stressed",
            }}
            linkHref="/rivers"
            linkKey="connected.wb_river_link"
          />
        </div>
      )}

      {/* Connected insight: nearby lost water body */}
      {wb.components.lost_proximity >= LOST_PROXIMITY_COMPONENT_THRESHOLD && wb.nearest_lost_body && (
        <div className="px-4">
          <ConnectedInsight
            messageKey="connected.wb_lost_proximity"
            linkHref="/water-bodies?mode=existing"
            linkKey="connected.wb_lost_link"
          />
        </div>
      )}

      {/* Connected insight: industrial discharge proximity */}
      {wb.components.industrial_proximity >= INDUSTRIAL_PROXIMITY_COMPONENT_THRESHOLD && wb.nearest_industrial && (
        <div className="px-4">
          <ConnectedInsight
            messageKey="connected.wb_industrial"
            linkHref="/rivers"
            linkKey="connected.wb_industrial_link"
          />
        </div>
      )}

      {/* Nearest features */}
      <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
        {wb.nearest_lost_body && (
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
              {t("lr.nearest_lost")}
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300">
              {language === "ta" ? (wb.nearest_lost_body_ta || wb.nearest_lost_body) : wb.nearest_lost_body}
              <span className="text-slate-400 dark:text-slate-500 ml-1">
                ({wb.nearest_lost_km} {t("lr.km_away")})
              </span>
            </div>
          </div>
        )}
        {wb.nearest_river_station && (
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
              {t("lr.nearest_river")}
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300">
              {language === "ta" ? (wb.nearest_river_station_ta || wb.nearest_river_station) : wb.nearest_river_station}
              <span className="text-slate-400 dark:text-slate-500 ml-1">
                ({wb.nearest_river_km} {t("lr.km_away")})
              </span>
            </div>
          </div>
        )}
        {wb.nearest_industrial && (
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
              {t("lr.nearest_industrial")}
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300">
              {language === "ta" ? (wb.nearest_industrial_ta || wb.nearest_industrial) : wb.nearest_industrial}
              <span className="text-slate-400 dark:text-slate-500 ml-1">
                ({wb.nearest_industrial_km} {t("lr.km_away")})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Methodology */}
      <div className="px-4 pb-4 text-xs text-slate-400 dark:text-slate-500 space-y-1">
        <p>{t("lr.methodology")}</p>
        <p>{t("lr.source_note")}</p>
      </div>
    </>
  );
}

export function UnifiedDetailPanel({ selected, restorationData, onClose }: UnifiedDetailPanelProps) {
  const { t, language } = useLanguage();
  const closeAria = t("common.close_panel");
  const wardLookup = useWardLookup();
  const [resolvedWard, setResolvedWard] = useState<number | null>(null);
  const [satelliteSummaryState, setSatelliteSummaryState] = useState<{
    osmId: number;
    summary: WaterBodySatelliteSummary | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (selected.latlng) {
      wardLookup(selected.latlng[0], selected.latlng[1]).then((w) => {
        if (!cancelled) setResolvedWard(w);
      });
    } else {
      Promise.resolve().then(() => { if (!cancelled) setResolvedWard(null); });
    }
    return () => { cancelled = true; };
  }, [selected, wardLookup]);

  useEffect(() => {
    const controller = new AbortController();

    if (selected.kind !== "current") {
      return () => controller.abort();
    }

    const osmId = selected.props.osm_id;
    fetch(`/api/water-bodies/gee?osm_id=${selected.props.osm_id}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) {
          return null;
        }
        if (!response.ok) {
          throw new Error(`Failed to fetch water-body satellite context: ${response.status}`);
        }
        const payload = await response.json();
        return payload?.data ? normalizeWaterBodySatelliteSummary(payload.data) : null;
      })
      .then((row) => {
        setSatelliteSummaryState({
          osmId,
          summary: shouldShowWaterBodySatelliteSummary(row) ? row : null,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setSatelliteSummaryState({ osmId, summary: null });
      });

    return () => controller.abort();
  }, [selected]);

  const satelliteSummary =
    selected.kind === "current" && satelliteSummaryState?.osmId === selected.props.osm_id
      ? satelliteSummaryState.summary
      : null;

  const localizeType = (value: string | undefined): string => {
    if (!value) return t("wb_panel.water_body");
    const key = `wb_type.${value.toLowerCase()}`;
    const localized = t(key);
    return localized === key ? value.charAt(0).toUpperCase() + value.slice(1) : localized;
  };

  const localizeReplacement = (value: string): string => {
    const key = `wb_replace.${value}`;
    const localized = t(key);
    return localized === key ? value : localized;
  };

  if (selected.kind === "current") {
    const { props } = selected;
    const primaryName = language === "ta"
      ? (props.name_ta || props.name || t("wb_panel.unnamed"))
      : (props.name || t("wb_panel.unnamed"));
    const secondaryName = language === "ta" ? props.name : props.name_ta;
    const areaText = props.area_ha
      ? `${props.area_ha.toLocaleString()} ha`
      : t("wb_panel.unknown");
    const type = localizeType(props.water_type);

    return (
      <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight truncate">
              {primaryName}
            </h2>
            {secondaryName && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {secondaryName}
              </p>
            )}
          </div>
          <CloseButton onClose={onClose} ariaLabel={closeAria} />
        </div>

        {/* Status */}
        <div className="px-4 pt-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            {t("wb_panel.existing")}
          </span>
        </div>

        {/* Basic stats */}
        <div className="p-4 grid grid-cols-2 gap-4">
          <Row label={t("wb_panel.type")} value={type} />
          <Row label={t("wb_panel.area")} value={areaText} />
          <Row label={t("wb_panel.osm_id")} value={`#${props.osm_id}`} />
        </div>

        {satelliteSummary ? <SatelliteContextSection summary={satelliteSummary} /> : null}

        {/* Census data (when matched to an OSM polygon) */}
        {selected.censusMatch && (() => {
          const cm = selected.censusMatch;

          return (
            <div className="border-t border-slate-200 dark:border-slate-700">
              <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {t("wb_panel.census_record")}
                </h3>
                {cm.encroachment_status === "yes" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                    {t("wb_panel.encroached")}
                    {cm.encroachment_pct != null && ` (${cm.encroachment_pct}%)`}
                  </span>
                )}
                {cm.is_in_use === false && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                    {t("wb_panel.not_in_use")}
                  </span>
                )}
              </div>

              <div className="px-4 py-3 grid grid-cols-2 gap-4">
                <Row label={t("wb_panel.ownership")} value={cm.ownership || "-"} />
                {cm.nature && <Row label={t("wb_panel.nature")} value={cm.nature} />}
                {cm.max_depth_m != null && (
                  <Row label={t("wb_panel.depth")} value={`${cm.max_depth_m} m`} />
                )}
                {cm.basin && <Row label={t("wb_panel.basin")} value={cm.basin} />}
                {cm.construction_year != null && cm.construction_year > 0 && (
                  <Row label={t("wb_panel.built")} value={String(cm.construction_year)} />
                )}
              </div>

              <CensusCapacitySection census={cm} />

              <div className="px-4 pb-3">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  <span className="font-medium">{t("wb_panel.source")}</span>{" "}
                  {t("wb_panel.census_source_label")}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Restoration data (always shown when available) */}
        {restorationData && <RestorationSection wb={restorationData} />}
        {resolvedWard && (
          <div className="px-4">
            <WardContext wardNumber={resolvedWard} />
            <WardRepresentatives wardNumber={resolvedWard} />
            <WardNarrative wardNumber={resolvedWard} />
            <NewsContext domain="water_bodies" />
          </div>
        )}
      </div>
    );
  }

  if (selected.kind === "census") {
    const { props } = selected;
    const name = props.name || t("wb_panel.unnamed");
    const type = localizeType(props.water_body_type ?? undefined);

    return (
      <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight truncate">
              {name}
            </h2>
            {props.village && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {props.village}
              </p>
            )}
          </div>
          <CloseButton onClose={onClose} ariaLabel={closeAria} />
        </div>

        {/* Status badges */}
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
            {t("wb_panel.census_record")}
          </span>
          {props.encroachment_status === "yes" && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
              {t("wb_panel.encroached")}
              {props.encroachment_pct != null && ` (${props.encroachment_pct}%)`}
            </span>
          )}
          {props.is_in_use === false && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
              {t("wb_panel.not_in_use")}
            </span>
          )}
        </div>

        {/* Basic stats */}
        <div className="p-4 grid grid-cols-2 gap-4">
          <Row label={t("wb_panel.type")} value={type} />
          <Row label={t("wb_panel.ownership")} value={props.ownership || "-"} />
          {props.nature && <Row label={t("wb_panel.nature")} value={props.nature} />}
          {props.max_depth_m != null && (
            <Row label={t("wb_panel.depth")} value={`${props.max_depth_m} m`} />
          )}
          {props.basin && <Row label={t("wb_panel.basin")} value={props.basin} />}
          {props.construction_year != null && props.construction_year > 0 && (
            <Row label={t("wb_panel.built")} value={String(props.construction_year)} />
          )}
        </div>

        <CensusCapacitySection census={props} />

        {/* Point location note */}
        <div className="px-4 pb-2">
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            {t("wb_panel.point_location")}
          </p>
        </div>

        {/* Restoration data (when available) */}
        {restorationData && <RestorationSection wb={restorationData} />}

        {/* Source */}
        <div className="px-4 pb-4">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            <span className="font-medium">{t("wb_panel.source")}</span>{" "}
            {t("wb_panel.census_source_label")}
          </p>
        </div>
        {resolvedWard && (
          <div className="px-4">
            <WardContext wardNumber={resolvedWard} />
            <WardRepresentatives wardNumber={resolvedWard} />
            <WardNarrative wardNumber={resolvedWard} />
            <NewsContext domain="water_bodies" />
          </div>
        )}
      </div>
    );
  }

  // Lost water body
  const { props } = selected;
  const primaryName = language === "ta"
    ? (props.name_ta || props.name)
    : props.name;
  const secondaryName = language === "ta" ? props.name : props.name_ta;
  const noteText = language === "ta" ? (props.notes_ta || props.notes) : props.notes;
  const pctLost =
    props.current_area_ha !== undefined
      ? Math.round(
          ((props.historical_area_ha - props.current_area_ha) /
            props.historical_area_ha) *
            100
        )
      : 100;

  const statusColor = STATUS_COLORS[props.status];
  const statusLabel = t(STATUS_TKEYS[props.status]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
            {primaryName}
          </h2>
          {secondaryName && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {secondaryName}
            </p>
          )}
        </div>
        <CloseButton onClose={onClose} ariaLabel={closeAria} />
      </div>

      {/* Status badge */}
      <div className="px-4 pt-3">
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: statusColor }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Stats grid */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <Row label={t("wb_panel.type")} value={localizeType(props.type)} />
        <Row label={t("wb_panel.area_lost")} value={`~${pctLost}%`} />
        <Row
          label={t("wb_panel.historical_area")}
          value={`~${props.historical_area_ha.toLocaleString()} ha`}
        />
        {props.current_area_ha !== undefined ? (
          <Row
            label={t("wb_panel.surviving_area")}
            value={`~${props.current_area_ha.toLocaleString()} ha`}
          />
        ) : (
          <Row label={t("wb_panel.surviving_area")} value={t("wb_panel.none")} />
        )}
        <Row
          label={t("wb_panel.replaced_by")}
          value={localizeReplacement(props.replaced_by)}
        />
      </div>

      {/* Area loss bar */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span>{t("wb_panel.area_remaining")}</span>
          <span>{100 - pctLost}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${100 - pctLost}%` }}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-4">
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {noteText}
        </p>
      </div>

      {/* Source */}
      <div className="px-4 pb-4">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          <span className="font-medium">{t("wb_panel.source")}</span> {props.source}
        </p>
      </div>
      {resolvedWard && (
        <div className="px-4">
          <WardContext wardNumber={resolvedWard} />
          <WardRepresentatives wardNumber={resolvedWard} />
          <WardNarrative wardNumber={resolvedWard} />
          <NewsContext domain="water_bodies" />
        </div>
      )}
    </div>
  );
}

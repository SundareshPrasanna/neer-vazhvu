"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ConnectedInsight } from "@/components/insights/connected-insight";
import { WardContext } from "@/components/insights/ward-context";
import { WardNarrative } from "@/components/insights/ward-narrative";
import { WardRepresentatives } from "@/components/insights/ward-representatives";
import { useWardLookup } from "@/lib/hooks/use-ward-lookup";
import type { SelectedWaterBody, WaterBodyStatus } from "@/types/water-bodies";
import { STATUS_COLORS } from "@/types/water-bodies";
import type { ScoredWaterBody } from "@/types/restoration";
import { getPriorityColor } from "@/types/restoration";
import { useLanguage } from "@/lib/i18n/context";
import {
  RIVER_POLLUTION_COMPONENT_THRESHOLD,
  RIVER_POLLUTION_COMPONENT_MAX,
  LOST_PROXIMITY_COMPONENT_THRESHOLD,
  INDUSTRIAL_PROXIMITY_COMPONENT_THRESHOLD,
} from "@/lib/insights/constants";

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

        {/* Census data (when matched to an OSM polygon) */}
        {selected.censusMatch && (() => {
          const cm = selected.censusMatch;
          const hasCapacity = cm.storage_capacity_original != null && cm.storage_capacity_original > 0;
          const capacityPct = hasCapacity && cm.storage_capacity_present != null
            ? Math.round((cm.storage_capacity_present / cm.storage_capacity_original!) * 100)
            : null;
          const isEncroached = cm.encroachment_status === "yes" && (cm.encroachment_pct ?? 0) > 0;
          const capacityEncroachMismatch = isEncroached && capacityPct != null && capacityPct >= 90;

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

              {hasCapacity && (
                <div className="px-4 pb-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>{t("wb_panel.capacity_remaining")}</span>
                    <span>{capacityPct ?? 0}%</span>
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
                  <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-1">
                    <span>{t("wb_panel.original")}: {cm.storage_capacity_original}</span>
                    <span>{t("wb_panel.present")}: {cm.storage_capacity_present ?? 0}</span>
                  </div>
                  {capacityEncroachMismatch && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 leading-snug">
                      {t("wb_panel.capacity_vs_encroach")}
                    </p>
                  )}
                </div>
              )}

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
          </div>
        )}
      </div>
    );
  }

  if (selected.kind === "census") {
    const { props } = selected;
    const name = props.name || t("wb_panel.unnamed");
    const type = localizeType(props.water_body_type ?? undefined);
    const hasCapacity = props.storage_capacity_original != null && props.storage_capacity_original > 0;
    const capacityPct = hasCapacity && props.storage_capacity_present != null
      ? Math.round((props.storage_capacity_present / props.storage_capacity_original!) * 100)
      : null;
    const isEncroached = props.encroachment_status === "yes" && (props.encroachment_pct ?? 0) > 0;
    // Flag when encroachment is significant but capacity shows no loss
    const capacityEncroachMismatch = isEncroached && capacityPct != null && capacityPct >= 90;

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

        {/* Storage capacity bar */}
        {hasCapacity && (
          <div className="px-4 pb-4">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
              {t("wb_panel.storage_capacity")}
            </h4>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{t("wb_panel.capacity_remaining")}</span>
              <span>{capacityPct ?? 0}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${capacityPct ?? 0}%`,
                  backgroundColor: capacityEncroachMismatch
                    ? "#f59e0b"  // amber — capacity not revised despite encroachment
                    : (capacityPct ?? 0) > 70 ? "#10b981" : (capacityPct ?? 0) > 40 ? "#f59e0b" : "#ef4444",
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-1">
              <span>{t("wb_panel.original")}: {props.storage_capacity_original}</span>
              <span>{t("wb_panel.present")}: {props.storage_capacity_present ?? 0}</span>
            </div>
            {capacityEncroachMismatch && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 leading-snug">
                {t("wb_panel.capacity_vs_encroach")}
              </p>
            )}
          </div>
        )}

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
        </div>
      )}
    </div>
  );
}

"use client";

import type { SelectedWaterBody, WaterBodyStatus } from "@/types/water-bodies";
import { STATUS_COLORS } from "@/types/water-bodies";
import { useLanguage } from "@/lib/i18n/context";

interface WaterBodyPanelProps {
  selected: SelectedWaterBody;
  onClose: () => void;
}

const STATUS_TKEYS: Record<WaterBodyStatus, string> = {
  fully_lost: "wb_panel.fully_lost",
  severely_reduced: "wb_panel.severely_reduced",
  partially_encroached: "wb_panel.partially_encroached",
};

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

const CLOSE_BTN = (onClose: () => void, ariaLabel: string) => (
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

export function WaterBodyPanel({ selected, onClose }: WaterBodyPanelProps) {
  const { t, language } = useLanguage();
  const closeAria = t("common.close_panel");

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
          {CLOSE_BTN(onClose, closeAria)}
        </div>

        {/* Status */}
        <div className="px-4 pt-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            {t("wb_panel.existing")}
          </span>
        </div>

        {/* Stats */}
        <div className="p-4 grid grid-cols-2 gap-4">
          <Row label={t("wb_panel.type")} value={type} />
          <Row label={t("wb_panel.area")} value={areaText} />
          <Row label={t("wb_panel.osm_id")} value={`#${props.osm_id}`} />
        </div>
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
        {CLOSE_BTN(onClose, closeAria)}
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
        <Row
          label={t("wb_panel.type")}
          value={localizeType(props.type)}
        />
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
    </div>
  );
}

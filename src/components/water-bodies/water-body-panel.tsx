"use client";

import type { SelectedWaterBody } from "@/types/water-bodies";
import { STATUS_LABELS, STATUS_COLORS } from "@/types/water-bodies";

interface WaterBodyPanelProps {
  selected: SelectedWaterBody;
  onClose: () => void;
}

function StatusBadge({ status }: { status: keyof typeof STATUS_LABELS }) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

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

export function WaterBodyPanel({ selected, onClose }: WaterBodyPanelProps) {
  if (selected.kind === "current") {
    const { props } = selected;
    const name = props.name || "Unnamed water body";
    const areaText = props.area_ha
      ? `${props.area_ha.toLocaleString()} ha`
      : "Unknown";
    const type = props.water_type
      ? props.water_type.charAt(0).toUpperCase() + props.water_type.slice(1)
      : "Water body";

    return (
      <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight truncate">
              {name}
            </h2>
            {props.name_ta && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {props.name_ta}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-2 p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
            aria-label="Close panel"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status */}
        <div className="px-4 pt-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            Existing
          </span>
        </div>

        {/* Stats */}
        <div className="p-4 grid grid-cols-2 gap-4">
          <Row label="Type" value={type} />
          <Row label="Area" value={areaText} />
          <Row label="OSM ID" value={`#${props.osm_id}`} />
        </div>
      </div>
    );
  }

  // Lost water body
  const { props } = selected;
  const pctLost =
    props.current_area_ha !== undefined
      ? Math.round(
          ((props.historical_area_ha - props.current_area_ha) /
            props.historical_area_ha) *
            100
        )
      : 100;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
            {props.name}
          </h2>
          {props.name_ta && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {props.name_ta}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
          aria-label="Close panel"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status badge */}
      <div className="px-4 pt-3">
        <StatusBadge status={props.status} />
      </div>

      {/* Stats grid */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <Row
          label="Type"
          value={
            props.type.charAt(0).toUpperCase() + props.type.slice(1)
          }
        />
        <Row label="Area lost" value={`~${pctLost}%`} />
        <Row
          label="Historical area"
          value={`~${props.historical_area_ha.toLocaleString()} ha`}
        />
        {props.current_area_ha !== undefined ? (
          <Row
            label="Surviving area"
            value={`~${props.current_area_ha.toLocaleString()} ha`}
          />
        ) : (
          <Row label="Surviving area" value="None" />
        )}
        <Row
          label="Replaced by"
          value={
            props.replaced_by.charAt(0).toUpperCase() +
            props.replaced_by.slice(1)
          }
        />
      </div>

      {/* Area loss bar */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span>Area remaining</span>
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
          {props.notes}
        </p>
      </div>

      {/* Source */}
      <div className="px-4 pb-4">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          <span className="font-medium">Source:</span> {props.source}
        </p>
      </div>
    </div>
  );
}

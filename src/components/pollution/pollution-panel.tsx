"use client";

import type { PollutionSource, IndustrialPollutionData } from "@/types/industrial-pollution";
import {
  SOURCE_TYPE_COLORS,
  SOURCE_TYPE_LABELS,
  POLLUTANT_LABELS,
  POLLUTANT_COLORS,
  RIVER_DISPLAY_NAMES,
} from "@/types/industrial-pollution";

interface PollutionPanelProps {
  source: PollutionSource;
  data: IndustrialPollutionData;
  onClose: () => void;
}

export function PollutionPanel({ source, data, onClose }: PollutionPanelProps) {
  const typeColor = SOURCE_TYPE_COLORS[source.type];
  const typeLabel = SOURCE_TYPE_LABELS[source.type];

  const riversAffected = source.rivers_affected
    .map((id) => RIVER_DISPLAY_NAMES[id] ?? id)
    .join(", ");

  return (
    <div className="bg-white dark:bg-slate-900 w-full h-full p-4 sm:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 leading-tight">
            {source.name}
          </h3>
          {source.name_ta && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {source.name_ta}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md ml-2 flex-shrink-0"
          aria-label="Close panel"
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

      {/* Type badge */}
      <div className="mb-4">
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium text-white"
          style={{ backgroundColor: typeColor }}
        >
          {typeLabel}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-2 mb-4">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 flex items-start justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Operator</span>
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 text-right ml-3 leading-snug">
            {source.operator}
          </span>
        </div>
        {riversAffected && (
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">Rivers affected</span>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 text-right ml-3">
              {riversAffected}
            </span>
          </div>
        )}
      </div>

      {/* Pollutant pills */}
      {source.pollutants.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Pollutants
          </div>
          <div className="flex flex-wrap gap-1.5">
            {source.pollutants.map((p) => (
              <span
                key={p}
                className={`px-2 py-0.5 rounded text-xs font-medium ${POLLUTANT_COLORS[p]}`}
              >
                {POLLUTANT_LABELS[p]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      <div className="mb-4">
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {source.description}
        </p>
      </div>

      {/* Incidents */}
      {source.incidents && source.incidents.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Key Incidents
          </div>
          <div className="space-y-2">
            {source.incidents.map((incident, i) => (
              <div
                key={i}
                className="rounded-lg border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                    {incident.date}
                  </span>
                  {incident.volume && (
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                      — {incident.volume}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                  {incident.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NGT Orders */}
      {source.ngt_orders && source.ngt_orders.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
            NGT Orders & Enforcement
          </div>
          <div className="space-y-1.5">
            {source.ngt_orders.map((order, i) => (
              <div
                key={i}
                className="rounded-lg border border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-2.5"
              >
                <p className="text-xs text-amber-900 dark:text-amber-200 leading-snug">
                  {order}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source */}
      <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-0.5">
        <p>Source: {source.source}</p>
        <p>Last updated: {data.last_updated}</p>
      </div>
    </div>
  );
}

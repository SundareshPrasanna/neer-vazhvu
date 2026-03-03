"use client";

import { useState } from "react";
import { RiverQualityChart } from "@/components/rivers/river-quality-chart";
import type { RiverQualityData, SelectedRiver } from "@/types/river-quality";
import {
  QUALITY_COLORS,
  QUALITY_LABELS,
  TREND_DO_THRESHOLD,
  TREND_BOD_THRESHOLD,
  computeStationTrend,
} from "@/types/river-quality";

interface RiverPanelProps {
  selected: SelectedRiver;
  qualityData: RiverQualityData;
  onClose: () => void;
}

export function RiverPanel({ selected, qualityData, onClose }: RiverPanelProps) {
  const river = qualityData.rivers.find((r) => r.id === selected.riverId);

  const initialStation =
    selected.stationId
      ? river?.stations.find((s) => s.id === selected.stationId)
      : river?.stations[0];

  const [activeStationId, setActiveStationId] = useState(
    initialStation?.id ?? river?.stations[0]?.id
  );

  if (!river) return null;

  const activeStation =
    river.stations.find((s) => s.id === activeStationId) ?? river.stations[0];

  const statusColor = QUALITY_COLORS[river.overall_status];
  const statusLabel = QUALITY_LABELS[river.overall_status];

  // Latest DO reading from active station
  const latestReading = [...activeStation.readings].sort((a, b) => b.year - a.year)[0];
  const latestDO = latestReading?.do_mgl;

  // 3-year trend for the active station
  const trend = computeStationTrend(activeStation.readings);

  const TREND_CONFIG = {
    improving: { label: "↑ Improving", className: "text-green-600 dark:text-green-400" },
    worsening: { label: "↓ Worsening", className: "text-red-600 dark:text-red-400" },
    mixed:     { label: "~ Mixed",     className: "text-orange-500 dark:text-orange-400" },
    stable:    { label: "→ Stable",    className: "text-slate-500 dark:text-slate-400" },
  } as const;

  return (
    <div className="bg-white dark:bg-slate-900 w-full h-full p-4 sm:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
            {river.name}
          </h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {river.name_ta}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
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
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Length</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
          <div
            className="text-base font-semibold"
            style={{ color: latestDO !== null && latestDO !== undefined ? statusColor : undefined }}
          >
            {latestDO !== null && latestDO !== undefined
              ? `${latestDO} mg/L`
              : "N/A"}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            DO ({latestReading?.year ?? "—"})
          </div>
        </div>
      </div>
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 mb-5 flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">CPCB Class</span>
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 text-right ml-2">
          {river.cpcb_class}
        </span>
      </div>

      {/* 3-year trend */}
      {trend && (
        <div className="border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-2.5 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              3-year trend
            </span>
            <span className={`text-xs font-semibold ${TREND_CONFIG[trend.direction].className}`}>
              {TREND_CONFIG[trend.direction].label}
              <span className="font-normal text-slate-400 dark:text-slate-500 ml-1">
                ({trend.start_year}–{trend.end_year})
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
            DO ↑ = better &nbsp;·&nbsp; BOD ↓ = better
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
              {station.stretch}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
          Water Quality — {activeStation.name}
        </div>
        <RiverQualityChart
          readings={activeStation.readings}
          stationName={activeStation.name}
        />
      </div>

      {/* DO / BOD explainer */}
      <div className="grid grid-cols-2 gap-2 mb-5 text-xs">
        <div className="rounded-lg border border-sky-100 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/30 p-2.5">
          <span className="font-semibold text-sky-700 dark:text-sky-400">DO — Dissolved Oxygen</span>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
            Oxygen dissolved in water. Fish and aquatic life need ≥ 4 mg/L to survive. Near zero means the river is biologically dead.
          </p>
        </div>
        <div className="rounded-lg border border-orange-100 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 p-2.5">
          <span className="font-semibold text-orange-700 dark:text-orange-400">BOD — Biochemical Oxygen Demand</span>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
            Organic pollution load. A clean river has &lt; 2 mg/L. Above 30 mg/L indicates severe sewage contamination.
          </p>
        </div>
      </div>

      {/* Callout note */}
      {river.notes && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-5">
          <p className="text-sm text-amber-900 dark:text-amber-200">{river.notes}</p>
        </div>
      )}

      {/* Description */}
      {river.description && (
        <div className="mb-5">
          <p className="text-sm text-slate-600 dark:text-slate-400">{river.description}</p>
        </div>
      )}

      {/* Source */}
      <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-0.5">
        <p>Source: {qualityData.source}</p>
        <p>Last updated: {qualityData.last_updated}</p>
      </div>
    </div>
  );
}

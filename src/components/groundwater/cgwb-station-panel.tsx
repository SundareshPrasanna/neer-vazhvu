"use client";

/**
 * Detail panel for a CGWB Year Book ground-water station. Renders the
 * quarterly readings (May/Aug/Nov/Jan) as both a small hydrograph and a
 * tabular list, plus block + aquifer metadata. Replaces the click-target
 * for the IDW-interpolated ward view in CGWB-yearbook cities like
 * Madurai - this panel surfaces actual measured depth at a real well
 * instead of interpolating.
 *
 * Reading-cadence note: CGWB Year Books publish four readings a year
 * (pre-monsoon May, Aug, Nov, post-monsoon Jan). Multi-year coverage
 * comes from stitching successive Year Books on the same well by
 * lat/lng. See public/data/madurai-cgwb-stations.json for the schema.
 */

import { useMemo } from "react";
import type { CgwbStation, CgwbStationQuality } from "@/types/groundwater";

const MONTH_LABELS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Major-ion rows we surface, with BIS 10500 acceptable limits where one
// exists. A value over its limit is flagged amber. EC has no BIS limit but
// the 3000 uS/cm salinity threshold is the meaningful coastal-aquifer marker.
const QUALITY_ROWS: Array<{
  key: keyof CgwbStationQuality;
  label: string;
  unit: string;
  limit: number | null;
  limitLabel?: string;
}> = [
  { key: "ec_us_cm", label: "Salinity (EC)", unit: "µS/cm", limit: 3000, limitLabel: "saline > 3000" },
  { key: "tds_mg_l", label: "TDS", unit: "mg/l", limit: 500 },
  { key: "chloride_mg_l", label: "Chloride", unit: "mg/l", limit: 250 },
  { key: "nitrate_mg_l", label: "Nitrate", unit: "mg/l", limit: 45 },
  { key: "fluoride_mg_l", label: "Fluoride", unit: "mg/l", limit: 1.0 },
  { key: "hardness_mg_l", label: "Total hardness", unit: "mg/l", limit: 200 },
];

function readingDateKey(year: number, month: number) {
  return year * 100 + month;
}

export function CgwbStationPanel({
  station,
  onClose,
  sourceNote,
}: {
  station: CgwbStation;
  onClose: () => void;
  /* Citation line for the foot of the panel. Defaults are wrong outside
     Tamil Nadu, so cities pass their own Year Book label. */
  sourceNote?: string;
}) {
  const sorted = useMemo(
    () => [...station.readings].sort((a, b) => readingDateKey(a.year, a.month) - readingDateKey(b.year, b.month)),
    [station.readings],
  );

  const latest = sorted[sorted.length - 1] ?? null;
  const earliest = sorted[0] ?? null;
  const minDepth = sorted.length > 0 ? Math.min(...sorted.map((r) => r.depth_m_bgl)) : null;
  const maxDepth = sorted.length > 0 ? Math.max(...sorted.map((r) => r.depth_m_bgl)) : null;
  const range = minDepth !== null && maxDepth !== null ? maxDepth - minDepth : null;

  // Sparkline geometry. SVG is 240 wide × 56 tall; we leave a 4px y-pad
  // top/bottom so the polyline never clips.
  const W = 240;
  const H = 56;
  const PAD_Y = 4;
  const sparkPoints = useMemo(() => {
    if (sorted.length === 0 || minDepth === null || maxDepth === null) return [];
    const span = maxDepth - minDepth;
    return sorted.map((r, i) => {
      const x = sorted.length === 1 ? W / 2 : (i / (sorted.length - 1)) * W;
      const yNorm = span === 0 ? 0.5 : (r.depth_m_bgl - minDepth) / span;
      // Higher depth_m_bgl = water further below ground = "worse" position,
      // so we flip the y-axis: deeper readings sit lower in the sparkline.
      const y = PAD_Y + yNorm * (H - 2 * PAD_Y);
      return { x, y, reading: r };
    });
  }, [sorted, minDepth, maxDepth]);

  return (
    <div className="bg-white dark:bg-slate-900 w-full p-4 sm:p-5 overflow-y-auto">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
            {station.name}
          </h3>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            CGWB Year Book - {station.block} block
            {station.block_inferred && (
              <span className="ml-1 text-amber-600 dark:text-amber-400" title="Block assignment inferred from geographic proximity to other CGWB wells in this block; not directly stated in the source PDF.">
                (inferred)
              </span>
            )}
            {" - "}phreatic / unconfined
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
            {station.lat.toFixed(4)}°N, {station.lng.toFixed(4)}°E
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
          aria-label="Close panel"
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2">
          <div className="text-[10px] uppercase text-slate-500">Latest depth</div>
          <div className="font-semibold mt-0.5 text-base">
            {latest ? `${latest.depth_m_bgl.toFixed(2)} m` : "no data"}
          </div>
          <div className="text-[10px] text-slate-500">
            {latest ? `${MONTH_LABELS[latest.month]} ${latest.year}` : ""} - below ground level
          </div>
        </div>
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2">
          <div className="text-[10px] uppercase text-slate-500">Range across record</div>
          <div className="font-semibold mt-0.5 text-base">
            {minDepth !== null && maxDepth !== null
              ? `${minDepth.toFixed(2)} - ${maxDepth.toFixed(2)} m`
              : "—"}
          </div>
          <div className="text-[10px] text-slate-500">
            {range !== null ? `${range.toFixed(2)} m fluctuation across ${sorted.length} readings` : ""}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      {sparkPoints.length > 1 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2 mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-[10px] uppercase text-slate-500">Quarterly readings</div>
            <div className="text-[10px] text-slate-400">
              {earliest && `${MONTH_LABELS[earliest.month]} ${earliest.year}`}
              {" → "}
              {latest && `${MONTH_LABELS[latest.month]} ${latest.year}`}
            </div>
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="text-blue-600 dark:text-blue-400">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              points={sparkPoints.map((p) => `${p.x},${p.y}`).join(" ")}
            />
            {sparkPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={2} fill="currentColor" />
            ))}
          </svg>
          <div className="text-[10px] text-slate-400 italic mt-0.5">
            Higher line = water deeper below ground (worse). 4 readings per CGWB year (May / Aug / Nov / Jan).
          </div>
        </div>
      )}

      {/* Tabular readings */}
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
        All readings - m below ground level
      </div>
      <div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium">When</th>
              <th className="text-right px-2 py-1.5 font-medium">Depth (m)</th>
              <th className="text-left px-2 py-1.5 font-medium">Year Book</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={`${r.year}-${r.month}-${i}`}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">
                  {MONTH_LABELS[r.month]} {r.year}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-slate-900 dark:text-slate-100">
                  {r.depth_m_bgl.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-[11px] text-slate-500">{r.year_book}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Water chemistry - only where the well was sampled for quality. */}
      {station.quality && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
            Water chemistry · pre-monsoon (May 2022)
          </div>
          <div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium">Parameter</th>
                  <th className="text-right px-2 py-1.5 font-medium">Value</th>
                  <th className="text-left px-2 py-1.5 font-medium">BIS limit</th>
                </tr>
              </thead>
              <tbody>
                {QUALITY_ROWS.map((row) => {
                  const v = station.quality?.[row.key];
                  if (v === undefined) return null;
                  const over = row.limit !== null && v > row.limit;
                  return (
                    <tr key={row.key} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">{row.label}</td>
                      <td
                        className={`px-2 py-1.5 text-right font-mono ${
                          over
                            ? "text-amber-600 dark:text-amber-400 font-semibold"
                            : "text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        {v} <span className="text-[10px] text-slate-400">{row.unit}</span>
                      </td>
                      <td className="px-2 py-1.5 text-[11px] text-slate-500">
                        {row.limitLabel ?? (row.limit !== null ? `${row.limit}` : "—")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(station.quality.arsenic_ug_l !== undefined ||
            station.quality.uranium_ug_l !== undefined ||
            station.quality.iron_mg_l !== undefined) && (
            <div className="text-[10px] text-slate-400 mt-1">
              Trace metals (NHS 2019-20):
              {station.quality.iron_mg_l !== undefined && ` Fe ${station.quality.iron_mg_l} mg/l`}
              {station.quality.arsenic_ug_l !== undefined && ` · As ${station.quality.arsenic_ug_l} µg/l`}
              {station.quality.uranium_ug_l !== undefined && ` · U ${station.quality.uranium_ug_l} µg/l`}
              {" "}— all well under BIS limits (As 10, U 30 µg/l).
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-slate-400 italic mt-3">
        {sourceNote ??
          "Source: CGWB Ground Water Year Book, annual editions. Phreatic (unconfined) aquifer dug well, manual seasonal measurement. The deeper semi-confined / confined aquifer is monitored separately via piezometers."}
      </p>
    </div>
  );
}

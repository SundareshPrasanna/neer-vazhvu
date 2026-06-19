"use client";

import { useState } from "react";
import type { CoastalSummary } from "@/types/coastal";

/**
 * "At a glance" overview for the shoreline page - a semi-transparent card
 * overlaid top-right of the map, open by default and collapsible to a pill.
 * Gives the Chennai-wide conclusion on arrival without changing the map.
 */
export function ShorelineSummary({
  summary,
  onShowWorst,
}: {
  summary: CoastalSummary | null;
  onShowWorst: () => void;
}) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:bg-white dark:hover:bg-slate-900"
      >
        <span className="w-2 h-2 rounded-full bg-red-600" />
        Coastline summary
        <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    );
  }

  const hc = summary?.highConf ?? 0;
  const pct = (n: number) => (hc ? Math.round((100 * n) / hc) : 0);
  const erodingPct = pct(summary?.eroding ?? 0);
  const accretingPct = pct(summary?.accreting ?? 0);
  const stablePct = Math.max(0, 100 - erodingPct - accretingPct);
  const accelPct =
    summary && summary.erodingWithSplit > 0
      ? Math.round((100 * summary.acceleratingErosion) / summary.erodingWithSplit)
      : null;
  const period = summary?.period ?? "1990-2026";

  return (
    <div className="w-[260px] sm:w-[288px] bg-white/85 dark:bg-slate-900/85 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3.5 text-sm">
      <div className="flex items-start justify-between mb-2">
        <h2 className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
          Chennai coastline
          <span className="block text-[11px] font-normal text-slate-500">
            at a glance - {period}, Mahabalipuram to Pulicat
          </span>
        </h2>
        <button
          onClick={() => setOpen(false)}
          className="p-1 -m-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
          aria-label="Collapse summary"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>

      <p className="text-slate-700 dark:text-slate-200 font-medium leading-snug mb-3">
        Most of the coast is eroding - and the erosion is speeding up.
      </p>

      {!summary ? (
        <p className="text-xs text-slate-400">Calculating from the satellite measurement…</p>
      ) : (
        <>
      {/* erosion / stable / accretion split */}
      <div className="mb-1.5">
        <div className="flex h-2.5 rounded-full overflow-hidden">
          <div style={{ width: `${erodingPct}%`, backgroundColor: "#dc2626" }} />
          <div style={{ width: `${stablePct}%`, backgroundColor: "#94a3b8" }} />
          <div style={{ width: `${accretingPct}%`, backgroundColor: "#2563eb" }} />
        </div>
        <div className="flex justify-between text-[11px] mt-1">
          <span className="text-red-600 dark:text-red-400 font-semibold">{erodingPct}% eroding</span>
          <span className="text-slate-500">{stablePct}% stable</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold">{accretingPct}% accreting</span>
        </div>
      </div>

      {accelPct != null && (
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5">
          <span className="font-bold text-slate-900 dark:text-slate-100">{accelPct}%</span> of the eroding
          coast is eroding <span className="font-semibold">faster</span> now (2015-2026) than before.
        </p>
      )}

      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-snug">
        <span className="font-semibold">Why:</span> the <span className="font-semibold">Ennore &amp; Kattupalli</span>{" "}
        ports interrupt the coast&apos;s natural south-to-north sand drift - trapping sand at the breakwaters,
        but starving and eroding the beaches further north (down-drift). The coast gains land where the{" "}
        <span className="font-semibold">Adyar &amp; Cooum</span> rivers drop silt at their mouths.
      </p>

      <button
        onClick={onShowWorst}
        className="mt-3 w-full text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md py-1.5"
      >
        Zoom to the worst-eroding spot →
      </button>

      <p className="text-[10px] text-slate-400 mt-2.5 leading-snug">
        Our satellite measurement ({summary.total.toLocaleString()}{" "}transects), corroborated by
        Anagha, Singh &amp; Frappart (2026).
      </p>
        </>
      )}
    </div>
  );
}

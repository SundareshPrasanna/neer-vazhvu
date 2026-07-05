"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import type { HistorySeries, ForecastSeries } from "@/types/reservoir";
import { useChartZoom } from "@/lib/hooks/use-chart-zoom";

interface Props {
  series: HistorySeries[];
  forecast?: ForecastSeries[];
  forecastDate?: string | null;
  earliestDate: string | null;
  latestDate: string | null;
  pointCount: number;
  /** City display name for the chart header. */
  cityDisplayName: string;
  /** Storage unit used in Y-axis label + tooltip. Default "TMC". */
  unit?: string;
  /** Per-city data-coverage note (from config) - names which sources have
   *  archives and since when, so sparse windows read as known gaps. */
  coverageNote?: string;
  /** Geographic scope badge (region places only). */
  scopeLabel?: string;
  /** Initial time-range tab (default '1yr'); config-driven per city. */
  defaultTab?: TabKey;
}

const TIME_TABS = [
  { key: "90d", label: "90 days", days: 90 },
  { key: "1yr", label: "1 yr", days: 365 },
  { key: "3yr", label: "3 yrs", days: 365 * 3 },
  { key: "all", label: "All time", days: 0 },
] as const;

type TabKey = (typeof TIME_TABS)[number]["key"];

type ViewMode = "by_source" | "summed";

const SOURCE_COLOR: Record<string, string> = {
  vaigai:          "#2563eb",
  mullaperiyar:    "#7c3aed",
  sothuparai:      "#059669",
  mettur:          "#0891b2",
  krs:             "#d97706",
  kabini:          "#ec4899",
  hemavathy:       "#10b981",
  harangi:         "#f97316",
  poondi:          "#2563eb",
  cholavaram:      "#0891b2",
  redhills:        "#dc2626",
  chembarambakkam: "#7c3aed",
  veeranam:        "#059669",
  kannankottai:    "#d97706",
  hemavathi:       "#10b981",
  // Mumbai's 7 BMC lakes - explicit, pairwise-distinct colours; the hash
  // fallback collides (bhatsa/tansa/tulsi all landed on the same slot).
  bhatsa:          "#2563eb",
  upper_vaitarna:  "#7c3aed",
  middle_vaitarna: "#ec4899",
  modak_sagar:     "#059669",
  tansa:           "#d97706",
  vihar:           "#0891b2",
  tulsi:           "#dc2626",
};

// Summed total line. Dark slate in light mode reads as a strong, near-black
// line over the colourful per-source bands; in dark mode the same colour
// disappears against the dark background, so flip to a light slate that
// still contrasts against per-source line colours without competing with
// them. Resolved at render time via useTheme below.
const SUMMED_LINE_LIGHT = "#0f172a"; // slate-900
const SUMMED_LINE_DARK  = "#e2e8f0"; // slate-200

function fallbackColor(sourceCode: string): string {
  let hash = 0;
  for (let i = 0; i < sourceCode.length; i++) hash = (hash * 31 + sourceCode.charCodeAt(i)) | 0;
  const palette = ["#0ea5e9", "#84cc16", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#10b981"];
  return palette[Math.abs(hash) % palette.length];
}

function colorFor(sourceCode: string): string {
  return SOURCE_COLOR[sourceCode] ?? fallbackColor(sourceCode);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTick(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export function MultiSourceHistoryChart({
  series,
  forecast = [],
  forecastDate = null,
  earliestDate,
  latestDate,
  pointCount,
  cityDisplayName,
  unit = "TMC",
  coverageNote,
  scopeLabel,
  defaultTab = "1yr",
}: Props) {
  const [tab, setTab] = useState<TabKey>(defaultTab);
  const [view, setView] = useState<ViewMode>("by_source");
  const [showForecast, setShowForecast] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  const summedLineColor = isDark ? SUMMED_LINE_DARK : SUMMED_LINE_LIGHT;

  const forecastBySource = useMemo(() => {
    const m = new Map<string, ForecastSeries>();
    for (const f of forecast) m.set(f.source_code, f);
    return m;
  }, [forecast]);

  // Default-hidden non-primary sources to keep the chart readable on
  // first load. Edge case: a city like Bengaluru tracks 4 upstream
  // basin reservoirs that are all is_primary=false (the basin is
  // irrigation-primary; BWSSB's drinking-water carve-out is downstream
  // at T.K. Halli). In that case the chart would render empty by
  // default. Fall back to showing ALL sources when none are flagged
  // primary - the cohort itself is the story.
  const defaultHidden = useMemo(() => {
    const hidden = new Set<string>();
    const hasAnyPrimary = series.some((s) => s.is_primary);
    if (!hasAnyPrimary) return hidden;
    for (const s of series) if (!s.is_primary) hidden.add(s.source_code);
    return hidden;
  }, [series]);
  const [hidden, setHidden] = useState<Set<string>>(defaultHidden);

  // Build the merged-by-date point array Recharts expects.
  const merged = useMemo(() => {
    const cutoffDays = TIME_TABS.find((t) => t.key === tab)?.days ?? 0;
    // Date.now() is technically impure during render; the cutoff is
    // a window relative to "now" by design (last-N-days view), so a
    // single read per render is the intended behaviour. The lint
    // rule's preferred alternative (state + effect) would just add
    // a render cycle without changing semantics.
    // eslint-disable-next-line react-hooks/purity
    const cutoffMs = cutoffDays > 0 ? Date.now() - cutoffDays * 86400 * 1000 : 0;
    const cutoffDate = cutoffMs > 0 ? new Date(cutoffMs).toISOString().slice(0, 10) : "";

    type Row = { date: string } & Record<string, string | number | null | [number, number]>;
    const byDate = new Map<string, Row>();

    for (const s of series) {
      if (hidden.has(s.source_code)) continue;
      for (const p of s.points) {
        if (cutoffDate && p.date < cutoffDate) continue;
        const row: Row = byDate.get(p.date) ?? { date: p.date };
        row[s.source_code] = p.storage_tmc;
        byDate.set(p.date, row);
      }
    }

    if (showForecast) {
      for (const f of forecast) {
        if (hidden.has(f.source_code)) continue;
        for (const p of f.points) {
          const row: Row = byDate.get(p.date) ?? { date: p.date };
          row[`${f.source_code}__forecast`] = p.predicted_tmc;
          row[`${f.source_code}__band`] = [p.lower_tmc, p.upper_tmc];
          byDate.set(p.date, row);
        }
      }

      // Bridge: anchor each source's forecast line to its last
      // historical point. Recharts treats history and forecast as
      // separate dataKeys, so without this the dashed forecast line
      // visually starts one tick after the solid history line ends.
      for (const s of series) {
        if (hidden.has(s.source_code)) continue;
        if (!forecastBySource.has(s.source_code)) continue;
        if (s.points.length === 0) continue;
        const lastP = s.points[s.points.length - 1];
        if (lastP.storage_tmc == null) continue;
        const row = byDate.get(lastP.date);
        if (!row) continue;
        const v = lastP.storage_tmc;
        row[`${s.source_code}__forecast`] = v;
        row[`${s.source_code}__band`] = [v, v];
      }
    }

    const rows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Compute the summed-total line per row across all currently visible
    // sources. Only emit when every visible source has a value at that
    // date (avoids misleading dips when one source happens to be missing
    // a reading). Forecast roll-up: sum of per-source predicted_tmc and
    // sum of band bounds across visible sources for the same target date.
    if (view === "summed") {
      const visibleCodes = series
        .filter((s) => !hidden.has(s.source_code))
        .map((s) => s.source_code);

      for (const row of rows) {
        // Historical sum
        let total = 0;
        let allPresent = visibleCodes.length > 0;
        for (const code of visibleCodes) {
          const v = row[code];
          if (typeof v !== "number" || !isFinite(v)) {
            allPresent = false;
            break;
          }
          total += v;
        }
        if (allPresent) row.__total = total;

        // Forecast sum (only if every visible source has a forecast row)
        if (showForecast) {
          let totalForecast = 0;
          let totalLower = 0;
          let totalUpper = 0;
          let allFc = visibleCodes.length > 0;
          for (const code of visibleCodes) {
            const fv = row[`${code}__forecast`];
            const fb = row[`${code}__band`];
            if (typeof fv !== "number" || !Array.isArray(fb)) {
              allFc = false;
              break;
            }
            totalForecast += fv;
            totalLower += fb[0];
            totalUpper += fb[1];
          }
          if (allFc) {
            row.__total_forecast = totalForecast;
            row.__total_band = [totalLower, totalUpper];
          }
        }
      }

      // Bridge: anchor the summed forecast line at the last summed
      // historical row, so the dashed total line continues from where
      // the solid total line ends.
      if (showForecast) {
        let lastTotalRow: Row | null = null;
        for (const row of rows) {
          if (typeof row.__total === "number") lastTotalRow = row;
        }
        if (lastTotalRow && lastTotalRow.__total_forecast == null) {
          const t = lastTotalRow.__total as number;
          lastTotalRow.__total_forecast = t;
          lastTotalRow.__total_band = [t, t];
        }
      }
    }

    return rows;
  }, [series, tab, hidden, showForecast, forecast, forecastBySource, view]);

  const visibleSeries = series.filter((s) => !hidden.has(s.source_code));

  const { containerRef, isZoomed, visibleRows, dragRange, resetZoom, handlers } = useChartZoom({
    rows: merged,
    toMillis: (r) => new Date(r.date as string).getTime(),
  });

  // Adaptive x-axis tick: when the visible span is short (< ~120 days)
  // show day-month so zoomed-in users can read individual dates;
  // otherwise stick with the month-year compact form.
  const tickFormatter = useMemo(() => {
    if (visibleRows.length < 2) return fmtTick;
    const first = new Date(visibleRows[0].date as string).getTime();
    const last = new Date(visibleRows[visibleRows.length - 1].date as string).getTime();
    const spanDays = (last - first) / 86_400_000;
    if (spanDays <= 120) {
      return (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      };
    }
    return fmtTick;
  }, [visibleRows]);

  if (series.length === 0 || pointCount === 0) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-4 text-sm text-slate-700 dark:text-slate-300">
        <div className="font-semibold text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wider mb-1">
          Reservoir history pending
        </div>
        <p>
          {cityDisplayName} reservoir storage history hasn&apos;t been
          backfilled yet. Once daily storage readings start landing, this
          chart fills in automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-white dark:bg-slate-900/30">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {cityDisplayName} reservoir storage history
          </h2>
          {scopeLabel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap">
              {scopeLabel}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500">
          {pointCount.toLocaleString()} readings -{" "}
          {earliestDate ? fmtDate(earliestDate) : "?"} - {latestDate ? fmtDate(latestDate) : "?"}
        </div>
      </div>

      {/* Time-range tabs + view toggle + forecast toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TIME_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                tab === t.key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-3">
          <button
            onClick={() => setView("by_source")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              view === "by_source"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            By source
          </button>
          <button
            onClick={() => setView("summed")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              view === "summed"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Summed total
          </button>
        </div>

        {forecast.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={showForecast}
              onChange={(e) => setShowForecast(e.target.checked)}
              className="accent-blue-600"
            />
            <span>Show {forecast[0]?.points.length ?? 14}-day forecast (80% band)</span>
          </label>
        )}
      </div>

      {/* Source toggles */}
      <div className="flex flex-wrap gap-2">
        {series.map((s) => {
          const on = !hidden.has(s.source_code);
          const color = colorFor(s.source_code);
          return (
            <button
              key={s.source_code}
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.source_code)) next.delete(s.source_code);
                  else next.add(s.source_code);
                  return next;
                })
              }
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] transition-opacity ${
                on ? "opacity-100" : "opacity-40"
              } border-slate-200 dark:border-slate-700`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-slate-700 dark:text-slate-300">{s.display_name}</span>
            </button>
          );
        })}
      </div>

      {/* Chart - drag-to-zoom on desktop, pinch on mobile, double-click
          to reset. The wrapper captures the gestures and overlays a
          translucent selection rectangle while the user is dragging. */}
      <div
        ref={containerRef}
        className="relative touch-pan-x select-none"
        {...handlers}
      >
        {isZoomed && (
          <button
            onClick={resetZoom}
            className="absolute top-2 right-2 z-[5] text-[11px] px-2 py-1 rounded bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
          >
            Reset zoom
          </button>
        )}
        {dragRange && Math.abs(dragRange.currentX - dragRange.startX) > 2 && (
          <div
            className="absolute top-0 bottom-0 z-[4] bg-blue-400/20 border-x border-blue-500 pointer-events-none"
            style={{
              left: Math.min(dragRange.startX, dragRange.currentX),
              width: Math.abs(dragRange.currentX - dragRange.startX),
            }}
          />
        )}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={visibleRows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
          <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 11 }} minTickGap={50} />
          <YAxis tick={{ fontSize: 11 }} label={{ value: unit, angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
          <Tooltip
            labelFormatter={(label) => fmtDate(label as string)}
            formatter={(value, name) => {
              const nameStr = String(name);
              if (Array.isArray(value)) {
                if (nameStr === "__total_band") {
                  return [
                    `${(value as number[])[0].toFixed(2)} - ${(value as number[])[1].toFixed(2)} ${unit}`,
                    "Total (80% band)",
                  ] as [string, string];
                }
                const code = nameStr.replace("__band", "");
                const display = series.find((s) => s.source_code === code)?.display_name ?? code;
                return [
                  `${(value as number[])[0].toFixed(2)} - ${(value as number[])[1].toFixed(2)} ${unit}`,
                  `${display} (80% band)`,
                ] as [string, string];
              }
              const num = typeof value === "number" ? value : Number(value);
              const text = isFinite(num) ? `${num.toFixed(2)} ${unit}` : "-";
              if (nameStr === "__total") return [text, "Total (visible sources)"] as [string, string];
              if (nameStr === "__total_forecast") return [text, "Total (forecast)"] as [string, string];
              const isForecast = nameStr.endsWith("__forecast");
              const code = nameStr.replace("__forecast", "");
              const display = series.find((s) => s.source_code === code)?.display_name ?? code;
              return [text, isForecast ? `${display} (forecast)` : display] as [string, string];
            }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              backgroundColor: isDark ? "#0f172a" : "#ffffff",
              border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
            }}
            labelStyle={{
              color: isDark ? "#f1f5f9" : "#0f172a",
              fontWeight: 600,
              marginBottom: 4,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => {
              const v = String(value);
              if (v.endsWith("__forecast") || v.endsWith("__band")) return "";
              if (v === "__total") return "Total (visible sources)";
              if (v === "__total_forecast" || v === "__total_band") return "";
              return series.find((s) => s.source_code === v)?.display_name ?? v;
            }}
          />
          {showForecast && forecastDate && (
            <ReferenceLine x={forecastDate} stroke="#94a3b8" strokeDasharray="4 2" />
          )}

          {/* Confidence-band areas (rendered first so lines paint on top). */}
          {showForecast && view === "by_source" &&
            visibleSeries.map((s) => {
              if (!forecastBySource.has(s.source_code)) return null;
              return (
                <Area
                  key={`${s.source_code}__band`}
                  dataKey={`${s.source_code}__band`}
                  fill={colorFor(s.source_code)}
                  fillOpacity={0.12}
                  stroke="none"
                  isAnimationActive={false}
                  legendType="none"
                />
              );
            })}
          {showForecast && view === "summed" && (
            <Area
              dataKey="__total_band"
              fill={summedLineColor}
              fillOpacity={0.12}
              stroke="none"
              isAnimationActive={false}
              legendType="none"
            />
          )}

          {view === "by_source" ? (
            <>
              {visibleSeries.map((s) => (
                <Line
                  key={s.source_code}
                  type="monotone"
                  dataKey={s.source_code}
                  name={s.source_code}
                  stroke={colorFor(s.source_code)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
              {showForecast &&
                visibleSeries.map((s) => {
                  if (!forecastBySource.has(s.source_code)) return null;
                  return (
                    <Line
                      key={`${s.source_code}__forecast`}
                      type="monotone"
                      dataKey={`${s.source_code}__forecast`}
                      name={`${s.source_code}__forecast`}
                      stroke={colorFor(s.source_code)}
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                      legendType="none"
                    />
                  );
                })}
            </>
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="__total"
                name="__total"
                stroke={summedLineColor}
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              {showForecast && (
                <Line
                  type="monotone"
                  dataKey="__total_forecast"
                  name="__total_forecast"
                  stroke={summedLineColor}
                  strokeWidth={2.5}
                  strokeDasharray="5 3"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />
              )}
            </>
          )}

        </ComposedChart>
      </ResponsiveContainer>
      </div>

      {coverageNote && (
        <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5">
          {coverageNote}
        </div>
      )}
      <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
        Click a source pill to toggle it; primary drinking sources are on by
        default. Drag horizontally on the chart to zoom into a time window
        (pinch on mobile); double-click to reset. Toggle &quot;Summed total&quot;
        to view combined storage across all visible sources.
      </div>
    </div>
  );
}

// Default export for backward compat with the prior import path.
export default MultiSourceHistoryChart;

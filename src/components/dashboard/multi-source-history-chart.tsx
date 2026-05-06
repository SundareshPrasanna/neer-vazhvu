"use client";

import { useMemo, useRef, useState } from "react";
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

interface Props {
  series: HistorySeries[];
  forecast?: ForecastSeries[];
  forecastDate?: string | null;
  earliestDate: string | null;
  latestDate: string | null;
  pointCount: number;
  /** City display name for the chart header. */
  cityDisplayName: string;
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
};

const SUMMED_LINE_COLOR = "#0f172a"; // slate-900 for the combined total

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
}: Props) {
  const [tab, setTab] = useState<TabKey>("1yr");
  const [view, setView] = useState<ViewMode>("by_source");
  const [showForecast, setShowForecast] = useState(true);
  // Custom x-axis domain for pinch / wheel zoom. null means use the
  // natural range of the merged data (i.e. follow the time-tab + data).
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchStateRef = useRef<{
    initialDistance: number;
    initialDomain: [number, number];
    centerMs: number;
  } | null>(null);

  const forecastBySource = useMemo(() => {
    const m = new Map<string, ForecastSeries>();
    for (const f of forecast) m.set(f.source_code, f);
    return m;
  }, [forecast]);

  // Default-hidden non-primary sources to keep the chart readable on first load.
  const defaultHidden = useMemo(() => {
    const hidden = new Set<string>();
    for (const s of series) if (!s.is_primary) hidden.add(s.source_code);
    return hidden;
  }, [series]);
  const [hidden, setHidden] = useState<Set<string>>(defaultHidden);

  // Build the merged-by-date point array Recharts expects.
  const merged = useMemo(() => {
    const cutoffDays = TIME_TABS.find((t) => t.key === tab)?.days ?? 0;
    const cutoffMs = cutoffDays > 0 ? Date.now() - cutoffDays * 86400 * 1000 : 0;

    type Row = { date: string } & Record<string, string | number | null | [number, number]>;
    const byDate = new Map<string, Row>();

    for (const s of series) {
      if (hidden.has(s.source_code)) continue;
      for (const p of s.points) {
        if (cutoffMs > 0 && new Date(p.date).getTime() < cutoffMs) continue;
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
    }

    return rows;
  }, [series, tab, hidden, showForecast, forecast, view]);

  const visibleSeries = series.filter((s) => !hidden.has(s.source_code));

  // Apply zoom domain to the merged rows. When zoomDomain is null we
  // render everything inside the time-tab; otherwise we filter to the
  // pinch-/wheel-selected window.
  const visibleRows = useMemo(() => {
    if (!zoomDomain || merged.length === 0) return merged;
    const [lo, hi] = zoomDomain;
    return merged.filter((r) => {
      const t = new Date(r.date as string).getTime();
      return t >= lo && t <= hi;
    });
  }, [merged, zoomDomain]);

  const dataRange = useMemo<[number, number] | null>(() => {
    if (merged.length === 0) return null;
    const first = new Date(merged[0].date as string).getTime();
    const last = new Date(merged[merged.length - 1].date as string).getTime();
    return [first, last];
  }, [merged]);

  // Desktop drag-to-zoom: user drags horizontally across the chart, we
  // overlay a translucent selection rect, and on mouse-up we zoom to
  // the selected x-range.
  const [dragRange, setDragRange] = useState<{ startX: number; currentX: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !dataRange) return;
    // Only react to primary button.
    if (e.button !== 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setDragRange({ startX: x, currentX: x });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRange || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    setDragRange({ ...dragRange, currentX: x });
  };

  const handleMouseUp = () => {
    if (!dragRange || !containerRef.current || !dataRange) {
      setDragRange(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const x1 = Math.min(dragRange.startX, dragRange.currentX);
    const x2 = Math.max(dragRange.startX, dragRange.currentX);
    const dragWidth = x2 - x1;
    setDragRange(null);
    // Ignore tiny drags (< 8 px) so a single-click doesn't accidentally
    // zoom to one pixel.
    if (dragWidth < 8) return;
    const current = zoomDomain ?? dataRange;
    const span = current[1] - current[0];
    const newLo = current[0] + (x1 / rect.width) * span;
    const newHi = current[0] + (x2 / rect.width) * span;
    const minSpan = 86400 * 1000 * 7;
    if (newHi - newLo < minSpan) return;
    setZoomDomain([Math.max(dataRange[0], newLo), Math.min(dataRange[1], newHi)]);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2 || !containerRef.current || !dataRange) return;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    const distance = Math.hypot(dx, dy);
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = (t1.clientX + t2.clientX) / 2 - rect.left;
    const fraction = Math.max(0, Math.min(1, centerX / rect.width));
    const current = zoomDomain ?? dataRange;
    const span = current[1] - current[0];
    pinchStateRef.current = {
      initialDistance: distance,
      initialDomain: current,
      centerMs: current[0] + span * fraction,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2 || !pinchStateRef.current || !dataRange) return;
    e.preventDefault();
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const { initialDistance, initialDomain, centerMs } = pinchStateRef.current;
    if (initialDistance < 4) return;
    const scale = initialDistance / distance; // pinch out (distance grows) -> scale < 1 -> zoom in
    const initialSpan = initialDomain[1] - initialDomain[0];
    const newSpan = Math.max(86400 * 1000 * 7, Math.min(dataRange[1] - dataRange[0], initialSpan * scale));
    // Keep centerMs at the same fraction of span as before.
    const fraction = (centerMs - initialDomain[0]) / initialSpan;
    let newLo = centerMs - newSpan * fraction;
    let newHi = centerMs + newSpan * (1 - fraction);
    if (newLo < dataRange[0]) {
      newHi += dataRange[0] - newLo;
      newLo = dataRange[0];
    }
    if (newHi > dataRange[1]) {
      newLo -= newHi - dataRange[1];
      newHi = dataRange[1];
    }
    if (newLo <= dataRange[0] && newHi >= dataRange[1]) {
      setZoomDomain(null);
    } else {
      setZoomDomain([Math.max(dataRange[0], newLo), Math.min(dataRange[1], newHi)]);
    }
  };

  const handleTouchEnd = () => {
    pinchStateRef.current = null;
  };

  const resetZoom = () => setZoomDomain(null);
  const isZoomed = zoomDomain !== null;

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
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {cityDisplayName} reservoir storage history
        </h2>
        <div className="text-xs text-slate-500">
          {pointCount.toLocaleString()} readings ·{" "}
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={resetZoom}
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
          <YAxis tick={{ fontSize: 11 }} label={{ value: "TMC", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
          <Tooltip
            labelFormatter={(label) => fmtDate(label as string)}
            formatter={(value, name) => {
              const nameStr = String(name);
              if (Array.isArray(value)) {
                if (nameStr === "__total_band") {
                  return [
                    `${(value as number[])[0].toFixed(2)} - ${(value as number[])[1].toFixed(2)} TMC`,
                    "Total (80% band)",
                  ] as [string, string];
                }
                const code = nameStr.replace("__band", "");
                const display = series.find((s) => s.source_code === code)?.display_name ?? code;
                return [
                  `${(value as number[])[0].toFixed(2)} - ${(value as number[])[1].toFixed(2)} TMC`,
                  `${display} (80% band)`,
                ] as [string, string];
              }
              const num = typeof value === "number" ? value : Number(value);
              const text = isFinite(num) ? `${num.toFixed(2)} TMC` : "-";
              if (nameStr === "__total") return [text, "Total (visible sources)"] as [string, string];
              if (nameStr === "__total_forecast") return [text, "Total (forecast)"] as [string, string];
              const isForecast = nameStr.endsWith("__forecast");
              const code = nameStr.replace("__forecast", "");
              const display = series.find((s) => s.source_code === code)?.display_name ?? code;
              return [text, isForecast ? `${display} (forecast)` : display] as [string, string];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
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
              fill={SUMMED_LINE_COLOR}
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
                stroke={SUMMED_LINE_COLOR}
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
                  stroke={SUMMED_LINE_COLOR}
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

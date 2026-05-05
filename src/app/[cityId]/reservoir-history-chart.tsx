"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { HistorySeries } from "./data";

interface Props {
  series: HistorySeries[];
  earliestDate: string | null;
  latestDate: string | null;
  pointCount: number;
  /** Pre-formatted display name for the chart header. */
  cityDisplayName: string;
}

const TIME_TABS = [
  { key: "90d", label: "90 days", days: 90 },
  { key: "1yr", label: "1 yr", days: 365 },
  { key: "3yr", label: "3 yrs", days: 365 * 3 },
  { key: "all", label: "All time", days: 0 },
] as const;

type TabKey = (typeof TIME_TABS)[number]["key"];

// Per-source line color. Stable so future additions stay consistent.
const SOURCE_COLOR: Record<string, string> = {
  vaigai:       "#2563eb",
  mullaperiyar: "#7c3aed",
  sothuparai:   "#059669",
  mettur:       "#0891b2",
  krs:          "#d97706",
  kabini:       "#ec4899",
  hemavathy:    "#10b981",
  harangi:      "#f97316",
};

function fallbackColor(sourceCode: string): string {
  // Stable hash -> palette pick for unknown sources.
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

export default function ReservoirHistoryChart({
  series,
  earliestDate,
  latestDate,
  pointCount,
  cityDisplayName,
}: Props) {
  const [tab, setTab] = useState<TabKey>("1yr");

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

    type Row = { date: string } & Record<string, string | number | null>;
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
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [series, tab, hidden]);

  const visibleSeries = series.filter((s) => !hidden.has(s.source_code));

  if (series.length === 0 || pointCount === 0) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-4 text-sm text-slate-700 dark:text-slate-300">
        <div className="font-semibold text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wider mb-1">
          Reservoir history pending
        </div>
        <p>
          {cityDisplayName} reservoir storage history hasn&apos;t been
          backfilled yet. Run{" "}
          <code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
            python neer-vazhvu-api/scripts/backfill_tn_pwd_reservoirs.py
          </code>{" "}
          to populate up to ~9 years of TN Agri ARS daily readings into{" "}
          <code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
            reservoir_daily_v2
          </code>
          ; this chart fills in automatically.
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

      {/* Time-range tabs */}
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

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={merged} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
          <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 11 }} minTickGap={50} />
          <YAxis tick={{ fontSize: 11 }} label={{ value: "TMC", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
          <Tooltip
            labelFormatter={(label) => fmtDate(label as string)}
            formatter={(value, name) => {
              const num = typeof value === "number" ? value : Number(value);
              const text = isFinite(num) ? `${num.toFixed(2)} TMC` : "-";
              const label =
                series.find((s) => s.source_code === String(name))?.display_name ??
                String(name);
              return [text, label] as [string, string];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) =>
              series.find((s) => s.source_code === value)?.display_name ?? value
            }
          />
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
        </LineChart>
      </ResponsiveContainer>

      <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
        Daily storage (TMC) from TN Agri ARS bulletin via{" "}
        <a
          href="https://tnagriculture.in/ARS/home/reservoir"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          tnagriculture.in
        </a>
        . Click a source pill to toggle it; primary drinking sources are on by default.
      </div>
    </div>
  );
}

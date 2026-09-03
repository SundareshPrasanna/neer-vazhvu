"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Play, Pause } from "lucide-react";
import type { RichBodyEntry } from "@/lib/water-bodies/rich-body-registry";
import { useTheme } from "@/components/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";

// Class colours - shared with the map legend ethos: open water sky, algae
// green, froth amber (the alarm signal), exposed bed brown.
const C = {
  open_water: "#0ea5e9",
  algae: "#16a34a",
  froth: "#f59e0b",
  bed: "#92400e",
  ndti: "#a16207",
  ndci: "#16a34a",
};

interface MonthRow {
  ym: string;
  ts: number;
  n_scenes: number;
  frac_open_water: number | null;
  frac_algae: number | null;
  frac_froth: number | null;
  frac_bed: number | null;
  algae_vigor_ndvi: number | null;
  ndci_rel: number | null;
  ndti_rel: number | null;
}

interface StateShape {
  tier: string;
  capability_status: Record<string, string>;
  headline_for_v0: string[];
  by_zone: Record<string, { monthly: Record<string, Record<string, number | null>> }>;
}

function toMonths(state: StateShape): MonthRow[] {
  const monthly = state.by_zone?.lakebed?.monthly ?? {};
  return Object.entries(monthly)
    .map(([ym, v]) => {
      const [y, m] = ym.split("-").map(Number);
      return {
        ym,
        ts: new Date(y, m - 1, 1).getTime(),
        n_scenes: (v.n_scenes as number) ?? 0,
        frac_open_water: v.frac_open_water ?? null,
        frac_algae: v.frac_algae ?? null,
        frac_froth: v.frac_froth ?? null,
        frac_bed: v.frac_bed ?? null,
        algae_vigor_ndvi: v.algae_vigor_ndvi ?? null,
        ndci_rel: v.ndci_rel ?? null,
        ndti_rel: v.ndti_rel ?? null,
      };
    })
    .sort((a, b) => a.ts - b.ts);
}

const pct = (x: number | null) => (x == null ? "-" : `${Math.round(100 * x)}%`);

function composition(r: MonthRow): Array<[string, number | null, string]> {
  return [
    ["open water", r.frac_open_water, C.open_water],
    ["algae", r.frac_algae, C.algae],
    ["bed", r.frac_bed, C.bed],
    ["froth", r.frac_froth, C.froth],
  ];
}

export function RichBodyPollutionPanel({ body }: { body: RichBodyEntry }) {
  const statePath = body.pollution?.signal_paths?.state;
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<StateShape | null>(null);
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Animation cursor (index into rows) + play state.
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  // Lazy-fetch the (large) state JSON on first expand only.
  useEffect(() => {
    if (!open || !statePath || state || loading) return;
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(statePath, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((j: StateShape) => {
        setState(j);
        setRows(toMonths(j));
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(true);
          setLoading(false);
        }
      });
    return () => ctrl.abort();
  }, [open, statePath, state, loading]);

  // Drive the play animation.
  useEffect(() => {
    if (!playing || rows.length === 0) return;
    const id = setInterval(() => {
      setCursor((c) => {
        const next = c == null ? 0 : c + 1;
        return next >= rows.length ? 0 : next;
      });
    }, 380);
    return () => clearInterval(id);
  }, [playing, rows.length]);

  if (!statePath) return null;

  const grid = isDark ? "#334155" : "#e2e8f0";
  const tick = isDark ? "#94a3b8" : "#64748b";
  const cur = cursor != null ? rows[cursor] : null;

  const yearTicks = (() => {
    if (rows.length === 0) return [];
    const a = rows[0].ts;
    const b = rows[rows.length - 1].ts;
    const out: number[] = [];
    for (let y = new Date(a).getFullYear(); y <= new Date(b).getFullYear(); y++) {
      const t = new Date(y, 0, 1).getTime();
      if (t >= a && t <= b) out.push(t);
    }
    return out;
  })();
  const yearFmt = (ts: number) => `'${new Date(ts).getFullYear().toString().slice(2)}`;

  // capability messaging
  const idxStatus = state?.capability_status?.turbidity_rel ?? "";
  const indicesRepresentative = idxStatus.startsWith("ok");

  return (
    <details
      className="border-t border-slate-200 dark:border-slate-800 shrink-0 group"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="px-4 md:px-6 py-2 text-[12px] cursor-pointer text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950/40 select-none flex items-center justify-between">
        <span>Pollution profile (Sentinel-2, relative · 2017-now)</span>
        <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
      </summary>

      <div className="px-4 md:px-6 pb-3 max-h-[52vh] overflow-y-auto">
        {loading && <Skeleton className="h-48 w-full rounded-lg" />}
        {error && (
          <div className="h-24 flex items-center justify-center text-slate-400 text-xs">
            Pollution data unavailable for this body.
          </div>
        )}

        {state && rows.length > 0 && (
          <>
            {/* Headline */}
            <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5 mb-2 list-disc pl-4">
              {state.headline_for_v0.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>

            {/* Animation controls + current-month readout */}
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => {
                  setPlaying((p) => !p);
                  if (cursor == null) setCursor(0);
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {playing ? "Pause" : "Play"} time-series
              </button>
              {cur && (
                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-semibold tabular-nums">{cur.ym}</span>
                  <span className="flex h-3 w-40 overflow-hidden rounded-sm border border-slate-300 dark:border-slate-600">
                    {composition(cur).map(([k, frac, color]) => (
                      <span
                        key={k}
                        style={{ width: `${100 * (frac ?? 0)}%`, background: color }}
                        title={`${k}: ${pct(frac)}`}
                      />
                    ))}
                  </span>
                </div>
              )}
            </div>

            {/* Surface composition - the primary signal */}
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Surface composition (% of clear lake surface)
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rows} margin={{ top: 5, right: 5, left: -12, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis
                    dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]}
                    ticks={yearTicks} tickFormatter={yearFmt}
                    tick={{ fontSize: 9, fill: tick }} tickLine={false} axisLine={false}
                  />
                  <YAxis
                    domain={[0, 1]} tick={{ fontSize: 9, fill: tick }} tickLine={false}
                    axisLine={false} width={34}
                    tickFormatter={(v: number) => `${Math.round(100 * v)}%`}
                  />
                  <Tooltip content={<CompositionTooltip isDark={isDark} />} />
                  {(["open_water", "algae", "bed", "froth"] as const).map((k) => (
                    <Area
                      key={k} type="monotone" dataKey={`frac_${k}`} stackId="1"
                      stroke={C[k]} fill={C[k]} fillOpacity={0.65} strokeWidth={0}
                      isAnimationActive={false} connectNulls
                    />
                  ))}
                  {cur && <ReferenceLine x={cur.ts} stroke={isDark ? "#e2e8f0" : "#0f172a"} strokeWidth={1} />}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <Legend />

            {/* Turbidity + chlorophyll (relative) */}
            <div className="mt-3 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Turbidity &amp; chlorophyll (relative)
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  indicesRepresentative
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                }`}
              >
                {indicesRepresentative ? "lake-representative" : "low-consistency (little open water)"}
              </span>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 5, right: 5, left: -12, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis
                    dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]}
                    ticks={yearTicks} tickFormatter={yearFmt}
                    tick={{ fontSize: 9, fill: tick }} tickLine={false} axisLine={false}
                  />
                  <YAxis tick={{ fontSize: 9, fill: tick }} tickLine={false} axisLine={false} width={34} />
                  <Tooltip content={<IndexTooltip isDark={isDark} />} />
                  <Line type="monotone" dataKey="ndti_rel" name="Turbidity (NDTI)" stroke={C.ndti}
                    strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="ndci_rel" name="Chlorophyll (NDCI)" stroke={C.ndci}
                    strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
                  {cur && <ReferenceLine x={cur.ts} stroke={isDark ? "#e2e8f0" : "#0f172a"} strokeWidth={1} />}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Honest gaps */}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
              Tier-1 relative indices (not calibrated to NTU / mg/L). <strong>TSS and
              calibrated turbidity/chlorophyll</strong> need in-situ samples (Tier-2,
              pending). DO / BOD / coliform have no satellite signature - a permanent
              data gap. Froth is a lower bound at 10 m resolution.
            </p>
          </>
        )}
      </div>
    </details>
  );
}

function Legend() {
  const items: Array<[string, string]> = [
    ["Open water", C.open_water],
    ["Algae / weed", C.algae],
    ["Exposed bed", C.bed],
    ["Froth", C.froth],
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CompositionTooltip({ active, payload, isDark }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as MonthRow;
  return (
    <div className={`rounded-lg border p-2 text-xs shadow-lg ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
      <div className="text-slate-500 dark:text-slate-400 font-medium mb-0.5">{d.ym} · {d.n_scenes} scenes</div>
      <div style={{ color: C.algae }}>Algae {pct(d.frac_algae)}</div>
      <div style={{ color: C.open_water }}>Open water {pct(d.frac_open_water)}</div>
      <div style={{ color: C.bed }}>Bed {pct(d.frac_bed)}</div>
      <div style={{ color: C.froth }}>Froth {pct(d.frac_froth)}</div>
    </div>
  );
}

function IndexTooltip({ active, payload, isDark }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as MonthRow;
  const f = (v: number | null) => (v == null ? "n/a" : v.toFixed(3));
  return (
    <div className={`rounded-lg border p-2 text-xs shadow-lg ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
      <div className="text-slate-500 dark:text-slate-400 font-medium mb-0.5">{d.ym}</div>
      <div style={{ color: C.ndti }}>Turbidity {f(d.ndti_rel)}</div>
      <div style={{ color: C.ndci }}>Chlorophyll {f(d.ndci_rel)}</div>
    </div>
  );
}

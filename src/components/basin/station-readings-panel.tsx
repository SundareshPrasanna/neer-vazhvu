"use client";

// Station-readings panel (station-readings contract v1 - see
// docs/specs/flow-stations-contract.md). Renders whatever series a station's
// readings pack declares; it never knows which agency or basin it belongs to.
// Loaded lazily from BasinAtlas so recharts only ships when a readings
// station is actually clicked.

import { useEffect, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/components/theme-provider";
import type { ReadingsSeries, StationReadingsPack } from "@/lib/basins";

const MONTH_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CLASS_COLORS: Record<string, string> = {
  A: "#059669", B: "#84cc16", C: "#f59e0b", D: "#ea580c", E: "#dc2626",
};

interface Props {
  basinId: string;
  stationKey: string;
  /** Display fallbacks while the pack loads. */
  name?: string;
  onClose: () => void;
}

export function StationReadingsPanel({ basinId, stationKey, name, onClose }: Props) {
  // Keyed by station so a stale pack never renders for a newly clicked
  // station - no synchronous reset in the effect needed.
  const [loaded, setLoaded] = useState<{ key: string; pack: StationReadingsPack | null } | null>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    let live = true;
    fetch(`/data/basins/${basinId}/readings/${encodeURIComponent(stationKey)}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (live) setLoaded({ key: stationKey, pack: d }); })
      .catch(() => { if (live) setLoaded({ key: stationKey, pack: null }); });
    return () => { live = false; };
  }, [basinId, stationKey]);

  const pack = loaded?.key === stationKey ? loaded.pack : null;
  const failed = loaded?.key === stationKey && loaded.pack === null;

  const shown = (pack?.series ?? []).filter((s) => s.verified);
  const meta = [pack?.station.agency, pack?.station.siteType, pack?.station.river]
    .filter(Boolean).join(" · ");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Monitoring station</div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {pack?.station.name ?? name ?? stationKey}
          </h2>
          {meta && <div className="text-xs text-slate-500 dark:text-slate-400">{meta}</div>}
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {failed && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Readings could not be loaded for this station.
        </p>
      )}
      {!pack && !failed && <p className="text-xs text-slate-400">Loading readings…</p>}

      {pack?.period && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          Record: {pack.period.from} to {pack.period.to}
        </div>
      )}

      {shown.map((s, i) => (
        <SeriesBlock key={`${s.kind}-${i}`} s={s} isDark={isDark} />
      ))}

      {pack && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Source: {pack.source.url ? (
            <a href={pack.source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{pack.source.label}</a>
          ) : pack.source.label}
          {" · "}fetched {pack.source.fetched}
          {pack.source.licence ? <> · {pack.source.licence}</> : null}
        </div>
      )}
    </div>
  );
}

function SeriesBlock({ s, isDark }: { s: ReadingsSeries; isDark: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        {s.label ?? s.kind}
        {s.unit ? <span className="font-normal text-slate-400"> ({s.unit})</span> : null}
      </div>
      <SeriesChart s={s} isDark={isDark} />
      {s.note && <div className="text-[10px] text-slate-400 leading-snug mt-0.5">{s.note}</div>}
    </div>
  );
}

function SeriesChart({ s, isDark }: { s: ReadingsSeries; isDark: boolean }) {
  const grid = isDark ? "#334155" : "#e2e8f0";
  const axis = isDark ? "#94a3b8" : "#64748b";
  const tickStyle = { fontSize: 9, fill: axis };
  const tooltipStyle = {
    backgroundColor: isDark ? "#1e293b" : "#ffffff",
    border: `1px solid ${grid}`,
    borderRadius: 6,
    fontSize: 11,
  } as const;

  switch (s.kind) {
    case "discharge-monthly":
    case "discharge-daily":
    case "gauge-level-monthly": {
      const data = (s.points ?? []).map(([t, v]) => ({ t, v: Number(v) }));
      return (
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="t" tick={tickStyle} minTickGap={40} />
            <YAxis tick={tickStyle} width={54} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={1.5} dot={false} name={s.unit ?? ""} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    case "climatology-monthly": {
      const data = (s.months ?? []).map((m) => ({
        m: MONTH_ABBR[m.m], band: [m.p25, m.p75], median: m.median,
      }));
      return (
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="m" tick={tickStyle} />
            <YAxis tick={tickStyle} width={54} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area dataKey="band" stroke="none" fill="#2563eb" fillOpacity={0.18} name="p25-p75" />
            <Line type="monotone" dataKey="median" stroke="#2563eb" strokeWidth={2} dot={false} name="median" />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    case "flow-duration": {
      const data = (s.exceedance ?? []).map(([pct, v]) => ({ pct, v }));
      // A log axis cannot hold a zero, and recharts does not degrade: given a
      // domain containing 0 it draws no ticks and no line, so the chart comes
      // out blank under a caption still claiming N values. Rivers that run dry
      // are exactly the ones worth plotting - T. Narasipur reads 0 cumec at the
      // 95th and 99th percentile - so fall back to a linear axis whenever the
      // series touches zero, and keep log for the perennial stations where it
      // earns its keep across three orders of magnitude.
      const positive = data.every((d) => Number.isFinite(d.v) && d.v > 0);
      return (
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="pct" tick={tickStyle} unit="%" type="number" domain={[0, 100]} />
            {positive ? (
              <YAxis tick={tickStyle} width={54} scale="log" domain={["auto", "auto"]} allowDataOverflow />
            ) : (
              <YAxis tick={tickStyle} width={54} />
            )}
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `exceeded ${v}% of days`} />
            <Line type="monotone" dataKey="v" stroke="#0d9488" strokeWidth={1.5} dot={false} name={s.unit ?? ""} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    case "annual-water-year": {
      const data = (s.points ?? []).map(([t, v]) => ({ t, v: Number(v) }));
      const lta = data.length ? data.reduce((a, d) => a + d.v, 0) / data.length : null;
      return (
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="t" tick={tickStyle} minTickGap={20} />
            <YAxis tick={tickStyle} width={54} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="v" fill="#2563eb" name={s.unit ?? ""} />
            {lta != null && <ReferenceLine y={lta} stroke={axis} strokeDasharray="4 4" />}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case "wq-param-series": {
      const data = (s.points ?? []).map(([t, v]) => ({ t, v: Number(v) }));
      return (
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="t" tick={tickStyle} minTickGap={40} />
            <YAxis tick={tickStyle} width={54} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="v" stroke="#9d174d" strokeWidth={1.5} dot={false} name={s.param ?? s.unit ?? ""} />
            {s.criterion != null && (
              // extendDomain: a station comfortably WITHIN the criterion must
              // still show the line - "well under the limit" is the reading.
              <ReferenceLine y={s.criterion} stroke="#dc2626" strokeDasharray="4 4" ifOverflow="extendDomain"
                label={{ value: s.criterionLabel ?? `criterion ${s.criterion}`, fontSize: 9, fill: axis, position: "insideTopRight" }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    case "wq-class-series": {
      const pts = s.points ?? [];
      return (
        <div className="flex flex-wrap gap-0.5 py-1">
          {pts.map(([t, v]) => (
            <span key={t} title={`${t}: class ${v}`}
              className="w-4 h-4 rounded-sm text-[8px] leading-4 text-center text-white font-semibold"
              style={{ backgroundColor: CLASS_COLORS[String(v)] ?? "#94a3b8" }}>
              {String(v)}
            </span>
          ))}
        </div>
      );
    }

    default: {
      // Forward-compatible: unknown kinds render as a plain table.
      const rows = (s.points ?? []).slice(-24);
      return (
        <table className="w-full text-[11px] text-slate-600 dark:text-slate-300">
          <tbody>
            {rows.map(([t, v]) => (
              <tr key={t} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-0.5 pr-2">{t}</td>
                <td className="py-0.5 text-right tabular-nums">{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  }
}

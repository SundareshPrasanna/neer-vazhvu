"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";

/* ── Ward equity panel ──────────────────────────────────────────────────
   The Equity Atlas as a my-ward section (no new pages): per-ward service
   equity from the utility's own numbers - supply hours, water quality
   (%-unfit samples) and unmetered share - as a verdict-first ranked view.
   Shared surface: city = ward-equity-{cityId}.json; the component
   self-hides for cities without a file. Worst wards float to the top. */

interface EquityWard {
  ward_code: string;
  label: string;
  name: string;
  avg_supply_hours: number | null;
  zones: number | null;
  zones_4h_or_less_pct: number | null;
  zones_24h: number;
  unfit_pct_2024: number | null;
  unfit_series: Record<string, number> | null;
  connections: number;
  unmetered_pct: number | null;
}

interface EquityFile {
  place_id: string;
  updated: string;
  source: { label: string; url: string };
  _note: string;
  city: {
    avg_supply_hours: number;
    zones_total: number;
    zones_4h_or_less_pct: number;
    zones_24h: number;
    connections_total: number;
    connections_unmetered: number;
  };
  wards: EquityWard[];
}

type Metric = "hours" | "unfit" | "unmetered";

const METRIC_DEF: Record<
  Metric,
  {
    key: string;
    explainKey: string;
    value: (w: EquityWard) => number | null;
    fmt: (v: number) => string;
    /** true when a HIGHER value is worse (unfit/unmetered); hours invert. */
    higherIsWorse: boolean;
    max: (ws: EquityWard[]) => number;
  }
> = {
  hours: {
    key: "equity.metric_hours",
    explainKey: "equity.explain_hours",
    value: (w) => w.avg_supply_hours,
    fmt: (v) => `${v} h/day`,
    higherIsWorse: false,
    max: () => 24,
  },
  unfit: {
    key: "equity.metric_unfit",
    explainKey: "equity.explain_unfit",
    value: (w) => w.unfit_pct_2024,
    fmt: (v) => `${v}%`,
    higherIsWorse: true,
    max: (ws) => Math.max(5, ...ws.map((w) => w.unfit_pct_2024 ?? 0)),
  },
  unmetered: {
    key: "equity.metric_unmetered",
    explainKey: "equity.explain_unmetered",
    value: (w) => w.unmetered_pct,
    fmt: (v) => `${v}%`,
    higherIsWorse: true,
    max: (ws) => Math.max(10, ...ws.map((w) => w.unmetered_pct ?? 0)),
  },
};

function barColor(frac: number, higherIsWorse: boolean): string {
  // frac = value/max; map severity to the shared red→green ramp.
  const sev = higherIsWorse ? frac : 1 - frac;
  if (sev >= 0.75) return "#ef4444";
  if (sev >= 0.5) return "#f97316";
  if (sev >= 0.25) return "#eab308";
  return "#22c55e";
}

export function WardEquityPanel({ cityId }: { cityId: string }) {
  const { t } = useLanguage();
  const [data, setData] = useState<EquityFile | null>(null);
  const [metric, setMetric] = useState<Metric>("hours");

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/ward-equity-${cityId}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<EquityFile>) : null))
      .then((d) => {
        if (!cancelled && d) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  const def = METRIC_DEF[metric];

  const ranked = useMemo(() => {
    if (!data) return [];
    const rows = data.wards.filter((w) => def.value(w) !== null);
    // Problems first: fewest hours / highest unfit / highest unmetered.
    rows.sort((a, b) =>
      def.higherIsWorse
        ? (def.value(b) as number) - (def.value(a) as number)
        : (def.value(a) as number) - (def.value(b) as number),
    );
    return rows;
  }, [data, def]);

  if (!data) return null;

  const c = data.city;
  const wards24 = data.wards.filter((w) => (w.avg_supply_hours ?? 0) >= 24).length;
  const wardsUnder4 = data.wards.filter((w) => (w.avg_supply_hours ?? 99) < 4).length;
  const maxV = def.max(ranked);

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
          {t("equity.title")}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{t("equity.intro")}</p>
      </div>

      {/* The scoreboard: the whole panel at one glance. */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          {wardsUnder4} {t("equity.chip_under4")}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          {wards24} {t("equity.chip_24x7")}
        </span>
        <span className="text-[11px] px-2 py-0.5 text-slate-500">
          {t("equity.chip_city")
            .replace("{hours}", String(c.avg_supply_hours))
            .replace("{pct}", String(c.zones_4h_or_less_pct))}
        </span>
      </div>

      {/* Metric toggle */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(METRIC_DEF) as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              metric === m
                ? "bg-sky-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {t(METRIC_DEF[m].key)}
          </button>
        ))}
      </div>

      {/* Never ship an unexplained metric: one plain-language line for
          whichever metric is active. */}
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
        {t(def.explainKey)}
      </p>

      {/* Ranked bars, worst first */}
      <div className="space-y-1">
        {ranked.map((w) => {
          const v = def.value(w) as number;
          const frac = Math.min(1, v / maxV);
          return (
            <div key={w.ward_code} className="flex items-center gap-2 text-xs">
              <span
                className="w-36 shrink-0 truncate text-slate-700 dark:text-slate-300"
                title={w.label}
              >
                {w.label}
              </span>
              <div className="flex-1 h-3.5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{ width: `${Math.max(2, frac * 100)}%`, backgroundColor: barColor(frac, def.higherIsWorse) }}
                />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-slate-800 dark:text-slate-100">
                {def.fmt(v)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400 leading-snug">
        {data._note} {t("equity.source_prefix")}{" "}
        <a
          href={data.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {data.source.label}
        </a>
        .
      </p>
    </section>
  );
}

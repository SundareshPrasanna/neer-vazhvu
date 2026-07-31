"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistorySeries } from "@/types/reservoir";

/**
 * The corridor's documented dependency panel (DECISIONS.md D11): SIPCOT's own
 * EC filings put the parks on CMWSSB supply from Chembarambakkam plus TTRO
 * reuse water, so the honest risk vector for this corridor is the reservoir,
 * not the (currently Safe-classified) aquifer under it. Storage history is
 * the same series the Chennai dashboard renders, via /api/reservoir/history.
 */
export function ChembarambakkamPanel() {
  const [series, setSeries] = useState<HistorySeries | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reservoir/history?cityId=chennai")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((payload: { series: HistorySeries[] }) => {
        if (cancelled) return;
        const chem = payload.series.find((s) => s.source_code === "chembarambakkam");
        if (chem) setSeries(chem);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const points = useMemo(
    () =>
      (series?.points ?? [])
        .filter((p) => p.storage_pct_frl !== null)
        .map((p) => ({ date: p.date, pct: p.storage_pct_frl })),
    [series],
  );
  const latest = points.length ? points[points.length - 1] : null;
  // One tick per year (first reading of each year) so the axis never repeats
  // a year label under minTickGap pressure.
  const yearTicks = useMemo(() => {
    const seen = new Set<string>();
    const ticks: string[] = [];
    for (const p of points) {
      const y = p.date.slice(0, 4);
      if (!seen.has(y)) {
        seen.add(y);
        ticks.push(p.date);
      }
    }
    return ticks;
  }, [points]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
          The corridor&apos;s documented water source: Chembarambakkam
        </h3>
        {latest && (
          <span className="text-sm font-mono text-slate-600 dark:text-slate-300">
            {latest.pct?.toFixed(0)}% of capacity ({latest.date})
          </span>
        )}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        SIPCOT&apos;s environmental-clearance compliance filings describe the
        estates as supplied by CMWSSB drawing on Chembarambakkam Lake,
        supplemented by tertiary treated reuse (TTRO) water piped from the
        Koyambedu and Kodungaiyur plants; Pillaipakkam&apos;s EC additionally
        prohibits groundwater drawl (citations per park in the sources
        section). Chembarambakkam is also one of Chennai&apos;s four drinking
        water reservoirs. In the 2019 crisis it fell effectively to zero. A
        corridor whose aquifer is classified Safe can still share its lifeline
        with a city of 10 million.
      </p>
      {points.length > 0 ? (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(d: string) => d.slice(0, 4)}
                ticks={yearTicks}
                minTickGap={40}
                stroke="currentColor"
                opacity={0.4}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => `${v}%`}
                width={36}
                domain={[0, 100]}
                stroke="currentColor"
                opacity={0.4}
              />
              <Tooltip
                formatter={(v) => [`${Number(v).toFixed(1)}% of capacity`, "Storage"]}
                labelFormatter={(d) => `Date: ${d}`}
              />
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey="pct"
                stroke="#0369a1"
                fill="#0369a1"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : failed ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Live storage history is temporarily unavailable; the series is on the{" "}
          <Link href="/chennai" className="underline">Chennai dashboard</Link>.
        </p>
      ) : (
        <div className="h-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Storage as % of full capacity (3,645 Mcft), daily CMWSSB readings, the
        same series as the{" "}
        <Link href="/chennai" className="underline">Chennai dashboard</Link>.
        Deep history and satellite record:{" "}
        <Link href="/chennai/water-bodies" className="underline">
          Chembarambakkam in the water-bodies deep-zoom panel
        </Link>
        .
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useTheme } from "next-themes";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n/context";
import { formatNumber } from "@/lib/utils/format";

interface HistoryPoint {
  summaryDate: string;
  observedAreaHa: number | null;
  baselineAreaHa: number | null;
  anomalyRatio: number | null;
}

interface WaterBodyHistoryChartProps {
  osmId: number;
}

function parseDate(value: string): Date | null {
  const parts = value.split("-").map(Number);
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
    return null;
  }
  return new Date(parts[0], parts[1] - 1, parts[2] ?? 1);
}

export function WaterBodyHistoryChart({ osmId }: WaterBodyHistoryChartProps) {
  const { t, language } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  const locale = language === "ta" ? "ta-IN" : "en-IN";

  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);

    fetch(`/api/water-bodies/gee/history?osm_id=${osmId}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((payload) => {
        const points: HistoryPoint[] = (payload.data ?? []).map(
          (row: Record<string, unknown>) => ({
            summaryDate: row.summary_date as string,
            observedAreaHa: row.latest_observed_area_ha as number | null,
            baselineAreaHa: row.seasonal_baseline_area_ha as number | null,
            anomalyRatio: row.anomaly_ratio as number | null,
          }),
        );
        setHistory(points);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [osmId]);

  const title = t("wb_panel.satellite_history_title");

  if (loading) {
    return (
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          {title}
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          {title}
        </div>
        <div className="h-40 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
          {t("wb_panel.satellite_history_error")}
        </div>
      </div>
    );
  }

  const withData = history.filter((p) => p.observedAreaHa !== null);
  if (withData.length < 2) {
    return null;
  }

  const baselineValues = withData
    .map((p) => p.baselineAreaHa)
    .filter((v): v is number => v !== null);
  const avgBaseline =
    baselineValues.length > 0
      ? baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length
      : null;

  const formatMonthShort = (date: string) => {
    const parsed = parseDate(date);
    if (!parsed) return date;
    return parsed.toLocaleDateString(locale, {
      month: "short",
      year: "2-digit",
    });
  };

  const formatMonthLong = (date: string) => {
    const parsed = parseDate(date);
    if (!parsed) return date;
    return parsed.toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
  };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const renderTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: readonly any[];
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as HistoryPoint;
    if (!d?.summaryDate) return null;

    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 text-xs space-y-0.5">
        <div className="text-slate-500 dark:text-slate-400 font-medium">
          {formatMonthLong(d.summaryDate)}
        </div>
        {d.observedAreaHa !== null && (
          <div className="font-semibold text-sky-600 dark:text-sky-400">
            {formatNumber(d.observedAreaHa, d.observedAreaHa >= 100 ? 0 : 1)} ha{" "}
            {t("wb_panel.satellite_history_observed")}
          </div>
        )}
        {d.baselineAreaHa !== null && (
          <div className="text-slate-400 dark:text-slate-500">
            {formatNumber(d.baselineAreaHa, d.baselineAreaHa >= 100 ? 0 : 1)} ha{" "}
            {t("wb_panel.satellite_history_baseline")}
          </div>
        )}
      </div>
    );
  };

  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const tickColor = isDark ? "#94a3b8" : "#64748b";

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
        {title}
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={history}
            margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="summaryDate"
              tick={{ fontSize: 9, fill: tickColor }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tickFormatter={formatMonthShort}
            />
            <YAxis
              tick={{ fontSize: 9, fill: tickColor }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v >= 100 ? Math.round(v) : v.toFixed(1)} ha`}
              width={48}
            />
            <Tooltip content={renderTooltip} />
            {avgBaseline !== null && (
              <ReferenceLine
                y={avgBaseline}
                stroke={isDark ? "#64748b" : "#94a3b8"}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            <Area
              type="monotone"
              dataKey="observedAreaHa"
              stroke="#0ea5e9"
              strokeWidth={2}
              fill="url(#areaGradient)"
              connectNulls={false}
              dot={false}
              activeDot={{ r: 3, fill: "#0ea5e9" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 text-center">
        {t("wb_panel.satellite_history_note")}
      </p>
    </div>
  );
}

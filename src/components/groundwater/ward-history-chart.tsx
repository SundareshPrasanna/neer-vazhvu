"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import type { WardHistoryPoint, WardHistoryResponse } from "@/types/groundwater";
import { useLanguage } from "@/lib/i18n/context";

interface WardHistoryChartProps {
  wardNumber: number;
}

export function WardHistoryChart({ wardNumber }: WardHistoryChartProps) {
  const { t, language } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  const locale = language === "ta" ? "ta-IN" : language === "kn" ? "kn-IN" : "en-IN";
  const [history, setHistory] = useState<WardHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const parseMonthDate = (value: string): Date | null => {
    const [year, month] = value.split("-").map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    return new Date(year, month - 1, 1);
  };

  const formatMonthYear = (date: string) => {
    const parsed = parseMonthDate(date);
    if (!parsed) return date;
    return parsed.toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
  };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: readonly any[] }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as WardHistoryPoint;
    if (!d?.date) return null;

    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 text-xs">
        <div className="text-slate-500 dark:text-slate-400">{formatMonthYear(d.date)}</div>
        {d.depthM !== null ? (
          <div className="font-semibold text-sky-600 dark:text-sky-400">
            {d.depthM.toFixed(1)}m {t("ward.tooltip_depth")}
          </div>
        ) : (
          <div className="text-slate-400">{t("gw.no_data_lc")}</div>
        )}
      </div>
    );
  };

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);

    fetch(`/api/groundwater/history?ward=${wardNumber}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d: WardHistoryResponse) => {
        setHistory(d.history);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [wardNumber]);

  if (loading) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
          {t("ward.history_trend")}
        </h4>
        <Skeleton className="h-44 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
          {t("ward.history_trend")}
        </h4>
        <div className="h-44 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
          {t("ward.history_load_error")}
        </div>
      </div>
    );
  }

  const dataWithDepth = history.filter((p) => p.depthM !== null);

  if (dataWithDepth.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
          {t("ward.history_trend")}
        </h4>
        <div className="h-44 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
          {t("ward.history_none")}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
        {t("ward.history_trend")}
      </h4>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: isDark ? "#94a3b8" : "#64748b" }}
              tickLine={false}
              axisLine={false}
              interval={5}
              tickFormatter={(d: string) => {
                const parsed = parseMonthDate(d);
                if (!parsed) return d;
                return parsed.toLocaleDateString(locale, {
                  month: "short",
                  year: "2-digit",
                });
              }}
            />
            <YAxis
              reversed
              tick={{ fontSize: 9, fill: isDark ? "#94a3b8" : "#64748b" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}m`}
              width={40}
            />
            <Tooltip content={renderTooltip} />
            <Line
              type="monotone"
              dataKey="depthM"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 text-center">
        {t("ward.history_yaxis_note")}
      </p>
    </div>
  );
}

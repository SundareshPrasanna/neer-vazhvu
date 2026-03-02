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
import { Skeleton } from "@/components/ui/skeleton";
import type { WardHistoryPoint, WardHistoryResponse } from "@/types/groundwater";

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface WardHistoryChartProps {
  wardNumber: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function renderTooltip({ active, payload }: { active?: boolean; payload?: readonly any[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as WardHistoryPoint;
  if (!d?.date) return null;

  const label = `${MONTH_NAMES[d.month - 1]} ${d.year}`;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 text-xs">
      <div className="text-slate-500 dark:text-slate-400">{label}</div>
      {d.depthM !== null ? (
        <div className="font-semibold text-sky-600 dark:text-sky-400">
          {d.depthM.toFixed(1)}m depth
        </div>
      ) : (
        <div className="text-slate-400">No data</div>
      )}
    </div>
  );
}

export function WardHistoryChart({ wardNumber }: WardHistoryChartProps) {
  const [history, setHistory] = useState<WardHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
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
          Historical Trend
        </h4>
        <Skeleton className="h-44 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
          Historical Trend
        </h4>
        <div className="h-44 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
          Unable to load historical data.
        </div>
      </div>
    );
  }

  const dataWithDepth = history.filter((p) => p.depthM !== null);

  if (dataWithDepth.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
          Historical Trend
        </h4>
        <div className="h-44 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
          No historical data available for this ward.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
        Historical Trend
      </h4>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              interval={5}
              tickFormatter={(d: string) => {
                const [y, m] = d.split("-");
                return `${MONTH_NAMES_SHORT[parseInt(m, 10) - 1]} '${y.slice(2)}`;
              }}
            />
            <YAxis
              reversed
              tick={{ fontSize: 9, fill: "#94a3b8" }}
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
        Y-axis inverted: higher = shallower (healthier)
      </p>
    </div>
  );
}

"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useState, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import type { RiverQualityReading } from "@/types/river-quality";
import { useLanguage } from "@/lib/i18n/context";

interface RiverQualityChartProps {
  readings: RiverQualityReading[];
  stationName: string;
}

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  color: string;
  name: string;
}

function renderTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly TooltipPayloadItem[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  const do_val = payload.find((p) => p.dataKey === "do_mgl");
  const bod_val = payload.find((p) => p.dataKey === "bod_mgl");
  const nitrate_val = payload.find((p) => p.dataKey === "nitrate_mgl");
  const fc_val = payload.find((p) => p.dataKey === "fecal_coliform_mpn");

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 text-xs">
      <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </div>
      {do_val?.value != null && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
          <span className="text-slate-600 dark:text-slate-400">
            DO:{" "}
            <span className="font-medium text-sky-600 dark:text-sky-400">
              {do_val.value.toFixed(1)} mg/L
            </span>
          </span>
        </div>
      )}
      {bod_val?.value != null && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
          <span className="text-slate-600 dark:text-slate-400">
            BOD:{" "}
            <span className="font-medium text-orange-600 dark:text-orange-400">
              {bod_val.value.toFixed(0)} mg/L
            </span>
          </span>
        </div>
      )}
      {nitrate_val?.value != null && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="text-slate-600 dark:text-slate-400">
            NO₃:{" "}
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {nitrate_val.value.toFixed(1)} mg/L
            </span>
          </span>
        </div>
      )}
      {fc_val?.value != null && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
          <span className="text-slate-600 dark:text-slate-400">
            FC:{" "}
            <span className="font-medium text-rose-600 dark:text-rose-400">
              {fc_val.value.toLocaleString()} MPN
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

export function RiverQualityChart({ readings, stationName }: RiverQualityChartProps) {
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  if (!readings || readings.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {t("rivers_chart.no_readings")}
        </span>
      </div>
    );
  }

  // Sort by year for clean line rendering
  const sorted = [...readings].sort((a, b) => a.year - b.year);

  return (
    <div className="h-44">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 truncate">
        {stationName}
      </p>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={sorted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />

          <XAxis
            dataKey="year"
            tick={{ fontSize: 9, fill: isDark ? "#94a3b8" : "#64748b" }}
            tickLine={false}
            axisLine={false}
          />

          {/* Left axis: DO (0–10 mg/L) */}
          <YAxis
            yAxisId="do"
            domain={[0, 10]}
            tick={{ fontSize: 9, fill: "#0ea5e9" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}`}
            width={22}
          />

          {/* Right axis: BOD + COD (0–400 mg/L) */}
          <YAxis
            yAxisId="bod"
            orientation="right"
            domain={[0, 400]}
            tick={{ fontSize: 9, fill: "#f97316" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}`}
            width={28}
          />

          <Tooltip content={renderTooltip} />

          <Legend
            wrapperStyle={{ fontSize: 9, paddingTop: 2 }}
            formatter={(value: string) => {
              if (value === "do_mgl") return "DO (mg/L)";
              if (value === "bod_mgl") return "BOD (mg/L)";
              if (value === "nitrate_mgl") return "NO₃ (mg/L)";
              return value;
            }}
          />

          {/* DO reference line: 4 mg/L = minimum for aquatic life */}
          <ReferenceLine
            yAxisId="do"
            y={4}
            stroke="#94a3b8"
            strokeDasharray="4 3"
            label={{ value: t("rivers_chart.do_min_label"), fontSize: 8, fill: "#94a3b8", position: "insideTopRight" }}
          />

          {/* BOD reference line: 2 mg/L = clean river */}
          <ReferenceLine
            yAxisId="bod"
            y={2}
            stroke="#94a3b8"
            strokeDasharray="4 3"
            label={{ value: t("rivers_chart.bod_clean_label"), fontSize: 8, fill: "#94a3b8", position: "insideTopLeft" }}
          />

          <Line
            yAxisId="do"
            type="monotone"
            dataKey="do_mgl"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "#0ea5e9" }}
            connectNulls={false}
            name="do_mgl"
          />

          <Line
            yAxisId="bod"
            type="monotone"
            dataKey="bod_mgl"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "#f97316" }}
            connectNulls={false}
            name="bod_mgl"
          />

          {/* Nitrate shares the BOD axis (mg/L, 0–45 fits within 0–400 range) */}
          <Line
            yAxisId="bod"
            type="monotone"
            dataKey="nitrate_mgl"
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={{ r: 2, fill: "#10b981" }}
            connectNulls={false}
            name="nitrate_mgl"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

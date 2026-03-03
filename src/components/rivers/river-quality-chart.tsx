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
    </div>
  );
}

export function RiverQualityChart({ readings, stationName }: RiverQualityChartProps) {
  const { t } = useLanguage();

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
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

          <XAxis
            dataKey="year"
            tick={{ fontSize: 9, fill: "#94a3b8" }}
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

          {/* Right axis: BOD (0–200 mg/L) */}
          <YAxis
            yAxisId="bod"
            orientation="right"
            domain={[0, 200]}
            tick={{ fontSize: 9, fill: "#f97316" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}`}
            width={28}
          />

          <Tooltip content={renderTooltip} />

          <Legend
            wrapperStyle={{ fontSize: 9, paddingTop: 2 }}
            formatter={(value: string) =>
              value === "do_mgl" ? "DO (mg/L)" : "BOD (mg/L)"
            }
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
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

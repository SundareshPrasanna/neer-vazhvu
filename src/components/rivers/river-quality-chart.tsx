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
import type { Measure, RiverQualityReading } from "@/types/river-quality";
import { measureWorst, measureLabel } from "@/lib/rivers/measure";
import { useLanguage } from "@/lib/i18n/context";

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface RiverQualityChartProps {
  readings: RiverQualityReading[];
  stationName: string;
}

/** The raw measures for a plotted point, so the tooltip can print the RANGE
 *  the source published rather than the single end this chart plots. */
type RawMeasures = {
  do_mgl: Measure;
  bod_mgl: Measure;
  nitrate_mgl: Measure;
  fecal_coliform_mpn: Measure;
};

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  color: string;
  name: string;
  payload?: { raw?: RawMeasures };
}

/** What to print for one series: the published range ("22-43") where there is
 *  one, else the plotted number. Falls back to the number so a point-value
 *  city is unchanged. */
function seriesLabel(item: TooltipPayloadItem | undefined, digits: number): string | null {
  if (!item || item.value == null) return null;
  const raw = item.payload?.raw?.[item.dataKey as keyof RawMeasures] ?? null;
  return measureLabel(raw) ?? item.value.toFixed(digits);
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
              {seriesLabel(do_val, 1)} mg/L
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
              {seriesLabel(bod_val, 0)} mg/L
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
              {seriesLabel(nitrate_val, 1)} mg/L
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
              {seriesLabel(fc_val, 0) ?? fc_val.value.toLocaleString()} MPN
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

  // Plot by month where the feed is genuinely monthly (Delhi/DPCC), by year
  // everywhere else (CPCB annual NWMP). `period` is the x-axis key either way,
  // so a monthly city gets one point per sample instead of its whole series
  // collapsing onto a single year tick.
  const sorted = [...readings]
    .map((r) => ({
      ...r,
      // Recharts scales numbers. Hyderabad's CPCB NWMP readings are annual
      // {min,max} ranges, so spreading them raw handed Recharts an object to
      // plot and the tooltip an object to call .toFixed() on - which is what
      // broke the Musi and Manjira panels (the two rivers that HAVE readings;
      // rivers without any returned early and looked fine). Plot the
      // threshold-relevant end, per src/lib/rivers/measure.ts, and keep the
      // raw measures for the tooltip so the reader still sees the published
      // range. No midpoint is invented - CPCB never measured one.
      do_mgl: measureWorst(r.do_mgl, "lower-is-worse"),
      bod_mgl: measureWorst(r.bod_mgl, "higher-is-worse"),
      nitrate_mgl: measureWorst(r.nitrate_mgl, "higher-is-worse"),
      fecal_coliform_mpn: measureWorst(r.fecal_coliform_mpn, "higher-is-worse"),
      raw: {
        do_mgl: r.do_mgl,
        bod_mgl: r.bod_mgl,
        nitrate_mgl: r.nitrate_mgl,
        fecal_coliform_mpn: r.fecal_coliform_mpn,
      },
      period: r.month ?? String(r.year),
      // "2026-04" -> "Apr 26" keeps the axis readable at 9px.
      periodLabel: r.month
        ? `${MONTH_ABBR[Number(r.month.slice(5, 7)) - 1] ?? r.month.slice(5, 7)} ${r.month.slice(2, 4)}`
        : String(r.year),
    }))
    .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));

  return (
    <div className="h-44">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 truncate">
        {stationName}
      </p>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={sorted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />

          <XAxis
            dataKey="periodLabel"
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

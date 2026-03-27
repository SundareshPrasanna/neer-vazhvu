"use client";

import { useState, useMemo, useEffect } from "react";
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
  Legend,
  ReferenceLine,
} from "recharts";
import { useTheme } from "next-themes";
import { formatNumber } from "@/lib/utils/format";
import type { HistoricalYearData } from "@/lib/mock-data";
import { useLanguage } from "@/lib/i18n/context";

interface ForecastPoint {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
}

interface StorageTrendChartProps {
  history: Array<{ date: string; totalStorage: number; totalInflow?: number; totalOutflow?: number }>;
  forecast?: ForecastPoint[];
  title?: string;
  capacity?: number;
  onBack?: () => void;
  comparisonYears?: Array<{ year: number; label: string }>;
  getHistoricalData?: (year: number) => HistoricalYearData;
}

const TAB_DAYS = [
  { key: "30d", days: 30 },
  { key: "90d", days: 90 },
  { key: "1yr", days: 365 },
  { key: "all", days: 0 },
];

const YEAR_COLORS: Record<number, string> = {
  2019: "#dc2626", // red  -  Day Zero
  2020: "#f59e0b", // amber
  2021: "#84cc16", // lime
  2022: "#06b6d4", // cyan
  2023: "#8b5cf6", // violet  -  flood year
  2024: "#ec4899", // pink
  2025: "#f97316", // orange
};

export function StorageTrendChart({
  history,
  forecast,
  title,
  capacity,
  onBack,
  comparisonYears,
  getHistoricalData,
}: StorageTrendChartProps) {
  const { t, language } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  const locale = language === "ta" ? "ta-IN" : "en-IN";
  const resolvedTitle = title ?? t("dash.combined_trend");
  const [activeDays, setActiveDays] = useState(0);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [showInflow, setShowInflow] = useState(false);
  const [showOutflow, setShowOutflow] = useState(false);
  const showFlowLines = showInflow || showOutflow;

  const filtered = useMemo(() => {
    if (activeDays === 0) return history;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - activeDays);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    return history.filter((h) => h.date >= cutoffStr);
  }, [history, activeDays]);

  // Filter forecast to match the active time range
  const filteredForecast = useMemo(() => {
    if (!forecast || forecast.length === 0) return [];
    if (activeDays === 0) return forecast;
    // For time-ranged views, include forecast if it falls within range
    // The forecast extends into the future, so always include it
    // as long as there's recent historical data in the range
    return forecast;
  }, [forecast, activeDays]);

  // Determine if we're showing multi-year data (>2 years span)
  const isMultiYear = useMemo(() => {
    if (filtered.length < 2) return false;
    const firstYear = new Date(filtered[0].date + "T00:00:00").getFullYear();
    const lastYear = new Date(filtered[filtered.length - 1].date + "T00:00:00").getFullYear();
    return lastYear - firstYear > 1;
  }, [filtered]);

  // Build comparison data aligned by day-of-year
  const chartData = useMemo(() => {
    // Get the historical data for selected years
    const historicalSets = selectedYears
      .map((year) => getHistoricalData?.(year))
      .filter(Boolean) as HistoricalYearData[];

    const result: Record<string, string | number | undefined>[] = [];

    for (let i = 0; i < filtered.length; i++) {
      const h = filtered[i];
      const currentDate = new Date(h.date + "T00:00:00");

      // Insert gap marker if >120 days between consecutive points
      if (i > 0) {
        const prevDate = new Date(filtered[i - 1].date + "T00:00:00");
        const gapDays = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        if (gapDays > 120) {
          result.push({ date: "", storage: undefined });
        }
      }

      const entry: Record<string, string | number | undefined> = {
        date: h.date,
        storage: h.totalStorage,
        inflow: h.totalInflow,
        outflow: h.totalOutflow,
      };

      // For each comparison year, find the matching day-of-year
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
      const dayOfYear = Math.floor(
        (currentDate.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
      );

      for (const hy of historicalSets) {
        const match = hy.data.find((d) => d.dayOfYear === dayOfYear);
        if (match) {
          entry[`y${hy.year}`] = match.totalStorage;
        }
      }

      result.push(entry);
    }

    // Append forecast data
    if (filteredForecast.length > 0 && result.length > 0) {
      // Add forecast fields to the last historical point so lines connect seamlessly
      const lastEntry = result[result.length - 1];
      if (lastEntry.storage !== undefined) {
        lastEntry.forecast = lastEntry.storage as number;
        lastEntry.forecastLower = lastEntry.storage as number;
        lastEntry.forecastUpper = lastEntry.storage as number;
      }

      for (const f of filteredForecast) {
        result.push({
          date: f.date,
          forecast: f.predicted,
          forecastLower: f.lower,
          forecastUpper: f.upper,
        });
      }
    }

    return result;
  }, [filtered, filteredForecast, selectedYears, getHistoricalData]);

  // Compute x-axis tick interval  -  fewer labels on mobile to prevent overlap
  const xAxisInterval = useMemo(() => {
    const len = chartData.length;
    if (len <= 8) return 0;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    const targetLabels = isMobile ? 5 : 12;
    return Math.max(1, Math.floor(len / targetLabels));
  }, [chartData]);

  // Format date for x-axis labels
  const formatTick = (date: string) => {
    if (!date) return "";
    const d = new Date(date + "T00:00:00");
    if (isMultiYear) return String(d.getFullYear());
    return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  };

  const currentDisplayYear = useMemo(() => {
    const latest = filtered[filtered.length - 1]?.date;
    if (!latest) return String(new Date().getFullYear());
    return String(new Date(`${latest}T00:00:00`).getFullYear());
  }, [filtered]);

  const toggleYear = (year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const hasComparisons = comparisonYears && comparisonYears.length > 0 && getHistoricalData;
  const hasForecast = filteredForecast.length > 0;

  // Custom tooltip that handles both historical and forecast points
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: readonly any[] }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as Record<string, unknown>;
    if (!d?.date) return null;

    const isForecastPoint = d.forecast !== undefined && d.storage === undefined;

    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 text-sm">
        <div className="text-slate-500 dark:text-slate-400 mb-1">
          {d.date as string}
          {isForecastPoint && (
            <span className="ml-2 text-violet-500 text-xs font-medium">{t("dash.forecast_label")}</span>
          )}
        </div>
        {d.storage !== undefined && (
          <div className="font-semibold text-blue-700 dark:text-blue-400">
            {formatNumber(d.storage as number)} mcft
          </div>
        )}
        {d.forecast !== undefined && (
          <>
            <div className="font-semibold text-violet-600 dark:text-violet-400">
              {formatNumber(d.forecast as number)} mcft
            </div>
            {d.forecastLower !== undefined && d.forecastUpper !== undefined && isForecastPoint && (
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {t("dash.range_label")} {formatNumber(d.forecastLower as number)} - {formatNumber(d.forecastUpper as number)}
              </div>
            )}
          </>
        )}
        {showInflow && d.inflow !== undefined && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#16a34a" }} />
            <span className="text-slate-600 dark:text-slate-400">{t("dash.in_label")}</span>
            <span className="font-semibold text-green-600 dark:text-green-400">
              {formatNumber(d.inflow as number)} {t("dash.cusecs_unit")}
            </span>
          </div>
        )}
        {showOutflow && d.outflow !== undefined && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#dc2626" }} />
            <span className="text-slate-600 dark:text-slate-400">{t("dash.out_label")}</span>
            <span className="font-semibold text-red-600 dark:text-red-400">
              {formatNumber(d.outflow as number)} {t("dash.cusecs_unit")}
            </span>
          </div>
        )}
        {/* Show comparison year values */}
        {payload
          .filter((p) => {
            const key = String(p.dataKey);
            return key !== "storage" && key !== "forecast" && key !== "forecastLower" && key !== "forecastUpper" && key !== "inflow" && key !== "outflow" && p.value !== undefined;
          })
          .map((p) => {
            const key = String(p.dataKey);
            const label = comparisonYears?.find((c) => `y${c.year}` === key)?.label || key;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-slate-600 dark:text-slate-400">{label}:</span>
                <span className="font-semibold">{formatNumber(p.value ?? 0)} mcft</span>
              </div>
            );
          })}
      </div>
    );
  };

  // Forecast chart elements  -  shared between AreaChart and LineChart
  const forecastElements = hasForecast ? (
    <>
      <defs>
        <linearGradient id="forecastBandGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.08} />
        </linearGradient>
      </defs>
      <Area
        yAxisId="left"
        type="monotone"
        dataKey="forecastUpper"
        stroke="none"
        fill="url(#forecastBandGradient)"
        connectNulls={false}
        legendType="none"
        tooltipType="none"
      />
      <Area
        yAxisId="left"
        type="monotone"
        dataKey="forecastLower"
        stroke="none"
        fill="var(--background)"
        fillOpacity={1}
        connectNulls={false}
        legendType="none"
        tooltipType="none"
      />
      <Line
        yAxisId="left"
        type="monotone"
        dataKey="forecast"
        stroke="#8b5cf6"
        strokeWidth={2}
        strokeDasharray="6 3"
        dot={false}
        name="forecast"
        connectNulls={false}
      />
    </>
  ) : null;

  // Inflow/outflow line elements  -  shared between AreaChart and LineChart
  const flowElements = (
    <>
      {showInflow && (
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="inflow"
          stroke="#16a34a"
          strokeWidth={1.5}
          dot={false}
          name={t("dash.inflow")}
          connectNulls={false}
        />
      )}
      {showOutflow && (
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="outflow"
          stroke="#dc2626"
          strokeWidth={1.5}
          dot={false}
          name={t("dash.outflow")}
          connectNulls={false}
        />
      )}
    </>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
            >
              <span>&#8592;</span> {t("dash.all_reservoirs")}
            </button>
          )}
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {resolvedTitle}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Flow toggle checkboxes */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={showInflow}
                onChange={(e) => setShowInflow(e.target.checked)}
                className="rounded border-slate-300 text-green-600 focus:ring-green-500 h-3.5 w-3.5"
              />
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <span className="w-3 h-0.5 bg-green-600 rounded inline-block" />
                {t("dash.inflow")}
              </span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={showOutflow}
                onChange={(e) => setShowOutflow(e.target.checked)}
                className="rounded border-slate-300 text-red-600 focus:ring-red-500 h-3.5 w-3.5"
              />
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <span className="w-3 h-0.5 bg-red-600 rounded inline-block" />
                {t("dash.outflow")}
              </span>
            </label>
          </div>
          {/* Time range tabs */}
          <div className="flex gap-1">
            {TAB_DAYS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveDays(tab.days)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeDays === tab.days
                    ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {tab.key === "all" ? t("dash.tab_all") : tab.key}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Year comparison selector */}
      {hasComparisons && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t("dash.compare_years")}</div>
          <div className="flex flex-wrap gap-1.5">
            {comparisonYears.map((cy) => {
              const isSelected = selectedYears.includes(cy.year);
              const color = YEAR_COLORS[cy.year] || "#6b7280";
              return (
                <button
                  key={cy.year}
                  onClick={() => toggleYear(cy.year)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all border ${
                    isSelected
                      ? "text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
                  }`}
                  style={
                    isSelected
                      ? { backgroundColor: color, borderColor: color }
                      : undefined
                  }
                >
                  {cy.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="h-64 sm:h-80">
        {filtered.length < 2 ? (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
            {t("dash.no_data_range")}
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          {selectedYears.length > 0 ? (
            // Multi-line chart when comparing years
            <LineChart data={chartData} margin={{ top: 5, right: showFlowLines ? 50 : 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                tickFormatter={formatTick}
                interval={xAxisInterval}
                angle={isMultiYear ? -45 : 0}
                textAnchor={isMultiYear ? "end" : "middle"}
                height={isMultiYear ? 40 : 30}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              {showFlowLines && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}`}
                  label={{ value: t("dash.cusecs_unit"), angle: 90, position: "insideRight", style: { fontSize: 10, fill: "#94a3b8" } }}
                />
              )}
              <Tooltip content={renderTooltip} />
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: "11px" }}
                formatter={(value: string) => {
                  if (value === "storage") return `${t("dash.current_year")} (${currentDisplayYear})`;
                  if (value === "forecast") return t("dash.forecast_label");
                  if (value === t("dash.inflow")) return t("dash.inflow_cusecs");
                  if (value === t("dash.outflow")) return t("dash.outflow_cusecs");
                  const year = parseInt(value.replace("y", ""));
                  return comparisonYears?.find((c) => c.year === year)?.label || value;
                }}
              />
              {capacity && (
                <ReferenceLine
                  yAxisId="left"
                  y={capacity}
                  stroke="#94a3b8"
                  strokeDasharray="6 4"
                  label={{ value: t("dash.capacity_ref"), position: "right", fontSize: 10, fill: "#94a3b8" }}
                />
              )}
              {/* Current year line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="storage"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={false}
                name="storage"
                connectNulls={false}
              />
              {/* Historical year lines */}
              {selectedYears.map((year) => (
                <Line
                  key={year}
                  yAxisId="left"
                  type="monotone"
                  dataKey={`y${year}`}
                  stroke={YEAR_COLORS[year] || "#6b7280"}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  name={`y${year}`}
                />
              ))}
              {/* Forecast overlay */}
              {forecastElements}
              {/* Inflow/outflow overlay */}
              {flowElements}
            </LineChart>
          ) : (
            // Original area chart when no comparisons
            <AreaChart data={chartData} margin={{ top: 5, right: showFlowLines ? 50 : 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="storageGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                tickFormatter={formatTick}
                interval={xAxisInterval}
                angle={isMultiYear ? -45 : 0}
                textAnchor={isMultiYear ? "end" : "middle"}
                height={isMultiYear ? 40 : 30}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              {showFlowLines && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}`}
                  label={{ value: t("dash.cusecs_unit"), angle: 90, position: "insideRight", style: { fontSize: 10, fill: "#94a3b8" } }}
                />
              )}
              <Tooltip content={renderTooltip} />
              {(hasForecast || showFlowLines) && (
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px" }}
                  formatter={(value: string) => {
                    if (value === "storage") return t("dash.actual_label");
                    if (value === "forecast") return t("dash.forecast_label");
                    if (value === t("dash.inflow")) return t("dash.inflow_cusecs");
                    if (value === t("dash.outflow")) return t("dash.outflow_cusecs");
                    return value;
                  }}
                />
              )}
              {capacity && (
                <ReferenceLine
                  yAxisId="left"
                  y={capacity}
                  stroke="#94a3b8"
                  strokeDasharray="6 4"
                  label={{ value: t("dash.capacity_ref"), position: "right", fontSize: 10, fill: "#94a3b8" }}
                />
              )}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="storage"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#storageGradient)"
                connectNulls={false}
                name="storage"
              />
              {/* Forecast overlay */}
              {forecastElements}
              {/* Inflow/outflow overlay */}
              {flowElements}
            </AreaChart>
          )}
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

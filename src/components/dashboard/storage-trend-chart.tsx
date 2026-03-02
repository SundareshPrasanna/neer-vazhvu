"use client";

import { useState, useMemo } from "react";
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
} from "recharts";
import { formatNumber } from "@/lib/utils/format";
import type { HistoricalYearData } from "@/lib/mock-data";

interface StorageTrendChartProps {
  history: Array<{ date: string; totalStorage: number }>;
  comparisonYears?: Array<{ year: number; label: string }>;
  getHistoricalData?: (year: number) => HistoricalYearData;
}

const TABS = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1yr", days: 365 },
  { label: "All", days: 0 },
];

const YEAR_COLORS: Record<number, string> = {
  2019: "#dc2626", // red — Day Zero
  2020: "#f59e0b", // amber
  2021: "#84cc16", // lime
  2022: "#06b6d4", // cyan
  2023: "#8b5cf6", // violet — flood year
  2024: "#ec4899", // pink
  2025: "#f97316", // orange
};

export function StorageTrendChart({
  history,
  comparisonYears,
  getHistoricalData,
}: StorageTrendChartProps) {
  const [activeDays, setActiveDays] = useState(90);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);

  const filtered =
    activeDays === 0 ? history : history.slice(-activeDays);

  // Build comparison data aligned by day-of-year
  const chartData = useMemo(() => {
    // Get the historical data for selected years
    const historicalSets = selectedYears
      .map((year) => getHistoricalData?.(year))
      .filter(Boolean) as HistoricalYearData[];

    return filtered.map((h, idx) => {
      const entry: Record<string, string | number> = {
        date: h.date,
        label: new Date(h.date + "T00:00:00").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        storage: h.totalStorage,
      };

      // For each comparison year, find the matching day-of-year
      const currentDate = new Date(h.date + "T00:00:00");
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

      return entry;
    });
  }, [filtered, selectedYears, getHistoricalData]);

  const toggleYear = (year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const hasComparisons = comparisonYears && comparisonYears.length > 0 && getHistoricalData;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Combined Storage Trend
        </h2>
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => setActiveDays(tab.days)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeDays === tab.days
                  ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Year comparison selector */}
      {hasComparisons && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Compare with past years:</div>
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
        <ResponsiveContainer width="100%" height="100%">
          {selectedYears.length > 0 ? (
            // Multi-line chart when comparing years
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 text-sm">
                      <div className="text-slate-500 dark:text-slate-400 mb-1">{d.date}</div>
                      {payload.map((p: { dataKey?: string | number; value?: number; color?: string }) => {
                        const key = String(p.dataKey);
                        const label =
                          key === "storage"
                            ? "Current"
                            : comparisonYears?.find(
                                (c) => `y${c.year}` === key
                              )?.label || key;
                        return (
                          <div
                            key={key}
                            className="flex items-center gap-2"
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: p.color }}
                            />
                            <span className="text-slate-600 dark:text-slate-400">{label}:</span>
                            <span className="font-semibold">
                              {formatNumber(p.value ?? 0)} mcft
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: "11px" }}
                formatter={(value: string) => {
                  if (value === "storage") return "Current (2026)";
                  const year = parseInt(value.replace("y", ""));
                  return comparisonYears?.find((c) => c.year === year)?.label || value;
                }}
              />
              {/* Current year line */}
              <Line
                type="monotone"
                dataKey="storage"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={false}
                name="storage"
              />
              {/* Historical year lines */}
              {selectedYears.map((year) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={`y${year}`}
                  stroke={YEAR_COLORS[year] || "#6b7280"}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  name={`y${year}`}
                />
              ))}
            </LineChart>
          ) : (
            // Original area chart when no comparisons
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="storageGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 text-sm">
                      <div className="text-slate-500 dark:text-slate-400">{d.date}</div>
                      <div className="font-semibold text-blue-700">
                        {formatNumber(d.storage)} mcft
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="storage"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#storageGradient)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

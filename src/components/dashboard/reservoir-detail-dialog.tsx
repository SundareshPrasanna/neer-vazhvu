"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatNumber, formatPct } from "@/lib/utils/format";
import type { ReservoirSummary } from "@/types/reservoir";
import type { ReservoirDailyRecord } from "@/lib/mock-data";

interface ReservoirDetailDialogProps {
  reservoir: ReservoirSummary | null;
  history: ReservoirDailyRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TABS = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1yr", days: 365 },
];

function getBarColor(pct: number): string {
  if (pct > 60) return "bg-green-500";
  if (pct > 30) return "bg-yellow-500";
  if (pct > 15) return "bg-orange-500";
  return "bg-red-500";
}

export function ReservoirDetailDialog({
  reservoir,
  history,
  open,
  onOpenChange,
}: ReservoirDetailDialogProps) {
  const [activeDays, setActiveDays] = useState(90);

  if (!reservoir) return null;

  const filtered = history.slice(-activeDays);

  const storageData = filtered.map((r) => ({
    date: r.date,
    label: new Date(r.date + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    }),
    storage: r.storage,
    capacity: reservoir.capacity,
  }));

  const flowData = filtered.map((r) => ({
    date: r.date,
    label: new Date(r.date + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    }),
    inflow: r.inflow,
    outflow: r.outflow,
  }));

  const rainfallData = filtered.map((r) => ({
    date: r.date,
    label: new Date(r.date + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    }),
    rainfall: r.rainfall,
  }));

  const storagePct = reservoir.capacity > 0
    ? (reservoir.currentStorage / reservoir.capacity) * 100
    : 0;

  // Stats from history
  const recentHistory = history.slice(-30);
  const avgInflow30d = Math.round(
    recentHistory.reduce((s, r) => s + r.inflow, 0) / recentHistory.length
  );
  const avgOutflow30d = Math.round(
    recentHistory.reduce((s, r) => s + r.outflow, 0) / recentHistory.length
  );
  const totalRainfall30d = parseFloat(
    recentHistory.reduce((s, r) => s + r.rainfall, 0).toFixed(1)
  );
  const minStorage = Math.min(...history.map((r) => r.storage));
  const maxStorage = Math.max(...history.map((r) => r.storage));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{reservoir.displayName}</DialogTitle>
        </DialogHeader>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">Current Storage</div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
              {formatNumber(reservoir.currentStorage)} mcft
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {formatPct(storagePct)} of capacity
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">Full Capacity</div>
            <div className="text-lg font-bold text-slate-700 dark:text-slate-300">
              {formatNumber(reservoir.capacity)} mcft
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">Avg Inflow (30d)</div>
            <div className="text-lg font-bold text-green-700 dark:text-green-400">
              {formatNumber(avgInflow30d)} cusecs
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">Avg Outflow (30d)</div>
            <div className="text-lg font-bold text-red-700 dark:text-red-400">
              {formatNumber(avgOutflow30d)} cusecs
            </div>
          </div>
        </div>

        {/* Quick facts row */}
        <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
          <span>
            Year range: {formatNumber(minStorage)}–{formatNumber(maxStorage)} mcft
          </span>
          <span>Rainfall (30d): {totalRainfall30d} mm</span>
        </div>

        {/* Storage bar */}
        <div className="mt-1">
          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getBarColor(storagePct)}`}
              style={{ width: `${Math.min(storagePct, 100)}%` }}
            />
          </div>
        </div>

        {/* Time range tabs */}
        <div className="flex gap-1 mt-4">
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

        {/* Storage chart */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Storage Level
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={storageData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="resStorageGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    const pct = d.capacity > 0 ? ((d.storage / d.capacity) * 100).toFixed(1) : "0";
                    return (
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 text-xs">
                        <div className="text-slate-500">{d.date}</div>
                        <div className="font-semibold text-blue-700">
                          {formatNumber(d.storage)} mcft ({pct}%)
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
                  fill="url(#resStorageGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inflow vs Outflow chart */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Inflow vs Outflow
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={flowData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 text-xs">
                        <div className="text-slate-500">{d.date}</div>
                        <div className="text-green-600">Inflow: {formatNumber(d.inflow)} cusecs</div>
                        <div className="text-red-600">Outflow: {formatNumber(d.outflow)} cusecs</div>
                      </div>
                    );
                  }}
                />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px" }}
                />
                <Line
                  type="monotone"
                  dataKey="inflow"
                  stroke="#16a34a"
                  strokeWidth={1.5}
                  dot={false}
                  name="Inflow"
                />
                <Line
                  type="monotone"
                  dataKey="outflow"
                  stroke="#dc2626"
                  strokeWidth={1.5}
                  dot={false}
                  name="Outflow"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rainfall chart */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Rainfall
          </h3>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rainfallData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="rainfallGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}mm`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 text-xs">
                        <div className="text-slate-500">{d.date}</div>
                        <div className="font-semibold text-cyan-600">{d.rainfall} mm</div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rainfall"
                  stroke="#06b6d4"
                  strokeWidth={1.5}
                  fill="url(#rainfallGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          <p>All data in demo mode is simulated. Connect Supabase for real CMWSSB data.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

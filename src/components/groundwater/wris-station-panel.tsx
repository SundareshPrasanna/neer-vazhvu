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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getGroundwaterColor } from "@/types/groundwater";
import type {
  WrisStation,
  WrisStationHistoryResponse,
  WrisStationReading,
  WrisDataQualityFlag,
} from "@/types/groundwater";
import { useLanguage } from "@/lib/i18n/context";

interface WrisStationPanelProps {
  station: WrisStation;
  onClose: () => void;
}

function formatDaysAgo(dateStr: string, t: (k: string, params?: Record<string, string | number>) => string): string {
  const reading = new Date(dateStr);
  const now = new Date();
  const ms = now.getTime() - reading.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return t("wris.today");
  if (days === 1) return t("wris.yesterday");
  return t("wris.days_ago").replace("{n}", String(days));
}

export function WrisStationPanel({ station, onClose }: WrisStationPanelProps) {
  const { t, language } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  const locale = language === "ta" ? "ta-IN" : language === "kn" ? "kn-IN" : "en-IN";

  const [readings, setReadings] = useState<WrisStationReading[]>([]);
  const [serverMeta, setServerMeta] = useState<WrisStationHistoryResponse["station"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);

    fetch(
      `/api/groundwater/stations?station=${encodeURIComponent(station.stationCode)}&days=730`,
      { signal: controller.signal }
    )
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d: WrisStationHistoryResponse) => {
        setReadings(d.readings || []);
        setServerMeta(d.station ?? null);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [station.stationCode]);

  // The list payload (`station`) and the detail payload (`serverMeta`) share
  // most fields, but only the detail payload has well metadata + quality flag
  // in older list responses. Prefer serverMeta when available.
  const wellType = serverMeta?.wellType ?? station.wellType ?? null;
  const wellDepthM = serverMeta?.wellDepthM ?? station.wellDepthM ?? null;
  const wellAquiferType = serverMeta?.wellAquiferType ?? station.wellAquiferType ?? null;
  const qualityFlag: WrisDataQualityFlag | null =
    serverMeta?.dataQualityFlag ?? station.dataQualityFlag ?? null;
  const recentCount = serverMeta?.recentCount ?? station.recentCount ?? null;
  const recentRangeM = serverMeta?.recentRangeM ?? station.recentRangeM ?? null;
  const hasWellInfo = !!(wellType || wellDepthM || wellAquiferType);

  // Display absolute depth (negative WRIS values mean below ground)
  const depthBelowGround = Math.abs(station.latestDepthM);
  const color = getGroundwaterColor(depthBelowGround);
  const modeLabel =
    station.acquisitionMode === "Telemetric"
      ? t("wris.mode_telemetric")
      : t("wris.mode_manual");

  // Transform readings for chart: store positive depth-below-ground
  const chartData = readings.map((r) => ({
    date: r.date,
    depthM: Math.abs(r.depthM),
  }));

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: readonly any[] }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as { date: string; depthM: number };
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 text-xs">
        <div className="text-slate-500 dark:text-slate-400">
          {new Date(d.date).toLocaleDateString(locale, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </div>
        <div className="font-semibold text-sky-600 dark:text-sky-400">
          {d.depthM.toFixed(2)}m {t("wris.depth_below_ground")}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 w-full h-full p-4 sm:p-6 overflow-y-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {t("wris.station")}
          </div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 leading-tight">
            {station.stationName}
          </h3>
          <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">
            {station.stationCode}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
          aria-label={t("common.close_panel")}
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mb-6">
        <div className="text-4xl font-bold" style={{ color }}>
          {depthBelowGround.toFixed(2)}m
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("wris.latest_reading")} - {t("wris.depth_below_ground")}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          {new Date(station.latestDate).toLocaleDateString(locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          {" - "}
          {formatDaysAgo(station.latestDate, t)}
        </div>
        <Badge className="mt-2" variant="secondary">
          {modeLabel}
        </Badge>
      </div>

      {qualityFlag === "stuck" && (
        <div className="mb-4 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              <div className="font-semibold mb-0.5">
                {t("wris.quality_stuck_title")}
              </div>
              <div>
                {t("wris.quality_stuck_msg")
                  .replace(
                    "{range}",
                    recentRangeM != null ? recentRangeM.toFixed(2) : "0.00",
                  )
                  .replace("{count}", String(recentCount ?? 60))}
              </div>
            </div>
          </div>
        </div>
      )}

      {qualityFlag === "stale" && (
        <div className="mb-4 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-3">
          <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <div className="font-semibold mb-0.5">
              {t("wris.quality_stale_title")}
            </div>
            <div>
              {station.acquisitionMode === "Telemetric"
                ? t("wris.quality_stale_telem")
                : t("wris.quality_stale_manual")}
            </div>
          </div>
        </div>
      )}

      {hasWellInfo && (
        <div className="mb-6 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
            {t("wris.well_info_title")}
          </div>
          <dl className="grid grid-cols-3 gap-2 text-xs">
            {wellType && (
              <>
                <dt className="col-span-1 text-slate-500 dark:text-slate-400">
                  {t("wris.well_type")}
                </dt>
                <dd className="col-span-2 text-slate-700 dark:text-slate-200 font-medium">
                  {wellType}
                </dd>
              </>
            )}
            {wellDepthM != null && (
              <>
                <dt className="col-span-1 text-slate-500 dark:text-slate-400">
                  {t("wris.well_depth")}
                </dt>
                <dd className="col-span-2 text-slate-700 dark:text-slate-200 font-medium">
                  {wellDepthM}m
                </dd>
              </>
            )}
            {wellAquiferType && (
              <>
                <dt className="col-span-1 text-slate-500 dark:text-slate-400">
                  {t("wris.aquifer")}
                </dt>
                <dd className="col-span-2 text-slate-700 dark:text-slate-200 font-medium">
                  {wellAquiferType}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}

      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
          {t("wris.history_title")}
        </h4>
        {loading ? (
          <Skeleton className="h-44 w-full rounded-lg" />
        ) : error ? (
          <div className="h-44 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
            {t("wris.history_error")}
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
            {t("wris.history_none")}
          </div>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: isDark ? "#94a3b8" : "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                  tickFormatter={(d: string) =>
                    new Date(d).toLocaleDateString(locale, { month: "short", year: "2-digit" })
                  }
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
        )}
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 text-center">
          {t("ward.history_yaxis_note")}
        </p>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        {t("wris.source_note")}
      </p>
    </div>
  );
}

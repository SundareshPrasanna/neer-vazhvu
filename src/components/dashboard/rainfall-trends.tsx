"use client";

import { useEffect, useState, useMemo } from "react";
import { useTheme } from "next-themes";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/context";

interface IMDRainfallData {
  source: string;
  grid_point: { lat: number; lon: number };
  year_range: [number, number];
  normal_period: [number, number];
  monthly: { year: number; month: number; rainfall_mm: number }[];
  annual_totals: { year: number; total_mm: number }[];
  normals: {
    annual_mean_mm: number;
    monthly_mean_mm: number[];
  };
}

const MONTH_LABELS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LABELS_TA = ["ஜன", "பிப்", "மார்", "ஏப்", "மே", "ஜூன்", "ஜூலை", "ஆக", "செப்", "அக்", "நவ", "டிச"];
// Years with annual rainfall below 80% of long-term mean are auto-colored amber.
// DAY_ZERO_YEAR is highlighted red — the crisis was caused by cumulative deficit (2016-2018).
const DAY_ZERO_YEAR = 2019;

function getBarColor(total: number, mean: number, year: number, dayZeroCity: boolean): string {
  if (dayZeroCity && year === DAY_ZERO_YEAR) return "#dc2626"; // red — Chennai's Day Zero
  if (total < mean * 0.8) return "#f97316"; // orange — below 80% of normal
  if (total > mean * 1.2) return "#3b82f6"; // blue — above 120% of normal
  return "#10b981"; // green — normal range
}

interface RainfallTrendsProps {
  /** City id for the data file lookup. Defaults to Chennai for back-compat. */
  cityId?: string;
  /** City display name shown in the chart title; falls back to a
   *  capitalised cityId. Pass it explicitly so the title matches the
   *  rest of the page header. */
  cityDisplayName?: string;
}

/** Cities for which we colour the 2019 bar red as "Day Zero". Other
 *  cities get the same regular below-/above-normal colouring rules
 *  applied to 2019 like any other year - they didn't have a Chennai-
 *  style Day Zero event so we don't manufacture one visually. */
const DAY_ZERO_CITIES = new Set(["chennai"]);

export function RainfallTrends({
  cityId = "chennai",
  cityDisplayName,
}: RainfallTrendsProps = {}) {
  const { t, language } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  const [data, setData] = useState<IMDRainfallData | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    // Reset on cityId change so a stale Chennai dataset doesn't
    // briefly render under Madurai's chart heading. Intentional;
    // the lint rule warns against the pattern but the alternatives
    // (key prop remount, derived state) read worse here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMissing(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    // Chennai's file lives at the legacy path; new cities use a
    // suffixed path so the generator can produce them side by side.
    const url =
      cityId === "chennai"
        ? "/data/imd-rainfall-monthly.json"
        : `/data/imd-rainfall-monthly-${cityId}.json`;
    fetch(url)
      .then((r) => {
        if (!r.ok) {
          setMissing(true);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => setMissing(true));
  }, [cityId]);

  const monthLabels = language === "ta" ? MONTH_LABELS_TA : MONTH_LABELS_EN;
  const currentYear = new Date().getFullYear();

  const currentMonth = new Date().getMonth() + 1; // 1-indexed

  // Current year monthly vs normal (only show months up to current month)
  const { monthlyComparison, comparisonYear } = useMemo(() => {
    if (!data) return { monthlyComparison: [], comparisonYear: currentYear };
    const currentYearData = data.monthly.filter((m) => m.year === currentYear);
    const hasCurrentYear = currentYearData.length > 0;
    const yearToUse = hasCurrentYear ? currentYear : data.year_range[1];
    const yearData = hasCurrentYear
      ? currentYearData
      : data.monthly.filter((m) => m.year === yearToUse);

    // Only show months up to the current month for the display year
    const maxMonth = yearToUse === currentYear ? currentMonth : 12;

    const comparison = data.normals.monthly_mean_mm
      .slice(0, maxMonth)
      .map((normal, i) => ({
        month: monthLabels[i],
        normal: Math.round(normal),
        actual: yearData.find((m) => m.month === i + 1)?.rainfall_mm ?? 0,
      }));

    return { monthlyComparison: comparison, comparisonYear: yearToUse };
  }, [data, currentYear, currentMonth, monthLabels]);

  if (!data) {
    if (missing) {
      // Honest empty state when this city's IMD rainfall file hasn't
      // been generated yet. Shown to readers; suppressed entirely on
      // Chennai because the legacy path always exists.
      if (cityId === "chennai") return null;
      return (
        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="p-6 space-y-2">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Long-term rainfall (IMD)
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Long-term IMD rainfall hasn&apos;t been generated for this city
              yet. The chart lights up automatically once the data file is
              available.
            </p>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  const mean = data.normals.annual_mean_mm;

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("rain.title").replace(
              "{city}",
              cityDisplayName ?? cityId.charAt(0).toUpperCase() + cityId.slice(1),
            )}
          </h2>
        </div>

        {/* Annual rainfall bar chart */}
        <div className="mb-6">
          <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0">
            {t("rain.annual_title")} ({data.year_range[0]}-{data.year_range[1]})
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
            {t("rain.normal_line")}: {mean} {t("rain.mm")}
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.annual_totals} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="year"
                tick={{ fontSize: 10 }}
                tickFormatter={(y: number) => (y % 10 === 0 ? String(y) : "")}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                width={35}
                tickFormatter={(v: number) => `${v}`}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`${value} ${t("rain.mm")}`, t("rain.total")]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(year: any) => {
                  const y = Number(year);
                  if (DAY_ZERO_CITIES.has(cityId) && y === DAY_ZERO_YEAR) {
                    return `${y} (${t("rain.day_zero")})`;
                  }
                  return String(y);
                }}
                contentStyle={{
                  fontSize: "12px",
                  backgroundColor: isDark ? "rgba(30,41,59,0.95)" : "rgba(255,255,255,0.95)",
                  border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                  borderRadius: "6px",
                  color: isDark ? "#e2e8f0" : "#1e293b",
                }}
                itemStyle={{ color: isDark ? "#e2e8f0" : "#1e293b" }}
                labelStyle={{ color: isDark ? "#f1f5f9" : "#0f172a" }}
              />
              <ReferenceLine
                y={mean}
                stroke="#64748b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
              <Bar dataKey="total_mm" radius={[2, 2, 0, 0]} maxBarSize={12}>
                {data.annual_totals.map((entry) => (
                  <Cell
                    key={entry.year}
                    fill={getBarColor(entry.total_mm, mean, entry.year, DAY_ZERO_CITIES.has(cityId))}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
            {DAY_ZERO_CITIES.has(cityId) && (
              <span><span className="inline-block w-2 h-2 rounded-sm bg-red-600 mr-1" />{t("rain.day_zero")} (2019)</span>
            )}
            <span><span className="inline-block w-2 h-2 rounded-sm bg-orange-500 mr-1" />{"<"} 80%</span>
            <span><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 mr-1" />{t("rain.normal")}</span>
            <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-500 mr-1" />{">"} 120%</span>
          </div>

          {/* City-specific contextual note. Falls back to the Chennai
              note (`rain.context_note_chennai`) only when no city-specific
              key has been authored, so a typo'd cityId stays safe and
              cities without a note render nothing. */}
          {(() => {
            const noteKey = `rain.context_note_${cityId}`;
            const note = t(noteKey);
            // useLanguage().t returns the key itself when missing; treat
            // that as "no note for this city".
            return note && note !== noteKey ? (
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 italic">
                {note}
              </p>
            ) : null;
          })()}
        </div>

        {/* Monthly comparison: current year vs normal */}
        <div>
          <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            {t("rain.monthly_title")} - {comparisonYear}
          </h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={monthlyComparison} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={35} tickFormatter={(v: number) => `${v}`} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [
                  `${value} ${t("rain.mm")}`,
                  name === "normal" ? t("rain.normal") : String(comparisonYear),
                ]}
                contentStyle={{
                  fontSize: "12px",
                  backgroundColor: isDark ? "rgba(30,41,59,0.95)" : "rgba(255,255,255,0.95)",
                  border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                  borderRadius: "6px",
                  color: isDark ? "#e2e8f0" : "#1e293b",
                }}
                itemStyle={{ color: isDark ? "#e2e8f0" : "#1e293b" }}
                labelStyle={{ color: isDark ? "#f1f5f9" : "#0f172a" }}
              />
              <Bar dataKey="normal" fill="#94a3b8" radius={[2, 2, 0, 0]} maxBarSize={16} name="normal" />
              <Bar dataKey="actual" fill="#3b82f6" radius={[2, 2, 0, 0]} maxBarSize={16} name="actual" />
            </BarChart>
          </ResponsiveContainer>

          <div className="flex gap-x-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span><span className="inline-block w-2 h-2 rounded-sm bg-slate-400 mr-1" />{t("rain.normal")}</span>
            <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-500 mr-1" />{comparisonYear}</span>
          </div>
        </div>

        {/* Source */}
        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
          {t("rain.source_note")}
        </p>
      </CardContent>
    </Card>
  );
}

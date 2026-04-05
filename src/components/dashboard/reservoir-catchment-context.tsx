"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/context";
import { getReservoirDisplayName } from "@/lib/i18n/reservoir-name";
import {
  summarizeReservoirCatchmentContext,
  type RainfallContextLevel,
  type ReservoirCatchmentContextRow,
} from "@/lib/gee/reservoir-context";
import { formatDate, interpolate } from "@/lib/utils/format";

interface ReservoirCatchmentContextProps {
  rows: ReservoirCatchmentContextRow[];
}

function badgeClasses(level: RainfallContextLevel): string {
  switch (level) {
    case "well_below":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900";
    case "below":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900";
    case "above":
      return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900";
    case "well_above":
      return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:border-cyan-900";
    case "near_normal":
    default:
      return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700";
  }
}

function formatSignedPercent(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) return null;
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function ReservoirCatchmentContext({ rows }: ReservoirCatchmentContextProps) {
  const summary = summarizeReservoirCatchmentContext(rows);
  const { t } = useLanguage();

  if (!summary) return null;

  const headline = interpolate(
    t(`dash.catchment_headline_${summary.headline}`),
    {
      count:
        summary.headline === "below"
          ? summary.belowCount
          : summary.headline === "above"
            ? summary.aboveCount
            : summary.nearNormalCount,
      total: summary.monitoredCount,
      windowDays: summary.windowDays,
    },
  );

  const detail = summary.standout
    ? interpolate(
        t(
          summary.standout.anomalyPct !== null && summary.standout.anomalyPct > 0
            ? "dash.catchment_detail_above"
            : "dash.catchment_detail_below",
        ),
        {
          reservoir: getReservoirDisplayName(summary.standout.reservoir, t),
          anomalyPct: Math.abs(Math.round(summary.standout.anomalyPct ?? 0)),
          windowDays: summary.windowDays,
        },
      )
    : t("dash.catchment_detail_near_normal");

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-6">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          {t("dash.catchment_title")}
        </h2>

        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <span className="font-semibold">{headline}</span>{" "}
          <span className="text-slate-600 dark:text-slate-400">{detail}</span>
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
          {summary.rows.map((row) => {
            const signedPct = formatSignedPercent(row.anomalyPct);
            return (
              <div
                key={row.reservoir}
                className={`rounded-lg border px-3 py-2 ${badgeClasses(row.contextLevel)}`}
              >
                <div className="text-xs font-semibold truncate">
                  {getReservoirDisplayName(row.reservoir, t)}
                </div>
                <div className="text-[11px] mt-1 flex items-center justify-between gap-2">
                  <span>{t(`dash.catchment_label_${row.contextLevel}`)}</span>
                  {signedPct ? <span className="font-mono">{signedPct}</span> : null}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
          {interpolate(t("dash.catchment_updated"), {
            date: formatDate(summary.contextDate),
            windowDays: summary.windowDays,
          })}
        </p>
      </CardContent>
    </Card>
  );
}

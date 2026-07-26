"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/lib/i18n/context";
import type { DrainageCapacityConfig } from "@/lib/cities/types";

/**
 * "Drainage-capacity" hero for the city dashboard.
 *
 * Every other hero on the platform answers "how much water is left". For some
 * cities that question has no answer: Kolkata has NO impounded storage - supply
 * is run-of-river Hooghly abstraction plus tube wells - so the days-left runway
 * is not merely awkward there, it is undefined. There is no volume to run down.
 *
 * What Kolkata does have is a published engineering promise the sky routinely
 * breaks. KMC's own Sewerage and Drainage document states the main sewer network
 * "was designed to discharge a rainfall of 6 mm. per hour". That is a live,
 * falsifiable figure with a divisor the reader can move, which is the shape a
 * hero on this platform has to have.
 *
 * So this hero asks: how often does the rain beat the drains?
 *
 * Reads `rainfall-intensity-{cityId}.json` (built by
 * neer-vazhvu-api/scripts/fetch_rainfall_intensity.py), which precomputes an
 * exceedance ladder - hours and distinct days above each candidate threshold,
 * per year - so the threshold slider moves without refetching or recomputing
 * ~230k hourly values in the browser.
 *
 * HONESTY CONTRACT, load-bearing, do not quietly drop:
 *  1. The rainfall is ERA5-family reanalysis, which smooths short convective
 *     bursts. Every count is a LOWER BOUND on true exceedance. The hero says so
 *     on its face, not in a tooltip.
 *  2. The design standard is quoted from a document, not measured, and it is
 *     config (`drainageCapacity.standardMmPerHour`) with a citation rendered
 *     beside it - so a reader can go check it and a rehabilitated stretch with
 *     a different rating is a config edit, not a code change.
 *  3. Part-years are excluded from the year picker's "complete" set, because an
 *     unfinished year reads as a fall in exceedance when it is just unfinished.
 */

interface ExceedanceRow {
  threshold_mm_per_hour: number;
  year: number;
  hours: number;
  days: number;
}

interface IntensityData {
  grid_point?: { latitude?: number; longitude?: number; elevation_m?: number };
  coverage: { from: string; to: string; hours: number; complete_years: number[] };
  limitation: string;
  thresholds_mm_per_hour: number[];
  exceedance: ExceedanceRow[];
  wettest_hours: { hour: string; mm: number }[];
  attribution?: string;
}

function intensityColour(hours: number): string {
  if (hours >= 60) return "text-red-600 dark:text-red-400";
  if (hours >= 35) return "text-orange-500 dark:text-orange-400";
  if (hours >= 15) return "text-amber-500 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

function formatHour(iso: string): string {
  // "2017-07-22T23:00" -> "22 Jul 2017, 23:00"
  const [d, t] = iso.split("T");
  const [y, m, day] = d.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(day)} ${months[Number(m) - 1]} ${y}, ${t}`;
}

export function DrainageCapacityHero({
  cityId,
  cityDisplayName,
  config,
  scopeLabel,
}: {
  cityId: string;
  cityDisplayName: string;
  config: DrainageCapacityConfig;
  scopeLabel?: string;
}) {
  const { t } = useLanguage();
  const [data, setData] = useState<IntensityData | null>(null);
  const [failed, setFailed] = useState(false);
  const [threshold, setThreshold] = useState(config.standardMmPerHour);
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/data/rainfall-intensity-${cityId}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: IntensityData) => {
        if (!live) return;
        setData(d);
        const complete = d.coverage?.complete_years ?? [];
        setYear(complete.length ? complete[complete.length - 1] : null);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [cityId]);

  const completeYears = useMemo(
    () => data?.coverage?.complete_years ?? [],
    [data],
  );

  const selected = useMemo(() => {
    if (!data || year === null) return null;
    return (
      data.exceedance.find(
        (r) => r.threshold_mm_per_hour === threshold && r.year === year,
      ) ?? null
    );
  }, [data, threshold, year]);

  // Long-run context for the selected threshold. Without it a reader cannot
  // tell whether the headline year was normal or exceptional.
  const longRun = useMemo(() => {
    if (!data || !completeYears.length) return null;
    const rows = data.exceedance.filter(
      (r) => r.threshold_mm_per_hour === threshold && completeYears.includes(r.year),
    );
    if (!rows.length) return null;
    const mean = rows.reduce((s, r) => s + r.hours, 0) / rows.length;
    const half = Math.floor(rows.length / 2);
    const early = rows.slice(0, half);
    const late = rows.slice(rows.length - half);
    const earlyMean = early.reduce((s, r) => s + r.hours, 0) / (early.length || 1);
    const lateMean = late.reduce((s, r) => s + r.hours, 0) / (late.length || 1);
    return {
      mean,
      years: rows.length,
      firstYear: rows[0].year,
      lastYear: rows[rows.length - 1].year,
      earlyMean,
      lateMean,
      earlySpan: early.length ? `${early[0].year}-${early[early.length - 1].year}` : "",
      lateSpan: late.length ? `${late[0].year}-${late[late.length - 1].year}` : "",
    };
  }, [data, threshold, completeYears]);

  const wettest = data?.wettest_hours?.[0];
  const ladder = data?.thresholds_mm_per_hour ?? [config.standardMmPerHour];
  const thresholdIndex = Math.max(0, ladder.indexOf(threshold));

  if (failed) return null;
  if (!data || !selected) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-sky-50 dark:from-slate-900 dark:to-slate-800">
        <CardContent className="p-6 sm:p-8">
          <div className="h-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </CardContent>
      </Card>
    );
  }

  const atStandard = threshold === config.standardMmPerHour;
  const src = config.standardSource;

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-sky-50 dark:from-slate-900 dark:to-slate-800">
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t("hero.drain_title")}
            </h2>
            {scopeLabel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap">
                {scopeLabel}
              </span>
            )}
          </div>
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {data.coverage.from.slice(0, 4)}-{data.coverage.to.slice(0, 4)}
          </Badge>
        </div>

        {/* The promise */}
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
          {t("hero.drain_built_for").replace("{city}", cityDisplayName)}
        </p>
        <div className="flex items-baseline gap-2 mb-6">
          <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">
            {config.standardMmPerHour} mm
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t("hero.drain_per_hour")}
          </span>
        </div>

        {/* The headline: how often the sky beat it */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
          <div className="sm:col-span-2">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              {atStandard
                ? t("hero.drain_beaten_for")
                : t("hero.drain_beaten_for_alt").replace("{mm}", String(threshold))}
            </p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className={`text-5xl sm:text-6xl font-bold ${intensityColour(selected.hours)}`}>
                {selected.hours}
              </span>
              <span className="text-lg text-slate-600 dark:text-slate-300">
                {selected.hours === 1 ? t("hero.drain_hour_unit") : t("hero.drain_hours_unit")}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t("hero.drain_in_year").replace("{year}", String(year))}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {t("hero.drain_across_days")
                .replace("{days}", String(selected.days))
                .replace("{unit}", selected.days === 1 ? t("hero.drain_day_unit") : t("hero.drain_days_unit"))}
            </p>
          </div>

          {longRun && (
            <div className="text-sm space-y-2 border-l-0 sm:border-l sm:pl-6 border-slate-200 dark:border-slate-700">
              <div className="flex justify-between gap-3">
                <span className="text-slate-600 dark:text-slate-400">
                  {t("hero.drain_longrun")}
                </span>
                <span className="font-semibold whitespace-nowrap">
                  {longRun.mean.toFixed(0)} {t("hero.drain_hours_short")}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("hero.drain_longrun_span")
                  .replace("{from}", String(longRun.firstYear))
                  .replace("{to}", String(longRun.lastYear))}
              </p>
              {longRun.earlyMean > 0 && (
                <p className="text-xs text-slate-600 dark:text-slate-400 pt-1">
                  {t("hero.drain_halves")
                    .replace("{earlySpan}", longRun.earlySpan)
                    .replace("{early}", longRun.earlyMean.toFixed(0))
                    .replace("{lateSpan}", longRun.lateSpan)
                    .replace("{late}", longRun.lateMean.toFixed(0))}
                </p>
              )}
            </div>
          )}
        </div>

        {/* The movable divisor */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-5">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <label className="text-slate-600 dark:text-slate-400">
                {t("hero.drain_threshold_label")}
              </label>
              <span className="font-semibold">
                {threshold} mm/h
                {atStandard && (
                  <span className="ml-2 text-xs font-normal text-sky-600 dark:text-sky-400">
                    {t("hero.drain_is_standard")}
                  </span>
                )}
              </span>
            </div>
            <Slider
              value={[thresholdIndex]}
              min={0}
              max={ladder.length - 1}
              step={1}
              onValueChange={([i]) => setThreshold(ladder[i])}
              aria-label={t("hero.drain_threshold_label")}
            />
            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              <span>{ladder[0]} mm/h</span>
              <span>{ladder[ladder.length - 1]} mm/h</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <label className="text-slate-600 dark:text-slate-400">
                {t("hero.drain_year_label")}
              </label>
              <span className="font-semibold">{year}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {completeYears.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    y === year
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Worst hour on record */}
        {wettest && (
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-baseline gap-3 text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              {t("hero.drain_worst_hour")}
            </span>
            <span className="text-right">
              <span className="font-semibold">{wettest.mm} mm</span>
              <span className="text-slate-500 dark:text-slate-400">
                {" "}
                &middot; {formatHour(wettest.hour)}
              </span>
              <span className="block text-xs text-red-600 dark:text-red-400">
                {t("hero.drain_times_over").replace(
                  "{x}",
                  (wettest.mm / config.standardMmPerHour).toFixed(1),
                )}
              </span>
            </span>
          </div>
        )}

        {/* Provenance + the two caveats, on the face of the hero */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
          {config.networkNote && (
            <p className="text-xs text-slate-600 dark:text-slate-400">{config.networkNote}</p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("hero.drain_standard_from")}{" "}
            {src.url ? (
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 dark:text-sky-400 hover:underline"
              >
                {src.publisher}, {src.document} ({src.year})
              </a>
            ) : (
              <span>
                {src.publisher}, {src.document} ({src.year})
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
            {t("hero.drain_reanalysis_caveat")}
          </p>
          {config.registerLink && (
            <p className="text-xs">
              <a
                href={config.registerLink.href}
                className="text-sky-600 dark:text-sky-400 hover:underline"
              >
                {config.registerLink.label} &rarr;
              </a>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

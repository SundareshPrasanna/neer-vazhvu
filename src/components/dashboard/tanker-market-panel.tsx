"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils/format";

/**
 * Tanker-market longitudinal panel for the city dashboard.
 *
 * Built for Bangalore using the OpenCity Bengaluru Tanker Water Surveys
 * (2015, 2019, 2024). Renders three sets of numbers:
 *
 *   1. Price evolution across 3 surveys (per load + 6000L-equivalent)
 *   2. 2024 crisis-era snapshot (% on tankers / dry days / YoY delta)
 *   3. The "BWSSB supply degraded" finding (90% reported worse YoY)
 *
 * The 2025 follow-up is context (improved post-Stage-V + post-El-Nino)
 * but isn't a structured CSV from the source - we surface it as a
 * narrative footnote.
 *
 * Source data: public/data/<cityId>-tanker-survey.json (built by
 * scripts/build-bangalore-tanker-summary.py from the 3 OpenCity CSVs).
 */

interface YearSummary {
  year: number;
  respondents_n: number;
  tanker_price_inr_per_load_median: number | null;
  tanker_capacity_litres_median: number | null;
  tanker_price_inr_per_6000l_median: number | null;
  dry_days_median: number | null;
  private_tanker_source_pct: number | null;
  bwssb_source_pct: number | null;
  // 2024 only
  more_often_pct?: number | null;
  bwssb_no_change_pct?: number | null;
  tanker_price_yoy_delta_inr_median?: number | null;
}

interface SurveyData {
  _source: { name: string; url: string };
  _2025_context: { summary: string; source_url: string };
  by_year: YearSummary[];
}

interface Props {
  cityId: string;
  cityDisplayName: string;
}

export function TankerMarketPanel({ cityId, cityDisplayName }: Props) {
  const [data, setData] = useState<SurveyData | null>(null);

  useEffect(() => {
    fetch(`/data/${cityId}-tanker-survey.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SurveyData>) : null))
      .then(setData)
      .catch(() => setData(null));
  }, [cityId]);

  if (!data) return null;

  const y2015 = data.by_year.find((y) => y.year === 2015);
  const y2019 = data.by_year.find((y) => y.year === 2019);
  const y2024 = data.by_year.find((y) => y.year === 2024);
  if (!y2024) return null;

  const priceGrowthSince2015 =
    y2015 && y2015.tanker_price_inr_per_load_median && y2024.tanker_price_inr_per_load_median
      ? Math.round(
          ((y2024.tanker_price_inr_per_load_median /
            y2015.tanker_price_inr_per_load_median) -
            1) *
            100,
        )
      : null;

  const bwssbWorsenedPct =
    y2024.bwssb_no_change_pct != null ? 100 - y2024.bwssb_no_change_pct : null;

  return (
    <Card className="border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50/40 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/20">
      <CardHeader>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
          {cityDisplayName}&apos;s tanker market - what households actually pay
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
          Longitudinal apartment-level surveys (2015, 2019, 2024) from
          OpenCity. The informal tanker market is uniquely large among
          Indian metros - what households substitute when BWSSB&apos;s 48%
          NRW gap meets their tap.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Price evolution row */}
        <div>
          <h3 className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            Median tanker price (per load)
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[y2015, y2019, y2024].map((y) =>
              y && y.tanker_price_inr_per_load_median ? (
                <div
                  key={y.year}
                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-3"
                >
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {y.year}
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      ₹{formatNumber(y.tanker_price_inr_per_load_median)}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      / load
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {y.tanker_capacity_litres_median
                      ? `~${formatNumber(y.tanker_capacity_litres_median)} L tanker; `
                      : ""}
                    n={y.respondents_n}
                  </p>
                </div>
              ) : null,
            )}
          </div>
          {priceGrowthSince2015 != null && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
              +{priceGrowthSince2015}% nominal price growth from 2015 to 2024.
            </p>
          )}
        </div>

        {/* 2024 crisis-era stats */}
        <div>
          <h3 className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            2024 snapshot - the pre-Stage-V crisis year
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {y2024.private_tanker_source_pct != null && (
              <BigStat
                value={`${y2024.private_tanker_source_pct}%`}
                label="of apartments rely on private tankers"
              />
            )}
            {y2024.more_often_pct != null && (
              <BigStat
                value={`${y2024.more_often_pct}%`}
                label="were ordering tankers more often than the previous quarter"
              />
            )}
            {bwssbWorsenedPct != null && (
              <BigStat
                value={`${bwssbWorsenedPct.toFixed(0)}%`}
                label="reported BWSSB supply got WORSE year-on-year"
                warn
              />
            )}
            {y2024.dry_days_median != null && (
              <BigStat
                value={`${y2024.dry_days_median}`}
                label="median dry days in the year (when tap simply didn't run)"
              />
            )}
          </div>
          {y2024.tanker_price_yoy_delta_inr_median != null && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
              Same households paid <span className="font-semibold tabular-nums">₹{formatNumber(y2024.tanker_price_yoy_delta_inr_median)}</span> more per tanker
              load in early 2024 than they did in Feb 2023 - a real-time
              private market price-jump captured the upstream Cauvery stress
              before piped-supply data could.
            </p>
          )}
        </div>

        {/* 2025 context narrative */}
        <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/20 p-3">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
            2025 follow-up: situation improved
          </p>
          <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
            {data._2025_context.summary}
          </p>
        </div>

        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
          Source:{" "}
          <a
            href={data._source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {data._source.name}
          </a>
          {" "}(CC BY-NC 2.0). Apartment-level survey of self-selected
          respondents; rates reflect the informal market, not the official
          BWSSB Kaveriwheels app rates.
        </p>
      </CardContent>
    </Card>
  );
}

function BigStat({
  value,
  label,
  warn,
}: {
  value: string;
  label: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-3">
      <div
        className={`text-2xl font-bold tabular-nums ${
          warn
            ? "text-amber-700 dark:text-amber-400"
            : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {value}
      </div>
      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
        {label}
      </p>
    </div>
  );
}

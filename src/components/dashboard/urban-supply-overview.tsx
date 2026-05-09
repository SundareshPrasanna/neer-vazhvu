"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/context";
import { formatNumber } from "@/lib/utils/format";

/**
 * Structural "city water supply at a glance" tile.
 *
 * Sits between the allocation hero and the reservoir cards on the
 * dashboards of cities where the headline story isn't a daily runway
 * but the structural shape of the supply chain itself - source mix,
 * WTP capacity, distribution scale, demand vs supply gap.
 *
 * The numbers behind this tile come from one-off engineering
 * documents (ADB IEE / DPR / MMC's own water-supply page for Madurai)
 * not live telemetry, so the JSON shape is verbose-but-static. Other
 * cities can ship their own <cityId>-supply-overview.json with the
 * same shape.
 */

interface SupplyMixItem {
  source: string;
  mld: number;
  annual_mcft: number | null;
  scheme?: string;
  supplies?: string;
  note?: string | null;
}

interface ReferenceFigure {
  id: string;
  src: string;
  caption: string;
  source_label: string;
}

interface SupplyOverviewData {
  _sources: { name: string; url: string; date: string; extracted: string }[];
  supply_chain: string[];
  current_supply_mix_mld: SupplyMixItem[];
  current_supply_total_mld: number;
  pannaipatty_wtp: {
    existing_capacity_mld: number;
    planned_addition_mld: number;
    planned_total_mld: number;
    expansion_source: string;
  };
  distribution: {
    /** Per-IEE Part 2 (Dec 2025): 28 existing OHTs (12 N + 16 S),
     *  410.5 LL aggregate. Tranche 2 adds 37 more OHTs at 589 LL. */
    ohts_existing: number;
    ohts_existing_aggregate_capacity_mld: number;
    ohts_new_under_tranche2: number;
    ohts_total_post_tranche2: number;
    /** Operational distribution zones (12 N + 16 S = 28). Distinct from
     *  DMAs (81 today / 115 post-Tranche-3), which are District
     *  Metering Areas at finer granularity. */
    distribution_zones: number;
    dmas_today: number;
    dmas_post_tranche3: number;
    mains_km_existing: number;
    new_distribution_pipelines_km_tranche3: number;
    connections: {
      total: number;
      domestic: number;
      non_domestic?: number;
      commercial: number;
      industrial?: number;
    };
  };
  demand: {
    population_2011: number;
    population_2034_design: number;
    demand_2034_mld: number;
    demand_gap_2034_mld: number;
    city_area_sqkm: number;
  };
  allocation_context: {
    mmc_drinking_mld: number;
    combined_drinking_mld: number;
    mullaperiyar_min_monthly_storage_avg_mcft: number;
    mullaperiyar_storage_period: string;
  };
  reference_figures?: ReferenceFigure[];
}

interface UrbanSupplyOverviewProps {
  cityId: string;
  cityDisplayName: string;
}

export function UrbanSupplyOverview({ cityId, cityDisplayName }: UrbanSupplyOverviewProps) {
  const { t } = useLanguage();
  const [data, setData] = useState<SupplyOverviewData | null>(null);

  useEffect(() => {
    fetch(`/data/${cityId}-supply-overview.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SupplyOverviewData>) : null))
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, [cityId]);

  // Hide entirely when the city hasn't published an overview file -
  // safer than rendering a thin / placeholder card.
  if (!data) return null;

  const supplyGapPct =
    data.demand.demand_2034_mld > 0
      ? Math.round((data.demand.demand_gap_2034_mld / data.demand.demand_2034_mld) * 100)
      : 0;
  const currentMetPct =
    data.demand.demand_2034_mld > 0
      ? Math.round((data.current_supply_total_mld / data.demand.demand_2034_mld) * 100)
      : 0;

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {t("supply_overview.title").replace("{city}", cityDisplayName)}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {t("supply_overview.subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Supply chain visualization - horizontal pipeline */}
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
            {t("supply_overview.chain_label")}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {data.supply_chain.map((step, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {step}
                </span>
                {i < data.supply_chain.length - 1 && (
                  <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">→</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Two-column on wide screens: source mix + distribution scale */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source mix */}
          <div>
            <h3 className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
              {t("supply_overview.source_mix_label").replace("{total}", String(data.current_supply_total_mld))}
            </h3>
            {/* Stacked bar */}
            <div className="flex w-full h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2">
              {data.current_supply_mix_mld.map((item, i) => {
                const pct = (item.mld / data.current_supply_total_mld) * 100;
                const colors = ["bg-blue-600", "bg-blue-400", "bg-cyan-500", "bg-teal-500", "bg-emerald-500", "bg-lime-500", "bg-amber-500"];
                return (
                  <div
                    key={item.source}
                    className={colors[i % colors.length]}
                    style={{ width: `${pct}%` }}
                    title={`${item.source}: ${item.mld} MLD`}
                  />
                );
              })}
            </div>
            <div className="space-y-1">
              {data.current_supply_mix_mld.map((item, i) => {
                const pct = ((item.mld / data.current_supply_total_mld) * 100).toFixed(0);
                const colors = ["bg-blue-600", "bg-blue-400", "bg-cyan-500", "bg-teal-500", "bg-emerald-500", "bg-lime-500", "bg-amber-500"];
                return (
                  <div key={item.source} className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-sm shrink-0 ${colors[i % colors.length]}`} />
                    <span className="text-slate-700 dark:text-slate-300 flex-1">{item.source}</span>
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                      {item.mld} MLD <span className="text-slate-400">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pannaipatty WTP + distribution scale */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
                {t("supply_overview.wtp_label")}
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {data.pannaipatty_wtp.existing_capacity_mld}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">MLD existing</span>
                {data.pannaipatty_wtp.planned_addition_mld > 0 && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-2">
                    +{data.pannaipatty_wtp.planned_addition_mld} MLD planned
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                {data.pannaipatty_wtp.expansion_source}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <Stat
                label={t("supply_overview.ohts_label")}
                value={String(data.distribution.ohts_existing)}
                sub={`${data.distribution.ohts_existing_aggregate_capacity_mld} MLD; +${data.distribution.ohts_new_under_tranche2} planned`}
              />
              <Stat
                label={t("supply_overview.zones_label")}
                value={`${data.distribution.distribution_zones} / ${data.distribution.dmas_today}`}
                sub={t("supply_overview.zones_sub")}
              />
              <Stat
                label={t("supply_overview.mains_label")}
                value={String(data.distribution.mains_km_existing)}
                sub={`km; +${data.distribution.new_distribution_pipelines_km_tranche3} planned`}
              />
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t("supply_overview.connections_line")
                .replace("{total}", formatNumber(data.distribution.connections.total))
                .replace("{domestic}", formatNumber(data.distribution.connections.domestic))
                .replace("{non_domestic}", formatNumber(data.distribution.connections.non_domestic ?? 0))
                .replace("{commercial}", formatNumber(data.distribution.connections.commercial))}
            </div>
          </div>
        </div>

        {/* Demand vs supply gap */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <h3 className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
            {t("supply_overview.demand_label")}
          </h3>
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {t("supply_overview.demand_2034")
                .replace("{demand}", String(data.demand.demand_2034_mld))
                .replace("{pop}", formatNumber(data.demand.population_2034_design))}
            </span>
            <span className="text-sm tabular-nums">
              <span className="text-slate-700 dark:text-slate-300 font-semibold">{data.current_supply_total_mld}</span>
              <span className="text-slate-400 dark:text-slate-500"> / {data.demand.demand_2034_mld} MLD</span>
              <span className="text-slate-400 dark:text-slate-500"> ({currentMetPct}%)</span>
            </span>
          </div>
          <div className="relative w-full h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
            <div
              className="absolute inset-y-0 left-0 bg-blue-500"
              style={{ width: `${currentMetPct}%` }}
            />
            <div
              className="absolute inset-y-0 bg-amber-300 dark:bg-amber-600"
              style={{ left: `${currentMetPct}%`, width: `${100 - currentMetPct}%`, opacity: 0.5 }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-snug">
            {t("supply_overview.demand_gap_caption")
              .replace("{gap}", String(data.demand.demand_gap_2034_mld))
              .replace("{pct}", String(supplyGapPct))}
          </p>
        </div>

        {/* Reference figures - the engineering diagrams from the
            IEE PDFs that document the structural numbers above.
            Click-to-zoom on each thumbnail. */}
        {data.reference_figures && data.reference_figures.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <h3 className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
              {t("supply_overview.figures_label")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.reference_figures.map((fig) => (
                <a
                  key={fig.id}
                  href={fig.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <div className="relative aspect-video bg-slate-50 dark:bg-slate-800/50 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 group-hover:border-blue-400 dark:group-hover:border-blue-600 transition-colors">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fig.src}
                      alt={fig.caption}
                      loading="lazy"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1.5 leading-snug">
                    {fig.caption}
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 italic">
                    {fig.source_label}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Source attribution */}
        <div className="text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2 leading-relaxed">
          <span className="font-semibold">{t("supply_overview.sources_label")}:</span>{" "}
          {data._sources.map((s, i) => (
            <span key={i}>
              {i > 0 && "; "}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600 dark:text-blue-400">
                {s.name}
              </a>
              <span className="text-slate-400"> ({s.date})</span>
            </span>
          ))}
          .
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 truncate">
        {label}
      </p>
      <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{sub}</p>
      )}
    </div>
  );
}

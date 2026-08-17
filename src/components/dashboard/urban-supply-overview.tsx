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
 * documents (ADB IEE / DPR / utility public pages) not live telemetry,
 * so the JSON shape is verbose-but-static. Other cities can ship their
 * own <cityId>-supply-overview.json with the same shape.
 *
 * Two supported shapes:
 *  - Single-WTP cities (Madurai): use `primary_wtp` / `pannaipatty_wtp`
 *    + Madurai-style distribution fields (OHTs, DMAs, mains).
 *  - Multi-WTP cities (Chennai): use `wtps_summary` + Chennai-style
 *    distribution fields (admin zones, CWRs, WDSs, network km).
 *  Madurai-only and Chennai-only fields are optional; the component
 *  renders the right layout based on which fields are present.
 *  Per-city narrative strings can be injected via `_view_overrides`.
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
  /** Local thumbnail path under /public (preferred). When absent, we
   *  render a text-only "external reference" card instead of a broken
   *  image. */
  src?: string;
  /** External URL the card links out to. Used when we cite a figure
   *  from a primary source (ADB IEE, JICA report) but haven't extracted
   *  + licensed the image into /public/images/ yet. */
  src_external?: string;
  caption: string;
  source_label: string;
}

interface PrimaryWtp {
  existing_capacity_mld: number;
  planned_addition_mld: number;
  planned_total_mld: number;
  expansion_source: string;
}

interface WtpsSummary {
  fresh_water_wtps_count: number;
  fresh_water_capacity_mld: number;
  desalination_plants_count?: number;
  desalination_capacity_mld?: number;
  total_installed_capacity_mld: number;
  average_supply_mld?: number;
  planned_additions_mld?: number;
  planned_additions_breakdown?: string;
}

interface SupplyOverviewData {
  /** Optional: every field a city may not have published yet is optional so a
   *  partial overview degrades to a thinner card instead of taking the whole
   *  dashboard down with it (Surat, review 2026-08-17). */
  _sources?: { name: string; url: string; date: string; extracted: string }[];
  /** Optional: a city may publish a supply overview without a chain (Surat
   *  shipped one before its chain was verified end to end). The renderer
   *  skips the strip rather than taking the whole dashboard down. */
  supply_chain?: string[];
  current_supply_mix_mld: SupplyMixItem[];
  current_supply_total_mld: number;

  /** Madurai-style: single primary WTP. Component renames `pannaipatty_wtp`
   *  to `primary_wtp` going forward; both names are accepted for
   *  back-compat with the Madurai JSON. */
  primary_wtp?: PrimaryWtp;
  pannaipatty_wtp?: PrimaryWtp;

  /** Chennai-style: aggregated multi-WTP summary. */
  wtps_summary?: WtpsSummary;

  distribution: {
    /** Madurai-style fields (all optional). */
    ohts_existing?: number;
    ohts_existing_aggregate_capacity_mld?: number;
    ohts_new_under_tranche2?: number;
    ohts_total_post_tranche2?: number;
    distribution_zones?: number;
    dmas_today?: number;
    dmas_post_tranche3?: number;
    mains_km_existing?: number;
    new_distribution_pipelines_km_tranche3?: number;

    /** Chennai-style fields (all optional). */
    administrative_zones?: number;
    ground_level_cwrs?: number;
    major_wdss?: number;
    total_wdss?: number;
    transmission_mains_km?: number;
    distribution_network_km?: number;
    population_served?: number;

    connections?: {
      total: number;
      domestic?: number;
      non_domestic?: number;
      commercial?: number;
      industrial?: number;
      domestic_and_non_domestic_combined?: number;
    };
    _connections_note?: string;
  };
  /** Optional: cities without a published design-horizon demand projection
   *  (Delhi - the CAG states current shortage, no 2034-style forecast)
   *  omit the block and the demand-gap section is skipped. */
  demand?: {
    population_2011?: number;
    population_2034_design?: number;
    population_design?: number;
    demand_2034_mld: number;
    demand_gap_2034_mld: number;
    city_area_sqkm?: number;
  };
  reference_figures?: ReferenceFigure[];

  /** Per-city narrative overrides for strings that are otherwise
   *  baked into the i18n bundle. Useful when the same component
   *  serves cities whose supply story differs structurally. */
  _view_overrides?: {
    subtitle?: string;
    wtp_label?: string;
    demand_caption?: string;
    /** Replaces the "2034 design demand: {demand} MLD for {pop} residents"
     *  line. The i18n default hard-codes 2034 (Madurai/Chennai's ADB design
     *  horizon); cities on a different plan horizon (Delhi: MPD-2041) must
     *  override it or the page states the wrong year. */
    demand_headline?: string;
  };
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

  if (!data) return null;

  const primaryWtp = data.primary_wtp ?? data.pannaipatty_wtp ?? null;
  const wtpsSummary = data.wtps_summary ?? null;

  const demand = data.demand ?? null;
  const supplyGapPct =
    demand && demand.demand_2034_mld > 0
      ? Math.round((demand.demand_gap_2034_mld / demand.demand_2034_mld) * 100)
      : 0;
  const currentMetPctRaw =
    demand && demand.demand_2034_mld > 0
      ? Math.round((data.current_supply_total_mld / demand.demand_2034_mld) * 100)
      : 0;
  const currentMetPct = Math.min(100, currentMetPctRaw);
  const designPopulation = demand?.population_2034_design ?? demand?.population_design ?? 0;

  const overrideSubtitle = data._view_overrides?.subtitle;
  const overrideWtpLabel = data._view_overrides?.wtp_label;
  const overrideDemandCaption = data._view_overrides?.demand_caption;

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {t("supply_overview.title").replace("{city}", cityDisplayName)}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {overrideSubtitle ?? t("supply_overview.subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Supply chain visualization - horizontal pipeline */}
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
            {t("supply_overview.chain_label")}
          </h3>
          <div className="flex flex-wrap items-stretch gap-1.5 text-[11px]">
            {(data.supply_chain ?? []).map((step, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 max-w-xs leading-snug">
                  {step}
                </span>
                {i < (data.supply_chain ?? []).length - 1 && (
                  <span className="text-slate-400 dark:text-slate-500 self-center" aria-hidden="true">→</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Two-column on wide screens: source mix + WTP/distribution scale */}
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
                const colors = ["bg-blue-600", "bg-blue-400", "bg-cyan-500", "bg-teal-500", "bg-emerald-500", "bg-lime-500", "bg-amber-500", "bg-orange-500"];
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
                const colors = ["bg-blue-600", "bg-blue-400", "bg-cyan-500", "bg-teal-500", "bg-emerald-500", "bg-lime-500", "bg-amber-500", "bg-orange-500"];
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

          {/* WTP block + distribution scale */}
          <div className="space-y-4">
            {/* Single-WTP path (Madurai) */}
            {primaryWtp && (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
                  {overrideWtpLabel ?? t("supply_overview.wtp_label")}
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {primaryWtp.existing_capacity_mld}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">MLD existing</span>
                  {primaryWtp.planned_addition_mld > 0 && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-2">
                      +{primaryWtp.planned_addition_mld} MLD planned
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  {primaryWtp.expansion_source}
                </p>
              </div>
            )}

            {/* Multi-WTP path (Chennai) */}
            {!primaryWtp && wtpsSummary && (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
                  {overrideWtpLabel ?? t("supply_overview.wtp_label")}
                </h3>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatNumber(wtpsSummary.total_installed_capacity_mld)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">MLD installed</span>
                  {wtpsSummary.planned_additions_mld && wtpsSummary.planned_additions_mld > 0 && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-2">
                      +{wtpsSummary.planned_additions_mld} MLD planned
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  {wtpsSummary.fresh_water_wtps_count} fresh-water WTPs
                  ({formatNumber(wtpsSummary.fresh_water_capacity_mld)} MLD)
                  {wtpsSummary.desalination_plants_count
                    ? ` + ${wtpsSummary.desalination_plants_count} desal plants (${formatNumber(wtpsSummary.desalination_capacity_mld ?? 0)} MLD)`
                    : ""}
                  {wtpsSummary.average_supply_mld
                    ? `; avg supply ~${formatNumber(wtpsSummary.average_supply_mld)} MLD`
                    : ""}
                  .
                </p>
              </div>
            )}

            {/* Madurai-shape distribution stat row (OHTs / Zones / Mains) */}
            {data.distribution.ohts_existing != null && (
              <div className="grid grid-cols-3 gap-3 text-xs">
                <Stat
                  label={t("supply_overview.ohts_label")}
                  value={String(data.distribution.ohts_existing)}
                  sub={`${data.distribution.ohts_existing_aggregate_capacity_mld ?? "?"} MLD; +${data.distribution.ohts_new_under_tranche2 ?? 0} planned`}
                />
                <Stat
                  label={t("supply_overview.zones_label")}
                  value={`${data.distribution.distribution_zones ?? "?"} / ${data.distribution.dmas_today ?? "?"}`}
                  sub={t("supply_overview.zones_sub")}
                />
                <Stat
                  label={t("supply_overview.mains_label")}
                  value={String(data.distribution.mains_km_existing ?? "?")}
                  sub={`km; +${data.distribution.new_distribution_pipelines_km_tranche3 ?? 0} planned`}
                />
              </div>
            )}

            {/* Chennai-shape distribution stat row (Zones/WDSs/Network) */}
            {data.distribution.ohts_existing == null && data.distribution.administrative_zones != null && (
              <div className="grid grid-cols-3 gap-3 text-xs">
                <Stat
                  label="Admin zones"
                  value={String(data.distribution.administrative_zones)}
                  sub={
                    data.distribution.major_wdss != null && data.distribution.total_wdss != null
                      ? `${data.distribution.major_wdss} major / ${data.distribution.total_wdss} WDSs`
                      : undefined
                  }
                />
                <Stat
                  label="Clear-water reservoirs"
                  value={String(data.distribution.ground_level_cwrs ?? "?")}
                  sub={
                    data.distribution.transmission_mains_km != null
                      ? `${data.distribution.transmission_mains_km} km transmission`
                      : undefined
                  }
                />
                <Stat
                  label="Distribution network"
                  value={
                    data.distribution.distribution_network_km != null
                      ? `${formatNumber(data.distribution.distribution_network_km)}`
                      : "?"
                  }
                  sub="km"
                />
              </div>
            )}

            {/* Connections line - the schema is forgiving so cities
                with only `total` (Chennai) get a one-line summary;
                cities with the full domestic/commercial breakdown
                (Madurai) get the rich version. */}
            <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {data.distribution.connections == null ? (
                <>
                  {data.distribution.population_served
                    ? `Serving ~${formatNumber(data.distribution.population_served)} residents.`
                    : null}
                </>
              ) : data.distribution.connections.domestic != null && data.distribution.connections.commercial != null ? (
                <>
                  {t("supply_overview.connections_line")
                    .replace("{total}", formatNumber(data.distribution.connections.total))
                    .replace("{domestic}", formatNumber(data.distribution.connections.domestic))
                    .replace("{non_domestic}", formatNumber(data.distribution.connections.non_domestic ?? 0))
                    .replace("{commercial}", formatNumber(data.distribution.connections.commercial))}
                </>
              ) : (
                <>
                  {formatNumber(data.distribution.connections.total)} service connections
                  {data.distribution.population_served
                    ? ` serving ~${formatNumber(data.distribution.population_served)} residents`
                    : ""}
                  .
                </>
              )}
              {data.distribution._connections_note && (
                <span className="block mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                  {data.distribution._connections_note}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Demand vs supply gap (skipped for cities without a published
            design-horizon projection) */}
        {demand && (
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <h3 className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
            {t("supply_overview.demand_label")}
          </h3>
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {(data._view_overrides?.demand_headline ?? t("supply_overview.demand_2034"))
                .replace("{demand}", String(demand.demand_2034_mld))
                .replace("{pop}", formatNumber(designPopulation))}
            </span>
            <span className="text-sm tabular-nums">
              <span className="text-slate-700 dark:text-slate-300 font-semibold">{data.current_supply_total_mld}</span>
              <span className="text-slate-400 dark:text-slate-500"> / {demand.demand_2034_mld} MLD</span>
              <span className="text-slate-400 dark:text-slate-500"> ({currentMetPctRaw}%)</span>
            </span>
          </div>
          <div className="relative w-full h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
            <div
              className="absolute inset-y-0 left-0 bg-blue-500"
              style={{ width: `${currentMetPct}%` }}
            />
            {currentMetPct < 100 && (
              <div
                className="absolute inset-y-0 bg-amber-300 dark:bg-amber-600"
                style={{ left: `${currentMetPct}%`, width: `${100 - currentMetPct}%`, opacity: 0.5 }}
              />
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-snug">
            {overrideDemandCaption
              ? overrideDemandCaption
              : t("supply_overview.demand_gap_caption")
                  .replace("{gap}", String(demand.demand_gap_2034_mld))
                  .replace("{pct}", String(supplyGapPct))}
          </p>
        </div>
        )}

        {/* Reference figures. Two render modes:
            - src present: link out + render a thumbnail (Chennai/Madurai)
            - only src_external: render a clean text-card linking to the
              external source (Bangalore until JICA figures are extracted) */}
        {data.reference_figures && data.reference_figures.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <h3 className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
              {t("supply_overview.figures_label")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(data.reference_figures ?? []).map((fig) => {
                const href = fig.src ?? fig.src_external;
                if (!href) return null;
                return (
                  <a
                    key={fig.id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    {fig.src ? (
                      <div className="relative aspect-video bg-slate-50 dark:bg-slate-800/50 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 group-hover:border-blue-400 dark:group-hover:border-blue-600 transition-colors">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={fig.src}
                          alt={fig.caption}
                          loading="lazy"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 group-hover:border-blue-400 dark:group-hover:border-blue-600 transition-colors p-3 flex flex-col justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          External reference
                        </span>
                        <span className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug line-clamp-4">
                          {fig.caption}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          View at source →
                        </span>
                      </div>
                    )}
                    {/* The caption + source label render below the card only
                        for thumbnail mode; text-card mode shows caption inside
                        the card itself, so we skip the caption block here to
                        avoid duplication. */}
                    {fig.src && (
                      <>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1.5 leading-snug">
                          {fig.caption}
                        </p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 italic">
                          {fig.source_label}
                        </p>
                      </>
                    )}
                    {!fig.src && (
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 italic">
                        {fig.source_label}
                      </p>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Source attribution */}
        <div className="text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2 leading-relaxed">
          <span className="font-semibold">{t("supply_overview.sources_label")}:</span>{" "}
          {(data._sources ?? []).map((s, i) => (
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

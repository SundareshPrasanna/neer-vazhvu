"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils/format";
import { useLanguage } from "@/lib/i18n/context";
import { PUMPING_HERO_COPY, type PumpingHeroCopy } from "@/content/hero/pumping";
import type { CityId } from "@/lib/cities/ids";

function format(template: string, params: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

/**
 * "Pumped-city" hero for the city dashboard. Built for Bangalore but
 * shape-fits any city whose headline supply story is "pumped from a
 * faraway river + local groundwater + tankers" rather than impounded
 * local reservoirs (Chennai) or a single dedicated allocation (Madurai).
 *
 * Reads <cityId>-supply-overview.json (the same engineering-document-
 * anchored JSON UrbanSupplyOverview consumes downstream on the same
 * page). Numbers come from the city's primary engineering reference:
 * JICA Bengaluru Water Supply and Sewerage Project (Phase 3), Nov 2017,
 * for Bangalore - via tables 3.1 / 3.1.2 / 6.2 / 6.3.
 *
 * The narrative arc this hero is engineered to communicate:
 *   1. WHAT is the supply chain (Cauvery -> pumping -> WTPs)
 *   2. HOW MUCH does it deliver (WTP capacity + 3-stage pumping facts)
 *   3. WHY isn't that enough (NRW + Stage V under-delivery + GW stress)
 *   4. WHEN does the deficit bite (2049 demand vs supply gap)
 */

interface SupplyMixItem {
  source: string;
  mld: number;
  _provenance?: string;
}

interface SupplyOverviewMin {
  current_supply_total_mld: number;
  current_supply_mix_mld: SupplyMixItem[];
  groundwater?: {
    official_mld?: number;
    estimate_mld?: number;
  };
  wtps_summary?: {
    planned_additions_mld?: number;
    total_installed_capacity_mld?: number;
    stage_v_design_mld?: number;
    stage_v_actual_mld?: number;
  };
  distribution?: {
    population_served?: number;
    transmission_mains_km?: number;
  };
  demand?: {
    demand_2049_mld?: number;
    demand_gap_2049_mld?: number;
  };
  allocation_context?: {
    transmission_distance_km?: number;
    transmission_elevation_lift_m?: number;
    energy_cost_of_pumping_pct_of_revenue?: number;
    nrw_pct?: number;
    present_per_capita_supply_lpcd?: number;
    present_per_capita_consumption_lpcd?: number;
  };
  stress_wards_iisc?: {
    stress_ward_count?: number;
  };
  project_cost?: {
    total_inr_crore?: number;
    components?: { name: string; inr_crore: number }[];
    funding_pattern?: { jica_loan_pct?: number };
  };
  /** English-only narrative for this city; overrides PUMPING_HERO_COPY. */
  hero_copy?: PumpingHeroCopy;
}

interface Props {
  cityId: string;
  cityDisplayName: string;
}

export function CauveryPumpingHero({ cityId, cityDisplayName }: Props) {
  const { t } = useLanguage();
  const [data, setData] = useState<SupplyOverviewMin | null>(null);

  useEffect(() => {
    fetch(`/data/${cityId}-supply-overview.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SupplyOverviewMin>) : null))
      .then(setData)
      .catch(() => setData(null));
  }, [cityId]);

  if (!data) return null;

  // Headline "Cauvery WTP capacity" = installed capacity (post-Stage-V), not the
  // per-stage design sum; falls back to the supply-mix total for cities without
  // a wtps_summary block.
  const cauveryMld =
    data.wtps_summary?.total_installed_capacity_mld ?? data.current_supply_total_mld;
  // Stage V design/actual are explicit fields so the "+planned" addition figure
  // (Stage VI) is no longer overloaded onto Stage V's design capacity.
  const stageVDesign = data.wtps_summary?.stage_v_design_mld ?? null;
  const stageVActual =
    data.wtps_summary?.stage_v_actual_mld ??
    data.current_supply_mix_mld.find((s) =>
      s.source.toLowerCase().includes("stage v"),
    )?.mld ??
    null;

  // Groundwater is a separate layer (the 'groundwater' object), not a slice of
  // the treated-supply mix. Fall back to the legacy mix lookup for safety.
  const groundwaterOfficial =
    data.groundwater?.official_mld ??
    data.current_supply_mix_mld.find((s) => s._provenance === "BWSSB_official")?.mld;
  const groundwaterEstimate =
    data.groundwater?.estimate_mld ??
    data.current_supply_mix_mld.find((s) => s._provenance === "WELL_Labs_2024")?.mld;

  const transmissionKm = data.allocation_context?.transmission_distance_km;
  const transmissionLiftM = data.allocation_context?.transmission_elevation_lift_m;
  const energyPct = data.allocation_context?.energy_cost_of_pumping_pct_of_revenue;
  const nrwPct = data.allocation_context?.nrw_pct;
  const lpcdSupply = data.allocation_context?.present_per_capita_supply_lpcd;
  const lpcdConsumption = data.allocation_context?.present_per_capita_consumption_lpcd;
  const stressWards = data.stress_wards_iisc?.stress_ward_count;
  const populationServed = data.distribution?.population_served;
  const demand2049 = data.demand?.demand_2049_mld;
  const deficit2049 = data.demand?.demand_gap_2049_mld;
  const projectCostCrore = data.project_cost?.total_inr_crore;
  const jicaLoanPct = data.project_cost?.funding_pattern?.jica_loan_pct;
  const copy: PumpingHeroCopy = { ...PUMPING_HERO_COPY[cityId as CityId], ...data.hero_copy };
  // t() returns a non-key unchanged, so JSON literals and i18n keys read alike.
  const text = (v: string, params: Record<string, string | number | undefined> = {}) => format(t(v), params);
  const say = (v: string | undefined, params: Record<string, string | number | undefined> = {}) =>
    v ? text(v, params) : undefined;
  const callout = (id: keyof NonNullable<PumpingHeroCopy["callouts"]>) => copy.callouts?.[id];

  return (
    <Card className="border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/30 dark:to-cyan-950/30">
      <CardContent className="p-6 space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            {format(t("pump.eyebrow"), { city: cityDisplayName })}
          </p>
          {copy.headline && (
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {say(copy.headline, { km: transmissionKm, m: transmissionLiftM })}
            </h2>
          )}
          {copy.body && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              {say(copy.body, { city: cityDisplayName, km: transmissionKm, m: transmissionLiftM })}
            </p>
          )}
        </div>

        {/* Top row: 4 big stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* A real number for any city; without the city's own label it reads
              neutrally rather than naming another city's treatment plants. */}
          <Stat
            value={formatNumber(cauveryMld)}
            unit="MLD"
            label={say(copy.wtp_label) ?? "Treatment capacity"}
            sub={say(copy.wtp_sub)}
          />
          {transmissionKm && (
            <Stat
              value={String(transmissionKm)}
              unit="km"
              label={say(copy.uphill_label) ?? "Transmission distance"}
              sub={say(copy.uphill_sub, { m: transmissionLiftM })}
            />
          )}
          {nrwPct != null && (
            <Stat
              value={String(nrwPct)}
              unit="%"
              label={t("pump.stat.nrw_label")}
              sub={say(copy.nrw_sub, { supply: lpcdSupply, consumer: lpcdConsumption })}
              warn
            />
          )}
          {populationServed && (
            <Stat
              value={(populationServed / 1_000_000).toFixed(1)}
              unit={t("pump.stat.unit_m_people")}
              label={say(copy.pop_label) ?? t("pump.stat.pop_label")}
              sub={say(copy.pop_sub)}
            />
          )}
        </div>

        {/* Story-callouts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {stageVDesign && stageVActual != null  && callout("stage_v") && (
            <Callout
              icon="V"
              title={text(callout("stage_v")!.title, { design: stageVDesign, actual: stageVActual })}
              body={text(callout("stage_v")!.body, {})}
            />
          )}
          {energyPct  && callout("energy") && (
            <Callout
              icon="$"
              title={text(callout("energy")!.title, { pct: energyPct })}
              body={text(callout("energy")!.body, { km: transmissionKm, m: transmissionLiftM })}
            />
          )}
          {groundwaterOfficial != null && groundwaterEstimate != null  && callout("gw") && (
            <Callout
              icon="G"
              title={text(callout("gw")!.title, { official: groundwaterOfficial, estimate: formatNumber(groundwaterEstimate) })}
              body={text(callout("gw")!.body, {})}
            />
          )}
          {stressWards  && callout("stress") && (
            <Callout
              icon="!"
              title={text(callout("stress")!.title, { count: stressWards })}
              body={text(callout("stress")!.body, {})}
            />
          )}
          {demand2049 && deficit2049 && callout("demand") && (
            <Callout
              icon="2049"
              title={text(callout("demand")!.title, {
                demand: formatNumber(demand2049),
                supply: formatNumber(demand2049 - deficit2049),
                gap: formatNumber(deficit2049),
              })}
              body={text(callout("demand")!.body)}
              wide
            />
          )}
          {projectCostCrore  && callout("project") && (
            <Callout
              icon="₹"
              title={text(callout("project")!.title, { cost: formatNumber(projectCostCrore) })}
              body={text(callout("project")!.body, { jica: jicaLoanPct })}
              wide
            />
          )}
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
          {say(copy.footer)}
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({
  value,
  unit,
  label,
  sub,
  warn,
}: {
  value: string;
  unit: string;
  label: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-1">
        <span
          className={`text-2xl sm:text-3xl font-bold tabular-nums ${
            warn
              ? "text-amber-700 dark:text-amber-400"
              : "text-blue-700 dark:text-blue-300"
          }`}
        >
          {value}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {unit}
        </span>
      </div>
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </p>
      {sub && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
          {sub}
        </p>
      )}
    </div>
  );
}

function Callout({
  icon,
  title,
  body,
  wide,
}: {
  icon: string;
  title: string;
  body: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex gap-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-3 ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      <div className="flex-shrink-0 w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold tabular-nums">
        {icon}
      </div>
      <div className="space-y-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
          {title}
        </p>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
          {body}
        </p>
      </div>
    </div>
  );
}

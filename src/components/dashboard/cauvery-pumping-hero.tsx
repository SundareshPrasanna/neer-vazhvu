"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils/format";
import { useLanguage } from "@/lib/i18n/context";

function format(template: string, params: Record<string, string | number>): string {
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
  wtps_summary?: {
    planned_additions_mld?: number;
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

  const cauveryMld = data.current_supply_total_mld;
  const stageVDesign = data.wtps_summary?.planned_additions_mld ?? null;
  const stageVActual =
    data.current_supply_mix_mld.find((s) =>
      s.source.toLowerCase().includes("stage v"),
    )?.mld ?? null;

  const groundwaterOfficial = data.current_supply_mix_mld.find(
    (s) => s._provenance === "BWSSB_official",
  )?.mld;
  const groundwaterEstimate = data.current_supply_mix_mld.find(
    (s) => s._provenance === "WELL_Labs_2024",
  )?.mld;

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

  return (
    <Card className="border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/30 dark:to-cyan-950/30">
      <CardContent className="p-6 space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            {format(t("pump.eyebrow"), { city: cityDisplayName })}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {format(t("pump.headline"), { km: transmissionKm ?? 95, m: transmissionLiftM ?? 500 })}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
            {format(t("pump.body"), { city: cityDisplayName, km: transmissionKm ?? 95, m: transmissionLiftM ?? 500 })}
          </p>
        </div>

        {/* Top row: 4 big stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat
            value={formatNumber(cauveryMld)}
            unit="MLD"
            label={t("pump.stat.wtp_label")}
            sub={t("pump.stat.wtp_sub")}
          />
          {transmissionKm && (
            <Stat
              value={String(transmissionKm)}
              unit="km"
              label={t("pump.stat.uphill_label")}
              sub={format(t("pump.stat.uphill_sub"), { m: transmissionLiftM ?? "~500" })}
            />
          )}
          {nrwPct != null && (
            <Stat
              value={String(nrwPct)}
              unit="%"
              label={t("pump.stat.nrw_label")}
              sub={
                lpcdSupply && lpcdConsumption
                  ? format(t("pump.stat.nrw_sub"), { supply: lpcdSupply, consumer: lpcdConsumption })
                  : t("pump.stat.nrw_sub_fallback")
              }
              warn
            />
          )}
          {populationServed && (
            <Stat
              value={(populationServed / 1_000_000).toFixed(1)}
              unit={t("pump.stat.unit_m_people")}
              label={t("pump.stat.pop_label")}
              sub={t("pump.stat.pop_sub")}
            />
          )}
        </div>

        {/* Story-callouts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {stageVDesign && stageVActual != null && (
            <Callout
              icon="V"
              title={format(t("pump.callout.stage_v_title"), { design: stageVDesign, actual: stageVActual })}
              body={t("pump.callout.stage_v_body")}
            />
          )}
          {energyPct && (
            <Callout
              icon="$"
              title={format(t("pump.callout.energy_title"), { pct: energyPct })}
              body={format(t("pump.callout.energy_body"), { km: transmissionKm ?? 95, m: transmissionLiftM ?? 500 })}
            />
          )}
          {groundwaterOfficial != null && groundwaterEstimate != null && (
            <Callout
              icon="G"
              title={format(t("pump.callout.gw_title"), { official: groundwaterOfficial, estimate: formatNumber(groundwaterEstimate) })}
              body={t("pump.callout.gw_body")}
            />
          )}
          {stressWards && (
            <Callout
              icon="!"
              title={format(t("pump.callout.stress_title"), { count: stressWards })}
              body={t("pump.callout.stress_body")}
            />
          )}
          {demand2049 && deficit2049 && (
            <Callout
              icon="2049"
              title={format(t("pump.callout.demand_title"), {
                demand: formatNumber(demand2049),
                supply: formatNumber(demand2049 - deficit2049),
                gap: formatNumber(deficit2049),
              })}
              body={t("pump.callout.demand_body")}
              wide
            />
          )}
          {projectCostCrore && (
            <Callout
              icon="₹"
              title={format(t("pump.callout.project_title"), { cost: formatNumber(projectCostCrore) })}
              body={format(t("pump.callout.project_body"), { jica: jicaLoanPct ?? 85 })}
              wide
            />
          )}
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
          {t("pump.footer")}
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

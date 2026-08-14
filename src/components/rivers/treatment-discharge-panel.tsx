"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Treatment & discharge panel.
 *
 * Answers one question the rivers map cannot: if the city has treatment
 * capacity, why is the river anoxic? It joins two datasets published by two
 * different bodies that were never designed to be read together -
 * the state pollution board's per-plant STP monitoring, and CPCB's NWMP river
 * stations - and walks the chain from installed capacity to river condition.
 *
 * Deliberately NOT a map. The STP feed publishes plant names and capacities but
 * no coordinates, and placing 66 plants by geocoding their name strings would
 * manufacture a precision the source does not carry. The chain is the finding;
 * dots would be decoration.
 */

type StpReading = { month: string; bod_mgl: number | null };

type Stp = {
  name: string;
  capacity_mld: number | null;
  capacity_raw: string | null;
  in_hyderabad_area: boolean;
  months_monitored: number;
  bod_median_mgl: number | null;
  bod_max_mgl: number | null;
  months_bod_over_10: number;
  readings: StpReading[];
};

type StpFile = {
  _source: string;
  _source_url: string;
  _licence: string;
  _note: string;
  _caveats: string[];
  totals: {
    months: number;
    plants_all_telangana: number;
    plants_hyderabad_area: number;
    plants_with_parsed_capacity: number;
    hyderabad_capacity_mld: number;
    hyderabad_plants_ever_over_bod_norm: number;
    period: string | null;
  };
  plants: Stp[];
};

type Range = { min: number | null; max: number | null } | null;
type RiverFile = {
  source_label?: string;
  rivers: {
    id: string;
    name: string;
    stations: {
      nwmp_code?: string;
      name: string;
      readings: { year: number; do_mgl: Range; bod_mgl: Range }[];
    }[];
  }[];
};

/** CPCB / MoEF discharge standard for STP effluent. */
const BOD_NORM = 10;
const nf = new Intl.NumberFormat("en-IN");

export function TreatmentDischargePanel({
  cityId,
  cityDisplayName,
  onClose,
}: {
  cityId: string;
  cityDisplayName: string;
  onClose: () => void;
}) {
  const [stp, setStp] = useState<StpFile | null>(null);
  const [river, setRiver] = useState<RiverFile | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch(`/data/${cityId}-stps.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("stp")))),
      fetch(`/data/river-quality-${cityId}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([s, rv]) => {
        if (!live) return;
        setStp(s as StpFile);
        setRiver(rv as RiverFile | null);
      })
      .catch(() => live && setErr(true));
    return () => {
      live = false;
    };
  }, [cityId]);

  const hyd = useMemo(() => (stp?.plants ?? []).filter((p) => p.in_hyderabad_area), [stp]);
  const ranked = useMemo(
    () => [...hyd].sort((a, b) => (b.capacity_mld ?? 0) - (a.capacity_mld ?? 0)),
    [hyd],
  );

  // Worst river reading, used to close the chain. Ranked on the annual MAXIMUM,
  // not the minimum: a low minimum only says the river had one bad day, while a
  // low maximum says even the year's BEST reading was that low. Several
  // stations touch 0.0 as a minimum; ranking on the max isolates the one where
  // oxygen never recovered at all.
  const worstStation = useMemo(() => {
    if (!river) return null;
    let worst: { name: string; year: number; do_max: number; do_min: number } | null = null;
    for (const r of river.rivers) {
      for (const s of r.stations) {
        for (const rd of s.readings) {
          const hi = rd.do_mgl?.max;
          const lo = rd.do_mgl?.min;
          if (hi == null || lo == null) continue;
          if (!worst || hi < worst.do_max) {
            worst = { name: s.name, year: rd.year, do_max: hi, do_min: lo };
          }
        }
      }
    }
    return worst;
  }, [river]);

  if (err) {
    return (
      <PanelShell onClose={onClose} title="Treatment & discharge">
        <p className="text-sm text-slate-500">Treatment data could not be loaded.</p>
      </PanelShell>
    );
  }
  if (!stp) {
    return (
      <PanelShell onClose={onClose} title="Treatment & discharge">
        <p className="text-sm text-slate-500">Loading treatment data...</p>
      </PanelShell>
    );
  }

  const t = stp.totals;
  const breachPct = t.plants_hyderabad_area
    ? (t.hyderabad_plants_ever_over_bod_norm / t.plants_hyderabad_area) * 100
    : 0;
  const biggest = ranked[0];
  const biggestPct = biggest && biggest.months_monitored
    ? (biggest.months_bod_over_10 / biggest.months_monitored) * 100
    : 0;

  return (
    <PanelShell onClose={onClose} title={`${cityDisplayName}: treatment & discharge`}>
      {/* Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Installed capacity", value: `${nf.format(Math.round(t.hyderabad_capacity_mld))} MLD`,
            sub: `${t.plants_with_parsed_capacity} named plants` },
          { label: "Plants monitored", value: String(t.plants_hyderabad_area),
            sub: `of ${t.plants_all_telangana} in the state file` },
          { label: "Ever over the norm", value: String(t.hyderabad_plants_ever_over_bod_norm),
            sub: `${breachPct.toFixed(0)}% of monitored plants` },
          { label: "Monitoring period", value: t.months ? `${t.months} mo` : "-", sub: t.period ?? "" },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{c.value}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* The chain */}
      <section className="rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-4">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          The chain, from installed capacity to river
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Two publishers, two datasets, never designed to be read together.
        </p>
        <ol className="mt-3 space-y-2.5">
          <ChainStep
            n={1}
            head={`${nf.format(Math.round(t.hyderabad_capacity_mld))} MLD of capacity exists, and it is itemised`}
            body={`The pollution board names every plant with its capacity and monitors its effluent monthly. Capacity is not the missing piece.`}
          />
          {biggest && (
            <ChainStep
              n={2}
              head={`The largest plant misses the discharge standard in ${biggestPct.toFixed(0)}% of monitored months`}
              body={`${biggest.name.split(",")[0]} treats ${biggest.capacity_mld} MLD and exceeded the ${BOD_NORM} mg/L BOD norm in ${biggest.months_bod_over_10} of ${biggest.months_monitored} months, with a median of ${biggest.bod_median_mgl} and a peak of ${biggest.bod_max_mgl}. The plant was running; the water leaving it was not clean.`}
            />
          )}
          <ChainStep
            n={3}
            head={`${t.hyderabad_plants_ever_over_bod_norm} of ${t.plants_hyderabad_area} monitored plants have breached the norm at least once`}
            body="This is a performance pattern across the estate, not one failing works."
          />
          {worstStation && (
            <ChainStep
              n={4}
              head={`Downstream, the river's BEST reading of the year was ${worstStation.do_max} mg/L`}
              body={`${worstStation.name}, ${worstStation.year}: CPCB's national network recorded dissolved oxygen between ${worstStation.do_min} and ${worstStation.do_max} mg/L across the whole year. Not one bad day - no measurable oxygen at either end of the range. Read very low values as at-or-below the programme's reporting floor rather than as exact concentrations.`}
            />
          )}
        </ol>
      </section>

      {/* Plant table */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Plants by capacity, and how often they meet the standard
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Share of monitored months where effluent BOD exceeded {BOD_NORM} mg/L. Longer bar is worse.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left font-medium py-1">Plant</th>
                <th className="text-right font-medium py-1">MLD</th>
                <th className="text-right font-medium py-1">Median BOD</th>
                <th className="text-left font-medium py-1 pl-3 w-[38%]">Months over norm</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 25).map((p) => {
                const pct = p.months_monitored ? (p.months_bod_over_10 / p.months_monitored) * 100 : 0;
                return (
                  <tr key={p.name} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1 text-slate-700 dark:text-slate-300">{p.name.split(",")[0]}</td>
                    <td className="py-1 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      {p.capacity_mld ?? "-"}
                    </td>
                    <td className={`py-1 text-right tabular-nums font-medium ${
                      (p.bod_median_mgl ?? 0) > BOD_NORM ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"
                    }`}>
                      {p.bod_median_mgl ?? "-"}
                    </td>
                    <td className="py-1 pl-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                          <div
                            className={`h-full rounded-sm ${pct >= 60 ? "bg-rose-500" : pct >= 25 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-20 text-right tabular-nums text-slate-500 text-[11px]">
                          {p.months_bod_over_10}/{p.months_monitored}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {ranked.length > 25 && (
          <p className="text-[11px] text-slate-500 mt-2">
            Showing the 25 largest of {ranked.length} monitored plants.
          </p>
        )}
      </section>

      {/* Gaps */}
      <section className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          What this does not tell you
        </h3>
        <p>
          <strong>No plant coordinates.</strong> The feed publishes names and capacities, not locations, so
          these plants are listed rather than mapped. Geocoding 66 name strings would invent a precision
          the source does not carry.
        </p>
        {stp._caveats?.slice(0, 3).map((c) => (
          <p key={c}>{c}</p>
        ))}
        <p className="pt-1 border-t border-slate-200 dark:border-slate-700">
          Source:{" "}
          <a href={stp._source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
            {stp._source}
          </a>{" "}
          - {stp._licence}
          {river?.source_label ? ` River readings: ${river.source_label}.` : ""}
        </p>
      </section>
    </PanelShell>
  );
}

function ChainStep({ n, head, body }: { n: number; head: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <div>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{head}</div>
        <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{body}</div>
      </div>
    </li>
  );
}

function PanelShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-[700] bg-black/40 flex justify-end" onClick={onClose}>
      <div
        className="w-full sm:max-w-3xl h-full bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 text-sm px-2 py-1"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div className="p-4 space-y-5">{children}</div>
      </div>
    </div>
  );
}

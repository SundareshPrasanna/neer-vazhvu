/**
 * Tanker page, "delivery-register" variant.
 *
 * The fourth kind, and the reason it is a new one rather than a reuse is worth
 * stating, because the temptation to force Pune through the Hyderabad panel was
 * real. HMWSSB's ledger answers "who ASKS, and when?" - it has bookings, it has
 * deliveries, and the ratio between them is a fulfilment rate that is the whole
 * point of that page. PMC's register has NO BOOKINGS AT ALL. It is one
 * spreadsheet per filling point per working day, one row per tanker already
 * sent: the dispatch record of a fleet, downstream of whatever asked for it.
 * There is no fulfilment rate to compute, no division or section unit, and the
 * dimensions that exist instead are filling point, prabhag and vehicle.
 *
 * So the question this panel answers is "WHAT DID THE CORPORATION ACTUALLY
 * SEND, AND WAS IT PLANNED?" - and the second half is the finding. A scheduled
 * tanker route is a known supply gap being serviced on a rota. An on-demand
 * majority is a system reacting to failures it did not plan for. Pune's split
 * is 58.4% on demand, so that leads.
 *
 * THREE THINGS THIS PANEL DELIBERATELY REFUSES TO DRAW.
 *
 * 1. No per-day time series as the headline. Two thirds of the rows cannot be
 *    dated at all - 167 of the registers carry no date anywhere, in the title
 *    or the sheet - and PMC's upload timestamp is not a substitute for the day
 *    the tankers ran. A chart over the datable third would look like a complete
 *    series and would not be one. The daily figures are shown as a reporting
 *    record, labelled as coverage rather than as demand.
 *
 * 2. No prabhag ranking. The prabhag column is populated on about half the
 *    rows, so the per-ward table is a partial attribution. Sorting it descending
 *    and calling the top row the worst-served ward would be reading recording
 *    practice as need. It renders with the coverage percentage attached and the
 *    word "partial" in the heading.
 *
 * 3. No recipients. The source rows carry society names, street addresses and
 *    phone numbers; the artifact carries counts only, and this panel could not
 *    render them if it wanted to. Deliberately unlike Gurugram's panel, which
 *    names its top buyers - those are companies buying at a published tariff,
 *    and naming them is reporting on a market. Pune's recipients are private
 *    housing societies, and naming one with its address publishes where
 *    identifiable residents do not have water.
 */

import type { ReactNode } from "react";

export type TankerDeliveryRegister = {
  _source: string;
  _source_url: string;
  _fetched: string;
  _note: string;
  kind: string;
  totals: {
    deliveries: number;
    registers_published: number;
    registers_parsed: number;
    distinct_days: number;
    distinct_vehicles: number;
    deliveries_dated: number;
    deliveries_undated: number;
    trips_scheduled: number;
    trips_on_demand: number;
    filling_points: number;
    _undated_note: string;
  };
  on_demand_split: {
    rows_in_scope: number;
    rows_in_scope_pct: number;
    trips_scheduled: number;
    trips_on_demand: number;
    on_demand_share_pct: number;
    _scope_note: string;
  };
  coverage: { from: string; to: string; _note: string };
  daily: { date: string; deliveries: number }[];
  busiest_day: { date: string; deliveries: number };
  filling_points: {
    point: string;
    deliveries: number;
    deliveries_dated: number;
    days_reporting: number;
    mean_per_dated_day: number;
  }[];
  prabhags: { ward: string; deliveries: number }[];
  outside_corporation: {
    label: string;
    deliveries: number;
    share_of_ward_attributed_pct: number;
    _finding: string;
  };
  data_quality: {
    rows_with_prabhag_pct: number;
    rows_with_vehicle_pct: number;
    trip_cells_rejected: number;
    registers_unparsed: number;
    registers_undated: number;
    _note: string;
  };
};

const nf = new Intl.NumberFormat("en-IN");

/** "2026-04-17" -> "17 Apr 2026". Dates here are always ISO from the producer. */
function d(iso: string): string {
  const [y, m, day] = iso.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${Number(day)} ${months[Number(m) - 1]} ${y}`;
}

function Card({ label, value, sub }: { label: string; value: string; sub: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{value}</div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{sub}</div>
    </div>
  );
}

export function TankerDeliveryRegisterPanel({
  register,
  cityDisplayName,
}: {
  register: TankerDeliveryRegister;
  cityDisplayName: string;
}) {
  const {
    totals,
    on_demand_split: split,
    coverage,
    filling_points,
    prabhags,
    outside_corporation: outside,
    data_quality: dq,
    busiest_day: busiest,
  } = register;

  const maxPoint = Math.max(...filling_points.map((p) => p.deliveries));
  const maxWard = Math.max(...prabhags.map((p) => p.deliveries));
  const scheduledPct = Math.max(0, 100 - split.on_demand_share_pct);
  // Named separately from the prabhag list because it is not a prabhag: PMC
  // excluded this area from the corporation in 2024 and kept sending tankers.
  const wardRows = prabhags.slice(0, 12);

  return (
    <div className="space-y-6">
      {/* Headline counters. The split leads; volume is context. */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          label="Unscheduled share of trips"
          value={`${split.on_demand_share_pct}%`}
          sub={`on demand rather than on a rota, across ${nf.format(split.rows_in_scope)} rows`}
        />
        <Card
          label="Deliveries recorded"
          value={nf.format(totals.deliveries)}
          sub={`one row per tanker sent, ${d(coverage.from)} to ${d(coverage.to)}`}
        />
        <Card
          label="Tankers in the fleet"
          value={nf.format(totals.distinct_vehicles)}
          sub={`distinct vehicle numbers across ${totals.filling_points} filling points`}
        />
        <Card
          label="Busiest recorded day"
          value={nf.format(busiest.deliveries)}
          sub={`deliveries city-wide on ${d(busiest.date)}`}
        />
      </section>

      {/* The finding. */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Most of this water was not planned for
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          {cityDisplayName} is one of the few Indian cities where the
          corporation runs the tanker fleet itself and publishes the dispatch
          record - a spreadsheet per filling point per working day, one row per
          tanker sent. It is not a booking system and not a survey: it is what
          the fleet actually did. Each row records whether the trip was{" "}
          <em>scheduled</em>, meaning a known supply gap being serviced on a
          rota, or <em>on demand</em>, meaning somebody rang. {split.on_demand_share_pct}%
          of trips are on demand. A city meeting known shortfalls on a rota
          would show the opposite ratio.
        </p>

        <div className="mt-4 space-y-1">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {nf.format(split.trips_on_demand)} on-demand trips
            </span>
            <span className="text-slate-500 dark:text-slate-400 tabular-nums">
              {nf.format(split.trips_scheduled)} scheduled
            </span>
          </div>
          <div className="flex h-6 rounded-sm overflow-hidden bg-slate-100 dark:bg-slate-800">
            <div
              className="bg-amber-600/80 h-full"
              style={{ width: `${split.on_demand_share_pct}%` }}
              title={`On demand: ${nf.format(split.trips_on_demand)} trips`}
            />
            <div
              className="bg-blue-600/80 h-full"
              style={{ width: `${scheduledPct}%` }}
              title={`Scheduled: ${nf.format(split.trips_scheduled)} trips`}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 leading-snug">
            {split._scope_note}
          </p>
        </div>
      </section>

      {/* Tankers to the area the corporation removed. */}
      <section className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {nf.format(outside.deliveries)} deliveries to an area that is no longer
          in the corporation
        </h2>
        <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-1 leading-relaxed">
          {outside.deliveries.toLocaleString("en-IN")} deliveries -{" "}
          {outside.share_of_ward_attributed_pct}% of everything with a ward
          attached - are booked in PMC&apos;s own register to{" "}
          <strong>{outside.label}</strong> rather than to a prabhag. The tankers
          did not stop at the new boundary. Kept here as its own line rather
          than folded into a ward number, because it is not a ward.
        </p>
      </section>

      {/* Filling points. */}
      <section>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
          Where the tankers fill
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          Two points carry most of the load. The mean is over the days a point
          could be dated, not over the whole window, which is why a point with
          few reporting days can show a high daily mean.
        </p>
        <div className="space-y-2">
          {filling_points.map((p) => (
            <div key={p.point} className="space-y-1">
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="font-medium text-slate-700 dark:text-slate-300">{p.point}</span>
                <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                  {nf.format(p.deliveries)} deliveries · {p.mean_per_dated_day}/day over{" "}
                  {p.days_reporting} dated {p.days_reporting === 1 ? "day" : "days"}
                </span>
              </div>
              <div className="h-4 rounded-sm bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-sm bg-blue-600/70"
                  style={{ width: `${(p.deliveries / maxPoint) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Prabhags - partial by construction, and labelled so. */}
      <section>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
          Deliveries by prabhag: a partial attribution
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          The prabhag column is filled on {dq.rows_with_prabhag_pct}% of rows, so
          this is <strong>not a ward ranking</strong> and the order below should
          not be read as which prabhag is worst served. A ward can be low here
          because its deliveries were recorded without a prabhag. Showing the
          top {wardRows.length} of {prabhags.length} that appear at all.
        </p>
        <div className="space-y-2">
          {wardRows.map((w) => (
            <div key={w.ward} className="space-y-1">
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Prabhag {w.ward}
                </span>
                <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                  {nf.format(w.deliveries)}
                </span>
              </div>
              <div className="h-3 rounded-sm bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-sm bg-slate-400 dark:bg-slate-500"
                  style={{ width: `${(w.deliveries / maxWard) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Honest gaps. This is the section that stops the numbers above being
          over-read, so it is rendered rather than left to the About page. */}
      <section className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          What this data does not tell you
        </h2>
        <p>
          <strong>
            {nf.format(totals.deliveries_undated)} of {nf.format(totals.deliveries)} rows
            cannot be dated.
          </strong>{" "}
          {totals._undated_note} So there is no usable daily demand series here,
          only {totals.distinct_days} days that could be dated at all, and every
          per-day figure on this page is computed over that subset rather than
          the whole register.
        </p>
        <p>{coverage._note}</p>
        <p>
          <strong>No volumes.</strong> The register counts tanker trips, not
          litres. Tanker capacity is not recorded on the row, so the water this
          represents cannot be totalled without assuming a load size that PMC
          does not publish.
        </p>
        <p>
          <strong>No recipients, by choice.</strong> The source rows carry
          society names, street addresses and phone numbers. None of that is
          republished, and it is not in the artifact behind this page. That is
          deliberately stricter than the treatment of a bulk-sales ledger, where
          the buyers are companies purchasing at a published tariff: these
          recipients are private housing societies, and naming one alongside its
          address publishes where identifiable residents do not have water.
        </p>
        <p>
          <strong>Only what PMC itself sent.</strong> Pune has a private tanker
          market alongside this one and no public record of it exists, so this is
          the floor on tanker dependence rather than the total.
        </p>
        <p>
          {dq.registers_unparsed > 0 && (
            <>
              {dq.registers_unparsed} of {totals.registers_published} published
              registers could not be parsed and are excluded.{" "}
            </>
          )}
          {nf.format(dq.trip_cells_rejected)} trip cells held a misaligned
          vehicle number rather than a count and were rejected rather than summed;
          summing them naively would have reported millions of trips against{" "}
          {nf.format(totals.deliveries)} rows.
        </p>
        <p className="pt-1 text-[11px]">
          Source:{" "}
          <a
            href={register._source_url}
            className="text-blue-600 dark:text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {register._source}
          </a>{" "}
          · fetched {register._fetched} · aggregated on build, published as
          counts only
        </p>
      </section>
    </div>
  );
}

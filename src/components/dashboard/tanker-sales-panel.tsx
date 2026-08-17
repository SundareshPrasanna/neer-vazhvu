/**
 * Tanker page, "utility-sales-ledger" variant.
 *
 * The third kind, and the one with prices AND a census. Bengaluru's survey
 * panel answers "what do households PAY?" because that market is private and
 * RTI-gated. Hyderabad's ledger panel answers "who ASKS, and when?" because
 * HMWSSB runs the fleet but records no tariff. Gurugram is neither: GMDA sells
 * bulk water by the tanker load from seven named points, at a published tariff
 * that differs by water grade, to buyers it names - so this panel answers
 * "what did the utility SELL, to whom, and at what price?"
 *
 * Deliberate editorial choice, and it is the whole design of this page:
 * VOLUME IS NOT THE HEADLINE. Bookings fall 12,337 to 7,208 across 2019-2021,
 * which reads as falling tanker dependence and is not safe to read that way -
 * this is a construction-driven market and 2020-21 are COVID years. The
 * finding that survives the confound is compositional, because it is a ratio
 * measured inside the same disrupted period: non-potable share rises 29.7% ->
 * 42.2% -> 51.2% against tariffs stable to the decimal. So the composition
 * shift leads, the volume series is shown with its caveat attached, and the
 * caveat is rendered rather than buried in About.
 */

import type { ReactNode } from "react";

export type TankerSales = {
  _source: string;
  _source_url: string;
  _licence: string;
  _fetched: string;
  _note: string;
  _coverage_gap: string;
  _caveats: string[];
  totals: {
    bookings: number;
    litres: number;
    amount_inr: number;
    years: number;
    months: number;
    buyers: number;
    delivery_sites: number;
    stations: number;
    first_booking: string;
    last_booking: string;
    non_potable_pct_first_year: number | null;
    non_potable_pct_last_year: number | null;
  };
  by_year: {
    year: number;
    bookings: number;
    litres: number;
    amount_inr: number;
    buyers: number;
    non_potable_litres: number;
    non_potable_pct: number | null;
    rows_rejected: number;
  }[];
  water_types: {
    water_type: string;
    potable: boolean;
    bookings: number;
    litres: number;
    amount_inr: number;
    rate_inr_per_kl: number | null;
    by_year: { year: number; litres: number; rate_inr_per_kl: number | null }[];
  }[];
  stations: {
    station: string;
    bookings: number;
    litres: number;
    water_types: string[];
    years: number[];
    active_all_years: boolean;
  }[];
  top_buyers: {
    buyer: string;
    bookings: number;
    litres: number;
    share_pct: number | null;
    potable_pct: number | null;
  }[];
};

const nf = new Intl.NumberFormat("en-IN");

/** Litres are the natural unit upstream but unreadable at 10^9. */
function ml(litres: number): string {
  return `${nf.format(Math.round(litres / 1_000_000))} ML`;
}

function crore(rupees: number): string {
  return `Rs ${(rupees / 10_000_000).toFixed(2)} Cr`;
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

export function TankerSalesPanel({
  sales,
  cityDisplayName,
}: {
  sales: TankerSales;
  cityDisplayName: string;
}) {
  const { totals, by_year, water_types, stations, top_buyers } = sales;

  const first = by_year[0];
  const last = by_year[by_year.length - 1];
  const potable = water_types.find((t) => t.potable);
  const treated = water_types
    .filter((t) => !t.potable)
    .sort((a, b) => (a.rate_inr_per_kl ?? 0) - (b.rate_inr_per_kl ?? 0))[0];
  const priceRatio =
    potable?.rate_inr_per_kl && treated?.rate_inr_per_kl
      ? potable.rate_inr_per_kl / treated.rate_inr_per_kl
      : null;

  const maxYearLitres = Math.max(...by_year.map((y) => y.litres));
  const top3 = top_buyers.slice(0, 3).reduce((s, b) => s + b.litres, 0);

  return (
    <div className="space-y-6">
      {/* Headline counters. Composition first, volume second - see the file
          docstring for why the volume trend is not the headline. */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          label="Non-potable share of sales"
          value={`${first?.non_potable_pct ?? "-"}% → ${last?.non_potable_pct ?? "-"}%`}
          sub={`${first?.year} to ${last?.year}, by volume`}
        />
        <Card
          label="Water sold by tanker"
          value={ml(totals.litres)}
          sub={`${nf.format(totals.bookings)} loads over ${totals.months} months`}
        />
        <Card
          label="Revenue"
          value={crore(totals.amount_inr)}
          sub={`across ${nf.format(totals.buyers)} buyers and ${totals.stations} dispensing points`}
        />
        <Card
          label="Potable vs treated price"
          value={priceRatio ? `${priceRatio.toFixed(1)}x` : "-"}
          sub={
            potable && treated
              ? `Rs ${potable.rate_inr_per_kl}/kL against Rs ${treated.rate_inr_per_kl}/kL for ${treated.water_type.toLowerCase()}`
              : "tariffs unavailable"
          }
        />
      </section>

      {/* The finding. */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          What {cityDisplayName} sold, and how that changed
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          {cityDisplayName} sits on a Central Ground Water Authority dark zone,
          declared in 2008. Across these three years the share of bulk tanker
          water that was <em>not</em> drinking water rose from{" "}
          {first?.non_potable_pct}% to {last?.non_potable_pct}% - potable volume
          fell {first && last ? Math.round((1 - (last.litres - last.non_potable_litres) / (first.litres - first.non_potable_litres)) * 100) : "-"}%
          while treated and recycled volume held roughly flat. The tariffs did
          not move over the same period, so this is a change in what was sold
          rather than a change in what it cost.
        </p>

        <div className="mt-4 space-y-3">
          {by_year.map((y) => {
            const potableLitres = y.litres - y.non_potable_litres;
            return (
              <div key={y.year} className="space-y-1">
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                    {y.year}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                    {ml(y.litres)} · {y.non_potable_pct}% non-potable
                  </span>
                </div>
                <div
                  className="flex h-5 rounded-sm overflow-hidden bg-slate-100 dark:bg-slate-800"
                  style={{ width: `${(y.litres / maxYearLitres) * 100}%` }}
                >
                  <div
                    className="bg-blue-600/80 h-full"
                    style={{ width: `${(potableLitres / y.litres) * 100}%` }}
                    title={`Potable ${ml(potableLitres)}`}
                  />
                  <div
                    className="bg-emerald-600/80 h-full"
                    style={{ width: `${(y.non_potable_litres / y.litres) * 100}%` }}
                    title={`Treated + recycled ${ml(y.non_potable_litres)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-600/80" /> Potable
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-600/80" /> Treated + recycled
          </span>
        </div>
      </section>

      {/* The caveat that must travel with the volume series, rendered rather
          than buried in About. */}
      <section className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <strong className="font-semibold">Read the falling volume carefully.</strong>{" "}
        Total loads drop from {nf.format(by_year[0]?.bookings ?? 0)} in{" "}
        {by_year[0]?.year} to {nf.format(last?.bookings ?? 0)} in {last?.year}, but
        that is not evidence of falling tanker dependence. This is a
        construction-driven market and {by_year[1]?.year}-{last?.year} are COVID
        years, when building stopped. The composition shift above is the
        finding that survives, because it is a ratio measured inside the same
        disrupted period.
      </section>

      {/* Tariff by grade. */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          What each grade costs
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          GMDA&apos;s own tariff, unchanged to the decimal across all three years.
        </p>
        <table className="w-full text-xs mt-3">
          <thead>
            <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left font-medium py-1">Water grade</th>
              <th className="text-right font-medium py-1">Rs / kL</th>
              <th className="text-right font-medium py-1">Volume</th>
              <th className="text-right font-medium py-1">Loads</th>
            </tr>
          </thead>
          <tbody>
            {water_types.map((t) => (
              <tr
                key={t.water_type}
                className="border-b border-slate-100 dark:border-slate-800"
              >
                <td className="py-1 text-slate-700 dark:text-slate-300">
                  {t.water_type}
                  {t.potable && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400">
                      drinking
                    </span>
                  )}
                </td>
                <td className="py-1 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                  {t.rate_inr_per_kl ?? "-"}
                </td>
                <td className="py-1 text-right text-slate-500 tabular-nums">{ml(t.litres)}</td>
                <td className="py-1 text-right text-slate-500 tabular-nums">
                  {nf.format(t.bookings)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Who buys it. */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Who buys it
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          The three largest buyers alone took{" "}
          {((top3 / totals.litres) * 100).toFixed(1)}% of everything sold. This
          is a bulk market of developers, contractors and industry, not a
          household one - GMDA sells tanker water to construction sites and
          factories, and the publisher names them.
        </p>
        <table className="w-full text-xs mt-3">
          <thead>
            <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left font-medium py-1">Buyer</th>
              <th className="text-right font-medium py-1">Volume</th>
              <th className="text-right font-medium py-1">Share</th>
              <th className="text-right font-medium py-1">Potable</th>
            </tr>
          </thead>
          <tbody>
            {top_buyers.map((b) => (
              <tr key={b.buyer} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1 text-slate-700 dark:text-slate-300">{b.buyer}</td>
                <td className="py-1 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                  {ml(b.litres)}
                </td>
                <td className="py-1 text-right text-slate-500 tabular-nums">
                  {b.share_pct ?? "-"}%
                </td>
                <td className="py-1 text-right text-slate-500 tabular-nums">
                  {b.potable_pct ?? "-"}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Dispensing points. */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Where it is dispensed
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Two of these are water works and boosting stations; the rest are
          sewage and effluent treatment plants selling their output. Points
          that stopped reporting are marked, rather than smoothed away.
        </p>
        <table className="w-full text-xs mt-3">
          <thead>
            <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left font-medium py-1">Dispensing point</th>
              <th className="text-right font-medium py-1">Volume</th>
              <th className="text-right font-medium py-1">Years active</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <tr key={s.station} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1 text-slate-700 dark:text-slate-300">
                  {s.station}
                  {!s.active_all_years && (
                    <span className="ml-2 text-[10px] text-amber-700 dark:text-amber-500">
                      stopped reporting
                    </span>
                  )}
                </td>
                <td className="py-1 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                  {ml(s.litres)}
                </td>
                <td className="py-1 text-right text-slate-500 tabular-nums">
                  {s.years.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Honest gaps. */}
      <section className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          What this data does not tell you
        </h2>
        <p>{sales._coverage_gap}</p>
        {sales._caveats.map((c) => (
          <p key={c.slice(0, 40)}>{c}</p>
        ))}
        <p>
          It also covers only what GMDA itself sold. Gurugram has a private
          tanker market alongside this one, and no public record of it exists -
          so this is the floor on tanker dependence, not the total.
        </p>
        <p className="pt-1 text-[11px]">
          Source:{" "}
          <a
            href={sales._source_url}
            className="text-blue-600 dark:text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {sales._source}
          </a>{" "}
          · fetched {sales._fetched} · aggregated on build, not republished
        </p>
      </section>
    </div>
  );
}

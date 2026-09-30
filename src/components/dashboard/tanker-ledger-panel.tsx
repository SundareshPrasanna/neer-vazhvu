/**
 * Tanker page, "utility-ledger" variant.
 *
 * The household-survey variant (TankerMarketPanel, Bengaluru) answers "what do
 * households PAY?" because that market is private and RTI-gated. Hyderabad is
 * the opposite case: HMWSSB runs the tanker fleet itself and publishes its own
 * booking/delivery ledger per division and section. So this panel answers a
 * different question - "who ASKS for tankers, and when?" - and must not borrow
 * the survey page's price framing.
 *
 * Every number and date range here is read from the ledger, which is rebuilt
 * when HMWSSB publishes a month, so nothing on this panel is typed in. The
 * first counter is the latest month. Section rankings are per era: HMWSSB
 * re-cut its divisions and sections in February 2026.
 */

type Section = { section: string; division: string; bookings: number; delivered: number; shortfall: number; months_reporting: number };
type Era = {
  id: string;
  from: string;
  to: string;
  months: number;
  bookings: number;
  delivered: number;
  sections: Section[];
  divisions: { division: string; bookings: number; delivered: number; sections: number }[];
};

export type TankerLedger = {
  _source: string;
  _source_url: string;
  _licence: string;
  _fetched: string;
  _note: string;
  _coverage: string;
  totals: { bookings: number; delivered: number; shortfall: number; fulfilment_pct: number; months: number };
  monthly: { month: string; label: string; bookings: number; delivered: number; sections_reporting: number }[];
  seasonality: { month: number; label: string; mean_bookings: number; years: number }[];
  eras: Era[];
  _empty_upstream_months?: string[];
};

const nf = new Intl.NumberFormat("en-IN");

function pct(part: number, whole: number): string {
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export function TankerLedgerPanel({
  ledger,
  cityDisplayName,
}: {
  ledger: TankerLedger;
  cityDisplayName: string;
}) {
  const { totals, seasonality, eras, monthly } = ledger;
  const latest = monthly[monthly.length - 1];
  const share = (m: { bookings: number; delivered: number }) => (m.delivered / m.bookings) * 100;

  const peak = seasonality.reduce((a, b) => (b.mean_bookings > a.mean_bookings ? b : a));
  const trough = seasonality.reduce((a, b) => (b.mean_bookings < a.mean_bookings ? b : a));
  const swing = peak.mean_bookings / trough.mean_bookings;
  const maxSeason = peak.mean_bookings;

  // Calendar years with all twelve months, for a like-for-like yearly total.
  const byYear = new Map<string, { n: number; bookings: number }>();
  for (const m of monthly) {
    const y = byYear.get(m.month.slice(0, 4)) ?? { n: 0, bookings: 0 };
    byYear.set(m.month.slice(0, 4), { n: y.n + 1, bookings: y.bookings + m.bookings });
  }
  const fullYears = [...byYear].filter(([, y]) => y.n === 12);
  const [firstYear, lastYear] = [fullYears[0], fullYears[fullYears.length - 1]];

  // Months where under 95% of bookings are recorded as delivered.
  const low = monthly.filter((m) => share(m) < 95);
  const before = low.length ? monthly.slice(0, monthly.indexOf(low[0])) : monthly;
  const floor = Math.floor(Math.min(...before.map(share)));

  return (
    <div className="space-y-6">
      {/* Headline counters: the latest month first */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `Bookings in ${latest.label}`, value: nf.format(latest.bookings), sub: `${share(latest).toFixed(1)}% recorded as delivered` },
          { label: "Bookings in the series", value: nf.format(totals.bookings), sub: `${totals.months} months, ${monthly[0].label} to ${latest.label}` },
          lastYear && firstYear !== lastYear
            ? { label: `Bookings in ${lastYear[0]}`, value: nf.format(lastYear[1].bookings), sub: `${(lastYear[1].bookings / firstYear[1].bookings).toFixed(1)}x the ${firstYear[0]} total` }
            : { label: "Delivered over the series", value: `${share(totals).toFixed(2)}%`, sub: `${nf.format(totals.shortfall)} not recorded as delivered` },
          { label: "Peak-to-trough swing", value: `${swing.toFixed(1)}x`, sub: `${peak.label} against ${trough.label}, mean over ${peak.years} full years` },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{c.value}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{c.sub}</div>
          </div>
        ))}
      </section>

      {/* Delivered share, stated as published */}
      <section className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40 p-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <strong className="font-semibold">Bookings recorded as delivered.</strong>{" "}
        Over the series, {nf.format(totals.delivered)} of {nf.format(totals.bookings)} bookings
        ({share(totals).toFixed(2)}%) are recorded as delivered.{" "}
        {low.length > 0 ? (
          <>
            The monthly share was {floor}% or higher in every month before {low[0].label}. It reads{" "}
            {low.slice(-6).map((m) => `${share(m).toFixed(1)}% for ${m.label}`).join(", ")}. The
            portal does not say whether the other bookings were cancelled, were still pending or
            were delivered in a later month.
          </>
        ) : (
          <>The monthly share is {floor}% or higher in every month.</>
        )}{" "}
        This share counts whether a booked tanker is recorded as delivered. It does not show
        whether a household needed one, could pay for one, or received piped water instead.
      </section>

      {/* Seasonality */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          When {cityDisplayName} books tankers
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Mean bookings per calendar month over {peak.years} full calendar years. Bookings
          peak in {peak.label} at {nf.format(peak.mean_bookings)} and are lowest in{" "}
          {trough.label} at {nf.format(trough.mean_bookings)}, a {swing.toFixed(1)}x swing
          between the hot season and the months after the monsoon.
        </p>
        <div className="mt-4 space-y-1.5">
          {seasonality.map((m) => (
            <div key={m.month} className="flex items-center gap-2">
              <div className="w-9 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{m.label}</div>
              <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-sm ${m.month === peak.month ? "bg-red-500" : "bg-blue-500/70"}`}
                  style={{ width: `${(m.mean_bookings / maxSeason) * 100}%` }}
                />
              </div>
              <div className="w-16 text-right text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                {nf.format(m.mean_bookings)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Geographic concentration, one block per section scheme */}
      {eras.map((era) => {
        const top = era.sections.slice(0, 10);
        const top3 = top.slice(0, 3).reduce((n, x) => n + x.bookings, 0);
        const recut = era.id === "post_recut";
        return (
          <section key={era.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Where the demand sits, {era.from} to {era.to}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {recut ? (
                <>
                  HMWSSB re-cut its divisions and sections in February 2026. Its files since then
                  list old and new sections side by side, some marked (OLD) or (NEW). Rows are
                  shown as published and are not added to the earlier table.
                </>
              ) : (
                <>
                  The three busiest sections, {top[0].section}, {top[1].section} and{" "}
                  {top[2].section}, account for {pct(top3, era.bookings)} of the{" "}
                  {nf.format(era.bookings)} bookings in these {era.months} months. They sit in the
                  western IT corridor, not the historic core.
                </>
              )}
            </p>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                { title: "Top sections", head: ["Section", "Div"], rows: top.map((x) => [x.section, x.division, x.bookings] as const) },
                { title: "Top divisions", head: ["Division", "Sections"], rows: era.divisions.slice(0, 6).map((d) => [`Division ${d.division}`, d.sections, d.bookings] as const) },
              ].map((t) => (
                <div key={t.title}>
                  <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">{t.title}</h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left font-medium py-1">{t.head[0]}</th>
                        <th className="text-right font-medium py-1">{t.head[1]}</th>
                        <th className="text-right font-medium py-1">Bookings</th>
                        <th className="text-right font-medium py-1">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.rows.map(([name, second, bookings]) => (
                        <tr key={`${name}-${second}`} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-1 text-slate-700 dark:text-slate-300">{name}</td>
                          <td className="py-1 text-right text-slate-500 tabular-nums">{second}</td>
                          <td className="py-1 text-right text-slate-700 dark:text-slate-300 tabular-nums">{nf.format(bookings)}</td>
                          <td className="py-1 text-right text-slate-500 tabular-nums">{pct(bookings, era.bookings)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Honest gaps */}
      <section className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          What this data does not tell you
        </h2>
        <p>
          <strong>No prices.</strong> HMWSSB publishes bookings and deliveries,
          not what a household paid. Unlike Bengaluru, we cannot show a tanker
          price for {cityDisplayName} - and the private tanker market that
          operates alongside the utility fleet is not in this ledger at all.
        </p>
        <p>
          <strong>Sections are not wards.</strong> &quot;Section&quot; is HMWSSB&apos;s own
          operational unit, not a GHMC ward, and no public mapping between the
          two exists. Booking counts therefore cannot be joined to ward
          population or to any equity denominator.
        </p>
        <p>
          <strong>Coverage.</strong> {ledger._coverage}
        </p>
        {ledger._empty_upstream_months && ledger._empty_upstream_months.length > 0 && (
          <p>
            <strong>Empty upstream file{ledger._empty_upstream_months.length > 1 ? "s" : ""}:</strong>{" "}
            {ledger._empty_upstream_months.join("; ")} - published but containing
            no rows, so {monthly.length} of {monthly.length + ledger._empty_upstream_months.length} months in
            the window carry data.
          </p>
        )}
        <p className="pt-1 border-t border-slate-200 dark:border-slate-700">
          Source:{" "}
          <a
            href={ledger._source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {ledger._source}
          </a>{" "}
          - {ledger._licence}. Retrieved {ledger._fetched}.
        </p>
      </section>
    </div>
  );
}

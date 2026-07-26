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
 * Deliberate editorial choice: fulfilment is NOT the headline. It sits at
 * 99.95% (593 undelivered out of 1.32 million bookings), which is a flat,
 * uninformative number. The signal is demand volume, seasonality and
 * geographic concentration.
 */

export type TankerLedger = {
  _source: string;
  _source_url: string;
  _licence: string;
  _fetched: string;
  _note: string;
  _coverage_gap: string;
  totals: {
    bookings: number;
    delivered: number;
    shortfall: number;
    fulfilment_pct: number;
    months: number;
    sections: number;
  };
  monthly: { month: string; label: string; bookings: number; delivered: number; sections_reporting: number }[];
  seasonality: { month: number; label: string; mean_bookings: number; years: number }[];
  divisions: { division: string; bookings: number; delivered: number; sections: number }[];
  sections: { section: string; division: string; bookings: number; delivered: number; shortfall: number; months_reporting: number }[];
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
  const { totals, seasonality, divisions, sections, monthly } = ledger;

  const peak = seasonality.reduce((a, b) => (b.mean_bookings > a.mean_bookings ? b : a));
  const trough = seasonality.reduce((a, b) => (b.mean_bookings < a.mean_bookings ? b : a));
  const swing = peak.mean_bookings / trough.mean_bookings;
  const maxSeason = peak.mean_bookings;

  // Computed here rather than read from totals.fulfilment_pct: the upstream
  // field is pre-rounded to 100.0, which reads as "nothing was missed" when
  // 593 bookings went undelivered. Two decimals keep the shortfall visible.
  const fulfilment = (totals.delivered / totals.bookings) * 100;

  const topSections = [...sections].sort((a, b) => b.bookings - a.bookings).slice(0, 10);
  const topDivisions = [...divisions].sort((a, b) => b.bookings - a.bookings).slice(0, 6);
  const top3 = topSections.slice(0, 3).reduce((s, x) => s + x.bookings, 0);

  return (
    <div className="space-y-6">
      {/* Headline counters */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Tanker bookings", value: nf.format(totals.bookings), sub: `${totals.months} months, Jan 2022 - Feb 2024` },
          { label: "Peak-to-trough swing", value: `${swing.toFixed(2)}x`, sub: `${peak.label} vs ${trough.label}, mean bookings` },
          { label: "HMWSSB sections", value: nf.format(totals.sections), sub: `across ${divisions.length} divisions` },
          { label: "Delivered", value: `${fulfilment.toFixed(2)}%`, sub: `${nf.format(totals.shortfall)} undelivered of ${nf.format(totals.bookings)}` },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{c.value}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{c.sub}</div>
          </div>
        ))}
      </section>

      {/* Why fulfilment is not the story */}
      <section className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <strong className="font-semibold">Read the fulfilment rate carefully.</strong>{" "}
        HMWSSB delivered {fulfilment.toFixed(2)}% of bookings over this
        period - {nf.format(totals.shortfall)} undelivered out of{" "}
        {nf.format(totals.bookings)}. That is a near-flat number and we do not
        headline it: it measures whether a booked tanker arrived, not whether a
        household needed one, could afford one, or got piped water instead. The
        informative signals here are how much demand there is, when it spikes,
        and where it concentrates.
      </section>

      {/* Seasonality */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          When {cityDisplayName} books tankers
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Mean bookings per calendar month across the series. Demand peaks in{" "}
          {peak.label} at {nf.format(peak.mean_bookings)} and falls to{" "}
          {nf.format(trough.mean_bookings)} in {trough.label}: a{" "}
          {swing.toFixed(2)}x swing between the hot-season peak and the
          post-monsoon trough. Bookings climb from February and stay high
          through June, then collapse once the monsoon is established.
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

      {/* Geographic concentration */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Where the demand sits
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          The three busiest sections - {topSections[0].section},{" "}
          {topSections[1].section} and {topSections[2].section}, all in Division{" "}
          {topSections[0].division} - account for {pct(top3, totals.bookings)} of every
          tanker booked in the city. This is the IT corridor, not the historic
          core.
        </p>

        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
              Top sections
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left font-medium py-1">Section</th>
                  <th className="text-right font-medium py-1">Div</th>
                  <th className="text-right font-medium py-1">Bookings</th>
                  <th className="text-right font-medium py-1">Share</th>
                </tr>
              </thead>
              <tbody>
                {topSections.map((s) => (
                  <tr key={`${s.division}-${s.section}`} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1 text-slate-700 dark:text-slate-300">{s.section}</td>
                    <td className="py-1 text-right text-slate-500 tabular-nums">{s.division}</td>
                    <td className="py-1 text-right text-slate-700 dark:text-slate-300 tabular-nums">{nf.format(s.bookings)}</td>
                    <td className="py-1 text-right text-slate-500 tabular-nums">{pct(s.bookings, totals.bookings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
              Top divisions
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left font-medium py-1">Division</th>
                  <th className="text-right font-medium py-1">Sections</th>
                  <th className="text-right font-medium py-1">Bookings</th>
                  <th className="text-right font-medium py-1">Share</th>
                </tr>
              </thead>
              <tbody>
                {topDivisions.map((d) => (
                  <tr key={d.division} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1 text-slate-700 dark:text-slate-300">Division {d.division}</td>
                    <td className="py-1 text-right text-slate-500 tabular-nums">{d.sections}</td>
                    <td className="py-1 text-right text-slate-700 dark:text-slate-300 tabular-nums">{nf.format(d.bookings)}</td>
                    <td className="py-1 text-right text-slate-500 tabular-nums">{pct(d.bookings, totals.bookings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

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
          <strong>The series stops.</strong> {ledger._coverage_gap}
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

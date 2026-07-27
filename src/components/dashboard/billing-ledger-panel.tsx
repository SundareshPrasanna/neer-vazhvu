/**
 * HMWSSB billing ledger panel, mounted under the tanker page.
 *
 * It sits here rather than on the allocations page for a reason. Allocations is
 * a WATER ledger - entitlements in TMC against receipts in MLD. Billing is
 * money, and putting revenue rows into that frame would blur it. What billing
 * DOES share with the tanker ledger is the operational geography: both key on
 * HMWSSB division and section, so the two can be read against each other and
 * 198 of 201 tanker sections join exactly.
 *
 * The join yields tanker bookings per piped connection. Read the caution below
 * before reading the table: this is NOT a deprivation map.
 */

export type BillingLedger = {
  _source: string;
  _source_url: string;
  _licence: string;
  _note: string;
  _caveats: string[];
  totals: {
    months: number;
    rows: number;
    demand: number;
    collection: number;
    collection_pct: number | null;
    divisions: number;
    sections: number;
  };
  monthly: { month: string; label: string; demand: number; collection: number; collection_pct: number | null; connections: number }[];
  divisions: { era: string; division: string; demand: number; collection: number; collection_pct: number | null; connections_last_known: number; connections_as_of: string | null }[];
  sections: { era: string; division: string; section: string; demand: number; collection: number; collection_pct: number | null; connections_last_known: number; connections_as_of: string | null }[];
};

export type TankerSection = { section: string; division: string; bookings: number };

const nf = new Intl.NumberFormat("en-IN");

/** The dataset states no unit for its money columns. Division settles it:
 *  Jun 2026 billed 1,478,622,872 across 1,546,853 connections, which is 956 per
 *  connection per month. As rupees that is an ordinary water bill. As thousands
 *  it would be 9.56 lakh per connection per month, as lakhs 9.56 crore - both
 *  impossible. So we render rupees, and say on the page that it is an inference
 *  from magnitude rather than a stated unit. */
function crore(rupees: number): string {
  return `${nf.format(Math.round(rupees / 1e7))} crore`;
}

export function BillingLedgerPanel({
  billing,
  tankerSections,
  cityDisplayName,
}: {
  billing: BillingLedger;
  tankerSections: TankerSection[];
  cityDisplayName: string;
}) {
  const t = billing.totals;
  const first = billing.monthly[0];
  const last = billing.monthly[billing.monthly.length - 1];

  // Join on (division, section). Only the pre-recut era is comparable: the
  // tanker series ends Feb 2024 and HMWSSB re-cut its section scheme in Feb 2026.
  const bill = new Map(
    billing.sections
      .filter((s) => s.era === "pre_recut")
      .map((s) => [`${s.division}|${s.section.trim().toUpperCase()}`, s]),
  );
  const joined = tankerSections
    .map((ts) => {
      const m = bill.get(`${ts.division}|${ts.section.trim().toUpperCase()}`);
      if (!m || !m.connections_last_known) return null;
      return {
        section: ts.section,
        division: ts.division,
        bookings: ts.bookings,
        connections: m.connections_last_known,
        as_of: m.connections_as_of,
        per_connection: ts.bookings / m.connections_last_known,
      };
    })
    .filter(Boolean) as {
      section: string; division: string; bookings: number;
      connections: number; as_of: string | null; per_connection: number;
    }[];
  joined.sort((a, b) => b.per_connection - a.per_connection);
  const maxPer = joined[0]?.per_connection ?? 1;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          What the utility bills, and what it collects
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
          HMWSSB publishes its own billing ledger monthly, on the same division and
          section units as the tanker record above. That makes the two comparable -
          the only city on this platform where a utility&apos;s billed base and its
          tanker demand can be read against each other.
        </p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Collection rate", value: `${t.collection_pct?.toFixed(1)}%`,
            sub: `${first?.label} to ${last?.label}, ${t.months} months` },
          { label: "Billed per year", value: `Rs ${crore((t.demand / t.months) * 12)}`,
            sub: `Rs ${crore(t.demand)} across the whole ${t.months} months` },
          { label: "Uncollected per year", value: `Rs ${crore(((t.demand - t.collection) / t.months) * 12)}`,
            sub: `Rs ${crore(t.demand - t.collection)} across the whole period` },
          { label: "Connections", value: nf.format(last?.connections ?? 0),
            sub: `from ${nf.format(first?.connections ?? 0)} in ${first?.label}` },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{c.value}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{c.sub}</div>
          </div>
        ))}
      </section>

      <section className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-1.5">
        <p>
          <strong className="font-semibold">These are rupees, but HMWSSB does not say so.</strong>{" "}
          The dataset labels its columns only &quot;total demand&quot; and &quot;total amount
          collected&quot;, with no unit anywhere. Division settles it: in {last?.label} the board
          billed {nf.format(Math.round((last?.demand ?? 0)))} across{" "}
          {nf.format(last?.connections ?? 0)} connections, which is{" "}
          <strong>
            about Rs {nf.format(Math.round((last?.demand ?? 0) / (last?.connections || 1)))} per
            connection per month
          </strong>
          . As rupees that is an ordinary water bill. As thousands it would be over nine lakh a
          month per connection, as lakhs over nine crore. So rupees is the only reading that
          survives, and we state it as an inference from magnitude rather than as a published unit.
        </p>
        <p>
          Figures are shown in crore for legibility. The underlying file keeps the raw published
          numbers with no conversion applied.
        </p>
      </section>

      {joined.length > 0 && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Tanker bookings per piped connection
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
            {joined.length} of {tankerSections.length} tanker sections join to the billing ledger on
            division and section. Bookings are the full tanker series; connections are the last month
            each section reported them, dated per row.
          </p>

          {/* The caution has to come BEFORE the table. */}
          <div className="mt-3 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <strong className="font-semibold">This is not a deprivation map. Read it the other way round.</strong>{" "}
            The highest rates sit in {joined[0].section.split("(")[0].trim()}, Jubilee Hills and Banjara
            Hills - the IT corridor and the affluent west, not the historic core. HMWSSB tankers are paid
            for, and booking one needs storage to receive it. So this measures where households can
            afford and accommodate tankers as much as where the pipe network falls short. A section at
            the bottom of this table is not necessarily well served; it may simply not be buying.
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left font-medium py-1">Section</th>
                  <th className="text-right font-medium py-1">Bookings</th>
                  <th className="text-right font-medium py-1">Connections</th>
                  <th className="text-right font-medium py-1">As of</th>
                  <th className="text-left font-medium py-1 pl-3 w-[30%]">Per connection</th>
                </tr>
              </thead>
              <tbody>
                {joined.slice(0, 20).map((r) => (
                  <tr key={`${r.division}-${r.section}`} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1 text-slate-700 dark:text-slate-300">{r.section}</td>
                    <td className="py-1 text-right tabular-nums text-slate-600 dark:text-slate-400">{nf.format(r.bookings)}</td>
                    <td className="py-1 text-right tabular-nums text-slate-600 dark:text-slate-400">{nf.format(r.connections)}</td>
                    <td className="py-1 text-right tabular-nums text-slate-400 text-[11px]">{r.as_of ?? "-"}</td>
                    <td className="py-1 pl-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                          <div className="h-full bg-blue-500/80 rounded-sm"
                               style={{ width: `${(r.per_connection / maxPer) * 100}%` }} />
                        </div>
                        <span className="w-12 text-right tabular-nums text-slate-600 dark:text-slate-400">
                          {r.per_connection.toFixed(2)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Showing the 20 highest of {joined.length} joined sections.
          </p>
        </section>
      )}

      <section className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          How to read this comparison
        </h3>
        <p>
          <strong>The two series do not cover the same window.</strong> Tanker bookings run to
          February 2024; connection counts are dated per row and can be later. The ratio is a rough
          intensity measure, not a rate for a fixed period.
        </p>
        <p>
          <strong>Only the pre-2026 section scheme is comparable.</strong> HMWSSB re-cut its
          divisions and sections in February 2026, so the join uses the earlier geography - the one
          the tanker series was recorded in.
        </p>
        {billing._caveats?.slice(0, 2).map((c) => <p key={c}>{c}</p>)}
        <p className="pt-1 border-t border-slate-200 dark:border-slate-700">
          Source:{" "}
          <a href={billing._source_url} target="_blank" rel="noopener noreferrer"
             className="text-blue-600 dark:text-blue-400 hover:underline">
            {billing._source}
          </a>{" "}
          - {billing._licence} Comparison built for {cityDisplayName} only, where both feeds share
          operational units.
        </p>
      </section>
    </div>
  );
}

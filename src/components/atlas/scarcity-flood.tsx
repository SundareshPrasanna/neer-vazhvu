/**
 * The hazard families rendered once, for both tiers: the state page prints
 * the full register (the scarcity week's table, the flood classification
 * with its quote), the district page prints its own row through the same
 * components. One component per feature - nothing is re-implemented per
 * page or per state.
 */
import {
  AtlasFinding,
  AtlasNote,
  AtlasTableScroll,
  StatTile,
  TABLE,
  TD,
  TH,
  THEAD,
  TR,
} from "@/components/atlas/atlas-primitives";
import type { DistrictFloodReading, DistrictScarcityReading, ScarcityWeek } from "@/lib/atlas/hazards";

const num = (value: number): string => Math.round(value).toLocaleString("en-IN");

/** The disaster plan's classification: sentence, quote, citation. */
export function FloodStatement({ reading }: { reading: DistrictFloodReading }) {
  return (
    <div>
      <AtlasFinding>{reading.sentence}</AtlasFinding>
      <blockquote className="mt-3 border-l-2 border-slate-300 dark:border-slate-600 pl-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        &ldquo;{reading.quote}&rdquo;
        <footer className="mt-1 text-xs text-slate-500 dark:text-slate-400">{reading.citation}</footer>
      </blockquote>
    </div>
  );
}

/** The district's week on the tanker register, as tiles plus the sentence. */
export function ScarcityDistrictRead({ reading }: { reading: DistrictScarcityReading }) {
  const { row, week } = reading;
  return (
    <div>
      <dl className="grid gap-4 sm:grid-cols-3">
        <StatTile
          value={num(row.tankersTotal)}
          label="Tankers this week"
          asOf={`week to ${week.weekEnd}`}
          note={`${num(row.tankersGovernment)} government, ${num(row.tankersPrivate)} private.`}
          primary={row.tankersTotal > 0}
        />
        <StatTile
          value={num(row.villages)}
          label="Villages on tankers"
          asOf={`week to ${week.weekEnd}`}
          note="Villages the report lists on tanker supply."
        />
        <StatTile
          value={num(row.wadis)}
          label="Wadis on tankers"
          asOf={`week to ${week.weekEnd}`}
          note="Hamlets (wadis and wastis) the report lists on tanker supply."
        />
      </dl>
      <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-200">
        {reading.sentence}
      </p>
    </div>
  );
}

/** The state's week: every district with a tanker, worst first. */
export function ScarcityStateTable({ week }: { week: ScarcityWeek }) {
  return (
    <div>
      <AtlasFinding>
        In the week to {week.weekEnd} (report dated {week.reportDate}), {num(week.totals.villages)}{" "}
        villages and {num(week.totals.wadis)} wadis across the state drew water from{" "}
        {num(week.totals.tankersTotal)} tankers - {num(week.totals.tankersGovernment)} government,{" "}
        {num(week.totals.tankersPrivate)} private. {week.worstDistrict.name} ran the most of any
        district ({num(week.worstDistrict.tankersTotal)}), the {week.worstDivision.name} division the
        most of any division ({num(week.worstDivision.tankersTotal)}).
      </AtlasFinding>
      <div className="mt-4">
        <AtlasTableScroll label="Districts on tanker supply, worst first">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={`${TH} text-left`}>District</th>
                <th className={`${TH} text-left`}>Division</th>
                <th className={`${TH} text-right`}>Villages</th>
                <th className={`${TH} text-right`}>Wadis</th>
                <th className={`${TH} text-right`}>Govt tankers</th>
                <th className={`${TH} text-right`}>Private</th>
                <th className={`${TH} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {week.active.map((row) => (
                <tr key={row.district} className={TR}>
                  <td className={`${TD} font-medium text-slate-900 dark:text-slate-100`}>{row.district}</td>
                  <td className={TD}>{row.division}</td>
                  <td className={`${TD} text-right`}>{num(row.villages)}</td>
                  <td className={`${TD} text-right`}>{num(row.wadis)}</td>
                  <td className={`${TD} text-right`}>{num(row.tankersGovernment)}</td>
                  <td className={`${TD} text-right`}>{num(row.tankersPrivate)}</td>
                  <td className={`${TD} text-right font-semibold`}>{num(row.tankersTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AtlasTableScroll>
      </div>
      <div className="mt-4">
        <AtlasNote>
          The other {num(week.zeroCount)} districts stand at zero in this week&rsquo;s report. The
          register is the Water Supply and Sanitation Department&rsquo;s weekly tanker report,
          transcribed edition by edition from the scanned PDF; an edition is accepted only when its
          district rows reproduce the report&rsquo;s own printed totals. Source:{" "}
          <a
            href={week.listingUrl}
            className="text-cyan-700 dark:text-cyan-400 hover:underline"
            rel="noopener noreferrer"
          >
            WSSD tanker reports
          </a>
          .
        </AtlasNote>
      </div>
    </div>
  );
}

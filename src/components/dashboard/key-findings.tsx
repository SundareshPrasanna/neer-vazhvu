import Link from "next/link";

/**
 * Key findings strip for the city dashboard.
 *
 * The dashboard leads with reservoir storage, which is the right lead for a
 * city whose feed is live. For a city whose feed has not been applied yet - or
 * simply on a day when nothing has moved - it left the page with almost
 * nothing on it. This strip fills that with the city's own tier-1 facts, which
 * are already curated and already carry their sources, so it introduces no new
 * data to maintain and cannot drift from the facts page.
 *
 * Self-hides where a city has no static facts file (Chennai runs the dynamic
 * pipeline) or has not graded any fact tier-1.
 */

export type Fact = {
  id: string;
  tier?: number;
  category: string;
  title: string;
  value?: string;
  unit?: string;
  source_label?: string;
};

/** Category -> accent. Unlisted categories fall back to slate rather than
 *  inventing a colour, so a new category never renders as a mystery hue. */
const ACCENT: Record<string, string> = {
  Groundwater: "border-l-amber-500",
  Sewage: "border-l-rose-500",
  "Water bodies": "border-l-blue-500",
  "Governance & finance": "border-l-violet-500",
  Equity: "border-l-orange-500",
  Heritage: "border-l-emerald-600",
  Flood: "border-l-cyan-500",
  Restoration: "border-l-teal-500",
  "Supply & sources": "border-l-sky-500",
};

export function KeyFindings({
  facts,
  cityId,
  cityDisplayName,
  limit = 6,
}: {
  facts: Fact[];
  cityId: string;
  cityDisplayName: string;
  limit?: number;
}) {
  const tier1 = facts.filter((f) => f.tier === 1);
  if (tier1.length === 0) return null;

  // One per category first, so the strip spans the city's problems rather than
  // stacking six variations of whichever topic happens to have the most facts.
  const seen = new Set<string>();
  const spread: Fact[] = [];
  for (const f of tier1) {
    if (seen.has(f.category)) continue;
    seen.add(f.category);
    spread.push(f);
  }
  for (const f of tier1) {
    if (spread.length >= limit) break;
    if (!spread.includes(f)) spread.push(f);
  }
  const shown = spread.slice(0, limit);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          What we found in {cityDisplayName}
        </h2>
        <Link
          href={`/${cityId}/facts`}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          All {facts.length} findings, with sources &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shown.map((f) => (
          <Link
            key={f.id}
            href={`/${cityId}/facts#${f.id}`}
            className={`block rounded-lg border border-slate-200 dark:border-slate-700 border-l-4 ${
              ACCENT[f.category] ?? "border-l-slate-400"
            } p-3 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors`}
          >
            <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {f.category}
            </div>
            {f.value && (
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-tight">
                {f.value}
              </div>
            )}
            {f.unit && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                {f.unit}
              </div>
            )}
            <div className="text-xs text-slate-700 dark:text-slate-300 mt-1.5 leading-snug">
              {f.title}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

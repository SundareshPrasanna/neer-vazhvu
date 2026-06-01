"use client";

import { useEffect, useState } from "react";

/**
 * Expanded /bangalore/tanker context layers. Sits beneath the
 * existing TankerMarketPanel (which renders the OpenCity longitudinal
 * survey). Reads public/data/bangalore-tanker-context.json - a
 * curated supplementary file compiled from primary press + WELL Labs
 * + IISc + Citizen Matters research.
 *
 * Five sections in order:
 *   1. Structural anchor (WELL Labs water-balance: where the city's
 *      28xx MLD actually comes from)
 *   2. March 2024 crisis timeline
 *   3. Official-vs-informal rate gap (4 tiers)
 *   4. Named extraction sites + regulatory-gap note
 *   5. Most-dependent corridors + worst-served wards
 *   6. Open data gaps (RTI / partnership follow-ups)
 *
 * Bangalore-specific for now; if Chennai / Madurai grow comparable
 * curated context the component shape will generalise.
 */

interface SourceRef {
  label: string;
  url: string;
  extracted: string;
}

interface TimelineEvent {
  date: string;
  headline: string;
  detail: string;
  source_key: string;
}

interface RateTier {
  channel: string;
  rate_5kl_inr?: number | null;
  rate_6kl_inr?: number | null;
  rate_6kl_inr_low?: number | null;
  rate_8kl_inr?: number | null;
  rate_12kl_inr?: number | null;
  rate_12kl_inr_high?: number | null;
  fleet_size: number | null;
  coverage: string;
  note: string;
}

interface ExtractionSite {
  name: string;
  type: string;
  lat: number | null;
  lng: number | null;
  narrative: string;
  source_key: string;
}

interface DependencyCorridor {
  corridor: string;
  rate_band_inr_kL: string;
  note: string;
}

interface WorstWard {
  ward_no: number | null;
  name: string;
  cauvery_lpcd: number;
  source_key: string;
}

interface DataGap {
  label: string;
  detail: string;
  rti_target: string;
}

interface TankerContext {
  structural_anchor: {
    headline: string;
    breakdown: Array<{ label: string; mld: number; share_pct: number | null; note?: string }>;
    source_key: string;
  };
  crisis_timeline_2024: {
    headline: string;
    subtitle: string;
    events: TimelineEvent[];
  };
  rate_gap: {
    headline: string;
    subtitle: string;
    tiers: RateTier[];
  };
  extraction_sites: {
    headline: string;
    subtitle: string;
    sites: ExtractionSite[];
    regulatory_gap: string;
  };
  dependency_corridors: {
    headline: string;
    subtitle: string;
    stress_ward_count: number;
    iisc_source_key: string;
    highest_rate_corridors_2025: DependencyCorridor[];
    worst_served_named_wards: WorstWard[];
  };
  data_gaps: DataGap[];
  sources: Record<string, SourceRef>;
}

function SourceLink({
  sourceKey,
  sources,
}: {
  sourceKey: string;
  sources: Record<string, SourceRef>;
}) {
  const ref = sources[sourceKey];
  if (!ref) return null;
  return (
    <a
      href={ref.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
    >
      [{ref.label}]
    </a>
  );
}

const SITE_TYPE_LABEL: Record<string, { label: string; tone: string }> = {
  illegal_lake_abstraction: {
    label: "Illegal lake abstraction",
    tone: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
  },
  illegal_lake_buffer_borewell: {
    label: "Illegal lake-buffer borewell",
    tone: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
  },
  industrial_borewell: {
    label: "Industrial borewell (diverted)",
    tone: "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200",
  },
  over_extracted_private_borewell: {
    label: "Over-extracted private borewell",
    tone: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200",
  },
  treated_wastewater: {
    label: "Treated wastewater (legitimate)",
    tone: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200",
  },
};

export function TankerExpandedContext() {
  const [ctx, setCtx] = useState<TankerContext | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/data/bangalore-tanker-context.json")
      .then((r) => (r.ok ? (r.json() as Promise<TankerContext>) : Promise.reject()))
      .then(setCtx)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-200">
        Could not load tanker context. The page falls back to the
        OpenCity longitudinal survey above.
      </div>
    );
  }
  if (!ctx) return null;

  const sources = ctx.sources;

  return (
    <div className="space-y-8">
      {/* 1. Structural anchor */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">
          The structural picture
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
          {ctx.structural_anchor.headline}
        </p>
        <div className="space-y-2">
          {ctx.structural_anchor.breakdown.map((row, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <div
                className="h-2 rounded-full bg-slate-300 dark:bg-slate-700 flex-1 overflow-hidden"
                style={{ minWidth: 60 }}
              >
                {row.share_pct != null && (
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${row.share_pct}%` }}
                  />
                )}
              </div>
              <div className="font-mono text-slate-800 dark:text-slate-200 tabular-nums w-20 text-right">
                {row.mld.toLocaleString()} MLD
              </div>
              <div className="text-slate-600 dark:text-slate-400 flex-[2] text-xs">
                {row.label}
                {row.note && (
                  <span className="text-amber-700 dark:text-amber-400 ml-1">
                    · {row.note}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
          Numbers from <SourceLink sourceKey={ctx.structural_anchor.source_key} sources={sources} />
          . Sums larger than 2,830 MLD because BWSSB also serves bulk
          industrial / institutional users outside the household total.
        </p>
      </section>

      {/* 2. Crisis timeline */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
          {ctx.crisis_timeline_2024.headline}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          {ctx.crisis_timeline_2024.subtitle}
        </p>
        <ol className="border-l-2 border-slate-200 dark:border-slate-700 pl-4 space-y-3">
          {ctx.crisis_timeline_2024.events.map((e) => (
            <li key={e.date} className="relative">
              <span className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />
              <div className="flex items-baseline gap-2 flex-wrap">
                <time className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {e.date}
                </time>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {e.headline}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {e.detail}{" "}
                <SourceLink sourceKey={e.source_key} sources={sources} />
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. Rate gap */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
          {ctx.rate_gap.headline}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          {ctx.rate_gap.subtitle}
        </p>
        <div className="space-y-3">
          {ctx.rate_gap.tiers.map((t, i) => {
            const rateBits: string[] = [];
            if (t.rate_5kl_inr) rateBits.push(`Rs ${t.rate_5kl_inr} / 5kL`);
            if (t.rate_6kl_inr) rateBits.push(`Rs ${t.rate_6kl_inr} / 6kL`);
            if (t.rate_6kl_inr_low && t.rate_12kl_inr_high)
              rateBits.push(`Rs ${t.rate_6kl_inr_low.toLocaleString()}-${t.rate_12kl_inr_high.toLocaleString()}`);
            if (t.rate_8kl_inr) rateBits.push(`Rs ${t.rate_8kl_inr} / 8kL`);
            if (t.rate_12kl_inr && !t.rate_12kl_inr_high)
              rateBits.push(`Rs ${t.rate_12kl_inr.toLocaleString()} / 12kL`);
            return (
              <div
                key={i}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40 p-3"
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {t.channel}
                  </span>
                  <span className="text-sm font-mono text-blue-700 dark:text-blue-400 tabular-nums">
                    {rateBits.join(" · ")}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {t.coverage}
                  {t.fleet_size != null && (
                    <span className="ml-2 text-slate-500 dark:text-slate-500">
                      · fleet ~{t.fleet_size.toLocaleString()}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-1 italic">
                  {t.note}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Extraction sites */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
          {ctx.extraction_sites.headline}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          {ctx.extraction_sites.subtitle}
        </p>
        <div className="space-y-3">
          {ctx.extraction_sites.sites.map((s, i) => {
            const typeMeta = SITE_TYPE_LABEL[s.type] ?? { label: s.type, tone: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" };
            return (
              <div
                key={i}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40 p-3"
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {s.name}
                  </span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeMeta.tone}`}
                  >
                    {typeMeta.label}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {s.narrative}{" "}
                  <SourceLink sourceKey={s.source_key} sources={sources} />
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-3 leading-relaxed">
          {ctx.extraction_sites.regulatory_gap}
        </p>
      </section>

      {/* 5. Dependency corridors */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
          {ctx.dependency_corridors.headline}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          {ctx.dependency_corridors.subtitle}{" "}
          <SourceLink sourceKey={ctx.dependency_corridors.iisc_source_key} sources={sources} />
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Highest informal tanker rates (Rs / kL, 2025)
            </h3>
            <div className="space-y-1.5">
              {ctx.dependency_corridors.highest_rate_corridors_2025.map((c, i) => (
                <div
                  key={i}
                  className="text-sm text-slate-700 dark:text-slate-300 border-l-2 border-amber-400 pl-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{c.corridor}</span>
                    <span className="font-mono text-xs text-amber-700 dark:text-amber-400 tabular-nums">
                      Rs {c.rate_band_inr_kL}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-500 italic">
                    {c.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Worst-served by piped supply (Cauvery LPCD)
            </h3>
            <div className="space-y-1.5">
              {ctx.dependency_corridors.worst_served_named_wards.map((w, i) => (
                <div
                  key={i}
                  className="text-sm text-slate-700 dark:text-slate-300 border-l-2 border-red-400 pl-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {w.ward_no != null ? `Ward ${w.ward_no}: ` : ""}
                      {w.name}
                    </span>
                    <span className="font-mono text-xs text-red-700 dark:text-red-400 tabular-nums">
                      {w.cauvery_lpcd} LPCD
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2 italic">
              MoHUA Service Level Benchmark target: 135 LPCD. <SourceLink sourceKey="citizen_matters_cauvery_index" sources={sources} />
            </p>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-4">
          IISc Groundwater Outlook flags{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {ctx.dependency_corridors.stress_ward_count} BBMP wards
          </span>{" "}
          as critically over-extracted. Mapping that 65-ward list onto
          a choropleth on this page is a Tier-1 follow-up (IISc PDF
          parse required - see data gaps below).
        </p>
      </section>

      {/* 6. Data gaps */}
      <section className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-5">
        <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200 mb-1">
          Data we don&apos;t have (RTI / partnership unlocks)
        </h2>
        <p className="text-sm text-amber-800 dark:text-amber-300 mb-3 leading-relaxed">
          The tanker market&apos;s remaining opacity isn&apos;t a
          mystery - it&apos;s a regulatory paper-trail that BBMP /
          BWSSB / KSPCB hold internally. Listed here so users can see
          the boundary of public knowledge and so the platform&apos;s
          honest-gaps principle stays visible.
        </p>
        <ul className="space-y-2">
          {ctx.data_gaps.map((g, i) => (
            <li
              key={i}
              className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed"
            >
              <span className="font-semibold">{g.label}.</span>{" "}
              <span className="text-amber-800 dark:text-amber-300">
                {g.detail}
              </span>{" "}
              <span className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                Target: {g.rti_target}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

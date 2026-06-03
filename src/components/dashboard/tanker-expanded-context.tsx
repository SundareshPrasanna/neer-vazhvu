"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";

function tFmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

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

const SITE_TYPE_TONE: Record<string, string> = {
  illegal_lake_abstraction: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
  illegal_lake_buffer_borewell: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
  industrial_borewell: "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200",
  over_extracted_private_borewell: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200",
  treated_wastewater: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200",
};

export function TankerExpandedContext() {
  const { t, language } = useLanguage();
  const [ctx, setCtx] = useState<TankerContext | null>(null);
  const [error, setError] = useState(false);
  // Generic per-language picker for JSON data fields. Each user-facing
  // text field in bangalore-tanker-context.json now ships parallel
  // `_kn` / `_ta` variants (see /tmp/patch_tanker_context.py); this
  // helper reads the right one or falls back to English.
  const pick = (
    obj: Record<string, unknown>,
    key: string,
  ): string => {
    const localized = obj[`${key}_${language}`];
    if (typeof localized === "string" && localized) return localized;
    const en = obj[key];
    return typeof en === "string" ? en : "";
  };

  useEffect(() => {
    fetch("/data/bangalore-tanker-context.json")
      .then((r) => (r.ok ? (r.json() as Promise<TankerContext>) : Promise.reject()))
      .then(setCtx)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-200">
        {t("tanker_ctx.error")}
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
          {t("tanker_ctx.section.structural_anchor")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
          {t("tanker_ctx.section.structural_body")}
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
                {pick(row as unknown as Record<string, unknown>, "label")}
                {row.note && (
                  <span className="text-amber-700 dark:text-amber-400 ml-1">
                    · {pick(row as unknown as Record<string, unknown>, "note")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
          {t("tanker_ctx.structural_footer").split("{source}")[0]}
          <SourceLink sourceKey={ctx.structural_anchor.source_key} sources={sources} />
          {t("tanker_ctx.structural_footer").split("{source}")[1] ?? ""}
        </p>
      </section>

      {/* 2. Crisis timeline */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
          {t("tanker_ctx.section.crisis_headline")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          {t("tanker_ctx.section.crisis_subtitle")}
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
                  {pick(e as unknown as Record<string, unknown>, "headline")}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {pick(e as unknown as Record<string, unknown>, "detail")}{" "}
                <SourceLink sourceKey={e.source_key} sources={sources} />
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. Rate gap */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
          {t("tanker_ctx.section.rate_gap_headline")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          {t("tanker_ctx.section.rate_gap_subtitle")}
        </p>
        <div className="space-y-3">
          {ctx.rate_gap.tiers.map((tier, i) => {
            const rateBits: string[] = [];
            if (tier.rate_5kl_inr) rateBits.push(`Rs ${tier.rate_5kl_inr} / 5kL`);
            if (tier.rate_6kl_inr) rateBits.push(`Rs ${tier.rate_6kl_inr} / 6kL`);
            if (tier.rate_6kl_inr_low && tier.rate_12kl_inr_high)
              rateBits.push(`Rs ${tier.rate_6kl_inr_low.toLocaleString()}-${tier.rate_12kl_inr_high.toLocaleString()}`);
            if (tier.rate_8kl_inr) rateBits.push(`Rs ${tier.rate_8kl_inr} / 8kL`);
            if (tier.rate_12kl_inr && !tier.rate_12kl_inr_high)
              rateBits.push(`Rs ${tier.rate_12kl_inr.toLocaleString()} / 12kL`);
            return (
              <div
                key={i}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40 p-3"
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {pick(tier as unknown as Record<string, unknown>, "channel")}
                  </span>
                  <span className="text-sm font-mono text-blue-700 dark:text-blue-400 tabular-nums">
                    {rateBits.join(" · ")}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {pick(tier as unknown as Record<string, unknown>, "coverage")}
                  {tier.fleet_size != null && (
                    <span className="ml-2 text-slate-500 dark:text-slate-500">
                      · {tFmt(t("tanker_ctx.fleet"), { n: tier.fleet_size.toLocaleString() })}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-1 italic">
                  {pick(tier as unknown as Record<string, unknown>, "note")}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Extraction sites */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
          {t("tanker_ctx.section.extraction_headline")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          {t("tanker_ctx.section.extraction_subtitle")}
        </p>
        <div className="space-y-3">
          {ctx.extraction_sites.sites.map((s, i) => {
            const tone = SITE_TYPE_TONE[s.type] ?? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
            const typeKey = `tanker_ctx.site_type.${s.type}`;
            const typeLabel = t(typeKey);
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
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${tone}`}
                  >
                    {typeLabel === typeKey ? s.type : typeLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {pick(s as unknown as Record<string, unknown>, "narrative")}{" "}
                  <SourceLink sourceKey={s.source_key} sources={sources} />
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-3 leading-relaxed">
          {t("tanker_ctx.section.extraction_gap")}
        </p>
      </section>

      {/* 5. Dependency corridors */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
          {t("tanker_ctx.section.corridors_headline")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          {t("tanker_ctx.section.corridors_subtitle")}{" "}
          <SourceLink sourceKey={ctx.dependency_corridors.iisc_source_key} sources={sources} />
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              {t("tanker_ctx.rates_heading")}
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
                    {pick(c as unknown as Record<string, unknown>, "note")}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              {t("tanker_ctx.worst_served")}
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
              {t("tanker_ctx.mohua_note")} <SourceLink sourceKey="citizen_matters_cauvery_index" sources={sources} />
            </p>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-4">
          {tFmt(t("tanker_ctx.stress_footer"), { count: ctx.dependency_corridors.stress_ward_count })}
        </p>
      </section>

    </div>
  );
}

/**
 * Standalone "Data we don't have" panel, split out from
 * TankerExpandedContext so the page can interleave it after the IISc
 * stress-ward map (which is rendered between the two). Same data
 * source; renders independently of the rest of the expanded context.
 */
export function TankerDataGaps() {
  const { t, language } = useLanguage();
  const [ctx, setCtx] = useState<TankerContext | null>(null);
  const pick = (
    obj: Record<string, unknown>,
    key: string,
  ): string => {
    const localized = obj[`${key}_${language}`];
    if (typeof localized === "string" && localized) return localized;
    const en = obj[key];
    return typeof en === "string" ? en : "";
  };
  useEffect(() => {
    fetch("/data/bangalore-tanker-context.json")
      .then((r) => (r.ok ? (r.json() as Promise<TankerContext>) : Promise.reject()))
      .then(setCtx)
      .catch(() => setCtx(null));
  }, []);
  if (!ctx) return null;

  return (
    <section className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-5">
      <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200 mb-1">
        {t("tanker_gaps.heading")}
      </h2>
      <p className="text-sm text-amber-800 dark:text-amber-300 mb-3 leading-relaxed">
        {t("tanker_gaps.body")}
      </p>
      <ul className="space-y-2">
        {ctx.data_gaps.map((g, i) => (
          <li
            key={i}
            className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed"
          >
            <span className="font-semibold">{pick(g as unknown as Record<string, unknown>, "label")}.</span>{" "}
            <span className="text-amber-800 dark:text-amber-300">
              {pick(g as unknown as Record<string, unknown>, "detail")}
            </span>{" "}
            <span className="text-[11px] text-amber-700 dark:text-amber-400 italic">
              {t("tanker_gaps.target")}: {pick(g as unknown as Record<string, unknown>, "rti_target")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

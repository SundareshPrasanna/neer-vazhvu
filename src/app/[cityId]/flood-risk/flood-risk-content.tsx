"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n/context";

/** English is the accessibility floor; other languages are optional and
 *  fall back to English at render time (Madurai carries ta, Delhi will
 *  carry hi after its translation pass). */
interface BilingualText {
  en: string;
  ta?: string;
  hi?: string;
}

export interface HistoricalEvent {
  year: number;
  trigger: BilingualText;
  impact: BilingualText;
  /** Optional citation. Some flood events are well-attested but the
   *  original news article has been removed from the publisher's site
   *  - we'd rather drop the dead link than fabricate one. When absent,
   *  the event card hides the citation footer entirely. */
  source_url?: string;
  source_label?: string;
}

export interface ExternalSource {
  name: string;
  description: BilingualText;
  url: string;
  cadence: string;
}

export interface FloodConfig {
  headline: BilingualText;
  /** Scope badge text (e.g. "Vaigai system scope", "Yamuna basin scope").
   *  Config-driven so no city's system name leaks into another city's page. */
  scope_label?: BilingualText;
  dam_release_threshold_cusecs: number;
  dam_release_note: BilingualText;
  historical_events: HistoricalEvent[];
  external_sources: ExternalSource[];
  data_gaps: BilingualText[];
  /** Cross-link card copy overrides. The flood.cross_link_* i18n defaults
   *  carry Madurai's specifics (Vaigai dam / Vaigai river system); a second
   *  narrative city overrides them here instead of leaking them. */
  cross_links?: {
    home_desc?: BilingualText;
    rivers_label?: BilingualText;
    rivers_desc?: BilingualText;
    water_bodies_desc?: BilingualText;
  };
}

export function FloodRiskContent({
  cityId,
  cityDisplayName,
  cfg,
}: {
  cityId: string;
  cityDisplayName: string;
  cfg: FloodConfig;
}) {
  const { t, language } = useLanguage();
  const pick = (b: BilingualText) =>
    (language === "ta" ? b.ta : language === "hi" ? b.hi : undefined) ?? b.en;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">{cityDisplayName} - {t("flood.badge_scope")}</Badge>
        {cfg.scope_label && (
          <Badge variant="outline" className="text-xs">{pick(cfg.scope_label)}</Badge>
        )}
        <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
          {t("flood.badge_no_hazard_map")}
        </Badge>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {cityDisplayName} {t("flood.heading_suffix")}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          {pick(cfg.headline)}
        </p>
      </header>

      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20">
        <CardContent className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400 font-semibold">
            {t("flood.dam_threshold_label")}
          </div>
          <div className="text-3xl sm:text-4xl font-bold tracking-tight">
            ~{cfg.dam_release_threshold_cusecs.toLocaleString()}
            <span className="text-base font-normal text-slate-400 ml-1">{t("flood.cusecs")}</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {pick(cfg.dam_release_note)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("flood.recent_events")} - {cfg.historical_events.length}
          </h2>
          <div className="space-y-3">
            {cfg.historical_events.map((e) => (
              <div key={`${e.year}-${e.trigger.en.slice(0, 20)}`} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100">{e.year}</span>
                  <span className="text-xs text-slate-500">{pick(e.trigger)}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">{pick(e.impact)}</p>
                {e.source_url && e.source_label && (
                  <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline inline-block mt-2">
                    {e.source_label} →
                  </a>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("flood.external_sources")} - {cfg.external_sources.length}
          </h2>
          <p className="text-xs text-slate-500">
            {t("flood.external_intro")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cfg.external_sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{s.name}</span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{s.cadence}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{pick(s.description)}</p>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("flood.data_gaps_heading")} ({cityDisplayName})
          </h2>
          <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 space-y-1">
            {cfg.data_gaps.map((gap, i) => (
              <li key={i}>{pick(gap)}</li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 italic mt-2">
            {t("flood.data_gaps_caveat")}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href={`/${cityId}`} className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 transition-colors">
          <div className="text-sm font-semibold">{cityDisplayName} {t("flood.cross_link_home")}</div>
          <div className="text-xs text-slate-500 mt-1">
            {cfg.cross_links?.home_desc ? pick(cfg.cross_links.home_desc) : t("flood.cross_link_home_desc")}
          </div>
        </Link>
        <Link href={`/${cityId}/rivers`} className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 transition-colors">
          <div className="text-sm font-semibold">
            {cfg.cross_links?.rivers_label ? pick(cfg.cross_links.rivers_label) : t("flood.cross_link_rivers")}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {cfg.cross_links?.rivers_desc ? pick(cfg.cross_links.rivers_desc) : t("flood.cross_link_rivers_desc")}
          </div>
        </Link>
        <Link href={`/${cityId}/water-bodies`} className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 transition-colors">
          <div className="text-sm font-semibold">{t("flood.cross_link_water_bodies")}</div>
          <div className="text-xs text-slate-500 mt-1">
            {cfg.cross_links?.water_bodies_desc ? pick(cfg.cross_links.water_bodies_desc) : t("flood.cross_link_water_bodies_desc")}
          </div>
        </Link>
      </div>
    </div>
  );
}

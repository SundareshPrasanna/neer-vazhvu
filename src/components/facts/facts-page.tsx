"use client";

import Link from "next/link";
import { BucketSection } from "@/components/facts/bucket-section";
import { useLanguage } from "@/lib/i18n/context";
import {
  BUCKETS,
  bucketForCategory,
  type FactBucketId,
} from "@/lib/facts/buckets";
import type { Fact } from "@/types/facts";

interface FactsPageProps {
  facts: Fact[];
  generatedAt: string;
  cityName: string;
  cityNameTa?: string;
  /**
   * URL of the city's Origins long-read narrative. Used by the
   * banner that appears when one or more facts have been routed
   * away from /facts because they're narrative milestones rather
   * than quotable operational numbers (e.g. Day Zero, 2015 floods).
   */
  originsUrl: string;
  /**
   * Path prefix for "See live data on /<page>" links inside each
   * bucket section. "" for the Chennai legacy pages (so dashboard
   * lives at "/" and groundwater at "/groundwater"); "/<cityId>" for
   * the multi-city template (so groundwater lives at
   * "/madurai/groundwater").
   */
  pagePathPrefix?: string;
}

export function FactsPage({
  facts,
  generatedAt,
  cityName,
  cityNameTa,
  originsUrl,
  pagePathPrefix = "",
}: FactsPageProps) {
  const { t, language } = useLanguage();

  // Bucket aggregation: bucket -> [facts], plus a separate list of
  // facts that were routed away from /facts (today: events).
  const byBucket: Record<FactBucketId, Fact[]> = {
    reservoirs: [],
    groundwater: [],
    coastal: [],
    rivers: [],
    "water-bodies": [],
    floods: [],
    infrastructure: [],
  };
  const excludedFacts: Fact[] = [];
  for (const fact of facts) {
    const bucket = bucketForCategory(fact.category);
    if (bucket === null) {
      excludedFacts.push(fact);
      continue;
    }
    byBucket[bucket].push(fact);
  }

  // Sort each bucket by tier ascending: Today (1) -> This year (2)
  // -> History (3) -> Infrastructure (4). The tier badge stays
  // visible on each card.
  for (const bucket of Object.values(byBucket)) {
    bucket.sort((a, b) => a.tier - b.tier);
  }

  const generatedLabel = formatDateTime(generatedAt, language);
  // Keep `cityName` as the brand-form (Bengaluru, Chennai, Madurai) for
  // non-Tamil languages - we don't have Kannada-script transliterations
  // of every city name yet. Tamil keeps its special-case for back-compat.
  const localizedCity =
    language === "ta" ? (cityNameTa ?? cityName) : cityName;
  const title = t("facts.page_title").replaceAll("{city}", localizedCity);
  const intro = t("facts.page_intro").replaceAll("{city}", localizedCity);

  // Buckets in display order, only those with at least one fact.
  const presentBuckets = BUCKETS.filter((b) => byBucket[b.id].length > 0);
  const firstBucketId = presentBuckets[0]?.id;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {title}
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          {intro}
        </p>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {t("facts.last_updated")}: {generatedLabel}
        </p>
      </header>

      {/* Banner: when one or more facts have been routed to Origins
          rather than rendered here, point readers there explicitly so
          they don't think those numbers are missing. */}
      {excludedFacts.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
          {t("facts.origins_banner_before").replaceAll("{city}", localizedCity)}
          <Link
            href={originsUrl}
            className="font-medium text-amber-700 dark:text-amber-300 hover:underline"
          >
            {t("facts.origins_banner_link")}
          </Link>
        </div>
      )}

      {/* Bucket nav chips - replaces the previous tier nav chips. */}
      <nav className="mb-2 flex flex-wrap gap-2">
        {presentBuckets.map((bucket) => (
          <a
            key={bucket.id}
            href={`#bucket-${bucket.id}`}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {bucket.label[language] ?? bucket.label.en}
            <span className="ml-1.5 text-slate-400 dark:text-slate-500 tabular-nums">
              {byBucket[bucket.id].length}
            </span>
          </a>
        ))}
      </nav>

      {presentBuckets.map((bucket) => (
        <BucketSection
          key={bucket.id}
          bucket={bucket}
          facts={byBucket[bucket.id]}
          pagePathPrefix={pagePathPrefix}
          defaultOpen={bucket.id === firstBucketId}
        />
      ))}

      <section className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
          {t("facts.methodology_title")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          {t("facts.methodology_intro")}
        </p>
        <Link
          href={`${pagePathPrefix}/about#data-sources`}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t("facts.methodology_link")}
        </Link>
      </section>
    </div>
  );
}

function formatDateTime(iso: string, language: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const locale =
      language === "ta" ? "ta-IN" : language === "kn" ? "kn-IN" : "en-IN";
    return d.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return iso;
  }
}

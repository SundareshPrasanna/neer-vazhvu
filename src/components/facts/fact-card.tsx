"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/context";
import { TIER_BADGE_STYLE } from "@/types/facts";
import type { Fact } from "@/types/facts";

interface FactCardProps {
  fact: Fact;
}

export function FactCard({ fact }: FactCardProps) {
  const { t, language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const badge = TIER_BADGE_STYLE[fact.tier];

  // Show the data year on the badge for non-live tiers so readers see
  // freshness at a glance ("Annual · 2024" reads more honestly than a
  // bare "Annual" badge when the underlying data is two years old).
  // Live tier keeps a clean badge - the per-card footer already shows
  // the as-of date for Tier 1 facts which refresh sub-daily.
  const badgeYearSuffix = (() => {
    if (fact.tier === 1) return "";
    const year = (fact.data_date ?? "").slice(0, 4);
    return /^\d{4}$/.test(year) ? ` · ${year}` : "";
  })();

  const title =
    language === "ta" && fact.title_ta ? fact.title_ta : fact.title;
  const interpretation =
    language === "ta" && fact.interpretation_ta
      ? fact.interpretation_ta
      : fact.interpretation;
  const quote =
    language === "ta" && fact.quote_text_ta
      ? fact.quote_text_ta
      : fact.quote_text;

  const anchorHref = `#${fact.id}`;
  const canonicalUrl = typeof window !== "undefined"
    ? `${window.location.origin}/facts${anchorHref}`
    : `https://neervazhvu.org/facts${anchorHref}`;
  const fullQuote = `${quote} Reference: ${canonicalUrl}`;

  const dateLabel = formatDate(fact.data_date ?? fact.retrieved_at, language);

  async function copyQuote() {
    try {
      await navigator.clipboard.writeText(fullQuote);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignored - fallback is just visual
    }
  }

  function tweet() {
    const tweetText = `${interpretation}`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(canonicalUrl)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignored
    }
  }

  return (
    <Card
      id={fact.id}
      className={cn(
        "relative scroll-mt-24 border-slate-200 dark:border-slate-800",
        "hover:shadow-md transition-shadow",
        "py-5 gap-4",
      )}
    >
      <div className="px-6 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              badge.bg,
              badge.text,
            )}
          >
            {badge.label}{badgeYearSuffix}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {fact.category}
          </span>
        </div>
        <a
          href={anchorHref}
          className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 text-sm"
          aria-label={t("facts.card_anchor")}
          title={t("facts.card_anchor")}
        >
          #
        </a>
      </div>

      <div className="px-6">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          {title}
        </h3>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {fact.value}
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {fact.unit}
          </span>
        </div>
      </div>

      <div className="px-6">
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {interpretation}
        </p>
      </div>

      {fact.threshold && (
        <div className="mx-6 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-400">
          <span className="font-semibold">{fact.threshold.source}:</span>{" "}
          {fact.threshold.label}
        </div>
      )}

      <div className="px-6 flex items-center justify-between flex-wrap gap-2">
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          <a
            href={fact.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-700 dark:hover:text-slate-300 underline decoration-dotted underline-offset-2"
          >
            {fact.source_label}
          </a>
          <span className="mx-1.5">·</span>
          <span>
            {t("facts.as_of")} {dateLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copyQuote}
            className="text-[11px] px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            aria-label={t("facts.copy_quote")}
          >
            {copied ? t("facts.copied") : t("facts.copy_quote")}
          </button>
          <button
            onClick={tweet}
            className="text-[11px] px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            aria-label={t("facts.tweet")}
          >
            {t("facts.tweet")}
          </button>
          <button
            onClick={copyLink}
            className="text-[11px] px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            aria-label={t("facts.copy_link")}
          >
            {t("facts.copy_link")}
          </button>
        </div>
      </div>
    </Card>
  );
}

function formatDate(iso: string, language: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(language === "ta" ? "ta-IN" : "en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

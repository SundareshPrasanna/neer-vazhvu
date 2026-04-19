"use client";

import { TierSection } from "@/components/facts/tier-section";
import { useLanguage } from "@/lib/i18n/context";
import type { Fact, FactTier } from "@/types/facts";

interface FactsPageProps {
  facts: Fact[];
  generatedAt: string;
}

export function FactsPage({ facts, generatedAt }: FactsPageProps) {
  const { t, language } = useLanguage();

  const byTier: Record<FactTier, Fact[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const fact of facts) {
    byTier[fact.tier].push(fact);
  }

  const generatedLabel = formatDateTime(generatedAt, language);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {t("facts.page_title")}
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          {t("facts.page_intro")}
        </p>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {t("facts.last_updated")}: {generatedLabel}
        </p>
      </header>

      <nav className="mb-2 flex flex-wrap gap-2">
        {([1, 2, 3, 4] as FactTier[]).map((tier) => (
          <a
            key={tier}
            href={`#tier-${tier}`}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {language === "ta" ? tierLabelTa(tier) : tierLabelEn(tier)}
            <span className="ml-1.5 text-slate-400 dark:text-slate-500 tabular-nums">
              {byTier[tier].length}
            </span>
          </a>
        ))}
      </nav>

      {([1, 2, 3, 4] as FactTier[]).map((tier) => (
        <TierSection
          key={tier}
          tier={tier}
          facts={byTier[tier]}
          defaultOpen={tier === 1}
        />
      ))}

      <section className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
          {t("facts.methodology_title")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          {t("facts.methodology_intro")}
        </p>
        <a
          href="/about#data-sources"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t("facts.methodology_link")}
        </a>
      </section>
    </div>
  );
}

function tierLabelEn(tier: FactTier): string {
  switch (tier) {
    case 1:
      return "Today";
    case 2:
      return "This year";
    case 3:
      return "History";
    case 4:
      return "Infrastructure";
  }
}

function tierLabelTa(tier: FactTier): string {
  switch (tier) {
    case 1:
      return "இன்று";
    case 2:
      return "இந்த ஆண்டு";
    case 3:
      return "வரலாறு";
    case 4:
      return "உள்கட்டமைப்பு";
  }
}

function formatDateTime(iso: string, language: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(language === "ta" ? "ta-IN" : "en-IN", {
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

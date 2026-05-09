"use client";

import { useLanguage } from "@/lib/i18n/context";

interface ComingSoonStoryProps {
  cityDisplayName: string;
}

/**
 * Stub shown for cities whose long-read water story isn't drafted yet.
 */
export function ComingSoonStory({ cityDisplayName }: ComingSoonStoryProps) {
  const { t } = useLanguage();
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2">
        {cityDisplayName} {t("story.water_story_label")}
      </div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
        {t("story.coming_soon")}
      </h1>
      <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
        {t("story.coming_soon_blurb")}
      </p>
    </div>
  );
}

"use client";

/**
 * Outer chrome for a city water-story page. Holds the city/page title
 * block and a footer with the "see also" links into the dashboard /
 * facts surfaces. The page body (Hero, Lede, Chapters, etc.) is passed
 * in as children so each city's narrative composes the shortcodes
 * directly without needing an MDX runtime.
 */

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";

interface StoryPageProps {
  cityId: string;
  cityDisplayName: string;
  /** Short tagline below the title, e.g. "City of Tanks". */
  tagline: string;
  /** When this story was last revised - shown in the byline. */
  lastRevised: string;
  children: React.ReactNode;
}

export function StoryPage({
  cityId,
  cityDisplayName,
  tagline,
  lastRevised,
  children,
}: StoryPageProps) {
  const { t } = useLanguage();
  const dashboardHref = cityId === "chennai" ? "/" : `/${cityId}`;
  const factsHref = cityId === "chennai" ? "/facts" : `/${cityId}/facts`;

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <header className="mb-8">
        <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2">
          {cityDisplayName} {t("story.water_story_label")}
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
          {tagline}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
          {t("story.last_revised")} {lastRevised}. {t("story.companion_text")}{" "}
          <Link href={dashboardHref} className="underline">
            {t("nav.dashboard")}
          </Link>
          {" · "}
          <Link href={factsHref} className="underline">
            {t("nav.facts")}
          </Link>
        </p>
      </header>

      {children}

      <footer className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
        <div className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
          {t("story.keep_going")}
        </div>
        <ul className="space-y-1.5">
          <li>
            <Link href={dashboardHref} className="text-blue-600 dark:text-blue-400 hover:underline">
              {t("story.dashboard_footer")}
            </Link>
          </li>
          <li>
            <Link href={factsHref} className="text-blue-600 dark:text-blue-400 hover:underline">
              {t("story.facts_footer")}
            </Link>
          </li>
        </ul>
      </footer>
    </article>
  );
}

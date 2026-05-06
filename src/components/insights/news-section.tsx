"use client";

import { useLanguage } from "@/lib/i18n/context";

interface NewsSectionProps {
  /** City display name to seed the Google News search. Defaults to Chennai. */
  cityDisplayName?: string;
}

function newsUrlFor(cityName: string): string {
  const q = `${cityName} water supply OR reservoir OR flood OR groundwater OR river pollution OR lake`;
  const params = new URLSearchParams({ q, hl: "en-IN", gl: "IN", ceid: "IN:en" });
  return `https://news.google.com/search?${params.toString()}`;
}

export function NewsSection({ cityDisplayName = "Chennai" }: NewsSectionProps = {}) {
  const { t } = useLanguage();
  const url = newsUrlFor(cityDisplayName);

  return (
    <div className="flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500">
      <svg
        className="w-3.5 h-3.5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
        />
      </svg>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
      >
        {t("news.search_all")} &rarr;
      </a>
      <span className="text-slate-300 dark:text-slate-600">|</span>
      <span>{t("news.via")}</span>
    </div>
  );
}

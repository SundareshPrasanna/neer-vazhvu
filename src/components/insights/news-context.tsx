"use client";

import { useLanguage } from "@/lib/i18n/context";
import { useNews } from "@/lib/hooks/use-news";
import type { NewsDomain } from "@/types/news";

interface NewsContextProps {
  domain: NewsDomain;
}

export function NewsContext({ domain }: NewsContextProps) {
  const { t } = useLanguage();
  const { articles, loading } = useNews(domain, 2);

  if (loading || articles.length === 0) return null;

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
      <div className="flex items-start gap-2">
        <svg
          className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0"
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
        <div className="flex-1 min-w-0">
          <h4 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
            {t("news.related")}
          </h4>
          <div className="space-y-1.5">
            {articles.map((article) => (
              <div key={article.id}>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 leading-snug line-clamp-2"
                >
                  {article.title}
                </a>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {article.sourceName}
                  </span>
                  <span className="text-[10px] text-slate-300 dark:text-slate-600">
                    -
                  </span>
                  <RelativeTime publishedAt={article.publishedAt} t={t} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RelativeTime({
  publishedAt,
  t,
}: {
  publishedAt: string;
  t: (key: string) => string;
}) {
  const now = Date.now();
  const published = new Date(publishedAt).getTime();
  const diffMs = now - published;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let label: string;
  if (diffHours < 1) {
    label = t("news.just_now");
  } else if (diffHours < 24) {
    label = t("news.hours_ago").replace("{n}", String(diffHours));
  } else {
    label = t("news.days_ago").replace("{n}", String(diffDays));
  }

  return (
    <span className="text-[10px] text-slate-400 dark:text-slate-500">
      {label}
    </span>
  );
}

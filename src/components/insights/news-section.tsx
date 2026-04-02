"use client";

import { useLanguage } from "@/lib/i18n/context";
import type { NewsArticle, NewsDomain } from "@/types/news";

const DOMAIN_COLORS: Record<NewsDomain, string> = {
  reservoirs: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  groundwater: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  flood: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  rivers: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  water_bodies: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

interface NewsSectionProps {
  articles: NewsArticle[];
}

export function NewsSection({ articles }: NewsSectionProps) {
  const { t } = useLanguage();

  if (articles.length === 0) return null;

  return (
    <div className="border-l-4 border-l-blue-400 bg-white dark:bg-slate-900 rounded-r-lg shadow-sm px-5 py-4">
      <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
        {t("news.heading")}
      </h3>

      <div className="space-y-2.5">
        {articles.map((article) => (
          <div key={article.id} className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 shrink-0">
                  {article.sourceName}
                </span>
                <span className="text-[10px] text-slate-300 dark:text-slate-600">
                  -
                </span>
                <RelativeTime publishedAt={article.publishedAt} t={t} />
              </div>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 leading-snug line-clamp-2"
              >
                {article.title}
              </a>
            </div>
            <div className="flex flex-wrap gap-1 shrink-0 pt-0.5">
              {article.domains.slice(0, 2).map((domain) => (
                <span
                  key={domain}
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${DOMAIN_COLORS[domain]}`}
                >
                  {t(`news.domain_${domain}`)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3">
        {t("news.via")}
      </p>
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

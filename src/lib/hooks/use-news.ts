"use client";

import { useEffect, useState } from "react";
import type { NewsDomain, NewsArticle } from "@/types/news";

// Time-based cache: 5-minute stale window, keyed by domain+limit
const cache = new Map<string, { data: NewsArticle[]; timestamp: number }>();
const STALE_MS = 5 * 60 * 1000;

function cacheKey(domain: NewsDomain | null, limit: number): string {
  return `${domain ?? "all"}:${limit}`;
}

export function useNews(
  domain: NewsDomain | null,
  limit: number = 5
): { articles: NewsArticle[]; loading: boolean } {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = cacheKey(domain, limit);
    const cached = cache.get(key);

    // Return cached data if still fresh
    if (cached && Date.now() - cached.timestamp < STALE_MS) {
      setArticles(cached.data);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const params = new URLSearchParams({ limit: String(limit) });
    if (domain) params.set("domain", domain);

    fetch(`/api/news?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const data: NewsArticle[] = json.articles ?? [];
        cache.set(key, { data, timestamp: Date.now() });
        setArticles(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setArticles([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [domain, limit]);

  return { articles, loading };
}

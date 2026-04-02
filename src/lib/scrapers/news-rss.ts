import * as cheerio from "cheerio";
import { DOMAIN_KEYWORDS, LOCALITY_TERMS, NEWS_RSS_URL } from "@/lib/news/domains";
import type { NewsDomain } from "@/types/news";

export interface RawNewsItem {
  guid: string;
  title: string;
  sourceName: string;
  url: string;
  publishedAt: string; // ISO 8601
  snippet: string;
  domains: NewsDomain[];
}

/**
 * Fetches and parses Google News RSS for Chennai water-related articles.
 * Classifies each article into page domains using keyword + locality scoring.
 * Only returns articles that matched at least one domain (no unclassified noise).
 */
export async function fetchNewsRSS(): Promise<RawNewsItem[]> {
  const response = await fetch(NEWS_RSS_URL, {
    headers: {
      "User-Agent": "NeerVazhvu/1.0 (Chennai Water Dashboard; educational use)",
    },
  });

  if (!response.ok) {
    throw new Error(`Google News RSS returned ${response.status}`);
  }

  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  const items: RawNewsItem[] = [];

  $("item").each((_i, el) => {
    const title = $(el).find("title").text().trim();
    const link = $(el).find("link").text().trim();
    const guid = $(el).find("guid").text().trim();
    const pubDate = $(el).find("pubDate").text().trim();
    const descriptionHtml = $(el).find("description").text().trim();
    const sourceEl = $(el).find("source");
    const sourceName = sourceEl.text().trim() || extractSourceFromTitle(title);

    if (!title || !link || !guid) return;

    // Strip HTML from description and truncate
    const snippet = stripHtml(descriptionHtml).slice(0, 200);

    // Parse pub date
    const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();

    // Classify into domains
    const domains = classifyDomains(title, snippet);

    // Only keep articles that matched at least one domain
    if (domains.length === 0) return;

    items.push({
      guid,
      title: cleanTitle(title),
      sourceName,
      url: link,
      publishedAt,
      snippet: snippet || "",
      domains,
    });
  });

  return items;
}

/**
 * Classify an article into page domains using keyword + locality scoring.
 * Requires at least one domain keyword match AND locality score >= 1.
 */
function classifyDomains(title: string, snippet: string): NewsDomain[] {
  const text = `${title} ${snippet}`.toLowerCase();

  // Check locality first - must score >= 1
  const localityScore = LOCALITY_TERMS.filter((term) =>
    text.includes(term.toLowerCase())
  ).length;

  if (localityScore < 1) return [];

  // Check each domain's keywords
  const matched: NewsDomain[] = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [NewsDomain, string[]][]) {
    const hasKeyword = keywords.some((kw) => text.includes(kw.toLowerCase()));
    if (hasKeyword) {
      matched.push(domain);
    }
  }

  return matched;
}

/** Google News titles often end with " - Source Name". Remove that suffix. */
function cleanTitle(title: string): string {
  const dashIdx = title.lastIndexOf(" - ");
  if (dashIdx > 20) {
    return title.slice(0, dashIdx).trim();
  }
  return title;
}

/** Strip HTML tags from a string. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/** Fallback: extract source name from title "Headline - Source" pattern. */
function extractSourceFromTitle(title: string): string {
  const dashIdx = title.lastIndexOf(" - ");
  if (dashIdx > 0) {
    return title.slice(dashIdx + 3).trim();
  }
  return "Unknown";
}

import { NextRequest, NextResponse } from "next/server";
import type { NewsDomain, NewsArticle } from "@/types/news";

const VALID_DOMAINS: NewsDomain[] = [
  "reservoirs", "groundwater", "flood", "rivers", "water_bodies",
];

export async function GET(request: NextRequest) {
  // Check if Supabase is configured
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.json({ articles: [] });
  }

  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain") as NewsDomain | null;
  const limitParam = parseInt(searchParams.get("limit") || "5", 10);
  const limit = Math.min(Math.max(limitParam, 1), 10);

  // Validate domain if provided
  if (domain && !VALID_DOMAINS.includes(domain)) {
    return NextResponse.json(
      { error: `Invalid domain. Must be one of: ${VALID_DOMAINS.join(", ")}` },
      { status: 400 }
    );
  }

  // Build query
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("news_articles")
    .select("id, title, source_name, url, published_at, snippet, domains")
    .gt("published_at", sevenDaysAgo)
    .order("published_at", { ascending: false })
    .limit(limit);

  // Filter by domain using @> (contains) for GIN index
  if (domain) {
    query = query.contains("domains", [domain]);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[api/news]", error.message);
    return NextResponse.json({ articles: [] });
  }

  // Map DB snake_case to app camelCase
  const articles: NewsArticle[] = (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    sourceName: row.source_name,
    url: row.url,
    publishedAt: row.published_at,
    snippet: row.snippet,
    domains: row.domains,
  }));

  return NextResponse.json({ articles });
}

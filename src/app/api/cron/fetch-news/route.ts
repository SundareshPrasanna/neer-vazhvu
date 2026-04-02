import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchNewsRSS } from "@/lib/scrapers/news-rss";
import { todayIST } from "@/lib/utils/date";

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const startTime = Date.now();
  const supabase = createAdminClient();
  const today = todayIST();

  try {
    const articles = await fetchNewsRSS();

    // Always clean up expired articles (even when fetch returns 0)
    await supabase
      .from("news_articles")
      .delete()
      .lt("expires_at", new Date().toISOString());

    // Zero-article guard: log as skipped, don't upsert
    if (articles.length === 0) {
      await supabase.from("pipeline_log").insert({
        run_date: today,
        step: "news_fetch",
        status: "skipped",
        rows_affected: 0,
        error_message: "RSS returned 0 classified articles - possible parser break or upstream issue",
        duration_ms: Date.now() - startTime,
        completed_at: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        skipped: true,
        articles: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    // Upsert classified articles
    const rows = articles.map((a) => ({
      guid: a.guid,
      title: a.title,
      source_name: a.sourceName,
      url: a.url,
      published_at: a.publishedAt,
      snippet: a.snippet,
      domains: a.domains,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(
        new Date(a.publishedAt).getTime() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    }));

    const { error } = await supabase
      .from("news_articles")
      .upsert(rows, { onConflict: "guid" });

    if (error) throw error;

    // Log success
    await supabase.from("pipeline_log").insert({
      run_date: today,
      step: "news_fetch",
      status: "success",
      rows_affected: articles.length,
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      articles: articles.length,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    await supabase.from("pipeline_log").insert({
      run_date: today,
      step: "news_fetch",
      status: "error",
      error_message: message,
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    });

    console.error("[cron/fetch-news]", message);
    return NextResponse.json(
      { success: false, error: "Pipeline step failed" },
      { status: 500 }
    );
  }
}

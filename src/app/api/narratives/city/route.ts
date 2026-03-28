import { NextResponse } from "next/server";

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ narrative: null });
  }

  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const { data } = await supabase
    .from("daily_briefing")
    .select("briefing_date, ai_headline_en, ai_headline_ta, ai_body_en, ai_body_ta, ai_source_dates, ai_model")
    .not("ai_headline_en", "is", null)
    .order("briefing_date", { ascending: false })
    .limit(1);

  if (!data?.[0]) {
    return NextResponse.json({ narrative: null });
  }

  const row = data[0];
  return NextResponse.json({
    narrative: {
      date: row.briefing_date,
      headline_en: row.ai_headline_en,
      headline_ta: row.ai_headline_ta,
      body_en: row.ai_body_en,
      body_ta: row.ai_body_ta,
      source_dates: row.ai_source_dates,
      model: row.ai_model,
    },
  });
}

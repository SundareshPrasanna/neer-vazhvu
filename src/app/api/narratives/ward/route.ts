import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wardParam = searchParams.get("ward");

  if (!wardParam) {
    return NextResponse.json({ error: "ward parameter required" }, { status: 400 });
  }

  const wardNumber = parseInt(wardParam, 10);
  if (isNaN(wardNumber) || wardNumber < 1 || wardNumber > 200) {
    return NextResponse.json({ error: "ward must be 1-200" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ narrative: null });
  }

  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const { data } = await supabase
    .from("ward_narrative")
    .select("narrative_date, headline_en, headline_ta, body_en, body_ta, source_dates, key_facts, model")
    .eq("ward_number", wardNumber)
    .order("narrative_date", { ascending: false })
    .limit(1);

  if (!data?.[0]) {
    return NextResponse.json({ narrative: null });
  }

  const row = data[0];
  return NextResponse.json({
    narrative: {
      ward_number: wardNumber,
      date: row.narrative_date,
      headline_en: row.headline_en,
      headline_ta: row.headline_ta,
      body_en: row.body_en,
      body_ta: row.body_ta,
      source_dates: row.source_dates,
      key_facts: row.key_facts,
      model: row.model,
    },
  });
}

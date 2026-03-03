import { NextResponse } from 'next/server';
import { generateMockRiskScores } from '@/lib/mock-data';
import type { RiskLevel } from '@/types/groundwater';

function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function GET() {
  // Demo mode: Supabase not configured — use mock data so the full UI is exercisable
  if (!isSupabaseConfigured()) {
    return NextResponse.json(generateMockRiskScores());
  }

  const { createServerClient } = await import('@/lib/supabase/server');
  const supabase = createServerClient();

  // Find most recent computed_date
  const { data: latest } = await supabase
    .from('ward_risk_score')
    .select('computed_date')
    .order('computed_date', { ascending: false })
    .limit(1);

  // No risk data yet (pipeline hasn't run) — return empty so UI hides the toggle
  if (!latest || latest.length === 0) {
    return NextResponse.json({ computedDate: null, wards: [] });
  }

  const computedDate = latest[0].computed_date as string;

  const { data, error } = await supabase
    .from('ward_risk_score')
    .select('ward_number, risk_score, risk_level, groundwater_component, trend_component, reservoir_component, seasonal_component')
    .eq('computed_date', computedDate)
    .order('ward_number', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const wards = (data || []).map((r) => ({
    wardNumber: r.ward_number as number,
    riskScore: r.risk_score as number,
    riskLevel: (r.risk_level as string).toLowerCase() as RiskLevel,
    groundwaterComponent: r.groundwater_component as number | null,
    trendComponent: r.trend_component as number | null,
    reservoirComponent: r.reservoir_component as number | null,
    seasonalComponent: r.seasonal_component as number | null,
  }));

  return NextResponse.json({ computedDate, wards });
}

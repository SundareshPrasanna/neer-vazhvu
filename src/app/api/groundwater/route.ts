import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { dataServiceUnavailable, internalServerError, isExplicitDemoMode, logRouteError } from '@/lib/api-error';
import { getGroundwaterStatus } from '@/types/groundwater';
import { generateMockGroundwater } from '@/lib/mock-data';

// Load canonical ward data once at module level
const wardNamesPath = resolve(process.cwd(), 'public/data/ward-names.json');
const wardNamesData = (JSON.parse(readFileSync(wardNamesPath, 'utf-8')) as {
  wards: { ward_number: number; zone_name: string }[];
}).wards;
const canonicalNames = new Map<number, string>(
  wardNamesData.map((w) => [w.ward_number, `Ward ${w.ward_number}`])
);
const canonicalZones = new Map<number, string>(
  wardNamesData.map((w) => [w.ward_number, w.zone_name])
);

function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function GET(request: NextRequest) {
  // Mock data only behind explicit demo mode; a bare missing config is an
  // error, not a fallback (baseline P0.4).
  if (!isSupabaseConfigured()) {
    if (!isExplicitDemoMode()) return dataServiceUnavailable();
    const { searchParams } = new URL(request.url);
    const VALID_STYLES = ['healthy', 'declining', 'crisis', 'recovering'] as const;
    const rawStyle = searchParams.get('style');
    const style = VALID_STYLES.includes(rawStyle as typeof VALID_STYLES[number]) ? (rawStyle as typeof VALID_STYLES[number]) : 'healthy';
    const mockData = generateMockGroundwater(style);
    return NextResponse.json(mockData);
  }

  const { createServerClient } = await import('@/lib/supabase/server');

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');

  const supabase = createServerClient();

  // If no year/month specified, find the most recent data
  let year: number;
  let month: number;

  if (yearParam && monthParam) {
    year = parseInt(yearParam, 10);
    month = parseInt(monthParam, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
    }
  } else {
    const { data: latest } = await supabase
      .from('groundwater_monthly')
      .select('year, month')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1);

    if (!latest || latest.length === 0) {
      return NextResponse.json({ error: 'No groundwater data available' }, { status: 404 });
    }
    year = latest[0].year;
    month = latest[0].month;
  }

  // Fetch all wards for this period
  const { data: currentData, error } = await supabase
    .from('groundwater_monthly')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .order('ward_number', { ascending: true })
    .limit(200);

  if (error) {
    logRouteError('/api/groundwater', error);
    return internalServerError();
  }

  // Fetch previous year same month for trend
  const { data: prevYearData } = await supabase
    .from('groundwater_monthly')
    .select('ward_number, depth_to_water_m')
    .eq('year', year - 1)
    .eq('month', month)
    .limit(200);

  const prevYearMap = new Map(
    prevYearData?.map((r) => [r.ward_number, r.depth_to_water_m]) || []
  );

  // Build ward list
  const wards = (currentData || []).map((r) => {
    const prevDepth = prevYearMap.get(r.ward_number);
    let trend: 'improving' | 'stable' | 'declining' | 'unknown' = 'unknown';

    if (prevDepth != null && r.depth_to_water_m != null) {
      const diff = r.depth_to_water_m - prevDepth;
      if (diff < -0.5) trend = 'improving'; // water table rising (depth decreasing)
      else if (diff > 0.5) trend = 'declining'; // water table falling
      else trend = 'stable';
    }

    return {
      wardNumber: r.ward_number,
      wardName: canonicalNames.get(r.ward_number) || r.ward_name || `Ward ${r.ward_number}`,
      wardNameTa: r.ward_name_ta || r.ward_name_tamil || undefined,
      zone: canonicalZones.get(r.ward_number) || r.zone_name || '',
      depthM: r.depth_to_water_m,
      trend,
    };
  });

  // Compute summary counts
  const summary = { healthy: 0, moderate: 0, declining: 0, stressed: 0, critical: 0, crisis: 0, noData: 0 };
  for (const w of wards) {
    const status = getGroundwaterStatus(w.depthM);
    summary[status]++;
  }

  // City average
  const withData = wards.filter((w) => w.depthM != null);
  const cityAverage =
    withData.length > 0
      ? withData.reduce((sum, w) => sum + w.depthM!, 0) / withData.length
      : null;

  return NextResponse.json({
    period: { year, month },
    cityAverage: cityAverage ? parseFloat(cityAverage.toFixed(1)) : null,
    wards,
    summary,
  });
}

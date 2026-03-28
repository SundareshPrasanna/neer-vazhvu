import { NextRequest, NextResponse } from 'next/server';
import { internalServerError, logRouteError } from '@/lib/api-error';
import { createServerClient } from '@/lib/supabase/server';
import { RESERVOIR_METADATA } from '@/lib/utils/constants';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawDays = parseInt(searchParams.get('days') || '90', 10);
  const days = isNaN(rawDays) ? 90 : Math.max(1, Math.min(365, rawDays));

  const supabase = createServerClient();

  // Get the most recent date's readings
  const { data: latest, error: latestErr } = await supabase
    .from('reservoir_daily')
    .select('*')
    .order('date', { ascending: false })
    .limit(6); // 6 reservoirs

  if (latestErr) {
    logRouteError('/api/reservoir', latestErr);
    return internalServerError();
  }

  if (!latest || latest.length === 0) {
    return NextResponse.json({ error: 'No reservoir data available' }, { status: 404 });
  }

  const mostRecentDate = latest[0].date;
  const todayReservoirs = latest.filter((r) => r.date === mostRecentDate);

  // Get reservoir metadata for display names
  // Build reservoir summaries
  const reservoirs = todayReservoirs.map((r) => {
    const reservoirName = r.reservoir as keyof typeof RESERVOIR_METADATA;
    const m = RESERVOIR_METADATA[reservoirName];
    return {
      name: reservoirName,
      displayName: m?.displayName || reservoirName,
      currentStorage: r.current_storage_mcft || 0,
      capacity: r.capacity_mcft || m?.fullCapacityMcft || 0,
      storagePct: r.storage_pct || 0,
      inflowCusecs: r.inflow_cusecs || 0,
      outflowCusecs: r.outflow_cusecs || 0,
      rainfallMm: r.rainfall_mm || 0,
    };
  });

  const totalStorage = reservoirs.reduce((sum, r) => sum + r.currentStorage, 0);
  const totalCapacity = reservoirs.reduce((sum, r) => sum + r.capacity, 0);

  // Get historical data for trend chart
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data: historyRaw } = await supabase
    .from('reservoir_daily')
    .select('date, current_storage_mcft')
    .gte('date', cutoffDate.toISOString().split('T')[0])
    .order('date', { ascending: true })
    .limit(2500);

  // Aggregate by date (sum all reservoirs per day)
  const historyMap = new Map<string, number>();
  for (const row of historyRaw || []) {
    historyMap.set(
      row.date,
      (historyMap.get(row.date) || 0) + (row.current_storage_mcft || 0)
    );
  }
  const history = Array.from(historyMap.entries()).map(([date, totalStorage]) => ({
    date,
    totalStorage,
  }));

  return NextResponse.json({
    lastUpdated: mostRecentDate,
    reservoirs,
    totals: {
      currentStorage: totalStorage,
      capacity: totalCapacity,
      storagePct: totalCapacity > 0 ? (totalStorage / totalCapacity) * 100 : 0,
    },
    history,
  });
}

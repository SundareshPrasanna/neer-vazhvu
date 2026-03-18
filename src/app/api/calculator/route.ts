import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { computeDaysLeft } from '@/lib/calculator/days-left';
import {
  DEFAULT_CONSUMPTION_MLD,
  DEFAULT_DESALINATION_MLD,
  CUSEC_DAY_TO_MCFT,
  DAY_ZERO_2019,
} from '@/lib/utils/constants';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawConsumption = searchParams.get('consumption');
  const consumption = rawConsumption !== null ? parseFloat(rawConsumption) : NaN;
  const finalConsumption = Number.isFinite(consumption) ? consumption : DEFAULT_CONSUMPTION_MLD;

  const rawDesalination = searchParams.get('desalination');
  const desalination = rawDesalination !== null ? parseFloat(rawDesalination) : NaN;
  const finalDesalination = Number.isFinite(desalination) ? desalination : DEFAULT_DESALINATION_MLD;

  const supabase = createServerClient();

  // 1. Get latest reservoir totals
  const { data: latest } = await supabase
    .from('reservoir_daily')
    .select('reservoir, current_storage_mcft, capacity_mcft, inflow_cusecs, date')
    .order('date', { ascending: false })
    .limit(12);

  if (!latest || latest.length === 0) {
    return NextResponse.json({ error: 'No reservoir data available' }, { status: 404 });
  }

  const mostRecentDate = latest[0].date;
  const todayReservoirs = latest.filter((r) => r.date === mostRecentDate);

  const totalStorage = todayReservoirs.reduce(
    (sum, r) => sum + (r.current_storage_mcft || 0),
    0
  );
  const totalCapacity = todayReservoirs.reduce(
    (sum, r) => sum + (r.capacity_mcft || 0),
    0
  );

  // 2. Recent 7-day average inflow
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: recentData } = await supabase
    .from('reservoir_daily')
    .select('date, inflow_cusecs')
    .gte('date', sevenDaysAgo.toISOString().split('T')[0])
    .not('inflow_cusecs', 'is', null);

  let recentAvgInflowMcftPerDay = 0;
  if (recentData && recentData.length > 0) {
    const byDate = new Map<string, number>();
    for (const row of recentData) {
      byDate.set(row.date, (byDate.get(row.date) || 0) + (row.inflow_cusecs || 0));
    }
    const dailyTotals = Array.from(byDate.values());
    const avgCusecs = dailyTotals.reduce((s, v) => s + v, 0) / dailyTotals.length;
    recentAvgInflowMcftPerDay = avgCusecs * CUSEC_DAY_TO_MCFT;
  }

  // 3. Seasonal average inflow
  const currentMonth = new Date().getMonth() + 1;
  const { data: seasonalData } = await supabase.rpc('avg_monthly_inflow', {
    target_month: currentMonth,
  });
  const seasonalAvgInflowMcftPerDay = seasonalData?.[0]?.avg_inflow_mcft_per_day || 0;

  // 4. Compute
  const result = computeDaysLeft({
    totalStorageMcft: totalStorage,
    totalCapacityMcft: totalCapacity,
    dailyConsumptionMLD: finalConsumption,
    desalinationMLD: finalDesalination,
    recentAvgInflowMcftPerDay,
    seasonalAvgInflowMcftPerDay,
  });

  // 5. Get 2019 comparison data (same day-of-year in 2019)
  const today = new Date();
  const sameDay2019 = `2019-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const { data: data2019 } = await supabase
    .from('reservoir_daily')
    .select('current_storage_mcft')
    .eq('date', sameDay2019);

  const storageOnThisDateIn2019 = data2019
    ? data2019.reduce((sum, r) => sum + (r.current_storage_mcft || 0), 0)
    : null;

  return NextResponse.json({
    daysLeft: {
      pessimistic: result.pessimistic,
      moderate: result.moderate,
      optimistic: result.optimistic,
    },
    assumptions: {
      consumptionMLD: finalConsumption,
      desalinationMLD: finalDesalination,
      netReservoirDemandMLD: finalConsumption - finalDesalination,
      recentAvgInflowMcftPerDay,
      seasonalAvgInflowMcftPerDay,
    },
    storage: {
      totalMcft: totalStorage,
      capacityMcft: totalCapacity,
      pct: result.storagePct,
    },
    comparison2019: {
      storageOnThisDateIn2019: storageOnThisDateIn2019 || null,
      dayZeroStorage: DAY_ZERO_2019.totalStorageMcft,
      dayZeroDate: DAY_ZERO_2019.date,
    },
    computedAt: result.lastUpdated,
  });
}

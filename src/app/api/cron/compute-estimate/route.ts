import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeDaysLeft } from '@/lib/calculator/days-left';
import { subtractDays, todayIST, todayISTParts } from '@/lib/utils/date';
import {
  DEFAULT_CONSUMPTION_MLD,
  DEFAULT_DESALINATION_MLD,
  MLD_TO_MCFT,
  CUSEC_DAY_TO_MCFT,
} from '@/lib/utils/constants';

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const startTime = Date.now();
  const supabase = createAdminClient();
  const today = todayIST();

  try {
    // 1. Get latest reservoir data (most recent date)
    const { data: latestReservoirs, error: resErr } = await supabase
      .from('reservoir_daily')
      .select('reservoir, current_storage_mcft, capacity_mcft, inflow_cusecs, outflow_cusecs, date')
      .order('date', { ascending: false })
      .limit(12); // 6 reservoirs × ~2 most recent dates

    if (resErr) throw resErr;
    if (!latestReservoirs || latestReservoirs.length === 0) {
      throw new Error('No reservoir data available for estimate computation');
    }

    // Get the most recent date
    const mostRecentDate = latestReservoirs[0].date;
    const todayReservoirs = latestReservoirs.filter((r) => r.date === mostRecentDate);

    const totalStorage = todayReservoirs.reduce(
      (sum, r) => sum + (r.current_storage_mcft || 0),
      0
    );
    const totalCapacity = todayReservoirs.reduce(
      (sum, r) => sum + (r.capacity_mcft || 0),
      0
    );

    // 2. Compute 7-day rolling average inflow
    const sevenDaysAgo = subtractDays(new Date(), 7);
    const { data: recentData } = await supabase
      .from('reservoir_daily')
      .select('date, inflow_cusecs')
      .gte('date', sevenDaysAgo)
      .not('inflow_cusecs', 'is', null);

    let recentAvgInflowMcftPerDay = 0;
    if (recentData && recentData.length > 0) {
      // Group by date and sum all reservoirs
      const byDate = new Map<string, number>();
      for (const row of recentData) {
        byDate.set(row.date, (byDate.get(row.date) || 0) + (row.inflow_cusecs || 0));
      }
      const dailyTotals = Array.from(byDate.values());
      const avgCusecs = dailyTotals.reduce((s, v) => s + v, 0) / dailyTotals.length;
      recentAvgInflowMcftPerDay = avgCusecs * CUSEC_DAY_TO_MCFT;
    }

    // 3. Get seasonal average inflow
    const currentMonth = todayISTParts().month;
    const { data: seasonalData } = await supabase.rpc('avg_monthly_inflow', {
      target_month: currentMonth,
    });
    const seasonalAvgInflowMcftPerDay = seasonalData?.[0]?.avg_inflow_mcft_per_day || 0;

    // 4. Compute estimate
    const result = computeDaysLeft({
      totalStorageMcft: totalStorage,
      totalCapacityMcft: totalCapacity,
      dailyConsumptionMLD: DEFAULT_CONSUMPTION_MLD,
      desalinationMLD: DEFAULT_DESALINATION_MLD,
      recentAvgInflowMcftPerDay,
      seasonalAvgInflowMcftPerDay,
    });

    // 5. Store estimate
    const netDemandMcft = (DEFAULT_CONSUMPTION_MLD - DEFAULT_DESALINATION_MLD) * MLD_TO_MCFT;
    const { error: insertErr } = await supabase
      .from('water_estimate_daily')
      .upsert(
        {
          date: today,
          total_storage_mcft: totalStorage,
          total_capacity_mcft: totalCapacity,
          storage_pct: result.storagePct,
          consumption_mld: DEFAULT_CONSUMPTION_MLD,
          consumption_mcft_day: netDemandMcft,
          avg_inflow_mcft_day: recentAvgInflowMcftPerDay,
          net_depletion_mcft_day: result.netDepletionRateMcftPerDay,
          days_left_pessimistic: result.pessimistic,
          days_left_moderate: result.moderate,
          days_left_optimistic: result.optimistic,
        },
        { onConflict: 'date' }
      );

    if (insertErr) throw insertErr;

    await supabase.from('pipeline_log').insert({
      run_date: today,
      step: 'compute_estimate',
      status: 'success',
      rows_affected: 1,
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      estimate: result,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    await supabase.from('pipeline_log').insert({
      run_date: today,
      step: 'compute_estimate',
      status: 'error',
      error_message: message,
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

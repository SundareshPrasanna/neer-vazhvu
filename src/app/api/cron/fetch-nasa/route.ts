import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchNASAPower } from '@/lib/api-clients/nasa-power';
import { subtractDays, todayIST } from '@/lib/utils/date';

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const startTime = Date.now();
  const supabase = createAdminClient();
  const today = todayIST();

  try {
    // NASA POWER has ~2 day lag, so fetch 5 days back to fill gaps
    const endDate = subtractDays(new Date(), 2);
    const startDate = subtractDays(new Date(), 5);

    const days = await fetchNASAPower(startDate, endDate);

    if (days.length === 0) {
      // Not an error — NASA data might not be ready yet
      await supabase.from('pipeline_log').insert({
        run_date: today,
        step: 'nasa_fetch',
        status: 'skipped',
        rows_affected: 0,
        duration_ms: Date.now() - startTime,
        completed_at: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, message: 'No new NASA data available', rows: 0 });
    }

    const rows = days.map((d) => ({
      date: d.date,
      precipitation_mm: d.precipitation_mm,
      temp_max_c: d.temp_max_c,
      temp_min_c: d.temp_min_c,
      humidity_pct: d.humidity_pct,
      source: 'nasa_power' as const,
    }));

    const { error } = await supabase
      .from('weather_daily')
      .upsert(rows, { onConflict: 'date' });

    if (error) throw error;

    await supabase.from('pipeline_log').insert({
      run_date: today,
      step: 'nasa_fetch',
      status: 'success',
      rows_affected: days.length,
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      rows: days.length,
      dateRange: { start: startDate, end: endDate },
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    await supabase.from('pipeline_log').insert({
      run_date: today,
      step: 'nasa_fetch',
      status: 'error',
      error_message: message,
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

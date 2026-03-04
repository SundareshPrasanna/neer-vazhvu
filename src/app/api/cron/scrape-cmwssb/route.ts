import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { scrapeCMWSSB } from '@/lib/scrapers/cmwssb';
import { todayIST } from '@/lib/utils/date';

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const startTime = Date.now();
  const supabase = createAdminClient();
  const today = todayIST();

  try {
    const { date, readings } = await scrapeCMWSSB();

    // Warn if data is stale (>2 days old)
    const daysDiff = Math.abs(
      (new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > 2) {
      console.warn(`CMWSSB data is ${daysDiff.toFixed(0)} days old (date: ${date})`);
    }

    // Upsert reservoir readings
    const rows = readings.map((r) => ({
      reservoir: r.reservoir,
      date: r.date,
      current_level_ft: r.current_level_ft,
      current_storage_mcft: r.current_storage_mcft,
      capacity_mcft: r.capacity_mcft,
      storage_pct: r.storage_pct,
      inflow_cusecs: r.inflow_cusecs,
      outflow_cusecs: r.outflow_cusecs,
      rainfall_mm: r.rainfall_mm,
      source: 'cmwssb_scrape' as const,
    }));

    const { error } = await supabase
      .from('reservoir_daily')
      .upsert(rows, { onConflict: 'reservoir,date' });

    if (error) throw error;

    // Log success
    await supabase.from('pipeline_log').insert({
      run_date: today,
      step: 'cmwssb_scrape',
      status: 'success',
      rows_affected: readings.length,
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      date,
      reservoirs: readings.length,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    await supabase.from('pipeline_log').insert({
      run_date: today,
      step: 'cmwssb_scrape',
      status: 'error',
      error_message: message,
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

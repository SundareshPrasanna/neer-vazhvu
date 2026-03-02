import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchCKANResource, OPENCITY_RESOURCES } from '@/lib/api-clients/opencity';

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const startTime = Date.now();
  const supabase = createAdminClient();
  const today = new Date().toISOString().split('T')[0];
  const dayOfMonth = new Date().getDate();

  // Only fetch on the 1st-3rd of the month (OpenCity updates monthly)
  if (dayOfMonth > 3) {
    return NextResponse.json({ success: true, message: 'Skipped — not first 3 days of month' });
  }

  try {
    let totalRows = 0;

    // Fetch latest groundwater data (try current year first)
    const currentYear = new Date().getFullYear();
    const yearKey = currentYear.toString();
    const resourceId = (OPENCITY_RESOURCES.groundwater as Record<string, string>)[yearKey];

    if (resourceId) {
      const records = await fetchCKANResource<Record<string, string>>(resourceId);

      const rows = records
        .filter((r) => r['Ward No'] || r['ward_no'])
        .map((r) => ({
          ward_number: parseInt(r['Ward No'] || r['ward_no'], 10),
          ward_name: r['Ward Name'] || r['ward_name'] || null,
          zone_name: r['Zone'] || r['zone'] || null,
          year: parseInt(r['Year'] || r['year'] || currentYear.toString(), 10),
          month: parseInt(r['Month'] || r['month'] || '1', 10),
          depth_to_water_m: parseFloat(r['Depth to Water Level (m)'] || r['depth_m'] || '0') || null,
          source: 'opencity_ckan' as const,
        }))
        .filter((r) => !isNaN(r.ward_number));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('groundwater_monthly')
          .upsert(rows, { onConflict: 'ward_number,year,month' });

        if (error) throw error;
        totalRows = rows.length;
      }
    }

    await supabase.from('pipeline_log').insert({
      run_date: today,
      step: 'opencity_fetch',
      status: 'success',
      rows_affected: totalRows,
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      rows: totalRows,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    await supabase.from('pipeline_log').insert({
      run_date: today,
      step: 'opencity_fetch',
      status: 'error',
      error_message: message,
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

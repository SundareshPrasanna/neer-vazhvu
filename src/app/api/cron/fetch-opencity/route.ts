import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchCKANResource, OPENCITY_RESOURCES } from '@/lib/api-clients/opencity';
import { todayIST, todayISTParts } from '@/lib/utils/date';

type CKANValue = string | number | null | undefined;
type CKANRecord = Record<string, CKANValue>;

const MONTH_NAMES = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

function getField(record: CKANRecord, candidates: readonly string[]): CKANValue {
  for (const key of candidates) {
    const value = record[key];
    if (value == null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    return value;
  }
  return undefined;
}

function parseWardNumber(value: CKANValue): number | null {
  if (value == null) return null;
  const parsed = parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > 200) return null;
  return parsed;
}

function parseDepth(value: CKANValue): number | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized || normalized === 'NA' || normalized === 'N/A') return null;
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMonth(value: CKANValue): number | null {
  if (value == null) return null;
  const raw = String(value).trim().toLowerCase();
  const numeric = parseInt(raw, 10);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) {
    return numeric;
  }
  const idx = MONTH_NAMES.findIndex((m) => m === raw || `${m}.` === raw);
  return idx >= 0 ? idx + 1 : null;
}

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const startTime = Date.now();
  const supabase = createAdminClient();
  const today = todayIST();
  const { day: dayOfMonth, year: currentYear } = todayISTParts();

  // Only fetch on the 1st-3rd of the month (OpenCity updates monthly)
  if (dayOfMonth > 3) {
    return NextResponse.json({ success: true, message: 'Skipped: not first 3 days of month' });
  }

  try {
    let totalRows = 0;

    // Pick newest available CKAN resource not beyond current year.
    const resourceMap = OPENCITY_RESOURCES.groundwater as Record<string, string>;
    const availableYears = Object.keys(resourceMap)
      .map((y) => parseInt(y, 10))
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => b - a);

    const selectedYear =
      availableYears.find((y) => y <= currentYear) ?? availableYears[0] ?? null;
    if (!selectedYear) {
      throw new Error('No OpenCity groundwater resource IDs configured');
    }

    const resourceId = resourceMap[String(selectedYear)];
    const records = await fetchCKANResource<CKANRecord>(resourceId);

    const rows: Array<{
      ward_number: number;
      ward_name: string | null;
      zone_name: string | null;
      year: number;
      month: number;
      depth_to_water_m: number | null;
      source: 'opencity_ckan';
    }> = [];

    for (const record of records) {
      const wardNumber = parseWardNumber(
        getField(record, ['Ward No', 'Ward_No', 'ward_no', 'WARD_NO', 'Ward Number'])
      );
      if (!wardNumber) continue;

      const wardName = getField(record, ['Ward Name', 'Ward_Name', 'ward_name', 'WARD_NAME']);
      const zoneName = getField(record, ['Zone', 'zone', 'ZONE', 'Zone Name', 'zone_name']);
      const yearOverride = parseInt(String(getField(record, ['Year', 'year']) ?? selectedYear), 10);
      const rowYear = Number.isFinite(yearOverride) ? yearOverride : selectedYear;

      let expanded = false;
      for (let month = 1; month <= 12; month++) {
        const monthKey = MONTH_NAMES[month - 1];
        const depth = parseDepth(
          getField(record, [monthKey, monthKey.toUpperCase(), `${monthKey}.`])
        );
        if (depth == null) continue;
        rows.push({
          ward_number: wardNumber,
          ward_name: wardName ? String(wardName) : null,
          zone_name: zoneName ? String(zoneName) : null,
          year: rowYear,
          month,
          depth_to_water_m: depth,
          source: 'opencity_ckan',
        });
        expanded = true;
      }

      // Fallback for datasets that are already row-based instead of month-column based.
      if (!expanded) {
        const month = parseMonth(getField(record, ['Month', 'month', 'MONTH']));
        const depth = parseDepth(
          getField(record, [
            'Depth to Water Level (m)',
            'Depth_to_Water_Level_m',
            'depth_m',
            'Depth to Water Level(m)',
            'Water Level (m)',
            'Depth',
          ])
        );
        if (month && depth != null) {
          rows.push({
            ward_number: wardNumber,
            ward_name: wardName ? String(wardName) : null,
            zone_name: zoneName ? String(zoneName) : null,
            year: rowYear,
            month,
            depth_to_water_m: depth,
            source: 'opencity_ckan',
          });
        }
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from('groundwater_monthly')
        .upsert(rows, { onConflict: 'ward_number,year,month' });

      if (error) throw error;
      totalRows = rows.length;
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
      sourceYear: selectedYear,
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

    console.error('[cron/fetch-opencity]', message);
    return NextResponse.json({ success: false, error: 'Pipeline step failed' }, { status: 500 });
  }
}

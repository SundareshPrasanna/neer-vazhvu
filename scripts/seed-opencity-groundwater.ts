/**
 * One-time script: Seed OpenCity ward-wise groundwater data into Supabase.
 *
 * Fetches from CKAN API for years 2021-2024.
 * Run: npx tsx scripts/seed-opencity-groundwater.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CKAN_BASE = 'https://data.opencity.in/api/3/action/datastore_search';

const GROUNDWATER_RESOURCES: Record<string, string> = {
  '2021': '61ef9b4e-feae-4e73-b503-aa2cba9eda50',
  '2022': '0e44c0a9-4965-4385-8988-ff4ed6f7534c',
  '2023': '2ccf989b-a340-4c49-8264-80a0b60717aa',
  '2024': '3a41ca9e-dbe1-495a-9ee3-c14aeaa988c6',
};

async function fetchAll(resourceId: string): Promise<Record<string, string>[]> {
  const allRecords: Record<string, string>[] = [];
  let offset = 0;
  const limit = 5000;

  while (true) {
    const url = `${CKAN_BASE}?resource_id=${resourceId}&limit=${limit}&offset=${offset}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success || !data.result.records.length) break;

    allRecords.push(...data.result.records);
    if (data.result.records.length < limit) break;
    offset += limit;
  }

  return allRecords;
}

// Common column name variations in OpenCity data
function getField(record: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key];
    }
  }
  return undefined;
}

async function main() {
  let totalInserted = 0;

  for (const [yearStr, resourceId] of Object.entries(GROUNDWATER_RESOURCES)) {
    console.log(`Fetching groundwater data for ${yearStr}...`);

    const records = await fetchAll(resourceId);
    console.log(`  Got ${records.length} records`);

    if (records.length === 0) continue;

    // Log available columns for debugging
    if (records[0]) {
      console.log(`  Columns: ${Object.keys(records[0]).join(', ')}`);
    }

    const rows = records
      .map((r) => {
        const wardNum = parseInt(
          getField(r, 'Ward No', 'Ward_No', 'ward_no', 'Ward Number', 'WARD_NO') || '0',
          10
        );
        const depthStr = getField(
          r,
          'Depth to Water Level (m)',
          'Depth_to_Water_Level_m',
          'depth_m',
          'Depth to Water Level(m)',
          'Water Level (m)',
          'Depth'
        );
        const monthStr = getField(r, 'Month', 'month', 'MONTH');
        const wardName = getField(r, 'Ward Name', 'Ward_Name', 'ward_name', 'WARD_NAME');
        const zone = getField(r, 'Zone', 'zone', 'ZONE', 'Zone Name');

        const month = monthStr ? parseMonthStr(monthStr) : null;
        const depth = depthStr ? parseFloat(depthStr) : null;

        return {
          ward_number: wardNum,
          ward_name: wardName || null,
          zone_name: zone || null,
          year: parseInt(yearStr, 10),
          month: month || 1,
          depth_to_water_m: isNaN(depth!) ? null : depth,
          source: 'opencity_ckan' as const,
        };
      })
      .filter((r) => r.ward_number > 0 && r.ward_number <= 200);

    if (rows.length === 0) {
      console.log(`  No valid rows for ${yearStr}`);
      continue;
    }

    // Batch upsert
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('groundwater_monthly')
        .upsert(chunk, { onConflict: 'ward_number,year,month' });

      if (error) {
        console.error(`  Error:`, error.message);
      } else {
        totalInserted += chunk.length;
      }
    }

    console.log(`  Inserted ${rows.length} rows for ${yearStr}`);
  }

  console.log(`\nDone! Total: ${totalInserted} groundwater rows`);
}

function parseMonthStr(s: string): number | null {
  const num = parseInt(s, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return num;

  const months: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12,
  };
  return months[s.toLowerCase().trim()] || null;
}

main().catch(console.error);

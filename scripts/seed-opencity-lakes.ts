/**
 * One-time script: Seed OpenCity monthly lake level data into Supabase.
 *
 * Fills the gap between Kaggle data (ends ~2019) and live CMWSSB scraping.
 * Run: npx tsx scripts/seed-opencity-lakes.ts
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

const LAKE_RESOURCES: Record<string, string> = {
  poondi: '8b0c0edc-4204-4f0f-8dc7-2db4817af04f',
  cholavaram: '20dc9876-ef1d-4cf1-9c42-f9d6c1f137db',
  redhills: 'febf2951-71eb-4807-9a06-246dadc1ef04',
  chembarambakkam: 'db41b1a4-5746-46d0-a006-e8fe2b1545a9',
  veeranam: 'a2f9aaad-7ac2-4a01-90d6-801eeef7d4b6',
  kannankottai: 'e0355257-d2d9-48be-a31e-6596a5fcdc07',
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

async function main() {
  let totalInserted = 0;

  for (const [reservoir, resourceId] of Object.entries(LAKE_RESOURCES)) {
    console.log(`Fetching lake data for ${reservoir}...`);

    const records = await fetchAll(resourceId);
    console.log(`  Got ${records.length} records`);

    if (records.length === 0) continue;

    // Log columns for debugging
    if (records[0]) {
      console.log(`  Columns: ${Object.keys(records[0]).join(', ')}`);
    }

    const rows = records
      .map((r) => {
        // Try to find a date field
        const dateStr =
          r['Date'] || r['date'] || r['Period'] || r['period'] || r['Month'] || '';

        let date: string | null = null;

        // Try YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          date = dateStr.slice(0, 10);
        }
        // Try DD-MM-YYYY or DD/MM/YYYY
        else {
          const match = dateStr.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
          if (match) {
            date = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
          }
        }

        if (!date) return null;

        // Try to find storage value
        const storageStr =
          r['Storage (mcft)'] ||
          r['Storage(mcft)'] ||
          r['storage_mcft'] ||
          r['Current Storage (mcft)'] ||
          r['Storage'] ||
          '';

        const storage = parseFloat(storageStr);

        return {
          reservoir,
          date,
          current_storage_mcft: isNaN(storage) ? null : storage,
          source: 'opencity_ckan' as const,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && r.current_storage_mcft !== null);

    if (rows.length === 0) {
      console.log(`  No valid rows for ${reservoir}`);
      continue;
    }

    // Batch upsert
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('reservoir_daily')
        .upsert(chunk, { onConflict: 'reservoir,date' });

      if (error) {
        console.error(`  Error:`, error.message);
      } else {
        totalInserted += chunk.length;
      }
    }

    console.log(`  Inserted ${rows.length} rows for ${reservoir}`);
  }

  console.log(`\nDone! Total: ${totalInserted} lake rows`);
}

main().catch(console.error);

/**
 * One-time script: Seed Kaggle Chennai Water Management CSV into Supabase.
 *
 * Prerequisites:
 * 1. Download the dataset from: https://www.kaggle.com/datasets/sudalairajkumar/chennai-water-management
 * 2. Place the CSV file at: ./data/chennai_reservoir_levels.csv
 * 3. Set env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: npx tsx scripts/seed-kaggle.ts
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const RESERVOIR_MAP: Record<string, string> = {
  POONDI: 'poondi',
  CHOLAVARAM: 'cholavaram',
  REDHILLS: 'redhills',
  CHEMBARAMBAKKAM: 'chembarambakkam',
};

async function main() {
  const csvPath = path.join(process.cwd(), 'data', 'chennai_reservoir_levels.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found at ${csvPath}`);
    console.error('Download from: https://www.kaggle.com/datasets/sudalairajkumar/chennai-water-management');
    process.exit(1);
  }

  const csv = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csv, { columns: true, skip_empty_lines: true }) as Record<string, string>[];

  console.log(`Parsed ${records.length} CSV rows`);

  // Each CSV row becomes 4 database rows (one per reservoir)
  const rows: Array<{
    reservoir: string;
    date: string;
    current_storage_mcft: number;
    source: string;
  }> = [];

  for (const record of records) {
    // Date format: DD-MM-YYYY
    const dateStr = record['Date'];
    const match = dateStr.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (!match) continue;

    const date = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;

    for (const [csvCol, dbName] of Object.entries(RESERVOIR_MAP)) {
      const value = parseFloat(record[csvCol]);
      if (isNaN(value)) continue;

      rows.push({
        reservoir: dbName,
        date,
        current_storage_mcft: value,
        source: 'kaggle',
      });
    }
  }

  console.log(`Upserting ${rows.length} reservoir readings...`);

  // Batch upsert in chunks of 500
  const chunkSize = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('reservoir_daily')
      .upsert(chunk, { onConflict: 'reservoir,date' });

    if (error) {
      console.error(`Error at chunk ${i}:`, error.message);
    } else {
      inserted += chunk.length;
      process.stdout.write(`\r  ${inserted}/${rows.length} rows...`);
    }
  }

  console.log(`\nDone! Inserted ${inserted} rows.`);
}

main().catch(console.error);

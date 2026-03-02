import * as cheerio from 'cheerio';
import { RESERVOIR_NAME_MAP } from '@/lib/utils/constants';
import type { ReservoirName } from '@/types/reservoir';

interface ScrapedReservoir {
  reservoir: ReservoirName;
  date: string;
  current_level_ft: number | null;
  current_storage_mcft: number;
  capacity_mcft: number;
  storage_pct: number;
  inflow_cusecs: number;
  outflow_cusecs: number;
  rainfall_mm: number;
}

interface ScrapeResult {
  date: string;
  readings: ScrapedReservoir[];
}

/**
 * Scrapes the CMWSSB lake level page for current reservoir data.
 * Target: https://cmwssb.tn.gov.in/lake-level
 */
export async function scrapeCMWSSB(): Promise<ScrapeResult> {
  const response = await fetch('https://cmwssb.tn.gov.in/lake-level', {
    headers: {
      'User-Agent': 'NeerVazhvu/1.0 (Chennai Water Dashboard; educational use)',
    },
  });

  if (!response.ok) {
    throw new Error(`CMWSSB returned ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract date from heading — looks for DD/MM/YYYY pattern
  const pageText = $('body').text();
  const dateMatch = pageText.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (!dateMatch) {
    throw new Error('Could not parse date from CMWSSB page');
  }
  const date = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;

  // Parse table rows
  const readings: ScrapedReservoir[] = [];
  $('table tr').each((_i, row) => {
    const cells = $(row)
      .find('td')
      .map((_j, td) => $(td).text().trim())
      .get();

    if (cells.length < 9) return;

    const nameRaw = cells[0].toLowerCase();
    const reservoirKey = Object.entries(RESERVOIR_NAME_MAP).find(([key]) =>
      nameRaw.includes(key)
    )?.[1];

    if (!reservoirKey) return;

    readings.push({
      reservoir: reservoirKey as ReservoirName,
      date,
      current_level_ft: parseNum(cells[3]),
      current_storage_mcft: parseNum(cells[4]) ?? 0,
      capacity_mcft: parseNum(cells[2]) ?? 0,
      storage_pct: parseNum(cells[5]) ?? 0,
      inflow_cusecs: parseNum(cells[6]) ?? 0,
      outflow_cusecs: parseNum(cells[7]) ?? 0,
      rainfall_mm: parseNum(cells[8]) ?? 0,
    });
  });

  if (readings.length === 0) {
    throw new Error('No reservoir data found in CMWSSB page — HTML structure may have changed');
  }

  return { date, readings };
}

function parseNum(value: string): number | null {
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

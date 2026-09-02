/**
 * The weekly check for the WSSD tanker register:
 *
 *   npx tsx scripts/atlas-scarcity-tankers-fetch.ts
 *
 * Reads the department's listing page, finds the newest "Tanker Report
 * DD.MM.YYYY" PDF, and compares it against the served register. When a new
 * edition exists it downloads the PDF into .cache/scarcity-tankers/, hashes
 * it, and writes a DRAFT input beside the reviewed ones -
 * pipeline-inputs/atlas/mh/scarcity-tankers/<date>.json.draft - with the
 * source block filled in and the district rows deliberately EMPTY.
 *
 * The rows stay empty on purpose. The report is a scanned image and OCR on
 * it is not yet harness-grade (digit-doubling on the table grid), and a
 * draft that guessed numbers would look exactly like a transcription. The
 * human transcribes the 34 rows from the PDF, the arithmetic harness in
 * scripts/atlas-scarcity-tankers-mh.ts then has to reproduce the report's
 * own printed totals before the edition is accepted, and review flips to
 * verified only when a person has read the rows back against the page.
 *
 * Exit codes: 0 = register current, 2 = new edition drafted (so a scheduled
 * runner can surface it), 1 = the listing could not be read.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const LISTING_URL = "https://water.maharashtra.gov.in/en/document-category/tanker-report/";
const SERVED = join(ROOT, "public/data/atlas/mh/scarcity-tankers.json");
const INPUT_DIR = join(ROOT, "pipeline-inputs/atlas/mh/scarcity-tankers");
const CACHE_DIR = join(ROOT, ".cache/scarcity-tankers");

interface Listed { reportDate: string; pdfUrl: string; title: string }

function isoOf(dd: string, mm: string, yyyy: string): string {
  return `${yyyy}-${mm}-${dd}`;
}

/** Every "Tanker Report DD.MM.YYYY" link on the listing page, newest first. */
export function parseListing(html: string): Listed[] {
  const found = new Map<string, Listed>();
  const pattern = /href="(https:\/\/cdnbbsr[^"]+\.pdf)"[^>]*aria-label="[^"]*Tanker Report (\d{2})\.(\d{2})\.(\d{4})/g;
  for (const match of html.matchAll(pattern)) {
    const reportDate = isoOf(match[2], match[3], match[4]);
    if (!found.has(reportDate)) {
      found.set(reportDate, {
        reportDate,
        pdfUrl: match[1],
        title: `Tanker Report ${match[2]}.${match[3]}.${match[4]}`,
      });
    }
  }
  return [...found.values()].sort((a, b) => b.reportDate.localeCompare(a.reportDate));
}

/** The Monday-to-Sunday week a Monday-dated report covers: the seven days
 *  ending the day before the report date. */
export function weekOf(reportDate: string): { weekStart: string; weekEnd: string } {
  const end = new Date(`${reportDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { weekStart: iso(start), weekEnd: iso(end) };
}

async function main(): Promise<void> {
  const response = await fetch(LISTING_URL, { headers: { "user-agent": "neer-vazhvu-atlas (data freshness check)" } });
  if (!response.ok) throw new Error(`listing fetch failed: HTTP ${response.status}`);
  const listed = parseListing(await response.text());
  if (listed.length === 0) throw new Error("no Tanker Report links found on the listing page - the markup changed");

  const served = JSON.parse(readFileSync(SERVED, "utf8")) as { latestReportDate: string };
  const newest = listed[0];
  console.log(`listing newest: ${newest.reportDate}; served register: ${served.latestReportDate}`);
  if (newest.reportDate <= served.latestReportDate) {
    console.log("register is current.");
    return;
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  const pdfPath = join(CACHE_DIR, `${newest.reportDate}.pdf`);
  const pdfResponse = await fetch(newest.pdfUrl);
  if (!pdfResponse.ok) throw new Error(`pdf fetch failed: HTTP ${pdfResponse.status}`);
  const pdf = Buffer.from(await pdfResponse.arrayBuffer());
  writeFileSync(pdfPath, pdf);
  const sha = createHash("sha256").update(pdf).digest("hex");

  const draftPath = join(INPUT_DIR, `${newest.reportDate}.json.draft`);
  if (!existsSync(draftPath)) {
    const { weekStart, weekEnd } = weekOf(newest.reportDate);
    const draft = {
      _doc:
        "DRAFT - not read by the producer until renamed to .json. Transcribe the 34 district rows " +
        "from the cached PDF (villages, wadis, government/private/total tankers, division), fill " +
        "stateTotals, statedDistrictsWithTankers, worstDistrict and worstDivision from the report's " +
        "own prose and totals row, then run scripts/atlas-scarcity-tankers-mh.ts: the edition is " +
        "accepted only when the row sums reproduce the printed totals. weekStart/weekEnd are " +
        "derived from the report date - correct them if the report states its week differently.",
      schemaVersion: 1,
      reportDate: newest.reportDate,
      weekStart,
      weekEnd,
      source: { listingUrl: LISTING_URL, pdfUrl: newest.pdfUrl, pdfSha256: sha, title: `WSSD weekly tanker report, ${newest.title}` },
      districts: [],
      stateTotals: null,
      statedDistrictsWithTankers: null,
      worstDistrict: null,
      worstDivision: null,
      quotes: {},
      review: { status: "proposed", transcribedAt: null, transcribedBy: null, verifiedAt: null, verifiedBy: null },
    };
    writeFileSync(draftPath, JSON.stringify(draft, null, 2) + "\n");
  }
  console.log(`NEW EDITION ${newest.reportDate}: pdf cached at ${pdfPath} (${pdf.length} bytes, sha256 ${sha.slice(0, 12)}...)`);
  console.log(`draft input at ${draftPath} - transcribe, harness-check, review, then rename to .json.`);
  process.exitCode = 2;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

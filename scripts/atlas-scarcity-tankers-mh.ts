/**
 * The Maharashtra scarcity register: the WSSD weekly tanker report, served
 * as one state-scoped artifact accumulating editions.
 *
 *   npx tsx scripts/atlas-scarcity-tankers-mh.ts --as-of 2026-09-02
 *
 * Each edition is a reviewed transcription under
 * pipeline-inputs/atlas/mh/scarcity-tankers/<report-date>.json (the report
 * is a scanned PDF; the machine reader is a follow-up, plan 3.7). The
 * arithmetic harness here is the gate that makes transcription safe: an
 * edition is refused unless its 34 district rows sum exactly to the state
 * totals the report itself prints, its per-row tanker split adds up, its
 * count of districts running tankers matches the report's own prose, and
 * its worst-district and worst-division lines agree with the table. One
 * Solapur cell was wrong in the very first transcription and this harness
 * caught it before it was ever committed.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { registryLicense } from "./lib/registry-contract";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const INPUT_DIR = join(ROOT, "pipeline-inputs/atlas/mh/scarcity-tankers");
const OUT = join(ROOT, "public/data/atlas/mh/scarcity-tankers.json");
const PRODUCED_BY = "scripts/atlas-scarcity-tankers-mh.ts";
const DIVISIONS = new Set([
  "Konkan", "Nashik", "Pune", "Chhatrapati Sambhajinagar", "Amravati", "Nagpur",
]);
const DISTRICT_COUNT = 34;
/** A week-over-week jump larger than this stops the chain for review. */
const MAX_STATE_TANKER_DELTA = 300;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Row {
  district: string;
  division: string;
  registrySlug?: string;
  villages: number;
  wadis: number;
  tankersGovernment: number;
  tankersPrivate: number;
  tankersTotal: number;
}
interface Edition {
  _doc?: string;
  schemaVersion: number;
  reportDate: string;
  weekStart: string;
  weekEnd: string;
  source: { listingUrl: string; pdfUrl: string; pdfSha256: string; title: string };
  districts: Row[];
  stateTotals: Row extends never ? never : {
    villages: number; wadis: number; tankersGovernment: number;
    tankersPrivate: number; tankersTotal: number;
  };
  statedDistrictsWithTankers: number;
  worstDistrict: { name: string; tankersTotal: number };
  worstDivision: { name: string; tankersTotal: number };
  quotes: Record<string, string>;
  review: { status: string; transcribedAt: string; transcribedBy: string; verifiedAt: string | null; verifiedBy: string | null };
}

function count(n: unknown, label: string, errors: string[]): number {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
    errors.push(`${label}: must be a non-negative integer, got ${String(n)}`);
    return 0;
  }
  return n;
}

function validateEdition(e: Edition, label: string): string[] {
  const errors: string[] = [];
  if (e.schemaVersion !== 1) errors.push(`${label}: schemaVersion must be 1`);
  for (const d of ["reportDate", "weekStart", "weekEnd"] as const) {
    if (!DATE.test(e[d])) errors.push(`${label}.${d}: must be YYYY-MM-DD`);
  }
  if (!(e.weekStart < e.weekEnd && e.weekEnd <= e.reportDate)) {
    errors.push(`${label}: week ${e.weekStart}..${e.weekEnd} must precede reportDate ${e.reportDate}`);
  }
  if (!/^[0-9a-f]{64}$/.test(e.source?.pdfSha256 ?? "")) errors.push(`${label}.source.pdfSha256: 64-hex required`);
  for (const u of ["listingUrl", "pdfUrl"] as const) {
    if (!String(e.source?.[u] ?? "").startsWith("https://")) errors.push(`${label}.source.${u}: https URL required`);
  }
  if (!Array.isArray(e.districts) || e.districts.length !== DISTRICT_COUNT) {
    errors.push(`${label}.districts: must carry exactly ${DISTRICT_COUNT} rows (the report's fixed order)`);
    return errors;
  }
  const sums = { villages: 0, wadis: 0, tankersGovernment: 0, tankersPrivate: 0, tankersTotal: 0 };
  const names = new Set<string>();
  const divisionTotals = new Map<string, number>();
  for (const [i, row] of e.districts.entries()) {
    const l = `${label}.districts[${i}] (${row.district ?? "?"})`;
    if (!row.district || names.has(row.district)) errors.push(`${l}: missing or duplicate district name`);
    names.add(row.district);
    if (!DIVISIONS.has(row.division)) errors.push(`${l}: unknown division ${row.division}`);
    for (const k of ["villages", "wadis", "tankersGovernment", "tankersPrivate", "tankersTotal"] as const) {
      sums[k] += count(row[k], `${l}.${k}`, errors);
    }
    if (row.tankersGovernment + row.tankersPrivate !== row.tankersTotal) {
      errors.push(`${l}: government ${row.tankersGovernment} + private ${row.tankersPrivate} != total ${row.tankersTotal}`);
    }
    divisionTotals.set(row.division, (divisionTotals.get(row.division) ?? 0) + row.tankersTotal);
  }
  // THE HARNESS: the report's own printed totals are the ground truth the
  // transcription must reproduce exactly.
  for (const k of ["villages", "wadis", "tankersGovernment", "tankersPrivate", "tankersTotal"] as const) {
    if (sums[k] !== e.stateTotals?.[k]) {
      errors.push(`${label}: district ${k} sum ${sums[k]} != state total ${e.stateTotals?.[k]} - the transcription disagrees with the report's own arithmetic`);
    }
  }
  const withTankers = e.districts.filter((r) => r.tankersTotal > 0).length;
  if (withTankers !== e.statedDistrictsWithTankers) {
    errors.push(`${label}: ${withTankers} districts carry tankers but the report's prose says ${e.statedDistrictsWithTankers}`);
  }
  const worst = [...e.districts].sort((a, b) => b.tankersTotal - a.tankersTotal)[0];
  if (worst.district !== e.worstDistrict?.name || worst.tankersTotal !== e.worstDistrict?.tankersTotal) {
    errors.push(`${label}: table's worst district ${worst.district} (${worst.tankersTotal}) != prose ${e.worstDistrict?.name} (${e.worstDistrict?.tankersTotal})`);
  }
  const worstDiv = [...divisionTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (worstDiv[0] !== e.worstDivision?.name || worstDiv[1] !== e.worstDivision?.tankersTotal) {
    errors.push(`${label}: table's worst division ${worstDiv[0]} (${worstDiv[1]}) != prose ${e.worstDivision?.name} (${e.worstDivision?.tankersTotal})`);
  }
  if (e.review?.status !== "proposed" && e.review?.status !== "verified") {
    errors.push(`${label}.review.status: must be proposed or verified`);
  }
  return errors;
}

function main(): void {
  const asOfIdx = process.argv.indexOf("--as-of");
  const asOf = asOfIdx > -1 ? process.argv[asOfIdx + 1] : undefined;
  if (!asOf || !DATE.test(asOf)) throw new Error("--as-of YYYY-MM-DD is required");
  const files = readdirSync(INPUT_DIR).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) throw new Error(`no editions under ${INPUT_DIR}`);
  const editions: Edition[] = [];
  const errors: string[] = [];
  for (const f of files) {
    const e = JSON.parse(readFileSync(join(INPUT_DIR, f), "utf8")) as Edition;
    errors.push(...validateEdition(e, f));
    editions.push(e);
  }
  editions.sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  for (let i = 1; i < editions.length; i += 1) {
    if (editions[i].reportDate === editions[i - 1].reportDate) {
      errors.push(`duplicate reportDate ${editions[i].reportDate}`);
    }
    const delta = Math.abs(editions[i].stateTotals.tankersTotal - editions[i - 1].stateTotals.tankersTotal);
    if (delta > MAX_STATE_TANKER_DELTA) {
      errors.push(`state tankers moved ${delta} between ${editions[i - 1].reportDate} and ${editions[i].reportDate} (> ${MAX_STATE_TANKER_DELTA}); review before serving`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`scarcity-tankers editions failed the harness:\n- ${errors.join("\n- ")}`);
  }
  const latest = editions[editions.length - 1];
  const artifact = {
    nvdm: "1.0",
    dataset: "atlas/scarcity-tankers",
    scope: { kind: "state", id: "maharashtra" },
    provenance: {
      sources: editions.map((e) => ({
        id: "wssd-weekly-tanker-report",
        title: `WSSD weekly tanker report, ${e.source.title}`,
        publisher: "Water Supply and Sanitation Department, Government of Maharashtra",
        license: registryLicense("wssd-weekly-tanker-report"),
        role: "asserts",
        url: e.source.pdfUrl,
        as_of: e.reportDate,
        retrieved: e.review.transcribedAt,
      })),
      method: "manual",
      produced_at: asOf,
      produced_by: PRODUCED_BY,
      // The reviewed transcription inputs live in pipeline-inputs/, outside
      // the catalogue: internal_inputs is catalogue lineage only.
      internal_inputs: [],
      note:
        `The WSSD weekly tanker report as a served register: ${editions.length} ` +
        `edition${editions.length === 1 ? "" : "s"}, each a reviewed transcription of a scanned PDF, ` +
        "accepted only when the 34 district rows reproduce the report's own printed state totals, " +
        "district count, worst-district and worst-division lines exactly. Zeros are the report's " +
        "zeros. The report is weekly; a missing week means WSSD did not post one or the " +
        "transcription is pending, never that tankers stopped.",
      conventions: {
        week: "each edition covers the Monday-to-Sunday week the report names; reportDate is the report's own date",
        counts: "villages and wadis are places on tanker supply in that week; tankers split government/private as the report prints them",
        review: "proposed = transcribed and harness-checked; verified = a person read the row back against the page",
      },
    },
    schemaVersion: 1,
    state: "maharashtra",
    districtCount: DISTRICT_COUNT,
    latestReportDate: latest.reportDate,
    editions: editions.map(({ _doc, ...e }) => e),
  };
  mkdirSync(join(ROOT, "public/data/atlas/mh"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(artifact, null, 2) + "\n");
  console.log(
    `Wrote ${OUT.replace(ROOT + "/", "")}: ${editions.length} edition(s), latest ${latest.reportDate}: ` +
    `${latest.stateTotals.villages} villages + ${latest.stateTotals.wadis} wadis on ${latest.stateTotals.tankersTotal} tankers; ` +
    `worst ${latest.worstDistrict.name} (${latest.worstDistrict.tankersTotal})`,
  );
}
main();

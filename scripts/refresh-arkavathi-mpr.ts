/**
 * Headwaters Stage 2 - NGT MPR family refresh (Arkavathi, Karnataka).
 * Extracts the Arkavathi chapter of NMCG's Karnataka Monthly Progress
 * Report into structured metrics with page citations, diffs editions,
 * and reports how far the repo lags upstream.
 * Requires `pdftotext` (poppler). Design notes: docs/specs/headwaters.md.
 *
 * Modes:
 *   --status                          repo asOf vs newest edition in the registry
 *   --extract <pdf|url> --edition <l> [--out <file>]
 *   --diff <old.json> <new.json>      change report -> change-report-arkavathi-mpr.md
 */

import { execFileSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

const ROOT = resolve(__dirname, "..");
const REPORT_FILE = resolve(ROOT, "change-report-arkavathi-mpr.md");
const REGISTRY = resolve(ROOT, "scripts/source-registry/basins.json");
const ACCOUNTABILITY = resolve(ROOT, "public/data/basins/arkavathi/accountability.json");
const SOURCE_ID = "nmcg-ngt-mpr-listing";
const RIVER = "Arkavathi";

/* ── Metric extraction spec ────────────────────────────────────────────── */
// Rows carrying (Ramanagara, Kanakapura, Total) columns. Patterns run over
// whitespace-collapsed text of the river chapter; MPR layouts wobble
// between editions, so each pattern tolerates interleaved column noise.
interface RowSpec {
  key: string;
  label: string;
  pattern: RegExp;
  unit: string;
  /** column names per capture group; default ramanagara/kanakapura/total */
  columns?: string[];
}
const DEFAULT_COLUMNS = ["ramanagara", "kanakapura", "total"];

const NUM = "([\\d]+(?:\\.[\\d]+)?)";
const ROWS: RowSpec[] = [
  {
    key: "sewage-generated",
    label: "Estimated sewage generation",
    pattern: new RegExp(`Estimated Sewage\\s+${NUM}\\s+${NUM}\\s+${NUM}\\s+Generation \\(MLD\\)`),
    unit: "MLD",
  },
  {
    key: "stp-ramanagara",
    label: "Ramanagara STP capacity / utilised",
    pattern: new RegExp(`CMC Ramanagara\\s+[\\d°'".NE\\s]+?${NUM}\\s*MLD\\s+${NUM}\\s*MLD`),
    unit: "MLD",
    columns: ["capacity", "utilised"],
  },
  {
    key: "stp-kanakapura",
    label: "Kanakapura STP capacity / utilised",
    pattern: new RegExp(`CMC Kanakapura\\s+[\\d°'".NE\\s]+?${NUM}\\s*(?:MLD)?\\s+${NUM}\\s*MLD`),
    unit: "MLD",
    columns: ["capacity", "utilised"],
  },
  {
    key: "stps-operational",
    label: "Operational STPs",
    pattern: new RegExp(`No\\. of Operational STPs:\\s+${NUM}\\s+${NUM}\\s+${NUM}`),
    unit: "count",
  },
  {
    key: "stps-complying",
    label: "Complying STPs",
    pattern: new RegExp(`No\\. of Complying STPs:\\s+${NUM}\\s+${NUM}\\s+${NUM}`),
    unit: "count",
  },
  {
    key: "msw-generated",
    label: "MSW generated (TPD)",
    pattern: new RegExp(`Current Municipal Solid Waste\\s+Generation\\s+${NUM}\\s+${NUM}\\s+${NUM}`),
    unit: "TPD",
  },
  {
    key: "msw-collected",
    label: "MSW collected (TPD)",
    pattern: new RegExp(`MSW Collected\\s*\\(TPD\\)\\s+${NUM}\\s+${NUM}\\s+${NUM}`),
    unit: "TPD",
  },
  {
    key: "msw-processed",
    label: "MSW processed (TPD)",
    pattern: new RegExp(`MSW Processed\\s*\\(TPD\\)\\s+${NUM}\\s+${NUM}\\s+${NUM}`),
    unit: "TPD",
  },
  {
    key: "msw-gap",
    label: "Solid waste management gap (TPD)",
    pattern: new RegExp(`Gap in Solid Waste Management\\s+${NUM}\\s+${NUM}\\s+${NUM}`),
    unit: "TPD",
  },
];

interface Metric {
  key: string;
  label: string;
  unit: string;
  values: Record<string, number>;
  page: number;
}

interface Extraction {
  family: "arkavathi-mpr";
  edition: string;
  source: string;
  extractedOn: string;
  priority: string | null;
  statusAsOn: string | null;
  metrics: Metric[];
  missing: string[];
}

/* ── PDF -> chapter text with page tracking ────────────────────────────── */

function pdfToText(pdfPath: string): string {
  return execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Pages of the river's chapter: from its "Name of the River" header to the next one. */
function riverChapter(fullText: string): { pages: string[]; startPage: number } {
  const pages = fullText.split("\f");
  let start = -1;
  let end = pages.length;
  for (let i = 0; i < pages.length; i++) {
    const header = /Name of the River\s+(.+)/.exec(pages[i]);
    if (!header) continue;
    if (start < 0 && header[1].includes(RIVER)) start = i;
    else if (start >= 0 && !header[1].includes(RIVER)) {
      end = i;
      break;
    }
  }
  if (start < 0) return { pages: [], startPage: -1 };
  return { pages: pages.slice(start, end), startPage: start + 1 };
}

function extract(pdfPath: string, edition: string, source: string): Extraction {
  const full = pdfToText(pdfPath);
  const { pages, startPage } = riverChapter(full);
  const out: Extraction = {
    family: "arkavathi-mpr",
    edition,
    source,
    extractedOn: new Date().toISOString().slice(0, 10),
    priority: null,
    statusAsOn: null,
    metrics: [],
    missing: [],
  };
  if (pages.length === 0) {
    out.missing = ROWS.map((r) => r.key);
    return out;
  }

  const header = pages[0].replace(/\s+/g, " ");
  out.priority = /Priority\s+([IVX]+)/.exec(header)?.[1] ?? null;
  out.statusAsOn = /Status as on\s+([A-Za-z]+[-\s]?\d{4})/.exec(header)?.[1] ?? null;

  const flatPages = pages.map((p) => p.replace(/\s+/g, " "));
  for (const row of ROWS) {
    let found = false;
    for (let i = 0; i < flatPages.length; i++) {
      const m = row.pattern.exec(flatPages[i]);
      if (!m) continue;
      const cols = row.columns ?? DEFAULT_COLUMNS;
      const values: Record<string, number> = {};
      cols.forEach((c, gi) => {
        if (m[gi + 1] !== undefined) values[c] = Number(m[gi + 1]);
      });
      out.metrics.push({
        key: row.key,
        label: row.label,
        unit: row.unit,
        values,
        page: startPage + i,
      });
      found = true;
      break;
    }
    if (!found) out.missing.push(row.key);
  }
  return out;
}

/* ── Diff + change report ──────────────────────────────────────────────── */

const SCHEMA_BREAK_THRESHOLD = 0.5;

function fmt(m: Metric): string {
  const cols = Object.entries(m.values)
    .map(([k, v]) => `${k[0]}:${v}`)
    .join(" / ");
  return `${cols} ${m.unit}`;
}

function diff(oldE: Extraction, newE: Extraction): { report: string; changed: boolean } {
  const lines: string[] = [];
  const changes: string[] = [];
  const oldBy = new Map(oldE.metrics.map((m) => [m.key, m]));

  const schemaBreak = newE.metrics.length < ROWS.length * SCHEMA_BREAK_THRESHOLD;
  lines.push(`## Change report - Arkavathi NGT MPR: ${oldE.edition} -> ${newE.edition}`);
  lines.push("");
  if (schemaBreak) {
    lines.push(
      `**SCHEMA BREAK** - only ${newE.metrics.length}/${ROWS.length} expected metrics found in ` +
        `${newE.edition} (missing: ${newE.missing.join(", ") || "-"}). The MPR format changed - ` +
        `likely the consolidated state-annexure layout without the per-river chapter. ` +
        `Do NOT roll values forward; a human decides whether this edition is usable ` +
        `(per-stretch narrative editions are authoritative; state annexures have ` +
        `contradicted them before).`,
    );
    lines.push("");
  }
  if (oldE.priority !== newE.priority)
    changes.push(`- **Priority (MPR/KSPCB view):** ${oldE.priority ?? "-"} -> ${newE.priority ?? "-"}`);

  lines.push("| metric | " + oldE.edition + " | " + newE.edition + " | page | change |");
  lines.push("|---|---|---|---|---|");
  for (const row of ROWS) {
    const o = oldBy.get(row.key);
    const n = newE.metrics.find((m) => m.key === row.key);
    if (!o && !n) continue;
    const same = o && n && JSON.stringify(o.values) === JSON.stringify(n.values);
    const state = !o ? "ADDED" : !n ? "MISSING" : same ? "unchanged" : "**CHANGED**";
    lines.push(
      `| ${row.label} | ${o ? fmt(o) : "-"} | ${n ? fmt(n) : "-"} | ${n?.page ?? o?.page ?? "-"} | ${state} |`,
    );
    if (state === "**CHANGED**") changes.push(`- **${row.label}:** ${fmt(o!)} -> ${fmt(n!)} (p.${n!.page})`);
    if (state === "MISSING" && !schemaBreak) changes.push(`- **${row.label}:** present in ${oldE.edition}, absent in ${newE.edition}`);
  }
  lines.push("");
  if (changes.length) {
    lines.push("### Changes (each is a data-update candidate AND a finding candidate)");
    lines.push("");
    lines.push(...changes);
  } else if (!schemaBreak) {
    lines.push("No value changes - the treatment gaps held again this edition (itself a citable finding).");
  }
  lines.push("");
  lines.push("### Affected repo files");
  lines.push("");
  const reg = JSON.parse(readFileSync(REGISTRY, "utf-8"));
  const entry = reg.sources.find((s: { id: string }) => s.id === SOURCE_ID);
  for (const dep of entry?.dependsOn ?? []) lines.push(`- \`${dep}\``);
  lines.push(`- \`public/data/basins/arkavathi/accountability.json\` (mpr.asOf fields)`);
  lines.push("");
  lines.push(
    "Values above are machine-extracted with page citations - verify against the PDF pages " +
      "before editing data (updates stay human-reviewed). Then `--accept " + SOURCE_ID + "`.",
  );
  return { report: lines.join("\n"), changed: changes.length > 0 || schemaBreak };
}

/* ── Status (repo vs upstream) ─────────────────────────────────────────── */

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

/** All month-year pairs in a string; compound asOf values ("Aug 2025 (stretch-wise); Apr 2026 (STP annexures)") yield several. */
function parseEditions(s: string): { y: number; m: number }[] {
  const clean = decodeURIComponent(s).toLowerCase().replace(/[-_,.]/g, " ");
  const out: { y: number; m: number }[] = [];
  const re = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(20\d\d)\b/g;
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    out.push({ y: Number(m[2]), m: MONTHS.findIndex((mo) => mo.startsWith(m![1])) });
  }
  return out;
}
const parseEdition = (s: string) => parseEditions(s)[0] ?? null;

function status() {
  const reg = JSON.parse(readFileSync(REGISTRY, "utf-8"));
  const entry = reg.sources.find((s: { id: string }) => s.id === SOURCE_ID);
  const links: string[] = entry?.lastSeen?.links ?? [];
  const ka = links
    .filter((l) => decodeURIComponent(l).toLowerCase().includes("karnataka"))
    .map((l) => ({ l, e: parseEdition(l) }))
    .filter((x): x is { l: string; e: { y: number; m: number } } => x.e !== null)
    .sort((a, b) => b.e.y - a.e.y || b.e.m - a.e.m);
  const newest = ka[0];

  const acc = JSON.parse(readFileSync(ACCOUNTABILITY, "utf-8"));
  const asOfs = new Set<string>();
  for (const r of acc.regions ?? [])
    for (const c of r.categories ?? []) if (c.mpr?.asOf) asOfs.add(c.mpr.asOf);
  const repoParsed = [...asOfs]
    .flatMap(parseEditions)
    .sort((a, b) => b.y - a.y || b.m - a.m);
  const repoNewest = repoParsed[0];
  const repoOldest = repoParsed[repoParsed.length - 1];

  console.log(`Newest Karnataka MPR seen by Headwaters: ${newest ? decodeURIComponent(newest.l).split("/").pop() : "none"}`);
  console.log(`Repo accountability mpr.asOf values: ${[...asOfs].join(" | ") || "none"}`);
  if (newest && repoNewest) {
    const label = (e: { y: number; m: number }) => `${MONTHS[e.m]} ${e.y}`;
    console.log(`Repo citations span ${label(repoOldest)} -> ${label(repoNewest)}.`);
    const behind = (newest.e.y - repoNewest.y) * 12 + (newest.e.m - repoNewest.m);
    console.log(
      behind > 0
        ? `REPO IS ${behind} EDITION(S) BEHIND (newest repo citation ${label(repoNewest)} < upstream ${label(newest.e)}).`
        : `Newest repo citation (${label(repoNewest)}) is current with or ahead of the newest listed Karnataka MPR (${label(newest.e)}); oldest citation ${label(repoOldest)} may still warrant a sweep.`,
    );
    if (behind > 0) {
      console.log(`Next: --extract "${newest.l}" --edition "${label(newest.e)}"`);
      process.exit(1);
    }
  }
}

/* ── Main ──────────────────────────────────────────────────────────────── */

async function fetchPdf(url: string): Promise<string> {
  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // nmcg.nic.in broken chain
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const path = join(mkdtempSync(join(tmpdir(), "mpr-")), "mpr.pdf");
    writeFileSync(path, buf);
    return path;
  } finally {
    if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const valueOf = (f: string) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  if (argv.includes("--status")) return status();

  const extractArg = valueOf("--extract");
  if (extractArg) {
    const edition = valueOf("--edition");
    if (!edition) {
      console.error("--extract needs --edition <label>");
      process.exit(2);
    }
    const pdfPath = /^https?:/.test(extractArg) ? await fetchPdf(extractArg) : extractArg;
    if (!existsSync(pdfPath)) {
      console.error(`not found: ${pdfPath}`);
      process.exit(2);
    }
    const ex = extract(pdfPath, edition, extractArg);
    const out =
      valueOf("--out") ??
      resolve(ROOT, `scripts/source-registry/extractions/arkavathi-mpr-${edition.toLowerCase().replace(/\s+/g, "-")}.json`);
    writeFileSync(out, JSON.stringify(ex, null, 2) + "\n");
    console.log(
      `${ex.metrics.length}/${ROWS.length} metrics extracted (missing: ${ex.missing.join(", ") || "none"}) -> ${out}`,
    );
    if (ex.missing.length) process.exit(1);
    return;
  }

  const di = argv.indexOf("--diff");
  if (di >= 0) {
    const [oldF, newF] = [argv[di + 1], argv[di + 2]];
    if (!oldF || !newF) {
      console.error("--diff <old.json> <new.json>");
      process.exit(2);
    }
    const { report, changed } = diff(
      JSON.parse(readFileSync(oldF, "utf-8")),
      JSON.parse(readFileSync(newF, "utf-8")),
    );
    writeFileSync(REPORT_FILE, report);
    console.log(report);
    if (changed) process.exit(1);
    return;
  }

  console.error("Usage: refresh-arkavathi-mpr.ts --status | --extract <pdf|url> --edition <label> [--out f] | --diff <old> <new>");
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

/**
 * Headwaters upstream edition detector - watches episodic sources (year
 * books, audits, bulletins, report listings) for new editions.
 * Registry: scripts/source-registry/*.json. Design notes + limitations:
 * docs/specs/headwaters.md (local-only).
 *
 * Modes:
 *   --validate                  offline registry gate (CI: npm run data:check)
 *   --check                     fetch + compare vs lastSeen -> editions-report.md
 *   --accept <id> [--edition <label>] | --accept-all
 *                               re-fetch and record lastSeen (also baselines)
 */

import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { listAllPlaces } from "../src/lib/cities";

const ROOT = resolve(__dirname, "..");
const REGISTRY_DIR = resolve(ROOT, "scripts/source-registry");
const REPORT_FILE = resolve(ROOT, "editions-report.md");

// Some publishers (ADB, several state portals) reject non-browser agents.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_STORED_LINKS = 500;

/* ── Registry types ────────────────────────────────────────────────────── */

type DetectionMethod = "link-set" | "page-hash" | "http-meta" | "api-date";

interface Detection {
  method: DetectionMethod;
  /** link-set: regex tested against each absolute href on the page. */
  linkPattern?: string;
  /** link-set / page-hash: optional cheerio selector scoping the region. */
  selector?: string;
  /** api-date: dot-path into the JSON response (supports [n] indices). */
  datePath?: string;
}

interface LastSeen {
  /** Human edition label ("Year Book 2023-24"), set via --accept. */
  edition?: string;
  /** Date the state was accepted (YYYY-MM-DD). */
  acceptedOn?: string;
  linksHash?: string;
  links?: string[];
  pageHash?: string;
  etag?: string;
  lastModified?: string;
  apiDate?: string;
}

interface SourceEntry {
  id: string;
  scope: string; // cityId | basinId | "platform"
  publisher: string;
  url: string;
  /** Skip TLS verification for hosts with broken cert chains (NMCG, CPCB). */
  insecureTLS?: boolean;
  license?: string;
  type: "pdf-listing" | "page" | "api" | "file";
  cadence: string;
  tier: 0 | 1 | 2 | 3;
  detection: Detection;
  lastSeen?: LastSeen;
  /** Repo files carrying numbers from this source. */
  dependsOn: string[];
  /** Script / Claude skill that re-extracts, or "manual". */
  refreshMethod: string;
  notes?: string;
}

interface RegistryFile {
  _doc?: string;
  sources: SourceEntry[];
}

function loadRegistry(): { entries: SourceEntry[]; byFile: Map<string, RegistryFile> } {
  if (!existsSync(REGISTRY_DIR)) {
    console.error(`Registry dir missing: ${REGISTRY_DIR}`);
    process.exit(2);
  }
  const byFile = new Map<string, RegistryFile>();
  const entries: SourceEntry[] = [];
  for (const f of readdirSync(REGISTRY_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const path = join(REGISTRY_DIR, f);
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as RegistryFile;
    byFile.set(path, parsed);
    for (const e of parsed.sources ?? []) entries.push(e);
  }
  return { entries, byFile };
}

/* ── Validation (offline, CI) ──────────────────────────────────────────── */

// A city may ship without registry coverage only with the reason on record.
const ONBOARDING_EXEMPTIONS: Record<string, string> = {
  delhi:
    "onboarding in progress (branch delhi-onboarding) - episodic-source " +
    "registry lands with the onboarding PR",
};

function validate(entries: SourceEntry[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  const cityIds = new Set(listAllPlaces().map((p) => p.cityId));
  for (const cityId of cityIds) {
    if (ONBOARDING_EXEMPTIONS[cityId]) continue;
    if (!entries.some((e) => e.scope === cityId)) {
      problems.push(
        `city ${cityId}: no episodic sources registered - onboarding a city ` +
          `requires registering its report/document sources in ` +
          `scripts/source-registry/ (or an ONBOARDING_EXEMPTIONS entry with the reason).`,
      );
    }
  }
  for (const e of entries) {
    const where = `source ${e.id ?? "<missing id>"}`;
    if (!e.id) problems.push(`entry without id (scope ${e.scope})`);
    else if (seen.has(e.id)) problems.push(`duplicate id: ${e.id}`);
    else seen.add(e.id);

    for (const field of ["scope", "publisher", "url", "type", "cadence", "refreshMethod"] as const) {
      if (!e[field]) problems.push(`${where}: missing ${field}`);
    }
    if (e.tier === undefined) problems.push(`${where}: missing tier`);
    if (!Array.isArray(e.dependsOn)) problems.push(`${where}: dependsOn must be an array`);

    const d = e.detection;
    if (!d?.method) {
      problems.push(`${where}: missing detection.method`);
      continue;
    }
    if (d.method === "link-set") {
      if (!d.linkPattern) problems.push(`${where}: link-set needs linkPattern`);
      else {
        try {
          new RegExp(d.linkPattern);
        } catch {
          problems.push(`${where}: linkPattern does not compile: ${d.linkPattern}`);
        }
      }
    }
    if (d.method === "api-date" && !d.datePath)
      problems.push(`${where}: api-date needs datePath`);

    for (const dep of e.dependsOn ?? []) {
      if (!existsSync(resolve(ROOT, dep)))
        problems.push(`${where}: dependsOn path not found: ${dep}`);
    }
  }
  return problems;
}

/* ── Fetching ──────────────────────────────────────────────────────────── */

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const attempt = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, {
        redirect: "follow",
        ...init,
        headers: { "User-Agent": BROWSER_UA, ...(init.headers ?? {}) },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await attempt();
  } catch {
    return await attempt();
  }
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

/** Observed upstream state, same shape as lastSeen minus the human fields. */
type Observed = Omit<LastSeen, "edition" | "acceptedOn">;

async function observe(e: SourceEntry): Promise<Observed> {
  if (!e.insecureTLS) return observeInner(e);
  // Entries run sequentially, so toggling the process-wide TLS flag is safe.
  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    return await observeInner(e);
  } finally {
    if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
  }
}

async function observeInner(e: SourceEntry): Promise<Observed> {
  const d = e.detection;

  if (d.method === "http-meta") {
    let res = await fetchWithTimeout(e.url, { method: "HEAD" });
    if (!res.ok) res = await fetchWithTimeout(e.url); // some servers reject HEAD
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const etag = res.headers.get("etag") ?? undefined;
    const lastModified = res.headers.get("last-modified") ?? undefined;
    if (!etag && !lastModified)
      throw new Error("server sends neither ETag nor Last-Modified - switch detection method");
    return { etag, lastModified };
  }

  if (d.method === "api-date") {
    const res = await fetchWithTimeout(e.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    let v: unknown = json;
    for (const part of d.datePath!.split(".")) {
      const m = part.match(/^(.*?)\[(\d+)\]$/);
      if (m) {
        if (m[1]) v = (v as Record<string, unknown>)?.[m[1]];
        v = (v as unknown[])?.[Number(m[2])];
      } else {
        v = (v as Record<string, unknown>)?.[part];
      }
    }
    if (typeof v !== "string" && typeof v !== "number")
      throw new Error(`datePath ${d.datePath} resolved to ${typeof v}`);
    return { apiDate: String(v) };
  }

  // link-set / page-hash need the page body.
  const res = await fetchWithTimeout(e.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const { load } = await import("cheerio");
  const $ = load(html);
  const scope = d.selector ? $(d.selector) : $.root();

  if (d.method === "page-hash") {
    const text = scope.text().replace(/\s+/g, " ").trim();
    if (!text) throw new Error(`selector matched no text: ${d.selector ?? "<body>"}`);
    return { pageHash: sha256(text) };
  }

  // link-set
  const pattern = new RegExp(d.linkPattern!, "i");
  const links = new Set<string>();
  scope.find("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: string;
    try {
      abs = new URL(href, e.url).toString();
    } catch {
      return;
    }
    if (pattern.test(abs) || pattern.test(href)) links.add(abs);
  });
  const sorted = [...links].sort();
  if (sorted.length === 0)
    throw new Error("linkPattern matched 0 links - page layout changed or blocked page served");
  return {
    linksHash: sha256(sorted.join("\n")),
    links: sorted.slice(0, MAX_STORED_LINKS),
  };
}

/* ── Comparison ────────────────────────────────────────────────────────── */

interface CheckResult {
  entry: SourceEntry;
  state: "ok" | "new-edition" | "check-failed" | "unbaselined";
  detail: string;
  /** link-set only: links present now but not in lastSeen. */
  newLinks?: string[];
  observed?: Observed;
}

function compare(e: SourceEntry, obs: Observed): CheckResult {
  const last = e.lastSeen;
  if (!last || Object.keys(last).length === 0) {
    return {
      entry: e,
      state: "unbaselined",
      detail: "no lastSeen recorded - baseline with --accept",
      observed: obs,
    };
  }
  const m = e.detection.method;
  if (m === "http-meta") {
    const changed =
      (obs.etag && last.etag && obs.etag !== last.etag) ||
      (obs.lastModified && last.lastModified && obs.lastModified !== last.lastModified) ||
      (!last.etag && !last.lastModified);
    return {
      entry: e,
      state: changed ? "new-edition" : "ok",
      detail: changed
        ? `Last-Modified ${last.lastModified ?? "-"} -> ${obs.lastModified ?? "-"}`
        : `unchanged (${obs.lastModified ?? obs.etag})`,
      observed: obs,
    };
  }
  if (m === "api-date") {
    const changed = obs.apiDate !== last.apiDate;
    return {
      entry: e,
      state: changed ? "new-edition" : "ok",
      detail: changed ? `${last.apiDate} -> ${obs.apiDate}` : `unchanged (${obs.apiDate})`,
      observed: obs,
    };
  }
  if (m === "page-hash") {
    const changed = obs.pageHash !== last.pageHash;
    return {
      entry: e,
      state: changed ? "new-edition" : "ok",
      detail: changed ? `page content changed (hash ${last.pageHash} -> ${obs.pageHash})` : "unchanged",
      observed: obs,
    };
  }
  // link-set
  if (obs.linksHash === last.linksHash)
    return { entry: e, state: "ok", detail: `unchanged (${obs.links?.length} links)`, observed: obs };
  const prev = new Set(last.links ?? []);
  const newLinks = (obs.links ?? []).filter((l) => !prev.has(l));
  const removed = (last.links ?? []).filter((l) => !(obs.links ?? []).includes(l)).length;
  return {
    entry: e,
    state: "new-edition",
    detail:
      newLinks.length > 0
        ? `${newLinks.length} new link(s), ${removed} removed`
        : `link set changed (${removed} removed, none added - possible relocation)`,
    newLinks,
    observed: obs,
  };
}

/* ── Report ────────────────────────────────────────────────────────────── */

const STATE_ORDER: Record<CheckResult["state"], number> = {
  "new-edition": 0,
  "check-failed": 1,
  unbaselined: 2,
  ok: 3,
};

function writeReport(results: CheckResult[], now: string): string {
  const lines: string[] = [];
  const count = (s: CheckResult["state"]) => results.filter((r) => r.state === s).length;
  lines.push(`## Headwaters - upstream editions - ${now}`);
  lines.push("");
  const newN = count("new-edition");
  const failN = count("check-failed");
  const baseN = count("unbaselined");
  lines.push(
    newN + failN + baseN === 0
      ? `All ${results.length} watched sources unchanged.`
      : `**${newN} new edition(s), ${failN} check failure(s), ${baseN} unbaselined** of ${results.length} watched sources.`,
  );
  lines.push("");
  lines.push("| source | scope | publisher | cadence | state | detail |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of [...results].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state])) {
    const state = r.state === "ok" ? "ok" : `**${r.state.toUpperCase()}**`;
    lines.push(
      `| ${r.entry.id} | ${r.entry.scope} | ${r.entry.publisher} | ${r.entry.cadence} | ${state} | ${r.detail.replace(/\|/g, "\\|")} |`,
    );
  }

  const actionable = results.filter((r) => r.state === "new-edition" || r.state === "check-failed");
  for (const r of actionable) {
    lines.push("");
    lines.push(`### ${r.entry.id} - ${r.state}`);
    lines.push("");
    lines.push(`- **Source:** ${r.entry.publisher} - ${r.entry.url}`);
    if (r.entry.lastSeen?.edition) lines.push(`- **Last accepted edition:** ${r.entry.lastSeen.edition} (${r.entry.lastSeen.acceptedOn ?? "?"})`);
    if (r.newLinks?.length) {
      lines.push(`- **New link(s):**`);
      for (const l of r.newLinks.slice(0, 20)) lines.push(`  - ${l}`);
      if (r.newLinks.length > 20) lines.push(`  - ...and ${r.newLinks.length - 20} more`);
    }
    lines.push(
      `- **Depends on:** ${r.entry.dependsOn.length ? r.entry.dependsOn.map((d) => `\`${d}\``).join(", ") : "(no lineage recorded yet)"}`,
    );
    lines.push(`- **Refresh via:** ${r.entry.refreshMethod}`);
    if (r.entry.notes) lines.push(`- **Notes:** ${r.entry.notes}`);
    lines.push(
      `- **After updating the data (or to acknowledge without a data change):** \`npx tsx scripts/check-upstream-editions.ts --accept ${r.entry.id} --edition "<label>"\` and commit the registry.`,
    );
  }
  const report = lines.join("\n");
  writeFileSync(REPORT_FILE, report);
  return report;
}

/* ── Accept ────────────────────────────────────────────────────────────── */

function persist(byFile: Map<string, RegistryFile>) {
  for (const [path, reg] of byFile) writeFileSync(path, JSON.stringify(reg, null, 2) + "\n");
}

async function accept(ids: string[] | "all", editionLabel: string | undefined) {
  const { entries, byFile } = loadRegistry();
  const targets =
    ids === "all" ? entries : entries.filter((e) => (ids as string[]).includes(e.id));
  if (ids !== "all") {
    const missing = (ids as string[]).filter((id) => !entries.some((e) => e.id === id));
    if (missing.length) {
      console.error(`Unknown source id(s): ${missing.join(", ")}`);
      process.exit(2);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  let failures = 0;
  for (const e of targets) {
    try {
      const obs = await observe(e);
      e.lastSeen = {
        ...obs,
        edition: editionLabel ?? e.lastSeen?.edition,
        acceptedOn: today,
      };
      console.log(`accepted ${e.id}`);
    } catch (err) {
      failures++;
      console.error(`FAILED  ${e.id}: ${String(err).slice(0, 140)}`);
    }
  }
  persist(byFile);
  console.log(
    `\n${targets.length - failures}/${targets.length} accepted; registry updated - review and commit scripts/source-registry/.`,
  );
  if (failures) process.exit(1);
}

/* ── Main ──────────────────────────────────────────────────────────────── */

async function main() {
  const argv = process.argv.slice(2);
  const flag = (f: string) => argv.includes(f);
  const valueOf = (f: string) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  if (flag("--validate")) {
    const { entries } = loadRegistry();
    const problems = validate(entries);
    console.log(`Headwaters registry: ${entries.length} sources across ${new Set(entries.map((e) => e.scope)).size} scopes.`);
    for (const p of problems) console.error(`  FAIL: ${p}`);
    if (problems.length) process.exit(1);
    console.log("Registry valid.");
    return;
  }

  if (flag("--accept-all")) return accept("all", valueOf("--edition"));
  if (flag("--accept")) {
    const id = valueOf("--accept");
    if (!id) {
      console.error("--accept needs a source id");
      process.exit(2);
    }
    return accept([id], valueOf("--edition"));
  }

  if (!flag("--check")) {
    console.error(
      "Usage: check-upstream-editions.ts --validate | --check | --accept <id> [--edition <label>] | --accept-all",
    );
    process.exit(2);
  }

  const { entries } = loadRegistry();
  const problems = validate(entries);
  if (problems.length) {
    console.error("Registry problems (fix via --validate):");
    for (const p of problems) console.error(`  ${p}`);
  }

  const now = new Date().toISOString().slice(0, 10);
  const results: CheckResult[] = [];
  for (const e of entries) {
    try {
      const obs = await observe(e);
      results.push(compare(e, obs));
    } catch (err) {
      results.push({
        entry: e,
        state: "check-failed",
        detail: String(err).slice(0, 160),
      });
    }
  }

  const report = writeReport(results, now);
  console.log(report);
  const alerting = results.filter(
    (r) => r.state === "new-edition" || r.state === "check-failed",
  );
  if (alerting.length || problems.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

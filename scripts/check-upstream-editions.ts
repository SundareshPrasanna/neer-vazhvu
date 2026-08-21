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
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { listAllPlaces } from "../src/lib/cities";
import { computeCoverage, cityOf } from "./lib/headwaters-coverage";
import { sourceTypeProblem, type SourceType } from "./lib/registry-contract";

const ROOT = resolve(__dirname, "..");

/** Repo-tracked paths under the corpus-managed trees, resolved lazily and
 *  once. Empty (never failing) when git is unavailable - existsSync remains
 *  the primary check and git only widens it for corpus-replaced checkouts. */
let gitTrackedPaths: Set<string> | null = null;
function gitTracked(dep: string): boolean {
  if (gitTrackedPaths === null) {
    try {
      gitTrackedPaths = new Set(
        execSync("git ls-files -- public/data public/geojson", {
          cwd: ROOT,
          encoding: "utf8",
        })
          .split("\n")
          .filter(Boolean),
      );
    } catch {
      gitTrackedPaths = new Set();
    }
  }
  const clean = dep.replace(/\/+$/, "");
  if (gitTrackedPaths.has(clean)) return true;
  // Directory joins ("public/data/cascade") name no single file.
  const prefix = clean + "/";
  for (const p of gitTrackedPaths) if (p.startsWith(prefix)) return true;
  return false;
}
const REGISTRY_DIR = resolve(ROOT, "scripts/source-registry");
const REPORT_FILE = resolve(ROOT, "editions-report.md");

// Some publishers (ADB, several state portals) reject non-browser agents.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_STORED_LINKS = 500;
const LOCAL_CHECK_MAX_AGE_DAYS = 90;

/* ── Registry types ────────────────────────────────────────────────────── */

type DetectionMethod =
  | "link-set"
  | "page-hash"
  | "http-meta"
  | "api-date"
  | "term-expiry"
  | "url-template"
  /** Continuously-updated upstream with NO editions to detect (OSM, Dynamic
      World, live WRIS/IMD services). Registered for lineage, licence, and
      dependsOn accountability (NVDM per-source rule); never fetched by this
      checker - re-fetch cadence is the coverage gate's freshness question
      (P5-1). This replaces keeping such sources registry-less. */
  | "continuous"
  /** Byte hash of the response body itself, for upstreams that are a FILE
      rather than a page - a PDF republished in place at a stable URL, where
      there is no listing to diff and no Last-Modified worth trusting. */
  | "content-hash"
  /** NOT a detector. An explicit, dated promise that a human will look.
      Some upstreams cannot be watched by machine at all: a portal behind a
      login, a page whose "new edition" is a judgement call, a site that
      refuses every automated client. The honest options are to drop the
      source or to commit to a cadence, and dropping it means the numbers
      rot invisibly.

      So this method never claims a detection. It records reviewEveryDays
      and the date of the last human review, and goes REVIEW-DUE when that
      lapses - the same escalation ciBlocked entries already get after
      LOCAL_CHECK_MAX_AGE_DAYS. Manual work does not scale, but a BOUNDED,
      NAGGING amount of manual work does: cost tracks the cadence, not the
      number of cities. */
  | "human-review";

/** Single source of truth for what the dispatch below can actually execute.
 *  Keep in lockstep with DetectionMethod - the type guards TypeScript callers,
 *  this guards the JSON registry, and the registry is where the bugs came from. */
const IMPLEMENTED_METHODS = new Set<string>([
  "link-set",
  "page-hash",
  "http-meta",
  "api-date",
  "term-expiry",
  "url-template",
  "continuous",
  "content-hash",
  "human-review",
]);

interface Detection {
  method: DetectionMethod;
  /** link-set: regex tested against each absolute href on the page. */
  linkPattern?: string;
  /** link-set / page-hash: optional cheerio selector scoping the region. */
  selector?: string;
  /** api-date: dot-path into the JSON response (supports [n] indices). */
  datePath?: string;
  /** term-expiry: YYYY-MM-DD the current term runs out. */
  termEndsOn?: string;
  /** term-expiry: days before termEndsOn to start alerting. */
  leadTimeDays?: number;
  /**
   * url-template: a url with `{YYYY}` (edition start year), `{YY}` (last two
   * digits of the following year, for fiscal-year names like `2025_26`) and
   * `{YYYY1}` (the following year in full). Probed forward from
   * `templateFrom` to find the highest year that exists.
   */
  urlTemplate?: string;
  /** url-template: first year to probe. Defaults to the current year - 1. */
  templateFrom?: number;
  /** human-review: how often a person must re-check this upstream. */
  reviewEveryDays?: number;
  /**
   * url-template: require this Content-Type prefix before counting a year as
   * published. For hosts that SOFT-404 - answering a missing edition with a
   * redirect to an HTML error page served as 200 instead of a 404 - `res.ok`
   * alone is true for every year probed, so the detector would report an
   * edition that does not exist, forever, and would do it silently.
   *
   * GMDA is the case that forced this (`gmda-tanker-mis`): its real editions
   * answer `application/xlsx`, while 2022 onward 302 to a 38,291-byte
   * `text/html` page under a 200. Content type is the only field that
   * separates them - status, length and body are all indistinguishable from a
   * successful fetch of some other resource.
   *
   * Omit for well-behaved hosts, which is most of them.
   */
  expectContentType?: string;
}

/** term-expiry default warning window - enough notice to line up sources
    before the incumbents change. */
const DEFAULT_TERM_LEAD_DAYS = 60;

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
  /** content-hash: sha of the response body. */
  contentHash?: string;
  /** human-review: YYYY-MM-DD a human last confirmed the edition on record. */
  reviewedOn?: string;
}

interface SourceEntry {
  id: string;
  scope: string; // cityId | basinId | "platform"
  publisher: string;
  url: string;
  /** Skip TLS verification for hosts with broken cert chains (NMCG, CPCB). */
  insecureTLS?: boolean;
  /**
   * Allow legacy (pre-RFC-5746) TLS renegotiation. A DIFFERENT problem from
   * `insecureTLS` and a strictly narrower concession: certificate and hostname
   * verification stay fully ON, and only the renegotiation handshake is
   * relaxed.
   *
   * Do not reach for `insecureTLS` when you see this failure - it does not fix
   * it. Verified against onemapdepts.gmda.gov.in on 2026-08-14:
   * NODE_TLS_REJECT_UNAUTHORIZED=0 still fails with
   * `SSL routines:final_renegotiate`, because the certificate was never the
   * problem; an undici dispatcher carrying SSL_OP_LEGACY_SERVER_CONNECT
   * succeeds. Python shows the same split - it names the error
   * UNSAFE_LEGACY_RENEGOTIATION_DISABLED - while curl's broader defaults hide
   * it, which is why a host can look reachable from the shell and be
   * unreachable from the checker.
   */
  legacyTLS?: boolean;
  /** Host blocks CI runner IPs (reason string). Checked from local runs only;
      CI reports LOCAL-ONLY until the last accept grows older than
      LOCAL_CHECK_MAX_AGE_DAYS, then escalates to CHECK-FAILED. */
  ciBlocked?: string;
  license?: string;
  type: SourceType;
  cadence: string;
  tier: 0 | 1 | 2 | 3;
  detection: Detection;
  lastSeen?: LastSeen;
  /**
   * Lineage: what in this repo carries numbers from this source. Two forms:
   *   - a repo-relative file path, checked for existence
   *   - `supabase:<table>`, for sources whose numbers land in a table rather
   *     than a committed file (reservoir feeds, groundwater, census). Not
   *     existence-checked - the freshness checker owns table liveness.
   * Must be non-empty: an alert with no lineage is not actionable.
   */
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
// (Empty today. Delhi's exemption was removed 2026-07-26: it shipped in #184
// with 6 registered sources, so the exemption was masking a city that no longer
// needed it - and would have hidden a future regression.)
const ONBOARDING_EXEMPTIONS: Record<string, string> = {};

/**
 * Hosts confirmed dead from our networks (both CI and a residential India IP),
 * with the replacement. Registering one of these produces a watch that can never
 * fire - cpcb-nwmp-annual did exactly that and nothing said so for days.
 *
 * Verified 2026-07-26. NOT a NICNET-wide rule: nmcg.nic.in is on the same
 * 164.100.x.x range and returns 200, so membership must be established per host.
 */
const UNREACHABLE_HOSTS: Record<string, string> = {
  "cpcb.nic.in":
    "cpcb.nic.in (164.100.58.91) has ports 80 and 443 filtered; CPCB serves everything on cpcb.gov.in (49.50.115.127).",
  "www.cpcb.nic.in": "see cpcb.nic.in - use cpcb.gov.in.",
  "yamuna-revival.nic.in":
    "yamuna-revival.nic.in (164.100.68.201) is unreachable on both ports.",
  "chennaimetrowater.tn.gov.in":
    "chennaimetrowater.tn.gov.in serves no HTTP; CMWSSB is at cmwssb.tn.gov.in.",
  "www.bwssb.karnataka.gov.in":
    "the www host does not resolve over HTTP; use bwssb.karnataka.gov.in.",
  "wellabs.org": "no DNS record; WELL Labs is welllabs.org (three L's).",
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
    // #220 review: type values outside the union bypassed the TS contract
    // (JSON is never type-checked) - enforce the allowed set at runtime.
    if (e.type) {
      const typeProblem = sourceTypeProblem(e.id ?? "<missing id>", e.type);
      if (typeProblem) problems.push(typeProblem);
    }
    if (e.tier === undefined) problems.push(`${where}: missing tier`);
    if (!Array.isArray(e.dependsOn)) problems.push(`${where}: dependsOn must be an array`);
    else if (e.dependsOn.length === 0)
      problems.push(
        `${where}: dependsOn is empty - an alert with no lineage is not actionable. ` +
          `List the repo files, or "supabase:<table>" where the numbers land in a table.`,
      );

    const d = e.detection;
    if (!d?.method) {
      problems.push(`${where}: missing detection.method`);
      continue;
    }
    // The registry is JSON, so nothing stopped a new city inventing a method
    // name. Kolkata shipped six that do not exist; Hyderabad shipped three
    // aimed at markup a React SPA never serves. Both look like coverage on the
    // registry and are dead - they reported an upstream fault that was ours,
    // weekly, for weeks. Fail the registry at onboarding, where it is cheap.
    if (!IMPLEMENTED_METHODS.has(d.method)) {
      problems.push(
        `${where}: detection.method "${d.method}" is not implemented by this checker. ` +
          `Implemented: ${[...IMPLEMENTED_METHODS].sort().join(", ")}. ` +
          `A method the checker cannot run is a source that is never watched - ` +
          `use human-review with a reviewEveryDays cadence if it genuinely cannot be automated.`,
      );
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
    if (d.method === "human-review" && !d.reviewEveryDays)
      problems.push(
        `${where}: human-review needs reviewEveryDays - an unautomatable source ` +
          `may ship without a detector, but not without a cadence, or it rots silently`,
      );
    if (d.method === "term-expiry") {
      if (!d.termEndsOn) problems.push(`${where}: term-expiry needs termEndsOn`);
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(d.termEndsOn) || Number.isNaN(Date.parse(d.termEndsOn)))
        problems.push(`${where}: termEndsOn must be a YYYY-MM-DD date, got ${d.termEndsOn}`);
    }
    if (d.method === "url-template") {
      if (!d.urlTemplate) problems.push(`${where}: url-template needs urlTemplate`);
      else if (!/\{YYYY\}/.test(d.urlTemplate))
        problems.push(`${where}: urlTemplate must contain {YYYY}: ${d.urlTemplate}`);
      if (d.templateFrom !== undefined && !(d.templateFrom > 1900))
        problems.push(`${where}: templateFrom must be a year, got ${d.templateFrom}`);
      if (d.expectContentType !== undefined && !d.expectContentType.trim())
        problems.push(`${where}: expectContentType must be a non-empty Content-Type prefix`);
    }
    if (d.expectContentType !== undefined && d.method !== "url-template")
      problems.push(
        `${where}: expectContentType only applies to url-template, not ${d.method}`,
      );

    // P5-8: hosts verified unreachable from our networks. Deliberately a
    // per-host deny-list, NOT a .nic.in or 164.100.x.x rule: nmcg.nic.in sits in
    // the same NICNET range (164.100.60.206) and serves 200 today, so the range
    // is not uniformly blocked. Only add a host here after confirming ports 80
    // and 443 are both dead from a residential India IP. Validate runs offline,
    // so this cannot be a DNS or IP test.
    const host = (e.url ?? "").match(/^https?:\/\/([^/:]+)/)?.[1] ?? "";
    if (UNREACHABLE_HOSTS[host])
      problems.push(`${where}: ${UNREACHABLE_HOSTS[host]} Use the reachable equivalent.`);

    for (const dep of e.dependsOn ?? []) {
      if (dep.startsWith("supabase:")) {
        if (!dep.slice("supabase:".length).match(/^[a-z_][a-z0-9_]*$/))
          problems.push(`${where}: malformed supabase lineage: ${dep}`);
        continue;
      }
      // On disk OR tracked in git. The locked-corpus CI job replaces
      // public/data with the released corpus, so a pre-release artifact
      // (a preview-gated family awaiting its first neer-vazhvu-data
      // release) exists only in the git index there - and its registry
      // join must not read as a dangling path. A path in NEITHER place
      // is still a genuine error.
      if (!existsSync(resolve(ROOT, dep)) && !gitTracked(dep))
        problems.push(`${where}: dependsOn path not found: ${dep}`);
    }
  }
  return problems;
}

/* ── Fetching ──────────────────────────────────────────────────────────── */

/** Set for the duration of a `legacyTLS` entry's observation; see observe().
 *  Entries run sequentially, which is what makes a module-level handle safe -
 *  the same argument the insecureTLS env toggle relies on. */
let legacyTLSDispatcher: unknown;

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
        // `dispatcher` is undici's, not in the DOM RequestInit type.
        ...(legacyTLSDispatcher ? { dispatcher: legacyTLSDispatcher } : {}),
      } as RequestInit);
    } finally {
      clearTimeout(timer);
    }
  };
  // Retry on THROWN errors (DNS, TLS, timeout) and on the status codes that
  // mean "a bot filter bounced you", not "this resource is gone".
  //
  // Added after the 2026-07-26 pre-merge dry runs: dusib-jj-bastis (403) and
  // fabdem-dem (415) each passed one run and failed the next, minutes apart,
  // with no upstream change. Same lesson as the link sweep, where running 8
  // requests in parallel got Newslaundry rate-limited and reported a live page
  // as dead. Treating the first bounce as truth manufactures findings.
  //
  // 404/410 are NOT retried - those are real answers.
  const TRANSIENT = new Set([403, 408, 415, 425, 429, 500, 502, 503, 504]);
  try {
    const res = await attempt();
    if (!TRANSIENT.has(res.status)) return res;
    await new Promise((r) => setTimeout(r, 3000));
    return await attempt();
  } catch {
    await new Promise((r) => setTimeout(r, 3000));
    return await attempt();
  }
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

/** Observed upstream state, same shape as lastSeen minus the human fields. */
type Observed = Omit<LastSeen, "edition" | "acceptedOn">;

async function observe(e: SourceEntry): Promise<Observed> {
  // term-expiry is a calendar check, not a fetch - the registry entry carries
  // the whole state, so there is nothing upstream to observe.
  if (e.detection.method === "term-expiry") return {};
  // Continuous upstreams are never fetched - registered for accountability only.
  if (e.detection.method === "continuous") return {};
  if (e.legacyTLS) {
    // Certificate verification stays on - only the renegotiation handshake is
    // relaxed. See SourceEntry.legacyTLS for why insecureTLS does not do this.
    const { Agent } = await import("undici");
    const { constants } = await import("node:crypto");
    legacyTLSDispatcher = new Agent({
      connect: { secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT },
    });
    try {
      return await observeInner(e);
    } finally {
      legacyTLSDispatcher = undefined;
    }
  }
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

  // Several of the highest-value episodic sources publish at a PREDICTABLE path
  // with no listing page anywhere - TN's policy notes (maws_e_pn_{YYYY}_{YY}.pdf),
  // BMC's ESR, CPCB's annual river data. link-set has nothing to scrape and
  // http-meta can only see the edition already named in the url, so neither can
  // ever detect the NEXT one. This probes the template forward instead.
  if (d.method === "url-template") {
    const thisYear = new Date().getUTCFullYear();
    const from = d.templateFrom ?? thisYear - 1;
    const expand = (y: number) =>
      d.urlTemplate!
        .replace(/\{YYYY\}/g, String(y))
        .replace(/\{YYYY1\}/g, String(y + 1))
        .replace(/\{YY\}/g, String((y + 1) % 100).padStart(2, "0"));

    let latest: { year: number; url: string } | null = null;
    let notFound = 0;
    let unreachable = 0;
    let lastError = "";
    for (let y = from; y <= thisYear + 1; y++) {
      const url = expand(y);
      try {
        let res = await fetchWithTimeout(url, { method: "HEAD" });
        if (!res.ok) res = await fetchWithTimeout(url);
        // A soft-404 host answers every year with 200, so `ok` alone would
        // pin `latest` to the last year probed and never move. Where the
        // entry declares the content type a real edition serves, a mismatch
        // is a not-found, not a hit. See Detection.expectContentType.
        const typeOk =
          !d.expectContentType ||
          (res.headers.get("content-type") ?? "")
            .toLowerCase()
            .startsWith(d.expectContentType.toLowerCase());
        if (res.ok && typeOk) latest = { year: y, url };
        else notFound++;
      } catch (e) {
        // A single year 404ing is normal (not published yet). A single year
        // THROWING is not the same thing, and conflating them is how a network
        // failure gets misread as a config error - see the note below.
        unreachable++;
        lastError = String(e).slice(0, 80);
      }
    }
    if (!latest) {
      // Distinguish "the host is unreachable" from "the template is wrong".
      // The first CI dry run (2026-07-26) reported "check the template" for
      // maws-policy-note and wrd-policy-note-tn when the real cause was
      // cms.tn.gov.in refusing the runner - exactly the pointer-vs-source
      // confusion that left cpcb-nwmp-annual broken for days.
      throw new Error(
        unreachable > 0 && notFound === 0
          ? `url-template: every probe from ${from} to ${thisYear + 1} failed to connect ` +
            `(${lastError}) - the HOST is unreachable, NOT a template problem. ` +
            `If this is CI-only, add ciBlocked.`
          : `url-template: no edition found from ${from} to ${thisYear + 1} ` +
            `(${notFound} not-found, ${unreachable} unreachable) - check the template ` +
            `or bump templateFrom`,
      );
    }
    // apiDate carries "<year> <url>" so the diff report names the new edition.
    return { apiDate: `${latest.year} ${latest.url}` };
  }

  if (d.method === "content-hash") {
    const res = await fetchWithTimeout(e.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error("empty body - nothing to hash");
    return { contentHash: sha256(buf.toString("binary")) };
  }

  if (d.method === "human-review") {
    // Deliberately no fetch. This method asserts nothing about the upstream;
    // the state comes entirely from when a person last looked.
    return {};
  }

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
  state: "ok" | "new-edition" | "check-failed" | "unbaselined" | "local-only" | "review-due";
  detail: string;
  /** link-set only: links present now but not in lastSeen. */
  newLinks?: string[];
  observed?: Observed;
}

function compare(e: SourceEntry, obs: Observed): CheckResult {
  // Continuous upstreams have no editions and are never fetched; they exist
  // for lineage/licence accountability. Always ok, never unbaselined.
  if (e.detection.method === "continuous") {
    return {
      entry: e,
      state: "ok",
      detail: "continuous upstream - no editions to watch; freshness-tracked (P5-1)",
      observed: obs,
    };
  }

  // Term-expiry carries its own state, so it is answerable before any
  // baseline exists - an unbaselined entry would otherwise mask a term that
  // has already run out.
  if (e.detection.method === "term-expiry") {
    const endsOn = e.detection.termEndsOn!;
    const lead = e.detection.leadTimeDays ?? DEFAULT_TERM_LEAD_DAYS;
    const daysLeft = Math.floor(
      (new Date(endsOn + "T00:00:00Z").getTime() - Date.now()) / 86_400_000,
    );
    const due = daysLeft <= lead;
    return {
      entry: e,
      state: due ? "new-edition" : "ok",
      detail: due
        ? daysLeft < 0
          ? `term ended ${endsOn} (${-daysLeft}d ago) - incumbents may already have changed; verify the result and roll termEndsOn forward`
          : `term ends ${endsOn} in ${daysLeft}d (lead ${lead}d) - line up the result source now`
        : `term runs to ${endsOn} (${daysLeft}d left)`,
      observed: obs,
    };
  }

  const last = e.lastSeen;
  const m = e.detection.method;
  if (m === "human-review") {
    const every = e.detection.reviewEveryDays ?? 90;
    // `last` is undefined for an entry that has never been accepted, which is
    // the normal starting state here - human-review deliberately skips the
    // unbaselined short-circuit so it can say "nobody has ever looked".
    const on = last?.reviewedOn ?? last?.acceptedOn;
    if (!on) {
      return {
        entry: e,
        state: "review-due",
        detail: `never reviewed - look at the source, then --accept ${e.id} --edition "<what you saw>"`,
        observed: obs,
      };
    }
    const age = Math.floor((Date.now() - new Date(on).getTime()) / 86_400_000);
    const due = age >= every;
    return {
      entry: e,
      state: due ? "review-due" : "ok",
      detail: due
        ? `last reviewed ${on} (${age}d ago, cadence ${every}d) - re-check and --accept`
        : `reviewed ${on} (${age}d ago, next in ${every - age}d)`,
      observed: obs,
    };
  }
  // Every other method needs a baseline before it can say anything.
  if (!last || Object.keys(last).length === 0) {
    return {
      entry: e,
      state: "unbaselined",
      detail: "no lastSeen recorded - baseline with --accept",
      observed: obs,
    };
  }
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
  if (m === "content-hash") {
    const changed = obs.contentHash !== last.contentHash;
    return {
      entry: e,
      state: changed ? "new-edition" : "ok",
      detail: changed
        ? `file content changed (hash ${last.contentHash} -> ${obs.contentHash})`
        : `unchanged (${obs.contentHash})`,
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
  // Above unbaselined: a lapsed review is a commitment we made and missed,
  // where an unbaselined entry is only ever setup we have not finished.
  "review-due": 2,
  unbaselined: 3,
  "local-only": 4,
  ok: 5,
};

function writeReport(results: CheckResult[], now: string): string {
  const lines: string[] = [];
  const count = (s: CheckResult["state"]) => results.filter((r) => r.state === s).length;
  lines.push(`## Headwaters - upstream editions - ${now}`);
  lines.push("");
  const newN = count("new-edition");
  const failN = count("check-failed");
  const baseN = count("unbaselined");
  const localN = count("local-only");
  const reviewN = count("review-due");
  lines.push(
    newN + failN + baseN + reviewN === 0
      ? `All ${results.length} watched sources unchanged.` +
          (localN ? ` (${localN} checked from local runs only - runner IPs blocked.)` : "")
      : `**${newN} new edition(s), ${failN} check failure(s), ${reviewN} review(s) due, ` +
          `${baseN} unbaselined** of ${results.length} watched sources.` +
          (localN ? ` ${localN} local-only.` : ""),
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

  const actionable = results.filter((r) => r.state === "new-edition" || r.state === "check-failed" || r.state === "review-due");
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
  // Machine-readable companion for .github/workflows/lib/rolling-alert.js:
  // the alert channel notifies on CHANGE, so it diffs these stable keys
  // rather than scraping the table above. Only actionable states are keyed -
  // an `ok` source is not news, and `unbaselined`/`local-only` are chores
  // rather than upstream events.
  writeFileSync(
    REPORT_FILE.replace(/\.md$/, "-keys.json"),
    JSON.stringify(
      actionable.map((r) => `${r.entry.id} (${r.state})`),
      null,
      2,
    ) + "\n",
  );
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

  if (flag("--validate") || flag("--coverage")) {
    const { entries } = loadRegistry();
    const problems = validate(entries);
    console.log(`Headwaters registry: ${entries.length} sources across ${new Set(entries.map((e) => e.scope)).size} scopes.`);
    for (const p of problems) console.error(`  FAIL: ${p}`);
    if (problems.length) process.exit(1);
    if (!flag("--coverage")) console.log("Registry valid.");

    // P5-2 coverage gate. Reported by default; --strict makes it blocking once
    // the allowlist reflects reality (see the module header).
    const cov = computeCoverage(
      ROOT,
      entries.flatMap((e) => e.dependsOn ?? []),
    );
    const pct = cov.total ? Math.round(((cov.covered.length + cov.allowlisted.length) / cov.total) * 100) : 100;
    console.log(
      `\nArtifact coverage: ${cov.covered.length} watched + ${cov.allowlisted.length} allowlisted ` +
        `of ${cov.total} shipped artifacts (${pct}%). ${cov.uncovered.length} with no registered upstream.`,
    );

    if (flag("--coverage")) {
      const byCity = new Map<string, string[]>();
      for (const a of cov.uncovered) {
        const c = cityOf(a);
        byCity.set(c, [...(byCity.get(c) ?? []), a]);
      }
      for (const [city, list] of [...byCity].sort((a, b) => b[1].length - a[1].length)) {
        console.log(`\n  ${city} (${list.length} unwatched)`);
        for (const a of list) console.log(`    ${a}`);
      }
      for (const s of cov.staleAllowlist)
        console.warn(`\n  STALE ALLOWLIST (artifact no longer shipped): ${s}`);
    } else if (cov.uncovered.length) {
      console.log(`  Run with --coverage for the per-city list.`);
    }

    if (flag("--strict") && cov.uncovered.length) {
      console.error(
        `\nFAIL: ${cov.uncovered.length} artifacts have no registered upstream and no UNWATCHED reason.`,
      );
      process.exit(1);
    }
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
    if (e.ciBlocked && process.env.CI) {
      const acceptedOn = e.lastSeen?.acceptedOn;
      const age = acceptedOn
        ? Math.floor((Date.now() - new Date(acceptedOn + "T00:00:00Z").getTime()) / 86_400_000)
        : Infinity;
      results.push(
        age > LOCAL_CHECK_MAX_AGE_DAYS
          ? {
              entry: e,
              state: "check-failed",
              detail: `local check OVERDUE (last accept ${acceptedOn ?? "never"}, >${LOCAL_CHECK_MAX_AGE_DAYS}d) - run --check locally. ${e.ciBlocked}`,
            }
          : {
              entry: e,
              state: "local-only",
              detail: `${e.ciBlocked} Last local accept ${acceptedOn} (${age}d ago).`,
            },
      );
      continue;
    }
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
    (r) => r.state === "new-edition" || r.state === "check-failed" || r.state === "review-due",
  );
  if (alerting.length || problems.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

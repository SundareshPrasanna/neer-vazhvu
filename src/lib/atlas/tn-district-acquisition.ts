import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { load } from "cheerio";

import type {
  AcquiredSourceRecordSet,
  CachedArtifact,
  CensusVillageRecord,
  JjmVillageRecord,
  TnDistrictRefreshPlan,
  TnDistrictSourceExtract,
  TnrdLgdGramPanchayatRecord,
  TnrdMasterGramPanchayatRecord,
} from "./acquisition-model";
import { ATLAS_SCHEMA_VERSION } from "./acquisition-model";
import {
  computeArtifactSetSha256,
  computeRecordsSha256,
  validateTnDistrictSourceExtract,
} from "./acquisition-validation";

// ASP.NET suppresses AutoPostBack fields for unknown/non-browser clients, so
// retain a standards-compatible browser prefix and append our product token.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 " +
  "Safari/537.36 NeerVazhvu-Onboarding-Atlas/1.0";
const FETCH_TIMEOUT_MS = 60_000;
// The DCHB workbook is 33.7 MB and censusindia.gov.in has served it at about
// 200 KB/s (measured 2026-08-31: three 60 s attempts each moved 10-12 MB), so
// its download gets its own ceiling instead of the shared one.
const CENSUS_WORKBOOK_TIMEOUT_MS = 300_000;
const FETCH_ATTEMPTS = 3;
const MAX_TEXT_BUFFER = 64 * 1024 * 1024;

interface FetchResult {
  artifact: CachedArtifact;
  responseUrl: string;
  contentType: string;
}

interface AcquisitionOptions {
  cacheDir: string;
  pythonExecutable?: string;
  censusExtractorPath?: string;
  /** The previous extract's census workbook, so a CLOSED release is reused
   *  from the content-addressed cache instead of re-downloaded (33 MB from a
   *  slow host whose TLS chain CI runners reject). */
  previousCensus?: { artifactSha256: string; retrievedAt: string };
}

interface NamedOption {
  value: string;
  text: string;
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function errorChain(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    if (!messages.includes(current.message)) messages.push(current.message);
    current = current.cause;
  }
  return messages.join(": ");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function compareNumericStrings(left: string, right: string): number {
  return left.localeCompare(right, "en", { numeric: true });
}

class ContentAddressedCache {
  readonly objectDir: string;

  constructor(cacheDir: string) {
    this.objectDir = resolve(cacheDir, "objects");
  }

  async put(bytes: Uint8Array): Promise<CachedArtifact> {
    const digest = sha256(bytes);
    await mkdir(this.objectDir, { recursive: true });
    const path = join(this.objectDir, digest);
    try {
      await writeFile(path, bytes, { flag: "wx" });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "EEXIST"
      ) {
        throw error;
      }
      const existing = await readFile(path);
      if (sha256(existing) !== digest) {
        throw new Error(`Cache object ${path} does not match its content digest`);
      }
    }
    return { sha256: digest, path, bytes };
  }
}

class CookieJar {
  private readonly values = new Map<string, string>();

  capture(headers: Headers): void {
    const headersWithCookies = headers as Headers & {
      getSetCookie?: () => string[];
    };
    const setCookies =
      headersWithCookies.getSetCookie?.() ??
      (headers.get("set-cookie") ? [headers.get("set-cookie")!] : []);
    for (const setCookie of setCookies) {
      const pair = setCookie.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator <= 0) continue;
      this.values.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  header(): string | undefined {
    if (this.values.size === 0) return undefined;
    return [...this.values.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

async function fetchIntoCache(
  cache: ContentAddressedCache,
  url: string,
  init: RequestInit = {},
  cookieJar?: CookieJar,
): Promise<FetchResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const headers = new Headers(init.headers);
      headers.set("User-Agent", USER_AGENT);
      headers.set("Accept", "*/*");
      const cookie = cookieJar?.header();
      if (cookie) headers.set("Cookie", cookie);
      const response = await fetch(url, {
        ...init,
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      cookieJar?.capture(response.headers);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0) throw new Error(`Empty response from ${url}`);
      return {
        artifact: await cache.put(bytes),
        responseUrl: response.url,
        contentType: response.headers.get("content-type") ?? "",
      };
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_ATTEMPTS) {
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, 250 * 2 ** (attempt - 1)),
        );
      }
    }
  }
  throw new Error(
    `Fetch failed after ${FETCH_ATTEMPTS} attempts for ${url}: ` +
      errorChain(lastError),
    { cause: lastError },
  );
}

async function fetchWithSystemCurlIntoCache(
  cache: ContentAddressedCache,
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<FetchResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const bytes = execFileSync(
        "curl",
        [
          "--fail",
          "--location",
          "--silent",
          "--show-error",
          "--proto",
          "=https",
          "--max-time",
          String(timeoutMs / 1_000),
          "--output",
          "-",
          url,
        ],
        { maxBuffer: MAX_TEXT_BUFFER },
      );
      if (bytes.length === 0) throw new Error(`Empty response from ${url}`);
      return {
        artifact: await cache.put(bytes),
        responseUrl: url,
        contentType: "",
      };
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_ATTEMPTS) {
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, 250 * 2 ** (attempt - 1)),
        );
      }
    }
  }
  throw new Error(
    `curl failed after ${FETCH_ATTEMPTS} attempts for ${url}: ` +
      errorChain(lastError),
    { cause: lastError },
  );
}

function artifactText(result: FetchResult): string {
  return new TextDecoder("utf-8").decode(result.artifact.bytes);
}

function parseOptions(html: string, selector = "option"): NamedOption[] {
  const $ = load(html);
  return $(selector)
    .toArray()
    .map((element) => ({
      value: normalizeWhitespace($(element).attr("value") ?? ""),
      text: normalizeWhitespace($(element).text()),
    }))
    .filter((option) => option.value.length > 0);
}

function requiredOption(
  options: NamedOption[],
  value: string,
  label: string,
): NamedOption {
  const matches = options.filter((option) => option.value === value);
  if (matches.length !== 1) {
    throw new Error(`${label}: expected one option ${value}, found ${matches.length}`);
  }
  return matches[0];
}

function validateRecordCount(
  label: string,
  expected: number,
  records: unknown[],
): void {
  if (records.length !== expected) {
    throw new Error(
      `${label}: expected ${expected} district records, found ${records.length}`,
    );
  }
}

async function withSourceContext<T>(
  sourceName: string,
  acquisition: () => Promise<T>,
): Promise<T> {
  try {
    return await acquisition();
  } catch (error) {
    const detail = errorChain(error) || String(error);
    throw new Error(`${sourceName} acquisition failed: ${detail}`, {
      cause: error,
    });
  }
}

export function parseTnrdLgdText(
  text: string,
  districtCode: string,
): TnrdLgdGramPanchayatRecord[] {
  const records: TnrdLgdGramPanchayatRecord[] = [];
  for (const rawLine of text.replaceAll("\f", "\n").split(/\r?\n/)) {
    const match = rawLine.match(
      /^\s*(\d{3})\s+(.+?)\s+(\d{4})\s+(.+?)\s+(\d{6})\s+(.+?)\s*$/,
    );
    if (!match || match[1] !== districtCode) continue;
    records.push({
      districtCode: match[1],
      districtName: normalizeWhitespace(match[2]),
      blockCode: match[3],
      blockName: normalizeWhitespace(match[4]),
      gramPanchayatCode: match[5],
      gramPanchayatName: normalizeWhitespace(match[6]),
    });
  }
  records.sort((left, right) =>
    compareNumericStrings(left.gramPanchayatCode, right.gramPanchayatCode),
  );
  const codes = records.map((record) => record.gramPanchayatCode);
  if (new Set(codes).size !== codes.length) {
    throw new Error(`TNRD LGD extract contains duplicate Gram Panchayat codes`);
  }
  return records;
}

function parseTnrdMasterSourceDate(html: string): string {
  const text = load(html).text();
  const matches = [...text.matchAll(/(\d{2})-(\d{2})-(\d{4})/g)];
  if (matches.length === 0) {
    throw new Error("TNRD master page does not expose a last-updated date");
  }
  const match = matches.at(-1)!;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function base64(value: string | number): string {
  return Buffer.from(String(value), "utf8").toString("base64");
}

async function postUrlEncoded(
  cache: ContentAddressedCache,
  url: string,
  fields: Record<string, string>,
): Promise<FetchResult> {
  const body = new URLSearchParams(fields);
  return fetchIntoCache(cache, url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: url,
    },
    body,
  });
}

async function acquireTnrdMaster(
  plan: TnDistrictRefreshPlan,
  acquiredAt: string,
  cache: ContentAddressedCache,
): Promise<AcquiredSourceRecordSet<TnrdMasterGramPanchayatRecord>> {
  const initial = await fetchIntoCache(cache, plan.sources.tnrdMaster.url);
  const initialHtml = artifactText(initial);
  const district = requiredOption(
    parseOptions(initialHtml, "select#dcode option"),
    plan.district.tnrdMasterCode,
    "TNRD master district",
  );
  const blockResponse = await postUrlEncoded(cache, plan.sources.tnrdMaster.url, {
    dcode: base64(plan.district.tnrdMasterCode),
    cmd: base64(9),
  });
  const blocks = parseOptions(artifactText(blockResponse));
  validateRecordCount(
    "TNRD master blocks",
    plan.expectedCounts.tnrdMasterBlocks,
    blocks,
  );

  const artifactSha256s = [
    initial.artifact.sha256,
    blockResponse.artifact.sha256,
  ];
  const records: TnrdMasterGramPanchayatRecord[] = [];
  for (const block of blocks) {
    const response = await postUrlEncoded(cache, plan.sources.tnrdMaster.url, {
      dcode: base64(plan.district.tnrdMasterCode),
      bcode: base64(block.value),
      cmd: base64(3),
    });
    artifactSha256s.push(response.artifact.sha256);
    for (const gramPanchayat of parseOptions(artifactText(response))) {
      records.push({
        districtLocalCode: plan.district.tnrdMasterCode,
        districtName: district.text,
        blockLocalCode: block.value,
        blockName: block.text,
        gramPanchayatLocalCode: gramPanchayat.value,
        gramPanchayatName: gramPanchayat.text,
      });
    }
  }
  records.sort(
    (left, right) =>
      compareNumericStrings(left.blockLocalCode, right.blockLocalCode) ||
      compareNumericStrings(
        left.gramPanchayatLocalCode,
        right.gramPanchayatLocalCode,
      ),
  );
  validateRecordCount(
    "TNRD master Gram Panchayats",
    plan.expectedCounts.tnrdMasterGramPanchayats,
    records,
  );
  return {
    sourceId: "tnrd-current-panchayat-master",
    sourceUrl: plan.sources.tnrdMaster.url,
    retrievedAt: acquiredAt,
    sourceAsOf: parseTnrdMasterSourceDate(initialHtml),
    snapshotSha256: computeArtifactSetSha256(artifactSha256s),
    artifactSha256s,
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
}

async function acquireTnrdLgd(
  plan: TnDistrictRefreshPlan,
  acquiredAt: string,
  cache: ContentAddressedCache,
): Promise<AcquiredSourceRecordSet<TnrdLgdGramPanchayatRecord>> {
  const response = await fetchIntoCache(cache, plan.sources.tnrdLgdPdf.url);
  if (!Buffer.from(response.artifact.bytes.subarray(0, 5)).equals(Buffer.from("%PDF-"))) {
    throw new Error("TNRD LGD source did not return a PDF");
  }
  const text = execFileSync(
    "pdftotext",
    ["-layout", response.artifact.path, "-"],
    {
      encoding: "utf8",
      maxBuffer: MAX_TEXT_BUFFER,
    },
  );
  const records = parseTnrdLgdText(text, plan.district.tnrdLgdCode);
  validateRecordCount(
    "TNRD LGD Gram Panchayats",
    plan.expectedCounts.tnrdLgdGramPanchayats,
    records,
  );
  return {
    sourceId: "tnrd-lgd-village-panchayat-list",
    sourceUrl: plan.sources.tnrdLgdPdf.url,
    retrievedAt: acquiredAt,
    sourceAsOf: plan.sources.tnrdLgdPdf.sourceAsOf,
    snapshotSha256: response.artifact.sha256,
    artifactSha256s: [response.artifact.sha256],
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
}

function collectWebFormsFields(html: string): URLSearchParams {
  const $ = load(html);
  const fields = new URLSearchParams();
  $("form input[name]").each((_index, element) => {
    if ($(element).is(":disabled")) return;
    const type = ($(element).attr("type") ?? "text").toLowerCase();
    if (!["hidden", "text"].includes(type)) return;
    fields.set($(element).attr("name")!, $(element).attr("value") ?? "");
  });
  $("form select[name]").each((_index, element) => {
    if ($(element).is(":disabled")) return;
    const selected = $(element).find("option[selected]").first();
    const option = selected.length > 0 ? selected : $(element).find("option").first();
    if (option.length === 0) return;
    fields.set($(element).attr("name")!, option.attr("value") ?? "");
  });
  return fields;
}

async function webFormsPostBack(
  cache: ContentAddressedCache,
  url: string,
  html: string,
  eventTarget: string,
  updates: Record<string, string>,
  cookieJar: CookieJar,
): Promise<FetchResult> {
  const fields = collectWebFormsFields(html);
  fields.set("__EVENTTARGET", eventTarget);
  fields.set("__EVENTARGUMENT", "");
  for (const [name, value] of Object.entries(updates)) fields.set(name, value);
  return fetchIntoCache(
    cache,
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: url,
      },
      body: fields,
    },
    cookieJar,
  );
}

export function parseJjmDistrictHtml(
  html: string,
  stateId: string,
  districtId: string,
): JjmVillageRecord[] {
  const $ = load(html);
  requiredOption(
    parseOptions(html, "select#ddState option"),
    stateId,
    "JJM state",
  );
  requiredOption(
    parseOptions(html, "select#ddDistrict option"),
    districtId,
    "JJM district",
  );
  const records: JjmVillageRecord[] = [];
  $("select#ddList option").each((_index, element) => {
    const value = normalizeWhitespace($(element).attr("value") ?? "");
    if (!value || value === "-1") return;
    const ids = value.split("/").map(normalizeWhitespace);
    const names = normalizeWhitespace($(element).text())
      .split("/")
      .map(normalizeWhitespace);
    if (
      ids.length !== 3 ||
      names.length !== 3 ||
      !ids.every((id) => /^\d+$/.test(id))
    ) {
      throw new Error(`Malformed JJM district option ${JSON.stringify(value)}`);
    }
    records.push({
      stateId,
      districtId,
      blockId: ids[0],
      blockName: names[0],
      gpId: ids[1],
      gpName: names[1],
      villageId: ids[2],
      villageName: names[2],
    });
  });
  records.sort((left, right) => compareNumericStrings(left.villageId, right.villageId));
  const recordKeys = records.map(
    (record) => `${record.blockId}/${record.gpId}/${record.villageId}`,
  );
  if (new Set(recordKeys).size !== recordKeys.length) {
    throw new Error("JJM district enumeration contains duplicate record paths");
  }
  return records;
}

async function acquireJjm(
  plan: TnDistrictRefreshPlan,
  acquiredAt: string,
  cache: ContentAddressedCache,
): Promise<AcquiredSourceRecordSet<JjmVillageRecord>> {
  const cookies = new CookieJar();
  const initial = await fetchIntoCache(
    cache,
    plan.sources.jjm.url,
    {},
    cookies,
  );
  const state = await webFormsPostBack(
    cache,
    plan.sources.jjm.url,
    artifactText(initial),
    "ddState",
    {
      ddState: plan.district.jjmStateId,
      ddDistrict: "-1",
    },
    cookies,
  );
  requiredOption(
    parseOptions(artifactText(state), "select#ddDistrict option"),
    plan.district.jjmDistrictId,
    "JJM district after state selection",
  );
  const district = await webFormsPostBack(
    cache,
    plan.sources.jjm.url,
    artifactText(state),
    "ddDistrict",
    {
      ddState: plan.district.jjmStateId,
      ddDistrict: plan.district.jjmDistrictId,
    },
    cookies,
  );
  const records = parseJjmDistrictHtml(
    artifactText(district),
    plan.district.jjmStateId,
    plan.district.jjmDistrictId,
  );
  validateRecordCount(
    "JJM district villages",
    plan.expectedCounts.jjmVillages,
    records,
  );
  const artifactSha256s = [
    initial.artifact.sha256,
    state.artifact.sha256,
    district.artifact.sha256,
  ];
  return {
    sourceId: "jjm-citizen-corner",
    sourceUrl: plan.sources.jjm.url,
    retrievedAt: acquiredAt,
    sourceAsOf: acquiredAt,
    snapshotSha256: computeArtifactSetSha256(artifactSha256s),
    artifactSha256s,
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
}

async function acquireCensus(
  plan: TnDistrictRefreshPlan,
  acquiredAt: string,
  cache: ContentAddressedCache,
  options: AcquisitionOptions,
): Promise<AcquiredSourceRecordSet<CensusVillageRecord>> {
  // The DCHB workbook is a CLOSED release (the 2021 census did not happen),
  // so its bytes can never change: when the previous acquisition's workbook
  // sits in the content-addressed cache, it is reused hash-verified instead
  // of re-downloaded (33.7 MB from a host measured at ~200 KB/s, whose TLS
  // chain CI runners reject). The record then carries the ORIGINAL
  // retrievedAt under an explicit reusedCachedArtifact flag the extract
  // validator understands. No cached copy falls through to the download.
  let response: FetchResult | null = null;
  let retrievedAt = acquiredAt;
  let reused = false;
  if (options.previousCensus) {
    const cachedPath = join(cache.objectDir, options.previousCensus.artifactSha256);
    try {
      const bytes = new Uint8Array(await readFile(cachedPath));
      if (sha256(bytes) !== options.previousCensus.artifactSha256) {
        throw new Error(`Cache object ${cachedPath} does not match its content digest`);
      }
      response = {
        artifact: { sha256: options.previousCensus.artifactSha256, path: cachedPath, bytes },
        responseUrl: plan.sources.census.url,
        contentType: "",
      };
      retrievedAt = options.previousCensus.retrievedAt;
      reused = true;
      console.error(
        `  census: reusing the cached closed-edition workbook ` +
          `(sha ${options.previousCensus.artifactSha256.slice(0, 12)}, retrieved ${retrievedAt})`,
      );
    } catch {
      response = null; // absent or unreadable cache: download below
    }
  }
  if (response === null) {
    // Census India's chain is accepted by the operating-system trust store
    // but is incomplete for Node's bundled CA verifier. curl still performs
    // normal TLS verification here; this is not an insecure-certificate
    // fallback.
    response = await fetchWithSystemCurlIntoCache(
      cache,
      plan.sources.census.url,
      CENSUS_WORKBOOK_TIMEOUT_MS,
    );
  }
  const signature = Buffer.from(response.artifact.bytes.subarray(0, 2)).toString("ascii");
  if (signature !== "PK") {
    throw new Error("Census source did not return an XLSX/ZIP workbook");
  }
  const extractorPath =
    options.censusExtractorPath ??
    resolve(process.cwd(), "scripts/atlas_extract_census_village_amenities.py");
  const output = execFileSync(
    options.pythonExecutable ?? "python3",
    [
      extractorPath,
      "--xlsx",
      response.artifact.path,
      "--district-code",
      plan.district.censusDistrictCode,
    ],
    {
      encoding: "utf8",
      maxBuffer: MAX_TEXT_BUFFER,
    },
  );
  const records = JSON.parse(output) as CensusVillageRecord[];
  validateRecordCount(
    "Census district villages",
    plan.expectedCounts.censusVillages,
    records,
  );
  return {
    sourceId: "census-2011-village-amenities",
    sourceUrl: plan.sources.census.url,
    retrievedAt,
    ...(reused ? { reusedCachedArtifact: true as const } : {}),
    sourceAsOf: plan.sources.census.sourceAsOf,
    snapshotSha256: response.artifact.sha256,
    artifactSha256s: [response.artifact.sha256],
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
}

export async function acquireTnDistrictSourceExtract(
  plan: TnDistrictRefreshPlan,
  acquiredAt: string,
  options: AcquisitionOptions,
): Promise<TnDistrictSourceExtract> {
  const cache = new ContentAddressedCache(options.cacheDir);
  const [tnrdLgd, tnrdMaster, jjm, census] = await Promise.all([
    withSourceContext("TNRD LGD list", () =>
      acquireTnrdLgd(plan, acquiredAt, cache),
    ),
    withSourceContext("TNRD current master", () =>
      acquireTnrdMaster(plan, acquiredAt, cache),
    ),
    withSourceContext("JJM Citizen Corner", () =>
      acquireJjm(plan, acquiredAt, cache),
    ),
    withSourceContext("Census village amenities", () =>
      acquireCensus(plan, acquiredAt, cache, options),
    ),
  ]);
  const extract: TnDistrictSourceExtract = {
    schemaVersion: ATLAS_SCHEMA_VERSION,
    planId: plan.id,
    acquiredAt,
    sources: { tnrdLgd, tnrdMaster, jjm, census },
  };
  const errors = validateTnDistrictSourceExtract(extract);
  if (errors.length > 0) {
    throw new Error(`Acquisition produced an invalid extract:\n- ${errors.join("\n- ")}`);
  }
  return extract;
}

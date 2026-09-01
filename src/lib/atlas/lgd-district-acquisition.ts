/**
 * Acquires the identity sources for a district whose master is the Local
 * Government Directory: the LGD Sub-Districts, Villages and Local Bodies
 * resources as republished monthly on data.gov.in by the Ministry of
 * Panchayati Raj, the JJM citizen-corner village enumeration, and the Census
 * 2011 DCHB village release.
 *
 * lgdirectory.gov.in itself sits behind a captcha on every view and every
 * download, so the portal republication is what a machine can read. Its API
 * caps ordinary keys at ten records a call; the portal's own bulk export
 * (limit=all, CSV) is advertised in each resource's metadata as
 * `datafile_url`, and that is discovered at fetch time rather than copied
 * into the plan, so a rotated export key never strands a refresh.
 *
 * Fail-closed like the Tamil Nadu adapter: every count is checked against
 * the reviewed plan, every export is content-addressed under .cache/atlas/,
 * and a header that no longer matches what the parser expects stops the run
 * rather than mis-reading a column.
 */
import { resolve } from "node:path";

import type { AcquiredSourceRecordSet, CensusVillageRecord, JjmVillageRecord } from "./acquisition-model";
import { ATLAS_SCHEMA_VERSION } from "./acquisition-model";
import { computeArtifactSetSha256, computeRecordsSha256 } from "./acquisition-validation";
import {
  LGD_IDENTITY_ADAPTER,
  LGD_SOURCE_IDS,
  validateLgdDistrictSourceExtract,
  type LgdDistrictRefreshPlan,
  type LgdDistrictSourceExtract,
  type LgdLocalBodyCoverageRecord,
  type LgdResourceSource,
  type LgdSubdistrictRecord,
  type LgdVillageRecord,
} from "./lgd-acquisition-model";
import {
  ContentAddressedCache,
  acquireCensusVillages,
  acquireJjmEnumeration,
  artifactText,
  fetchIntoCache,
  fetchWithSystemCurlIntoCache,
  validateRecordCount,
  withSourceContext,
  type AcquisitionOptions,
} from "./tn-district-acquisition";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36 NeerVazhvu-Onboarding-Atlas/1.0";

/** Where a resource's bulk export url is published. */
export const OGD_RESOURCE_METADATA_URL =
  "https://www.data.gov.in/backend/dmspublic/v1/resources";

/**
 * data.gov.in drops new connections for a while after a burst of requests
 * (observed 2026-09-01: connect timeouts from Node while a single curl
 * succeeded), so its calls are made one at a time and each one waits out a
 * refusal on this ladder before giving up. Minutes, not the shared fetch's
 * quarter-second retries.
 */
const PATIENCE_MS = [5_000, 15_000, 45_000, 90_000, 180_000];

async function patientFetchIntoCache(
  cache: ContentAddressedCache,
  url: string,
): Promise<Awaited<ReturnType<typeof fetchIntoCache>>> {
  let lastError: unknown;
  for (const [attempt, wait] of PATIENCE_MS.entries()) {
    try {
      // Node's fetch has been refused where the system curl connected in the
      // same minute (2026-09-01), so the later rungs try curl: same bytes,
      // same content-addressed cache, no verification relaxed.
      return attempt < 2
        ? await fetchIntoCache(cache, url)
        : await fetchWithSystemCurlIntoCache(cache, url, 300_000, { globoff: true, userAgent: USER_AGENT });
    } catch (error) {
      lastError = error;
      console.error(
        `  data.gov.in refused (${attempt + 1}/${PATIENCE_MS.length}); waiting ${wait / 1000} s: ` +
          (error instanceof Error ? error.message.split(":")[0] : String(error)),
      );
      await new Promise((resolveWait) => setTimeout(resolveWait, wait));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/* ── CSV ───────────────────────────────────────────────────────────────── */

/** RFC 4180 rows: quoted fields may hold commas and doubled quotes. The
 *  exports carry no embedded newlines, and a row that tries one fails the
 *  column-count check below rather than being silently spliced. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

/** The export quotes some header cells twice ("""stateCode"""), so a header
 *  is compared after stripping quotes and whitespace. */
function normaliseHeader(cell: string): string {
  return cell.replace(/"/g, "").trim();
}

function requireHeader(actual: string[], expected: string[], label: string): void {
  const seen = actual.map(normaliseHeader);
  if (seen.length !== expected.length || seen.some((cell, index) => cell !== expected[index])) {
    throw new Error(
      `${label}: export columns changed.\n  expected ${expected.join(",")}\n  found    ${seen.join(",")}`,
    );
  }
}

/* ── data.gov.in ───────────────────────────────────────────────────────── */

interface ResourceExport {
  exportUrl: string;
  /** The portal's own "changed" stamp for the resource, as a date. */
  changedOn: string;
  metadataSha256: string;
}

/** Reads the portal's metadata row for a resource and takes the bulk export
 *  url it advertises. Nothing here is guessed: if the portal stops publishing
 *  a datafile_url the refresh stops with that message. */
export async function discoverResourceExport(
  source: LgdResourceSource,
  cache: ContentAddressedCache,
): Promise<ResourceExport> {
  const url = `${OGD_RESOURCE_METADATA_URL}?filters[uuid]=${source.resourceId}&limit=1`;
  const response = await patientFetchIntoCache(cache, url);
  const parsed = JSON.parse(artifactText(response)) as {
    data?: { rows?: Array<Record<string, unknown[]>> };
  };
  const row = parsed.data?.rows?.[0];
  const exportUrl = row?.datafile_url?.[0];
  const changed = row?.changed?.[0];
  if (typeof exportUrl !== "string" || !exportUrl.startsWith("https://api.data.gov.in/resource/")) {
    throw new Error(`data.gov.in publishes no bulk export url for resource ${source.resourceId}`);
  }
  if (!exportUrl.includes(source.resourceId)) {
    throw new Error(`data.gov.in export url ${exportUrl} is not for resource ${source.resourceId}`);
  }
  if (typeof changed !== "number") {
    throw new Error(`data.gov.in metadata for ${source.resourceId} carries no changed stamp`);
  }
  return {
    exportUrl,
    changedOn: new Date(changed * 1000).toISOString().slice(0, 10),
    metadataSha256: response.artifact.sha256,
  };
}

async function fetchExport(
  exportUrl: string,
  filters: Record<string, string>,
  cache: ContentAddressedCache,
): Promise<{ rows: string[][]; sha256: string; url: string }> {
  const params = Object.entries(filters)
    .map(([key, value]) => `&filters[${encodeURIComponent(key)}]=${encodeURIComponent(value)}`)
    .join("");
  const url = `${exportUrl}${params}`;
  const response = await patientFetchIntoCache(cache, url);
  const text = artifactText(response);
  if (!text.trim().startsWith('"') && !/^[A-Za-z]/.test(text.trim())) {
    throw new Error(`data.gov.in export did not return CSV for ${url}`);
  }
  return { rows: parseCsv(text), sha256: response.artifact.sha256, url };
}

/* ── the three LGD resources ───────────────────────────────────────────── */

const SUBDISTRICT_COLUMNS = [
  "state_code",
  "state_name_english",
  "state_name_local",
  "state_census2011_code",
  "district_code",
  "district_name_english",
  "district_name_local",
  "district_census2011_code",
  "subdistrict_code",
  "subdistrict_name_english",
  "subdistrict_name_local",
  "subdistrict_census2011_code",
  "last_updated",
];

/** The Villages export labels the local-name column "VillageCode" a second
 *  time; positions are what the parser trusts, and the header is checked as
 *  published so a re-ordered export stops the run. */
const VILLAGE_COLUMNS = [
  "VillageCode",
  "VillageNameEnglish",
  "VillageCode",
  "VillageCensus2011Code",
  "SubdistrictCode",
  "SubDistrictNameEnglish",
  "SubDistrictNameLocal",
  "SubDistrictCensus2011Code",
  "DistrictCode",
  "DistrictNameEnglish",
  "DistrictNameLocal",
  "DistrictCensus2011Code",
  "StateCode",
  "StateNameEnglish",
  "StateNameLocal",
  "stateCensus2011Code",
  "last_updated",
];

const LOCAL_BODY_COLUMNS = [
  "stateCode",
  "stateNameEnglish",
  "stateNameLocal",
  "stateCensus2011Code",
  "localBodyCode",
  "localBodyNameEnglish",
  "localBodyNameLocal",
  "localBodyCensus2011Code",
  "localBodyTypeCode",
  "localBodyTypeName",
  "coverage_entityCode",
  "coverage_entityName",
  "coverage_entityType",
  "coverage_coverageType",
  "last_updated",
];

const trim = (value: string | undefined): string => (value ?? "").trim();

async function acquireSubdistricts(
  plan: LgdDistrictRefreshPlan,
  acquiredAt: string,
  cache: ContentAddressedCache,
): Promise<AcquiredSourceRecordSet<LgdSubdistrictRecord>> {
  const source = plan.sources.lgdSubdistricts;
  const discovered = await discoverResourceExport(source, cache);
  const { rows, sha256, url } = await fetchExport(
    discovered.exportUrl,
    { district_code: plan.district.lgdDistrictCode },
    cache,
  );
  requireHeader(rows[0] ?? [], SUBDISTRICT_COLUMNS, "LGD sub-districts");
  const records: LgdSubdistrictRecord[] = rows.slice(1).map((cells) => ({
    stateCode: trim(cells[0]),
    districtCode: trim(cells[4]),
    districtName: trim(cells[5]),
    subdistrictCode: trim(cells[8]),
    subdistrictName: trim(cells[9]),
    subdistrictCensus2011Code: trim(cells[11]),
  }));
  for (const record of records) {
    if (record.districtCode !== plan.district.lgdDistrictCode) {
      throw new Error(`LGD sub-district ${record.subdistrictCode} belongs to district ${record.districtCode}`);
    }
  }
  records.sort((left, right) => left.subdistrictCode.localeCompare(right.subdistrictCode, "en", { numeric: true }));
  validateRecordCount("LGD sub-districts", plan.expectedCounts.lgdSubdistricts, records);
  return {
    sourceId: LGD_SOURCE_IDS.subdistricts,
    sourceUrl: url,
    retrievedAt: acquiredAt,
    sourceAsOf: discovered.changedOn,
    snapshotSha256: computeArtifactSetSha256([discovered.metadataSha256, sha256]),
    artifactSha256s: [discovered.metadataSha256, sha256],
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
}

async function acquireVillages(
  plan: LgdDistrictRefreshPlan,
  acquiredAt: string,
  cache: ContentAddressedCache,
): Promise<AcquiredSourceRecordSet<LgdVillageRecord>> {
  const source = plan.sources.lgdVillages;
  const discovered = await discoverResourceExport(source, cache);
  const { rows, sha256, url } = await fetchExport(
    discovered.exportUrl,
    { districtCode: plan.district.lgdDistrictCode },
    cache,
  );
  requireHeader(rows[0] ?? [], VILLAGE_COLUMNS, "LGD villages");
  const records: LgdVillageRecord[] = rows.slice(1).map((cells) => ({
    villageCode: trim(cells[0]),
    villageName: trim(cells[1]),
    villageCensus2011Code: trim(cells[3]),
    subdistrictCode: trim(cells[4]),
    subdistrictName: trim(cells[5]),
    districtCode: trim(cells[8]),
    stateCode: trim(cells[12]),
  }));
  for (const record of records) {
    if (record.districtCode !== plan.district.lgdDistrictCode) {
      throw new Error(`LGD village ${record.villageCode} belongs to district ${record.districtCode}`);
    }
  }
  records.sort((left, right) => left.villageCode.localeCompare(right.villageCode, "en", { numeric: true }));
  validateRecordCount("LGD villages", plan.expectedCounts.lgdVillages, records);
  return {
    sourceId: LGD_SOURCE_IDS.villages,
    sourceUrl: url,
    retrievedAt: acquiredAt,
    sourceAsOf: discovered.changedOn,
    snapshotSha256: computeArtifactSetSha256([discovered.metadataSha256, sha256]),
    artifactSha256s: [discovered.metadataSha256, sha256],
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
}

/** The Local Bodies resource has no district column, so the state's Village
 *  Panchayat rows are exported whole and the district's are those whose
 *  covered village is in the district's village list. A Panchayat whose only
 *  coverage rows point outside the district is not this district's. */
async function acquireLocalBodies(
  plan: LgdDistrictRefreshPlan,
  villages: LgdVillageRecord[],
  acquiredAt: string,
  cache: ContentAddressedCache,
): Promise<AcquiredSourceRecordSet<LgdLocalBodyCoverageRecord>> {
  const source = plan.sources.lgdLocalBodies;
  const discovered = await discoverResourceExport(source, cache);
  const { rows, sha256, url } = await fetchExport(
    discovered.exportUrl,
    { stateCode: plan.district.lgdStateCode, localBodyTypeName: "Village Panchayat" },
    cache,
  );
  requireHeader(rows[0] ?? [], LOCAL_BODY_COLUMNS, "LGD local bodies");
  const villageCodes = new Set(villages.map((village) => village.villageCode));
  const records: LgdLocalBodyCoverageRecord[] = [];
  for (const cells of rows.slice(1)) {
    const entityCode = trim(cells[10]);
    if (!villageCodes.has(entityCode)) continue;
    records.push({
      stateCode: trim(cells[0]),
      localBodyCode: trim(cells[4]),
      localBodyName: trim(cells[5]),
      localBodyNameLocal: trim(cells[6]),
      localBodyTypeName: trim(cells[9]),
      entityCode,
      entityName: trim(cells[11]),
      entityType: trim(cells[12]),
      coverageType: trim(cells[13]),
    });
  }
  records.sort(
    (left, right) =>
      left.localBodyCode.localeCompare(right.localBodyCode, "en", { numeric: true }) ||
      left.entityCode.localeCompare(right.entityCode, "en", { numeric: true }),
  );
  validateRecordCount("LGD coverage rows", plan.expectedCounts.lgdCoverageRows, records);
  const gramPanchayats = new Set(records.map((record) => record.localBodyCode));
  if (gramPanchayats.size !== plan.expectedCounts.lgdGramPanchayats) {
    throw new Error(
      `LGD Gram Panchayats: expected ${plan.expectedCounts.lgdGramPanchayats}, found ${gramPanchayats.size}`,
    );
  }
  return {
    sourceId: LGD_SOURCE_IDS.localBodies,
    sourceUrl: url,
    retrievedAt: acquiredAt,
    sourceAsOf: discovered.changedOn,
    snapshotSha256: computeArtifactSetSha256([discovered.metadataSha256, sha256]),
    artifactSha256s: [discovered.metadataSha256, sha256],
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
}

/* ── the whole extract ─────────────────────────────────────────────────── */

export async function acquireLgdDistrictSourceExtract(
  plan: LgdDistrictRefreshPlan,
  acquiredAt: string,
  options: AcquisitionOptions,
): Promise<LgdDistrictSourceExtract> {
  const cache = new ContentAddressedCache(options.cacheDir);
  // The three LGD resources are read one after another: the portal throttles
  // parallel connections. JJM and the Census are other hosts and run beside.
  const lgdSubdistricts = await withSourceContext("LGD sub-districts", () =>
    acquireSubdistricts(plan, acquiredAt, cache),
  );
  const lgdVillages = await withSourceContext("LGD villages", () => acquireVillages(plan, acquiredAt, cache));
  const lgdLocalBodies = await withSourceContext("LGD local bodies", () =>
    acquireLocalBodies(plan, lgdVillages.records, acquiredAt, cache),
  );
  const [jjm, census] = await Promise.all([
    withSourceContext("JJM Citizen Corner", () =>
      acquireJjmEnumeration(
        {
          url: plan.sources.jjm.url,
          stateId: plan.district.jjmStateId,
          districtId: plan.district.jjmDistrictId,
          expectedVillages: plan.expectedCounts.jjmVillages,
        },
        acquiredAt,
        cache,
      ),
    ),
    withSourceContext("Census village amenities", () =>
      acquireCensusVillages(
        {
          url: plan.sources.census.url,
          sourceAsOf: plan.sources.census.sourceAsOf,
          districtCode: plan.district.censusDistrictCode,
          expectedVillages: plan.expectedCounts.censusVillages,
          sheet: plan.district.censusWorkbookSheet,
          allowEmptyGramPanchayat: true,
        },
        acquiredAt,
        cache,
        {
          ...options,
          censusExtractorPath:
            options.censusExtractorPath ??
            resolve(process.cwd(), "scripts/atlas_extract_census_village_amenities.py"),
        },
      ),
    ),
  ]);
  const extract: LgdDistrictSourceExtract = {
    schemaVersion: ATLAS_SCHEMA_VERSION,
    planId: plan.id,
    identityAdapter: LGD_IDENTITY_ADAPTER,
    acquiredAt,
    sources: { lgdSubdistricts, lgdVillages, lgdLocalBodies, jjm, census },
  };
  const errors = validateLgdDistrictSourceExtract(extract);
  if (errors.length > 0) {
    throw new Error(`Acquisition produced an invalid extract:\n- ${errors.join("\n- ")}`);
  }
  return extract;
}

/** The JJM and Census record types are shared with Tamil Nadu; re-exported
 *  so an LGD-adapter caller needs one import. */
export type { CensusVillageRecord, JjmVillageRecord };

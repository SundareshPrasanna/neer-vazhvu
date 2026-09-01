/**
 * JJM citizen-corner village service for one district, served per LGD block
 * as public/data/atlas/<state>/<district>/jjm-service/<blockCode>.json.
 *
 *   npx tsx scripts/atlas-jjm-tn-district.ts --district thanjavur --fetch --as-of 2026-09-01 [--block <lgdBlockCode>] [--limit n] [--delay-ms 400]
 *   npx tsx scripts/atlas-jjm-tn-district.ts --district thanjavur --replay
 *
 * The village enumeration and the JJM-block-to-LGD-block alignment come from
 * the served directory. Three JSON page methods are read per village; this is
 * a public portal, so requests are serial and paced. A partial run (--block,
 * --limit) writes only the blocks it touched and records why it is partial;
 * a full run prunes shards for blocks that no longer exist.
 */
import { computeRecordsSha256 } from "../src/lib/atlas/acquisition-validation";
import {
  districtArtifactPath,
  identityFromDirectory,
  type DistrictDirectoryArtifact,
  type JjmServiceShard,
} from "../src/lib/atlas/artifacts";
import {
  JJM_PAGE_METHODS,
  JJM_SERVICE_SCHEMA_VERSION,
  JJM_SERVICE_SOURCE_ID,
  normalizeJjmVillageService,
  rollUpJjmServiceByGramPanchayat,
  validateJjmServiceRecords,
  validateTnDistrictJjmServiceExtract,
} from "../src/lib/atlas/tn-jjm-service";
import type { JjmVillageService, TnDistrictJjmServiceExtract } from "../src/lib/atlas/tn-jjm-service";
import {
  argValue,
  atlasEnvelope,
  cachePath,
  hasFlag,
  pruneShards,
  readArtifact,
  readCacheJson,
  requireAsOf,
  requireDistrict,
  upstreamSource,
  writeAtlasArtifact,
  writeCache,
} from "./lib/atlas-producer";

const PRODUCED_BY = "scripts/atlas-jjm-tn-district.ts";
const CACHE = "jjm-service.json";
const PAGE_URL = "https://ejalshakti.gov.in/jjm/citizen_corner/VillageInformation.aspx";

interface EnumeratedVillage {
  blockId: string;
  gpId: string;
  villageId: string;
  villageName: string;
  /** LGD block the village's shard belongs to. */
  lgdBlockCode: string;
}

/** Every enumerated JJM village with the LGD block its shard belongs to:
 *  bound villages take their Panchayat's block, unbound ones the aligned block. */
function enumerateVillages(directory: DistrictDirectoryArtifact): EnumeratedVillage[] {
  const blockByJjmId = new Map<string, string>();
  for (const block of directory.blocks) {
    if (block.jjmBlockId) blockByJjmId.set(block.jjmBlockId, block.code);
  }
  const villages: EnumeratedVillage[] = [];
  for (const panchayat of directory.panchayats) {
    if (!panchayat.jjm) continue;
    for (const village of panchayat.jjm.villages) {
      villages.push({
        blockId: panchayat.jjm.blockId,
        gpId: panchayat.jjm.gpId,
        villageId: village.villageId,
        villageName: village.villageName,
        lgdBlockCode: panchayat.blockCode,
      });
    }
  }
  for (const unit of directory.unbound.jjm) {
    const lgdBlockCode = blockByJjmId.get(unit.blockId);
    if (!lgdBlockCode) {
      throw new Error(
        `JJM block ${unit.blockId} (${unit.blockName}) is not aligned to an LGD block; ` +
          "stage a block alignment before acquiring its villages",
      );
    }
    for (const village of unit.villages) {
      villages.push({
        blockId: unit.blockId,
        gpId: unit.gpId,
        villageId: village.villageId,
        villageName: village.villageName,
        lgdBlockCode,
      });
    }
  }
  return villages.sort((left, right) =>
    `${left.blockId}/${left.gpId}/${left.villageId}`.localeCompare(
      `${right.blockId}/${right.gpId}/${right.villageId}`,
    ),
  );
}

async function callPageMethod(method: string, payload: Record<string, string>): Promise<unknown> {
  const response = await fetch(`${PAGE_URL}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Referer: PAGE_URL,
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "neer-vazhvu-atlas/0.1 (research; contact@neervazhvu.org)",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);
  const body = (await response.json()) as { d?: unknown };
  const data = body.d ?? body;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

async function acquire(
  directory: DistrictDirectoryArtifact,
  targets: EnumeratedVillage[],
  allVillages: number,
  asOf: string,
  delayMs: number,
  partialReason: string | null,
): Promise<TnDistrictJjmServiceExtract> {
  const records: JjmVillageService[] = [];
  let failures = 0;
  for (const [index, village] of targets.entries()) {
    const payload = {
      stcode: directory.district.jjmStateId,
      dtcode: directory.district.jjmDistrictId,
      cat: "0",
      subcat: "0",
      param: "0",
      VillageId: village.villageId,
    };
    try {
      const habitations = await callPageMethod(JJM_PAGE_METHODS.habitations, payload);
      const sources = await callPageMethod(JJM_PAGE_METHODS.sources, payload);
      const samples = await callPageMethod(JJM_PAGE_METHODS.samples, payload);
      records.push(normalizeJjmVillageService(village, { habitations, sources, samples }));
    } catch (error) {
      failures += 1;
      console.error(
        `  ${village.villageId} ${village.villageName}: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
    if ((index + 1) % 25 === 0) console.error(`  ...${index + 1}/${targets.length}`);
    if (index + 1 < targets.length) await sleep(delayMs);
  }
  if (failures > 0) console.error(`  ${failures} villages failed and are absent from this run`);
  records.sort((left, right) =>
    `${left.blockId}/${left.gpId}/${left.villageId}`.localeCompare(
      `${right.blockId}/${right.gpId}/${right.villageId}`,
    ),
  );
  const partial = records.length < allVillages;
  return {
    schemaVersion: JJM_SERVICE_SCHEMA_VERSION,
    planId: directory.district.planId,
    jjmStateId: directory.district.jjmStateId,
    jjmDistrictId: directory.district.jjmDistrictId,
    acquiredAt: asOf,
    source: {
      sourceId: JJM_SERVICE_SOURCE_ID,
      sourceUrl: PAGE_URL,
      pageMethods: Object.values(JJM_PAGE_METHODS),
    },
    coverage: {
      villagesInDistrict: allVillages,
      villagesAcquired: records.length,
      partialReason: partial
        ? (partialReason ?? `${allVillages - records.length} villages failed to acquire`)
        : null,
    },
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  const fetchNow = hasFlag(argv, "--fetch");
  const replay = hasFlag(argv, "--replay");
  if (fetchNow === replay) throw new Error("choose exactly one of --fetch or --replay");
  const directory = readArtifact<DistrictDirectoryArtifact>(district, "directory");
  const identity = identityFromDirectory(directory);
  const villages = enumerateVillages(directory);
  const blockOfVillage = new Map(
    villages.map((village) => [
      `${village.blockId}/${village.gpId}/${village.villageId}`,
      village.lgdBlockCode,
    ]),
  );

  let service: TnDistrictJjmServiceExtract;
  let partialRun = false;
  if (fetchNow) {
    const asOf = requireAsOf(argv);
    const block = argValue(argv, "--block");
    const limit = argValue(argv, "--limit");
    let targets = block ? villages.filter((village) => village.lgdBlockCode === block) : villages;
    if (limit !== undefined) targets = targets.slice(0, Number(limit));
    if (targets.length === 0) throw new Error("No villages selected");
    partialRun = targets.length < villages.length;
    service = await acquire(
      directory,
      targets,
      villages.length,
      asOf,
      Number(argValue(argv, "--delay-ms") ?? 400),
      block
        ? `Restricted to LGD block ${block}`
        : limit !== undefined
          ? `Limited to ${targets.length} villages`
          : null,
    );
    if (!partialRun) writeCache(district, CACHE, service);
  } else {
    const cached = readCacheJson<TnDistrictJjmServiceExtract>(district, CACHE);
    if (!cached) {
      throw new Error(`No cached JJM service extract at ${cachePath(district, CACHE)}; run --fetch`);
    }
    service = cached;
  }
  const errors = validateTnDistrictJjmServiceExtract(service, identity);
  if (errors.length > 0) {
    throw new Error(`Invalid JJM service extract:\n- ${errors.join("\n- ")}`);
  }

  const byBlock = new Map<string, JjmVillageService[]>();
  for (const record of service.records) {
    const key = `${record.blockId}/${record.gpId}/${record.villageId}`;
    const blockCode = blockOfVillage.get(key);
    if (!blockCode) throw new Error(`village ${key} has no LGD block`);
    const bucket = byBlock.get(blockCode) ?? [];
    bucket.push(record);
    byBlock.set(blockCode, bucket);
  }
  const enumeratedPerBlock = new Map<string, number>();
  for (const village of villages) {
    enumeratedPerBlock.set(
      village.lgdBlockCode,
      (enumeratedPerBlock.get(village.lgdBlockCode) ?? 0) + 1,
    );
  }
  const jjmBlockOf = new Map(directory.blocks.map((block) => [block.code, block.jjmBlockId]));
  const written = new Set<string>();
  for (const [blockCode, records] of [...byBlock.entries()].sort()) {
    const blockName = identity.blocks.get(blockCode) ?? blockCode;
    const recordErrors = validateJjmServiceRecords(records, identity);
    if (recordErrors.length > 0) {
      throw new Error(`Block ${blockCode}:\n- ${recordErrors.join("\n- ")}`);
    }
    const villagesInBlock = enumeratedPerBlock.get(blockCode) ?? 0;
    const envelope = atlasEnvelope({
      district,
      family: "jjm-service",
      sources: [upstreamSource("jjm", { retrieved: service.acquiredAt })],
      method: "api",
      producedAt: service.acquiredAt,
      producedBy: PRODUCED_BY,
      internalInputs: [districtArtifactPath(district, "directory")],
      note:
        `JJM IMIS citizen-corner village information for ${records.length} of ${villagesInBlock} ` +
        `enumerated villages in ${blockName} block: habitations (population, households, tap ` +
        "connections), drinking-water sources and the displayed water-quality sample rows, " +
        "read from the page's JSON methods BindHabitationInfo, BindSourceInfo and " +
        "BindSampleTestedInfo. Villages are keyed by JJM block/GP/village ids; the directory " +
        "binds JJM GP ids to LGD Gram Panchayat codes.",
      conventions: {
        totals: "per-village totals are sums over habitation rows; null when no row states the figure",
        samples: "sample rows are the portal's displayed set, not a sampling regime; dates converted from dd-mm-yyyy",
        shard: "one file per LGD block; a JJM block aligned to an LGD block places its unbound villages here too",
      },
    });
    const shard: Omit<JjmServiceShard, keyof typeof envelope> = {
      schemaVersion: JJM_SERVICE_SCHEMA_VERSION,
      planId: service.planId,
      blockCode,
      blockName,
      jjmStateId: service.jjmStateId,
      jjmDistrictId: service.jjmDistrictId,
      jjmBlockId: jjmBlockOf.get(blockCode) ?? null,
      acquiredAt: service.acquiredAt,
      source: service.source,
      coverage: {
        villagesInBlock,
        villagesAcquired: records.length,
        partialReason:
          records.length < villagesInBlock
            ? (service.coverage.partialReason ?? "villages missing from the acquisition")
            : null,
      },
      recordsSha256: computeRecordsSha256(records),
      recordCount: records.length,
      records,
    };
    writeAtlasArtifact(district, "jjm-service", blockCode, envelope, shard);
    written.add(blockCode);
  }
  const pruned = partialRun ? [] : pruneShards(district, "jjm-service", written);

  const rollups = rollUpJjmServiceByGramPanchayat(service);
  const covered = rollups.filter((rollup) => rollup.tapCoveragePercent !== null);
  console.log(
    [
      `Wrote ${written.size} jjm-service shards for ${district.slug}` +
        (pruned.length ? ` (pruned ${pruned.join(", ")})` : ""),
      `Villages: ${service.recordCount} of ${service.coverage.villagesInDistrict}` +
        (service.coverage.partialReason ? ` (partial: ${service.coverage.partialReason})` : ""),
      `JJM Gram Panchayats: ${rollups.length}; tap coverage reported for ${covered.length}, ` +
        `${covered.filter((r) => (r.tapCoveragePercent ?? 0) >= 100).length} at 100 percent`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

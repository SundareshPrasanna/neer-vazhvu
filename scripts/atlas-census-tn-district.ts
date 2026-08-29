/**
 * Census 2011 village amenities (water and land-use columns) rolled up to
 * Gram Panchayats, served per LGD block as
 * public/data/atlas/<state>/<district>/census-2011/<blockCode>.json.
 *
 *   npx tsx scripts/atlas-census-tn-district.ts --district thanjavur --workbook <DCHB xlsx> --as-of 2026-09-01
 *   npx tsx scripts/atlas-census-tn-district.ts --district thanjavur --replay
 *
 * The workbook is the DCHB village release the refresh already downloaded
 * (content-addressed under .cache/atlas/<state>/<district>/objects/); the
 * Python extractor streams the district's rows out of it. Which villages
 * belong to which Panchayat comes from the served directory's Census
 * bindings, so identity and payload stay separable.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { computeRecordsSha256 } from "../src/lib/atlas/acquisition-validation";
import {
  districtArtifactPath,
  identityFromDirectory,
  type CensusShard,
  type DistrictDirectoryArtifact,
} from "../src/lib/atlas/artifacts";
import {
  rollUpCensusAttributesByGramPanchayat,
  validateTnDistrictCensusAttributes,
} from "../src/lib/atlas/tn-census-attributes";
import type {
  CensusBinding,
  TnDistrictCensusAttributes,
} from "../src/lib/atlas/tn-census-attributes";
import {
  ROOT,
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
} from "./lib/atlas-producer";

const PRODUCED_BY = "scripts/atlas-census-tn-district.ts";
const CACHE = "census-village-attributes.json";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  const workbook = argValue(argv, "--workbook");
  const replay = hasFlag(argv, "--replay");
  if ((workbook !== undefined) === replay) {
    throw new Error("choose exactly one of --workbook <xlsx> or --replay");
  }
  const directory = readArtifact<DistrictDirectoryArtifact>(district, "directory");
  const identity = identityFromDirectory(directory);

  let attributes: TnDistrictCensusAttributes;
  if (workbook !== undefined) {
    const asOf = requireAsOf(argv);
    const out = cachePath(district, CACHE);
    execFileSync(
      "python3",
      [
        resolve(ROOT, "scripts/atlas_extract_census_village_attributes.py"),
        "--workbook",
        resolve(workbook),
        "--district-code",
        directory.district.censusDistrictCode,
        "--plan-id",
        directory.district.planId,
        "--as-of",
        asOf,
        "--source-url",
        "https://censusindia.gov.in/nada/index.php/catalog/45377",
        "--out",
        out,
      ],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    attributes = readCacheJson<TnDistrictCensusAttributes>(district, CACHE)!;
  } else {
    const cached = readCacheJson<TnDistrictCensusAttributes>(district, CACHE);
    if (!cached) {
      throw new Error(`No cached Census attributes at ${cachePath(district, CACHE)}; run with --workbook`);
    }
    attributes = cached;
  }
  const errors = validateTnDistrictCensusAttributes(attributes, identity);
  if (errors.length > 0) {
    throw new Error(`Invalid Census attribute extract:\n- ${errors.join("\n- ")}`);
  }

  const bindings: CensusBinding[] = directory.panchayats
    .filter((panchayat) => panchayat.census)
    .map((panchayat) => ({
      lgdGramPanchayatCode: panchayat.lgdCode,
      sourceUnitId: panchayat.census!.sourceUnitId,
      villageCodes: panchayat.census!.villages.map((village) => village.villageCode),
    }));
  const rollups = rollUpCensusAttributesByGramPanchayat(attributes, bindings);
  const byVillage = new Map(attributes.records.map((record) => [record.villageCode, record]));
  const byBlock = new Map<string, CensusShard["records"]>();
  for (const rollup of rollups) {
    const blockCode = identity.gramPanchayats.get(rollup.lgdGramPanchayatCode)?.blockCode;
    if (!blockCode) throw new Error(`${rollup.lgdGramPanchayatCode} has no block`);
    const bucket = byBlock.get(blockCode) ?? [];
    bucket.push({
      ...rollup,
      villages: rollup.villageCodes.map((code) => byVillage.get(code)!),
    });
    byBlock.set(blockCode, bucket);
  }
  const boundVillages = new Set(rollups.flatMap((rollup) => rollup.villageCodes));
  const unboundVillages = attributes.recordCount - boundVillages.size;

  const written = new Set<string>();
  for (const [blockCode, records] of [...byBlock.entries()].sort()) {
    const blockName = identity.blocks.get(blockCode) ?? blockCode;
    const envelope = atlasEnvelope({
      district,
      family: "census-2011",
      sources: [
        upstreamSource("census", { role: "input", as_of: "2011", retrieved: attributes.acquiredAt }),
      ],
      method: "derived",
      producedAt: attributes.acquiredAt,
      producedBy: PRODUCED_BY,
      internalInputs: [districtArtifactPath(district, "directory")],
      note:
        `Census 2011 DCHB village amenities for ${records.length} Gram Panchayats in ${blockName} ` +
        "block: land use and irrigation-by-source areas summed over each Panchayat's bound " +
        "Census villages (villages[] carries the source rows), and drinking-water source " +
        "availability combined per Panchayat. Reference year 2009 for the village tables; " +
        "a historical baseline, not current service.",
      conventions: {
        measures: "hectares, summed over constituent villages; null when no village states the figure",
        availability:
          "available when any constituent village reports the source; not-available only when every village does; otherwise not-stated",
        seasonal:
          "sourceTypesLostInSummer lists sources reported for the year but not for April to September - 2009 seasonality, not present reliability",
        bindings: "a Panchayat with no Census binding in the directory has no record here",
      },
    });
    const shard: Omit<CensusShard, keyof typeof envelope> = {
      schemaVersion: attributes.schemaVersion,
      planId: attributes.planId,
      blockCode,
      blockName,
      censusDistrictCode: attributes.censusDistrictCode,
      acquiredAt: attributes.acquiredAt,
      source: attributes.source,
      recordsSha256: computeRecordsSha256(records),
      recordCount: records.length,
      records,
    };
    writeAtlasArtifact(district, "census-2011", blockCode, envelope, shard);
    written.add(blockCode);
  }
  const pruned = pruneShards(district, "census-2011", written);
  console.log(
    [
      `Wrote ${written.size} census-2011 shards for ${district.slug}` +
        (pruned.length ? ` (pruned ${pruned.join(", ")})` : ""),
      `${rollups.length} Gram Panchayats rolled up from ${boundVillages.size} bound villages; ` +
        `${unboundVillages} of ${attributes.recordCount} district villages belong to unbound Census units`,
      `Seasonal loss recorded for ${rollups.filter((r) => r.sourceTypesLostInSummer.length > 0).length} Panchayats`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

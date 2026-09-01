/**
 * First Census of Water Bodies per Gram Panchayat, served per LGD block as
 * public/data/atlas/<state>/<district>/water-bodies/<blockCode>.geojson,
 * for a district whose reviewed plan names the census resource (Satara,
 * Maharashtra, first). The Tamil Nadu districts read TNGIS instead
 * (atlas-water-bodies-tn-district.ts); both write the same family.
 *
 *   npx tsx scripts/atlas-water-bodies-census-district.ts --district satara --as-of 2026-09-01 [--fetch]
 *
 * The census locates each water body in a VILLAGE (its unique_id carries
 * the Census 2011 village code); the directory's LGD coverage register says
 * which Panchayat covers the village. A village under exactly one Panchayat
 * is assigned; a village under two, under none, or unknown to the directory
 * is counted on the block's shard and never pooled. The licence is open
 * (GODL-India), so the recorded coordinates are served as MultiPoint
 * geometry; the attributes follow the plan's judgement (Satara's return is
 * templated, so its waterspread is withheld and only counts, types,
 * ownership and points are published).
 *
 * Fail-closed: the row count must equal the plan's expectation (a closed
 * edition), the assignment rate must hold, and a plan that calls a templated
 * waterspread column "stated" stops the run.
 */
import { readFileSync } from "node:fs";

import { computeRecordsSha256 } from "../src/lib/atlas/acquisition-validation";
import {
  districtArtifactPath,
  identityFromDirectory,
  type DistrictDirectoryArtifact,
  type WaterBodiesShard,
  type WaterBodyFeature,
} from "../src/lib/atlas/artifacts";
import {
  validateLgdDistrictRefreshPlan,
  type LgdDistrictRefreshPlan,
} from "../src/lib/atlas/lgd-acquisition-model";
import {
  discoverResourceExport,
  exportKeyOf,
  patientFetchIntoCache,
} from "../src/lib/atlas/lgd-district-acquisition";
import { ContentAddressedCache, artifactText } from "../src/lib/atlas/tn-district-acquisition";
import {
  buildWaterBodiesCensusExtract,
  parseWaterBodiesCensusRows,
  reportWaterBodiesCensusJoin,
  validateWaterBodiesCensusExtract,
  WATER_BODIES_CENSUS_LICENSE,
  WATER_BODIES_CENSUS_REGISTER,
  type CensusWaterBodyRecord,
} from "../src/lib/atlas/water-bodies-census";
import {
  SOURCE_IDS,
  atlasEnvelope,
  cacheDir,
  cachePath,
  hasFlag,
  planIdentityAdapter,
  pruneShards,
  readArtifact,
  readCacheJson,
  readCacheText,
  requireAsOf,
  requireDistrict,
  reviewedInputPath,
  sha256Hex,
  upstreamSource,
  writeAtlasArtifact,
  writeCache,
} from "./lib/atlas-producer";

const PRODUCED_BY = "scripts/atlas-water-bodies-census-district.ts";
const CACHE = "water-bodies-census.json";
const META = "water-bodies-census.meta.json";
const LISTS_URL = "https://api.data.gov.in/lists";
/** Below this share of rural rows assigned to a Panchayat, the membership
 *  index (or the resource's id scheme) has changed; stop rather than serve a
 *  thinner register as if it were the same one. */
const MIN_ASSIGNMENT_RATE = 0.8;

interface Snapshot {
  body: string;
  url: string;
  sha256: string;
  retrievedAt: string;
  resourceUpdatedOn: string;
}

function keylessQuery(baseUrl: string, districtName: string): string {
  return `${baseUrl}?format=json&limit=all&filters[district_name]=${encodeURIComponent(districtName)}`;
}

async function readSnapshot(options: {
  district: ReturnType<typeof requireDistrict>;
  plan: LgdDistrictRefreshPlan;
  fetchNow: boolean;
  retrievedAt: string;
}): Promise<Snapshot> {
  const { district, plan } = options;
  const source = plan.sources.waterBodiesCensus!;
  const url = keylessQuery(source.url, source.districtName);
  if (!options.fetchNow) {
    const body = readCacheText(district, CACHE);
    const meta = readCacheJson<Omit<Snapshot, "body">>(district, META);
    if (body === undefined || meta === undefined) {
      throw new Error(`No cached census rows (with ${META}) at ${cachePath(district, CACHE)}; re-run with --fetch`);
    }
    return { body, ...meta, sha256: sha256Hex(body) };
  }
  const cache = new ContentAddressedCache(cacheDir(district));
  // The portal's export key comes from the metadata of an LGD resource the
  // plan already names; the census resource's own datafile_url is an S3
  // file the portal refuses without a session.
  const lgdExport = await discoverResourceExport(plan.sources.lgdLocalBodies, cache);
  const key = exportKeyOf(lgdExport.exportUrl);
  const listing = await patientFetchIntoCache(
    cache,
    `${LISTS_URL}?format=json&api-key=${key}&limit=1&filters[index_name]=${source.resourceId}`,
  );
  const listed = JSON.parse(artifactText(listing)) as { records?: Array<{ updated_date?: string }> };
  const updated = listed.records?.[0]?.updated_date;
  if (typeof updated !== "string" || updated.length < 10) {
    throw new Error(`data.gov.in lists no updated_date for resource ${source.resourceId}`);
  }
  const query =
    `${source.url}?api-key=${key}&offset=0&limit=all&format=json` +
    `&filters[district_name]=${encodeURIComponent(source.districtName)}`;
  const response = await patientFetchIntoCache(cache, query);
  const body = artifactText(response);
  const meta = {
    url,
    resourceId: source.resourceId,
    retrievedAt: options.retrievedAt,
    resourceUpdatedOn: updated.slice(0, 10),
    sha256: sha256Hex(body),
  };
  writeCache(district, CACHE, body);
  writeCache(district, META, meta);
  return { body, url, sha256: meta.sha256, retrievedAt: meta.retrievedAt, resourceUpdatedOn: meta.resourceUpdatedOn };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  const asOf = requireAsOf(argv);
  if (planIdentityAdapter(district) !== "lgd-directory") {
    throw new Error(`${district.slug}: a TNRD-built district reads TNGIS, not the census register`);
  }
  const planPath = reviewedInputPath(district, "refresh-plan.json");
  const plan = JSON.parse(readFileSync(planPath, "utf8")) as LgdDistrictRefreshPlan;
  const planErrors = validateLgdDistrictRefreshPlan(plan);
  if (planErrors.length > 0) throw new Error(`Invalid refresh plan ${planPath}:\n- ${planErrors.join("\n- ")}`);
  const source = plan.sources.waterBodiesCensus;
  const expectedRows = plan.expectedCounts.waterBodiesCensusRows;
  if (!source || !expectedRows) {
    console.log(`${district.slug}: the reviewed plan names no water-bodies census resource; nothing to serve`);
    return;
  }
  if (SOURCE_IDS.waterBodiesCensusMh !== `water-bodies-census-${district.stateSlug}`) {
    throw new Error(`no registered census upstream for state ${district.stateSlug}; register one in atlas-producer.ts`);
  }

  const directory = readArtifact<DistrictDirectoryArtifact>(district, "directory");
  const identity = identityFromDirectory(directory);
  const snapshot = await readSnapshot({ district, plan, fetchNow: hasFlag(argv, "--fetch"), retrievedAt: asOf });
  const parsed = JSON.parse(snapshot.body) as { total?: number; count?: number; records?: unknown[] };
  const records = Array.isArray(parsed.records) ? parsed.records : [];
  if (parsed.total !== expectedRows || records.length !== expectedRows) {
    throw new Error(
      `the resource returns ${records.length} rows (total ${parsed.total}) for ${source.districtName}; ` +
        `the plan expects ${expectedRows}. A new edition or a changed filter: review the plan`,
    );
  }
  const rows = parseWaterBodiesCensusRows(records);
  const extract = buildWaterBodiesCensusExtract(rows, directory, {
    planId: directory.district.planId,
    districtLgdCode: directory.district.lgdDistrictCode,
    acquiredAt: snapshot.retrievedAt,
    sourceId: SOURCE_IDS.waterBodiesCensusMh,
    resourceId: source.resourceId,
    sourceUrl: snapshot.url,
    catalogUrl: source.catalogUrl,
    districtName: source.districtName,
    resourceUpdatedOn: snapshot.resourceUpdatedOn,
    snapshotSha256: snapshot.sha256,
    waterspread: source.waterspread,
    waterspreadNote: source.waterspreadNote,
  });
  const errors = validateWaterBodiesCensusExtract(extract, identity);
  if (errors.length > 0) throw new Error(`Invalid water-bodies census extract:\n- ${errors.join("\n- ")}`);
  const report = reportWaterBodiesCensusJoin(extract, identity);
  const assignmentRate = extract.featureCount / Math.max(1, extract.ruralRowCount);
  if (assignmentRate < MIN_ASSIGNMENT_RATE) {
    throw new Error(
      `only ${(assignmentRate * 100).toFixed(1)}% of rural rows join a Panchayat through the LGD coverage register; ` +
        "the resource's unique_id scheme or the coverage register has changed",
    );
  }

  // One shard per block that holds any row, assigned or not, so a block's
  // unassigned count is served even where no Panchayat received a record.
  const blocks = new Set<string>([
    ...extract.records.map((record) => record.lgdBlockCode),
    ...Object.keys(extract.unassignedByBlock),
  ]);
  const written = new Set<string>();
  const empty = { sharedVillage: 0, uncoveredVillage: 0, censusVillageWithoutLgdRow: 0, unknownVillage: 0, urban: 0 };
  for (const blockCode of [...blocks].sort()) {
    const blockName = identity.blocks.get(blockCode);
    if (!blockName) throw new Error(`block ${blockCode} in the census rows is not a block of this district`);
    const blockRecords = extract.records.filter((record) => record.lgdBlockCode === blockCode);
    const features: WaterBodyFeature[] = blockRecords.map((record: CensusWaterBodyRecord) => {
      const { points, ...properties } = record;
      return {
        type: "Feature",
        geometry: points.length > 0 ? { type: "MultiPoint", coordinates: points } : null,
        properties,
      };
    });
    const properties = features.map((feature) => feature.properties);
    const unassigned = extract.unassignedByBlock[blockCode] ?? empty;
    const unassignedTotal = Object.values(unassigned).reduce((total, count) => total + count, 0);
    const featureCount = properties.reduce((total, record) => total + record.count, 0);
    const envelope = atlasEnvelope({
      district,
      family: "water-bodies",
      sources: [upstreamSource("waterBodiesCensusMh", { retrieved: extract.acquiredAt, as_of: extract.source.resourceUpdatedOn })],
      method: "api",
      producedAt: asOf,
      producedBy: PRODUCED_BY,
      internalInputs: [districtArtifactPath(district, "directory")],
      note:
        `First Census of Water Bodies rows for ${blockName} taluka: ${featureCount} water bodies assigned to ` +
        `${properties.length} Gram Panchayats through the LGD coverage register (the census locates each in a ` +
        `Census 2011 village; a village under exactly one Panchayat is assigned), rolled up per Panchayat ` +
        `(count, named count, type and ownership classes, a digest of the sorted names) with the enumerators' ` +
        `coordinates served as MultiPoint geometry under the Government Open Data License. ${unassignedTotal} rows ` +
        `of the taluka are counted and not assigned (ext.atlas.unassigned: a village listed under two Panchayats, ` +
        `under none, a Census village with no LGD row, a town). Waterspread is ${extract.attributes.waterspread}: ` +
        `${extract.attributes.note} A Panchayat absent here has no row in the return.`,
      conventions: {
        geometry: "MultiPoint of the recorded coordinates, five decimals, points outside the district's own bounding box dropped and counted in ext.atlas.pointsOutsideDistrict (a district total)",
        join: "unique_id part 5 is the Census 2011 village code; the directory's LGD coverage register names the Panchayat; shared, uncovered and unknown villages and urban rows are counted in ext.atlas.unassigned, never pooled",
        holder: "byDepartment carries the census ownership class (the register's holder axis); byType the census water-body class",
        vintage: "reference years 2017-18 to 2020-21, published 2023; the portal's resource stamp is the edition watched",
      },
    });
    const ext: WaterBodiesShard["ext"] = {
      atlas: {
        schemaVersion: extract.schemaVersion,
        planId: extract.planId,
        blockCode,
        blockName,
        register: WATER_BODIES_CENSUS_REGISTER,
        districtLgdCode: extract.districtLgdCode,
        acquiredAt: extract.acquiredAt,
        layer: `First Census of Water Bodies, ${district.stateName} return (data.gov.in resource ${extract.source.resourceId})`,
        sourceUrl: extract.source.sourceUrl,
        rights: {
          status: "open",
          termsUrl: extract.source.catalogUrl,
          termsQuote: WATER_BODIES_CENSUS_LICENSE,
          approval: null,
        },
        contributingDepartments: extract.contributingOwners,
        snapshotSha256: extract.snapshotSha256,
        featureCount,
        recordCount: properties.length,
        recordsSha256: computeRecordsSha256(properties),
        unassigned,
        unassignedDistrict: extract.unassigned,
        attributes: { waterspread: extract.attributes.waterspread, note: extract.attributes.note },
        pointsOutsideDistrict: extract.pointsOutsideDistrict,
      },
    };
    writeAtlasArtifact(
      district,
      "water-bodies",
      blockCode,
      { ...envelope, ext },
      { type: "FeatureCollection", features },
      { compact: true },
    );
    written.add(blockCode);
  }
  const pruned = pruneShards(district, "water-bodies", written);
  const fmt = (value: number): string => value.toLocaleString("en-IN");
  console.log(
    [
      `Wrote ${written.size} water-bodies shards for ${district.slug}` + (pruned.length ? ` (pruned ${pruned.join(", ")})` : ""),
      `${fmt(extract.rowCount)} census rows (${fmt(extract.ruralRowCount)} rural, ${fmt(extract.urbanRowCount)} urban); ` +
        `${fmt(report.assignedRows)} assigned to ${report.panchayatsWithWaterBodies}/${report.lgdGramPanchayats} Gram Panchayats ` +
        `(${(assignmentRate * 100).toFixed(1)}% of rural rows); ${report.panchayatsWithout.length} Panchayats with none`,
      `Unassigned: shared village ${extract.unassigned.sharedVillage}, uncovered village ${extract.unassigned.uncoveredVillage}, ` +
        `Census village without LGD row ${extract.unassigned.censusVillageWithoutLgdRow}, unknown ${extract.unassigned.unknownVillage}, urban ${extract.unassigned.urban}`,
      `Points served: ${fmt(report.pointsServed)}; outside the district: ${extract.pointsOutsideDistrict}; ` +
        `types: ${extract.types.map((t) => `${t.type} ${t.count}`).join(", ")}; owners: ${extract.contributingOwners.join(", ")}`,
      `Waterspread ${extract.attributes.waterspread} (${extract.attributes.diagnostic.distinctWaterspreadValues} distinct values over ` +
        `${extract.attributes.diagnostic.ruralRows} rural rows); resource updated ${extract.source.resourceUpdatedOn}`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

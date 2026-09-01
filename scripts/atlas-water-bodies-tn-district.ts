/**
 * TNGIS water bodies per Gram Panchayat, served per LGD block as
 * public/data/atlas/<state>/<district>/water-bodies/<blockCode>.geojson.
 *
 *   npx tsx scripts/atlas-water-bodies-tn-district.ts --district thanjavur --as-of 2026-09-01 [--fetch]
 *
 * The layer states each water body's Gram Panchayat LGD code, so the join is
 * exact or it is a defect. TNGIS restricts public display, redistribution
 * and commercial use to prior approval, and the reuse confirmation asked for
 * on 2026-07-27 has had no reply: every feature therefore carries a null
 * geometry and derived counts, areas and digests only. If an approval is
 * recorded, re-acquire and widen the features then.
 */
import {
  districtArtifactPath,
  identityFromDirectory,
  type DistrictDirectoryArtifact,
  type WaterBodiesShard,
  type WaterBodyFeature,
} from "../src/lib/atlas/artifacts";
import { computeRecordsSha256 } from "../src/lib/atlas/acquisition-validation";
import {
  WATER_BODY_LAYER,
  buildTnDistrictWaterBodyExtract,
  reportWaterBodyJoin,
  validateTnDistrictWaterBodyExtract,
} from "../src/lib/atlas/tn-water-bodies";
import {
  atlasEnvelope,
  hasFlag,
  pruneShards,
  readArtifact,
  readWfsSnapshot,
  requireAsOf,
  requireDistrict,
  upstreamSource,
  writeAtlasArtifact,
} from "./lib/atlas-producer";

const PRODUCED_BY = "scripts/atlas-water-bodies-tn-district.ts";
const CACHE = "tngis-all-water-bodies.json";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  const asOf = requireAsOf(argv);
  const directory = readArtifact<DistrictDirectoryArtifact>(district, "directory");
  const identity = identityFromDirectory(directory);
  // TNGIS keys its layers on TNRD's district code; a directory built by
  // another adapter has no TNGIS layer to read.
  const districtLgdCode = directory.district.tnrdLgdCode;
  if (!districtLgdCode) {
    throw new Error(`${district.slug}: not a TNRD-built directory; TNGIS water bodies do not apply`);
  }

  const snapshot = await readWfsSnapshot({
    district,
    cacheName: CACHE,
    layer: WATER_BODY_LAYER,
    cqlFilter: `rd_lgddcod=${districtLgdCode}`,
    fetchNow: hasFlag(argv, "--fetch"),
    retrievedAt: asOf,
  });
  const parsed = JSON.parse(snapshot.body) as { features?: unknown[] };
  if (!Array.isArray(parsed.features) || parsed.features.length === 0) {
    throw new Error("TNGIS response contained no features");
  }
  const { default: area } = await import("@turf/area");
  const waterBodies = buildTnDistrictWaterBodyExtract(parsed.features as never[], {
    planId: directory.district.planId,
    districtLgdCode,
    acquiredAt: snapshot.retrievedAt,
    sourceUrl: snapshot.url,
    snapshotSha256: snapshot.sha256,
    area: (feature) => area(feature as never),
  });
  const errors = validateTnDistrictWaterBodyExtract(waterBodies, identity);
  if (errors.length > 0) {
    throw new Error(`Invalid water-body extract:\n- ${errors.join("\n- ")}`);
  }
  const report = reportWaterBodyJoin(waterBodies, identity);
  // The join is the whole reason this source is cheap. If it ever degrades,
  // that is a source change worth stopping on rather than a quieter profile.
  const joinRate = report.panchayatsWithWaterBodies / report.lgdGramPanchayats;
  if (joinRate < 0.5) {
    throw new Error(
      `Join covers only ${(joinRate * 100).toFixed(1)}% of Gram Panchayats. ` +
        "The layer's panchayat_lgdvcode column may have changed.",
    );
  }

  const byBlock = new Map<string, WaterBodyFeature[]>();
  for (const record of waterBodies.records) {
    const blockCode = identity.gramPanchayats.get(record.lgdGramPanchayatCode)?.blockCode;
    if (!blockCode) throw new Error(`${record.lgdGramPanchayatCode} has no block`);
    const bucket = byBlock.get(blockCode) ?? [];
    bucket.push({
      type: "Feature",
      geometry: null,
      properties: { ...record, lgdBlockCode: blockCode },
    });
    byBlock.set(blockCode, bucket);
  }

  const written = new Set<string>();
  for (const [blockCode, features] of [...byBlock.entries()].sort()) {
    const blockName = identity.blocks.get(blockCode) ?? blockCode;
    const records = features.map((feature) => feature.properties);
    const envelope = atlasEnvelope({
      district,
      family: "water-bodies",
      sources: [upstreamSource("tngisWaterBodies", { retrieved: waterBodies.acquiredAt })],
      method: "api",
      producedAt: waterBodies.acquiredAt,
      producedBy: PRODUCED_BY,
      internalInputs: [districtArtifactPath(district, "directory")],
      note:
        `TNGIS all-water-bodies register for ${blockName} block: ${features.length} Gram ` +
        `Panchayats with ${records.reduce((total, record) => total + record.count, 0)} ` +
        "water bodies between them, rolled up per Panchayat (count, named count, summed and " +
        "largest waterspread computed from the geometry, contributing departments, a digest of " +
        "the sorted names). Geometry is null and names are withheld: TNGIS terms require prior " +
        "approval for public display or redistribution and the confirmation requested on " +
        "2026-07-27 has no reply. A Panchayat absent here has no water body in the register.",
      conventions: {
        geometry: "null by rule until TNGIS/TNeGA approval is recorded; areas are hectares computed from the withheld polygons",
        join: "panchayat_lgdvcode is the LGD Gram Panchayat code; features with code 0 (towns, corporations) are dropped, never pooled",
        vintage: "the layer merges five departments' registers and carries no survey date",
      },
    });
    const ext: WaterBodiesShard["ext"] = {
      atlas: {
        schemaVersion: waterBodies.schemaVersion,
        planId: waterBodies.planId,
        blockCode,
        blockName,
        districtLgdCode,
        acquiredAt: waterBodies.acquiredAt,
        layer: waterBodies.source.layer,
        sourceUrl: waterBodies.source.sourceUrl,
        rights: {
          status: waterBodies.source.rights.status,
          termsUrl: waterBodies.source.rights.termsUrl,
          termsQuote: waterBodies.source.rights.termsQuote,
          approval: waterBodies.source.rights.approval,
        },
        contributingDepartments: waterBodies.source.contributingDepartments,
        snapshotSha256: waterBodies.snapshotSha256,
        featureCount: records.reduce((total, record) => total + record.count, 0),
        recordCount: records.length,
        recordsSha256: computeRecordsSha256(records),
      },
    };
    writeAtlasArtifact(
      district,
      "water-bodies",
      blockCode,
      { ...envelope, ext },
      { type: "FeatureCollection", features },
    );
    written.add(blockCode);
  }
  const pruned = pruneShards(district, "water-bodies", written);
  console.log(
    [
      `Wrote ${written.size} water-bodies shards for ${district.slug}` +
        (pruned.length ? ` (pruned ${pruned.join(", ")})` : ""),
      `${report.featureCount.toLocaleString("en-IN")} water bodies across ` +
        `${report.panchayatsWithWaterBodies}/${report.lgdGramPanchayats} Gram Panchayats; ` +
        `${report.panchayatsWithout.length} with none; named by the source: ${report.namedFeatures}`,
      `Total waterspread: ${report.totalAreaHectares.toLocaleString("en-IN")} ha; ` +
        `departments: ${waterBodies.source.contributingDepartments.join(", ")}`,
      "Rights: geometry and names withheld pending TNGIS/TNeGA approval.",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

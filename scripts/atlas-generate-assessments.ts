/**
 * Generates the 40-capability assessment and the place brief for every Gram
 * Panchayat in a district from the served artifacts, and writes them per LGD
 * block as public/data/atlas/<state>/<district>/{assessments,briefs}/<blockCode>.json.
 *
 *   npx tsx scripts/atlas-generate-assessments.ts --district thanjavur --as-of 2026-09-01
 *   npx tsx scripts/atlas-generate-assessments.ts --district thanjavur --validate
 *
 * Inputs are the served directory, jjm-service, census-2011, groundwater-taluks,
 * groundwater-projection, rainfall and water-bodies artifacts, read through
 * src/lib/atlas/data.ts (run from the repository root); nothing is fetched.
 * The assembly and the rules live in src/lib/atlas/district-assessment.ts so
 * the tests regenerate the fixture corpus with the same code. --validate runs the whole-corpus assertions (every family joins the
 * directory by LGD code, cardinalities match the reviewed plan, every brief
 * validates, shards partition the blocks) and exits non-zero on any failure.
 */
import { readFileSync } from "node:fs";

import { loadTnDistrictRefreshPlan } from "../src/lib/atlas/acquisition-validation";
import {
  districtArtifactPath,
  identityAdapterOf,
  identityVintage,
  type AssessmentsShard,
  type BriefsShard,
} from "../src/lib/atlas/artifacts";
import type { GeneratedAssessment } from "../src/lib/atlas/capability-evidence";
import {
  generateDistrictAssessments,
  loadDistrictCorpus,
  type DistrictCorpus,
} from "../src/lib/atlas/district-assessment";
import { summarizeBriefs, validatePlaceBrief } from "../src/lib/atlas/place-brief";
import type { PlaceBrief } from "../src/lib/atlas/place-brief";
import {
  atlasEnvelope,
  hasFlag,
  planIdentityAdapter,
  pruneShards,
  requireAsOf,
  requireDistrict,
  reviewedInputPath,
  shardCodes,
  upstreamSource,
  writeAtlasArtifact,
} from "./lib/atlas-producer";
import type { AtlasDistrict } from "../src/lib/atlas/registry";

const PRODUCED_BY = "scripts/atlas-generate-assessments.ts";

function inputSources(corpus: DistrictCorpus, blockCode: string, district: AtlasDistrict) {
  const directory = corpus.directory;
  const lgd = identityAdapterOf(directory) === "lgd-directory";
  const sources = lgd
    ? [
        upstreamSource("lgdLocalBodies", { role: "input", as_of: identityVintage(directory).sourceAsOf, retrieved: directory.acquiredAt }),
        upstreamSource("lgdVillages", { role: "input", retrieved: directory.acquiredAt }),
        upstreamSource("lgdSubdistricts", { role: "input", retrieved: directory.acquiredAt }),
        upstreamSource("jjm", { role: "input", retrieved: directory.acquiredAt }),
        upstreamSource("censusMh", { role: "input", as_of: "2011", retrieved: directory.vintages.census.retrievedAt }),
      ]
    : [
        upstreamSource("tnrdLgd", { role: "input", as_of: "2021-03-11", retrieved: directory.acquiredAt }),
        upstreamSource("tnrdMaster", { role: "input", retrieved: directory.acquiredAt }),
        upstreamSource("jjm", { role: "input", retrieved: directory.acquiredAt }),
        upstreamSource("census", { role: "input", as_of: "2011", retrieved: directory.acquiredAt }),
      ];
  const internalInputs = [districtArtifactPath(district, "directory")];
  if (corpus.jjm.some((shard) => shard.blockCode === blockCode)) {
    internalInputs.push(districtArtifactPath(district, "jjm-service", blockCode));
  }
  if (corpus.census.some((shard) => shard.blockCode === blockCode)) {
    internalInputs.push(districtArtifactPath(district, "census-2011", blockCode));
  }
  if (corpus.groundwater && corpus.projection) {
    sources.push(upstreamSource(lgd ? "ingresMh" : "ingres", { role: "input", retrieved: corpus.groundwater.acquiredAt }));
    internalInputs.push(districtArtifactPath(district, "groundwater-taluks"));
    internalInputs.push(districtArtifactPath(district, "groundwater-projection"));
  }
  if (corpus.rainfall) {
    sources.push(upstreamSource("openMeteo", { role: "input", retrieved: corpus.rainfall.acquiredAt }));
    internalInputs.push(districtArtifactPath(district, "rainfall"));
  }
  const waterShard = corpus.waterBodies.find((shard) => shard.ext.atlas.blockCode === blockCode);
  if (waterShard) {
    sources.push(
      upstreamSource("tngisWaterBodies", { role: "input", retrieved: waterShard.ext.atlas.acquiredAt }),
    );
    internalInputs.push(districtArtifactPath(district, "water-bodies", blockCode));
  }
  if (directory.vintages.boundary) {
    sources.push(
      upstreamSource(lgd ? "datameetMh" : "tngisBoundary", {
        role: "input",
        retrieved: directory.vintages.boundary.retrievedAt,
      }),
    );
  }
  return { sources, internalInputs };
}

/** The Panchayat count the reviewed plan expects, from either plan shape. */
function expectedGramPanchayats(district: AtlasDistrict): number {
  const path = reviewedInputPath(district, "refresh-plan.json");
  if (planIdentityAdapter(district) === "lgd-directory") {
    const plan = JSON.parse(readFileSync(path, "utf8")) as { expectedCounts: { lgdGramPanchayats: number } };
    return plan.expectedCounts.lgdGramPanchayats;
  }
  return loadTnDistrictRefreshPlan(path).expectedCounts.tnrdLgdGramPanchayats;
}

function validateCorpus(district: AtlasDistrict): void {
  const expected = expectedGramPanchayats(district);
  const { corpus, errors } = loadDistrictCorpus(district);
  const { directory, identity } = corpus;
  if (directory.panchayats.length !== expected) {
    errors.push(`directory: ${directory.panchayats.length} Gram Panchayats, plan expects ${expected}`);
  }
  // Every family shard must sit in a block the directory lists, and the
  // GP-grain families must cover the directory exactly once.
  const blockCodes = new Set(directory.blocks.map((block) => block.code));
  for (const family of ["jjm-service", "census-2011", "water-bodies", "assessments", "briefs"] as const) {
    for (const code of shardCodes(district, family)) {
      if (!blockCodes.has(code)) errors.push(`${family}/${code}: not a block of this district`);
    }
  }
  const briefs = corpus.briefs;
  const briefIds = briefs.flatMap((shard) => shard.briefs.map((brief) => brief.placeId));
  if (new Set(briefIds).size !== briefIds.length) errors.push("briefs: a Gram Panchayat has more than one brief");
  for (const code of identity.gramPanchayats.keys()) {
    if (!briefIds.includes(code)) errors.push(`briefs: ${code} has no brief`);
  }
  for (const shard of briefs) {
    for (const brief of shard.briefs) {
      if (brief.blockCode !== shard.blockCode) errors.push(`briefs/${shard.blockCode}: ${brief.placeId} is in the wrong shard`);
      errors.push(...validatePlaceBrief(brief).map((e) => `briefs/${shard.blockCode}/${brief.placeId}: ${e}`));
    }
  }
  const assessments = corpus.assessments;
  const assessed = assessments.flatMap((shard) => shard.assessments.map((a) => a.placeId));
  if (assessed.length !== identity.gramPanchayats.size) {
    errors.push(`assessments: ${assessed.length} assessments for ${identity.gramPanchayats.size} Gram Panchayats`);
  }
  if (corpus.rainfall) {
    const withCentroid = directory.panchayats.filter((p) => p.boundary).length;
    if (corpus.rainfall.recordCount !== withCentroid) {
      errors.push(`rainfall: ${corpus.rainfall.recordCount} records for ${withCentroid} Panchayats with a centroid`);
    }
  }
  if (corpus.projection) {
    const accounted = corpus.projection.records.length + corpus.projection.review.length;
    if (accounted !== identity.gramPanchayats.size) {
      errors.push(`groundwater-projection: ${accounted} accounted for ${identity.gramPanchayats.size}`);
    }
  }
  const acquiredVillages = corpus.jjm.reduce((total, shard) => total + shard.recordCount, 0);
  if (acquiredVillages !== identity.jjmVillagePaths.size) {
    errors.push(`jjm-service: ${acquiredVillages} villages acquired of ${identity.jjmVillagePaths.size} enumerated`);
  }
  if (errors.length > 0) {
    console.error(`${district.slug}: ${errors.length} problem(s)`);
    for (const error of errors) console.error(`  ${error}`);
    process.exit(1);
  }
  const summary = summarizeBriefs(briefs.flatMap((shard) => shard.briefs));
  console.log(
    `${district.slug}: corpus valid. ${identity.gramPanchayats.size} Gram Panchayats, ` +
      `${summary.briefReady} brief-ready, ${summary.directoryOnly} directory-only; ` +
      `${acquiredVillages} JJM villages, ${corpus.census.reduce((t, s) => t + s.recordCount, 0)} Census rollups, ` +
      `${corpus.waterBodies.reduce((t, s) => t + s.ext.atlas.featureCount, 0)} water bodies`,
  );
}

function main(): void {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  if (hasFlag(argv, "--validate")) {
    validateCorpus(district);
    return;
  }
  const assessedAt = requireAsOf(argv);
  const { corpus, errors } = loadDistrictCorpus(district);
  if (errors.length > 0) {
    throw new Error(`Served inputs are inconsistent:\n- ${errors.join("\n- ")}`);
  }
  const run = generateDistrictAssessments(corpus, assessedAt);
  const { assessments, briefs } = run;

  const byBlock = new Map<string, { assessments: GeneratedAssessment[]; briefs: PlaceBrief[] }>();
  for (const [index, brief] of briefs.entries()) {
    const bucket = byBlock.get(brief.blockCode) ?? { assessments: [], briefs: [] };
    bucket.assessments.push(assessments[index]);
    bucket.briefs.push(brief);
    byBlock.set(brief.blockCode, bucket);
  }
  const written = new Set<string>();
  for (const [blockCode, bucket] of [...byBlock.entries()].sort()) {
    const blockName = corpus.identity.blocks.get(blockCode) ?? blockCode;
    const { sources, internalInputs } = inputSources(corpus, blockCode, district);
    const assessmentEnvelope = atlasEnvelope({
      district,
      family: "assessments",
      sources,
      method: "derived",
      producedAt: assessedAt,
      producedBy: PRODUCED_BY,
      internalInputs,
      note:
        `${run.profileId}: ${bucket.assessments.length} Gram Panchayats in ${blockName} block assessed ` +
        "against 40 capabilities by the evidence rules in src/lib/atlas/capability-evidence.ts " +
        `(${bucket.assessments[0]?.generatorVersion}). Each requirement records its state ` +
        "(adequate, unavailable, not-applicable, not-assessed), the evidence with its locality " +
        "class and projection method, and limitations. A capability with no rule is reported " +
        "unavailable rather than guessed; an undetermined applicability is not-assessed rather " +
        "than a gap.",
      conventions: {
        locality:
          "direct-place | within-place | connected-system | containing-area | nearby-observation | derived-place: how close the evidence is to the place; groundwater is always containing-area (revenue taluk)",
        projection:
          "direct-published | identifier-crosswalk | spatial-intersection | administrative-proxy | interpolation | service-relation: the relation between the evidence unit and the Panchayat",
      },
    });
    const assessmentShard: Omit<AssessmentsShard, keyof typeof assessmentEnvelope> = {
      schemaVersion: 1,
      planId: corpus.directory.district.planId,
      blockCode,
      blockName,
      profileId: run.profileId,
      assessedAt,
      generatorVersion: bucket.assessments[0]?.generatorVersion ?? "",
      requirementIds: run.requirementIds,
      recordCount: bucket.assessments.length,
      assessments: bucket.assessments,
    };
    writeAtlasArtifact(district, "assessments", blockCode, assessmentEnvelope, assessmentShard);

    const briefEnvelope = atlasEnvelope({
      district,
      family: "briefs",
      sources,
      method: "derived",
      producedAt: assessedAt,
      producedBy: PRODUCED_BY,
      internalInputs: [...internalInputs, districtArtifactPath(district, "assessments", blockCode)],
      note:
        `Place briefs for ${bucket.briefs.length} Gram Panchayats in ${blockName} block: the verdict ` +
        "derived from the tension between tap coverage and the containing taluk's groundwater " +
        "category, headline facts each carrying their caveat, the named capability gaps, and the " +
        "detail behind them (habitations, sources, sampling, land, seasonal sources, boundary, " +
        "rainfall, water bodies). Briefs fail closed: a place must hold identity, population and " +
        "drinking-water service before it gets a verdict; otherwise it is directory-only and " +
        "publishes no numbers.",
      conventions: {
        status: "brief-ready | directory-only; a directory-only brief carries no verdict and no headline facts by rule",
        tone: "positive | warning | neutral | blocked, the same vocabulary the district page uses",
        groundwater: "every taluk-grain figure says it describes the taluk, not the Panchayat",
      },
    });
    const briefShard: Omit<BriefsShard, keyof typeof briefEnvelope> = {
      schemaVersion: 1,
      planId: corpus.directory.district.planId,
      blockCode,
      blockName,
      assessedAt,
      recordCount: bucket.briefs.length,
      briefs: bucket.briefs,
    };
    writeAtlasArtifact(district, "briefs", blockCode, briefEnvelope, briefShard);
    written.add(blockCode);
  }
  const pruned = [
    ...pruneShards(district, "assessments", written),
    ...pruneShards(district, "briefs", written),
  ];

  const summary = summarizeBriefs(briefs);
  const adequateCounts = assessments.map((assessment) => assessment.summary.adequate);
  const mean = adequateCounts.reduce((total, value) => total + value, 0) / Math.max(1, adequateCounts.length);
  console.log(
    [
      `Wrote ${written.size} assessments and ${written.size} briefs shards for ${district.slug}` +
        (pruned.length ? ` (pruned ${pruned.join(", ")})` : ""),
      `Briefs: ${summary.briefReady} ready, ${summary.directoryOnly} held as directory-only`,
      `Verdict tone: ${Object.entries(summary.byTone)
        .sort()
        .map(([tone, count]) => `${tone} ${count}`)
        .join(", ")}`,
      `Adequate capabilities per Panchayat: mean ${mean.toFixed(2)} of ${run.requirementIds.length}`,
      `Commonest gaps: ${summary.commonestGaps.map((gap) => `${gap.capabilityId} (${gap.places})`).join(", ")}`,
    ].join("\n"),
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

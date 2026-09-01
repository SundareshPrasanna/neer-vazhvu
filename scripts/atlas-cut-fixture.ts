/**
 * Cuts the unit-test fixture for an LGD-built district: one taluka, sliced to
 * a handful of Gram Panchayats, under fixtures/atlas/<state>/<district>/.
 *
 *   npx tsx scripts/atlas-cut-fixture.ts --district satara --block 4264 --panchayats 15 --keep 189960
 *
 * The fixture is what src/lib/atlas/test-support.ts reads: the served
 * families (directory, groundwater-taluks, groundwater-projection, rainfall,
 * curated-briefs, and the block's jjm-service, census-2011, boundaries,
 * assessments and briefs shards) plus the mini acquisition inputs the
 * directory was built from (refresh-plan, source-extract, block-alignment,
 * crosswalk-resolution, boundary-extract). Every served family is sliced
 * from the district's served artifacts with its counts and digests
 * recomputed; the directory is REBUILT from the mini inputs by the same
 * builder the producer uses, then checked against the served slice, so the
 * refresh test's "served equals rebuilt" assertion holds by construction.
 * Regenerate, never hand-edit. --keep names Panchayats that must be in the
 * slice (a reviewed plan target, for example).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { computeRecordsSha256 } from "../src/lib/atlas/acquisition-validation";
import type {
  AssessmentsShard,
  BoundariesShard,
  BriefsShard,
  CensusShard,
  DistrictDirectoryArtifact,
  GroundwaterProjectionArtifact,
  JjmServiceShard,
  RainfallArtifact,
} from "../src/lib/atlas/artifacts";
import type { DataMeetBoundaryExtract } from "../src/lib/atlas/datameet-boundary";
import type { LgdDistrictRefreshPlan, LgdDistrictSourceExtract } from "../src/lib/atlas/lgd-acquisition-model";
import { buildLgdDistrictDirectoryPayload, crosswalkExtractOf } from "../src/lib/atlas/lgd-district-refresh";
import { buildTnDistrictCrosswalk, loadReviewedBlockAlignmentTable, type ReviewedBlockAlignmentTable } from "../src/lib/atlas/tn-crosswalk";
import { buildCanonicalCrosswalk, type TnDistrictCrosswalkResolution } from "../src/lib/atlas/tn-crosswalk-resolution";
import type { TnDistrictSourceExtract } from "../src/lib/atlas/acquisition-model";
import {
  ROOT,
  argValue,
  planIdentityAdapter,
  readArtifact,
  readCacheJson,
  requireDistrict,
  reviewedInputPath,
} from "./lib/atlas-producer";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main(): void {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  if (planIdentityAdapter(district) !== "lgd-directory") {
    throw new Error("this cutter is for LGD-built districts; the Tamil Nadu fixtures predate it");
  }
  const blockCode = argValue(argv, "--block");
  if (!blockCode) throw new Error("--block <lgd sub-district code> is required");
  const size = Number(argValue(argv, "--panchayats") ?? "15");
  const keep = (argValue(argv, "--keep") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const out = resolve(ROOT, "fixtures/atlas", district.stateSlug, district.slug);

  const plan = readJson<LgdDistrictRefreshPlan>(reviewedInputPath(district, "refresh-plan.json"));
  const extract = readCacheJson<LgdDistrictSourceExtract>(district, "source-extract.json");
  const boundary = readCacheJson<DataMeetBoundaryExtract>(district, "datameet-boundary-extract.json");
  if (!extract) throw new Error("no cached source-extract.json; run the identity refresh first");
  const directory = readArtifact<DistrictDirectoryArtifact>(district, "directory");

  // The slice: the block's Panchayats in served order, the kept ones first.
  const inBlock = directory.panchayats.filter((p) => p.blockCode === blockCode);
  if (inBlock.length === 0) throw new Error(`no Panchayats in block ${blockCode}`);
  const kept = inBlock.filter((p) => keep.includes(p.lgdCode));
  if (kept.length !== keep.length) throw new Error(`--keep names Panchayats outside block ${blockCode}`);
  const chosen = [...kept, ...inBlock.filter((p) => !keep.includes(p.lgdCode))].slice(0, size);
  const codes = new Set(chosen.map((p) => p.lgdCode));
  const villageCodes = new Set(chosen.flatMap((p) => p.lgdCoverage?.villages.map((v) => v.villageCode) ?? []));
  const census2011 = new Set(chosen.flatMap((p) => p.lgdCoverage?.villages.map((v) => v.census2011Code) ?? []));
  const jjmUnits = new Set(chosen.map((p) => p.jjm?.sourceUnitId).filter((id): id is string => !!id));

  // Mini extract: the sources restricted to what the slice needs.
  const filterSet = <T>(set: LgdDistrictSourceExtract["sources"]["lgdVillages"], records: T[]) => ({
    ...set,
    records,
    recordCount: records.length,
    recordsSha256: computeRecordsSha256(records),
  });
  const miniExtract: LgdDistrictSourceExtract = {
    ...extract,
    sources: {
      lgdSubdistricts: filterSet(
        extract.sources.lgdSubdistricts as never,
        extract.sources.lgdSubdistricts.records.filter((r) => r.subdistrictCode === blockCode),
      ) as never,
      lgdVillages: filterSet(
        extract.sources.lgdVillages as never,
        extract.sources.lgdVillages.records.filter((r) => villageCodes.has(r.villageCode)),
      ) as never,
      lgdLocalBodies: filterSet(
        extract.sources.lgdLocalBodies as never,
        extract.sources.lgdLocalBodies.records.filter((r) => codes.has(r.localBodyCode)),
      ) as never,
      jjm: filterSet(
        extract.sources.jjm as never,
        extract.sources.jjm.records.filter((r) => jjmUnits.has(`${r.blockId}/${r.gpId}`)),
      ) as never,
      census: filterSet(
        extract.sources.census as never,
        extract.sources.census.records.filter((r) => census2011.has(r.villageCode)),
      ) as never,
    },
  };
  const miniPlan: LgdDistrictRefreshPlan = {
    ...plan,
    expectedCounts: {
      lgdSubdistricts: miniExtract.sources.lgdSubdistricts.recordCount,
      lgdVillages: miniExtract.sources.lgdVillages.recordCount,
      lgdGramPanchayats: codes.size,
      lgdCoverageRows: miniExtract.sources.lgdLocalBodies.recordCount,
      jjmVillages: miniExtract.sources.jjm.recordCount,
      censusVillages: miniExtract.sources.census.recordCount,
    },
    targets: plan.targets.filter((t) => codes.has(t.lgdGramPanchayatCode)),
  };
  if (miniPlan.targets.length === 0) throw new Error("the slice holds no reviewed target; pass --keep <code>");

  // Crosswalk inputs restricted to the block, then the directory rebuilt.
  const crosswalkExtract: TnDistrictSourceExtract = crosswalkExtractOf(miniPlan, miniExtract);
  const alignmentPath = reviewedInputPath(district, "block-alignment.json");
  const alignment = existsSync(alignmentPath) ? readJson<ReviewedBlockAlignmentTable>(alignmentPath) : undefined;
  const miniAlignment = alignment
    ? { ...alignment, alignments: alignment.alignments.filter((a) => a.lgdBlockCode === blockCode) }
    : undefined;
  const reviewedBlockAlignments = miniAlignment
    ? loadReviewedBlockAlignmentTable(writeTemp(out, "block-alignment.json", miniAlignment), crosswalkExtract).alignments
    : undefined;
  const proposal = buildTnDistrictCrosswalk(crosswalkExtract, {
    id: `${district.slug}-crosswalk-v1`,
    proposedAt: miniExtract.acquiredAt,
    reviewedBlockAlignments,
  });
  const resolutionPath = reviewedInputPath(district, "crosswalk-resolution.json");
  const resolution = existsSync(resolutionPath) ? readJson<TnDistrictCrosswalkResolution>(resolutionPath) : undefined;
  const deferred = new Set(proposal.jjm.review.sourceUnits.map((e) => e.sourceUnitId));
  const miniResolution = resolution
    ? {
        ...resolution,
        sourceRecordDigests: proposal.sourceRecordDigests,
        decisions: resolution.decisions.filter((d) => deferred.has(d.sourceUnitId)),
      }
    : undefined;
  const canonical = buildCanonicalCrosswalk(proposal, miniResolution ? [miniResolution] : []);
  const miniBoundary: DataMeetBoundaryExtract | undefined = boundary
    ? (() => {
        const records = boundary.records.filter((r) => codes.has(r.lgdGramPanchayatCode));
        return {
          ...boundary,
          records,
          recordCount: records.length,
          recordsSha256: computeRecordsSha256(records),
          panchayatsWithoutGeometry: boundary.panchayatsWithoutGeometry.filter((c) => codes.has(c)),
        };
      })()
    : undefined;
  const payload = buildLgdDistrictDirectoryPayload({
    district,
    plan: miniPlan,
    extract: miniExtract,
    proposal,
    canonical,
    boundary: miniBoundary,
  });
  const rebuiltCodes = payload.panchayats.map((p) => p.lgdCode).sort();
  if (JSON.stringify(rebuiltCodes) !== JSON.stringify([...codes].sort())) {
    throw new Error("the rebuilt mini directory does not hold the chosen Panchayats");
  }
  const { nvdm, dataset, scope, provenance } = directory;
  const miniDirectory: DistrictDirectoryArtifact = { nvdm, dataset, scope, provenance, ...payload } as DistrictDirectoryArtifact;

  rmSync(out, { recursive: true, force: true });
  writeJson(resolve(out, "refresh-plan.json"), miniPlan);
  writeJson(resolve(out, "source-extract.json"), miniExtract);
  if (miniAlignment) writeJson(resolve(out, "block-alignment.json"), miniAlignment);
  if (miniResolution) writeJson(resolve(out, "crosswalk-resolution.json"), miniResolution);
  if (miniBoundary) writeJson(resolve(out, "boundary-extract.json"), miniBoundary);
  writeJson(resolve(out, "directory.json"), miniDirectory);

  // Served whole-district families, sliced to the chosen Panchayats.
  const groundwater = readArtifact<Record<string, unknown>>(district, "groundwater-taluks");
  writeJson(resolve(out, "groundwater-taluks.json"), groundwater);
  const projection = readArtifact<GroundwaterProjectionArtifact>(district, "groundwater-projection");
  const projected = projection.records.filter((r) => codes.has(r.lgdGramPanchayatCode));
  const deferredProjection = projection.review.filter((r) => codes.has(r.lgdGramPanchayatCode));
  const byCategory: Record<string, number> = {};
  for (const r of projected) byCategory[r.category ?? "not-stated"] = (byCategory[r.category ?? "not-stated"] ?? 0) + 1;
  writeJson(resolve(out, "groundwater-projection.json"), {
    ...projection,
    records: projected,
    review: deferredProjection,
    recordCount: projected.length,
    recordsSha256: computeRecordsSha256(projected),
    summary: {
      ...projection.summary,
      gramPanchayats: codes.size,
      projected: projected.length,
      deferred: deferredProjection.length,
      byCategory,
      blocksSpanningTaluks: 0,
      talukCoverage: new Set(projected.map((r) => r.talukName)).size,
    },
  });
  const rainfallPath = resolve(ROOT, "public/data/atlas", district.stateSlug, district.slug, "rainfall.json");
  if (existsSync(rainfallPath)) {
    const rainfall = readJson<RainfallArtifact>(rainfallPath);
    const records = rainfall.records.filter((r) => codes.has(r.lgdGramPanchayatCode));
    writeJson(resolve(out, "rainfall.json"), {
      ...rainfall,
      records,
      recordCount: records.length,
      recordsSha256: computeRecordsSha256(records),
    });
  }
  const curatedPath = resolve(ROOT, "public/data/atlas", district.stateSlug, district.slug, "curated-briefs.json");
  if (existsSync(curatedPath)) writeJson(resolve(out, "curated-briefs.json"), readJson(curatedPath));

  // The block's shards, sliced to the chosen Panchayats.
  const shard = <T>(family: string): T | undefined => {
    const ext = family === "boundaries" ? "geojson" : "json";
    const path = resolve(ROOT, "public/data/atlas", district.stateSlug, district.slug, family, `${blockCode}.${ext}`);
    return existsSync(path) ? readJson<T>(path) : undefined;
  };
  const jjm = shard<JjmServiceShard>("jjm-service");
  if (jjm) {
    const gpIds = new Set(chosen.map((p) => p.jjm?.gpId).filter(Boolean));
    const records = jjm.records.filter((r) => gpIds.has(r.gpId));
    writeJson(resolve(out, "jjm-service", `${blockCode}.json`), {
      ...jjm,
      coverage: { ...jjm.coverage, villagesInBlock: records.length, villagesAcquired: records.length },
      records,
      recordCount: records.length,
      recordsSha256: computeRecordsSha256(records),
    });
  }
  const census = shard<CensusShard>("census-2011");
  if (census) {
    const records = census.records.filter((r) => codes.has(r.lgdGramPanchayatCode));
    writeJson(resolve(out, "census-2011", `${blockCode}.json`), {
      ...census,
      records,
      recordCount: records.length,
      recordsSha256: computeRecordsSha256(records),
    });
  }
  const boundaries = shard<BoundariesShard>("boundaries");
  if (boundaries) {
    const features = boundaries.features.filter((f) => codes.has(f.properties.lgdCode));
    writeJson(resolve(out, "boundaries", `${blockCode}.geojson`), {
      ...boundaries,
      features,
      ext: { atlas: { ...boundaries.ext.atlas, featureCount: features.length } },
    });
  }
  const assessments = shard<AssessmentsShard>("assessments");
  if (assessments) {
    const list = assessments.assessments.filter((a) => codes.has(a.placeId));
    writeJson(resolve(out, "assessments", `${blockCode}.json`), { ...assessments, assessments: list, recordCount: list.length });
  }
  const briefs = shard<BriefsShard>("briefs");
  if (briefs) {
    const list = briefs.briefs.filter((b) => codes.has(b.placeId));
    writeJson(resolve(out, "briefs", `${blockCode}.json`), { ...briefs, briefs: list, recordCount: list.length });
  }
  console.log(
    `Cut fixtures/atlas/${district.stateSlug}/${district.slug}: block ${blockCode}, ${codes.size} Panchayats ` +
      `(${miniExtract.sources.jjm.recordCount} JJM villages, ${miniExtract.sources.census.recordCount} Census rows, ` +
      `${miniBoundary?.recordCount ?? 0} boundaries)`,
  );
}

/** The alignment loader validates against a file on disk; the mini table is
 *  written where the fixture will keep it. */
function writeTemp(out: string, name: string, value: unknown): string {
  const path = resolve(out, name);
  writeJson(path, value);
  return path;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

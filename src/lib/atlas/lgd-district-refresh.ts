/**
 * Builds the served district directory for a district whose identity master
 * is the Local Government Directory (lgd-acquisition-model.ts), from the
 * acquisition extract, the JJM crosswalk (machine proposal plus reviewed
 * resolution), the reviewed refresh plan and, where drawn, the DataMeet
 * boundary extract.
 *
 * The output is the same DistrictDirectoryArtifact Tamil Nadu serves, so
 * every downstream producer and page reads it unchanged. What differs is
 * where each field comes from:
 *   - Gram Panchayats and their names: the LGD Local Bodies register.
 *   - Blocks: the LGD sub-districts (talukas), where the state's Panchayat
 *     Samitis are coterminous with them; a Panchayat's block is the taluka
 *     its covered villages sit in.
 *   - JJM binding: the name crosswalk within a block, as in Tamil Nadu.
 *   - Census composition: the villages the LGD register lists under the
 *     Panchayat, joined to the Census 2011 rows by the register's own 2011
 *     code. The Maharashtra Census release has no Panchayat column, so this
 *     is the only composition there is, and it is authoritative but partial
 *     (the register names one covering village for most Panchayats).
 *
 * Fail-closed like the TNRD builder: counts must agree with the reviewed
 * plan, every reviewed target must resolve by identifier, and a Panchayat
 * whose villages span more than one taluka is placed in the taluka holding
 * most of them and recorded as spanning.
 */
import type {
  AcquiredSourceRecordSet,
  CensusVillageRecord,
  JjmVillageRecord,
  TnDistrictSourceExtract,
  TnrdLgdGramPanchayatRecord,
} from "./acquisition-model";
import { ATLAS_SCHEMA_VERSION } from "./acquisition-model";
import { computeRecordsSha256 } from "./acquisition-validation";
import type {
  DirectoryBlock,
  DirectoryBoundary,
  DirectoryComposition,
  DirectoryPanchayat,
  DistrictDirectoryArtifact,
} from "./artifacts";
import type { DataMeetBoundaryExtract } from "./datameet-boundary";
import {
  validateLgdDistrictRefreshPlan,
  validateLgdDistrictSourceExtract,
  type LgdDistrictRefreshPlan,
  type LgdDistrictRefreshTarget,
  type LgdDistrictSourceExtract,
  type LgdLocalBodyCoverageRecord,
} from "./lgd-acquisition-model";
import type { AtlasDistrict } from "./registry";
import { collectJjmSourceUnits } from "./tn-crosswalk";
import type { TnDistrictCrosswalkProposal } from "./tn-crosswalk";
import type { CanonicalCrosswalk } from "./tn-crosswalk-resolution";
import type { DirectoryPayload } from "./tn-district-refresh";
import { findJjmRecordsForTarget } from "./tn-district-refresh";

/** The match class an LGD coverage binding carries: the register itself
 *  states the village belongs to the Panchayat, so no name was matched. */
export const LGD_COVERAGE_MATCH_CLASS = "lgd-coverage";

export interface LgdGramPanchayat {
  lgdCode: string;
  name: string;
  nameLocal: string;
  /** The taluka (block) most of its covered villages sit in. */
  subdistrictCode: string;
  subdistrictName: string;
  spansSubdistricts: boolean;
  coverage: LgdLocalBodyCoverageRecord[];
}

/**
 * The Panchayat list of the district: one record per local body, its block
 * decided by its covered villages. A Panchayat covering villages in two
 * talukas goes to the taluka holding more of them (ties: the lower code),
 * and says so.
 */
export function collectLgdGramPanchayats(extract: LgdDistrictSourceExtract): LgdGramPanchayat[] {
  const subdistrictOfVillage = new Map(
    extract.sources.lgdVillages.records.map((village) => [village.villageCode, village.subdistrictCode]),
  );
  const subdistrictName = new Map(
    extract.sources.lgdSubdistricts.records.map((row) => [row.subdistrictCode, row.subdistrictName]),
  );
  const byCode = new Map<string, LgdLocalBodyCoverageRecord[]>();
  for (const row of extract.sources.lgdLocalBodies.records) {
    const bucket = byCode.get(row.localBodyCode) ?? [];
    bucket.push(row);
    byCode.set(row.localBodyCode, bucket);
  }
  const panchayats: LgdGramPanchayat[] = [];
  for (const [code, coverage] of byCode) {
    const votes = new Map<string, number>();
    for (const row of coverage) {
      const subdistrict = subdistrictOfVillage.get(row.entityCode);
      if (!subdistrict) throw new Error(`Panchayat ${code} covers ${row.entityCode}, which has no taluka`);
      votes.set(subdistrict, (votes.get(subdistrict) ?? 0) + 1);
    }
    const [winner] = [...votes.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "en", { numeric: true }),
    )[0];
    panchayats.push({
      lgdCode: code,
      name: coverage[0].localBodyName,
      nameLocal: coverage[0].localBodyNameLocal,
      subdistrictCode: winner,
      subdistrictName: subdistrictName.get(winner) ?? winner,
      spansSubdistricts: votes.size > 1,
      coverage: [...coverage].sort((left, right) =>
        left.entityCode.localeCompare(right.entityCode, "en", { numeric: true }),
      ),
    });
  }
  return panchayats.sort((left, right) => left.lgdCode.localeCompare(right.lgdCode, "en", { numeric: true }));
}

/**
 * The identity list in the shape the crosswalk machinery matches against:
 * the crosswalk was written for TNRD's LGD list and needs district, block
 * and Panchayat codes with names, which the LGD register supplies directly.
 * The block is the taluka.
 */
export function lgdRecordsForCrosswalk(
  plan: LgdDistrictRefreshPlan,
  panchayats: LgdGramPanchayat[],
): TnrdLgdGramPanchayatRecord[] {
  return panchayats.map((panchayat) => ({
    districtCode: plan.district.lgdDistrictCode,
    districtName: plan.district.displayName,
    blockCode: panchayat.subdistrictCode,
    blockName: panchayat.subdistrictName,
    gramPanchayatCode: panchayat.lgdCode,
    gramPanchayatName: panchayat.name,
  }));
}

export function assertLgdPlanMatchesExtract(
  plan: LgdDistrictRefreshPlan,
  extract: LgdDistrictSourceExtract,
): void {
  const errors = [
    ...validateLgdDistrictRefreshPlan(plan).map((error) => `plan: ${error}`),
    ...validateLgdDistrictSourceExtract(extract).map((error) => `source extract: ${error}`),
  ];
  if (extract.planId !== plan.id) errors.push(`planId: expected ${plan.id}, got ${extract.planId}`);
  const counts = {
    lgdSubdistricts: extract.sources.lgdSubdistricts.records.length,
    lgdVillages: extract.sources.lgdVillages.records.length,
    lgdGramPanchayats: new Set(extract.sources.lgdLocalBodies.records.map((row) => row.localBodyCode)).size,
    lgdCoverageRows: extract.sources.lgdLocalBodies.records.length,
    jjmVillages: extract.sources.jjm.records.length,
    censusVillages: extract.sources.census.records.length,
  };
  for (const [name, value] of Object.entries(counts)) {
    const expected = plan.expectedCounts[name as keyof typeof counts];
    if (value !== expected) errors.push(`expectedCounts.${name}: expected ${expected}, got ${value}`);
  }
  for (const record of extract.sources.jjm.records) {
    if (record.stateId !== plan.district.jjmStateId || record.districtId !== plan.district.jjmDistrictId) {
      errors.push(`JJM parent mismatch on village ${record.villageId}`);
    }
  }
  for (const record of extract.sources.census.records) {
    if (record.districtCode !== plan.district.censusDistrictCode) {
      errors.push(`Census district mismatch on village ${record.villageCode}`);
    }
  }
  if (errors.length > 0) throw new Error(`Refresh inputs do not agree:\n- ${errors.join("\n- ")}`);
}

interface ReviewedTargetResolution {
  target: LgdDistrictRefreshTarget;
  panchayat: LgdGramPanchayat;
  jjm: JjmVillageRecord[];
  census: CensusVillageRecord[];
}

/** Every reviewed target must resolve by identifier: the Panchayat code in
 *  the register, its JJM unit in the enumeration, and each reviewed member
 *  village both in the register's coverage and in the Census rows. */
export function resolveLgdReviewedTargets(
  plan: LgdDistrictRefreshPlan,
  extract: LgdDistrictSourceExtract,
  panchayats: LgdGramPanchayat[],
): Map<string, ReviewedTargetResolution> {
  assertLgdPlanMatchesExtract(plan, extract);
  const byCode = new Map(panchayats.map((panchayat) => [panchayat.lgdCode, panchayat]));
  const censusByCode = new Map(extract.sources.census.records.map((record) => [record.villageCode, record]));
  const census2011Of = new Map(
    extract.sources.lgdVillages.records.map((village) => [village.villageCode, village.villageCensus2011Code]),
  );
  const resolved = new Map<string, ReviewedTargetResolution>();
  for (const target of plan.targets) {
    const panchayat = byCode.get(target.lgdGramPanchayatCode);
    if (!panchayat) throw new Error(`${target.id}: Panchayat ${target.lgdGramPanchayatCode} is not in the LGD register`);
    if (panchayat.subdistrictCode !== target.lgdSubdistrictCode) {
      throw new Error(
        `${target.id}: reviewed taluka ${target.lgdSubdistrictCode}, register places it in ${panchayat.subdistrictCode}`,
      );
    }
    const jjm = findJjmRecordsForTarget(extract.sources.jjm.records, target.jjmBlockId, target.jjmGramPanchayatId);
    if (jjm.length === 0) throw new Error(`${target.id}: reviewed JJM GP has no enumerated villages`);
    const expectation = target.mappingExpectations.jjm;
    if (expectation.status === "complete" && jjm.length !== expectation.expectedRecordCount) {
      throw new Error(`${target.id} JJM mapping: expected ${expectation.expectedRecordCount}, found ${jjm.length}`);
    }
    const coveredCensusCodes = panchayat.coverage
      .map((row) => census2011Of.get(row.entityCode) ?? "")
      .filter((code) => code.length > 0);
    const census: CensusVillageRecord[] = [];
    for (const member of target.censusComposition.members) {
      if (member.kind !== "village") continue;
      if (!coveredCensusCodes.includes(member.code)) {
        throw new Error(`${target.id}: reviewed member ${member.code} is not a village the register lists under this Panchayat`);
      }
      const record = censusByCode.get(member.code);
      if (!record) throw new Error(`${target.id}: reviewed member ${member.code} has no Census 2011 row`);
      if (record.subdistrictCode !== target.censusSubdistrictCode) {
        throw new Error(`${target.id}: member ${member.code} sits in Census sub-district ${record.subdistrictCode}`);
      }
      census.push(record);
    }
    const censusExpectation = target.mappingExpectations.census;
    if (censusExpectation.status === "complete" && census.length !== censusExpectation.expectedRecordCount) {
      throw new Error(`${target.id} Census mapping: expected ${censusExpectation.expectedRecordCount}, found ${census.length}`);
    }
    resolved.set(target.lgdGramPanchayatCode, { target, panchayat, jjm, census });
  }
  return resolved;
}

/** The LGD Panchayat list, JJM enumeration and an empty Census axis, in the
 *  shape buildTnDistrictCrosswalk matches. */
export function crosswalkExtractOf(
  plan: LgdDistrictRefreshPlan,
  extract: LgdDistrictSourceExtract,
): TnDistrictSourceExtract {
  const records = lgdRecordsForCrosswalk(plan, collectLgdGramPanchayats(extract));
  const identity: AcquiredSourceRecordSet<(typeof records)[number]> = {
    sourceId: "tnrd-lgd-village-panchayat-list",
    sourceUrl: extract.sources.lgdLocalBodies.sourceUrl,
    retrievedAt: extract.sources.lgdLocalBodies.retrievedAt,
    sourceAsOf: extract.sources.lgdLocalBodies.sourceAsOf,
    snapshotSha256: extract.sources.lgdLocalBodies.snapshotSha256,
    artifactSha256s: extract.sources.lgdLocalBodies.artifactSha256s,
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
  const census: AcquiredSourceRecordSet<never> = {
    sourceId: "census-2011-village-amenities",
    sourceUrl: extract.sources.census.sourceUrl,
    retrievedAt: extract.sources.census.retrievedAt,
    sourceAsOf: extract.sources.census.sourceAsOf,
    snapshotSha256: extract.sources.census.snapshotSha256,
    artifactSha256s: extract.sources.census.artifactSha256s,
    recordsSha256: computeRecordsSha256([]),
    recordCount: 0,
    records: [],
  };
  return {
    schemaVersion: ATLAS_SCHEMA_VERSION,
    planId: extract.planId,
    acquiredAt: extract.acquiredAt,
    sources: {
      tnrdLgd: identity,
      // The crosswalk only reads the identity list, JJM and Census; the
      // master slot is the identity list again so the shape validates.
      tnrdMaster: ((): TnDistrictSourceExtract["sources"]["tnrdMaster"] => {
        const master = records.map((record) => ({
          districtLocalCode: record.districtCode,
          districtName: record.districtName,
          blockLocalCode: record.blockCode,
          blockName: record.blockName,
          gramPanchayatLocalCode: record.gramPanchayatCode,
          gramPanchayatName: record.gramPanchayatName,
        }));
        return {
          ...identity,
          sourceId: "tnrd-current-panchayat-master",
          recordsSha256: computeRecordsSha256(master),
          records: master,
        };
      })(),
      jjm: extract.sources.jjm,
      census,
    },
  };
}

function bboxCentre(bbox: [number, number, number, number]): [number, number] {
  return [Number(((bbox[0] + bbox[2]) / 2).toFixed(6)), Number(((bbox[1] + bbox[3]) / 2).toFixed(6))];
}

function vintage(source: AcquiredSourceRecordSet<unknown>) {
  return { sourceAsOf: source.sourceAsOf, retrievedAt: source.retrievedAt, recordCount: source.recordCount };
}

export function buildLgdDistrictDirectoryPayload(options: {
  district: AtlasDistrict;
  plan: LgdDistrictRefreshPlan;
  extract: LgdDistrictSourceExtract;
  proposal: TnDistrictCrosswalkProposal;
  canonical: CanonicalCrosswalk;
  boundary?: DataMeetBoundaryExtract;
}): DirectoryPayload {
  const { district, plan, extract, proposal, canonical, boundary } = options;
  const panchayats = collectLgdGramPanchayats(extract);
  const reviewed = resolveLgdReviewedTargets(plan, extract, panchayats);
  if (canonical.planId !== plan.id || proposal.planId !== plan.id) {
    throw new Error("crosswalk and plan describe different districts");
  }
  const byCode = new Map(panchayats.map((panchayat) => [panchayat.lgdCode, panchayat]));
  const villages = new Map(extract.sources.lgdVillages.records.map((village) => [village.villageCode, village]));
  const censusByCode = new Map(extract.sources.census.records.map((record) => [record.villageCode, record]));

  const jjmVillagesByUnit = new Map<string, JjmVillageRecord[]>();
  for (const record of extract.sources.jjm.records) {
    const key = `${record.blockId}/${record.gpId}`;
    const bucket = jjmVillagesByUnit.get(key) ?? [];
    bucket.push(record);
    jjmVillagesByUnit.set(key, bucket);
  }
  const jjmUnits = new Map(collectJjmSourceUnits(extract.sources.jjm.records).map((unit) => [unit.id, unit]));
  const boundaryByCode = new Map<string, DirectoryBoundary>();
  for (const record of boundary?.records ?? []) {
    boundaryByCode.set(record.lgdGramPanchayatCode, {
      type: record.type,
      areaHectares: record.areaHectares,
      centroid: bboxCentre(record.bbox),
      bbox: record.bbox,
      geometrySha256: record.geometrySha256,
      ringCount: record.ringCount,
      vertexCount: record.vertexCount,
    });
  }

  const boundJjmUnits = new Set<string>();
  const coveredVillages = new Set<string>();
  let censusBound = 0;
  const records: DirectoryPanchayat[] = canonical.records.map((record) => {
    const panchayat = byCode.get(record.lgdGramPanchayatCode);
    if (!panchayat) throw new Error(`crosswalk names ${record.lgdGramPanchayatCode}, which the register does not list`);
    const target = reviewed.get(record.lgdGramPanchayatCode);

    const jjmBinding = record.jjm
      ? ((): DirectoryPanchayat["jjm"] => {
          const unit = jjmUnits.get(record.jjm.sourceUnitId);
          if (!unit) throw new Error(`JJM unit ${record.jjm.sourceUnitId} is not in the extract`);
          boundJjmUnits.add(unit.id);
          return {
            sourceUnitId: unit.id,
            blockId: unit.blockId,
            gpId: unit.id.split("/")[1],
            gpName: unit.name,
            matchClass: record.jjm.matchClass,
            status: record.jjm.status === "verified" ? "verified" : "proposed",
            villages: (jjmVillagesByUnit.get(unit.id) ?? []).map((village) => ({
              villageId: village.villageId,
              villageName: village.villageName,
            })),
          };
        })()
      : null;

    // Census composition through the register: each covered village's 2011
    // code names its Census row. A covered village with no 2011 code (created
    // after the Census) stays in lgdCoverage but cannot join a Census row.
    const coverage = panchayat.coverage.map((row) => {
      const village = villages.get(row.entityCode);
      coveredVillages.add(row.entityCode);
      return {
        villageCode: row.entityCode,
        villageName: village?.villageName ?? row.entityName,
        census2011Code: village?.villageCensus2011Code ?? "",
        coverageType: row.coverageType,
      };
    });
    const censusVillages = coverage
      .map((item) => censusByCode.get(item.census2011Code))
      .filter((row): row is CensusVillageRecord => row !== undefined);
    const censusBinding: DirectoryPanchayat["census"] =
      censusVillages.length > 0
        ? {
            sourceUnitId: `lgd/${panchayat.lgdCode}`,
            cdBlockCode: censusVillages[0].cdBlocks[0]?.code ?? "",
            gramPanchayatCode: panchayat.lgdCode,
            gramPanchayatName: panchayat.name,
            matchClass: LGD_COVERAGE_MATCH_CLASS,
            status: "proposed",
            villages: censusVillages.map((row) => ({
              villageCode: row.villageCode,
              villageName: row.villageName,
              subdistrictCode: row.subdistrictCode,
            })),
          }
        : null;
    if (censusBinding) censusBound += 1;

    const composition: DirectoryComposition = target
      ? {
          status: "reviewed",
          completeness: target.target.censusComposition.status,
          basis: target.target.censusComposition.basis,
          reviewedAt: target.target.reviewedAt,
          members: target.target.censusComposition.members,
          exclusions: target.target.censusComposition.exclusions,
        }
      : censusBinding
        ? {
            status: "crosswalk",
            completeness: "unknown",
            basis: "authoritative-crosswalk",
            reviewedAt: null,
            members: censusBinding.villages.map((village) => ({
              kind: "village" as const,
              code: village.villageCode,
              name: village.villageName,
            })),
            exclusions: [],
          }
        : {
            status: "unbound",
            completeness: "unknown",
            basis: null,
            reviewedAt: null,
            members: [],
            exclusions: [],
          };

    return {
      lgdCode: panchayat.lgdCode,
      name: panchayat.name,
      ...(panchayat.nameLocal ? { nameLocal: panchayat.nameLocal } : {}),
      blockCode: panchayat.subdistrictCode,
      blockName: panchayat.subdistrictName,
      tnrdMaster: null,
      lgdCoverage: { villages: coverage },
      jjm: jjmBinding,
      census: censusBinding,
      composition,
      boundary: boundaryByCode.get(panchayat.lgdCode) ?? null,
    };
  });
  records.sort((left, right) => left.lgdCode.localeCompare(right.lgdCode));

  const panchayatsPerBlock = new Map<string, number>();
  for (const record of records) {
    panchayatsPerBlock.set(record.blockCode, (panchayatsPerBlock.get(record.blockCode) ?? 0) + 1);
  }
  const alignment = new Map(proposal.blocks.map((block) => [block.lgdBlockCode, block]));
  // The Census CD block of a taluka is read from the Census rows themselves
  // (every village row names its CD block), joined through the LGD's own
  // Census 2011 sub-district code; the crosswalk's Census axis is empty here.
  const cdBlockBySubdistrict = new Map<string, Map<string, { code: string; name: string; votes: number }>>();
  for (const record of extract.sources.census.records) {
    const bucket = cdBlockBySubdistrict.get(record.subdistrictCode) ?? new Map();
    for (const cdBlock of record.cdBlocks) {
      const entry = bucket.get(cdBlock.code) ?? { code: cdBlock.code, name: cdBlock.name, votes: 0 };
      entry.votes += 1;
      bucket.set(cdBlock.code, entry);
    }
    cdBlockBySubdistrict.set(record.subdistrictCode, bucket);
  }
  const blocks: DirectoryBlock[] = extract.sources.lgdSubdistricts.records
    .map((row) => {
      const aligned = alignment.get(row.subdistrictCode);
      const cdBlocks = [...(cdBlockBySubdistrict.get(row.subdistrictCensus2011Code)?.values() ?? [])].sort(
        (left, right) => right.votes - left.votes || left.code.localeCompare(right.code),
      );
      return {
        code: row.subdistrictCode,
        name: row.subdistrictName,
        jjmBlockId: aligned?.jjmBlockId ?? null,
        jjmBlockName: aligned?.jjmBlockName ?? null,
        censusCdBlockCode: cdBlocks[0]?.code ?? null,
        censusCdBlockName: cdBlocks[0]?.name ?? null,
        panchayatCount: panchayatsPerBlock.get(row.subdistrictCode) ?? 0,
      };
    })
    .sort((left, right) => left.code.localeCompare(right.code));
  const blockCodes = new Set(blocks.map((block) => block.code));
  for (const record of records) {
    if (!blockCodes.has(record.blockCode)) {
      throw new Error(`Gram Panchayat ${record.lgdCode} sits in taluka ${record.blockCode}, which the register does not list`);
    }
  }

  const uncoveredVillages = extract.sources.lgdVillages.records
    .filter((village) => !coveredVillages.has(village.villageCode))
    .map((village) => ({
      villageCode: village.villageCode,
      villageName: village.villageName,
      census2011Code: village.villageCensus2011Code,
      subdistrictCode: village.subdistrictCode,
      censusRow: censusByCode.has(village.villageCensus2011Code),
    }));
  const lgdCensusCodes = new Set(
    extract.sources.lgdVillages.records.map((village) => village.villageCensus2011Code).filter(Boolean),
  );
  const censusVillagesWithoutLgdRow = extract.sources.census.records
    .filter((record) => !lgdCensusCodes.has(record.villageCode))
    .map((record) => ({
      villageCode: record.villageCode,
      villageName: record.villageName,
      subdistrictCode: record.subdistrictCode,
    }));

  const byMatchClass = { ...canonical.summary.byMatchClass };
  if (censusBound > 0) byMatchClass[LGD_COVERAGE_MATCH_CLASS] = censusBound;
  const bothBound = records.filter((record) => record.jjm && record.census).length;
  const unbound = records.filter((record) => !record.jjm && !record.census).length;

  return {
    schemaVersion: ATLAS_SCHEMA_VERSION,
    district: {
      slug: district.slug,
      name: plan.district.displayName,
      stateSlug: district.stateSlug,
      stateName: district.stateName,
      planId: plan.id,
      identityAdapter: "lgd-directory",
      jjmStateId: plan.district.jjmStateId,
      jjmDistrictId: plan.district.jjmDistrictId,
      censusDistrictCode: plan.district.censusDistrictCode,
      lgdDistrictCode: plan.district.lgdDistrictCode,
      lgdStateCode: plan.district.lgdStateCode,
      ingresDistrictName: plan.district.ingresDistrictName,
      ingresStateName: plan.district.ingresStateName,
      ingresAssessmentUnitType: plan.district.ingresAssessmentUnitType,
      blockModel: plan.district.blockModel,
    },
    acquiredAt: extract.acquiredAt,
    vintages: {
      // The identity master is the Panchayat list; the register's coverage
      // rows (one per Panchayat-village pair) are a second count beside it.
      lgdLocalBodies: { ...vintage(extract.sources.lgdLocalBodies), recordCount: records.length },
      lgdCoverage: vintage(extract.sources.lgdLocalBodies),
      lgdVillages: vintage(extract.sources.lgdVillages),
      lgdSubdistricts: vintage(extract.sources.lgdSubdistricts),
      jjm: vintage(extract.sources.jjm),
      census: vintage(extract.sources.census),
      boundary: boundary
        ? {
            layer: boundary.source.layer,
            retrievedAt: boundary.source.retrievedAt,
            recordCount: boundary.recordCount,
            sourceId: boundary.source.sourceId,
            license: boundary.source.rights.license,
            publicGeometry: true,
          }
        : null,
    },
    crosswalk: {
      proposalId: canonical.proposalId,
      foldingVersion: canonical.foldingVersion,
      matchProcedureVersion: canonical.matchProcedureVersion,
      resolutionIds: canonical.resolutionIds,
      summary: {
        lgdGramPanchayats: records.length,
        jjmBound: canonical.summary.jjmBound,
        censusBound,
        bothBound,
        unbound,
        verifiedBindings: canonical.summary.verifiedBindings,
        proposedBindings: canonical.summary.proposedBindings + censusBound,
        byMatchClass,
      },
    },
    blocks,
    panchayats: records,
    uncoveredVillages,
    censusVillagesWithoutLgdRow,
    unbound: {
      jjm: [...jjmUnits.values()]
        .filter((unit) => !boundJjmUnits.has(unit.id))
        .map((unit) => ({
          sourceUnitId: unit.id,
          blockId: unit.blockId,
          blockName: unit.blockName,
          gpId: unit.id.split("/")[1],
          gpName: unit.name,
          villages: (jjmVillagesByUnit.get(unit.id) ?? []).map((village) => ({
            villageId: village.villageId,
            villageName: village.villageName,
          })),
        })),
      // The Census has no Panchayat units in this state; nothing to leave unbound.
      census: [],
    },
  };
}

export type { DistrictDirectoryArtifact };

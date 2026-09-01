/**
 * Builds the served district directory from the acquisition extract, the
 * crosswalk (machine proposal plus reviewed resolution), the reviewed refresh
 * plan and, where acquired, the TNGIS boundary extract.
 *
 * Fail-closed rules carried over from the July resolver: the plan and the
 * extract must agree on every count and identifier, and a reviewed target's
 * Census composition must match what the extract actually enumerates. A
 * drifted count stops the run; nothing is reconciled silently.
 */
import type {
  AcquiredSourceRecordSet,
  CensusVillageRecord,
  JjmVillageRecord,
  TnDistrictRefreshPlan,
  TnDistrictRefreshTarget,
  TnDistrictSourceExtract,
  TnrdLgdGramPanchayatRecord,
  TnrdMasterGramPanchayatRecord,
} from "./acquisition-model";
import { ATLAS_SCHEMA_VERSION } from "./acquisition-model";
import {
  validateTnDistrictRefreshPlan,
  validateTnDistrictSourceExtract,
} from "./acquisition-validation";
import type {
  AtlasEnvelope,
  DirectoryBlock,
  DirectoryBoundary,
  DirectoryComposition,
  DirectoryPanchayat,
  DistrictDirectoryArtifact,
} from "./artifacts";
import { identityVintage } from "./artifacts";
import type { AtlasDistrict } from "./registry";
import type { TnDistrictBoundaryExtract } from "./tn-boundary";
import { collectCensusSourceUnits, collectJjmSourceUnits } from "./tn-crosswalk";
import type { TnDistrictCrosswalkProposal } from "./tn-crosswalk";
import type { CanonicalCrosswalk } from "./tn-crosswalk-resolution";

export type DirectoryPayload = Omit<DistrictDirectoryArtifact, keyof AtlasEnvelope>;

function assertObservedCardinality(
  target: TnDistrictRefreshTarget,
  sourceName: "JJM" | "Census",
  observedRecordCount: number,
  expectation: TnDistrictRefreshTarget["mappingExpectations"]["jjm"],
): void {
  if (
    expectation.status === "complete" &&
    observedRecordCount !== expectation.expectedRecordCount
  ) {
    throw new Error(
      `${target.id} ${sourceName} mapping: reviewed complete expectation is ` +
        `${expectation.expectedRecordCount}, found ${observedRecordCount}`,
    );
  }
  if (
    expectation.status === "partial" &&
    expectation.expectedRecordCount !== undefined &&
    observedRecordCount >= expectation.expectedRecordCount
  ) {
    throw new Error(
      `${target.id} ${sourceName} mapping: reviewed partial expectation requires ` +
        `fewer than ${expectation.expectedRecordCount} records, found ` +
        observedRecordCount,
    );
  }
}

function exactlyOne<T>(records: T[], label: string): T {
  if (records.length !== 1) {
    throw new Error(`${label}: expected exactly one record, found ${records.length}`);
  }
  return records[0];
}

export function assertPlanMatchesExtract(
  plan: TnDistrictRefreshPlan,
  extract: TnDistrictSourceExtract,
): void {
  const errors = [
    ...validateTnDistrictRefreshPlan(plan).map((error) => `plan: ${error}`),
    ...validateTnDistrictSourceExtract(extract).map(
      (error) => `source extract: ${error}`,
    ),
  ];
  if (extract.planId !== plan.id) {
    errors.push(`planId: expected ${plan.id}, got ${extract.planId}`);
  }
  const expectedSources: Array<
    [string, AcquiredSourceRecordSet<unknown>, string]
  > = [
    ["tnrdLgd", extract.sources.tnrdLgd, plan.sources.tnrdLgdPdf.url],
    ["tnrdMaster", extract.sources.tnrdMaster, plan.sources.tnrdMaster.url],
    ["jjm", extract.sources.jjm, plan.sources.jjm.url],
    ["census", extract.sources.census, plan.sources.census.url],
  ];
  for (const [name, source, expectedUrl] of expectedSources) {
    if (source.sourceUrl !== expectedUrl) {
      errors.push(`${name}.sourceUrl: expected ${expectedUrl}, got ${source.sourceUrl}`);
    }
  }

  const counts = {
    tnrdLgdGramPanchayats: extract.sources.tnrdLgd.records.length,
    tnrdMasterBlocks: new Set(
      extract.sources.tnrdMaster.records.map((record) => record.blockLocalCode),
    ).size,
    tnrdMasterGramPanchayats: extract.sources.tnrdMaster.records.length,
    jjmVillages: extract.sources.jjm.records.length,
    censusVillages: extract.sources.census.records.length,
  };
  for (const [name, value] of Object.entries(counts)) {
    const expected = plan.expectedCounts[name as keyof typeof counts];
    if (value !== expected) {
      errors.push(`expectedCounts.${name}: expected ${expected}, got ${value}`);
    }
  }

  for (const record of extract.sources.tnrdLgd.records) {
    if (record.districtCode !== plan.district.tnrdLgdCode) {
      errors.push(
        `tnrdLgd district mismatch: expected ${plan.district.tnrdLgdCode}, ` +
          `got ${record.districtCode}`,
      );
    }
  }
  for (const record of extract.sources.tnrdMaster.records) {
    if (record.districtLocalCode !== plan.district.tnrdMasterCode) {
      errors.push(
        `tnrdMaster district mismatch: expected ${plan.district.tnrdMasterCode}, ` +
          `got ${record.districtLocalCode}`,
      );
    }
  }
  for (const record of extract.sources.jjm.records) {
    if (
      record.stateId !== plan.district.jjmStateId ||
      record.districtId !== plan.district.jjmDistrictId
    ) {
      errors.push(
        `JJM parent mismatch on village ${record.villageId}: expected ` +
          `${plan.district.jjmStateId}/${plan.district.jjmDistrictId}`,
      );
    }
  }
  for (const record of extract.sources.census.records) {
    if (record.districtCode !== plan.district.censusDistrictCode) {
      errors.push(
        `Census district mismatch on village ${record.villageCode}: expected ` +
          plan.district.censusDistrictCode,
      );
    }
  }
  if (errors.length > 0) {
    throw new Error(`Refresh inputs do not agree:\n- ${errors.join("\n- ")}`);
  }
}

function assertReviewedCensusComposition(
  target: TnDistrictRefreshTarget,
  rawCensusRecords: CensusVillageRecord[],
  eligibleCensusRecords: CensusVillageRecord[],
): void {
  const rawCodes = new Set(rawCensusRecords.map((record) => record.villageCode));
  const eligibleCodes = new Set(
    eligibleCensusRecords.map((record) => record.villageCode),
  );
  const reviewedVillageMembers = target.censusComposition.members.filter(
    (member) => member.kind === "village",
  );
  const reviewedMemberCodes = new Set(
    reviewedVillageMembers.map((member) => member.code),
  );

  for (const exclusion of target.censusComposition.exclusions) {
    if (exclusion.kind === "village" && !rawCodes.has(exclusion.code)) {
      throw new Error(
        `${target.id} Census composition: excluded village ${exclusion.code} ` +
          "was not present in the legacy Census GP row set",
      );
    }
  }
  for (const record of eligibleCensusRecords) {
    if (!reviewedMemberCodes.has(record.villageCode)) {
      throw new Error(
        `${target.id} Census composition: eligible village ${record.villageCode} ` +
          "is missing from the reviewed member set",
      );
    }
  }
  for (const member of reviewedVillageMembers) {
    if (!eligibleCodes.has(member.code)) {
      throw new Error(
        `${target.id} Census composition: reviewed village ${member.code} ` +
          "is not present in the eligible legacy Census row set",
      );
    }
  }
}

export interface ReviewedTargetResolution {
  target: TnDistrictRefreshTarget;
  tnrdLgd: TnrdLgdGramPanchayatRecord;
  tnrdMaster: TnrdMasterGramPanchayatRecord;
  jjm: JjmVillageRecord[];
  census: CensusVillageRecord[];
}

/**
 * Checks every reviewed plan target against the extract by identifier, never
 * by name similarity, and returns what each target resolved to. Keyed by LGD
 * Gram Panchayat code.
 */
export function resolveReviewedTargets(
  plan: TnDistrictRefreshPlan,
  extract: TnDistrictSourceExtract,
): Map<string, ReviewedTargetResolution> {
  assertPlanMatchesExtract(plan, extract);
  const resolved = new Map<string, ReviewedTargetResolution>();
  for (const target of plan.targets) {
    const tnrdLgd = exactlyOne(
      extract.sources.tnrdLgd.records.filter(
        (record) =>
          record.gramPanchayatCode === target.tnrdLgdGramPanchayatCode,
      ),
      `${target.id} TNRD LGD mapping`,
    );
    const tnrdMaster = exactlyOne(
      extract.sources.tnrdMaster.records.filter(
        (record) =>
          record.blockLocalCode === target.tnrdMasterBlockCode &&
          record.gramPanchayatLocalCode ===
            target.tnrdMasterGramPanchayatCode,
      ),
      `${target.id} TNRD current-master mapping`,
    );
    const jjm = findJjmRecordsForTarget(
      extract.sources.jjm.records,
      target.jjmBlockId,
      target.jjmGramPanchayatId,
    );
    if (jjm.length === 0) {
      throw new Error(`${target.id}: reviewed JJM GP has no enumerated villages`);
    }
    const rawCensus = findCensusRecordsForTarget(
      extract.sources.census.records,
      target.censusSubdistrictCode,
      target.censusGramPanchayatCode,
    );
    const excludedCensusVillageCodes = new Set(
      target.censusComposition.exclusions
        .filter((exclusion) => exclusion.kind === "village")
        .map((exclusion) => exclusion.code),
    );
    const census = rawCensus.filter(
      (record) => !excludedCensusVillageCodes.has(record.villageCode),
    );
    assertReviewedCensusComposition(target, rawCensus, census);
    assertObservedCardinality(target, "JJM", jjm.length, target.mappingExpectations.jjm);
    assertObservedCardinality(
      target,
      "Census",
      census.length,
      target.mappingExpectations.census,
    );
    resolved.set(target.tnrdLgdGramPanchayatCode, {
      target,
      tnrdLgd,
      tnrdMaster,
      jjm,
      census,
    });
  }
  return resolved;
}

export function findJjmRecordsForTarget(
  records: JjmVillageRecord[],
  blockId: string,
  gpId: string,
): JjmVillageRecord[] {
  return records.filter(
    (record) => record.blockId === blockId && record.gpId === gpId,
  );
}

export function findCensusRecordsForTarget(
  records: CensusVillageRecord[],
  subdistrictCode: string,
  gramPanchayatCode: string,
): CensusVillageRecord[] {
  return records.filter(
    (record) =>
      record.subdistrictCode === subdistrictCode &&
      record.gramPanchayats.some(
        (gramPanchayat) => gramPanchayat.code === gramPanchayatCode,
      ),
  );
}

function bboxCentre(bbox: [number, number, number, number]): [number, number] {
  return [
    Number(((bbox[0] + bbox[2]) / 2).toFixed(6)),
    Number(((bbox[1] + bbox[3]) / 2).toFixed(6)),
  ];
}

/**
 * The directory payload (everything but the NVDM envelope, which the
 * producer adds). One record per LGD Gram Panchayat; blocks partition them;
 * source units nothing is bound to are kept under `unbound` so the
 * enumeration stays complete.
 */
export function buildDistrictDirectoryPayload(options: {
  district: AtlasDistrict;
  plan: TnDistrictRefreshPlan;
  extract: TnDistrictSourceExtract;
  proposal: TnDistrictCrosswalkProposal;
  canonical: CanonicalCrosswalk;
  boundary?: TnDistrictBoundaryExtract;
}): DirectoryPayload {
  const { district, plan, extract, proposal, canonical, boundary } = options;
  const reviewed = resolveReviewedTargets(plan, extract);
  if (canonical.planId !== plan.id || proposal.planId !== plan.id) {
    throw new Error("crosswalk and plan describe different districts");
  }

  const jjmVillagesByUnit = new Map<string, JjmVillageRecord[]>();
  for (const record of extract.sources.jjm.records) {
    const key = `${record.blockId}/${record.gpId}`;
    const bucket = jjmVillagesByUnit.get(key) ?? [];
    bucket.push(record);
    jjmVillagesByUnit.set(key, bucket);
  }
  const jjmUnits = new Map(
    collectJjmSourceUnits(extract.sources.jjm.records).map((unit) => [unit.id, unit]),
  );
  const censusUnits = new Map(
    collectCensusSourceUnits(extract.sources.census.records).map((unit) => [
      unit.id,
      unit,
    ]),
  );
  const censusVillages = new Map(
    extract.sources.census.records.map((record) => [record.villageCode, record]),
  );
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
  const boundCensusUnits = new Set<string>();
  const panchayats: DirectoryPanchayat[] = canonical.records.map((record) => {
    const target = reviewed.get(record.lgdGramPanchayatCode);
    const jjmBinding = record.jjm
      ? ((): DirectoryPanchayat["jjm"] => {
          const unit = jjmUnits.get(record.jjm.sourceUnitId);
          if (!unit) {
            throw new Error(`JJM unit ${record.jjm.sourceUnitId} is not in the extract`);
          }
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
    const censusBinding = record.census
      ? ((): DirectoryPanchayat["census"] => {
          const unit = censusUnits.get(record.census.sourceUnitId);
          if (!unit) {
            throw new Error(
              `Census unit ${record.census.sourceUnitId} is not in the extract`,
            );
          }
          boundCensusUnits.add(unit.id);
          return {
            sourceUnitId: unit.id,
            cdBlockCode: unit.blockId,
            gramPanchayatCode: unit.id.split("/")[1],
            gramPanchayatName: unit.name,
            matchClass: record.census.matchClass,
            status: record.census.status === "verified" ? "verified" : "proposed",
            villages: unit.villageCodes.map((code) => {
              const village = censusVillages.get(code)!;
              return {
                villageCode: code,
                villageName: village.villageName,
                subdistrictCode: village.subdistrictCode,
              };
            }),
          };
        })()
      : null;

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
            basis: null,
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
      lgdCode: record.lgdGramPanchayatCode,
      name: record.lgdGramPanchayatName,
      blockCode: record.lgdBlockCode,
      blockName: record.lgdBlockName,
      tnrdMaster: target
        ? {
            blockLocalCode: target.tnrdMaster.blockLocalCode,
            gramPanchayatLocalCode: target.tnrdMaster.gramPanchayatLocalCode,
            name: target.tnrdMaster.gramPanchayatName,
          }
        : null,
      jjm: jjmBinding,
      census: censusBinding,
      composition,
      boundary: boundaryByCode.get(record.lgdGramPanchayatCode) ?? null,
    };
  });
  panchayats.sort((left, right) => left.lgdCode.localeCompare(right.lgdCode));

  const panchayatsPerBlock = new Map<string, number>();
  for (const panchayat of panchayats) {
    panchayatsPerBlock.set(
      panchayat.blockCode,
      (panchayatsPerBlock.get(panchayat.blockCode) ?? 0) + 1,
    );
  }
  const blocks: DirectoryBlock[] = proposal.blocks
    .map((block) => ({
      code: block.lgdBlockCode,
      name: block.lgdBlockName,
      jjmBlockId: block.jjmBlockId ?? null,
      jjmBlockName: block.jjmBlockName ?? null,
      censusCdBlockCode: block.censusCdBlockCode ?? null,
      censusCdBlockName: block.censusCdBlockName ?? null,
      panchayatCount: panchayatsPerBlock.get(block.lgdBlockCode) ?? 0,
    }))
    .sort((left, right) => left.code.localeCompare(right.code));
  const blockCodes = new Set(blocks.map((block) => block.code));
  for (const panchayat of panchayats) {
    if (!blockCodes.has(panchayat.blockCode)) {
      throw new Error(
        `Gram Panchayat ${panchayat.lgdCode} sits in block ${panchayat.blockCode}, ` +
          "which the crosswalk does not list",
      );
    }
  }

  return {
    schemaVersion: ATLAS_SCHEMA_VERSION,
    district: {
      slug: district.slug,
      name: plan.district.displayName,
      stateSlug: district.stateSlug,
      stateName: district.stateName,
      planId: plan.id,
      tnrdLgdCode: plan.district.tnrdLgdCode,
      tnrdMasterCode: plan.district.tnrdMasterCode,
      jjmStateId: plan.district.jjmStateId,
      jjmDistrictId: plan.district.jjmDistrictId,
      censusDistrictCode: plan.district.censusDistrictCode,
      lgdDistrictCode: plan.district.lgdDistrictCode,
      ingresDistrictName: plan.district.ingresDistrictName,
    },
    acquiredAt: extract.acquiredAt,
    vintages: {
      tnrdLgd: vintage(extract.sources.tnrdLgd),
      tnrdMaster: vintage(extract.sources.tnrdMaster),
      jjm: vintage(extract.sources.jjm),
      census: vintage(extract.sources.census),
      boundary: boundary
        ? {
            layer: boundary.source.layer,
            retrievedAt: boundary.source.retrievedAt,
            recordCount: boundary.recordCount,
          }
        : null,
    },
    crosswalk: {
      proposalId: canonical.proposalId,
      foldingVersion: canonical.foldingVersion,
      matchProcedureVersion: canonical.matchProcedureVersion,
      resolutionIds: canonical.resolutionIds,
      summary: canonical.summary,
    },
    blocks,
    panchayats,
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
      census: [...censusUnits.values()]
        .filter((unit) => !boundCensusUnits.has(unit.id))
        .map((unit) => ({
          sourceUnitId: unit.id,
          cdBlockCode: unit.blockId,
          cdBlockName: unit.blockName,
          gramPanchayatCode: unit.id.split("/")[1],
          gramPanchayatName: unit.name,
          villages: unit.villageCodes.map((code) => {
            const village = censusVillages.get(code)!;
            return {
              villageCode: code,
              villageName: village.villageName,
              subdistrictCode: village.subdistrictCode,
            };
          }),
        })),
    },
  };
}

function vintage(source: AcquiredSourceRecordSet<unknown>) {
  return {
    sourceAsOf: source.sourceAsOf,
    retrievedAt: source.retrievedAt,
    recordCount: source.recordCount,
  };
}

/**
 * Consistency checks on a directory as served: blocks partition the
 * Panchayats, codes are unique, and every binding names villages. Used by the
 * page loader and by the producers' --validate mode.
 */
export function validateDirectoryPayload(directory: DirectoryPayload): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const perBlock = new Map<string, number>();
  for (const panchayat of directory.panchayats) {
    if (seen.has(panchayat.lgdCode)) {
      errors.push(`panchayats: duplicate LGD code ${panchayat.lgdCode}`);
    }
    seen.add(panchayat.lgdCode);
    perBlock.set(panchayat.blockCode, (perBlock.get(panchayat.blockCode) ?? 0) + 1);
    if (panchayat.jjm && panchayat.jjm.villages.length === 0) {
      errors.push(`panchayats[${panchayat.lgdCode}]: JJM binding names no villages`);
    }
    if (panchayat.census && panchayat.census.villages.length === 0) {
      errors.push(`panchayats[${panchayat.lgdCode}]: Census binding names no villages`);
    }
    if (panchayat.composition.status === "unbound" && panchayat.census) {
      errors.push(`panchayats[${panchayat.lgdCode}]: bound to Census yet composition unbound`);
    }
  }
  const blockCodes = new Set<string>();
  for (const block of directory.blocks) {
    if (blockCodes.has(block.code)) errors.push(`blocks: duplicate code ${block.code}`);
    blockCodes.add(block.code);
    if ((perBlock.get(block.code) ?? 0) !== block.panchayatCount) {
      errors.push(
        `blocks[${block.code}]: declares ${block.panchayatCount} Panchayats, ` +
          `directory lists ${perBlock.get(block.code) ?? 0}`,
      );
    }
  }
  for (const code of perBlock.keys()) {
    if (!blockCodes.has(code)) errors.push(`blocks: Panchayats in unlisted block ${code}`);
  }
  const identity = identityVintage(directory as DistrictDirectoryArtifact);
  if (identity.recordCount !== directory.panchayats.length) {
    errors.push(
      `identity vintage recordCount ${identity.recordCount} does not ` +
        `match ${directory.panchayats.length} Panchayats`,
    );
  }
  return errors;
}

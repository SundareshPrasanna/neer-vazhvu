/**
 * Acquisition-side types for a Tamil Nadu district: the reviewed refresh
 * plan (pipeline-inputs/atlas/<state>/<district>/refresh-plan.json) and the
 * source extract the acquisition produces from TNRD, JJM and Census 2011.
 *
 * The extract is a producer intermediate cached under .cache/atlas/; what the
 * app reads is the served directory artifact built from it (see artifacts.ts).
 */

export const ATLAS_SCHEMA_VERSION = 1;

export const RECORD_SET_COMPLETENESS_STATUSES = [
  "complete",
  "partial",
  "unknown",
] as const;

export type RecordSetCompletenessStatus =
  (typeof RECORD_SET_COMPLETENESS_STATUSES)[number];

export const RECORD_SET_COMPLETENESS_BASES = [
  "authoritative-enumeration",
  "authoritative-crosswalk",
  "verified-singleton",
  "manual-audit",
] as const;

export type RecordSetCompletenessBasis =
  (typeof RECORD_SET_COMPLETENESS_BASES)[number];

export const COMPOSITION_EVIDENCE_METHODS = [
  "authoritative-crosswalk",
  "manual-audit",
] as const;

export type CompositionEvidenceMethod =
  (typeof COMPOSITION_EVIDENCE_METHODS)[number];

export const CENSUS_SETTLEMENT_KINDS = [
  "village",
  "census-town",
] as const;

export type CensusSettlementKind =
  (typeof CENSUS_SETTLEMENT_KINDS)[number];

export const CENSUS_COMPOSITION_EXCLUSION_REASONS = [
  "belongs-to-other-gram-panchayat",
] as const;

export type CensusCompositionExclusionReason =
  (typeof CENSUS_COMPOSITION_EXCLUSION_REASONS)[number];

export interface TnDistrictRefreshPlan {
  schemaVersion: number;
  id: string;
  district: {
    displayName: string;
    tnrdLgdCode: string;
    tnrdMasterCode: string;
    jjmStateId: string;
    jjmDistrictId: string;
    censusDistrictCode: string;
    /** LGD district code, used by the TNGIS taluk layer. Not the TNRD code. */
    lgdDistrictCode: string;
    ingresDistrictName: string;
    ingresStateUuid: string;
  };
  sources: {
    tnrdLgdPdf: {
      url: string;
      sourceAsOf: string;
    };
    tnrdMaster: {
      url: string;
    };
    jjm: {
      url: string;
    };
    census: {
      url: string;
      sourceAsOf: string;
    };
  };
  expectedCounts: {
    tnrdLgdGramPanchayats: number;
    tnrdMasterBlocks: number;
    tnrdMasterGramPanchayats: number;
    jjmVillages: number;
    censusVillages: number;
  };
  targets: TnDistrictRefreshTarget[];
}

export interface TnDistrictRefreshTarget {
  id: string;
  displayName: string;
  reviewedAt: string;
  tnrdLgdGramPanchayatCode: string;
  tnrdMasterBlockCode: string;
  tnrdMasterGramPanchayatCode: string;
  jjmBlockId: string;
  jjmGramPanchayatId: string;
  censusSubdistrictCode: string;
  censusGramPanchayatCode: string;
  mappingExpectations: {
    jjm: TnDistrictMappingExpectation;
    census: TnDistrictMappingExpectation;
  };
  censusComposition: TnDistrictCensusCompositionReview;
}

export interface TnDistrictMappingExpectation {
  status: RecordSetCompletenessStatus;
  basis: RecordSetCompletenessBasis;
  expectedRecordCount?: number;
}

export interface TnDistrictCensusCompositionMember {
  kind: CensusSettlementKind;
  code: string;
  name: string;
}

export interface TnDistrictCensusCompositionExclusion
  extends TnDistrictCensusCompositionMember {
  reason: CensusCompositionExclusionReason;
  ownerLgdGramPanchayatCode: string;
}

export interface TnDistrictCensusCompositionEvidence {
  id: string;
  sourceId: string;
  sourceUrl: string;
  sourceAsOf: string;
  method: CompositionEvidenceMethod;
  locator: string;
  assertion: string;
}

export interface TnDistrictCensusCompositionReview {
  status: RecordSetCompletenessStatus;
  basis: RecordSetCompletenessBasis;
  expectedRecordCount?: number;
  members: TnDistrictCensusCompositionMember[];
  exclusions: TnDistrictCensusCompositionExclusion[];
  evidence: TnDistrictCensusCompositionEvidence[];
}

export interface TnrdLgdGramPanchayatRecord {
  districtCode: string;
  districtName: string;
  blockCode: string;
  blockName: string;
  gramPanchayatCode: string;
  gramPanchayatName: string;
}

export interface TnrdMasterGramPanchayatRecord {
  districtLocalCode: string;
  districtName: string;
  blockLocalCode: string;
  blockName: string;
  gramPanchayatLocalCode: string;
  gramPanchayatName: string;
}

export interface JjmVillageRecord {
  stateId: string;
  districtId: string;
  blockId: string;
  blockName: string;
  gpId: string;
  gpName: string;
  villageId: string;
  villageName: string;
}

export interface CensusVillageRecord {
  stateCode: string;
  stateName: string;
  districtCode: string;
  districtName: string;
  subdistrictCode: string;
  subdistrictName: string;
  villageCode: string;
  villageName: string;
  cdBlocks: CensusNamedCode[];
  gramPanchayats: CensusNamedCode[];
  referenceYear: string;
}

export interface CensusNamedCode {
  code: string;
  name: string;
}

export interface AcquiredSourceRecordSet<T> {
  sourceId: string;
  sourceUrl: string;
  retrievedAt: string;
  sourceAsOf: string;
  snapshotSha256: string;
  artifactSha256s: string[];
  recordsSha256: string;
  recordCount: number;
  records: T[];
}

export interface TnDistrictSourceExtract {
  schemaVersion: number;
  planId: string;
  acquiredAt: string;
  sources: {
    tnrdLgd: AcquiredSourceRecordSet<TnrdLgdGramPanchayatRecord>;
    tnrdMaster: AcquiredSourceRecordSet<TnrdMasterGramPanchayatRecord>;
    jjm: AcquiredSourceRecordSet<JjmVillageRecord>;
    census: AcquiredSourceRecordSet<CensusVillageRecord>;
  };
}

export interface CachedArtifact {
  sha256: string;
  path: string;
  bytes: Uint8Array;
}

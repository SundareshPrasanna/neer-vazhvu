import { readFileSync } from "node:fs";

import { computeRecordsSha256 } from "./acquisition-validation";
import type {
  CensusVillageRecord,
  JjmVillageRecord,
  TnDistrictSourceExtract,
  TnrdLgdGramPanchayatRecord,
} from "./acquisition-model";

export const CROSSWALK_SCHEMA_VERSION = 1;

// Folding rules decide the size of the accepted set, so the version is stamped
// into every proposal, asserted by the golden tests, and must be bumped when a
// rule changes. Regeneration then produces a reviewable diff instead of a
// silently wider match.
export const CROSSWALK_FOLDING_VERSION = "tn-transliteration-v2";

// The order and strictness of the match passes also decide the accepted set,
// independently of the folding rules, so it carries its own version.
export const CROSSWALK_MATCH_PROCEDURE_VERSION = "raw-exact-then-fold-v1";

export const MACHINE_MATCH_CLASSES = [
  "exact",
  "unique-folded",
  "block-elimination",
] as const;

export const PROPOSED_MATCH_CLASSES = ["proposed-pairing"] as const;

export const REVIEWED_MATCH_CLASSES = [
  "tamil-assisted",
  "human-affirmed",
] as const;

export const CROSSWALK_MATCH_CLASSES = [
  ...MACHINE_MATCH_CLASSES,
  ...PROPOSED_MATCH_CLASSES,
  ...REVIEWED_MATCH_CLASSES,
] as const;

export type MachineMatchClass = (typeof MACHINE_MATCH_CLASSES)[number];
export type ProposedMatchClass = (typeof PROPOSED_MATCH_CLASSES)[number];
export type ReviewedMatchClass = (typeof REVIEWED_MATCH_CLASSES)[number];
export type CrosswalkMatchClass = (typeof CROSSWALK_MATCH_CLASSES)[number];

export const CROSSWALK_REVIEW_REASONS = [
  "no-name-match-in-block",
  "ambiguous-lgd-name-collision",
  "ambiguous-source-name-collision",
  "block-not-aligned",
] as const;

export type CrosswalkReviewReason = (typeof CROSSWALK_REVIEW_REASONS)[number];

export const CROSSWALK_AXES = ["jjm", "census"] as const;

export type CrosswalkAxis = (typeof CROSSWALK_AXES)[number];

// A proposed row is usable and binds downstream, but it is labelled so every
// consumer can see it has not been checked by someone with local knowledge.
// Only an explicit rejection is withheld.
export const VERIFICATION_STATUSES = [
  "proposed",
  "verified",
  "rejected",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const BLOCK_ALIGNMENT_BASES = [
  "verified",
  "proposed",
  "exact",
  "unique-folded",
] as const;

export type BlockAlignmentBasis = (typeof BLOCK_ALIGNMENT_BASES)[number];

export interface CrosswalkBlockAlignment {
  lgdBlockCode: string;
  lgdBlockName: string;
  jjmBlockId?: string;
  jjmBlockName?: string;
  jjmBasis?: BlockAlignmentBasis;
  censusCdBlockCode?: string;
  censusCdBlockName?: string;
  censusBasis?: BlockAlignmentBasis;
}

/**
 * A human-affirmed block mapping. Block names drift harder than Gram
 * Panchayat names across TNRD, JJM and Census, and one unaligned block
 * strands every Panchayat inside it. Fourteen reviewed rows per district
 * remove that failure mode permanently, so folding proposes the table and a
 * reviewer affirms it.
 */
export interface ReviewedBlockAlignment {
  lgdBlockCode: string;
  jjmBlockId?: string;
  censusCdBlockCode?: string;
  status: VerificationStatus;
  question?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  note?: string;
}

export interface ReviewedBlockAlignmentTable {
  schemaVersion: number;
  planId: string;
  alignments: ReviewedBlockAlignment[];
}

export interface CrosswalkLgdRef {
  lgdGramPanchayatCode: string;
  lgdGramPanchayatName: string;
  lgdBlockCode: string;
  lgdBlockName: string;
}

export interface CrosswalkReceipt {
  foldedKey: string;
  sourceName: string;
  lgdName: string;
}

export interface CrosswalkAcceptedMatch extends CrosswalkLgdRef {
  sourceUnitId: string;
  matchClass: MachineMatchClass;
  receipt: CrosswalkReceipt;
}

export interface CrosswalkReviewEntry {
  sourceUnitId: string;
  sourceName: string;
  sourceBlockName: string;
  lgdBlockCode?: string;
  lgdBlockName?: string;
  reason: CrosswalkReviewReason;
  foldedKey: string;
  candidates: CrosswalkLgdRef[];
}

export interface CrosswalkAxisResult {
  accepted: CrosswalkAcceptedMatch[];
  review: {
    sourceUnits: CrosswalkReviewEntry[];
    lgdGramPanchayats: CrosswalkLgdRef[];
  };
}

export interface CrosswalkAxisSummary {
  sourceUnits: number;
  accepted: number;
  reviewSourceUnits: number;
  reviewLgdGramPanchayats: number;
  acceptedByClass: Record<MachineMatchClass, number>;
}

export interface CrosswalkCensusMembership {
  villageRows: number;
  membershipPairs: number;
  multiGramPanchayatVillages: number;
  villagesCovered: number;
}

export interface TnDistrictCrosswalkProposal {
  schemaVersion: number;
  id: string;
  planId: string;
  proposedAt: string;
  foldingVersion: string;
  matchProcedureVersion: string;
  extract: {
    acquiredAt: string;
  };
  sourceRecordDigests: {
    tnrdLgd: string;
    jjm: string;
    census: string;
  };
  reviewedBlockAlignments: ReviewedBlockAlignment[];
  blocks: CrosswalkBlockAlignment[];
  jjm: CrosswalkAxisResult;
  census: CrosswalkAxisResult;
  censusMembership: CrosswalkCensusMembership;
  summary: {
    lgdGramPanchayats: number;
    lgdBlocks: number;
    jjm: CrosswalkAxisSummary;
    census: CrosswalkAxisSummary;
  };
}

export const UNVERIFIED_REVIEWER = /^\s*(pending|todo|tbd|draft|unknown)/i;

const DIGRAPH_FOLDINGS: Array<[string, string]> = [
  ["zh", "l"],
  ["th", "t"],
  ["dh", "d"],
  ["bh", "b"],
  ["gh", "g"],
  ["ph", "p"],
  ["kh", "k"],
  ["sh", "s"],
  ["ch", "s"],
  ["w", "v"],
  ["j", "s"],
];

export function foldTamilPlaceName(value: string): string {
  let folded = (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
  for (const [from, to] of DIGRAPH_FOLDINGS) {
    folded = folded.split(from).join(to);
  }
  // v2: nasal-stop voicing (Pullampady / Pullambadi), terminal y as a vowel
  // (Vaiyampatty / Vaiyampatti), and glide spelling (Uppiliyapuram /
  // Uppiliapuram). Added after Tiruchirappalli showed five whole blocks
  // failing to align on these three variants alone.
  folded = folded.split("mb").join("mp").split("nb").join("np");
  folded = folded.replace(/y$/, "i");
  folded = folded.split("ia").join("ya");
  folded = folded.replace(/(.)\1+/g, "$1");
  folded = folded
    .split("ee")
    .join("i")
    .split("oo")
    .join("u")
    .split("aa")
    .join("a");
  folded = folded.replace(/(ai|ei|ay|ey)$/, "a");
  folded = folded.replace(/[aeiou]+$/, "");
  return folded.replace(/(.)\1+/g, "$1");
}

function normalizeRawName(value: string): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

interface SourceUnit {
  id: string;
  name: string;
  blockId: string;
  blockName: string;
}

interface LgdBlock {
  code: string;
  name: string;
  records: TnrdLgdGramPanchayatRecord[];
}

function toLgdRef(
  record: TnrdLgdGramPanchayatRecord,
  block: LgdBlock,
): CrosswalkLgdRef {
  return {
    lgdGramPanchayatCode: record.gramPanchayatCode,
    lgdGramPanchayatName: record.gramPanchayatName,
    lgdBlockCode: block.code,
    lgdBlockName: block.name,
  };
}

function indexLgdBlocks(
  records: TnrdLgdGramPanchayatRecord[],
): Map<string, LgdBlock> {
  const blocks = new Map<string, LgdBlock>();
  for (const record of records) {
    const key = foldTamilPlaceName(record.blockName);
    let block = blocks.get(key);
    if (!block) {
      block = { code: record.blockCode, name: record.blockName, records: [] };
      blocks.set(key, block);
    }
    block.records.push(record);
  }
  return blocks;
}

export function collectJjmSourceUnits(
  records: JjmVillageRecord[],
): Array<SourceUnit & { villageCount: number }> {
  const units = new Map<string, SourceUnit & { villageCount: number }>();
  for (const record of records) {
    const id = `${record.blockId}/${record.gpId}`;
    const existing = units.get(id);
    if (existing) {
      existing.villageCount += 1;
      continue;
    }
    units.set(id, {
      id,
      name: record.gpName,
      blockId: record.blockId,
      blockName: record.blockName,
      villageCount: 1,
    });
  }
  return [...units.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function collectCensusSourceUnits(
  records: CensusVillageRecord[],
): Array<SourceUnit & { villageCodes: string[] }> {
  const units = new Map<string, SourceUnit & { villageCodes: string[] }>();
  for (const record of records) {
    // A village row may declare several CD-block and Gram-Panchayat
    // memberships. Every pair is preserved as its own unit rather than
    // collapsed, so a multi-Panchayat village is never silently assigned.
    for (const cdBlock of record.cdBlocks) {
      for (const gramPanchayat of record.gramPanchayats) {
        const id = `${cdBlock.code}/${gramPanchayat.code}`;
        const existing = units.get(id);
        if (existing) {
          if (!existing.villageCodes.includes(record.villageCode)) {
            existing.villageCodes.push(record.villageCode);
          }
          continue;
        }
        units.set(id, {
          id,
          name: gramPanchayat.name,
          blockId: cdBlock.code,
          blockName: cdBlock.name,
          villageCodes: [record.villageCode],
        });
      }
    }
  }
  for (const unit of units.values()) unit.villageCodes.sort();
  return [...units.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function summarizeCensusMembership(
  records: CensusVillageRecord[],
  units: Array<{ villageCodes: string[] }>,
): CrosswalkCensusMembership {
  let membershipPairs = 0;
  let multiGramPanchayatVillages = 0;
  for (const record of records) {
    membershipPairs += record.cdBlocks.length * record.gramPanchayats.length;
    if (record.gramPanchayats.length > 1) multiGramPanchayatVillages += 1;
  }
  const covered = new Set<string>();
  for (const unit of units) {
    for (const code of unit.villageCodes) covered.add(code);
  }
  return {
    villageRows: records.length,
    membershipPairs,
    multiGramPanchayatVillages,
    villagesCovered: covered.size,
  };
}

/**
 * Matches one source axis against the LGD hierarchy inside each block.
 *
 * The passes are order-independent by construction: a fold key is only
 * accepted when exactly one source unit and exactly one LGD record carry it,
 * so no earlier unit can quietly claim a record a later unit also matched.
 * Every collision, in either direction, is deferred with its closed candidate
 * set instead of being resolved by iteration order.
 */
function matchAxis(
  units: SourceUnit[],
  blocks: Map<string, LgdBlock>,
  reviewedBlocks: Map<string, LgdBlock>,
): CrosswalkAxisResult {
  const accepted: CrosswalkAcceptedMatch[] = [];
  const review: CrosswalkReviewEntry[] = [];
  const claimed = new Set<string>();
  const deferred: Array<{
    unit: SourceUnit;
    block: LgdBlock;
    reason: CrosswalkReviewReason;
    foldCandidates: CrosswalkLgdRef[];
  }> = [];

  // A reviewed alignment binds by source block identifier and outranks any
  // name folding; folding only applies where no reviewer has spoken.
  const resolveBlock = (unit: SourceUnit): LgdBlock | undefined =>
    reviewedBlocks.get(unit.blockId) ??
    blocks.get(foldTamilPlaceName(unit.blockName));

  const unitsByBlock = new Map<string, SourceUnit[]>();
  const unresolvedUnits: SourceUnit[] = [];
  for (const unit of units) {
    const block = resolveBlock(unit);
    if (!block) {
      unresolvedUnits.push(unit);
      continue;
    }
    const key = foldTamilPlaceName(block.name);
    const bucket = unitsByBlock.get(key);
    if (bucket) bucket.push(unit);
    else unitsByBlock.set(key, [unit]);
  }

  for (const [blockKey, blockUnits] of [
    ...unitsByBlock.entries(),
    ["", unresolvedUnits] as [string, SourceUnit[]],
  ]) {
    const block = blockKey ? blocks.get(blockKey) : undefined;
    if (!block) {
      for (const unit of blockUnits) {
        review.push({
          sourceUnitId: unit.id,
          sourceName: unit.name,
          sourceBlockName: unit.blockName,
          reason: "block-not-aligned",
          foldedKey: foldTamilPlaceName(unit.name),
          candidates: [],
        });
      }
      continue;
    }

    const unitsByRaw = new Map<string, SourceUnit[]>();
    for (const unit of blockUnits) {
      const key = normalizeRawName(unit.name);
      const bucket = unitsByRaw.get(key);
      if (bucket) bucket.push(unit);
      else unitsByRaw.set(key, [unit]);
    }
    const lgdByRaw = new Map<string, TnrdLgdGramPanchayatRecord[]>();
    for (const record of block.records) {
      const key = normalizeRawName(record.gramPanchayatName);
      const bucket = lgdByRaw.get(key);
      if (bucket) bucket.push(record);
      else lgdByRaw.set(key, [record]);
    }

    const unitsByFold = new Map<string, SourceUnit[]>();
    for (const unit of blockUnits) {
      const key = foldTamilPlaceName(unit.name);
      const bucket = unitsByFold.get(key);
      if (bucket) bucket.push(unit);
      else unitsByFold.set(key, [unit]);
    }
    const lgdByFold = new Map<string, TnrdLgdGramPanchayatRecord[]>();
    for (const record of block.records) {
      const key = foldTamilPlaceName(record.gramPanchayatName);
      const bucket = lgdByFold.get(key);
      if (bucket) bucket.push(record);
      else lgdByFold.set(key, [record]);
    }

    for (const unit of blockUnits) {
      const foldedKey = foldTamilPlaceName(unit.name);
      // A raw-name match that is unique on both sides is stronger evidence
      // than any fold, so it is tested first. Otherwise a fold collision
      // between two distinct names could suppress an exact identity, which is
      // how Kalyanapuram I Sethi and Kalyanapuram II Sethi were deferred.
      const rawKey = normalizeRawName(unit.name);
      const rawUnits = unitsByRaw.get(rawKey) ?? [];
      const rawCandidates = (lgdByRaw.get(rawKey) ?? []).filter(
        (record) => !claimed.has(record.gramPanchayatCode),
      );
      if (rawUnits.length === 1 && rawCandidates.length === 1) {
        const record = rawCandidates[0];
        claimed.add(record.gramPanchayatCode);
        accepted.push({
          ...toLgdRef(record, block),
          sourceUnitId: unit.id,
          matchClass: "exact",
          receipt: {
            foldedKey,
            sourceName: unit.name,
            lgdName: record.gramPanchayatName,
          },
        });
        continue;
      }
      const sourceCollisions = unitsByFold.get(foldedKey) ?? [];
      const candidates = (lgdByFold.get(foldedKey) ?? []).filter(
        (record) => !claimed.has(record.gramPanchayatCode),
      );
      if (sourceCollisions.length > 1) {
        deferred.push({
          unit,
          block,
          reason: "ambiguous-source-name-collision",
          foldCandidates: candidates.map((record) => toLgdRef(record, block)),
        });
        continue;
      }
      if (candidates.length > 1) {
        deferred.push({
          unit,
          block,
          reason: "ambiguous-lgd-name-collision",
          foldCandidates: candidates.map((record) => toLgdRef(record, block)),
        });
        continue;
      }
      if (candidates.length === 1) {
        const record = candidates[0];
        claimed.add(record.gramPanchayatCode);
        accepted.push({
          ...toLgdRef(record, block),
          sourceUnitId: unit.id,
          matchClass:
            normalizeRawName(record.gramPanchayatName) ===
            normalizeRawName(unit.name)
              ? "exact"
              : "unique-folded",
          receipt: {
            foldedKey,
            sourceName: unit.name,
            lgdName: record.gramPanchayatName,
          },
        });
        continue;
      }
      deferred.push({
        unit,
        block,
        reason: "no-name-match-in-block",
        foldCandidates: [],
      });
    }
  }

  // Closed-set elimination fires only when a block has exactly one deferred
  // source unit and exactly one unclaimed LGD record, and only when that unit
  // was deferred for absence of a match rather than for ambiguity. An
  // ambiguous unit is never resolved by elimination.
  for (const [blockKey, block] of blocks) {
    const blockDeferred = deferred.filter(
      (entry) => foldTamilPlaceName(entry.block.name) === blockKey,
    );
    const unclaimed = block.records.filter(
      (record) => !claimed.has(record.gramPanchayatCode),
    );
    if (
      blockDeferred.length === 1 &&
      unclaimed.length === 1 &&
      blockDeferred[0].reason === "no-name-match-in-block"
    ) {
      const { unit } = blockDeferred[0];
      const record = unclaimed[0];
      claimed.add(record.gramPanchayatCode);
      accepted.push({
        ...toLgdRef(record, block),
        sourceUnitId: unit.id,
        matchClass: "block-elimination",
        receipt: {
          foldedKey: foldTamilPlaceName(unit.name),
          sourceName: unit.name,
          lgdName: record.gramPanchayatName,
        },
      });
      continue;
    }
    for (const entry of blockDeferred) {
      review.push({
        sourceUnitId: entry.unit.id,
        sourceName: entry.unit.name,
        sourceBlockName: entry.unit.blockName,
        lgdBlockCode: block.code,
        lgdBlockName: block.name,
        reason: entry.reason,
        foldedKey: foldTamilPlaceName(entry.unit.name),
        candidates:
          entry.foldCandidates.length > 0
            ? entry.foldCandidates
            : unclaimed.map((record) => toLgdRef(record, block)),
      });
    }
  }

  const unmatchedLgd: CrosswalkLgdRef[] = [];
  for (const block of blocks.values()) {
    for (const record of block.records) {
      if (!claimed.has(record.gramPanchayatCode)) {
        unmatchedLgd.push(toLgdRef(record, block));
      }
    }
  }

  return {
    accepted: accepted.sort((left, right) =>
      left.sourceUnitId.localeCompare(right.sourceUnitId),
    ),
    review: {
      sourceUnits: review.sort((left, right) =>
        left.sourceUnitId.localeCompare(right.sourceUnitId),
      ),
      lgdGramPanchayats: unmatchedLgd.sort((left, right) =>
        left.lgdGramPanchayatCode.localeCompare(right.lgdGramPanchayatCode),
      ),
    },
  };
}

function summarizeAxis(
  sourceUnits: number,
  result: CrosswalkAxisResult,
): CrosswalkAxisSummary {
  const acceptedByClass: Record<MachineMatchClass, number> = {
    exact: 0,
    "unique-folded": 0,
    "block-elimination": 0,
  };
  for (const match of result.accepted) acceptedByClass[match.matchClass] += 1;
  return {
    sourceUnits,
    accepted: result.accepted.length,
    reviewSourceUnits: result.review.sourceUnits.length,
    reviewLgdGramPanchayats: result.review.lgdGramPanchayats.length,
    acceptedByClass,
  };
}

export function buildTnDistrictCrosswalk(
  extract: TnDistrictSourceExtract,
  options: {
    id: string;
    proposedAt: string;
    reviewedBlockAlignments?: ReviewedBlockAlignment[];
  },
): TnDistrictCrosswalkProposal {
  const lgdRecords = extract.sources.tnrdLgd.records;
  const blocks = indexLgdBlocks(lgdRecords);
  const jjmUnits = collectJjmSourceUnits(extract.sources.jjm.records);
  const censusUnits = collectCensusSourceUnits(extract.sources.census.records);

  const reviewed = options.reviewedBlockAlignments ?? [];
  const blocksByCode = new Map(
    [...blocks.values()].map((block) => [block.code, block]),
  );
  const reviewedJjmBlocks = new Map<string, LgdBlock>();
  const reviewedCensusBlocks = new Map<string, LgdBlock>();
  for (const alignment of reviewed) {
    if (alignment.status === "rejected") continue;
    const block = blocksByCode.get(alignment.lgdBlockCode);
    if (!block) continue;
    if (alignment.jjmBlockId) reviewedJjmBlocks.set(alignment.jjmBlockId, block);
    if (alignment.censusCdBlockCode) {
      reviewedCensusBlocks.set(alignment.censusCdBlockCode, block);
    }
  }

  const jjm = matchAxis(jjmUnits, blocks, reviewedJjmBlocks);
  const census = matchAxis(censusUnits, blocks, reviewedCensusBlocks);

  const blockAlignments: CrosswalkBlockAlignment[] = [...blocks.entries()]
    .map(([key, block]) => {
      const affirmed = reviewed.find(
        (alignment) =>
          alignment.lgdBlockCode === block.code && alignment.status !== "rejected",
      );
      const jjmBlock = affirmed?.jjmBlockId
        ? extract.sources.jjm.records.find(
            (record) => record.blockId === affirmed.jjmBlockId,
          )
        : extract.sources.jjm.records.find(
            (record) => foldTamilPlaceName(record.blockName) === key,
          );
      const censusBlock = affirmed?.censusCdBlockCode
        ? extract.sources.census.records
            .flatMap((record) => record.cdBlocks)
            .find((cdBlock) => cdBlock.code === affirmed.censusCdBlockCode)
        : extract.sources.census.records
            .flatMap((record) => record.cdBlocks)
            .find((cdBlock) => foldTamilPlaceName(cdBlock.name) === key);
      const affirmedStatus = affirmed?.status;
      const basis = (
        affirmedBy: string | undefined,
        sourceName: string | undefined,
      ): BlockAlignmentBasis | undefined => {
        if (sourceName === undefined) return undefined;
        if (affirmedBy) return affirmedStatus === "verified" ? "verified" : "proposed";
        return normalizeRawName(sourceName) === normalizeRawName(block.name)
          ? "exact"
          : "unique-folded";
      };
      return {
        lgdBlockCode: block.code,
        lgdBlockName: block.name,
        jjmBlockId: jjmBlock?.blockId,
        jjmBlockName: jjmBlock?.blockName,
        jjmBasis: basis(affirmed?.jjmBlockId, jjmBlock?.blockName),
        censusCdBlockCode: censusBlock?.code,
        censusCdBlockName: censusBlock?.name,
        censusBasis: basis(affirmed?.censusCdBlockCode, censusBlock?.name),
      };
    })
    .sort((left, right) => left.lgdBlockCode.localeCompare(right.lgdBlockCode));

  return {
    schemaVersion: CROSSWALK_SCHEMA_VERSION,
    id: options.id,
    planId: extract.planId,
    proposedAt: options.proposedAt,
    foldingVersion: CROSSWALK_FOLDING_VERSION,
    matchProcedureVersion: CROSSWALK_MATCH_PROCEDURE_VERSION,
    extract: { acquiredAt: extract.acquiredAt },
    sourceRecordDigests: {
      tnrdLgd: extract.sources.tnrdLgd.recordsSha256,
      jjm: extract.sources.jjm.recordsSha256,
      census: extract.sources.census.recordsSha256,
    },
    reviewedBlockAlignments: [...reviewed].sort((left, right) =>
      left.lgdBlockCode.localeCompare(right.lgdBlockCode),
    ),
    blocks: blockAlignments,
    jjm,
    census,
    censusMembership: summarizeCensusMembership(
      extract.sources.census.records,
      censusUnits,
    ),
    summary: {
      lgdGramPanchayats: lgdRecords.length,
      lgdBlocks: blocks.size,
      jjm: summarizeAxis(jjmUnits.length, jjm),
      census: summarizeAxis(censusUnits.length, census),
    },
  };
}

function validateAxisCardinality(
  axis: CrosswalkAxis,
  result: CrosswalkAxisResult,
  sourceUnitIds: string[],
  lgdRecords: TnrdLgdGramPanchayatRecord[],
  errors: string[],
): void {
  const acceptedCodes = new Set<string>();
  const perBlockClaims = new Map<string, Set<string>>();
  for (const match of result.accepted) {
    if (acceptedCodes.has(match.lgdGramPanchayatCode)) {
      errors.push(
        `${axis}.accepted: Gram Panchayat ${match.lgdGramPanchayatCode} is claimed more than once`,
      );
    }
    acceptedCodes.add(match.lgdGramPanchayatCode);
    const claims =
      perBlockClaims.get(match.lgdBlockCode) ?? new Set<string>();
    if (claims.has(match.sourceUnitId)) {
      errors.push(
        `${axis}.accepted: source unit ${match.sourceUnitId} is matched more than once`,
      );
    }
    claims.add(match.sourceUnitId);
    perBlockClaims.set(match.lgdBlockCode, claims);
  }

  const deferredCodes = new Set(
    result.review.lgdGramPanchayats.map((ref) => ref.lgdGramPanchayatCode),
  );
  for (const code of deferredCodes) {
    if (acceptedCodes.has(code)) {
      errors.push(
        `${axis}.review: Gram Panchayat ${code} is both accepted and deferred`,
      );
    }
  }
  const consumed = acceptedCodes.size + deferredCodes.size;
  if (consumed !== lgdRecords.length) {
    errors.push(
      `${axis}: ${consumed} of ${lgdRecords.length} LGD Gram Panchayats accounted for; ` +
        "every record must be accepted or deferred exactly once",
    );
  }

  const seenUnits = new Set<string>();
  for (const id of [
    ...result.accepted.map((match) => match.sourceUnitId),
    ...result.review.sourceUnits.map((entry) => entry.sourceUnitId),
  ]) {
    if (seenUnits.has(id)) {
      errors.push(`${axis}: source unit ${id} appears more than once`);
    }
    seenUnits.add(id);
  }
  for (const id of sourceUnitIds) {
    if (!seenUnits.has(id)) {
      errors.push(`${axis}: source unit ${id} is neither accepted nor deferred`);
    }
  }
  if (seenUnits.size !== sourceUnitIds.length) {
    errors.push(
      `${axis}: ${seenUnits.size} source units accounted for, expected ${sourceUnitIds.length}`,
    );
  }

  for (const match of result.accepted) {
    if (!MACHINE_MATCH_CLASSES.includes(match.matchClass)) {
      errors.push(
        `${axis}.accepted: ${match.sourceUnitId} carries reviewed match class ` +
          `${match.matchClass}; reviewed decisions belong in a resolution record`,
      );
    }
  }
  for (const entry of result.review.sourceUnits) {
    if (
      entry.reason !== "block-not-aligned" &&
      entry.candidates.length === 0 &&
      result.review.lgdGramPanchayats.length > 0
    ) {
      errors.push(
        `${axis}.review: ${entry.sourceUnitId} was deferred without a candidate set`,
      );
    }
  }
}

export function validateTnDistrictCrosswalkProposal(
  proposal: TnDistrictCrosswalkProposal,
  extract: TnDistrictSourceExtract,
): string[] {
  const errors: string[] = [];
  if (proposal.schemaVersion !== CROSSWALK_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion: expected ${CROSSWALK_SCHEMA_VERSION}, found ${proposal.schemaVersion}`,
    );
  }
  if (proposal.planId !== extract.planId) {
    errors.push(
      `planId: proposal ${proposal.planId} does not match extract ${extract.planId}`,
    );
  }
  if (proposal.foldingVersion !== CROSSWALK_FOLDING_VERSION) {
    errors.push(
      `foldingVersion: proposal was produced by ${proposal.foldingVersion}, ` +
        `current rules are ${CROSSWALK_FOLDING_VERSION}`,
    );
  }
  if (proposal.matchProcedureVersion !== CROSSWALK_MATCH_PROCEDURE_VERSION) {
    errors.push(
      `matchProcedureVersion: proposal was produced by ${proposal.matchProcedureVersion}, ` +
        `current procedure is ${CROSSWALK_MATCH_PROCEDURE_VERSION}`,
    );
  }
  for (const [source, digest] of Object.entries(proposal.sourceRecordDigests)) {
    const recordSet =
      extract.sources[source as keyof TnDistrictSourceExtract["sources"]];
    if (!recordSet) {
      errors.push(`sourceRecordDigests.${source}: unknown source`);
      continue;
    }
    if (digest !== computeRecordsSha256(recordSet.records)) {
      errors.push(
        `sourceRecordDigests.${source}: proposal is stale against the extract`,
      );
    }
  }
  if (errors.length > 0) return errors;

  const rebuilt = buildTnDistrictCrosswalk(extract, {
    id: proposal.id,
    proposedAt: proposal.proposedAt,
    reviewedBlockAlignments: proposal.reviewedBlockAlignments,
  });
  if (JSON.stringify(rebuilt) !== JSON.stringify(proposal)) {
    errors.push(
      "proposal is not reproducible from the extract under the current folding rules",
    );
  }

  validateAxisCardinality(
    "jjm",
    proposal.jjm,
    collectJjmSourceUnits(extract.sources.jjm.records).map((unit) => unit.id),
    extract.sources.tnrdLgd.records,
    errors,
  );
  const censusUnits = collectCensusSourceUnits(extract.sources.census.records);
  validateAxisCardinality(
    "census",
    proposal.census,
    censusUnits.map((unit) => unit.id),
    extract.sources.tnrdLgd.records,
    errors,
  );

  const membership = summarizeCensusMembership(
    extract.sources.census.records,
    censusUnits,
  );
  if (
    JSON.stringify(membership) !== JSON.stringify(proposal.censusMembership)
  ) {
    errors.push(
      "censusMembership: multi-Panchayat village memberships are not preserved exactly",
    );
  }
  if (membership.villagesCovered !== membership.villageRows) {
    errors.push(
      `censusMembership: ${membership.villagesCovered} of ${membership.villageRows} ` +
        "Census village rows are represented in the crosswalk units",
    );
  }
  return errors;
}

export function validateReviewedBlockAlignmentTable(
  table: ReviewedBlockAlignmentTable,
  extract: TnDistrictSourceExtract,
): string[] {
  const errors: string[] = [];
  if (table.schemaVersion !== CROSSWALK_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion: expected ${CROSSWALK_SCHEMA_VERSION}, found ${table.schemaVersion}`,
    );
  }
  if (table.planId !== extract.planId) {
    errors.push(
      `planId: table ${table.planId} does not match extract ${extract.planId}`,
    );
  }
  const lgdBlockCodes = new Set(
    extract.sources.tnrdLgd.records.map((record) => record.blockCode),
  );
  const jjmBlockIds = new Set(
    extract.sources.jjm.records.map((record) => record.blockId),
  );
  const censusBlockCodes = new Set(
    extract.sources.census.records.flatMap((record) =>
      record.cdBlocks.map((cdBlock) => cdBlock.code),
    ),
  );
  const seenLgd = new Set<string>();
  const seenJjm = new Set<string>();
  const seenCensus = new Set<string>();
  for (const alignment of table.alignments) {
    const label = `alignments[${alignment.lgdBlockCode}]`;
    if (!lgdBlockCodes.has(alignment.lgdBlockCode)) {
      errors.push(`${label}: unknown LGD block code`);
    }
    if (seenLgd.has(alignment.lgdBlockCode)) {
      errors.push(`${label}: LGD block is affirmed more than once`);
    }
    seenLgd.add(alignment.lgdBlockCode);
    if (alignment.jjmBlockId !== undefined) {
      if (!jjmBlockIds.has(alignment.jjmBlockId)) {
        errors.push(`${label}: JJM block ${alignment.jjmBlockId} is not in the extract`);
      }
      if (seenJjm.has(alignment.jjmBlockId)) {
        errors.push(`${label}: JJM block ${alignment.jjmBlockId} is claimed twice`);
      }
      seenJjm.add(alignment.jjmBlockId);
    }
    if (alignment.censusCdBlockCode !== undefined) {
      if (!censusBlockCodes.has(alignment.censusCdBlockCode)) {
        errors.push(
          `${label}: Census CD block ${alignment.censusCdBlockCode} is not in the extract`,
        );
      }
      if (seenCensus.has(alignment.censusCdBlockCode)) {
        errors.push(
          `${label}: Census CD block ${alignment.censusCdBlockCode} is claimed twice`,
        );
      }
      seenCensus.add(alignment.censusCdBlockCode);
    }
    if (!VERIFICATION_STATUSES.includes(alignment.status)) {
      errors.push(`${label}: unknown verification status`);
      continue;
    }
    if (alignment.status === "rejected") continue;
    if (alignment.status === "proposed") {
      if (alignment.verifiedBy !== undefined || alignment.verifiedAt !== undefined) {
        errors.push(
          `${label}: a proposed row must not carry verifiedBy or verifiedAt`,
        );
      }
      if (!alignment.question || alignment.question.trim().length === 0) {
        errors.push(
          `${label}: state the question a reviewer is being asked to answer`,
        );
      }
      continue;
    }
    if (!alignment.verifiedAt || !/^\d{4}-\d{2}-\d{2}$/.test(alignment.verifiedAt)) {
      errors.push(`${label}: verifiedAt must be an ISO date`);
    }
    if (!alignment.verifiedBy || UNVERIFIED_REVIEWER.test(alignment.verifiedBy)) {
      errors.push(
        `${label}: verifiedBy ${JSON.stringify(alignment.verifiedBy)} is a placeholder`,
      );
    }
  }
  return errors;
}

export function loadReviewedBlockAlignmentTable(
  path: string,
  extract: TnDistrictSourceExtract,
): ReviewedBlockAlignmentTable {
  const parsed = JSON.parse(
    readFileSync(path, "utf8"),
  ) as ReviewedBlockAlignmentTable;
  const errors = validateReviewedBlockAlignmentTable(parsed, extract);
  if (errors.length > 0) {
    throw new Error(
      `Invalid reviewed block alignment table ${path}:\n- ${errors.join("\n- ")}`,
    );
  }
  return parsed;
}

export function loadTnDistrictCrosswalkProposal(
  path: string,
  extract: TnDistrictSourceExtract,
): TnDistrictCrosswalkProposal {
  const parsed = JSON.parse(
    readFileSync(path, "utf8"),
  ) as TnDistrictCrosswalkProposal;
  const errors = validateTnDistrictCrosswalkProposal(parsed, extract);
  if (errors.length > 0) {
    throw new Error(
      `Invalid district crosswalk proposal ${path}:\n- ${errors.join("\n- ")}`,
    );
  }
  return parsed;
}

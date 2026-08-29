import assert from "node:assert/strict";
import test from "node:test";

import type { TnDistrictSourceExtract } from "./acquisition-model";
import { computeRecordsSha256 } from "./acquisition-validation";
import {
  CROSSWALK_FOLDING_VERSION,
  CROSSWALK_MATCH_PROCEDURE_VERSION,
  MACHINE_MATCH_CLASSES,
  buildTnDistrictCrosswalk,
  collectCensusSourceUnits,
  foldTamilPlaceName,
  loadReviewedBlockAlignmentTable,
  validateReviewedBlockAlignmentTable,
  validateTnDistrictCrosswalkProposal,
} from "./tn-crosswalk";
import type { ReviewedBlockAlignmentTable } from "./tn-crosswalk";
import {
  FIXTURE_DISTRICTS,
  buildMiniProposal,
  fixturePath,
  loadMiniExtract,
} from "./test-support";

const thanjavur = loadMiniExtract("thanjavur");
const tiruchirappalli = loadMiniExtract("tiruchirappalli");
const proposal = buildMiniProposal("thanjavur", thanjavur);

test("transliteration folding collapses the known Tamil Nadu spelling variants", () => {
  for (const [left, right] of [
    ["Pullampady", "Pullambadi"],
    ["Vaiyampatty", "Vaiyampatti"],
    ["Ammapettai", "AMMAPET"],
  ]) {
    assert.equal(foldTamilPlaceName(left), foldTamilPlaceName(right), `${left} / ${right}`);
  }
  assert.notEqual(foldTamilPlaceName("Chathirappatti"), foldTamilPlaceName("P.N. Chathiram"));
  // A vowel swap inside the stem is not folded away: Thiruverumbur and
  // THIRUVERAMBUR align through a reviewed block row, not through folding.
  assert.notEqual(foldTamilPlaceName("Thiruverumbur"), foldTamilPlaceName("THIRUVERAMBUR"));
});

test("the fixture crosswalk carries its versions and binds every place once per axis", () => {
  assert.equal(proposal.foldingVersion, CROSSWALK_FOLDING_VERSION);
  assert.equal(proposal.matchProcedureVersion, CROSSWALK_MATCH_PROCEDURE_VERSION);
  for (const district of FIXTURE_DISTRICTS) {
    const extract = loadMiniExtract(district.slug);
    const mini = buildMiniProposal(district.slug, extract);
    assert.equal(mini.summary.lgdGramPanchayats, district.panchayats);
    assert.equal(mini.summary.lgdBlocks, 1);
    for (const axis of ["jjm", "census"] as const) {
      const result = mini[axis];
      const all = [
        ...result.accepted.map((match) => match.lgdGramPanchayatCode),
        ...result.review.lgdGramPanchayats.map((ref) => ref.lgdGramPanchayatCode),
      ];
      assert.equal(new Set(all).size, all.length, `${axis}: duplicate LGD record`);
      assert.equal(all.length, district.panchayats, `${axis}: LGD records unaccounted for`);
      const ids = [
        ...result.accepted.map((match) => match.sourceUnitId),
        ...result.review.sourceUnits.map((entry) => entry.sourceUnitId),
      ];
      assert.equal(new Set(ids).size, ids.length, `${axis}: duplicate source unit`);
      assert.equal(ids.length, mini.summary[axis].sourceUnits);
      for (const match of result.accepted) {
        assert.ok(MACHINE_MATCH_CLASSES.includes(match.matchClass));
        assert.equal(match.receipt.foldedKey, foldTamilPlaceName(match.receipt.sourceName));
      }
      for (const entry of result.review.sourceUnits) {
        if (entry.reason === "block-not-aligned") continue;
        assert.ok(entry.candidates.length > 0, `${entry.sourceUnitId} deferred with no candidates`);
      }
    }
    assert.deepEqual(validateTnDistrictCrosswalkProposal(mini, extract), []);
  }
});

test("multi-Panchayat Census memberships are preserved exactly", () => {
  const membership = proposal.censusMembership;
  assert.equal(membership.villageRows, thanjavur.sources.census.recordCount);
  assert.equal(membership.villagesCovered, membership.villageRows);
  const units = collectCensusSourceUnits(thanjavur.sources.census.records);
  const pairs = units.reduce((total, unit) => total + unit.villageCodes.length, 0);
  assert.ok(pairs >= membership.villageRows);
});

test("ambiguity is deferred rather than resolved by iteration order", () => {
  const shuffled = {
    ...thanjavur,
    sources: {
      ...thanjavur.sources,
      jjm: {
        ...thanjavur.sources.jjm,
        records: [...thanjavur.sources.jjm.records].reverse(),
      },
    },
  };
  const reordered = buildTnDistrictCrosswalk(shuffled, {
    id: "thanjavur-crosswalk-v1",
    proposedAt: thanjavur.acquiredAt,
  });
  assert.deepEqual(reordered.jjm.accepted, proposal.jjm.accepted);
  assert.deepEqual(reordered.jjm.review.sourceUnits, proposal.jjm.review.sourceUnits);
});

test("a proposal from a different extract is rejected as stale", () => {
  const errors = validateTnDistrictCrosswalkProposal(proposal, tiruchirappalli);
  assert.ok(errors.some((error) => error.includes("planId")));
});

test("a proposal is rejected once the source records move under it", () => {
  const moved = structuredClone(thanjavur) as TnDistrictSourceExtract;
  moved.sources.jjm.records[0].gpName = "Renamed";
  moved.sources.jjm.recordsSha256 = computeRecordsSha256(moved.sources.jjm.records);
  const errors = validateTnDistrictCrosswalkProposal(proposal, moved);
  assert.ok(errors.some((error) => error.includes("sourceRecordDigests.jjm")));
});

test("a raw-exact name beats a fold collision in the same block", () => {
  // Every accepted exact match must pair identical raw names, never a fold.
  for (const match of proposal.jjm.accepted.filter((m) => m.matchClass === "exact")) {
    assert.equal(
      match.receipt.sourceName.trim().toLowerCase(),
      match.receipt.lgdName.trim().toLowerCase(),
    );
  }
});

test("a reviewed block alignment cannot claim one source block twice", () => {
  const jjmBlockId = tiruchirappalli.sources.jjm.records[0].blockId;
  const blockCode = tiruchirappalli.sources.tnrdLgd.records[0].blockCode;
  const table: ReviewedBlockAlignmentTable = {
    schemaVersion: 1,
    planId: tiruchirappalli.planId,
    alignments: [
      { lgdBlockCode: blockCode, jjmBlockId, status: "verified", verifiedAt: "2026-07-25", verifiedBy: "test" },
      { lgdBlockCode: blockCode, jjmBlockId, status: "verified", verifiedAt: "2026-07-25", verifiedBy: "test" },
    ],
  };
  const errors = validateReviewedBlockAlignmentTable(table, tiruchirappalli);
  assert.ok(errors.some((error) => error.includes("claimed twice")));
  assert.ok(errors.some((error) => error.includes("affirmed more than once")));
});

test("a reviewed block alignment outranks folding and recovers a misnamed block", () => {
  // Rename the JJM block so no fold can align it: every unit is stranded.
  const renamed = structuredClone(tiruchirappalli) as TnDistrictSourceExtract;
  for (const record of renamed.sources.jjm.records) record.blockName = "Unrelated Name";
  renamed.sources.jjm.recordsSha256 = computeRecordsSha256(renamed.sources.jjm.records);
  const base = buildTnDistrictCrosswalk(renamed, { id: "t", proposedAt: "2026-07-25" });
  assert.equal(base.summary.jjm.accepted, 0);
  assert.ok(base.jjm.review.sourceUnits.every((entry) => entry.reason === "block-not-aligned"));
  const row = {
    lgdBlockCode: renamed.sources.tnrdLgd.records[0].blockCode,
    jjmBlockId: renamed.sources.jjm.records[0].blockId,
    question: "Same block?",
  };
  const proposed = buildTnDistrictCrosswalk(renamed, {
    id: "t",
    proposedAt: "2026-07-25",
    reviewedBlockAlignments: [{ ...row, status: "proposed" }],
  });
  const rejected = buildTnDistrictCrosswalk(renamed, {
    id: "t",
    proposedAt: "2026-07-25",
    reviewedBlockAlignments: [{ ...row, status: "rejected" }],
  });
  assert.ok(proposed.summary.jjm.accepted > 0, "a proposed row binds downstream");
  assert.equal(proposed.blocks.filter((block) => block.jjmBasis === "proposed").length, 1);
  assert.equal(rejected.summary.jjm.accepted, 0, "a rejected row never binds");
});

test("the tracked Tiruchirappalli block row is a proposal, not a claim", () => {
  const table = loadReviewedBlockAlignmentTable(
    fixturePath("tiruchirappalli", "block-alignment.json"),
    tiruchirappalli,
  );
  assert.equal(table.alignments.length, 1);
  for (const alignment of table.alignments) {
    assert.equal(alignment.status, "proposed");
    assert.ok(alignment.question && alignment.question.length > 0);
    assert.equal(alignment.verifiedBy, undefined);
  }
});

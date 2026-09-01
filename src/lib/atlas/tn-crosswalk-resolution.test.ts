import assert from "node:assert/strict";
import test from "node:test";

import type { TnDistrictSourceExtract } from "./acquisition-model";
import { computeRecordsSha256 } from "./acquisition-validation";
import { buildTnDistrictCrosswalk } from "./tn-crosswalk";
import {
  buildCanonicalCrosswalk,
  validateTnDistrictCrosswalkResolution,
} from "./tn-crosswalk-resolution";
import type {
  CrosswalkResolutionDecision,
  TnDistrictCrosswalkResolution,
} from "./tn-crosswalk-resolution";
import { buildMiniProposal, loadMiniExtract, loadMiniResolution } from "./test-support";

/**
 * Two JJM units renamed past any fold, so both are deferred with the two
 * unclaimed Panchayats as their closed candidate set. Two, not one: with one
 * deferred unit and one unclaimed record, block elimination would bind it.
 */
function deferredExtract(): {
  extract: TnDistrictSourceExtract;
  renamed: Array<{ unitId: string; lgdCode: string }>;
} {
  const extract = structuredClone(loadMiniExtract("thanjavur")) as TnDistrictSourceExtract;
  const base = buildTnDistrictCrosswalk(extract, { id: "seed", proposedAt: "2026-07-25" });
  const renamed = base.jjm.accepted.slice(0, 2).map((match) => ({
    unitId: match.sourceUnitId,
    lgdCode: match.lgdGramPanchayatCode,
  }));
  // Distinct nonsense names: two units folding to the same key would be
  // deferred as a source-name collision, which is a different case.
  const nonsense = ["Zqa", "Zqb"];
  for (const record of extract.sources.jjm.records) {
    const unitId = `${record.blockId}/${record.gpId}`;
    const index = renamed.findIndex((entry) => entry.unitId === unitId);
    if (index >= 0) record.gpName = nonsense[index];
  }
  extract.sources.jjm.recordsSha256 = computeRecordsSha256(extract.sources.jjm.records);
  return { extract, renamed };
}

const { extract, renamed } = deferredExtract();
const proposal = buildTnDistrictCrosswalk(extract, {
  id: "thanjavur-crosswalk-v1",
  proposedAt: extract.acquiredAt,
});
const staged: TnDistrictCrosswalkResolution = {
  schemaVersion: 1,
  id: "thanjavur-crosswalk-resolution-v1",
  planId: proposal.planId,
  proposalId: proposal.id,
  foldingVersion: proposal.foldingVersion,
  matchProcedureVersion: proposal.matchProcedureVersion,
  sourceRecordDigests: proposal.sourceRecordDigests,
  decisions: renamed.map(
    (entry): CrosswalkResolutionDecision => ({
      axis: "jjm",
      sourceUnitId: entry.unitId,
      lgdGramPanchayatCode: entry.lgdCode,
      status: "proposed",
      matchClass: "proposed-pairing",
      evidence: "Staged by the test from the closed candidate set.",
      question: "Same Panchayat?",
    }),
  ),
};

test("renaming two units defers them both with a closed candidate set", () => {
  assert.equal(proposal.jjm.review.sourceUnits.length, 2);
  for (const entry of proposal.jjm.review.sourceUnits) {
    assert.equal(entry.reason, "no-name-match-in-block");
    assert.equal(entry.candidates.length, 2);
  }
  assert.deepEqual(validateTnDistrictCrosswalkResolution(staged, proposal), []);
});

test("a proposed decision may not masquerade as verified", () => {
  const tampered = {
    ...staged,
    decisions: [{ ...staged.decisions[0], matchClass: "human-affirmed" as const }],
  };
  const errors = validateTnDistrictCrosswalkResolution(tampered, proposal);
  assert.ok(errors.some((error) => error.includes("proposed-pairing")));
});

test("a verified decision needs a real verifier and a reviewed method", () => {
  const tampered = {
    ...staged,
    decisions: [
      { ...staged.decisions[0], status: "verified" as const, verifiedBy: "PENDING", verifiedAt: "2026-07-25" },
    ],
  };
  const errors = validateTnDistrictCrosswalkResolution(tampered, proposal);
  assert.ok(errors.some((error) => error.includes("placeholder")));
  assert.ok(errors.some((error) => error.includes("reviewed match method")));
});

test("a decision may not step outside its offered candidate set", () => {
  const outside = proposal.jjm.accepted[0].lgdGramPanchayatCode;
  const tampered = {
    ...staged,
    decisions: [{ ...staged.decisions[0], lgdGramPanchayatCode: outside }],
  };
  const errors = validateTnDistrictCrosswalkResolution(tampered, proposal);
  assert.ok(errors.some((error) => error.includes("outside the candidate set")));
});

test("a decision may not bind a Gram Panchayat twice on one axis", () => {
  const [first, second] = staged.decisions;
  const tampered = {
    ...staged,
    decisions: [first, { ...second, lgdGramPanchayatCode: first.lgdGramPanchayatCode }],
  };
  const errors = validateTnDistrictCrosswalkResolution(tampered, proposal);
  assert.ok(errors.some((error) => error.includes("already bound")));
});

test("a decision may not target an already accepted source unit", () => {
  const accepted = proposal.jjm.accepted[0];
  const tampered = {
    ...staged,
    decisions: [{ ...staged.decisions[0], sourceUnitId: accepted.sourceUnitId, lgdGramPanchayatCode: null }],
  };
  const errors = validateTnDistrictCrosswalkResolution(tampered, proposal);
  assert.ok(errors.some((error) => error.includes("only review-queue entries")));
});

test("a resolution reviewed against other source records is rejected", () => {
  const tampered = {
    ...staged,
    sourceRecordDigests: { ...staged.sourceRecordDigests, jjm: "0".repeat(64) },
  };
  const errors = validateTnDistrictCrosswalkResolution(tampered, proposal);
  assert.ok(errors.some((error) => error.includes("different source records")));
});

test("the canonical crosswalk binds every Gram Panchayat once and keeps each method", () => {
  const canonical = buildCanonicalCrosswalk(proposal, [staged]);
  assert.equal(canonical.records.length, proposal.summary.lgdGramPanchayats);
  assert.equal(
    new Set(canonical.records.map((record) => record.lgdGramPanchayatCode)).size,
    canonical.records.length,
  );
  assert.equal(canonical.summary.jjmBound, proposal.summary.lgdGramPanchayats);
  assert.equal(canonical.summary.byMatchClass["proposed-pairing"], 2);
  assert.equal(canonical.summary.verifiedBindings, 0);
  for (const entry of renamed) {
    const record = canonical.records.find((r) => r.lgdGramPanchayatCode === entry.lgdCode);
    assert.equal(record?.jjm?.matchClass, "proposed-pairing");
    assert.equal(record?.jjm?.status, "proposed");
  }
});

test("a rejected decision never binds", () => {
  const rejected = {
    ...staged,
    decisions: staged.decisions.map((decision) => ({ ...decision, status: "rejected" as const })),
  };
  const canonical = buildCanonicalCrosswalk(proposal, [rejected]);
  assert.equal(canonical.summary.jjmBound, proposal.summary.jjm.accepted);
  assert.equal(canonical.summary.byMatchClass["proposed-pairing"], undefined);
});

test("the canonical crosswalk refuses to rebind an axis", () => {
  const duplicate = { ...staged, decisions: [staged.decisions[0], staged.decisions[0]] };
  assert.throws(() => buildCanonicalCrosswalk(proposal, [duplicate]), /rebinds/);
});

test("the tracked fixture resolutions load against their own proposals", () => {
  for (const slug of ["thanjavur", "tiruchirappalli"]) {
    const mini = buildMiniProposal(slug);
    const resolution = loadMiniResolution(slug, mini);
    assert.equal(resolution.proposalId, mini.id);
    for (const decision of resolution.decisions) {
      assert.equal(decision.status, "proposed");
    }
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import type { BriefsShard } from "./artifacts";
import type { PlaceEvidenceInputs } from "./capability-evidence";
import {
  BRIEF_REQUIRED_CAPABILITIES,
  buildHeadlineFacts,
  deriveVerdict,
  summarizeBriefs,
  validatePlaceBrief,
} from "./place-brief";
import type { PlaceBrief } from "./place-brief";
import { readFixture } from "./test-support";

const thanjavur = readFixture<BriefsShard>("thanjavur", "briefs", "6633.json").briefs;
const tiruchirappalli = readFixture<BriefsShard>("tiruchirappalli", "briefs", "6684.json").briefs;

const baseInputs = (overrides: Partial<PlaceEvidenceInputs>): PlaceEvidenceInputs => ({
  lgdGramPanchayatCode: "228400",
  lgdGramPanchayatName: "Poondi",
  identity: undefined,
  boundary: undefined,
  jjm: undefined,
  census: undefined,
  groundwater: undefined,
  rainfall: undefined,
  rainfallWindow: undefined,
  waterBodies: undefined,
  ...overrides,
});

test("universal taps on an over-drawn aquifer is the finding, not the count", () => {
  const verdict = deriveVerdict(
    baseInputs({
      jjm: { households: 1143, tapCoveragePercent: 100 } as never,
      groundwater: { category: "over_exploited", stageOfExtractionPercent: 124.77, talukName: "Thiruvidaimarudhur" } as never,
    }),
  );
  assert.equal(verdict?.tone, "warning");
  assert.match(verdict?.title ?? "", /aquifer in deficit/);
  assert.match(verdict?.body ?? "", /1,143/);
  assert.match(verdict?.body ?? "", /124\.8 percent/);
  assert.doesNotMatch(verdict?.body ?? "", /124\.77/);
});

test("the extraction stage is shown to a tenth wherever it appears", () => {
  const inputs = baseInputs({
    jjm: { households: 680, tapCoveragePercent: 100 } as never,
    groundwater: { category: "over_exploited", stageOfExtractionPercent: 100.7308, talukName: "Papanasam" } as never,
  });
  assert.match(deriveVerdict(inputs)?.body ?? "", /100\.7 percent/);
  const fact = buildHeadlineFacts(inputs).find((f) => f.label.startsWith("Groundwater extraction"));
  assert.equal(fact?.value, "100.7%");
  for (const brief of [...thanjavur, ...tiruchirappalli]) {
    for (const candidate of brief.headlineFacts) {
      if (!candidate.label.startsWith("Groundwater extraction")) continue;
      assert.doesNotMatch(candidate.value, /\.\d{2,}%/, `${brief.placeId} shows ${candidate.value}`);
    }
  }
});

test("an incomplete service on an over-drawn aquifer is the worst case", () => {
  const verdict = deriveVerdict(
    baseInputs({
      jjm: { households: 500, tapCoveragePercent: 62 } as never,
      groundwater: { category: "over_exploited", stageOfExtractionPercent: 143.04, talukName: "Manapparai" } as never,
    }),
  );
  assert.equal(verdict?.tone, "blocked");
  assert.match(verdict?.body ?? "", /already over-drawn/);
});

test("full coverage with no groundwater assessment still reaches a verdict", () => {
  const verdict = deriveVerdict(baseInputs({ jjm: { households: 200, tapCoveragePercent: 100 } as never }));
  assert.equal(verdict?.tone, "neutral");
  assert.match(verdict?.title ?? "", /not characterised/);
});

test("every headline fact carries its caveat", () => {
  const facts = buildHeadlineFacts(
    baseInputs({
      jjm: {
        households: 1143, householdConnections: 1143, tapCoveragePercent: 100, habitationCount: 3, sourceCount: 8,
        sourceTypes: ["Deep Tubewell"], sampleRowCount: 94, latestSampleStatus: "Safe", latestSampleDate: "2026-07-16",
      } as never,
      groundwater: { category: "over_exploited", stageOfExtractionPercent: 108.16, talukName: "Orathanadu" } as never,
    }),
  );
  assert.ok(facts.length >= 4);
  for (const fact of facts) assert.ok(fact.note.trim().length > 0);
  const groundwaterFact = facts.find((fact) => fact.label.includes("Groundwater"));
  assert.match(groundwaterFact?.note ?? "", /not this Panchayat/);
});

test("every served brief validates, and a published one reaches a verdict", () => {
  for (const brief of [...thanjavur, ...tiruchirappalli]) {
    assert.deepEqual(validatePlaceBrief(brief), [], brief.placeId);
    if (brief.status !== "brief-ready") continue;
    assert.ok(brief.verdict, `${brief.placeId} has no verdict`);
    assert.ok(brief.headlineFacts.length > 0, `${brief.placeId} has no facts`);
  }
  const silent: PlaceBrief = { ...thanjavur[0], verdict: null };
  assert.ok(validatePlaceBrief(silent).some((error) => error.includes("must reach a verdict")));
});

test("a held place may not leak a verdict or headline numbers", () => {
  const leaking: PlaceBrief = {
    ...thanjavur[0],
    status: "directory-only",
    statusReason: "Held back because place-identity-and-composition is not established for this place.",
  };
  const errors = validatePlaceBrief(leaking);
  assert.ok(errors.some((error) => error.includes("must not publish a verdict")));
  assert.ok(errors.some((error) => error.includes("must not publish headline facts")));
});

test("the two fixture blocks tell different stories", () => {
  // Sethubavachatram straddles a semi-critical and an over-exploited taluk;
  // Thiruverambur sits wholly on a safe one. The block roll-ups exist to keep
  // that contrast visible.
  const delta = summarizeBriefs(thanjavur);
  assert.equal(delta.places, 15);
  assert.equal(delta.briefReady, 15);
  assert.deepEqual(delta.byTone, { neutral: 11, warning: 4 });
  const upland = summarizeBriefs(tiruchirappalli);
  assert.equal(upland.places, 15);
  assert.deepEqual(upland.byTone, { positive: 15 });
  for (const summary of [delta, upland]) {
    assert.ok(summary.commonestGaps.some((gap) => gap.capabilityId === "drinking-water-reliability"));
  }
});

test("the required floor is identity first", () => {
  assert.equal(BRIEF_REQUIRED_CAPABILITIES[0], "place-identity-and-composition");
});

test("a clean sampling series is caveated rather than presented as reassurance", () => {
  const withQuality = [...thanjavur, ...tiruchirappalli].filter((brief) =>
    brief.headlineFacts.some((fact) => fact.label.startsWith("Last water-quality")),
  );
  assert.ok(withQuality.length > 0);
  for (const brief of withQuality) {
    const fact = brief.headlineFacts.find((f) => f.label.startsWith("Last water-quality"));
    assert.match(fact?.value ?? "", /^\d+d ago$|^[A-Za-z]/);
    assert.match(fact?.note ?? "", /recorded unsafe/);
  }
});

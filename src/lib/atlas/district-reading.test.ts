import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyIrrigation,
  composeDistrictVerdict,
  deriveDistrictTone,
  listNames,
  type VerdictSignals,
} from "./district-reading";
import { FIXTURE_DISTRICTS, buildFixtureReading } from "./test-support";

const TONES = new Set(["positive", "warning", "neutral", "blocked"]);

function signals(overrides: Partial<VerdictSignals>): VerdictSignals {
  return {
    source: "canal",
    canalPercent: 80,
    wellPercent: 20,
    taluks: 9,
    overExploited: 0,
    critical: 0,
    semiCritical: 0,
    safe: 9,
    tapPercent: 100,
    households: 1000,
    gapBlocks: [],
    metturBasin: true,
    ...overrides,
  };
}

/** Every string in the reading, however nested, so the copy rules can be
 *  checked once rather than per field. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out));
  return out;
}

test("the tone rule covers the vocabulary and nothing outside it", () => {
  assert.equal(deriveDistrictTone(signals({})), "positive");
  assert.equal(deriveDistrictTone(signals({ overExploited: 6, critical: 1, safe: 2 })), "warning");
  assert.equal(
    deriveDistrictTone(signals({ source: "well", overExploited: 4, safe: 5, tapPercent: 94 })),
    "warning",
  );
  assert.equal(
    deriveDistrictTone(signals({ source: "well", overExploited: 4, safe: 5, tapPercent: 70 })),
    "blocked",
  );
  assert.equal(deriveDistrictTone(signals({ taluks: 0, safe: 0, tapPercent: null })), "neutral");
  assert.equal(deriveDistrictTone(signals({ overExploited: 1, safe: 8, tapPercent: 100 })), "neutral");
  assert.equal(deriveDistrictTone(signals({ tapPercent: 60 })), "warning");
});

test("the verdict is one sentence, reads the exact-100 figure as a convention, and names no officer", () => {
  const verdict = composeDistrictVerdict(signals({ overExploited: 6, critical: 1, safe: 2 }));
  assert.ok(verdict.sentence.endsWith("."));
  assert.equal(verdict.sentence.split(". ").length, 1);
  assert.match(verdict.sentence, /released at Mettur/);
  assert.match(verdict.sentence, /6 of 9 taluks already draw more groundwater than recharges and 1 more is close/);
  assert.match(verdict.sentence, /reporting convention rather than a measurement/);
  assert.ok(verdict.nextSteps.some((s) => /Mettur/.test(s)));
  assert.ok(verdict.nextSteps.some((s) => /District Environment Plan/.test(s)));
  assert.doesNotMatch(verdict.sentence, /officer|department|collector|failed|neglect/i);
});

test("a well-fed district with its gap on the no-canal blocks says so", () => {
  const verdict = composeDistrictVerdict(
    signals({
      source: "well",
      canalPercent: 40,
      wellPercent: 60,
      overExploited: 4,
      safe: 5,
      tapPercent: 94,
      gapBlocks: [
        { name: "Vaiyampatty", tapPercent: 47, canalPercent: 0, inDeficitTaluk: true },
        { name: "Marungapuri", tapPercent: 65.9, canalPercent: 0, inDeficitTaluk: true },
        { name: "Manapparai", tapPercent: 97, canalPercent: 0, inDeficitTaluk: true },
      ],
    }),
  );
  assert.match(verdict.sentence, /^60% of the irrigated farmland was watered from wells at the 2011 Census/);
  assert.match(verdict.sentence, /blocks without canal water, Vaiyampatty and Marungapuri/);
  assert.equal(verdict.tone, "warning");
});

test("irrigation is classified by the majority source", () => {
  assert.equal(classifyIrrigation(80, 20), "canal");
  assert.equal(classifyIrrigation(40, 60), "well");
  assert.equal(classifyIrrigation(45, 45), "mixed");
  assert.equal(classifyIrrigation(null, null), null);
  assert.equal(listNames(["A", "B", "C"]), "A, B and C");
});

test("both fixture districts produce a complete reading from the same code", () => {
  for (const fixture of FIXTURE_DISTRICTS) {
    const reading = buildFixtureReading(fixture.slug);
    assert.ok(reading, `${fixture.slug} has no reading`);
    assert.ok(TONES.has(reading.verdict.tone));
    assert.equal(reading.facts.length, 3);
    for (const fact of reading.facts) {
      assert.ok(fact.asOf.length > 0, `${fact.label} carries no date`);
      assert.ok(fact.note.length > 0);
    }
    assert.match(reading.asOf, /^\d{4}-\d{2}-\d{2}$/, "asOf is read from the briefs");
    assert.ok(reading.blocks.length === reading.blockCount);
    assert.ok(reading.groundwater.finding.length > 0);
    assert.ok(reading.vintages.length >= 6);
    for (const row of reading.vintages) {
      assert.notEqual(row.produced, "unstated", `${row.label} has no produced_at`);
    }
    // The copy rules: no em-dashes, and nothing attributed to an officer.
    for (const text of strings(reading)) {
      assert.doesNotMatch(text, /—/, `em-dash in: ${text}`);
    }
  }
});

test("Thanjavur's fixture block reads as canal-fed on an over-drawn aquifer with the 100.0% artifact named", () => {
  const reading = buildFixtureReading("thanjavur");
  assert.equal(reading.irrigation.source, "canal");
  assert.ok(reading.mettur, "a Cauvery delta district carries the Mettur reading");
  assert.match(reading.mettur!.gap, /not wired/);
  assert.ok(reading.blockFindings.artifact, "exactly 100.0% taps is flagged");
  assert.match(reading.blockFindings.artifact!, /reporting convention/);
  assert.equal(reading.verdict.tone, "warning");
  assert.ok(reading.groundwater.categories.over_exploited > 0);
});

test("the Tiruchirappalli fixture reads its own numbers, not Thanjavur's", () => {
  const trichy = buildFixtureReading("tiruchirappalli");
  const thanjavur = buildFixtureReading("thanjavur");
  assert.notEqual(trichy.verdict.sentence, thanjavur.verdict.sentence);
  assert.notEqual(trichy.groundwater.finding, thanjavur.groundwater.finding);
  assert.ok(trichy.groundwater.categories.safe > 0);
  assert.ok(trichy.drinking.total > 0);
});

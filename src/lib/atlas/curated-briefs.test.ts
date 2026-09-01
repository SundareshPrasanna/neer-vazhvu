import assert from "node:assert/strict";
import test from "node:test";

import {
  curatedBriefCount,
  curatedBriefsOf,
  findCuratedBrief,
  getCuratedBrief,
  getCuratedBriefs,
} from "./curated-briefs";
import type { CuratedBriefsArtifact } from "./curated-briefs";
import { findBrief } from "./district-directory";
import { districtBySlug, fixtureBriefs, readFixture, readFixtureArtifact } from "./test-support";

const CURATED_LGD_CODES = ["228400", "228711", "228911", "228767"];

const thanjavur = curatedBriefsOf(
  districtBySlug("thanjavur"),
  readFixture<CuratedBriefsArtifact>("thanjavur", "curated-briefs.json"),
);

test("the reviewed Thanjavur briefs resolve by LGD code", () => {
  assert.equal(thanjavur.length, 4);
  for (const lgdCode of CURATED_LGD_CODES) {
    const curated = findCuratedBrief(thanjavur, lgdCode);
    assert.ok(curated, `${lgdCode} should have a reviewed brief`);
    assert.equal(curated.lgdCode, lgdCode);
    assert.ok(curated.verdictTitle.length > 0);
    assert.ok(curated.insights.length > 0);
    assert.ok(curated.headlineFacts.length > 0);
    assert.ok(curated.nextEvidence.length > 0);
    assert.match(curated.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(curated.evidence.every((source) => source.sourceUrl.startsWith("https://")));
  }
});

test("a district with no reviewed briefs returns none", () => {
  const tiruchirappalli = districtBySlug("tiruchirappalli");
  assert.equal(
    readFixtureArtifact<CuratedBriefsArtifact>("tiruchirappalli", "curated-briefs"),
    undefined,
  );
  assert.deepEqual(curatedBriefsOf(tiruchirappalli, undefined), []);
  // The registry flag gates the served file too: a stray artifact cannot publish itself.
  assert.deepEqual(curatedBriefsOf(tiruchirappalli, { briefs: thanjavur } as never), []);
  assert.equal(curatedBriefCount("tiruchirappalli"), 0);
  assert.equal(getCuratedBrief("tiruchirappalli", "230382"), undefined);
  assert.deepEqual(getCuratedBriefs("madurai"), []);
});

test("a reviewed brief says something the generated one cannot", () => {
  const curated = findCuratedBrief(thanjavur, "228711");
  const generated = findBrief(fixtureBriefs("thanjavur"), "228711");
  assert.ok(curated && generated);
  // Both describe Kuruvikkarambai, but only the reviewed one carries a
  // reading of the place rather than a restatement of its numbers.
  assert.notEqual(curated.verdictTitle, generated.verdict?.title);
  assert.ok(curated.insights.some((insight) => insight.text.length > 80));
  // The generated brief supplies the named gaps the page shows underneath.
  assert.ok(generated.gaps.length > 0);
});

test("the curated artifact is human-authored data with a full envelope", () => {
  const artifact = readFixture<CuratedBriefsArtifact>("thanjavur", "curated-briefs.json");
  assert.equal(artifact.dataset, "atlas/curated-briefs");
  assert.equal(artifact.provenance.method, "manual");
  assert.equal(artifact.provenance.produced_by, "manual");
  assert.ok(artifact.provenance.sources.every((source) => source.id || (source.closed && source.as_of)));
  assert.equal(artifact.briefs.length, 4);
});

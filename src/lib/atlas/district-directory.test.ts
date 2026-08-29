import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDistrictDirectory,
  directoryPlaceName,
  findBrief,
  getDistrictBriefs,
  getDistrictDirectory,
} from "./district-directory";
import {
  FIXTURE_DISTRICTS,
  buildAllFixtureDirectories,
  districtBySlug,
  fixtureBriefs,
  readFixtureArtifacts,
} from "./test-support";

test("TNRD's shouting names are shown in title case, mixed-case names untouched", () => {
  assert.equal(directoryPlaceName("KURUVIKKARAMBAI"), "Kuruvikkarambai");
  assert.equal(directoryPlaceName("Panaiyakuruchi"), "Panaiyakuruchi");
  assert.equal(directoryPlaceName("P.N. CHATHIRAM"), "P.N. Chathiram");
});

for (const fixture of FIXTURE_DISTRICTS) {
  test(`${fixture.slug}: the public directory is built from the served artifacts`, () => {
    const directory = buildDistrictDirectory(
      districtBySlug(fixture.slug),
      readFixtureArtifacts(fixture.slug).directory,
      fixtureBriefs(fixture.slug),
    );
    assert.ok(directory);
    assert.equal(directory.panchayats.length, fixture.panchayats);
    assert.equal(directory.blocks.length, 1);
    assert.equal(directory.blocks[0].code, fixture.block);
    assert.equal(directory.blocks[0].panchayatCount, fixture.panchayats);
    assert.ok(directory.lgdSourceAsOf.startsWith("2021-03-11"));
    assert.match(directory.currentMasterAsOf, /^\d{4}-\d{2}-\d{2}$/);
    for (const entry of directory.panchayats) {
      assert.match(entry.lgdCode, /^\d{6}$/);
      assert.notEqual(entry.name, entry.name.toUpperCase(), `${entry.lgdCode} is not shouting`);
      assert.ok(typeof entry.latitude === "number" && typeof entry.longitude === "number");
    }
    // Coverage comes from the briefs, and every fixture place cleared the floor.
    assert.equal(directory.waterProfileCount, fixture.panchayats);
    assert.equal(directory.blocks[0].waterProfileCount, fixture.panchayats);
  });

  test(`${fixture.slug}: briefs resolve by LGD code`, () => {
    const briefs = fixtureBriefs(fixture.slug);
    assert.equal(briefs.length, fixture.panchayats);
    const first = briefs[0];
    assert.equal(findBrief(briefs, first.placeId)?.placeId, first.placeId);
    assert.equal(findBrief(briefs, "000000"), undefined);
  });
}

test("unregistered districts and states resolve to nothing", () => {
  assert.equal(getDistrictDirectory("tn", "madurai"), undefined);
  assert.equal(getDistrictDirectory("ka", "thanjavur"), undefined);
  assert.equal(getDistrictBriefs("madurai").length, 0);
  assert.equal(buildAllFixtureDirectories().length, FIXTURE_DISTRICTS.length);
});

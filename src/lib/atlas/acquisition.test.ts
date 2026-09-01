import assert from "node:assert/strict";
import test from "node:test";

import type { TnDistrictRefreshPlan, TnDistrictSourceExtract } from "./acquisition-model";
import {
  validateTnDistrictRefreshPlan,
  validateTnDistrictSourceExtract,
} from "./acquisition-validation";
import { parseJjmDistrictHtml, parseTnrdLgdText } from "./tn-district-acquisition";
import { resolveReviewedTargets } from "./tn-district-refresh";
import { FIXTURE_DISTRICTS, loadMiniExtract, loadMiniPlan } from "./test-support";

const plan = loadMiniPlan("tiruchirappalli");
const extract = loadMiniExtract("tiruchirappalli");

test("the fixture plans and extracts pass strict validation and agree on counts", () => {
  for (const district of FIXTURE_DISTRICTS) {
    const miniPlan = loadMiniPlan(district.slug);
    const miniExtract = loadMiniExtract(district.slug);
    assert.deepEqual(validateTnDistrictRefreshPlan(miniPlan), []);
    assert.deepEqual(validateTnDistrictSourceExtract(miniExtract), []);
    assert.equal(miniExtract.sources.tnrdLgd.recordCount, district.panchayats);
    assert.equal(
      miniExtract.sources.jjm.recordCount,
      miniPlan.expectedCounts.jjmVillages,
    );
    assert.equal(
      miniExtract.sources.census.recordCount,
      miniPlan.expectedCounts.censusVillages,
    );
  }
});

test("TNRD PDF parser accepts the source's one-space name boundary", () => {
  const records = parseTnrdLgdText(
    [
      "  545      TIRUCHIRAPPALLI   6684    THIRUVERAMBUR     230381    Palanganangudi",
      "  545      TIRUCHIRAPPALLI   6684    THIRUVERAMBUR     230382 Panaiyakuruchi",
      "  544      TIRUVARUR         6668    MANNARGUDI        229826 PULLAMANGALAM",
    ].join("\n"),
    "545",
  );
  assert.equal(records.length, 2);
  assert.equal(records[1].gramPanchayatCode, "230382");
  assert.equal(records[1].gramPanchayatName, "Panaiyakuruchi");
});

test("JJM parser preserves parent paths when a leaf village ID is reused", () => {
  const html = `
    <select id="ddState"><option value="29">Tamil Nadu</option></select>
    <select id="ddDistrict"><option value="445">Tiruchirappalli</option></select>
    <select id="ddList">
      <option value="-1">Select village</option>
      <option value="4610/153861/378166">Block A / GP A / Village X</option>
      <option value="4610/153862/378166">Block A / GP B / Village X</option>
    </select>
  `;
  const records = parseJjmDistrictHtml(html, "29", "445");
  assert.equal(records.length, 2);
  assert.equal(records[0].villageId, records[1].villageId);
  assert.notEqual(records[0].gpId, records[1].gpId);
});

test("JJM parser rejects an exact duplicate source path", () => {
  const html = `
    <select id="ddState"><option value="29">Tamil Nadu</option></select>
    <select id="ddDistrict"><option value="445">Tiruchirappalli</option></select>
    <select id="ddList">
      <option value="4610/153861/378166">Block A / GP A / Village X</option>
      <option value="4610/153861/378166">Block A / GP A / Village X</option>
    </select>
  `;
  assert.throws(() => parseJjmDistrictHtml(html, "29", "445"), /duplicate record paths/);
});

test("reviewed targets resolve by identifier, never by name similarity", () => {
  const resolved = resolveReviewedTargets(plan, extract);
  assert.equal(resolved.size, plan.targets.length);
  const panaiyakuruchi = resolved.get("230382");
  assert.ok(panaiyakuruchi);
  assert.equal(panaiyakuruchi.tnrdLgd.gramPanchayatName, "Panaiyakuruchi");
  assert.equal(panaiyakuruchi.jjm.length, 1);
  assert.deepEqual(
    panaiyakuruchi.census.map((record) => record.villageCode),
    ["636015"],
  );
});

test("refresh fails closed when a district enumeration count drifts", () => {
  const changed = structuredClone(plan) as TnDistrictRefreshPlan;
  changed.expectedCounts.jjmVillages -= 1;
  assert.throws(
    () => resolveReviewedTargets(changed, extract),
    /expectedCounts\.jjmVillages: expected 14, got 15/,
  );
});

test("refresh fails closed when the reviewed crosswalk no longer resolves", () => {
  const changed = structuredClone(plan) as TnDistrictRefreshPlan;
  changed.targets[0].jjmGramPanchayatId = "999999";
  assert.throws(
    () => resolveReviewedTargets(changed, extract),
    /reviewed JJM GP has no enumerated villages/,
  );
});

test("refresh rejects source substitution even when records look valid", () => {
  const substituted = structuredClone(extract) as TnDistrictSourceExtract;
  substituted.sources.jjm.sourceUrl = "https://example.invalid/jjm";
  assert.throws(() => resolveReviewedTargets(plan, substituted), /jjm\.sourceUrl: expected/);
});

test("reviewed complete cardinality fails closed instead of trusting observed rows", () => {
  const changed = structuredClone(plan) as TnDistrictRefreshPlan;
  changed.targets[0].mappingExpectations.jjm.expectedRecordCount = 2;
  assert.throws(
    () => resolveReviewedTargets(changed, extract),
    /JJM mapping: reviewed complete expectation is 2, found 1/,
  );
});

test("reviewed Census exclusions cannot point back to the target Panchayat", () => {
  const changed = structuredClone(plan) as TnDistrictRefreshPlan;
  const target = changed.targets[0];
  target.censusComposition.exclusions.push({
    kind: "village",
    code: "999999",
    name: "Elsewhere",
    reason: "belongs-to-other-gram-panchayat",
    ownerLgdGramPanchayatCode: target.tnrdLgdGramPanchayatCode,
  });
  assert.ok(
    validateTnDistrictRefreshPlan(changed).some((error) =>
      error.includes("must identify a different Panchayat"),
    ),
  );
});

test("source-extract validation rejects duplicate composite JJM paths", () => {
  const invalid = structuredClone(extract) as TnDistrictSourceExtract;
  invalid.sources.jjm.records[1] = structuredClone(invalid.sources.jjm.records[0]);
  assert.ok(
    validateTnDistrictSourceExtract(invalid).some((error) =>
      error.includes("duplicate blockId+gpId+villageId"),
    ),
  );
});

test("source-extract validation detects an edited normalized record", () => {
  const invalid = structuredClone(extract) as TnDistrictSourceExtract;
  invalid.sources.jjm.records[0].villageName = "Unreviewed edit";
  assert.ok(
    validateTnDistrictSourceExtract(invalid).some((error) =>
      error.includes("sources.jjm.recordsSha256: expected"),
    ),
  );
});

test("source-extract validation checks aggregate raw-response digests", () => {
  const invalid = structuredClone(extract) as TnDistrictSourceExtract;
  invalid.sources.jjm.snapshotSha256 = "0".repeat(64);
  assert.ok(
    validateTnDistrictSourceExtract(invalid).some((error) =>
      error.includes("sources.jjm.snapshotSha256: expected"),
    ),
  );
});

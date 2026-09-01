import assert from "node:assert/strict";
import test from "node:test";

import { computeRecordsSha256 } from "./acquisition-validation";
import {
  BOUNDARY_LAYER,
  TNGIS_TERMS_URL,
  reportBoundaryJoin,
  validateTnDistrictBoundaryExtract,
} from "./tn-boundary";
import { FIXTURE_DISTRICTS, loadMiniBoundary, loadMiniIdentity } from "./test-support";

for (const district of FIXTURE_DISTRICTS) {
  const identity = loadMiniIdentity(district.slug);
  const boundary = loadMiniBoundary(district.slug);

  test(`${district.slug} boundaries bind by LGD code with no residual`, () => {
    const report = reportBoundaryJoin(boundary, identity);
    assert.equal(report.joined, district.panchayats);
    assert.equal(report.boundaryRecords, district.panchayats);
    assert.deepEqual(report.missingBoundary, []);
    assert.deepEqual(report.unmatchedBoundary, []);
    assert.deepEqual(report.blockMismatches, []);
    assert.deepEqual(report.duplicateGeometries, []);
  });

  test(`${district.slug} boundary geometry is non-degenerate and inside Tamil Nadu`, () => {
    for (const record of boundary.records) {
      assert.ok(record.areaHectares > 0, `${record.name} has no area`);
      assert.ok(record.vertexCount >= 4, `${record.name} has too few vertices`);
      const [minX, minY, maxX, maxY] = record.bbox;
      assert.ok(maxX > minX && maxY > minY, `${record.name} has a null bbox`);
      assert.ok(minX > 76 && maxX < 81.5, `${record.name} is outside Tamil Nadu`);
      assert.ok(minY > 8 && maxY < 14, `${record.name} is outside Tamil Nadu`);
    }
  });

  test(`${district.slug} records the published TNGIS restriction`, () => {
    assert.equal(boundary.source.layer, BOUNDARY_LAYER);
    assert.equal(boundary.source.rights.status, "permission-required");
    assert.equal(boundary.source.rights.termsUrl, TNGIS_TERMS_URL);
    assert.match(boundary.source.rights.termsQuote, /prior approval/);
    assert.equal(boundary.source.rights.approval, null);
    assert.equal(boundary.source.mappingYear, null);
  });
}

const identity = loadMiniIdentity("thanjavur");
const boundary = loadMiniBoundary("thanjavur");

test("a boundary that no Gram Panchayat claims is an error", () => {
  const records = boundary.records.map((record, index) =>
    index === 0 ? { ...record, lgdGramPanchayatCode: "999999" } : record,
  );
  const tampered = { ...boundary, records, recordsSha256: computeRecordsSha256(records) };
  const errors = validateTnDistrictBoundaryExtract(tampered, identity);
  assert.ok(errors.some((error) => error.includes("no boundary")));
  assert.ok(errors.some((error) => error.includes("match no Gram Panchayat")));
});

test("downgrading the TNGIS restriction is rejected", () => {
  const tampered = { ...boundary, source: { ...boundary.source, rights: { ...boundary.source.rights, status: "permitted" as never } } };
  assert.ok(validateTnDistrictBoundaryExtract(tampered, identity).some((error) => error.includes("may not be downgraded")));
});

test("a recorded approval must name a grantor and a written reference", () => {
  const tampered = {
    ...boundary,
    source: {
      ...boundary.source,
      rights: { ...boundary.source.rights, approval: { grantedBy: "", grantedAt: "2026-07-25", reference: "", scope: [] as never[] } },
    },
  };
  const errors = validateTnDistrictBoundaryExtract(tampered, identity);
  assert.ok(errors.some((error) => error.includes("grantor")));
  assert.ok(errors.some((error) => error.includes("must state what it permits")));
});

import assert from "node:assert/strict";
import test from "node:test";

import { computeRecordsSha256 } from "./acquisition-validation";
import { identityFromDirectory, type DistrictDirectoryArtifact } from "./artifacts";
import { loadGroundwaterProjection, loadGroundwaterTaluks } from "./data";
import {
  pointInPolygonRings,
  polygonCentroid,
  validateGroundwaterProjection,
} from "./tn-groundwater-projection";
import { FIXTURE_DISTRICTS, districtBySlug, readFixture } from "./test-support";

const district = districtBySlug("thanjavur");
const directory = readFixture<DistrictDirectoryArtifact>("thanjavur", "directory.json");
const identity = identityFromDirectory(directory);
const groundwater = loadGroundwaterTaluks(district)!;
const projection = loadGroundwaterProjection(district)!;

test("a point inside a ring is inside, and a hole excludes it", () => {
  const square: number[][][] = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]];
  assert.equal(pointInPolygonRings([5, 5], square), true);
  assert.equal(pointInPolygonRings([15, 5], square), false);
  const withHole: number[][][] = [square[0], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]];
  assert.equal(pointInPolygonRings([5, 5], withHole), false);
  assert.equal(pointInPolygonRings([1, 1], withHole), true);
});

test("the centroid of a square is its middle", () => {
  const [x, y] = polygonCentroid([[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]);
  assert.ok(Math.abs(x - 5) < 1e-9);
  assert.ok(Math.abs(y - 5) < 1e-9);
});

for (const fixture of FIXTURE_DISTRICTS) {
  test(`${fixture.slug}: every Gram Panchayat is projected or deferred exactly once`, () => {
    const d = districtBySlug(fixture.slug);
    const served = readFixture<DistrictDirectoryArtifact>(fixture.slug, "directory.json");
    const p = loadGroundwaterProjection(d)!;
    assert.deepEqual(validateGroundwaterProjection(p, identityFromDirectory(served), loadGroundwaterTaluks(d)!), []);
    const codes = [
      ...p.records.map((record) => record.lgdGramPanchayatCode),
      ...p.review.map((entry) => entry.lgdGramPanchayatCode),
    ];
    assert.equal(new Set(codes).size, codes.length);
    assert.equal(codes.length, fixture.panchayats);
    assert.equal(p.summary.gramPanchayats, fixture.panchayats);
    assert.equal(p.summary.projected + p.summary.deferred, fixture.panchayats);
  });
}

test("the projection says what it is: a spatial-intersection view of district evidence", () => {
  assert.equal(projection.dataset, "atlas/groundwater-projection");
  assert.equal(projection.projectionMethod, "spatial-intersection");
  assert.deepEqual(projection.projection?.of, { kind: "district", id: district.scopeId });
  assert.equal(projection.projection?.method, "spatial-intersection");
  assert.ok((projection.projection?.limitations ?? []).some((line) => line.includes("revenue taluk")));
  assert.equal(projection.provenance.method, "derived");
  assert.ok(projection.provenance.internal_inputs?.some((path) => path.endsWith("groundwater-taluks.json")));
});

test("Sethubavachatram block spans two revenue taluks and inherits both categories", () => {
  // This is why a block-to-taluk name match would have been wrong: the two
  // hierarchies are not the same partition of the district.
  assert.equal(projection.summary.talukCoverage, 2);
  assert.equal(projection.summary.blocksSpanningTaluks, 1);
  assert.deepEqual(projection.summary.byCategory, { semi_critical: 11, over_exploited: 4 });
  const kuruvikkarambai = projection.records.find((record) => record.lgdGramPanchayatCode === "228711");
  assert.equal(kuruvikkarambai?.talukName, "Peravurani");
  assert.equal(kuruvikkarambai?.category, "semi_critical");
});

test("a projected category may not drift from its taluk", () => {
  const records = [{ ...projection.records[0], category: "safe" as const }, ...projection.records.slice(1)];
  const tampered = { ...projection, records, recordsSha256: computeRecordsSha256(records) };
  assert.ok(
    validateGroundwaterProjection(tampered, identity, groundwater).some((error) => error.includes("does not match taluk")),
  );
});

test("the projection method cannot be overstated", () => {
  const tampered = { ...projection, projectionMethod: "direct-published" as never };
  assert.ok(
    validateGroundwaterProjection(tampered, identity, groundwater).some((error) => error.includes("spatial intersection only")),
  );
});

test("projection and groundwater extract describe the same assessment year", () => {
  assert.equal(projection.assessmentYear, groundwater.assessmentYear);
  const tampered = { ...projection, assessmentYear: "2021-2022" };
  assert.ok(validateGroundwaterProjection(tampered, identity, groundwater).some((error) => error.includes("assessmentYear")));
});

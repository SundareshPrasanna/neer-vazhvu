import assert from "node:assert/strict";
import test from "node:test";

import type { AcquiredSourceRecordSet } from "./acquisition-model";
import { computeRecordsSha256 } from "./acquisition-validation";
import type {
  LgdDistrictSourceExtract,
  LgdLocalBodyCoverageRecord,
  LgdSubdistrictRecord,
  LgdVillageRecord,
} from "./lgd-acquisition-model";
import { collectLgdGramPanchayats } from "./lgd-district-refresh";
import { buildMembershipGroundwaterProjection, validateGroundwaterProjection } from "./tn-groundwater-projection";
import type { TnDistrictGroundwaterExtract } from "./tn-groundwater";
import type { DistrictIdentity } from "./artifacts";

function recordSet<T>(sourceId: string, records: T[]): AcquiredSourceRecordSet<T> {
  return {
    sourceId,
    sourceUrl: "https://example.test/" + sourceId,
    retrievedAt: "2026-09-01",
    sourceAsOf: "2026-09-01",
    snapshotSha256: "b".repeat(64),
    artifactSha256s: ["b".repeat(64)],
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
}

const subdistricts: LgdSubdistrictRecord[] = [
  { stateCode: "27", districtCode: "494", districtName: "Satara", subdistrictCode: "4264", subdistrictName: "Patan", subdistrictCensus2011Code: "04264" },
  { stateCode: "27", districtCode: "494", districtName: "Satara", subdistrictCode: "4265", subdistrictName: "Karad", subdistrictCensus2011Code: "04265" },
];
const villages: LgdVillageRecord[] = [
  { villageCode: "564320", villageName: "Marul Haveli", villageCensus2011Code: "564320", subdistrictCode: "4264", subdistrictName: "Patan", districtCode: "494", stateCode: "27" },
  { villageCode: "564163", villageName: "Vajegaon", villageCensus2011Code: "564163", subdistrictCode: "4264", subdistrictName: "Patan", districtCode: "494", stateCode: "27" },
  { villageCode: "564500", villageName: "Karad side", villageCensus2011Code: "564500", subdistrictCode: "4265", subdistrictName: "Karad", districtCode: "494", stateCode: "27" },
  { villageCode: "564501", villageName: "Karad side 2", villageCensus2011Code: "564501", subdistrictCode: "4265", subdistrictName: "Karad", districtCode: "494", stateCode: "27" },
];
const coverage = (localBodyCode: string, localBodyName: string, entityCode: string): LgdLocalBodyCoverageRecord => ({
  stateCode: "27",
  localBodyCode,
  localBodyName,
  localBodyNameLocal: "",
  localBodyTypeName: "Village Panchayat",
  entityCode,
  entityName: entityCode,
  entityType: "Village",
  coverageType: "Full",
});

const extract = {
  schemaVersion: 1,
  planId: "mh-satara-v1",
  identityAdapter: "lgd-directory",
  acquiredAt: "2026-09-01",
  sources: {
    lgdSubdistricts: recordSet("lgd-subdistricts-datagovin", subdistricts),
    lgdVillages: recordSet("lgd-villages-datagovin", villages),
    lgdLocalBodies: recordSet("lgd-local-bodies-datagovin", [
      coverage("189960", "Marul Haveli", "564320"),
      // Spans two talukas: two Karad villages against one Patan village.
      coverage("200000", "Spanner", "564163"),
      coverage("200000", "Spanner", "564500"),
      coverage("200000", "Spanner", "564501"),
    ]),
    jjm: recordSet("jjm-citizen-corner", []),
    census: recordSet("census-2011-village-amenities", []),
  },
} as unknown as LgdDistrictSourceExtract;

test("a Panchayat's taluka is the one holding most of its covered villages, and spanning is recorded", () => {
  const panchayats = collectLgdGramPanchayats(extract);
  assert.deepEqual(
    panchayats.map((p) => [p.lgdCode, p.subdistrictCode, p.subdistrictName, p.spansSubdistricts, p.coverage.length]),
    [
      ["189960", "4264", "Patan", false, 1],
      ["200000", "4265", "Karad", true, 3],
    ],
  );
});

test("the membership projection attaches a taluka's IN-GRES figure by code join and defers an unassessed taluka", () => {
  const groundwater: TnDistrictGroundwaterExtract = {
    schemaVersion: 1,
    planId: "mh-satara-v1",
    assessmentYear: "2024-2025",
    acquiredAt: "2026-09-01",
    source: { sourceId: "ingres-gec-dynamic-groundwater", sourceUrl: "https://example.test", portalUrl: "https://example.test", assessmentUnitType: "TALUKA", hierarchy: "revenue" },
    district: { locationName: "Satara", locationUUID: "d", category: "safe", stageOfExtractionPercent: 57.9 },
    recordsSha256: "",
    recordCount: 1,
    records: [
      { locationName: "Patan", locationUUID: "p", locationType: "TALUKA", category: "safe", stageOfExtractionPercent: 56.38, annualRechargeHam: 2645.2, totalAvailabilityHam: 2600, availabilityForFutureUseHam: 1100, rainfallMm: 1800 },
    ],
  };
  groundwater.recordsSha256 = computeRecordsSha256(groundwater.records);
  const projection = buildMembershipGroundwaterProjection({
    planId: "mh-satara-v1",
    projectedAt: "2026-09-01",
    talukDistrictLgdCode: "494",
    talukLayer: "lgd-subdistricts-datagovin",
    places: [
      { lgdGramPanchayatCode: "189960", lgdGramPanchayatName: "Marul Haveli", lgdBlockCode: "4264", subDistrictCode: "4264", subDistrictName: "Patan" },
      { lgdGramPanchayatCode: "200000", lgdGramPanchayatName: "Spanner", lgdBlockCode: "4265", subDistrictCode: "4265", subDistrictName: "Karad" },
    ],
    boundarySourceId: "datameet-village-boundaries-mh",
    groundwater,
  });
  assert.equal(projection.projectionMethod, "administrative-membership");
  assert.equal(projection.records.length, 1);
  assert.equal(projection.records[0].containment, "village-subdistrict-code");
  assert.equal(projection.records[0].stageOfExtractionPercent, 56.38);
  assert.equal(projection.review.length, 1);
  assert.equal(projection.review[0].reason, "taluk-has-no-assessment");
  const identity: DistrictIdentity = {
    planId: "mh-satara-v1",
    gramPanchayats: new Map([
      ["189960", { name: "Marul Haveli", blockCode: "4264", blockName: "Patan" }],
      ["200000", { name: "Spanner", blockCode: "4265", blockName: "Karad" }],
    ]),
    blocks: new Map([["4264", "Patan"], ["4265", "Karad"]]),
    jjmVillagePaths: new Set(),
    censusVillageCodes: new Set(),
  };
  assert.deepEqual(validateGroundwaterProjection(projection, identity, groundwater), []);
});

/* ── the Satara fixture, when cut ──────────────────────────────────────── */

import { existsSync } from "node:fs";

import type { DistrictDirectoryArtifact } from "./artifacts";
import { boundaryProvenance, identityAdapterOf, identityVintage } from "./artifacts";
import { LGD_COVERAGE_MATCH_CLASS, buildLgdDistrictDirectoryPayload, crosswalkExtractOf } from "./lgd-district-refresh";
import { buildTnDistrictCrosswalk, loadReviewedBlockAlignmentTable } from "./tn-crosswalk";
import { buildCanonicalCrosswalk, loadTnDistrictCrosswalkResolution } from "./tn-crosswalk-resolution";
import { validateDirectoryPayload, type DirectoryPayload } from "./tn-district-refresh";
import {
  LGD_FIXTURE_DISTRICTS,
  districtBySlug,
  fixturePath,
  loadMiniDataMeetBoundary,
  loadMiniLgdExtract,
  loadMiniLgdPlan,
  readFixture,
} from "./test-support";

function withoutEnvelope(artifact: DistrictDirectoryArtifact): DirectoryPayload {
  const { nvdm, dataset, scope, provenance, projection, ext, ...payload } = artifact;
  void nvdm;
  void dataset;
  void scope;
  void provenance;
  void projection;
  void ext;
  return payload;
}

for (const fixture of LGD_FIXTURE_DISTRICTS) {
  const present = existsSync(fixturePath(fixture.slug, "directory.json"));
  test(`${fixture.slug}: the served directory is exactly what the LGD builder rebuilds`, { skip: !present && "fixture not cut yet" }, () => {
    const district = districtBySlug(fixture.slug);
    const plan = loadMiniLgdPlan(fixture.slug);
    const extract = loadMiniLgdExtract(fixture.slug);
    const crosswalkExtract = crosswalkExtractOf(plan, extract);
    const alignmentPath = fixturePath(fixture.slug, "block-alignment.json");
    const reviewedBlockAlignments = existsSync(alignmentPath)
      ? loadReviewedBlockAlignmentTable(alignmentPath, crosswalkExtract).alignments
      : undefined;
    const proposal = buildTnDistrictCrosswalk(crosswalkExtract, {
      id: `${fixture.slug}-crosswalk-v1`,
      proposedAt: extract.acquiredAt,
      reviewedBlockAlignments,
    });
    const resolutionPath = fixturePath(fixture.slug, "crosswalk-resolution.json");
    const resolutions = existsSync(resolutionPath) ? [loadTnDistrictCrosswalkResolution(resolutionPath, proposal)] : [];
    const canonical = buildCanonicalCrosswalk(proposal, resolutions);
    const rebuilt = buildLgdDistrictDirectoryPayload({
      district,
      plan,
      extract,
      proposal,
      canonical,
      boundary: loadMiniDataMeetBoundary(fixture.slug),
    });
    const served = readFixture<DistrictDirectoryArtifact>(fixture.slug, "directory.json");
    assert.deepEqual(rebuilt, withoutEnvelope(served));
    assert.deepEqual(validateDirectoryPayload(served), []);
  });

  test(`${fixture.slug}: the directory says which registers built it`, { skip: !present && "fixture not cut yet" }, () => {
    const served = readFixture<DistrictDirectoryArtifact>(fixture.slug, "directory.json");
    assert.equal(identityAdapterOf(served), "lgd-directory");
    assert.equal(served.district.blockModel, "sub-district");
    assert.equal(identityVintage(served).recordCount, served.panchayats.length);
    assert.equal(served.panchayats.length, fixture.panchayats);
    assert.deepEqual(
      served.blocks.map((block) => [block.code, block.name, block.panchayatCount]),
      [[fixture.block, fixture.blockName, fixture.panchayats]],
    );
    const provenance = boundaryProvenance(served);
    assert.ok(provenance && provenance.label === "DataMeet" && provenance.publicGeometry);
    const target = served.panchayats.find((entry) => entry.lgdCode === fixture.reviewedTarget);
    assert.ok(target, "the reviewed target is in the slice");
    assert.equal(target.composition.status, "reviewed");
    assert.ok(target.lgdCoverage && target.lgdCoverage.villages.length > 0);
    for (const panchayat of served.panchayats) {
      assert.equal(panchayat.tnrdMaster, null, "no TNRD master outside Tamil Nadu");
      if (panchayat.census) {
        assert.equal(panchayat.census.matchClass, LGD_COVERAGE_MATCH_CLASS);
        assert.ok(panchayat.census.villages.length > 0);
      }
      if (panchayat.composition.status === "crosswalk") {
        assert.equal(panchayat.composition.basis, "authoritative-crosswalk");
      }
    }
  });
}

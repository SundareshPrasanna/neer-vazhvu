import assert from "node:assert/strict";
import test from "node:test";

import {
  parseReviewedMprSeries,
  reviewedMprConceptLabel,
  reviewedMprValueLabel,
} from "./reviewed-mpr";

function fixture() {
  return {
    schema: "neer-vazhvu.public-mpr-series",
    schemaVersion: "1",
    surfaceId: "arkavathi-progress",
    scope: { kind: "basin", id: "arkavathi" },
    editions: [{
      editionId: "nmcg-ngt-mpr-listing:2026-03-31",
      period: { start: "2026-03-31", end: "2026-03-31" },
      source: {
        title: "Arkavathi River Monthly Progress Report, March 2026",
        publisher: "NMCG",
        url: "https://example.test/march.pdf",
        asOf: "2026-03-31",
      },
      records: [{
        claimId: "nv-claim:flow",
        concept: "nv-candidate:facility-design-capacity",
        subjectId: "nv-subject:stp",
        subjectLabel: "Existing STP reported under CMC Kanakapura",
        value: { kind: "quantity", value: 6.29, unit: "MLD", qualifier: "reported" },
        pageNumber: 37,
      }],
    }],
    summary: { editionCount: 1, recordCount: 1 },
  };
}

test("accepts the released Arkavathi MPR contract and formats its values", () => {
  const parsed = parseReviewedMprSeries(fixture());
  assert.ok(parsed);
  assert.equal(parsed.editions[0].records[0].pageNumber, 37);
  assert.equal(reviewedMprConceptLabel("nv-candidate:facility-design-capacity"), "Design capacity");
  assert.equal(reviewedMprValueLabel(parsed.editions[0].records[0].value), "6.29 MLD");
});

test("fails closed when declared release counts do not match the records", () => {
  const changed = fixture();
  changed.summary.recordCount = 2;
  assert.equal(parseReviewedMprSeries(changed), null);
});

test("fails closed on a non-HTTPS source", () => {
  const changed = fixture();
  changed.editions[0].source.url = "http://example.test/march.pdf";
  assert.equal(parseReviewedMprSeries(changed), null);
});

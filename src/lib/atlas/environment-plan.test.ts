import assert from "node:assert/strict";
import test from "node:test";

import {
  environmentPlanReading,
  validateEnvironmentPlanInput,
  type EnvironmentPlanArtifact,
  type EnvironmentPlanInput,
} from "./environment-plan";
import { LGD_FIXTURE_DISTRICTS, fixtureSlugsPresent, readFixtureArtifacts } from "./test-support";

function input(): EnvironmentPlanInput {
  return {
    schemaVersion: 1,
    id: "test-plan-2018-19",
    sourceId: "mpcb-district-environment-plans",
    document: {
      title: "District Environment Plan: Test",
      publisher: "A board",
      url: "https://example.gov.in/plan.pdf",
      listingUrl: "https://example.gov.in/plans",
      editionLabel: "2018-19",
      editionNote: "as listed",
      documentDate: "2019-12-30",
      pages: 12,
      sha256: "b".repeat(64),
      bytes: 100,
      retrievedAt: "2026-09-01",
      template: "CPCB model plan; no balance table",
      quirks: [],
    },
    waterBalance: null,
    figures: [
      { id: "sewage", label: "Sewage", value: 49.75, unit: "MLD", detail: "", quote: "ULB generate about 49.75 MLD", section: "4.0", pdfPage: 8, printedPage: 7 },
    ],
    actionPoints: [{ text: "60 MLD of STP", sector: "Domestic", priority: "Very high", pdfPage: 9 }],
    review: { status: "proposed", extractedAt: "2026-09-01", extractedBy: "assistant", verifiedAt: null, verifiedBy: null },
  };
}

test("a transcribed plan validates, and the reading says whether a balance exists", () => {
  assert.deepEqual(validateEnvironmentPlanInput(input()), []);
  const artifact = { ...input(), nvdm: "1.0", dataset: "atlas/environment-plan", scope: { kind: "district", id: "t" }, provenance: {} } as unknown as EnvironmentPlanArtifact;
  const reading = environmentPlanReading(artifact);
  assert.equal(reading.hasWaterBalance, false);
  assert.equal(reading.figures.length, 1);
});

test("a figure without its sentence, a page beyond the document, or a verified status without a date is refused", () => {
  const noQuote = input();
  noQuote.figures[0] = { ...noQuote.figures[0], quote: "" };
  assert.ok(validateEnvironmentPlanInput(noQuote).some((e) => /quote/.test(e)));
  const farPage = input();
  farPage.figures[0] = { ...farPage.figures[0], pdfPage: 40 };
  assert.ok(validateEnvironmentPlanInput(farPage).some((e) => /beyond the document/.test(e)));
  const claimed = input();
  claimed.review = { ...claimed.review, status: "verified" };
  assert.ok(validateEnvironmentPlanInput(claimed).some((e) => /verifiedAt: required/.test(e)));
  const balance = input();
  balance.waterBalance = { year: "2018-19", demandMld: 100, supplyMld: 80, deficitMld: 20, quote: "the balance", pdfPage: 5 };
  assert.deepEqual(validateEnvironmentPlanInput(balance), []);
});

for (const fixture of LGD_FIXTURE_DISTRICTS.filter((entry) => fixtureSlugsPresent().includes(entry.slug))) {
  test(`${fixture.slug}: the served environment plan is a valid transcription with page citations`, () => {
    const artifact = readFixtureArtifacts(fixture.slug).environmentPlan;
    assert.ok(artifact, "the fixture carries the plan");
    assert.deepEqual(validateEnvironmentPlanInput(artifact), []);
    assert.equal(artifact.waterBalance, null, "the CPCB model plan carries no balance");
    assert.ok(artifact.figures.every((figure) => figure.quote.length > 0 && figure.pdfPage <= artifact.document.pages));
    assert.ok(artifact.provenance.sources.some((source) => source.id === artifact.sourceId));
  });
}

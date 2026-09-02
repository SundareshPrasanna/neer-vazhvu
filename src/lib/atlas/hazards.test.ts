import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  districtFloodReading,
  districtScarcityReading,
  floodVintageRow,
  latestScarcityWeek,
  scarcityVintageRow,
  stateFloodReading,
  type FloodClassificationArtifact,
  type ScarcityTankersArtifact,
} from "./hazards";

const envelope = {
  nvdm: "1.0" as const,
  scope: { kind: "state" as const, id: "maharashtra" },
  provenance: {
    sources: [{ id: "wssd-weekly-tanker-report", title: "t", publisher: "p", license: "l", role: "asserts" as const, url: "u", as_of: "2026-08-31", retrieved: "2026-09-02" }],
    method: "manual",
    produced_at: "2026-09-02",
    produced_by: "test",
  },
};

function scarcityFixture(): ScarcityTankersArtifact {
  return {
    ...envelope,
    dataset: "atlas/scarcity-tankers",
    state: "maharashtra",
    districtCount: 3,
    latestReportDate: "2026-08-31",
    editions: [
      {
        schemaVersion: 1,
        reportDate: "2026-08-24",
        weekStart: "2026-08-17",
        weekEnd: "2026-08-23",
        source: { listingUrl: "https://example/listing", pdfUrl: "https://example/old.pdf", pdfSha256: "0".repeat(64), title: "Tanker Report 24.08.2026" },
        districts: [
          { district: "Ahilyanagar", division: "Nashik", villages: 90, wadis: 480, tankersGovernment: 2, tankersPrivate: 90, tankersTotal: 92 },
          { district: "Satara", division: "Pune", villages: 4, wadis: 20, tankersGovernment: 0, tankersPrivate: 5, tankersTotal: 5 },
          { district: "Kolhapur", division: "Pune", villages: 0, wadis: 0, tankersGovernment: 0, tankersPrivate: 0, tankersTotal: 0 },
        ],
        stateTotals: { villages: 94, wadis: 500, tankersGovernment: 2, tankersPrivate: 95, tankersTotal: 97 },
        statedDistrictsWithTankers: 2,
        worstDistrict: { name: "Ahilyanagar", tankersTotal: 92 },
        worstDivision: { name: "Nashik", tankersTotal: 92 },
        review: { status: "verified", transcribedAt: "2026-08-25", transcribedBy: "test", verifiedAt: "2026-08-26", verifiedBy: "test" },
      },
      {
        schemaVersion: 1,
        reportDate: "2026-08-31",
        weekStart: "2026-08-24",
        weekEnd: "2026-08-30",
        source: { listingUrl: "https://example/listing", pdfUrl: "https://example/new.pdf", pdfSha256: "1".repeat(64), title: "Tanker Report 31.08.2026" },
        districts: [
          { district: "Ahilyanagar", division: "Nashik", villages: 94, wadis: 499, tankersGovernment: 2, tankersPrivate: 95, tankersTotal: 97 },
          { district: "Satara", division: "Pune", villages: 6, wadis: 26, tankersGovernment: 0, tankersPrivate: 7, tankersTotal: 7 },
          { district: "Kolhapur", division: "Pune", villages: 0, wadis: 0, tankersGovernment: 0, tankersPrivate: 0, tankersTotal: 0 },
        ],
        stateTotals: { villages: 100, wadis: 525, tankersGovernment: 2, tankersPrivate: 102, tankersTotal: 104 },
        statedDistrictsWithTankers: 2,
        worstDistrict: { name: "Ahilyanagar", tankersTotal: 97 },
        worstDivision: { name: "Nashik", tankersTotal: 97 },
        review: { status: "proposed", transcribedAt: "2026-09-02", transcribedBy: "test", verifiedAt: null, verifiedBy: null },
      },
    ],
  };
}

const mhFlood: FloodClassificationArtifact = {
  ...envelope,
  dataset: "atlas/flood-classification",
  state: "mh",
  source: { title: "Maharashtra State Disaster Management Plan, 2023", publisher: "MSDMA", url: "u", documentDate: "2023-09-05", retrievedAt: "2026-09-02", pages: 204 },
  classification: {
    kind: "flood-prone-except",
    statement: "Every district is flood-prone except the eight the plan names.",
    exceptions: [{ sdmpName: "Ahmednagar", currentName: "Ahilyanagar", registrySlug: "ahilyanagar" }],
    quote: "All districts in the State except Ahmednagar ... are flood prone.",
    section: "7.1 Flood",
    pdfPage: 61,
    printedPage: 51,
  },
  review: { status: "proposed" },
};

const tnFlood: FloodClassificationArtifact = {
  ...envelope,
  scope: { kind: "state" as const, id: "tamil-nadu" },
  dataset: "atlas/flood-classification",
  state: "tn",
  source: { title: "Tamil Nadu State Disaster Management Plan 2023", publisher: "TNSDMA", url: "u", documentDate: "2023-03-18", retrievedAt: "2026-09-02", pages: 272 },
  classification: {
    kind: "coastal-high-vulnerability",
    statement: "Fourteen coastal districts named highly vulnerable.",
    districts: [{ sdmpName: "Thanjavur", currentName: "Thanjavur" }],
    quote: "The 14 coastal Districts, viz., ... Thanjavur ...",
    section: "State profile, hazard vulnerability",
    pdfPage: 24,
    printedPage: null,
  },
  review: { status: "proposed" },
};

describe("latestScarcityWeek", () => {
  it("picks the newest edition and sorts active districts worst first", () => {
    const week = latestScarcityWeek(scarcityFixture());
    assert.ok(week);
    assert.equal(week.reportDate, "2026-08-31");
    assert.deepEqual(week.active.map((r) => r.district), ["Ahilyanagar", "Satara"]);
    assert.equal(week.zeroCount, 1);
    assert.equal(week.totals.tankersTotal, 104);
  });
});

describe("districtScarcityReading", () => {
  it("names the worst district as running more tankers than any other", () => {
    const reading = districtScarcityReading(scarcityFixture(), "Ahilyanagar");
    assert.ok(reading);
    assert.ok(reading.isWorstDistrict);
    assert.match(reading.sentence, /more tankers than any other district/);
    assert.match(reading.sentence, /week to 2026-08-30/);
  });
  it("reads a zero row as a reading, not a gap", () => {
    const reading = districtScarcityReading(scarcityFixture(), "Kolhapur");
    assert.ok(reading);
    assert.equal(reading.row.tankersTotal, 0);
    assert.match(reading.sentence, /No village or wadi in the district was on tanker supply/);
    assert.match(reading.sentence, /Statewide/);
  });
  it("returns null for a district outside the register", () => {
    assert.equal(districtScarcityReading(scarcityFixture(), "Thanjavur"), null);
  });
});

describe("districtFloodReading", () => {
  it("reads a Maharashtra exception as named not flood-prone", () => {
    const reading = districtFloodReading(mhFlood, { name: "Ahilyanagar", slug: "ahilyanagar" });
    assert.equal(reading.exposed, false);
    assert.match(reading.sentence, /not flood-prone/);
    assert.match(reading.citation, /printed page 51/);
  });
  it("reads every unexcepted Maharashtra district as flood-prone", () => {
    const reading = districtFloodReading(mhFlood, { name: "Kolhapur", slug: "kolhapur" });
    assert.equal(reading.exposed, true);
    assert.match(reading.sentence, /flood-prone/);
  });
  it("reads a named Tamil Nadu coastal district as highly vulnerable", () => {
    const reading = districtFloodReading(tnFlood, { name: "Thanjavur", slug: "thanjavur" });
    assert.equal(reading.exposed, true);
    assert.match(reading.sentence, /fourteen coastal districts/);
    assert.match(reading.citation, /PDF page 24/);
  });
  it("never reads absence from the Tamil Nadu list as safety", () => {
    const reading = districtFloodReading(tnFlood, { name: "Salem", slug: "salem" });
    assert.equal(reading.exposed, null);
    assert.match(reading.sentence, /not a rating of safety/);
  });
});

describe("state tier and vintages", () => {
  it("serves the plan's own statement at the state tier", () => {
    const reading = stateFloodReading(tnFlood);
    assert.equal(reading.sentence, tnFlood.classification.statement);
    assert.equal(reading.exposed, null);
  });
  it("dates the scarcity vintage to the latest week, never to review status", () => {
    const row = scarcityVintageRow(scarcityFixture());
    assert.match(row.describes, /week to 2026-08-30, report dated 2026-08-31/);
    assert.doesNotMatch(row.note, /review|pending|await/i);
  });
  it("dates the flood vintage to the plan", () => {
    const row = floodVintageRow(mhFlood);
    assert.match(row.describes, /2023-09-05/);
  });
});

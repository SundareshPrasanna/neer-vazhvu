import assert from "node:assert/strict";
import test from "node:test";

import {
  pollutedStretchesReading,
  selectForDistrict,
  validatePollutedStretchesInput,
  type PollutedStretchesArtifact,
  type PollutedStretchesInput,
  type PrsEntry,
} from "./polluted-stretches";

const edition: PollutedStretchesInput["edition"] = {
  label: "October 2025 (updated version)",
  reportTitle: "Polluted River Stretches for Restoration of Water Quality",
  publishedLabel: "October 2025",
  bodObservedYears: "2022 and 2023",
  followUpBodYear: "2024",
  url: "https://cpcb.gov.in/polluted-river-stretches/",
  pdfSha256: "dde4",
  pdfBytes: 1,
  pdfPages: 170,
  retrievedAt: "2026-09-06",
  annexures: {},
  priorityBands: { I: "a", II: "b", III: "c", IV: "d", V: "e" },
};

function entry(overrides: Partial<PrsEntry>): PrsEntry {
  return {
    id: "tn-cauvery-iiia-122",
    state: "TAMIL NADU",
    stateSlug: "tn",
    kind: "stretch",
    river: "Cauvery",
    text: "RIVER CAUVERY AT ERODE NEAR VIRAPALAYAM TO PITCHAVARAM",
    priority: "II",
    maxBod2022_23: 24,
    serial: { annexure: "III A", sno: 122, pdfPage: 91 },
    stations: [{ code: "1320", location: "RIVER CAUVERY AT ERODE NEAR VIRAPALAYAM", bod2024: 3.2 }],
    since2018: { class: "improved", stretch2018: "METTUR TO MAYILADUTHURAI", priority2018: "I", annexure: "X", sno: 58, pdfPage: 121 },
    districts: [
      { name: "Erode", kind: "named", basis: "'ERODE' is the district name", scopeId: "tn-erode" },
      { name: "Namakkal", kind: "course", basis: "left bank between Erode and Tiruchirappalli" },
    ],
    review: { status: "proposed", reviewedAt: null, reviewedBy: null, note: "" },
    ...overrides,
  };
}

const input: PollutedStretchesInput = {
  schemaVersion: 1,
  id: "cpcb-prs-2025",
  sourceId: "cpcb-prs-report",
  edition,
  states: [],
  stateNotes: [
    {
      stateSlug: "tn",
      text: "The 2022 edition listed the Amaravathi.",
      districts: [{ name: "Karur", kind: "course", basis: "flows through Karur", scopeId: "tn-karur" }],
      basis: "CPCB 2022",
    },
  ],
  entries: [
    entry({}),
    entry({ id: "tn-sarabanga-iiib-122", kind: "location", river: "Sarabanga", priority: "I", districts: [{ name: "Salem", kind: "named", basis: "'SALEM'", scopeId: "tn-salem" }] }),
    entry({ id: "mh-krishna-iiia-90", stateSlug: "mh", state: "MAHARASHTRA", river: "Krishna", priority: "IV", districts: [{ name: "Satara", kind: "named", basis: "'SATARA'" }] }),
  ],
};

test("the input validates and duplicate ids are refused", () => {
  assert.deepEqual(validatePollutedStretchesInput(input), []);
  const dup = { ...input, entries: [entry({}), entry({})] };
  assert.ok(validatePollutedStretchesInput(dup).some((e) => e.includes("duplicate")));
});

test("a district gets the entries that name it, by scope id or folded name, never another state's", () => {
  const erode = selectForDistrict(input, { scopeId: "tn-erode", stateSlug: "tn", name: "Erode" });
  assert.equal(erode.count, 1);
  assert.equal(erode.entries[0].district.kind, "named");
  const namakkal = selectForDistrict(input, { scopeId: "tn-namakkal", stateSlug: "tn", name: "Namakkal" });
  assert.equal(namakkal.count, 1);
  assert.equal(namakkal.entries[0].district.kind, "course");
  const satara = selectForDistrict(input, { scopeId: "mh-satara", stateSlug: "mh", name: "Satara" });
  assert.equal(satara.count, 1);
  const tiruppur = selectForDistrict(input, { scopeId: "tn-tiruppur", stateSlug: "tn", name: "Tiruppur" });
  assert.equal(tiruppur.count, 0);
  const karur = selectForDistrict(input, { scopeId: "tn-karur", stateSlug: "tn", name: "Karur" });
  assert.equal(karur.count, 0);
  assert.equal(karur.notes.length, 1);
});

test("entries sort worst priority first and the reading says so in one line", () => {
  const salem = selectForDistrict(input, { scopeId: "tn-salem", stateSlug: "tn", name: "Salem" });
  const artifact = {
    schemaVersion: 1,
    planId: "cpcb-prs-2025",
    districtName: "Salem",
    edition,
    ...salem,
  } as PollutedStretchesArtifact;
  const reading = pollutedStretchesReading(artifact);
  assert.equal(reading.worstPriority, "I");
  assert.match(reading.sentence ?? "", /one polluted stretch touching the district: Sarabanga \(Priority I\)/);
  const none = pollutedStretchesReading({ ...artifact, entries: [], count: 0 });
  assert.equal(none.sentence, null);
  assert.equal(none.worstPriority, null);
});

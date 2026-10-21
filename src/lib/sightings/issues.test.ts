import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  CARDS_PER_ISSUE,
  buildIssues,
  issuePhotos,
  homesText,
  issueLine,
  issueNotes,
  issuePlaceKey,
  issueStatusText,
  openText,
  peopleText,
  type IssueEvent,
  type IssuePhoto,
  type IssueSource,
} from "./issues";
import type { CaseStatus } from "./status";
import type { PublicIssue, PublicReport } from "./types";

/** Noon in India on 18 Oct 2026. */
const NOW = new Date("2026-10-18T06:30:00Z");
/** About 100 m of latitude. */
const M100 = 0.0009;

let seq = 0;
function src(o: {
  at: string;
  cat?: string;
  sub?: string | null;
  status?: CaseStatus | null;
  lat?: number;
  lng?: number;
  by?: string;
  body?: string | null;
  ward?: string | null;
  gp?: string | null;
  events?: IssueEvent[];
  photo?: string | null;
  fixedPhoto?: string | null;
  photos?: IssuePhoto[];
  group?: string | null;
  fixit?: boolean;
  where?: string | null;
}): IssueSource {
  const id = `r${++seq}`;
  const cat = o.cat ?? "dumping";
  const lat = o.lat ?? 13.0;
  const lng = o.lng ?? 80.2;
  const report = {
    id,
    createdAt: o.at.slice(0, 10),
    placeName: "Chennai",
    where: o.where === undefined ? "Puzhal lake, Ward 12" : o.where,
    category: cat,
    subcategory: o.sub === undefined ? "garbage_on_bank" : o.sub,
    label: cat === "drinking" ? "Muddy or coloured tap water" : `Label of ${o.sub === undefined ? "garbage_on_bank" : o.sub}`,
    point: cat === "drinking" ? null : [Math.round(lat * 1000) / 1000, Math.round(lng * 1000) / 1000],
    groupName: o.group ?? null,
    fixit: o.fixit ? { id: "f1", groupName: "Lake Friends", startsAt: "2026-10-25T03:30:00Z", meetingPoint: "Gate 2", note: null, going: 3 } : null,
    placeHref: "/chennai/water-bodies?layer=reports",
  } as PublicReport;
  return {
    row: {
      id,
      created_at: o.at,
      updated_at: o.at,
      reporter_key: o.by ?? `key-${id}`,
      place_id: "chennai",
      ward_id: o.ward === undefined ? "12" : o.ward,
      panchayat_code: o.gp ?? null,
      water_body_id: o.body === undefined ? "puzhal" : o.body,
      category: cat,
      subcategory: report.subcategory,
      case_status: o.status === undefined ? "open" : o.status,
      lat,
      lng,
    },
    report,
    events: o.events ?? [],
    ...(o.photos ? { photos: o.photos } : { reportPhoto: o.photo === undefined ? `https://x/${id}.webp` : o.photo, fixedPhoto: o.fixedPhoto ?? null }),
  };
}

const ev = (event: string, at: string, actor_role: IssueEvent["actor_role"] = "resident", actor_key: string | null = null): IssueEvent => ({ event, created_at: at, actor_role, actor_key });

const one = (sources: IssueSource[]) => {
  const issues = buildIssues(sources, NOW);
  assert.equal(issues.length, 1, JSON.stringify(issues.map((i) => i.reportIds)));
  return issues[0];
};

test("the place key is the follow key: water body, else panchayat, else ward, else place; a home's never the water body", () => {
  const p = { place_id: "chennai", ward_id: "12", panchayat_code: null, water_body_id: "puzhal" };
  assert.equal(issuePlaceKey(p), "body:puzhal");
  assert.equal(issuePlaceKey(p, true), "chennai:ward:12");
  assert.equal(issuePlaceKey({ place_id: "tn-erode", ward_id: null, panchayat_code: "223344", water_body_id: null }), "tn-erode:gp:223344");
  assert.equal(issuePlaceKey({ place_id: "arkavathi", ward_id: null, panchayat_code: null, water_body_id: "t1" }, true), "arkavathi");
});

test("reports of one type within 150 m of any report in an open issue are one issue, chained", () => {
  const a = src({ at: "2026-09-01T04:00:00Z" });
  const b = src({ at: "2026-09-05T04:00:00Z", lat: 13.0 + M100 * 1.4 });
  // 280 m from the first, 140 m from the second.
  const c = src({ at: "2026-09-09T04:00:00Z", lat: 13.0 + M100 * 2.8 });
  const i = one([c, a, b]);
  assert.equal(i.id, a.row.id);
  assert.deepEqual(i.reportIds, [c.row.id, b.row.id, a.row.id]);
  assert.equal(i.reports, 3);
  assert.equal(i.firstOn, "2026-09-01");
  assert.equal(i.lastSeenOn, "2026-09-09");
  assert.equal(i.daysOpen, 47);
  assert.equal(i.status, "open");
  assert.equal(i.photoUrl, `https://x/${c.row.id}.webp`);
  assert.deepEqual(i.point, a.report.point);
});

test("a different type, a spot over 150 m away, another water body or an 'other' report is a separate issue", () => {
  const base = { at: "2026-09-01T04:00:00Z" };
  assert.equal(buildIssues([src(base), src({ ...base, sub: "cd_debris" })], NOW).length, 2);
  assert.equal(buildIssues([src(base), src({ ...base, lat: 13.0 + M100 * 1.8 })], NOW).length, 2);
  assert.equal(buildIssues([src(base), src({ ...base, body: "chembarambakkam" })], NOW).length, 2);
  // "Other" has no status today; were it to take one, two still never merge.
  assert.equal(buildIssues([src({ ...base, cat: "other", sub: null }), src({ ...base, cat: "other", sub: null })], NOW).length, 2);
});

test("types residents mix up at one spot are one issue, named by the type most of its reports name", () => {
  const at = (d: number) => `2026-09-0${d}T04:00:00Z`;
  const drain = { cat: "flooding", body: null };
  const i = one([
    src({ ...drain, at: at(1), cat: "sewage", sub: "manhole_overflow" }),
    src({ ...drain, at: at(2), sub: "drain_overflow", lat: 13.0 + M100 }),
    src({ ...drain, at: at(3), sub: "drain_overflow" }),
  ]);
  assert.equal(i.reports, 3);
  assert.equal(i.category, "flooding");
  assert.equal(i.subcategory, "drain_overflow");
  assert.equal(i.label, "Label of drain_overflow");
  // A tie goes to the earliest; unrelated types at the spot stay apart.
  assert.equal(one([src({ at: at(1), sub: "floating_trash" }), src({ at: at(2), sub: "plastic_buildup" })]).subcategory, "floating_trash");
  assert.equal(buildIssues([src({ at: at(1), cat: "surface", sub: "dead_fish" }), src({ at: at(2), sub: "carcass_waste" })], NOW).length, 2);
});

test("the issue photo is the newest published one: a report's, a still-there update's, or a fix once all is fixed", () => {
  const p = (url: string, kind: IssuePhoto["kind"], at: string, ordinal = 0): IssuePhoto => ({ url, kind, at, ordinal });
  const a = src({ at: "2026-09-01T04:00:00Z", photos: [p("a1", "report", "2026-09-01T04:00:00Z"), p("a0", "report", "2026-09-01T04:00:00Z", 1)] });
  const b = src({ at: "2026-09-05T04:00:00Z", photos: [p("b1", "report", "2026-09-05T04:00:00Z"), p("b-update", "update", "2026-10-02T04:00:00Z")] });
  assert.equal(one([a, b]).photoUrl, "b-update");
  assert.equal(one([a]).photoUrl, "a1");
  // One report fixed while another is open: the fix does not stand for the issue.
  const fixedA = src({ at: "2026-09-01T04:00:00Z", status: "fixed", events: [ev("fixed", "2026-10-05T04:00:00Z", "reviewer")], photos: [p("a1", "report", "2026-09-01T04:00:00Z"), p("a-fixed", "fixed", "2026-10-05T04:00:00Z")] });
  const openB = src({ at: "2026-09-05T04:00:00Z", photos: [p("b1", "report", "2026-09-05T04:00:00Z")] });
  assert.equal(one([fixedA, openB]).photoUrl, "b1");
  assert.equal(one([fixedA]).photoUrl, "a-fixed");
  // Only published photos are passed on: an update photo waiting for review is not one.
  const rows = [
    { id: "1", sighting_id: "s", kind: "report" as const, storage_path: "x/1", public_path: "x/1", ordinal: 0, created_at: "2026-09-01T04:00:00Z" },
    { id: "2", sighting_id: "s", kind: "update" as const, storage_path: "x/2", public_path: null, ordinal: 0, created_at: "2026-10-01T04:00:00Z" },
  ];
  assert.deepEqual(issuePhotos(rows, (path) => `https://cdn/${path}`), [{ url: "https://cdn/x/1", kind: "report", at: "2026-09-01T04:00:00Z", ordinal: 0 }]);
});

test("good news and 'other' have no status, so they are no issue; old home reports drop out of the window", () => {
  assert.deepEqual(buildIssues([src({ at: "2026-10-01T04:00:00Z", cat: "recovery", sub: "wildlife_back", status: null })], NOW), []);
  assert.deepEqual(buildIssues([src({ at: "2026-08-01T04:00:00Z", cat: "drinking", sub: "dirty_tap_water" })], NOW), []);
});

test("people counts reporters, 'still there' and 'seen it too' once each, and never a department or reviewer", () => {
  const a = src({
    at: "2026-09-01T04:00:00Z",
    by: "alice",
    events: [
      ev("approved", "2026-09-01T06:00:00Z", "reviewer", "rev"),
      ev("seen_too", "2026-09-03T04:00:00Z", "resident", "bob"),
      ev("still_there", "2026-09-03T04:00:00Z", "resident", "bob"),
      ev("still_there", "2026-09-10T04:00:00Z", "reporter", "alice"),
      ev("action_taken", "2026-09-12T04:00:00Z", "department", "dept"),
    ],
  });
  // Bob also sent a report of his own; a deleted neighbour said "seen it too" with their "still there".
  const b = src({
    at: "2026-09-04T04:00:00Z",
    by: "bob",
    events: [ev("seen_too", "2026-10-02T04:00:00Z", "resident", "deleted"), ev("still_there", "2026-10-02T04:00:00Z", "resident", "deleted")],
  });
  // Two deleted accounts are two people.
  const c = src({ at: "2026-09-05T04:00:00Z", by: "deleted" });
  const d = src({ at: "2026-09-06T04:00:00Z", by: "deleted" });
  const i = one([a, b, c, d]);
  assert.equal(i.people, 5);
  assert.equal(i.reports, 4);
  assert.equal(i.lastSeenOn, "2026-10-02");
  const out = JSON.stringify(i);
  for (const secret of ["alice", "bob", "rev", "dept", "13.0009", String(a.row.lat + 0.00001)]) assert.ok(!out.includes(secret), secret);
});

test("the status is the most advanced open one; fixed or closed only once every report is", () => {
  const at = "2026-09-01T04:00:00Z";
  assert.equal(one([src({ at, status: "open" }), src({ at, status: "authority_done" }), src({ at, status: "reported" })]).status, "authority_done");
  assert.equal(one([src({ at, status: "fixed", events: [ev("fixed", "2026-10-03T05:00:00Z", "reviewer")] }), src({ at, status: "reported" })]).status, "reported");
  const fixed = one([
    src({ at, status: "fixed", events: [ev("fixed", "2026-10-03T05:00:00Z", "reviewer")], fixedPhoto: "https://x/fixed.webp" }),
    src({ at, status: "closed", events: [ev("closed", "2026-10-01T05:00:00Z", "reviewer")] }),
  ]);
  assert.equal(fixed.status, "fixed");
  assert.equal(fixed.resolvedOn, "2026-10-03");
  assert.equal(fixed.daysOpen, null);
  assert.equal(fixed.photoUrl, "https://x/fixed.webp");
  assert.equal(one([src({ at, status: "closed", events: [ev("closed", "2026-10-01T05:00:00Z", "department")] })]).status, "closed");
});

test("a report after the issue was fixed starts a new one that counts the earlier fix; one sent before still joins", () => {
  const a = src({ at: "2026-03-01T04:00:00Z", status: "fixed", events: [ev("fixed", "2026-04-10T04:00:00Z", "reviewer")] });
  // Sent while the first was still open, and fixed with it.
  const b = src({ at: "2026-04-01T04:00:00Z", status: "fixed", events: [ev("fixed", "2026-04-12T04:00:00Z", "reviewer")] });
  // Closed by the department, not fixed: does not count as a fix.
  const c = src({ at: "2026-06-01T04:00:00Z", status: "closed", events: [ev("closed", "2026-06-20T04:00:00Z", "department")] });
  const d = src({ at: "2026-08-25T04:00:00Z", lat: 13.0 + M100 });
  const issues = buildIssues([a, b, c, d], NOW);
  // The fixed issue of April and the closed one of June are past 60 days: left out, their reports still in `data`.
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].reportIds, [d.row.id]);
  assert.equal(issues[0].earlierFixes, 1);
  // A report elsewhere on the lake counts no fix.
  assert.equal(buildIssues([a, b, src({ at: "2026-08-25T04:00:00Z", lat: 13.01 })], NOW)[0].earlierFixes, 0);
});

test("open issues first by people then the oldest; then fixed lately, the latest first; older fixes left out", () => {
  const far = (k: number) => 13.0 + k * 0.01;
  const small = src({ at: "2026-08-01T04:00:00Z", lat: far(1) });
  const bigNew = src({ at: "2026-09-01T04:00:00Z", lat: far(2), events: [ev("seen_too", "2026-09-02T04:00:00Z", "resident", "n1")] });
  const bigOld = src({ at: "2026-07-01T04:00:00Z", lat: far(3), events: [ev("seen_too", "2026-09-02T04:00:00Z", "resident", "n2")] });
  const fixedA = src({ at: "2026-07-01T04:00:00Z", lat: far(4), status: "fixed", events: [ev("fixed", "2026-09-01T04:00:00Z", "reviewer")] });
  const fixedB = src({ at: "2026-07-01T04:00:00Z", lat: far(5), status: "fixed", events: [ev("fixed", "2026-10-01T04:00:00Z", "reviewer")] });
  const fixedOld = src({ at: "2026-05-01T04:00:00Z", lat: far(6), status: "fixed", events: [ev("fixed", "2026-08-01T04:00:00Z", "reviewer")] });
  const order = buildIssues([small, bigNew, fixedA, fixedOld, bigOld, fixedB], NOW).map((i) => i.id);
  assert.deepEqual(order, [bigOld, bigNew, small, fixedB, fixedA].map((s) => s.row.id));
});

test("tap water counts by ward and type over 30 days, in homes, with no point and no photo", () => {
  const tap = { cat: "drinking", sub: "dirty_tap_water", where: "Ward 12", photo: "https://x/home.webp" };
  // Points far apart and in a water body: neither splits a home issue.
  const a = src({ ...tap, at: "2026-09-25T04:00:00Z", by: "h1", lat: 13.0 });
  const b = src({ ...tap, at: "2026-10-01T04:00:00Z", by: "h2", lat: 13.05, body: "other-lake" });
  const c = src({ ...tap, at: "2026-10-10T04:00:00Z", by: "h1", lat: 13.02 });
  const otherWard = src({ ...tap, at: "2026-10-10T04:00:00Z", ward: "13", where: "Ward 13" });
  const issues = buildIssues([a, b, c, otherWard], NOW);
  assert.equal(issues.length, 2);
  const w12 = issues.find((i) => i.where === "Ward 12")!;
  assert.equal(w12.reports, 3);
  assert.equal(w12.people, 2);
  assert.equal(w12.point, null);
  assert.equal(w12.photoUrl, null);
  assert.equal(issueLine(w12, (d) => d), "2 homes in Ward 12 in the last 30 days.");
  // A home report keyed on the whole place is named by the place.
  const basin = one([src({ ...tap, at: "2026-10-10T04:00:00Z", ward: null, body: null, where: "Magadi" })]);
  assert.equal(basin.where, "Chennai");
});

test("dates are India dates: a report late at night UTC is the next day; first day open reads 'since today'", () => {
  const i = one([src({ at: "2026-10-17T20:00:00Z" })]);
  assert.equal(i.firstOn, "2026-10-18");
  assert.equal(i.daysOpen, 0);
  assert.equal(openText(i.daysOpen!), "Open since today");
});

test("groups are named once each, and a planned clean-up is flagged", () => {
  const at = "2026-09-01T04:00:00Z";
  const i = one([src({ at, group: "Lake Friends" }), src({ at, group: "Lake Friends", fixit: true }), src({ at, group: "SRM Eco Club" }), src({ at })]);
  assert.deepEqual(i.groups, ["Lake Friends", "SRM Eco Club"]);
  assert.equal(i.fixitPlanned, true);
});

test("the wording is plain, with no em dashes or middle dots", () => {
  const day = (ymd: string) => ({ "2026-03-12": "12 Mar 2026", "2026-10-02": "2 Oct 2026", "2026-10-03": "3 Oct 2026" })[ymd] ?? ymd;
  const base: PublicIssue = {
    id: "r1", category: "dumping", subcategory: "garbage_on_bank", label: "Garbage on the bank or in the water", where: "Puzhal lake",
    firstOn: "2026-03-12", lastSeenOn: "2026-03-12", daysOpen: 47, resolvedOn: null, reports: 9, people: 14, status: "reported",
    photoUrl: null, reportIds: ["r1"], groups: [], fixitPlanned: false, earlierFixes: 0, point: [13, 80.2], placeHref: null,
  };
  assert.equal(peopleText(1), "1 person has reported it");
  assert.equal(peopleText(14), "14 people have reported or seen it");
  assert.equal(openText(1), "Open 1 day");
  assert.equal(openText(47), "Open 47 days");
  assert.equal(homesText(1, null), "1 home here in the last 30 days");
  assert.equal(issueLine(base, day), "First reported 12 Mar 2026. 14 people have reported or seen it. Open 47 days.");
  assert.equal(issueLine({ ...base, lastSeenOn: "2026-10-02" }, day), "First reported 12 Mar 2026. Last seen 2 Oct 2026. 14 people have reported or seen it. Open 47 days.");
  assert.equal(issueLine({ ...base, people: 1, status: "authority_done" }, day), "First reported 12 Mar 2026. 1 person has reported it.");
  const fixed = { ...base, status: "fixed" as const, daysOpen: null, resolvedOn: "2026-10-03", lastSeenOn: "2026-10-02" };
  assert.equal(issueLine(fixed, day), "First reported 12 Mar 2026. 14 people have reported or seen it.");
  assert.equal(issueStatusText(fixed, day), "Fixed 3 Oct 2026");
  assert.equal(issueStatusText(base, day), "Reported");
  assert.equal(issueStatusText({ ...base, status: "open" }, day), "Not yet reported");
  assert.equal(issueStatusText({ ...base, status: null }, day), null);
  assert.equal(issueNotes(base), null);
  assert.equal(issueNotes({ ...base, earlierFixes: 1, groups: ["Lake Friends"], fixitPlanned: true }), "Fixed once before. Sent by Lake Friends. Clean-up planned.");
  assert.equal(issueNotes({ ...base, earlierFixes: 2, groups: ["A", "B", "C"] }), "Fixed 2 times before. Sent by A, B and C.");
  for (const s of [issueLine(base, day), issueNotes({ ...base, earlierFixes: 3, groups: ["A", "B"], fixitPlanned: true })!]) assert.ok(!/[—·]/.test(s), s);
  assert.ok(CARDS_PER_ISSUE >= 5);
});

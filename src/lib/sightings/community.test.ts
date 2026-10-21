import { strict as assert } from "node:assert";
import { test } from "node:test";

import { MAX_FOLLOW_CHARS, impactLine, isFollowTarget, nodFor, parseFollowTarget, seenNotice, seenText, thanksText } from "./community";

test("a report takes 'seen it too' while open and 'thank you' once fixed, and nothing on a home's report", () => {
  for (const s of ["open", "reported", "authority_done"] as const) assert.equal(nodFor({ caseStatus: s, category: "dumping" }), "seen_too", s);
  assert.equal(nodFor({ caseStatus: "fixed", category: "dumping" }), "thanks");
  assert.equal(nodFor({ caseStatus: "closed", category: "dumping" }), null);
  assert.equal(nodFor({ caseStatus: null, category: "dumping" }), null);
  // Tap water and water tests are a home's: never a nod.
  for (const s of ["open", "fixed"] as const) assert.equal(nodFor({ caseStatus: s, category: "drinking" }), null, s);
});

test("follow keys take the shapes followTargets builds, and nothing else", () => {
  for (const ok of ["chennai", "tn-erode", "chennai:ward:12", "tn-erode:gp:223344", "body:32945537", "body:KA06LH0006 ( NRLD 2019)", "arkavathi:ward:W-3"]) {
    assert.ok(isFollowTarget(ok), ok);
  }
  const bad = [
    "", "c", "Chennai", "chennai:ward:", "chennai:zone:1", "body:", "body: 12", "body:12 ", "chennai:ward:1\n",
    "body:" + "x".repeat(MAX_FOLLOW_CHARS), "a".repeat(41), "chennai/ward/1", "body:café", 12, null, undefined, { target: "chennai" },
  ];
  for (const b of bad) assert.ok(!isFollowTarget(b), JSON.stringify(b));
});

test("a follow key splits into its place and unit", () => {
  assert.deepEqual(parseFollowTarget("chennai"), { kind: "place", place: "chennai" });
  assert.deepEqual(parseFollowTarget("chennai:ward:12"), { kind: "ward", place: "chennai", id: "12" });
  assert.deepEqual(parseFollowTarget("tn-erode:gp:223344"), { kind: "gp", place: "tn-erode", id: "223344" });
  assert.deepEqual(parseFollowTarget("body:32945537"), { kind: "body", id: "32945537" });
  assert.equal(parseFollowTarget("chennai:zone:1"), null);
});

test("a reporter hears at 1, 3, 10 and 25 people, not on every tap", () => {
  const told = Array.from({ length: 40 }, (_, i) => i + 1).filter((n) => seenNotice(n));
  assert.deepEqual(told, [1, 3, 10, 25]);
  assert.equal(seenNotice(0), null);
  assert.equal(seenNotice(3)?.body, "3 people nearby have seen your report too.");
  assert.equal(seenNotice(1)?.body, "Someone nearby has seen your report too.");
});

test("counts and the reporter's summary read plainly, with no em dashes or middle dots", () => {
  assert.equal(seenText(1), "Seen by 1 person");
  assert.equal(seenText(12), "Seen by 12 people");
  assert.equal(thanksText(3), "Thanked by 3 people");
  assert.equal(impactLine(0, 0), null);
  assert.equal(impactLine(23, 4), "Your reports were seen by 23 people nearby and thanked 4 times.");
  assert.equal(impactLine(1, 1), "Your reports were seen by 1 person nearby and thanked once.");
  assert.equal(impactLine(0, 2), "Your reports were thanked 2 times.");
  assert.equal(impactLine(5, 0), "Your reports were seen by 5 people nearby.");
  for (const s of [seenNotice(1)!.title, seenNotice(10)!.title, impactLine(2, 2)!]) assert.ok(!/[—·]/.test(s), s);
});

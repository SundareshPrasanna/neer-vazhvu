import { strict as assert } from "node:assert";
import { test } from "node:test";

import { NUDGE_DAYS, dueByReporter, nudgeNotice, parseSubscription, type NudgeRow } from "./push";

const P256DH = "B" + "x".repeat(86);
const AUTH = "a".repeat(22);
const sub = (endpoint: string, keys: Record<string, unknown> = { p256dh: P256DH, auth: AUTH }) => ({ endpoint, keys });

test("a subscription is accepted only from a browser push service, with well-formed keys", () => {
  for (const host of ["fcm.googleapis.com/fcm/send/abc", "updates.push.services.mozilla.com/wpush/v2/abc", "web.push.apple.com/QF1", "wns2-par02p.notify.windows.com/w/?token=abc"]) {
    assert.deepEqual(parseSubscription(sub(`https://${host}`)), { endpoint: `https://${host}`, p256dh: P256DH, auth: AUTH }, host);
  }
  const bad = [
    null,
    "x",
    { endpoint: "https://fcm.googleapis.com/fcm/send/abc" },
    sub("http://fcm.googleapis.com/fcm/send/abc"),
    sub("https://example.com/fcm/send/abc"),
    sub("https://fcm.googleapis.com.evil.example/abc"),
    sub("https://notify.windows.com.evil.example/abc"),
    sub("https://user:pw@fcm.googleapis.com/fcm/send/abc"),
    sub("https://fcm.googleapis.com:8443/fcm/send/abc"),
    sub(`https://fcm.googleapis.com/${"a".repeat(1000)}`),
    sub("https://fcm.googleapis.com/fcm/send/abc", { p256dh: "short", auth: AUTH }),
    sub("https://fcm.googleapis.com/fcm/send/abc", { p256dh: P256DH, auth: "not base64!!!!!!!!!!" }),
    sub("https://fcm.googleapis.com/fcm/send/abc", { p256dh: P256DH, auth: 12 }),
  ];
  for (const b of bad) assert.equal(parseSubscription(b), null, JSON.stringify(b));
});

test("a reminder goes to published open reports quiet for two weeks, once per lull", () => {
  const now = new Date("2026-10-17T04:30:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const row = (id: string, over: Partial<NudgeRow> = {}): NudgeRow => ({
    id,
    reporter_key: "k1",
    review_status: "approved",
    case_status: "open",
    created_at: ago(30),
    nudged_at: null,
    ...over,
  });
  const rows = [
    row("due"),
    row("reported", { case_status: "reported" }),
    row("other-reporter", { reporter_key: "k2", case_status: "authority_done" }),
    row("recent", { created_at: ago(NUDGE_DAYS - 1) }),
    row("recent-event"),
    row("old-event"),
    row("nudged-lately", { nudged_at: ago(3) }),
    row("nudged-long-ago", { nudged_at: ago(NUDGE_DAYS + 1) }),
    row("fixed", { case_status: "fixed" }),
    row("closed", { case_status: "closed" }),
    row("no-status", { case_status: null }),
    row("checking", { review_status: "received" }),
    row("deleted", { reporter_key: "deleted" }),
  ];
  const events = new Map([
    ["recent-event", ago(2)],
    ["old-event", ago(20)],
  ]);
  const due = dueByReporter(rows, events, now);
  assert.deepEqual([...due.keys()].sort(), ["k1", "k2"]);
  assert.deepEqual(due.get("k1"), ["due", "reported", "old-event", "nudged-long-ago"]);
  assert.deepEqual(due.get("k2"), ["other-reporter"]);
});

test("the reminder carries a count only, in plain words", () => {
  assert.match(nudgeNotice(1).body, /^You have one report .* Is it still there, or fixed\?$/);
  assert.match(nudgeNotice(3).body, /^You have 3 reports .* Are they still there, or fixed\?$/);
  for (const n of [1, 3]) {
    const { title, body, url } = nudgeNotice(n);
    assert.equal(url, "/for-citizens");
    assert.ok(!/[—–·]/.test(title + body));
  }
});

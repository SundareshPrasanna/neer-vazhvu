import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { digest, readDigest } = require("./rolling-alert.js");
const knownBlocked = require("./known-blocked.json");

type Issue = { number: number; title: string; body: string; state: string };

/** The four octokit calls digest makes, over an in-memory issue list. */
function fakeGithub(issues: Issue[]) {
  const comments: { issue: number; body: string }[] = [];
  const rest = {
    issues: {
      listForRepo: "list",
      create: async (o: { title: string; body: string }) =>
        void issues.push({ number: 100 + issues.length, title: o.title, body: o.body, state: "open" }),
      update: async (o: { issue_number: number; title?: string; body?: string; state?: string }) => {
        const { issue_number, ...fields } = o;
        Object.assign(issues.find((i) => i.number === issue_number)!, fields);
      },
      createComment: async (o: { issue_number: number; body: string }) =>
        void comments.push({ issue: o.issue_number, body: o.body }),
    },
  };
  return { github: { rest, paginate: async () => issues.filter((i) => i.state === "open") }, comments };
}

const context = { repo: { owner: "o", repo: "r" }, serverUrl: "https://github.com", runId: 1 };
const register = {
  entries: [{ match: ["hyderabad:reservoir:*"], reason: "HMWSSB quiet.", since: "2026-10-21", review: "2026-11-06" }],
};
const item = (id: string, level = 0) => ({ id, summary: `${id} is stale.`, level });
const run = (github: unknown, o: object) =>
  digest({ github, context, channel: "freshness", note: "", register, today: "2026-10-23", ...o });

test("a new break is named in the title and notifies; a known-blocked one does neither", async () => {
  const issues: Issue[] = [];
  const { github, comments } = fakeGithub(issues);
  await run(github, { items: [item("hyderabad:reservoir:singur"), item("hyderabad:reservoir:manjira")] });
  assert.equal(issues[0].title, "Pipeline alerts: nothing new (+2 known blocked)");
  await run(github, { items: [item("hyderabad:reservoir:singur"), item("hyderabad:reservoir:manjira")] });
  assert.equal(comments.length, 0);
  await run(github, { channel: "daily-pipeline", items: [item("cmwssb-scrape")] });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].title, "Pipeline alerts: cmwssb-scrape (+2 known blocked)");
  assert.match(comments[0].body, /cmwssb-scrape/);
});

test("a channel keeps the others' items, and scope keeps its own unread ones", async () => {
  const issues: Issue[] = [];
  const { github } = fakeGithub(issues);
  await run(github, { channel: "atlas-refresh", scope: ["atlas-refresh:erode"], items: [item("atlas-refresh:erode")] });
  await run(github, { items: [item("a"), item("b")] });
  await run(github, { scope: ["a"], items: [] });
  const { channels } = readDigest(issues[0].body);
  assert.deepEqual(Object.keys(channels["atlas-refresh"].items), ["atlas-refresh:erode"]);
  assert.deepEqual(Object.keys(channels.freshness.items), ["b"]);
});

test("a comment when a level rises, and when a block passes its review date", async () => {
  const issues: Issue[] = [];
  const { github, comments } = fakeGithub(issues);
  await run(github, { items: [item("a", 1), item("hyderabad:reservoir:singur")] });
  await run(github, { items: [item("a", 2), item("hyderabad:reservoir:singur")] });
  assert.equal(comments.length, 1);
  await run(github, { items: [item("a", 2), item("hyderabad:reservoir:singur")], today: "2026-11-07" });
  assert.equal(comments.length, 2);
  assert.match(comments[1].body, /singur.*Known blocked until 2026-11-06/);
});

test("closes when nothing is flagged; a later break opens a new digest", async () => {
  const issues: Issue[] = [];
  const { github } = fakeGithub(issues);
  await run(github, { items: [item("a")] });
  await run(github, { items: [] });
  assert.equal(issues[0].state, "closed");
  await run(github, { items: [item("b")] });
  assert.deepEqual(issues.map((i) => i.state), ["closed", "open"]);
});

test("known-blocked.json entries are complete and dated", () => {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  for (const e of knownBlocked.entries) {
    assert.ok(e.match.length && e.match.every((m: unknown) => typeof m === "string" && m), JSON.stringify(e));
    assert.ok(e.reason && date.test(e.since) && date.test(e.review) && e.since <= e.review, JSON.stringify(e));
  }
});

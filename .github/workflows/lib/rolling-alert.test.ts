import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { itemAlerts, writeState } = createRequire(import.meta.url)("./rolling-alert.js");

type Issue = { number: number; title: string; body: string; state: string };

/** The four octokit calls itemAlerts makes, over an in-memory issue list. */
function fakeGithub(issues: Issue[]) {
  const comments: { issue: number; body: string }[] = [];
  const rest = {
    issues: {
      listForRepo: "list",
      create: async (o: { title: string; body: string }) =>
        void issues.push({ number: 100 + issues.length, title: o.title, body: o.body, state: "open" }),
      update: async (o: { issue_number: number; body?: string; state?: string }) =>
        void Object.assign(issues.find((i) => i.number === o.issue_number)!, o.body ? { body: o.body } : { state: o.state }),
      createComment: async (o: { issue_number: number; body: string }) =>
        void comments.push({ issue: o.issue_number, body: o.body }),
    },
  };
  return { github: { rest, paginate: async () => issues.filter((i) => i.state === "open") }, comments };
}

const context = { repo: { owner: "o", repo: "r" }, serverUrl: "https://github.com", runId: 1 };
const item = (id: string, level = 0) => ({ id, title: `Stale feed: ${id}`, body: "row", summary: `${id} is stale`, level });
const managed = (number: number, id: string, level = 0): Issue => ({
  number, title: `Stale feed: ${id}`, body: writeState([`item:${id}`, `level:${level}`]), state: "open",
});
const run = (github: unknown, o: object) =>
  itemAlerts({ github, context, labels: ["pipeline-alert", "data-freshness"], footer: "", ...o });

test("a new stale feed opens its own issue beside a long-lived one", async () => {
  const issues = [managed(1, "bangalore:wris-groundwater", 2)];
  const { github, comments } = fakeGithub(issues);
  await run(github, { items: [item("bangalore:wris-groundwater", 2), item("chennai:reservoir")] });
  assert.deepEqual(issues.map((i) => [i.title, i.state]), [
    ["Stale feed: bangalore:wris-groundwater", "open"],
    ["Stale feed: chennai:reservoir", "open"],
  ]);
  assert.equal(comments.length, 0);
});

test("a comment only when the level rises", async () => {
  const issues = [managed(1, "a", 1)];
  const { github, comments } = fakeGithub(issues);
  await run(github, { items: [item("a", 1)] });
  assert.equal(comments.length, 0);
  await run(github, { items: [item("a", 2)] });
  assert.deepEqual(comments.map((c) => c.issue), [1]);
  await run(github, { items: [item("a", 2)] });
  assert.equal(comments.length, 1);
});

test("a recovered feed closes; an unread feed and an unmanaged issue are left alone", async () => {
  const rolling: Issue = { number: 271, title: "Data freshness: stale feeds", body: "<!--alert-state:a|b-->", state: "open" };
  const issues = [managed(1, "recovered"), managed(2, "unread"), rolling];
  const { github } = fakeGithub(issues);
  await run(github, { items: [], unknown: ["unread"] });
  assert.deepEqual(issues.map((i) => i.state), ["closed", "open", "open"]);
});

test("nothing closes when the checker did not finish", async () => {
  const issues = [managed(1, "a")];
  const { github } = fakeGithub(issues);
  await run(github, { items: [item("checker")], complete: false });
  assert.deepEqual(issues.map((i) => i.state), ["open", "open"]);
});

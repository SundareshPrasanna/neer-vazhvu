import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseRequest } from "./validate";

const base = { kind: "city", subject: "Trivandrum", name: "Asha" };

test("a request needs a known kind, a subject and a name", () => {
  assert.equal(parseRequest(base).ok, true);
  assert.equal(parseRequest({ ...base, kind: "town" }).ok, false);
  assert.equal(parseRequest({ ...base, subject: " k " }).ok, false);
  assert.equal(parseRequest({ ...base, name: "   " }).ok, false);
  assert.equal(parseRequest(null).ok, false);
});

test("fields are cleaned, and contact needs an explicit yes", () => {
  const r = parseRequest({ ...base, subject: "  Navi   Mumbai ", message: " line one\nline two ", contactOk: "true", sourcePath: "/?q=x" });
  assert.ok(r.ok);
  assert.equal(r.value.subject, "Navi Mumbai");
  assert.equal(r.value.message, "line one\nline two");
  assert.equal(r.value.contactOk, false);
  assert.equal(r.value.sourcePath, "/?q=x");
  const bad = parseRequest({ ...base, contactOk: true, sourcePath: "https://evil.test/" });
  assert.ok(bad.ok);
  assert.equal(bad.value.contactOk, true);
  assert.equal(bad.value.sourcePath, null);
});

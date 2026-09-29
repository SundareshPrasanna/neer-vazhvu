import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fetchJson, fetchJsonOrNull, fetchJsonShared } from "./fetch-json";

const HTML_404 = "<!DOCTYPE html><html><body>404</body></html>";
let calls = 0;
globalThis.fetch = (async (url: string) => {
  calls++;
  if (url.includes("missing")) return new Response(HTML_404, { status: 404 });
  if (url.includes("broken")) return new Response(HTML_404, { status: 500 });
  return new Response(JSON.stringify({ url }), { status: 200 });
}) as typeof fetch;

test("fetchJson rejects a 404 with the URL and status, not a JSON parse error", async () => {
  await assert.rejects(fetchJson("/data/missing.json"), /GET \/data\/missing\.json: HTTP 404/);
  assert.deepEqual(await fetchJson("/data/x.json"), { url: "/data/x.json" });
});

test("fetchJsonOrNull resolves a missing file to null", async () => {
  assert.equal(await fetchJsonOrNull("/data/missing.json"), null);
  assert.equal(await fetchJsonOrNull("/data/broken.json"), null);
});

test("fetchJsonShared makes one request per URL and retries after a failure", async () => {
  calls = 0;
  const [a, b] = await Promise.all([fetchJsonShared("/data/s.json"), fetchJsonShared("/data/s.json")]);
  assert.equal(a, b);
  assert.equal(calls, 1);
  await assert.rejects(fetchJsonShared("/data/broken.json"));
  await assert.rejects(fetchJsonShared("/data/broken.json"));
  assert.equal(calls, 3);
});

import assert from "node:assert/strict";
import test from "node:test";

import { testLabel } from "./test-meta";
import { parseSubmit } from "./validate";

const form = (extra: Record<string, string>) => {
  const f = new FormData();
  const base: Record<string, string> = { lat: "13.05", lng: "80.2", category: "drinking", subcategory: "water_test", waterSource: "borewell", "reading.tds": "640" };
  for (const [k, v] of Object.entries({ ...base, ...extra })) f.append(k, v);
  f.append("photos", new File([new Uint8Array([1, 2, 3])], "meter.jpg", { type: "image/jpeg" }));
  return f;
};

test("a water test needs what it was tested with and whether the water was filtered", () => {
  assert.deepEqual(parseSubmit(form({})), { ok: false, error: "Choose what you tested with." });
  assert.deepEqual(parseSubmit(form({ "test.instrument": "meter" })), { ok: false, error: "Say whether the water was filtered." });
  const ok = parseSubmit(form({ "test.instrument": "meter", "test.filtered": "raw" }));
  assert.ok(ok.ok && ok.value.testMeta?.instrument === "meter" && ok.value.testMeta.filtered === "raw");
});

test("optional test details are kept only when valid", () => {
  const r = parseSubmit(form({ "test.instrument": "kit", "test.filtered": "unknown", "test.calibrated": "never", "test.flushed": "yes", "test.depthFt": "450", "test.model": " Pen T3 " }));
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value.testMeta, { instrument: "kit", filtered: "unknown", calibrated: "never", flushed: true, depthFt: 450, model: "Pen T3" });
  assert.deepEqual(parseSubmit(form({ "test.instrument": "meter", "test.filtered": "raw", "test.depthFt": "99999" })), { ok: false, error: "The borewell depth looks out of range." });
  const junk = parseSubmit(form({ "test.instrument": "meter", "test.filtered": "raw", "test.calibrated": "yesterday", "test.flushed": "maybe" }));
  assert.ok(junk.ok && junk.value.testMeta?.calibrated === undefined && junk.value.testMeta?.flushed === undefined);
});

test("reports without readings carry no test details", () => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ lat: "13.05", lng: "80.2", category: "dumping", subcategory: "floating_trash", "test.instrument": "meter" })) f.append(k, v);
  f.append("photos", new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" }));
  const r = parseSubmit(f);
  assert.ok(r.ok && r.value.testMeta === null);
});

test("the public line says how the test was done, and never lets filtered water stand for the source", () => {
  assert.equal(testLabel({ instrument: "meter", filtered: "raw" }, "Borewell"), "Home test with a digital meter, water straight from the borewell");
  assert.match(testLabel({ instrument: "kit", filtered: "filtered" }, "Piped tap"), /approximate, after a filter or RO, so it does not describe the piped tap itself$/);
  assert.equal(testLabel({ instrument: "lab", filtered: "unknown" }, null), "From a lab report");
});

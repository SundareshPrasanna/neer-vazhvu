import { strict as assert } from "node:assert";
import { test } from "node:test";
import { wardNumberOf } from "./ward-number";

test("reads every ward-number spelling the ward files use", () => {
  assert.equal(wardNumberOf({ ward_number: 12, Ward_No: 12 }), 12);
  assert.equal(wardNumberOf({ Ward_No: "7" }), 7);
  assert.equal(wardNumberOf({ ward_no: 150 }), 150);
});

test("a feature with no ward number is null, not ward 0", () => {
  assert.equal(wardNumberOf({ name: "x" }), null);
  assert.equal(wardNumberOf(null), null);
  assert.equal(wardNumberOf({ ward_no: "" }), null);
});

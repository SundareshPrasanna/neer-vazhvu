import { strict as assert } from "node:assert";
import { test } from "node:test";

import { REVIEW_KEYS, isTyping, reviewCommand } from "./review-keys";

const body = { tagName: "BODY" };

test("each letter maps to its command, in either case", () => {
  assert.equal(reviewCommand({ key: "j", target: body }), "next");
  assert.equal(reviewCommand({ key: "K", target: body }), "previous");
  assert.equal(reviewCommand({ key: "a", target: body }), "approve");
  assert.equal(reviewCommand({ key: "r", target: body }), "reject");
  assert.equal(reviewCommand({ key: "p", target: body }), "publish");
  assert.equal(reviewCommand({ key: "d", target: body }), "discard");
  assert.equal(reviewCommand({ key: "m", target: body }), "same");
  assert.equal(reviewCommand({ key: "x", target: body }), null);
  assert.equal(reviewCommand({ key: "Enter", target: body }), null);
});

test("never while typing in a field, nor with a modifier or a held key", () => {
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input"]) assert.equal(reviewCommand({ key: "a", target: { tagName } }), null, tagName);
  assert.equal(reviewCommand({ key: "a", target: { tagName: "DIV", isContentEditable: true } }), null);
  assert.equal(reviewCommand({ key: "a", ctrlKey: true, target: body }), null);
  assert.equal(reviewCommand({ key: "a", metaKey: true, target: body }), null);
  assert.equal(reviewCommand({ key: "a", altKey: true, target: body }), null);
  assert.equal(reviewCommand({ key: "j", repeat: true, target: body }), null);
  assert.equal(isTyping({ tagName: "BUTTON" }), false);
  assert.equal(isTyping(null), false);
});

test("Escape cancels, even from the reason field", () => {
  assert.equal(reviewCommand({ key: "Escape", target: { tagName: "INPUT" } }), "cancel");
});

test("one key per command, single letters", () => {
  const keys = REVIEW_KEYS.map((k) => k.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(REVIEW_KEYS.map((k) => k.command)).size, keys.length);
  for (const k of keys) assert.match(k, /^[A-Z]$/);
});

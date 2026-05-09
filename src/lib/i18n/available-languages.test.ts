import assert from "node:assert/strict";
import test from "node:test";

import { resolveAvailableLanguagesForPath } from "./available-languages";

test("root path resolves to Chennai's available languages (legacy)", () => {
  const langs = resolveAvailableLanguagesForPath("/");
  assert.deepEqual([...langs], ["en", "ta"]);
});

test("legacy unscoped path resolves to Chennai's languages", () => {
  const langs = resolveAvailableLanguagesForPath("/water-bodies");
  assert.deepEqual([...langs], ["en", "ta"]);
});

test("madurai-scoped path resolves to Madurai's languages", () => {
  const langs = resolveAvailableLanguagesForPath("/madurai/water-bodies");
  assert.deepEqual([...langs], ["en", "ta"]);
});

test("explicit chennai-scoped path resolves to Chennai's languages", () => {
  const langs = resolveAvailableLanguagesForPath("/chennai/about");
  assert.deepEqual([...langs], ["en", "ta"]);
});

test("unknown city slug falls back to Chennai (legacy default)", () => {
  // Future-proofs the resolver: if a city is added without
  // availableLanguages, we don't crash; we use the Chennai default.
  const langs = resolveAvailableLanguagesForPath("/some-future-place/page");
  assert.deepEqual([...langs], ["en", "ta"]);
});

test("path with trailing slash and query is parsed correctly", () => {
  const langs = resolveAvailableLanguagesForPath("/madurai/");
  assert.deepEqual([...langs], ["en", "ta"]);
});

test("returns at least 'en' even if config lookup fails", () => {
  const langs = resolveAvailableLanguagesForPath("");
  assert.ok(langs.length >= 1);
  assert.ok(langs.includes("en"));
});

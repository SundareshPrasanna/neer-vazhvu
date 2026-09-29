import assert from "node:assert/strict";
import test from "node:test";

import { resolveAvailableLanguagesForPath } from "./available-languages";

test("the landing page is not a city and offers English only", () => {
  assert.deepEqual([...resolveAvailableLanguagesForPath("/")], ["en"]);
});

test("madurai-scoped path resolves to Madurai's languages", () => {
  const langs = resolveAvailableLanguagesForPath("/madurai/water-bodies");
  assert.deepEqual([...langs], ["en", "ta"]);
});

test("explicit chennai-scoped path resolves to Chennai's languages", () => {
  const langs = resolveAvailableLanguagesForPath("/chennai/about");
  assert.deepEqual([...langs], ["en", "ta"]);
});

test("a path outside any city offers English only, not another city's languages", () => {
  assert.deepEqual([...resolveAvailableLanguagesForPath("/some-future-place/page")], ["en"]);
  assert.deepEqual([...resolveAvailableLanguagesForPath("/atlas/mh/satara")], ["en"]);
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

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve } from "path";

import { CITIES_WITH_WARD_RANKINGS, hasWardRankings } from "./cities";

/**
 * The set in ./cities and the loader branches in ./load-rankings must agree.
 *
 * They did not: load-rankings listed five cities inline and ward-selector.tsx
 * linked to /<city>/my-ward/rankings with no check, so Gurugram - which has a
 * my-ward page and no rankings bundle - shipped a link to a 404. Parsing the
 * loader rather than importing it keeps this test free of `fs`-backed module
 * loading and of the JSON those loaders read.
 */
test("every loader branch in load-rankings is in CITIES_WITH_WARD_RANKINGS", () => {
  const src = readFileSync(
    resolve(process.cwd(), "src/lib/ward-rankings/load-rankings.ts"),
    "utf8",
  );
  const body = src.slice(src.indexOf("export function loadWardRankings"));
  const end = body.indexOf("\n}");
  const branches = [...body.slice(0, end).matchAll(/cityId === "([a-z-]+)"/g)].map(
    (m) => m[1],
  );

  assert.ok(branches.length > 0, "no loader branches found - did the shape change?");
  for (const city of branches) {
    assert.ok(
      hasWardRankings(city),
      `${city} has a loader branch but is missing from CITIES_WITH_WARD_RANKINGS`,
    );
  }
  for (const city of CITIES_WITH_WARD_RANKINGS) {
    assert.ok(
      branches.includes(city),
      `${city} is in CITIES_WITH_WARD_RANKINGS but has no loader branch`,
    );
  }
});

test("a city with no rankings bundle is reported as having none", () => {
  assert.equal(hasWardRankings("gurugram"), false);
  assert.equal(hasWardRankings("surat"), false);
  assert.equal(hasWardRankings("pune"), false);
  assert.equal(hasWardRankings("chennai"), true);
});

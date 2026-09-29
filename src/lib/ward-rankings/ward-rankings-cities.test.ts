import { test } from "node:test";
import assert from "node:assert/strict";

import { hasWardRankings } from "./cities";

// Membership is derived from the pre-baked specs plus Chennai, so the link in
// ward-selector.tsx and the rankings route cannot drift apart. Gurugram once
// shipped a link to a 404 when they were two hand-kept lists.
test("a city with no rankings bundle is reported as having none", () => {
  assert.equal(hasWardRankings("gurugram"), false);
  assert.equal(hasWardRankings("surat"), false);
  assert.equal(hasWardRankings("pune"), false);
  assert.equal(hasWardRankings("chennai"), true);
});

import assert from "node:assert/strict";
import test from "node:test";

import { listBasins } from ".";

// scripts/new_district_basin.py writes TODO copy (blurb, credits) that must not reach a registered map.
test("no registered basin manifest carries TODO text", () => {
  for (const m of listBasins()) assert.doesNotMatch(JSON.stringify(m), /\bTODO\b/, `${m.basinId}: fill the scaffold's TODOs before registering it`);
});

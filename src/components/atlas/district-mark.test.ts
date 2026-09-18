import assert from "node:assert/strict";
import test from "node:test";

import { listAtlasDistricts } from "@/lib/atlas/registry";
import { DISTRICT_ACCENT, districtAccent, hasDistrictMark } from "./district-mark";

// Every registered district is drawn: a new district cannot ship on the
// shared fallback mark (his rule: no two districts share one image).
test("every Atlas district has its own mark and accent", () => {
  for (const district of listAtlasDistricts()) {
    assert.ok(hasDistrictMark(district.scopeId), `${district.scopeId} has no drawn mark`);
    assert.ok(district.scopeId in DISTRICT_ACCENT, `${district.scopeId} has no accent`);
  }
});

test("no two districts share an accent within a state", () => {
  const byState = new Map<string, string[]>();
  for (const [scopeId, accent] of Object.entries(DISTRICT_ACCENT)) {
    const state = scopeId.split("-")[0];
    byState.set(state, [...(byState.get(state) ?? []), accent]);
  }
  for (const [state, accents] of byState) {
    assert.equal(new Set(accents).size, accents.length, `${state}: duplicate accent`);
  }
});

test("an unknown scope falls back to the shared accent", () => {
  assert.equal(districtAccent("xx-nowhere"), "from-teal-500 to-emerald-700");
});

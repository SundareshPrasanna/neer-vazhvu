import assert from "node:assert/strict";
import test from "node:test";

import {
  ATLAS_DISTRICTS,
  groupAtlasStates,
  stateHref,
  type AtlasDistrict,
} from "./registry";

function mini(slug: string, stateSlug: string, stateName: string): AtlasDistrict {
  return {
    slug,
    scopeId: `${stateSlug}-${slug}`,
    stateSlug,
    stateCode: stateSlug.toUpperCase(),
    stateName,
    name: slug,
    hook: "",
    hasCuratedBriefs: false,
    published: true,
    irrigationCurrentSource: { label: "", nextStep: "", gapNote: "" },
  };
}

test("states group by first appearance and keep district order", () => {
  const states = groupAtlasStates([
    mini("a", "tn", "Tamil Nadu"),
    mini("b", "mh", "Maharashtra"),
    mini("c", "tn", "Tamil Nadu"),
  ]);
  assert.equal(states.length, 2);
  assert.deepEqual(states.map((s) => s.stateSlug), ["tn", "mh"]);
  assert.deepEqual(states[0].districts.map((d) => d.slug), ["a", "c"]);
});

test("an empty district list yields no states: the tier gates on data", () => {
  assert.deepEqual(groupAtlasStates([]), []);
});

test("every registered state carries a hook and a stable href", () => {
  for (const s of groupAtlasStates(ATLAS_DISTRICTS)) {
    assert.ok(s.hook.length > 0, `state ${s.stateSlug} has no hook`);
    assert.equal(stateHref(s.stateSlug), `/atlas/${s.stateSlug}`);
  }
});

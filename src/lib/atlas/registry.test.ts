import assert from "node:assert/strict";
import test from "node:test";

import { tryGetBasinManifest } from "../basins";
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

test("every basin link names a registered basin, and a sub-basin by its manifest key and name", () => {
  for (const d of ATLAS_DISTRICTS) {
    if (d.deepDive) assert.ok(tryGetBasinManifest(d.deepDive.basinId), `${d.slug}: no basin manifest ${d.deepDive.basinId}`);
    if (!d.basin) continue;
    const sub = tryGetBasinManifest(d.basin.basinId)?.subBasins?.find((s) => s.key === d.basin!.subBasinKey);
    assert.ok(sub, `${d.slug}: ${d.basin.basinId} has no sub-basin ${d.basin.subBasinKey}`);
    assert.equal(sub.name, d.basin.subBasinName, `${d.slug}: sub-basin name differs from the manifest`);
  }
});

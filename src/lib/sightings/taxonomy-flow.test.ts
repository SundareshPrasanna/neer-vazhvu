import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  EXTENTS,
  GOOD_NEWS_KEY,
  HOME_SMELLS,
  RELATED_TYPES,
  REPORT_GROUPS,
  SEEN_AT,
  getType,
  homeSmellType,
  isCommunityReport,
  isPrivateCategory,
  relatedKey,
  relatedSubcategories,
  roleFor,
  typesFor,
} from "./taxonomy";
import type { SeenAt } from "./types";
import { parseSubmit } from "./validate";

const PUBLIC_PLACES: SeenAt[] = ["lake", "river", "drain", "street"];
const all = REPORT_GROUPS.flatMap((group) => group.types.map((type) => ({ group, type })));

test("every public type outside good news is offered at a public place, and never at home", () => {
  for (const { group, type } of all.filter((x) => isCommunityReport(x.group.key) && x.group.key !== GOOD_NEWS_KEY)) {
    assert.ok(type.seenAt?.some((p) => PUBLIC_PLACES.includes(p)), `${group.key}/${type.key} has no public place`);
    assert.ok(!type.seenAt?.includes("home"), `${group.key}/${type.key} is offered at home`);
  }
  // Good news is added at every public place by the What step itself.
  for (const type of REPORT_GROUPS.find((g) => g.key === GOOD_NEWS_KEY)!.types) assert.equal(type.seenAt, undefined, type.key);
});

test("home lists only private types; every private type is reachable from home or its smell question", () => {
  const home = typesFor("home");
  assert.ok(home.length > 0);
  for (const { group, type } of home) assert.ok(isPrivateCategory(group.key), `${group.key}/${type.key}`);
  for (const p of PUBLIC_PLACES) for (const { group, type } of typesFor(p)) assert.ok(!isPrivateCategory(group.key), `${p}: ${group.key}/${type.key}`);
  const reachable = new Set([...home.map((x) => x.type.key), ...HOME_SMELLS.map((s) => s.subcategory), homeSmellType("salty", "borewell")]);
  for (const { group, type } of all.filter((x) => isPrivateCategory(x.group.key))) assert.ok(reachable.has(type.key), `${group.key}/${type.key}`);
});

test("each public place leads with 6 to 8 common types, then the rest; no type twice", () => {
  for (const p of PUBLIC_PLACES) {
    const list = typesFor(p);
    const common = list.filter((x) => x.type.common).length;
    assert.ok(common >= 6 && common <= 8, `${p}: ${common} common`);
    assert.ok(list.slice(0, common).every((x) => x.type.common) && list.slice(common).every((x) => !x.type.common), p);
    assert.equal(new Set(list.map((x) => x.type.key)).size, list.length, p);
  }
  // The tank structures and low water read under a lake.
  const lake = typesFor("lake").map((x) => x.type.key);
  for (const k of ["drying_up", "bund_breach", "inlet_blocked", "sluice_damaged"]) assert.ok(lake.includes(k), k);
});

test("type keys are unique across groups, so a key alone names its group", () => {
  const keys = all.map((x) => x.type.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("labels and hints are plain: no em dash, en dash or middle dot", () => {
  const texts = [
    ...REPORT_GROUPS.flatMap((g) => [g.label, g.hint, ...g.types.map((t) => t.label)]),
    ...SEEN_AT.flatMap((s) => [s.label, s.hint]),
    ...EXTENTS.map((e) => e.label),
    ...HOME_SMELLS.map((s) => s.label),
  ];
  for (const s of texts) assert.ok(!/[—–·]/.test(s), s);
});

test("routing roles stay as they were", () => {
  const overrides = all.filter((x) => x.type.role !== undefined).map((x) => `${x.type.key}:${x.type.role}`).sort();
  assert.deepEqual(overrides, [
    "borewell_quality:null",
    "bund_breach:water_body",
    "dead_fish:pollution_control",
    "effluent_discharge:pollution_control",
    "hazardous_waste:pollution_control",
    "inlet_blocked:water_body",
    "oil_film:pollution_control",
    "sluice_damaged:water_body",
    "water_test:null",
  ]);
  assert.equal(roleFor("flooding", "drain_overflow"), "storm_drainage");
  assert.equal(roleFor("sewage", "manhole_overflow"), "sewerage");
  assert.equal(roleFor("surface", "drying_up"), "water_body");
});

test("related types exist, are public, and each sits in one set", () => {
  const seen = new Set<string>();
  for (const set of RELATED_TYPES) {
    assert.ok(set.length >= 2);
    for (const k of set) {
      const owner = all.find((x) => x.type.key === k);
      assert.ok(owner, `${k} is not a type`);
      assert.ok(isCommunityReport(owner.group.key), `${k} is a home type`);
      assert.ok(!seen.has(k), `${k} sits in two sets`);
      seen.add(k);
    }
  }
  assert.equal(relatedKey("sewage", "manhole_overflow"), relatedKey("flooding", "drain_overflow"));
  assert.equal(relatedKey("dumping", "cd_debris"), relatedKey("encroachment", "filling_in"));
  assert.notEqual(relatedKey("surface", "dead_fish"), relatedKey("dumping", "carcass_waste"));
  assert.deepEqual(relatedSubcategories("dead_fish"), ["dead_fish"]);
  assert.ok(relatedSubcategories("floating_trash").includes("garbage_on_bank"));
});

test("a home smell is sent as the type it describes; salty well water is the well's own", () => {
  for (const s of HOME_SMELLS) assert.ok(getType("drinking", s.subcategory), s.key);
  assert.equal(homeSmellType("sewage", "piped"), "sewage_in_supply");
  assert.equal(homeSmellType("chlorine", "piped"), "smelly_tap_water");
  assert.equal(homeSmellType("salty", "piped"), "smelly_tap_water");
  assert.equal(homeSmellType("salty", "borewell"), "borewell_quality");
  assert.equal(homeSmellType("salty", "open_well"), "borewell_quality");
  assert.equal(homeSmellType("salty", null), "smelly_tap_water");
  assert.equal(homeSmellType("perfume", "piped"), null);
});

test("a report from home must be about home water, and home water must come from home", () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ lat: "13.05", lng: "80.2", ...fields })) f.append(k, v);
    f.append("photos", new File([new Uint8Array(20)], "p.jpg", { type: "image/jpeg" }));
    return f;
  };
  const lake = parseSubmit(form({ category: "dumping", subcategory: "garbage_on_bank", seenAt: "lake", extent: "stretch" }));
  assert.ok(lake.ok && lake.value.seenAt === "lake" && lake.value.extent === "stretch");
  assert.equal(parseSubmit(form({ category: "dumping", subcategory: "garbage_on_bank", seenAt: "home" })).ok, false);
  assert.equal(parseSubmit(form({ category: "other", note: "Tanker", seenAt: "home" })).ok, false);
  assert.equal(parseSubmit(form({ category: "drinking", subcategory: "dirty_tap_water", seenAt: "street" })).ok, false);
  assert.equal(parseSubmit(form({ category: "dumping", subcategory: "garbage_on_bank", seenAt: "moon" })).ok, false);
  assert.equal(parseSubmit(form({ category: "dumping", subcategory: "garbage_on_bank", extent: "huge" })).ok, false);
  const home = parseSubmit(form({ category: "drinking", subcategory: "dirty_tap_water", seenAt: "home", extent: "widespread" }));
  assert.ok(home.ok && home.value.seenAt === "home" && home.value.extent === null, "no extent on a home report");
  const none = parseSubmit(form({ category: "dumping", subcategory: "garbage_on_bank" }));
  assert.ok(none.ok && none.value.seenAt === null && none.value.extent === null, "both optional");
});

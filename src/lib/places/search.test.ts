import { strict as assert } from "node:assert";
import { test } from "node:test";
import { groupAtlasStates, listAtlasDistricts } from "../atlas/registry";
import { listAllPlaces } from "../cities";
import { CONFIDENT, SCORE, normalise, scorePlace, searchPlaces, type PlaceTerms } from "./search";
import { cityTerms, districtTerms, stateTerms } from "./terms";

const ALL: PlaceTerms[] = [
  ...listAllPlaces().map(cityTerms),
  ...listAtlasDistricts().map(districtTerms),
  ...groupAtlasStates(listAtlasDistricts()).map(stateTerms),
];

const top = (q: string) => searchPlaces(q, ALL)[0];

test("normalise drops case, Latin accents and punctuation, keeps Indic vowel signs", () => {
  assert.equal(normalise("  Kalyan-Dombivli "), "kalyan dombivli");
  assert.equal(normalise("Pondichéry"), "pondichery");
  assert.equal(normalise("சென்னை"), "சென்னை");
});

test("names, prefixes, aliases, local script and states all find the place", () => {
  assert.deepEqual([top("chennai")?.place.id, top("chennai")?.score], ["city:chennai", SCORE.exact]);
  assert.equal(top("chen")?.place.id, "city:chennai");
  assert.equal(top("madras")?.place.id, "city:chennai");
  assert.equal(top("Bangalore")?.place.id, "city:bangalore");
  assert.equal(top("சென்னை")?.place.id, "city:chennai");
  assert.equal(top("trichy")?.place.id, "district:tn-tiruchirappalli");
  assert.equal(top("navi mumbai")?.place.id, "city:mumbai");
  assert.equal(top("tamil nadu")?.place.id, "state:tn");
  assert.ok(searchPlaces("tamil nadu", ALL).some((m) => m.place.id === "city:chennai"));
});

test("a typo still finds the place, but never counts as found", () => {
  const m = top("Tiruchirapalli");
  assert.equal(m?.place.id, "district:tn-tiruchirappalli");
  assert.ok(m!.score < CONFIDENT);
  // Nagaur is a real city that is not on the board: one letter from Nagpur.
  assert.ok(searchPlaces("Nagaur", ALL).every((x) => x.score < CONFIDENT));
  assert.equal(searchPlaces("Xyzzy", ALL).length, 0);
  assert.equal(searchPlaces("   ", ALL).length, 0);
});

// The onboarding guards: these run over the live registries, so a new city
// or district that breaks search fails here with its name.
test("every place is found first by its own name", () => {
  for (const p of ALL) {
    const hits = searchPlaces(p.name, ALL).filter((m) => m.score === SCORE.exact);
    assert.ok(hits.some((m) => m.place.id === p.id), `${p.id}: not found by "${p.name}"`);
  }
});

test("every alias finds its place, and no alias is another place's name", () => {
  const names = new Map(ALL.map((p) => [normalise(p.name), p]));
  const aliases = [
    ...listAllPlaces().map((c) => ({ id: `city:${c.cityId}`, name: c.displayName, aliases: c.landing.aliases ?? [] })),
    ...listAtlasDistricts().map((d) => ({ id: `district:${d.scopeId}`, name: d.name, aliases: d.aliases ?? [] })),
  ];
  for (const { id, name, aliases: list } of aliases) {
    for (const a of list) {
      const other = names.get(normalise(a));
      assert.ok(!other || normalise(other.name) === normalise(name), `${id}: alias "${a}" is the name of ${other?.id}`);
      const self = ALL.find((p) => p.id === id)!;
      assert.ok(scorePlace(a, self) >= CONFIDENT, `${id}: alias "${a}" does not find it`);
    }
  }
});

/**
 * Every city whose /my-ward route ships must have ward actions in its
 * src/cities/<id>/my-ward.ts.
 *
 * This exists because of issue #286. The card used to read
 * `ACTIONS_BY_CITY[cityId] ?? ACTIONS_BY_CITY.chennai`, so a city missing from
 * that map did not render an empty card - it rendered CHENNAI'S EMERGENCY
 * NUMBERS. Gurugram shipped /my-ward for weeks showing CMWSSB's complaint line
 * to residents 1,900 km away, and nothing caught it because the page looked
 * complete and returned HTTP 200.
 *
 * The fallback is gone, so the failure mode is now a missing card rather than
 * wrong information. This test closes the other half: it fails the build if a
 * city turns its route on without adding real contact details, instead of
 * letting the card silently vanish.
 *
 * Deliberately NOT asserting the reverse: mumbai and pune carry actions while
 * their routes are off, which is correct - they are ready for whenever the
 * route turns on.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listAllPlaces } from "../../lib/cities";
import { MY_WARD_CONTENT } from "../../cities/generated/my-ward";

const root = process.cwd();
const card = readFileSync(join(root, "src/components/my-ward/ward-actions-card.tsx"), "utf-8");

function citiesShippingMyWard(): string[] {
  return listAllPlaces()
    .filter((p) => p.routes.includes("my-ward"))
    .map((p) => p.cityId);
}

function citiesWithActions(): Set<string> {
  return new Set(
    Object.entries(MY_WARD_CONTENT)
      .filter(([, content]) => content?.actions)
      .map(([city]) => city),
  );
}

test("every city shipping /my-ward has ward-actions contact details", () => {
  const ships = citiesShippingMyWard();
  const configured = citiesWithActions();
  assert.ok(ships.length > 0, "no city ships /my-ward - the parser is broken, not the config");
  const missing = ships.filter((c) => !configured.has(c));
  assert.deepEqual(
    missing,
    [],
    `${missing.join(", ")} ship /my-ward with no actions in src/cities/<id>/my-ward.ts. ` +
      "Since issue #286 removed the Chennai fallback, the actions card will not " +
      "render at all for these cities. Add each city's OWN agency numbers and " +
      "portal URLs, primary-sourced - never another city's, and never a " +
      "plausible-looking number.",
  );
});

/** Strip comments so the check reads CODE, not prose.
 *
 *  The first version of the test below failed on its own documentation: the
 *  comment in ward-actions-card.tsx quotes the old expression verbatim to
 *  explain what was wrong with it, and a raw-text scan cannot tell an
 *  explanation from a reintroduction. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

test("the Chennai fallback has not come back", () => {
  const code = codeOnly(card);
  assert.ok(
    !/MY_WARD_CONTENT\[[^\]]+\]\?\.actions\s*\?\?/.test(code),
    "ward-actions-card falls back to another city's config again. That is issue " +
      "#286: it renders one city's emergency numbers to another city's residents. " +
      "A missing city must render no card, not somebody else's helplines.",
  );
  assert.ok(
    /const actionsConfig = MY_WARD_CONTENT\[cityId as CityId\]\?\.actions;/.test(code),
    "expected the plain lookup with no fallback - if this line moved, update the test",
  );
});

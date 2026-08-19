/**
 * Every city whose /my-ward route ships must have an entry in
 * ACTIONS_BY_CITY.
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
 * Deliberately NOT asserting the reverse: mumbai and pune carry entries while
 * their routes are off, which is correct - the config is ready for whenever
 * they turn on.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const routing = readFileSync(join(root, "src/lib/cities/routing.ts"), "utf-8");
const card = readFileSync(join(root, "src/components/my-ward/ward-actions-card.tsx"), "utf-8");

function citiesShippingMyWard(): string[] {
  const block = routing.slice(
    routing.indexOf("FEATURE_AVAILABILITY"),
    routing.indexOf("\n};", routing.indexOf("FEATURE_AVAILABILITY")),
  );
  const out: string[] = [];
  for (const m of block.matchAll(/^ {2}([a-z]+): new Set\(\[([\s\S]*?)\]\)/gm)) {
    if (m[2].includes('"my-ward"')) out.push(m[1]);
  }
  return out;
}

function citiesWithActions(): Set<string> {
  const block = card.slice(
    card.indexOf("const ACTIONS_BY_CITY"),
    card.indexOf("\n};", card.indexOf("const ACTIONS_BY_CITY")),
  );
  return new Set([...block.matchAll(/^ {2}([a-z]+): \{$/gm)].map((m) => m[1]));
}

test("every city shipping /my-ward has ward-actions contact details", () => {
  const ships = citiesShippingMyWard();
  const configured = citiesWithActions();
  assert.ok(ships.length > 0, "no city ships /my-ward - the parser is broken, not the config");
  const missing = ships.filter((c) => !configured.has(c));
  assert.deepEqual(
    missing,
    [],
    `${missing.join(", ")} ship /my-ward with no entry in ACTIONS_BY_CITY. ` +
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
    !/ACTIONS_BY_CITY\[[^\]]+\]\s*\?\?/.test(code),
    "ward-actions-card falls back to another city's config again. That is issue " +
      "#286: it renders one city's emergency numbers to another city's residents. " +
      "A missing city must render no card, not somebody else's helplines.",
  );
  assert.ok(
    /const actionsConfig = ACTIONS_BY_CITY\[cityId\];/.test(code),
    "expected the plain lookup with no fallback - if this line moved, update the test",
  );
});

/**
 * The parity badge must not outrun the research.
 *
 * `FeatureNotYetAvailable` renders "parity: EASY|MEDIUM|HARD" from a table
 * that used to be seven hardcoded literals, one per caller page, identical for
 * every city. That made /gurugram/rivers advertise "parity: EASY" for a city
 * with no river. Verdicts now live in PARITY_VERDICTS, keyed by (city, route),
 * and these tests pin that table to what is actually on disk and in the app.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CITIES_WITH_PARITY_AUDIT,
  PARITY_VERDICTS,
  parityVerdictFor,
} from "./parity-audits";

const ROOT = process.cwd();
const DOCS_DIR = join(ROOT, "docs", "cities");

test("every city with a verdict has a parity-audit.md to back it", () => {
  const unbacked = [...CITIES_WITH_PARITY_AUDIT].filter(
    (city) => !existsSync(join(DOCS_DIR, city, "parity-audit.md")),
  );
  assert.deepEqual(
    unbacked,
    [],
    `These cities would publish a parity verdict with no audit behind it: ` +
      `${unbacked.join(", ")}. Write docs/cities/<id>/parity-audit.md or ` +
      `remove the entry from src/lib/cities/parity-audits.ts.`,
  );
});

test("every written parity audit is actually surfaced", () => {
  const onDisk = readdirSync(DOCS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((city) => existsSync(join(DOCS_DIR, city, "parity-audit.md")));

  const hidden = onDisk.filter((c) => !CITIES_WITH_PARITY_AUDIT.has(c));
  assert.deepEqual(
    hidden,
    [],
    `These cities have a parity audit whose verdicts are not surfaced: ` +
      `${hidden.join(", ")}. Add them to src/lib/cities/parity-audits.ts.`,
  );
});

test("verdicts are keyed on real cities and real routes", () => {
  const cities = readdirSync(join(ROOT, "src", "lib", "cities"))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => f.replace(/\.ts$/, ""));

  const routes = readdirSync(join(ROOT, "src", "app", "[cityId]"), {
    withFileTypes: true,
  })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  for (const [city, byRoute] of Object.entries(PARITY_VERDICTS)) {
    assert.ok(
      cities.includes(city),
      `${city} has parity verdicts but no src/lib/cities/${city}.ts`,
    );
    for (const route of Object.keys(byRoute)) {
      assert.ok(
        routes.includes(route),
        `${city} has a verdict for route "${route}", which is not a ` +
          `directory under src/app/[cityId]/`,
      );
    }
  }
});

test("an unaudited city gets no verdict rather than a borrowed one", () => {
  // The original bug: every city inherited the route's literal. Chennai is the
  // reference build and has no audit of its own, so it must come back null.
  assert.equal(parityVerdictFor("chennai", "rivers"), null);
  assert.equal(parityVerdictFor("madurai", "climate-risk"), null);
  assert.equal(parityVerdictFor("not-a-city", "rivers"), null);
});

test("an audited city gets no verdict for routes its audit did not cover", () => {
  // Gurugram IS audited, but its audit does not assess climate-risk. Being
  // audited must not turn into blanket coverage.
  assert.equal(parityVerdictFor("gurugram", "climate-risk"), null);
  assert.equal(parityVerdictFor("gurugram", "shoreline"), null);
});

test("Gurugram rivers is N/A, not EASY - the regression this all exists for", () => {
  assert.equal(parityVerdictFor("gurugram", "rivers"), "N/A");
});

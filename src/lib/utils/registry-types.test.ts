/**
 * Registry type-contract regression (#220 review: "repo" and "pdf-feed"
 * shipped from JSON past the SourceEntry union because runtime validation
 * only checked non-emptiness). Pins:
 *   1. a bogus type is rejected by the shared contract helper - the same
 *      helper `check-upstream-editions.ts --validate` (npm run data:check)
 *      now runs, so a bogus type fails data:check;
 *   2. every entry actually in scripts/source-registry/ carries an allowed
 *      type, so the union cannot drift from the JSON silently.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  SOURCE_TYPES,
  sourceTypeProblem,
} from "../../../scripts/lib/registry-contract";

const REGISTRY_DIR = join(process.cwd(), "scripts", "source-registry");

test("bogus registry types are rejected (repo / pdf-feed regression)", () => {
  for (const bogus of ["repo", "pdf-feed", "", undefined, 42]) {
    assert.ok(
      sourceTypeProblem("test-entry", bogus),
      `expected a problem for type ${JSON.stringify(bogus)}`,
    );
  }
  for (const ok of SOURCE_TYPES) {
    assert.equal(sourceTypeProblem("test-entry", ok), null);
  }
});

test("every committed registry entry carries an allowed type", () => {
  const files = readdirSync(REGISTRY_DIR).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 5, "registry dir unexpectedly empty");
  for (const f of files) {
    const doc = JSON.parse(readFileSync(join(REGISTRY_DIR, f), "utf-8"));
    for (const e of doc.sources ?? []) {
      assert.equal(
        sourceTypeProblem(e.id, e.type),
        null,
        `${f}: ${e.id} has disallowed type ${JSON.stringify(e.type)}`,
      );
    }
  }
});

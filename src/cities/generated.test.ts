/** The committed index in src/cities/generated/ must match the city folders.
 *  A failure means a folder was added or changed without running
 *  `npm run cities:gen`. */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { staleFiles } from "../../scripts/gen-city-index";

test("src/cities/generated/ is current", async () => {
  const stale = await staleFiles();
  assert.deepEqual(stale, [], `stale: ${stale.join(", ")}. Run: npm run cities:gen`);
});

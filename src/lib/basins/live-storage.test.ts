import assert from "node:assert/strict";
import test from "node:test";

import { liveStorageLine, withLiveStorage } from "./live-storage";

const bhatsa = { code: "bhatsa", date: "2026-09-06", storageTmc: 32.282, storagePctFrl: 97 };

test("a live reservoir leads with today's reading, after the name", () => {
  const out = withLiveStorage({ name: "Bhatsa", liveCode: "bhatsa", bmcShareMcft: 25321.9 }, { bhatsa });
  assert.deepEqual(Object.keys(out), ["name", "liveStorage", "liveCode", "bmcShareMcft"]);
  assert.equal(out.liveStorage, "32.282 TMC, 97% of the dam's live capacity (2026-09-06, WRD Pravah daily bulletin)");
});

test("a live reservoir with no row in the feed says so instead of inventing one", () => {
  const out = withLiveStorage({ name: "Tansa", liveCode: "tansa" }, { bhatsa });
  assert.equal(out.liveStorage, "No reading in the daily feed yet");
});

test("features without a liveCode pass through unchanged", () => {
  const props = { name: "Vihar", feed: "No public daily feed" };
  assert.equal(withLiveStorage(props, { bhatsa }), props);
});

test("a row with no percentage still carries the volume and date", () => {
  assert.equal(liveStorageLine({ code: "x", date: "2026-09-01", storageTmc: 1.5, storagePctFrl: null }), "1.5 TMC (2026-09-01, WRD Pravah daily bulletin)");
});

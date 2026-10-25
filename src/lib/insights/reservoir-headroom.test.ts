import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { ReservoirSummary } from "@/types/reservoir";
import { buildHeadroom, inMonsoonSeason, istMonth, readingAgeDays } from "./reservoir-headroom";

const r = (name: string, storage: number, capacity: number, extra: Partial<ReservoirSummary> = {}): ReservoirSummary => ({
  name,
  displayName: name,
  currentStorage: storage,
  capacity,
  storagePct: Math.min(100, (storage / capacity) * 100),
  inflowCusecs: null,
  outflowCusecs: null,
  rainfallMm: 0,
  ...extra,
});

test("CMWSSB reading of 22 Oct 2026: Red Hills leads, room is capacity minus storage", () => {
  const h = buildHeadroom([
    r("chembarambakkam", 1466, 3645),
    r("redhills", 2351, 3300, { inflowCusecs: 1395, outflowCusecs: 207 }),
    r("poondi", 485, 3231),
    r("veeranam", 628.96, 1465),
    r("kannankottai", 242, 500),
    r("cholavaram", 142, 1081),
  ])!;
  assert.deepEqual(
    h.rows.map((x) => x.name),
    ["redhills", "kannankottai", "veeranam", "chembarambakkam", "poondi", "cholavaram"],
  );
  assert.equal(h.rows[0].roomMcft, 949);
  assert.equal(h.rows[0].fillPct.toFixed(2), "71.24");
  assert.equal(h.rows[0].inflowCusecs, 1395);
  assert.equal(h.total.capacityMcft, 13222);
  assert.equal(h.total.roomMcft.toFixed(2), "7907.04");
  assert.deepEqual(h.missing, []);
});

test("above full is never clamped: room goes negative, fill passes 100", () => {
  const h = buildHeadroom([r("a", 3700, 3645)])!;
  assert.equal(h.rows[0].roomMcft, -55);
  assert.ok(h.rows[0].fillPct > 100);
});

test("a reservoir with no reading is listed as missing, not counted as empty", () => {
  const h = buildHeadroom([r("a", 100, 1000), r("b", 0, 500, { isLive: false })])!;
  assert.deepEqual(h.rows.map((x) => x.name), ["a"]);
  assert.equal(h.total.capacityMcft, 1000);
  assert.deepEqual(h.missing, ["b"]);
});

test("no live reading means no card", () => {
  assert.equal(buildHeadroom([r("a", 0, 500, { isLive: false })]), null);
  assert.equal(buildHeadroom([]), null);
});

test("season follows the IST calendar month", () => {
  // 30 Sep 19:00 UTC is 1 Oct 00:30 IST.
  assert.equal(istMonth(new Date("2026-09-30T19:00:00Z")), 10);
  assert.equal(inMonsoonSeason("northeast", new Date("2026-09-30T19:00:00Z")), true);
  assert.equal(inMonsoonSeason("northeast", new Date("2026-09-30T18:00:00Z")), false);
  assert.equal(inMonsoonSeason("northeast", new Date("2026-12-31T18:00:00Z")), true);
  assert.equal(inMonsoonSeason("northeast", new Date("2026-12-31T18:30:00Z")), false);
  assert.equal(inMonsoonSeason("southwest", new Date("2026-07-15T06:00:00Z")), true);
});

test("reading age counts IST calendar days", () => {
  assert.equal(readingAgeDays("2026-10-22", new Date("2026-10-23T06:00:00Z")), 1);
  assert.equal(readingAgeDays("2026-10-16", new Date("2026-10-20T06:00:00Z")), 4);
  // 22 Oct 19:00 UTC is already 23 Oct in IST.
  assert.equal(readingAgeDays("2026-10-22", new Date("2026-10-22T19:00:00Z")), 1);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  sortReservoirCatchmentRows,
  summarizeReservoirCatchmentContext,
  type ReservoirCatchmentContextRow,
} from "./reservoir-context";

function row(
  reservoir: ReservoirCatchmentContextRow["reservoir"],
  overrides: Partial<ReservoirCatchmentContextRow> = {},
): ReservoirCatchmentContextRow {
  return {
    reservoir,
    contextDate: "2026-02-28",
    windowDays: 30,
    rainTotalMm: 10,
    baselineMm: 12,
    anomalyPct: -16.67,
    contextLevel: "near_normal",
    ...overrides,
  };
}

test("sortReservoirCatchmentRows follows dashboard reservoir display order", () => {
  const sorted = sortReservoirCatchmentRows([
    row("cholavaram"),
    row("poondi"),
    row("chembarambakkam"),
    row("redhills"),
  ]);

  assert.deepEqual(sorted.map((entry) => entry.reservoir), [
    "chembarambakkam",
    "redhills",
    "poondi",
    "cholavaram",
  ]);
});

test("summarizeReservoirCatchmentContext flags below-normal majority", () => {
  const summary = summarizeReservoirCatchmentContext([
    row("chembarambakkam", { anomalyPct: -28, contextLevel: "below" }),
    row("redhills", { anomalyPct: -55, contextLevel: "well_below" }),
    row("poondi", { anomalyPct: -8, contextLevel: "near_normal" }),
    row("cholavaram", { anomalyPct: 4, contextLevel: "near_normal" }),
  ]);

  assert(summary);
  assert.equal(summary.headline, "below");
  assert.equal(summary.belowCount, 2);
  assert.equal(summary.standout?.reservoir, "redhills");
});

test("summarizeReservoirCatchmentContext flags above-normal majority", () => {
  const summary = summarizeReservoirCatchmentContext([
    row("chembarambakkam", { anomalyPct: 31, contextLevel: "above" }),
    row("redhills", { anomalyPct: 61, contextLevel: "well_above" }),
    row("poondi", { anomalyPct: 24, contextLevel: "above" }),
    row("cholavaram", { anomalyPct: 8, contextLevel: "near_normal" }),
  ]);

  assert(summary);
  assert.equal(summary.headline, "above");
  assert.equal(summary.aboveCount, 3);
  assert.equal(summary.standout?.reservoir, "redhills");
});

test("summarizeReservoirCatchmentContext treats mostly near-normal rows as stable", () => {
  const summary = summarizeReservoirCatchmentContext([
    row("chembarambakkam", { anomalyPct: -5, contextLevel: "near_normal" }),
    row("redhills", { anomalyPct: 7, contextLevel: "near_normal" }),
    row("poondi", { anomalyPct: null, baselineMm: 0.4, contextLevel: "near_normal" }),
    row("cholavaram", { anomalyPct: 18, contextLevel: "near_normal" }),
  ]);

  assert(summary);
  assert.equal(summary.headline, "near_normal");
  assert.equal(summary.standout, null);
});

test("summarizeReservoirCatchmentContext keeps mixed signal when above and below are balanced", () => {
  const summary = summarizeReservoirCatchmentContext([
    row("chembarambakkam", { anomalyPct: -24, contextLevel: "below" }),
    row("redhills", { anomalyPct: 41, contextLevel: "above" }),
    row("poondi", { anomalyPct: 3, contextLevel: "near_normal" }),
    row("cholavaram", { anomalyPct: -2, contextLevel: "near_normal" }),
  ]);

  assert(summary);
  assert.equal(summary.headline, "mixed");
  assert.equal(summary.standout?.reservoir, "redhills");
});

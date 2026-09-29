import assert from "node:assert/strict";
import test from "node:test";

import { cleanReadings, preMonsoonSummary, qualityExceedances, type WellReading } from "./groundwater-wells";

test("telemetry's negative depths become metres below ground; sentinels and the envelope drop readings", () => {
  const { readings, dropped, flatlined } = cleanReadings([
    { date: "2026-01-01", value: -7.34 },
    { date: "2026-02-01", value: -8.27 },
    { date: "2026-03-01", value: 0 },
    { date: "2026-04-01", value: -250 },
    { date: "2026-05-01", value: -9.28 },
  ]);
  assert.deepEqual(readings.map((reading) => reading.depthMbgl), [7.34, 8.27, 9.28]);
  assert.equal(dropped, 2);
  assert.equal(flatlined, false);
});

test("a station that never changes is a stuck sensor and keeps nothing", () => {
  const result = cleanReadings([27.2, 27.2, 27.2, 27.2].map((value, index) => ({ date: `2026-0${index + 1}-01`, value })));
  assert.equal(result.flatlined, true);
  assert.equal(result.readings.length, 0);
});

test("the pre-monsoon summary compares the latest season with the earlier ones and fits a trend", () => {
  const readings: WellReading[] = [];
  for (let year = 2017; year <= 2026; year += 1) {
    readings.push({ date: `${year}-04-10`, depthMbgl: 5 + (year - 2017) * 0.2 });
    readings.push({ date: `${year}-08-10`, depthMbgl: 1 });
  }
  const summary = preMonsoonSummary(readings);
  assert.ok(summary);
  assert.equal(summary.latestYear, 2026);
  assert.equal(summary.latestMbgl, 6.8);
  assert.equal(summary.priorMedianMbgl, 5.8);
  assert.equal(summary.changeM, 1);
  assert.equal(summary.trendMPerYear, 0.2);
  assert.equal(summary.trendYears, 10);
});

test("too few seasons give no trend", () => {
  const summary = preMonsoonSummary([
    { date: "2025-04-01", depthMbgl: 4 },
    { date: "2026-04-01", depthMbgl: 5 },
  ]);
  assert.equal(summary?.trendMPerYear, null);
  assert.equal(summary?.priorMedianMbgl, null);
});

test("well chemistry is read against the BIS acceptable limits", () => {
  const out = qualityExceedances({ ph: 6.1, tds: 144.6, chloride: 310, nitrate: 12, fluoride: null, faecalColiform: 3 });
  assert.deepEqual(
    out.map((exceedance) => [exceedance.parameter, exceedance.limit]),
    [
      ["ph", "6.5 to 8.5"],
      ["chloride", "at most 250 mg/l"],
      ["faecalColiform", "at most 0 per 100 ml"],
    ],
  );
});

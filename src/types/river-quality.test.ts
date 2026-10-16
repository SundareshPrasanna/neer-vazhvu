import assert from "node:assert/strict";
import test from "node:test";

import {
  compareReadingPeriod,
  computeStationTrend,
  latestReadingOf,
  readingPeriodLabel,
  type RiverQualityReading,
} from "./river-quality";

function reading(year: number, month: string | null, do_mgl: number | null, bod_mgl: number | null): RiverQualityReading {
  return {
    year, month, do_mgl, bod_mgl, ph: null, conductivity_us: null, cod_mgl: null,
    fecal_coliform_mpn: null, tds_mgl: null, nitrate_mgl: null,
    chromium_mgl: null, lead_mgl: null, cadmium_mgl: null,
  };
}

// A monthly year listed January first: sorting on year alone kept January.
test("the latest reading of a monthly feed is its last month", () => {
  const rows = [reading(2024, "2024-01", 5.9, 3.2), reading(2024, "2024-06", 6, 3), reading(2024, "2024-12", 7.4, 3)];
  assert.equal(latestReadingOf(rows)?.month, "2024-12");
  assert.equal(readingPeriodLabel(latestReadingOf(rows)!), "Dec 2024");
});

test("annual readings keep their year-only order, ties included", () => {
  const a = { ...reading(2023, null, 4, 5), ph: 1 };
  const b = { ...reading(2023, null, 3, 6), ph: 2 };
  const rows = [reading(2021, null, 5, 2), a, b];
  assert.equal(latestReadingOf(rows), a);
  const old = [...rows].sort((x, y) => x.year - y.year);
  assert.deepEqual([...rows].sort(compareReadingPeriod), old);
  assert.equal(readingPeriodLabel(a), "2023");
});

test("a monthly trend compares the same month three years earlier", () => {
  const rows: RiverQualityReading[] = [];
  for (let y = 2021; y <= 2024; y++) {
    for (let m = 1; m <= 12; m++) rows.push(reading(y, `${y}-${String(m).padStart(2, "0")}`, 6, 3));
  }
  rows.find((r) => r.month === "2021-12")!.do_mgl = 6.2;
  rows.find((r) => r.month === "2024-12")!.do_mgl = 7.4;
  const t = computeStationTrend(rows)!;
  assert.equal(t.start_month, "2021-12");
  assert.equal(t.end_month, "2024-12");
  assert.equal(t.start_year, 2021);
  assert.equal(t.do_delta, 1.2);
  assert.equal(t.direction, "improving");
});

test("a monthly feed without the month three years back shows no trend", () => {
  const rows = ["2026-01", "2026-03", "2026-04", "2026-05"].map((m) => reading(2026, m, 5, 3));
  assert.equal(computeStationTrend(rows), null);
});

test("an annual trend is unchanged: last reading against the third-last", () => {
  const rows = [2019, 2020, 2021, 2022, 2023].map((y, i) => reading(y, null, 5 - i, 10 + 2 * i));
  const t = computeStationTrend(rows)!;
  assert.equal(t.start_year, 2021);
  assert.equal(t.end_year, 2023);
  assert.equal(t.start_month, undefined);
  assert.equal(t.direction, "worsening");
});

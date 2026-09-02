import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cellSortValue, columnKindOf, compareCells, firstClickDescending } from "./table-sort";

const v = cellSortValue;

describe("cellSortValue", () => {
  it("reads leading numbers through Indian grouping and units", () => {
    assert.equal(v("1,234 ha").num, 1234);
    assert.equal(v("92.5%").num, 92.5);
    assert.equal(v("148 d").num, 148);
    assert.equal(v("-3.2").num, -3.2);
  });
  it("keeps a category with an embedded count as text", () => {
    const value = v("over-exploited (5 of 12)");
    assert.equal(value.num, null);
    assert.equal(value.missing, false);
  });
  it("reads ISO dates as dates, not as the year", () => {
    assert.equal(v("2026-08-31").date, "2026-08-31");
    assert.equal(v("2026-08-31").num, null);
  });
  it("treats the gap vocabulary as missing", () => {
    for (const raw of ["not stated", "not projected", "", "—", "-", "n/a", "None"]) {
      assert.equal(v(raw).missing, true, raw);
    }
  });
});

describe("columnKindOf", () => {
  it("takes the majority of known cells", () => {
    assert.equal(columnKindOf([v("12"), v("3 ha"), v("not stated"), v("x")]), "number");
    assert.equal(columnKindOf([v("2026-08-31"), v("2025-01-01"), v("unstated")]), "date");
    assert.equal(columnKindOf([v("canal"), v("well"), v("7")]), "text");
  });
  it("is text when every cell is missing", () => {
    assert.equal(columnKindOf([v("not stated"), v("")]), "text");
  });
});

describe("compareCells", () => {
  it("sinks missing cells to the bottom in both directions", () => {
    const rows = [v("5"), v("not stated"), v("12")];
    for (const descending of [true, false]) {
      const sorted = [...rows].sort((a, b) => compareCells(a, b, "number", descending));
      assert.equal(sorted[2].missing, true, `descending=${descending}`);
    }
  });
  it("orders numbers numerically, not lexically", () => {
    const sorted = [v("97"), v("7"), v("348")].sort((a, b) => compareCells(a, b, "number", true));
    assert.deepEqual(sorted.map((value) => value.num), [348, 97, 7]);
  });
  it("orders dates chronologically", () => {
    const sorted = [v("2026-08-31"), v("2026-08-24")].sort((a, b) => compareCells(a, b, "date", false));
    assert.equal(sorted[0].date, "2026-08-24");
  });
});

describe("firstClickDescending", () => {
  it("puts the biggest reading first, names A to Z", () => {
    assert.equal(firstClickDescending("number"), true);
    assert.equal(firstClickDescending("date"), true);
    assert.equal(firstClickDescending("text"), false);
  });
});

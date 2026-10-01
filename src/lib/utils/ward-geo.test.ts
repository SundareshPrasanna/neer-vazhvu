/** Points are counted into the ward that contains them, whatever ward number their source attached. */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildGridIndex, countPointsByWard, type WardGeo } from "../../../scripts/lib/ward-geo";

// Unit-square ward whose west edge is at x
const square = (ward_number: number, x: number): WardGeo => ({
  ward_number,
  bbox: [x, 0, x + 1, 1],
  feature: {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] },
  },
});
const point = (lng: number, ward: number): GeoJSON.Feature => ({
  type: "Feature",
  properties: { ward },
  geometry: { type: "Point", coordinates: [lng, 0.5] },
});

test("a point whose ward attribute names another ward is counted where it sits", () => {
  const wards = [square(1, 0), square(2, 1)];
  // Two points sit in ward 1 (one labelled ward 2 by its source); a third sits outside every ward.
  const counts = countPointsByWard([point(0.5, 1), point(0.25, 2), point(5, 1)], wards, buildGridIndex(wards));
  assert.deepEqual([...counts], [[1, 2]]);
});

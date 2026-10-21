import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Feature, FeatureCollection, Polygon } from "geojson";

import { indexLines, indexPolygons, linesNear, metresBetween, nearBBox, pathDistanceM, polygonDistanceM, polygonsNear } from "./locate";

/** Chennai-ish latitude: a degree of longitude is about 108.5 km here. */
const LAT = 13;
const M_LAT = 1 / 111_320;
const M_LNG = 1 / (111_320 * Math.cos((LAT * Math.PI) / 180));

/** A 100 m square lake with its south-west corner at (80, 13). */
const square = (id: string, x0 = 80, y0 = LAT, side = 100): Feature<Polygon> => ({
  type: "Feature",
  properties: { id },
  geometry: {
    type: "Polygon",
    coordinates: [[[x0, y0], [x0 + side * M_LNG, y0], [x0 + side * M_LNG, y0 + side * M_LAT], [x0, y0 + side * M_LAT], [x0, y0]]],
  },
});

const near = (a: number, b: number, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("distance to a path: perpendicular inside a segment, to the end beyond it, and a single point", () => {
  const path = [[80, LAT], [80 + 200 * M_LNG, LAT]];
  near(pathDistanceM(80 + 100 * M_LNG, LAT + 40 * M_LAT, path), 40);
  near(pathDistanceM(80 - 30 * M_LNG, LAT + 40 * M_LAT, path), 50);
  near(pathDistanceM(80, LAT + 25 * M_LAT, Float32Array.from([80, LAT])), 25);
  assert.equal(pathDistanceM(80, LAT, []), Infinity);
});

test("distance to a polygon is 0 inside and to the nearest edge outside; an island in a hole is outside", () => {
  const lake = square("a");
  assert.equal(polygonDistanceM(80 + 50 * M_LNG, LAT + 50 * M_LAT, lake), 0);
  near(polygonDistanceM(80 + 50 * M_LNG, LAT - 20 * M_LAT, lake), 20);
  near(polygonDistanceM(80 + 130 * M_LNG, LAT + 140 * M_LAT, lake), 50);
  const ring = lake.geometry.coordinates[0];
  const hole = square("h", 80 + 40 * M_LNG, LAT + 40 * M_LAT, 20).geometry.coordinates[0];
  const withIsland: Feature<Polygon> = { ...lake, geometry: { type: "Polygon", coordinates: [ring, hole] } };
  near(polygonDistanceM(80 + 50 * M_LNG, LAT + 50 * M_LAT, withIsland), 10);
});

test("polygons near a point: inside first, then within the margin, the rest left out", () => {
  const fc: FeatureCollection = { type: "FeatureCollection", features: [square("far", 80 + 300 * M_LNG), square("next", 80 + 130 * M_LNG), square("in")] };
  const hits = polygonsNear(indexPolygons(fc), 80 + 90 * M_LNG, LAT + 50 * M_LAT, 50);
  assert.deepEqual(hits.map((h) => h.feature.properties?.id), ["in", "next"]);
  assert.equal(hits[0].distanceM, 0);
  near(hits[1].distanceM, 40);
});

test("lines are indexed small, filtered by what pick keeps, and found within the margin, nearest first", () => {
  const line = (name: string | null, dy: number, kind = "river") => ({
    type: "Feature" as const,
    properties: { name, waterway: kind },
    geometry: { type: "MultiLineString" as const, coordinates: [[[80, LAT + dy * M_LAT], [80 + 500 * M_LNG, LAT + dy * M_LAT]], []] },
  });
  const fc: FeatureCollection = { type: "FeatureCollection", features: [line("Cooum", 50), line("Adyar", -20), line("Drain", 5, "drain"), line(null, 500)] };
  const index = indexLines(fc, (p) => (p?.waterway === "river" ? { name: (p.name as string | null) ?? null } : null));
  assert.equal(index.length, 3);
  assert.ok(index.every((x) => x.parts.every((p) => p instanceof Float32Array)));
  const hits = linesNear(index, 80 + 250 * M_LNG, LAT, 60);
  assert.deepEqual(hits.map((h) => h.data.name), ["Adyar", "Cooum"]);
  near(hits[0].distanceM, 20);
  near(hits[1].distanceM, 50);
});

test("a box grows by metres, and great-circle metres match the grid", () => {
  const b: [number, number, number, number] = [80, LAT, 80 + 100 * M_LNG, LAT + 100 * M_LAT];
  assert.ok(nearBBox(80 - 40 * M_LNG, LAT, b, 50));
  assert.ok(!nearBBox(80 - 60 * M_LNG, LAT, b, 50));
  near(metresBetween(80, LAT, 80, LAT + 100 * M_LAT), 100);
  near(metresBetween(80, LAT, 80 + 100 * M_LNG, LAT), 100);
});

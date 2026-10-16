import { test } from "node:test";
import assert from "node:assert/strict";
import { isOsmId, sourceCode, takesRiverName } from "./body-ids";

test("only river-typed, unnamed polygons with an osm_id take a river's name", () => {
  assert.equal(takesRiverName({ name: "", osm_id: 1, water_type: "river" }), true);
  assert.equal(takesRiverName({ name: "", osm_id: "way/1", water: "river" }), true); // Pune
  assert.equal(takesRiverName({ name: "", osm_id: 1, water_type: "Canal" }), true);
  assert.equal(takesRiverName({ name: "Mutha", osm_id: 1, water_type: "river" }), false);
  assert.equal(takesRiverName({ name: "", osm_id: "mrsac:505", water_type: "tank" }), false); // Nagpur
  assert.equal(takesRiverName({ name: "", osm_id: 1, water_type: "pond" }), false);
  assert.equal(takesRiverName({ name: "", osm_id: 1, water_type: "water" }), false);
  assert.equal(takesRiverName({ name: "" }), false); // Surat: no osm_id, no type
});

test("an OSM id is a number or a typed OSM path; survey codes are not", () => {
  assert.equal(isOsmId(23633592), true);
  assert.equal(isOsmId("way/22824920"), true);
  assert.equal(isOsmId("relation/1611529"), true);
  assert.equal(isOsmId("mrsac:505040300101962"), false);
  assert.equal(isOsmId(undefined), false);
  assert.equal(isOsmId(""), false);
});

test("a '<source>:<code>' id yields its source and code", () => {
  const m = sourceCode("mrsac:505040300101962");
  assert.deepEqual(m && [m[1], m[2]], ["mrsac", "505040300101962"]);
  assert.equal(sourceCode("way/1"), null);
  assert.equal(sourceCode(12), null);
  assert.equal(sourceCode(undefined), null);
});

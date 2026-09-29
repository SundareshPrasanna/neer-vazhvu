import assert from "node:assert/strict";
import test from "node:test";

import { bindStateLsgPolygons, type StateLsgFeature } from "./state-lsg-boundary";
import { membershipFixture } from "./test-support";

const square: StateLsgFeature["geometry"] = {
  type: "MultiPolygon",
  coordinates: [[[[76, 10], [76.1, 10], [76.1, 10.1], [76, 10.1], [76, 10]]]],
};
const feature = (name: string, type: string, lsgdCode: string): StateLsgFeature => ({
  properties: { LB_NAME_EN: name, type, lsgd_code: lsgdCode },
  geometry: square,
});
const fields = { nameField: "LB_NAME_EN", typeField: "type", excludedTypes: ["Municipality"] };

test("polygons bind by name, ignore the layer's own codes and its type slips, and skip urban bodies", () => {
  const membership = membershipFixture({
    members: [
      { lgdGramPanchayatCode: "220001", name: "Nalleppilly", blockCode: "1001", boundaryName: "Nalleppilly" },
      // Typed "Block Panchayat" in the layer and carrying a B-code: still a Panchayat.
      { lgdGramPanchayatCode: "220002", name: "Muthalamada", blockCode: "1002", boundaryName: "Muthalamada" },
    ],
  });
  const { geometries, excludedFeatures } = bindStateLsgPolygons({
    features: [
      feature("Nalleppilly", "Grama Panchayat", "G099999"),
      feature("Muthalamada", "Block Panchayat", "B091000"),
      feature("Chittur-Thathamangalam (M)", "Municipality", "M090300"),
    ],
    fields,
    membership,
  });
  assert.deepEqual([...geometries.keys()], ["220001", "220002"]);
  assert.equal(excludedFeatures, 1);
});

test("an unclaimed polygon or an unmatched member stops the refresh", () => {
  const membership = membershipFixture({
    members: [
      { lgdGramPanchayatCode: "220001", name: "Nalleppilly", blockCode: "1001", boundaryName: "Nalleppilly" },
      { lgdGramPanchayatCode: "220002", name: "Muthalamada", blockCode: "1002", boundaryName: "Muthalamada" },
    ],
  });
  assert.throws(
    () =>
      bindStateLsgPolygons({
        features: [feature("Nalleppilly", "Grama Panchayat", "G1"), feature("Kozhinjampara", "Grama Panchayat", "G2")],
        fields,
        membership,
      }),
    /Muthalamada" matches 0 polygons[\s\S]*polygons no member claims: Kozhinjampara/,
  );
});

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { listPublishedAtlasDistricts } from "../atlas/registry";
import { listBasins } from "../basins";
import { listEnabledPlaces } from "../cities";
import { placeUrl, type PlaceFields } from "./place-url";

const at = (p: Partial<PlaceFields> & Pick<PlaceFields, "place_kind" | "place_id">): PlaceFields => ({
  ward_id: null,
  water_body_id: null,
  water_body_name: null,
  panchayat_code: null,
  panchayat_name: null,
  category: "dumping",
  ...p,
});

test("a city report links to its water body's map, else its ward page, else the city map", () => {
  assert.deepEqual(placeUrl(at({ place_kind: "city", place_id: "chennai", ward_id: "151", water_body_id: "123", water_body_name: "Puzhal Lake" })), {
    href: "/chennai/water-bodies?layer=reports",
    label: "Puzhal Lake, Chennai",
  });
  assert.deepEqual(placeUrl(at({ place_kind: "city", place_id: "chennai", ward_id: "151" })), { href: "/chennai/my-ward?ward=151", label: "Ward 151, Chennai" });
  assert.deepEqual(placeUrl(at({ place_kind: "city", place_id: "chennai" })), { href: "/chennai/water-bodies?layer=reports", label: "Chennai" });
  assert.deepEqual(placeUrl(at({ place_kind: "city", place_id: "chennai", water_body_id: "123" })), { href: "/chennai/water-bodies?layer=reports", label: "Chennai" });
});

test("a city without a ward page sends a ward report to its map", () => {
  const city = listEnabledPlaces().find((c) => !c.routes.includes("my-ward") && c.routes.includes("water-bodies"));
  assert.ok(city, "no enabled city without a ward page to test against");
  assert.deepEqual(placeUrl(at({ place_kind: "city", place_id: city.cityId, ward_id: "7" })), {
    href: `/${city.cityId}/water-bodies?layer=reports`,
    label: city.displayName,
  });
  // Tap water has no point, so with no ward page it shows nowhere.
  assert.equal(placeUrl(at({ place_kind: "city", place_id: city.cityId, ward_id: "7", category: "drinking" })), null);
});

test("tap water and water tests never link to a map", () => {
  assert.deepEqual(placeUrl(at({ place_kind: "city", place_id: "chennai", ward_id: "151", water_body_id: "123", water_body_name: "Puzhal Lake", category: "drinking" })), {
    href: "/chennai/my-ward?ward=151",
    label: "Ward 151, Chennai",
  });
  assert.equal(placeUrl(at({ place_kind: "city", place_id: "chennai", category: "drinking" })), null);
  assert.deepEqual(placeUrl(at({ place_kind: "basin", place_id: "arkavathi", category: "drinking" })), {
    href: "/bangalore/rivers?basin=arkavathi",
    label: "Arkavathi watershed, Cauvery",
  });
});

test("a district report links to its GP page, else the district page", () => {
  assert.deepEqual(placeUrl(at({ place_kind: "district", place_id: "tn-krishnagiri" })), { href: "/atlas/tn/krishnagiri", label: "Krishnagiri district" });
  assert.deepEqual(placeUrl(at({ place_kind: "district", place_id: "tn-krishnagiri", panchayat_code: "123456", panchayat_name: "Kaveripattinam" })), {
    href: "/atlas/tn/krishnagiri/panchayats/123456",
    label: "Kaveripattinam, Krishnagiri district",
  });
  assert.deepEqual(placeUrl(at({ place_kind: "district", place_id: "tn-krishnagiri", panchayat_code: "123456" })), {
    href: "/atlas/tn/krishnagiri/panchayats/123456",
    label: "Krishnagiri district",
  });
});

test("a basin report links to the basin's atlas with the layer on; an overview basin has no page for it", () => {
  assert.deepEqual(placeUrl(at({ place_kind: "basin", place_id: "arkavathi" })), { href: "/bangalore/rivers?basin=arkavathi&layer=reports", label: "Arkavathi watershed, Cauvery" });
  for (const b of listBasins().filter((x) => x.overviewMode)) assert.equal(placeUrl(at({ place_kind: "basin", place_id: b.basinId })), null, b.basinId);
});

test("unknown places link nowhere", () => {
  assert.equal(placeUrl(at({ place_kind: "city", place_id: "atlantis" })), null);
  assert.equal(placeUrl(at({ place_kind: "district", place_id: "xx-atlantis" })), null);
  assert.equal(placeUrl(at({ place_kind: "basin", place_id: "atlantis" })), null);
});

test("every covered place gets a site path and a plain label", () => {
  const links = [
    ...listEnabledPlaces().map((c) => placeUrl(at({ place_kind: "city", place_id: c.cityId, ward_id: "1" }))),
    ...listPublishedAtlasDistricts().map((d) => placeUrl(at({ place_kind: "district", place_id: d.scopeId }))),
    ...listBasins().filter((b) => !b.overviewMode).map((b) => placeUrl(at({ place_kind: "basin", place_id: b.basinId }))),
  ];
  for (const l of links) {
    assert.ok(l, "a covered place has no link");
    assert.match(l.href, /^\/[a-z0-9]/, l.href);
    assert.ok(!/[\u2014\u00b7]/.test(l.label), l.label);
  }
});

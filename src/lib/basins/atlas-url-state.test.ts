import assert from "node:assert/strict";
import test from "node:test";

import type { BasinLayer } from "./types";
import {
  buildAtlasShareUrl,
  encodeLayersParam,
  layerKey,
  parseLayersParam,
} from "./atlas-url-state";

const layers: BasinLayer[] = [
  { family: "boundary", label: "Basin boundary", floor: "hydrology", geom: "fill", color: "#000", defaultOn: true },
  { family: "prs", label: "Polluted stretch", floor: "hydrology", geom: "line", color: "#000", defaultOn: false, prs: true },
  { family: "pressures-industrial", label: "17-category", floor: "pressures", geom: "point", color: "#000", defaultOn: true, kindFilter: "major-industry" },
  { family: "pressures-industrial", label: "Areas", floor: "pressures", geom: "fill", color: "#000", defaultOn: true, kindFilter: "industrial-area" },
];

test("layerKey splits kind-filtered entries sharing a family", () => {
  assert.equal(layerKey(layers[0]), "boundary");
  assert.equal(layerKey(layers[2]), "pressures-industrial:major-industry");
  assert.equal(layerKey(layers[3]), "pressures-industrial:industrial-area");
});

test("encodeLayersParam omits the param while state matches defaults", () => {
  const defaults = { boundary: true, prs: false };
  assert.equal(encodeLayersParam({ boundary: true, prs: false }, defaults), null);
  // Same ON set spelled differently (missing key vs explicit false) still matches.
  assert.equal(encodeLayersParam({ boundary: true }, defaults), null);
});

test("encodeLayersParam lists the ON set exhaustively once customised", () => {
  const defaults = { boundary: true, prs: false };
  assert.equal(encodeLayersParam({ boundary: true, prs: true }, defaults), "boundary,prs");
  assert.equal(encodeLayersParam({ boundary: false, prs: false }, defaults), "");
});

test("parseLayersParam turns the ON list into a full toggle map", () => {
  const state = parseLayersParam("prs,pressures-industrial:major-industry", layers);
  assert.deepEqual(state, {
    boundary: false,
    prs: true,
    "pressures-industrial:major-industry": true,
    "pressures-industrial:industrial-area": false,
  });
});

test("parseLayersParam ignores unknown keys and passes through empty as null", () => {
  const state = parseLayersParam("prs,got-removed", layers);
  assert.ok(state);
  assert.equal(state!["prs"], true);
  assert.ok(!("got-removed" in state!));
  assert.equal(parseLayersParam(null, layers), null);
  assert.equal(parseLayersParam("", layers), null);
});

test("round-trip: encode -> parse restores the same ON set", () => {
  const defaults = Object.fromEntries(layers.map((l) => [layerKey(l), l.defaultOn]));
  const custom: Record<string, boolean> = { ...defaults, prs: true, "pressures-industrial:industrial-area": false };
  const param = encodeLayersParam(custom, defaults);
  assert.ok(param);
  const restored = parseLayersParam(param, layers)!;
  for (const l of layers) {
    assert.equal(restored[layerKey(l)], !!custom[layerKey(l)], layerKey(l));
  }
});

test("buildAtlasShareUrl targets the embed page with only the set params", () => {
  assert.equal(
    buildAtlasShareUrl({ origin: "https://neervazhvu.org", basinId: "arkavathi" }),
    "https://neervazhvu.org/embed/basins/arkavathi",
  );
  const url = buildAtlasShareUrl({
    origin: "https://neervazhvu.org",
    basinId: "arkavathi",
    riverId: "vrishabhavathi",
    floor: "governance",
    layersParam: "boundary,prs",
    growth: true,
  });
  assert.equal(
    url,
    "https://neervazhvu.org/embed/basins/arkavathi?river=vrishabhavathi&floor=governance&layers=boundary%2Cprs&growth=1",
  );
});

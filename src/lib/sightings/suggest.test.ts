import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { MultiPolygon, Polygon } from "geojson";

import {
  SUGGEST_MAX,
  fold,
  indexBuilder,
  labelPoint,
  lakeName,
  normalize,
  suggest,
  suggestQuery,
  titleCase,
  wardParts,
  type EntryInput,
} from "./suggest";

const CHENNAI = { lat: 13.08, lng: 80.27 };

function index(...xs: EntryInput[]) {
  const b = indexBuilder();
  xs.forEach((x) => b.add(x));
  return b.entries;
}
const lake = (name: string, lat: number, lng: number, at = "Chennai", id: string | null = null): EntryInput => ({
  kind: "lake",
  label: `${name}, ${at}`,
  name,
  ctx: [at],
  lat,
  lng,
  id,
});
const ward = (n: number, zone: string, lat: number, lng: number, city = "Chennai"): EntryInput => ({
  kind: "ward",
  label: `Ward ${n}, ${zone}, ${city}`,
  name: `Ward ${n}`,
  ctx: [zone, city],
  lat,
  lng,
});
const labels = (r: { label: string }[]) => r.map((x) => x.label);

test("normalising: case, accents, punctuation and spaces; Indian scripts keep their vowel signs", () => {
  assert.equal(normalize("  Ambattur   LAKE! "), "ambattur lake");
  assert.equal(normalize("Bélandur Kere"), "belandur kere");
  assert.equal(normalize("H.D.Kote"), "h d kote");
  assert.equal(normalize("ஏரி"), "ஏரி");
  assert.equal(suggestQuery("Ward  82"), "ward 82");
});

test("folding makes the common spellings of one name equal", () => {
  for (const [a, b] of [
    ["chembarambakkam", "chembarambakam"],
    ["velachery", "velacheri"],
    ["thiruvallur", "tiruvallur"],
    ["poonamallee", "punamalli"],
    ["puzhal", "puzal"],
  ]) {
    assert.equal(fold(a), fold(b), `${a} / ${b}`);
  }
  assert.notEqual(fold("porur"), fold("perur"));
});

test("titleCase turns only ALL-CAPS register names", () => {
  assert.equal(titleCase("AMBATTUR"), "Ambattur");
  assert.equal(titleCase("H.D.KOTE"), "H.D.Kote");
  assert.equal(titleCase("Malakkathimmanahalli eri"), "Malakkathimmanahalli eri");
});

test("lake names leave out rivers, drains and placeholders", () => {
  assert.equal(lakeName("Ambattur Lake"), "Ambattur Lake");
  for (const n of ["Cooum River", "Najafgarh Nallah", "Piali Khal", "Unnamed waterbody", "Trombay Creek"]) assert.equal(lakeName(n), null, n);
});

test("the start of a word comes before a match inside a word; the place's own name before where it is", () => {
  const ix = index(lake("Kambattur Tank", 13.2, 80.1), ward(82, "Ambattur", 13.125, 80.168), lake("Ambattur Lake", 13.106, 80.143, "Chennai", "25391800"));
  assert.deepEqual(labels(suggest(ix, "ambattur")), ["Ambattur Lake, Chennai", "Ward 82, Ambattur, Chennai", "Kambattur Tank, Chennai"]);
  assert.deepEqual(suggest(ix, "amba")[0], { label: "Ambattur Lake, Chennai", kind: "lake", lat: 13.106, lng: 80.143, waterBodyId: "25391800" });
  assert.equal("waterBodyId" in suggest(ix, "ward 82")[0], false);
});

test("lake, eri, kere, tank are shown but not needed to match; on their own they list lakes", () => {
  const ix = index(lake("Ambattur Lake", 13.106, 80.143), lake("Bellandur Kere", 12.936, 77.672, "Bengaluru"), ward(82, "Ambattur", 13.125, 80.168));
  assert.deepEqual(labels(suggest(ix, "ambattur eri")), ["Ambattur Lake, Chennai", "Ward 82, Ambattur, Chennai"]);
  assert.deepEqual(labels(suggest(ix, "bellandur lake")), ["Bellandur Kere, Bengaluru"]);
  // "tan" is not "tank": lake words never match a word start of their own.
  assert.deepEqual(suggest(ix, "tan"), []);
  assert.deepEqual(labels(suggest(ix, "kere")), ["Bellandur Kere, Bengaluru", "Ambattur Lake, Chennai"]);
});

test("'ward 82' and '82' find the ward before ward 820; inside-a-word matches need 3 characters", () => {
  const ix = index(ward(182, "Perungudi", 12.96, 80.24), ward(820, "Narela", 28.8, 77.1, "Delhi"), ward(82, "Ambattur", 13.125, 80.168));
  assert.deepEqual(labels(suggest(ix, "ward 82")), ["Ward 82, Ambattur, Chennai", "Ward 820, Narela, Delhi"]);
  assert.deepEqual(labels(suggest(ix, "82")), ["Ward 82, Ambattur, Chennai", "Ward 820, Narela, Delhi"]);
  assert.deepEqual(labels(suggest(ix, "182")), ["Ward 182, Perungudi, Chennai"]);
  assert.deepEqual(labels(suggest(ix, "ward82")), ["Ward 82, Ambattur, Chennai", "Ward 820, Narela, Delhi"]);
});

test("nearer places first when the map centre is known", () => {
  const ix = index(ward(5, "Gota", 23.1, 72.5, "Ahmedabad"), ward(5, "Tondiarpet", 13.11, 80.29), ward(5, "Narela", 28.8, 77.1, "Delhi"));
  assert.equal(suggest(ix, "ward 5", CHENNAI)[0].label, "Ward 5, Tondiarpet, Chennai");
  assert.equal(suggest(ix, "ward 5", { lat: 28.6, lng: 77.2 })[0].label, "Ward 5, Narela, Delhi");
});

test("spellings: a folded match comes last; a name typed as two words still matches", () => {
  const ix = index(lake("Chembarambakkam Lake", 13.008, 80.055), {
    kind: "town",
    label: "H.D.Kote, Kabini Basin",
    name: "H.D.Kote",
    ctx: ["Kabini Basin"],
    lat: 12.09,
    lng: 76.33,
  });
  assert.deepEqual(labels(suggest(ix, "chembarambakam")), ["Chembarambakkam Lake, Chennai"]);
  assert.deepEqual(labels(suggest(ix, "Chembaram bakkam")), ["Chembarambakkam Lake, Chennai"]);
  assert.deepEqual(labels(suggest(ix, "hd kote")), ["H.D.Kote, Kabini Basin"]);
});

test("at least 2 characters, at most 8 results", () => {
  const ix = index(...Array.from({ length: 20 }, (_, i) => ward(i + 1, "Ambattur", 13 + i / 100, 80.1)));
  assert.deepEqual(suggest(ix, "a"), []);
  assert.deepEqual(suggest(ix, " . "), []);
  assert.equal(suggest(ix, "ambattur").length, SUGGEST_MAX);
});

test("one lake in several outlines counts once; a namesake across the city stays", () => {
  const ix = index(lake("Thamarai Kulam", 13.1, 80.2), lake("Thamarai Kulam", 13.105, 80.2), lake("Thamarai Kulam", 12.95, 80.2));
  assert.equal(ix.length, 2);
  // The same label within 5 km shows once (Himayat Sagar mapped as outlines kilometres apart).
  const big = index(lake("Himayat Sagar", 17.3, 78.35, "Hyderabad"), lake("Himayat Sagar", 17.33, 78.37, "Hyderabad"));
  assert.equal(big.length, 2);
  assert.equal(suggest(big, "himayat").length, 1);
});

test("ward labels: the number people use and the ward's name, else a zone that is a place name", () => {
  assert.equal(wardParts({ Zone_Name: "AMBATTUR", Ward_No: 82, ward_number: 82 }, "Chennai")?.label, "Ward 82, Ambattur, Chennai");
  assert.equal(
    wardParts({ ward_no: 1, ward_label: "25 - Vinayaka Layout", ward_name: "Vinayaka Layout", zone_name: "Rajarajeshwarinagar" }, "Bengaluru")?.label,
    "Ward 25, Vinayaka Layout, Bengaluru",
  );
  assert.equal(wardParts({ ward_no: 1, ward_code: "A", ward_name: "Colaba / Fort", ward_label: "A - Colaba / Fort" }, "Mumbai")?.label, "Ward A, Colaba / Fort, Mumbai");
  assert.equal(wardParts({ ward_no: 99, ward_name: "99", zone: "West Zone-V" }, "Madurai")?.label, "Ward 99, Madurai");
  assert.equal(wardParts({ ward_no: 1 }, "Kolkata")?.label, "Ward 1, Kolkata");
  assert.equal(wardParts({ name: "x" }, "Kolkata"), null);
  const nagpur = wardParts({ ward_number: 12, ward_name: "Prabhag 12", zone_name: "Ashi Nagar" }, "Nagpur")!;
  assert.equal(nagpur.label, "Ward 12, Ashi Nagar, Nagpur");
  const ix = index({ kind: "ward", ...nagpur, lat: 21.1, lng: 79.1 });
  assert.deepEqual(labels(suggest(ix, "prabhag 12")), ["Ward 12, Ashi Nagar, Nagpur"]);
});

/** Even-odd test, independent of the code under test. */
function inside([x, y]: [number, number], rings: number[][][]): boolean {
  let c = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) if (r[i][1] > y !== r[j][1] > y && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
}

test("label point: the centroid when inside; inside a U shape and outside a central hole otherwise; the largest part", () => {
  const square: Polygon = { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] };
  const p = labelPoint(square)!;
  assert.ok(Math.abs(p[0] - 1) < 1e-9 && Math.abs(p[1] - 1) < 1e-9);

  // A U: its centroid falls in the notch.
  const u: Polygon = { type: "Polygon", coordinates: [[[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3], [0, 0]]] };
  assert.ok(inside(labelPoint(u)!, u.coordinates));

  const ring: Polygon = { type: "Polygon", coordinates: [square.coordinates[0], [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5], [0.5, 0.5]]] };
  assert.ok(inside(labelPoint(ring)!, ring.coordinates));

  const two: MultiPolygon = { type: "MultiPolygon", coordinates: [[[[10, 10], [10.1, 10], [10.1, 10.1], [10, 10]]], square.coordinates] };
  const q = labelPoint(two)!;
  assert.ok(inside(q, square.coordinates));
  assert.equal(labelPoint({ type: "Polygon", coordinates: [] }), null);
});

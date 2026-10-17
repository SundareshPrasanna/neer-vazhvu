/** How a water test was done: what it was measured with and whether the water was filtered. Decides how a reading is read. */

export const TEST_INSTRUMENTS = [
  { key: "meter", label: "Digital meter" },
  { key: "kit", label: "Test kit or strips" },
  { key: "lab", label: "Lab report" },
] as const;
export const TEST_FILTERED = [
  { key: "raw", label: "Straight from the source" },
  { key: "filtered", label: "After a filter or RO" },
  { key: "unknown", label: "Don't know" },
] as const;
export const TEST_CALIBRATED = [
  { key: "recent", label: "Within 3 months" },
  { key: "older", label: "Longer ago" },
  { key: "never", label: "Never" },
  { key: "unknown", label: "Don't know" },
] as const;

export type Instrument = (typeof TEST_INSTRUMENTS)[number]["key"];
export type Filtered = (typeof TEST_FILTERED)[number]["key"];
export type Calibrated = (typeof TEST_CALIBRATED)[number]["key"];

/** Stored in sightings.test_meta. Only `instrument` and `filtered` are public; the rest is for analysis. */
export interface TestMeta {
  instrument: Instrument;
  filtered: Filtered;
  calibrated?: Calibrated;
  /** Borewell or open well: did the pump run a few minutes before the sample. */
  flushed?: boolean;
  depthFt?: number;
  model?: string;
}

export const MAX_DEPTH_FT = 3000;
export const MAX_MODEL_CHARS = 60;

/**
 * The line shown with public readings, e.g. "Home test with a digital meter, water straight from the borewell".
 * Filtered water is said plainly not to describe the source, so nobody reads an RO tap as the borewell.
 */
export function testLabel(meta: Pick<TestMeta, "instrument" | "filtered">, source: string | null): string {
  const how = { meter: "Home test with a digital meter", kit: "Home test kit; colour-chart readings are approximate", lab: "From a lab report" }[meta.instrument];
  const from = source ? source.toLowerCase() : "source";
  const water = {
    raw: `, water straight from the ${from}`,
    filtered: `, after a filter or RO, so it does not describe the ${from} itself`,
    unknown: "",
  }[meta.filtered];
  return how + water;
}

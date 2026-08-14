import type { Measure } from "@/types/river-quality";

/**
 * A water-quality reading is either a POINT value or an ANNUAL MIN-MAX RANGE.
 *
 * Chennai, Bengaluru, Delhi and Madurai carry point values from monthly or
 * per-sample monitoring. Hyderabad is built on CPCB's national NWMP tables,
 * which publish a min and a max per station per year and nothing in between.
 * We do not flatten those to a midpoint - CPCB never measured a midpoint, and
 * inventing one would make up a number to fit a renderer.
 *
 * So every renderer that touches a reading uses these two helpers:
 *   measureWorst() - the end of the range that matters for a threshold, so
 *                    colour-coding and "Nx over the limit" stay meaningful.
 *   measureLabel() - what the source actually published, shown to the reader.
 */

export type WorseDirection = "lower-is-worse" | "higher-is-worse";

function ends(m: Measure): { lo: number | null; hi: number | null } {
  if (m == null) return { lo: null, hi: null };
  if (typeof m === "number") return { lo: m, hi: m };
  return {
    lo: typeof m.min === "number" ? m.min : null,
    hi: typeof m.max === "number" ? m.max : null,
  };
}

/** The threshold-relevant end. DO is lower-is-worse, BOD/COD higher-is-worse. */
export function measureWorst(m: Measure, kind: WorseDirection): number | null {
  const { lo, hi } = ends(m);
  if (lo == null && hi == null) return null;
  return kind === "lower-is-worse" ? (lo ?? hi) : (hi ?? lo);
}

/** What to print: "2.4", or "0.5-3.6" for a genuine range. */
export function measureLabel(m: Measure): string | null {
  const { lo, hi } = ends(m);
  if (lo == null && hi == null) return null;
  if (lo != null && hi != null) return lo === hi ? String(lo) : `${lo}-${hi}`;
  return String(lo ?? hi);
}

/** True where the source published a real range rather than a point. */
export function isRange(m: Measure): boolean {
  if (m == null || typeof m === "number") return false;
  return m.min != null && m.max != null && m.min !== m.max;
}

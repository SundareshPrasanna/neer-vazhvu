import type { ReservoirName } from "../../types/reservoir";
import { RESERVOIR_DISPLAY_ORDER } from "../utils/constants";

export type RainfallContextLevel =
  | "well_below"
  | "below"
  | "near_normal"
  | "above"
  | "well_above";

export interface ReservoirCatchmentContextRow {
  reservoir: ReservoirName;
  contextDate: string;
  windowDays: number;
  rainTotalMm: number;
  baselineMm: number | null;
  anomalyPct: number | null;
  contextLevel: RainfallContextLevel;
}

export type ReservoirCatchmentHeadline = "below" | "above" | "near_normal" | "mixed";

export interface ReservoirCatchmentSummary {
  contextDate: string;
  windowDays: number;
  monitoredCount: number;
  belowCount: number;
  aboveCount: number;
  nearNormalCount: number;
  headline: ReservoirCatchmentHeadline;
  standout: ReservoirCatchmentContextRow | null;
  rows: ReservoirCatchmentContextRow[];
}

function compareReservoirOrder(a: ReservoirName, b: ReservoirName): number {
  const ai = RESERVOIR_DISPLAY_ORDER.indexOf(a);
  const bi = RESERVOIR_DISPLAY_ORDER.indexOf(b);
  return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
}

export function sortReservoirCatchmentRows(
  rows: ReservoirCatchmentContextRow[],
): ReservoirCatchmentContextRow[] {
  return [...rows].sort((a, b) => compareReservoirOrder(a.reservoir, b.reservoir));
}

export function summarizeReservoirCatchmentContext(
  rows: ReservoirCatchmentContextRow[],
): ReservoirCatchmentSummary | null {
  if (rows.length === 0) return null;

  const ordered = sortReservoirCatchmentRows(rows);
  const belowCount = ordered.filter((row) =>
    row.contextLevel === "well_below" || row.contextLevel === "below"
  ).length;
  const aboveCount = ordered.filter((row) =>
    row.contextLevel === "above" || row.contextLevel === "well_above"
  ).length;
  const nearNormalCount = ordered.length - belowCount - aboveCount;

  let headline: ReservoirCatchmentHeadline;
  if (belowCount > aboveCount && belowCount >= 2) {
    headline = "below";
  } else if (aboveCount > belowCount && aboveCount >= 2) {
    headline = "above";
  } else if (nearNormalCount === ordered.length || nearNormalCount >= 3) {
    headline = "near_normal";
  } else {
    headline = "mixed";
  }

  const standout = [...ordered]
    .filter((row) => row.anomalyPct !== null && Math.abs(row.anomalyPct) >= 20)
    .sort((a, b) => Math.abs(b.anomalyPct ?? 0) - Math.abs(a.anomalyPct ?? 0))[0] ?? null;

  return {
    contextDate: ordered[0].contextDate,
    windowDays: ordered[0].windowDays,
    monitoredCount: ordered.length,
    belowCount,
    aboveCount,
    nearNormalCount,
    headline,
    standout,
    rows: ordered,
  };
}

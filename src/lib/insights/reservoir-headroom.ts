import type { ReservoirSummary } from "@/types/reservoir";

/**
 * Rainy-season headroom: how much more each reservoir can hold before it is
 * full, from the publisher's own storage and capacity figures.
 *
 * Headroom is a subtraction (capacity minus storage) and nothing else. It is
 * never clamped: a reservoir above its published capacity reads as "above
 * full by X", because that is the true state. No threshold here is ours.
 */

/** IMD's season definitions: the southwest monsoon is June to September,
 *  the northeast monsoon (post-monsoon season) October to December. */
export const MONSOON_MONTHS = {
  southwest: [6, 7, 8, 9],
  northeast: [10, 11, 12],
} as const;

export type Monsoon = keyof typeof MONSOON_MONTHS;

/** Month (1-12) of an instant in India Standard Time (UTC+5:30). */
export function istMonth(now: Date): number {
  return new Date(now.getTime() + 330 * 60 * 1000).getUTCMonth() + 1;
}

export function inMonsoonSeason(monsoon: Monsoon, now: Date): boolean {
  return (MONSOON_MONTHS[monsoon] as readonly number[]).includes(istMonth(now));
}

/** Whole days between a reading date (YYYY-MM-DD) and today in IST. */
export function readingAgeDays(asOf: string, now: Date): number {
  const todayIst = new Date(now.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
  return Math.round((Date.parse(todayIst) - Date.parse(asOf)) / 86_400_000);
}

export interface HeadroomRow {
  name: string;
  displayName: string;
  storageMcft: number;
  capacityMcft: number;
  /** storage / capacity x 100, unclamped. */
  fillPct: number;
  /** capacity - storage; negative when above full. */
  roomMcft: number;
  inflowCusecs: number | null;
  outflowCusecs: number | null;
}

export interface Headroom {
  /** Fullest first: the reservoir nearest its capacity leads. */
  rows: HeadroomRow[];
  total: { storageMcft: number; capacityMcft: number; fillPct: number; roomMcft: number };
  /** Registered reservoirs with no reading in this release. */
  missing: string[];
}

export function buildHeadroom(reservoirs: ReservoirSummary[]): Headroom | null {
  const live = reservoirs.filter((r) => r.isLive !== false && r.capacity > 0);
  if (live.length === 0) return null;

  const rows = live
    .map((r) => ({
      name: r.name,
      displayName: r.displayName,
      storageMcft: r.currentStorage,
      capacityMcft: r.capacity,
      fillPct: (r.currentStorage / r.capacity) * 100,
      roomMcft: r.capacity - r.currentStorage,
      inflowCusecs: r.inflowCusecs,
      outflowCusecs: r.outflowCusecs,
    }))
    .sort((a, b) => b.fillPct - a.fillPct);

  const storageMcft = rows.reduce((s, r) => s + r.storageMcft, 0);
  const capacityMcft = rows.reduce((s, r) => s + r.capacityMcft, 0);

  return {
    rows,
    total: {
      storageMcft,
      capacityMcft,
      fillPct: (storageMcft / capacityMcft) * 100,
      roomMcft: capacityMcft - storageMcft,
    },
    missing: reservoirs.filter((r) => r.isLive === false).map((r) => r.displayName),
  };
}

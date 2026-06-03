/**
 * Bengaluru daily briefing - template-based for V1, AI-uplift-ready.
 *
 * Mirrors the Chennai CityStory pattern in spirit but is scoped to
 * Bengaluru's specific drivers: not "days of water left" (Chennai's
 * reservoir-city framing) but a structural read on the Cauvery
 * Pumping chain (upstream storage + Stage V under-delivery + IISc
 * stress wards + tanker market) refreshed each day from the latest
 * reservoir_daily_v2 readings.
 *
 * V1 is fully template-based - no LLM call. The render component
 * carries an optional `aiOverride` slot so a later Claude pipeline
 * (mirroring Chennai's daily_briefing table) can land here without
 * a component-shape refactor.
 *
 * Storage-percent variants (4 buckets, IST month-aware):
 *   - "drought_drawdown"  total FRL < 25%
 *   - "pre_monsoon"       total FRL 25-50% AND month in May-Jun
 *   - "monsoon_recharge"  total FRL 50-75% (rising or steady) OR Jul-Sep
 *   - "post_monsoon"      total FRL >= 75% OR month in Oct-Dec
 *   - "steady_drawdown"   else (Jan-Apr 25-50%, etc.)
 *
 * Sentence templates surface live numbers (today's storage TMC,
 * percent FRL across the 4 upstream Cauvery dams) PLUS constants
 * pulled from `bangalore-supply-overview.json` (Stage V design vs
 * actual, NRW, 5.8M served, 65 IISc stress wards, ~5000 tankers).
 */

import type { ReservoirSummary } from "@/types/reservoir";

export type BangaloreBriefingVariant =
  | "drought_drawdown"
  | "pre_monsoon"
  | "monsoon_recharge"
  | "post_monsoon"
  | "steady_drawdown";

export interface BangaloreBriefing {
  variant: BangaloreBriefingVariant;
  /** Structured fields the client component substitutes into i18n
   *  templates. The English prose is no longer carried on this struct -
   *  it is composed at render time so the briefing localises per the
   *  user's chosen language. */
  fields: {
    pct: number;          // total FRL %
    lowName: string;      // dam with lowest % (most-drawn)
    lowPct: number;
    highName: string;     // dam with highest % (most buffer)
    highPct: number;
    stageVDesign: number;
    stageVActual: number;
    served: number;       // population on BWSSB piped (millions)
    gba: number;          // total GBA population (millions)
    tankers: string;      // formatted "5,000"
    wards: number;        // IISc stress wards
    nrwPct: number;
    tmcPerPct: string;    // pretty-printed TMC per 1% FRL
  };
  /** Date string from the upstream daily ingest, or null if no live
   *  reading is available yet. The freshness label is built at render
   *  time using t("briefing.freshness.*"). */
  freshnessDate: string | null;
  /** Total live storage across the 4 upstream Cauvery dams, in TMC. */
  totalStorageTmc: number;
  /** Total full-pool capacity across the 4 dams, in TMC. */
  totalCapacityTmc: number;
  /** Percent FRL across all 4 dams combined. */
  totalPctFrl: number;
}


// Constants pulled from bangalore-supply-overview.json + IISc Outlook
// (April 2025) + OpenCity Tanker Survey 2024-25. Hand-mirrored here so
// the briefing builder doesn't need a separate I/O pass.
const STAGE_V_DESIGN_MLD = 775;
const STAGE_V_ACTUAL_MLD_APPROX = 400;
const NRW_PCT_APPROX = 48;
const POPULATION_SERVED_M = 5.8;
const POPULATION_GBA_M = 14;
const IISC_STRESS_WARDS = 65;
const TANKER_FLEET_APPROX = 5000;


function pickVariant(totalPctFrl: number, monthIST: number): BangaloreBriefingVariant {
  if (totalPctFrl < 25) return "drought_drawdown";
  if (totalPctFrl >= 75) return "post_monsoon";
  // 25-75% bucket: month-driven framing
  if (monthIST === 5 || monthIST === 6) {
    return totalPctFrl < 50 ? "pre_monsoon" : "monsoon_recharge";
  }
  if (monthIST >= 7 && monthIST <= 9) return "monsoon_recharge";
  if (monthIST >= 10 && monthIST <= 12) return "post_monsoon";
  // Jan-Apr or May-Jun rest
  return "steady_drawdown";
}


/**
 * The prose has been moved out into i18n keys (briefing.headline.*,
 * briefing.sentence.*). The builder now returns only the structured
 * fields the client component plugs into those templates.
 */


export function buildBangaloreBriefing(
  summaries: ReservoirSummary[],
  lastUpdated: string | null,
): BangaloreBriefing | null {
  // Bengaluru's 4 upstream Cauvery dams. We need at least one live reading
  // to render anything honest.
  const liveReadings = summaries.filter(
    (s) => s.isLive !== false && s.storagePct != null && s.currentStorage != null,
  );
  if (liveReadings.length === 0) return null;

  // Compute combined FRL %. Use weighted-by-capacity so the larger dams
  // (KRS 48.4 TMC, Hemavathi 35.7 TMC) dominate over the smaller ones
  // (Harangi 8.5 TMC) the way the basin actually behaves.
  const totalStorageMcft = liveReadings.reduce(
    (sum, s) => sum + (s.currentStorage ?? 0),
    0,
  );
  const totalCapacityMcft = liveReadings.reduce(
    (sum, s) => sum + (s.capacity ?? 0),
    0,
  );
  const totalPctFrl =
    totalCapacityMcft > 0 ? (totalStorageMcft / totalCapacityMcft) * 100 : 0;

  const totalStorageTmc = totalStorageMcft / 1000;
  const totalCapacityTmc = totalCapacityMcft / 1000;

  // Pick variant by storage % + IST month (the basin's hydrological clock
  // is sharply month-driven on the south-west monsoon).
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const monthIST = nowIST.getMonth() + 1; // 1-12
  const variant = pickVariant(totalPctFrl, monthIST);

  // Pick lowest- and highest-FRL dams so the client component can drop
  // their names + percentages into the localised dam_range sentence.
  const sorted = liveReadings
    .filter((s) => s.storagePct != null)
    .sort((a, b) => (a.storagePct ?? 0) - (b.storagePct ?? 0));
  const low = sorted[0];
  const high = sorted[sorted.length - 1];

  // TMC of basin storage represented by 1% FRL on the 4 main dams
  // (KRS 48.4 + Hemavathi 35.7 + Harangi 8.5 + Kabini 19.52 TMC ~= 112.12).
  const tmcPerPct = (((48400 + 35700 + 19520 + 8500) / 1000) * 0.01).toFixed(2);

  return {
    variant,
    fields: {
      pct: Math.round(totalPctFrl),
      lowName: low?.displayName ?? "",
      lowPct: Math.round(low?.storagePct ?? 0),
      highName: high?.displayName ?? "",
      highPct: Math.round(high?.storagePct ?? 0),
      stageVDesign: STAGE_V_DESIGN_MLD,
      stageVActual: STAGE_V_ACTUAL_MLD_APPROX,
      served: POPULATION_SERVED_M,
      gba: POPULATION_GBA_M,
      tankers: TANKER_FLEET_APPROX.toLocaleString(),
      wards: IISC_STRESS_WARDS,
      nrwPct: NRW_PCT_APPROX,
      tmcPerPct,
    },
    freshnessDate: lastUpdated,
    totalStorageTmc: Math.round(totalStorageTmc * 100) / 100,
    totalCapacityTmc: Math.round(totalCapacityTmc * 100) / 100,
    totalPctFrl: Math.round(totalPctFrl * 10) / 10,
  };
}

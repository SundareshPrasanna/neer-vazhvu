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
  /** Single-line headline (English). Kannada/Tamil prose deferred until
   *  city-language i18n keys land for Bengaluru. */
  headline: string;
  /** 3-4 supporting bullet sentences. Each is a short factual line. */
  sentences: string[];
  /** Freshness footer ("Cauvery storage: 2026-05-26 · refreshed daily"). */
  freshness: string;
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


function variantHeadline(variant: BangaloreBriefingVariant, pct: number): string {
  const p = pct.toFixed(0);
  switch (variant) {
    case "drought_drawdown":
      return `Cauvery basin in drought drawdown: 4 upstream dams at just ${p}% of FRL combined.`;
    case "pre_monsoon":
      return `Pre-monsoon drawdown: Cauvery upstream at ${p}% of FRL, awaiting south-west monsoon onset.`;
    case "monsoon_recharge":
      return `Cauvery basin in monsoon recharge: 4 upstream dams at ${p}% of FRL combined.`;
    case "post_monsoon":
      return `Cauvery basin near full storage: 4 upstream dams at ${p}% of FRL combined.`;
    case "steady_drawdown":
      return `Cauvery upstream storage at ${p}% of FRL - mid-cycle draw against next monsoon.`;
  }
}


function buildSentences(
  variant: BangaloreBriefingVariant,
  summaries: ReservoirSummary[],
): string[] {
  const out: string[] = [];

  // Per-dam status sentence - lead with the lowest pct (most stress
  // signal) and the highest (most buffer).
  const sorted = summaries
    .filter((s) => s.storagePct != null)
    .sort((a, b) => (a.storagePct ?? 0) - (b.storagePct ?? 0));
  if (sorted.length >= 2) {
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    out.push(
      `${low.displayName} is the most-drawn at ${Math.round(low.storagePct ?? 0)}% FRL; ${high.displayName} carries the most buffer at ${Math.round(high.storagePct ?? 0)}% FRL.`,
    );
  }

  // Stage V structural under-delivery is constant in the briefing because
  // it's the dominant structural fact regardless of upstream storage.
  out.push(
    `BWSSB's Cauvery Stage V (commissioned Oct 2024) is delivering ~${STAGE_V_ACTUAL_MLD_APPROX} MLD against ${STAGE_V_DESIGN_MLD} MLD design per The Ken (Feb 2026), keeping the city's piped capacity below 2034 demand even at full upstream storage.`,
  );

  // Demand-side constants (IISc + tanker).
  out.push(
    `~${POPULATION_SERVED_M}M of ${POPULATION_GBA_M}M GBA residents are on BWSSB piped supply; the rest depend on over-extracted borewells and the ~${TANKER_FLEET_APPROX.toLocaleString()}-tanker informal market. IISc Groundwater Outlook (Apr 2025) flags ${IISC_STRESS_WARDS} BBMP wards as critically over-extracted.`,
  );

  // Variant-specific closing sentence.
  switch (variant) {
    case "drought_drawdown":
      out.push(
        `At this drawdown level, Karnataka's drinking-water carve-out at T.K. Halli is the first item under pressure - irrigation releases get curtailed before urban supply, but pumping itself becomes more contested. Watch the Cauvery Water Management Authority release schedules.`,
      );
      break;
    case "pre_monsoon":
      out.push(
        `Monsoon onset for the Cauvery catchment is typically the first week of June (south-west monsoon). KRS + Hemavathi typically refill 60-80% by end-July in a normal year; weak monsoons (2017, 2023) push that into August.`,
      );
      break;
    case "monsoon_recharge":
      out.push(
        `Recharge season also coincides with the BBMP foam-fire window - Bellandur's downstream weir typically produces surfactant foam events in the first heavy rains after a dry stretch (Feb 2017 fire was the canonical event).`,
      );
      break;
    case "post_monsoon":
      out.push(
        `Even at full upstream storage, BWSSB's ~${NRW_PCT_APPROX}% non-revenue water (JICA Phase 3) means roughly half of what's pumped 95 km from T.K. Halli is lost between WTP and household meter. That structural loss is the next data unlock when BWSSB publishes NRW telemetry.`,
      );
      break;
    case "steady_drawdown":
      out.push(
        `Mid-cycle drawdown phase. Each percentage point of FRL on these four dams represents roughly ${(((48400 + 35700 + 19520 + 8500) / 1000) * 0.01).toFixed(2)} TMC of basin storage - the same volume Bengaluru's piped network distributes in about 25 days at current pumping rates.`,
      );
      break;
  }

  return out;
}


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

  return {
    variant,
    headline: variantHeadline(variant, totalPctFrl),
    sentences: buildSentences(variant, liveReadings),
    freshness: lastUpdated
      ? `Cauvery upstream storage: ${lastUpdated} · refreshed daily via TN Agri archive`
      : "Cauvery upstream storage: live ingest pending",
    totalStorageTmc: Math.round(totalStorageTmc * 100) / 100,
    totalCapacityTmc: Math.round(totalCapacityTmc * 100) / 100,
    totalPctFrl: Math.round(totalPctFrl * 10) / 10,
  };
}

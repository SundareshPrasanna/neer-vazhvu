/**
 * Waterway page type.
 *
 * A waterway is NOT a city and NOT a corridor. Cities are framed around
 * residents; corridors around industry and the shared aquifer; a waterway is
 * framed around one linear water body walked end to end: its measured
 * geometry, its reaches, and the record of what flows into it, what was
 * ordered about it, and what is known versus pending. Like a basin or a
 * corridor, a waterway is data, not code: one WaterwayManifest plus a data
 * build under public/data/waterways/<waterwayId>/ produced by
 * scripts/build_waterway_<id>.py and gated by scripts/verify_waterway_<id>.py.
 * Onboarding the Cooum or the Vaigai later is a new manifest and a data
 * build, never a new component.
 *
 * Editorial constitution: docs/waterways/buckingham-canal/DECISIONS.md
 * (progressive disclosure W2, receipts-on-every-number W3, banned corrected
 * figures W4, attributed-never-averaged capacities W5, no scorecards W6).
 */

/** A source receipt. Every rendered number resolves to one of these. */
export interface WaterwayClaim {
  id: string;
  text: string;
  source: string;
  date: string;
  /** verified = checked against the cited document; inferred = our own
   *  synthesis or measurement interpretation; asserted = a named party's
   *  claim, not endorsed. */
  flag: "verified" | "inferred" | "asserted";
  context: string;
}

export interface WaterwayFact {
  text: string;
  source: string;
  date: string;
  flag: WaterwayClaim["flag"];
  claim_id: string;
}

export interface WaterwayTransect {
  km: number;
  w: number | null;
  flag: string;
}

export interface WaterwayReach {
  id: number;
  name: string;
  km: [number, number];
  verdict: string;
  character: string[];
  width: {
    median_m: number | null;
    min_m: number | null;
    max_m: number | null;
    n_measured: number;
  };
  satellite: {
    veg_frac_dry: number | null;
    veg_frac_recent: number | null;
    water_frac_recent: number | null;
    eff_width_m_recent: number | null;
  };
  transects: WaterwayTransect[];
  built_edge: {
    buildings_50m: number;
    rooftop_m2_50m: number;
    buildings_100m: number;
  } | null;
  photos: { file: string; author: string; licence: string; year: string }[];
  facts: WaterwayFact[];
  chips: string[];
}

export interface WaterwayChapter {
  id: number;
  key: string;
  title: string;
  km: [number, number] | null;
  verdict: string;
  reach_ids: number[];
  reaches: { id: number; name: string; km: [number, number] }[];
}

export interface WaterwayTimelineEntry {
  year: string;
  label: string;
  amount: string | null;
  status: string;
  source: string;
  date: string;
  claim_id: string;
}

export interface WaterwayHeadlineStat {
  value: string;
  label: string;
  source: string;
  date: string;
  flag: WaterwayClaim["flag"];
  claim_id: string;
}

export interface WaterwayIdentity {
  name: string;
  scope: string;
  length_km: number;
  chainage_zero: string;
  built: string;
  headline_stats: WaterwayHeadlineStat[];
}

export interface WaterwayManifest {
  waterwayId: string;
  /** Full display name, e.g. "The Buckingham Canal". */
  displayName: string;
  /** Short label for chrome, e.g. "Buckingham Canal". */
  shortName: string;
  stateCode: string;
  /** One-sentence description for metadata. */
  description: string;
  /** Map initial view over the full alignment. */
  center: [number, number];
  zoom: number;
  /** Chainage direction note rendered in the explorer. */
  chainageNote: string;
  /** Preview gate: page 404s in production unless enabled. */
  enabled: boolean;
}

export interface WaterwayTodayTile {
  value: string;
  label: string;
  source: string;
  date: string;
  flag: WaterwayClaim["flag"];
  claim_id: string;
}

export interface WaterwayToday {
  as_of: string;
  tiles: WaterwayTodayTile[];
  strip: { state: string; from: number; to: number }[];
  veg_by_reach: { reach_id: number; veg_ha: number }[];
  top_veg_reaches: { reach_id: number; veg_ha: number }[];
  turbidity: { reach_id: number; ndti: number | null; water_ha: number }[];
  silt: WaterwayFact[];
}

export interface WaterwayWidthLedger {
  note: string;
  source: string;
  date: string;
  flag: WaterwayClaim["flag"];
  today_line: string;
  claim_id?: string;
  rows: {
    stretch: string;
    orig_min: number;
    orig_max: number;
    hsctc_min: number;
    hsctc_max: number;
    m2026_min?: number | null;
    m2026_max?: number | null;
  }[];
}

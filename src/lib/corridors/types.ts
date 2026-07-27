/**
 * Industrial Corridor page type.
 *
 * A corridor is NOT a city. Cities are framed around residents (wards, taps,
 * reservoirs); corridors are framed around industry and the shared aquifer
 * (assessment units, extraction pressure, regulatory status). Like a basin
 * (src/lib/basins/), a corridor is data, not code: one CorridorManifest plus
 * data files under public/data/corridors/<corridorId>/ produced by
 * scripts/build_corridor_<corridorId>.py. Onboarding a new corridor
 * (Tiruppur, Peenya, Chakan) is a new manifest and a data build, never a new
 * component.
 *
 * Editorial constitution (docs/corridors/sriperumbudur/DECISIONS.md): every
 * number dated and sourced, gaps named, no scorecards, no company-level
 * depletion attribution, no interpolation dressed as measurement.
 */

/** One taluk row of assessment.json's `table`, as emitted by the build script. */
export interface CorridorTalukRow {
  taluk: string;
  district: string;
  editions: Record<
    string,
    { category: string | null; stage_pct: number | null; rainfall_mm: number | null }
  >;
  category_change: string | null;
  stage_trend: "up" | "down" | "flat" | null;
  firka_categories_2025: [string, string | null][];
}

export interface CorridorAssessment {
  _provenance: Record<string, unknown> & { retrieved: string };
  corridor_taluks_from_intersect: string[];
  corridor_taluks_final: string[];
  table: CorridorTalukRow[];
}

export interface CorridorManifest {
  corridorId: string;
  /** Full display name, e.g. "Sriperumbudur-Oragadam Industrial Corridor". */
  displayName: string;
  /** Short label for chrome and links, e.g. "Sriperumbudur-Oragadam". */
  shortName: string;
  stateCode: string;
  /** Districts whose assessment units the corridor spans. */
  districts: string[];
  /** Map initial view. */
  center: [number, number];
  zoom: number;
  /** One-sentence description for metadata and the landing card. */
  description: string;
  /**
   * Assessment editions rendered as a comparable trend series (identical
   * units; see DECISIONS.md D3 for the comparability cut lines).
   */
  editions: string[];
  latestEdition: string;
  /** The assessment unit named in UI copy (TN: revenue firka under taluk). */
  unitNoun: string;
}

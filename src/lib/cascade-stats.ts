/**
 * Server-side loader for cascade reconstruction stats manifests.
 *
 * The pipeline at neer-vazhvu-api/app/cascade/publish.py writes one
 * stats JSON per district at public/data/cascade/{cityId}-cascade-stats.json.
 * This module reads those files at build time / server-render time so
 * the frontend never hardcodes the counts.
 *
 * Returns null if the stats file is absent (e.g. a city without
 * cascade overlay, or one whose pipeline has not yet run). Callers
 * should treat null as "do not render the cascade methodology
 * section".
 */

import fs from "node:fs";
import path from "node:path";

export interface CascadeNodeSummary {
  osm_id: number;
  name: string | null;
  degree_in: number;
  cascade_position: number | null;
  area_ha: number | null;
}

export interface EdgeConfidenceCounts {
  high: number;
  medium: number;
  low: number;
  unspecified: number;
}

export interface CascadeStats {
  district_id: string;
  label: string;
  _meta: {
    generated_at: string;
    pipeline_version: string;
    algorithm: string;
    inputs_hash: string;
  };
  node_count: number;
  edge_count: number;
  river_outlet_count: number;
  isolated_count: number;
  max_cascade_depth: number;
  top_convergence: CascadeNodeSummary | null;
  narrative_anchor: CascadeNodeSummary | null;
  edge_confidence_counts?: EdgeConfidenceCounts;
}

const STATS_DIR = path.join(process.cwd(), "public", "data", "cascade");

export function loadCascadeStats(cityId: string): CascadeStats | null {
  const filePath = path.join(STATS_DIR, `${cityId}-cascade-stats.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as CascadeStats;
  } catch {
    return null;
  }
}

/**
 * Resolve the spotlight node to surface on the methodology section.
 * Prefer the explicit narrative_anchor (if a district config names
 * one) over the auto-computed top_convergence node. Returns null if
 * neither is available or both lack a name.
 */
export function resolveConvergenceExample(
  stats: CascadeStats,
): { name: string; degreeIn: number } | null {
  const candidate = stats.narrative_anchor ?? stats.top_convergence;
  if (!candidate || !candidate.name) return null;
  return { name: candidate.name, degreeIn: candidate.degree_in };
}

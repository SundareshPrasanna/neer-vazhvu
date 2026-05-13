/**
 * Cascade stats: types + pure utility functions. Safe to import from
 * client components (no fs / no node-only modules). The server-side
 * loader that reads the JSON from disk lives in
 * `cascade-stats-loader.ts` and must only be imported from server
 * components (page.tsx files), never from "use client" components.
 */

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

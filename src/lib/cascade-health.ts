/**
 * Server-side loader for cascade-health JSON outputs.
 *
 * The pipeline at neer-vazhvu-api/app/cascade/health.py writes
 * public/data/cascade/{cityId}-cascades-health.json with documented +
 * auto-derived cascades, each scored and priority-classed. This
 * module reads those files at server-render time so the frontend
 * never has to parse them on the client.
 */

import fs from "node:fs";
import path from "node:path";

export type CascadePriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface DocumentedCascadeTank {
  name: string;
  osm_id: number | null;
  area_ha?: number | null;
  category?: string;
  is_terminal?: boolean;
  is_inflow_origin?: boolean;
  is_tributary?: boolean;
  supernode_group?: string;
  notes?: string;
}

export interface DocumentedCascadeEdge {
  from_index: number;
  to_index: number;
  link_type: "natural" | "engineered" | "mixed";
  notes?: string;
}

export interface CascadeSource {
  citation: string;
  url: string;
  type: string;
}

export interface CascadeCourtAnchor {
  case: string;
  court: string;
  year: number;
  url: string;
  summary?: string;
}

export interface CascadeRestorationAnchor {
  program: string;
  url: string;
}

export interface DocumentedCascadeScored {
  cascade_id: string;
  name: string;
  short_name: string | null;
  narrative: string;
  transfer_type: "natural" | "engineered" | "mixed";
  historical_era: string | null;
  confidence: string;
  is_engineered_control: boolean;
  source: CascadeSource;
  court_anchor: CascadeCourtAnchor | null;
  restoration_anchor: CascadeRestorationAnchor | null;
  tanks_in_order: DocumentedCascadeTank[];
  edges: DocumentedCascadeEdge[];
  health_score: number;
  priority: CascadePriority;
  components: {
    tank_presence: { resolved_in_osm: number; total: number; ratio: number };
    edge_reproduction: {
      reproduced: number;
      total_documented: number;
      ratio: number;
    };
    avg_edge_confidence: number;
    lost_tank_intersections: string[];
    court_anchor_present: boolean;
    restoration_anchor_present: boolean;
    engineered_control: boolean;
  };
}

export interface AutoCascadeScored {
  cascade_id: string;
  size: number;
  tank_osm_ids: number[];
  representative_tank_name: string | null;
  total_area_ha: number;
  edge_count: number;
  avg_edge_confidence: number;
  isolated_count: number;
  non_isolated_ratio: number;
  lost_tank_intersections: string[];
  health_score: number;
  priority: CascadePriority;
  documented_overlap: {
    documented_cascade_id: string;
    documented_name: string;
    shared_tank_count: number;
  } | null;
}

export interface CascadeHealth {
  district_id: string;
  label: string;
  _meta: {
    generated_at: string;
    pipeline_version: string;
    algorithm: string;
    inputs_hash: string;
  };
  summary: {
    documented_count: number;
    auto_count: number;
    documented_by_priority: Record<CascadePriority, number>;
    auto_by_priority: Record<CascadePriority, number>;
    min_component_size: number;
  };
  documented_cascades: DocumentedCascadeScored[];
  auto_cascades: AutoCascadeScored[];
}

const HEALTH_DIR = path.join(process.cwd(), "public", "data", "cascade");

export function loadCascadeHealth(cityId: string): CascadeHealth | null {
  const filePath = path.join(HEALTH_DIR, `${cityId}-cascades-health.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as CascadeHealth;
  } catch {
    return null;
  }
}

/**
 * Visual styling for priority badges. Tailwind class strings; kept
 * here so all cascade cards stay consistent.
 */
export const PRIORITY_STYLES: Record<
  CascadePriority,
  { badge: string; bar: string; ring: string }
> = {
  CRITICAL: {
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    bar: "bg-red-500",
    ring: "ring-red-200 dark:ring-red-900/40",
  },
  HIGH: {
    badge:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    bar: "bg-orange-500",
    ring: "ring-orange-200 dark:ring-orange-900/40",
  },
  MEDIUM: {
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    bar: "bg-amber-500",
    ring: "ring-amber-200 dark:ring-amber-900/40",
  },
  LOW: {
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    bar: "bg-emerald-500",
    ring: "ring-emerald-200 dark:ring-emerald-900/40",
  },
};

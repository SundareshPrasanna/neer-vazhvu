import type { RiverId } from "./river-quality";

// ─── Status & category constants ────────────────────────────────────────────

export const RESTORATION_STATUSES = ["completed", "in_progress", "planned"] as const;
export type RestorationStatus = (typeof RESTORATION_STATUSES)[number];

export const RESTORATION_CATEGORIES = ["eco_restoration", "river_restoration", "infrastructure", "canal_restoration"] as const;
export type RestorationCategory = (typeof RESTORATION_CATEGORIES)[number];

// ─── Data types ─────────────────────────────────────────────────────────────

export interface RestorationMetric {
  label: string;
  label_ta: string | null;
  value: string;
}

export interface RestorationProject {
  id: string;
  name: string;
  name_ta: string | null;
  display_on_rivers: RiverId[];
  location_name: string;
  status: RestorationStatus;
  category: RestorationCategory;
  budget_display: string | null;
  budget_cr: number | null;
  area_acres: number | null;
  length_km: number | null;
  started: string | null;
  completed: string | null;
  implementing_agencies: string[];
  source_url: string;
  summary: string;
  summary_ta: string | null;
  metrics: RestorationMetric[];
}

export interface RestorationProjectsData {
  last_updated: string;
  source: string;
  projects: RestorationProject[];
}

/**
 * Server-side loader for cascade sensitivity sweep outputs.
 *
 * The pipeline at neer-vazhvu-api/app/cascade/sensitivity.py writes
 * public/data/cascade/{cityId}-cascade-sensitivity.json with per-
 * parameter sweep results. This module reads those files at server-
 * render time for the about-page methodology section.
 */

import fs from "node:fs";
import path from "node:path";

export interface SensitivityResult {
  value: number;
  skipped: boolean;
  note?: string;
  node_count?: number;
  edge_count?: number;
  river_outlet_count?: number;
  isolated_count?: number;
  max_cascade_depth?: number;
  edge_confidence_counts?: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface SensitivitySweep {
  parameter: string;
  default: number;
  values: number[];
  results: SensitivityResult[];
}

export interface CascadeSensitivity {
  district_id: string;
  label: string;
  _meta: {
    generated_at: string;
    pipeline_version: string;
    algorithm: string;
    inputs_hash: string;
  };
  sweeps: SensitivitySweep[];
}

const SENSITIVITY_DIR = path.join(process.cwd(), "public", "data", "cascade");

export function loadCascadeSensitivity(
  cityId: string,
): CascadeSensitivity | null {
  const filePath = path.join(
    SENSITIVITY_DIR,
    `${cityId}-cascade-sensitivity.json`,
  );
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as CascadeSensitivity;
  } catch {
    return null;
  }
}

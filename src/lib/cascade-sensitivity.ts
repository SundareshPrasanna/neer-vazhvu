/**
 * Cascade sensitivity: types only. Safe to import from client
 * components. The server-side loader lives in
 * `cascade-sensitivity-loader.ts` and must only be imported from
 * server components.
 */

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

import type { WardProfile } from "@/lib/hooks/use-ward-profile";

/* ── Intervention catalog ──────────────────────────────────────────── */

export type ResolutionType = "continuous" | "discrete";

export interface Intervention {
  id: string;
  labelKey: string;
  descriptionKey: string;
  /** Must match a key in ward-rankings METRICS. */
  metricKey: string;
  /** Natural unit: "km", "zone", "body". */
  unit: string;
  unitLabelKey: string;
  /** Cost per unit in crore (low estimate). */
  costPerUnitCrLow: number;
  /** Cost per unit in crore (high estimate). */
  costPerUnitCrHigh: number;
  /**
   * Change in the *raw physical quantity* per unit of intervention.
   * For area-normalized metrics (km/sq km, zones/sq km, bodies/sq km),
   * the uplift planner divides by area_sq_km at computation time.
   *
   * For restoration score (wb_health), this is the approximate score
   * improvement per body restored, divided by the ward's body count.
   */
  impactPerUnit: number;
  /** "add" for higher-is-better metrics, "subtract" for lower-is-better. */
  impactDirection: "add" | "subtract";
  /** Continuous (km, can do 0.1 increments) or discrete (whole bodies/zones). */
  resolution: ResolutionType;
  /** Smallest practical step. 0.1 km for continuous, 1 for discrete. */
  stepSize: number;
  /**
   * Maximum units per ward. Computed from the ward's actual data when
   * this function is provided; otherwise falls back to flatMaxUnits.
   */
  maxUnits: (p: WardProfile) => number;
  /** Hard ceiling regardless of profile (for display/safety). */
  flatMaxUnits: number;
  /** Englishcitation for cost estimate. Not shown in UI, for maintainers. */
  sourceNote: string;
}

/* ── Interventions ─────────────────────────────────────────────────── */

export const INTERVENTIONS: Intervention[] = [
  {
    id: "build_drain",
    labelKey: "uplift.int_build_drain",
    descriptionKey: "uplift.int_build_drain_desc",
    metricKey: "drainage",
    unit: "km",
    unitLabelKey: "uplift.unit_km",
    costPerUnitCrLow: 1.5,
    costPerUnitCrHigh: 3.0,
    impactPerUnit: 1.0, // +1 km drain length (divided by area_sq_km)
    impactDirection: "add",
    resolution: "continuous",
    stepSize: 0.1,
    maxUnits: () => 20, // practical cap per ward
    flatMaxUnits: 20,
    sourceNote: "GCC SWD tender estimates 2022-24",
  },
  {
    id: "build_pumping_main",
    labelKey: "uplift.int_build_pumping_main",
    descriptionKey: "uplift.int_build_pumping_main_desc",
    metricKey: "sewerage_infra",
    unit: "km",
    unitLabelKey: "uplift.unit_km",
    costPerUnitCrLow: 3.0,
    costPerUnitCrHigh: 6.0,
    impactPerUnit: 1.0, // +1 km pumping main (divided by area_sq_km)
    impactDirection: "add",
    resolution: "continuous",
    stepSize: 0.1,
    maxUnits: () => 15,
    flatMaxUnits: 15,
    sourceNote: "CMWSSB Phase-2 expansion DPR, Smart Cities Mission benchmarks",
  },
  {
    id: "flood_mitigation",
    labelKey: "uplift.int_flood_mitigation",
    descriptionKey: "uplift.int_flood_mitigation_desc",
    metricKey: "flood_risk",
    unit: "zone",
    unitLabelKey: "uplift.unit_hazard_zone",
    costPerUnitCrLow: 5.0,
    costPerUnitCrHigh: 15.0,
    impactPerUnit: 1.0, // -1 severe zone (divided by area_sq_km)
    impactDirection: "subtract",
    resolution: "discrete",
    stepSize: 1,
    maxUnits: (p) => {
      // Cap at actual number of high + very_high zones
      const cat = p.flood.by_category;
      return (cat["very_high"] ?? 0) + (cat["high"] ?? 0);
    },
    flatMaxUnits: 30,
    sourceNote: "CFLOWS Chennai flood mitigation feasibility, NDMA project costs",
  },
  {
    id: "restore_water_body",
    labelKey: "uplift.int_restore_wb",
    descriptionKey: "uplift.int_restore_wb_desc",
    metricKey: "wb_health",
    unit: "body",
    unitLabelKey: "uplift.unit_water_body",
    costPerUnitCrLow: 2.0,
    costPerUnitCrHigh: 8.0,
    // Approximate: restoring one body reduces the ward's average
    // restoration score by ~15 points / current_count.
    impactPerUnit: 15.0,
    impactDirection: "subtract",
    resolution: "discrete",
    stepSize: 1,
    maxUnits: (p) => {
      // Only restore bodies that actually need it
      return p.water_bodies.restoration_critical + p.water_bodies.restoration_high;
    },
    flatMaxUnits: 10,
    sourceNote: "Care Earth Trust restoration estimates, TNSWA lake restoration projects",
  },
  {
    id: "revive_water_body",
    labelKey: "uplift.int_revive_wb",
    descriptionKey: "uplift.int_revive_wb_desc",
    metricKey: "wb_density",
    unit: "body",
    unitLabelKey: "uplift.unit_water_body",
    costPerUnitCrLow: 10.0,
    costPerUnitCrHigh: 25.0,
    impactPerUnit: 1.0, // +1 body (divided by area_sq_km)
    impactDirection: "add",
    resolution: "discrete",
    stepSize: 1,
    maxUnits: (p) => {
      // Only offer revival when ward has documented lost bodies
      return p.lost_bodies.count;
    },
    flatMaxUnits: 5,
    sourceNote: "TNSWA revival cost estimates, Naganathapuram lake revival project 2023",
  },
];

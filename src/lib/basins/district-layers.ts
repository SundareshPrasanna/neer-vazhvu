import type { BasinLayer } from "./types";

// Layer building blocks shared by the district basin atlases (Erode, Krishnagiri,
// Palakkad), so each district manifest declares only what differs.

type ClassRow = NonNullable<BasinLayer["classes"]>["rows"][number];
const kindClasses = (rows: ClassRow[]) => ({ prop: "kind", rows });

/** The frame: district boundary, the catchments a river selection scopes to, the river lines. */
export function districtFrame(district: string, catchments: string, rivers: string): BasinLayer[] {
  return [
    { family: "boundary", label: `${district} district boundary`, floor: "hydrology", geom: "fill", color: "#d946ef", defaultOn: true, context: true },
    { family: "sub-hydrosheds", label: catchments, floor: "hydrology", geom: "fill", color: "#818cf8", defaultOn: true, context: true },
    { family: "rivers", label: rivers, floor: "hydrology", geom: "line", color: "#2563eb", defaultOn: true, context: true },
  ];
}

export const TN_WRD_CATCHMENTS = "Sub-basin catchments (TN WRD)";

export const CWC_CANALS: BasinLayer = {
  family: "canals", label: "Canal network (CWC)", floor: "hydrology", geom: "line", color: "#0891b2", defaultOn: true,
  classes: kindClasses([
    { value: "main", label: "Main and branch canals", color: "#0e7490" },
    { value: "distributary", label: "Distributaries", color: "#06b6d4" },
    { value: "minor", label: "Minors and sub-minors", color: "#67e8f9" },
  ]),
};

/** Reservoir points; the two legend rows say which ones open a reading. */
export function reservoirs(label: string, withReading: string, withoutReading: string): BasinLayer {
  return {
    family: "reservoirs", label, floor: "hydrology", geom: "point", color: "#0891b2", defaultOn: true, readings: true,
    legendRows: [
      { sym: "dot", color: "#0891b2", label: withReading },
      { sym: "ring", color: "#0891b2", label: withoutReading },
    ],
  };
}

/** TNGIS water bodies: the larger outlines, the heavy remainder, and named-tank points. */
export const TNGIS_WATER_BODIES: BasinLayer[] = [
  { family: "waterbodies-major", label: "Tanks and water bodies (named or 5 ha and above)", floor: "hydrology", geom: "fill", color: "#0284c7", defaultOn: true },
  { family: "waterbodies-minor", label: "Smaller water bodies and stream parcels", floor: "hydrology", geom: "fill", color: "#0d9488", defaultOn: false, heavy: true },
  { family: "tanks", label: "Named tanks (centre points)", floor: "hydrology", geom: "point", color: "#0284c7", defaultOn: false },
];

/** The four TNGIS watershed levels. */
export const TNGIS_WATERSHEDS: BasinLayer[] = [
  { family: "watersheds", label: "Watersheds", floor: "hydrology", geom: "fill", color: "#4f46e5", defaultOn: false, outline: true },
  { family: "sub-watersheds", label: "Sub-watersheds", floor: "hydrology", geom: "fill", color: "#6366f1", defaultOn: false, outline: true },
  { family: "mini-watersheds", label: "Mini-watersheds", floor: "hydrology", geom: "fill", color: "#818cf8", defaultOn: false, outline: true },
  { family: "micro-watersheds", label: "Micro-watersheds", floor: "hydrology", geom: "fill", color: "#a5b4fc", defaultOn: false, outline: true, heavy: true },
];

export function cwcGauges(label: string, legend: string): BasinLayer {
  return {
    family: "gauging-stations", label, floor: "monitoring", geom: "point", color: "#0f766e", defaultOn: true, readings: true,
    legendRows: [{ sym: "dot", color: "#0f766e", label: legend }],
  };
}

export function tnpcbRealtime(label: string): BasinLayer {
  return {
    family: "realtime-stations", label, floor: "monitoring", geom: "point", color: "#be185d", defaultOn: true, readings: true,
    legendRows: [{ sym: "dot", color: "#be185d", label: "TNPCB real-time sensor station (tap for charts)" }],
  };
}

export function groundwaterWells(rows: ClassRow[]): BasinLayer {
  return { family: "groundwater-wells", label: "Groundwater wells (depth to water)", floor: "monitoring", geom: "point", color: "#0369a1", defaultOn: true, classes: kindClasses(rows) };
}

export const TN_GROUNDWATER_WELLS = groundwaterWells([
  { value: "cgwb-telemetry", label: "CGWB telemetry, readings to September 2026", color: "#0369a1" },
  { value: "state-telemetry", label: "Tamil Nadu state telemetry, readings to September 2026", color: "#0e7490" },
  { value: "cgwb-manual", label: "CGWB manual wells, readings 2021 to 2024", color: "#64748b", defaultOff: true },
]);

/** The TNPCB register by category and sector: the district's leading red sectors, then the shared rows. */
export function tnpcbIndustries(leading: ClassRow[], orangeLabel: string): BasinLayer {
  return {
    family: "industries", label: "Industrial units (TNPCB category and sector)", floor: "pressures", geom: "point", color: "#be123c", defaultOn: true,
    classes: kindClasses([
      ...leading,
      { value: "red-tannery", label: "Red: tanneries", color: "#7c2d12" },
      { value: "red-paper", label: "Red: pulp and paper", color: "#a16207" },
      { value: "red-chemicals", label: "Red: basic chemicals", color: "#7e22ce" },
      { value: "red-other", label: "Red: other units", color: "#dc2626" },
      { value: "red-quarry-mining", label: "Red: quarries and mining", color: "#78716c", defaultOff: true },
      { value: "orange", label: orangeLabel, color: "#f97316", defaultOff: true },
      { value: "green-white", label: "Green and white category", color: "#16a34a", defaultOff: true },
    ]),
  };
}

export const INGRES_TALUKS: BasinLayer = {
  family: "groundwater-taluks", label: "Groundwater category by taluk (IN-GRES, 2024-2025)", floor: "governance", geom: "fill", color: "#f59e0b", defaultOn: true,
  classes: kindClasses([
    { value: "over-exploited", label: "Over-exploited (extraction above 100% of recharge)", color: "#b91c1c" },
    { value: "critical", label: "Critical (90 to 100%)", color: "#ea580c" },
    { value: "semi-critical", label: "Semi-critical (70 to 90%)", color: "#f59e0b" },
    { value: "safe", label: "Safe (70% and below)", color: "#16a34a" },
  ]),
};

export function treatmentPlants(rows: ClassRow[]): BasinLayer {
  return { family: "treatment-plants", label: "Treatment plants", floor: "governance", geom: "point", color: "#a855f7", defaultOn: true, classes: kindClasses(rows) };
}

export function cwcCommandAreas(rows: ClassRow[]): BasinLayer {
  return { family: "command-areas", label: "Canal command areas (CWC)", floor: "governance", geom: "fill", color: "#65a30d", defaultOn: false, outline: true, classes: kindClasses(rows) };
}

/** Taluk, block and village panchayat outlines (TNGIS). */
export const TN_ADMIN: BasinLayer[] = [
  { family: "admin-taluk", label: "Taluks", floor: "governance", geom: "fill", color: "#7570b3", defaultOn: false },
  { family: "admin-block", label: "Blocks", floor: "governance", geom: "fill", color: "#1b9e77", defaultOn: false },
  { family: "admin-gp", label: "Village panchayats", floor: "governance", geom: "fill", color: "#66a61e", defaultOn: false, heavy: true },
];

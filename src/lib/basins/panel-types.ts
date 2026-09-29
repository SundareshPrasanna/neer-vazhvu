// Data contracts of the basin atlas panels (gaps.json, prs.json, accountability.json)
// and of its legend rows, shared by the on-screen panels and the PDF export.

// gaps.json shape (cross-source treatment-gap intelligence per admin unit).
export interface GapSource { source: string; says: string; citation: string; url?: string }
export type GapMedium = "liquid" | "solid";
export type GapSector = "public" | "industry" | "institutional" | "construction";
export interface GapStream {
  stream: string;
  summary: string;
  /** Which waste medium this stream belongs to (groups the panel). */
  medium?: GapMedium;
  /** Who generates it - the sector axis (drives composition-bar colour). */
  sector?: GapSector;
  /** Native reporting granularity of the figures (taluk vs district-wide). */
  granularity?: "taluk" | "district";
  /** Generation magnitude normalised to the medium's common unit (MLD for
   *  liquid, TPD for solid), for the composition bar. Absent = no defensible
   *  generation figure (stream still shows as a card). */
  magnitude?: { perDay: number; unit: string; estimated?: boolean };
  // emphasis tone: "bad" (red - a gap/deficit/non-compliance) or "good" (green
  // - a positive outcome). Legacy `true` is treated as "bad". Absent = neutral.
  metrics: { label: string; value: string; emphasis?: boolean | "good" | "bad" }[];
  trend?: { label: string; unit?: string; points: { year: number; value: number | null; url?: string; note?: string }[] };
  sources: GapSource[];
}
/** panelLabel names what the unit's evidence IS (the DEP-snapshot default is
 *  the Arkavathi's; a city river's gap view is built from other documents). */
export interface GapUnit { name: string; level?: string; coverage?: string; conflicts?: string[]; caveats?: string[]; headline: string; streams: GapStream[]; panelLabel?: string }

// ── DEP Snapshot v2 (gaps.json `version: 2`; district-first) ─────────────────
// One tab per district whose DEP covers part of the basin (Paani review,
// 28 Jul 2026): DEPs are district documents, so the panel now leads with the
// district, taluks nest below it, ULBs below that, and the content is re-cut
// to the 7 NGT thematic areas (OA 360/2018). v1 basins (plain `units`) keep
// the old single-unit GapPanel untouched.
/** How to find a region on the map (shared by accountability + DEP panels). */
export type MapMatch = { family: string; prop?: string; values?: string[]; contains?: string[]; kinds?: string[] };
export type DepThemeStatus = "covered" | "district-level" | "not-covered";
export interface DepTheme {
  theme: string;
  subtheme?: string;
  /** covered = unit-specific data; district-level = reported district-wide
   *  only; not-covered = the plan is silent for this unit. */
  status: DepThemeStatus;
  summary?: string;
  metrics?: { label: string; value: string; emphasis?: boolean | "good" | "bad" }[];
  /** Action items the plan itself lists for this theme - the accountability
   *  payload (action point / timeline / responsible agency). */
  openActions?: string[];
  /** Source page numbers in the DEP document. */
  pages?: number[];
  /** Value read via OCR from a scanned plan; treat as approximate. */
  ocrUncertain?: boolean;
}
export interface DepUlb {
  key: string;
  name: string;
  type: string;
  note?: string;
  /** The ULB's constituting/upgrading gazette notification (Paani round 4). */
  gazette?: { label: string; url: string };
  /** Internal contradictions of the plan at this ULB's level. */
  conflicts?: string[];
  mapMatch?: MapMatch;
  themes: DepTheme[];
}
/** A taluk tab carries only what the DEP reports at taluk grain - ULB-level
 *  data lives on the ULB tabs (Paani round 4: the old cross-source unit here
 *  duplicated the ULB content). */
export interface DepTaluk { key: string; label: string; mapMatch?: MapMatch; note?: string; themes: DepTheme[] }
export interface DepDistrict {
  key: string;
  name: string;
  dep: { label: string; url: string; note?: string };
  /** Share of the district's area inside the basin (computed from the
   *  admin-district and boundary layers). */
  pctInBasin: number;
  counts?: { label: string; value: string }[];
  countsNote?: string;
  /** Internal contradictions of the plan at district level. */
  conflicts?: string[];
  mapMatch?: MapMatch;
  districtThemes: DepTheme[];
  ulbs: DepUlb[];
  taluks: DepTaluk[];
  industrialAreas?: { name: string; mapMatch?: MapMatch }[];
  industrialAreasNote?: string;
  /** Cross-source contradictions about the district's industrial areas. */
  industrialAreasConflicts?: string[];
}
export interface DepGovernance {
  items: { heading: string; body: string; source?: GapSource }[];
  gaps: string[];
}
export interface DepData { version: 2; title?: string; note?: string; governance?: DepGovernance; districts: DepDistrict[] }

// ── PRS (Polluted River Stretch) entry-point panel (prs.json) ────────────────
// Tabbed surface: each tab is a stressor theme; the subtab axis differs per
// theme (Sewage = admin units along the stretch; Industrial/Solid/PRS = named
// sub-categories). The selected tab+subtab shows two parallel 2021-2025 tracks:
// generation and the infrastructure built (per the partner's PDF, page 3).
export interface PrsYearPoint { year: number; value: number }
export interface PrsInfraItem { label: string; status: string; tone?: "good" | "bad" | "neutral" }
export interface PrsUnit {
  key: string;
  name: string;
  /** Admin level this unit's figures are reported at (ULB / taluk / district /
   *  catchment), shown as a chip so each number's granularity is explicit. */
  level?: string;
  /** "other" = figures come from DEP / CAG / F-register etc., not the MPR.
   *  MPR is the primary baseline: each town's detail renders an MPR bucket
   *  first, then an Other-sources bucket. Units tagged "other" show an
   *  explicit no-data state in the MPR bucket and their content moves to
   *  the Other-sources bucket. */
  sourceTier?: "mpr" | "other";
  /** Custom text for the MPR bucket's no-data state (default: "Not itemised
   *  in any MPR edition"). E.g. BBMP: the MPR tracks the V-Valley catchment
   *  in aggregate rather than per-ULB. */
  mprNote?: string;
  /** Names the specific document(s) behind an other-source unit, rendered
   *  under the figures ("Source: ..."). */
  sourceNote?: string;
  /** Links to this unit's full cross-source GapPanel. */
  gapUnit?: string;
  caveat?: string;
  /** Generated quantity per year (MLD for liquid, TPD for solid). */
  generation: PrsYearPoint[];
  generationNote?: string;
  /** Treated/processed quantity per year, same unit as generation. */
  treated: PrsYearPoint[];
  capacity?: string;
  gapValue?: number;
  gapNote?: string;
  infrastructure?: PrsInfraItem[];
  dashboard?: string;
  /** Other waste streams reported for this unit (plastic, biomedical, hazardous)
   *  - a label + value line, shown beneath the generated-vs-processed timeline. */
  otherStreams?: { label: string; value: string }[];
}
/** A narrative sub-theme (Industrial: Discharges/Areas/Clusters; PRS:
 *  PRS/E-flow/Flood/Evidence) - text + key points, not a per-year timeline. */
export interface PrsCategory {
  key: string;
  label: string;
  /** Admin level this category's figures are reported at (shown as a chip). */
  level?: string;
  body?: string;
  points?: string[];
  /** A map layer this category maps to (e.g. "pressures", "evidence-points"). */
  layerRef?: string;
  /** See PrsUnit.sourceTier - "other" groups this category under Other sources. */
  sourceTier?: "mpr" | "other";
  /** An external source to open in a new tab (e.g. a live CPCB dashboard the
   *  reader can inspect for themselves). */
  link?: { url: string; label: string };
  /** No known public data yet - shown as an explicit honest gap. */
  noData?: boolean;
}
export interface PrsTab {
  key: string;
  label: string;
  status: "built" | "soon";
  subtabKind?: "units" | "categories";
  source?: string;
  intro?: string;
  /** "stretch" = reported for the stretch as a whole; only these tabs are
   *  listed in the panel. Unscoped tabs feed the accountability matrix. */
  scope?: "stretch";
  /** Status-list row (summary view): a short badge + one-liner + tone colour. */
  summaryBadge?: string;
  summaryLine?: string;
  summaryTone?: "bad" | "warn" | "neutral" | "good";
  /** "units" tabs: the dual-timeline. unitLabel = MLD|TPD; treatedVerb =
   *  treated|processed (drives the bar value + legend wording). */
  unitLabel?: string;
  treatedVerb?: string;
  units?: PrsUnit[];
  /** "categories" tabs: narrative sub-themes. */
  categories?: PrsCategory[];
}
/** One CPCB survey edition of the stretch: how long it was and which BOD-based
 *  priority band it fell in. */
export interface PrsEpoch {
  year: number;
  length_km: number;
  priority: string;
  /** Where the length comes from when it is not our own mapping (a board's
   *  action plan, say), or any caveat that belongs beside the bar. */
  note?: string;
  /** This edition's extent is not drawn on the map - no geometry, or geometry
   *  too partial to draw honestly. The panel says so rather than implying the
   *  reader is looking at the whole of it. */
  notMapped?: boolean;
}
export interface PrsData {
  river: string;
  stretchName: string;
  /** Survey editions, oldest first. Two on the Arkavathi (2020, 2025), three
   *  on rivers CPCB has reclassified more often. The status bars, the map
   *  legend and the growth toggle all derive from this list, so adding an
   *  edition is a data change. */
  epochs: PrsEpoch[];
  /** Legacy lead paragraph. Superseded by statusLine + statusFacts (Paani
   *  Phase-1 review asked for structured facts over prose); rendered only
   *  when statusFacts is absent. */
  conclusion?: string;
  /** Plain-language one-liner under the 2020/2025 bars, e.g. "The polluted
   *  stretch has expanded by nearly 38 km while deteriorating from Priority
   *  III to Priority I." */
  statusLine?: string;
  /** Structured Current Status facts (stretch, length, classification,
   *  restoration target), rendered as label/value rows. */
  statusFacts?: { label: string; value: string }[];
  /** "Cite this Data Source" link - the canonical reference for the PRS
   *  classification (mirrored copy preferred so the link never breaks). */
  citeSource?: { url: string; label?: string };
  /** "Key Terms Used on This Page" popup: full forms + context for CPCB,
   *  PRS, MPR, BOD, priority classes etc. */
  keyTerms?: { term: string; full: string; note?: string }[];
  /** Governance & compliance block: who is accountable for restoring this
   *  stretch, and the reporting obligations that make them checkable. */
  governance?: {
    rows: { label: string; value: string }[];
    actionPlan?: { url: string; label?: string };
    compliance?: { value: string; link?: { url: string; label: string }; note?: string }[];
    note?: string;
  };
  growthNote?: string;
  priorityNote?: string;
  /** One-line "what this is" - the MPR-overview context line. */
  mprOverview?: string;
  /** Which admin levels (district / taluk / ULB / GP) the data covers and which
   *  it does not - shown as an explicit reporting-level note. */
  levelCoverage?: string;
  /** How to read the figures - that "nil/not reported" means absent from the
   *  documents, not necessarily absent on the ground. */
  reportingCaveat?: string;
  bodCaveat: string;
  /** Promoted "extent of pollution" section, shown above the per-area tabs:
   *  the evidence that pollution is documented over time and beyond BOD.
   *  link = the featured independent study (Paani x ICCW report). */
  evidence?: { headline: string; points: string[]; layerRef?: string; link?: { url: string; label: string } };
  tabs: PrsTab[];
  grievance?: { label: string; sub?: string; url: string; urlNote?: string };
  sources?: string[];
}

// ── Accountability matrix (accountability.json) ─────────────────────────────
// Region-first Action-Plan-vs-MPR comparison (Paani Phase-2 agreement):
// MPR = the primary, monthly-updated baseline; DEP/CAG/F-register = other
// sources. The verdict encodes what exists at each level - "not reported"
// is a first-class, citable finding, not a blank.
export interface AccCategory {
  key: string;
  label: string;
  verdict: "tracked" | "in-plan-not-reported" | "reported-not-in-plan" | "silent";
  actionPlan: { status: "addressed" | "partial" | "absent"; summary: string; cite?: string };
  mpr: { status: "reported" | "partial" | "not-reported"; summary: string; asOf: string };
  gaps?: string[];
  /** Key into legalLibrary. */
  legalRef?: string;
  media?: { label: string; url: string }[];
}
export interface AccRegion {
  kind: "ulb" | "ia" | "gp";
  key: string;
  name: string;
  inBasinNote?: string;
  grievance?: { label: string; url: string };
  /** Regions the documents never itemise carry this instead of categories. */
  silentNote?: string;
  /** How to find this region on the map: the layer family plus a property
   *  match (exact values or substring contains). When the family is split into
   *  kind-filtered layer entries, `kinds` names which entries to switch on. */
  mapMatch?: MapMatch;
  categories: AccCategory[];
}
export interface AccountabilityData {
  question: string;
  intro?: string;
  portalNote?: string;
  baseline: {
    primary: { label: string; asOf: string; note?: string };
    /** asOf dates the plan itself. It was hardcoded as "2019" in both surfaces,
     *  which is the Arkavathi's edition and nobody else's - the Kabini and
     *  Shimsha plans carry no date we can establish, so they render without one. */
    actionPlan: { label: string; url: string; asOf?: string };
    banner?: string;
    otherSources?: string[];
  };
  legalLibrary?: Record<string, { label: string; url: string }[]>;
  regions: AccRegion[];
}

export type LegendSym = "box" | "dot" | "ring" | "line" | "dash" | "outline" | "tri" | "tri-ring";
export interface LegendItem { sym: LegendSym; color: string; label: string }

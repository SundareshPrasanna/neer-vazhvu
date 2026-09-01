"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Circle, Tooltip, ZoomControl, Pane, useMap } from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import { MapResizer } from "@/components/map-resizer";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { useMapTiles } from "@/lib/utils/map-tiles";
import { ELEVATION_BAND_COLORS, elevationLegendEntries } from "@/components/map/elevation-bands";
import { exportBasinAtlasPdf } from "@/lib/basins/export-pdf";
import {
  buildAtlasShareUrl,
  encodeLayersParam,
  layerKey,
  parseLayersParam,
} from "@/lib/basins/atlas-url-state";
import {
  ACC_KIND_LABEL,
  ACC_VERDICT_LABEL,
  DEP_STATUS_LABEL,
  DEP_THEME_ORDER,
  depThemeTitle,
  prsMapColor,
  withEpochAccents,
} from "@/lib/basins/panel-labels";
import type {
  BasinFloor,
  BasinInventory,
  BasinLayer,
  BasinManifest,
} from "@/lib/basins";
import { tryGetBasinManifest } from "@/lib/basins";
import {
  parseReviewedMprSeries,
  reviewedMprConceptLabel,
  reviewedMprValueLabel,
  type ReviewedMprRecord,
  type ReviewedMprSeries,
} from "@/lib/basins/reviewed-mpr";
import "leaflet/dist/leaflet.css";

// Station-readings panel (contract v1): loaded on demand so recharts only
// ships when a readings-enabled station is actually clicked.
const StationReadingsPanel = dynamic(
  () => import("@/components/basin/station-readings-panel").then((m) => m.StationReadingsPanel),
  { ssr: false, loading: () => <p className="text-xs text-slate-400">Loading readings…</p> },
);

interface Props {
  cityId: string;
  cityDisplayName: string;
  manifest: BasinManifest;
  inventory: BasinInventory | null;
  /** Pre-select a river (e.g. when opened by clicking it on the rivers map). */
  initialRiverId?: string | null;
  /** Pre-focus a floor (e.g. open straight onto the gaps / governance view). */
  initialFloor?: BasinFloor;
  /** Embedded as an overlay (over the rivers page): skip URL syncing and show
   *  a back button instead of relying on the address bar. */
  embedded?: boolean;
  /** Back affordance when embedded. */
  onClose?: () => void;
  /** Basin-stack navigation (hierarchy): swap to another basin in place -
   *  used for the "Part of <parent> ↑" affordance when parentBasinId is set. */
  onNavigateBasin?: (basinId: string) => void;
  /** Optional: render a custom detail panel for a clicked feature (e.g. a
   *  city's rich CPCB quality panel for a monitoring station). Return null to
   *  fall back to the generic key/value FeaturePanel. Keeps the atlas decoupled
   *  from any city-specific panel component. */
  renderFeatureDetail?: (args: {
    family: string;
    props: Record<string, unknown>;
    onClose: () => void;
  }) => ReactNode | null;
}

// The elevator floors, top (surface) to bottom (causes + accountability).
const FLOORS: { id: BasinFloor; label: string; sub: string }[] = [
  { id: "hydrology", label: "River system", sub: "Rivers, catchments, tanks" },
  { id: "monitoring", label: "State & evidence", sub: "Readings, lab evidence" },
  { id: "pressures", label: "Pressures", sub: "Industry, quarries, waste" },
  { id: "governance", label: "Governance & response", sub: "Treatment, boundaries, gaps" },
];

// gaps.json shape (cross-source treatment-gap intelligence per admin unit).
export interface GapSource { source: string; says: string; citation: string; url?: string }
type GapMedium = "liquid" | "solid";
type GapSector = "public" | "industry" | "institutional" | "construction";
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

// Sector axis: one palette, used by the composition bar, the stream swatches
// and the legend so they can never disagree.
// color = base fill; dark = the stripe colour for district-wide figures (a
// darker shade of the same hue, so white labels stay legible over the stripes).
const SECTOR_META: Record<GapSector, { label: string; color: string; dark: string }> = {
  public: { label: "Public / municipal", color: "#2563eb", dark: "#1e40af" },
  industry: { label: "Industry", color: "#dc2626", dark: "#991b1b" },
  institutional: { label: "Institutional", color: "#7c3aed", dark: "#5b21b6" },
  construction: { label: "Construction", color: "#d97706", dark: "#9a3412" },
};
const SECTOR_ORDER: GapSector[] = ["public", "industry", "institutional", "construction"];
const MEDIUM_LABEL: Record<GapMedium, string> = { liquid: "Liquid waste", solid: "Solid waste" };

// Outer rings of a (Multi)Polygon, so each gap part can be badged separately.
function polygonOuterRings(geom: Feature["geometry"] | null | undefined): [number, number][][] {
  if (!geom) return [];
  if (geom.type === "Polygon") return [geom.coordinates[0] as [number, number][]];
  if (geom.type === "MultiPolygon") return geom.coordinates.map((poly) => poly[0] as [number, number][]);
  return [];
}
// Min bbox area (deg²) for a detached gap part to earn its own badge: includes
// the ~0.36 km² Harohalli/Kaggalahalli exclave, excludes hair-thin slivers.
const GAP_BADGE_MIN_AREA = 1.2e-5;
export interface GapUnit { name: string; level?: string; coverage?: string; conflicts?: string[]; caveats?: string[]; headline: string; streams: GapStream[] }

// ── DEP Snapshot v2 (gaps.json `version: 2`; district-first) ─────────────────
// One tab per district whose DEP covers part of the basin (Paani review,
// 28 Jul 2026): DEPs are district documents, so the panel now leads with the
// district, taluks nest below it, ULBs below that, and the content is re-cut
// to the 7 NGT thematic areas (OA 360/2018). v1 basins (plain `units`) keep
// the old single-unit GapPanel untouched.
/** How to find a region on the map (shared by accountability + DEP panels). */
type MapMatch = { family: string; prop?: string; values?: string[]; contains?: string[]; kinds?: string[] };
type DepThemeStatus = "covered" | "district-level" | "not-covered";
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

const COACH_KEY = "basin-atlas-coach-dismissed";

type FC = FeatureCollection;

/** Draw order on the shared canvas (lower = drawn first = underneath). Base
 *  outlines and sub-catchments sit below thematic fills, lines, and points so
 *  the layers on top receive hover/click, not the catchment beneath them. */
function drawRank(l: BasinLayer): number {
  if (l.elevation) return -2; // terrain underneath everything, even the gap choropleth
  if (l.gap) return -1; // gap choropleth at the very bottom - all data (incl. STPs) sits above it
  if (l.prs) return 5; // polluted stretch always on top so the thin line stays clickable
  // Below the basin boundary, always: as an ordinary fill it painted the
  // out-of-state shade OVER the boundary line, and the shared edge read as a
  // separate polygon abutting the basin (Madhuri, 31 Aug).
  if (l.family === "context-boundary") return -0.5;
  if (l.family === "boundary" || l.family.startsWith("admin")) return 0;
  if (l.family === "sub-hydrosheds") return 1;
  if (l.geom === "fill") return 2;
  if (l.geom === "line") return 3;
  return 4; // point
}

async function fetchJson(url: string): Promise<FC | null> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as FC) : null;
  } catch {
    return null;
  }
}

/** Keep the map framed: the whole basin by default, the selected river's
 *  sub-catchments when one is chosen. */
function MapController({
  fitBounds,
  defaultFocus,
  hasSelection,
}: {
  fitBounds: L.LatLngBounds | null;
  defaultFocus?: { center: [number, number]; zoom: number };
  hasSelection: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (fitBounds && fitBounds.isValid()) {
      // A river is selected: fit its full extent (zooming out if the river spans
      // more than the default view, e.g. the basin-long Arkavathi).
      map.fitBounds(fitBounds, { padding: [8, 8], maxZoom: 14 });
    } else if (defaultFocus && !hasSelection) {
      // Nothing selected and the manifest pins a focus view - honour it instead
      // of the (too-wide) whole-basin boundary fit. Suppressed while a river is
      // selected so the focus view never pre-empts that river's fit (e.g. before
      // its sub-catchments finish loading).
      map.setView(defaultFocus.center, defaultFocus.zoom);
    }
  }, [fitBounds, defaultFocus, hasSelection, map]);
  return null;
}

/** Fly to a freshly highlighted region ("Show X on the map"). Keyed on the
 *  bbox so other layers streaming in (which recompute the bounds object but
 *  not its extent) don't re-trigger the flight. */
function HighlightFlyer({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  const lastRef = useRef<string>("");
  useEffect(() => {
    // Highlight cleared (Reset): forget the last flight so re-highlighting
    // the same region flies again.
    if (!bounds) { lastRef.current = ""; return; }
    const key = bounds.toBBoxString();
    if (key === lastRef.current) return;
    lastRef.current = key;
    map.flyToBounds(bounds, { padding: [30, 30], maxZoom: 13, duration: 0.8 });
  }, [bounds, map]);
  return null;
}

/** Fly to the visitor's location when it is (re)acquired. If they're inside the
 *  mapped basin we zoom in close so nearby stretches / industrial areas read;
 *  if they're outside it we frame both their pin and the basin so the distance
 *  is honest rather than dropping them into empty tiles. */
function LocateFlyer({
  location,
  basinBounds,
}: {
  location: { lat: number; lng: number } | null;
  basinBounds: L.LatLngBounds | null;
}) {
  const map = useMap();
  const lastRef = useRef<string>("");
  useEffect(() => {
    if (!location) return;
    const key = `${location.lat.toFixed(5)},${location.lng.toFixed(5)}`;
    if (key === lastRef.current) return;
    lastRef.current = key;
    const here = L.latLng(location.lat, location.lng);
    const inside = basinBounds?.contains(here) ?? true;
    if (inside) {
      map.flyTo(here, Math.max(map.getZoom(), 14), { duration: 0.8 });
    } else if (basinBounds) {
      map.flyToBounds(L.latLngBounds([here]).extend(basinBounds), {
        padding: [40, 40],
        duration: 0.8,
      });
    } else {
      map.flyTo(here, 13, { duration: 0.8 });
    }
  }, [location, basinBounds, map]);
  return null;
}

export function BasinAtlas({ cityDisplayName, manifest, inventory, initialRiverId = null, initialFloor, embedded = false, onClose, onNavigateBasin, renderFeatureDetail }: Props) {
  const tiles = useMapTiles();

  const [focusedFloor, setFocusedFloor] = useState<BasinFloor>(initialFloor ?? "hydrology");
  // Initial toggle state: a calm landing, not everything at once. Start with
  // only the entry floor's default-on layers + always-on context + the PRS
  // spine on. Rendering is then checkbox-only, so the user can freely combine
  // layers from other floors (e.g. PRS + treatment gaps) by toggling them on.
  // Kept as a memo (not just the useState initialiser) because the URL sync
  // compares against it: ?layers= is written only once the set is customised.
  const defaultEnabled = useMemo(() => {
    const startFloor = initialFloor ?? "hydrology";
    return Object.fromEntries(
      manifest.layers.map((l) => [
        layerKey(l),
        l.defaultOn && (l.context || l.prs || l.floor === startFloor),
      ]),
    );
  }, [manifest.layers, initialFloor]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(defaultEnabled);
  // Which floors' toggle lists are expanded in the rail. Only the entry floor
  // opens by default (a calm landing); others collapse with a chevron so it's
  // clear they open. Collapsing only hides the list - layers stay rendered.
  const [expandedFloors, setExpandedFloors] = useState<Set<BasinFloor>>(
    () => new Set<BasinFloor>([initialFloor ?? "hydrology"]),
  );
  const [selectedRiverId, setSelectedRiverId] = useState<string | null>(initialRiverId);
  // Region highlighted from the accountability matrix ("Show X on the map").
  const [mapHighlight, setMapHighlight] = useState<MapHighlight | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<{ family: string; props: Record<string, unknown> } | null>(null);
  const [selectedGapUnit, setSelectedGapUnit] = useState<string | null>(null);
  const [gapData, setGapData] = useState<Record<string, GapUnit>>({});
  const [gapNote, setGapNote] = useState<string | null>(null);
  // District-first DEP snapshot (gaps.json version 2); null for v1 basins.
  const [depData, setDepData] = useState<DepData | null>(null);
  // PRS entry-point panel: open when the polluted-stretch line is clicked.
  const [selectedPrs, setSelectedPrs] = useState(false);
  const [prsData, setPrsData] = useState<PrsData | null>(null);
  const [accData, setAccData] = useState<AccountabilityData | null>(null);
  const [reviewedMpr, setReviewedMpr] = useState<ReviewedMprSeries | null>(null);
  // True when a gap unit was opened FROM the PRS panel, so the gap panel can
  // offer a "back to PRS" affordance.
  const [gapFromPrs, setGapFromPrs] = useState(false);
  // Reveal the 2020 stretch alongside 2025 to show how the polluted reach grew.
  const [showGrowth, setShowGrowth] = useState(false);
  const [data, setData] = useState<Record<string, FC | null>>({});
  const [coachDismissed, setCoachDismissed] = useState(true);
  // Either panel can be collapsed to see the map alone. On phones the map is
  // the calm resting state, so the layers panel starts closed (tap "Layers" to
  // open it as a bottom sheet); on desktop the sidebar starts open. The atlas
  // is client-only (ssr:false) so `window` is available here.
  const [railOpen, setRailOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 768,
  );
  // On phones the layers panel and a detail panel are both bottom sheets, so
  // opening a detail selection closes the layers sheet - they never stack.
  const hasSelection = selectedRiverId != null || selectedFeature != null || selectedGapUnit != null || selectedPrs;
  useEffect(() => {
    if (hasSelection && typeof window !== "undefined" && window.innerWidth < 768) {
      setRailOpen(false);
    }
  }, [hasSelection]);
  const fetchedRef = useRef<Set<string>>(new Set());
  const didDefaultGapRef = useRef(false);

  const layerByFamily = useMemo(
    () => Object.fromEntries(manifest.layers.map((l) => [l.family, l])),
    [manifest.layers],
  );
  // "Show X on the map": switch on the matched family's layers and highlight
  // the region. Shared by the accountability matrix and the DEP panel. Toggle
  // keys are layerKey(l) (family:kindFilter for split families), so enabling
  // the bare family name would miss kind-filtered entries (e.g.
  // pressures-industrial). Which kinds to switch on: mapMatch.kinds, else a
  // kind-valued property match, else every entry of the family.
  const showOnMap = useCallback((m: MapMatch) => {
    const kinds = m.kinds ?? (m.prop === "kind" ? m.values : undefined);
    setEnabled((s) => {
      const next = { ...s };
      for (const l of manifest.layers) {
        if (l.family !== m.family) continue;
        if (l.kindFilter && kinds && !kinds.includes(l.kindFilter)) continue;
        next[layerKey(l)] = true;
      }
      return next;
    });
    setMapHighlight(m);
  }, [manifest.layers]);
  const shedToRiver = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of manifest.rivers) for (const s of r.subHydroshedIds) m.set(s, r.riverId);
    return m;
  }, [manifest.rivers]);
  const selectedRiver = useMemo(
    () => manifest.rivers.find((r) => r.riverId === selectedRiverId) ?? null,
    [manifest.rivers, selectedRiverId],
  );
  const selectedSheds = useMemo(
    () => new Set(selectedRiver?.subHydroshedIds ?? []),
    [selectedRiver],
  );

  // Touch devices need bigger hit targets. The atlas renders client-only
  // (ssr:false), so window is always available here.
  const coarsePointer =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  // "Where am I?" - drop a pin at the visitor's own location so they can read
  // the polluted stretches / industrial areas nearest them. Generic to any
  // basin (uses the loaded footprint to tell inside-basin from outside).
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState<{ tone: "info" | "warn" | "error"; text: string } | null>(null);

  // Extent of everything currently drawn = a good-enough footprint of the basin
  // for an inside/outside check (recomputed as layers stream in).
  const basinBounds = useMemo(() => {
    const feats = Object.values(data).flatMap((fc) => fc?.features ?? []);
    if (!feats.length) return null;
    const b = L.geoJSON({ type: "FeatureCollection", features: feats } as FC).getBounds();
    return b.isValid() ? b : null;
  }, [data]);

  function locateMe() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocateMsg({ tone: "error", text: "Location isn't available in this browser." });
      return;
    }
    setLocating(true);
    setLocateMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        setLocating(false);
        const here = L.latLng(latitude, longitude);
        if (basinBounds && !basinBounds.contains(here)) {
          setLocateMsg({ tone: "warn", text: `You're outside the mapped basin. Showing your location and the basin together.` });
        } else {
          setLocateMsg({ tone: "info", text: "You are here. Zoom in to see the stretches and areas nearest you." });
        }
      },
      (err) => {
        setLocating(false);
        setLocateMsg({
          tone: "error",
          text:
            err.code === err.PERMISSION_DENIED
              ? "Location is blocked. Click the lock / location icon in your browser's address bar, set Location to Allow, then try again."
              : err.code === err.POSITION_UNAVAILABLE
                ? "Your location is unavailable. Check that location services are on for your browser (macOS: System Settings > Privacy & Security > Location Services)."
                : "Couldn't get your location in time. Please try again.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  // URL <-> state (?river= & ?level=), via replaceState (no full navigation).
  // Skipped when embedded as an overlay so we don't clobber the rivers-page URL.
  // Cross-source gap intelligence for the gap layer's click panel (optional).
  useEffect(() => {
    fetchJson(`/data/basins/${manifest.basinId}/gaps.json`)
      .then((d) => {
        const v2 = d as unknown as DepData;
        if (v2?.version === 2 && Array.isArray(v2.districts)) {
          setDepData(v2);
          // v2 keeps no flat GapUnit map - the DepPanel resolves badge / PRS
          // keys against its districts' ULBs and taluks directly.
          setGapData({});
          setGapNote(v2.note ?? null);
          return;
        }
        const parsed = d as unknown as { units?: Record<string, GapUnit>; note?: string };
        setGapData(parsed?.units ?? {});
        setGapNote(parsed?.note ?? null);
      })
      .catch(() => setGapData({}));
  }, [manifest.basinId]);

  // PRS panel content (optional; only basins with a prs layer ship prs.json).
  useEffect(() => {
    if (!manifest.layers.some((l) => l.prs)) return;
    fetchJson(`/data/basins/${manifest.basinId}/prs.json`)
      .then((d) => setPrsData((d as unknown as PrsData) ?? null))
      .catch(() => setPrsData(null));
    // Accountability matrix rides with the PRS story; absent file = section
    // simply not rendered (data-only onboarding for other basins).
    fetchJson(`/data/basins/${manifest.basinId}/accountability.json`)
      .then((d) => setAccData((d as unknown as AccountabilityData) ?? null))
      .catch(() => setAccData(null));
    fetchJson(`/data/basins/${manifest.basinId}/mpr-reviewed.json`)
      .then((d) => setReviewedMpr(parseReviewedMprSeries(d)))
      .catch(() => setReviewedMpr(null));
  }, [manifest.basinId, manifest.layers]);

  // On phones the layers panel is an off-canvas drawer; start it closed so the
  // map is full-screen, with the "Layers" tab to open it. Desktop keeps the
  // in-flow sidebar open.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setRailOpen(false);
  }, []);

  // When opened straight to the governance floor (the "Treatment & waste gaps"
  // button), auto-select the manifest's default gap unit once the data loads,
  // so the right-hand detail panel is populated and discoverable rather than
  // blank. Fires once per mount; the user can close/switch freely afterwards.
  useEffect(() => {
    if (didDefaultGapRef.current) return;
    if (initialFloor !== "governance") return;
    const unit = manifest.defaultGapUnit;
    const inDep = !!depData?.districts.some(
      (dd) => dd.taluks.some((t) => t.key === unit) || dd.ulbs.some((u) => u.key === unit),
    );
    if (unit && (gapData[unit] || inDep)) {
      setSelectedGapUnit(unit);
      setSelectedFeature(null);
      didDefaultGapRef.current = true;
    }
  }, [gapData, depData, initialFloor, manifest.defaultGapUnit]);

  // What the gap layer highlights. The selection key alone can't decide this:
  // it says which unit the panel is focused on, not whether that unit has a
  // polygon, and "bbmp" is deliberately both a ULB key and a taluk key. So the
  // DepPanel - the only thing that knows what it is actually showing - reports
  // the polygon to light up, and null for every view that has no polygon
  // (district-wide, governance, and ULBs whose own boundary isn't a gap unit).
  // v1 basins have no DepPanel; there the selection is always a polygon key.
  const [depHighlight, setDepHighlight] = useState<string | null>(null);
  const mapGapUnit = useMemo(() => {
    if (!selectedGapUnit) return null;
    return depData ? depHighlight : selectedGapUnit;
  }, [selectedGapUnit, depData, depHighlight]);

  // ?layers= / ?growth= restore in EVERY context, embedded included - the PDF
  // export links back to the embed page with these params, and the embed's
  // server component only forwards ?river/?floor as props. Applied once per
  // mount: basin-stack navigation swaps the manifest without remounting, and
  // another basin's layer keys must not be re-parsed against this one.
  const appliedUrlLayersRef = useRef(false);
  useEffect(() => {
    setCoachDismissed(localStorage.getItem(COACH_KEY) === "1");
    const p = new URLSearchParams(window.location.search);
    if (!appliedUrlLayersRef.current) {
      appliedUrlLayersRef.current = true;
      const fromUrl = parseLayersParam(p.get("layers"), manifest.layers);
      if (fromUrl) setEnabled(fromUrl);
      if (p.get("growth") === "1") setShowGrowth(true);
    }
    if (embedded) return;
    const r = p.get("river");
    const lvl = p.get("level") as BasinFloor | null;
    if (r && manifest.rivers.some((x) => x.riverId === r)) setSelectedRiverId(r);
    if (lvl && FLOORS.some((f) => f.id === lvl)) setFocusedFloor(lvl);
  }, [manifest.rivers, manifest.layers, embedded]);

  // The full toggle map with the defaultOn fallback applied for layers added
  // after `enabled` was initialised - what the URL and the PDF export read.
  const effectiveEnabled = useMemo(
    () =>
      Object.fromEntries(
        manifest.layers.map((l) => [layerKey(l), enabled[layerKey(l)] ?? l.defaultOn]),
      ),
    [manifest.layers, enabled],
  );

  useEffect(() => {
    if (embedded) return;
    const p = new URLSearchParams(window.location.search);
    if (selectedRiverId) p.set("river", selectedRiverId);
    else p.delete("river");
    p.set("level", focusedFloor);
    const layersParam = encodeLayersParam(effectiveEnabled, defaultEnabled);
    if (layersParam !== null) p.set("layers", layersParam);
    else p.delete("layers");
    if (showGrowth) p.set("growth", "1");
    else p.delete("growth");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [selectedRiverId, focusedFloor, effectiveEnabled, defaultEnabled, showGrowth, embedded]);

  // A layer is visible iff its checkbox is on (and, for non-context layers,
  // its floor is focused). The checkbox is the single source of truth - zoom
  // never hides a checked layer. This also gates fetching.
  function shouldRender(l: BasinLayer): boolean {
    // The checkbox is the single source of truth: a layer renders iff its
    // toggle is on, regardless of which floor is focused. This lets layers from
    // different floors be combined (e.g. the polluted stretch + treatment gaps).
    // Fall back to defaultOn if the toggle key is missing (a layer added after
    // this state was initialised), so a default-on layer is never silently hidden.
    // Exception (Paani Phase-1 review): the polluted stretch is not a resting
    // layer - it renders while the PRS panel is open ("Explore the polluted
    // stretch"), on top of whatever the checkbox says, and hides again when
    // the panel closes unless the user has checked it explicitly.
    if (l.prs && selectedPrs) return true;
    return enabled[layerKey(l)] ?? l.defaultOn;
  }

  // The data key a layer reads from: heavy + river selected -> per-shed merge.
  function dataKey(l: BasinLayer): string {
    if (l.heavy && selectedRiverId) return `${l.family}__${selectedRiverId}`;
    return l.family;
  }

  // Load whatever the currently-rendered layers need.
  useEffect(() => {
    for (const l of manifest.layers) {
      if (!shouldRender(l)) continue;
      const key = dataKey(l);
      if (fetchedRef.current.has(key)) continue;
      fetchedRef.current.add(key);

      if (l.heavy && selectedRiverId) {
        const sheds = selectedRiver?.subHydroshedIds ?? [];
        Promise.all(
          sheds.map((s) => fetchJson(`/data/basins/${manifest.basinId}/${l.family}/${s}.geojson`)),
        ).then((parts) => {
          const features = parts.filter(Boolean).flatMap((fc) => fc!.features);
          setData((d) => ({ ...d, [key]: { type: "FeatureCollection", features } }));
        });
      } else {
        fetchJson(`/data/basins/${manifest.basinId}/${l.family}.geojson`).then((fc) =>
          setData((d) => ({ ...d, [key]: fc })),
        );
      }
    }
    // selectedPrs is a dep because Explore-the-stretch can be the first thing
    // that makes the (default-off) PRS layer renderable - see shouldRender.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, focusedFloor, selectedRiverId, selectedPrs]);

  // What the map frames: the selected river's sub-catchments, or the whole
  // basin boundary when nothing is selected (the default). Depends only on the
  // boundary/shed/context data (stable references once loaded) and the
  // selection - NOT the whole `data` object - so changing floors never
  // refits/resets the zoom.
  const shedData = data["sub-hydrosheds"];
  const boundaryData = data["boundary"];
  const contextData = data["context-boundary"];
  const fitBounds = useMemo(() => {
    let feats: Feature[];
    if (selectedRiverId && shedData) {
      // A river is selected: frame its sub-catchments.
      feats = shedData.features.filter((f) => selectedSheds.has(String((f.properties as Record<string, unknown>)?.shedId)));
    } else if (manifest.defaultFocus) {
      // Nothing selected and a focus view is configured: defer to it (the
      // MapController applies center/zoom) instead of the wide boundary fit.
      return null;
    } else {
      // A basin whose story crosses its working boundary ships a wider
      // context outline; frame to that, or the reach it exists to show gets
      // cropped at the line it is meant to cross.
      const context = contextData?.features ?? [];
      feats = context.length ? context : boundaryData?.features ?? [];
    }
    if (!feats.length) return null;
    const b = L.geoJSON({ type: "FeatureCollection", features: feats } as FC).getBounds();
    return b.isValid() ? b : null;
  }, [selectedRiverId, shedData, boundaryData, contextData, selectedSheds, manifest.defaultFocus]);

  // Frame the region highlighted from the accountability matrix ("Show X on
  // the map") once its layer data is in. Matching mirrors the highlight style.
  const highlightBounds = useMemo(() => {
    if (!mapHighlight) return null;
    const feats = (data[mapHighlight.family]?.features ?? []).filter((f) =>
      matchesHighlight(mapHighlight, { family: mapHighlight.family } as BasinLayer, f),
    );
    if (!feats.length) return null;
    const b = L.geoJSON({ type: "FeatureCollection", features: feats } as FC).getBounds();
    return b.isValid() ? b : null;
  }, [mapHighlight, data]);

  function selectRiver(riverId: string | null) {
    setSelectedRiverId(riverId);
    setSelectedFeature(null);
    setSelectedGapUnit(null);
    setSelectedPrs(false);
  }

  // Restrict a feature collection to the selected river's sheds. Context layers
  // and gap layers are exempt - gaps sit at admin level (no shed id), so a river
  // selection must not filter them out.
  function scoped(fc: FC | null, layer: BasinLayer): Feature[] {
    if (!fc) return [];
    // No scoping when: nothing selected, context/gap layers, or the selected
    // river has no sub-shed of its own (e.g. an artificial canal that cuts
    // across catchments) - in that case show the full layer rather than hiding
    // everything.
    // PRS is exempt too: the polluted stretch spans the whole river (no shedId),
    // so a river selection must not filter it out. Elevation bands likewise -
    // terrain is whole-basin context with no shedId on its features.
    if (!selectedRiverId || layer.context || layer.gap || layer.prs || layer.elevation || selectedSheds.size === 0)
      return fc.features;
    return fc.features.filter((f) =>
      selectedSheds.has(String((f.properties as Record<string, unknown>)?.shedId)),
    );
  }

  // No floor-based dimming: every enabled layer draws at full strength so
  // cross-floor combinations read equally (the rail still groups by floor).
  const dim = () => false;

  // Per-floor feature counts for the rail (from inventory).
  const floorCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of FLOORS) {
      out[f.id] = manifest.layers
        .filter((l) => l.floor === f.id && !l.context)
        .reduce((n, l) => n + (inventory?.families[l.family]?.featureCount ?? 0), 0);
    }
    return out;
  }, [manifest.layers, inventory]);

  const floorLayers = (floor: BasinFloor) => manifest.layers.filter((l) => l.floor === floor);

  // Draw order (single shared canvas): base outlines + sub-catchments at the
  // bottom, then fills, lines, points on top. Stable-sorted so manifest order
  // is preserved within a rank.
  const orderedLayers = useMemo(
    () => [...manifest.layers].sort((a, b) => drawRank(a) - drawRank(b)),
    [manifest.layers],
  );

  const visibleLayers = orderedLayers.filter(shouldRender);

  // Terrain vs choropleth: hypsometric fills under a gap choropleth muddy its
  // severity reading (the one fill layer that spans whole admin units), so the
  // bands drop to a whisper while any gap layer is visible. Other fills
  // (tanks, industrial areas) are compact features that stay legible on top.
  const elevationDimmed = visibleLayers.some((l) => l.gap);
  const elevationLegend = useMemo(
    () => elevationLegendEntries(data["elevation-bands"] ?? null),
    [data],
  );
  // The basin has a PRS story when a prs layer is declared and its panel
  // content has loaded - this gates the "Explore the polluted stretch" entry
  // point, which must be offered even while the stretch itself is hidden
  // (the layer is default-off per Paani's Phase-1 review).
  // Every station in the basin that has a readings pack, for the panel's
  // compare-with picker. Family travels with each one so the picker can offer
  // only stations that share a series worth drawing side by side.
  const readingsPeers = useMemo(() => {
    const seen = new Set<string>();
    const out: { stationKey: string; name: string; family: string; agency?: string }[] = [];
    for (const l of manifest.layers) {
      if (!l.readings) continue;
      for (const f of data[l.family]?.features ?? []) {
        const p = (f.properties ?? {}) as Record<string, unknown>;
        const key = p.stationKey == null ? "" : String(p.stationKey);
        if (!p.hasReadings || !key || seen.has(key)) continue;
        seen.add(key);
        out.push({
          stationKey: key,
          name: String(p.name ?? key),
          family: l.family,
          agency: p.agency == null ? undefined : String(p.agency),
        });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [manifest.layers, data]);

  const hasPrsStory = manifest.layers.some((l) => l.prs) && prsData !== null;
  // The survey editions actually drawn on the map, oldest first. A basin can
  // ship fewer of these than its panel reports - an edition whose geometry is
  // missing or too partial to draw is told in the panel, not sketched here.
  const prsEpochsOnMap = useMemo(() => {
    const byYear = new Map<number, string>();
    for (const f of data["prs"]?.features ?? []) {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const year = Number(p.year);
      if (Number.isFinite(year)) byYear.set(year, String(p.priority ?? ""));
    }
    return [...byYear.entries()]
      .map(([year, priority]) => ({ year, priority }))
      .sort((a, b) => a.year - b.year);
  }, [data]);
  const prsYearsOnMap = useMemo(() => prsEpochsOnMap.map((e) => e.year), [prsEpochsOnMap]);
  // The stretch is on the map (so it needs a legend); the growth toggle needs
  // more than one edition drawn to compare.
  const prsVisible = manifest.layers.some((l) => l.prs && shouldRender(l)) && prsEpochsOnMap.length > 0;
  const prsGrowthAvailable = prsVisible && prsEpochsOnMap.length > 1;
  // Legend rows for the stretch, matching the map's colours and draw order.
  const prsLegend = useMemo(() => {
    if (!prsEpochsOnMap.length) return [];
    const newest = prsEpochsOnMap.length - 1;
    const label = (e: { year: number; priority: string }, i: number) => {
      const band = e.priority ? ` (Priority ${e.priority})` : "";
      if (!showGrowth || prsEpochsOnMap.length === 1) return `polluted stretch, ${e.year}${band}`;
      return i === newest ? `added by ${e.year} → now Priority ${e.priority}` : `polluted by ${e.year}${band}`;
    };
    const rows = prsEpochsOnMap.map((e, i) => ({
      color: prsMapColor(newest - i),
      weight: showGrowth ? 4 + (newest - i) * 4 : 4,
      label: label(e, i),
    }));
    return showGrowth ? rows : rows.slice(newest);
  }, [prsEpochsOnMap, showGrowth]);

  // Derived insight (Madhuri's CAG ask): when the pressures layer is shown,
  // how many industrial areas have no CETP nearby - computed live from the data.
  const legendNotes = useMemo(() => {
    const out: string[] = [];
    if (visibleLayers.some((l) => l.family === "pressures-industrial" && l.kindFilter !== "major-industry")) {
      const ind = (data["pressures-industrial"]?.features ?? []).filter(
        (f) => (f.properties as Record<string, unknown>)?.kind === "industrial-area",
      );
      const none = ind.filter((f) => (f.properties as Record<string, unknown>)?.cetp === "none").length;
      if (ind.length) out.push(`≈${none} of ${ind.length} industrial areas have no CETP within ~5 km - CAG-flagged gap, spatial estimate (8 of 18 KIADB areas)`);
    }
    return out;
  }, [visibleLayers, data]);

  // ── One-click PDF export: capture the map as-is, then re-render the PRS
  // story and the treatment-gap snapshot as text pages (see export-pdf.tsx).
  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  async function downloadPdf() {
    const mapEl = mapWrapRef.current?.querySelector<HTMLElement>(".leaflet-container");
    if (!mapEl) {
      setPdfError("The map hasn't finished loading yet - try again in a moment.");
      return;
    }
    setPdfBusy(true);
    setPdfError(null);
    try {
      // The PDF legend = the on-map legend + the PRS-year entries (which the
      // map shows in their own inline box next to the growth toggle).
      const items = buildLegendItems(visibleLayers, elevationLegend);
      for (const row of prsLegend) {
        items.push({ sym: "line", color: row.color, label: row.label.replace(/^./, (c) => c.toUpperCase()) });
      }
      // Share URL: the ON set spelled out explicitly (not the defaults-elided
      // form the address bar uses), so the embed page restores this exact view
      // whatever its own entry-floor defaults are.
      const layersParam = manifest.layers
        .map(layerKey)
        .filter((k) => effectiveEnabled[k])
        .join(",");
      // State-faithful contract: the data table lists only what is on the
      // exported map (rail counts), and the PRS pages ship only when the
      // stretch is actually rendered (toggled on, or its panel open) - the
      // same rule the gap pages follow.
      const inventoryRows = visibleLayers.flatMap((l) => {
        const inv = inventory?.families[l.family];
        if (!inv) return [];
        const count =
          (l.kindFilter && inv.sources.find((sc) => sc.kind === l.kindFilter)?.count) ||
          inv.featureCount;
        return [{ label: l.label, count }];
      });
      const prsOnMap = visibleLayers.some((l) => l.prs);
      await exportBasinAtlasPdf({
        mapEl,
        manifest,
        inventoryRows,
        scopeLabel: selectedRiver ? `${selectedRiver.displayName} (river-scoped)` : "Whole basin",
        legendItems: items,
        legendNotes,
        selectedRiver,
        prs: prsOnMap ? prsData : null,
        acc: prsOnMap ? accData : null,
        reviewedMpr: prsOnMap ? reviewedMpr : null,
        dep: depData,
        gapUnits: Object.values(gapData),
        gapNote,
        includeGaps: visibleLayers.some((l) => l.gap),
        shareUrl: buildAtlasShareUrl({
          origin: window.location.origin,
          basinId: manifest.basinId,
          riverId: selectedRiverId,
          floor: focusedFloor,
          layersParam: layersParam || null,
          growth: showGrowth,
        }),
      });
    } catch (err) {
      console.error("Basin atlas PDF export failed", err);
      setPdfError("Couldn't prepare the PDF. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="h-full w-full flex flex-col md:flex-row">
      {/* ── Elevator rail: off-canvas left drawer on mobile, in-flow sidebar on
           desktop. ── */}
      {railOpen && (
        <button
          aria-label="Close layers"
          onClick={() => setRailOpen(false)}
          className="md:hidden fixed inset-0 z-[1190] bg-black/40"
        />
      )}
      {railOpen && (
      <div className="bg-white dark:bg-slate-900 overflow-y-auto overscroll-contain fixed inset-x-0 bottom-0 z-[1200] max-h-[72vh] rounded-t-2xl shadow-2xl md:static md:inset-auto md:max-h-none md:rounded-none md:z-auto md:w-60 md:shadow-none md:shrink-0 md:border-r border-slate-200 dark:border-slate-700">
        {/* Grab handle - mobile bottom-sheet affordance; tap to close. */}
        <button
          aria-label="Close layers panel"
          onClick={() => setRailOpen(false)}
          className="md:hidden sticky top-0 z-10 w-full flex items-center justify-center py-2.5 bg-white/95 dark:bg-slate-900/95"
        >
          <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        </button>
        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">{cityDisplayName}</div>
          <div className="flex items-start justify-between gap-2">
            <h1 className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{manifest.displayName}</h1>
            <button
              onClick={() => setRailOpen(false)}
              title="Hide layers panel"
              className="block shrink-0 -mt-0.5 p-1 text-lg leading-none text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <span className="md:hidden">✕</span>
              <span className="hidden md:inline">«</span>
            </button>
          </div>
          {manifest.displayNameLocal && (
            <div className="text-xs text-slate-500 dark:text-slate-400">{manifest.displayNameLocal}</div>
          )}
          {/* Hierarchy up-link: this basin is a sub-basin of a larger one. */}
          {manifest.parentBasinId && onNavigateBasin && (() => {
            const parent = tryGetBasinManifest(manifest.parentBasinId!);
            return parent ? (
              <button
                onClick={() => onNavigateBasin(parent.basinId)}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span aria-hidden>↑</span> Part of the {parent.displayName}
              </button>
            ) : null;
          })()}
          {/* Basin intro - desktop rail only, collapsed by default to save space. */}
          <details className="hidden md:block group mt-2">
            <summary className="cursor-pointer list-none flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <span aria-hidden className="text-slate-400 group-open:rotate-90 transition-transform">▸</span>
              About this basin
            </summary>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{manifest.blurb}</p>
            {manifest.areaKm2 && (
              <p className="mt-1 text-[11px] text-slate-400">Basin area ~{manifest.areaKm2.toLocaleString()} km².</p>
            )}
          </details>
          {/* One-click export: the map exactly as configured + the PRS story
              + the treatment-gap snapshot as searchable text pages. */}
          <button
            onClick={downloadPdf}
            disabled={pdfBusy}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60"
          >
            <span aria-hidden>⤓</span>
            {pdfBusy ? "Preparing PDF…" : "Download as PDF"}
          </button>
          {pdfError && (
            <p role="alert" className="mt-1 text-[10px] leading-snug text-rose-600 dark:text-rose-400">{pdfError}</p>
          )}
          {selectedRiver && (
            <button
              onClick={() => selectRiver(null)}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Whole basin (clear {selectedRiver.displayName})
            </button>
          )}
        </div>

        {/* "River system" is the one grouped category; every other layer is a
            flat toggle row. The floor model stays underneath (deep links,
            default-on sets) - only the rail presentation is two-tier. */}
        <div className="block">
          {(() => {
            const f = FLOORS[0]; // hydrology = "River system"
            const open = expandedFloors.has(f.id);
            const onCount = floorLayers(f.id).filter((l) => enabled[layerKey(l)] ?? l.defaultOn).length;
            return (
              <div key={f.id}>
                <button
                  onClick={() => {
                    setFocusedFloor(f.id);
                    setExpandedFloors((s) => {
                      const next = new Set(s);
                      if (next.has(f.id)) next.delete(f.id);
                      else next.add(f.id);
                      return next;
                    });
                  }}
                  aria-expanded={open}
                  className={`w-full text-left px-3 py-2.5 border-l-4 transition-colors ${
                    open
                      ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30"
                      : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`flex items-center text-sm font-semibold ${open ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"}`}>
                      <span aria-hidden className={`mr-1 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
                      {f.label}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {onCount > 0 && (
                        <span className="text-[9px] font-medium text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 rounded px-1 py-0.5 tabular-nums">{onCount} on</span>
                      )}
                      {floorCounts[f.id] > 0 && (
                        <span className="text-[10px] tabular-nums text-slate-400">{floorCounts[f.id]}</span>
                      )}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 pl-4">{f.sub}{!open && onCount === 0 ? " · open to explore" : ""}</div>
                </button>

                {/* Collapsing only hides the list - enabled layers stay on the map. */}
                {open && (
                <div className="px-3 pb-2 pt-1 space-y-1">
                    {floorLayers(f.id).map((l) => {
                      const inv = inventory?.families[l.family];
                      return (
                        <label key={layerKey(l)} className="flex items-start gap-2 text-xs cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={enabled[layerKey(l)] ?? l.defaultOn}
                            onChange={(e) => setEnabled((s) => ({ ...s, [layerKey(l)]: e.target.checked }))}
                            className="mt-0.5 accent-blue-600"
                          />
                          <span className="flex items-center gap-1.5 leading-tight">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: l.color }} />
                            <span className="text-slate-600 dark:text-slate-300">
                              {l.label}
                              {inv && <span className="text-slate-400"> ({(l.kindFilter && inv.sources.find((sc) => sc.kind === l.kindFilter)?.count) || inv.featureCount})</span>}
                              {l.heavy && <span className="block text-[10px] text-slate-400">large layer</span>}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Everything else: flat, always-visible toggle rows. */}
          <div className="px-3 pt-2 pb-2 space-y-1 border-t border-slate-200 dark:border-slate-700">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold pb-0.5">Layers</div>
            {manifest.layers.filter((l) => l.floor !== "hydrology").map((l) => {
              const inv = inventory?.families[l.family];
              return (
                <label key={layerKey(l)} className="flex items-start gap-2 text-xs cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={enabled[layerKey(l)] ?? l.defaultOn}
                    onChange={(e) => {
                      setFocusedFloor(l.floor);
                      setEnabled((s) => ({ ...s, [layerKey(l)]: e.target.checked }));
                    }}
                    className="mt-0.5 accent-blue-600"
                  />
                  <span className="flex items-center gap-1.5 leading-tight">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: l.color }} />
                    <span className="text-slate-600 dark:text-slate-300">
                      {l.label}
                      {inv && <span className="text-slate-400"> ({(l.kindFilter && inv.sources.find((sc) => sc.kind === l.kindFilter)?.count) || inv.featureCount})</span>}
                      {l.heavy && <span className="block text-[10px] text-slate-400">large layer</span>}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Data on this map */}
        <DataOnThisMap manifest={manifest} inventory={inventory} />
      </div>
      )}

      {/* ── Map ── */}
      <div ref={mapWrapRef} className="relative flex-1 h-full min-h-[320px]">
        <MapContainer center={manifest.mapCenter} zoom={manifest.mapZoom} className="h-full w-full" preferCanvas zoomControl={false}>
          <ZoomControl position="bottomright" />
          <MapResizer />
          {/* mapHighlight counts as a selection here so Reset (which clears it)
              flies back to the overview instead of staying zoomed into the
              estate the HighlightFlyer framed. */}
          <MapController fitBounds={fitBounds} defaultFocus={manifest.defaultFocus} hasSelection={selectedRiverId != null || mapHighlight != null} />
          {/* crossOrigin so the tile <img>s load CORS-clean (OSM sends
              Access-Control-Allow-Origin:*) - required for the PDF export's
              canvas capture to read them without tainting. */}
          <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} crossOrigin="anonymous" />

          {/* One shared canvas, stacked by DRAW ORDER (not panes): base outlines
              and sub-catchments first (bottom), then thematic fills, lines, and
              points on top. Single canvas means hit-testing follows the same
              order, so a tank/point on top receives the hover, not the
              catchment beneath it. (Separate pane-canvases would each eat events
              across the whole map, blocking layers below.) */}
          {orderedLayers.map((l) => {
            if (!shouldRender(l)) return null;
            const fc = data[dataKey(l)];
            if (!fc) return null;
            let feats = scoped(fc, l);
            if (l.kindFilter) {
              feats = feats.filter((f) => (f.properties as Record<string, unknown>)?.kind === l.kindFilter);
            }
            // PRS: by default only the latest edition's stretch is shown; the
            // growth toggle reveals the earlier ones too. Sort so EARLIER
            // lines draw on top of later ones, leaving each newer band showing
            // only where the stretch extended.
            if (l.prs) {
              const maxYear = prsYearsOnMap.at(-1) ?? 0;
              feats = feats
                .filter((f) => showGrowth || Number((f.properties as Record<string, unknown>)?.year) === maxYear)
                .slice()
                .sort((a, b) => Number((b.properties as Record<string, unknown>)?.year) - Number((a.properties as Record<string, unknown>)?.year));
            }
            if (!feats.length) return null;
            const fcScoped: FC = { type: "FeatureCollection", features: feats };
            const faded = dim();

            // Elevation bands: pure background, colored by the shared FABDEM
            // palette so the atlas terrain reads the same as the city
            // flood-risk maps. Dimmed while a gap choropleth is up so the
            // severity fills keep their contrast. Rendered in its OWN pane
            // below the overlay pane (tiles 200 < 350 < overlays 400): the
            // shared canvas draws in layer-ADD order, so a layer toggled on
            // later would paint on top - a DOM-stacked pane pins terrain to
            // the bottom no matter the toggle sequence. Safe to break the
            // one-canvas rule here because the bands take no events at all;
            // the main canvas above still receives every hover/click.
            if (l.elevation) {
              return (
                <Pane key="elevation-pane" name="elevation-bands" style={{ zIndex: 350 }}>
                  <GeoJSON
                    key={`elevation-${tiles.isDark}-${elevationDimmed}`}
                    data={fcScoped}
                    interactive={false}
                    style={(feat?: Feature) => ({
                      fillColor:
                        ELEVATION_BAND_COLORS[Number((feat?.properties as Record<string, unknown>)?.order ?? 0)] ?? "#94a3b8",
                      fillOpacity: elevationDimmed ? 0.12 : 0.45,
                      stroke: false,
                    })}
                  />
                </Pane>
              );
            }

            // Gap layer: only the choropleth FILL is drawn here (at the very
            // bottom, drawRank -1, non-interactive) so it never sits over or
            // blocks the STPs/features above it. The clickable badge is rendered
            // separately, last, so it stays on top and openable.
            if (l.gap) {
              return (
                <GeoJSON
                  key={`gapfill-${selectedRiverId}-${tiles.isDark}-${mapGapUnit ?? ""}`}
                  data={fcScoped}
                  interactive={false}
                  style={(feat?: Feature) => fillStyle(l, feat, faded, mapGapUnit)}
                />
              );
            }

            if (l.family === "sub-hydrosheds") {
              // Catchments select a river only on the hydrology floor (where
              // picking a river makes sense). On other floors they are passive
              // context outlines, so they don't grab clicks from those floors.
              const shedInteractive = focusedFloor === "hydrology";
              return (
                <GeoJSON
                  key={`shed-${selectedRiverId}-${focusedFloor}-${tiles.isDark}`}
                  data={fcScoped}
                  interactive={shedInteractive}
                  style={(feat?: Feature) => shedStyle(feat, selectedSheds, faded, l.color)}
                  onEachFeature={(feat: Feature, layer: Layer) => {
                    if (!shedInteractive) return;
                    const sid = String((feat.properties as Record<string, unknown>)?.shedId ?? "");
                    const name = String((feat.properties as Record<string, unknown>)?.name ?? "sub-catchment");
                    const river = shedToRiver.get(sid);
                    const rName = manifest.rivers.find((r) => r.riverId === river)?.displayName;
                    const isSelected = !!river && river === selectedRiverId;
                    // "click for X" only invites a selection that would change the
                    // view - never on the catchment whose river is already selected.
                    const label = !river
                      ? `${name} catchment`
                      : isSelected
                        ? `${name} catchment - ${rName}`
                        : `${name} catchment - click for ${rName}`;
                    layer.bindTooltip(label, { sticky: true });
                    if (river && !isSelected) layer.on("click", () => selectRiver(river));
                  }}
                />
              );
            }

            if (l.geom === "line") {
              return (
                <GeoJSON
                  key={`${l.family}-${selectedRiverId}-${tiles.isDark}${l.prs ? `-${showGrowth}` : ""}`}
                  data={fcScoped}
                  style={(feat?: Feature) => lineStyle(l, feat, manifest, selectedRiverId, faded, l.prs && showGrowth, prsYearsOnMap)}
                  interactive={l.family === "rivers" || !!l.prs}
                  onEachFeature={(feat: Feature, layer: Layer) => {
                    if (l.prs) {
                      const pp = (feat.properties ?? {}) as Record<string, unknown>;
                      layer.bindTooltip(String(pp?.label ?? "Polluted river stretch") + " - click to see how & why", { sticky: true });
                      layer.on("click", () => { setSelectedPrs(true); setSelectedFeature(null); setSelectedGapUnit(null); });
                    } else if (l.family === "rivers") {
                      const rprops = feat.properties as Record<string, unknown>;
                      const rid = String(rprops?.riverId ?? rprops?.river_id ?? "");
                      const r = manifest.rivers.find((x) => x.riverId === rid);
                      if (r) {
                        layer.bindTooltip(r.displayName, { sticky: true });
                        layer.on("click", () => selectRiver(rid));
                      }
                    }
                  }}
                />
              );
            }

            if (l.geom === "point") {
              const treatment = l.family === "infrastructure" || l.family === "fstp";
              return (
                <GeoJSON
                  key={`${layerKey(l)}-${selectedRiverId}`}
                  data={fcScoped}
                  pointToLayer={(feat, latlng) =>
                    treatment
                      ? L.marker(latlng, { icon: treatmentIcon(l, feat), opacity: faded ? 0.4 : 1 })
                      : L.circleMarker(latlng, pointStyle(l, feat, faded))
                  }
                  onEachFeature={(feat: Feature, layer: Layer) => {
                    const p = (feat.properties ?? {}) as Record<string, unknown>;
                    layer.bindTooltip(tipLabel(p, l), { sticky: true });
                    layer.on("click", () => { setSelectedFeature({ family: l.family, props: p }); setSelectedGapUnit(null); setSelectedPrs(false); });
                  }}
                />
              );
            }

            // fill: boundary + admin are non-interactive base outlines (so they
            // never steal hover from the layers above); waterbodies / pressures
            // / command-areas are interactive thematic fills. pointToLayer keeps
            // any point geometry (e.g. waste-facility) a circle, not a default
            // marker (which would 404 its icon and render broken).
            // boundary, the full-extent context outline + always-on district
            // are non-interactive context; the opt-in admin levels
            // (taluk/town/GP) are tappable to reveal their place in the
            // hierarchy.
            const isBase = l.family === "boundary" || l.family === "admin-district" || l.family === "context-boundary";
            const isAdmin = l.family.startsWith("admin");
            // The key must encode WHICH region is highlighted, not just that
            // one is: react-leaflet only re-applies styles on remount, so a
            // boolean flag would leave the first highlight stuck when the
            // user picks a different region of the same family.
            const hlSig = mapHighlight?.family === l.family ? JSON.stringify(mapHighlight) : "";
            return (
              <GeoJSON
                key={`${layerKey(l)}-${selectedRiverId}-${tiles.isDark}-${hlSig}`}
                data={fcScoped}
                interactive={!isBase}
                style={(feat?: Feature) => fillStyle(l, feat, faded, null, mapHighlight)}
                pointToLayer={(feat, latlng) => L.circleMarker(latlng, pressurePointStyle(feat, faded))}
                onEachFeature={(feat: Feature, layer: Layer) => {
                  if (isBase) return;
                  const p = (feat.properties ?? {}) as Record<string, unknown>;
                  layer.bindTooltip(isAdmin ? adminTip(p) : tipLabel(p, l), { sticky: true });
                  layer.on("click", () => { setSelectedFeature({ family: l.family, props: p }); setSelectedGapUnit(null); setSelectedPrs(false); });
                }}
              />
            );
          })}

          {/* Gap badges, rendered LAST so they sit on top (clickable) while the
              gap choropleth fill stays at the bottom of the stack. */}
          {orderedLayers.filter((l) => l.gap && shouldRender(l)).map((l) => {
            const fc = data[dataKey(l)];
            if (!fc) return null;
            return scoped(fc, l).flatMap((f, idx) => {
              const unit = String((f.properties as Record<string, unknown>)?.gapUnit ?? "");
              const name = String((f.properties as Record<string, unknown>)?.name ?? "Treatment & waste gaps");
              const sev = String((f.properties as Record<string, unknown>)?.severity ?? "high");
              const sevColor = sev === "high" ? "#dc2626" : sev === "medium" ? "#ea580c" : "#f59e0b";
              // When a unit is selected, dim the others so the choice reads.
              const dimmed = mapGapUnit != null && mapGapUnit !== unit;
              const isSel = mapGapUnit === unit;
              // Badge each polygon PART, not just the feature as a whole, so a
              // detached fragment (e.g. Harohalli's Kaggalahalli exclave near
              // Hosuru) gets its own labelled, clickable dot instead of an
              // anonymous fill. Tiny slivers are skipped to avoid clutter; the
              // largest part is always badged so every unit keeps at least one.
              const parts = polygonOuterRings(f.geometry);
              const ranked = parts
                .map((ring) => ({ ring, b: L.latLngBounds(ring.map(([x, y]) => [y, x] as [number, number])) }))
                .map((p) => ({ ...p, area: (p.b.getEast() - p.b.getWest()) * (p.b.getNorth() - p.b.getSouth()) }))
                .sort((a, b) => b.area - a.area);
              return ranked
                .filter((p, i) => i === 0 || p.area >= GAP_BADGE_MIN_AREA)
                .map((p, pi) => (
                  <CircleMarker
                    key={`gapbadge-${unit}-${idx}-${pi}-${mapGapUnit ?? ""}`}
                    center={p.b.getCenter()}
                    radius={(coarsePointer ? 12 : 6) + (isSel ? 3 : 0)}
                    pathOptions={{
                      color: dimmed ? "#cbd5e1" : isSel ? "#7f1d1d" : "#fecaca",
                      weight: isSel ? 3 : coarsePointer ? 2 : 1,
                      fillColor: dimmed ? "#94a3b8" : sevColor,
                      fillOpacity: dimmed ? 0.35 : 0.85,
                    }}
                    eventHandlers={{ click: () => { setSelectedGapUnit(unit); setSelectedFeature(null); setSelectedPrs(false); setGapFromPrs(false); } }}
                  >
                    <Tooltip sticky>{name}{pi > 0 ? " (detached part)" : ""} - click for treatment &amp; waste gaps</Tooltip>
                  </CircleMarker>
                ));
            });
          })}

          <HighlightFlyer bounds={highlightBounds} />

          {/* Visitor's own location: an accuracy ring + a solid blue dot, drawn
              last so it sits on top of every layer. */}
          <LocateFlyer location={userLocation} basinBounds={basinBounds} />
          {userLocation && (
            <>
              {userLocation.accuracy > 0 && userLocation.accuracy < 5000 && (
                <Circle
                  center={[userLocation.lat, userLocation.lng]}
                  radius={userLocation.accuracy}
                  interactive={false}
                  pathOptions={{ color: "#2563eb", weight: 1, fillColor: "#3b82f6", fillOpacity: 0.12 }}
                />
              )}
              <CircleMarker
                center={[userLocation.lat, userLocation.lng]}
                radius={coarsePointer ? 9 : 7}
                pathOptions={{ color: "#ffffff", weight: 2.5, fillColor: "#2563eb", fillOpacity: 1 }}
              >
                <Tooltip direction="top">You are here</Tooltip>
              </CircleMarker>
            </>
          )}
        </MapContainer>

        {/* "Where am I?" control + status. Upper-left and filled blue so it
            reads as THE action on the map (Madhuri's review: bottom-right
            neutral was inconspicuous). Sits below the Back button when the
            atlas is a city-page overlay, which owns top-3 left-3. */}
        <div className={`absolute ${embedded && onClose ? "top-14" : "top-3"} left-3 z-[500] flex flex-col items-start gap-1.5 max-w-[70%]`}>
          <button
            onClick={locateMe}
            disabled={locating}
            aria-label="Show my location on the map"
            className="rounded-md shadow-lg px-3 py-1.5 text-xs font-semibold border bg-blue-600 hover:bg-blue-700 disabled:hover:bg-blue-600 text-white border-blue-700 disabled:opacity-60 flex items-center gap-1.5"
          >
            <span aria-hidden>◎</span>
            {locating ? "Locating…" : userLocation ? "Recenter on me" : "Where am I?"}
          </button>
          {locateMsg && (
            <div
              className={`rounded-md shadow px-3 py-1.5 text-[11px] leading-snug flex items-start gap-2 border ${
                locateMsg.tone === "error"
                  ? "bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800"
                  : locateMsg.tone === "warn"
                    ? "bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800"
                    : "bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              }`}
            >
              <span>{locateMsg.text}</span>
              <button
                onClick={() => { setLocateMsg(null); setUserLocation(null); }}
                aria-label="Dismiss"
                className="shrink-0 opacity-60 hover:opacity-100 font-semibold"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Back to the rivers map (only when opened as an overlay). */}
        {embedded && onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 left-3 z-[500] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-md shadow px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            ← Back to rivers
          </button>
        )}

        {/* Reset: clears ANY active selection (river scope, gap unit, clicked
            feature, or accountability-matrix highlight) so every layer shows
            basin-wide and nothing is greyed out, and flies back to the overview. */}
        {(selectedRiverId || selectedGapUnit || selectedFeature || selectedPrs || mapHighlight) && (
          <button
            onClick={() => { setSelectedGapUnit(null); setSelectedFeature(null); setSelectedPrs(false); setGapFromPrs(false); setMapHighlight(null); selectRiver(null); }}
            className="absolute top-3 right-3 z-[500] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-md shadow px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            ↺ Reset{selectedRiver ? " to whole basin" : ""}
          </button>
        )}

        {/* Coach mark */}
        {!embedded && !coachDismissed && !selectedRiverId && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] max-w-[88%] sm:max-w-md bg-slate-900/95 text-white text-xs rounded-xl px-3.5 py-2 shadow-lg flex items-center gap-3">
            <span>Click a river to explore its pollution story</span>
            <button
              onClick={() => { localStorage.setItem(COACH_KEY, "1"); setCoachDismissed(true); }}
              className="text-slate-300 hover:text-white underline"
            >
              don&apos;t show again
            </button>
          </div>
        )}

        {/* Growth toggle: reveal the 2020 stretch under the 2025 one so the
            orange->red growth of the polluted reach reads on the map. Top-right,
            below the Reset button (which only shows when something is selected). */}
        {(hasPrsStory || prsVisible) && (
          <div className={`absolute ${(selectedRiverId || selectedGapUnit || selectedFeature || selectedPrs) ? "top-14" : "top-3"} right-3 z-[500] flex flex-col items-end gap-1`}>
            {hasPrsStory && !selectedPrs && (
              <button
                onClick={() => { setSelectedPrs(true); setSelectedFeature(null); setSelectedGapUnit(null); setGapFromPrs(false); }}
                className="rounded-md shadow px-3 py-1.5 text-xs font-semibold border bg-rose-600 hover:bg-rose-700 text-white border-rose-700 flex items-center gap-1.5"
              >
                <span aria-hidden className="inline-block w-3 h-[3px] rounded bg-white/90" />
                Explore the polluted stretch →
              </button>
            )}
            {prsGrowthAvailable && (
            <button
              onClick={() => setShowGrowth((v) => !v)}
              aria-pressed={showGrowth}
              className={`rounded-md shadow px-3 py-1.5 text-xs font-medium border ${
                showGrowth
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {showGrowth ? "Hide growth" : "Show how the stretch grew"}
            </button>
            )}
            {prsVisible && (
            <div className="flex flex-col items-end gap-1 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-[10px] text-slate-600 dark:text-slate-300 shadow">
              {prsLegend.map((row) => (
                <span key={row.label} className="flex items-center gap-1.5">
                  <span className="inline-block w-4 rounded" style={{ backgroundColor: row.color, height: Math.max(2, row.weight / 2) }} />
                  {row.label}
                </span>
              ))}
            </div>
            )}
          </div>
        )}

        {/* Reopen the layers drawer/sidebar when collapsed (left-edge tab). */}
        {!railOpen && (
          <button
            onClick={() => setRailOpen(true)}
            title="Show layers panel"
            className="flex absolute left-0 top-1/2 -translate-y-1/2 z-[500] items-center bg-white/95 dark:bg-slate-900/95 border border-l-0 border-slate-200 dark:border-slate-700 rounded-r-md shadow px-1.5 py-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            » Layers
          </button>
        )}
        {/* Legend - reflects what's currently visible. Raised above the mobile
            bottom sheet when a detail panel is open so it isn't covered. */}
        <MapLegend layers={visibleLayers} elevation={elevationLegend} notes={legendNotes} raised={!!(selectedGapUnit || selectedFeature || selectedRiver || selectedPrs)} />
      </div>

      {/* ── Detail panel: draggable bottom sheet on mobile, sidebar on desktop
           (shared BottomSheet, matching the rivers map). Shown when a river,
           feature or gap is selected; closing clears the selection. ── */}
      {(selectedGapUnit || selectedFeature || selectedRiver || selectedPrs) && (
        <BottomSheet onClose={() => { setSelectedGapUnit(null); setSelectedFeature(null); setSelectedPrs(false); setGapFromPrs(false); selectRiver(null); }}>
          <div className="p-5 text-sm">
            {selectedPrs && prsData ? (
              <PRSPanel
                prs={prsData}
                accountability={accData}
                reviewedMpr={reviewedMpr}
                layerByFamily={layerByFamily}
                onOpenUnit={(u) => { setSelectedPrs(false); setSelectedFeature(null); setSelectedGapUnit(u); setGapFromPrs(true); }}
                depUnit={manifest.defaultGapUnit}
                onShowRegion={(r) => {
                  if (!r.mapMatch) return;
                  showOnMap(r.mapMatch);
                  // On phones this sheet covers the map - close it so the
                  // highlighted region is actually visible.
                  if (typeof window !== "undefined" && window.innerWidth < 768) setSelectedPrs(false);
                }}
                onShowLayer={(family) => {
                  const lyr = layerByFamily[family];
                  // Enable every entry of the family - kind-split families
                  // (e.g. pressures-industrial) key their toggles by
                  // family:kindFilter, so the bare family key would miss them.
                  setEnabled((s) => {
                    const next = { ...s };
                    for (const l of manifest.layers) if (l.family === family) next[layerKey(l)] = true;
                    return next;
                  });
                  if (lyr) {
                    setFocusedFloor(lyr.floor);
                    setExpandedFloors((s) => { const n = new Set(s); n.add(lyr.floor); return n; });
                  }
                }}
                onClose={() => setSelectedPrs(false)}
              />
            ) : selectedGapUnit && depData ? (
              <DepPanel
                data={depData}
                focusTaluk={selectedGapUnit}
                onSelectTaluk={setSelectedGapUnit}
                onHighlight={setDepHighlight}
                onShowMatch={(m) => {
                  showOnMap(m);
                  // On phones this sheet covers the map - close it so the
                  // highlighted region is actually visible.
                  if (typeof window !== "undefined" && window.innerWidth < 768) { setSelectedGapUnit(null); setGapFromPrs(false); }
                }}
                onClose={() => { setSelectedGapUnit(null); setGapFromPrs(false); }}
                onBack={gapFromPrs ? () => { setSelectedGapUnit(null); setGapFromPrs(false); setSelectedPrs(true); } : undefined}
              />
            ) : selectedGapUnit && gapData[selectedGapUnit] ? (
              <GapPanel
                unit={gapData[selectedGapUnit]}
                note={gapNote}
                onClose={() => { setSelectedGapUnit(null); setGapFromPrs(false); }}
                onBack={gapFromPrs ? () => { setSelectedGapUnit(null); setGapFromPrs(false); setSelectedPrs(true); } : undefined}
              />
            ) : selectedFeature ? (
              layerByFamily[selectedFeature.family]?.readings && selectedFeature.props.hasReadings ? (
                <StationReadingsPanel
                  basinId={manifest.basinId}
                  stationKey={String(selectedFeature.props.stationKey)}
                  name={selectedFeature.props.name != null ? String(selectedFeature.props.name) : undefined}
                  family={selectedFeature.family}
                  peers={readingsPeers}
                  onClose={() => setSelectedFeature(null)}
                />
              ) : renderFeatureDetail?.({
                family: selectedFeature.family,
                props: selectedFeature.props,
                onClose: () => setSelectedFeature(null),
              }) ?? (
                <FeaturePanel
                  props={selectedFeature.props}
                  label={layerByFamily[selectedFeature.family]?.label ?? selectedFeature.family}
                  onClose={() => setSelectedFeature(null)}
                />
              )
            ) : selectedRiver ? (
              <RiverPanel river={selectedRiver} onClear={() => selectRiver(null)} />
            ) : null}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

// ── legend ───────────────────────────────────────────────────────────────

export type LegendSym = "box" | "dot" | "ring" | "line" | "dash" | "outline" | "tri" | "tri-ring";
export interface LegendItem { sym: LegendSym; color: string; label: string }

/** One legend entry per symbol actually on the map right now, expanding
 *  pressures into its kinds and showing the monitoring public-domain cue
 *  (filled vs hollow). Every entry's color comes from the layer's manifest
 *  `color` or the shared PRESSURE_KIND_COLOR map - the same sources the map
 *  styles read - so the legend can never disagree with what's drawn. Shared
 *  by the on-map MapLegend and the PDF export's page-1 legend. */
export function buildLegendItems(layers: BasinLayer[], elevation?: { band: string; color: string }[]): LegendItem[] {
  const items: LegendItem[] = [];
  for (const l of layers) {
    if (l.legendRows) {
      // The manifest speaks for itself: a layer whose features carry more than
      // one visual role declares its own rows (basin-specific prose stays
      // data, never a hardcoded label here).
      items.push(...l.legendRows);
    }
    else if (l.elevation) {
      // Band labels come from the data (they differ per basin), matching the
      // city elevation legend: never hardcode edges at a call site.
      for (const e of elevation ?? []) items.push({ sym: "box", color: e.color, label: e.band });
    }
    else if (l.gap) {
      // Severity scale (matches the fill/badge colours) so red vs amber reads
      // as "how bad is the gap", not just decoration.
      items.push({ sym: "box", color: "#dc2626", label: "Waste gap - severe" });
      items.push({ sym: "box", color: "#ea580c", label: "Waste gap - moderate" });
      items.push({ sym: "box", color: "#f59e0b", label: "Waste gap - minor" });
    }
    else if (l.family === "boundary") items.push({ sym: "line", color: l.color, label: l.label });
    else if (l.family === "sub-hydrosheds") items.push({ sym: "dash", color: l.color, label: "Sub-catchment" });
    else if (l.family === "rivers") items.push({ sym: "line", color: l.color, label: "River" });
    else if (l.family === "drainage") items.push({ sym: "line", color: l.color, label: l.label });
    else if (l.readings) {
      // A readings layer's cue is whether a pack opens on tap, whatever the
      // family - so this branch must win over the monitoring-points one.
      if (l.family === "flow-stations") {
        items.push({ sym: "dot", color: l.color, label: "Gauge (tap for readings)" });
        items.push({ sym: "ring", color: l.color, label: "Gauge (readings not yet fetched)" });
      } else {
        items.push({ sym: "dot", color: l.color, label: "Station (tap for readings)" });
        items.push({ sym: "ring", color: l.color, label: "Station (no readings to show)" });
      }
    } else if (l.family === "monitoring-points") {
      items.push({ sym: "dot", color: l.color, label: "Monitoring (public data)" });
      items.push({ sym: "ring", color: l.color, label: "Monitoring (not in public domain)" });
    } else if (l.family === "pressures-industrial" && l.kindFilter === "industrial-area-other") {
      items.push({ sym: "outline", color: "#94a3b8", label: "Industrial area - unnamed (no effluent details)" });
    } else if (l.family === "pressures-industrial" && l.kindFilter === "major-industry") {
      items.push({ sym: "dot", color: PRESSURE_KIND_COLOR["major-industry"], label: "17-category industry (KSPCB)" });
    } else if (l.family === "pressures-industrial" && l.kindFilter && l.kindFilter !== "industrial-area") {
      // A kind-split entry that is NOT the estate fill (points, units outside
      // estates, estates outside the basin) draws in its own layer colour -
      // one row each. Routing these through the CETP trio repeated the same
      // three rows once per entry (Madhuri, 31 Aug).
      items.push({ sym: l.geom === "point" ? "dot" : "box", color: l.color, label: l.label });
    } else if (l.family === "pressures-industrial") {
      // The three CETP states are all solid fills (see fillStyle) - the legend
      // rows must mirror that, one box per state.
      items.push({ sym: "box", color: "#C62828", label: "Industrial area - no CETP (est.)" });
      items.push({ sym: "box", color: "#1976D2", label: "Industrial area - CETP available" });
      items.push({ sym: "box", color: "#F9A825", label: "Industrial area - CETP status to be verified" });
      // The 17-category dot appears here only when this entry is NOT
      // kind-split (a split manifest declares its own toggle + legend row).
      if (!l.kindFilter) items.push({ sym: "dot", color: PRESSURE_KIND_COLOR["major-industry"], label: "Major industry (17-category)" });
    } else if (l.family === "pressures-quarries") {
      items.push({ sym: "box", color: PRESSURE_KIND_COLOR["quarry"], label: "Quarry" });
    } else if (l.family === "pressures-waste") {
      items.push({ sym: "box", color: PRESSURE_KIND_COLOR["waste-facility"], label: "Hazardous waste facility" });
    } else if (l.family === "infrastructure") {
      // Squares / triangles, echoing the treatmentIcon marker shapes.
      items.push({ sym: "box", color: l.color, label: "STP (operational)" });
      items.push({ sym: "outline", color: l.color, label: "STP (not yet functional)" });
    } else if (l.family === "fstp") {
      items.push({ sym: "tri", color: l.color, label: "FSTP (operational)" });
      items.push({ sym: "tri-ring", color: l.color, label: "FSTP (not yet functional)" });
    } else if (l.family.startsWith("admin")) items.push({ sym: "outline", color: l.color, label: l.label });
    else if (l.geom === "point") items.push({ sym: "dot", color: l.color, label: l.label });
    else if (l.geom === "line") items.push({ sym: "line", color: l.color, label: l.label });
    else items.push({ sym: "box", color: l.color, label: l.label });
  }
  // Backstop: two layer entries that legitimately produce the same row (a
  // kind-split family) must not print it twice.
  const seen = new Set<string>();
  return items.filter((it) => {
    const k = `${it.sym}|${it.color}|${it.label}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** How the legend last stood, across basins and visits: it opens collapsed
 *  (a full legend ate most of a small map - Madhuri, 31 Aug) unless the
 *  reader expanded it last time. */
const LEGEND_OPEN_KEY = "nv-basin-legend-open";

/** Dynamic legend: reflects what's currently visible on the map. */
function MapLegend({ layers, elevation, notes, raised }: { layers: BasinLayer[]; elevation?: { band: string; color: string }[]; notes?: string[]; raised?: boolean }) {
  // Collapsed on first paint even when storage says open - the stored value is
  // applied in an effect so server and client render the same initial tree.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(LEGEND_OPEN_KEY) === "1") setOpen(true);
    } catch { /* storage unavailable: stay collapsed */ }
  }, []);
  const toggle = () => setOpen((o) => {
    try { localStorage.setItem(LEGEND_OPEN_KEY, o ? "0" : "1"); } catch { /* fine */ }
    return !o;
  });
  const items = buildLegendItems(layers, elevation);
  if (!items.length) return null;
  return (
    <div className={`absolute ${raised ? "bottom-[156px] md:bottom-3" : "bottom-3"} left-3 z-[800] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow text-[11px] max-w-[230px] transition-[bottom] duration-200`}>
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-2.5 py-1.5 font-semibold text-slate-600 dark:text-slate-300"
      >
        Legend <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-2.5 pb-2 space-y-1 max-h-[42vh] overflow-y-auto">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <LegendSymbol sym={it.sym} color={it.color} />
              <span className="text-slate-600 dark:text-slate-300 leading-tight">{it.label}</span>
            </div>
          ))}
          {notes && notes.map((n, i) => (
            <div key={`note-${i}`} className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug pt-1 mt-1 border-t border-slate-200 dark:border-slate-700">{n}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function LegendSymbol({ sym, color }: { sym: LegendSym; color: string }) {
  if (sym === "dot") return <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />;
  if (sym === "ring") return <span className="inline-block w-3 h-3 rounded-full shrink-0 border-2 bg-transparent" style={{ borderColor: color }} />;
  if (sym === "line") return <span className="inline-block w-4 h-[2px] shrink-0" style={{ backgroundColor: color }} />;
  if (sym === "dash") return <span className="inline-block w-4 border-t-2 border-dashed shrink-0" style={{ borderColor: color }} />;
  if (sym === "outline") return <span className="inline-block w-3 h-3 rounded-sm shrink-0 border" style={{ borderColor: color }} />;
  if (sym === "tri" || sym === "tri-ring")
    return (
      <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0" aria-hidden>
        <polygon
          points="6,1 11.5,11 0.5,11"
          fill={sym === "tri" ? color : "none"}
          stroke={color}
          strokeWidth={sym === "tri" ? 0 : 1.8}
          strokeLinejoin="round"
        />
      </svg>
    );
  return <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />;
}

// ── styling ──────────────────────────────────────────────────────────────

/** Short, single-line hover label; full detail lives in the click panel. */
function tipLabel(p: Record<string, unknown>, l: BasinLayer): string {
  if (String(p.kind) === "industrial-area-other") return "Industrial area (unnamed) - no effluent details";
  const kind = p.kind ? String(p.kind).replace(/-/g, " ") : "";
  const raw = String(p.name ?? p.contributor ?? kind ?? l.label).trim() || l.label;
  return raw.length > 46 ? `${raw.slice(0, 46)}…` : raw;
}

/** Admin tooltip: the unit and its place in the hierarchy, e.g.
 *  "Haragadde (gp) - Kanakapura taluk - Ramanagara". */
function adminTip(p: Record<string, unknown>): string {
  const name = String(p.name ?? "").trim();
  const level = String(p.level ?? "").trim();
  const parts = [level ? `${name} (${level})` : name];
  if (p.parentTaluk) parts.push(`${String(p.parentTaluk)} taluk`);
  if (p.parentDistrict) parts.push(String(p.parentDistrict));
  return parts.join(" - ");
}

function pressurePointStyle(feat: Feature | undefined, faded: boolean): L.CircleMarkerOptions {
  const kind = String((feat?.properties as Record<string, unknown>)?.kind ?? "");
  const c = PRESSURE_KIND_COLOR[kind] ?? "#b91c1c";
  return { radius: 5, color: c, weight: 1.5, fillColor: c, fillOpacity: faded ? 0.3 : 0.85, opacity: faded ? 0.5 : 1 };
}

// Sub-catchments are dashed INDIGO outlines - a hue absent from the OSM
// basemap (which draws its own admin boundaries in grey/white), so they read
// as ours, not the basemap's. Outline-only (no fill) avoids the darkening
// where catchments meet; the interior stays clickable under canvas. The
// selected catchment pops in amber with a faint highlight fill.
function shedStyle(feat: Feature | undefined, selectedSheds: Set<string>, faded: boolean, color: string): PathOptions {
  const sid = String((feat?.properties as Record<string, unknown>)?.shedId ?? "");
  const sel = selectedSheds.has(sid);
  return {
    color: sel ? SELECTED_SHED_COLOR : color,
    weight: sel ? 2.5 : 1.4,
    dashArray: sel ? undefined : "5 4",
    opacity: sel ? 0.95 : faded ? 0.45 : 0.8,
    fill: sel,
    fillColor: SELECTED_SHED_COLOR,
    fillOpacity: sel ? 0.08 : 0,
  };
}

function lineStyle(l: BasinLayer, feat: Feature | undefined, manifest: BasinManifest, selectedRiverId: string | null, faded: boolean, showGrowth = false, prsYears: number[] = []): PathOptions {
  if (l.prs) {
    const yr = Number((feat?.properties as Record<string, unknown>)?.year);
    if (showGrowth && prsYears.length > 1) {
      // Growth view: each older reach is drawn LAST (on top) and thicker, so
      // it fully covers the newer line beneath it on the length they share.
      // A newer band therefore shows only where the stretch EXTENDED.
      const fromNewest = Math.max(prsYears.length - 1 - prsYears.indexOf(yr), 0);
      return { color: prsMapColor(fromNewest), weight: 4 + fromNewest * 4, opacity: fromNewest ? 1 : 0.95 };
    }
    // Default: just the current (latest) stretch, red.
    return { color: "#dc2626", weight: 5, opacity: faded ? 0.5 : 0.95 };
  }
  if (l.family === "context-rivers") {
    // Heavier than the in-basin course, not lighter: this is the reach a
    // reader is being asked to notice, and a pale hairline read as a minor
    // stream against the basemap.
    return { color: l.color, weight: 3, dashArray: "7 4", opacity: faded ? 0.55 : 1 };
  }
  if (l.family === "context-streams") {
    // The Kerala tributary skeleton: visibly a level below the mainstem
    // context line, so the reservoirs read as ON rivers without the
    // headwaters shouting over the subject.
    return { color: l.color, weight: 1.25, dashArray: "4 4", opacity: faded ? 0.4 : 0.7 };
  }
  if (l.family === "prs-drains") {
    // The drains feeding the polluted stretch. Weight-1 amber vanished into
    // the basemap's orange roads (Madhuri, 31 Aug); these are the lines the
    // outfall dots exist to explain, so they draw like it.
    return { color: l.color, weight: 3, opacity: faded ? 0.5 : 0.95 };
  }
  if (l.family === "rivers") {
    const rprops = feat?.properties as Record<string, unknown>;
    const rid = String(rprops?.riverId ?? rprops?.river_id ?? "");
    const r = manifest.rivers.find((x) => x.riverId === rid);
    const sel = rid === selectedRiverId;
    return { color: r?.color ?? l.color, weight: sel ? 5 : 3, opacity: sel || !selectedRiverId ? 1 : 0.75 };
  }
  // fill: false matters when a polygon family is routed through the line
  // path - Leaflet's default otherwise fills it, tinting the whole shape.
  return { color: l.color, weight: 1, opacity: faded ? 0.4 : 0.85, fill: false };
}

function pointStyle(l: BasinLayer, feat: Feature | undefined, faded: boolean): L.CircleMarkerOptions {
  const p = (feat?.properties ?? {}) as Record<string, unknown>;
  // Hollow marks a station you cannot read here today, but the cue is keyed
  // per layer type: a readings layer goes hollow when no readings pack is
  // attached (solid promises a chart on tap - see the tap gate on
  // StationReadingsPanel), a non-readings monitoring layer when the station's
  // data is not in the public domain. Treatment plants never reach here -
  // they render as shaped markers (treatmentIcon) that carry their own
  // solid/hollow status convention.
  const hollow = l.readings
    ? p.hasReadings !== true
    : l.family === "monitoring-points" && String(p.publicDomain ?? "").toUpperCase() !== "YES";
  return {
    radius: 5,
    color: l.color,
    weight: 1.5,
    fillColor: hollow ? "transparent" : l.color,
    fillOpacity: faded ? 0.3 : hollow ? 0 : 0.85,
    opacity: faded ? 0.5 : 1,
  };
}

// Treatment plants are DOM markers, not canvas circles: STP = square, FSTP =
// triangle (Madhuri's review - identical small circles were unfindable in a
// demo), sized well above the 10 px data dots and drawn in the markerPane,
// which stacks above every canvas fill. Solid = operational, hollow = not yet
// functional - the same status convention the circles used; the white outline
// on solid shapes keeps them legible on both the light and darkened basemaps.
function treatmentIcon(l: BasinLayer, feat: Feature | undefined): L.DivIcon {
  const p = (feat?.properties ?? {}) as Record<string, unknown>;
  const operational = /operational/i.test(String(p.status ?? ""));
  const fill = operational ? l.color : "none";
  const stroke = operational ? "#ffffff" : l.color;
  const sw = operational ? 1.5 : 2.5;
  const shape =
    l.family === "fstp"
      ? `<polygon points="9,1.5 17,16 1,16" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`
      : `<rect x="2" y="2" width="14" height="14" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">${shape}</svg>`,
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// ── shared color sources (the map, legend, and rail all read from these +
//    each layer's manifest `color`, so they can never drift out of sync) ──

// Warm red->orange->amber ramp: reads as "pressure", three steps distinct and
// each mid-toned so it holds on both the light and dark basemaps.
const PRESSURE_KIND_COLOR: Record<string, string> = {
  "industrial-area": "#C62828",
  quarry: "#ea580c",
  "waste-facility": "#ca8a04",
  // Named 17-category major polluters (KSPCB) - a deep rose, distinct from the
  // red/orange/amber area kinds and rendered as a point, not a fill.
  "major-industry": "#9d174d",
};
// The selected sub-catchment highlight (warm amber - the only warm structural
// cue, so "you are scoped here" stands out from the cool context).
const SELECTED_SHED_COLOR = "#f59e0b";

// Admin levels are all neutral; tell them apart by dash pattern + weight.
const ADMIN_DASH: Record<string, string | undefined> = {
  "admin-district": undefined,
  "admin-taluk": "6 4",
  "admin-town": "2 3",
  "admin-gp": "1 4",
};

type MapHighlight = MapMatch;

function matchesHighlight(hl: MapHighlight | null | undefined, l: BasinLayer, feat: Feature | undefined): boolean {
  if (!hl || hl.family !== l.family) return false;
  const p = (feat?.properties ?? {}) as Record<string, unknown>;
  // Kind guard: a name-contains match must not leak onto other kinds sharing
  // the family (e.g. a 17-category industry whose address names the estate).
  if (hl.kinds && !hl.kinds.includes(String(p.kind ?? ""))) return false;
  if (!hl.prop) return true;
  const v = String(p[hl.prop] ?? "");
  if (hl.values?.includes(v)) return true;
  return hl.contains?.some((c) => v.toLowerCase().includes(c.toLowerCase())) ?? false;
}

/** `gapUnit` is the polygon-backed selection (see mapGapUnit), never a ULB key. */
function fillStyle(l: BasinLayer, feat: Feature | undefined, faded: boolean, gapUnit?: string | null, hl?: MapHighlight | null): PathOptions {
  if (matchesHighlight(hl, l, feat)) {
    return { color: SELECTED_SHED_COLOR, weight: 3, fillColor: l.color, fillOpacity: 0.35, opacity: 1 };
  }
  if (l.family === "context-boundary") {
    // Two roles. "context" is the full outline: dashed, in the layer's
    // outlineColor - pale enough to defer to the bold clip frame, bright
    // enough to survive a dark basemap (Madhuri, 31 Aug: the old slate dash
    // was invisible, so the basin looked like it stopped at Karnataka).
    // "beyond" is the out-of-state catchment itself, and it gets a FILL -
    // 2,199 sq km drawn as bare outline is 2,199 sq km nobody can see
    // (review, 27 Aug) - but NO stroke: its only edges are the full outline
    // and the basin boundary, which draw themselves.
    if ((feat?.properties as Record<string, unknown> | undefined)?.role === "beyond") {
      return { stroke: false, fillColor: l.color, fillOpacity: faded ? 0.12 : 0.25 };
    }
    return { color: l.outlineColor ?? l.color, weight: 2.5, dashArray: "7 5", fill: false, opacity: faded ? 0.6 : 0.95 };
  }
  if (l.family === "boundary") {
    // Bold SOLID line in the manifest color (fuchsia) - a hue the OSM basemap
    // never uses, so the basin edge can't be mistaken for a basemap boundary.
    return { color: l.color, weight: 3, fill: false, opacity: 0.95 };
  }
  if (l.family.startsWith("admin")) {
    // District is always-on context (outline only). The opt-in finer levels get
    // a faint fill so the whole unit is tappable (hierarchy on tap/hover).
    const detail = l.family !== "admin-district";
    return {
      color: l.color,
      weight: l.family === "admin-district" ? 1.4 : 1.2,
      fill: detail,
      fillColor: l.color,
      fillOpacity: detail ? (faded ? 0.03 : 0.07) : 0,
      opacity: faded ? 0.4 : 0.85,
      dashArray: ADMIN_DASH[l.family],
    };
  }
  if (l.gap) {
    const unit = String((feat?.properties as Record<string, unknown>)?.gapUnit ?? "");
    const sev = String((feat?.properties as Record<string, unknown>)?.severity ?? "high");
    const c = sev === "high" ? "#dc2626" : sev === "medium" ? "#ea580c" : "#f59e0b";
    // When a unit is selected, grey out the others so the selection stands out.
    if (gapUnit != null && gapUnit !== unit) {
      return { color: "#cbd5e1", weight: 1, fillColor: "#94a3b8", fillOpacity: 0.12 };
    }
    const isSel = gapUnit === unit;
    return { color: c, weight: isSel ? 3 : 2, fillColor: c, fillOpacity: faded ? 0.2 : isSel ? 0.55 : 0.4 };
  }
  if (l.family.startsWith("pressures")) {
    const p = (feat?.properties as Record<string, unknown>) ?? {};
    const kind = String(p.kind ?? "");
    // Industrial areas are sub-coloured by CETP coverage, palette fixed with
    // Madhuri (Aug 2026): no CETP = red, CETP available = blue, status to be
    // verified = yellow. All three are SOLID fills at the same opacity - the
    // old faint/dashed states vanished against the basemap in a live demo.
    if (kind === "industrial-area-other") {
      // Unattributed (likely KSSIDC) estates: marked but detail-less, so a
      // quiet dashed grey - visibly present, visibly not the KIADB story.
      return { color: "#94a3b8", weight: 1, fillColor: "#94a3b8", fillOpacity: faded ? 0.12 : 0.25, dashArray: "3 3" };
    }
    if (kind === "industrial-area") {
      const cetp = String(p.cetp ?? "unknown");
      const c = cetp === "none" ? "#C62828" : cetp === "served" ? "#1976D2" : "#F9A825";
      return { color: c, weight: 1, fillColor: c, fillOpacity: faded ? 0.2 : 0.55 };
    }
    const c = PRESSURE_KIND_COLOR[kind] ?? l.color;
    return { color: c, weight: 1, fillColor: c, fillOpacity: faded ? 0.2 : 0.5 };
  }
  // waterbodies, command-areas
  return { color: l.color, weight: 0.8, fillColor: l.color, fillOpacity: faded ? 0.3 : 0.6 };
}

// ── panels ───────────────────────────────────────────────────────────────

// Attribute-card order + labels for the river panel (Paani Phase-1 review:
// structured attributes over prose; unknown fields say "Details coming soon").
const RIVER_ATTRIBUTE_ROWS: { key: keyof NonNullable<BasinManifest["rivers"][number]["attributes"]>; label: string }[] = [
  { key: "origin", label: "Origin" },
  { key: "length", label: "Length" },
  { key: "tributaries", label: "Tributaries" },
  { key: "flowsInto", label: "Flows into" },
  { key: "pollutedStretch", label: "Polluted river stretch" },
  { key: "restorationInitiatives", label: "Restoration initiatives" },
];

function RiverPanel({ river, onClear }: { river: BasinManifest["rivers"][number]; onClear: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{river.displayName}</h2>
          {river.displayNameLocal && <div className="text-sm text-slate-500 dark:text-slate-400">{river.displayNameLocal}</div>}
        </div>
        <span className="inline-block w-3 h-3 rounded-full mt-1.5" style={{ backgroundColor: river.color }} />
      </div>
      {river.attributes && (
        <dl className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
          {RIVER_ATTRIBUTE_ROWS.map(({ key, label }) => {
            const value = river.attributes?.[key];
            return (
              <div key={key} className="flex gap-2 px-2.5 py-1.5">
                <dt className="text-[12px] text-slate-500 dark:text-slate-400 w-32 shrink-0">{label}</dt>
                <dd className={`text-[12px] leading-snug ${value ? "font-medium text-slate-800 dark:text-slate-100" : "italic text-slate-400 dark:text-slate-500"}`}>
                  {value ?? "Details coming soon"}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {river.narrative && <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{river.narrative}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Every floor is now scoped to this river&apos;s sub-catchment{river.subHydroshedIds.length > 1 ? "s" : ""}. Switch floors on the left to see its monitoring, pressures and treatment.
      </p>
      <button onClick={onClear} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">← Back to whole basin</button>
    </div>
  );
}

const PROP_LABELS: Record<string, string> = {
  agency: "Agency",
  purpose: "Purpose",
  frequency: "Frequency",
  publicDomain: "Public-domain data",
  findings: "Key findings",
  contributor: "Contributor",
  period: "Study period",
  locationName: "Location",
  capacityMld: "Operating capacity (MLD)",
  capacityKld: "Capacity (KLD)",
  classification: "Classification",
  locationNote: "Location note",
  status: "Status",
  process: "Process",
  kind: "Type",
  type: "Type",
  custodian: "Custodian",
  district: "District",
  tankId: "Tank ID",
  details: "Details",
  areaHa: "Area (ha)",
  govCode: "Government code",
  townType: "Town type",
  cetpNote: "CETP coverage",
};
const LINK_FIELDS = new Set(["dataUrl", "evidenceUrl"]);

/** Fallback label for any property key not in PROP_LABELS: split camelCase and
 *  capitalise, so "evidenceType" -> "Evidence Type", "govCode" -> "Gov Code". */
function humanizeKey(k: string): string {
  const s = k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function FeaturePanel({ props, label, onClose }: { props: Record<string, unknown>; label: string; onClose: () => void }) {
  const title = String(props.name ?? props.contributor ?? props.kind ?? label);
  const entries = Object.entries(props).filter(
    ([k, v]) => k !== "name" && k !== "shedId" && k !== "cetp" && k !== "hasReadings"
      && k !== "readingsPending" && !LINK_FIELDS.has(k) && v != null && String(v).trim() !== "",
  );
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">{title}</h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <dl className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10px] uppercase tracking-wider text-slate-400">{PROP_LABELS[k] ?? humanizeKey(k)}</dt>
            <dd className="text-slate-700 dark:text-slate-300 leading-relaxed">{String(v)}</dd>
          </div>
        ))}
      </dl>
      {[...LINK_FIELDS].map((k) =>
        props[k] && String(props[k]).startsWith("http") ? (
          <a key={k} href={String(props[k])} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline">
            View source / lab report →
          </a>
        ) : null,
      )}
    </div>
  );
}

/** Priority chip colour: CPCB band I/II = worst (red), III-V progressively less. */
function priorityClass(p: string): string {
  const worst = p === "I" || p === "II";
  return worst
    ? "bg-rose-600 text-white"
    : "bg-amber-500 text-white";
}

/** PRS (Polluted River Stretch) entry-point panel: lead with the conclusion
 *  (the stretch grew + worsened), the constructive BOD caveat, then the
 *  stressor themes as collapsible sub-sections that reuse the gaps data already
 *  loaded, each linking into that unit's full cross-source GapPanel. */
function PRSPanel({
  prs,
  accountability,
  reviewedMpr,
  layerByFamily,
  onOpenUnit,
  onShowLayer,
  onShowRegion,
  depUnit,
  onClose,
}: {
  prs: PrsData;
  accountability?: AccountabilityData | null;
  reviewedMpr?: ReviewedMprSeries | null;
  layerByFamily: Record<string, BasinLayer>;
  onOpenUnit: (unit: string) => void;
  onShowLayer: (family: string) => void;
  onShowRegion?: (r: AccRegion) => void;
  /** Gap unit the DEP cross-link opens; the link renders only when set. */
  depUnit?: string;
  onClose: () => void;
}) {
  const firstSubKey = (t?: PrsTab) => t?.units?.[0]?.key ?? t?.categories?.[0]?.key ?? "";
  const [openArea, setOpenArea] = useState<string | null>(null);
  const [subKey, setSubKey] = useState<string>("");
  const [showKeyTerms, setShowKeyTerms] = useState(false);
  const openTab = openArea ? prs.tabs.find((t) => t.key === openArea) ?? null : null;
  const subs = openTab ? openTab.units ?? openTab.categories ?? [] : [];
  const unit = openTab?.units?.find((u) => u.key === subKey) ?? openTab?.units?.[0];
  const cat = openTab?.categories?.find((c) => c.key === subKey) ?? openTab?.categories?.[0];
  const openAreaFn = (t: PrsTab) => { setOpenArea(t.key); setSubKey(firstSubKey(t)); };
  const maxKm = Math.max(...prs.epochs.map((e) => e.length_km), 0) || 1;
  const rows = withEpochAccents(prs.epochs);
  const badgeTone: Record<string, string> = {
    bad: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    warn: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  };

  // ── Level 2: one area's detail ──
  if (openTab) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setOpenArea(null)} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
            ← All priority areas
          </button>
          <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{openTab.label}</h2>
        {openTab.intro && <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">{openTab.intro}</p>}
        {subs.length > 1 && (() => {
          const chip = (s: (typeof subs)[number], muted: boolean) => {
            const name = "name" in s ? s.name : s.label;
            const on = s.key === (unit?.key ?? cat?.key);
            return (
              <button
                key={s.key}
                onClick={() => setSubKey(s.key)}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  on
                    ? "bg-rose-600 text-white border-rose-600"
                    : muted
                      ? "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 border-dashed hover:bg-slate-100 dark:hover:bg-slate-700"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {name}
              </button>
            );
          };
          // Units (towns) render as one flat row - every town gets both an
          // MPR bucket and an Other-sources bucket in its detail below, so
          // the chips don't pre-sort them. Categories (thematic sub-tabs)
          // keep the register split: MPR-sourced lead, DEP/CAG/F-register/
          // OCEMS material sits under an explicit "Other sources" group.
          if (openTab.units) {
            return <div className="flex flex-wrap gap-1">{subs.map((s) => chip(s, false))}</div>;
          }
          const primary = subs.filter((s) => s.sourceTier !== "other");
          const other = subs.filter((s) => s.sourceTier === "other");
          return (
            <div className="space-y-1.5">
              {primary.length > 0 && (
                <div className="flex flex-wrap gap-1 items-center">
                  {other.length > 0 && <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mr-0.5">MPR</span>}
                  {primary.map((s) => chip(s, false))}
                </div>
              )}
              {other.length > 0 && (
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mr-0.5">Other sources</span>
                  {other.map((s) => chip(s, true))}
                </div>
              )}
            </div>
          );
        })()}
        {openTab.units && unit && (
          <div className="space-y-2">
            {/* Bucket 1: MPR - the primary baseline. Towns the MPR doesn't
                itemise get an explicit no-data state, never a silent blank. */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">MPR (primary source)</div>
              {unit.sourceTier === "other" ? (
                <p className="text-[12px] leading-snug rounded-md border border-slate-200 dark:border-slate-700 border-dashed bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 px-2.5 py-2">
                  {unit.mprNote ?? `No data: ${unit.name} is not itemised in any MPR edition we hold.`}
                </p>
              ) : (
                <UnitTimeline unit={unit} unitLabel={openTab.unitLabel ?? "MLD"} treatedVerb={openTab.treatedVerb ?? "treated"} onOpenUnit={onOpenUnit} />
              )}
            </div>
            {/* Bucket 2: other sources - the specific document is named in
                the sourceNote below the figures, never as label shorthand. */}
            {unit.sourceTier === "other" && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Other sources</div>
                <UnitTimeline unit={unit} unitLabel={openTab.unitLabel ?? "MLD"} treatedVerb={openTab.treatedVerb ?? "treated"} onOpenUnit={onOpenUnit} />
                {unit.sourceNote && <p className="mt-1 text-[10px] text-slate-400 leading-snug">Source: {unit.sourceNote}</p>}
              </div>
            )}
          </div>
        )}
        {openTab.categories && cat && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
            {(cat.level || cat.noData) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {cat.level && (
                  <span className="inline-block text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">Reported at: {cat.level}</span>
                )}
                {/* The honest gap is a marker, not a replacement: an author who
                    can say WHAT is missing keeps saying it below. */}
                {cat.noData && (
                  <span className="inline-block text-[9px] uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50 rounded px-1.5 py-0.5">No known public data</span>
                )}
              </div>
            )}
            <>
                {cat.body ? (
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 leading-relaxed">{cat.body}</p>
                ) : cat.noData ? (
                  <p className="text-[13px] text-slate-500 dark:text-slate-400">No known public data yet for {cat.label} along this stretch.</p>
                ) : null}
                {cat.points && cat.points.length > 0 && (
                  <ul className="space-y-2.5">
                    {cat.points.map((p, i) => {
                      const ci = p.indexOf(": ");
                      const hasLabel = ci > 0 && ci <= 42;
                      const label = hasLabel ? p.slice(0, ci) : null;
                      const rest = hasLabel ? p.slice(ci + 2) : p;
                      return (
                        <li key={i} className="flex gap-2 text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed">
                          <span aria-hidden className="mt-[7px] w-1.5 h-1.5 rounded-full bg-rose-400 dark:bg-rose-500 shrink-0" />
                          <span>
                            {label && <span className="font-semibold text-slate-900 dark:text-slate-100">{label}. </span>}
                            {rest}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {cat.layerRef && layerByFamily[cat.layerRef] && (
                  <button onClick={() => onShowLayer(cat.layerRef!)} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
                    Show {layerByFamily[cat.layerRef].label} on the map →
                  </button>
                )}
                {cat.link && (
                  <a
                    href={cat.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 text-[12px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  >
                    {cat.link.label} ↗
                  </a>
                )}
            </>
          </div>
        )}
        {openTab.source && <p className="text-[10px] text-slate-400">Source: {openTab.source}</p>}
      </div>
    );
  }

  // ── Level 1: summary ──
  return (
    <div className="space-y-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-rose-500">Polluted river stretch (PRS)</div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">{prs.river}</h2>
          <p className="text-[11px] text-slate-400">{prs.stretchName}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Glossary + citation affordances (Paani Phase-1 review) */}
      {(prs.keyTerms || prs.citeSource) && (
        <div className="flex flex-wrap items-center gap-2">
          {prs.keyTerms && prs.keyTerms.length > 0 && (
            <button
              onClick={() => setShowKeyTerms(true)}
              className="inline-flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            >
              Key terms used on this page
            </button>
          )}
          {prs.citeSource && (
            <a
              href={prs.citeSource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            >
              {prs.citeSource.label ?? "Cite this data source"} ↗
            </a>
          )}
        </div>
      )}
      {showKeyTerms && prs.keyTerms && (
        <KeyTermsPopup terms={prs.keyTerms} onClose={() => setShowKeyTerms(false)} />
      )}

      {/* Legacy prose lead - only when structured facts aren't provided */}
      {!prs.statusFacts && prs.conclusion && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3">
          <div className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-rose-500 shrink-0">▶</span>
            <p className="text-[13px] font-semibold text-rose-900 dark:text-rose-100 leading-relaxed">{prs.conclusion}</p>
          </div>
        </div>
      )}

      {/* Current status: 2020 vs 2025 bars + plain-language line + facts */}
      <section>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">Current status</div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.year}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-500 w-9 shrink-0">{r.year}</span>
                <div className="flex-1 h-4 rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-sm" style={{ width: `${(r.length_km / maxKm) * 100}%`, backgroundColor: r.accent }} />
                </div>
                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 w-14 text-right shrink-0">{r.length_km} km</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${priorityClass(r.priority)}`}>P{r.priority}</span>
              </div>
              {r.note && (
                <p className="mt-0.5 ml-11 text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                  {r.notMapped && <span className="font-medium">Not drawn on the map. </span>}
                  {r.note}
                </p>
              )}
            </div>
          ))}
        </div>
        {prs.statusLine && (
          <p className="mt-2 text-[13px] font-semibold text-rose-900 dark:text-rose-100 leading-relaxed rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-2.5">
            {prs.statusLine}
          </p>
        )}
        {prs.statusFacts && prs.statusFacts.length > 0 && (
          <dl className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {prs.statusFacts.map((f) => (
              <div key={f.label} className="flex gap-2 px-2.5 py-1.5">
                <dt className="text-[12px] text-slate-500 dark:text-slate-400 w-32 shrink-0">{f.label}</dt>
                <dd className="text-[12px] font-medium text-slate-800 dark:text-slate-100 leading-snug">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {reviewedMpr && <ReviewedMprSection series={reviewedMpr} />}

      {/* Governance & compliance: who is accountable, and what they must report */}
      {prs.governance && (
        <section>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">Governance &amp; Compliance</div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {prs.governance.rows.map((f) => (
              <div key={f.label} className="flex gap-2 px-2.5 py-1.5">
                <span className="text-[12px] text-slate-500 dark:text-slate-400 w-32 shrink-0">{f.label}</span>
                <span className="text-[12px] font-medium text-slate-800 dark:text-slate-100 leading-snug">{f.value}</span>
              </div>
            ))}
            {prs.governance.actionPlan && (
              <div className="px-2.5 py-1.5">
                <a
                  href={prs.governance.actionPlan.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {prs.governance.actionPlan.label ?? "Action Plan"} ↗
                </a>
              </div>
            )}
            {prs.governance.compliance?.map((c) => (
              <div key={c.value} className="flex gap-2 px-2.5 py-1.5">
                <span className="text-[12px] text-slate-500 dark:text-slate-400 w-32 shrink-0">Compliance</span>
                <span className="text-[12px] font-medium text-slate-800 dark:text-slate-100 leading-snug">
                  {c.value}
                  {c.link && (
                    <>
                      {" "}
                      <a href={c.link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">{c.link.label} ↗</a>
                    </>
                  )}
                  {c.note && <span className="block mt-0.5 font-normal text-[11px] text-slate-500 dark:text-slate-400">{c.note}</span>}
                </span>
              </div>
            ))}
          </div>
          {prs.governance.note && <p className="mt-1 text-[11px] text-slate-400 leading-snug">{prs.governance.note}</p>}
        </section>
      )}

      {/* Accountability matrix: Action Plan vs MPR, region-first */}
      {accountability && <AccountabilityMatrix data={accountability} onShowRegion={onShowRegion} />}

      {depUnit && (
        <button onClick={() => onOpenUnit(depUnit)} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Explore treatment and waste gaps (DEP 2022 snapshot) →
        </button>
      )}

      {/* Stretch-level obligations only; per-area rows live in the
          accountability matrix. */}
      {prs.tabs.some((t) => t.scope === "stretch") && (
      <section>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">Stretch-level obligations <span className="normal-case font-normal text-slate-400">(reported for the stretch as a whole; tap for detail)</span></div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
          {prs.tabs.filter((t) => t.scope === "stretch").map((t) => (
            <button
              key={t.key}
              onClick={() => openAreaFn(t)}
              className="w-full text-left flex items-center gap-2 px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              {t.summaryBadge && (
                <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 w-[88px] text-center ${badgeTone[t.summaryTone ?? "neutral"]}`}>{t.summaryBadge}</span>
              )}
              <span className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{t.label}</span>
                {t.summaryLine && <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{t.summaryLine}</span>}
              </span>
              <span aria-hidden className="text-slate-400 shrink-0">›</span>
            </button>
          ))}
        </div>
      </section>
      )}

      {/* Evidence (collapsed; the "beyond BOD" beat) */}
      {prs.evidence && (
        <details className="group rounded-md border border-slate-200 dark:border-slate-700">
          <summary className="cursor-pointer list-none p-2.5 flex items-start gap-1.5">
            <span aria-hidden className="text-slate-400 group-open:rotate-90 transition-transform mt-0.5">▸</span>
            <span className="flex-1">
              <span className="text-[13px] uppercase tracking-wider text-rose-700 dark:text-rose-400 font-bold">Evidence of pollution</span>
              <span className="block text-[12px] text-slate-600 dark:text-slate-300 leading-snug">{prs.evidence.headline}</span>
            </span>
          </summary>
          <div className="px-2.5 pb-2.5 pt-0.5">
            <ul className="space-y-1 list-disc pl-4">
              {prs.evidence.points.map((p, i) => (
                <li key={i} className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">{p}</li>
              ))}
            </ul>
            {prs.evidence.layerRef && layerByFamily[prs.evidence.layerRef] && (
              <button onClick={() => onShowLayer(prs.evidence!.layerRef!)} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
                Show {layerByFamily[prs.evidence.layerRef].label} on the map →
              </button>
            )}
            {prs.evidence.link && (
              <a
                href={prs.evidence.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 flex items-center gap-1.5 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 text-[12px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
              >
                {prs.evidence.link.label} ↗
              </a>
            )}
          </div>
        </details>
      )}

      {/* Report a problem (action) */}
      {prs.grievance && (
        <a
          href={prs.grievance.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold px-3 py-2"
        >
          {prs.grievance.label} →
        </a>
      )}

      {/* Footer disclosures - everything else, one tap deep */}
      <PrsDisclosure label="Priority, methodology & data coverage">
        {prs.reportingCaveat && <p className="text-[12px] text-slate-700 dark:text-slate-200 font-medium leading-relaxed">{prs.reportingCaveat}</p>}
        {prs.growthNote && <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">{prs.growthNote}</p>}
        {prs.priorityNote && <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">{prs.priorityNote}</p>}
        {prs.bodCaveat && <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">{prs.bodCaveat}</p>}
        {prs.mprOverview && <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">{prs.mprOverview}</p>}
        {prs.levelCoverage && <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed"><span className="font-semibold">Reporting level: </span>{prs.levelCoverage}</p>}
      </PrsDisclosure>

      {prs.sources && prs.sources.length > 0 && (
        <PrsDisclosure label="Sources">
          <ul className="space-y-0.5">
            {prs.sources.map((s, i) => (
              <li key={i} className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{s}</li>
            ))}
          </ul>
        </PrsDisclosure>
      )}
      {prs.grievance?.urlNote && <p className="text-[10px] text-slate-400 italic">{prs.grievance.urlNote}</p>}
    </div>
  );
}

function ReviewedMprSection({ series }: { series: ReviewedMprSeries }) {
  const latest = series.editions.at(-1);
  const [editionId, setEditionId] = useState(latest?.editionId ?? "");
  const edition = series.editions.find((item) => item.editionId === editionId) ?? latest;
  const groups = useMemo(() => {
    const grouped = new Map<string, ReviewedMprRecord[]>();
    for (const record of edition?.records ?? []) {
      const current = grouped.get(record.subjectLabel) ?? [];
      current.push(record);
      grouped.set(record.subjectLabel, current);
    }
    return [...grouped.entries()];
  }, [edition]);
  if (!edition) return null;

  const month = (date: string) => new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

  return (
    <section className="rounded-lg border border-blue-200 dark:border-blue-900/70 bg-blue-50/60 dark:bg-blue-950/20 p-3 space-y-2.5">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-300 font-semibold">Reviewed monthly progress</div>
        <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">
          {series.summary.editionCount} report editions · {series.summary.recordCount} source-linked values
        </p>
      </div>

      <div className="flex flex-wrap gap-1" aria-label="Monthly progress report editions">
        {series.editions.map((item) => (
          <button
            key={item.editionId}
            onClick={() => setEditionId(item.editionId)}
            className={`text-[11px] px-2 py-1 rounded border font-semibold transition-colors ${
              item.editionId === edition.editionId
                ? "bg-blue-700 text-white border-blue-700"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-800"
            }`}
          >
            {month(item.period.end)}
          </button>
        ))}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{month(edition.period.end)}</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{edition.source.title}</p>
        </div>
        <a
          href={edition.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:underline"
        >
          Source PDF ↗
        </a>
      </div>

      <div key={edition.editionId} className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {groups.map(([subject, records]) => (
          <details key={subject} open={edition.records.length <= 15} className="group px-2.5 py-2">
            <summary className="cursor-pointer list-none flex items-center gap-2">
              <span aria-hidden className="text-[10px] text-slate-400 group-open:rotate-90 transition-transform">▸</span>
              <span className="flex-1 text-[12px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">{subject}</span>
              <span className="text-[10px] text-slate-400">{records.length}</span>
            </summary>
            <dl className="mt-2 ml-4 space-y-1.5">
              {records.map((record) => (
                <div key={record.claimId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
                  <dt className="text-[11px] text-slate-500 dark:text-slate-400">{reviewedMprConceptLabel(record.concept)}</dt>
                  <dd className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 text-right">{reviewedMprValueLabel(record.value)}</dd>
                  <dd className="col-span-2 text-[10px] text-slate-400">Evidence: page {record.pageNumber}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 leading-snug">
        Values are published only after platform review. Page numbers point back to the named report above.
      </p>
    </section>
  );
}

// Verdict chips for the accountability matrix. Plain-language labels: the
// value of the matrix is making "exists in MPR vs doesn't" explicit per
// region x category, so absence reads as a finding, not a blank.
const ACC_VERDICT_CLS: Record<AccCategory["verdict"], string> = {
  tracked: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  "in-plan-not-reported": "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  "reported-not-in-plan": "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  silent: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};

export function AccountabilityMatrix({ data, onShowRegion }: { data: AccountabilityData; onShowRegion?: (r: AccRegion) => void }) {
  const kinds = (["ulb", "ia", "gp"] as const).filter((k) => data.regions.some((r) => r.kind === k));
  // Nothing pre-selected: the three kind tabs render alone; region chips
  // appear on tab click, the detail card on chip click.
  const [kind, setKind] = useState<AccRegion["kind"] | null>(null);
  const regions = kind ? data.regions.filter((r) => r.kind === kind) : [];
  const [regionKey, setRegionKey] = useState<string | null>(null);
  const region = regions.find((r) => r.key === regionKey) ?? (regions.length === 1 ? regions[0] : undefined);

  return (
    <section>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">Accountability: plan vs progress reports</div>
      <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200 leading-snug mb-1.5">{data.question}</p>
      {data.baseline.banner && (
        <p className="text-[11px] leading-snug rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-2 py-1.5 mb-2">
          {data.baseline.banner}
        </p>
      )}

      {/* Region-kind tabs */}
      <div className="flex gap-1 mb-1.5">
        {kinds.map((k) => (
          <button
            key={k}
            onClick={() => { setKind(k); setRegionKey(null); }}
            className={`text-[11px] px-2 py-1 rounded font-semibold border transition-colors ${
              k === kind
                ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            {ACC_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {kind && data.portalNote && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic leading-snug mb-1.5">{data.portalNote}</p>
      )}
      {/* Region chips */}
      {regions.length > 1 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {regions.map((r) => (
            <button
              key={r.key}
              onClick={() => setRegionKey(r.key)}
              className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                r.key === region?.key
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {r.name}
              {r.silentNote && <span aria-hidden className="ml-1 text-[9px] opacity-70">∅</span>}
            </button>
          ))}
        </div>
      )}

      {region && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-2">
          <div>
            <div className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{region.name}</div>
            {region.inBasinNote && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{region.inBasinNote}</p>}
            {region.mapMatch && onShowRegion && (
              <button onClick={() => onShowRegion(region)} className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
                Show {region.name} on the map →
              </button>
            )}
          </div>

          {region.silentNote ? (
            <p className="text-[12px] leading-snug rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-100 px-2 py-1.5">
              <span className={`inline-block align-middle mr-1.5 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${ACC_VERDICT_CLS.silent}`}>{ACC_VERDICT_LABEL.silent}</span>
              {region.silentNote}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {region.categories.map((c) => (
                <details key={c.key} className="group py-1.5">
                  <summary className="cursor-pointer list-none flex items-center gap-2">
                    <span aria-hidden className="text-slate-400 group-open:rotate-90 transition-transform text-[10px]">▸</span>
                    <span className="flex-1 text-[13px] font-semibold text-slate-800 dark:text-slate-100">{c.label}</span>
                    <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${ACC_VERDICT_CLS[c.verdict]}`}>{ACC_VERDICT_LABEL[c.verdict]}</span>
                  </summary>
                  <div className="mt-1.5 ml-4 space-y-1.5">
                    <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Action Plan{data.baseline.actionPlan.asOf ? ` (${data.baseline.actionPlan.asOf})` : ""}</div>
                      <p className="text-[12px] text-slate-700 dark:text-slate-200 leading-snug">{c.actionPlan.summary}</p>
                      {c.actionPlan.cite && <p className="text-[10px] text-slate-400 mt-0.5">{c.actionPlan.cite}</p>}
                    </div>
                    <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">MPR status <span className="normal-case">(as of {c.mpr.asOf})</span></div>
                      <p className="text-[12px] text-slate-700 dark:text-slate-200 leading-snug">{c.mpr.summary}</p>
                    </div>
                    {c.gaps && c.gaps.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-rose-500 font-semibold">Gap identified</div>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {c.gaps.map((g, i) => (
                            <li key={i} className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">{g}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {c.legalRef && data.legalLibrary?.[c.legalRef] && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Legal requirement</div>
                        {data.legalLibrary[c.legalRef].map((l, i) => (
                          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="block text-[12px] text-blue-600 dark:text-blue-400 hover:underline leading-snug">
                            {l.label} ↗
                          </a>
                        ))}
                      </div>
                    )}
                    {c.media && c.media.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Media reports</div>
                        {c.media.map((m, i) => (
                          <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="block text-[12px] text-blue-600 dark:text-blue-400 hover:underline leading-snug">
                            {m.label} ↗
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}

          {region.grievance && (
            <a
              href={region.grievance.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {region.grievance.label} ↗
            </a>
          )}
        </div>
      )}

      <p className="mt-1.5 text-[10px] text-slate-400 leading-snug">
        Baseline: {data.baseline.primary.label}, {data.baseline.primary.asOf}.{" "}
        <a href={data.baseline.actionPlan.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 hover:underline">{data.baseline.actionPlan.label} ↗</a>
        {data.baseline.primary.note && <span> {data.baseline.primary.note}</span>}
      </p>
    </section>
  );
}

/** "Key Terms Used on This Page" popup (Paani Phase-1 review): full forms of
 *  the acronyms with a line of context each, so the panel stays readable for
 *  first-time visitors without diluting the summary itself. */
function KeyTermsPopup({ terms, onClose }: { terms: { term: string; full: string; note?: string }[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Key terms used on this page">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Key terms used on this page</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <dl className="space-y-2.5">
          {terms.map((t) => (
            <div key={t.term}>
              <dt className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                {t.term} <span className="font-medium text-slate-500 dark:text-slate-400">- {t.full}</span>
              </dt>
              {t.note && <dd className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug mt-0.5">{t.note}</dd>}
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Small collapsible used for the PRS summary's footer meta sections. */
function PrsDisclosure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group border-t border-slate-200 dark:border-slate-700 pt-2">
      <summary className="cursor-pointer list-none flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
        <span aria-hidden className="text-slate-400 group-open:rotate-90 transition-transform">▸</span>
        {label}
      </summary>
      <div className="mt-1.5 space-y-1.5">{children}</div>
    </details>
  );
}

/** One year's generated-vs-treated bar: a single bar scaled to GENERATED,
 *  split into a treated/processed segment (blue) + an untreated-gap segment
 *  (red). When only one side is reported for a year, the bar is shown honestly
 *  (neutral / treated-only) rather than inventing a gap. `unit` = MLD | TPD. */
function GenTreatedBar({ year, gen, treated, max, unit }: { year: number; gen?: number; treated?: number; max: number; unit: string }) {
  const w = (v: number) => `${Math.max(0, (v / max) * 100)}%`;
  let segments: ReactNode;
  let value: string;
  if (gen != null && treated != null) {
    const tr = Math.min(treated, gen);
    segments = (
      <>
        <div style={{ width: w(tr), backgroundColor: "#3b82f6" }} title="treated/processed" />
        <div style={{ width: w(gen - tr), backgroundColor: "#b91c1c" }} title="gap" />
      </>
    );
    value = `${treated} / ${gen} ${unit}`;
  } else if (gen != null) {
    segments = <div style={{ width: w(gen), backgroundColor: "#94a3b8" }} title="generated (treatment not reported)" />;
    value = `${gen} ${unit} gen`;
  } else if (treated != null) {
    segments = <div style={{ width: w(treated), backgroundColor: "#3b82f6" }} title="treated/processed" />;
    value = `${treated} ${unit}`;
  } else {
    segments = null;
    value = "n/r";
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-slate-400 w-8 shrink-0">{year}</span>
      <div className="flex-1 h-4 rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden flex">{segments}</div>
      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-300 w-24 text-right shrink-0">{value}</span>
    </div>
  );
}

/** A unit's dual-timeline: one generated-vs-treated bar per year, then the
 *  infrastructure built + status. Generic over the quantity unit (MLD/TPD) and
 *  the treatment verb (treated/processed), so Sewage and Solid waste reuse it. */
function UnitTimeline({ unit, unitLabel, treatedVerb, onOpenUnit }: { unit: PrsUnit; unitLabel: string; treatedVerb: string; onOpenUnit: (u: string) => void }) {
  const genBy = new Map(unit.generation.map((p) => [p.year, p.value]));
  const trBy = new Map(unit.treated.map((p) => [p.year, p.value]));
  const years = Array.from(new Set([...genBy.keys(), ...trBy.keys()])).sort((a, b) => a - b);
  const maxV = Math.max(1, ...unit.generation.map((p) => p.value), ...unit.treated.map((p) => p.value));
  const gapWord = treatedVerb === "processed" ? "unprocessed" : "untreated";
  const toneColor: Record<string, string> = { good: "text-emerald-600", bad: "text-rose-600", neutral: "text-slate-400" };
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
      {unit.level && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">Reported at: {unit.level}</span>
        </div>
      )}
      {unit.caveat && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">⚠ {unit.caveat}</p>
      )}

      {/* Track 1: generated vs treated/processed, one bar per year */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Generated vs {treatedVerb} ({unitLabel}/year)</div>
        {years.length > 0 ? (
          <>
            <div className="space-y-1">
              {years.map((y) => (
                <GenTreatedBar key={y} year={y} gen={genBy.get(y)} treated={trBy.get(y)} max={maxV} unit={unitLabel} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[9px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded-sm" style={{ backgroundColor: "#3b82f6" }} />{treatedVerb}</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded-sm" style={{ backgroundColor: "#b91c1c" }} />{gapWord} gap</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded-sm" style={{ backgroundColor: "#94a3b8" }} />not reported</span>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-slate-400">{unit.generationNote ?? "Generation not separately reported."}</p>
        )}
        {years.length > 0 && unit.generationNote && (
          <p className="text-[10px] text-slate-400 mt-1 leading-snug">{unit.generationNote}</p>
        )}
        {typeof unit.gapValue === "number" && (
          <div className="mt-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 p-1.5 text-[12px] text-rose-800 dark:text-rose-200 leading-snug">
            ⚠ {gapWord.charAt(0).toUpperCase() + gapWord.slice(1)} gap {unit.gapValue} {unitLabel}{unit.gapNote ? ` - ${unit.gapNote}` : ""}
          </div>
        )}
      </div>

      {/* Track 2: infrastructure built + status */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Infrastructure &amp; status</div>
        {unit.capacity && <p className="text-[12px] text-slate-600 dark:text-slate-300">Capacity: {unit.capacity}</p>}
        {unit.infrastructure && unit.infrastructure.length > 0 && (
          <ul className="space-y-1 mt-1">
            {unit.infrastructure.map((it, i) => (
              <li key={i} className="text-[12px] text-slate-600 dark:text-slate-300 flex gap-1.5 leading-snug">
                <span aria-hidden className={`${toneColor[it.tone ?? "neutral"]} shrink-0`}>●</span>
                <span><span className="font-semibold">{it.label}:</span> {it.status}</span>
              </li>
            ))}
          </ul>
        )}
        {unit.dashboard && <p className="text-[11px] text-slate-400 mt-1">Public dashboard: {unit.dashboard}</p>}
      </div>

      {unit.otherStreams && unit.otherStreams.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Other waste streams</div>
          <ul className="space-y-0.5">
            {unit.otherStreams.map((s, i) => (
              <li key={i} className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">
                <span className="font-semibold">{s.label}:</span> {s.value}
              </li>
            ))}
          </ul>
        </div>
      )}

      {unit.gapUnit && (
        <button onClick={() => onOpenUnit(unit.gapUnit!)} className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Open this unit in the DEP snapshot →
        </button>
      )}
    </div>
  );
}

/** Cross-source treatment-gap panel: the "why does it persist" view - metrics,
 *  the gap over time, and what each document says, with citations. */
function GapPanel({ unit, note, onClose, onBack }: { unit: GapUnit; note?: string | null; onClose: () => void; onBack?: () => void }) {
  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to polluted stretch
        </button>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-rose-500">District Environment Plan (DEP) 2022 Snapshot{unit.level ? ` - ${unit.level}` : ""}</div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">{unit.name}</h2>
          {note && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{note}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      {unit.headline && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3">
          <div className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-rose-500 shrink-0">▶</span>
            <p className="text-[13px] font-semibold text-rose-900 dark:text-rose-100 leading-relaxed">{unit.headline}</p>
          </div>
        </div>
      )}
      {unit.coverage && (
        <p className="text-[11px] text-slate-400">Data coverage: {unit.coverage}</p>
      )}
      <GapConflicts conflicts={unit.conflicts} />
      <GapCaveats caveats={unit.caveats} />

      <GapStreamsBody unit={unit} />
      <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 leading-relaxed">
        Figures extracted from public documents; each line links to its source. Composition bars show generation by sector; hazardous &amp; biomedical are reported district-wide.
      </p>
    </div>
  );
}

function GapConflicts({ conflicts }: { conflicts?: string[] }) {
  if (!conflicts?.length) return null;
  return (
    <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-2.5">
      <div className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold mb-1">Points to reconcile across sources</div>
      <ul className="space-y-1 list-disc pl-4">
        {conflicts.map((c, i) => (
          <li key={i} className="text-[12px] text-amber-800 dark:text-amber-200 leading-snug">{c}</li>
        ))}
      </ul>
    </div>
  );
}

function GapCaveats({ caveats }: { caveats?: string[] }) {
  if (!caveats?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-2.5">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">Notes &amp; caveats</div>
      <ul className="space-y-1 list-disc pl-4">
        {caveats.map((c, i) => (
          <li key={i} className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">{c}</li>
        ))}
      </ul>
    </div>
  );
}

/** The waste-stream cards for one admin unit, grouped by medium with the
 *  sector legend and composition bars. Shared by the v1 GapPanel and the
 *  taluk tier of the v2 DepPanel. */
function GapStreamsBody({ unit }: { unit: GapUnit }) {
  const media: GapMedium[] = ["liquid", "solid"];
  const orphans = unit.streams.filter((s) => !s.medium);
  const presentSectors = SECTOR_ORDER.filter((sec) => unit.streams.some((s) => s.sector === sec));
  return (
    <div className="space-y-4">
      {presentSectors.length > 0 && (
        <div className="pt-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Colour = who generates it</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {presentSectors.map((sec) => (
              <span key={sec} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SECTOR_META[sec].color }} />
                {SECTOR_META[sec].label}
              </span>
            ))}
          </div>
        </div>
      )}
      {media.map((med) => {
        const ms = unit.streams.filter((s) => s.medium === med);
        if (!ms.length) return null;
        return (
          <section key={med} className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-3">
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{MEDIUM_LABEL[med]}</h3>
            <CompositionBar streams={ms} />
            <div className="space-y-3.5">
              {ms.map((s, i) => <StreamCard key={i} s={s} />)}
            </div>
          </section>
        );
      })}
      {orphans.map((s, i) => (
        <section key={`x${i}`} className="border-t border-slate-200 dark:border-slate-700 pt-3"><StreamCard s={s} /></section>
      ))}
    </div>
  );
}

// ── DEP Snapshot v2 panel (district-first) ───────────────────────────────────
// Theme labels/order live in @/lib/basins/panel-labels (shared with the PDF
// export); only the Tailwind chip classes are local to this surface.
const DEP_STATUS_CLS: Record<DepThemeStatus, string> = {
  covered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  "district-level": "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  "not-covered": "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};

/** One thematic-area entry: status chip, summary, metrics, and the plan's own
 *  action items (the accountability payload). Collapsible - a unit has up to
 *  12 entries (7 themes, waste split into 6 sub-plans). */
function DepThemeCard({ t, defaultOpen = false }: { t: DepTheme; defaultOpen?: boolean }) {
  const hasBody = Boolean(t.summary || t.metrics?.length || t.openActions?.length);
  return (
    <details className="group py-1.5" open={defaultOpen && hasBody}>
      <summary className={`list-none flex items-center gap-2 ${hasBody ? "cursor-pointer" : "cursor-default"}`}>
        {hasBody && <span aria-hidden className="text-slate-400 text-[10px] transition-transform group-open:rotate-90">▶</span>}
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 flex-1">{depThemeTitle(t)}</span>
        <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${DEP_STATUS_CLS[t.status]}`}>{DEP_STATUS_LABEL[t.status]}</span>
      </summary>
      {hasBody && (
        <div className="pl-4 pt-1.5 space-y-2">
          {t.summary && <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">{t.summary}</p>}
          {t.metrics && t.metrics.length > 0 && (
            <dl className="space-y-1.5">
              {t.metrics.map((m, j) => (
                <div key={j} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[13px] text-slate-500 dark:text-slate-400">{m.label}</dt>
                  <dd className={`text-[13px] tabular-nums text-right ${m.emphasis === "good" ? "font-bold text-emerald-600 dark:text-emerald-400" : m.emphasis ? "font-bold text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}`}>{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {t.openActions && t.openActions.length > 0 && (
            <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-2">
              <div className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold mb-1">Action items in the plan</div>
              <ul className="space-y-1 list-disc pl-4">
                {t.openActions.map((a, i) => (
                  <li key={i} className="text-[12px] text-amber-800 dark:text-amber-200 leading-snug">{a}</li>
                ))}
              </ul>
            </div>
          )}
          {(t.pages?.length || t.ocrUncertain) && (
            <p className="text-[10px] text-slate-400">
              {t.pages?.length ? `DEP p. ${t.pages.join(", ")}` : null}
              {t.ocrUncertain ? `${t.pages?.length ? " - " : ""}read via OCR from a scanned plan; values approximate` : null}
            </p>
          )}
        </div>
      )}
    </details>
  );
}

/** A unit's thematic areas in canonical NGT order (waste sub-plans inline). */
function DepThemeList({ themes }: { themes: DepTheme[] }) {
  const ordered = [...themes].sort((a, b) => DEP_THEME_ORDER.indexOf(a.theme) - DEP_THEME_ORDER.indexOf(b.theme));
  if (!ordered.length) return null;
  return <div className="divide-y divide-slate-100 dark:divide-slate-800">{ordered.map((t, i) => <DepThemeCard key={i} t={t} />)}</div>;
}

function DepShowOnMap({ name, match, onShowMatch }: { name: string; match?: MapMatch; onShowMatch?: (m: MapMatch) => void }) {
  if (!match || !onShowMatch) return null;
  return (
    <button onClick={() => onShowMatch(match)} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
      Show {name} on the map →
    </button>
  );
}

function DepPanel({ data, focusTaluk, onSelectTaluk, onHighlight, onShowMatch, onClose, onBack }: {
  data: DepData;
  focusTaluk: string | null;
  onSelectTaluk: (key: string) => void;
  /** Which gap polygon the map should light up for what this panel is showing. */
  onHighlight: (key: string | null) => void;
  onShowMatch: (m: MapMatch) => void;
  onClose: () => void;
  onBack?: () => void;
}) {
  // The key that opened the panel is a ULB key (PRS "open in the DEP" links)
  // or a taluk key (map badges): land on its district with that card open.
  // ULBs win the lookup - 'bbmp' names both the ULB and the city-taluks tab,
  // and the ULB card carries the substance. GOV_TAB is the governance tab.
  const GOV_TAB = "__governance";
  const homeDistrict = useMemo(
    () =>
      data.districts.find((d) => d.ulbs.some((u) => u.key === focusTaluk) || d.taluks.some((t) => t.key === focusTaluk)) ??
      data.districts[0],
    [data.districts, focusTaluk],
  );
  const [tab, setTab] = useState<string>(homeDistrict?.key ?? GOV_TAB);
  const [view, setView] = useState<{ kind: "district" } | { kind: "ulb"; key: string } | { kind: "taluk"; key: string }>(() => {
    if (focusTaluk && homeDistrict?.ulbs.some((u) => u.key === focusTaluk)) return { kind: "ulb", key: focusTaluk };
    if (focusTaluk && homeDistrict?.taluks.some((t) => t.key === focusTaluk)) return { kind: "taluk", key: focusTaluk };
    return { kind: "district" };
  });
  // Clicking another map badge while the panel is open changes focusTaluk
  // without remounting - follow it (state-adjustment-during-render pattern).
  //
  // A bare key can't say which kind was meant, and "bbmp" names both a ULB and
  // a taluk. Our own chips set the view before reporting the key, so if the
  // panel already shows that exact unit the caller's intent is on screen and
  // re-resolving would override it - which made the "Bengaluru North & South"
  // taluk chip bounce to the BBMP ULB card. Only genuinely external focus
  // changes get resolved, and those keep ULB precedence.
  const [lastFocus, setLastFocus] = useState(focusTaluk);
  if (focusTaluk !== lastFocus) {
    setLastFocus(focusTaluk);
    const alreadyShown = view.kind !== "district" && view.key === focusTaluk;
    if (focusTaluk && homeDistrict && !alreadyShown) {
      if (homeDistrict.ulbs.some((u) => u.key === focusTaluk)) {
        setTab(homeDistrict.key);
        setView({ kind: "ulb", key: focusTaluk });
      } else if (homeDistrict.taluks.some((t) => t.key === focusTaluk)) {
        setTab(homeDistrict.key);
        setView({ kind: "taluk", key: focusTaluk });
      }
    }
  }
  const district = data.districts.find((d) => d.key === tab) ?? null;
  const selUlb = district && view.kind === "ulb" ? district.ulbs.find((u) => u.key === view.key) ?? null : null;
  const selTaluk = district && view.kind === "taluk" ? district.taluks.find((t) => t.key === view.key) ?? null : null;

  // One place decides what the map lights up, so every route in here - chips,
  // district tabs, governance, and the map-badge sync above - stays honest.
  // Without this the old taluk stayed lit under unrelated content.
  const isPolygonKey = (key: string) => data.districts.some((d) => d.taluks.some((t) => t.key === key));
  useEffect(() => {
    if (tab === GOV_TAB || !district) return onHighlight(null);
    if (selTaluk) return onHighlight(selTaluk.key);
    // A ULB normally has no gap polygon; its map cue is "Show <ULB> on the map".
    // BBMP is the exception - it is deliberately both a ULB and a taluk key, and
    // the polygons it names are literally the "BBMP city-wide" pair, so lighting
    // them for the BBMP card shows exactly the area the card describes.
    if (selUlb) return onHighlight(isPolygonKey(selUlb.key) ? selUlb.key : null);
    return onHighlight(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, district, selTaluk, selUlb, data.districts, onHighlight]);

  const chip = (active: boolean) =>
    `text-[11px] px-2 py-0.5 rounded border transition-colors ${active
      ? "bg-rose-600 text-white border-rose-600"
      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"}`;

  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to polluted stretch
        </button>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-rose-500">{data.title ?? "District Environment Plan (DEP) 2022 Snapshot"}</div>
          {data.note && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{data.note}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* District tabs + governance. DEPs are district documents, so the
          district - not the taluk - is the entry axis (Paani review). */}
      <div className="flex flex-wrap gap-1.5">
        {data.districts.map((d) => (
          <button key={d.key} onClick={() => { setTab(d.key); setView({ kind: "district" }); }} className={chip(tab === d.key)}>
            {d.name}
          </button>
        ))}
        {data.governance && (
          <button onClick={() => { setTab(GOV_TAB); setView({ kind: "district" }); }} className={chip(tab === GOV_TAB)}>
            Governance &amp; compliance
          </button>
        )}
      </div>

      {tab === GOV_TAB && data.governance ? (
        <DepGovernanceView gov={data.governance} />
      ) : district ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">{district.name}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              <a href={district.dep.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{district.dep.label} ↗</a>
              {district.dep.note ? ` - ${district.dep.note}` : ""}
            </p>
            <DepShowOnMap name={district.name} match={district.mapMatch} onShowMatch={onShowMatch} />
          </div>

          {/* Basin-share stat + admin composition of the district. */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-slate-500 dark:text-slate-400">Share of the district inside the Arkavathi basin</span>
              <span className="text-[15px] font-bold tabular-nums text-slate-900 dark:text-slate-100">{district.pctInBasin}%</span>
            </div>
            <div className="h-1.5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-rose-500/80" style={{ width: `${Math.min(district.pctInBasin, 100)}%` }} />
            </div>
            {district.counts && district.counts.length > 0 && (
              <dl className="pt-1 space-y-1">
                {district.counts.map((c, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3">
                    <dt className="text-[12px] text-slate-500 dark:text-slate-400">{c.label}</dt>
                    <dd className="text-[12px] tabular-nums font-semibold text-slate-700 dark:text-slate-300">{c.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {district.countsNote && <p className="text-[10px] text-slate-400 leading-snug">{district.countsNote}</p>}
          </div>

          {/* Sub-navigation: district-wide themes / ULBs / taluks. */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <button onClick={() => setView({ kind: "district" })} className={chip(view.kind === "district")}>District-wide</button>
            {district.ulbs.map((u) => (
              <button
                key={u.key}
                // Tell the map too, or it keeps a previously picked taluk lit
                // while the panel has moved on to a ULB. A ULB key has no gap
                // polygon, so this clears the highlight rather than moving it.
                onClick={() => { setView({ kind: "ulb", key: u.key }); onSelectTaluk(u.key); }}
                className={chip(view.kind === "ulb" && view.key === u.key)}
              >
                {u.name} ({u.type})
              </button>
            ))}
          </div>
          {district.taluks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Taluks</span>
              {district.taluks.map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setView({ kind: "taluk", key: t.key }); onSelectTaluk(t.key); }}
                  className={chip(view.kind === "taluk" && view.key === t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {view.kind === "district" && (
            <>
              <GapConflicts conflicts={district.conflicts} />
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">The 7 NGT thematic areas - district-wide</div>
                <DepThemeList themes={district.districtThemes} />
              </div>
            </>
          )}
          {selUlb && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-2">
              <div>
                <div className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{selUlb.name} ({selUlb.type})</div>
                {selUlb.note && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{selUlb.note}</p>}
                {selUlb.gazette && (
                  <a href={selUlb.gazette.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5">
                    {selUlb.gazette.label} ↗
                  </a>
                )}
                <DepShowOnMap name={`${selUlb.name} (${selUlb.type})`} match={selUlb.mapMatch} onShowMatch={onShowMatch} />
              </div>
              <GapConflicts conflicts={selUlb.conflicts} />
              <DepThemeList themes={selUlb.themes} />
            </div>
          )}
          {selTaluk && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-2">
              <div>
                <div className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{selTaluk.label} (taluk)</div>
                {selTaluk.note && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{selTaluk.note}</p>}
                <DepShowOnMap name={`${selTaluk.label} (taluk)`} match={selTaluk.mapMatch} onShowMatch={onShowMatch} />
              </div>
              {selTaluk.themes.length > 0 ? (
                <>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">What the plan reports at taluk level</div>
                  <DepThemeList themes={selTaluk.themes} />
                </>
              ) : (
                <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-snug">No taluk-level reporting in this plan.</p>
              )}
            </div>
          )}

          {district.industrialAreas && district.industrialAreas.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Industrial areas in the district (falling within Arkavathi Basin)</span>
                {district.industrialAreas.map((ia, i) =>
                  ia.mapMatch ? (
                    <button key={i} onClick={() => onShowMatch(ia.mapMatch!)} className={chip(false)}>{ia.name} ↗</button>
                  ) : (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500">{ia.name}</span>
                  ),
                )}
              </div>
              {district.industrialAreasNote && <p className="text-[10px] text-slate-400 leading-snug">{district.industrialAreasNote}</p>}
              <GapConflicts conflicts={district.industrialAreasConflicts} />
            </div>
          )}
        </div>
      ) : null}

      <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 leading-relaxed">
        Figures extracted from the District Environment Plans; each entry cites its page in the source document. Themes follow the NGT&apos;s 7 thematic areas (OA 360/2018).
      </p>
    </div>
  );
}

function DepGovernanceView({ gov }: { gov: DepGovernance }) {
  return (
    <div className="space-y-3">
      {gov.items.map((it, i) => (
        <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
          <div className="text-[13px] font-bold text-slate-900 dark:text-slate-100 mb-1">{it.heading}</div>
          <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">{it.body}</p>
          {it.source && (
            <div className="mt-1.5 text-[13px] leading-relaxed">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{it.source.source}:</span>{" "}
              <span className="text-slate-600 dark:text-slate-400">{it.source.says}</span>
              {it.source.url ? (
                <a href={it.source.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5">
                  {it.source.citation} ↗
                </a>
              ) : (
                <span className="block text-[11px] text-slate-400 italic mt-0.5">{it.source.citation}</span>
              )}
            </div>
          )}
        </div>
      ))}
      {gov.gaps.length > 0 && (
        <div className="rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-2.5">
          <div className="text-[11px] uppercase tracking-wider text-rose-700 dark:text-rose-400 font-semibold mb-1">The compliance gap</div>
          <ul className="space-y-1 list-disc pl-4">
            {gov.gaps.map((g, i) => (
              <li key={i} className="text-[12px] text-rose-800 dark:text-rose-200 leading-snug">{g}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Sector composition for one medium: a single stacked bar, normalised to the
 *  medium's common unit (MLD / TPD), coloured by who generates the waste.
 *  District-wide figures are striped so taluk precision is never implied. */
function CompositionBar({ streams }: { streams: GapStream[] }) {
  const segs = streams
    .filter((s) => s.magnitude && s.sector)
    .sort((a, b) => SECTOR_ORDER.indexOf(a.sector!) - SECTOR_ORDER.indexOf(b.sector!));
  if (!segs.length) return null;
  const total = segs.reduce((n, s) => n + s.magnitude!.perDay, 0);
  if (total <= 0) return null;
  const u = segs[0].magnitude!.unit;
  const anyDistrict = segs.some((s) => s.granularity === "district");
  const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString() : n >= 10 ? n.toFixed(0) : n.toFixed(n < 1 ? 2 : 1));
  const swatch = (sec: GapSector, district: boolean) => {
    const { color, dark } = SECTOR_META[sec];
    return district
      ? { backgroundImage: `repeating-linear-gradient(45deg, ${color}, ${color} 4px, ${dark} 4px, ${dark} 8px)` }
      : { backgroundColor: color };
  };
  return (
    <div>
      <div className="flex h-5 w-full rounded overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700">
        {segs.map((s, i) => {
          const pct = (s.magnitude!.perDay / total) * 100;
          const district = s.granularity === "district";
          return (
            <div
              key={i}
              style={{ width: `${pct}%`, ...swatch(s.sector!, district) }}
              title={`${s.stream}: ${fmt(s.magnitude!.perDay)} ${u} - ${district ? "district-wide" : "this taluk"}`}
              className="flex items-center justify-center overflow-hidden"
            >
              {pct >= 11 && (
                <span className="text-[9px] font-semibold text-white px-0.5 truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                  {fmt(s.magnitude!.perDay)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {segs.map((s, i) => {
          const district = s.granularity === "district";
          return (
            <li key={i} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={swatch(s.sector!, district)} />
                <span className="truncate text-slate-600 dark:text-slate-300">{s.stream}</span>
                {district && <span className="text-[8px] uppercase tracking-wide text-slate-400 shrink-0">district</span>}
              </span>
              <span className="tabular-nums text-slate-500 dark:text-slate-400 shrink-0">{fmt(s.magnitude!.perDay)} {u}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] text-slate-400 mt-1 leading-snug">
        Generation by sector ({u}){anyDistrict ? "; striped = district-wide, shared across the district's taluks" : ""}.
      </p>
    </div>
  );
}

/** Plain-language gloss for a waste stream: what it is, so "hazardous" or "C&D"
 *  isn't jargon. Keyed by keyword so it survives label tweaks. */
function wasteWhat(stream: string): string {
  const n = stream.toLowerCase();
  if (n.includes("hazardous")) return "toxic/chemical waste needing special disposal - solvents, acids, used oil, heavy-metal sludge";
  if (n.includes("biomedical")) return "infectious/clinical waste from hospitals and clinics";
  if (n.includes("c&d") || n.includes("construction")) return "rubble, concrete and soil from building and demolition";
  if (n.includes("municipal") || n.includes("solid waste")) return "everyday household and commercial garbage";
  if (n.includes("sewage")) return "domestic wastewater from homes and businesses";
  if (n.includes("effluent")) return "liquid waste discharged by factories";
  return "";
}

/** One stream's detail card: sector swatch + granularity tag, metrics, optional
 *  trend, and the cited "what the documents say" block. */
function StreamCard({ s }: { s: GapStream }) {
  const what = wasteWhat(s.stream);
  return (
    <div>
      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {s.sector && <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SECTOR_META[s.sector].color }} />}
        <span>{s.stream}</span>
        {s.granularity === "district" && (
          <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">district-wide</span>
        )}
      </h4>
      {s.sector && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          <span className="font-medium text-slate-600 dark:text-slate-300">Generated by {SECTOR_META[s.sector].label.toLowerCase()}</span>
          {what ? ` - ${what}` : ""}
        </p>
      )}
      <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-2.5 mt-1.5 leading-relaxed">{s.summary}</p>

      <dl className="space-y-1.5 mb-3">
        {s.metrics.map((m, j) => (
          <div key={j} className="flex items-baseline justify-between gap-3">
            <dt className="text-[13px] text-slate-500 dark:text-slate-400">{m.label}</dt>
            <dd className={`text-[13px] tabular-nums text-right ${m.emphasis === "good" ? "font-bold text-emerald-600 dark:text-emerald-400" : m.emphasis ? "font-bold text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}`}>{m.value}</dd>
          </div>
        ))}
      </dl>

      {s.trend && s.trend.points.length > 0 && <GapTrend trend={s.trend} />}

      <div className="mt-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-slate-400">What the documents say</div>
        {s.sources.map((src, k) => (
          <div key={k} className="text-[13px] leading-relaxed">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{src.source}:</span>{" "}
            <span className="text-slate-600 dark:text-slate-400">{src.says}</span>
            {src.url ? (
              <a href={src.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5">
                {src.citation} ↗
              </a>
            ) : (
              <span className="block text-[11px] text-slate-400 italic mt-0.5">{src.citation}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tiny inline bar chart - equal bars across years make "frozen, nothing
 *  changed" read at a glance. */
function GapTrend({ trend }: { trend: NonNullable<GapStream["trend"]> }) {
  const max = Math.max(...trend.points.map((p) => p.value ?? 0), 1);
  return (
    <div className="mb-2">
      <div className="text-[11px] text-slate-400 mb-1">{trend.label}</div>
      <div className="flex items-end gap-1 h-14">
        {trend.points.map((p, i) => {
          const hasVal = p.value != null;
          const bar = hasVal ? (
            <div className="w-full bg-rose-400/80 dark:bg-rose-500/70 rounded-sm group-hover:bg-rose-500" style={{ height: `${Math.max(((p.value as number) / max) * 100, 6)}%` }} />
          ) : (
            <div className="w-full border border-dashed border-slate-400/60 rounded-sm" style={{ height: "30%" }} />
          );
          const yr = <span className={`text-[9px] tabular-nums ${p.url ? "text-blue-600 dark:text-blue-400 group-hover:underline" : "text-slate-400"}`}>{String(p.year).slice(2)}</span>;
          const title = hasVal
            ? `${p.year}: ${p.value}${trend.unit ? " " + trend.unit : ""}${p.url ? " - open report" : ""}`
            : `${p.year}: ${p.note ?? "not reported"}${p.url ? " - open report" : ""}`;
          const inner = (<>{bar}{!hasVal && <span className="text-[8px] text-slate-400 leading-none">n/r</span>}{yr}</>);
          return p.url ? (
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" title={title} className="group flex-1 flex flex-col items-center justify-end gap-0.5">
              {inner}
            </a>
          ) : (
            <div key={i} title={title} className="flex-1 flex flex-col items-center justify-end gap-0.5">{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

function DataOnThisMap({ manifest, inventory }: { manifest: BasinManifest; inventory: BasinInventory | null }) {
  const [open, setOpen] = useState(false);
  if (!inventory) return null;
  const layersWithData = manifest.layers.filter((l) => inventory.families[l.family]);
  return (
    <div className="border-t border-slate-200 dark:border-slate-700 mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between"
      >
        Data on this map
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 text-[11px] text-slate-500 dark:text-slate-400">
          {/* Collaboration credit - manifest-declared; the partner's name is
              in the logo itself (alt text carries it). Light chip keeps the
              colour logo readable in dark mode. */}
          {manifest.collaboration && (
            <a
              href={manifest.collaboration.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="block group rounded-md border border-slate-200 dark:border-slate-700 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <span className="block text-[10px] uppercase tracking-wider text-slate-400">{manifest.collaboration.label}</span>
              <span className="mt-1 block rounded bg-white px-2 py-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={manifest.collaboration.logo} alt={manifest.collaboration.name} className="w-full max-w-[210px] h-auto" />
              </span>
              {manifest.collaboration.sub && (
                <span className="block text-slate-400 group-hover:underline">{manifest.collaboration.sub}</span>
              )}
            </a>
          )}

          {/* Consolidated layer inventory (counts only - provenance is in Sources). */}
          <div>
            <div className="text-slate-600 dark:text-slate-300 font-medium mb-1">Layers ({layersWithData.length})</div>
            <div className="space-y-0.5">
              {layersWithData.map((l) => (
                <div key={layerKey(l)} className="flex justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300">{l.label}</span>
                  <span className="tabular-nums text-slate-400">{(l.kindFilter && inventory.families[l.family].sources.find((sc) => sc.kind === l.kindFilter)?.count) || inventory.families[l.family].featureCount}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
            <div className="text-slate-600 dark:text-slate-300 font-medium mb-1">Sources</div>
            {manifest.credits.map((c, i) => <div key={i} className="leading-snug">{c}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

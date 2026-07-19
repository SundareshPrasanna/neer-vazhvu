"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Circle, Tooltip, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import { MapResizer } from "@/components/map-resizer";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { useMapTiles } from "@/lib/utils/map-tiles";
import type {
  BasinFloor,
  BasinInventory,
  BasinLayer,
  BasinManifest,
} from "@/lib/basins";
import { tryGetBasinManifest } from "@/lib/basins";
import "leaflet/dist/leaflet.css";

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
interface GapSource { source: string; says: string; citation: string; url?: string }
type GapMedium = "liquid" | "solid";
type GapSector = "public" | "industry" | "institutional" | "construction";
interface GapStream {
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
interface GapUnit { name: string; level?: string; coverage?: string; conflicts?: string[]; caveats?: string[]; headline: string; streams: GapStream[] }

// ── PRS (Polluted River Stretch) entry-point panel (prs.json) ────────────────
// Tabbed surface: each tab is a stressor theme; the subtab axis differs per
// theme (Sewage = admin units along the stretch; Industrial/Solid/PRS = named
// sub-categories). The selected tab+subtab shows two parallel 2021-2025 tracks:
// generation and the infrastructure built (per the partner's PDF, page 3).
interface PrsYearPoint { year: number; value: number }
interface PrsInfraItem { label: string; status: string; tone?: "good" | "bad" | "neutral" }
interface PrsUnit {
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
interface PrsCategory {
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
interface PrsTab {
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
interface PrsData {
  river: string;
  stretchName: string;
  comparison: { y2020: { length_km: number; priority: string }; y2025: { length_km: number; priority: string } };
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
  categories: AccCategory[];
}
export interface AccountabilityData {
  question: string;
  intro?: string;
  baseline: {
    primary: { label: string; asOf: string; note?: string };
    actionPlan: { label: string; url: string };
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
  if (l.gap) return -1; // gap choropleth at the very bottom - all data (incl. STPs) sits above it
  if (l.prs) return 5; // polluted stretch always on top so the thin line stays clickable
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
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
    const startFloor = initialFloor ?? "hydrology";
    return Object.fromEntries(
      manifest.layers.map((l) => [
        l.family,
        l.defaultOn && (l.context || l.prs || l.floor === startFloor),
      ]),
    );
  });
  // Which floors' toggle lists are expanded in the rail. Only the entry floor
  // opens by default (a calm landing); others collapse with a chevron so it's
  // clear they open. Collapsing only hides the list - layers stay rendered.
  const [expandedFloors, setExpandedFloors] = useState<Set<BasinFloor>>(
    () => new Set<BasinFloor>([initialFloor ?? "hydrology"]),
  );
  const [selectedRiverId, setSelectedRiverId] = useState<string | null>(initialRiverId);
  const [selectedFeature, setSelectedFeature] = useState<{ family: string; props: Record<string, unknown> } | null>(null);
  const [selectedGapUnit, setSelectedGapUnit] = useState<string | null>(null);
  const [gapData, setGapData] = useState<Record<string, GapUnit>>({});
  // PRS entry-point panel: open when the polluted-stretch line is clicked.
  const [selectedPrs, setSelectedPrs] = useState(false);
  const [prsData, setPrsData] = useState<PrsData | null>(null);
  const [accData, setAccData] = useState<AccountabilityData | null>(null);
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
      .then((d) => setGapData(((d as unknown as { units?: Record<string, GapUnit> })?.units) ?? {}))
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
    if (unit && gapData[unit]) {
      setSelectedGapUnit(unit);
      setSelectedFeature(null);
      didDefaultGapRef.current = true;
    }
  }, [gapData, initialFloor, manifest.defaultGapUnit]);

  useEffect(() => {
    setCoachDismissed(localStorage.getItem(COACH_KEY) === "1");
    if (embedded) return;
    const p = new URLSearchParams(window.location.search);
    const r = p.get("river");
    const lvl = p.get("level") as BasinFloor | null;
    if (r && manifest.rivers.some((x) => x.riverId === r)) setSelectedRiverId(r);
    if (lvl && FLOORS.some((f) => f.id === lvl)) setFocusedFloor(lvl);
  }, [manifest.rivers, embedded]);

  useEffect(() => {
    if (embedded) return;
    const p = new URLSearchParams(window.location.search);
    if (selectedRiverId) p.set("river", selectedRiverId);
    else p.delete("river");
    p.set("level", focusedFloor);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [selectedRiverId, focusedFloor, embedded]);

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
    return enabled[l.family] ?? l.defaultOn;
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
  // boundary/shed data (stable references once loaded) and the selection - NOT
  // the whole `data` object - so changing floors never refits/resets the zoom.
  const shedData = data["sub-hydrosheds"];
  const boundaryData = data["boundary"];
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
      feats = boundaryData?.features ?? [];
    }
    if (!feats.length) return null;
    const b = L.geoJSON({ type: "FeatureCollection", features: feats } as FC).getBounds();
    return b.isValid() ? b : null;
  }, [selectedRiverId, shedData, boundaryData, selectedSheds, manifest.defaultFocus]);

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
    // so a river selection must not filter it out.
    if (!selectedRiverId || layer.context || layer.gap || layer.prs || selectedSheds.size === 0)
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
  // The basin has a PRS story when a prs layer is declared and its panel
  // content has loaded - this gates the "Explore the polluted stretch" entry
  // point, which must be offered even while the stretch itself is hidden
  // (the layer is default-off per Paani's Phase-1 review).
  const hasPrsStory = manifest.layers.some((l) => l.prs) && prsData !== null;
  // The growth toggle is only meaningful when the PRS layer is on the map AND
  // there is more than one survey year to compare.
  const prsVisible =
    manifest.layers.some((l) => l.prs && shouldRender(l)) &&
    (data["prs"]?.features?.length ?? 0) > 1;

  // Derived insight (Madhuri's CAG ask): when the pressures layer is shown,
  // how many industrial areas have no CETP nearby - computed live from the data.
  const legendNotes = useMemo(() => {
    const out: string[] = [];
    if (visibleLayers.some((l) => l.family === "pressures-industrial")) {
      const ind = (data["pressures-industrial"]?.features ?? []).filter(
        (f) => (f.properties as Record<string, unknown>)?.kind === "industrial-area",
      );
      const none = ind.filter((f) => (f.properties as Record<string, unknown>)?.cetp === "none").length;
      if (ind.length) out.push(`≈${none} of ${ind.length} industrial areas have no CETP within ~5 km - CAG-flagged gap, spatial estimate (8 of 18 KIADB areas)`);
    }
    return out;
  }, [visibleLayers, data]);

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
            const onCount = floorLayers(f.id).filter((l) => enabled[l.family] ?? l.defaultOn).length;
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
                        <label key={l.family} className="flex items-start gap-2 text-xs cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={enabled[l.family] ?? l.defaultOn}
                            onChange={(e) => setEnabled((s) => ({ ...s, [l.family]: e.target.checked }))}
                            className="mt-0.5 accent-blue-600"
                          />
                          <span className="flex items-center gap-1.5 leading-tight">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: l.color }} />
                            <span className="text-slate-600 dark:text-slate-300">
                              {l.label}
                              {inv && <span className="text-slate-400"> ({inv.featureCount})</span>}
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
                <label key={l.family} className="flex items-start gap-2 text-xs cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={enabled[l.family] ?? l.defaultOn}
                    onChange={(e) => {
                      setFocusedFloor(l.floor);
                      setEnabled((s) => ({ ...s, [l.family]: e.target.checked }));
                    }}
                    className="mt-0.5 accent-blue-600"
                  />
                  <span className="flex items-center gap-1.5 leading-tight">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: l.color }} />
                    <span className="text-slate-600 dark:text-slate-300">
                      {l.label}
                      {inv && <span className="text-slate-400"> ({inv.featureCount})</span>}
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
      <div className="relative flex-1 h-full min-h-[320px]">
        <MapContainer center={manifest.mapCenter} zoom={manifest.mapZoom} className="h-full w-full" preferCanvas zoomControl={false}>
          <ZoomControl position="bottomright" />
          <MapResizer />
          <MapController fitBounds={fitBounds} defaultFocus={manifest.defaultFocus} hasSelection={selectedRiverId != null} />
          <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />

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
            // PRS: by default only the latest year's stretch is shown; the
            // growth toggle reveals the earlier year too. Sort so the EARLIER
            // (2020) line draws on top of the later (2025) one, so the segments
            // left red are exactly the 2020->2025 growth.
            if (l.prs) {
              const years = feats.map((f) => Number((f.properties as Record<string, unknown>)?.year));
              const maxYear = years.length ? Math.max(...years) : 0;
              feats = feats
                .filter((f) => showGrowth || Number((f.properties as Record<string, unknown>)?.year) === maxYear)
                .slice()
                .sort((a, b) => Number((b.properties as Record<string, unknown>)?.year) - Number((a.properties as Record<string, unknown>)?.year));
            }
            if (!feats.length) return null;
            const fcScoped: FC = { type: "FeatureCollection", features: feats };
            const faded = dim();

            // Gap layer: only the choropleth FILL is drawn here (at the very
            // bottom, drawRank -1, non-interactive) so it never sits over or
            // blocks the STPs/features above it. The clickable badge is rendered
            // separately, last, so it stays on top and openable.
            if (l.gap) {
              return (
                <GeoJSON
                  key={`gapfill-${selectedRiverId}-${tiles.isDark}-${selectedGapUnit ?? ""}`}
                  data={fcScoped}
                  interactive={false}
                  style={(feat?: Feature) => fillStyle(l, feat, faded, selectedGapUnit)}
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
                  style={(feat?: Feature) => lineStyle(l, feat, manifest, selectedRiverId, faded, l.prs && showGrowth)}
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
              return (
                <GeoJSON
                  key={`${l.family}-${selectedRiverId}`}
                  data={fcScoped}
                  pointToLayer={(feat, latlng) =>
                    L.circleMarker(latlng, pointStyle(l, feat, faded))
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
            // boundary + always-on district are non-interactive context; the
            // opt-in admin levels (taluk/town/GP) are tappable to reveal their
            // place in the hierarchy.
            const isBase = l.family === "boundary" || l.family === "admin-district";
            const isAdmin = l.family.startsWith("admin");
            return (
              <GeoJSON
                key={`${l.family}-${selectedRiverId}-${tiles.isDark}`}
                data={fcScoped}
                interactive={!isBase}
                style={(feat?: Feature) => fillStyle(l, feat, faded)}
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
              const dimmed = selectedGapUnit != null && selectedGapUnit !== unit;
              const isSel = selectedGapUnit === unit;
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
                    key={`gapbadge-${unit}-${idx}-${pi}-${selectedGapUnit ?? ""}`}
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

        {/* "Where am I?" control + status. Bottom-right, lifted above the zoom
            control; the bottom-left corner is taken by the MapLegend. */}
        <div className="absolute bottom-24 right-3 z-[500] flex flex-col items-end gap-1.5 max-w-[70%]">
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
          <button
            onClick={locateMe}
            disabled={locating}
            aria-label="Show my location on the map"
            className="rounded-md shadow px-3 py-1.5 text-xs font-medium border bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 flex items-center gap-1.5"
          >
            <span aria-hidden>◎</span>
            {locating ? "Locating…" : userLocation ? "Recenter on me" : "Where am I?"}
          </button>
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

        {/* Reset: clears ANY active selection (river scope, gap unit, or clicked
            feature) so every layer shows basin-wide and nothing is greyed out,
            and flies back to the overview. */}
        {(selectedRiverId || selectedGapUnit || selectedFeature || selectedPrs) && (
          <button
            onClick={() => { setSelectedGapUnit(null); setSelectedFeature(null); setSelectedPrs(false); setGapFromPrs(false); selectRiver(null); }}
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
            {prsVisible && (
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
              {showGrowth ? (
                <>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-[3px] rounded" style={{ backgroundColor: "#f97316" }} />polluted by 2020 (Priority III)</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-[2px] rounded" style={{ backgroundColor: "#dc2626" }} />added by 2025 → now Priority I</span>
                </>
              ) : (
                <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-[2px] rounded" style={{ backgroundColor: "#dc2626" }} />polluted stretch, 2025 (Priority I)</span>
              )}
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
        <MapLegend layers={visibleLayers} notes={legendNotes} raised={!!(selectedGapUnit || selectedFeature || selectedRiver || selectedPrs)} />
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
                layerByFamily={layerByFamily}
                onOpenUnit={(u) => { setSelectedPrs(false); setSelectedFeature(null); setSelectedGapUnit(u); setGapFromPrs(true); }}
                onShowLayer={(family) => {
                  const lyr = layerByFamily[family];
                  setEnabled((s) => ({ ...s, [family]: true }));
                  if (lyr) {
                    setFocusedFloor(lyr.floor);
                    setExpandedFloors((s) => { const n = new Set(s); n.add(lyr.floor); return n; });
                  }
                }}
                onClose={() => setSelectedPrs(false)}
              />
            ) : selectedGapUnit && gapData[selectedGapUnit] ? (
              <GapPanel
                unit={gapData[selectedGapUnit]}
                onClose={() => { setSelectedGapUnit(null); setGapFromPrs(false); }}
                onBack={gapFromPrs ? () => { setSelectedGapUnit(null); setGapFromPrs(false); setSelectedPrs(true); } : undefined}
              />
            ) : selectedFeature ? (
              renderFeatureDetail?.({
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

type LegendSym = "box" | "dot" | "ring" | "line" | "dash" | "outline";

/** Dynamic legend: one entry per symbol actually on the map right now,
 *  expanding pressures into its kinds and showing the monitoring public-domain
 *  cue (filled vs hollow). */
function MapLegend({ layers, notes, raised }: { layers: BasinLayer[]; notes?: string[]; raised?: boolean }) {
  const [open, setOpen] = useState(true);
  // Every entry's color comes from the layer's manifest `color` or the shared
  // PRESSURE_KIND_COLOR map - the same sources the map styles read - so the
  // legend can never disagree with what's drawn.
  const items: { sym: LegendSym; color: string; label: string }[] = [];
  for (const l of layers) {
    if (l.gap) {
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
    else if (l.family === "monitoring-points") {
      items.push({ sym: "dot", color: l.color, label: "Monitoring (public data)" });
      items.push({ sym: "ring", color: l.color, label: "Monitoring (not in public domain)" });
    } else if (l.family === "pressures-industrial") {
      items.push({ sym: "box", color: "#dc2626", label: "Industrial area - no CETP (est.)" });
      items.push({ sym: "box", color: "#64748b", label: "Industrial area - CETP nearby" });
      // Third CETP state drawn by fillStyle (faint dashed grey) - must be
      // named here too: every rendered style gets a legend row.
      items.push({ sym: "outline", color: "#cbd5e1", label: "Industrial area - CETP unknown" });
      items.push({ sym: "dot", color: PRESSURE_KIND_COLOR["major-industry"], label: "Major industry (17-category)" });
    } else if (l.family === "pressures-quarries") {
      items.push({ sym: "box", color: PRESSURE_KIND_COLOR["quarry"], label: "Quarry" });
    } else if (l.family === "pressures-waste") {
      items.push({ sym: "box", color: PRESSURE_KIND_COLOR["waste-facility"], label: "Waste facility" });
    } else if (l.family === "infrastructure") {
      items.push({ sym: "dot", color: l.color, label: "STP (operational)" });
      items.push({ sym: "ring", color: l.color, label: "STP (not yet functional)" });
    } else if (l.family === "fstp") {
      items.push({ sym: "dot", color: l.color, label: "FSTP (operational)" });
      items.push({ sym: "ring", color: l.color, label: "FSTP (not yet functional)" });
    } else if (l.family.startsWith("admin")) items.push({ sym: "outline", color: l.color, label: l.label });
    else if (l.geom === "point") items.push({ sym: "dot", color: l.color, label: l.label });
    else items.push({ sym: "box", color: l.color, label: l.label });
  }
  if (!items.length) return null;
  return (
    <div className={`absolute ${raised ? "bottom-[156px] md:bottom-3" : "bottom-3"} left-3 z-[800] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow text-[11px] max-w-[230px] transition-[bottom] duration-200`}>
      <button
        onClick={() => setOpen((o) => !o)}
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
  return <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />;
}

// ── styling ──────────────────────────────────────────────────────────────

/** Short, single-line hover label; full detail lives in the click panel. */
function tipLabel(p: Record<string, unknown>, l: BasinLayer): string {
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

function lineStyle(l: BasinLayer, feat: Feature | undefined, manifest: BasinManifest, selectedRiverId: string | null, faded: boolean, showGrowth = false): PathOptions {
  if (l.prs) {
    const yr = Number((feat?.properties as Record<string, unknown>)?.year);
    const isLatest = yr >= 2025;
    if (showGrowth) {
      // Growth view: the 2020 reach is drawn LAST (on top) as a thick orange
      // line that fully covers the red beneath it on the shared length; the
      // 2025 red therefore only shows where the stretch EXTENDED - the growth.
      return isLatest
        ? { color: "#dc2626", weight: 4, opacity: 0.95 }
        : { color: "#f97316", weight: 8, opacity: 1 };
    }
    // Default: just the current (latest) stretch, red.
    return { color: "#dc2626", weight: 5, opacity: faded ? 0.5 : 0.95 };
  }
  if (l.family === "rivers") {
    const rprops = feat?.properties as Record<string, unknown>;
    const rid = String(rprops?.riverId ?? rprops?.river_id ?? "");
    const r = manifest.rivers.find((x) => x.riverId === rid);
    const sel = rid === selectedRiverId;
    return { color: r?.color ?? l.color, weight: sel ? 5 : 3, opacity: sel || !selectedRiverId ? 1 : 0.75 };
  }
  return { color: l.color, weight: 1, opacity: faded ? 0.4 : 0.85 };
}

function pointStyle(l: BasinLayer, feat: Feature | undefined, faded: boolean): L.CircleMarkerOptions {
  const p = (feat?.properties ?? {}) as Record<string, unknown>;
  // Monitoring: hollow if not in public domain (honest-gap cue). Treatment
  // plants (STP + FSTP): hollow if not yet functional (status doesn't say
  // "operational"), so an unbuilt/under-construction plant reads as not-solid.
  const treatment = l.family === "infrastructure" || l.family === "fstp";
  const hollow =
    (l.family === "monitoring-points" && String(p.publicDomain ?? "").toUpperCase() !== "YES") ||
    (treatment && !/operational/i.test(String(p.status ?? "")));
  return {
    radius: 5,
    color: l.color,
    weight: 1.5,
    fillColor: hollow ? "transparent" : l.color,
    fillOpacity: faded ? 0.3 : hollow ? 0 : 0.85,
    opacity: faded ? 0.5 : 1,
  };
}

// ── shared color sources (the map, legend, and rail all read from these +
//    each layer's manifest `color`, so they can never drift out of sync) ──

// Warm red->orange->amber ramp: reads as "pressure", three steps distinct and
// each mid-toned so it holds on both the light and dark basemaps.
const PRESSURE_KIND_COLOR: Record<string, string> = {
  "industrial-area": "#dc2626",
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

function fillStyle(l: BasinLayer, feat: Feature | undefined, faded: boolean, selectedGapUnit?: string | null): PathOptions {
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
    if (selectedGapUnit != null && selectedGapUnit !== unit) {
      return { color: "#cbd5e1", weight: 1, fillColor: "#94a3b8", fillOpacity: 0.12 };
    }
    const isSel = selectedGapUnit === unit;
    return { color: c, weight: isSel ? 3 : 2, fillColor: c, fillOpacity: faded ? 0.2 : isSel ? 0.55 : 0.4 };
  }
  if (l.family.startsWith("pressures")) {
    const p = (feat?.properties as Record<string, unknown>) ?? {};
    const kind = String(p.kind ?? "");
    // Industrial areas are sub-coloured by CETP coverage (Madhuri's ask): no
    // CETP nearby = strong red (the gap), CETP nearby = muted, unlocated = grey.
    if (kind === "industrial-area") {
      const cetp = String(p.cetp ?? "unknown");
      const c = cetp === "none" ? "#dc2626" : cetp === "served" ? "#64748b" : "#cbd5e1";
      return { color: c, weight: 1, fillColor: c, fillOpacity: faded ? 0.2 : cetp === "none" ? 0.6 : 0.3, dashArray: cetp === "unknown" ? "3 3" : undefined };
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
    ([k, v]) => k !== "name" && k !== "shedId" && k !== "cetp" && !LINK_FIELDS.has(k) && v != null && String(v).trim() !== "",
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
  layerByFamily,
  onOpenUnit,
  onShowLayer,
  onClose,
}: {
  prs: PrsData;
  accountability?: AccountabilityData | null;
  layerByFamily: Record<string, BasinLayer>;
  onOpenUnit: (unit: string) => void;
  onShowLayer: (family: string) => void;
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
  const maxKm = Math.max(prs.comparison.y2020.length_km, prs.comparison.y2025.length_km) || 1;
  const rows = [
    { year: "2020", ...prs.comparison.y2020, accent: "#fb7185" },
    { year: "2025", ...prs.comparison.y2025, accent: "#b91c1c" },
  ];
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
            {cat.level && (
              <span className="inline-block text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">Reported at: {cat.level}</span>
            )}
            {cat.noData ? (
              <p className="text-[13px] text-slate-500 dark:text-slate-400">No known public data yet for {cat.label} along this stretch.</p>
            ) : (
              <>
                {cat.body && <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 leading-relaxed">{cat.body}</p>}
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
            )}
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
            <div key={r.year} className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500 w-9 shrink-0">{r.year}</span>
              <div className="flex-1 h-4 rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-sm" style={{ width: `${(r.length_km / maxKm) * 100}%`, backgroundColor: r.accent }} />
              </div>
              <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 w-14 text-right shrink-0">{r.length_km} km</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${priorityClass(r.priority)}`}>P{r.priority}</span>
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
      {accountability && <AccountabilityMatrix data={accountability} />}

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

// Verdict chips for the accountability matrix. Plain-language labels: the
// value of the matrix is making "exists in MPR vs doesn't" explicit per
// region x category, so absence reads as a finding, not a blank.
const ACC_VERDICT: Record<AccCategory["verdict"], { label: string; cls: string }> = {
  tracked: { label: "In plan + MPR", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  "in-plan-not-reported": { label: "In plan, not in MPR", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  "reported-not-in-plan": { label: "In MPR, not in plan", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" },
  silent: { label: "Not in plan or MPR", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
};
const ACC_KIND_LABEL: Record<AccRegion["kind"], string> = { ulb: "ULBs", ia: "Industrial Areas", gp: "Gram Panchayats" };

export function AccountabilityMatrix({ data }: { data: AccountabilityData }) {
  const kinds = (["ulb", "ia", "gp"] as const).filter((k) => data.regions.some((r) => r.kind === k));
  const [kind, setKind] = useState<AccRegion["kind"]>(kinds[0] ?? "ulb");
  const regions = data.regions.filter((r) => r.kind === kind);
  const [regionKey, setRegionKey] = useState<string | null>(null);
  const region = regions.find((r) => r.key === regionKey) ?? regions[0];

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
          </div>

          {region.silentNote ? (
            <p className="text-[12px] leading-snug rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-100 px-2 py-1.5">
              <span className={`inline-block align-middle mr-1.5 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${ACC_VERDICT.silent.cls}`}>{ACC_VERDICT.silent.label}</span>
              {region.silentNote}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {region.categories.map((c) => (
                <details key={c.key} className="group py-1.5">
                  <summary className="cursor-pointer list-none flex items-center gap-2">
                    <span aria-hidden className="text-slate-400 group-open:rotate-90 transition-transform text-[10px]">▸</span>
                    <span className="flex-1 text-[13px] font-semibold text-slate-800 dark:text-slate-100">{c.label}</span>
                    <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${ACC_VERDICT[c.verdict].cls}`}>{ACC_VERDICT[c.verdict].label}</span>
                  </summary>
                  <div className="mt-1.5 ml-4 space-y-1.5">
                    <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Action Plan (2019)</div>
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
          View full cross-source detail →
        </button>
      )}
    </div>
  );
}

/** Cross-source treatment-gap panel: the "why does it persist" view - metrics,
 *  the gap over time, and what each document says, with citations. */
function GapPanel({ unit, onClose, onBack }: { unit: GapUnit; onClose: () => void; onBack?: () => void }) {
  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to polluted stretch
        </button>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-rose-500">Treatment &amp; waste gaps{unit.level ? ` - ${unit.level}` : ""}</div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">{unit.name}</h2>
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
      {unit.conflicts && unit.conflicts.length > 0 && (
        <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-2.5">
          <div className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold mb-1">Points to reconcile across sources</div>
          <ul className="space-y-1 list-disc pl-4">
            {unit.conflicts.map((c, i) => (
              <li key={i} className="text-[12px] text-amber-800 dark:text-amber-200 leading-snug">{c}</li>
            ))}
          </ul>
        </div>
      )}
      {unit.caveats && unit.caveats.length > 0 && (
        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-2.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">Notes &amp; caveats</div>
          <ul className="space-y-1 list-disc pl-4">
            {unit.caveats.map((c, i) => (
              <li key={i} className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">{c}</li>
            ))}
          </ul>
        </div>
      )}

      {(() => {
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
      })()}
      <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 leading-relaxed">
        Figures extracted from public documents; each line links to its source. Composition bars show generation by sector; hazardous &amp; biomedical are reported district-wide.
      </p>
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
          {/* Data partner credit - most of this basin's data is Paani Earth's. */}
          <a
            href="https://paani.earth"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 group rounded-md border border-slate-200 dark:border-slate-700 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <span className="leading-tight">
              <span className="block text-[10px] uppercase tracking-wider text-slate-400">Data partner</span>
              <span className="block text-slate-700 dark:text-slate-200 font-semibold group-hover:underline">Paani Earth Foundation</span>
              <span className="block text-slate-400">Basin spatial data &amp; field evidence - paani.earth ↗</span>
            </span>
          </a>

          {/* Consolidated layer inventory (counts only - provenance is in Sources). */}
          <div>
            <div className="text-slate-600 dark:text-slate-300 font-medium mb-1">Layers ({layersWithData.length})</div>
            <div className="space-y-0.5">
              {layersWithData.map((l) => (
                <div key={l.family} className="flex justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300">{l.label}</span>
                  <span className="tabular-nums text-slate-400">{inventory.families[l.family].featureCount}</span>
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

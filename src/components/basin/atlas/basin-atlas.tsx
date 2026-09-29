"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Circle, Tooltip, ZoomControl, Pane } from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { Layer } from "leaflet";
import { MapResizer } from "@/components/map/base-map";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { useMapTiles } from "@/lib/utils/map-tiles";
import { ELEVATION_BAND_COLORS, elevationLegendEntries } from "@/components/map/elevation-bands";
import { exportBasinAtlasPdf } from "@/lib/basins/export-pdf";
import { buildAtlasShareUrl, encodeLayersParam, layerKey, parseLayersParam } from "@/lib/basins/atlas-url-state";
import { prsMapColor } from "@/lib/basins/panel-labels";
import type { BasinFloor, BasinInventory, BasinLayer, BasinManifest } from "@/lib/basins";
import { tryGetBasinManifest } from "@/lib/basins";
import { withLiveStorage, type LiveStorageRow } from "@/lib/basins/live-storage";
import { basinDataUrl } from "@/lib/basins/paths";
import { parseReviewedMprSeries, type ReviewedMprSeries } from "@/lib/basins/reviewed-mpr";
import "leaflet/dist/leaflet.css";
import { fetchJsonOrNull } from "@/lib/data/fetch-json";
import { HighlightFlyer, LocateFlyer, MapController } from "./map-controllers";
import { DataOnThisMap } from "./data-on-this-map";
import { DepPanel } from "./panels/dep";
import { FeaturePanel } from "./panels/feature";
import { GapPanel } from "./panels/gap";
import { ClassChips, MapLegend, buildLegendItems } from "./legend";
import { PRSPanel } from "./panels/prs";
import { RiverPanel } from "./panels/river";
import {
  GAP_BADGE_MIN_AREA, type MapHighlight, adminTip, drawRank, fillStyle, lineStyle, matchesHighlight, pointStyle, polygonOuterRings,
  pressurePointStyle, shedStyle, tipLabel, treatmentIcon,
} from "./map-style";
import type { AccountabilityData, DepData, GapUnit, MapMatch, PrsData } from "@/lib/basins/panel-types";

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

const COACH_KEY = "basin-atlas-coach-dismissed";

type FC = FeatureCollection;

async function fetchJson(url: string): Promise<FC | null> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as FC) : null;
  } catch {
    return null;
  }
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
  // Classes switched off per layer (layerKey -> class values), for layers that declare `classes`.
  const [hiddenClasses, setHiddenClasses] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(manifest.layers.filter((l) => l.classes).map((l) => [layerKey(l), l.classes!.rows.filter((r) => r.defaultOff).map((r) => r.value)])),
  );
  const toggleClass = useCallback((key: string, value: string) => {
    setHiddenClasses((h) => {
      const cur = h[key] ?? [];
      return { ...h, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  }, []);
  // "Show X on the map": the family to fly to once its data is in. `n` makes a repeat click fly again.
  const [flyFamily, setFlyFamily] = useState<{ family: string; n: number } | null>(null);
  const [accData, setAccData] = useState<AccountabilityData | null>(null);
  const [reviewedMpr, setReviewedMpr] = useState<ReviewedMprSeries | null>(null);
  // True when a gap unit was opened FROM the PRS panel, so the gap panel can
  // offer a "back to PRS" affordance.
  const [gapFromPrs, setGapFromPrs] = useState(false);
  // Reveal the 2020 stretch alongside 2025 to show how the polluted reach grew.
  const [showGrowth, setShowGrowth] = useState(false);
  const [data, setData] = useState<Record<string, FC | null>>({});
  // Live storage for features that join the daily reservoir feed (liveCode),
  // read at view time through the same route the overview strip uses - a
  // static "today" figure in the family file would be stale by tomorrow.
  const [liveStorage, setLiveStorage] = useState<Record<string, LiveStorageRow>>({});
  const liveCodesRef = useRef<Set<string>>(new Set());
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
    fetchJson(basinDataUrl(manifest.basinId, "gaps.json"))
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
    fetchJson(basinDataUrl(manifest.basinId, "prs.json"))
      .then((d) => setPrsData((d as unknown as PrsData) ?? null))
      .catch(() => setPrsData(null));
    // Accountability matrix rides with the PRS story; absent file = section
    // simply not rendered (data-only onboarding for other basins).
    fetchJson(basinDataUrl(manifest.basinId, "accountability.json"))
      .then((d) => setAccData((d as unknown as AccountabilityData) ?? null))
      .catch(() => setAccData(null));
    fetchJson(basinDataUrl(manifest.basinId, "mpr-reviewed.json"))
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
          sheds.map((s) => fetchJson(basinDataUrl(manifest.basinId, `${l.family}/${s}.geojson`))),
        ).then((parts) => {
          const features = parts.filter(Boolean).flatMap((fc) => fc!.features);
          setData((d) => ({ ...d, [key]: { type: "FeatureCollection", features } }));
        });
      } else {
        fetchJson(basinDataUrl(manifest.basinId, `${l.family}.geojson`)).then((fc) =>
          setData((d) => ({ ...d, [key]: fc })),
        );
      }
    }
    // selectedPrs is a dep because Explore-the-stretch can be the first thing
    // that makes the (default-off) PRS layer renderable - see shouldRender.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, focusedFloor, selectedRiverId, selectedPrs]);

  // Fetch the daily storage row for every liveCode the loaded layers carry.
  useEffect(() => {
    const codes = Object.values(data).flatMap((fc) =>
      (fc?.features ?? []).map((f) => (f.properties as Record<string, unknown>)?.liveCode).filter((c): c is string => typeof c === "string"),
    ).filter((c) => !liveCodesRef.current.has(c));
    if (codes.length === 0) return;
    codes.forEach((c) => liveCodesRef.current.add(c));
    fetchJsonOrNull<{ reservoirs?: LiveStorageRow[] }>(`/api/reservoir/basin?codes=${[...new Set(codes)].join(",")}`)
      .then((d) => {
        if (!d?.reservoirs) return;
        setLiveStorage((prev) => ({ ...prev, ...Object.fromEntries(d.reservoirs!.map((r) => [r.code, r])) }));
      })
      .catch(() => undefined);
  }, [data]);

  // What the map frames: the selected river's sub-catchments, or the whole
  // basin boundary when nothing is selected (the default). Depends only on the
  // boundary/shed/context data (stable references once loaded) and the
  // selection - NOT the whole `data` object - so changing floors never
  // refits/resets the zoom.
  const shedData = data["sub-hydrosheds"];
  const boundaryData = data["boundary"];
  const contextData = data["context-boundary"];
  const riversData = data["rivers"];
  // Loaded-state key of the manifest's default-fit families ("" until the
  // manifest names some and every one has arrived).
  const fitKey = (manifest.defaultFitFamilies ?? []).every((f) => data[f])
    ? (manifest.defaultFitFamilies ?? []).map((f) => `${f}:${data[f]?.features.length ?? 0}`).join(",")
    : "";
  const flyFamilyBounds = useMemo(() => {
    const feats = flyFamily ? data[flyFamily.family]?.features ?? [] : [];
    if (!feats.length) return null;
    const b = L.geoJSON({ type: "FeatureCollection", features: feats } as never).getBounds();
    return b.isValid() ? b : null;
  }, [flyFamily, data]);
  const fitBounds = useMemo(() => {
    let feats: Feature[];
    if (selectedRiverId && shedData && selectedSheds.size > 0) {
      // A river is selected: frame its sub-catchments.
      feats = shedData.features.filter((f) => selectedSheds.has(String((f.properties as Record<string, unknown>)?.shedId)));
    } else if (selectedRiverId) {
      // A river with no shed of its own (a canal, a context river outside the
      // working boundary): frame its course, or the map would stay wherever
      // it was and the panel would describe a river off the edge of it.
      feats = (riversData?.features ?? []).filter((f) => {
        const rp = f.properties as Record<string, unknown>;
        return String(rp?.riverId ?? rp?.river_id ?? "") === selectedRiverId;
      });
    } else if (manifest.defaultFocus) {
      // Nothing selected and a focus view is configured: defer to it (the
      // MapController applies center/zoom) instead of the wide boundary fit.
      return null;
    } else if (fitKey) {
      // The manifest names the families that frame the opening view - a city
      // atlas whose supply lakes sit far outside its boundary opens on the
      // whole system, the way its PDF export already does.
      feats = (manifest.defaultFitFamilies ?? []).flatMap((f) => data[f]?.features ?? []);
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
    // fitKey stands in for the fit families' data so a floor change never refits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, selectedRiverId, shedData, boundaryData, contextData, riversData, selectedSheds, manifest.defaultFocus]);

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

  const visibleLayers = orderedLayers.filter(shouldRender).map((l) => {
    const hidden = l.classes ? hiddenClasses[layerKey(l)] ?? [] : [];
    return hidden.length ? { ...l, classes: { ...l.classes!, rows: l.classes!.rows.filter((r) => !hidden.includes(r.value)) } } : l;
  });

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
                        <div key={layerKey(l)}>
                        <label className="flex items-start gap-2 text-xs cursor-pointer group">
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
                        {l.classes && (enabled[layerKey(l)] ?? l.defaultOn) && (
                        <ClassChips layer={l} hidden={hiddenClasses[layerKey(l)] ?? []} counts={inv?.sources} onToggle={(v) => toggleClass(layerKey(l), v)} />
                      )}
                        </div>
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
                <div key={layerKey(l)}>
                <label className="flex items-start gap-2 text-xs cursor-pointer group">
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
                {l.classes && (enabled[layerKey(l)] ?? l.defaultOn) && (
                <ClassChips layer={l} hidden={hiddenClasses[layerKey(l)] ?? []} counts={inv?.sources} onToggle={(v) => toggleClass(layerKey(l), v)} />
              )}
                </div>
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
            // Classed layers: drop the classes the reader has switched off.
            const hiddenCls = l.classes ? hiddenClasses[layerKey(l)] ?? [] : [];
            const clsSig = hiddenCls.join("|");
            if (l.classes && hiddenCls.length) {
              const prop = l.classes.prop;
              feats = feats.filter((f) => !hiddenCls.includes(String((f.properties as Record<string, unknown>)?.[prop] ?? "")));
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
                  key={`${l.family}-${selectedRiverId}-${tiles.isDark}${l.prs ? `-${showGrowth}` : ""}-${clsSig}`}
                  data={fcScoped}
                  style={(feat?: Feature) => lineStyle(l, feat, manifest, selectedRiverId, faded, l.prs && showGrowth, prsYearsOnMap)}
                  interactive={l.family === "rivers" || !!l.prs || !!l.classes}
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
                    } else if (l.classes) {
                      // Classed lines carry named features (a canal network): name on hover, details on click.
                      const p = (feat.properties ?? {}) as Record<string, unknown>;
                      layer.bindTooltip(tipLabel(p, l), { sticky: true });
                      layer.on("click", () => { setSelectedFeature({ family: l.family, props: p }); setSelectedGapUnit(null); setSelectedPrs(false); });
                    }
                  }}
                />
              );
            }

            if (l.geom === "point") {
              const treatment = l.family === "infrastructure" || l.family === "fstp";
              return (
                <GeoJSON
                  key={`${layerKey(l)}-${selectedRiverId}-${clsSig}`}
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
                key={`${layerKey(l)}-${selectedRiverId}-${tiles.isDark}-${hlSig}-${clsSig}`}
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
          <HighlightFlyer key={flyFamily?.n ?? 0} bounds={flyFamilyBounds} />

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
            basin-wide and nothing is greyed out, and flies back to the overview.
            ALSO the way back to the full three-panel view when the layers rail
            is closed: with the rail shut and nothing selected there was no
            button here at all, and the left-edge reopen tab was easy to miss -
            a dead end that read as "the panels are gone", fixed only by a
            reload (Madhuri, 31 Aug). */}
        {(selectedRiverId || selectedGapUnit || selectedFeature || selectedPrs || mapHighlight || !railOpen) && (
          <button
            onClick={() => {
              setSelectedGapUnit(null); setSelectedFeature(null); setSelectedPrs(false); setGapFromPrs(false); setMapHighlight(null); selectRiver(null);
              // Reopen the rail on desktop; on phones the map is the calm
              // resting state and the Layers sheet stays closed.
              if (typeof window !== "undefined" && window.innerWidth >= 768) setRailOpen(true);
            }}
            className="absolute top-3 right-3 z-[500] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-md shadow px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            ↺ Reset{selectedRiver ? " to whole basin" : !hasSelection && !mapHighlight ? " view" : ""}
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
                  // The layer may already be on, so switching it on shows nothing: go to it.
                  setFlyFamily({ family, n: Date.now() });
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
                basinName={manifest.displayName}
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
                  props={withLiveStorage(selectedFeature.props, liveStorage)}
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

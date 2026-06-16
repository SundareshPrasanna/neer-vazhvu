"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import { MapResizer } from "@/components/map-resizer";
import { useMapTiles } from "@/lib/utils/map-tiles";
import type {
  BasinFloor,
  BasinInventory,
  BasinLayer,
  BasinManifest,
} from "@/lib/basins";
import "leaflet/dist/leaflet.css";

interface Props {
  cityId: string;
  cityDisplayName: string;
  manifest: BasinManifest;
  inventory: BasinInventory | null;
  /** Pre-select a river (e.g. when opened by clicking it on the rivers map). */
  initialRiverId?: string | null;
  /** Embedded as an overlay (over the rivers page): skip URL syncing and show
   *  a back button instead of relying on the address bar. */
  embedded?: boolean;
  /** Back affordance when embedded. */
  onClose?: () => void;
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
  metrics: { label: string; value: string; emphasis?: boolean }[];
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

const COACH_KEY = "basin-atlas-coach-dismissed";

type FC = FeatureCollection;

/** Draw order on the shared canvas (lower = drawn first = underneath). Base
 *  outlines and sub-catchments sit below thematic fills, lines, and points so
 *  the layers on top receive hover/click, not the catchment beneath them. */
function drawRank(l: BasinLayer): number {
  if (l.gap) return -1; // gap choropleth at the very bottom - all data (incl. STPs) sits above it
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
function MapController({ fitBounds }: { fitBounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (fitBounds && fitBounds.isValid()) {
      map.fitBounds(fitBounds, { padding: [8, 8], maxZoom: 14 });
    }
  }, [fitBounds, map]);
  return null;
}

export function BasinAtlas({ cityDisplayName, manifest, inventory, initialRiverId = null, embedded = false, onClose }: Props) {
  const tiles = useMapTiles();

  const [focusedFloor, setFocusedFloor] = useState<BasinFloor>("hydrology");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(manifest.layers.map((l) => [l.family, l.defaultOn])),
  );
  const [selectedRiverId, setSelectedRiverId] = useState<string | null>(initialRiverId);
  const [selectedFeature, setSelectedFeature] = useState<{ family: string; props: Record<string, unknown> } | null>(null);
  const [selectedGapUnit, setSelectedGapUnit] = useState<string | null>(null);
  const [gapData, setGapData] = useState<Record<string, GapUnit>>({});
  const [data, setData] = useState<Record<string, FC | null>>({});
  const [coachDismissed, setCoachDismissed] = useState(true);
  // Either panel can be collapsed to see the map alone.
  const [railOpen, setRailOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const fetchedRef = useRef<Set<string>>(new Set());

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

  // URL <-> state (?river= & ?level=), via replaceState (no full navigation).
  // Skipped when embedded as an overlay so we don't clobber the rivers-page URL.
  // Cross-source gap intelligence for the gap layer's click panel (optional).
  useEffect(() => {
    fetchJson(`/data/basins/${manifest.basinId}/gaps.json`)
      .then((d) => setGapData(((d as unknown as { units?: Record<string, GapUnit> })?.units) ?? {}))
      .catch(() => setGapData({}));
  }, [manifest.basinId]);

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
    if (!enabled[l.family]) return false;
    if (!l.context && l.floor !== focusedFloor) return false;
    return true;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, focusedFloor, selectedRiverId]);

  // What the map frames: the selected river's sub-catchments, or the whole
  // basin boundary when nothing is selected (the default). Depends only on the
  // boundary/shed data (stable references once loaded) and the selection - NOT
  // the whole `data` object - so changing floors never refits/resets the zoom.
  const shedData = data["sub-hydrosheds"];
  const boundaryData = data["boundary"];
  const fitBounds = useMemo(() => {
    const feats =
      selectedRiverId && shedData
        ? shedData.features.filter((f) => selectedSheds.has(String((f.properties as Record<string, unknown>)?.shedId)))
        : boundaryData?.features ?? [];
    if (!feats.length) return null;
    const b = L.geoJSON({ type: "FeatureCollection", features: feats } as FC).getBounds();
    return b.isValid() ? b : null;
  }, [selectedRiverId, shedData, boundaryData, selectedSheds]);

  function selectRiver(riverId: string | null) {
    setSelectedRiverId(riverId);
    setSelectedFeature(null);
    setSelectedGapUnit(null);
  }

  // Restrict a feature collection to the selected river's sheds. Context layers
  // and gap layers are exempt - gaps sit at admin level (no shed id), so a river
  // selection must not filter them out.
  function scoped(fc: FC | null, layer: BasinLayer): Feature[] {
    if (!fc) return [];
    if (!selectedRiverId || layer.context || layer.gap) return fc.features;
    return fc.features.filter((f) =>
      selectedSheds.has(String((f.properties as Record<string, unknown>)?.shedId)),
    );
  }

  const dim = (l: BasinLayer) => l.floor !== focusedFloor;

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

  // Derived insight (Madhuri's CAG ask): when the pressures layer is shown,
  // how many industrial areas have no CETP nearby - computed live from the data.
  const legendNotes = useMemo(() => {
    const out: string[] = [];
    if (visibleLayers.some((l) => l.family === "pressures")) {
      const ind = (data["pressures"]?.features ?? []).filter(
        (f) => (f.properties as Record<string, unknown>)?.kind === "industrial-area",
      );
      const none = ind.filter((f) => (f.properties as Record<string, unknown>)?.cetp === "none").length;
      if (ind.length) out.push(`≈${none} of ${ind.length} industrial areas have no CETP within ~5 km - CAG-flagged gap, spatial estimate (8 of 18 KIADB areas)`);
    }
    return out;
  }, [visibleLayers, data]);

  return (
    <div className="h-full w-full flex flex-col md:flex-row">
      {/* ── Elevator rail ── */}
      {railOpen && (
      <div className="shrink-0 md:w-60 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-y-auto">
        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start justify-between gap-2">
            <h1 className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{manifest.displayName}</h1>
            <button
              onClick={() => setRailOpen(false)}
              title="Hide layers panel"
              className="hidden md:block shrink-0 -mt-0.5 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              «
            </button>
          </div>
          {manifest.displayNameLocal && (
            <div className="text-xs text-slate-500 dark:text-slate-400">{manifest.displayNameLocal}</div>
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

        <div className="flex md:block">
          {FLOORS.map((f, i) => {
            const active = f.id === focusedFloor;
            return (
              <div key={f.id} className="flex-1 md:flex-none">
                <button
                  onClick={() => setFocusedFloor(f.id)}
                  className={`w-full text-left px-3 py-2.5 border-l-4 transition-colors ${
                    active
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                      : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold ${active ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"}`}>
                      <span className="text-[10px] font-mono text-slate-400 mr-1">{i + 1}</span>
                      {f.label}
                    </span>
                    {floorCounts[f.id] > 0 && (
                      <span className="text-[10px] tabular-nums text-slate-400">{floorCounts[f.id]}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 hidden md:block">{f.sub}</div>
                </button>

                {/* Per-floor layer toggles, only under the focused floor. */}
                {active && (
                  <div className="px-3 pb-2 pt-1 space-y-1 hidden md:block">
                    {floorLayers(f.id).map((l) => {
                      const inv = inventory?.families[l.family];
                      return (
                        <label key={l.family} className="flex items-start gap-2 text-xs cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={!!enabled[l.family]}
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
          })}
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
          <MapController fitBounds={fitBounds} />
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
            const feats = scoped(fc, l);
            if (!feats.length) return null;
            const fcScoped: FC = { type: "FeatureCollection", features: feats };
            const faded = dim(l);

            // Gap layer: only the choropleth FILL is drawn here (at the very
            // bottom, drawRank -1, non-interactive) so it never sits over or
            // blocks the STPs/features above it. The clickable badge is rendered
            // separately, last, so it stays on top and openable.
            if (l.gap) {
              return (
                <GeoJSON
                  key={`gapfill-${selectedRiverId}-${tiles.isDark}`}
                  data={fcScoped}
                  interactive={false}
                  style={(feat?: Feature) => fillStyle(l, feat, faded)}
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
                        ? `${name} catchment · ${rName}`
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
                  key={`${l.family}-${selectedRiverId}-${tiles.isDark}`}
                  data={fcScoped}
                  style={(feat?: Feature) => lineStyle(l, feat, manifest, selectedRiverId, faded)}
                  interactive={l.family === "rivers"}
                  onEachFeature={(feat: Feature, layer: Layer) => {
                    if (l.family === "rivers") {
                      const rid = String((feat.properties as Record<string, unknown>)?.riverId ?? "");
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
                    layer.on("click", () => { setSelectedFeature({ family: l.family, props: p }); setSelectedGapUnit(null); });
                  }}
                />
              );
            }

            // fill: boundary + admin are non-interactive base outlines (so they
            // never steal hover from the layers above); waterbodies / pressures
            // / command-areas are interactive thematic fills. pointToLayer keeps
            // any point geometry (e.g. waste-facility) a circle, not a default
            // marker (which would 404 its icon and render broken).
            const isBase = l.family === "boundary" || l.family.startsWith("admin");
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
                  layer.bindTooltip(tipLabel(p, l), { sticky: true });
                  layer.on("click", () => { setSelectedFeature({ family: l.family, props: p }); setSelectedGapUnit(null); });
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
                    key={`gapbadge-${unit}-${idx}-${pi}`}
                    center={p.b.getCenter()}
                    radius={6}
                    pathOptions={{ color: "#fecaca", weight: 1, fillColor: "#dc2626", fillOpacity: 0.7 }}
                    eventHandlers={{ click: () => { setSelectedGapUnit(unit); setSelectedFeature(null); } }}
                  >
                    <Tooltip sticky>{name}{pi > 0 ? " (detached part)" : ""} - click for treatment &amp; waste gaps</Tooltip>
                  </CircleMarker>
                ));
            });
          })}
        </MapContainer>

        {/* Back to the rivers map (only when opened as an overlay). */}
        {embedded && onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 left-3 z-[500] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-md shadow px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            ← Back to rivers
          </button>
        )}

        {/* Whole-basin reset: clears the river scope so every layer shows
            basin-wide (e.g. all waterbodies), and flies back to the overview. */}
        {selectedRiverId && (
          <button
            onClick={() => selectRiver(null)}
            className="absolute top-3 right-3 z-[500] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-md shadow px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            ↺ Whole basin
          </button>
        )}

        {/* Coach mark */}
        {!embedded && !coachDismissed && !selectedRiverId && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-slate-900/95 text-white text-xs rounded-full px-4 py-2 shadow-lg flex items-center gap-3">
            <span>Click a river to explore its pollution story</span>
            <button
              onClick={() => { localStorage.setItem(COACH_KEY, "1"); setCoachDismissed(true); }}
              className="text-slate-300 hover:text-white underline"
            >
              don&apos;t show again
            </button>
          </div>
        )}

        {/* Reopen tabs when a panel is collapsed (md+). */}
        {!railOpen && (
          <button
            onClick={() => setRailOpen(true)}
            title="Show layers panel"
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-[500] items-center bg-white/95 dark:bg-slate-900/95 border border-l-0 border-slate-200 dark:border-slate-700 rounded-r-md shadow px-1.5 py-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            » Layers
          </button>
        )}
        {!panelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            title="Show details panel"
            className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-[500] items-center bg-white/95 dark:bg-slate-900/95 border border-r-0 border-slate-200 dark:border-slate-700 rounded-l-md shadow px-1.5 py-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Details «
          </button>
        )}

        {/* Legend - reflects what's currently visible. */}
        <MapLegend layers={visibleLayers} notes={legendNotes} />
      </div>

      {/* ── Detail panel ── */}
      {panelOpen && (
      <aside className="hidden lg:flex h-full w-[400px] xl:w-[460px] shrink-0 border-l border-slate-200 dark:border-slate-700 flex-col overflow-y-auto bg-white dark:bg-slate-900 p-5 text-sm">
        <div className="flex justify-end -mt-2 -mr-2 mb-1">
          <button onClick={() => setPanelOpen(false)} title="Hide details panel" className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">»</button>
        </div>
        {selectedGapUnit && gapData[selectedGapUnit] ? (
          <GapPanel unit={gapData[selectedGapUnit]} onClose={() => setSelectedGapUnit(null)} />
        ) : selectedFeature ? (
          <FeaturePanel
            props={selectedFeature.props}
            label={layerByFamily[selectedFeature.family]?.label ?? selectedFeature.family}
            onClose={() => setSelectedFeature(null)}
          />
        ) : selectedRiver ? (
          <RiverPanel river={selectedRiver} onClear={() => selectRiver(null)} />
        ) : (
          <div className="space-y-3 text-slate-600 dark:text-slate-400">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{cityDisplayName} · {manifest.displayName}</h2>
            <p className="leading-relaxed">{manifest.blurb}</p>
            {manifest.areaKm2 && (
              <p className="text-xs text-slate-500">Basin area ~{manifest.areaKm2.toLocaleString()} km². {manifest.areaNote}</p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Use the floors on the left to move between the river system, its monitoring evidence, the pressures on it, and the response. Click a river to scope everything to its sub-basin.
            </p>
          </div>
        )}
      </aside>
      )}
    </div>
  );
}

// ── legend ───────────────────────────────────────────────────────────────

type LegendSym = "box" | "dot" | "ring" | "line" | "dash" | "outline";

/** Dynamic legend: one entry per symbol actually on the map right now,
 *  expanding pressures into its kinds and showing the monitoring public-domain
 *  cue (filled vs hollow). */
function MapLegend({ layers, notes }: { layers: BasinLayer[]; notes?: string[] }) {
  const [open, setOpen] = useState(true);
  // Every entry's color comes from the layer's manifest `color` or the shared
  // PRESSURE_KIND_COLOR map - the same sources the map styles read - so the
  // legend can never disagree with what's drawn.
  const items: { sym: LegendSym; color: string; label: string }[] = [];
  for (const l of layers) {
    if (l.gap) items.push({ sym: "box", color: "#dc2626", label: "Treatment & waste gap" });
    else if (l.family === "boundary") items.push({ sym: "line", color: l.color, label: l.label });
    else if (l.family === "sub-hydrosheds") items.push({ sym: "dash", color: l.color, label: "Sub-catchment" });
    else if (l.family === "rivers") items.push({ sym: "line", color: l.color, label: "River" });
    else if (l.family === "drainage") items.push({ sym: "line", color: l.color, label: l.label });
    else if (l.family === "monitoring-points") {
      items.push({ sym: "dot", color: l.color, label: "Monitoring (public data)" });
      items.push({ sym: "ring", color: l.color, label: "Monitoring (not in public domain)" });
    } else if (l.family === "pressures") {
      items.push({ sym: "box", color: "#dc2626", label: "Industrial area - no CETP (est.)" });
      items.push({ sym: "box", color: "#64748b", label: "Industrial area - CETP nearby" });
      items.push({ sym: "box", color: PRESSURE_KIND_COLOR["quarry"], label: "Quarry" });
      items.push({ sym: "box", color: PRESSURE_KIND_COLOR["waste-facility"], label: "Waste facility" });
    } else if (l.family.startsWith("admin")) items.push({ sym: "outline", color: l.color, label: l.label });
    else if (l.geom === "point") items.push({ sym: "dot", color: l.color, label: l.label });
    else items.push({ sym: "box", color: l.color, label: l.label });
  }
  if (!items.length) return null;
  return (
    <div className="absolute bottom-3 left-3 z-[500] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow text-[11px] max-w-[230px]">
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

function lineStyle(l: BasinLayer, feat: Feature | undefined, manifest: BasinManifest, selectedRiverId: string | null, faded: boolean): PathOptions {
  if (l.family === "rivers") {
    const rid = String((feat?.properties as Record<string, unknown>)?.riverId ?? "");
    const r = manifest.rivers.find((x) => x.riverId === rid);
    const sel = rid === selectedRiverId;
    return { color: r?.color ?? l.color, weight: sel ? 5 : 3, opacity: sel || !selectedRiverId ? 1 : 0.75 };
  }
  return { color: l.color, weight: 1, opacity: faded ? 0.4 : 0.85 };
}

function pointStyle(l: BasinLayer, feat: Feature | undefined, faded: boolean): L.CircleMarkerOptions {
  const p = (feat?.properties ?? {}) as Record<string, unknown>;
  // Monitoring: hollow if not in public domain (honest-gap cue).
  const hollow = l.family === "monitoring-points" && String(p.publicDomain ?? "").toUpperCase() !== "YES";
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

function fillStyle(l: BasinLayer, feat: Feature | undefined, faded: boolean): PathOptions {
  if (l.family === "boundary") {
    // Bold SOLID line in the manifest color (fuchsia) - a hue the OSM basemap
    // never uses, so the basin edge can't be mistaken for a basemap boundary.
    return { color: l.color, weight: 3, fill: false, opacity: 0.95 };
  }
  if (l.family.startsWith("admin")) {
    return {
      color: l.color,
      weight: l.family === "admin-district" ? 1.4 : 1.2,
      fill: false,
      opacity: faded ? 0.4 : 0.85,
      dashArray: ADMIN_DASH[l.family],
    };
  }
  if (l.gap) {
    const sev = String((feat?.properties as Record<string, unknown>)?.severity ?? "high");
    const c = sev === "high" ? "#dc2626" : sev === "medium" ? "#ea580c" : "#f59e0b";
    return { color: c, weight: 2, fillColor: c, fillOpacity: faded ? 0.2 : 0.4 };
  }
  if (l.family === "pressures") {
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

/** Cross-source treatment-gap panel: the "why does it persist" view - metrics,
 *  the gap over time, and what each document says, with citations. */
function GapPanel({ unit, onClose }: { unit: GapUnit; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-rose-500">Treatment &amp; waste gaps{unit.level ? ` · ${unit.level}` : ""}</div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">{unit.name}</h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      {unit.headline && (
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed border-l-2 border-rose-400 pl-2.5">{unit.headline}</p>
      )}
      {unit.coverage && (
        <p className="text-[11px] text-slate-400">Data coverage: {unit.coverage}</p>
      )}
      {unit.conflicts && unit.conflicts.length > 0 && (
        <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-2.5">
          <div className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold mb-1">⚠ Source conflicts</div>
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
        return (
          <div className="space-y-4">
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
              title={`${s.stream}: ${fmt(s.magnitude!.perDay)} ${u} · ${district ? "district-wide" : "this taluk"}`}
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
                <span className="truncate text-slate-600 dark:text-slate-300">{SECTOR_META[s.sector!].label}</span>
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

/** One stream's detail card: sector swatch + granularity tag, metrics, optional
 *  trend, and the cited "what the documents say" block. */
function StreamCard({ s }: { s: GapStream }) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {s.sector && <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SECTOR_META[s.sector].color }} />}
        <span>{s.stream}</span>
        {s.granularity === "district" && (
          <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">district-wide</span>
        )}
      </h4>
      <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-2.5 mt-1 leading-relaxed">{s.summary}</p>

      <dl className="space-y-1.5 mb-3">
        {s.metrics.map((m, j) => (
          <div key={j} className="flex items-baseline justify-between gap-3">
            <dt className="text-[13px] text-slate-500 dark:text-slate-400">{m.label}</dt>
            <dd className={`text-[13px] tabular-nums text-right ${m.emphasis ? "font-bold text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}`}>{m.value}</dd>
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/partners/paani-earth-logo.png" alt="Paani Earth Foundation" width={36} height={36} className="rounded shrink-0" />
            <span className="leading-tight">
              <span className="block text-[10px] uppercase tracking-wider text-slate-400">Data partner</span>
              <span className="block text-slate-700 dark:text-slate-200 font-semibold group-hover:underline">Paani Earth Foundation</span>
              <span className="block text-slate-400">Basin spatial data &amp; field evidence · paani.earth ↗</span>
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Pane, useMap } from "react-leaflet";
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
  { id: "governance", label: "Response", sub: "Treatment, governance" },
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

/** Fly to the selected river's sub-hydrosheds; fly back to basin view on clear. */
function MapController({
  fitBounds,
  resetKey,
  center,
  zoom,
  onZoom,
}: {
  fitBounds: L.LatLngBounds | null;
  resetKey: number;
  center: [number, number];
  zoom: number;
  onZoom: (z: number) => void;
}) {
  const map = useMap();
  useEffect(() => {
    onZoom(map.getZoom());
    const h = () => onZoom(map.getZoom());
    map.on("zoomend", h);
    return () => void map.off("zoomend", h);
  }, [map, onZoom]);
  useEffect(() => {
    if (fitBounds && fitBounds.isValid()) {
      map.fitBounds(fitBounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [fitBounds, map]);
  useEffect(() => {
    if (resetKey > 0) map.flyTo(center, zoom, { duration: 0.7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
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
  const [data, setData] = useState<Record<string, FC | null>>({});
  const [zoom, setZoom] = useState(manifest.mapZoom);
  const [resetKey, setResetKey] = useState(0);
  const [coachDismissed, setCoachDismissed] = useState(true);
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

  // Should a layer render right now? (gates fetching too.)
  function shouldRender(l: BasinLayer): boolean {
    if (!enabled[l.family]) return false;
    if (!l.context && l.floor !== focusedFloor) return false;
    if (l.minZoom && zoom < l.minZoom && !selectedRiverId) return false;
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
  }, [enabled, focusedFloor, zoom, selectedRiverId]);

  // Bounds to fly to when a river is selected (its sheds in the loaded sheds file).
  const fitBounds = useMemo(() => {
    if (!selectedRiverId) return null;
    const sheds = data["sub-hydrosheds"];
    if (!sheds) return null;
    const sel = sheds.features.filter((f) => selectedSheds.has(String((f.properties as Record<string, unknown>)?.shedId)));
    if (!sel.length) return null;
    const b = L.geoJSON({ type: "FeatureCollection", features: sel } as FC).getBounds();
    return b.isValid() ? b : null;
  }, [selectedRiverId, data, selectedSheds]);

  function selectRiver(riverId: string | null) {
    setSelectedRiverId(riverId);
    setSelectedFeature(null);
    if (!riverId) setResetKey((k) => k + 1);
  }

  // Restrict a feature collection to the selected river's sheds (non-context).
  function scoped(fc: FC | null, layer: BasinLayer): Feature[] {
    if (!fc) return [];
    if (!selectedRiverId || layer.context) return fc.features;
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

  return (
    <div className="h-full w-full flex flex-col md:flex-row">
      {/* ── Elevator rail ── */}
      <div className="shrink-0 md:w-60 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-y-auto">
        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
          <h1 className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{manifest.displayName}</h1>
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
                      const gated = l.minZoom && zoom < l.minZoom && !selectedRiverId;
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
                              {gated && <span className="block text-[10px] text-amber-600 dark:text-amber-400">zoom in to load</span>}
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

      {/* ── Map ── */}
      <div className="relative flex-1 h-full min-h-[320px]">
        <MapContainer center={manifest.mapCenter} zoom={manifest.mapZoom} className="h-full w-full" preferCanvas>
          <MapResizer />
          <MapController fitBounds={fitBounds} resetKey={resetKey} center={manifest.mapCenter} zoom={manifest.mapZoom} onZoom={setZoom} />
          <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />

          {/* z-order, bottom to top: non-interactive base outlines, then the
              clickable sheds, then thematic fills/lines/points on top so they
              win hit-testing (canvas hit-test ignores fill:false). */}
          <Pane name="b-base" style={{ zIndex: 390 }} />
          <Pane name="b-shed" style={{ zIndex: 400 }} />
          <Pane name="b-fill" style={{ zIndex: 410 }} />
          <Pane name="b-line" style={{ zIndex: 420 }} />
          <Pane name="b-point" style={{ zIndex: 440 }} />

          {manifest.layers.map((l) => {
            if (!shouldRender(l)) return null;
            const fc = data[dataKey(l)];
            if (!fc) return null;
            const feats = scoped(fc, l);
            if (!feats.length) return null;
            const fcScoped: FC = { type: "FeatureCollection", features: feats };
            const faded = dim(l);

            if (l.family === "sub-hydrosheds") {
              return (
                <GeoJSON
                  key={`shed-${selectedRiverId}-${tiles.isDark}`}
                  data={fcScoped}
                  pane="b-shed"
                  style={(feat?: Feature) => shedStyle(feat, selectedSheds, faded)}
                  onEachFeature={(feat: Feature, layer: Layer) => {
                    const sid = String((feat.properties as Record<string, unknown>)?.shedId ?? "");
                    const name = String((feat.properties as Record<string, unknown>)?.name ?? "sub-catchment");
                    const river = shedToRiver.get(sid);
                    const rName = manifest.rivers.find((r) => r.riverId === river)?.displayName;
                    layer.bindTooltip(river ? `${name} - click for ${rName}` : name, { sticky: true });
                    if (river) layer.on("click", () => selectRiver(river));
                  }}
                />
              );
            }

            if (l.geom === "line") {
              return (
                <GeoJSON
                  key={`${l.family}-${selectedRiverId}-${tiles.isDark}`}
                  data={fcScoped}
                  pane="b-line"
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
                  pane="b-point"
                  pointToLayer={(feat, latlng) =>
                    L.circleMarker(latlng, pointStyle(l, feat, faded))
                  }
                  onEachFeature={(feat: Feature, layer: Layer) => {
                    const p = (feat.properties ?? {}) as Record<string, unknown>;
                    layer.bindTooltip(tipLabel(p, l), { sticky: true });
                    layer.on("click", () => setSelectedFeature({ family: l.family, props: p }));
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
                pane={isBase ? "b-base" : "b-fill"}
                interactive={!isBase}
                style={(feat?: Feature) => fillStyle(l, feat, faded)}
                pointToLayer={(feat, latlng) => L.circleMarker(latlng, pressurePointStyle(feat, faded))}
                onEachFeature={(feat: Feature, layer: Layer) => {
                  if (isBase) return;
                  const p = (feat.properties ?? {}) as Record<string, unknown>;
                  layer.bindTooltip(tipLabel(p, l), { sticky: true });
                  layer.on("click", () => setSelectedFeature({ family: l.family, props: p }));
                }}
              />
            );
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
      </div>

      {/* ── Detail panel ── */}
      <aside className="hidden lg:flex h-full w-[360px] shrink-0 border-l border-slate-200 dark:border-slate-700 flex-col overflow-y-auto bg-white dark:bg-slate-900 p-5 text-sm">
        {selectedFeature ? (
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
    </div>
  );
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

function shedStyle(feat: Feature | undefined, selectedSheds: Set<string>, faded: boolean): PathOptions {
  const sid = String((feat?.properties as Record<string, unknown>)?.shedId ?? "");
  const sel = selectedSheds.has(sid);
  return {
    color: "#0ea5e9",
    weight: sel ? 2 : 1,
    fillColor: "#0ea5e9",
    fillOpacity: sel ? 0.18 : faded ? 0.04 : 0.08,
  };
}

function lineStyle(l: BasinLayer, feat: Feature | undefined, manifest: BasinManifest, selectedRiverId: string | null, faded: boolean): PathOptions {
  if (l.family === "rivers") {
    const rid = String((feat?.properties as Record<string, unknown>)?.riverId ?? "");
    const r = manifest.rivers.find((x) => x.riverId === rid);
    const sel = rid === selectedRiverId;
    return { color: r?.color ?? l.color, weight: sel ? 4 : 2.5, opacity: sel || !selectedRiverId ? 0.95 : 0.5 };
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

const PRESSURE_KIND_COLOR: Record<string, string> = {
  "industrial-area": "#b91c1c",
  quarry: "#92400e",
  "waste-facility": "#7c2d12",
};

function fillStyle(l: BasinLayer, feat: Feature | undefined, faded: boolean): PathOptions {
  if (l.family === "boundary") {
    return { color: l.color, weight: 2.5, fill: false, dashArray: "6 4" };
  }
  if (l.family.startsWith("admin")) {
    return { color: l.color, weight: 1, fill: false, opacity: faded ? 0.4 : 0.8, dashArray: l.family === "admin-district" ? undefined : "3 3" };
  }
  if (l.family === "pressures") {
    const kind = String((feat?.properties as Record<string, unknown>)?.kind ?? "");
    const c = PRESSURE_KIND_COLOR[kind] ?? l.color;
    return { color: c, weight: 1, fillColor: c, fillOpacity: faded ? 0.2 : 0.45 };
  }
  // waterbodies, command-areas
  return { color: l.color, weight: 0.8, fillColor: l.color, fillOpacity: faded ? 0.25 : 0.55 };
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
  custodian: "Custodian",
  district: "District",
  tankId: "Tank ID",
  details: "Details",
  areaHa: "Area (ha)",
};
const LINK_FIELDS = new Set(["dataUrl", "evidenceUrl"]);

function FeaturePanel({ props, label, onClose }: { props: Record<string, unknown>; label: string; onClose: () => void }) {
  const title = String(props.name ?? props.contributor ?? props.kind ?? label);
  const entries = Object.entries(props).filter(
    ([k, v]) => k !== "name" && k !== "shedId" && !LINK_FIELDS.has(k) && v != null && String(v).trim() !== "",
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
            <dt className="text-[10px] uppercase tracking-wider text-slate-400">{PROP_LABELS[k] ?? k}</dt>
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

function DataOnThisMap({ manifest, inventory }: { manifest: BasinManifest; inventory: BasinInventory | null }) {
  const [open, setOpen] = useState(false);
  if (!inventory) return null;
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
        <div className="px-3 pb-3 space-y-2 text-[11px] text-slate-500 dark:text-slate-400">
          {manifest.layers.map((l) => {
            const inv = inventory.families[l.family];
            if (!inv) return null;
            const prov = inv.sources.map((s) => s.provenance).filter(Boolean)[0];
            return (
              <div key={l.family}>
                <span className="text-slate-700 dark:text-slate-300">{l.label}</span>{" "}
                <span className="tabular-nums">({inv.featureCount})</span>
                {prov && <div className="text-slate-400 leading-snug">{prov}</div>}
              </div>
            );
          })}
          {inventory.skipped.length > 0 && (
            <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
              <div className="text-slate-600 dark:text-slate-300 font-medium">Data we don&apos;t have yet</div>
              {inventory.skipped.map((s) => (
                <div key={s.file} className="leading-snug">{s.file}: {s.reason}</div>
              ))}
            </div>
          )}
          <div className="pt-1 border-t border-slate-200 dark:border-slate-700 space-y-1">
            {manifest.credits.map((c, i) => <div key={i} className="leading-snug">{c}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

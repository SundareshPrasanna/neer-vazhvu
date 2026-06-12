"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Pane, useMap } from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import { MapResizer } from "@/components/map-resizer";
import { useMapTiles } from "@/lib/utils/map-tiles";
import "leaflet/dist/leaflet.css";

interface LakeProps {
  osm_id: number;
  name: string;
  name_ta: string;
  catchment_area_sqkm: number | null;
  lake_area_sqkm: number | null;
  drains_to_river: boolean | null;
  river_outlet_distance_km: number | null;
}

interface Props {
  cityId: string;
  cityDisplayName: string;
  center: [number, number];
  zoom?: number;
}

const C_DEFAULT = "#0ea5e9"; // sky-500  — other lakes
const C_SELECTED = "#dc2626"; // red-600 — the lake you clicked
const C_INSIDE = "#2563eb"; // blue-600 — tank within the catchment (feeds it)

// --- client-side point-in-polygon (even-odd over all rings, handles holes
//     and MultiPolygon), so we can tell which tanks sit inside a catchment. ---
function pointInRing(x: number, y: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInPolygon(x: number, y: number, rings: Position[][]): boolean {
  let inside = false;
  for (const ring of rings) if (pointInRing(x, y, ring)) inside = !inside;
  return inside;
}
function pointInGeom(x: number, y: number, geom: Geometry): boolean {
  if (geom.type === "Polygon") return pointInPolygon(x, y, geom.coordinates);
  if (geom.type === "MultiPolygon") return geom.coordinates.some((p) => pointInPolygon(x, y, p));
  return false;
}
function centroidOf(geom: Geometry): [number, number] | null {
  let ring: Position[] | null = null;
  if (geom.type === "Polygon") ring = geom.coordinates[0];
  else if (geom.type === "MultiPolygon") ring = geom.coordinates[0]?.[0] ?? null;
  if (!ring || !ring.length) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of ring) { sx += x; sy += y; }
  return [sx / ring.length, sy / ring.length];
}

/** Fit to the selected catchment when it loads; fly back to the city view on Reset. */
function MapController({
  fitGeom,
  resetKey,
  center,
  zoom,
}: {
  fitGeom: Feature | null;
  resetKey: number;
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!fitGeom) return;
    const b = L.geoJSON(fitGeom).getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [50, 50], maxZoom: 14 });
  }, [fitGeom, map]);
  useEffect(() => {
    if (resetKey > 0) map.flyTo(center, zoom, { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  return null;
}

export function CatchmentAtlas({ cityId, cityDisplayName, center, zoom = 11 }: Props) {
  const tiles = useMapTiles();
  const [lakes, setLakes] = useState<FeatureCollection | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [catchment, setCatchment] = useState<Feature | null>(null);
  const [streams, setStreams] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    fetch(`/data/cascade/${cityId}-cascade-lakes.geojson`)
      .then((r) => r.json())
      .then(setLakes)
      .catch(() => setLakes(null));
  }, [cityId]);

  const lakeById = useMemo(() => {
    const m = new Map<number, LakeProps>();
    lakes?.features.forEach((f) => m.set((f.properties as { osm_id: number }).osm_id, f.properties as unknown as LakeProps));
    return m;
  }, [lakes]);

  // Tanks whose centroid falls inside the selected catchment = the lakes that
  // drain into it. Computed from the fetched catchment polygon, client-side.
  const inside = useMemo(() => {
    const s = new Set<number>();
    if (!catchment || !lakes) return s;
    const geom = catchment.geometry;
    for (const f of lakes.features) {
      const id = (f.properties as { osm_id: number }).osm_id;
      if (id === selected) continue;
      const c = centroidOf(f.geometry);
      if (c && pointInGeom(c[0], c[1], geom)) s.add(id);
    }
    return s;
  }, [catchment, lakes, selected]);

  function selectLake(osmId: number) {
    setSelected(osmId);
    setCatchment(null);
    setStreams(null);
    setLoading(true);
    fetch(`/api/cascade/${cityId}/catchment?osm_id=${osmId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setCatchment(d?.catchment ?? null);
        setStreams(d?.streams ?? null);
      })
      .finally(() => setLoading(false));
  }

  function reset() {
    setSelected(null);
    setCatchment(null);
    setStreams(null);
    setResetKey((k) => k + 1);
  }

  function lakeStyle(osmId: number): PathOptions {
    const color = osmId === selected ? C_SELECTED : inside.has(osmId) ? C_INSIDE : C_DEFAULT;
    const hi = osmId === selected || inside.has(osmId);
    return { color, weight: osmId === selected ? 2 : 1, fillColor: color, fillOpacity: hi ? 0.65 : 0.3 };
  }

  const sel = selected != null ? lakeById.get(selected) ?? null : null;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row">
      <div className="relative flex-1 h-full">
        <MapContainer center={center} zoom={zoom} className="h-full w-full" preferCanvas>
          <MapResizer />
          <MapController fitGeom={catchment} resetKey={resetKey} center={center} zoom={zoom} />
          <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />

          {/* Catchment — neutral dashed outline (the area of influence). */}
          <Pane name="catchment" style={{ zIndex: 410 }}>
            {catchment && (
              <GeoJSON
                key={`catch-${selected}`}
                data={catchment}
                style={{ color: "#334155", weight: 1.5, dashArray: "5 4", fillColor: "#94a3b8", fillOpacity: 0.1 }}
              />
            )}
          </Pane>

          {/* Feeder streams within the catchment, width by Strahler order. */}
          <Pane name="streams" style={{ zIndex: 418 }}>
            {streams && (
              <GeoJSON
                key={`streams-${selected}`}
                data={streams}
                style={(feat?: Feature) => {
                  const o = (feat?.properties as { order?: number })?.order ?? 1;
                  return { color: "#1d4ed8", weight: Math.min(0.5 + o * 0.55, 4), opacity: 0.85 };
                }}
              />
            )}
          </Pane>

          {/* Clickable lake polygons. */}
          <Pane name="lakes" style={{ zIndex: 430 }}>
            {lakes && (
              <GeoJSON
                key={`lakes-${selected}-${inside.size}`}
                data={lakes}
                style={(feat?: Feature) => lakeStyle((feat?.properties as { osm_id: number }).osm_id)}
                onEachFeature={(feat: Feature, layer: Layer) => {
                  const p = feat.properties as unknown as LakeProps;
                  layer.on("click", () => selectLake(p.osm_id));
                  const label =
                    (p.name || "(unnamed tank)") +
                    (p.catchment_area_sqkm != null ? ` · catchment ${p.catchment_area_sqkm.toFixed(1)} km²` : "");
                  layer.bindTooltip(label, { sticky: true });
                }}
              />
            )}
          </Pane>
        </MapContainer>

        {selected != null && (
          <button
            onClick={reset}
            className="absolute top-3 right-3 z-[500] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-md shadow px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Reset view
          </button>
        )}

        <div className="absolute bottom-4 left-4 z-[500] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow px-3 py-2 text-xs space-y-1">
          <LegendDot color={C_SELECTED} label="Selected lake" />
          <LegendDot color={C_INSIDE} label="Tank in catchment (feeds it)" />
          <LegendDot color={C_DEFAULT} label="Other lakes" />
          <div className="flex items-center gap-2 pt-0.5">
            <span className="inline-block w-4 h-0.5 bg-blue-700" />
            <span className="text-slate-600 dark:text-slate-300">Feeder streams</span>
          </div>
        </div>
      </div>

      {/* Side panel */}
      <aside className="w-full md:w-[360px] shrink-0 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 overflow-y-auto bg-white dark:bg-slate-900 p-5 text-sm">
        {!sel ? (
          <div className="text-slate-600 dark:text-slate-400 space-y-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {cityDisplayName} — lake catchments
            </h1>
            <p>
              Every lake sits at the bottom of a catchment: the land whose rain
              drains into it. Click any lake to see its{" "}
              <strong className="text-slate-800 dark:text-slate-200">area of influence</strong>
              {" "}— the catchment it collects from, the feeder streams that carry
              water in, and the tanks within it that drain toward it.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Catchments and streams are terrain-derived from FABDEM 30 m
              elevation (WhiteboxTools flow routing). Rivers and canals are
              excluded — they are conduits, not catchments.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <header>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {sel.name || "(unnamed tank)"}
              </h2>
              {sel.name_ta && <div className="text-sm text-slate-500 dark:text-slate-400">{sel.name_ta}</div>}
            </header>

            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Catchment (area of influence)"
                value={
                  sel.catchment_area_sqkm != null
                    ? `${sel.catchment_area_sqkm.toFixed(1)} km²`
                    : loading
                      ? "…"
                      : "n/a"
                }
                emphasis
              />
              <Stat label="Lake surface" value={sel.lake_area_sqkm != null ? `${sel.lake_area_sqkm.toFixed(2)} km²` : "—"} />
            </div>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Drainage network
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Tanks in catchment" value={loading ? "…" : String(inside.size)} />
                <Stat label="Drains to river" value={sel.drains_to_river ? "Yes" : "No"} />
                <Stat
                  label="Distance to river"
                  value={sel.river_outlet_distance_km != null ? `${sel.river_outlet_distance_km.toFixed(1)} km` : "—"}
                />
              </div>
            </section>

            <section className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="font-semibold text-slate-600 dark:text-slate-300 mb-1">Coming next</div>
              Rainfall over this catchment, estimated rooftop-harvest potential,
              and buildings in the catchment.
            </section>

            <button onClick={reset} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              ← Reset view
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className={`mt-0.5 font-semibold tabular-nums ${
          emphasis ? "text-xl text-blue-700 dark:text-blue-300" : "text-base text-slate-900 dark:text-slate-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
    </div>
  );
}

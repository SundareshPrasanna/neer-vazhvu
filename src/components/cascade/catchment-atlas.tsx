"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, GeoJSON, Pane, useMap } from "react-leaflet";
import { CorporationBoundaries } from "@/components/map/corporation-boundaries";
import { tryGetPlaceConfig } from "@/lib/cities";
import L from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import { MapResizer } from "@/components/map-resizer";
import { useMapTiles } from "@/lib/utils/map-tiles";
import "leaflet/dist/leaflet.css";

interface LakeProps {
  osm_id: number;
  name: string;
  name_ta: string;
  catchment_area_sqkm: number | null;   // OWN / direct catchment (headline)
  total_upstream_sqkm?: number | null;   // full basin draining through it
  received_sqkm?: number | null;          // inherited from upstream tanks
  drains_to_osm_id?: number | null;        // cascade: where its overflow goes next
  drains_to_name?: string | null;
  drains_to_river_name?: string | null;    // the named river this lake's overflow reaches
  lake_area_sqkm: number | null;
  drains_to_river: boolean | null;
  river_outlet_distance_km: number | null;
  buildings_in_catchment?: number | null;
  rooftop_area_sqkm?: number | null;
  annual_rainfall_mm?: number | null;
  rooftop_harvest_ml?: number | null;
}

interface Props {
  cityId: string;
  cityDisplayName: string;
  center: [number, number];
  zoom?: number;
}

const C_DEFAULT = "#0ea5e9"; // sky-500    - other lakes
const C_SELECTED = "#e11d48"; // rose-600  - the lake you clicked
const C_UPSTREAM = "#2563eb"; // blue-600  - feeds it (upstream cascade)
const C_DOWNSTREAM = "#7c3aed"; // violet-600 - its overflow drains here (downstream cascade)

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
    if (!b.isValid()) return;
    // Snap to an integer zoom and jump without animation. Animating
    // through fractional zoom levels makes the raster tile layer redraw
    // mid-transition, which reads as flickering rectangles.
    const targetZoom = Math.min(14, Math.floor(map.getBoundsZoom(b, false, L.point(50, 50))));
    map.setView(b.getCenter(), targetZoom, { animate: false });
  }, [fitGeom, map]);
  useEffect(() => {
    if (resetKey > 0) map.setView(center, zoom, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  return null;
}

export function CatchmentAtlas({ cityId, cityDisplayName, center, zoom = 11 }: Props) {
  const tiles = useMapTiles();
  const [lakes, setLakes] = useState<FeatureCollection | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [catchment, setCatchment] = useState<Feature | null>(null);
  const [basin, setBasin] = useState<Geometry | null>(null);
  const [streams, setStreams] = useState<FeatureCollection | null>(null);
  const [downflow, setDownflow] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    fetch(`/data/cascade/${cityId}-cascade-lakes.geojson`)
      .then((r) => r.json())
      .then(setLakes)
      .catch(() => setLakes(null));
  }, [cityId]);

  // Lake lookup + the cascade graph (each lake -> the lake its overflow
  // drains into next), built from the embedded drains_to_osm_id.
  const { lakeById, adjUp, adjDown } = useMemo(() => {
    const lakeById = new Map<number, LakeProps>();
    const adjUp = new Map<number, number[]>();
    const adjDown = new Map<number, number[]>();
    lakes?.features.forEach((f) => {
      const p = f.properties as unknown as LakeProps;
      lakeById.set(p.osm_id, p);
      const to = p.drains_to_osm_id;
      if (to != null) {
        adjDown.set(p.osm_id, [...(adjDown.get(p.osm_id) ?? []), to]);
        adjUp.set(to, [...(adjUp.get(to) ?? []), p.osm_id]);
      }
    });
    return { lakeById, adjUp, adjDown };
  }, [lakes]);

  // Walk the cascade: upstream = everything that feeds the selected lake;
  // downstream = the chain its overflow flows down.
  const { upstream, downstream } = useMemo(() => {
    const walk = (start: number, adj: Map<number, number[]>) => {
      const seen = new Set<number>();
      const stack = [start];
      while (stack.length) {
        const n = stack.pop()!;
        for (const m of adj.get(n) ?? []) {
          if (!seen.has(m)) { seen.add(m); stack.push(m); }
        }
      }
      return seen;
    };
    if (selected == null) return { upstream: new Set<number>(), downstream: new Set<number>() };
    return { upstream: walk(selected, adjUp), downstream: walk(selected, adjDown) };
  }, [selected, adjUp, adjDown]);

  // Named lists for the panel: the ordered downstream chain (where the water
  // goes, lake by lake, ending at a river) and the immediate upstream feeders.
  const { downstreamChain, namedUpstream, unnamedUpstreamCount } = useMemo(() => {
    if (selected == null) return { downstreamChain: [], namedUpstream: [], unnamedUpstreamCount: 0 };
    // Downstream chain, with runs of unnamed tanks collapsed into one count.
    type Step = { osm_id: number | null; name: string; isRiver: boolean; unnamedRun?: number };
    const chain: Step[] = [];
    const seen = new Set<number>([selected]);
    let cur: number | null = selected;
    while (cur != null) {
      const p = lakeById.get(cur);
      const next = p?.drains_to_osm_id ?? null;
      const riverName = (p?.drains_to_river_name || "").trim();
      if (next == null) {
        if (riverName || p?.drains_to_river) {
          chain.push({ osm_id: null, name: riverName || "the river", isRiver: true });
        }
        break;
      }
      const nextLake = lakeById.get(next);
      const nm = (nextLake?.name || "").trim();
      if (nextLake && !nm) {
        const last = chain[chain.length - 1];
        if (last && last.unnamedRun) last.unnamedRun += 1;
        else chain.push({ osm_id: null, name: "", isRiver: false, unnamedRun: 1 });
      } else if (!nextLake) {
        // drains_to points at a body that was filtered out: treat as a river sink.
        chain.push({ osm_id: null, name: riverName || "an unnamed watercourse", isRiver: true });
      } else {
        chain.push({ osm_id: next, name: nm, isRiver: false });
      }
      if (!nextLake || seen.has(next)) break;
      seen.add(next);
      cur = next;
    }
    // Immediate feeders: named ones listed, unnamed collapsed to a count.
    const ids = adjUp.get(selected) ?? [];
    const named = ids
      .map((id) => ({ osm_id: id, name: (lakeById.get(id)?.name || "").trim() }))
      .filter((u) => u.name)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { downstreamChain: chain, namedUpstream: named, unnamedUpstreamCount: ids.length - named.length };
  }, [selected, lakeById, adjUp]);

  function selectLake(osmId: number) {
    setSelected(osmId);
    setCatchment(null);
    setBasin(null);
    setStreams(null);
    setDownflow(null);
    setLoading(true);
    fetch(`/api/cascade/${cityId}/catchment?osm_id=${osmId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setCatchment(d?.catchment ?? null);
        setBasin(d?.basin ?? null);
        setStreams(d?.streams ?? null);
        setDownflow(d?.downstream ?? null);
      })
      .finally(() => setLoading(false));
  }

  function reset() {
    setSelected(null);
    setCatchment(null);
    setBasin(null);
    setStreams(null);
    setDownflow(null);
    setResetKey((k) => k + 1);
  }

  // Deep link to the catchment methodology on the city's about page (Chennai
  // uses flat routing). The about page renders it under id="catchment-methodology".
  const methodologyHref =
    (cityId === "chennai" ? "/about" : `/${cityId}/about`) + "#catchment-methodology";

  function lakeStyle(osmId: number): PathOptions {
    const color =
      osmId === selected
        ? C_SELECTED
        : upstream.has(osmId)
          ? C_UPSTREAM
          : downstream.has(osmId)
            ? C_DOWNSTREAM
            : C_DEFAULT;
    const hi = osmId === selected || upstream.has(osmId) || downstream.has(osmId);
    return { color, weight: osmId === selected ? 2 : 1, fillColor: color, fillOpacity: hi ? 0.7 : 0.3 };
  }

  const sel = selected != null ? lakeById.get(selected) ?? null : null;

  return (
    <div className="h-full flex flex-col md:flex-row">
      <div className="relative flex-1 h-full">
        <MapContainer center={center} zoom={zoom} className="h-full w-full" preferCanvas zoomSnap={1}>
          <MapResizer />
          <MapController
            fitGeom={basin ? ({ type: "Feature", properties: {}, geometry: basin } as Feature) : catchment}
            resetKey={resetKey}
            center={center}
            zoom={zoom}
          />
          <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />

          {/* Region places (the MMR) overlay their corporation boundaries as
              context. No-op for single-city places. */}
          {tryGetPlaceConfig(cityId)?.placeKind === "region" && (
            <CorporationBoundaries cityId={cityId} />
          )}

          {/* Inherited area - the total basin (own + received) in a faint amber
              underneath; the part not covered by the bright own catchment above
              reads as "inherited from upstream." */}
          <Pane name="basin" style={{ zIndex: 405 }}>
            {basin && (
              <GeoJSON
                key={`basin-${selected}-${tiles.isDark ? "d" : "l"}`}
                data={{ type: "Feature", properties: {}, geometry: basin } as Feature}
                style={{
                  color: tiles.isDark ? "#fcd34d" : "#b45309", // boundary of the inherited basin
                  weight: 1.5,
                  dashArray: "5 5",
                  fillColor: "#fcd34d", // amber-300, a pale wash = inherited
                  fillOpacity: tiles.isDark ? 0.12 : 0.2,
                }}
              />
            )}
          </Pane>

          {/* Own catchment - bright amber. Deep boundary on light, gold on dark. */}
          <Pane name="catchment" style={{ zIndex: 410 }}>
            {catchment && (
              <GeoJSON
                key={`catch-${selected}-${tiles.isDark ? "d" : "l"}`}
                data={catchment}
                style={{
                  color: tiles.isDark ? "#fb923c" : "#9a3412", // solid orange boundary = direct catchment
                  weight: 2.5,
                  fillColor: tiles.isDark ? "#ea580c" : "#ea580c", // orange-600, strong = own/direct
                  fillOpacity: tiles.isDark ? 0.4 : 0.45,
                }}
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
                  // order-1 dendrites stay visible (~1.2px); trunks scale up.
                  return { color: "#1d4ed8", weight: Math.min(0.9 + o * 0.6, 4.5), opacity: 0.9 };
                }}
              />
            )}
          </Pane>

          {/* Downstream flow path: how this lake's overflow runs down the
              channel network through the cascade to the river. */}
          <Pane name="downflow" style={{ zIndex: 424 }}>
            {downflow && (
              <GeoJSON
                key={`downflow-${selected}`}
                data={downflow}
                style={() => ({ color: C_DOWNSTREAM, weight: 3, opacity: 0.95, dashArray: "1 6", lineCap: "round" })}
              />
            )}
          </Pane>

          {/* Clickable lake polygons. */}
          <Pane name="lakes" style={{ zIndex: 430 }}>
            {lakes && (
              <GeoJSON
                key={`lakes-${selected}-${upstream.size}-${downstream.size}`}
                data={lakes}
                style={(feat?: Feature) => lakeStyle((feat?.properties as { osm_id: number }).osm_id)}
                onEachFeature={(feat: Feature, layer: Layer) => {
                  const p = feat.properties as unknown as LakeProps;
                  layer.on("click", () => selectLake(p.osm_id));
                  const label =
                    (p.name || "(unnamed tank)") +
                    (p.catchment_area_sqkm != null ? ` - catchment ${p.catchment_area_sqkm.toFixed(1)} km²` : "");
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
          <LegendDot color={C_UPSTREAM} label="Upstream - feeds it" />
          <LegendDot color={C_DOWNSTREAM} label="Downstream - drains to" />
          <LegendDot color={C_DEFAULT} label="Other lakes" />
          <div className="flex items-center gap-2 pt-0.5">
            <span className="inline-block w-4 h-0.5 bg-blue-700" />
            <span className="text-slate-600 dark:text-slate-300">Feeder streams</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-0 border-t-2 border-dotted" style={{ borderColor: C_DOWNSTREAM }} />
            <span className="text-slate-600 dark:text-slate-300">Downstream flow</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#ea580c", opacity: 0.85 }} />
            <span className="text-slate-600 dark:text-slate-300">Direct catchment (drains straight in)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#fcd34d", opacity: 0.7 }} />
            <span className="text-slate-600 dark:text-slate-300">Inherited basin (from upstream)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-4 h-0 border-t-2 border-dashed border-amber-500"
            />
            <span className="text-slate-600 dark:text-slate-300">Catchment</span>
          </div>
        </div>
      </div>

      {/* Side panel */}
      <aside className="w-full md:w-[360px] shrink-0 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 overflow-y-auto bg-white dark:bg-slate-900 p-5 text-sm">
        {!sel ? (
          <div className="text-slate-600 dark:text-slate-400 space-y-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {cityDisplayName} - lake catchments
            </h1>
            <p>
              Every lake sits at the bottom of a catchment: the land whose rain
              drains into it. Click any lake to see its{" "}
              <strong className="text-slate-800 dark:text-slate-200">area of influence</strong>
              {" "}- the catchment it collects from, the feeder streams that carry
              water in, and the tanks within it that drain toward it.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Catchments and streams are terrain-derived from FABDEM 30 m
              elevation (WhiteboxTools flow routing). Rivers and canals are
              excluded - they are conduits, not catchments.
            </p>
            <Link
              href={methodologyHref}
              className="inline-block text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              How this is built: full methodology &rarr;
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <header>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {sel.name || "(unnamed tank)"}
              </h2>
              {sel.name_ta && <div className="text-sm text-slate-500 dark:text-slate-400">{sel.name_ta}</div>}
            </header>

            <Stat
              label="Direct catchment (area of influence)"
              value={
                sel.catchment_area_sqkm != null
                  ? `${sel.catchment_area_sqkm.toFixed(1)} km²`
                  : loading
                    ? "…"
                    : "n/a"
              }
              emphasis
            />
            {/* Cascade hierarchy: own + received = total upstream basin. */}
            {sel.total_upstream_sqkm != null &&
              sel.received_sqkm != null &&
              sel.received_sqkm > 0.05 && (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 text-xs space-y-1">
                  <Row label="Drains directly into it" value={`${(sel.catchment_area_sqkm ?? 0).toFixed(1)} km²`} />
                  <Row
                    label="Inherited from upstream tanks"
                    value={`+ ${sel.received_sqkm.toFixed(1)} km²`}
                  />
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-1">
                    <Row
                      label="Total upstream basin"
                      value={`${sel.total_upstream_sqkm.toFixed(1)} km²`}
                      bold
                    />
                  </div>
                </div>
              )}
            <Stat label="Lake surface" value={sel.lake_area_sqkm != null ? `${sel.lake_area_sqkm.toFixed(2)} km²` : "-"} />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Cascade
              </h3>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Overflow flows down to{downstreamChain.length > 0 ? ` (${downstream.size} tank${downstream.size === 1 ? "" : "s"} downstream)` : ""}
              </div>
              {downstreamChain.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Drains locally; no mapped downstream tank.</p>
              ) : (
                <ol className="space-y-1 mb-3">
                  {downstreamChain.map((d, i) => (
                    <li key={`${d.osm_id ?? "x"}-${i}`} style={{ paddingLeft: `${Math.min(i, 6) * 12}px` }}>
                      {d.unnamedRun ? (
                        <span className="text-sm text-slate-500 dark:text-slate-400 italic">
                          <span aria-hidden className="text-violet-500">↳</span> {d.unnamedRun} unnamed tank{d.unnamedRun === 1 ? "" : "s"}
                        </span>
                      ) : d.osm_id != null ? (
                        <button
                          onClick={() => selectLake(d.osm_id!)}
                          className="text-left text-sm text-violet-700 dark:text-violet-300 hover:underline"
                        >
                          <span aria-hidden className="text-violet-500">↳</span> {d.name}
                        </button>
                      ) : (
                        <span className="text-sm text-sky-700 dark:text-sky-300">
                          <span aria-hidden className="text-sky-500">↳</span> {d.name}
                          {/river|canal|nadi|watercourse/i.test(d.name) ? null : <span className="text-slate-400"> (river)</span>}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Fed by {upstream.size} upstream tank{upstream.size === 1 ? "" : "s"}
              </div>
              {namedUpstream.length === 0 && unnamedUpstreamCount === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Headwater; no mapped tank feeds it.</p>
              ) : (
                <ul className="space-y-1 mb-3">
                  {namedUpstream.slice(0, 8).map((u) => (
                    <li key={u.osm_id}>
                      <button
                        onClick={() => selectLake(u.osm_id)}
                        className="text-left text-sm text-blue-700 dark:text-blue-300 hover:underline"
                      >
                        <span aria-hidden className="text-blue-500">↑</span> {u.name}
                      </button>
                    </li>
                  ))}
                  {namedUpstream.length > 8 ? (
                    <li className="text-xs text-slate-400 dark:text-slate-500">
                      + {namedUpstream.length - 8} more named feeder{namedUpstream.length - 8 === 1 ? "" : "s"}
                    </li>
                  ) : null}
                  {unnamedUpstreamCount > 0 ? (
                    <li className="text-xs text-slate-400 dark:text-slate-500 italic">
                      <span aria-hidden className="text-blue-500/60">↑</span> + {unnamedUpstreamCount} unnamed feeder tank{unnamedUpstreamCount === 1 ? "" : "s"}
                    </li>
                  ) : null}
                </ul>
              )}

              <Stat
                label="Distance to river"
                value={sel.river_outlet_distance_km != null ? `${sel.river_outlet_distance_km.toFixed(1)} km` : "-"}
              />
            </section>

            {sel.rooftop_harvest_ml != null ? (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                  Rooftop rainwater harvest
                </h3>
                <Stat
                  label="Annual harvest potential"
                  value={`${sel.rooftop_harvest_ml.toLocaleString(undefined, { maximumFractionDigits: 0 })} million litres`}
                  emphasis
                />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Stat
                    label="Buildings in catchment"
                    value={(sel.buildings_in_catchment ?? 0).toLocaleString()}
                  />
                  <Stat
                    label="Rooftop area"
                    value={sel.rooftop_area_sqkm != null ? `${sel.rooftop_area_sqkm.toFixed(2)} km²` : "-"}
                  />
                  <Stat
                    label="Annual rainfall"
                    value={sel.annual_rainfall_mm != null ? `${sel.annual_rainfall_mm.toFixed(0)} mm` : "-"}
                  />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                  Rooftop area × annual rainfall × 0.8 runoff. Buildings from
                  Overture; rainfall from IMD normals.
                </p>
              </section>
            ) : (
              <section className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-3 text-xs text-slate-500 dark:text-slate-400">
                Rooftop-harvest potential not yet computed for this city.
              </section>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-700 pt-3">
              <button onClick={reset} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                ← Reset view
              </button>
              <Link
                href={methodologyHref}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
              >
                How this is built &rarr;
              </Link>
            </div>
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={bold ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-500 dark:text-slate-400"}>
        {label}
      </span>
      <span className={`tabular-nums ${bold ? "font-bold text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}`}>
        {value}
      </span>
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

"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { FeatureCollection, Feature } from "geojson";
import type { PathOptions } from "leaflet";
import { useMapTiles } from "@/lib/utils/map-tiles";

/**
 * Storm-water drainage network map for the NARRATIVE flood variant.
 *
 * The interactive flood variant is not usable for a city like Hyderabad: it
 * defaults to a modelled hazard-zone view and offers historical-hotspot and
 * sewerage view modes, none of which exist here. Rather than switch variants
 * and ship three empty view modes, this mounts a single focused map under the
 * narrative card stack.
 *
 * Layers are declared in the city's flood config, so no city id appears in
 * this component. Both layers are the drainage authority's OWN registers.
 */

export interface DrainageLayerSpec {
  /** Public URL of the GeoJSON. */
  url: string;
  /** Legend label. */
  label: string;
  /** "line" renders LineString/MultiLineString; "point" renders markers. */
  kind: "line" | "point";
  /** Stroke / fill colour. */
  color: string;
  /** Property to read a feature name from, for tooltips. */
  nameProp?: string;
}

const LINE_STYLE = (color: string): PathOptions => ({
  color,
  weight: 2,
  opacity: 0.85,
});

export function DrainageNetworkMap({
  center,
  zoom,
  layers,
}: {
  center: [number, number];
  zoom: number;
  layers: DrainageLayerSpec[];
}) {
  const tiles = useMapTiles();
  const [data, setData] = useState<Record<string, FeatureCollection | null>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    Promise.all(
      layers.map((l) =>
        fetch(l.url)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
          .then((d) => [l.url, d] as const),
      ),
    ).then((pairs) => {
      if (!live) return;
      setData(Object.fromEntries(pairs));
    });
    return () => {
      live = false;
    };
  }, [layers]);

  const toggle = (url: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });

  return (
    <div className="space-y-2">
      {/* Legend / toggles */}
      <div className="flex flex-wrap gap-3">
        {layers.map((l) => {
          const fc = data[l.url];
          const n = fc?.features?.length ?? null;
          const off = hidden.has(l.url);
          return (
            <button
              key={l.url}
              onClick={() => toggle(l.url)}
              className={`flex items-center gap-1.5 text-xs rounded-md border px-2 py-1 transition-colors ${
                off
                  ? "border-slate-200 dark:border-slate-700 text-slate-400"
                  : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: off ? "#cbd5e1" : l.color }}
              />
              {l.label}
              {n !== null && <span className="text-slate-500 tabular-nums">({n})</span>}
            </button>
          );
        })}
      </div>

      <div className="h-[420px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
        <MapContainer center={center} zoom={zoom} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer url={tiles.url} attribution={tiles.attribution} />
          {layers.map((l) => {
            const fc = data[l.url];
            if (!fc || hidden.has(l.url)) return null;

            if (l.kind === "point") {
              return fc.features.map((f: Feature, i: number) => {
                if (!f.geometry || f.geometry.type !== "Point") return null;
                const [lng, lat] = f.geometry.coordinates as [number, number];
                const name = l.nameProp
                  ? (f.properties?.[l.nameProp] as string | undefined)
                  : undefined;
                return (
                  <CircleMarker
                    key={`${l.url}-${i}`}
                    center={[lat, lng]}
                    radius={5}
                    pathOptions={{ color: l.color, fillColor: l.color, fillOpacity: 0.8, weight: 1 }}
                  >
                    {name && (
                      <Tooltip>
                        <span className="text-xs">{name}</span>
                      </Tooltip>
                    )}
                  </CircleMarker>
                );
              });
            }

            return (
              <GeoJSON
                key={l.url}
                data={fc}
                style={() => LINE_STYLE(l.color)}
                onEachFeature={(f, layer) => {
                  const name = l.nameProp
                    ? (f.properties?.[l.nameProp] as string | undefined)
                    : undefined;
                  const len = f.properties?.length_m as number | undefined;
                  if (name) {
                    layer.bindTooltip(
                      len ? `${name} - ${(len / 1000).toFixed(2)} km` : name,
                      { sticky: true },
                    );
                  }
                }}
              />
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";
import { MapResizer } from "@/components/map-resizer";
import { useMapTiles } from "@/lib/utils/map-tiles";
import "leaflet/dist/leaflet.css";
import type { RiverInfo } from "./rivers-client";

interface RiverGeoFeature {
  river_id: string;
  name: string;
  name_ta: string;
  length_km: number;
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString;
}

interface MapProps {
  rivers: RiverGeoFeature[];
  selectedRiverId: string | null;
  onSelectRiver: (id: string) => void;
  mapCenter: [number, number];
  mapZoom: number;
  riverInfo: Record<string, RiverInfo>;
}

// Simple river-color palette. Color comes from riverInfo.color (Tailwind
// stroke palette) but Leaflet expects hex; map common Tailwind classes.
const TAILWIND_HEX: Record<string, string> = {
  "stroke-blue-600":   "#2563eb",
  "stroke-cyan-600":   "#0891b2",
  "stroke-amber-600":  "#d97706",
  "stroke-emerald-600":"#059669",
  "stroke-violet-600": "#7c3aed",
};

function colorFor(info: RiverInfo | undefined): string {
  if (!info) return "#0ea5e9";
  return TAILWIND_HEX[info.color] ?? "#0ea5e9";
}

function lineStringsFromGeometry(g: GeoJSON.LineString | GeoJSON.MultiLineString): number[][][] {
  if (g.type === "LineString") return [g.coordinates];
  return g.coordinates;
}

export function RiversLeafletMap({
  rivers,
  selectedRiverId,
  onSelectRiver,
  mapCenter,
  mapZoom,
  riverInfo,
}: MapProps) {
  const tiles = useMapTiles();

  // Pre-compute polyline coordinate arrays in lat/lng order (Leaflet) per
  // river segment. GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
  const segments = useMemo(() => {
    const out: { riverId: string; coords: [number, number][]; key: string }[] = [];
    for (const r of rivers) {
      const lines = lineStringsFromGeometry(r.geometry);
      lines.forEach((line, i) => {
        const coords = line.map(([lng, lat]) => [lat, lng] as [number, number]);
        out.push({ riverId: r.river_id, coords, key: `${r.river_id}-${i}` });
      });
    }
    return out;
  }, [rivers]);

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      className="h-full w-full"
      scrollWheelZoom={true}
    >
      <MapResizer />
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />

      {segments.map(({ riverId, coords, key }) => {
        const info = riverInfo[riverId];
        const isSelected = riverId === selectedRiverId;
        const color = colorFor(info);
        return (
          <Polyline
            key={key}
            positions={coords}
            pathOptions={{
              color,
              weight: isSelected ? 5 : 3,
              opacity: isSelected ? 1.0 : 0.75,
            }}
            eventHandlers={{
              click: () => onSelectRiver(riverId),
              mouseover: (e) => {
                (e.target as L.Path).setStyle({ weight: 5, opacity: 1 });
              },
              mouseout: (e) => {
                (e.target as L.Path).setStyle({
                  weight: isSelected ? 5 : 3,
                  opacity: isSelected ? 1.0 : 0.75,
                });
              },
            }}
          >
            <Tooltip sticky>
              <strong>{info?.display_name ?? riverId}</strong>
              {info?.status && (
                <>
                  <br />
                  <span style={{ fontSize: "11px", color: "#64748b" }}>{info.status}</span>
                </>
              )}
            </Tooltip>
          </Polyline>
        );
      })}
    </MapContainer>
  );
}

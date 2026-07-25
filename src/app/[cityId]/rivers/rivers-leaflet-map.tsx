"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Tooltip, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { MapResizer } from "@/components/map-resizer";
import { useMapTiles } from "@/lib/utils/map-tiles";
import { useLanguage } from "@/lib/i18n/context";
import { FitToBounds, pointsBounds } from "@/components/map/fit-to-bounds";
import "leaflet/dist/leaflet.css";
import type { RiverInfo } from "./rivers-client";

export interface CpcbStationMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  river_id: string;
  has_readings: boolean;
  /** Latest annual midpoint BOD if known. */
  latest_bod: number | null;
  /** Latest annual midpoint DO if known. */
  latest_do: number | null;
  latest_year: number | null;
}

export interface IndustrialSourceMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  rivers_affected: string[];
}

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
  cpcbStations?: CpcbStationMarker[];
  industrialSources?: IndustrialSourceMarker[];
}

const INDUSTRIAL_TYPE_FILL: Record<string, string> = {
  industrial_estate: "#9333ea",   // purple
  tannery:           "#7c2d12",   // brown
  textile_dyeing:    "#be185d",   // pink
  discharge_zone:    "#0f172a",   // slate-900
  thermal_power:     "#1f2937",   // grey
  petrochemical:     "#0891b2",   // cyan
  chemical:          "#15803d",   // green
  port:              "#1d4ed8",   // blue
};

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
  cpcbStations = [],
  industrialSources = [],
}: MapProps) {
  const tiles = useMapTiles();
  const { language } = useLanguage();
  const localizedName = (info: RiverInfo | undefined, fallback: string) =>
    info ? (language === "ta" ? info.display_name_ta ?? info.display_name : info.display_name) : fallback;
  const localizedStatus = (info: RiverInfo | undefined) =>
    info ? (language === "ta" ? info.status_ta ?? info.status : info.status) : undefined;

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
      <FitToBounds
        bounds={pointsBounds(segments.flatMap((s) => s.coords))}
        resetKey={`rivers:${segments.length}`}
        maxZoom={12}
      />

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
            {/* maxWidth + normal wrapping: status strings can run long
                (Delhi's Yamuna) and Leaflet tooltips default to nowrap,
                which overflows the viewport (QA). */}
            <Tooltip sticky opacity={0.95}>
              <div style={{ maxWidth: 260, whiteSpace: "normal" }}>
                <strong>{localizedName(info, riverId)}</strong>
                {info?.status && (
                  <>
                    <br />
                    <span style={{ fontSize: "11px", color: "#64748b" }}>{localizedStatus(info)}</span>
                  </>
                )}
              </div>
            </Tooltip>
          </Polyline>
        );
      })}

      {cpcbStations.map((s) => {
        // Color reflects pollution severity: BOD > 6 = red, > 3 = amber,
        // otherwise green. Stations without readings render as grey.
        const fill = !s.has_readings || s.latest_bod === null
          ? "#94a3b8"
          : s.latest_bod > 6 ? "#dc2626"
          : s.latest_bod > 3 ? "#d97706"
          : "#16a34a";
        return (
          <CircleMarker
            key={`cpcb-${s.id}`}
            center={[s.lat, s.lng]}
            radius={6}
            pathOptions={{
              color: "#0f172a",
              weight: 1,
              fillColor: fill,
              fillOpacity: 0.85,
            }}
            eventHandlers={{ click: () => onSelectRiver(s.river_id) }}
          >
            <Tooltip>
              <strong>{s.name}</strong>
              {s.has_readings && s.latest_year !== null && (
                <>
                  <br />
                  <span style={{ fontSize: "11px" }}>
                    {s.latest_year}: BOD {s.latest_bod ?? "-"} mg/L - DO {s.latest_do ?? "-"} mg/L
                  </span>
                </>
              )}
              {!s.has_readings && (
                <>
                  <br />
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    NWMP station - no readings published
                  </span>
                </>
              )}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {industrialSources.map((s) => {
        const fill = INDUSTRIAL_TYPE_FILL[s.type] ?? "#475569";
        return (
          <CircleMarker
            key={`ind-${s.id}`}
            center={[s.lat, s.lng]}
            radius={5}
            pathOptions={{
              color: "#fbbf24",
              weight: 2,
              fillColor: fill,
              fillOpacity: 0.85,
            }}
            eventHandlers={{
              click: () => {
                if (s.rivers_affected.length > 0) onSelectRiver(s.rivers_affected[0]);
              },
            }}
          >
            <Tooltip>
              <strong>{s.name}</strong>
              <br />
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                {s.type.replace(/_/g, " ")} - affects {s.rivers_affected.join(", ")}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

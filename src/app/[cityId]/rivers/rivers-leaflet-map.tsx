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

/** A monitored outfall drain. Distinct from an industrial source because the
 *  question it answers is different: not "who pollutes here" but "is this
 *  drain still discharging". NO FLOW is the verification signal for a
 *  drain-trapping programme, so it is carried explicitly rather than being
 *  inferred from missing values. */
export interface DrainMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  group: string | null;
  /** Printed NO FLOW in the source report - i.e. trapped or dry, which is the
   *  outcome a trapping programme is trying to produce. Never set from an
   *  unreadable row. */
  noFlow: boolean;
  bod: number | null;
  cod: number | null;
  month: string | null;
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
  drains?: DrainMarker[];
}

// Drain fill by BOD against DPCC's 30 mg/l effluent standard. A drain printed
// NO FLOW is drawn hollow instead: it is the ABSENCE of discharge, which is
// what a trapping programme is trying to achieve, and colouring it like a
// clean-but-flowing drain would hide the distinction.
function drainFill(d: DrainMarker): string {
  if (d.noFlow) return "#334155";
  if (d.bod == null) return "#64748b";
  if (d.bod <= 30) return "#16a34a";
  if (d.bod <= 60) return "#eab308";
  if (d.bod <= 120) return "#f97316";
  return "#dc2626";
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
  drains = [],
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
              <div style={{ maxWidth: 280, whiteSpace: "normal", lineHeight: 1.35 }}>
                <strong>{localizedName(info, riverId)}</strong>
                {info?.status && (() => {
                  // Hover is a one-line orientation, not the story. Config
                  // authors have written paragraph-length statuses here - the
                  // Musi's ran to 459 characters against a 38-137 norm - which
                  // renders as an unreadable strip over a thin polyline. Clamp
                  // defensively; the full text is on the click panel.
                  const full = localizedStatus(info) ?? "";
                  const short = full.length > 150 ? `${full.slice(0, 147).trimEnd()}...` : full;
                  return (
                    <>
                      <br />
                      <span style={{ fontSize: "11px", color: "#64748b" }}>{short}</span>
                    </>
                  );
                })()}
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

      {drains
        // Null-coordinate guard: a drain can be monitored without being
        // locatable, and Leaflet throws "Invalid LatLng object" on a null centre.
        .filter((d) => typeof d.lat === "number" && typeof d.lng === "number")
        .map((d) => (
          <CircleMarker
            key={`drain-${d.id}`}
            center={[d.lat, d.lng]}
            radius={d.noFlow ? 4 : 6}
            pathOptions={{
              color: d.noFlow ? "#64748b" : "#0f172a",
              weight: d.noFlow ? 1.5 : 1,
              // Hollow + dashed when NO FLOW: the ABSENCE of discharge is the
              // outcome the trapping programme exists to produce, so it must
              // not look like a low-BOD drain that is still running.
              fillColor: drainFill(d),
              fillOpacity: d.noFlow ? 0.15 : 0.85,
              dashArray: d.noFlow ? "2 2" : undefined,
            }}
          >
            <Tooltip>
              <div style={{ maxWidth: 240, whiteSpace: "normal" }}>
                <strong>{d.name}</strong>
                {d.noFlow ? (
                  <>
                    <br />
                    <span style={{ fontSize: "11px", color: "#0f766e" }}>
                      NO FLOW recorded{d.month ? ` (${d.month})` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <br />
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      {d.bod != null ? `BOD ${d.bod} mg/l` : "BOD not read"}
                      {d.cod != null ? ` - COD ${d.cod} mg/l` : ""}
                      {d.bod != null && d.bod > 30 ? " - over the 30 mg/l standard" : ""}
                    </span>
                  </>
                )}
                {d.group && (
                  <>
                    <br />
                    <span style={{ fontSize: "10px", color: "#94a3b8" }}>{d.group}</span>
                  </>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

      {/* Second guard, deliberately duplicated from the caller: a source with
          no coordinates (Delhi's SMA CETP is real but unmapped in OSM) would
          reach Leaflet as center={[null, null]} and throw "Invalid LatLng
          object", taking the whole map down. Cheap insurance against a future
          caller that forgets to filter. */}
      {industrialSources
        .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
        .map((s) => {
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
